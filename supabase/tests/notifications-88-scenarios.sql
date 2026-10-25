-- Tests du schéma 88 (notifications), projet de test seulement. Chaque bloc finit par raise exception 'TEST …' : tout est annulé.
-- Comptes de simulation du projet de test (aucune donnée réelle). A = administrateur. Les téléphones sont de faux abonnements
-- (https://test.invalid/…), créés puis annulés avec le bloc : aucun push ne part (le projet de test n'a pas les clés push).
-- Résultat obtenu le 24/10/2026 noté sous chaque bloc.

-- Bloc 1 (mis à jour pour le schéma 91, relu avec le schéma 96b) : plus aucun réglage par catégorie (le serveur ignore les
-- anciennes préférences et « diffusions »), catégories critiques, plafond de 8 commerciaux par jour (l'envoi raté ne compte pas),
-- écart de 90 min entre deux commerciaux, 4 « conseils » au plus, doublon, heures calmes, envoi sans téléphone.
-- L'ancien bloc 1 (schéma 88 : préférences « pref », plafond de 6, 1 conseil) est périmé depuis le schéma 91.
do $$
declare B1 uuid := '9bdc3a6d-93b3-41f1-bbbd-984b1094f05f'; B2 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  B3 uuid := '66b186ee-6e92-4a0d-8bc9-d5b5699d652f'; B4 uuid := 'ec705bc9-0a7b-45f8-905d-3458bad00037'; B5 uuid := '9a88ae51-03fb-41e9-8197-485763bf74af';
  res text := ''; j json; i int; n int; h int := extract(hour from now() at time zone 'UTC');
begin
  -- heures calmes neutralisées, écart réduit à 1 min (le résultat ne dépend pas de l'heure du test) ; remis plus bas pour les tester.
  -- Le temps qui passe est simulé en reculant de 3 min les envois (plus que l'écart doublé de 2 min) déjà notés (now() ne bouge pas dans un bloc).
  update public.notif_regles set calme_debut = 0, calme_fin = 0, ecart_min = 1 where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', B1, 'role', 'authenticated')::text, true);
  begin perform public.notif_pref_regler('offres', false); exception when others then null; end;
  res := res || 'offres « coupées » : envoyer=' || (public.notif_preparer(B1, 'offres', 't88:o1') ->> 'envoyer');
  j := public.notif_preparer(B1, 'commande', 't88:c1', 'creee', null, null, 'application.dc.html#/?commande=x', 'Commande', 'Tomate');
  res := res || ' | commande (critique) : envoyer=' || (j ->> 'envoyer') || ' nature=' || (j ->> 'nature');

  perform set_config('request.jwt.claims', json_build_object('sub', B2, 'role', 'authenticated')::text, true);
  begin perform public.notif_reglage_diffusions(false); exception when others then null; end;
  res := res || ' | diffusions=false : conseils envoyer=' || (public.notif_preparer(B2, 'conseils', 't88:d1') ->> 'envoyer');

  -- 9 envois commerciaux, le 1er raté : il ne compte pas, donc 8 réussis ; le 10e est refusé ; la négociation passe toujours
  for i in 1..9 loop
    j := public.notif_preparer(B3, 'groupes', 't88:p' || i);
    perform public.notif_resultat((j ->> 'nid')::uuid, 1, case when i = 1 then 0 else 1 end);
    update public.notif_journal set cree_le = cree_le - interval '3 minutes' where user_id = B3;
  end loop;
  res := res || ' | plafond : ' || (select string_agg(resultat, ',' order by id) from public.notif_journal where user_id = B3 and cle like 't88:p%');
  res := res || ' | 10e : ' || (select coalesce(x ->> 'raison', x::text) from (select public.notif_preparer(B3, 'offres', 't88:p10') x) y);
  res := res || ' | négociation après plafond : envoyer=' || (public.notif_preparer(B3, 'negociation', 't88:n1') ->> 'envoyer');

  for i in 1..4 loop j := public.notif_preparer(B5, 'conseils', 't88:k' || i); perform public.notif_resultat((j ->> 'nid')::uuid, 1, 1);
    update public.notif_journal set cree_le = cree_le - interval '3 minutes' where user_id = B5; end loop;
  res := res || ' | 4 conseils, 5e : ' || (select coalesce(x ->> 'raison', x::text) from (select public.notif_preparer(B5, 'conseils', 't88:k5') x) y);

  update public.notif_regles set ecart_min = 90 where id = 1;
  j := public.notif_preparer(B4, 'groupes', 't88:e1'); perform public.notif_resultat((j ->> 'nid')::uuid, 1, 1);
  res := res || ' | écart 90 min : 2e commercial ' || (select coalesce(x ->> 'raison', x::text) from (select public.notif_preparer(B4, 'offres', 't88:e2') x) y);

  res := res || ' | doublon : 1er envoyer=' || (public.notif_preparer(B5, 'negociation', 't88:dbl') ->> 'envoyer');
  res := res || ', 2e ' || (select coalesce(x ->> 'raison', x::text) from (select public.notif_preparer(B5, 'negociation', 't88:dbl') x) y);
  select count(*) into n from public.notif_journal where cle = 't88:dbl';
  res := res || ', lignes=' || n;

  update public.notif_regles set calme_debut = h, calme_fin = (h + 1) % 24, ecart_min = 1 where id = 1;
  res := res || ' | calme : groupes ' || (select coalesce(x ->> 'raison', x::text) from (select public.notif_preparer(B2, 'groupes', 't88:q1') x) y)
    || ', commande envoyer=' || (public.notif_preparer(B2, 'commande', 't88:q2') ->> 'envoyer');

  j := public.notif_preparer(B4, 'commande', 't88:t0'); perform public.notif_resultat((j ->> 'nid')::uuid, 0, 0);
  res := res || ' | sans téléphone : ' || (select resultat from public.notif_journal where cle = 't88:t0');
  raise exception 'TEST %', res;
end $$;
-- Résultat (24/10/2026, après le schéma 96b, projet de test) : TEST offres « coupées » : envoyer=true | commande (critique) : envoyer=true nature=trans | diffusions=false : conseils envoyer=true | plafond : echec,ok,ok,ok,ok,ok,ok,ok,ok | 10e : plafond | négociation après plafond : envoyer=true | 4 conseils, 5e : plafond | écart 90 min : 2e commercial plafond | doublon : 1er envoyer=true, 2e doublon, lignes=1 | calme : groupes calme, commande envoyer=true | sans téléphone : aucun_telephone
-- Lecture : les anciennes préférences ne coupent plus rien ; la commande part toujours ; 8 envois commerciaux réussis par jour (le raté ne compte pas), le suivant est refusé ; 4 conseils au plus ; 90 min entre deux commerciaux ; une seule ligne pour une clé ; heures calmes : le commercial attend, la commande part.

-- Bloc 2 : ouverture (une seule fois, faux identifiant refusé), droits du visiteur, du membre et de l'administrateur.
do $$
declare B1 uuid := '9bdc3a6d-93b3-41f1-bbbd-984b1094f05f'; B2 uuid := 'af343de8-c7f9-4531-899e-624322b72a38'; A uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  res text := ''; j json; v_nid uuid; n int; ok boolean;
begin
  j := public.notif_preparer(B1, 'negociation', 't88:o:1', 'prix', gen_random_uuid()::text, null, 'application.dc.html#/?nego=x', 'Awa propose 500 F / kg', 'Tomate');
  v_nid := (j ->> 'nid')::uuid; perform public.notif_resultat(v_nid, 1, 1);
  perform public.notif_preparer(B2, 'commande', 't88:o:2');
  perform public.notif_desactivation_noter(B2, 'expire');

  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  ok := public.notif_ouverte(v_nid); res := res || 'ouverture 1 : ' || ok;
  ok := public.notif_ouverte(v_nid); res := res || ' | ouverture 2 : ' || ok;
  ok := public.notif_ouverte(gen_random_uuid()); res := res || ' | faux identifiant : ' || ok;
  begin select count(*) into n from public.notif_journal; res := res || ' | visiteur lit le journal (erreur) ' || n; exception when others then res := res || ' | visiteur : journal refusé'; end;
  begin perform public.notif_preparer(B1, 'offres', 't88:anon'); res := res || ' | visiteur prépare (erreur)'; exception when others then res := res || ' | visiteur : préparer refusé'; end;
  begin perform public.notif_stats(30); res := res || ' | visiteur stats (erreur)'; exception when others then res := res || ' | visiteur : stats refusées'; end;
  begin perform public.notif_prefs_moi(); res := res || ' | visiteur prefs (erreur)'; exception when others then res := res || ' | visiteur : prefs refusées'; end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', B2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.notif_journal where user_id <> B2; res := res || ' | B2 voit lignes des autres : ' || n;
  select count(*) into n from public.notif_journal where cle = 't88:o:2'; res := res || ' | B2 voit la sienne : ' || n;
  begin insert into public.notif_journal (user_id, cat, nature, cle) values (B2, 'offres', 'com', 't88:x'); res := res || ' | insertion directe (erreur)'; exception when others then res := res || ' | insertion directe refusée'; end;
  begin update public.notif_journal set ouvert_le = now() where cle = 't88:o:2'; get diagnostics n = row_count; res := res || ' | modification directe (erreur) ' || n; exception when others then res := res || ' | modification directe refusée'; end;
  begin select count(*) into n from public.notif_prefs; res := res || ' | lit notif_prefs (erreur)'; exception when others then res := res || ' | notif_prefs refusée'; end;
  begin select count(*) into n from public.notif_file; res := res || ' | lit notif_file (erreur)'; exception when others then res := res || ' | notif_file refusée'; end;
  begin perform public.notif_preparer(B2, 'offres', 't88:m'); res := res || ' | membre prépare (erreur)'; exception when others then res := res || ' | membre : préparer refusé'; end;
  begin perform public.notif_lots_prendre(10); res := res || ' | membre prend les lots (erreur)'; exception when others then res := res || ' | membre : lots refusés'; end;
  begin perform public.notif_stats(30); res := res || ' | membre stats (erreur)'; exception when others then res := res || ' | membre : stats refusées'; end;
  select count(*) into n from public.notif_categories; res := res || ' | catégories lisibles : ' || n;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.notif_stats(30);
  reset role;
  res := res || ' | stats négociation : ' || (select x::text from json_array_elements(j -> 'categories') x where x ->> 'cat' = 'negociation')
    || ' | désactivations : ' || (j -> 'desactivations')::text
    || ' | clés : ' || (select string_agg(k, ',') from json_object_keys(j) k);
  raise exception 'TEST %', res;
end $$;
-- Résultat (24/10/2026) : TEST ouverture 1 : true | ouverture 2 : false | faux identifiant : false | visiteur : journal refusé | visiteur : préparer refusé | visiteur : stats refusées | visiteur : prefs refusées | B2 voit lignes des autres : 0 | B2 voit la sienne : 1 | insertion directe refusée | modification directe refusée | notif_prefs refusée | notif_file refusée | membre : préparer refusé | membre : lots refusés | membre : stats refusées | catégories lisibles : 15 | stats négociation : {"cat":"negociation","libelle":"Négociations","nature":"trans","ordre":2,"envoyees":1,"echecs":0,"sans_telephone":0,"bloquees":0,"ouvertes":1,"lues_liste":0,"actions":0,"conversions":0} | désactivations : [{"origine" : "expire", "cat" : null, "n" : 1}] | clés : depuis,abonnes,categories,desactivations,limites
-- Lecture : l'ouverture compte une fois ; un faux identifiant est refusé ; le visiteur ne lit rien ; le membre ne voit que ses envois et n'écrit rien directement ; seuls les totaux sont rendus à l'administrateur.

-- Bloc 3 : nouvelle offre pertinente (produit suivi, déjà acheté, région ; ni l'auteur ni une autre région), regroupement
-- par personne et par produit, « ville seulement », demande pour les vendeurs du produit, pas de doublon à la 2e prise.
do $$
declare S uuid := 'ec35879a-1009-4b40-9c66-53a9b2595eb8'; B1 uuid := '9bdc3a6d-93b3-41f1-bbbd-984b1094f05f'; B2 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  B3 uuid := '66b186ee-6e92-4a0d-8bc9-d5b5699d652f'; B4 uuid := 'ec705bc9-0a7b-45f8-905d-3458bad00037'; B5 uuid := '9a88ae51-03fb-41e9-8197-485763bf74af';
  B6 uuid := 'f8e1b009-e7c7-4637-b685-c05155f06be9'; V1 uuid := '7e1cc033-cb69-4186-a81c-8fcef71e66c1'; V2 uuid := '0ce42d74-20ae-458d-b145-de76b17efb7c';
  P text := 'tomate-t88'; R text := 'region-t88'; res text := ''; o0 uuid; o1 uuid; o2 uuid; o3 uuid; o4 uuid; d1 uuid; ng uuid; cid uuid; u uuid; lots json;
begin
  update public.notif_regles set calme_debut = 0, calme_fin = 0 where id = 1;
  update public.annonces_publiees set n = 0 where user_id in (S, V1, V2, B6);
  foreach u in array array[S, B1, B2, B3, B4, B5, B6, V1, V2] loop
    insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test.invalid/' || u, u, repeat('x', 24), repeat('y', 10));
  end loop;
  update public.profils set region_slug = R, role = 'acheteur', ville = 'Ville T88' where user_id = B3;
  update public.profils set region_slug = 'region-autre' where user_id = B4;
  insert into public.alertes_produits (user_id, product_slug, offres, demandes) values (B1, P, true, false), (B5, P, false, true);
  -- B2 a déjà acheté ce produit (commande terminée il y a 5 jours)
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (S, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 100, 'carton', 9000, 'active') returning id into o0;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, unite, statut)
  values ('offre', o0, B2, S, 'Tomate', 'carton', 'conclue') returning id into ng;
  insert into public.commandes (numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
  values ('T88-1', ng, S, B2, B2, 'Tomate', 10, 'carton', 9000, 90000, 'vendeur', 'en_cours', 'confirmee') returning id into cid;
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - interval '5 days' where id = cid;
  res := res || 'slug commande=' || public._notif_slug_commande(cid);
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (V1, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 50, 'carton', 8500, 'active') returning id into o1;
  res := res || ' | offre 1 : ' || coalesce((select string_agg(case f.user_id when B1 then 'B1' when B2 then 'B2' when B3 then 'B3' when B4 then 'B4' when V1 then 'auteur' when S then 'S' else '?' end || ':' || (f.donnees ->> 'raison'), ',' order by f.user_id)
      from public.notif_file f where f.objet_id = o1::text), 'aucune');
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (V1, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 20, 'carton', 8800, 'active') returning id into o2;
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (V2, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 30, 'carton', 8700, 'active') returning id into o3;
  -- « ville seulement » à Ville T88 : B3 (même ville) oui ; B1 (suiveur, autre ville) et B2 (autre ville) non
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, ville_seulement)
  values (V2, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 30, 'carton', 8700, 'active', true) returning id into o4;
  res := res || ' | ville seulement : ' || coalesce((select string_agg(case f.user_id when B1 then 'B1' when B2 then 'B2' when B3 then 'B3' else '?' end, ',') from public.notif_file f where f.objet_id = o4::text), 'personne');
  insert into public.demandes (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, status)
  values (B6, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 200, 'carton', 8000, 'active') returning id into d1;
  res := res || ' | demande : ' || coalesce((select string_agg(case f.user_id when B5 then 'B5' when S then 'S' when V1 then 'V1' when V2 then 'V2' when B6 then 'auteur' else f.user_id::text end || ':' || f.cat || ':' || (f.donnees ->> 'raison'), ',' order by f.user_id)
      from public.notif_file f where f.objet_id = d1::text), 'aucune');
  lots := public.notif_lots_prendre(500);
  res := res || ' | lots : ' || coalesce((select string_agg(case (l ->> 'user_id')::uuid when B1 then 'B1' when B2 then 'B2' when B3 then 'B3' when B5 then 'B5' when S then 'S' when V1 then 'V1' when V2 then 'V2' else '?' end
      || ' ' || (l ->> 'type') || ' n=' || (l ->> 'n'), ', ' order by l ->> 'user_id', l ->> 'type') from json_array_elements(lots) l where l ->> 'slug' = P), 'aucun');
  res := res || ' | 2e prise : ' || (select count(*) from json_array_elements(public.notif_lots_prendre(500)) l where l ->> 'slug' = P);
  res := res || ' | lot B1 : ' || coalesce((select (l -> 'donnees')::text || ' url=' || (l ->> 'url') from json_array_elements(lots) l where (l ->> 'user_id')::uuid = B1 and l ->> 'slug' = P), 'aucun');
  raise exception 'TEST %', res;
end $$;
-- Résultat (24/10/2026) : TEST slug commande=tomate-t88 | offre 1 : B3:region,B1:suivi,B2:deja_achete | ville seulement : B3 | demande : V2:pour_vendeur:vendeur_region,V1:pour_vendeur:vendeur_region,B5:pour_vendeur:suivi,S:pour_vendeur:vendeur_region | lots : V2 demande n=1, B3 offre n=5, V1 demande n=1, B5 demande n=1, B1 offre n=4, B2 offre n=3, S demande n=1 | 2e prise : 0 | lot B1 : {"prix": 8700, "unite": "carton", "ville": "Ville T88", "raison": "suivi", "quantite": 30} url=application.dc.html#/produits/tomate-t88
-- Lecture : l'offre prévient le suiveur, l'acheteur passé et l'acheteur de la région, pas l'auteur ni l'autre région ; « ville seulement » : seule la personne de la ville ; la demande prévient le suiveur des demandes et les vendeurs du produit (pas son auteur) ; un seul message par personne et par produit (B1 : 4 offres réunies ; B3 en a 5 avec l'offre « ville seulement ») ; rien la 2e fois.

-- Bloc 4 : achat groupé proche du seuil (80 %, une seule fois), veille de la date limite, approvisionnement à renouveler,
-- action après une ouverture.
do $$
declare S uuid := 'ec35879a-1009-4b40-9c66-53a9b2595eb8'; B1 uuid := '9bdc3a6d-93b3-41f1-bbbd-984b1094f05f'; B2 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  B3 uuid := '66b186ee-6e92-4a0d-8bc9-d5b5699d652f'; B4 uuid := 'ec705bc9-0a7b-45f8-905d-3458bad00037';
  P text := 'tomate-t88'; R text := 'region-t88'; res text := ''; o0 uuid; g uuid; ng uuid; cid uuid; u uuid; lots json; i int; j json; v_nid uuid; n int;
begin
  update public.notif_regles set calme_debut = 0, calme_fin = 0 where id = 1;
  update public.annonces_publiees set n = 0 where user_id = S;
  foreach u in array array[S, B1, B2, B3, B4] loop
    insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test.invalid/' || u, u, repeat('x', 24), repeat('y', 10));
  end loop;
  -- B3 suit le produit dans la région du groupe ; B4 le suit mais dans une autre région
  update public.profils set region_slug = R where user_id = B3;
  update public.profils set region_slug = 'region-autre' where user_id = B4;
  insert into public.alertes_produits (user_id, product_slug, offres, demandes) values (B3, P, true, false), (B4, P, true, false);
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (S, gen_random_uuid()::text, P, 'Tomate', R, 'Ville T88', 1000, 'kg', 900, 'active') returning id into o0;
  insert into public.groupes_achat (offre_id, vendeur_id, createur_id, produit, unite, zone, region_slug, objectif, min_participants, date_limite, prix_base, statut)
  values (o0, S, B1, 'Tomate', 'kg', 'Ville T88', R, 100, 2, now() + interval '24 hours', 900, 'ouvert') returning id into g;
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g, B1, 50, 900);
  res := res || '50 % : ' || (select count(*) from public.notif_file where cle like 'groupe80:' || g || '%');
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g, B2, 30, 900);
  res := res || ' | 80 % : ' || (select string_agg(case user_id when B1 then 'B1' when B2 then 'B2' when B3 then 'B3' when B4 then 'B4' when S then 'vendeur' else '?' end || ':' || cat || ':manque ' || (donnees ->> 'manque'), ',' order by user_id) from public.notif_file where cle like 'groupe80:' || g || '%');
  update public.groupe_participants set quantite = 35 where groupe_id = g and user_id = B2;
  res := res || ' | 85 % (pas de doublon) : ' || (select count(*) from public.notif_file where cle like 'groupe80:' || g || '%');
  res := res || ' | veille : ' || public.notif_groupes_veille();
  res := res || ' puis ' || public.notif_groupes_veille();
  -- B3 : 2 commandes terminées du même produit à 10 jours d'écart, la dernière il y a 10 jours → à renouveler aujourd'hui
  for i in 1..2 loop
    insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, unite, statut)
    values ('offre', o0, B3, S, 'Tomate', 'kg', 'conclue') returning id into ng;
    insert into public.commandes (numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('T88-R' || i, ng, S, B3, B3, 'Tomate', 10, 'kg', 900, 9000, 'vendeur', 'en_cours', 'confirmee') returning id into cid;
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = now() - make_interval(days => case when i = 1 then 20 else 10 end) where id = cid;
  end loop;
  res := res || ' | renouveler : ' || public.notif_renouveler_calculer();
  res := res || ' puis ' || public.notif_renouveler_calculer();
  res := res || ' (' || coalesce((select donnees::text || ' ' || url from public.notif_file where user_id = B3 and type = 'renouveler'), 'rien') || ')';
  lots := public.notif_lots_prendre(500);
  res := res || ' | lots : ' || coalesce((select string_agg(case (l ->> 'user_id')::uuid when B1 then 'B1' when B2 then 'B2' when B3 then 'B3' when B4 then 'B4' else '?' end
      || ' ' || (l ->> 'type') || ' ' || (l ->> 'cat') || ' n=' || (l ->> 'n'), ', ' order by l ->> 'user_id', l ->> 'type') from json_array_elements(lots) l where l ->> 'slug' = P), 'aucun');
  -- B4 ouvre une notification « offres » sur ce produit, puis fait une proposition dans les 24 h
  j := public.notif_preparer(B4, 'offres', 't88:act', 'offre', o0::text, P);
  v_nid := (j ->> 'nid')::uuid; perform public.notif_resultat(v_nid, 1, 1);
  perform public.notif_ouverte(v_nid);
  update public.notif_journal set ouvert_le = now() - interval '1 minute' where nid = v_nid;
  insert into public.negociations (cible, cible_id, auteur_id, proprio_id, produit, unite, statut) values ('offre', o0, B4, S, 'Tomate', 'kg', 'ouverte');
  n := public.notif_actions_calculer();
  res := res || ' | actions calculées : ' || n || ' → ' || coalesce((select action from public.notif_journal where nid = v_nid), 'aucune');
  j := public.notif_preparer(B2, 'offres', 't88:act2', 'offre', o0::text, P);
  res := res || ', non ouverte : ' || coalesce((select action from public.notif_journal where cle = 't88:act2'), 'aucune');
  raise exception 'TEST %', res;
end $$;
-- Résultat (24/10/2026) : TEST 50 % : 0 | 80 % : B3:groupes:manque 20,B1:groupe_suivi:manque 20,B2:groupe_suivi:manque 20 | 85 % (pas de doublon) : 3 | veille : 2 puis 0 | renouveler : 1 puis 0 ({"jours": 10, "commandes": 2} application.dc.html#/?racheter=<id>) | lots : B3 groupe_proche groupes n=1, B3 offre offres n=1, B3 renouveler renouveler n=1, B1 groupe_proche groupe_suivi n=1, B1 groupe_veille groupe_suivi n=1, B2 groupe_proche groupe_suivi n=1, B2 groupe_veille groupe_suivi n=1, B4 offre offres n=1 | actions calculées : 1 → proposition, non ouverte : aucune
-- Lecture : rien à 50 % ; à 80 % les inscrits (groupe_suivi) et le suiveur de la région (groupes), pas celui d'une autre région, avec le vrai manque (20 kg) ; pas de 2e message à 85 % ; veille une seule fois ; produit à racheter calculé une seule fois (écart moyen 10 jours) ; l'action « proposition » est comptée après l'ouverture, rien pour une notification non ouverte.

-- ───────── Bloc 5 (schéma 88d) : statistiques jour par jour, administrateur seulement. Projet de test, 24/10/2026.
-- Résultat réel : TEST jours={"jour":"2026-10-24","envoyees":1,"ouvertes":1,"actions":1,"desactivations":1} nb=3 membre_refuse=t anon_refuse=t stats_cat_ok=t
do $$
declare adm uuid; mb uuid; r json; s json; ok_anon boolean := false; ok_mb boolean := false;
begin
  select user_id into adm from public.admins limit 1;
  select id into mb from auth.users where id not in (select user_id from public.admins) limit 1;
  insert into public.notif_journal (user_id, cat, nature, cle, resultat, ouvert_le, ouvert_par, action_le, action) values (mb, 'offres', 'com', 'test88d:' || gen_random_uuid(), 'ok', now(), 'push', now(), 'proposition');
  insert into public.notif_desactivations (user_id, origine) values (mb, 'permission');
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.notif_stats_jours(3);
  s := public.notif_stats(1);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', mb, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin perform public.notif_stats_jours(3); exception when others then ok_mb := sqlerrm like 'Réservé%'; end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin perform public.notif_stats_jours(3); exception when others then ok_anon := sqlstate = '42501'; end;
  reset role;
  raise exception 'TEST jours=% nb=% membre_refuse=% anon_refuse=% stats_cat_ok=%', r->0, json_array_length(r), ok_mb, ok_anon, (s->'categories') is not null;
end $$;

-- ───────── Bloc 6 (relecture du 24/10/2026) : permission retirée sans téléphone, conseils pendant les heures calmes, date limite
-- de la veille. Projet de test ; tout est annulé par l'exception.
do $$
declare S uuid := 'ec35879a-1009-4b40-9c66-53a9b2595eb8'; B1 uuid := '9bdc3a6d-93b3-41f1-bbbd-984b1094f05f'; B2 uuid := 'af343de8-c7f9-4531-899e-624322b72a38';
  res text := ''; o0 uuid; g uuid; h int := extract(hour from now() at time zone 'UTC'); n int; ok boolean;
begin
  update public.notif_regles set calme_debut = 0, calme_fin = 0 where id = 1;
  update public.marketing_reglage set max_jour = 30 where id = 1;
  perform set_config('request.jwt.claims', json_build_object('sub', B2, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := public.notif_permission_retiree(); res := res || 'sans téléphone : ' || coalesce(ok::text, 'null');
  reset role;
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test.invalid/b2', B2, repeat('x', 24), repeat('y', 10));
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test.invalid/b1', B1, repeat('x', 24), repeat('y', 10));
  set local role authenticated;
  ok := public.notif_permission_retiree(); res := res || ' | avec téléphone : ' || coalesce(ok::text, 'null');
  ok := public.notif_permission_retiree(); res := res || ' | 2e fois : ' || coalesce(ok::text, 'null');
  reset role;
  select count(*) into n from public.notif_cible_conseils() c where c.user_id in (B1, B2); res := res || ' | conseils (jour) : ' || n;
  update public.notif_regles set calme_debut = h, calme_fin = (h + 1) % 24 where id = 1;
  select count(*) into n from public.notif_cible_conseils(); res := res || ' | conseils (calme) : ' || n;
  update public.notif_regles set calme_debut = 0, calme_fin = 0 where id = 1;
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
  values (S, gen_random_uuid()::text, 'tomate-t88', 'Tomate', 'region-t88', 'Ville T88', 1000, 'kg', 900, 'active') returning id into o0;
  insert into public.groupes_achat (offre_id, vendeur_id, createur_id, produit, unite, zone, region_slug, objectif, min_participants, date_limite, prix_base, statut)
  values (o0, S, B1, 'Tomate', 'kg', 'Ville T88', 'region-t88', 100, 2, now() + interval '20 hours', 900, 'ouvert') returning id into g;
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g, B1, 10, 900);
  n := public.notif_groupes_veille();
  res := res || ' | veille : ' || n || ' ' || coalesce((select donnees::text from public.notif_file where cle = 'groupe_veille:' || g || ':' || B1), 'aucune ligne');
  raise exception 'TEST %', res;
end $$;
-- Résultat (24/10/2026) : sans téléphone : false | avec téléphone : true | 2e fois : false | conseils (jour) : 2 | conseils (calme) : 0
-- | veille : 1 {"unite": "kg", "limite": "2026-10-25T13:05:54.759364+00:00", "manque": 90, "statut": "ouvert"}

-- Rejoué le 24/10/2026 (étape 7, après 92-96) : blocs 1, 2, 3, 5, 6 identiques ; bloc 4 : plus de « B3 offre » ni « B3 renouveler »
-- dans le même passage : depuis 96b (notif_lots_prendre), un seul lot commercial par personne et par passage (écart 90 min) ;
-- les deux restent « en attente » pour un passage suivant. Voulu.
