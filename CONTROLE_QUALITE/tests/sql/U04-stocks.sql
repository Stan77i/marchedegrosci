-- U04 Stocks et produits : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.

-- ══ Bloc STK-A : deux acheteurs sur le même reste, annulation après réservation, rendu une seule fois ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  o uuid; n1 uuid; n2 uuid; n uuid; c uuid; res text := ''; j json;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 10, 20000, 'stka');
  perform pg_temp.qui(B); n1 := public.nego_ouvrir('offre', o, 20000, 8, null);
  perform pg_temp.qui(Cm); n2 := public.nego_ouvrir('offre', o, 20000, 8, null);
  perform pg_temp.qui(S);
  perform public.nego_agir(n1, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n1))::uuid);
  res := 'STK-01a 1er accord: stock=' || pg_temp.lire(format('select quantity || ''/'' || status from public.offres where id = %L', o));
  res := res || ' | STK-01b 2e accord sur le même reste: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n2, 'accord', pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n2))));
  perform pg_temp.qui(Cm);
  res := res || ' | STK-01c C repropose 8: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 20000, 8, null, null)', n2, 'prix'));
  res := res || ' | STK-01d C propose 2: ' || pg_temp.e(format('select public.nego_agir(%L, %L, 20000, 2, null, null)', n2, 'prix'));
  perform pg_temp.qui(S);
  perform public.nego_agir(n2, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n2))::uuid);
  res := res || ' → stock=' || pg_temp.lire(format('select quantity || ''/'' || status from public.offres where id = %L', o));
  perform pg_temp.qui(D);
  res := res || ' | STK-01e D sur offre épuisée: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 20000, 1, null)', 'offre', o));
  -- STK-02 : le vendeur annule après réservation (commande confirmée, annulation demandée par le vendeur, acceptée par l'acheteur)
  execute 'reset role';
  c := pg_temp.cmd(S, B, n1, true);
  perform pg_temp.qui(S);
  res := res || ' | STK-02a vendeur demande l''annulation: ' || public.commande_annuler_motif(c, true, null, 'stock_epuise', null, null);
  perform pg_temp.qui(B);
  res := res || ' | acheteur accepte: ' || public.commande_annuler_motif(c, true, null, null, null, true);
  res := res || ' → stock=' || pg_temp.lire(format('select quantity || ''/'' || status from public.offres where id = %L', o))
     || ' mouvement=' || pg_temp.lire(format('select pris || ''/'' || rendu from public.stock_mouvements where negociation_id = %L', n1));
  res := res || ' | STK-02b 2e annulation: ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, null, null, null, true)', c));
  execute 'reset role';
  update public.commandes set etat = 'annulee', updated_at = now() where id = c;   -- déclencheur rejoué
  perform public.commandes_delais();
  perform public.accords_sans_suite();
  res := res || ' | STK-02c après déclencheur rejoué + tâches: stock=' || (select quantity from public.offres where id = o)
     || ' mouvement=' || (select pris || '/' || rendu from public.stock_mouvements where negociation_id = n1);
  -- l'accord de C (2) existe toujours : le stock rendu (8) ne dépasse pas le stock d'origine
  res := res || ' | STK-02d total = ' || ((select quantity from public.offres where id = o) + 2) || ' (origine 10)';
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : STK-01a stock 2 | 01b 2e accord refusé « il reste 2 » | 01c 8 refusé | 01d 2 accepté → 0/retiree | 01e offre épuisée refusée
-- | STK-02a annulation demandée → acceptée → stock 8/active, mouvement 8/8 | 02b 2e annulation refusée | 02c déclencheur + tâches : stock 8 (pas de double rendu)
-- | 02d 8 + 2 vendus = 10 (origine).

-- ══ Bloc STK-B : quantités et prix limites, unités, pause, retrait, fraude sur le stock ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; o2 uuid; n uuid; n2 uuid; c uuid; res text := ''; v text;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'stkb');
  perform pg_temp.qui(B);
  -- STK-03 : propositions limites (prix, quantité)
  foreach v in array array['0|10', '-5|10', '0.001|10', 'NaN|10', 'Infinity|10', '999999999|10', '20000|0', '20000|-1', '20000|0.5', '20000|NaN', '20000|1000000000', '20000|101'] loop
    res := res || ' STK-03 prix=' || split_part(v, '|', 1) || ' q=' || split_part(v, '|', 2) || ': '
      || pg_temp.e(format('select public.nego_ouvrir(%L, %L, %L::numeric, %L::numeric, null)', 'offre', o, split_part(v, '|', 1), split_part(v, '|', 2))) || ';';
  end loop;
  n := pg_temp.lire(format('select id::text from public.negociations where cible_id = %L and auteur_id = %L and statut = %L', o, B, 'ouverte'))::uuid;
  res := res || ' | STK-03b dernière proposition gardée: ' || pg_temp.lire(format('select dernier_prix || '' × '' || dernier_quantite from public.negociations where id = %L', n));
  -- STK-04 : accord sur une demi-unité (0,5 sac), le stock descend de 0,5
  perform pg_temp.e(format('select public.nego_agir(%L, %L, 20000, 0.5, null, null)', n, 'prix'));
  perform pg_temp.qui(S);
  perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := res || ' | STK-04 0,5 sac: stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o));
  -- STK-05 : unités : offre en tonnes, l'acheteur propose 5 000 (pensant en kg) ; la commande garde l'unité de l'annonce
  execute 'reset role';
  o2 := gen_random_uuid();
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o2, S, 'cq-stkb-t-' || o2, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 5, 'tonne', 250000, 'active');
  perform pg_temp.qui(B);
  res := res || ' | STK-05a 5 000 sur 5 tonnes: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 250000, 5000, null)', 'offre', o2));
  execute 'reset role';
  n2 := pg_temp.accord(S, B, o2, 250000, 2);
  c := pg_temp.cmd(S, B, n2, false);
  res := res || ' | STK-05b commande: ' || (select quantite || ' ' || unite || ' × ' || prix_unitaire || ' = ' || montant from public.commandes where id = c);
  -- STK-06 : pause et retrait
  update public.offres set pause_le = now() where id = o;
  perform pg_temp.qui(B);
  res := res || ' | STK-06a proposition sur offre en pause: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 20000, 5, null)', 'offre', o));
  execute 'reset role';
  update public.offres set pause_le = null where id = o;
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', o, 20000, 5, null);
  execute 'reset role';
  update public.offres set pause_le = now() where id = o;
  perform pg_temp.qui(S);
  res := res || ' | STK-06b accord pendant la pause: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, null)', n, 'accord'));
  execute 'reset role';
  update public.offres set pause_le = null, status = 'retiree' where id = o;
  res := res || ' | STK-06c négociation après retrait: ' || (select statut || coalesce('/' || motif_fin, '') from public.negociations where id = n);
  perform pg_temp.qui(S);
  res := res || ' accord: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, null)', n, 'accord'));
  -- STK-07 : fraude sur le stock
  perform pg_temp.qui(B);
  res := res || ' | STK-07a acheteur change le stock du vendeur: ' || pg_temp.e(format('update public.offres set quantity = 99999, status = %L where id = %L', 'active', o))
     || ' → ' || pg_temp.lire(format('select quantity || ''/'' || status from public.offres where id = %L', o));
  res := res || ' | STK-07b acheteur écrit un mouvement de stock: ' || pg_temp.e(format('insert into public.stock_mouvements (negociation_id, cible, cible_id, pris) values (%L, %L, %L, 1)', gen_random_uuid(), 'offre', o));
  perform pg_temp.qui(S);
  res := res || ' | STK-07c vendeur publie quantité négative: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, -5, %L, 1000, %L)', S, 'cq-neg-' || gen_random_uuid(), 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active'));
  res := res || ' | STK-07d quantité 0: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 0, %L, 1000, %L)', S, 'cq-zero-' || gen_random_uuid(), 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active'));
  res := res || ' | STK-07e prix négatif: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 10, %L, -1000, %L)', S, 'cq-pn-' || gen_random_uuid(), 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active'));
  res := res || ' | STK-07f unité inventée: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 10, %L, 1000, %L)', S, 'cq-u-' || gen_random_uuid(), 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'camion', 'active'));
  res := res || ' | STK-07g quantité vide: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, null, %L, 1000, %L)', S, 'cq-null-' || gen_random_uuid(), 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active'));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : STK-03 prix 0, -5, NaN, Infinity refusés ; prix 0,001 F ACCEPTÉ ; prix 999 999 999 accepté ; quantité 0, -1, NaN, 1e9, 101 refusées ;
-- 0,5 sac accepté | 03b dernière proposition 20000 × 0.5 | STK-04 stock 99.5 | STK-05a 5 000 sur 5 tonnes refusé | 05b commande « 2 tonne × 250000 = 500000 »
-- | STK-06a/b pause : proposition et accord refusés | 06c retrait : négociation close/annonce_retiree, accord impossible
-- | STK-07a « ok » mais 0 ligne touchée (stock inchangé 99.5) | 07b refusé | 07c/d/g QUANTITE_REQUISE | 07e prix négatif refusé | 07f unité « camion » ACCEPTÉE.

-- ══ Bloc STK-C : demande (sens inverse) et accord sans suite : rendu une seule fois ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  did uuid := gen_random_uuid(); n1 uuid; n2 uuid; res text := ''; k1 int; k2 int;
begin
  perform pg_temp.verif(D);
  insert into public.demandes (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, status)
    values (did, D, 'cq-stkc-' || did, 'mais', 'Maïs', 'san-pedro', 'San-Pédro', 10, 'sac', 20000, 'active');
  perform pg_temp.qui(S); n1 := public.nego_ouvrir('demande', did, 20000, 8, null);
  perform pg_temp.qui(Cm); n2 := public.nego_ouvrir('demande', did, 20000, 8, null);
  perform pg_temp.qui(D);
  perform public.nego_agir(n1, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n1))::uuid);
  res := 'STK-08a demande 1er accord: reste=' || pg_temp.lire(format('select quantity::text from public.demandes where id = %L', did));
  res := res || ' | STK-08b 2e accord: ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n2, 'accord', pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n2))));
  execute 'reset role';
  set local session_replication_role = replica;
  update public.negociations set conclu_le = now() - interval '73 hours' where id = n1;
  set local session_replication_role = origin;
  k1 := public.accords_sans_suite();
  k2 := public.accords_sans_suite();
  res := res || ' | STK-09 accord sans commande 73 h: 1er passage=' || k1 || ' 2e passage=' || k2
     || ' reste=' || (select quantity || '/' || status from public.demandes where id = did)
     || ' mouvement=' || (select pris || '/' || rendu from public.stock_mouvements where negociation_id = n1);
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : STK-08a reste 2 | 08b 2e accord refusé « il reste 2 » | STK-09 1er passage 1, 2e passage 0, reste 10/active, mouvement 8/8.
-- En attente : deux connexions simultanées (STK-10 : deux « accord » au même instant sur le dernier sac ; le code verrouille l'annonce par « for update »,
-- la preuve à deux connexions n'est pas possible par le MCP).
-- Règle en cours de changement (schéma 97b, autre équipe) : quantité minimale et achat partiel ; non testé ici.
