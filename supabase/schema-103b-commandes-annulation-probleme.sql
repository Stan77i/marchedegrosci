-- Schéma 103b : annulation demandée par l'acheteur, « Signaler un problème » en 5 choix, indicateurs pour l'écran, « fausse arrivée »,
-- avis de clôture, confirmation renvoyée, verrou du litige (propositions validées par le propriétaire, « Ok » du 25/10/2026,
-- docs/regles/SCENARIOS-COMMANDE.md, partie 6, n° 2, 6, 8, 9, 10, 11, 12, 13, 14 et 15). À appliquer après 103a.
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire.
--  n° 2  Vendeur banni pendant le transport : l'acheteur peut encore confirmer la réception avec le mot secret pendant le litige de l'équipe.
--  n° 5  La date de la demande d'annulation est notée (annulation_demande_le) : la tâche des délais l'accepte après 24 h (103a).
--  n° 6  L'acheteur peut demander une annulation d'un commun accord avant le chargement (motif obligatoire, 2 demandes au plus,
--        comme le vendeur) ; le vendeur accepte (sans faute pour personne) ou refuse (la commande continue).
--  n° 8  Retrait chez le vendeur par l'acheteur lui-même (transport_regle = 'retrait', accepté par le vendeur) : la remise au départ vaut
--        « arrivé » ; le vendeur la déclare (étape « arrivee ») après les photos de départ, l'acheteur vérifie sur place et confirme avec le
--        mot secret. Indicateur « remise_vaut_arrivee » pour l'écran. Règle du propriétaire du 25/10/2026 : le risque reste au vendeur
--        jusqu'à la réception conforme ; « transport à la charge de l'acheteur » veut seulement dire que le transport n'est pas compris
--        dans le prix (le livreur peut être celui du vendeur) : ce cas garde l'heure comptée depuis l'arrivée, pas depuis le départ.
--  n° 9  Fausse déclaration « arrivé » constatée par l'équipe : nouvelle issue admin_litige_fausse_arrivee → commande annulée en faveur
--        de l'acheteur, « litige perdu » pour le vendeur (passe par la porte admin_litige_clore : conflit d'intérêts et journal de l'équipe).
--  n° 10 Date d'arrivée annoncée dépassée : indicateur « date_depassee » (l'écran met en avant « Signaler un problème ») ; rien d'automatique.
--  n° 11 Deux demandes de nouvelles sans réponse du vendeur : indicateur « nouvelles_sans_reponse » ; les relances restent sans limite.
--        Réponse du vendeur = un retard signalé, ou une étape écrite par le vendeur ou le chauffeur, après la demande.
--  n° 12 « Signaler un problème » : 5 choix (cassé, manquant, mauvaise qualité, mauvaise quantité, autre) ; photo demandée pour « cassé »
--        et « mauvaise qualité » (1 à 4, stockage « preuves » existant, dossier du membre) ; colonnes litige_type, litige_photos.
--  n° 13 Clôture en faveur du vendeur, et toute clôture qui porte une note (équipe, refus, partage) : les deux parties sont prévenues
--        (push_commande ignorait toute étape « terminee »).
--  n° 14 Confirmation renvoyée après une coupure : réponse « deja_confirmee », sans erreur ; un message du litige verrouille la commande :
--        la clôture automatique et le message ne passent pas en même temps (le message arrivé après la clôture est refusé).
--  n° 15 Délai de chargement de 72 h : inchangé (vérifié par le test).
-- Rien n'est effacé : create or replace, add column if not exists.

alter table public.commandes add column if not exists litige_type text;
alter table public.commandes add column if not exists litige_photos text[];
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_litige_type_check') then
    alter table public.commandes add constraint commandes_litige_type_check
      check (litige_type is null or litige_type in ('casse', 'manquant', 'qualite', 'quantite', 'autre'));
  end if;
end $$;

-- n° 5 et 6 : annuler (version 92b) ; l'acheteur peut aussi demander ; la date de la demande est notée
create or replace function public.commande_annuler(p_id uuid, p_oui boolean default true, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; dem_ach boolean;
  mo text := nullif(current_setting('mdg.fiab_motif', true), ''); acc text := nullif(current_setting('mdg.fiab_accord', true), '');
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  nt := public._cmd_texte(p_note, 300);
  if c.etat = 'a_confirmer' then
    if me <> c.cree_par then raise exception 'Répondez plutôt à la commande (confirmer ou refuser).'; end if;
    if mo is null then raise exception 'Choisissez un motif.'; end if;
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
    return 'annulee';
  end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible. Un problème : touchez « Signaler un problème ».'; end if;
  dem_ach := c.annulation_par is not null and c.annulation_par = c.acheteur_id;
  if not p_oui then
    if c.annulation_par is null or c.annulation_par = me then raise exception 'Il n''y a pas de demande d''annulation à refuser.'; end if;
    update public.commandes set annulation_par = null, annulation_demande_le = null where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_refusee', me, r, 'declaration', null, null, null,
      coalesce(nt || ' · ', '') || case
        when dem_ach and c.annulation_demandes_acheteur >= 2 then 'Deuxième refus : la commande continue. Un problème : « Signaler un problème ».'
        when dem_ach then 'La commande continue. L''acheteur peut redemander une fois.'
        when c.annulation_demandes >= 2 then 'Deuxième refus : l''équipe du Marché de Gros décidera si on lui signale un problème.'
        else 'Le vendeur peut redemander une fois.' end);
    return 'en_cours';
  end if;
  if c.annulation_par = me then raise exception 'Vous avez déjà demandé l''annulation. L''autre partie doit l''accepter.'; end if;
  if c.annulation_par is null then
    if mo is null then raise exception 'Choisissez un motif.'; end if;
    if me = c.acheteur_id then
      if c.annulation_demandes_acheteur >= 2 then
        raise exception 'ANNULATION_LIMITE : le vendeur a déjà refusé votre annulation deux fois. Un problème : touchez « Signaler un problème ».';
      end if;
      update public.commandes set annulation_par = me, annulation_demandes_acheteur = annulation_demandes_acheteur + 1, annulation_demande_le = now()
      where id = p_id;
    else
      if c.annulation_demandes >= 2 then
        raise exception 'ANNULATION_LIMITE : l''acheteur a déjà refusé votre annulation deux fois. Touchez « Signaler un problème » : l''équipe du Marché de Gros tranchera.';
      end if;
      update public.commandes set annulation_par = me, annulation_demandes = annulation_demandes + 1, annulation_demande_le = now() where id = p_id;
    end if;
    perform public._cmd_journal(p_id, 'annulation_demandee', me, r, 'declaration', null, null, null, nt);
    return 'annulation_demandee';
  end if;
  -- n° 6 : une demande de l'acheteur acceptée par le vendeur ne compte contre personne
  if dem_ach then perform set_config('mdg.fiab_accord', 'true', true); acc := 'true'; end if;
  if acc is null then raise exception 'Dites si vous êtes d''accord avec le motif.'; end if;
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null,
    case when dem_ach then coalesce(nt || ' · ', '') || 'Annulation d''un commun accord, demandée par l''acheteur. Personne n''est en faute.' else nt end);
  return 'annulee';
end $$;

-- n° 6 : accepter la demande de l'acheteur ne demande pas d'avis sur le motif (sans faute)
create or replace function public.commande_annuler_motif(p_id uuid, p_oui boolean default true, p_note text default null, p_motif text default null,
  p_motif_texte text default null, p_accord boolean default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t text; r text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me not in (c.vendeur_id, c.acheteur_id) then raise exception 'Commande introuvable.'; end if;
  if c.etat = 'a_confirmer' or (c.etat = 'en_cours' and p_oui and c.annulation_par is null) then
    t := public._fiab_motif_ok(p_motif, p_motif_texte);
    perform public._fiab_poser(p_motif, t, null, null, null);
  elsif c.etat = 'en_cours' and p_oui and c.annulation_par is not null and c.annulation_par <> me then
    if c.annulation_par = c.acheteur_id then
      perform public._fiab_poser(null, null, true, null, null);
    else
      if p_accord is null then raise exception 'Dites si vous êtes d''accord avec le motif.'; end if;
      perform public._fiab_poser(null, null, p_accord, null, null);
    end if;
  end if;
  r := public.commande_annuler(p_id, p_oui, p_note);
  if r = 'annulation_demandee' then
    update public.commandes set annulation_motif = p_motif, annulation_motif_texte = t where id = p_id;
  elsif r = 'en_cours' then
    update public.commandes set annulation_motif = null, annulation_motif_texte = null where id = p_id;
  end if;
  perform public._fiab_poser(null, null, null, null, null);
  return r;
end $$;

-- n° 12 : « Signaler un problème » en 5 choix ; photo demandée pour « cassé » et « mauvaise qualité »
create or replace function public.commande_probleme(p_id uuid, p_type text, p_texte text default null, p_photos text[] default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text := public._cmd_texte(p_texte, 240); x text; lib text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  lib := case p_type when 'casse' then 'Marchandise cassée' when 'manquant' then 'Marchandise manquante' when 'qualite' then 'Mauvaise qualité'
                     when 'quantite' then 'Pas la bonne quantité' when 'autre' then 'Autre problème' end;
  if lib is null then raise exception 'Choisissez le problème : cassé, manquant, mauvaise qualité, mauvaise quantité ou autre.'; end if;
  if p_type = 'autre' and t is null then raise exception 'Dites le problème en quelques mots.'; end if;
  if p_photos is not null and cardinality(p_photos) > 4 then raise exception '4 photos au plus.'; end if;
  if p_type in ('casse', 'qualite') and (p_photos is null or cardinality(p_photos) < 1) then
    raise exception 'PHOTO_REQUISE : ajoutez au moins une photo de la marchandise.';
  end if;
  if p_photos is not null then
    foreach x in array p_photos loop
      if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
        raise exception 'Photo introuvable : renvoyez-la.';
      end if;
    end loop;
  end if;
  perform public.commande_litige(p_id, lib || coalesce(' · ' || t, ''));
  update public.commandes set litige_type = p_type, litige_photos = nullif(p_photos, '{}') where id = p_id;
  return 'litige';
end $$;
revoke all on function public.commande_probleme(uuid, text, text, text[]) from public, anon;
grant execute on function public.commande_probleme(uuid, text, text, text[]) to authenticated;

-- n° 2 et 14 : réception avec le mot (version 97b) ; confirmation renvoyée = « deja_confirmee » ; vendeur banni : l'acheteur confirme
-- encore pendant le litige de l'équipe
create or replace function public.commande_reception_mot(p_id uuid, p_mot text default null, p_sans_mot boolean default false,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; sans boolean := coalesce(p_sans_mot, false);
  mx integer := public._cmd_regle('mot_essais', 5); auto boolean;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if r = 'acheteur' and c.etat = 'terminee'
     and exists (select 1 from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'reception') then
    return 'deja_confirmee';
  end if;
  auto := c.etat = 'litige' and c.litige_par is null
    and ((c.litige_auto_le is not null and c.etape = 'arrivee')
         or (public.est_banni(c.vendeur_id) and c.etape in ('chargement', 'transport', 'transbordement', 'arrivee')));
  if c.etat <> 'en_cours' and not auto then raise exception 'Cette commande n''est pas en cours.'; end if;
  if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
  if c.validation = 'code' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.etape not in ('chargement', 'transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  if not sans then
    if public._mot_norme(p_mot) = '' then raise exception 'Tapez le mot secret écrit sur le papier glissé dans la marchandise.'; end if;
    if c.mot_essais >= mx then return 'mot_bloque'; end if;
    if c.mot_secret is null or public._mot_norme(p_mot) <> public._mot_norme(c.mot_secret) then
      update public.commandes set mot_essais = mot_essais + 1,
        mot_bloque_le = case when mot_essais + 1 >= mx then now() else mot_bloque_le end where id = p_id;
      if c.mot_essais + 1 >= mx then
        perform public._cmd_alerte(p_id, 'mot_bloque',
          format('%s essais faux : le mot secret est bloqué. L''équipe du Marché de Gros est prévenue.', mx));
        return 'mot_bloque';
      end if;
      return 'mot_incorrect:' || (mx - c.mot_essais - 1);
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

-- n° 14 : un message du litige verrouille la commande (la clôture automatique saute une commande verrouillée, « skip locked » ;
-- un message arrivé après la clôture reçoit « La discussion est close »)
create or replace function public.litige_ecrire(p_cmd uuid, p_texte text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t text := btrim(coalesce(p_texte, '')); r text; refus text;
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or me is null then raise exception 'Commande introuvable.'; end if;
  -- une partie de la commande écrit sous son rôle, même si son compte est administrateur
  r := case when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur' when public.est_admin() then 'admin' end;
  if r is null then raise exception 'Commande introuvable.'; end if;
  if r <> 'admin' and public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'litige' then raise exception 'La discussion est close : le litige est réglé.'; end if;
  if t = '' then raise exception 'Écrivez votre message.'; end if;
  if char_length(t) > 600 then raise exception '600 caractères au plus.'; end if;
  if r <> 'admin' then refus := public.texte_refus(t); if refus is not null then raise exception '%', refus; end if; end if;
  insert into public.litige_messages (commande_id, auteur_id, role, texte) values (c.id, me, r, t);
  update public.commandes set updated_at = now() where id = c.id;
end $$;

-- n° 13 : les étapes « terminee » qui portent une note (clôture pour le vendeur, décision de l'équipe, refus, partage) sont annoncées
-- aux deux parties ; la fin sans note (juste après « Réception confirmée ») reste muette (déjà annoncée par la réception)
create or replace function public.push_commande() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if (new.evenement = 'terminee' and new.note is null) or (new.evenement = 'transport' and new.preuve = 'auto') then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('commande_etape_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;

-- n° 9 : « fausse arrivée » constatée par l'équipe : annulée en faveur de l'acheteur, « litige perdu » pour le vendeur
create or replace function public.admin_litige_fausse_arrivee(p_cmd uuid, p_note text) returns text
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 270 then raise exception 'Expliquez ce que l''équipe a constaté (270 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if c.livre_le is null then raise exception 'Le vendeur (ou son chauffeur) n''a pas déclaré l''arrivée : pas de fausse arrivée possible.'; end if;
  if c.etat = 'en_cours' and c.etape = 'arrivee' then
    update public.commandes set etat = 'litige', litige_par = null, litige_le = now(), litige_motif = left('Fausse arrivée constatée par l''équipe : ' || nt, 300),
      litige_echeance = now(), annulation_par = null where id = c.id;
  elsif c.etat <> 'litige' then
    raise exception 'Cette commande n''est plus en cours.';
  end if;
  perform public.admin_litige_clore(p_cmd, 'annulee', 'Fausse arrivée : ' || nt, 'vendeur');
  return 'annulee';
end $$;
revoke all on function public.admin_litige_fausse_arrivee(uuid, text) from public, anon;
grant execute on function public.admin_litige_fausse_arrivee(uuid, text) to authenticated;

-- n° 11 : nombre de demandes de nouvelles restées sans réponse du vendeur
create or replace function public._cmd_nouvelles_sans_reponse(p_cmd uuid) returns integer
language sql stable security definer set search_path = public as $$
  with k as (select * from public.commandes where id = p_cmd),
  rep as (select greatest(
      (select max(s.at) from public.commande_suivi s where s.commande_id = p_cmd and s.genre = 'retard'),
      (select max(e.at) from public.commande_etapes e, k where e.commande_id = p_cmd and e.role in ('vendeur', 'chauffeur')
         and (e.par is null or e.par <> k.acheteur_id))) at)
  select count(*)::integer from public.commande_suivi s, rep
  where s.commande_id = p_cmd and s.genre = 'nouvelles' and (rep.at is null or s.at > rep.at);
$$;
revoke all on function public._cmd_nouvelles_sans_reponse(uuid) from public, anon, authenticated;

-- Ce que l'écran de la commande lit (version 99a) + n° 1, 2, 3, 6, 8, 9, 10, 11, 12
create or replace function public.commande_delais(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; hc integer := public._cmd_regle('chargement_heures', 72);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  mx integer := public._cmd_regle('mot_essais', 5); ech timestamptz; auto boolean; vb boolean; ab boolean; route boolean; arr0 timestamptz;
  dd boolean; nsr integer; adm boolean := public.est_admin();
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if c.id is null or (r is null and not adm) then raise exception 'Commande introuvable.'; end if;
  ech := case when c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') then coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) end;
  auto := c.etat = 'litige' and c.litige_auto_le is not null and not public._cmd_acheteur_a_reagi(c);
  vb := public.est_banni(c.vendeur_id);
  ab := public.est_banni(c.acheteur_id);
  route := c.etat = 'en_cours' and c.etape in ('chargement', 'transport', 'transbordement');
  arr0 := case when c.etat in ('en_cours', 'litige') and c.etape = 'arrivee' then coalesce(c.livre_le, public._cmd_arrivee_acheteur(c.id)) end;
  dd := route and c.arrivee_estimee is not null and c.arrivee_estimee < now();
  nsr := case when route or (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation')) then public._cmd_nouvelles_sans_reponse(c.id) else 0 end;
  return json_build_object(
    'confirme_le', c.confirme_le,
    'chargement_echeance', ech,
    'peut_annuler_retard', r = 'acheteur' and ech is not null and (now() >= ech or vb),
    'vendeur_banni', r = 'acheteur' and vb,
    'acheteur_banni', r = 'vendeur' and ab,
    'peut_annuler_acheteur_banni', r = 'vendeur' and ab and ech is not null,
    'je_transporte', coalesce(public._cmd_transporte(c, r), false),
    'peut_declarer_arrivee', c.etat = 'en_cours' and ((r = 'acheteur' and c.etape in ('chargement', 'transport', 'transbordement'))
      or (r in ('vendeur', 'chauffeur') and c.livre_le is null and c.etape in ('chargement', 'transport', 'transbordement', 'arrivee'))),
    'remise_vaut_arrivee', c.transport_regle = 'retrait',
    'livre_le', c.livre_le,
    'reception_echeance', case when c.etat = 'en_cours' and c.etape = 'arrivee'
      then public._cmd_reception_base(c.id) + make_interval(mins => mrec) end,
    'nuit_reportee', arr0 is not null and public._cmd_nuit_report(arr0) <> arr0,
    'litige_auto', auto,
    'cloture_echeance', case when auto then c.litige_auto_le + make_interval(mins => mlit) end,
    'mot_essais_restants', greatest(mx - coalesce(c.mot_essais, 0), 0),
    'mot_bloque', coalesce(c.mot_essais, 0) >= mx,
    'annulation_demandes', c.annulation_demandes,
    'peut_redemander', c.annulation_demandes < 2,
    'annulation_demandee_par', case when c.annulation_par is null then null when c.annulation_par = c.vendeur_id then 'vendeur' else 'acheteur' end,
    'annulation_auto_le', case when c.etat = 'en_cours' and c.annulation_par is not null and c.annulation_par = c.vendeur_id and c.annulation_demande_le is not null
      then c.annulation_demande_le + make_interval(hours => public._cmd_regle('annulation_reponse_heures', 24)) end,
    'peut_demander_annulation', c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') and c.annulation_par is null
      and ((r = 'acheteur' and c.annulation_demandes_acheteur < 2) or (r = 'vendeur' and c.annulation_demandes < 2)),
    'litige_echeance', c.litige_echeance,
    'litige_type', c.litige_type,
    'arrivee_estimee', c.arrivee_estimee,
    'date_depassee', dd,
    'peut_demander_nouvelles', r = 'acheteur' and c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation', 'chargement', 'transport', 'transbordement'),
    'nouvelles_le', c.nouvelles_le,
    'nouvelles_sans_reponse', nsr,
    'mettre_en_avant_probleme', r = 'acheteur' and (dd or nsr >= 2),
    'peut_signaler_retard', r in ('vendeur', 'chauffeur') and route,
    'peut_demander_delai', r = 'acheteur' and c.etat = 'en_cours' and c.etape = 'arrivee' and c.delai_heures is null,
    'delai_heures', c.delai_heures,
    'fausse_arrivee_possible', adm and r is null and c.livre_le is not null and (c.etat = 'litige' or (c.etat = 'en_cours' and c.etape = 'arrivee')),
    'chargement_heures', hc, 'reception_minutes', mrec, 'litige_sans_reponse_minutes', mlit,
    'reception_heures', greatest(round(mrec / 60.0), 1));
end $$;
revoke all on function public.commande_delais(uuid) from public, anon;
grant execute on function public.commande_delais(uuid) to authenticated;
