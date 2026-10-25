-- Tests des corrections du contrôle qualité, équipe B2 (schémas 100a à 100f, 25/10/2026). Projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- ANO-014 quota d'annonces, ANO-015 profil vidé à la suppression, ANO-016/017/021 journal de l'équipe,
-- ANO-018 conflit d'intérêts, ANO-020 avis d'une commande annulée, ANO-037/038 droits et search_path.
-- Chaque bloc finit par raise exception 'TEST OK: …' ou 'TEST ECHEC: …' : tout est annulé, rien ne reste dans la base.
-- Comptes de simulation du projet de test : S vendeur, B acheteur, X, Y, Z membres, ADM administrateur (aucune donnée réelle).
-- Les blocs se lancent avec les outils ci-dessous dans le même appel (ou tous ensemble avec un lanceur qui rattrape chaque bloc).

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 110); end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.en(u uuid, q text) returns text language plpgsql as $f$
begin perform pg_temp.qui(u); execute q; execute 'reset role'; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 110); end $f$;

-- C100-1 (ANO-014) : quota de 3 annonces gratuites : changer le produit d'une annonce compte comme une nouvelle annonce
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  r text := ''; bad boolean := false; v text; o1 uuid := gen_random_uuid(); o2 uuid := gen_random_uuid(); o3 uuid := gen_random_uuid(); n0 int;
  ins text := 'insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, %L, 5, %L, 1000, %L)';
  maj text := 'update public.offres set product_slug = %L, product_label = %L, quantity = 50, quantite_vue = 50, price = 9000, status = %L where id = %L';
begin
  insert into public.annonces_publiees (user_id, n) values (X, 0) on conflict (user_id) do update set n = 0;
  execute format(ins, o1, X, 'cq100-1a', 'riz', 'Riz', 'abidjan', 'Abidjan', 'sac', 'retiree');
  execute format(ins, o2, X, 'cq100-1b', 'riz', 'Riz', 'abidjan', 'Abidjan', 'sac', 'retiree');
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-C100-1');
  execute format(ins, o3, S, 'cq100-1c', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'sac', 'active');
  -- a) non vérifié, 3 annonces déjà publiées : annonce retirée changée de produit puis remise en ligne
  insert into public.annonces_publiees (user_id, n) values (X, 3) on conflict (user_id) do update set n = 3;
  v := pg_temp.en(X, format(maj, 'igname', 'Igname', 'active', o1));
  r := r || 'a) quota épuisé, autre produit + remise en ligne: ' || left(v, 70) || ' -> ' || (select product_slug || '/' || status from public.offres where id = o1);
  if (select status from public.offres where id = o1) = 'active' then bad := true; r := r || ' [CONTOURNEMENT]'; end if;
  -- b) même produit remis en ligne : pas une nouvelle annonce, accepté, compteur inchangé
  v := pg_temp.en(X, format('update public.offres set status = %L, quantity = 5, quantite_vue = 5 where id = %L', 'active', o1));
  r := r || ' | b) même produit remis en ligne: ' || left(v, 50) || ' compteur=' || (select n from public.annonces_publiees where user_id = X);
  if v <> 'ok' or (select n from public.annonces_publiees where user_id = X) <> 3 then bad := true; end if;
  -- c) non vérifié, 1 annonce publiée : changer de produit est permis et compte (compteur 1 -> 2)
  update public.annonces_publiees set n = 1 where user_id = X;
  v := pg_temp.en(X, format(maj, 'igname', 'Igname', 'retiree', o2));
  r := r || ' | c) quota non épuisé, autre produit: ' || left(v, 50) || ' compteur=' || (select n from public.annonces_publiees where user_id = X);
  if v <> 'ok' or (select n from public.annonces_publiees where user_id = X) <> 2 then bad := true; end if;
  -- d) membre vérifié : changer de produit ne touche pas au compteur
  n0 := coalesce((select n from public.annonces_publiees where user_id = S), 0);
  v := pg_temp.en(S, format(maj, 'riz', 'Riz', 'active', o3));
  r := r || ' | d) vérifié, autre produit: ' || left(v, 50) || ' compteur inchangé=' || (coalesce((select n from public.annonces_publiees where user_id = S), 0) = n0);
  if v <> 'ok' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100a (25/10/2026) : le bloc échouait déjà à l'insertion (VERIFICATION_REQUISE, compteur de X plein) ; SEC-05 c : autre produit + remise en ligne ACCEPTÉ, compteur resté à 3.
-- APRÈS 100a (25/10/2026) : TEST OK : a) « VERIFICATION_REQUISE : changer de produit compte comme une nouvelle annonce… » (annonce restée riz/retiree) ;
-- b) même produit remis en ligne : ok, compteur 3 ; c) quota non épuisé : ok, compteur 1 -> 2 ; d) vérifié : ok, compteur inchangé.

-- C100-2 (ANO-015) : suppression du compte : présentation, activités, photos et structure vidées
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; r text := ''; bad boolean := false; v text; p public.profils;
begin
  update public.profils set bio = 'Ma vie, ma boutique', activites = 'Maïs, riz', photos = array['ca27004f/cq100.jpg'], structure_type = 'entreprise',
    structure_nom = 'Ets CQ 100', structure_logo = 'ca27004f/logo.png', structure_preuves = array['ca27004f/preuve.jpg'] where user_id = X;
  v := pg_temp.en(X, 'select public.supprimer_compte()');
  select * into p from public.profils where user_id = X;
  r := r || 'supprimer_compte: ' || left(v, 70) || ' | supprime_le=' || (p.supprime_le is not null)
     || ' bio=' || coalesce(p.bio, 'vide') || ' activites=' || coalesce(p.activites, 'vide') || ' photos=' || coalesce(p.photos::text, 'vide')
     || ' structure=' || coalesce(p.structure_type || '/' || p.structure_nom, 'vide') || ' logo=' || coalesce(p.structure_logo, 'vide') || ' preuves=' || coalesce(p.structure_preuves::text, 'vide');
  if v <> 'ok' or coalesce(p.bio, p.activites, p.structure_type, p.structure_nom, p.structure_logo) is not null
     or coalesce(cardinality(p.photos), 0) > 0 or coalesce(cardinality(p.structure_preuves), 0) > 0 then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100b (25/10/2026) : TEST ECHEC : supprimer_compte ok mais bio, activités, structure (type et nom) gardées.
-- APRÈS 100b (25/10/2026) : TEST OK : supprime_le rempli ; bio, activités, structure, logo vides ; photos et preuves = {}.

-- C100-3 (ANO-016, ANO-017, ANO-021) : chaque geste sensible de l'équipe écrit une ligne dans admin_journal
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; Z uuid := 'd353320a-68b5-4c05-83f9-b26b0b938a52'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; bad boolean := false; v text; aj int; vid uuid; c uuid; j jsonb;
begin
  -- a) suspendre
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_suspendre(%L, %L, 7)', X, 'CQ100 abus'));
  r := r || 'a) suspendre: ' || left(v, 30) || ' journal+' || ((select count(*) from public.admin_journal) - aj)
     || ' motif=' || coalesce((select motif from public.admin_journal where action = 'admin_suspendre' and cible_id = X order by at desc limit 1), 'aucun');
  if (select count(*) from public.admin_journal) - aj <> 1 then bad := true; end if;
  -- b) bannir puis lever : le bannissement d'origine reste dans le journal
  v := pg_temp.en(ADM, format('select public.admin_bannir(%L, %L, %L)', Z, 'arnaque', 'CQ100 faux sacs'));
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_lever_bannissement(%L)', Z));
  j := (select detail from public.admin_journal where action = 'admin_lever_bannissement' and cible_id = Z order by at desc limit 1);
  r := r || ' | b) lever bannissement: ' || left(v, 30) || ' journal+' || ((select count(*) from public.admin_journal) - aj)
     || ' motif d''origine gardé=' || coalesce(j -> 'avant' -> 'bannissement' ->> 'motif', 'non') || ' encore banni=' || exists (select 1 from public.bannis where user_id = Z);
  if coalesce(j -> 'avant' -> 'bannissement' ->> 'motif', '') <> 'arnaque' then bad := true; end if;
  -- c) identité vérifiée puis refusée : les deux décisions sont dans le journal, avec l'état d'avant
  insert into public.verifications (user_id, statut, piece, defi, expire_le, nom_saisi, numero_lu) values (Y, 'en_attente', 'cni', '2222', current_date + 300, 'Test Y', 'CQ100Y') returning id into vid;
  v := pg_temp.en(ADM, format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', vid, 'verifie', current_date + 300, 'CQ100Y'));
  v := v || ' / ' || pg_temp.en(ADM, format('select public.admin_identite_decider(%L, %L, %L, null, null, null)', vid, 'refuse', 'Photo truquée'));
  r := r || ' | c) identité x2: ' || left(v, 40) || ' décisions au journal=' || (select count(*) from public.admin_journal where action = 'admin_identite_decider' and cible_id = Y)
     || ' avant la 2e=' || coalesce((select detail -> 'avant' -> 'dossier' ->> 'statut' from public.admin_journal where action = 'admin_identite_decider' and cible_id = Y order by at desc, (detail -> 'avant' -> 'dossier' ->> 'statut') desc limit 1), 'aucun');
  if (select count(*) from public.admin_journal where action = 'admin_identite_decider' and cible_id = Y) <> 2 then bad := true; end if;
  -- d) réglage : ancienne et nouvelle valeur
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, 'select public.admin_fiabilite_regler(''{"suspension_jours": 9}''::jsonb)');
  j := (select detail from public.admin_journal where action = 'admin_fiabilite_regler' order by at desc limit 1);
  r := r || ' | d) réglage: ' || left(v, 30) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' changements=' || left(coalesce((j -> 'changements')::text, 'aucun'), 120);
  if (select count(*) from public.admin_journal) - aj <> 1 or j -> 'changements' is null then bad := true; end if;
  -- e) une décision qui en appelle d'autres (commande_issue -> litige_clore -> trancher2 -> trancher) : une seule ligne
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ100-I', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'confirmee') returning id into c;
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_commande_issue(%L, %L, %L, %L)', c, 'annulee', 'Vendeur injoignable depuis 5 jours', 'vendeur'));
  r := r || ' | e) issue imposée: ' || left(v, 30) || ' -> ' || (select etat from public.commandes where id = c) || ' journal+' || ((select count(*) from public.admin_journal) - aj);
  if v <> 'ok' or (select count(*) from public.admin_journal) - aj <> 1 then bad := true; end if;
  -- f) un membre n'appelle ni les fonctions d'origine ni le journal
  r := r || ' | f) membre: _j_admin_suspendre=' || left(pg_temp.en(X, format('select public._j_admin_suspendre(%L, %L, 7)', Y, 'pirate')), 40)
     || ' _adm_noter=' || left(pg_temp.en(X, 'select public._adm_noter(''x'', ''{}''::jsonb, null, null)'), 40)
     || ' admin_suspendre=' || left(pg_temp.en(X, format('select public.admin_suspendre(%L, %L, 7)', Y, 'pirate')), 40);
  if pg_temp.en(X, format('select public._j_admin_suspendre(%L, %L, 7)', Y, 'pirate')) = 'ok' or pg_temp.en(X, 'select public._adm_noter(''x'', ''{}''::jsonb, null, null)') = 'ok' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100c (25/10/2026) : TEST ECHEC : journal+0 partout ; bannissement levé sans trace ; 0 décision d'identité au journal ; un membre n'a pas de _j_ (fonctions absentes).
-- APRÈS 100c (25/10/2026) : TEST OK : a) journal+1, motif « CQ100 abus » ; b) journal+1, motif d'origine « arnaque » gardé ; c) 2 décisions au journal, état d'avant de la 2e = verifie ;
-- d) journal+1 avec changements avant/après de reglages.fiabilite ; e) issue imposée (4 fonctions en chaîne) : journal+1 ; f) membre : « permission denied » pour _j_admin_suspendre et _adm_noter, « Réservé à l'administration » pour admin_suspendre.

-- C100-4 (ANO-018) : l'équipe ne tranche pas une commande où elle est vendeur, acheteur ou transporteur
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; bad boolean := false; v text; c1 uuid; c2 uuid; c3 uuid;
  ins text := 'insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le, litige_par, litige_le, litige_motif) values (%L, %L, %L, %L, %L, 10, %L, 20000, 200000, %L, %L, %L, %s, %L, %s, %L) returning id';
begin
  execute format(ins, 'CQ100-L1', ADM, B, B, 'mais', 'sac', 'vendeur', 'litige', 'arrivee', 'null', B, 'now()', 'Sacs abîmés') into c1;
  execute format(ins, 'CQ100-L2', ADM, B, B, 'mais', 'sac', 'vendeur', 'terminee', 'terminee', 'now()', null, 'null', null) into c2;
  execute format(ins, 'CQ100-L3', S, B, B, 'mais', 'sac', 'vendeur', 'litige', 'arrivee', 'null', B, 'now()', 'Sacs abîmés') into c3;
  v := pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c1, 'terminee', 'Je me donne raison', 'acheteur'));
  r := r || 'a) admin vendeur tranche son litige: ' || left(v, 90) || ' -> ' || (select etat from public.commandes where id = c1);
  if v = 'ok' then bad := true; end if;
  v := pg_temp.en(ADM, format('select public.admin_litige_partager(%L, 3, %L)', c1, 'Partage'));
  r := r || ' | b) partage: ' || left(v, 40); if v = 'ok' then bad := true; end if;
  v := pg_temp.en(ADM, format('select public.admin_liberer(%L, %L)', c2, 'Clôture'));
  r := r || ' | c) clôture de sa vente: ' || left(v, 40); if v = 'ok' then bad := true; end if;
  v := pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, null)', c3, 'terminee', 'Accord trouvé entre les deux'));
  r := r || ' | d) litige entre deux membres: ' || left(v, 40) || ' -> ' || (select etat from public.commandes where id = c3);
  if v <> 'ok' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100c (25/10/2026) : TEST ECHEC : l'administrateur vendeur tranche son propre litige (terminee) et clôture sa vente.
-- APRÈS 100c (25/10/2026) : TEST OK : a) b) c) « CONFLIT_INTERETS : vous êtes partie à cette commande. Un autre membre de l'équipe doit décider. » ; d) litige entre deux membres : ok.
-- Un membre (non admin) partie à la commande reçoit toujours « Réservé à l'administration. » (vérifié le 25/10/2026).

-- C100-5 (ANO-020) : un avis donné sur une commande ensuite annulée ne compte plus dans la note publique
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  r text := ''; bad boolean := false; c uuid; a1 text; a2 text; n1 text; n2 text; u1 boolean; u2 boolean;
begin
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ100-AV', S, X, X, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'terminee', 'terminee', now()) returning id into c;
  insert into public.avis_commandes (commande_id, auteur_id, cible_id, role_cible, note) values (c, X, S, 'vendeur', 1);
  u1 := exists (select 1 from public._avis_uniques() a where a.auteur_id = X and a.cible_id = S and a.note = 1);
  a1 := public.reputation_publique(S) -> 'vendeur' ->> 'avis';
  n1 := (select nombre::text from public.notes_publiques(array[S]));
  update public.commandes set etat = 'annulee', etape = 'terminee' where id = c;
  u2 := exists (select 1 from public._avis_uniques() a where a.auteur_id = X and a.cible_id = S and a.note = 1);
  a2 := public.reputation_publique(S) -> 'vendeur' ->> 'avis';
  n2 := (select nombre::text from public.notes_publiques(array[S]));
  r := 'commande terminée : avis compté=' || u1 || ' réputation avis=' || coalesce(a1, '?') || ' notes=' || coalesce(n1, '?')
    || ' | annulée : avis compté=' || u2 || ' réputation avis=' || coalesce(a2, '?') || ' notes=' || coalesce(n2, '?');
  if u2 or a2::int >= a1::int then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100e (25/10/2026) : TEST ECHEC : après annulation, l'avis compte encore (réputation avis=1, notes=4).
-- APRÈS 100e (25/10/2026) : TEST OK : terminée : avis compté, réputation avis=1, notes=4 ; annulée : plus compté, réputation avis=0, notes=3.

-- C100-6 (ANO-037, ANO-038, ANO-019) : droits sur villes_ref, search_path, contraintes de commandes (lecture seule)
do $$
declare r text := ''; bad boolean := false;
begin
  r := 'villes_ref anon=' || coalesce((select string_agg(a::text, ' ') from pg_class c, unnest(c.relacl) a where c.oid = 'public.villes_ref'::regclass and a::text ~ '^(anon|authenticated)='), 'aucun');
  if exists (select 1 from pg_class c, unnest(c.relacl) a where c.oid = 'public.villes_ref'::regclass and a::text ~ '^(anon|authenticated)=[a-zA-Z]*[awdDxtm]') then bad := true; end if;
  r := r || ' | sans search_path: ' || coalesce((select string_agg(p.proname, ',') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_notif_rang', 'negocier', 'proposer_prix')
       and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))), 'aucune');
  if exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('_notif_rang', 'negocier', 'proposer_prix')
       and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))) then bad := true; end if;
  r := r || ' | contraintes commandes 100d: ' || coalesce((select string_agg(conname || case when convalidated then '' else ' (NOT VALID)' end, ', ') from pg_constraint where conrelid = 'public.commandes'::regclass and conname like 'commandes\_c100\_%'), 'aucune');
  if (select count(*) from pg_constraint where conrelid = 'public.commandes'::regclass and conname like 'commandes\_c100\_%') < 7 then bad := true; end if;
  r := r || ' | avis sur commande non terminée (lignes gardées, plus comptées)=' || (select count(*) from public.avis_commandes a join public.commandes c on c.id = a.commande_id where c.etat <> 'terminee');
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- AVANT 100d/100f (25/10/2026) : TEST ECHEC : villes_ref anon=arwdDxtm authenticated=arwdDxtm ; sans search_path : _notif_rang, negocier, proposer_prix ; contraintes : aucune.
-- APRÈS (25/10/2026) : TEST OK : villes_ref anon=r authenticated=r ; sans search_path : aucune ; 7 contraintes commandes_c100_* validées (+ offres_c100_prix_ferme) ;
-- avis sur commande non terminée : 2 lignes gardées (simulation MDG-C-261023-FE0FD3), plus comptées.
