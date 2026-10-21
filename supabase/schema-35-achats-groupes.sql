-- ═════════ Marché de Gros CI — schéma 35 : achats groupés ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop ; une colonne nullable ajoutée à commandes (groupe_id).
--
-- Plusieurs acheteurs se regroupent sur UNE offre active (un produit, un vendeur), pour une zone de livraison.
--   • le vendeur fixe le prix et les paliers de réduction selon le volume, l'objectif, le minimum de participants,
--     la date limite et, s'il veut, une estimation des frais de transport mutualisés (répartis au prorata des quantités) ;
--     un acheteur peut PROPOSER un groupe : il reste « propose » tant que le vendeur ne l'a pas validé ;
--   • chacun s'inscrit avec SA quantité (une seule inscription par personne, verrou sur le groupe : pas de dépassement) ;
--     on garde le prix vu à l'inscription (prix_vu) ;
--   • statuts : propose → ouvert → seuil_atteint → en_attente_confirmation → confirme → termine ; ou annule / expire ;
--   • en attente de confirmation, le prix final est figé selon le volume ; CHAQUE participant confirme lui-même
--     (48 h). Si le prix final est plus haut que celui qu'il a vu, il doit le reconfirmer : jamais de hausse silencieuse ;
--   • tous confirmés et seuil tenu → une commande par participant (étape « confirmée »), le stock de l'offre baisse,
--     la commission (schéma 30) s'inscrit seule ; aucun paiement ;
--   • seuil non tenu à la date limite → « expire » ; chacun peut alors, s'il le veut, passer en achat individuel
--     (une proposition normale au vendeur, nego_ouvrir) : rien n'est fait à sa place.

create table if not exists public.groupes_achat (
  id                uuid primary key default gen_random_uuid(),
  offre_id          uuid not null references public.offres (id) on delete restrict,
  vendeur_id        uuid not null,
  createur_id       uuid not null,
  produit           text not null,
  unite             text not null,
  zone              text not null check (char_length(zone) between 2 and 120),
  region_slug       text,
  objectif          numeric not null check (objectif > 0),
  min_participants  int not null default 2 check (min_participants between 2 and 50),
  date_limite       timestamptz not null,
  prix_base         numeric check (prix_base > 0),
  paliers           jsonb not null default '[]'::jsonb,
  frais_transport   numeric check (frais_transport >= 0),
  statut            text not null check (statut in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation', 'confirme', 'termine', 'annule', 'expire')),
  prix_final        numeric,
  confirmer_avant   timestamptz,
  note              text check (char_length(note) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists groupes_achat_statut on public.groupes_achat (statut, date_limite);
create index if not exists groupes_achat_offre on public.groupes_achat (offre_id);

create table if not exists public.groupe_participants (
  id          uuid primary key default gen_random_uuid(),
  groupe_id   uuid not null references public.groupes_achat (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  quantite    numeric not null check (quantite > 0),
  prix_vu     numeric,
  statut      text not null default 'inscrit' check (statut in ('inscrit', 'confirme', 'retire')),
  confirme_le timestamptz,
  commande_id uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (groupe_id, user_id)
);
create index if not exists groupe_participants_user on public.groupe_participants (user_id, created_at desc);

alter table public.groupes_achat enable row level security;
alter table public.groupe_participants enable row level security;
revoke all on public.groupes_achat, public.groupe_participants from anon, authenticated;

alter table public.commandes add column if not exists groupe_id uuid references public.groupes_achat (id) on delete set null;

-- Annulation d'une commande issue d'un groupe : le stock revient sur l'offre du groupe (même signature qu'avant).
create or replace function public._cmd_rendre_stock(c public.commandes) returns void
language plpgsql security definer set search_path = public as $$
declare n public.negociations;
begin
  if coalesce(c.quantite, 0) <= 0 then return; end if;
  if c.groupe_id is not null then
    update public.offres set quantity = coalesce(quantity, 0) + c.quantite where id = (select offre_id from public.groupes_achat where id = c.groupe_id);
    return;
  end if;
  if c.negociation_id is null then return; end if;
  select * into n from public.negociations where id = c.negociation_id;
  if n.id is null then return; end if;
  if n.cible = 'offre' then update public.offres set quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id;
  else update public.demandes set quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id; end if;
end $$;

-- prix pour un volume total : le palier le plus avantageux atteint, sinon le prix de base
create or replace function public._groupe_prix(g public.groupes_achat, total numeric) returns numeric
language sql immutable set search_path = public as $$
  select coalesce((select min((p->>'prix')::numeric) from jsonb_array_elements(g.paliers) p where (p->>'quantite')::numeric <= total), g.prix_base);
$$;
create or replace function public._groupe_total(p_id uuid) returns numeric
language sql stable set search_path = public as $$
  select coalesce(sum(quantite), 0) from public.groupe_participants where groupe_id = p_id and statut <> 'retire';
$$;
create or replace function public._groupe_n(p_id uuid) returns int
language sql stable set search_path = public as $$
  select count(*)::int from public.groupe_participants where groupe_id = p_id and statut <> 'retire';
$$;

-- paliers : 1 à 5, quantités croissantes, prix décroissants et inférieurs au prix de base
create or replace function public._groupe_paliers(p jsonb, base numeric) returns jsonb
language plpgsql immutable set search_path = public as $$
declare x jsonb; q numeric := 0; pr numeric := base; out jsonb := '[]'::jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return '[]'::jsonb; end if;
  if jsonb_array_length(p) > 5 then raise exception 'Cinq paliers au plus.'; end if;
  for x in select * from jsonb_array_elements(p) order by (value->>'quantite')::numeric loop
    if (x->>'quantite')::numeric <= q then raise exception 'Les paliers doivent avoir des quantités croissantes.'; end if;
    if (x->>'prix')::numeric <= 0 or (x->>'prix')::numeric >= pr then raise exception 'Chaque palier doit baisser le prix.'; end if;
    q := (x->>'quantite')::numeric; pr := (x->>'prix')::numeric;
    out := out || jsonb_build_object('quantite', q, 'prix', pr);
  end loop;
  return out;
end $$;

-- recalcul du statut pendant les inscriptions (ouvert ↔ seuil_atteint)
create or replace function public._groupe_recalculer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat;
begin
  select * into g from public.groupes_achat where id = p_id;
  if g.statut not in ('ouvert', 'seuil_atteint') then return; end if;
  update public.groupes_achat set statut = case when public._groupe_total(g.id) >= g.objectif and public._groupe_n(g.id) >= g.min_participants then 'seuil_atteint' else 'ouvert' end,
    updated_at = now() where id = g.id;
end $$;

-- ——— Créer (vendeur : ouvert) ou proposer (acheteur : propose, il s'inscrit avec sa quantité) ———
create or replace function public.groupe_creer(p_offre uuid, p_zone text, p_objectif numeric, p_min int, p_date_limite timestamptz,
  p_paliers jsonb, p_frais numeric, p_ma_quantite numeric, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); o public.offres; g uuid; vend boolean; r text; ouverts int;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into o from public.offres where id = p_offre;
  if o.id is null or o.status <> 'active' then raise exception 'Cette offre n''est plus disponible.'; end if;
  if o.price is null or o.price <= 0 then raise exception 'Un achat groupé demande une offre avec un prix.'; end if;
  vend := o.user_id = me;
  if p_objectif is null or p_objectif <= 0 then raise exception 'Indiquez la quantité visée.'; end if;
  if p_objectif > coalesce(o.quantity, 0) then raise exception 'L''objectif dépasse la quantité de l''offre (%).', o.quantity; end if;
  if p_date_limite is null or p_date_limite < now() + interval '6 hours' or p_date_limite > now() + interval '30 days' then
    raise exception 'Date limite : entre 6 heures et 30 jours.'; end if;
  if coalesce(p_min, 2) not between 2 and 50 then raise exception 'Entre 2 et 50 participants au minimum.'; end if;
  r := public.texte_refus(concat_ws(' · ', p_zone, p_note)); if r is not null and not public.est_admin() then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  select count(*) into ouverts from public.groupes_achat where createur_id = me and statut in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation');
  if ouverts >= 10 then raise exception 'Limite : 10 achats groupés en cours.'; end if;
  if not vend and coalesce(p_ma_quantite, 0) <= 0 then raise exception 'Indiquez votre quantité.'; end if;
  insert into public.groupes_achat (offre_id, vendeur_id, createur_id, produit, unite, zone, region_slug, objectif, min_participants, date_limite,
    prix_base, paliers, frais_transport, statut, note)
  values (o.id, o.user_id, me, coalesce(o.product_label, 'Produit'), coalesce(o.unit, 'kg'), btrim(p_zone), o.region_slug, p_objectif, coalesce(p_min, 2), p_date_limite,
    o.price, case when vend then public._groupe_paliers(p_paliers, o.price) else '[]'::jsonb end, case when vend then p_frais end,
    case when vend then 'ouvert' else 'propose' end, nullif(btrim(p_note), ''))
  returning id into g;
  if not vend then
    if p_ma_quantite > p_objectif then raise exception 'Votre quantité dépasse l''objectif.'; end if;
    insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g, me, p_ma_quantite, o.price);
  end if;
  return g;
end $$;

-- ——— Le vendeur valide un groupe proposé (prix, paliers, frais) ou le refuse ———
create or replace function public.groupe_valider(p_id uuid, p_oui boolean, p_paliers jsonb, p_frais numeric) returns void
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null or g.vendeur_id <> auth.uid() then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut <> 'propose' then raise exception 'Ce groupe n''attend pas votre validation.'; end if;
  if not p_oui then update public.groupes_achat set statut = 'annule', updated_at = now() where id = g.id; return; end if;
  update public.groupes_achat set statut = 'ouvert', paliers = public._groupe_paliers(p_paliers, g.prix_base), frais_transport = p_frais, updated_at = now() where id = g.id;
  perform public._groupe_recalculer(g.id);
end $$;

-- ——— S'inscrire ou changer sa quantité ———
create or replace function public.groupe_rejoindre(p_id uuid, p_quantite numeric) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.groupes_achat; o public.offres; autres numeric; prix numeric;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into g from public.groupes_achat where id = p_id for update;   -- un seul inscrit à la fois : pas de dépassement
  if g.id is null then raise exception 'Achat groupé introuvable.'; end if;
  if g.vendeur_id = me then raise exception 'Vous êtes le vendeur de ce groupe.'; end if;
  if g.statut not in ('ouvert', 'seuil_atteint') then raise exception 'Les inscriptions sont fermées.'; end if;
  if g.date_limite <= now() then raise exception 'La date limite est passée.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Indiquez votre quantité.'; end if;
  select * into o from public.offres where id = g.offre_id;
  if o.status <> 'active' then raise exception 'L''offre du vendeur n''est plus disponible.'; end if;
  select coalesce(sum(quantite), 0) into autres from public.groupe_participants where groupe_id = g.id and statut <> 'retire' and user_id <> me;
  if autres + p_quantite > coalesce(o.quantity, 0) then raise exception 'Il reste % % disponibles dans ce groupe.', greatest(0, coalesce(o.quantity, 0) - autres), g.unite; end if;
  prix := public._groupe_prix(g, autres + p_quantite);
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g.id, me, p_quantite, prix)
  on conflict (groupe_id, user_id) do update set quantite = excluded.quantite, prix_vu = excluded.prix_vu, statut = 'inscrit', confirme_le = null, updated_at = now();
  perform public._groupe_recalculer(g.id);
  return json_build_object('prix', prix, 'total', autres + p_quantite);
end $$;

create or replace function public.groupe_quitter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut not in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation') then raise exception 'Ce groupe est déjà confirmé ou fermé.'; end if;
  update public.groupe_participants set statut = 'retire', updated_at = now() where groupe_id = g.id and user_id = auth.uid() and statut <> 'retire';
  if not found then raise exception 'Vous ne participez pas à ce groupe.'; end if;
  if g.statut = 'en_attente_confirmation' then perform public._groupe_evaluer(g.id); else perform public._groupe_recalculer(g.id); end if;
end $$;

-- ——— Le vendeur lance la confirmation (seuil atteint) ; le prix final est figé selon le volume ———
create or replace function public.groupe_lancer(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; pf numeric;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null or g.vendeur_id <> auth.uid() then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut <> 'seuil_atteint' then raise exception 'Le seuil n''est pas atteint.'; end if;
  pf := public._groupe_prix(g, public._groupe_total(g.id));
  update public.groupes_achat set statut = 'en_attente_confirmation', prix_final = pf, confirmer_avant = now() + interval '48 hours', updated_at = now() where id = g.id;
  update public.groupe_participants set statut = 'inscrit', confirme_le = null where groupe_id = g.id and statut = 'confirme';
end $$;

-- évaluation pendant la confirmation : nouveau prix si des participants se retirent (reconfirmation si hausse), confirmation finale
create or replace function public._groupe_evaluer(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; o public.offres; total numeric; pf numeric; p record; cid uuid; num text;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.statut <> 'en_attente_confirmation' then return g.statut; end if;
  total := public._groupe_total(g.id);
  if total < g.objectif or public._groupe_n(g.id) < g.min_participants then
    if g.confirmer_avant <= now() or g.date_limite <= now() then update public.groupes_achat set statut = 'expire', updated_at = now() where id = g.id; return 'expire'; end if;
    update public.groupes_achat set statut = 'ouvert', prix_final = null, confirmer_avant = null, updated_at = now() where id = g.id;
    update public.groupe_participants set statut = 'inscrit', confirme_le = null where groupe_id = g.id and statut = 'confirme';
    return 'ouvert';
  end if;
  pf := public._groupe_prix(g, total);
  if pf > coalesce(g.prix_final, pf) then   -- le prix monte : tout le monde reconfirme
    update public.groupe_participants set statut = 'inscrit', confirme_le = null where groupe_id = g.id and statut = 'confirme';
  end if;
  update public.groupes_achat set prix_final = pf, updated_at = now() where id = g.id;
  if exists (select 1 from public.groupe_participants where groupe_id = g.id and statut = 'inscrit') then return 'en_attente_confirmation'; end if;
  -- tous confirmés : stock, puis une commande par participant
  select * into o from public.offres where id = g.offre_id for update;
  if o.status <> 'active' or coalesce(o.quantity, 0) < total then return 'stock_insuffisant'; end if;
  update public.offres set quantity = quantity - total where id = o.id;
  update public.offres set status = 'retiree' where id = o.id and quantity <= 0 and status = 'active';
  for p in select * from public.groupe_participants where groupe_id = g.id and statut = 'confirme' loop
    num := 'MDG-G-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || p.id::text), 1, 6));
    insert into public.commandes (numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
      ville_depart, lieu_livraison, commission_montant, mode_transport, validation, etat, etape, groupe_id)
    values (num, null, g.vendeur_id, p.user_id, g.vendeur_id, g.produit, p.quantite, g.unite, pf, round(pf * p.quantite, 0),
      left(o.city, 80), left(g.zone, 120), round(round(pf * p.quantite, 0) * 0.035, 0), 'vendeur', 'declaration', 'en_cours', 'confirmee', g.id)
    returning id into cid;
    perform public._cmd_journal(cid, 'confirmee', p.user_id, 'acheteur', 'declaration', null, null, null, 'Achat groupé : participation confirmée');
    update public.groupe_participants set commande_id = cid where id = p.id;
  end loop;
  update public.groupes_achat set statut = 'confirme', updated_at = now() where id = g.id;
  return 'confirme';
end $$;

-- ——— Chaque participant confirme (ou se retire) ———
create or replace function public.groupe_confirmer(p_id uuid, p_oui boolean) returns text
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut <> 'en_attente_confirmation' then raise exception 'Ce groupe n''attend pas de confirmation.'; end if;
  if g.confirmer_avant <= now() then raise exception 'Le délai de confirmation est passé.'; end if;
  update public.groupe_participants set statut = case when p_oui then 'confirme' else 'retire' end, confirme_le = case when p_oui then now() end, updated_at = now()
  where groupe_id = g.id and user_id = auth.uid() and statut <> 'retire';
  if not found then raise exception 'Vous ne participez pas à ce groupe.'; end if;
  return public._groupe_evaluer(g.id);
end $$;

create or replace function public.groupe_annuler(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null or auth.uid() not in (g.vendeur_id, g.createur_id) then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut not in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation') then raise exception 'Ce groupe ne peut plus être annulé ici.'; end if;
  update public.groupes_achat set statut = 'annule', updated_at = now() where id = g.id;
end $$;

-- ——— Échéances (pg_cron, toutes les 15 minutes) ———
create or replace function public.groupes_echeances() returns int
language plpgsql security definer set search_path = public as $$
declare g record; n int := 0;
begin
  -- date limite passée sans seuil → expiré ; avec seuil → confirmation lancée (le vendeur s'y est engagé en ouvrant le groupe)
  for g in select * from public.groupes_achat where statut in ('propose', 'ouvert', 'seuil_atteint') and date_limite <= now() for update skip locked loop
    if g.statut = 'seuil_atteint' then
      update public.groupes_achat set statut = 'en_attente_confirmation', prix_final = public._groupe_prix(g::public.groupes_achat, public._groupe_total(g.id)),
        confirmer_avant = now() + interval '48 hours', updated_at = now() where id = g.id;
    else update public.groupes_achat set statut = 'expire', updated_at = now() where id = g.id; end if;
    n := n + 1;
  end loop;
  -- délai de confirmation passé : ceux qui n'ont pas confirmé sont retirés (ils n'ont rien accepté), puis évaluation
  for g in select * from public.groupes_achat where statut = 'en_attente_confirmation' and confirmer_avant <= now() for update skip locked loop
    update public.groupe_participants set statut = 'retire', updated_at = now() where groupe_id = g.id and statut = 'inscrit';
    perform public._groupe_evaluer(g.id); n := n + 1;
  end loop;
  -- confirmé → terminé quand toutes ses commandes sont terminées ou annulées
  update public.groupes_achat x set statut = 'termine', updated_at = now()
  where x.statut = 'confirme' and not exists (select 1 from public.commandes c where c.groupe_id = x.id and c.etat not in ('terminee', 'annulee'));
  return n;
end $$;

-- ——— Lectures ———
create or replace function public.groupe_detail(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', g.id, 'offre_id', g.offre_id, 'produit', g.produit, 'unite', g.unite, 'zone', g.zone, 'region', g.region_slug,
    'objectif', g.objectif, 'min_participants', g.min_participants, 'date_limite', g.date_limite, 'prix_base', g.prix_base, 'paliers', g.paliers,
    'frais_transport', g.frais_transport, 'statut', g.statut, 'prix_final', g.prix_final, 'confirmer_avant', g.confirmer_avant, 'note', g.note,
    'vendeur_id', g.vendeur_id, 'vendeur', coalesce(public.nom_public(g.vendeur_id), 'Vendeur'), 'vendeur_verifie', public.identite_ok(g.vendeur_id),
    'je_suis_vendeur', g.vendeur_id = auth.uid(), 'je_suis_createur', g.createur_id = auth.uid(),
    'total', public._groupe_total(g.id), 'participants', public._groupe_n(g.id),
    'prix_courant', public._groupe_prix(g, public._groupe_total(g.id)),
    'stock_offre', (select quantity from public.offres where id = g.offre_id), 'offre_active', (select status = 'active' from public.offres where id = g.offre_id),
    'parts', (select coalesce(json_agg(json_build_object('quantite', p.quantite, 'statut', p.statut, 'moi', p.user_id = auth.uid()) order by p.created_at), '[]'::json)
              from public.groupe_participants p where p.groupe_id = g.id and p.statut <> 'retire'),
    'moi', (select json_build_object('quantite', p.quantite, 'prix_vu', p.prix_vu, 'statut', p.statut, 'commande_id', p.commande_id)
            from public.groupe_participants p where p.groupe_id = g.id and p.user_id = auth.uid()))
  from public.groupes_achat g where g.id = p_id;
$$;

create or replace function public.groupes_liste(p_vue text, p_produit text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.date_limite), '[]'::json) from (
    select g.id, g.produit, g.unite, g.zone, g.region_slug region, g.objectif, g.min_participants, g.date_limite, g.prix_base, g.statut,
      public._groupe_total(g.id) total, public._groupe_n(g.id) participants, public._groupe_prix(g, public._groupe_total(g.id)) prix_courant,
      (select min((p->>'prix')::numeric) from jsonb_array_elements(g.paliers) p) meilleur_prix,
      coalesce(public.nom_public(g.vendeur_id), 'Vendeur') vendeur, g.vendeur_id = auth.uid() je_suis_vendeur,
      (select p.statut from public.groupe_participants p where p.groupe_id = g.id and p.user_id = auth.uid()) mon_statut
    from public.groupes_achat g
    where (p_vue = 'ouverts' and g.statut in ('ouvert', 'seuil_atteint') and g.date_limite > now() and (p_produit is null or g.offre_id in (select id from public.offres where product_slug = p_produit)))
       or (p_vue = 'miens' and (g.vendeur_id = auth.uid() or g.createur_id = auth.uid() or exists (select 1 from public.groupe_participants p where p.groupe_id = g.id and p.user_id = auth.uid())))
    order by g.date_limite limit 100) x;
$$;

revoke all on function public._groupe_prix(public.groupes_achat, numeric), public._groupe_total(uuid), public._groupe_n(uuid), public._groupe_paliers(jsonb, numeric),
  public._groupe_recalculer(uuid), public._groupe_evaluer(uuid), public.groupes_echeances() from public, anon, authenticated;
revoke all on function public.groupe_creer(uuid, text, numeric, int, timestamptz, jsonb, numeric, numeric, text), public.groupe_valider(uuid, boolean, jsonb, numeric),
  public.groupe_rejoindre(uuid, numeric), public.groupe_quitter(uuid), public.groupe_lancer(uuid), public.groupe_confirmer(uuid, boolean), public.groupe_annuler(uuid) from public, anon;
grant execute on function public.groupe_creer(uuid, text, numeric, int, timestamptz, jsonb, numeric, numeric, text), public.groupe_valider(uuid, boolean, jsonb, numeric),
  public.groupe_rejoindre(uuid, numeric), public.groupe_quitter(uuid), public.groupe_lancer(uuid), public.groupe_confirmer(uuid, boolean), public.groupe_annuler(uuid) to authenticated;
revoke all on function public.groupe_detail(uuid), public.groupes_liste(text, text) from public;
grant execute on function public.groupe_detail(uuid), public.groupes_liste(text, text) to anon, authenticated;

select cron.schedule('mdg-groupes-echeances', '*/15 * * * *', 'select public.groupes_echeances()');

-- ——— Notifications (fonction pousser, cas 11) : changement de statut du groupe, ou reconfirmation demandée ———
create or replace function public.push_groupe() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; corps jsonb;
begin
  if tg_table_name = 'groupes_achat' then
    if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then return new; end if;
    if new.statut not in ('propose', 'seuil_atteint', 'en_attente_confirmation', 'confirme', 'expire', 'annule') then return new; end if;
    corps := jsonb_build_object('groupe_id', new.id, 'statut', new.statut);
  else
    if not (old.statut = 'confirme' and new.statut = 'inscrit') then return new; end if;
    corps := jsonb_build_object('groupe_id', new.groupe_id, 'reconfirmer', new.user_id);
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := corps, headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_groupe() from public, anon, authenticated;
create or replace trigger groupes_achat_push after insert or update of statut on public.groupes_achat for each row execute function public.push_groupe();
create or replace trigger groupe_participants_push after update of statut on public.groupe_participants for each row execute function public.push_groupe();
