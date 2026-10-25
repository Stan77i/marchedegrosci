-- U07 Profils et confiance : exercices SQL reproductibles (système de contrôle MGCI, 25/10/2026).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Jamais sur la production.
-- Chaque bloc crée ses données de simulation, vérifie, puis finit par raise exception 'TEST OK: …' ou 'TEST ECHEC: …' :
-- tout est annulé, rien ne reste en base. Lancer les outils ci-dessous dans le même appel que chaque bloc.
-- Comptes de simulation du projet de test : S = vendeur (Yamoussoukro), B = acheteur (Daloa), X, Y, Z = membres tiers, ADM = administrateur.
-- Piège : dans une même expression plpgsql, une sous-requête lit l'état d'avant l'appel d'une fonction de la même expression : lire dans une instruction à part.
-- Résultat obtenu le 25/10/2026 sous chaque bloc ; tableau complet et anomalies : CONTROLE_QUALITE/rapports/2026-10-25-controle-general.md (annexe : rapports/annexes/2026-10-25-securite.md).

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
create or replace function pg_temp.en(u uuid, q text) returns text language plpgsql as $f$
begin perform pg_temp.qui(u); execute q; execute 'reset role'; return 'ok'; exception when others then return 'ERR ' || left(sqlerrm, 90); end $f$;

-- PRO-01 (normal + limite) : champs du profil, longueurs, caractères, pseudo unique sans tenir compte des majuscules, profil d'un autre
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  r text := ''; bad boolean := false; v text; j json; q text; attendu text; i int := 0;
  cas text[][] := array[
    -- [requête (X connecté), attendu ok|ERR]
    array[format('update public.profils set bio = %L, pseudo = %L, ville = %L, region_slug = %L where user_id = %L', 'Grossiste de maïs à Abidjan', 'awa_cq', 'Abidjan', 'abidjan', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ok'],
    array[format('update public.profils set bio = %L where user_id = %L', repeat('a', 600), 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ok'],
    array[format('update public.profils set bio = %L where user_id = %L', repeat('a', 601), 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set pseudo = %L where user_id = %L', 'ab', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set pseudo = %L where user_id = %L', repeat('b', 24), 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ok'],
    array[format('update public.profils set pseudo = %L where user_id = %L', repeat('b', 25), 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set prenom = %L where user_id = %L', 'Awa2', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set prenom = %L, nom = %L where user_id = %L', 'Marie-Ève', 'N''Guessan', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ok'],
    array[format('update public.profils set role = %L where user_id = %L', 'transporteur', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set structure_type = %L, structure_nom = %L where user_id = %L', 'cooperative', 'Coop Espoir', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ok'],
    array[format('update public.profils set avatar = %L where user_id = %L', repeat('z', 201), 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR'],
    array[format('update public.profils set bio = %L where user_id = %L', 'Hack', 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'), 'zero'],
    array[format('update public.profils set supprime_le = null where user_id = %L', 'ca27004f-17de-494a-8db8-8c85a7cbd65c'), 'ERR']
  ];
begin
  update public.profils set pseudo = 'Awa_CQ_Y' where user_id = Y;
  perform pg_temp.qui(X);
  for i in 1 .. array_length(cas, 1) loop
    q := cas[i][1]; attendu := cas[i][2];
    if attendu = 'zero' then
      execute q; get diagnostics v = row_count; v := 'lignes=' || v;
      if v <> 'lignes=0' then bad := true; end if;
    else
      v := pg_temp.e(q);
      if (attendu = 'ok') <> (v = 'ok') then bad := true; v := v || ' [INATTENDU]'; end if;
    end if;
    r := r || ' | ' || i || ':' || left(v, 55);
  end loop;
  v := pg_temp.e(format('update public.profils set pseudo = %L where user_id = %L', 'awa_cq_y', X));
  r := r || ' | pseudo pris (autre casse): ' || left(v, 60); if v = 'ok' then bad := true; end if;
  r := r || ' | pseudo_libre(AWA_CQ_Y)=' || public.pseudo_libre('AWA_CQ_Y');
  execute 'reset role';
  j := public.profil_public(X);
  r := r || ' || profil_public: ' || left(j::text, 160);
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : 13/13 cas conformes ; pseudo pris dans une autre casse refusé. Les refus remontent le texte brut « violates check constraint ».

-- PRO-02 (limite + erreur) : pièce d'identité expirée ; suppression du compte pendant une commande en cours ; données gardées après suppression
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  c uuid; r text := ''; bad boolean := false; v text; j json; o uuid := gen_random_uuid();
begin
  -- a) identité vérifiée mais pièce expirée : le badge doit tomber
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (S, 'verifie', 'cni', '1234', now() - interval '400 days', current_date - 1, 'CQ-PRO2-EXP');
  r := r || 'a) pièce expirée hier : identite_ok=' || public.identite_ok(S) || ' identite_verifiee=' || coalesce((select string_agg(iv::text, ',') from public.identite_verifiee(array[S]) iv), 'vide');
  if public.identite_ok(S) then bad := true; end if;
  update public.verifications set expire_le = current_date where numero = 'CQ-PRO2-EXP';
  r := r || ' ; expire aujourd''hui : identite_ok=' || public.identite_ok(S);
  -- b) suppression du compte pendant une commande en cours
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
    values ('CQ-PRO2', X, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'en_cours', 'chargement') returning id into c;
  update public.profils set bio = 'Ma vie, mon numéro de boutique', activites = 'Maïs, riz', structure_type = 'entreprise', structure_nom = 'Ets CQ Test' where user_id = X;
  perform pg_temp.qui(X);
  v := pg_temp.e('select public.supprimer_compte()');
  execute 'reset role';
  r := r || ' | b) supprimer_compte avec une commande en cours (vendeur, au chargement): ' || left(v, 60)
     || ' ; commande=' || (select etat || '/' || etape from public.commandes where id = c)
     || ' ; profil gardé: bio=' || coalesce((select left(bio, 20) from public.profils where user_id = X), 'vide')
     || ' activites=' || coalesce((select activites from public.profils where user_id = X), 'vide')
     || ' structure=' || coalesce((select structure_nom from public.profils where user_id = X), 'vide');
  if v = 'ok' and (select etat from public.commandes where id = c) = 'en_cours' then bad := true; r := r || ' [compte supprimé avec une commande en cours]'; end if;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon';
  j := public.profil_public(X);
  execute 'reset role';
  r := r || ' ; profil_public après suppression: ' || left(coalesce(j::text, 'NULL'), 140);
  if coalesce(j::text, '') like '%Ets CQ Test%' or coalesce(j::text, '') like '%Ma vie%' then bad := true; r := r || ' [données encore publiques]'; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST ECHEC : expiration correcte (hier=false, aujourd'hui=true) ; supprimer_compte ACCEPTÉ avec une commande en cours au chargement (commande reste en_cours, compte bloqué) ;
-- bio, activités et nom de structure gardés en base (profil_public renvoie NULL).

-- PRO-03 (malveillant + régression) : badges par fausses commandes (schéma 94d), contestation de niveau, signalement d'un membre, ce que voit un visiteur
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  r text := ''; bad boolean := false; v text; i int; j json;
begin
  -- a) régression badges anti-complices (schéma 94d) : 5 commandes de 600 000 F entre deux comptes, reçues 2 min après
  for i in 1..5 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, created_at)
    values ('CQ-PRO3-' || i, S, B, B, 'riz', 1, 'sac', 600000, 600000, 'vendeur', 'terminee', 'terminee', now() - interval '2 minutes');
  end loop;
  update public.commandes set termine_le = now() where numero like 'CQ-PRO3-%';
  perform public._niv_appliquer(S, 'vendeur'); perform public._niv_appliquer(B, 'acheteur');
  r := r || 'a) 5 fausses commandes en 2 min : badge S=' || coalesce(public._niv_effectif(S, 'vendeur'), 'aucun') || ' B=' || coalesce(public._niv_effectif(B, 'acheteur'), 'aucun')
     || ' gros=' || coalesce(public._niv_calculer(B, 'acheteur') ->> 'gros', '?');
  if public._niv_effectif(S, 'vendeur') is not null or public._niv_effectif(B, 'acheteur') is not null then bad := true; end if;
  -- b) contestation du badge : une seule ouverte à la fois
  perform pg_temp.qui(S);
  r := r || ' | b) contestation 1: ' || left(pg_temp.e(format('select public.niveaux_contester(%L, %L)', 'vendeur', 'Mes ventes ne sont pas toutes comptées, merci de vérifier.')), 50)
     || ' ; 2: ' || left(pg_temp.e(format('select public.niveaux_contester(%L, %L)', 'vendeur', 'Je conteste encore une fois mon niveau.')), 60);
  execute 'reset role';
  r := r || ' ; ouvertes=' || (select count(*) from public.niveaux_contestations where user_id = S and statut = 'ouverte');
  if (select count(*) from public.niveaux_contestations where user_id = S and statut = 'ouverte') > 1 then bad := true; end if;
  -- c) signaler un membre : soi-même, sans détail, deux fois
  perform pg_temp.qui(X);
  r := r || ' | c) se signaler soi-même: ' || left(pg_temp.e(format('select public.signaler_membre(%L, %L, %L, %L, null, null, true)', X, 'arnaque', 'Je me signale moi-même pour voir', 'profil')), 40)
     || ' ; sans détail: ' || left(pg_temp.e(format('select public.signaler_membre(%L, %L, %L, %L, null, null, true)', S, 'arnaque', 'court', 'profil')), 40)
     || ' ; 1er: ' || left(pg_temp.e(format('select public.signaler_membre(%L, %L, %L, %L, null, null, true)', S, 'arnaque', 'Il a pris l''argent et rien livré', 'profil')), 40)
     || ' ; 2e identique: ' || left(pg_temp.e(format('select public.signaler_membre(%L, %L, %L, %L, null, null, true)', S, 'arnaque', 'Il a pris l''argent et rien livré', 'profil')), 60);
  execute 'reset role';
  r := r || ' ; signalements X->S=' || (select count(*) from public.signalements_membres where auteur_id = X and cible_id = S);
  if (select count(*) from public.signalements_membres where auteur_id = X and cible_id = S) > 1 then bad := true; end if;
  -- d) ce que voit un visiteur sans compte de la fiabilité et des niveaux
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true); execute 'set local role anon';
  j := public.fiabilite_publique(S);
  r := r || ' | d) fiabilite_publique(anon): ' || left(coalesce(j::text, 'NULL'), 120) || ' ; niveaux_publics: ' || left(coalesce((select string_agg(np::text, ',') from public.niveaux_publics(array[S]) np), 'vide'), 80);
  execute 'reset role';
  if coalesce(j::text, '') ~* '(motif|note_admin|sanction|annulation_id)' then bad := true; r := r || ' [détail privé exposé]'; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : aucun badge ; signalements soi-même / trop court / doublon refusés ; fiabilité publique « 100 % sur 5 » nourrie par les 5 fausses commandes ;
-- contestation non atteinte (« Rien à contester » : il faut un changement de niveau dans les 7 jours).

-- PRO-04 (concurrent dans une transaction) : deux dossiers d'identité, double décision de l'équipe
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; bad boolean := false; v1 text; v2 text; id1 uuid; vid uuid;
begin
  -- a) deux dossiers d'identité ouverts pour le même membre (concurrence simulée dans une transaction)
  perform pg_temp.qui(X);
  v1 := pg_temp.v(format('select public.identite_commencer(%L)::text', 'cni'));
  v2 := pg_temp.v(format('select public.identite_commencer(%L)::text', 'passeport'));
  execute 'reset role';
  r := r || 'a) commencer x2: ' || left(v1, 50) || ' / ' || left(v2, 50) || ' ; dossiers ouverts=' || (select count(*) from public.verifications where user_id = X and statut in ('brouillon', 'en_attente', 'verification_manuelle'));
  if (select count(*) from public.verifications where user_id = X and statut in ('brouillon', 'en_attente', 'verification_manuelle')) > 1 then bad := true; end if;
  begin
    insert into public.verifications (user_id, statut, piece, defi, expire_le) values (X, 'en_attente', 'cni', '1111', current_date + 300);
    r := r || ' ; 2e dossier ouvert inséré en base: accepté'; bad := true;
  exception when unique_violation then r := r || ' ; 2e dossier ouvert inséré en base: refusé (index unique)'; end;
  -- b) l'équipe décide deux fois le même dossier (double clic)
  insert into public.verifications (user_id, statut, piece, defi, expire_le, nom_saisi, numero_lu) values ('e0191bd5-e039-4948-9143-6a30cfdeaf6c', 'en_attente', 'cni', '2222', current_date + 300, 'Test Y', 'CQPRO4') returning id into vid;
  perform pg_temp.qui(ADM);
  r := r || ' | b) décision 1: ' || left(pg_temp.e(format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', vid, 'verifie', current_date + 300, 'CQPRO4')), 40)
     || ' ; décision 2 (refus après vérifié): ' || left(pg_temp.e(format('select public.admin_identite_decider(%L, %L, %L, null, null, null)', vid, 'refuse', 'Photo floue')), 60);
  execute 'reset role';
  r := r || ' ; statut=' || (select statut from public.verifications where id = vid) || ' journal=' || (select count(*) from public.admin_journal where cible_id = 'e0191bd5-e039-4948-9143-6a30cfdeaf6c');
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : 1 seul dossier ouvert (index unique) ; « vérifié » puis « refusé » accepté : la 1re décision est écrasée, aucune ligne dans admin_journal (voir ADM-01).
