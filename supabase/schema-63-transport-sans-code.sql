-- ═════════ Schéma 63 (24/10/2026) — le transport de l'acheteur ou du vendeur se passe sans code de chauffeur ═════════
-- Règle du propriétaire :
--   • quand l'acheteur ou le vendeur choisit lui-même son transporteur, le transporteur n'a rien à faire sur la plateforme :
--     ni inscription, ni code transporteur, ni codes à taper. La transaction se passe entre le vendeur et l'acheteur :
--     le vendeur glisse son MOT SECRET dans la marchandise (schéma 58), l'acheteur le retrouve et le TAPE pour confirmer la réception ;
--   • les codes (prise en charge, réception, code transporteur) restent réservés au transporteur du réseau Marché de Gros,
--     celui que nous recommandons et avec qui nous traitons (aujourd'hui en pause, schéma 62).
-- Aucun « drop » : tout est en create or replace ; une seule fonction nouvelle (commande_reception_mot).

-- 1) commande_creer : la validation suit le mode de transport, quoi que demande le téléphone
create or replace function public.commande_creer(p_nego uuid, p_mode text, p_lieu text default null, p_validation text default 'declaration')
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); n public.negociations; v uuid; a uuid; dep text; mt numeric; cid uuid := gen_random_uuid(); lieu text; val text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.statut <> 'conclue' then raise exception 'La commande se crée après un accord conclu.'; end if;
  if exists (select 1 from public.commandes where negociation_id = p_nego) then raise exception 'Une commande existe déjà pour cet accord.'; end if;
  if p_mode not in ('reseau', 'acheteur', 'vendeur') then raise exception 'Choisissez qui transporte la marchandise.'; end if;
  -- schéma 63 : codes avec le transporteur du réseau seulement ; avec son propre transporteur, le mot secret du vendeur
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
    coalesce(dep, n.ville), lieu, case when mt is not null then round(mt * 0.035) end, p_mode, val);
  perform public._cmd_journal(cid, 'creee', me, case when me = v then 'vendeur' else 'acheteur' end, 'declaration', lieu);
  return cid;
end $$;

-- 2) commande_avancer : avec son propre transporteur, la réception passe par commande_reception_mot (le mot secret)
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' and p_etape = 'chargement' then raise exception 'Commande avec codes : le chauffeur tape le code de prise en charge que lui donne le vendeur.'; end if;
  if c.validation = 'code' and p_etape = 'reception' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.validation = 'declaration' and c.mode_transport <> 'reseau' and p_etape = 'reception' then
    raise exception 'MOT_REQUIS : pour confirmer la réception, tapez le mot secret du vendeur trouvé dans la marchandise. Mettez l''application à jour si vous ne voyez pas la case.';
  end if;
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
    if r not in ('acheteur', 'chauffeur') then raise exception 'C''est l''acheteur ou le chauffeur qui signale l''arrivée.'; end if;
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le chauffeur doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;
  update public.commandes set etape = p_etape where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon, nt);
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

-- 3) commande_reception_mot : l'acheteur tape le mot secret retrouvé dans la marchandise.
--    Pas de limite d'essais : confirmer la réception n'avantage pas l'acheteur, deviner le mot ne lui sert à rien.
--    Le papier a disparu ? L'acheteur peut confirmer « sans le mot » : c'est écrit dans le journal, visible des deux et de l'équipe.
create or replace function public._mot_norme(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(translate(upper(coalesce(t, '')), 'ÀÂÄÁÉÈÊËÎÏÍÔÖÓÙÛÜÚÇ', 'AAAAEEEEIIIOOOUUUUC'), '[^A-Z0-9]', '', 'g')
$$;

create or replace function public.commande_reception_mot(p_id uuid, p_mot text default null, p_sans_mot boolean default false,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; sans boolean := coalesce(p_sans_mot, false);
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
  if c.validation = 'code' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  if not sans then
    if public._mot_norme(p_mot) = '' then raise exception 'Tapez le mot secret écrit sur le papier glissé dans la marchandise.'; end if;
    if c.mot_secret is null or public._mot_norme(p_mot) <> public._mot_norme(c.mot_secret) then
      raise exception 'MOT_FAUX : ce n''est pas le mot secret du vendeur. Vérifiez le papier glissé dans la marchandise.';
    end if;
  end if;
  nt := public._cmd_texte(p_note, 240);
  update public.commandes set etape = 'reception' where id = p_id;
  perform public._cmd_journal(p_id, 'reception', me, 'acheteur', case when sans then 'declaration' else 'code' end, null, p_lat, p_lon,
    case when sans then 'Réception confirmée sans le mot secret du vendeur' else 'Mot secret du vendeur retrouvé dans la marchandise' end || coalesce(' · ' || nt, ''));
  update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
  perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
  return 'terminee';
end $$;

revoke all on function public.commande_reception_mot(uuid, text, boolean, double precision, double precision, text) from public, anon;
grant execute on function public.commande_reception_mot(uuid, text, boolean, double precision, double precision, text) to authenticated;
revoke all on function public._mot_norme(text) from public, anon;
