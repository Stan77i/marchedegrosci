-- U06 Transport et livraison : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.
-- Comptes de test : chauffeur f8e1b009… (transporteur vérifié d9b2a5a8…), administrateur 981961d4….

-- ══ Bloc TRA-A : service réseau fermé, puis ouvert (dans ce bloc annulé) : prix à trois, changement de prix après accord, codes ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; CHF uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TRP uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid; n uuid; c uuid; m uuid; p1 uuid; p2 uuid; res text := ''; k1 text; k2 text; v text; j json;
begin
  perform pg_temp.verif(S);
  update public.reglages set valeur = 'false'::jsonb where cle = 'transport_reseau_ouvert';
  o := pg_temp.offre(S, 1000, 20000, 'traa');
  n := pg_temp.accord(S, B, o, 20000, 10);
  perform pg_temp.qui(B);
  res := 'TRA-01 commande « réseau » service fermé: ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'reseau', 'Daloa'));
  -- ouverture du service, seulement dans ce bloc annulé
  execute 'reset role';
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  perform pg_temp.qui(B);
  c := public.commande_creer2(n, 'reseau', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  perform pg_temp.qui(ADM);
  res := res || ' | TRA-02 affectation: ' || public.admin_affecter(c, TRP);
  m := pg_temp.lire(format('select id::text from public.transport_missions where commande_id = %L and statut = %L', c, 'proposee'))::uuid;
  -- TRA-03 : l'acheteur propose avant le transporteur
  perform pg_temp.qui(B);
  res := res || ' | TRA-03 acheteur propose en premier: ' || pg_temp.e(format('select public.transport_agir(%L, %L, 30000, null)', m, 'prix'));
  -- TRA-04 : prix limites
  perform pg_temp.qui(CHF);
  foreach v in array array['0', '-1', '0.4', '100000000', 'NaN'] loop
    res := res || ' TRA-04 prix=' || v || ': ' || pg_temp.e(format('select public.transport_agir(%L, %L, %L::numeric, null)', m, 'prix', v)) || ';';
  end loop;
  res := res || ' propositions_à_0=' || pg_temp.lire(format('select count(*)::text from public.transport_propositions where mission_id = %L and prix <= 0', m));
  -- TRA-05 : le transporteur change son prix après l'accord de l'acheteur, avant celui du vendeur
  perform public.transport_agir(m, 'prix', 50000, null);
  p1 := pg_temp.lire(format('select id::text from public.transport_propositions where mission_id = %L and issue = %L', m, 'en_attente'))::uuid;
  perform pg_temp.qui(B); perform public.transport_agir(m, 'accord', null, p1);
  perform pg_temp.qui(CHF); perform public.transport_agir(m, 'prix', 65000, null);
  p2 := pg_temp.lire(format('select id::text from public.transport_propositions where mission_id = %L and issue = %L', m, 'en_attente'))::uuid;
  perform pg_temp.qui(S);
  res := res || ' | TRA-05a vendeur accepte l''ancien prix: ' || pg_temp.e(format('select public.transport_agir(%L, %L, null, %L)', m, 'accord', p1));
  res := res || ' | TRA-05b vendeur accepte le nouveau: ' || pg_temp.e(format('select public.transport_agir(%L, %L, null, %L)', m, 'accord', p2))
     || ' mission=' || pg_temp.lire(format('select statut || coalesce('' '' || prix, '''') from public.transport_missions where id = %L', m));
  perform pg_temp.qui(B); perform public.transport_agir(m, 'accord', null, p2);
  res := res || ' | TRA-05c acheteur accepte le nouveau: mission=' || pg_temp.lire(format('select statut || '' '' || prix from public.transport_missions where id = %L', m))
     || ' total_convenu=' || pg_temp.lire(format('select total_convenu::text from public.commandes where id = %L', c))
     || ' registre_transport=' || pg_temp.lire(format('select coalesce(string_agg(statut || '':'' || commission, '',''), %L) from public.commissions_transport where mission_id = %L', 'aucun', m));
  -- TRA-06 : prix changé après l'accord des trois
  perform pg_temp.qui(CHF);
  res := res || ' | TRA-06a transporteur change son prix après accord: ' || pg_temp.e(format('select public.transport_agir(%L, %L, 90000, null)', m, 'prix'));
  perform pg_temp.qui(S);
  res := res || ' | TRA-06b vendeur refuse après accord: ' || pg_temp.e(format('select public.transport_agir(%L, %L, null, null)', m, 'refus'));
  -- TRA-07 : un tiers
  perform pg_temp.qui(Cm);
  res := res || ' | TRA-07 tiers: ' || pg_temp.e(format('select public.transport_agir(%L, %L, 1000, null)', m, 'prix'));
  -- TRA-08 : messages privés pendant la mission
  perform pg_temp.qui(CHF);
  res := res || ' | TRA-08 chauffeur écrit en privé à l''acheteur: ' || pg_temp.e(format('select public.dm_envoyer(public.dm_ouvrir(%L), %L, null)', B, 'Payez-moi en direct'));
  -- TRA-09 : codes : mauvais code, ancien code, 5 essais
  perform pg_temp.qui(S);
  j := public.commande_code_obtenir(c, 'prise_en_charge'); k1 := coalesce(j ->> 'code', j::text);
  j := public.commande_code_obtenir(c, 'prise_en_charge'); k2 := coalesce(j ->> 'code', j::text);
  perform pg_temp.qui(CHF);
  res := res || ' | TRA-09a ancien code (k1≠k2: ' || (k1 <> k2) || '): ' || coalesce(public.commande_valider_code(c, k1, null, null) ->> 'message', 'ok');
  res := res || ' | TRA-09b code de lettres: ' || coalesce(public.commande_valider_code(c, 'abcdef', null, null) ->> 'message', 'ok');
  res := res || ' | TRA-09c 3 essais faux de plus: ' || coalesce(public.commande_valider_code(c, '000000', null, null) ->> 'message', 'ok') || ' / '
     || coalesce(public.commande_valider_code(c, '000001', null, null) ->> 'message', 'ok') || ' / ' || coalesce(public.commande_valider_code(c, '000002', null, null) ->> 'message', 'ok');
  res := res || ' | TRA-09d bon code après blocage: ' || coalesce(public.commande_valider_code(c, k2, null, null) ->> 'message', 'ok') || ' ' || pg_temp.cs(c);
  -- preuves de départ du vendeur (obligatoires avant la prise en charge)
  perform pg_temp.qui(S); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', S || '/cq/' || c || '-1.jpg', S, now() + interval '1 second'),
    ('preuves', S || '/cq/' || c || '-2.jpg', S, now() + interval '1 second'), ('preuves', S || '/motpapier-cq-' || c || '.jpg', S, now() + interval '1 second');
  perform pg_temp.qui(S);
  perform public.commande_depart_preuves(c, array[S || '/cq/' || c || '-1.jpg', S || '/cq/' || c || '-2.jpg'], 2500);
  perform public.commande_depart_mot(c, S || '/motpapier-cq-' || c || '.jpg');
  j := public.commande_code_obtenir(c, 'prise_en_charge');
  perform pg_temp.qui(CHF);
  res := res || ' | TRA-09e nouveau code: ' || (public.commande_valider_code(c, j ->> 'code', null, null))::text || ' ' || pg_temp.cs(c);
  -- TRA-10 : prix après le chargement
  res := res || ' | TRA-10 prix après chargement: ' || pg_temp.e(format('select public.transport_agir(%L, %L, 1000, null)', m, 'prix'));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : TRA-01 service fermé : commande « réseau » refusée | 02 affectation proposee | 03 acheteur en premier refusé
-- | 04 prix 0, -1, 1e8, NaN refusés proprement ; prix 0,4 refusé par une contrainte (message technique anglais) | 05a ancien prix « a changé »
-- | 05b vendeur seul : mission encore proposee | 05c les trois : acceptee 65 000, total 265 000, commission transport prevue 4 485 (6,9 %)
-- | 06a/06b prix « déjà convenu » | 07 tiers « Mission introuvable » | 08 message privé refusé | 09a ancien code refusé (compte comme essai)
-- | 09b–c 5 essais → bloqué | 09d bon code après blocage refusé | 09e nouveau code ok → transport | 10 prix après chargement refusé.

-- ══ Bloc TRA-B : livraison déclarée, acheteur muet ; mot secret (faux, ancien, 5 essais) ; photos de départ réutilisées ; refus du prix ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; c2 uuid; c3 uuid; res text := ''; mot text; mot2 text; i int; r text;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'trab');
  -- TRA-11 : livraison déclarée par le vendeur, l'acheteur ne confirme jamais (règle actuelle du test : 24 h ; en cours de changement vers 1 h + 1 h)
  n := pg_temp.accord(S, B, o, 20000, 10);
  c := pg_temp.cmd(S, B, n, true);
  perform pg_temp.partir(S, c);
  perform pg_temp.qui(S); perform public.commande_avancer(c, 'arrivee', null, null, null, null);
  execute 'reset role';
  res := 'TRA-11 règles lues: ' || (select (valeur ->> 'reception_heures') || ' h / reception_minutes=' || coalesce(valeur ->> 'reception_minutes', '-') || ' / litige_sans_reponse_minutes=' || coalesce(valeur ->> 'litige_sans_reponse_minutes', '-') from public.reglages where cle = 'commandes');
  update public.commandes set livre_le = now() - interval '61 minutes' where id = c;
  perform public.commandes_delais();
  res := res || ' | à 61 min: ' || (select etat from public.commandes where id = c);
  update public.commandes set livre_le = now() - interval '13 hours' where id = c;
  perform public.commandes_delais();
  res := res || ' | à 13 h: ' || (select etat || ' alertes=' || coalesce((select string_agg(evenement, ',') from public.commande_alertes where commande_id = c), '-') from public.commandes where id = c);
  update public.commandes set livre_le = now() - interval '25 hours' where id = c;
  perform public.commandes_delais();
  res := res || ' | à 25 h: ' || (select etat || ' par=' || coalesce(litige_par::text, 'systeme') from public.commandes where id = c)
     || ' commission=' || (select statut_registre from public.commissions where commande_id = c);
  -- TRA-12 : mot secret : ancien mot d'une autre commande, majuscules, 5 essais, puis bon mot, puis « sans mot »
  n := pg_temp.accord(S, B, o, 20000, 10);
  c2 := pg_temp.cmd(S, B, n, true);
  perform pg_temp.partir(S, c2);
  n := pg_temp.accord(S, B, o, 20000, 10);
  c3 := pg_temp.cmd(S, B, n, true);
  perform pg_temp.partir(S, c3);
  select mot_secret into mot from public.commandes where id = c2;
  select mot_secret into mot2 from public.commandes where id = c3;
  perform pg_temp.qui(B);
  res := res || ' | TRA-12a mot de l''autre commande: ' || public.commande_reception_mot(c3, mot, false, null, null, null);
  res := res || ' | TRA-12b mot vide: ' || pg_temp.e(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c3, '   '));
  for i in 1..4 loop r := public.commande_reception_mot(c3, 'faux' || i, false, null, null, null); res := res || ' essai' || (i + 1) || '=' || r; end loop;
  res := res || ' | TRA-12c bon mot après blocage: ' || public.commande_reception_mot(c3, mot2, false, null, null, null) || ' ' || pg_temp.cs(c3);
  res := res || ' | TRA-12d « sans mot » après blocage: ' || pg_temp.e(format('select public.commande_reception_mot(%L, null, true, null, null, null)', c3)) || ' ' || pg_temp.cs(c3);
  res := res || ' | TRA-12e mot en majuscules avec espaces: ' || public.commande_reception_mot(c2, '  ' || upper(mot) || ' ', false, null, null, null);
  -- TRA-13 : photos de départ d'une autre commande réutilisées
  execute 'reset role';
  n := pg_temp.accord(S, B, o, 20000, 10);
  c := pg_temp.cmd(S, B, n, true);
  perform pg_temp.qui(S);
  res := res || ' | TRA-13a photos d''une autre commande: ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L::text[], 2500)', c, array[S || '/cq/' || c2 || '-1.jpg', S || '/cq/' || c2 || '-2.jpg']));
  res := res || ' | TRA-13b photo d''un autre membre: ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L::text[], 2500)', c, array[B || '/x-1.jpg', B || '/x-2.jpg']));
  res := res || ' | TRA-13c poids 0: ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L::text[], 0)', c, array[S || '/cq/' || c2 || '-1.jpg', S || '/cq/' || c2 || '-2.jpg']));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026, après le schéma 97b appliqué par l'autre équipe à 00:22 UTC) : TRA-11 règles reception_heures=24, reception_minutes=60 ;
-- à 61 min → litige automatique (règle en cours de changement : 24 h avant, 1 h maintenant) ; commission suspendue
-- | TRA-12a mot d'une autre commande → mot_incorrect:4 | 12b mot vide refusé (ne compte pas) | 5e essai → mot_bloque | 12c bon mot après blocage → mot_bloque
-- | 12d « sans mot » après blocage → terminee (l'acheteur peut toujours confirmer sans mot) | 12e majuscules + espaces → terminee
-- | TRA-13a photos d'une autre commande refusées | 13b photo d'un autre membre refusée | 13c non concluant (refus sur la photo avant le poids).
-- En attente : GPS réel (positions du chauffeur) ; deux connexions simultanées (TRA-14 : deux « accord » du prix à trois au même instant).

-- ══ Bloc TRA-C : refus du prix du transporteur → la commande continue avec le livreur du vendeur ; expiration 48 h ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; CHF uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; TRP uuid := 'd9b2a5a8-5949-48b3-a328-e8d642c3db5d';
  o uuid; n uuid; c uuid; m uuid; res text := '';
begin
  perform pg_temp.verif(S);
  update public.reglages set valeur = 'true'::jsonb where cle = 'transport_reseau_ouvert';
  o := pg_temp.offre(S, 1000, 20000, 'trac');
  n := pg_temp.accord(S, B, o, 20000, 10);
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'reseau', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  perform pg_temp.qui(ADM); perform public.admin_affecter(c, TRP);
  m := pg_temp.lire(format('select id::text from public.transport_missions where commande_id = %L and statut = %L', c, 'proposee'))::uuid;
  perform pg_temp.qui(CHF); perform public.transport_agir(m, 'prix', 40000, null);
  -- TRA-15 : prix expiré (48 h)
  execute 'reset role';
  update public.transport_propositions set expire_le = now() - interval '1 minute' where mission_id = m and issue = 'en_attente';
  perform pg_temp.qui(B);
  res := 'TRA-15 accord d''un prix expiré: ' || pg_temp.e(format('select public.transport_agir(%L, %L, null, null)', m, 'accord'));
  perform pg_temp.qui(CHF); perform public.transport_agir(m, 'prix', 45000, null);
  -- TRA-16 : refus par l'acheteur
  perform pg_temp.qui(B);
  res := res || ' | TRA-16a refus: ' || pg_temp.e(format('select public.transport_agir(%L, %L, null, null)', m, 'refus'))
     || ' mission=' || pg_temp.lire(format('select statut from public.transport_missions where id = %L', m))
     || ' commande=' || pg_temp.lire(format('select concat_ws(%L, etat, mode_transport, validation, transport_regle, coalesce(transporteur_id::text, %L)) from public.commandes where id = %L', ' ', 'sans_transporteur', c));
  perform pg_temp.qui(CHF);
  res := res || ' | TRA-16b transporteur propose encore: ' || pg_temp.e(format('select public.transport_agir(%L, %L, 30000, null)', m, 'prix'));
  perform pg_temp.qui(ADM);
  res := res || ' | TRA-16c réaffectation: ' || pg_temp.e(format('select public.admin_affecter(%L, %L)', c, TRP));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : TRA-15 prix expiré refusé | TRA-16a refus → mission retiree, commande en_cours, livreur du vendeur, déclaration
-- | 16b le transporteur ne peut plus proposer | 16c réaffectation refusée (mode vendeur).
