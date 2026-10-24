-- Tests du schéma 84 (chantier 2, fiabilité). À lancer sur le projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- Chaque bloc finit par raise exception 'TEST …' : tout est annulé, rien ne reste dans la base.
-- Les fonctions sont appelées comme le ferait un membre (auth.uid() lu dans request.jwt.claims) ;
-- le bloc E vérifie les droits avec les vrais rôles (authenticated, anon).
-- Données de simulation du projet de test : offre de Daloa, vendeur S, acheteur B, administrateur ADM.

-- outils du test (fonctions temporaires, annulées avec le reste)
create or replace function pg_temp.qui(u uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); $f$;
create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
-- une commande proposée par l'acheteur B à partir de l'offre o (négociation, accord du vendeur S, création)
create or replace function pg_temp.mk(S uuid, B uuid, o uuid) returns uuid language plpgsql as $f$
declare n uuid; g public.negociations;
begin
  perform pg_temp.qui(B); n := public.nego_ouvrir2('offre', o, 440, 5, null, 'sans', null);
  perform pg_temp.qui(S); select * into g from public.negociations where id = n;
  perform public.nego_agir2(n, 'accord', null, null, null, g.dernier_msg);
  perform pg_temp.qui(B); return public.commande_creer2(n, 'acheteur', 'Marché de Daloa', 'Daloa');
end $f$;
create or replace function pg_temp.copie(src uuid, p_etat text) returns uuid language plpgsql as $f$
declare c public.commandes; i uuid := gen_random_uuid();
begin
  select * into c from public.commandes where id = src;
  c.id := i; c.numero := 'TEST-' || left(i::text, 8); c.negociation_id := null; c.etat := p_etat; c.annulation_par := null;
  c.etape := case when p_etat = 'terminee' then 'terminee' else 'confirmee' end; c.termine_le := case when p_etat = 'terminee' then now() end;
  insert into public.commandes select (c).*;
  return i;
end $f$;
create or replace function pg_temp.abusive(S uuid, B uuid, src uuid) returns uuid language plpgsql as $f$
declare c uuid;
begin
  c := pg_temp.copie(src, 'en_cours');
  perform pg_temp.qui(S); perform public.commande_annuler_motif(c, true, null, 'prix_change', null);
  perform pg_temp.qui(B); perform public.commande_annuler_motif(c, true, null, null, null, false);
  return (select id from public.annulations where commande_id = c);
end $f$;

-- Résultats obtenus le 24/10/2026 sur le projet de test (blocs lancés un par un avec les outils ci-dessus) :
-- A. motif obligatoire (« Choisissez un motif », « autre » sans mot refusé), retrait et refus avant confirmation = légitime,
--    imputée à personne ; ancien chemin sans motif accepté ; demande du vendeur après confirmation, l'acheteur voit le motif,
--    doit dire s'il est d'accord ; d'accord = légitime ; pas d'accord = abusive pour le vendeur + avertissement ; ancien chemin = légitime depuis 84f ;
--    l'acheteur ne peut pas demander seul après confirmation ; une seule ligne par commande ; un tiers ne voit rien.
-- B. paliers : 1-2 avertissement, 3-4 baisse, 5 examen ; aucune suspension automatique ; achat groupé : 3 annulations du même
--    groupe = 1 dans le comptage et 1 sanction ; expiration après 48 h (tâche) = légitime, motif « sans réponse », journal ;
--    commande récente non touchée ; litige tranché avec fautif = catégorie litige imputée, sans sanction ; refus non-admin et
--    fautif hors commande ; litige sans fautif (ou ancien écran) = imputé à personne.
-- C. 24 terminées + 1 abusive = « 96 % sur 25 » (public et reputation_publique) ; 3 abusives = 80 % (poids double) ;
--    contestation : seulement l'intéressé, texte trop court, numéro refusé, une seule fois, 7 jours ; acceptée en « technique »
--    → sanction levée, score 92 % ; requalification légitime puis abusive pour l'acheteur, une seule sanction ;
--    réglages : seuils dans l'ordre, clés connues, nombres entiers ; tout refusé à un membre.
-- D/E. suspension par l'admin seulement (motif, 1 à 365 jours) ; 7 jours puis 30 en récidive ; annonces masquées puis rendues
--    (levée par l'admin, ou fin naturelle par la tâche) ; pas rendues à un compte banni ; nouvelle offre, remise en ligne,
--    nouvelle négociation et nouvelle commande refusées ; la commande en cours avance (préparation, chargement, départ).
-- F. rôles réels : authenticated ne lit ni n'écrit les 3 tables, ni les fonctions internes ; anon ne peut que lire le score.
-- G. admin_litige_clore : refusé à un membre, rôle inconnu refusé, « faute de l'acheteur » = litige imputé à l'acheteur.

-- Exemple : bloc A (les autres blocs suivent le même modèle)
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; c1 uuid; c4 uuid; c5 uuid; r text := ''; a public.annulations; x text; j json;
begin
  c1 := pg_temp.mk(S, B, o);
  r := r || 'A1a ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, null, null, null)', c1)) || E'\n';
  r := r || 'A1d ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, %L, %L, null)', c1, 'désolé', 'erreur_saisie')) || E'\n';
  select * into a from public.annulations where commande_id = c1;
  r := r || 'A1e chemin=' || a.chemin || ' cat=' || a.categorie || ' imp=' || coalesce(a.imputable_id::text, 'personne') || E'\n';
  c4 := pg_temp.mk(S, B, o); perform pg_temp.qui(S); perform public.commande_repondre_motif(c4, true, null);
  x := public.commande_annuler_motif(c4, true, null, 'panne_meteo', 'Camion en panne');
  perform pg_temp.qui(B); j := public.commande_annulation_motif(c4);
  x := public.commande_annuler_motif(c4, true, null, null, null, true);
  select * into a from public.annulations where commande_id = c4;
  r := r || 'A4 ' || j::text || ' cat=' || a.categorie || E'\n';
  c5 := pg_temp.mk(S, B, o); perform pg_temp.qui(S); perform public.commande_repondre_motif(c5, true, null);
  perform public.commande_annuler_motif(c5, true, null, 'prix_change', null);
  perform pg_temp.qui(B); perform public.commande_annuler_motif(c5, true, null, null, null, false);
  select * into a from public.annulations where commande_id = c5;
  r := r || 'A5 cat=' || a.categorie || ' sanction=' || (select type from public.sanctions where annulation_id = a.id) || E'\n';
  raise exception E'TEST\n%', r;
end $$;

-- Bloc D/E : suspension
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; r text := ''; j json; sid uuid; actives int;
begin
  select count(*) into actives from public.offres where user_id = S and status = 'active';
  perform pg_temp.qui(ADM);
  j := public.admin_suspendre(S, 'Test'); sid := (j ->> 'id')::uuid;
  r := r || 'D2 ' || (j ->> 'jours') || ' jours, masquées=' || (select count(*) from public.offres where suspension_id = sid) || E'\n';
  perform pg_temp.qui(S);
  r := r || 'D3 nego ' || pg_temp.e(format('select public.nego_ouvrir2(%L, %L, 500, 5, null, %L, null)', 'offre', o, 'sans')) || E'\n';
  update public.sanctions set debut = now() - interval '8 days', fin = now() - interval '1 minute' where id = sid;
  perform set_config('request.jwt.claims', '', true);
  r := r || 'E2 ' || public.fiabilite_tick()::text || ' actives avant=' || actives || ' après=' || (select count(*) from public.offres where user_id = S and status = 'active') || E'\n';
  raise exception E'TEST\n%', r;
end $$;

-- Bloc H (relecture, schéma 84f) : ancien chemin légitime, confidentialité de « Ma fiabilité ».
-- Résultats obtenus le 24/10/2026 : T1 ancien chemin = légitime, 0 sanction ; T2 pas d'accord = abusive vendeur + avertissement,
-- second appel refusé, 1 ligne ; T3 l'acheteur ne peut pas contester, ne voit ni catégorie, ni contestation, ni note ; le vendeur
-- voit tout ; réimputée à l'acheteur après la contestation du vendeur : « contestable » faux, 1 seule sanction active (acheteur).
do $$
declare S uuid := 'd56f75b3-463d-484d-9e19-4af3fd3eb8d8'; B uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid := '94a33186-8a5e-4cf1-a198-d8a7d6c523ab'; c1 uuid; c2 uuid; r text := ''; a public.annulations; j json; cid uuid; x text;
begin
  c1 := pg_temp.mk(S, B, o); perform pg_temp.qui(S); perform public.commande_repondre(c1, true, null);
  perform public.commande_annuler(c1, true, 'vieux');
  perform pg_temp.qui(B); perform public.commande_annuler(c1, true, null);
  select * into a from public.annulations where commande_id = c1;
  r := r || 'T1 ancien: cat=' || a.categorie || ' sanctions=' || (select count(*) from public.sanctions where annulation_id = a.id) || E'\n';
  c2 := pg_temp.mk(S, B, o); perform pg_temp.qui(S); perform public.commande_repondre_motif(c2, true, null);
  x := public.commande_annuler_motif(c2, true, null, 'prix_change', null);
  perform pg_temp.qui(B); x := public.commande_annuler_motif(c2, true, null, null, null, false);
  select * into a from public.annulations where commande_id = c2;
  perform pg_temp.qui(S); cid := public.contester_annulation(a.id, 'Le camion est vraiment tombé en panne');
  perform pg_temp.qui(B); j := public.ma_fiabilite();
  r := r || 'T3 B voit: ' || coalesce((select e::text from json_array_elements(j->'annulations') e where (e->>'id')::uuid = a.id), 'rien') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
