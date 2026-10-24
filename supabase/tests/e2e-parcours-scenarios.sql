-- Parcours complets de bout en bout (étape 7, après les schémas 92 à 96), projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- Chaque bloc finit par raise exception 'TEST: …' : tout est annulé, rien ne reste en base.
-- Les fonctions sont appelées comme dans l'application (nego_ouvrir, nego_agir, commande_creer2, commande_repondre…), avec le rôle authenticated.
-- S = vendeur (Yamoussoukro), B = acheteur (Daloa), C = 2e membre, ADM = administrateur (comptes de simulation du projet de test).
-- Outils : à lancer dans le même appel que chaque bloc.
-- Piège : dans une même expression plpgsql, une sous-requête lit l'état d'AVANT l'appel d'une fonction de la même expression :
-- appeler la fonction dans une instruction à part, puis lire.

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
create or replace function pg_temp.cs(c uuid) returns text language sql as $f$
select pg_temp.lire(format($q$select etat || '/' || etape from public.commandes where id = %L$q$, c)) $f$;

-- ══ Parcours (a) : offre → négociation → accord → commande → confirmation → preuves de départ → chargement → arrivée → mot secret → 1 h → clôture → commission calculée → fiabilité, badge ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  oid uuid := gen_random_uuid(); n uuid; c uuid; res text := ''; m uuid; mot text; k text; nb int;
  p text[] := array['1bfd5713-2525-44a6-8403-084ebb9ddad3/e2e/a1.jpg', '1bfd5713-2525-44a6-8403-084ebb9ddad3/e2e/a2.jpg', '1bfd5713-2525-44a6-8403-084ebb9ddad3/motpapier-e2e.jpg'];
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-a-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 1000, 'sac', 20000, 'active');
  perform pg_temp.qui(B);
  n := public.nego_ouvrir('offre', oid, 19000, 100, 'Bonjour, 100 sacs ?');
  perform pg_temp.qui(S);
  m := pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid;
  perform public.nego_agir(n, 'accord', null, null, null, m);
  res := concat(res, 'a1 accord: ' || pg_temp.lire(format('select concat_ws('' '', statut, ''prix='' || prix_final, ''q='' || quantite_finale) from public.negociations where id = %L', n))
     || ' stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', oid)));
  perform pg_temp.qui(B);
  c := public.commande_creer2(n, 'vendeur', 'Marché de Daloa', 'Daloa', null);
  res := concat(res, ' | a2 commande ' || pg_temp.lire(format('select concat_ws('' '', etat || ''/'' || etape, ''montant='' || montant, ''val='' || validation, ''transport='' || transport_regle) from public.commandes where id = %L', c)));
  perform pg_temp.qui(S);
  perform public.commande_repondre(c, true, null);
  res := concat(res, ' | a3 ' || pg_temp.cs(c));
  res := concat(res, ' | a4 chargement sans preuves: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')));
  k := public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], S, now() + interval '1 second'), ('preuves', p[2], S, now() + interval '1 second'), ('preuves', p[3], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  res := concat(res, ' | a5 photos+poids: ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 2500)', c, array[p[1], p[2]])));
  res := concat(res, ' | a6 chargement sans papier: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')));
  res := concat(res, ' | a7 papier (code ' || length(k) || ' car.): ' || pg_temp.e(format('select public.commande_depart_mot(%L, %L)', c, p[3])));
  res := concat(res, ' | a8 chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')));
  res := concat(res, ' | a9 transport: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'transport')) || ' ' || pg_temp.cs(c));
  perform pg_temp.qui(B);
  res := concat(res, ' | a10 acheteur arrivée: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'arrivee')) || ' ' || pg_temp.cs(c));
  res := concat(res, ' | a11 réception sans mot (avancer): ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'reception')));
  mot := pg_temp.lire(format('select mot_secret from public.commandes where id = %L', c));
  res := concat(res, ' | a12 mauvais mot: ' || public.commande_reception_mot(c, 'zzzz-faux', false, null, null, null)::text);
  res := concat(res, ' | a13 bon mot: ' || pg_temp.e(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, upper(mot))) || ' ' || pg_temp.cs(c));
  execute 'reset role';
  res := concat(res, ' | a14 avant 1 h: libéré=' || ((select libere_le from public.commandes where id = c) is not null)
     || ' commission=' || (select statut || '/' || coalesce(statut_registre, '-') || ' ' || commission || ' F' from public.commissions where commande_id = c));
  -- la commande a été créée il y a 2 jours (règle des 60 min des badges), la réception date d'il y a 61 min
  update public.commandes set created_at = now() - interval '2 days', termine_le = now() - interval '61 minutes' where id = c;
  -- appel séparé : dans une même expression, les sous-requêtes lisent l'état d'avant l'appel
  nb := public.sequestre_liberer_echus();
  res := concat(res, ' | a15 clôture auto=', nb, ' ', (select concat_ws(' ', etat, 'termine_le=' || termine_le, 'libere=' || libere_le, 'liberation=' || liberation) from public.commandes where id = c),
     ' commission=', (select concat_ws(' ', statut || '/' || statut_registre, commission || ' F', '(3,5 % de ' || montant_vente || ')') from public.commissions where commande_id = c),
     ' commandes.commission_statut=', coalesce((select commission_statut from public.commandes where id = c), 'null'));
  res := concat(res, ' | registre=', (select string_agg(j.statut || ':' || j.motif, ' ; ') from public.commission_journal j join public.commissions k2 on k2.id = j.commission_id where k2.commande_id = c));
  perform pg_temp.qui(B);
  res := concat(res, ' | a16 litige après clôture: ' || pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'Trop tard')));
  execute 'reset role';
  res := concat(res, ' | a17 fiab S=' || (public._fiab_score(S))::text);
  res := concat(res, ' | a18 badge S: ' || coalesce(public._niv_calculer(S, 'vendeur') ->> 'niveau', 'aucun') || ' (comptées=' || coalesce(public._niv_calculer(S, 'vendeur') -> 'detail' -> 0 ->> 'commandes', '?') || ')');
  res := concat(res, ' | a19 journal=' || (select string_agg(evenement, ',' order by at) from public.commande_etapes where commande_id = c));
  raise exception 'TEST: %', res;
end $$;
-- Résultat obtenu (24/10/2026, 23:40) :
-- a1 accord conclue prix=19000 q=100 stock=900 | a2 montant=1900000 val=declaration transport=livreur_vendeur | a3 en_cours/confirmee
-- | a4 chargement sans preuves : DEPART_PREUVES | a5 photos+poids ok | a6 chargement sans papier : DEPART_PREUVES | a7 papier ok | a8 chargement ok
-- | a9 transport ok | a10 acheteur arrivée ok en_cours/arrivee | a11 réception par commande_avancer : MOT_REQUIS | a12 mauvais mot : mot_incorrect:4
-- | a13 bon mot (majuscules) : terminee | a14 avant 1 h : libéré=false, commission prevue | a15 à 61 min : clôture auto=1, registre « prevue → calculee
-- (clôture, calculée seulement : rien ne sera réclamé) » | a16 litige après clôture refusé | a17 fiabilité S 100 % sur 1 | a18 badge aucun (comptées=1)
-- | a19 journal creee,confirmee,chargement,transport,arrivee,reception,terminee.


-- Blocs (b), (c), (d), (e), (j) : écrits le 24/10/2026 mais PAS ENCORE JOUÉS (appels SQL refusés pendant la session). À jouer et noter.

-- ══ Parcours (b) : la commande est refusée par le vendeur → le stock revient ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  oid uuid := gen_random_uuid(); n uuid; c uuid; res text := '';
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-b-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', oid, 20000, 100, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  res := concat(res, 'b1 accord sur tout: stock=', pg_temp.lire(format('select quantity || ''/'' || status from public.offres where id = %L', oid)));
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  perform pg_temp.qui(S);
  res := concat(res, ' | b2 refus sans motif: ', pg_temp.e(format('select public.commande_repondre(%L, false, null)', c)));
  res := concat(res, ' | b3 refus motif: ', pg_temp.e(format('select public.commande_repondre_motif(%L, false, null, %L, null)', c, 'stock_epuise')), ' ', pg_temp.cs(c));
  execute 'reset role';
  res := concat(res, ' | b4 stock=', (select quantity || '/' || status from public.offres where id = oid),
    ' mouvement=', (select pris || '/' || rendu from public.stock_mouvements where negociation_id = n),
    ' annulation=', coalesce((select categorie || ' imputable=' || coalesce(imputable_id::text, 'personne') from public.annulations where commande_id = c), 'aucune'),
    ' commission=', (select statut || '/' || statut_registre from public.commissions where commande_id = c));
  raise exception 'TEST: %', res;
end $$;

-- ══ Parcours (c) : accord sans commande pendant 72 h → « sans suite », stock rendu ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  oid uuid := gen_random_uuid(); n uuid; res text := ''; k int;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-c-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', oid, 20000, 40, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  execute 'reset role';
  res := concat(res, 'c1 après accord stock=', (select quantity from public.offres where id = oid));
  update public.negociations set conclu_le = now() - interval '71 hours' where id = n;
  k := public.accords_sans_suite();
  res := concat(res, ' | c2 à 71 h: sans_suite=', k, ' stock=', (select quantity from public.offres where id = oid));
  update public.negociations set conclu_le = now() - interval '73 hours' where id = n;
  perform public.commandes_delais();
  res := concat(res, ' | c3 à 73 h (tâche mdg-commandes-delais): stock=', (select quantity from public.offres where id = oid),
    ' mouvement=', (select pris || '/' || rendu || ' sans_suite=' || (sans_suite_le is not null) from public.stock_mouvements where negociation_id = n),
    ' nego=', (select statut from public.negociations where id = n));
  perform pg_temp.qui(B);
  res := concat(res, ' | c4 commande ensuite: ', pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa')));
  raise exception 'TEST: %', res;
end $$;

-- ══ Parcours (d) : commande confirmée, rien chargé en 72 h → l'acheteur annule → fiabilité du vendeur ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  oid uuid := gen_random_uuid(); n uuid; c uuid; res text := ''; j json;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-d-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', oid, 20000, 30, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  perform pg_temp.qui(B);
  res := concat(res, 'd1 annuler tout de suite: ', pg_temp.e(format('select public.commande_annuler_retard(%L, null)', c)));
  execute 'reset role';
  update public.commandes set confirme_le = now() - interval '73 hours' where id = c;
  perform public.commandes_delais();
  res := concat(res, ' | d2 tâche à 73 h: alertes=', (select string_agg(evenement, ',') from public.commande_alertes where commande_id = c));
  perform pg_temp.qui(B);
  j := public.commande_delais(c);
  res := concat(res, ' | d3 peut_annuler_retard=', j ->> 'peut_annuler_retard');
  perform pg_temp.qui(S);
  res := concat(res, ' | d4 vendeur annule « retard »: ', pg_temp.e(format('select public.commande_annuler_retard(%L, null)', c)));
  perform pg_temp.qui(B);
  res := concat(res, ' | d5 acheteur annule: ', pg_temp.e(format('select public.commande_annuler_retard(%L, %L)', c, 'Rien chargé depuis 3 jours')), ' ', pg_temp.cs(c));
  execute 'reset role';
  res := concat(res, ' | d6 stock=', (select quantity from public.offres where id = oid),
    ' annulation=', (select concat_ws(' ', categorie, 'imputable=' || case imputable_id when S then 'vendeur' when B then 'acheteur' else 'personne' end, 'motif=' || motif) from public.annulations where commande_id = c),
    ' sanction=', coalesce((select string_agg(type, ',') from public.sanctions where user_id = S and annulation_id in (select id from public.annulations where commande_id = c)), 'aucune'));
  res := concat(res, ' | d7 fiab S=', public._fiab_score(S)::text, ' fiab B imputables=', public._fiab_score(B) ->> 'imputables');
  raise exception 'TEST: %', res;
end $$;

-- ══ Parcours (e) : « livré » déclaré par le vendeur, acheteur muet 24 h → litige automatique → l'équipe partage ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  oid uuid := gen_random_uuid(); n uuid; c uuid; res text := ''; k text;
  p text[] := array['1bfd5713-2525-44a6-8403-084ebb9ddad3/e2e/e1.jpg', '1bfd5713-2525-44a6-8403-084ebb9ddad3/e2e/e2.jpg', '1bfd5713-2525-44a6-8403-084ebb9ddad3/motpapier-e2e-e.jpg'];
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-e-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', oid, 20000, 100, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  perform pg_temp.qui(B); c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  perform pg_temp.qui(S); perform public.commande_repondre(c, true, null);
  k := public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], S, now() + interval '1 second'), ('preuves', p[2], S, now() + interval '1 second'), ('preuves', p[3], S, now() + interval '1 second');
  perform pg_temp.qui(S);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 5000);
  perform public.commande_depart_mot(c, p[3]);
  perform public.commande_avancer(c, 'chargement', null, null, null, null);
  perform public.commande_avancer(c, 'transport', null, null, null, null);
  res := concat(res, 'e1 vendeur « livré »: ', pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'arrivee')), ' ', pg_temp.cs(c));
  execute 'reset role';
  update public.commandes set livre_le = now() - interval '13 hours' where id = c;
  perform public.commandes_delais();
  res := concat(res, ' | e2 à 13 h: ', (select etat from public.commandes where id = c), ' alertes=', (select string_agg(evenement, ',') from public.commande_alertes where commande_id = c));
  update public.commandes set livre_le = now() - interval '25 hours' where id = c;
  perform public.commandes_delais();
  res := concat(res, ' | e3 à 25 h: ', (select concat_ws(' ', etat, 'par=' || coalesce(litige_par::text, 'systeme'), 'motif=' || left(litige_motif, 50), 'échéance=' || (litige_echeance is not null)) from public.commandes where id = c),
    ' commission=', (select statut || '/' || statut_registre from public.commissions where commande_id = c));
  perform pg_temp.qui(B);
  res := concat(res, ' | e4 mot après litige: ', pg_temp.e(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, 'x')));
  perform pg_temp.qui(S);
  res := concat(res, ' | e5 vendeur tranche: ', pg_temp.e(format('select public.admin_litige_partager(%L, 30, %L)', c, 'moi')));
  perform pg_temp.qui(ADM);
  res := concat(res, ' | e6 partage 100/100: ', pg_temp.e(format('select public.admin_litige_partager(%L, 100, %L)', c, 'Tout refusé ?')));
  res := concat(res, ' | e7 partage 30 refusés: ', pg_temp.e(format('select public.admin_litige_partager(%L, 30, %L)', c, '30 sacs abîmés, photos à l''appui')));
  execute 'reset role';
  res := concat(res, ' | e8 ', (select concat_ws(' ', etat || '/' || etape, 'refusé=' || montant_refuse, 'refus_q=' || refus_quantite, 'libéré=' || (libere_le is not null), 'liberation=' || liberation) from public.commandes where id = c),
    ' commission=', (select statut || '/' || statut_registre || ' sur ' || montant_vente || ' = ' || commission from public.commissions where commande_id = c),
    ' stock=', (select quantity from public.offres where id = oid),
    ' annulation=', coalesce((select categorie || ' imputable=' || case imputable_id when S then 'vendeur' when B then 'acheteur' else 'personne' end from public.annulations where commande_id = c), 'aucune'));
  raise exception 'TEST: %', res;
end $$;

-- ══ (j) deux acceptations sur le même stock (offre, puis demande) → la 2e refusée ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; C uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  oid uuid := gen_random_uuid(); did uuid := gen_random_uuid(); n1 uuid; n2 uuid; n3 uuid; n4 uuid; res text := '';
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'E2E-S');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (oid, S, 'e2e-j-' || oid, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 10, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n1 := public.nego_ouvrir('offre', oid, 20000, 8, null);
  perform pg_temp.qui(C); n2 := public.nego_ouvrir('offre', oid, 20000, 8, null);
  perform pg_temp.qui(S);
  perform public.nego_agir(n1, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n1))::uuid);
  res := concat(res, 'j1 1er accord: stock=', pg_temp.lire(format('select quantity::text from public.offres where id = %L', oid)));
  res := concat(res, ' | j2 2e accord: ', pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n2, 'accord', pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n2)))),
    ' stock=', pg_temp.lire(format('select quantity::text from public.offres where id = %L', oid)));
  execute 'reset role';
  insert into public.demandes (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, status)
    values (did, B, 'e2e-j-d-' || did, 'mais', 'Maïs', 'haut-sassandra', 'Daloa', 10, 'sac', 20000, 'active');
  perform pg_temp.qui(S); n3 := public.nego_ouvrir('demande', did, 20000, 8, null);
  perform pg_temp.qui(C); n4 := public.nego_ouvrir('demande', did, 20000, 8, null);
  perform pg_temp.qui(B);
  res := concat(res, ' | j3 demande 1er accord: ', pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n3, 'accord', pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n3)))),
    ' reste=', pg_temp.lire(format('select quantity::text from public.demandes where id = %L', did)));
  res := concat(res, ' | j4 demande 2e accord: ', pg_temp.e(format('select public.nego_agir(%L, %L, null, null, null, %L)', n4, 'accord', pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n4)))),
    ' reste=', pg_temp.lire(format('select quantity::text from public.demandes where id = %L', did)));
  raise exception 'TEST: %', res;
end $$;
