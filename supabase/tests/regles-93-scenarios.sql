-- Scénarios du schéma 93 (règles sans contournement), joués sur le projet de TEST (yowdymdnoiubatxlwhfv) le 24/10/2026.
-- Chaque bloc finit par raise exception 'TEST: …' : tout est annulé, rien ne reste en base.
-- Membres de test : vendeur ca27004f-… ; acheteurs 657e5590-…, e0191bd5-…, af343de8-….
-- Résultats obtenus (copiés de la sortie) :
--  A : A1 publiée, expire dans 30 j | A2 DOUBLON | A3 Paris : VILLE_INCONNUE | A4 Cocody (région de Bouaké) : VILLE_INCONNUE |
--      A5 « Napié (près de Katiola) » : ok | A6 prix ferme 0 : PRIX_REQUIS | A7 quantité vidée : QUANTITE_REQUISE |
--      A8 produit/unité/ville changés pendant la négociation : ANNONCE_FIGEE | A9 prix changé : ok | A10 accord 60 : stock=40, prix accord=14000 |
--      A11 ville changée après l'accord (sans commande) : ANNONCE_FIGEE | A12 renvoi q=100 sans quantite_vue : stock=40 |
--      A13 renvoi q=100 avec une ancienne vue (100) : stock=40 | A14 proposition de 100 : « Quantité trop grande : l'annonce porte sur 40 au plus. » |
--      A15 remise à 70 après avoir vu 40 : stock=70 | A16 quantité 0 : status=retiree |
--      A17 livraison à Abidjan (vente uniquement à Bouaké, annonce changée en Korhogo par l'admin) : refusée « Ce vendeur vend uniquement à Bouaké » |
--      A18 commande : départ=Bouaké (ville de la négociation) | A19 commande_creer : permission denied | A20 nego_transport : permission denied |
--      A21 politique d'effacement des membres : false.
--      → le scénario d'audit « 160 sacs vendus pour 100 » ne passe plus (A12 à A14).
--  B : B1 accord sur une offre en pause : ANNONCE_EN_PAUSE | B2 contre-proposition en pause : ANNONCE_EN_PAUSE |
--      B3 l'acheteur rouvre aussitôt une négociation arrêtée par le vendeur : NEGO_ARRETEE (« dans 24 h ») | B4 nouvelle négociation aussitôt : NEGO_ARRETEE |
--      B5 après 25 h simulées : statut=ouverte | B6 demande de 10, 2e accord de 8 : « Quantité plus disponible : il reste 2 » |
--      B7 ancienne offre sans quantité : « Cette offre n'a plus de stock. » (avant : 5 000 sacs acceptés).
--  C : C1 tâche annonces_expirer : {offres 1, demandes 1, refus 0, rappels 1} en 349 ms (≈ 90 000 offres en base) |
--      C2 offre au bout : retiree, expirée | C3 offre avec une négociation ouverte : reste active | C4 demande au bout : retiree, expirée |
--      C5 rappel 3 jours avant : offre_fin / rappel | C6 2e passage : rien | C7 ligne gardée : 1 | C8 prolonger l'expirée : active, fin dans 30 j |
--      C9 le membre change sa date à la main : permission denied | C10 prolonger l'active : fin dans 30 j | C11 un autre membre : « Annonce introuvable » |
--      C12 anciennes annonces de plus de 30 j encore en ligne (délai de grâce de 7 jours) : 61 647.
--  D : D1 groupe livré à Daloa sur une offre « uniquement à Bouaké » : refusé | D2 « Bouaké centre » : ok | D3 suspendu qui rejoint : COMPTE_SUSPENDU |
--      D4 offre en pause : ANNONCE_EN_PAUSE | D5 stock baissé avant la confirmation : retour=stock_insuffisant, groupe=expire (avant : bloqué) |
--      D6 offre retirée : groupe=annule | D7 suspendu qui crée un groupe : COMPTE_SUSPENDU |
--      D8 groupe qui prend tout le stock : confirme, offre retiree/0 (pas annulé par l'épuisement) | D9 commandes : ville d'arrivée Bouaké, commission 21000 chacune.
--  E : E1 réponse à un besoin dont la période est passée : refusée | E2 besoin en cours : ok.
--  Non-régression : bloc A de tests/boutiques-86-scenarios.sql rejoué, sortie identique à celle notée dans ce fichier.
--  Limite : la concurrence réelle (deux connexions en même temps) n'est pas testable avec une seule connexion ; le verrou FOR UPDATE est lu dans le code.
--  Le test H de transport-83-scenarios.sql appelle commande_creer et nego_transport sans rôle membre (postgres) : il passe encore ;
--  avec le rôle authenticated, ces deux appels sont maintenant refusés (voulu).

-- A
do $$
declare v uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; a1 uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; a2 uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  o uuid; o2 uuid; n1 uuid; n2 uuid; out text := ''; r record; q numeric; cid uuid; x text;
begin
  update public.annonces_publiees set n = 0 where user_id = v;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement)
    values ('t93-a', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 15000, true) returning id into o;
  select round(extract(epoch from expire_le - now()) / 86400) into q from public.offres where id = o;
  out := out || 'A1 publiée, expire dans ' || q || ' j';
  begin insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-b', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 15000);
    out := out || ' | A2 doublon PASSE (mauvais)'; exception when others then out := out || ' | A2 ' || sqlerrm; end;
  begin insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-c', 'manioc', 'Manioc', 'vallee-du-bandama', 'Paris', 10, 'sac', 100);
    out := out || ' | A3 Paris PASSE (mauvais)'; exception when others then out := out || ' | A3 Paris: ' || left(sqlerrm, 40); end;
  begin insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-d', 'manioc', 'Manioc', 'vallee-du-bandama', 'Cocody', 10, 'sac', 100);
    out := out || ' | A4 Cocody/Bouaké PASSE (mauvais)'; exception when others then out := out || ' | A4 Cocody: ' || left(sqlerrm, 40); end;
  begin insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-e', 'manioc', 'Manioc', 'vallee-du-bandama', 'Napié (près de Katiola)', 10, 'sac', 100) returning id into o2;
    out := out || ' | A5 localité (près de Katiola): ok'; exception when others then out := out || ' | A5 localité refusée (mauvais): ' || sqlerrm; end;
  begin insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, negociable) values ('t93-f', 'mais', 'Maïs', 'vallee-du-bandama', 'Bouaké', 10, 'sac', 0, false);
    out := out || ' | A6 prix ferme 0 PASSE (mauvais)'; exception when others then out := out || ' | A6 ' || left(sqlerrm, 40); end;
  begin update public.offres set quantity = null where id = o; out := out || ' | A7 quantité vidée PASSE (mauvais)'; exception when others then out := out || ' | A7 ' || left(sqlerrm, 40); end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  n1 := public.nego_ouvrir('offre', o, 14000, 60, 'test');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  begin update public.offres set product_slug = 'manioc', product_label = 'Manioc', unit = 'kg', city = 'Korhogo', region_slug = 'savanes', price = 300 where id = o;
    out := out || ' | A8 changement produit/unité/ville PASSE (mauvais)'; exception when others then out := out || ' | A8 ' || left(sqlerrm, 60); end;
  update public.offres set price = 16000 where id = o; out := out || ' | A9 prix changé: ok';
  perform public.nego_agir(n1, 'accord', null, null, null, null);
  select quantity, status into r from public.offres where id = o; out := out || ' | A10 accord 60 : stock=' || r.quantity;
  select prix_final into q from public.negociations where id = n1; out := out || ' prix accord=' || q;
  begin update public.offres set city = 'Katiola' where id = o; out := out || ' | A11 ville après accord PASSE (mauvais)'; exception when others then out := out || ' | A11 accord sans commande: ' || left(sqlerrm, 14); end;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement)
    values ('t93-a', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 16000, true)
    on conflict (user_id, client_id) do update set quantity = excluded.quantity, price = excluded.price, quantite_vue = excluded.quantite_vue;
  select quantity into q from public.offres where id = o; out := out || ' | A12 renvoi q=100 sans vue: stock=' || q;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement, quantite_vue)
    values ('t93-a', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 16000, true, 100)
    on conflict (user_id, client_id) do update set quantity = excluded.quantity, quantite_vue = excluded.quantite_vue;
  select quantity into q from public.offres where id = o; out := out || ' | A13 renvoi q=100 vue=100 (ancienne): stock=' || q;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true); set local role authenticated;
  begin n2 := public.nego_ouvrir('offre', o, 16000, 100, null); out := out || ' | A14 proposition 100 PASSE (mauvais)'; exception when others then out := out || ' | A14 ' || left(sqlerrm, 60); end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement, quantite_vue)
    values ('t93-a', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 70, 'sac', 16000, true, 40)
    on conflict (user_id, client_id) do update set quantity = excluded.quantity, quantite_vue = excluded.quantite_vue;
  select quantity, quantite_vue into r from public.offres where id = o; out := out || ' | A15 remise 70 après avoir vu 40: stock=' || r.quantity || ' vue gardée=' || coalesce(r.quantite_vue::text, 'non');
  update public.offres set quantity = 0 where id = o2; select status into x from public.offres where id = o2; out := out || ' | A16 quantité 0: status=' || x;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set city = 'Korhogo', region_slug = 'savanes' where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin cid := public.commande_creer2(n1, 'vendeur', null, 'Abidjan', null); out := out || ' | A17 livraison Abidjan PASSE (mauvais)'; exception when others then out := out || ' | A17 ' || left(sqlerrm, 45); end;
  cid := public.commande_creer2(n1, 'vendeur', null, 'Bouaké', null);
  reset role;
  select ville_depart, ville_arrivee into r from public.commandes where id = cid; out := out || ' | A18 commande: départ=' || r.ville_depart || ' arrivée=' || r.ville_arrivee;
  set local role authenticated;
  begin perform public.commande_creer(n1, 'vendeur', 'Abidjan', 'declaration'); out := out || ' | A19 commande_creer PASSE (mauvais)'; exception when others then out := out || ' | A19 commande_creer: ' || left(sqlerrm, 40); end;
  begin perform public.nego_transport(n1, true); out := out || ' | A20 nego_transport PASSE (mauvais)'; exception when others then out := out || ' | A20 nego_transport: ' || left(sqlerrm, 40); end;
  reset role;
  select qual into x from pg_policies where tablename = 'offres' and policyname = 'retirer ses offres'; out := out || ' | A21 politique effacement membre: ' || x;
  raise exception 'TEST: %', out;
end $$;

-- B
do $$
declare v uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; a1 uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; a2 uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; a3 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  o uuid; d uuid; n1 uuid; n2 uuid; n3 uuid; out text := ''; x text;
begin
  update public.annonces_publiees set n = 0 where user_id in (v, a3);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price)
    values ('t93-p', 'mais', 'Maïs', 'vallee-du-bandama', 'Bouaké', 50, 'sac', 9000) returning id into o;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  n1 := public.nego_ouvrir('offre', o, 8500, 10, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  update public.offres set pause_le = now() where id = o;
  begin perform public.nego_agir(n1, 'accord', null, null, null, null); out := out || 'B1 accord en pause PASSE (mauvais)'; exception when others then out := out || 'B1 accord en pause: ' || left(sqlerrm, 40); end;
  begin perform public.nego_agir(n1, 'prix', 8800, 10, null, null); out := out || ' | B2 contre-prop. en pause PASSE (mauvais)'; exception when others then out := out || ' | B2 contre-prop. en pause: ' || left(sqlerrm, 18); end;
  update public.offres set pause_le = null where id = o;
  perform public.nego_agir(n1, 'fin', null, null, 'non merci', null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.nego_agir(n1, 'prix', 8700, 10, null, null); out := out || ' | B3 rouvrir aussitôt PASSE (mauvais)'; exception when others then out := out || ' | B3 ' || sqlerrm; end;
  begin perform public.nego_ouvrir('offre', o, 8700, 10, null); out := out || ' | B4 nouvelle négo aussitôt PASSE (mauvais)'; exception when others then out := out || ' | B4 nouvelle négo: ' || left(sqlerrm, 14); end;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.messages set created_at = now() - interval '25 hours' where negociation_id = n1 and genre = 'fin';
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.nego_agir(n1, 'prix', 8700, 10, null, null); select statut into x from public.negociations where id = n1; out := out || ' | B5 après 25 h : statut=' || x;
    exception when others then out := out || ' | B5 après 25 h refusé (mauvais): ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.demandes (client_id, product_slug, product_label, region_slug, city, quantity, unit, budget)
    values ('t93-d', 'riz', 'Riz', 'abidjan', 'Abidjan', 10, 'sac', 20000) returning id into d;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  n2 := public.nego_ouvrir('demande', d, 20000, 8, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true); set local role authenticated;
  n3 := public.nego_ouvrir('demande', d, 20000, 8, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.nego_agir(n2, 'accord', null, null, null, null);
  begin perform public.nego_agir(n3, 'accord', null, null, null, null); out := out || ' | B6 2e accord demande PASSE (mauvais)'; exception when others then out := out || ' | B6 2e accord demande: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set quantity = null where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.nego_ouvrir('offre', o, 9000, 5000, null); out := out || ' | B7 offre sans quantité PASSE (mauvais)'; exception when others then out := out || ' | B7 offre sans quantité: ' || sqlerrm; end;
  raise exception 'TEST: %', out;
end $$;

-- C
do $$
declare v uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; a1 uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; a3 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  o uuid; o2 uuid; o3 uuid; d uuid; n1 uuid; out text := ''; r record; j json; t0 timestamptz; f timestamptz; x text;
begin
  update public.annonces_publiees set n = 0 where user_id in (v, a3);
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-x1', 'mais', 'Maïs', 'savanes', 'Korhogo', 50, 'sac', 9000) returning id into o;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-x2', 'riz', 'Riz', 'savanes', 'Korhogo', 50, 'sac', 20000) returning id into o2;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price) values ('t93-x3', 'mil', 'Mil', 'savanes', 'Korhogo', 50, 'sac', 7000) returning id into o3;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.demandes (client_id, product_slug, product_label, region_slug, city, quantity, unit, budget) values ('t93-x4', 'oignon', 'Oignon', 'savanes', 'Korhogo', 20, 'sac', 15000) returning id into d;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  n1 := public.nego_ouvrir('offre', o2, 19000, 10, null);
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set expire_le = now() - interval '1 minute' where id in (o, o2);
  update public.demandes set expire_le = now() - interval '1 minute' where id = d;
  update public.offres set expire_le = now() + interval '2 days' where id = o3;
  update public.notif_regles set calme_debut = 3, calme_fin = 4 where id = 1;   -- essai joué à 22 h : hors heures calmes pour le bloc
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://essai.invalid/t93-essai', v, 'xxxxxxxxxxxxxxxxxxxxxxxx', 'xxxxxxxxxx');
  t0 := clock_timestamp();
  j := public.annonces_expirer();
  out := 'C1 tâche: ' || j::text || ' en ' || round(extract(epoch from clock_timestamp() - t0) * 1000) || ' ms';
  select status, expiree_le is not null e into r from public.offres where id = o; out := out || ' | C2 offre au bout: ' || r.status || ' expirée=' || r.e;
  select status into x from public.offres where id = o2; out := out || ' | C3 offre en négociation: ' || x;
  select status, expiree_le is not null e into r from public.demandes where id = d; out := out || ' | C4 demande: ' || r.status || ' expirée=' || r.e;
  select string_agg(type || '/' || cat, ',') into x from public.notif_file where user_id = v and cle like 'x1:%'; out := out || ' | C5 rappel: ' || coalesce(x, 'aucun');
  j := public.annonces_expirer(); out := out || ' | C6 2e passage: ' || j::text;
  select count(*)::text into x from public.offres where id = o; out := out || ' | C7 ligne gardée: ' || x;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  f := public.annonce_prolonger('offre', 't93-x1');
  select status, expiree_le is null e, round(extract(epoch from expire_le - now()) / 86400) j into r from public.offres where id = o;
  out := out || ' | C8 prolonger l''expirée: ' || r.status || ' fin dans ' || r.j || ' j';
  begin update public.offres set expire_le = now() + interval '1 day' where id = o3; out := out || ' | C9 membre change sa date PASSE (mauvais)'; exception when others then out := out || ' | C9 membre change sa date: ' || left(sqlerrm, 30); end;
  f := public.annonce_prolonger('offre', 't93-x3'); out := out || ' | C10 prolonger l''active: fin dans ' || round(extract(epoch from f - now()) / 86400) || ' j';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.annonce_prolonger('offre', 't93-x1'); out := out || ' | C11 autre membre PASSE (mauvais)'; exception when others then out := out || ' | C11 autre membre: ' || left(sqlerrm, 20); end;
  reset role; perform set_config('request.jwt.claims', '', true);
  select count(*)::text into x from public.offres where status = 'active' and expire_le is null and created_at < now() - interval '30 days';
  out := out || ' | C12 anciennes de plus de 30 j encore en ligne: ' || x;
  raise exception 'TEST: %', out;
end $$;

-- D
do $$
declare v uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; a1 uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; a2 uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; a3 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  o uuid; o2 uuid; o3 uuid; g uuid; g2 uuid; g3 uuid; out text := ''; x text; st text; r record;
begin
  update public.annonces_publiees set n = 0 where user_id = v;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement)
    values ('t93-g1', 'igname', 'Igname', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 10000, true) returning id into o;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price)
    values ('t93-g2', 'mais', 'Maïs', 'vallee-du-bandama', 'Bouaké', 100, 'sac', 9000) returning id into o2;
  insert into public.offres (client_id, product_slug, product_label, region_slug, city, quantity, unit, price, ville_seulement)
    values ('t93-g3', 'riz', 'Riz', 'vallee-du-bandama', 'Bouaké', 60, 'sac', 20000, true) returning id into o3;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.groupe_creer(o, 'Daloa centre', 60, 2, now() + interval '2 days', null, null, 30, null); out := 'D1 zone Daloa PASSE (mauvais)'; exception when others then out := 'D1 zone Daloa: ' || left(sqlerrm, 45); end;
  g := public.groupe_creer(o, 'Bouaké centre', 60, 2, now() + interval '2 days', null, null, 30, null); out := out || ' | D2 zone Bouaké centre: ok';
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_valider(g, true, null, null);
  reset role; perform set_config('request.jwt.claims', '', true);
  insert into public.sanctions (user_id, type, debut, fin, motif) values (a2, 'suspension', now() - interval '1 hour', now() + interval '7 days', 'essai 93');
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.groupe_rejoindre(g, 30); out := out || ' | D3 suspendu rejoint PASSE (mauvais)'; exception when others then out := out || ' | D3 suspendu: ' || left(sqlerrm, 16); end;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set pause_le = now() where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.groupe_rejoindre(g, 30); out := out || ' | D4 offre en pause PASSE (mauvais)'; exception when others then out := out || ' | D4 offre en pause: ' || left(sqlerrm, 16); end;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set pause_le = null where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_rejoindre(g, 30);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_lancer(g);
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.offres set quantity = 40 where id = o;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_confirmer(g, true);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  st := public.groupe_confirmer(g, true);
  reset role; perform set_config('request.jwt.claims', '', true);
  select statut into x from public.groupes_achat where id = g; out := out || ' | D5 stock manquant: retour=' || st || ' groupe=' || x;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  g2 := public.groupe_creer(o2, 'Bouaké', 50, 2, now() + interval '2 days', null, null, 20, null);
  g3 := public.groupe_creer(o3, 'Bouaké, quartier Koko', 60, 2, now() + interval '2 days', null, null, 30, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_valider(g2, true, null, null);
  perform public.groupe_valider(g3, true, null, null);
  update public.offres set retiree_le = now() where id = o2;
  reset role; perform set_config('request.jwt.claims', '', true);
  select statut into x from public.groupes_achat where id = g2; out := out || ' | D6 offre retirée: groupe=' || x;
  perform set_config('request.jwt.claims', json_build_object('sub', a2, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.groupe_creer(o, 'Bouaké', 20, 2, now() + interval '2 days', null, null, 10, null); out := out || ' | D7 suspendu crée PASSE (mauvais)'; exception when others then out := out || ' | D7 suspendu crée: ' || left(sqlerrm, 16); end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_rejoindre(g3, 30);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_lancer(g3);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.groupe_confirmer(g3, true);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', a3, 'role', 'authenticated')::text, true); set local role authenticated;
  st := public.groupe_confirmer(g3, true);
  reset role; perform set_config('request.jwt.claims', '', true);
  select statut into x from public.groupes_achat where id = g3;
  select o.status, o.quantity into r from public.offres o where o.id = o3;
  out := out || ' | D8 groupe complet: retour=' || st || ' groupe=' || x || ' offre=' || r.status || '/' || r.quantity;
  select string_agg(coalesce(ville_arrivee, '-') || '/' || commission_montant, ',') into x from public.commandes where groupe_id = g3;
  out := out || ' | D9 commandes (ville d''arrivée/commission): ' || x;
  raise exception 'TEST: %', out;
end $$;

-- E
do $$
declare a1 uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; b record; d uuid; out text := '';
begin
  select x.id, x.user_id into b from public.besoins x where x.statut = 'ouvert' and x.user_id <> a1 and exists (select 1 from public.demandes dd where dd.besoin_id = x.id and dd.status = 'active') limit 1;
  select id into d from public.demandes where besoin_id = b.id and status = 'active' limit 1;
  update public.besoins set livraison_debut = current_date - 10, livraison_fin = current_date - 2 where id = b.id;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.besoin_repondre(d, 1000, 10, null, null, null); out := 'E1 besoin passé PASSE (mauvais)'; exception when others then out := 'E1 besoin passé: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims', '', true);
  update public.besoins set livraison_fin = current_date + 5 where id = b.id;
  perform set_config('request.jwt.claims', json_build_object('sub', a1, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.besoin_repondre(d, 1000, 10, null, null, null); out := out || ' | E2 besoin en cours: ok'; exception when others then out := out || ' | E2 besoin en cours refusé: ' || sqlerrm; end;
  reset role;
  raise exception 'TEST: % (besoin %)', out, coalesce(b.id::text, 'aucun');
end $$;
