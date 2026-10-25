-- U02 Sécurité : exercices SQL reproductibles (système de contrôle MGCI, 25/10/2026).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Jamais sur la production.
-- Chaque bloc crée ses données de simulation, vérifie, puis finit par raise exception 'TEST OK: …' ou 'TEST ECHEC: …' :
-- tout est annulé, rien ne reste en base. Lancer les outils ci-dessous dans le même appel que chaque bloc.
-- Comptes de simulation du projet de test : S = vendeur (Yamoussoukro), B = acheteur (Daloa), X et Y = membres tiers, ADM = administrateur.
-- Résultat obtenu le 25/10/2026 écrit sous chaque bloc ; tableau complet : CONTROLE_QUALITE/rapports/2026-10-25-controle-general.md (annexe : rapports/annexes/2026-10-25-securite.md).

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.anon() returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
create or replace function pg_temp.v(q text) returns text language plpgsql as $f$
declare v text; begin execute q into v; return coalesce(v, 'NULL'); exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;

-- SEC-01 (malveillant) : un tiers agit sur la commande d'un autre (lire, chargement, arrivée, réception, annulation, litige, clôture, preuves, avis…)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  c uuid; r text := ''; avant text; apres text; f text; ok int := 0; ko int := 0; bad boolean := false;
begin
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
  values ('CQ-SEC1', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'confirmee') returning id into c;
  insert into public.commande_etapes (commande_id, evenement, par, role, at) values (c, 'confirmee', S, 'vendeur', now() - interval '1 hour');
  avant := (select concat_ws('|', etat, etape, litige_par, libere_le, annulation_demandes, depart_defi, (select count(*) from public.commande_etapes where commande_id = c)) from public.commandes where id = c);
  perform pg_temp.qui(X);
  r := r || 'X lit la table commandes: ' || pg_temp.v(format('select count(*)::text from public.commandes where id = %L', c));
  r := r || ' | mes_commandes2 contient: ' || pg_temp.v(format('select count(*)::text from public.mes_commandes2() m where m.id = %L', c));
  r := r || ' | journal: ' || pg_temp.v(format('select count(*)::text from public.commande_journal(%L)', c));
  foreach f in array array[
    format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement'),
    format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'arrivee'),
    format('select public.commande_reception_mot(%L, %L, true, null, null, null)', c, 'x'),
    format('select public.commande_annuler_motif(%L, true, null, %L, null, false)', c, 'autre'),
    format('select public.commande_annuler_retard(%L, %L)', c, 'test'),
    format('select public.commande_litige(%L, %L)', c, 'Je veux bloquer'),
    format('select public.commande_liberer(%L)', c),
    format('select public.commande_depart_defi(%L)', c),
    format('select public.commande_depart_preuves(%L, %L, 10)', c, array[X || '/a.jpg', X || '/b.jpg']),
    format('select public.commande_refuser2(%L, 1, %L, null, null, true)', c, 'casse'),
    format('select public.litige_ecrire(%L, %L)', c, 'bonjour'),
    format('select public.litige_messages_lire(%L)', c),
    format('select public.commande_position(%L)', c),
    format('select public.suivi_lien_creer(%L)', c),
    format('select public.commande_code_obtenir(%L, %L)', c, 'reception'),
    format('select public.commande_sequestre(%L)', c),
    format('select public.commande_delais(%L)', c),
    format('select public.avis_commande_donner(%L, 1, %L)', c, 'nul'),
    format('select public.commande_repondre_motif(%L, false, null, %L, null)', c, 'stock_epuise')]
  loop
    apres := pg_temp.v(replace(f, 'select public.', 'select left(public.') || '::text, 80)');
    if apres like 'ERR%' then ko := ko + 1; elsif apres = 'NULL' then ok := ok + 1; else bad := true; r := r || ' | FUITE/ACTION: ' || left(f, 60) || ' -> ' || apres; end if;
  end loop;
  execute 'reset role';
  apres := (select concat_ws('|', etat, etape, litige_par, libere_le, annulation_demandes, depart_defi, (select count(*) from public.commande_etapes where commande_id = c)) from public.commandes where id = c);
  r := r || ' | actions refusées=' || ko || ' réponses vides (NULL)=' || ok || ' | état inchangé=' || (avant = apres) || ' (' || avant || ' -> ' || apres || ')';
  raise exception '%: %', case when bad or avant <> apres then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : table commandes refusée ; mes_commandes2=0 ; journal=0 ; 16 actions refusées ; 3 réponses vides (litige_messages_lire, commande_position, commande_sequestre) ; état inchangé.

-- SEC-02 (malveillant) : sans compte (anon) : fonctions sensibles fermées, chaque fonction ouverte appelée à vide, lecture de chaque table, numéro dans une annonce
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; f record; t record; q text; res text; r text := ''; nb_f int := 0; nb_err int := 0; nb_null int := 0; bad boolean := false;
  interdits text := ''; tables_lues text := ''; oid1 uuid := gen_random_uuid(); avant bigint; apres bigint;
begin
  -- a) aucune fonction sensible ne doit être exécutable sans compte
  select string_agg(p.proname, ',' order by p.proname) into interdits from pg_proc p
   where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute')
     and p.proname ~ '^(admin_|commande_|dm_(?!duree)|nego_|identite_(commencer|soumettre|retirer|statut)|mes_|transport_agir|chauffeur_|litige_|avis_commande|noter|signaler_membre|supprimer_compte|creer_secours|_niv_|_fiab_|est_banni|est_suspendu|identite_ok|groupe_(creer|rejoindre|quitter|lancer|valider|confirmer|annuler)|besoin_creer|push_|boutique_activer|ma_|niveaux_(moi|contester|vu))';
  if interdits is not null then bad := true; end if;
  r := r || 'a) fonctions sensibles ouvertes à anon: ' || coalesce(interdits, 'aucune');
  -- b) chaque fonction SECURITY DEFINER ouverte à anon, appelée sans compte avec des valeurs vides
  avant := (select count(*) from public.offres) + (select count(*) from public.demandes) + (select count(*) from public.profils) + (select count(*) from public.signalements);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  for f in select p.proname, (select string_agg('null::' || format_type(a, null), ', ') from unnest(p.proargtypes::oid[]) a) args, p.prorettype = 'trigger'::regtype trig
           from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1 loop
    continue when f.trig;
    nb_f := nb_f + 1;
    q := format('select left(x::text, 50) from public.%I(%s) x limit 1', f.proname, coalesce(f.args, ''));
    begin execute q into res; exception when others then res := 'ERR ' || left(sqlerrm, 50); end;
    if res like 'ERR%' then nb_err := nb_err + 1; elsif res is null or res in ('[]', '{}', 'null', '') then nb_null := nb_null + 1;
    else r := r || ' | ' || f.proname || '=' || res; end if;
  end loop;
  execute 'reset role';
  apres := (select count(*) from public.offres) + (select count(*) from public.demandes) + (select count(*) from public.profils) + (select count(*) from public.signalements);
  r := r || ' || b) ' || nb_f || ' fonctions anon appelées : ' || nb_err || ' erreurs, ' || nb_null || ' vides ; lignes créées=' || (apres - avant);
  -- c) lecture directe des tables sans compte
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  for t in select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1 loop
    begin execute format('select count(*)::text from public.%I', t.relname) into res; exception when others then res := 'refus'; end;
    if res <> 'refus' then tables_lues := tables_lues || t.relname || '=' || res || ' '; end if;
  end loop;
  execute 'reset role';
  r := r || ' || c) tables lisibles sans compte: ' || tables_lues;
  -- d) une annonce publiée avec un numéro : le numéro reste-t-il lisible sans compte ?
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC2');
  perform pg_temp.qui(S);
  r := r || ' || d) publication avec numéro: ' || pg_temp.e(format('insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, phone, seller_name) values (%L, %L, %L, %L, %L, %L, %L, 10, %L, 1000, %L, %L, %L)',
     oid1, S, 'cq-sec2', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active', '0701020304', 'Awa'));
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  r := r || ' ; anon lit phone=' || pg_temp.v(format('select coalesce(phone, ''vide'') || '' / nom='' || coalesce(seller_name, ''vide'') from public.offres where id = %L', oid1));
  execute 'reset role';
  if exists (select 1 from public.offres where id = oid1 and (phone is not null or seller_name like '%0701020304%' or seller_name = 'Awa' and phone is not null)) then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : aucune fonction sensible ouverte ; 46 fonctions anon : 2 erreurs, 25 vides, 0 ligne créée ; tables lisibles : offres, demandes (actives), notif_categories, villes_ref=0, zones=0 ;
-- numéro dans phone vidé, nom remplacé par celui du compte ; numéro dans seller_name refusé (TEXTE_REFUSE). (1er passage : faux positif dm_duree, corrigé.)

-- SEC-03 (malveillant) : un membre lit les données privées d'un autre (RLS) ; l'acheteur et la photo du papier du mot secret
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  c uuid; d uuid; n uuid; tel text; r text := ''; bad boolean := false; v text; q text; k text;
  p_mot text := '1bfd5713-2525-44a6-8403-084ebb9ddad3/cq-motpapier.jpg'; p_dep text := '1bfd5713-2525-44a6-8403-084ebb9ddad3/cq-depart1.jpg';
begin
  -- données synthétiques : commande S->B avec photo du papier du mot secret, conversation privée S-B, dossier d'identité de S, téléphone de notification de S
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, lieu_livraison, depart_photos, depart_mot_photo)
  values ('CQ-SEC3', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'chargement', 'Quartier Commerce, porte bleue', array[p_dep, p_dep], p_mot) returning id into c;
  insert into storage.objects (bucket_id, name, owner) values ('preuves', p_mot, S), ('preuves', p_dep, S);
  insert into public.discussions (a_id, b_id) values (least(S, B), greatest(S, B)) on conflict (a_id, b_id) do update set a_id = excluded.a_id returning id into d;
  insert into public.dm (discussion_id, auteur_id, texte) values (d, S, 'CQ message privé');
  select id into n from public.negociations where X not in (auteur_id, proprio_id) limit 1;
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC3-PIECE');
  select regexp_replace(split_part(email, '@', 1), '^225', '') into tel from auth.users where id = S;
  perform pg_temp.qui(X);
  foreach q in array array[
    format('select count(*)::text from public.profils where user_id = %L', S),
    format('select count(*)::text from public.negociations where id = %L', n),
    format('select count(*)::text from public.messages where negociation_id = %L', n),
    format('select count(*)::text from public.dm where discussion_id = %L', d),
    format('select left(public.dm_messages(%L, null)::text, 60)', d),
    format('select count(*)::text from public.verifications where user_id = %L', S),
    'select count(*)::text from public.transporteurs',
    format('select count(*)::text from storage.objects where bucket_id = %L and name = %L', 'preuves', p_mot),
    format('select count(*)::text from storage.objects where bucket_id = %L and name = %L', 'preuves', p_dep),
    format('select public._preuve_refus_visible(%L)::text', p_mot),
    format('select count(*)::text from public.push_abonnements where user_id = %L', S),
    format('select count(*)::text from public.notif_journal where user_id = %L', S),
    format('select count(*)::text from public.alertes_produits where user_id = %L', S),
    'select count(*)::text from public.admin_journal',
    'select count(*)::text from public.admins',
    'select count(*)::text from public.alertes',
    'select count(*)::text from public.signalements',
    'select left(public.admin_discussions()::text, 40)',
    format('select left(public.admin_dm(%L)::text, 40)', d)]
  loop
    v := pg_temp.v(q);
    k := substr(q, 8, 70);
    if v not in ('0', 'NULL', 'false') and v not like 'ERR%' then bad := true; r := r || ' | FUITE ' || k || ' -> ' || v; else r := r || ' | ' || left(v, 40); end if;
  end loop;
  v := pg_temp.v(format('select public.profil_public(%L)::text', S));
  r := r || ' || profil_public(S) contient le numéro=' || (position(tel in v) > 0) || ' contient la pièce=' || (position('CQ-SEC3-PIECE' in v) > 0);
  if position(tel in v) > 0 or position('CQ-SEC3-PIECE' in v) > 0 then bad := true; end if;
  v := pg_temp.v(format('select public.reputation_publique(%L)::text', S)) || pg_temp.v(format('select public.avis_de2(%L)::text', S));
  r := r || ' reputation/avis contiennent le numéro=' || (position(tel in v) > 0);
  if position(tel in v) > 0 then bad := true; end if;
  -- l'acheteur lui-même voit les photos de départ, mais jamais la photo du papier du mot secret (équipe seulement)
  perform pg_temp.qui(B);
  v := pg_temp.v(format('select count(*)::text from storage.objects where bucket_id = %L and name = %L', 'preuves', p_mot));
  r := r || ' || B voit photo papier=' || v || ' photo départ=' || pg_temp.v(format('select count(*)::text from storage.objects where bucket_id = %L and name = %L', 'preuves', p_dep));
  if v <> '0' then bad := true; end if;
  r := r || ' mes_commandes2 donne depart_mot_photo=' || (position('cq-motpapier' in coalesce((select string_agg(m::text, ' ') from public.mes_commandes2() m), '')) > 0);
  if position('cq-motpapier' in coalesce((select string_agg(m::text, ' ') from public.mes_commandes2() m), '')) > 0 then bad := true; end if;
  execute 'reset role';
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : rien de lisible par X ; profil_public/réputation/avis sans numéro ni pièce ; B voit la photo de départ (1), pas la photo du papier (0).

-- SEC-04 (malveillant) : falsifier est_admin, identité vérifiée, badge, transporteur vérifié, réglages ; toutes les fonctions admin_* par un membre
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  r text := ''; bad boolean := false; v text; q text; f record; nb int := 0; nb_err int := 0; ouverts text := ''; idv uuid; j json; tr uuid;
begin
  perform pg_temp.qui(X);
  -- écritures directes dans les tables de confiance
  foreach q in array array[
    format('insert into public.admins (user_id) values (%L)', X),
    format('update public.profils set user_id = %L where user_id = %L', S, X),
    format('insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (%L, %L, %L, %L, now(), current_date + 365, %L)', X, 'verifie', 'cni', '1234', 'FAUX'),
    format('insert into public.niveaux_membres (user_id, role, niveau) values (%L, %L, %L)', X, 'vendeur', 'fiable'),
    format('update public.niveaux_membres set niveau = %L where user_id = %L', 'gros', X),
    format('update public.transporteurs set statut = %L where user_id = %L', 'verifie', X),
    format('insert into public.avis_commandes (commande_id, auteur_id, cible_id, role_cible, note) select id, %L, vendeur_id, %L, 5 from public.commandes limit 1', X, 'vendeur'),
    format('update public.sanctions set fin = now() where user_id = %L', X),
    format('insert into public.reglages (cle, valeur) values (%L, %L)', 'transport_reseau_ouvert', 'true'),
    format('select public._niv_appliquer(%L, %L)', X, 'vendeur'),
    format('select public._fiab_score(%L)', X),
    format('select public.identite_ok(%L)', X)]
  loop
    v := pg_temp.e(q);
    if v = 'ok' then bad := true; r := r || ' | ACCEPTE ' || left(q, 70); else nb_err := nb_err + 1; end if;
  end loop;
  r := r || 'écritures directes refusées=' || nb_err || '/12';
  -- un faux rôle dans le jeton ne donne rien
  perform set_config('request.jwt.claims', json_build_object('sub', X, 'role', 'service_role', 'app_metadata', json_build_object('role', 'admin'))::text, true);
  r := r || ' | jeton role=service_role : est_admin=' || pg_temp.v('select public.est_admin()::text') || ' admin_comptes=' || left(pg_temp.v('select left(public.admin_comptes()::text, 30)'), 40);
  if pg_temp.v('select public.est_admin()::text') <> 'false' then bad := true; end if;
  perform pg_temp.qui(X);
  -- toutes les fonctions admin_* ouvertes aux membres, appelées par un membre (valeurs vides)
  nb_err := 0;
  for f in select p.proname, (select string_agg('null::' || format_type(a, null), ', ') from unnest(p.proargtypes::oid[]) a) args
           from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'admin\_%' and has_function_privilege('authenticated', p.oid, 'execute') order by 1 loop
    nb := nb + 1;
    v := pg_temp.v(format('select left(x::text, 40) from public.%I(%s) x limit 1', f.proname, coalesce(f.args, '')));
    if v like 'ERR%' or (f.proname in ('admin_identite_compte', 'admin_structures_compte') and v = '0') then nb_err := nb_err + 1; else ouverts := ouverts || f.proname || '=' || v || ' '; end if;
  end loop;
  r := r || ' | fonctions admin_* : ' || nb || ' appelées, ' || nb_err || ' refusées ; sans refus : ' || coalesce(nullif(ouverts, ''), 'aucune');
  if ouverts <> '' then bad := true; end if;
  -- appels admin avec de vrais arguments
  foreach q in array array[
    format('select public.admin_suspendre(%L, %L, 30)', S, 'abus'),
    format('select public.admin_bannir(%L, %L, %L)', S, 'arnaque', 'x'),
    format('select public.admin_niveaux_regle_modifier(%L, %L, %L)', 'vendeur', 'fiable', '{"commandes": 0}'),
    format('select public.admin_fiabilite_regler(%L)', '{"suspension_jours": 0}'),
    format('select public.admin_diffuser(%L)', 'Message à tous'),
    'select public.notif_regles_regler(null)']
  loop
    v := pg_temp.e(q);
    if v = 'ok' then bad := true; r := r || ' | ACCEPTE ' || left(q, 70); end if;
  end loop;
  -- identité : un membre ne peut pas se déclarer vérifié en remplissant lui-même le dossier
  v := pg_temp.v(format('select public.identite_commencer(%L)::text', 'cni'));
  r := r || ' | identite_commencer=' || left(v, 60);
  begin idv := (v::json ->> 'id')::uuid; exception when others then idv := null; end;
  if idv is not null then
    r := r || ' soumettre(mrz_ok=true)=' || left(pg_temp.e(format('select public.identite_soumettre(%L, %L, %L, true, %L, %L, %L, false)', idv, 'Awa Kone', 'AWA KONE', current_date + 300, current_date + 300, 'CI0001112223')), 60);
  end if;
  execute 'reset role';
  r := r || ' statut dossier=' || coalesce((select string_agg(statut, ',') from public.verifications where user_id = X), 'aucun') || ' identite_ok=' || public.identite_ok(X);
  if public.identite_ok(X) then bad := true; end if;
  r := r || ' | est_admin(X) en base=' || exists (select 1 from public.admins where user_id = X) || ' niveaux X=' || coalesce((select string_agg(role || ':' || coalesce(niveau, '-'), ',') from public.niveaux_membres where user_id = X), 'aucun');
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : 12/12 écritures refusées ; jeton service_role -> est_admin=false ; 61 admin_* : 59 refusées + 2 compteurs à 0 (voulu) ; identité reste brouillon.

-- SEC-05 (malveillant/limite) : contourner une restriction (suspendu, banni, quota non vérifié, faux transporteur, transporteur non vérifié)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  r text := ''; bad boolean := false; v text; o_s uuid := gen_random_uuid(); o_old uuid := gen_random_uuid(); m uuid; c uuid; trx uuid; tro uuid; ins text;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC5');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o_s, S, 'cq-sec5-s', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  ins := 'insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 5, %L, 1000, %L)';
  -- a) compte suspendu
  insert into public.sanctions (user_id, type, debut, fin, motif) values (X, 'suspension', now() - interval '1 hour', now() + interval '7 days', 'CQ test');
  perform pg_temp.qui(X);
  v := pg_temp.e(format(ins, X, 'cq-sec5-a', 'riz', 'Riz', 'abidjan', 'Abidjan', 'sac', 'active'));
  r := r || 'a) suspendu publie: ' || left(v, 50); if v = 'ok' then bad := true; end if;
  v := pg_temp.e(format('select public.nego_ouvrir(%L, %L, 19000, 10, %L)', 'offre', o_s, 'bonjour'));
  r := r || ' ; suspendu négocie: ' || left(v, 50); if v = 'ok' then bad := true; end if;
  execute 'reset role';
  update public.sanctions set levee_le = now() where user_id = X and motif = 'CQ test';
  -- b) compte banni
  insert into public.bannis (user_id, motif, detail) values (Y, 'autre', 'CQ test');
  perform pg_temp.qui(Y);
  v := pg_temp.e(format(ins, Y, 'cq-sec5-b', 'riz', 'Riz', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active'));
  r := r || ' | b) banni publie: ' || left(v, 40); if v = 'ok' then bad := true; end if;
  v := pg_temp.e(format('select public.nego_ouvrir(%L, %L, 19000, 10, %L)', 'offre', o_s, 'bonjour'));
  r := r || ' ; banni négocie: ' || left(v, 40); if v = 'ok' then bad := true; end if;
  v := pg_temp.e(format('select public.dm_ouvrir(%L)', S));
  r := r || ' ; banni ouvre une conversation: ' || left(v, 40);
  execute 'reset role';
  -- c) non vérifié : 3 annonces gratuites utilisées
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o_old, X, 'cq-sec5-ancienne', 'riz', 'Riz', 'abidjan', 'Abidjan', 5, 'sac', 1000, 'retiree');
  insert into public.annonces_publiees (user_id, n) values (X, 3) on conflict (user_id) do update set n = 3;
  perform pg_temp.qui(X);
  v := pg_temp.e(format(ins, X, 'cq-sec5-c', 'igname', 'Igname', 'abidjan', 'Abidjan', 'sac', 'active'));
  r := r || ' | c) 4e annonce non vérifié: ' || left(v, 45); if v = 'ok' then bad := true; end if;
  v := pg_temp.e(format('update public.offres set product_slug = %L, product_label = %L, quantity = 50, quantite_vue = 50, price = 9000, status = %L where id = %L', 'igname', 'Igname', 'active', o_old));
  r := r || ' ; ancienne annonce retirée transformée (autre produit) et remise en ligne: ' || left(v, 45);
  execute 'reset role';
  r := r || ' -> ' || (select product_slug || '/' || status || '/q=' || quantity from public.offres where id = o_old) || ' compteur=' || (select n from public.annonces_publiees where user_id = X);
  if (select status from public.offres where id = o_old) = 'active' then bad := true; r := r || ' [CONTOURNEMENT DU QUOTA]'; end if;
  -- d) un membre qui n'est pas le transporteur d'une mission
  select m2.id, m2.commande_id into m, c from public.transport_missions m2 join public.transporteurs t on t.id = m2.transporteur_id where t.user_id <> X and m2.statut in ('proposee', 'acceptee') limit 1;
  perform pg_temp.qui(X);
  r := r || ' | d) mission ' || coalesce(left(m::text, 8), 'aucune') || ' : chauffeur_repondre2=' || left(pg_temp.e(format('select public.chauffeur_repondre2(%L, true, 50000, null)', m)), 30)
     || ' chauffeur_prix=' || left(pg_temp.e(format('select public.chauffeur_prix(%L, 50000)', m)), 30)
     || ' transport_agir=' || left(pg_temp.e(format('select public.transport_agir(%L, %L, 50000, null)', m, 'prix')), 30)
     || ' chauffeur_position=' || left(pg_temp.e(format('select public.chauffeur_position(%L, 5.3, -4.0, 10)', c)), 30)
     || ' chauffeur_missions=' || pg_temp.v('select count(*)::text from json_array_elements(public.chauffeur_missions()::json)');
  -- e) transporteur inscrit mais pas vérifié : il ne peut ni se rendre disponible, ni proposer un prix réseau
  v := pg_temp.v(format('select public.transporteur_inscrire(%L, %L, %L, 1000, %L)::text', 'Transport X', 'camion', 'AB 123 CD', '{abidjan}'));
  r := r || ' | e) inscription=' || left(v, 45) || ' disponible=' || left(pg_temp.e('select public.transporteur_disponible(true)'), 50);
  execute 'reset role';
  select id into trx from public.transporteurs where user_id = X;
  -- le réseau est fermé : on l'ouvre le temps du test (annulé avec le reste) pour atteindre le contrôle « transporteur vérifié »
  insert into public.reglages (cle, valeur) values ('transport_reseau_ouvert', 'true'::jsonb) on conflict (cle) do update set valeur = 'true'::jsonb;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-SEC5', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'reseau', 'en_cours', 'confirmee') returning id into c;
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut) values (c, trx, S, 'admin', 'proposee') returning id into m;
  perform pg_temp.qui(X);
  v := pg_temp.e(format('select public.transport_agir(%L, %L, 30000, null)', m, 'prix'));
  r := r || ' ; non vérifié propose un prix réseau: ' || left(v, 70);
  if v = 'ok' then bad := true; end if;
  execute 'reset role';
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST ECHEC : tout est refusé SAUF : une annonce retirée d'un non vérifié (quota épuisé) changée de produit puis remise en ligne -> acceptée (contournement du quota de 3 annonces gratuites).

-- SEC-06 (malveillant) : injection SQL et HTML/script dans les champs texte
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid := gen_random_uuid(); n uuid; d uuid; c uuid; r text := ''; bad boolean := false; v text; nadm_avant int; nadm_apres int; t text;
  t_sql text := $t$x'); update public.admins set user_id = user_id where true; select ('$t$;
  t_sql2 text := $t$1; select pg_sleep(0) --$t$;
  t_js text := '<script>alert(1)</script>';
  t_img text := '<img src=x onerror=alert(1)>';
begin
  nadm_avant := (select count(*) from public.admins);
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC6');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o, S, 'cq-sec6', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B);
  v := pg_temp.v(format('select public.nego_ouvrir(%L, %L, 19000, 10, %L)::text', 'offre', o, t_sql)); r := r || 'nego texte SQL: ' || left(v, 40);
  begin n := v::uuid; exception when others then n := null; end;
  if n is not null then
    r := r || ' ; nego_agir texte script: ' || left(pg_temp.e(format('select public.nego_agir(%L, %L, 19500, 10, %L, null)', n, 'prix', t_js)), 50);
  end if;
  d := pg_temp.v(format('select public.dm_ouvrir(%L)::text', S))::uuid;
  r := r || ' | dm script: ' || left(pg_temp.e(format('select public.dm_envoyer(%L, %L, %L)', d, t_js, 'cq-sec6')), 50);
  r := r || ' | dm SQL: ' || left(pg_temp.e(format('select public.dm_envoyer(%L, %L, %L)', d, t_sql2, 'cq-sec6b')), 50);
  r := r || ' | bio img: ' || left(pg_temp.e(format('update public.profils set bio = %L where user_id = %L', t_img, B)), 50);
  r := r || ' | pseudo script: ' || left(pg_temp.e(format('update public.profils set pseudo = %L where user_id = %L', t_js, B)), 50);
  r := r || ' | signaler_membre détail img: ' || left(pg_temp.e(format('select public.signaler_membre(%L, %L, %L, %L, null, null, true)', S, 'arnaque', t_img, 'profil')), 50);
  r := r || ' | demande détail script: ' || left(pg_temp.e(format('insert into public.demandes (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, status, exigences) values (%L, %L, %L, %L, %L, %L, 5, %L, 1000, %L, %L)', B, 'cq-sec6', 'mais', t_js, 'daloa', 'Daloa', 'sac', 'active', t_img)), 50);
  execute 'reset role';
  nadm_apres := (select count(*) from public.admins);
  r := r || ' || admins avant/après=' || nadm_avant || '/' || nadm_apres;
  if nadm_avant <> nadm_apres then bad := true; end if;
  select string_agg(left(x, 45), ' ¦ ') into t from (
    select texte x from public.messages where negociation_id = n
    union all select texte from public.dm where discussion_id = d and texte in (t_js, t_sql2)
    union all select bio from public.profils where user_id = B
    union all select product_label || ' / ' || coalesce(exigences, '') from public.demandes where user_id = B and client_id = 'cq-sec6') z;
  r := r || ' || stocké tel quel: ' || coalesce(t, 'rien');
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : aucun SQL exécuté ; <script> et <img onerror> stockés bruts (dm, négociation, bio, signalement) ; l'app les échappe à l'affichage (esc).

-- SEC-07 (malveillant) : abus : négocier sa propre offre, auto-avis, avis sur commande non terminée, double avis, signalements en masse
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  C uuid[] := array['3885adf0-e6af-4195-98be-f4a250aa359d', '1ebda56b-8e8b-40ac-8168-d117db9a939a', 'd353320a-68b5-4c05-83f9-b26b0b938a52']::uuid[];
  o uuid := gen_random_uuid(); cs uuid; ce uuid; ct uuid; r text := ''; bad boolean := false; v text; i int; nb_ok int := 0;
begin
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC7');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o, S, 'cq-sec7', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  -- a) négocier sa propre annonce
  perform pg_temp.qui(S);
  v := pg_temp.e(format('select public.nego_ouvrir(%L, %L, 19000, 10, null)', 'offre', o)); r := r || 'a) négocie sa propre offre: ' || left(v, 45);
  if v = 'ok' then bad := true; end if;
  -- b) auto-avis : commande où le vendeur est aussi l'acheteur (créée en base, la contrainte la laisse-t-elle passer ?)
  execute 'reset role';
  begin
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ-SEC7-SOI', S, S, S, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'terminee', 'terminee', now()) returning id into cs;
    r := r || ' | b) commande vendeur=acheteur acceptée par la base';
    perform pg_temp.qui(S);
    r := r || ' ; auto-avis: ' || left(pg_temp.e(format('select public.avis_commande_donner(%L, 5, %L)', cs, 'top')), 50);
    execute 'reset role';
    if exists (select 1 from public.avis_commandes where commande_id = cs) then bad := true; end if;
  exception when others then r := r || ' | b) commande vendeur=acheteur refusée par la base: ' || left(sqlerrm, 50); end;
  -- c) avis sur une commande non terminée, puis deux avis sur une commande terminée
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-SEC7-EC', S, B, B, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'en_cours', 'confirmee') returning id into ce;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ-SEC7-T', S, B, B, 'mais', 1, 'sac', 1000, 1000, 'vendeur', 'terminee', 'terminee', now()) returning id into ct;
  perform pg_temp.qui(B);
  v := pg_temp.e(format('select public.avis_commande_donner(%L, 1, %L)', ce, 'mauvais')); r := r || ' | c) avis commande en cours: ' || left(v, 45);
  if v = 'ok' then bad := true; end if;
  r := r || ' ; avis 1 terminée: ' || pg_temp.e(format('select public.avis_commande_donner(%L, 1, %L)', ct, 'mauvais'))
     || ' ; avis 2 même commande: ' || pg_temp.e(format('select public.avis_commande_donner(%L, 5, %L)', ct, 'finalement bien'));
  r := r || ' ; ancienne fonction noter: ' || left(pg_temp.e(format('select public.noter(%L, 5, %L)', S, 'x')), 40);
  execute 'reset role';
  r := r || ' ; avis en base pour ct=' || (select count(*) || ' note=' || max(note) from public.avis_commandes where commande_id = ct);
  if (select count(*) from public.avis_commandes where commande_id = ct) <> 1 then bad := true; end if;
  -- d) signalements en masse par des comptes neufs non vérifiés
  for i in 1..3 loop
    perform pg_temp.qui(C[i]);
    perform pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', o, 'arnaque'));
  end loop;
  perform pg_temp.qui(X);
  r := r || ' | d) X 1er signalement: ' || pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', o, 'arnaque'))
     || ' ; 2e: ' || left(pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', o, 'arnaque')), 50)
     || ' ; faux auteur: ' || left(pg_temp.e(format('insert into public.signalements (user_id, cible, cible_id, motif) values (%L, %L, %L, %L)', S, 'offre', gen_random_uuid(), 'x')), 50);
  for i in 1..22 loop
    if pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', gen_random_uuid(), 'masse')) = 'ok' then nb_ok := nb_ok + 1; end if;
  end loop;
  execute 'reset role';
  r := r || ' ; 22 de plus en 1 jour: acceptés=' || nb_ok || ' ; annonce après 4 signalements de comptes neufs: ' || (select status from public.offres where id = o);
  if (select status from public.offres where id = o) <> 'active' or nb_ok > 20 then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : tout refusé ; 1 avis par commande ; 20 signalements/jour au plus ; 4 comptes neufs ne masquent pas. Note : la table commandes accepte vendeur=acheteur.

-- SEC-08 (régression) : failles corrigées en octobre (schémas 66, 68, 71, 72, 73, 74, 78)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  r text := ''; bad boolean := false; v text; o uuid; i int; tel text; ess_avant int; ess_apres int; d uuid; res text := ''; j json;
begin
  select regexp_replace(split_part(email, '@', 1), '^225', '') into tel from auth.users where id = S;
  -- R1 (schéma 73) : date de publication non modifiable
  select id into o from public.offres where user_id = S and status = 'active' limit 1;
  perform pg_temp.qui(S);
  v := pg_temp.e(format('update public.offres set created_at = %L where id = %L', '2020-01-01', o)); r := r || 'R1 date: ' || left(v, 40);
  if v = 'ok' then bad := true; end if;
  -- R2 (schéma 74) : photos de profil = seulement le stockage du membre
  v := pg_temp.e(format('update public.profils set photos = %L where user_id = %L', array['https://pisteur.example/x.jpg', '//cdn.example/y.jpg', B || '/z.jpg', '../../a.jpg', S || '/ok.jpg'], S));
  execute 'reset role';
  r := r || ' | R2 photos: ' || v || ' gardées=' || coalesce((select array_to_string(photos, ',') from public.profils where user_id = S), 'aucune');
  if exists (select 1 from public.profils where user_id = S and array_to_string(photos, ',') ~ '(https?:|//|\.\.|68345d7a)') then bad := true; end if;
  -- R3 (schéma 66) : signalement avec un faux auteur
  perform pg_temp.qui(B);
  v := pg_temp.e(format('insert into public.signalements (user_id, cible, cible_id, motif) values (%L, %L, %L, %L)', S, 'offre', o, 'x')); r := r || ' | R3 faux auteur: ' || left(v, 40);
  if v = 'ok' then bad := true; end if;
  execute 'reset role';
  -- R4 (schéma 78) : heure de dernière activité cachée sans compte
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon';
  j := public.profil_public(S);
  r := r || ' | R4 anon vu_le=' || coalesce(j ->> 'vu_le', 'vide') || ' actif_le=' || coalesce((select actif_le::text from public.statuts_publics(array[S])), 'vide');
  if j ->> 'vu_le' is not null or (select actif_le from public.statuts_publics(array[S])) is not null then bad := true; end if;
  -- R5 (schéma 71) : 10 codes de suivi faux par adresse et par quart d'heure
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.77"}', true);
  for i in 1..11 loop
    v := pg_temp.e(format('select public.suivi_code_jeton(%L)', 'ZZZZ' || i));
    if i in (1, 10, 11) then res := res || i || ':' || left(v, 35) || ' '; end if;
  end loop;
  r := r || ' | R5 codes de suivi: ' || res;
  if res not like '%11:ERR TROP_ESSAIS%' then bad := true; end if;
  -- R6 (schéma 72) : code de secours, les échecs sont enfin comptés
  execute 'reset role';
  ess_avant := (select count(*) from public.secours_essais);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon';
  perform set_config('request.headers', '{"x-forwarded-for":"198.51.100.78"}', true);
  res := '';
  for i in 1..6 loop
    v := pg_temp.v(format('select coalesce(public.secours_reinitialiser(%L, %L, %L), %L)', tel, 'FAUX-' || i, '135792', 'vide'));
    res := res || i || ':' || left(v, 30) || ' ';
  end loop;
  r := r || ' | R6 secours (anon): ' || res || ' ; reinitialiser_code ouverte à anon=' || has_function_privilege('anon', 'public.reinitialiser_code(text,text,text)', 'execute')
     || ' à authenticated=' || has_function_privilege('authenticated', 'public.reinitialiser_code(text,text,text)', 'execute');
  execute 'reset role';
  ess_apres := (select count(*) from public.secours_essais);
  r := r || ' échecs notés=' || (ess_apres - ess_avant);
  if (ess_apres - ess_avant) < 5 then bad := true; end if;
  -- R7 (schéma 68) : message privé avec un numéro : numéro masqué, alerte à l'équipe, pas de plantage
  perform pg_temp.qui(B);
  d := pg_temp.v(format('select public.dm_ouvrir(%L)::text', S))::uuid;
  v := pg_temp.e(format('select public.dm_envoyer(%L, %L, %L)', d, 'Appelle moi au 07 01 02 03 04', 'cq-sec8'));
  execute 'reset role';
  r := r || ' | R7 dm avec numéro: ' || left(v, 40) || ' stocké=' || coalesce((select string_agg(texte, ',') from public.dm where discussion_id = d and texte like 'Appelle moi%'), 'rien');
  if exists (select 1 from public.dm where discussion_id = d and texte like '%07 01 02 03 04%') then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : les 7 failles restent corrigées.

-- SEC-09 (panne + concurrence dans une transaction) : exception au milieu d'une fonction, double litige, double clôture, double commande
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  c uuid; c2 uuid; r text := ''; bad boolean := false; v text; av text; ap text; o uuid := gen_random_uuid(); n uuid; k1 text; k2 text;
begin
  -- panne au milieu : commande_avancer('chargement') sans preuves → le déclencheur des étapes lève DEPART_PREUVES après les contrôles de la fonction
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-SEC9', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'confirmee') returning id into c;
  av := (select concat_ws('|', etat, etape, updated_at, (select count(*) from public.commande_etapes where commande_id = c), (select count(*) from public.commande_alertes where commande_id = c)) from public.commandes where id = c);
  perform pg_temp.qui(S);
  v := pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement'));
  execute 'reset role';
  ap := (select concat_ws('|', etat, etape, updated_at, (select count(*) from public.commande_etapes where commande_id = c), (select count(*) from public.commande_alertes where commande_id = c)) from public.commandes where id = c);
  r := r || 'P1 chargement sans preuves: ' || left(v, 40) || ' ; rien à moitié=' || (av = ap);
  if av <> ap then bad := true; end if;
  -- panne au milieu : preuves de départ avec une photo valable et une absente du stockage
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', S || '/cq-sec9-a.jpg', S, now() + interval '1 second');
  insert into public.commande_etapes (commande_id, evenement, par, role, at) values (c, 'confirmee', S, 'vendeur', now() - interval '1 hour');
  perform pg_temp.qui(S);
  v := pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c, array[S || '/cq-sec9-a.jpg', S || '/cq-sec9-absente.jpg']));
  execute 'reset role';
  r := r || ' | P2 preuves dont une absente: ' || left(v, 50) || ' ; photos en base=' || coalesce((select array_to_string(depart_photos, ',') from public.commandes where id = c), 'aucune')
     || ' poids=' || coalesce((select depart_poids_kg::text from public.commandes where id = c), 'aucun');
  if (select depart_photos is not null or depart_poids_kg is not null from public.commandes where id = c) then bad := true; end if;
  -- idempotence (une seule connexion) : litige deux fois, clôture deux fois
  perform pg_temp.qui(B);
  r := r || ' | C1 litige 1: ' || pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'Sacs abîmés'))
     || ' ; litige 2: ' || left(pg_temp.e(format('select public.commande_litige(%L, %L)', c, 'Encore')), 50);
  execute 'reset role';
  r := r || ' ; événements litige=' || (select count(*) from public.commande_etapes where commande_id = c and evenement = 'litige');
  if (select count(*) from public.commande_etapes where commande_id = c and evenement = 'litige') <> 1 then bad := true; end if;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ-SEC9-T', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'terminee', 'terminee', now()) returning id into c2;
  perform pg_temp.qui(B);
  r := r || ' | C2 clôture 1: ' || pg_temp.e(format('select public.commande_liberer(%L)', c2)) || ' ; clôture 2: ' || left(pg_temp.e(format('select public.commande_liberer(%L)', c2)), 40);
  execute 'reset role';
  r := r || ' ; journal liberee=' || (select count(*) from public.sequestre_journal where commande_id = c2 and evenement = 'liberee');
  if (select count(*) from public.sequestre_journal where commande_id = c2 and evenement = 'liberee') <> 1 then bad := true; end if;
  -- idempotence : une négociation conclue ne donne qu'une commande
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-SEC9');
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o, S, 'cq-sec9', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'sac', 20000, 'active');
  perform pg_temp.qui(B); n := public.nego_ouvrir('offre', o, 20000, 10, null);
  perform pg_temp.qui(S); perform public.nego_agir(n, 'accord', null, null, null, pg_temp.v(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  perform pg_temp.qui(B);
  k1 := pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
  k2 := pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
  execute 'reset role';
  r := r || ' | C3 commande 1: ' || left(k1, 40) || ' ; commande 2 même accord: ' || left(k2, 50) || ' ; commandes pour cet accord=' || (select count(*) from public.commandes where negociation_id = n);
  if (select count(*) from public.commandes where negociation_id = n) > 1 then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : rien à moitié ; idempotence tenue. Vraie concurrence à deux connexions : en attente (impossible via le MCP).

-- SEC-10 (concurrent) : deux connexions simultanées (ex. deux clics « Confirmer la réception » au même instant, deux admins sur le même litige).
-- EN ATTENTE : deux connexions simultanées (impossible via le MCP, qui joue une transaction à la fois). Ce qui est vérifié à la place : SEC-09, ADM-03, BDD-05.

-- SEC-11 (statique, lecture seule) : droits trop larges et fonctions SECURITY DEFINER. Rien n'est écrit.
select c.relname,
  (select a::text from unnest(c.relacl) a where a::text like 'anon=%') droits_anon,
  (select a::text from unnest(c.relacl) a where a::text like 'authenticated=%') droits_membres
from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  and exists (select 1 from unnest(c.relacl) a where a::text ~ '^(anon|authenticated)=[a-zA-Z]*[DxtwT]');
select p.proname, p.prosecdef, p.proconfig, has_function_privilege('anon', p.oid, 'execute') anon, has_function_privilege('authenticated', p.oid, 'execute') membres
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and ((p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%')))
       or (p.proname like '\_%' and has_function_privilege('anon', p.oid, 'execute') and p.prosecdef));
-- Résultat (25/10/2026, TEST) : villes_ref : anon et authenticated ont arwdDxtm (tous les droits, dont « D » = vider la table, qui ignore la RLS) ;
-- aucune fonction SECURITY DEFINER sans search_path ; anon exécute _cmd_chargement_preuves (déclencheur, inutilisable seul) et _transport_reseau_ouvert (lecture d'un réglage public).
-- get_advisors (TEST et PROD, lecture seule) : 63 tables RLS sans règle (accès par fonctions seulement, voulu) ; 48 fonctions SECURITY DEFINER ouvertes à anon, 238 aux membres ;
-- search_path modifiable : 10 en test (dont 7 du schéma _sim de simulation, negocier, proposer_prix, _notif_rang), 1 en prod (_notif_rang) ; protection « mots de passe compromis » désactivée (TEST et PROD).
