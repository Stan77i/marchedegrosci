-- Schéma 93b : négociations et commandes sans contournement (audit du 24/10/2026, P2 n° 7, 8, 9 ; P3 n° 31 ; contradiction 2).
-- Après 93a. Fichier sans les mots interdits par le MCP.
--  1. nego_agir : une offre en pause n'accepte ni nouvelle proposition ni accord ; une offre sans quantité ne se vend pas ;
--     l'annonce est verrouillée (FOR UPDATE) au moment de l'accord, offre ET demande ; une négociation « arrêtée » ne se rouvre
--     pas aussitôt par l'autre partie (24 h, réglable : reglages.annonces.nego_arret_heures).
--  2. nego_ouvrir : même délai pour ouvrir une nouvelle négociation sur la même annonce après un arrêt par l'autre partie.
--  3. commande_creer2 : la ville de l'annonce est celle de la négociation (figée à son ouverture), plus celle d'aujourd'hui.
--  4. Les membres ne peuvent plus appeler l'ancienne commande_creer (contourne « ville seulement » et le transport à part)
--     ni nego_transport (changeait le transport d'une proposition sans changer son identifiant). commande_creer2 l'appelle encore
--     en interne. L'application n'appelle plus ces deux fonctions (v3/commandes.js, v3/negoce.js).

-- ───────── 0. Arrêt récent par l'autre partie ? (le texte du refus, ou null)
create or replace function public._nego_arret_refus(p_cible text, p_cible_id uuid, p_me uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare h numeric := public._ann_regle('nego_arret_heures', 24); quand timestamptz;
begin
  if h <= 0 then return null; end if;
  select m.created_at into quand from public.negociations n join public.messages m on m.negociation_id = n.id and m.genre = 'fin'
  where n.cible = p_cible and n.cible_id = p_cible_id and p_me in (n.auteur_id, n.proprio_id) and n.statut = 'close' and n.motif_fin = 'arretee'
    and m.auteur_id <> p_me and m.created_at > now() - make_interval(hours => h::int)
  order by m.created_at desc limit 1;
  if quand is null then return null; end if;
  return 'NEGO_ARRETEE : l''autre partie a arrêté cette négociation. Vous pourrez refaire une proposition dans '
    || greatest(1, ceil(extract(epoch from (quand + make_interval(hours => h::int) - now())) / 3600))::int || ' h.';
end $$;
revoke all on function public._nego_arret_refus(text, uuid, uuid) from public, anon, authenticated;

-- ───────── 1. nego_agir
create or replace function public.nego_agir(nego uuid, action text, prix numeric default null, quantite numeric default null,
  texte text default null, ref uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; t text := nullif(btrim(coalesce(texte, '')), ''); recent int;
  a record; q numeric; deja numeric; prop public.messages; mn numeric; pause timestamptz; refus text;
begin
  select * into n from public.negociations where id = nego for update;
  if n.id is null or me is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Négociation introuvable.'; end if;
  if action not in ('texte', 'prix', 'accord', 'refus', 'retrait', 'fin') then raise exception 'Action inconnue.'; end if;
  if char_length(t) > 500 then raise exception 'Message trop long (500 caractères au plus).'; end if;
  select count(*) into recent from public.messages where auteur_id = me and created_at > now() - interval '1 minute';
  if recent >= 20 then raise exception 'Trop de messages d''un coup. Patientez une minute.'; end if;
  if n.dernier_msg is not null then select * into prop from public.messages where id = n.dernier_msg; end if;
  if prop.id is not null and prop.issue = 'en_attente' and n.expire_le <= now() then
    update public.messages set issue = 'expiree' where id = prop.id; prop.issue := 'expiree';
    update public.negociations set dernier_par = null, dernier_msg = null where id = nego; n.dernier_par := null; n.dernier_msg := null;
  end if;

  if action = 'texte' then
    if t is null then raise exception 'Message vide.'; end if;
    insert into public.messages (negociation_id, auteur_id, genre, texte) values (nego, me, 'texte', t);

  elsif n.statut = 'conclue' then
    raise exception 'Cette négociation est conclue : l''accord ne peut plus changer.';

  elsif action = 'prix' then
    if prix is null or prix <= 0 or prix >= 1e9 then raise exception 'Indiquez un prix.'; end if;
    if n.statut = 'close' and n.motif_fin = 'arretee' then
      refus := public._nego_arret_refus(n.cible, n.cible_id, me);
      if refus is not null then raise exception '%', refus; end if;
    end if;
    if n.cible = 'offre' then select quantity, status, negociable, price as p, pause_le into a from public.offres where id = n.cible_id;
    else select quantity, status, negociable, budget as p, null::timestamptz as pause_le into a from public.demandes where id = n.cible_id; end if;
    if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
    if a.pause_le is not null then raise exception 'ANNONCE_EN_PAUSE : ce vendeur a mis cette offre en pause. Revenez plus tard.'; end if;
    if n.cible = 'offre' and coalesce(a.quantity, 0) <= 0 and not public.est_admin_id(n.proprio_id) then
      raise exception 'Cette offre n''a plus de stock.';
    end if;
    if not a.negociable and me <> n.proprio_id and prix is distinct from a.p then raise exception 'Le prix de cette annonce n''est pas négociable.'; end if;
    q := coalesce(quantite, n.dernier_quantite, a.quantity);
    if q is not null and (q <= 0 or q >= 1e9) then raise exception 'Quantité invalide.'; end if;
    if q is not null and a.quantity > 0 and q > a.quantity then raise exception 'Quantité trop grande : l''annonce porte sur % au plus.', a.quantity; end if;
    if n.cible = 'offre' and me <> n.proprio_id then
      select o.qte_min into mn from public.offres o where o.id = n.cible_id;
      if mn is not null then
        if a.quantity > 0 then mn := least(mn, a.quantity); end if;
        if q is null or q < mn then
          raise exception 'Le vendeur vend à partir de % %. Proposez au moins cette quantité.', replace(trim_scale(mn)::text, '.', ','), coalesce(n.unite, '');
        end if;
      end if;
    end if;
    if prop.id is not null and prop.issue = 'en_attente' then update public.messages set issue = 'remplacee' where id = prop.id; end if;
    insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte, issue, expire_le)
    values (nego, me, 'prix', prix, q, t, 'en_attente', now() + interval '48 hours') returning * into prop;
    update public.negociations set statut = 'ouverte', motif_fin = null, dernier_prix = prix, dernier_quantite = q, dernier_par = me,
      dernier_msg = prop.id, expire_le = prop.expire_le where id = nego;

  elsif action in ('accord', 'refus') then
    if prop.id is null or prop.issue <> 'en_attente' then
      raise exception '%', case when prop.issue = 'expiree' then 'Cette proposition a expiré (48 h sans réponse). Faites une nouvelle proposition.' else 'Il n''y a pas de proposition en attente.' end;
    end if;
    if prop.auteur_id = me then raise exception 'Vous ne pouvez pas répondre à votre propre proposition.'; end if;
    if ref is not null and ref <> prop.id then raise exception 'La proposition a changé entre-temps. Relisez la dernière proposition.'; end if;
    if n.statut <> 'ouverte' then raise exception 'Cette négociation est terminée.'; end if;
    if action = 'accord' then
      -- l'annonce est verrouillée jusqu'à la fin : deux accords en même temps ne prennent pas le même stock
      if n.cible = 'offre' then select quantity, status, pause_le into a from public.offres where id = n.cible_id for update;
      else select quantity, status, null::timestamptz as pause_le into a from public.demandes where id = n.cible_id for update; end if;
      if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
      if a.pause_le is not null then raise exception 'ANNONCE_EN_PAUSE : cette offre est en pause. Pas de nouvel accord tant qu''elle l''est.'; end if;
      if n.cible = 'offre' and coalesce(a.quantity, 0) <= 0 and not public.est_admin_id(n.proprio_id) then
        raise exception 'Quantité plus disponible : cette offre n''a plus de stock.';
      end if;
      select coalesce(sum(quantite_finale), 0) into deja from public.negociations where cible = n.cible and cible_id = n.cible_id and statut = 'conclue';
      if a.quantity > 0 and prop.quantite is not null and prop.quantite > a.quantity then
        raise exception 'Quantité plus disponible : il reste % sur cette annonce.', a.quantity;
      end if;
      update public.messages set issue = 'acceptee' where id = prop.id;
      insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'accord', prop.prix, prop.quantite, t);
      update public.negociations set statut = 'conclue', prix_final = prop.prix, quantite_finale = prop.quantite, conditions_finales = prop.texte,
        conclu_le = now(), dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
    else
      update public.messages set issue = 'refusee' where id = prop.id;
      insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'refus', prop.prix, prop.quantite, t);
      update public.negociations set dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
    end if;

  elsif action = 'retrait' then
    if prop.id is null or prop.issue <> 'en_attente' or prop.auteur_id <> me then raise exception 'Vous n''avez pas de proposition en attente à retirer.'; end if;
    update public.messages set issue = 'retiree' where id = prop.id;
    insert into public.messages (negociation_id, auteur_id, genre, prix, quantite, texte) values (nego, me, 'retrait', prop.prix, prop.quantite, t);
    update public.negociations set dernier_par = null, dernier_msg = null, expire_le = null where id = nego;

  elsif action = 'fin' then
    if n.statut <> 'ouverte' then raise exception 'Cette négociation est déjà terminée.'; end if;
    if prop.id is not null and prop.issue = 'en_attente' then update public.messages set issue = 'retiree' where id = prop.id; end if;
    insert into public.messages (negociation_id, auteur_id, genre, texte) values (nego, me, 'fin', t);
    update public.negociations set statut = 'close', motif_fin = 'arretee', dernier_par = null, dernier_msg = null, expire_le = null where id = nego;
  end if;

  update public.negociations set updated_at = now(),
    lu_auteur  = case when me = auteur_id  then now() else lu_auteur end,
    lu_proprio = case when me = proprio_id then now() else lu_proprio end
  where id = nego;
end $$;

-- ───────── 2. nego_ouvrir : pas de nouvelle négociation juste après un arrêt par l'autre partie
create or replace function public.nego_ouvrir(cible text, cible_id uuid, prix numeric, quantite numeric default null, texte text default null)
returns uuid language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me uuid := auth.uid(); a record; n uuid; ouvertes int; refus text;
begin
  if me is null then raise exception 'Connectez-vous pour proposer un prix.'; end if;
  if cible = 'offre' then
    select user_id, product_label, city, unit, quantity, price as p, status, negociable into a from public.offres where id = cible_id;
  elsif cible = 'demande' then
    select user_id, product_label, city, unit, quantity, budget as p, status, negociable into a from public.demandes where id = cible_id;
  else raise exception 'Annonce inconnue.'; end if;
  if not found or a.status <> 'active' then raise exception 'Cette annonce n''est plus disponible.'; end if;
  if a.user_id = me then raise exception 'C''est votre propre annonce.'; end if;
  if not a.negociable and (prix is distinct from a.p) then raise exception 'Le prix de cette annonce n''est pas négociable : vous pouvez proposer le prix affiché.'; end if;
  if not exists (select 1 from public.negociations g where g.cible = nego_ouvrir.cible and g.cible_id = nego_ouvrir.cible_id and g.auteur_id = me and g.statut = 'ouverte') then
    refus := public._nego_arret_refus(nego_ouvrir.cible, nego_ouvrir.cible_id, me);
    if refus is not null then raise exception '%', refus; end if;
  end if;
  select count(*) into ouvertes from public.negociations where auteur_id = me and created_at > now() - interval '1 day';
  if ouvertes >= 40 then raise exception 'Limite atteinte : 40 négociations ouvertes par jour.'; end if;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, ville, unite, quantite, prix_annonce)
  values (cible, cible_id, me, a.user_id, a.product_label, a.city, a.unit, a.quantity, a.p)
  on conflict (cible, cible_id, auteur_id) where statut = 'ouverte' do nothing
  returning id into n;
  if n is null then select g.id into n from public.negociations g where g.cible = nego_ouvrir.cible and g.cible_id = nego_ouvrir.cible_id and g.auteur_id = me and g.statut = 'ouverte'; end if;
  perform public.nego_agir(n, 'prix', prix, quantite, texte, null);
  return n;
end $$;

-- ───────── 3. commande_creer2 : la ville de l'annonce est celle de la négociation
create or replace function public.commande_creer2(p_nego uuid, p_mode text, p_lieu text default null, p_ville_arrivee text default null, p_ville_depart text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; dep text; arr text; meme boolean; inclus boolean; apart boolean; regle text; cid uuid; mt numeric;
  vs boolean; nom text; ann text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into n from public.negociations where id = p_nego;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.cible = 'offre' then
    select city, ville_seulement into ann, vs from public.offres where id = n.cible_id;
    dep := coalesce(nullif(btrim(n.ville), ''), ann);   -- la ville convenue dans la négociation, pas celle d'aujourd'hui
    arr := public._cmd_texte(p_ville_arrivee, 80);
    if arr is null then raise exception 'Choisissez la ville de livraison.'; end if;
  else
    select city, ville_seulement into ann, vs from public.demandes where id = n.cible_id;
    arr := coalesce(nullif(btrim(n.ville), ''), public._cmd_texte(p_ville_arrivee, 80), ann);
    dep := public._cmd_texte(p_ville_depart, 80);
    if dep is null then raise exception 'Choisissez la ville où se trouve la marchandise.'; end if;
  end if;
  -- « ville seulement » (schéma 87) contrôlé avec la ville de la négociation
  if coalesce(vs, false) and public._ville_cle(coalesce(n.ville, ann)) <> '' then
    nom := public._ville_ref(coalesce(nullif(btrim(n.ville), ''), ann));
    if n.cible = 'offre' and public._ville_cle(public._ville_ref(arr)) is distinct from public._ville_cle(nom) then
      raise exception 'Ce vendeur vend uniquement à % : la livraison doit se faire à %.', nom, nom;
    elsif n.cible = 'demande' and public._ville_cle(public._ville_ref(dep)) is distinct from public._ville_cle(nom) then
      raise exception 'Cet acheteur achète uniquement à % : la marchandise doit se trouver à %.', nom, nom;
    end if;
  end if;
  perform set_config('mgci.ville_verifiee', '1', true);
  meme := public._ville_cle(public._ville_ref(dep)) = public._ville_cle(public._ville_ref(arr));
  inclus := coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id));
  apart := not inclus and n.prix_transport_final is not null;
  if p_mode = 'acheteur' and apart then
    raise exception 'Le transport à part est convenu avec le vendeur : c''est lui qui livre, ou un transporteur du réseau Marché de Gros.';
  end if;
  regle := case when p_mode = 'reseau' then 'mgci' when inclus then 'inclus' when apart then 'a_part'
                when p_mode = 'vendeur' then 'livreur_vendeur' when meme then 'retrait' else 'acheteur' end;
  cid := public.commande_creer(p_nego, p_mode, p_lieu, case when p_mode = 'reseau' then 'code' else 'declaration' end);
  perform set_config('mgci.ville_verifiee', '', true);
  select montant into mt from public.commandes where id = cid;
  update public.commandes set ville_depart = left(dep, 80), ville_arrivee = left(arr, 80), meme_ville = meme, transport_regle = regle,
    prix_transport = case when regle = 'a_part' then round(n.prix_transport_final, 0) end,
    total_convenu = case when mt is null or regle = 'mgci' then null when regle = 'a_part' then round(mt, 0) + round(n.prix_transport_final, 0) else round(mt, 0) end
  where id = cid;
  return cid;
end $$;

-- ───────── 4. Portes de côté fermées aux membres (révocation, pas de suppression)
revoke execute on function public.commande_creer(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.nego_transport(uuid, boolean) from public, anon, authenticated;
