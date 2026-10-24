-- Schéma 83b : chantier 1 (commande et transport), partie commande.
-- Appliqué sur le projet de TEST le 24/10/2026. Pas encore en production.
-- 1. La commande garde la ville de livraison, sait si c'est la même ville, et fige le transport convenu :
--    transport_regle = inclus | a_part (prix convenu dans l'accord) | livreur_vendeur | retrait | acheteur | mgci.
--    total_convenu = marchandise + transport convenu (rien n'est payé dans l'application).
-- 2. commande_creer2 : nouvelle fonction (commande_creer reste pour les anciennes applications).
--    Même ville : le vendeur organise son livreur ; retrait par l'acheteur seulement si le vendeur l'accepte (il confirme la commande).
-- 3. commande_creer : commission marchandise à 0 pour un vendeur administrateur (comme _seq_repartition).
-- 4. commande_transport : prix accepté seulement ; pas de total quand le livreur est hors Marché de Gros.
-- 5. commande_choisir_transporteur fermée : un livreur de l'acheteur ou du vendeur n'a rien à faire dans l'application.

alter table public.commandes add column if not exists ville_arrivee text;
alter table public.commandes add column if not exists meme_ville boolean;
alter table public.commandes add column if not exists transport_regle text;
alter table public.commandes add column if not exists prix_transport numeric;
alter table public.commandes add column if not exists total_convenu numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_transport_regle_check') then
    alter table public.commandes add constraint commandes_transport_regle_check check (
      (transport_regle is null or transport_regle in ('inclus', 'a_part', 'livreur_vendeur', 'retrait', 'acheteur', 'mgci'))
      and (ville_arrivee is null or char_length(ville_arrivee) <= 80)
      and (prix_transport is null or (prix_transport > 0 and prix_transport < 100000000))
      and (total_convenu is null or total_convenu >= 0));
  end if;
end $$;

-- même règle que MDGVilles.cle (app/villes.js) : sans accents, sans casse, sans tirets ni apostrophes
create or replace function public._ville_cle(v text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select regexp_replace(lower(translate(coalesce(v, ''), 'ÀÂÄÉÈÊËÎÏÔÖÙÛÜÇàâäéèêëîïôöùûüç', 'AAAEEEEIIOOUUUCaaaeeeeiioouuuc')), '[^a-z0-9]+', '', 'g')
$function$;

create or replace function public.commande_creer(p_nego uuid, p_mode text, p_lieu text default null::text, p_validation text default 'declaration'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); n public.negociations; v uuid; a uuid; dep text; mt numeric; cid uuid := gen_random_uuid(); lieu text; val text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.statut <> 'conclue' then raise exception 'La commande se crée après un accord conclu.'; end if;
  if exists (select 1 from public.commandes where negociation_id = p_nego) then raise exception 'Une commande existe déjà pour cet accord.'; end if;
  if p_mode not in ('reseau', 'acheteur', 'vendeur') then raise exception 'Choisissez qui transporte la marchandise.'; end if;
  val := case when p_mode = 'reseau' then 'code' else 'declaration' end;
  if p_mode <> 'vendeur' and coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id)) then
    raise exception 'Le transport est inclus dans le prix du vendeur : c''est lui qui transporte.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if n.cible = 'offre' then v := n.proprio_id; a := n.auteur_id; select city into dep from public.offres where id = n.cible_id;
  else v := n.auteur_id; a := n.proprio_id; end if;
  mt := case when n.prix_final is not null and coalesce(n.quantite_finale, n.quantite) is not null then round(n.prix_final * coalesce(n.quantite_finale, n.quantite)) end;
  insert into public.commandes (id, numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
    ville_depart, lieu_livraison, commission_montant, mode_transport, validation)
  values (cid, 'MDG-C-' || to_char(now(), 'YYMMDD') || '-' || upper(left(replace(cid::text, '-', ''), 6)), p_nego, v, a, me,
    n.produit, coalesce(n.quantite_finale, n.quantite), n.unite, n.prix_final, mt,
    coalesce(dep, n.ville), lieu, case when mt is null then null when public.est_admin_id(v) then 0 else round(mt * 0.035) end, p_mode, val);
  perform public._cmd_journal(cid, 'creee', me, case when me = v then 'vendeur' else 'acheteur' end, 'declaration', lieu);
  return cid;
end $function$;

create or replace function public.commande_creer2(p_nego uuid, p_mode text, p_lieu text default null, p_ville_arrivee text default null, p_ville_depart text default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); n public.negociations; dep text; arr text; meme boolean; inclus boolean; apart boolean; regle text; cid uuid; mt numeric;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into n from public.negociations where id = p_nego;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.cible = 'offre' then
    select city into dep from public.offres where id = n.cible_id;
    dep := coalesce(dep, n.ville);
    arr := public._cmd_texte(p_ville_arrivee, 80);
    if arr is null then raise exception 'Choisissez la ville de livraison.'; end if;
  else
    arr := coalesce(public._cmd_texte(p_ville_arrivee, 80), n.ville);
    dep := public._cmd_texte(p_ville_depart, 80);
    if dep is null then raise exception 'Choisissez la ville où se trouve la marchandise.'; end if;
  end if;
  meme := public._ville_cle(dep) = public._ville_cle(arr);
  inclus := coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id));
  apart := not inclus and n.prix_transport_final is not null;
  if p_mode = 'acheteur' and apart then
    raise exception 'Le transport à part est convenu avec le vendeur : c''est lui qui livre, ou un transporteur du réseau Marché de Gros.';
  end if;
  regle := case when p_mode = 'reseau' then 'mgci' when inclus then 'inclus' when apart then 'a_part'
                when p_mode = 'vendeur' then 'livreur_vendeur' when meme then 'retrait' else 'acheteur' end;
  cid := public.commande_creer(p_nego, p_mode, p_lieu, case when p_mode = 'reseau' then 'code' else 'declaration' end);
  select montant into mt from public.commandes where id = cid;
  update public.commandes set ville_depart = left(dep, 80), ville_arrivee = left(arr, 80), meme_ville = meme, transport_regle = regle,
    prix_transport = case when regle = 'a_part' then round(n.prix_transport_final, 0) end,
    total_convenu = case when mt is null or regle = 'mgci' then null when regle = 'a_part' then round(mt, 0) + round(n.prix_transport_final, 0) else round(mt, 0) end
  where id = cid;
  return cid;
end $function$;
revoke execute on function public.commande_creer2(uuid, text, text, text, text) from public, anon;
grant execute on function public.commande_creer2(uuid, text, text, text, text) to authenticated;

create or replace function public.commande_choisir_transporteur(p_cmd uuid, p_code text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  raise exception 'Votre livreur n''a rien à faire dans l''application : ni inscription, ni code. Pour un transporteur du réseau, c''est l''équipe du Marché de Gros qui l''affecte.';
end $function$;
