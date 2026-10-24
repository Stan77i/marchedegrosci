-- ═════════ Marché de Gros CI — schéma 89b : l'échéance affichée et le message de refus passent à 1 h ═════════
-- Seuls changements par rapport à la version en place (schéma 61) : « + interval '1 hour' » et « dans l'heure qui suit la réception ».

CREATE OR REPLACE FUNCTION public.commande_sequestre(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c public.commandes; r text; rep json; s public.sequestres;
begin
  select * into c from public.commandes where id = p_id;
  if c.id is null or me is null then return null; end if;
  r := public._cmd_role2(c, me);
  if r is null and public.est_admin() then r := 'admin'; end if;
  if r is null then return null; end if;
  rep := public._seq_repartition(c.id);
  select * into s from public.sequestres where commande_id = c.id;
  return json_build_object(
    'role', r,
    'actif', s.id is not null,
    'etat', coalesce(s.etat, 'non_ouvert'), 'operateur', s.operateur, 'depose_le', s.depose_le, 'solde_le', s.solde_le,
    'libere_le', c.libere_le, 'liberation', c.liberation, 'montant_refuse', c.montant_refuse,
    'echeance', case when c.etat = 'terminee' and c.libere_le is null then c.termine_le + interval '1 hour' end,
    'sans_reponse', false,
    'mot', case when r in ('vendeur', 'admin') then c.mot_secret end,
    'avec_mot', c.mot_secret is not null,
    'repartition', case when r = 'chauffeur' then json_build_object('transporteur_brut', rep->'transporteur_brut', 'transporteur_commission', rep->'transporteur_commission', 'transporteur_net', rep->'transporteur_net') else rep end,
    'refus', case when c.refus_le is null then null else json_build_object(
      'le', c.refus_le, 'quantite', c.refus_quantite, 'unite', c.unite, 'motif', c.refus_motif, 'photos', c.refus_photos, 'mot', c.refus_mot,
      'chauffeur', c.refus_chauffeur, 'chauffeur_le', c.refus_chauffeur_le, 'vendeur', c.refus_vendeur, 'vendeur_le', c.refus_vendeur_le,
      'chauffeur_suffit', public._cmd_chauffeur_independant(c) and coalesce(c.refus_mot, 'retrouve') = 'retrouve',
      'a_chauffeur', exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null)) end,
    'peut_liberer', r = 'acheteur' and c.etat = 'terminee' and c.libere_le is null,
    'peut_refuser', r = 'acheteur' and ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)),
    'mot_bloque', c.mot_essais >= 5,
    'peut_constater', r = 'chauffeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null,
    'peut_repondre', r = 'vendeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_vendeur is null);
end $function$;

CREATE OR REPLACE FUNCTION public.commande_refuser2(p_id uuid, p_quantite numeric, p_motif text, p_photos text[], p_mot text DEFAULT NULL::text, p_sans_mot boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c public.commandes; m text; x text; q numeric; mot text;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur peut refuser la marchandise.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)) then
    raise exception 'Le refus se fait quand le chauffeur est arrivé, ou dans l''heure qui suit la réception, avant la clôture de la commande.';
  end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème (marchandise gâtée, abîmée, quantité manquante…).'; end if;
  if p_photos is null or cardinality(p_photos) < 1 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 1 à 4 photos : la marchandise, et le papier du vendeur.'; end if;
  foreach x in array p_photos loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
  end loop;
  if p_quantite is not null and p_quantite <= 0 then raise exception 'Quantité refusée invalide.'; end if;
  if c.mot_secret is not null then
    if coalesce(p_sans_mot, false) or coalesce(btrim(p_mot), '') = '' then
      raise exception 'Sans le mot secret du vendeur, pas de remboursement. S''il n''y avait pas de papier, touchez « Signaler un problème » : l''équipe jugera.';
    end if;
    if c.mot_essais >= 5 then return 'mot_bloque'; end if;
    if public._mot_norm(p_mot) <> public._mot_norm(c.mot_secret) then
      update public.commandes set mot_essais = mot_essais + 1 where id = c.id;
      return case when c.mot_essais + 1 >= 5 then 'mot_bloque' else 'mot_incorrect:' || (5 - c.mot_essais - 1) end;
    end if;
    mot := 'retrouve';
  end if;
  q := case when p_quantite is null or c.quantite is null or p_quantite >= c.quantite then null else p_quantite end;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now(),
    refus_quantite = q, refus_motif = m, refus_photos = p_photos, refus_le = now(), refus_mot = mot,
    refus_chauffeur = null, refus_chauffeur_le = null, refus_vendeur = null, refus_vendeur_le = null where id = c.id;
  perform public._seq_journal(c.id, 'refus', me, 'acheteur',
    case when q is null then 'toute la marchandise' else q || ' ' || coalesce(c.unite, '') end || ' : ' || m || case when mot = 'retrouve' then ' · mot du vendeur retrouvé' else '' end);
  perform public._cmd_journal(c.id, 'litige', me, 'acheteur', 'declaration', null, null, null, 'Marchandise refusée : ' || m);
  return 'ok';
end $function$;
