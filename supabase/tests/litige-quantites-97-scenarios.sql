-- Scénarios des schémas 97b (litige en 1 h après « livré ») et 97c (quantité minimale, achat d'une partie du stock).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Chaque bloc finit par raise exception 'TEST: …' : rien ne reste en base.
-- S = vendeur, B = acheteur, C et D = autres membres, ADM = administrateur (comptes de simulation du projet de test).
-- Outils : à lancer dans le même appel que chaque bloc.

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
-- une commande de 100 sacs de maïs, confirmée, chargée avec ses preuves, en route, puis « livré » déclaré par le vendeur
create or replace function pg_temp.livree(S uuid, B uuid) returns uuid language plpgsql as $f$
declare oid uuid := gen_random_uuid(); n uuid; c uuid; x text := replace(gen_random_uuid()::text, '-', '');
  p text[] := array[S || '/e2e/l97-' || x || '-1.jpg', S || '/e2e/l97-' || x || '-2.jpg', S || '/motpapier-l97-' || x || '.jpg'];
begin
  execute 'reset role';
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'l97-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', oid, 20000, 100, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], S, now() + interval '1 second'), ('preuves', p[2], S, now() + interval '1 second'), ('preuves', p[3], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 5000);
  perform public.commande_depart_mot(c, p[3]);
  perform public.commande_avancer(c, 'chargement', null, null, null, null);
  perform public.commande_avancer(c, 'transport', null, null, null, null);
  perform public.commande_avancer(c, 'arrivee', null, null, null, null);
  execute 'reset role';
  return c;
end $f$;

-- ══ L1 : « livré », acheteur muet → rappel à 30 min, litige à 60 min, clôture en faveur du vendeur 60 min plus tard ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  c uuid; res text := ''; j json; r json;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'L97-S');
  c := pg_temp.livree(S, B);
  perform pg_temp.qui(B); j := public.commande_delais(c); execute 'reset role';
  res := concat(res, 'l1 livré: ', (select etat || '/' || etape from public.commandes where id = c),
    ' échéance=', round(extract(epoch from ((j ->> 'reception_echeance')::timestamptz - (select livre_le from public.commandes where id = c))) / 60), ' min',
    ' étapes notifiées=', (select string_agg(evenement, ',' order by at) from public.commande_etapes where commande_id = c and evenement in ('arrivee')));
  update public.commandes set livre_le = now() - interval '29 minutes' where id = c;
  r := public.commandes_delais();
  res := concat(res, ' | l2 à 29 min: ', (select etat from public.commandes where id = c), ' alertes=', coalesce((select string_agg(evenement, ',') from public.commande_alertes where commande_id = c), 'aucune'));
  update public.commandes set livre_le = now() - interval '31 minutes' where id = c;
  r := public.commandes_delais();
  res := concat(res, ' | l3 à 31 min: ', (select etat from public.commandes where id = c), ' alertes=', coalesce((select string_agg(evenement, ',') from public.commande_alertes where commande_id = c), 'aucune'),
    ' file notif B=', (select count(*) from public.notif_file where objet_id = c::text and user_id = B));
  update public.commandes set livre_le = now() - interval '61 minutes' where id = c;
  r := public.commandes_delais();
  res := concat(res, ' | l4 à 61 min: ', (select concat_ws(' ', etat, 'par=' || coalesce(litige_par::text, 'systeme'), 'auto=' || (litige_auto_le is not null), 'motif=' || litige_motif) from public.commandes where id = c),
    ' commission=', (select statut || '/' || statut_registre from public.commissions where commande_id = c),
    ' journal=', (select note from public.commande_etapes where commande_id = c and evenement = 'litige' order by at desc limit 1));
  perform pg_temp.qui(B); j := public.commande_delais(c); execute 'reset role';
  res := concat(res, ' | l5 écran acheteur: litige_auto=', j ->> 'litige_auto', ' clôture dans ', round(extract(epoch from ((j ->> 'cloture_echeance')::timestamptz - now())) / 60), ' min');
  update public.commandes set litige_auto_le = now() - interval '59 minutes' where id = c;
  r := public.commandes_delais();
  res := concat(res, ' | l6 litige +59 min: ', (select etat from public.commandes where id = c));
  update public.commandes set litige_auto_le = now() - interval '61 minutes' where id = c;
  r := public.commandes_delais();
  res := concat(res, ' | l7 litige +61 min: clotures=', r ->> 'clotures_sans_reponse', ' ', (select concat_ws(' ', etat || '/' || etape, 'libéré=' || (libere_le is not null), 'liberation=' || liberation, 'refusé=' || montant_refuse) from public.commandes where id = c),
    ' commission=', (select statut || '/' || statut_registre || ' ' || commission || ' F' from public.commissions where commande_id = c),
    ' journal=', (select evenement || ' « ' || note || ' »' from public.commande_etapes where commande_id = c order by at desc limit 1),
    ' séquestre=', coalesce((select note from public.sequestre_journal where commande_id = c order by at desc limit 1), 'aucun'),
    ' annulation=', coalesce((select categorie from public.annulations where commande_id = c), 'aucune'));
  perform pg_temp.qui(B);
  res := concat(res, ' | l8 litige après clôture: ', pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'Trop tard')));
  raise exception 'TEST: %', res;
end $$;
-- Résultat AVANT le schéma 97b (25/10/2026) : échéance = 1440 min (24 h) ; à 31 min : aucun avis ; à 61 min : en_cours (rien).
-- Résultat APRÈS (25/10/2026) : l1 en_cours/arrivee, échéance = 60 min, étape « arrivee » notifiée | l2 à 29 min : rien | l3 à 31 min : rappel_reception
-- (file notif B = 0 : B n'a pas d'abonnement sur le test) | l4 à 61 min : litige par=systeme auto=true « Réception non confirmée 60 min après la livraison
-- déclarée », commission suspendue, journal « Pas de réponse de l'acheteur 60 min après la livraison déclarée. Sans réponse de sa part dans les 60 min,
-- la commande sera close en faveur du vendeur. » | l5 écran acheteur : litige_auto=true, clôture dans 60 min | l6 +59 min : litige
-- | l7 +61 min : clotures=1, terminee/terminee, libéré, liberation=auto, refusé=0, commission prevue/calculee 70000 F (rien n'est réclamé),
-- journal terminee « En faveur du vendeur : l'acheteur n'a pas répondu », séquestre « Clôture en faveur du vendeur… », aucune annulation
-- | l8 litige après clôture refusé.

-- ══ L2 : pendant le litige automatique, l'acheteur écrit, confirme avec le mot secret, ou refuse avec photos ; ou il signale avant l'heure ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  c1 uuid; c2 uuid; c3 uuid; c4 uuid; res text := ''; r json; mot text; ph text := '68345d7a-9d64-410a-a4c7-92a750d9888d/refus-l97-' || replace(gen_random_uuid()::text, '-', '') || '.jpg';
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'L97-S');
  c1 := pg_temp.livree(S, B); c2 := pg_temp.livree(S, B); c3 := pg_temp.livree(S, B); c4 := pg_temp.livree(S, B);
  update public.commandes set livre_le = now() - interval '61 minutes' where id in (c1, c2, c3);
  -- c4 : l'acheteur signale un problème avant l'heure
  perform pg_temp.qui(B); perform public.commande_litige(c4, 'Il manque 10 sacs'); execute 'reset role';
  update public.commandes set livre_le = now() - interval '61 minutes' where id = c4;
  r := public.commandes_delais();
  res := concat(res, 'm1 litiges auto=', r ->> 'litiges_reception', ' (c4 déjà en litige par l''acheteur : ', (select coalesce((litige_par = B)::text, 'null') || ' auto=' || (litige_auto_le is not null) from public.commandes where id = c4), ')');
  perform pg_temp.qui(B);
  res := concat(res, ' | m2 c1 l''acheteur écrit: ', pg_temp.e(format('select public.litige_ecrire(%L, %L)', c1, 'Je n''étais pas là, je regarde demain matin.')));
  mot := pg_temp.lire(format('select mot_secret from public.commandes where id = %L', c2));
  res := concat(res, ' | m3 c2 mot secret pendant le litige: ', public.commande_reception_mot(c2, mot, false, null, null, null), ' ', pg_temp.lire(format('select etat || ''/'' || etape || '' libéré='' || (libere_le is not null) from public.commandes where id = %L', c2)));
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', ph, B, now());
  perform pg_temp.qui(B);
  mot := pg_temp.lire(format('select mot_secret from public.commandes where id = %L', c3));
  res := concat(res, ' | m4 c3 refus avec photo pendant le litige: ', public.commande_refuser2(c3, 20, 'Sacs mouillés', array[ph], mot, false),
    ' par acheteur=', pg_temp.lire(format('select (litige_par = %L)::text from public.commandes where id = %L', B, c3)));
  execute 'reset role';
  update public.commandes set litige_auto_le = now() - interval '61 minutes' where id in (c1, c3);
  update public.commandes set litige_le = now() - interval '61 minutes' where id = c4;
  r := public.commandes_delais();
  res := concat(res, ' | m5 +61 min: clôtures=', r ->> 'clotures_sans_reponse', ' c1=', (select etat from public.commandes where id = c1), ' c3=', (select etat from public.commandes where id = c3), ' c4=', (select etat from public.commandes where id = c4));
  raise exception 'TEST: %', res;
end $$;
-- Résultat (25/10/2026) : m1 litiges auto=3 (c4 déjà en litige par l'acheteur, pas automatique) | m2 c1 l'acheteur écrit : ok
-- | m3 c2 mot secret pendant le litige : terminee (libéré=false : clôture normale 1 h après la réception) | m4 c3 refus avec photo : ok, litige par l'acheteur
-- | m5 +61 min : clôtures=0 ; c1, c3, c4 restent en litige (l'équipe tranche).

-- ══ L3 : réglages de l'administrateur ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; res text := '';
begin
  res := concat(res, 'r0 défaut=', (select (valeur ->> 'reception_minutes') || '/' || (valeur ->> 'litige_sans_reponse_minutes') from public.reglages where cle = 'commandes'));
  perform pg_temp.qui(S);
  res := concat(res, ' | r1 membre: ', pg_temp.e($q$select public.admin_commandes_regler('{"reception_minutes": 90}')$q$));
  perform pg_temp.qui(ADM);
  res := concat(res, ' | r2 10 min: ', pg_temp.e($q$select public.admin_commandes_regler('{"reception_minutes": 10}')$q$));
  res := concat(res, ' | r3 90 et 45 min: ', pg_temp.e($q$select public.admin_commandes_regler('{"reception_minutes": 90, "litige_sans_reponse_minutes": 45}')$q$));
  -- lu dans une instruction à part (une même expression lit l'état d'avant l'appel)
  res := concat(res, ' lu=', (public.commandes_regles() ->> 'reception_minutes') || '/' || (public.commandes_regles() ->> 'litige_sans_reponse_minutes'));
  execute 'reset role';
  res := concat(res, ' | r4 tâche=', (select schedule from cron.job where jobname = 'mdg-commandes-delais'));
  raise exception 'TEST: %', res;
end $$;
-- Résultat (25/10/2026) : r0 défaut 60/60 | r1 membre : « Réservé à l'administration. » | r2 10 min : refusé (de 15 à 2880 minutes)
-- | r3 90 et 45 min : ok, relu 90/45 | r4 tâche mdg-commandes-delais : */5 * * * *.

-- ══ Q1 : offre 1000 kg, minimum 100 kg, vendue par parties ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; A uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; B2 uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; C uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  oid uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); n uuid; res text := '';
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'Q97-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, qte_min)
    values (oid, S, 'q97-' || oid, 'tomate', 'Tomate', 'yamoussoukro', 'Yamoussoukro', 1000, 'kg', 300, 'active', 100);
  perform pg_temp.qui(A); n := public.nego_ouvrir('offre', oid, 300, 500, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, 'q1 A 500: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.offres where id = %L', oid)));
  perform pg_temp.qui(B2); n := public.nego_ouvrir('offre', oid, 300, 300, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, ' | q2 B 300: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.offres where id = %L', oid)));
  perform pg_temp.qui(C);
  res := concat(res, ' | q3 C 50: ', pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 50, null)', 'offre', oid)));
  res := concat(res, ' | q4 C 300: ', pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 300, null)', 'offre', oid)));
  n := public.nego_ouvrir('offre', oid, 300, 200, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, ' | q5 C 200: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.offres where id = %L', oid)));
  -- le reste plus petit que le minimum se prend en entier
  execute 'reset role';
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, qte_min)
    values (o2, S, 'q97-' || o2, 'tomate', 'Tomate', 'yamoussoukro', 'Yamoussoukro', 1000, 'kg', 300, 'active', 100);
  perform pg_temp.qui(A); n := public.nego_ouvrir('offre', o2, 300, 950, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  perform pg_temp.qui(C);
  res := concat(res, ' | q6 reste 50 < minimum : C 30: ', pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 30, null)', 'offre', o2)));
  n := public.nego_ouvrir('offre', o2, 300, 50, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, ' | q7 C 50: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.offres where id = %L', o2)));
  raise exception 'TEST: %', res;
end $$;
-- Résultat AVANT et APRÈS le schéma 97c (identique : l'offre se vendait déjà par parties, avec minimum) :
-- q1 A 500 : reste 500 active | q2 B 300 : reste 200 active | q3 C 50 : « Le vendeur vend à partir de 100 kg. » | q4 C 300 : « l'annonce porte sur 200 au plus »
-- | q5 C 200 : reste 0 retiree (plus visible) | q6 reste 50 < minimum : C 30 refusé (« à partir de 50 kg ») | q7 C 50 : reste 0 retiree.

-- ══ Q2 : demande 1000 kg, minimum 200 kg fixé par l'acheteur ; publication contrôlée ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; C uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830';
  did uuid := gen_random_uuid(); n uuid; res text := '';
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (D, 'verifie', 'cni', '1234', now(), current_date + 365, 'Q97-D');
  perform pg_temp.qui(D);
  res := concat(res, 'p1 demande sans quantité: ', pg_temp.e(format($q$insert into public.demandes (user_id, client_id, product_slug, product_label, region_slug, city, unit, status) values (%L, 'q97-p1', 'tomate', 'Tomate', 'yamoussoukro', 'Yamoussoukro', 'kg', 'active')$q$, D)));
  res := concat(res, ' | p2 minimum 1200 > 1000: ', pg_temp.e(format($q$insert into public.demandes (user_id, client_id, product_slug, product_label, region_slug, city, quantity, qte_min, unit, status) values (%L, 'q97-p2', 'tomate', 'Tomate', 'yamoussoukro', 'Yamoussoukro', 1000, 1200, 'kg', 'active')$q$, D)));
  execute 'reset role';
  insert into public.demandes (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, qte_min, unit, budget, status)
    values (did, D, 'q97-' || did, 'tomate', 'Tomate', 'yamoussoukro', 'Yamoussoukro', 1000, 200, 'kg', 300, 'active');
  perform pg_temp.qui(S);
  res := concat(res, ' | p3 vendeur propose 100: ', pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 100, null)', 'demande', did)));
  n := public.nego_ouvrir('demande', did, 300, 600, null);
  perform pg_temp.qui(D); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, ' | p4 S 600: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.demandes where id = %L', did)));
  perform pg_temp.qui(D);
  res := concat(res, ' | p5 tableau: qte_min des demandes=', coalesce((select string_agg(x ->> 'qte_min', ',') from json_array_elements(public.tableau_marche('tomate', null) -> 'demandes') x where x ->> 'qte_min' is not null), 'absent'));
  perform pg_temp.qui(C);
  res := concat(res, ' | p6 C 500: ', pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 500, null)', 'demande', did)));
  n := public.nego_ouvrir('demande', did, 300, 400, null);
  perform pg_temp.qui(D); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, ' | p7 C 400: reste ', pg_temp.lire(format('select quantity || '' '' || status from public.demandes where id = %L', did)));
  raise exception 'TEST: %', res;
end $$;
-- Résultat APRÈS le schéma 97c (25/10/2026) : p1 demande sans quantité : QUANTITE_REQUISE | p2 minimum 1200 > 1000 : QTE_MIN
-- | p3 vendeur propose 100 : « L'acheteur achète à partir de 200 kg. » | p4 S 600 : reste 400 active | p5 tableau : qte_min des demandes = 200
-- | p6 C 500 : « l'annonce porte sur 400 au plus » | p7 C 400 : reste 0 retiree.
-- Avant 97c : pas de minimum sur les demandes (colonne absente), une demande pouvait être publiée sans quantité côté serveur.
