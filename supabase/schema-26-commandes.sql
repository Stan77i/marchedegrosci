-- ═════════ Marché de Gros CI — schéma 26 : les commandes (suivi après l'accord) ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop.
--
-- Principe :
--   • une commande naît d'un accord conclu (négociation « conclue ») : une seule commande par accord ;
--   • l'une des parties la crée (mode de transport, lieu de livraison), l'autre la confirme → « Commande confirmée » ;
--   • les étapes n'avancent que par les fonctions ci-dessous, qui vérifient QUI agit et DANS QUEL ORDRE ;
--     chaque étape est écrite dans un journal horodaté (commande_etapes) : qui, quand, où, avec quelle preuve ;
--   • validation « declaration » : le vendeur déclare le chargement, l'acheteur l'arrivée et la réception
--     (chauffeur sans l'application). La validation « code » (codes à usage unique saisis par le chauffeur) arrive
--     avec l'espace chauffeur : la colonne est prête, la fonction la refuse pour l'instant ;
--   • commission de 3,5 % : calculée par le serveur et affichée au vendeur, statut « non_activee ».
--     RIEN n'est encaissé : il n'y a pas de paiement dans l'application ;
--   • annulation d'un commun accord tant que la marchandise n'est pas chargée (le stock revient sur l'annonce) ;
--     ensuite, litige (jusqu'à 48 h après la réception), tranché par l'administration ;
--   • tables fermées (RLS sans politique, aucun droit direct) : lecture et écriture par les fonctions seulement.
--
-- Corrigé au passage dans nego_agir (appliqué en base par remplacement ciblé) : la quantité déjà vendue était
-- comptée deux fois (le stock de l'annonce baisse déjà après chaque accord, schéma 12). Désormais :
--   « si prop.quantite > quantité restante → Quantité plus disponible : il reste % sur cette annonce. »

-- ——— 1) Tables ———
create table if not exists public.commandes (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null unique,
  negociation_id     uuid unique references public.negociations (id) on delete set null,
  vendeur_id         uuid not null references auth.users (id) on delete cascade,
  acheteur_id        uuid not null references auth.users (id) on delete cascade,
  cree_par           uuid not null,
  produit            text,
  quantite           numeric,
  unite              text,
  prix_unitaire      numeric,
  montant            numeric,
  ville_depart       text check (char_length(ville_depart) <= 80),
  lieu_livraison     text check (char_length(lieu_livraison) <= 120),
  commission_taux    numeric not null default 0.035,
  commission_montant numeric,
  commission_statut  text not null default 'non_activee' check (commission_statut in ('non_activee')),
  mode_transport     text not null check (mode_transport in ('reseau', 'acheteur', 'vendeur')),
  validation         text not null default 'declaration' check (validation in ('declaration', 'code')),
  transporteur_id    uuid,
  etat               text not null default 'a_confirmer' check (etat in ('a_confirmer', 'en_cours', 'terminee', 'annulee', 'litige')),
  etape              text check (etape in ('confirmee', 'preparation', 'chargement', 'transport', 'transbordement', 'arrivee', 'reception', 'terminee')),
  annulation_par     uuid,
  litige_par         uuid,
  litige_motif       text check (char_length(litige_motif) <= 300),
  litige_le          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  termine_le         timestamptz
);
create index if not exists commandes_vendeur on public.commandes (vendeur_id, updated_at desc);
create index if not exists commandes_acheteur on public.commandes (acheteur_id, updated_at desc);

create table if not exists public.commande_etapes (
  id          uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  evenement   text not null check (evenement in ('creee', 'confirmee', 'refusee', 'preparation', 'chargement', 'transport', 'transbordement',
                'arrivee', 'reception', 'terminee', 'annulation_demandee', 'annulation_refusee', 'annulee', 'litige')),
  par         uuid,
  role        text not null check (role in ('vendeur', 'acheteur', 'chauffeur', 'admin', 'systeme')),
  preuve      text not null default 'declaration' check (preuve in ('declaration', 'code', 'gps', 'auto', 'admin')),
  lieu        text check (char_length(lieu) <= 120),
  lat         double precision check (lat is null or lat between -90 and 90),
  lon         double precision check (lon is null or lon between -180 and 180),
  note        text check (char_length(note) <= 300),
  at          timestamptz not null default now()
);
create index if not exists commande_etapes_cmd on public.commande_etapes (commande_id, at);

alter table public.commandes enable row level security;
alter table public.commande_etapes enable row level security;
revoke all on public.commandes, public.commande_etapes from anon, authenticated;
grant select on public.commandes, public.commande_etapes to service_role;

-- ——— 2) Outils internes ———
create or replace function public._cmd_role(c public.commandes, u uuid) returns text
language sql immutable set search_path = public as $$
  select case when u = c.vendeur_id then 'vendeur' when u = c.acheteur_id then 'acheteur' end;
$$;

create or replace function public._cmd_texte(t text, n int) returns text
language plpgsql stable set search_path = public as $$
declare v text := nullif(btrim(coalesce(t, '')), ''); r text;
begin
  if v is null then return null; end if;
  if char_length(v) > n then raise exception 'Texte trop long (% caractères au plus).', n; end if;
  r := public.texte_refus(v);
  if r is not null then raise exception '%', r; end if;
  return v;
end $$;

create or replace function public._cmd_journal(p_cmd uuid, p_ev text, p_par uuid, p_role text, p_preuve text,
  p_lieu text default null, p_lat double precision default null, p_lon double precision default null, p_note text default null) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.commande_etapes (commande_id, evenement, par, role, preuve, lieu, lat, lon, note)
  values (p_cmd, p_ev, p_par, p_role, p_preuve, p_lieu, p_lat, p_lon, p_note);
  update public.commandes set updated_at = now() where id = p_cmd;
$$;

-- le stock pris par l'accord revient sur l'annonce quand la commande est annulée (l'annonce n'est pas remise en ligne)
create or replace function public._cmd_rendre_stock(c public.commandes) returns void
language plpgsql volatile security definer set search_path = public as $$
declare n public.negociations;
begin
  if c.negociation_id is null or coalesce(c.quantite, 0) <= 0 then return; end if;
  select * into n from public.negociations where id = c.negociation_id;
  if n.id is null then return; end if;
  if n.cible = 'offre' then update public.offres set quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id;
  else update public.demandes set quantity = coalesce(quantity, 0) + c.quantite where id = n.cible_id; end if;
end $$;

-- ——— 3) Créer une commande à partir d'un accord ———
create or replace function public.commande_creer(p_nego uuid, p_mode text, p_lieu text default null, p_validation text default 'declaration') returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; v uuid; a uuid; dep text; mt numeric; cid uuid := gen_random_uuid(); lieu text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.statut <> 'conclue' then raise exception 'La commande se crée après un accord conclu.'; end if;
  if exists (select 1 from public.commandes where negociation_id = p_nego) then raise exception 'Une commande existe déjà pour cet accord.'; end if;
  if p_mode not in ('reseau', 'acheteur', 'vendeur') then raise exception 'Choisissez qui transporte la marchandise.'; end if;
  if coalesce(p_validation, 'declaration') = 'code' then raise exception 'Les codes de validation arrivent avec l''espace chauffeur. Choisissez « sans code » pour l''instant.'; end if;
  if p_validation is not null and p_validation <> 'declaration' then raise exception 'Mode de validation inconnu.'; end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if n.cible = 'offre' then v := n.proprio_id; a := n.auteur_id; select city into dep from public.offres where id = n.cible_id;
  else v := n.auteur_id; a := n.proprio_id; end if;
  mt := case when n.prix_final is not null and coalesce(n.quantite_finale, n.quantite) is not null then round(n.prix_final * coalesce(n.quantite_finale, n.quantite)) end;
  insert into public.commandes (id, numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
    ville_depart, lieu_livraison, commission_montant, mode_transport, validation)
  values (cid, 'MDG-C-' || to_char(now(), 'YYMMDD') || '-' || upper(left(replace(cid::text, '-', ''), 6)), p_nego, v, a, me,
    n.produit, coalesce(n.quantite_finale, n.quantite), n.unite, n.prix_final, mt,
    coalesce(dep, n.ville), lieu, case when mt is not null then round(mt * 0.035) end, p_mode, 'declaration');
  perform public._cmd_journal(cid, 'creee', me, case when me = v then 'vendeur' else 'acheteur' end, 'declaration', lieu);
  return cid;
end $$;

-- ——— 4) L'autre partie confirme (ou refuse) ———
create or replace function public.commande_repondre(p_id uuid, p_oui boolean, p_note text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'a_confirmer' then raise exception 'Cette commande a déjà reçu une réponse.'; end if;
  if me = c.cree_par then raise exception 'C''est l''autre partie qui confirme la commande.'; end if;
  nt := public._cmd_texte(p_note, 300);
  if p_oui then
    update public.commandes set etat = 'en_cours', etape = 'confirmee' where id = p_id;
    perform public._cmd_journal(p_id, 'confirmee', me, r, 'declaration', null, null, null, nt);
  else
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'refusee', me, r, 'declaration', null, null, null, nt);
  end if;
end $$;

-- ——— 5) Faire avancer une étape (ordre et rôle vérifiés ici) ———
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' then raise exception 'Cette étape se valide avec le code du chauffeur.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120); nt := public._cmd_texte(p_note, 300);
  pv := case when p_lat is not null then 'gps' else 'declaration' end;

  if p_etape = 'preparation' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui prépare la marchandise.'; end if;
    if c.etape <> 'confirmee' then raise exception 'Étape déjà passée.'; end if;
  elsif p_etape = 'chargement' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui confirme le chargement.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'Le chargement est déjà confirmé.'; end if;
  elsif p_etape = 'transbordement' then
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le transbordement se signale pendant le transport.'; end if;
    if lieu is null then raise exception 'Indiquez le lieu du transbordement.'; end if;
  elsif p_etape = 'arrivee' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui signale l''arrivée du chauffeur.'; end if;
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le chauffeur doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;

  update public.commandes set etape = p_etape where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon, nt);
  -- étapes automatiques : après le chargement, le transport commence ; après la réception, la commande est terminée
  if p_etape = 'chargement' then
    update public.commandes set etape = 'transport' where id = p_id;
    perform public._cmd_journal(p_id, 'transport', null, 'systeme', 'auto');
    return 'transport';
  elsif p_etape = 'reception' then
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
    perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
    return 'terminee';
  end if;
  return p_etape;
end $$;

-- ——— 6) Annuler d'un commun accord (avant le chargement) ———
create or replace function public.commande_annuler(p_id uuid, p_oui boolean default true, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  nt := public._cmd_texte(p_note, 300);
  -- avant la confirmation, celui qui a créé la commande peut la retirer seul
  if c.etat = 'a_confirmer' then
    if me <> c.cree_par then raise exception 'Répondez plutôt à la commande (confirmer ou refuser).'; end if;
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
    return 'annulee';
  end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible. Ouvrez un litige si besoin.'; end if;
  if not p_oui then
    if c.annulation_par is null or c.annulation_par = me then raise exception 'Il n''y a pas de demande d''annulation à refuser.'; end if;
    update public.commandes set annulation_par = null where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_refusee', me, r, 'declaration', null, null, null, nt);
    return 'en_cours';
  end if;
  if c.annulation_par = me then raise exception 'Vous avez déjà demandé l''annulation. L''autre partie doit l''accepter.'; end if;
  if c.annulation_par is null then
    update public.commandes set annulation_par = me where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_demandee', me, r, 'declaration', null, null, null, nt);
    return 'annulation_demandee';
  end if;
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
  perform public._cmd_rendre_stock(c);
  return 'annulee';
end $$;

-- ——— 7) Ouvrir un litige (marchandise chargée, jusqu'à 48 h après la réception) ———
create or replace function public.commande_litige(p_id uuid, p_motif text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; m text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème en quelques mots.'; end if;
  if not ((c.etat = 'en_cours' and c.etape in ('chargement', 'transport', 'transbordement', 'arrivee', 'reception'))
       or (c.etat = 'terminee' and c.termine_le > now() - interval '48 hours')) then
    raise exception 'Un litige s''ouvre après le chargement, et jusqu''à 48 h après la réception.';
  end if;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now() where id = p_id;
  perform public._cmd_journal(p_id, 'litige', me, r, 'declaration', null, null, null, m);
end $$;

-- ——— 8) Lire ———
create or replace function public.mes_commandes() returns table (
  id uuid, numero text, negociation_id uuid, role text, etat text, etape text, produit text, quantite numeric, unite text,
  prix_unitaire numeric, montant numeric, commission_montant numeric, mode_transport text, validation text,
  ville_depart text, lieu_livraison text, partenaire_id uuid, partenaire_nom text, cree_par_moi boolean,
  annulation text, created_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.numero, c.negociation_id, public._cmd_role(c, auth.uid()), c.etat, c.etape, c.produit, c.quantite, c.unite,
    c.prix_unitaire, c.montant, case when auth.uid() = c.vendeur_id then c.commission_montant end, c.mode_transport, c.validation,
    c.ville_depart, c.lieu_livraison,
    case when auth.uid() = c.vendeur_id then c.acheteur_id else c.vendeur_id end,
    coalesce(public.nom_public(case when auth.uid() = c.vendeur_id then c.acheteur_id else c.vendeur_id end), 'Membre'),
    c.cree_par = auth.uid(),
    case when c.annulation_par is null then null when c.annulation_par = auth.uid() then 'moi' else 'autre' end,
    c.created_at, c.updated_at
  from public.commandes c
  where auth.uid() is not null and auth.uid() in (c.vendeur_id, c.acheteur_id)
  order by c.updated_at desc
  limit 500;
$$;

create or replace function public.commande_journal(p_id uuid) returns table (evenement text, role text, preuve text, lieu text,
  lat double precision, lon double precision, note text, at timestamptz, par_moi boolean)
language sql stable security definer set search_path = public as $$
  select e.evenement, e.role, e.preuve, e.lieu, e.lat, e.lon, e.note, e.at, e.par = auth.uid()
  from public.commande_etapes e join public.commandes c on c.id = e.commande_id
  where e.commande_id = p_id and auth.uid() is not null and (auth.uid() in (c.vendeur_id, c.acheteur_id) or public.est_admin())
  order by e.at, e.id;
$$;

-- ——— 9) Notification à l'autre partie à chaque étape (fonction Edge « pousser », { commande_etape_id }) ———
create or replace function public.push_commande() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if new.evenement in ('transport', 'terminee') then return new; end if;   -- étapes automatiques : déjà annoncées par l'étape qui les déclenche
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('commande_etape_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
create trigger commande_etapes_push after insert on public.commande_etapes for each row execute function public.push_commande();

-- ——— 10) Droits ———
revoke execute on function public._cmd_role(public.commandes, uuid), public._cmd_texte(text, int),
  public._cmd_journal(uuid, text, uuid, text, text, text, double precision, double precision, text),
  public._cmd_rendre_stock(public.commandes), public.push_commande() from public, anon, authenticated;
revoke execute on function public.commande_creer(uuid, text, text, text), public.commande_repondre(uuid, boolean, text),
  public.commande_avancer(uuid, text, text, double precision, double precision, text), public.commande_annuler(uuid, boolean, text),
  public.commande_litige(uuid, text), public.mes_commandes(), public.commande_journal(uuid) from public, anon;
grant execute on function public.commande_creer(uuid, text, text, text), public.commande_repondre(uuid, boolean, text),
  public.commande_avancer(uuid, text, text, double precision, double precision, text), public.commande_annuler(uuid, boolean, text),
  public.commande_litige(uuid, text), public.mes_commandes(), public.commande_journal(uuid) to authenticated;
