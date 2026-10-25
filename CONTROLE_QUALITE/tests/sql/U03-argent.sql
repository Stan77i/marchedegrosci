-- U03 Transactions et argent : exercices joués sur le projet de TEST (yowdymdnoiubatxlwhfv). Rien ne reste : chaque bloc finit par raise exception.
-- Coller d'abord le contenu de _outils.sql (même dossier) dans la même requête. Résultats du 25/10/2026 : CONTROLE_QUALITE/rapports/annexes/2026-10-25-metier.md.
-- Ce qui existe : calcul de la commission (3,5 %), registre (commissions, commission_journal), clôture 1 h, journal du séquestre.
-- Ce qui n'est PAS branché : paiement, dépôt réel, remboursement, prélèvement. Ces tests sont « en attente : prestataire de paiement ».

-- ══ Bloc ARG-A : commission prévue → calculée, double clôture, coupure au milieu, tentatives de fraude ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; res text := ''; mot text; k int; j0 int; j1 int;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'arga');
  n := pg_temp.accord(S, B, o, 19000, 100);
  c := pg_temp.cmd(S, B, n, true);
  res := 'ARG-01 après confirmation: ' || (select statut || '/' || statut_registre || ' ' || commission || ' F sur ' || montant_vente from public.commissions where commande_id = c);
  perform pg_temp.partir(S, c);
  select mot_secret into mot from public.commandes where id = c;
  perform pg_temp.qui(B);
  perform public.commande_avancer(c, 'arrivee', null, null, null, null);
  -- ARG-07 : coupure juste après la confirmation de réception (erreur dans la même transaction)
  begin
    perform public.commande_reception_mot(c, mot, false, null, null, null);
    raise exception 'coupure simulée';
  exception when others then
    res := res || ' | ARG-07 après coupure: ' || pg_temp.cs(c) || ' commission=' || pg_temp.lire(format('select statut_registre from public.commissions where commande_id = %L', c));
  end;
  res := res || ' | ARG-01b réception: ' || public.commande_reception_mot(c, mot, false, null, null, null);
  res := res || ' | ARG-03a 2e réception: ' || pg_temp.e(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, mot));
  res := res || ' | ARG-03b clôture: ' || pg_temp.e(format('select public.commande_liberer(%L)', c));
  res := res || ' | ARG-03c 2e clôture: ' || pg_temp.e(format('select public.commande_liberer(%L)', c));
  execute 'reset role';
  k := public.sequestre_liberer_echus();
  res := res || ' | ARG-03d tâche 1 h ensuite: liberation=' || (select liberation from public.commandes where id = c);
  select count(*) into j0 from public.commission_journal j join public.commissions m on m.id = j.commission_id where m.commande_id = c;
  update public.commandes set updated_at = now(), lieu_livraison = 'x' where id = c;   -- déclencheur rejoué
  select count(*) into j1 from public.commission_journal j join public.commissions m on m.id = j.commission_id where m.commande_id = c;
  res := res || ' | ARG-03e registre: ' || (select string_agg(j.statut, '>' order by j.id) from public.commission_journal j join public.commissions m on m.id = j.commission_id where m.commande_id = c)
     || ' lignes avant/après déclencheur rejoué=' || j0 || '/' || j1
     || ' final=' || (select statut || '/' || statut_registre || ' ' || commission || ' F' from public.commissions where commande_id = c);
  -- ARG-04 : fraude par l'acheteur ou le vendeur
  perform pg_temp.qui(S);
  res := res || ' | ARG-04a vendeur passe sa commission à annulee: ' || pg_temp.e(format('update public.commissions set statut = %L, commission = 0 where commande_id = %L', 'annulee', c))
     || ' → ' || pg_temp.lire(format('select statut_registre || '' '' || commission from public.commissions where commande_id = %L', c));
  res := res || ' | ARG-04b vendeur écrit au registre: ' || pg_temp.e(format('insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif) select id, %L, 0, 0, %L from public.commissions where commande_id = %L', 'annulee', 'x', c));
  res := res || ' | ARG-04c vendeur crée un séquestre: ' || pg_temp.e(format('insert into public.sequestres (commande_id, operateur, reference, montant) values (%L, %L, %L, 1)', c, 'x', 'x'));
  res := res || ' | ARG-04d vendeur appelle le dépôt: ' || pg_temp.e(format('select public.sequestre_depot_confirme(%L, %L, %L, 1)', c, 'x', 'x'));
  perform pg_temp.qui(B);
  res := res || ' | ARG-04e acheteur baisse le montant: ' || pg_temp.e(format('update public.commandes set montant = 1, montant_refuse = 0 where id = %L', c))
     || ' → ' || pg_temp.lire(format('select montant::text from public.commandes where id = %L', c));
  res := res || ' | ARG-04f acheteur appelle la tâche de clôture: ' || pg_temp.e('select public.sequestre_liberer_echus()');
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : ARG-01 prevue 66 500 F sur 1 900 000 | ARG-07 après coupure en_cours/arrivee, commission prevue (rien à moitié)
-- | réception terminee | 2e réception « n'est pas en cours » | clôture ok, 2e « déjà clôturée » | liberation=conforme | registre prevue>calculee,
-- 2 lignes avant et après déclencheur rejoué | ARG-04 a–f : tout refusé (permission denied), montant inchangé.

-- ══ Bloc ARG-B : « due » seulement avec séquestre, annulation, arrondis, vendeur officiel, montants énormes ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; c2 uuid; res text := ''; mot text; tot numeric;
begin
  perform pg_temp.verif(S);
  -- ARG-05 : fonction de dépôt (service seulement, jamais appelée par l'application) : mauvais montant, double appel
  o := pg_temp.offre(S, 100, 10000, 'argb1');
  n := pg_temp.accord(S, B, o, 10000, 10);
  c := pg_temp.cmd(S, B, n, true);
  tot := (public._seq_repartition(c) ->> 'total')::numeric;
  res := 'ARG-05a total attendu=' || tot || ' dépôt faux montant: ' || pg_temp.e(format('select public.sequestre_depot_confirme(%L, %L, %L, %s)', c, 'wave', 'cq-ref-1', tot - 1));
  res := res || ' | ARG-05b dépôt juste: ' || public.sequestre_depot_confirme(c, 'wave', 'cq-ref-1', tot);
  res := res || ' | ARG-05c 2e appel (même réf.): ' || public.sequestre_depot_confirme(c, 'wave', 'cq-ref-1', tot) || ' lignes=' || (select count(*) from public.sequestres where commande_id = c);
  perform pg_temp.partir(S, c);
  select mot_secret into mot from public.commandes where id = c;
  perform pg_temp.qui(B);
  perform public.commande_reception_mot(c, mot, false, null, null, null);
  perform public.commande_liberer(c);
  execute 'reset role';
  res := res || ' | ARG-05d clôture avec séquestre: ' || (select statut || '/' || statut_registre || ' ' || commission from public.commissions where commande_id = c);
  -- ARG-06 : sans séquestre, même parcours → jamais « due »
  o := pg_temp.offre(S, 100, 10000, 'argb2');
  n := pg_temp.accord(S, B, o, 10000, 10);
  c2 := pg_temp.cmd(S, B, n, true);
  res := res || ' | ARG-05e même référence de dépôt sur une autre commande: ' || pg_temp.e(format('select public.sequestre_depot_confirme(%L, %L, %L, %s)', c2, 'wave', 'cq-ref-1', tot));
  perform pg_temp.partir(S, c2);
  select mot_secret into mot from public.commandes where id = c2;
  perform pg_temp.qui(B);
  perform public.commande_reception_mot(c2, mot, false, null, null, null);
  perform public.commande_liberer(c2);
  execute 'reset role';
  res := res || ' | ARG-06 clôture sans séquestre: ' || (select statut || '/' || statut_registre from public.commissions where commande_id = c2)
     || ' due_sur_toute_la_base_sans_sequestre=' || (select count(*) from public.commissions k where (k.statut = 'due' or k.statut_registre = 'due') and not exists (select 1 from public.sequestres q where q.commande_id = k.commande_id));
  -- ARG-08 : annulation → commission annulee une seule fois
  o := pg_temp.offre(S, 100, 10000, 'argb3');
  n := pg_temp.accord(S, B, o, 10000, 10);
  c := pg_temp.cmd(S, B, n, false);
  perform pg_temp.qui(S);
  perform public.commande_repondre_motif(c, false, null, 'stock_epuise', null);
  res := res || ' | ARG-08 refus: ' || pg_temp.lire(format('select statut || ''/'' || statut_registre from public.commissions where commande_id = %L', c))
     || ' 2e refus: ' || pg_temp.e(format('select public.commande_repondre_motif(%L, false, null, %L, null)', c, 'stock_epuise'))
     || ' lignes annulee=' || pg_temp.lire(format('select count(*)::text from public.commission_journal j join public.commissions m on m.id = j.commission_id where m.commande_id = %L and j.statut = %L', c, 'annulee'));
  -- ARG-09 : arrondis (333,33 F × 3 sacs) et petits montants (1 F × 1)
  o := pg_temp.offre(S, 100, 333.33, 'argb4');
  n := pg_temp.accord(S, B, o, 333.33, 3);
  c := pg_temp.cmd(S, B, n, true);
  res := res || ' | ARG-09a 333,33×3: montant=' || (select montant || ' commande.commission=' || commission_montant from public.commandes where id = c)
     || ' registre=' || (select montant_vente || ' → ' || commission from public.commissions where commande_id = c);
  o := pg_temp.offre(S, 100, 1, 'argb5');
  n := pg_temp.accord(S, B, o, 1, 1);
  c := pg_temp.cmd(S, B, n, true);
  res := res || ' | ARG-09b 1 F: registre=' || (select montant_vente || ' → ' || commission || ' ' || statut from public.commissions where commande_id = c);
  -- ARG-10 : montant énorme (prix 999 999 999 F interdit, 999 999 998 F × 999 999 sacs)
  o := pg_temp.offre(S, 999999, 999999998, 'argb6');
  perform pg_temp.qui(B);
  res := res || ' | ARG-10a prix 1e9: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 1000000000, 10, null)', 'offre', o));
  execute 'reset role';
  n := pg_temp.accord(S, B, o, 999999998, 999999);
  c := pg_temp.cmd(S, B, n, true);
  res := res || ' | ARG-10b énorme: montant=' || (select montant from public.commandes where id = c) || ' registre=' || (select commission from public.commissions where commande_id = c);
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : ARG-05a faux montant refusé | 05b bloque | 05c 2e appel → bloque, 1 seule ligne | 05d clôture avec séquestre due/due 3 500
-- | 05e même référence sur une autre commande refusée (clé unique) | ARG-06 sans séquestre prevue/calculee ; MAIS 51 lignes « due » sans séquestre
-- dans la base de test (lignes d'avant le schéma 95b, statut_registre vide) | ARG-08 annulee, 2e refus refusé, 1 ligne annulee
-- | ARG-09a 1 000 F → 35 F | ARG-09b 1 F → 0 F prevue | ARG-10a prix 1e9 refusé | ARG-10b 999 999 998 F × 999 999 sacs accepté : montant 999 998 998 000 002 F.
-- Lecture des 51 lignes : select k.statut, k.statut_registre, count(*) from commissions k where (k.statut = 'due' or k.statut_registre = 'due')
--   and not exists (select 1 from sequestres q where q.commande_id = k.commande_id) group by 1, 2;

-- ══ Bloc ARG-C : litige → commission suspendue → décision de l'équipe (une seule fois) ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid; n uuid; c uuid; c2 uuid; res text := '';
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 10000, 'argc1');
  n := pg_temp.accord(S, B, o, 10000, 10);
  c := pg_temp.cmd(S, B, n, true);
  perform pg_temp.partir(S, c);
  perform pg_temp.qui(B);
  perform public.commande_litige(c, 'Sacs mouillés');
  res := 'ARG-11a litige: ' || pg_temp.cs(c) || ' commission=' || pg_temp.lire(format('select statut || ''/'' || statut_registre from public.commissions where commande_id = %L', c));
  res := res || ' | ARG-11b 2e litige: ' || pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'encore'));
  res := res || ' | ARG-11c acheteur tranche lui-même: ' || pg_temp.e(format('select public.admin_litige_trancher(%L, %L, %L)', c, 'annulee', 'moi'));
  perform pg_temp.qui(ADM);
  res := res || ' | ARG-11d équipe annule: ' || pg_temp.e(format('select public.admin_litige_clore(%L, %L, %L, %L)', c, 'annulee', 'Marchandise abîmée, photos', 'vendeur'))
     || ' ' || pg_temp.cs(c) || ' commission=' || pg_temp.lire(format('select statut || ''/'' || statut_registre from public.commissions where commande_id = %L', c))
     || ' stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o));
  res := res || ' | ARG-11e 2e décision: ' || pg_temp.e(format('select public.admin_litige_clore(%L, %L, %L, null)', c, 'terminee', 'changement d''avis'));
  -- litige ouvert avant le chargement, puis annulé : stock rendu une fois
  o := pg_temp.offre(S, 100, 10000, 'argc2');
  n := pg_temp.accord(S, B, o, 10000, 10);
  c2 := pg_temp.cmd(S, B, n, true);
  perform pg_temp.qui(B);
  perform public.commande_litige(c2, 'Le vendeur ne répond plus');
  perform pg_temp.qui(ADM);
  perform public.admin_litige_clore(c2, 'annulee', 'Vendeur injoignable', null);
  res := res || ' | ARG-11f litige avant chargement annulé: stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o))
     || ' mouvement=' || pg_temp.lire(format('select pris || ''/'' || rendu from public.stock_mouvements where negociation_id = %L', n))
     || ' commission=' || pg_temp.lire(format('select statut_registre from public.commissions where commande_id = %L', c2));
  raise exception 'TEST OK: %', res;
end $$;
-- Résultat (25/10/2026) : ARG-11a litige → suspendue | 11b 2e litige refusé | 11c acheteur « Réservé à l'administration » | 11d équipe annule
-- → annulee/annulee, stock 90 (marchandise partie : pas rendue) | 11e 2e décision refusée | 11f litige avant chargement annulé : stock 100, mouvement 10/10.

-- ══ En attente : prestataire de paiement (rien n'est branché, aucun test possible) ══
-- ARG-12 dépôt réel de l'acheteur chez un opérateur (Wave, Orange, MTN, Moov) et rappel du prestataire → sequestre_depot_confirme : en attente.
-- ARG-13 versement réel au vendeur à la clôture (libération) : en attente.
-- ARG-14 remboursement réel à l'acheteur (annulation, litige, refus partiel) : en attente.
-- ARG-15 double débit chez le prestataire (deux références pour une commande : la 2e est ignorée sans trace, voir anomalie) : en attente.
-- ARG-16 deux clôtures simultanées (acheteur + tâche mdg-liberer-echus) sur deux connexions : en attente : deux connexions simultanées.
