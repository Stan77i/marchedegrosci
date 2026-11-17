-- Scénarios du schéma 104 : demandes de produit (projet de TEST seulement). Tout est annulé par la dernière exception : rien ne reste.
-- Comptes du projet de test : membres ca27004f… et 657e5590…, administrateur 981961d4….
-- Résultat attendu (joué le 17/11/2026) :
-- TEST LIMITE:PRODUIT_LIMITE NUM:TEXTE_REFUSE ADMLIST:refus ADMREF:refus TABLE:refus TROUVE:1/moi=false MOIAUSSI:true/2/true MESB:1
--   ADM:72h n=3 vide=zaban:2 MOTIF:MOTIF ACC:gombo-seche/prev=2 FUS:existant/prev=1 REF:refuse DEUX:DEMANDE_FERMEE JOURNAL:3 NOTIF:4
--   [produit_ajoute>application.dc.html#/publier?produit=gombo-seche, produit_existant>…?produit=soumbala, produit_refuse>application.dc.html#/]
--   AJOUTES:[gombo-seche (produit, alias gnangnan sec, gombo sec), soumbala (alias, Néré)]
do $$
declare a uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; b uuid := '657e5590-29cb-42dc-a512-ae0baa98c968'; adm uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r json; d1 uuid; d2 uuid; d3 uuid; out text := ''; nj int; nn int; x json; y text;
begin
  -- deux abonnements push fictifs (annulés à la fin) pour que les avis entrent dans la file
  insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values ('https://test.example/aaaaaaaaaa', a, repeat('x', 30), repeat('x', 12)), ('https://test.example/bbbbbbbbbb', b, repeat('x', 30), repeat('x', 12));
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  -- 1. trois demandes en attente au plus
  r := public.produit_demander('Gombo séché', 'legumes-et-fruits', 'sac', 'gnangnan sec'); d1 := (r->>'id')::uuid;
  r := public.produit_demander('Néré', 'assaisonnements-epices-condiments'); d2 := (r->>'id')::uuid;
  r := public.produit_demander('Attiéké sec', 'tubercules-et-feculents'); d3 := (r->>'id')::uuid;
  begin perform public.produit_demander('Karité brut', 'arachide-noix-et-oleagineux'); out := out || 'LIMITE:KO '; exception when others then out := out || 'LIMITE:' || split_part(sqlerrm, ' ', 1) || ' '; end;
  -- 2. un numéro dans le nom est refusé
  begin perform public.produit_demander('Tomate 0701020304', 'legumes-et-fruits'); out := out || 'NUM:KO '; exception when others then out := out || 'NUM:' || split_part(sqlerrm, ' ', 1) || ' '; end;
  -- 3. un membre n'a pas accès aux fonctions de l'équipe ni aux tables
  begin perform public.admin_produits_demandes(); out := out || 'ADMLIST:KO '; exception when others then out := out || 'ADMLIST:refus '; end;
  begin perform public.admin_produit_refuser(d2, 'test test'); out := out || 'ADMREF:KO '; exception when others then out := out || 'ADMREF:refus '; end;
  begin perform 1 from public.produits_demandes; out := out || 'TABLE:KO '; exception when others then out := out || 'TABLE:refus '; end;
  -- 4. « Moi aussi » : même nom normalisé (majuscules, accents, espaces), pas de doublon
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  x := public.produit_demande_trouver('gombo  SECHE'); out := out || 'TROUVE:' || coalesce(x->>'soutiens','null') || '/moi=' || (x->>'moi') || ' ';
  r := public.produit_demander('GOMBO seche', 'legumes-et-fruits'); out := out || 'MOIAUSSI:' || (r->>'moi_aussi') || '/' || (r->>'soutiens') || '/' || ((r->>'id')::uuid = d1) || ' ';
  x := public.mes_produits_demandes(); out := out || 'MESB:' || json_array_length(x) || ' ';
  -- 5. mots cherchés sans résultat : chiffres et unités retirés
  perform public.recherche_vide('Zaban 25 kg'); perform public.recherche_vide('zabán');
  -- 6. l'équipe : liste, motif obligatoire, accepter, rattacher, refuser, pas deux réponses
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  x := public.admin_produits_demandes(); out := out || 'ADM:' || (x->>'reponse_heures') || 'h n=' || json_array_length(x->'demandes') || ' vide=' || (x->'vides'->0->>'mot') || ':' || (x->'vides'->0->>'n') || ' ';
  begin perform public.admin_produit_accepter(d1, null, 'Gombo séché', 'legumes-et-fruits', 'sac', array['gombo sec'], ''); out := out || 'MOTIF:KO '; exception when others then out := out || 'MOTIF:' || split_part(sqlerrm, ' ', 1) || ' '; end;
  r := public.admin_produit_accepter(d1, null, 'Gombo séché', 'legumes-et-fruits', 'sac', array['gombo sec'], 'Produit courant'); out := out || 'ACC:' || (r->>'slug') || '/prev=' || (r->>'prevenus') || ' ';
  r := public.admin_produit_fusionner(d2, 'soumbala', 'Le néré est le soumbala'); out := out || 'FUS:' || (r->>'statut') || '/prev=' || (r->>'prevenus') || ' ';
  r := public.admin_produit_refuser(d3, 'Déjà dans la liste : attiéké'); out := out || 'REF:' || (r->>'statut') || ' ';
  begin perform public.admin_produit_refuser(d3, 'encore'); out := out || 'DEUX:KO '; exception when others then out := out || 'DEUX:' || split_part(sqlerrm, ' ', 1) || ' '; end;
  reset role;
  -- 7. journal de l'équipe et avis (file des notifications)
  select count(*) into nj from public.admin_journal where action like 'admin_produit_%' and at > now() - interval '1 minute';
  select count(*), string_agg(distinct type || '>' || url, ', ') into nn, y from public.notif_file where cat = 'produits' and regroupe in ('prod:' || d1, 'prod:' || d2, 'prod:' || d3);
  out := out || 'JOURNAL:' || nj || ' NOTIF:' || nn || ' [' || coalesce(y,'') || '] ';
  select json_agg(json_build_object('s', slug, 't', type, 'a', alias)) into x from public.produits_ajoutes;
  out := out || 'AJOUTES:' || x::text;
  raise exception 'TEST %', out;
end $$;
