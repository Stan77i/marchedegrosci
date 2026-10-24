-- Scénarios du schéma 86 (boutiques), joués sur le projet de TEST (yowdymdnoiubatxlwhfv) le 24/10/2026.
-- Chaque bloc se termine par raise exception 'TEST …' : tout est annulé, rien ne reste en base.
-- Membres de test : vendeur efec4ce4-… (3 offres), acheteurs bdc90230-… et 98f3115e-…, membre 072428f6-… (0 annonce publiée).
-- Résultats obtenus (copiés de la sortie) :
--  A : activer → active=true, adresse = code court, nom « Test C. » ; anon : trouvée, 3 offres (manioc disponible, igname disponible,
--      banane-plantain pause), majuscules acceptées, adresse inconnue → trouvee=false ; anon refusé sur ma_boutique et sur la table ;
--      négociation refusée sur l'offre en pause (ANNONCE_EN_PAUSE), permise sur l'offre active ; l'acheteur ne modifie pas l'offre (0 ligne) ;
--      visites {vues 1 (deux vues anon dédoublées), produits 1, partages 1} ; retrait : status retiree, ligne gardée ;
--      sans quantité → QUANTITE_REQUISE ; pseudo = code d'une autre boutique → refusé.
--  B : quantité de départ 50 → 60 (remise par le vendeur) → reste 60 quand la quantité baisse à 8 → état stock_faible ;
--      quantité de départ à la main → refusée (droit de colonne) ; accord 150 sur 100 → STOCK_INSUFFISANT ; accord 80 → reste 20, stock_faible ;
--      second accord 50 sur 20 → STOCK_INSUFFISANT ; pause : la négociation ouverte reste ouverte et conclut (10) ;
--      retrait par retiree_le seul (après 86c) → 0 négociation ouverte, ligne gardée ; compte supprimé → boutique introuvable et fermée.
--  C : épuisé visible (igname : epuise, 0) ; boutiques_de → 1 ; boutiques_publiques → la boutique ; 45 mesures d'un même visiteur → 40 gardées.

-- A
do $$
declare v uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; acht uuid := 'bdc90230-b914-4d84-8939-94b058693af0';
  o1 uuid := '18935a58-5759-4fef-a9d9-44bb4276ea9a'; o2 uuid := '7f3007cf-54e7-4da6-9916-fd97213e1d30';
  r json; code text; out text := ''; e text; pub json;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.boutique_activer(true); code := r->>'code';
  out := out || ' | activer: active=' || (r->>'active') || ' code=' || code || ' adresse=' || (r->>'adresse') || ' nom=' || (r->>'nom');
  update public.offres set pause_le = now() where id = o2;
  r := public.ma_boutique(); out := out || ' | ma_boutique: dispo=' || (r->>'disponibles') || ' pause=' || (r->>'en_pause');
  reset role; perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;
  pub := public.boutique_publique(code);
  out := out || ' | anon: trouvee=' || (pub->>'trouvee') || ' nom=' || (pub->>'nom') || ' nb=' || json_array_length(pub->'catalogue')
     || ' etats=' || (select string_agg((x->>'produit') || ':' || (x->>'etat'), ',') from json_array_elements(pub->'catalogue') x);
  out := out || ' | majuscules: ' || (public.boutique_publique(upper(code))->>'trouvee') || ' inconnue: ' || (public.boutique_publique('zzzzzz')->>'trouvee');
  begin perform public.ma_boutique(); out := out || ' | anon ma_boutique PASSE (mauvais)'; exception when others then out := out || ' | anon ma_boutique refusé'; end;
  begin perform * from public.boutiques; out := out || ' | anon lit boutiques (mauvais)'; exception when others then out := out || ' | anon table refusée'; end;
  perform public.boutique_mesurer(code, 'vue', 'qr', 'qr', null);
  perform public.boutique_mesurer(code, 'vue', 'qr', 'qr', null);
  perform public.boutique_mesurer(code, 'partage', null, null, null);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', acht, 'role', 'authenticated')::text, true); set local role authenticated;
  begin perform public.nego_ouvrir('offre', o2, 190, 100, 'test'); out := out || ' | nego sur pause PASSE (mauvais)'; exception when others then out := out || ' | nego pause refusée: ' || sqlerrm; end;
  begin perform public.nego_ouvrir('offre', o1, 290, 100, 'test'); out := out || ' | nego offre active: ok'; exception when others then out := out || ' | nego active refusée: ' || sqlerrm; end;
  perform public.boutique_mesurer(code, 'produit', null, null, left(md5(o1::text), 12));
  update public.offres set pause_le = null where id = o2; get diagnostics e = row_count; out := out || ' | acheteur modifie offre: lignes=' || e;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.boutique_mesurer(code, 'vue', null, null, null);
  perform public.boutique_mesurer(code, 'qr', null, null, null);
  r := public.ma_boutique(); out := out || ' | visites=' || (r->'visites')::text;
  update public.offres set retiree_le = now() where id = o1;
  reset role;
  select json_build_object('status', status, 'retiree_le', retiree_le is not null) into r from public.offres where id = o1;
  out := out || ' | retiree: ' || r::text;
  set local role authenticated;
  begin insert into public.offres (client_id, product_slug, region_slug, city, quantity, unit, price) values ('t-sans-qte', 'igname', 'abidjan', 'Abidjan', null, 'kg', 100); out := out || ' | sans quantité PASSE (mauvais)'; exception when others then out := out || ' | sans quantité: ' || sqlerrm; end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', acht, 'role', 'authenticated')::text, true); set local role authenticated;
  begin update public.profils set pseudo = code where user_id = acht; out := out || ' | pseudo=code PASSE (mauvais)'; exception when others then out := out || ' | pseudo=code: ' || sqlerrm; end;
  raise exception 'TEST %', out;
end $$;

-- B
do $$
declare v uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; acht uuid := 'bdc90230-b914-4d84-8939-94b058693af0'; acht2 uuid := '98f3115e-2759-4f5c-86cb-a8d755cda4bc';
  w uuid := '072428f6-50e3-471c-9256-1439e5b62484';
  o1 uuid := '18935a58-5759-4fef-a9d9-44bb4276ea9a'; o2 uuid := '7f3007cf-54e7-4da6-9916-fd97213e1d30';
  r json; code text; out text := ''; e text; n1 uuid; n2 uuid; oid uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', w, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.offres (client_id, product_slug, region_slug, city, quantity, unit, price, quantite_depart) values ('t-avec-qte', 'igname', 'abidjan', 'Abidjan', 50, 'sac', 100, 9999) returning id into oid;
  select quantite_depart::text into e from public.offres where id = oid; out := out || 'insert depart=' || e;
  update public.offres set quantity = 60 where id = oid; select quantite_depart::text into e from public.offres where id = oid; out := out || ' | remonte 60 → depart=' || e;
  begin update public.offres set quantite_depart = 1 where id = oid; out := out || ' | depart à la main PASSE (mauvais)'; exception when others then out := out || ' | depart à la main: ' || sqlerrm; end;
  update public.offres set quantity = 8 where id = oid; select quantite_depart::text into e from public.offres where id = oid; out := out || ' | baisse 8 → depart=' || e;
  r := public.boutique_activer(true); code := r->>'code';
  r := public.boutique_publique(code); out := out || ' | etat=' || (r->'catalogue'->0->>'etat');
  reset role;
  update public.offres set quantity = 100 where id = o1;
  perform set_config('request.jwt.claims', json_build_object('sub', acht, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.nego_ouvrir('offre', o1, 290, 80, 'a');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', acht2, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.nego_ouvrir('offre', o1, 290, 50, 'b');
  reset role;
  select id into n1 from public.negociations where cible_id = o1 and auteur_id = acht and statut = 'ouverte' order by created_at desc limit 1;
  select id into n2 from public.negociations where cible_id = o1 and auteur_id = acht2 and statut = 'ouverte' order by created_at desc limit 1;
  begin update public.negociations set statut = 'conclue', quantite_finale = 150, prix_final = 290, conclu_le = now() where id = n1; out := out || ' | accord 150 sur 100 PASSE (mauvais)'; exception when others then out := out || ' | accord 150: ' || sqlerrm; end;
  update public.negociations set statut = 'conclue', quantite_finale = 80, prix_final = 290, conclu_le = now() where id = n1;
  select json_build_object('q', quantity, 'depart', quantite_depart, 'status', status) into r from public.offres where id = o1; out := out || ' | après accord 80: ' || r::text;
  begin update public.negociations set statut = 'conclue', quantite_finale = 50, prix_final = 290, conclu_le = now() where id = n2; out := out || ' | 2e accord PASSE (mauvais)'; exception when others then out := out || ' | 2e accord 50: ' || sqlerrm; end;
  update public.offres set pause_le = now() where id = o1;
  out := out || ' | après pause, n2 statut=' || (select statut from public.negociations where id = n2);
  update public.negociations set statut = 'conclue', quantite_finale = 10, prix_final = 290, conclu_le = now() where id = n2;
  out := out || ' | accord 10 en pause: q=' || (select quantity::text from public.offres where id = o1);
  update public.offres set pause_le = null where id = o2;
  perform set_config('request.jwt.claims', json_build_object('sub', acht, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.nego_ouvrir('offre', o2, 190, 100, 'c');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  update public.offres set retiree_le = now() where id = o2;
  reset role;
  out := out || ' | o2 retirée: status=' || (select status from public.offres where id = o2) || ' ouvertes=' || (select count(*) from public.negociations where cible_id = o2 and statut = 'ouverte');
  update public.profils set supprime_le = now() where user_id = w;
  out := out || ' | compte supprimé: trouvee=' || (public.boutique_publique(code)->>'trouvee') || ' active=' || (select active::text from public.boutiques where user_id = w);
  raise exception 'TEST %', out;
end $$;

-- C
do $$
declare v uuid := 'efec4ce4-7ab1-4b93-9e90-020bd0007a8c'; acht uuid := 'bdc90230-b914-4d84-8939-94b058693af0';
  o1 uuid := '18935a58-5759-4fef-a9d9-44bb4276ea9a'; r json; kode text; out text := ''; i int; n1 uuid;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true); set local role authenticated;
  kode := public.boutique_activer(true)->>'code';
  reset role;
  update public.offres set quantity = 30 where id = o1;
  perform set_config('request.jwt.claims', json_build_object('sub', acht, 'role', 'authenticated')::text, true); set local role authenticated;
  perform public.nego_ouvrir('offre', o1, 290, 30, 'a');
  reset role;
  select id into n1 from public.negociations where cible_id = o1 and auteur_id = acht and statut = 'ouverte' order by created_at desc limit 1;
  update public.negociations set statut = 'conclue', quantite_finale = 30, prix_final = 290, conclu_le = now() where id = n1;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); set local role anon;
  r := public.boutique_publique(kode);
  out := out || 'etats=' || (select string_agg((x->>'produit') || ':' || (x->>'etat') || ':' || (x->>'quantite'), ',') from json_array_elements(r->'catalogue') x);
  out := out || ' | boutiques_de=' || (select count(*) from public.boutiques_de(array[v, acht]));
  out := out || ' | boutiques_publiques=' || (select string_agg((x->>'adresse') || '/' || (x->>'nom'), ',') from json_array_elements(public.boutiques_publiques()) x);
  for i in 1..45 loop perform public.boutique_mesurer(kode, 'produit', null, null, lpad(to_hex(i), 12, '0')); end loop;
  reset role;
  out := out || ' | passages gardés pour 45 essais=' || (select count(*) from public.boutique_passages p where p.code = kode and p.evenement = 'produit');
  raise exception 'TEST %', out;
end $$;
