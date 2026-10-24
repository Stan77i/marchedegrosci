-- Tests du schéma 94 (équipe Confiance, audit du 24/10/2026). Projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- Chaque bloc finit par raise exception 'TEST …' : tout est annulé, rien ne reste dans la base.
-- Comptes de simulation du projet de test (aucune donnée réelle). ADM = administrateur.
-- Les résultats obtenus sont écrits sous chaque bloc.

-- outils (à lancer avec chaque bloc, dans le même appel)
create or replace function pg_temp.qui(u uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); $f$;
create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;

-- Bloc 1 : noms réservés (P1 n° 3, test T3 de l'audit) et pseudo de boutique
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; r text := ''; v text;
begin
  perform pg_temp.qui(X);
  r := r || 'T3 prénom+nom : ' || pg_temp.e(format('update public.profils set prenom = %L, nom = %L where user_id = %L', 'Marché', 'de Gros', X)) || E'\n';
  foreach v in array array['MarcheDeGros', 'M4rche_de_Gr0s', 'mgci.ci', 'Admin_Abj', 'SupportCI', 'service.client', 'equipe-mdg', 'Kone_officiel', 'marche.du.gros'] loop
    r := r || 'pseudo ' || v || ' : ' || left(pg_temp.e(format('update public.profils set pseudo = %L where user_id = %L', v, X)), 70) || E'\n';
  end loop;
  r := r || 'structure : ' || left(pg_temp.e(format('update public.profils set structure_nom = %L where user_id = %L', 'Marché de Gros SARL', X)), 70) || E'\n';
  r := r || 'nom normal : ' || pg_temp.e(format('update public.profils set prenom = %L, nom = %L, pseudo = %L where user_id = %L', 'Awa', 'Koné', 'awa_kone', X)) || E'\n';
  r := r || 'pseudo_libre(marchedegros)=' || public.pseudo_libre('marchedegros') || ' pseudo_libre(awa_kone2)=' || public.pseudo_libre('awa_kone2') || E'\n';
  perform pg_temp.qui(ADM);
  r := r || 'admin met un nom réservé à un membre : ' || pg_temp.e(format('update public.profils set pseudo = %L where user_id = %L', 'equipe_test', X)) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : T3 prénom+nom refusé (« Ce nom est réservé à l’équipe du Marché de Gros ») ; pseudos MarcheDeGros,
-- M4rche_de_Gr0s, mgci.ci, Admin_Abj, SupportCI, service.client, equipe-mdg, Kone_officiel, marche.du.gros refusés ; structure refusée ;
-- nom normal ok ; pseudo_libre(marchedegros)=false, pseudo_libre(awa_kone2)=true ; l'admin peut corriger un membre : ok.

-- Bloc 2 : identité vérifiée = nom figé (P2 n° 17, test T4) ; suppression du compte = numéro libéré (P2 n° 29)
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; r text := ''; mail text;
begin
  update public.profils set prenom = 'Kouassi', nom = 'Yao' where user_id = X;
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (X, 'verifie', 'cni', '1234', now(), current_date + 365, 'CI0001234567');
  perform pg_temp.qui(X);
  r := r || 'vérifié=' || public.identite_ok(X) || E'\n';
  r := r || 'change de prénom : ' || pg_temp.e(format('update public.profils set prenom = %L where user_id = %L', 'Moussa', X)) || E'\n';
  r := r || 'même nom, autre casse : ' || pg_temp.e(format('update public.profils set prenom = %L, nom = %L where user_id = %L', 'KOUASSI', 'yao', X)) || E'\n';
  r := r || 'change sa bio : ' || pg_temp.e(format('update public.profils set bio = %L where user_id = %L', 'Grossiste de maïs', X)) || E'\n';
  select email into mail from auth.users where id = X;
  r := r || 'supprimer_compte : ' || pg_temp.e('select public.supprimer_compte()') || E'\n';
  r := r || 'adresse avant=' || mail || ' après=' || (select email from auth.users where id = X)
     || ' numéro libre=' || (not exists (select 1 from auth.users where email = mail))
     || ' journal=' || (select count(*) from public.admin_journal where cible_id = X and action = 'numero_libere') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : vérifié=true ; change de prénom refusé (« Votre identité est vérifiée… ») ; même nom autre casse : ok ;
-- bio : ok ; supprimer_compte : ok ; adresse 2250700000060@… → supprime-2250700000060-ca27004f@detache.marchedegros.ci, numéro libre=true, journal=1.

-- Bloc 3 : une pièce ne vérifie qu'un compte (P2 n° 27)
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  v1 uuid; v2 uuid; r text := '';
begin
  insert into public.verifications (user_id, statut, piece, defi, expire_le, nom_saisi, numero_lu) values (X, 'en_attente', 'cni', '1111', current_date + 365, 'Kouassi Yao', 'CI 000 123 4567') returning id into v1;
  insert into public.verifications (user_id, statut, piece, defi, expire_le, nom_saisi, numero_lu) values (Y, 'en_attente', 'cni', '2222', current_date + 365, 'Kouassi Yao', 'CI0001234567') returning id into v2;
  perform pg_temp.qui(ADM);
  r := r || 'X sans numéro : ' || pg_temp.e(format('select public.admin_identite_decider(%L, %L, null, null, %L, null)', v1, 'verifie', current_date + 365)) || E'\n';
  r := r || 'X avec numéro : ' || pg_temp.e(format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', v1, 'verifie', current_date + 365, 'CI 000 123 4567')) || E'\n';
  r := r || 'Y même pièce : ' || pg_temp.e(format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', v2, 'verifie', current_date + 365, 'ci-0001234567')) || E'\n';
  r := r || 'Y autre pièce : ' || pg_temp.e(format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', v2, 'verifie', current_date + 365, 'CI0009999999')) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : X sans numéro refusé (« Recopiez le numéro de la pièce ») ; X avec numéro ok ;
-- Y même pièce (ci-0001234567) refusée (« déjà vérifiée sur un autre compte ») ; Y autre pièce ok.

-- Bloc 4 : numéro contesté, code changé par l'équipe (journal + message), numéro des conversations (P1 n° 4, P2 n° 21)
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; j json; d uuid;
begin
  perform pg_temp.qui(X);
  r := r || 'membre rend un numéro : ' || pg_temp.e($q$select public.admin_numero_rendre('0700000056', 'Le vrai propriétaire a montré sa facture')$q$) || E'\n';
  r := r || 'membre change un code : ' || pg_temp.e(format('select public.admin_reinitialiser_journal(%L, %L, %L)', Y, '482915', 'essai')) || E'\n';
  execute 'set local role authenticated';
  r := r || 'ancienne admin_reinitialiser par un membre : ' || pg_temp.e(format('select public.admin_reinitialiser(%L, %L)', Y, '482915')) || E'\n';
  perform pg_temp.qui(ADM);
  r := r || 'ancienne admin_reinitialiser par l''admin (rôle authenticated) : ' || pg_temp.e(format('select public.admin_reinitialiser(%L, %L)', Y, '482915')) || E'\n';
  r := r || 'sans motif : ' || pg_temp.e(format('select public.admin_reinitialiser_journal(%L, %L, %L)', Y, '482915', '')) || E'\n';
  r := r || 'code facile : ' || pg_temp.e(format('select public.admin_reinitialiser_journal(%L, %L, %L)', Y, '123456', 'Le membre a oublié son code')) || E'\n';
  r := r || 'avec motif : ' || pg_temp.e(format('select public.admin_reinitialiser_journal(%L, %L, %L)', Y, '482915', 'Le membre a oublié son code, appel vérifié')) || E'\n';
  reset role;
  r := r || 'journal=' || (select count(*) from public.admin_journal where cible_id = Y and action = 'code_change')
     || ' message au membre=' || (select count(*) from public.dm m join public.discussions x on x.id = m.discussion_id
                                  where Y in (x.a_id, x.b_id) and m.auteur_id = ADM and m.texte like 'Votre code de connexion%') || E'\n';
  perform pg_temp.qui(ADM); execute 'set local role authenticated';
  j := public.admin_numero_rendre('07 00 00 00 56', 'Le vrai propriétaire a montré sa facture Orange');
  reset role;
  r := r || 'numéro rendu : ' || j::text || ' adresse=' || (select email from auth.users where id = Y) || ' bloqué=' || ((select banned_until from auth.users where id = Y) = 'infinity')
     || ' numéro libre=' || (not exists (select 1 from auth.users where email = '2250700000056@tel.marchedegros.ci'))
     || ' journal=' || (select count(*) from public.admin_journal where cible_id = Y and action = 'numero_rendu') || E'\n';
  perform pg_temp.qui(ADM); execute 'set local role authenticated';
  r := r || 'numéro libre redemandé : ' || pg_temp.e($q$select public.admin_numero_rendre('0700000056', 'Le vrai propriétaire a montré sa facture')$q$) || E'\n';
  r := r || 'numéros des conversations : ' || coalesce((select string_agg(distinct coalesce(a_tel, 'null'), ',') from (select a_tel from public.admin_discussions() limit 5) z), 'aucune') || E'\n';
  reset role;
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : membre : admin_numero_rendre et admin_reinitialiser_journal refusés ; ancienne admin_reinitialiser :
-- « permission denied » (membre et admin) ; sans motif refusé ; 123456 refusé ; avec motif ok ; journal=1, message au membre=1 ;
-- numéro rendu : adresse conteste-2250700000056-e0191bd5@detache…, bloqué=true, numéro libre=true, journal=1 ; redemandé : « Ce numéro est libre » ;
-- numéros des conversations lus dans l'adresse de connexion (10 chiffres).

-- Bloc 5 : badges anti-complices (P2 n° 12, test 3 de l'audit : 5 fausses commandes entre deux comptes)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  P uuid[] := array['788f9d6e-6b65-45c0-8cc4-201539674f26', '07a79726-99c9-4788-9aab-c8015ed9bf4a', 'b12a640c-a355-4e95-b446-40cd16a5ff7e']::uuid[];
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; i int; r text := ''; j json;
begin
  -- 5 commandes de 600 000 F entre S et B, reçues 2 minutes après la création (comme dans l'audit)
  for i in 1..5 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, created_at)
    values ('T94-' || i, S, B, B, 'riz', 1, 'sac', 600000, 600000, 'vendeur', 'terminee', 'terminee', now() - interval '2 minutes');
  end loop;
  update public.commandes set termine_le = now() where numero like 'T94-%';
  perform public._niv_appliquer(S, 'vendeur'); perform public._niv_appliquer(B, 'acheteur');
  r := r || '5 commandes en 2 min : S=' || coalesce(public._niv_effectif(S, 'vendeur'), 'aucun') || ' B=' || coalesce(public._niv_effectif(B, 'acheteur'), 'aucun')
     || ' gros=' || (public._niv_calculer(B, 'acheteur') ->> 'gros') || E'\n';
  -- même paire, mais reçues 1 jour après la création : plafond 3 par partenaire, 1 seul partenaire
  update public.commandes set created_at = now() - interval '1 day' where numero like 'T94-%';
  perform public._niv_appliquer(S, 'vendeur'); perform public._niv_appliquer(B, 'acheteur');
  r := r || 'même paire, délai 1 j : S=' || coalesce(public._niv_effectif(S, 'vendeur'), 'aucun') || ' (comptées=' || (public._niv_calculer(S, 'vendeur') -> 'detail' -> 0 ->> 'commandes')
     || ', partenaires=' || (public._niv_calculer(S, 'vendeur') -> 'detail' -> 0 ->> 'partenaires') || ') B gros=' || (public._niv_calculer(B, 'acheteur') ->> 'gros') || E'\n';
  -- 3 vrais partenaires différents de plus
  for i in 1..3 loop
    insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, created_at, termine_le)
    values ('T94P-' || i, S, P[i], P[i], 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'terminee', 'terminee', now() - interval '1 day', now());
  end loop;
  perform public._niv_appliquer(S, 'vendeur');
  r := r || '+3 partenaires : S=' || coalesce(public._niv_effectif(S, 'vendeur'), 'aucun') || ' (partenaires=' || (public._niv_calculer(S, 'vendeur') -> 'detail' -> 0 ->> 'partenaires') || ')' || E'\n';
  perform pg_temp.qui(ADM);
  j := public.admin_paires_fermees();
  r := r || 'paires fermées : ' || coalesce((select string_agg((e ->> 'n') || ' cmd, ' || (e ->> 'part_a') || '%/' || (e ->> 'part_b') || '%', ' ; ')
       from json_array_elements(j) e where (e ->> 'a_id')::uuid in (S, B) and (e ->> 'b_id')::uuid in (S, B)), 'aucune') || E'\n';
  r := r || 'texte des critères : ' || left(public._niv_texte(), 160) || E'\n';
  perform pg_temp.qui(S);
  r := r || 'membre lit les paires : ' || pg_temp.e('select public.admin_paires_fermees()') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : 5 commandes en 2 min : S=aucun B=aucun gros=false (audit : « Vendeur fiable », « Acheteur fiable », gros) ;
-- même paire, délai 1 j : S=aucun (comptées=3, partenaires=1), gros=false ; +3 partenaires : S=fiable (partenaires=4) ;
-- paires fermées : « 5 cmd, 45%/71% » ; membre lit les paires : refusé.

-- Bloc 6 : signalements (P2 n° 16, P3 n° 36, test T2 de l'audit : 3 comptes masquent une annonce)
do $$
declare O uuid; PROP uuid; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  C uuid[] := array['3885adf0-e6af-4195-98be-f4a250aa359d', '1ebda56b-8e8b-40ac-8168-d117db9a939a', 'd353320a-68b5-4c05-83f9-b26b0b938a52']::uuid[];
  i int; r text := ''; j json;
begin
  select id, user_id into O, PROP from public.offres where status = 'active' and user_id = '86c69f98-e113-4bfb-bb2a-0bd32fba7830' limit 1;
  -- 3 comptes neufs signalent : l'annonce reste en ligne
  for i in 1..3 loop
    perform pg_temp.qui(C[i]); execute 'set local role authenticated';
    insert into public.signalements (cible, cible_id, motif) values ('offre', O, 'Arnaque — test');
    reset role;
  end loop;
  r := r || '3 comptes neufs : ' || (select status from public.offres where id = O) || E'\n';
  perform pg_temp.qui(C[1]); execute 'set local role authenticated';
  r := r || 'même membre, 2e fois : ' || pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', O, 'encore')) || E'\n';
  reset role;
  r := r || 'compteur public (connectés, non traités)=' || (select nombre from public.signalements_publics(array[O])) || E'\n';
  -- les 3 deviennent anciens et vérifiés ; un 4e signalement relance le calcul
  update auth.users set created_at = now() - interval '60 days' where id = any (C);
  for i in 1..3 loop
    insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (C[i], 'verifie', 'cni', '1234', now(), current_date + 365, 'T94SIG' || i);
  end loop;
  perform pg_temp.qui('9905e315-6a5f-42c0-8906-04f4189e1268'); execute 'set local role authenticated';
  insert into public.signalements (cible, cible_id, motif) values ('offre', O, 'Arnaque — test');
  reset role;
  r := r || '3 vérifiés anciens + 1 : ' || (select status from public.offres where id = O)
     || ' masquage=' || (select count(*) from public.signalement_masquages where cible_id = O and decision is null)
     || ' message au vendeur=' || (select count(*) from public.dm m join public.discussions x on x.id = m.discussion_id
                                   where PROP in (x.a_id, x.b_id) and m.texte like 'Votre annonce%cachée%') || E'\n';
  -- le vendeur voit et conteste
  perform pg_temp.qui(PROP); execute 'set local role authenticated';
  j := public.mes_annonces_masquees();
  r := r || 'vendeur voit : ' || json_array_length(j) || ' annonce(s)' || E'\n';
  r := r || 'contestation trop courte : ' || pg_temp.e(format('select public.signalement_contester(%L, %L, %L)', 'offre', O, 'non')) || E'\n';
  r := r || 'contestation : ' || pg_temp.e(format('select public.signalement_contester(%L, %L, %L)', 'offre', O, 'Ces comptes sont des concurrents, mon riz est bien là.')) || E'\n';
  r := r || 'deuxième contestation : ' || pg_temp.e(format('select public.signalement_contester(%L, %L, %L)', 'offre', O, 'Encore une fois, je conteste.')) || E'\n';
  r := r || 'vendeur remet en ligne lui-même : ' || pg_temp.e(format('update public.offres set status = %L where id = %L', 'active', O))
     || ' statut=' || (select status from public.offres where id = O) || E'\n';
  reset role;
  perform pg_temp.qui(ADM); execute 'set local role authenticated';
  r := r || 'admin voit les contestations : ' || (select count(*) from json_array_elements(public.admin_masquages()) e where (e ->> 'cible_id')::uuid = O and e ->> 'contestation' is not null) || E'\n';
  r := r || 'admin rétablit : ' || pg_temp.e(format('select public.admin_annonce_retablir(%L, %L, %L)', 'offre', O, 'Signalements de concurrents')) || E'\n';
  reset role;
  r := r || 'après : ' || (select status from public.offres where id = O)
     || ' signalements traités=' || (select count(*) from public.signalements where cible_id = O and traite) || '/' || (select count(*) from public.signalements where cible_id = O)
     || ' compteur public=' || coalesce((select nombre::text from public.signalements_publics(array[O])), '0')
     || ' décision=' || (select decision from public.signalement_masquages where cible_id = O)
     || ' journal=' || (select count(*) from public.admin_journal where cible_id = O) || E'\n';
  -- sans compte : 5 par jour et par téléphone, un seul par annonce
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '{"x-forwarded-for":"41.202.1.1"}', true);
  execute 'set local role anon';
  r := r || 'anonyme même annonce x2 : ' || pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', O, 'a'))
     || ' / ' || pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', O, 'a')) || E'\n';
  for i in 1..5 loop
    r := r || 'anonyme ' || (i + 1) || ' : ' || left(pg_temp.e(format('insert into public.signalements (cible, cible_id, motif) values (%L, %L, %L)', 'offre', gen_random_uuid(), 'a')), 60) || E'\n';
  end loop;
  reset role;
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : 3 comptes neufs : active (audit : masquee) ; 2e signalement du même membre refusé ; compteur public=3 ;
-- 3 vérifiés anciens + 1 : masquee, masquage=1, message au vendeur=1 ; vendeur voit 1 annonce ; contestation courte refusée, contestation ok,
-- 2e refusée ; le vendeur ne peut pas la remettre en ligne (RLS) ; admin voit la contestation=1 ; rétablit : ok → active, signalements traités 4/4,
-- compteur public=0, décision=retablie, journal=1 ; anonyme : même annonce 2 fois refusé ; 5 par jour puis refus.

-- Bloc 7 : fiabilité (P2 n° 13 et 28) : litige perdu, compteur public, récidive, météo examinée avant sanction
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  c uuid; a public.annulations; r text := ''; j json; sid uuid;
begin
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le, litige_motif)
  values ('T94L-1', S, B, B, 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'litige', 'arrivee', B, now(), 'Sacs abîmés') returning id into c;
  perform pg_temp.qui(ADM);
  perform public.admin_litige_clore(c, 'terminee', 'Photos de départ propres, rien ne prouve la casse', 'acheteur');
  select * into a from public.annulations where commande_id = c;
  r := r || 'litige gagné par le vendeur : commande=' || (select etat from public.commandes where id = c) || ' imputé à=' || case a.imputable_id when B then 'acheteur' when S then 'vendeur' else 'personne' end
     || ' catégorie=' || a.categorie || ' sanction B=' || coalesce((select type from public.sanctions where annulation_id = a.id), 'aucune') || E'\n';
  j := public.reputation_publique(S);
  r := r || 'profil vendeur : litiges_perdus=' || (j -> 'vendeur' ->> 'litiges_perdus') || ' litiges_contre=' || (j -> 'vendeur' ->> 'litiges_contre') || E'\n';
  j := public.reputation_publique(B);
  r := r || 'profil acheteur : litiges_perdus=' || (j -> 'acheteur' ->> 'litiges_perdus') || E'\n';
  -- litige clos sans fautif : rien n'est imputé
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le)
  values ('T94L-2', S, B, B, 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'litige', 'arrivee', B, now()) returning id into c;
  perform public.admin_litige_clore(c, 'terminee', 'Accord trouvé entre les deux', null);
  r := r || 'litige sans fautif : annulations=' || (select count(*) from public.annulations where commande_id = c) || E'\n';
  -- récidive : une suspension levée avant la fin ne compte pas
  j := public.admin_suspendre(S, 'Test 1'); sid := (j ->> 'id')::uuid;
  perform public.admin_suspension_lever(sid, 'Erreur');
  j := public.admin_suspendre(S, 'Test 2');
  r := r || 'après une suspension levée par erreur : ' || (j ->> 'jours') || ' jours, récidive=' || (j ->> 'recidive') || E'\n';
  -- la 2e va à son terme (simulé) : la suivante est une récidive
  update public.sanctions set debut = now() - interval '10 days', fin = now() - interval '3 days' where id = (j ->> 'id')::uuid;
  j := public.admin_suspendre(S, 'Test 3');
  r := r || 'après une suspension allée à son terme : ' || (j ->> 'jours') || ' jours, récidive=' || (j ->> 'recidive') || E'\n';
  -- une suspension allée à son terme il y a plus de 12 mois ne compte plus
  update public.sanctions set debut = now() - interval '400 days', fin = now() - interval '393 days' where user_id = S and type = 'suspension';
  j := public.admin_suspendre(S, 'Test 4');
  r := r || 'terme il y a 13 mois : ' || (j ->> 'jours') || ' jours, récidive=' || (j ->> 'recidive') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : litige gagné par le vendeur : terminee, imputé à l'acheteur, catégorie litige, sanction B=avertissement ;
-- profil vendeur litiges_perdus=0 litiges_contre=0 (audit : 3) ; profil acheteur litiges_perdus=1 ; litige sans fautif : 0 annulation ;
-- suspension levée par erreur puis nouvelle : 7 jours, récidive=false ; après une suspension allée à son terme : 30 jours, récidive=true ;
-- terme il y a 13 mois : 7 jours, récidive=false.

-- Bloc 7b : motif « panne / météo » refusé par l'autre partie → à examiner, pas de sanction ; classée abusive par l'équipe → sanction
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  c uuid; a public.annulations; r text := '';
begin
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, annulation_par, annulation_motif)
  values ('T94M-1', S, B, B, 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'en_cours', 'confirmee', S, 'panne_meteo') returning id into c;
  perform pg_temp.qui(B);
  perform set_config('mdg.fiab_accord', 'false', true);
  update public.commandes set etat = 'annulee' where id = c;
  perform set_config('mdg.fiab_accord', '', true);
  select * into a from public.annulations where commande_id = c;
  r := r || 'météo refusée : catégorie=' || a.categorie || ' à examiner=' || a.a_examiner || ' sanctions=' || (select count(*) from public.sanctions where annulation_id = a.id)
     || ' score S imputables=' || (public._fiab_score(S) ->> 'imputables') || E'\n';
  perform pg_temp.qui(S);
  r := r || 'S voit : ' || (select (e ->> 'a_examiner') || ' catégorie=' || coalesce(e ->> 'categorie', 'aucune') || ' contestable=' || (e ->> 'contestable')
       from json_array_elements(public.ma_fiabilite() -> 'annulations') e where (e ->> 'id')::uuid = a.id) || E'\n';
  perform pg_temp.qui(ADM);
  r := r || 'liste à examiner : ' || (select count(*) from json_array_elements(public.admin_fiabilite() -> 'a_examiner') e where (e ->> 'id')::uuid = a.id) || E'\n';
  perform public.admin_annulation_classer(a.id, 'abusive', S, 'Pas de panne prouvée');
  r := r || 'classée abusive : à examiner=' || (select a_examiner from public.annulations where id = a.id) || ' sanction=' || coalesce((select type from public.sanctions where annulation_id = a.id), 'aucune') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : météo refusée : abusive, à examiner=true, 0 sanction, imputables=0 ; S voit a_examiner=true, catégorie aucune,
-- contestable=false ; liste à examiner=1 ; classée abusive : à examiner=false, sanction=avertissement.

-- Bloc 8 : photos de départ (P2 n° 15, photos seulement)
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; c1 uuid; c2 uuid; r text := '';
  p text[] := array[S || '/t94/a.jpg', S || '/t94/b.jpg', S || '/t94/c.jpg', S || '/t94/d.jpg', S || '/t94/vieille.jpg'];
begin
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
  values ('T94F-1', S, B, B, 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'en_cours', 'confirmee') returning id into c1;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape)
  values ('T94F-2', S, B, B, 'riz', 1, 'sac', 100000, 100000, 'vendeur', 'en_cours', 'confirmee') returning id into c2;
  insert into public.commande_etapes (commande_id, evenement, par, role, at) values (c1, 'confirmee', B, 'acheteur', now() - interval '1 hour'), (c2, 'confirmee', B, 'acheteur', now() - interval '1 hour');
  insert into storage.objects (bucket_id, name, owner, created_at) values
    ('preuves', p[1], S, now()), ('preuves', p[2], S, now()), ('preuves', p[3], S, now()), ('preuves', p[4], S, now()), ('preuves', p[5], S, now() - interval '3 days');
  perform pg_temp.qui(S);
  r := r || 'même photo deux fois : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c1, array[p[1], p[1]])) || E'\n';
  r := r || 'photo d''avant la confirmation : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c1, array[p[1], p[5]])) || E'\n';
  r := r || 'photos neuves : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c1, array[p[1], p[2]])) || E'\n';
  r := r || 'mêmes photos pour une 2e commande : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c2, array[p[1], p[2]])) || E'\n';
  r := r || 'autres photos pour la 2e : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c2, array[p[3], p[4]])) || E'\n';
  r := r || 'reprise des photos de la 1re commande par elle-même : ' || pg_temp.e(format('select public.commande_depart_preuves(%L, %L, 50)', c1, array[p[1], p[2]])) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : même photo deux fois refusée ; photo d'avant la confirmation refusée ; photos neuves ok ;
-- mêmes photos pour une 2e commande refusées (audit : acceptées) ; autres photos ok ; la 1re commande reprend ses propres photos : ok.

-- Bloc 9 : date de création forcée par le serveur (P2 n° 26, test T6 de l'audit)
do $$
declare U uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830'; O uuid; d0 timestamptz; r text := '';
begin
  select id, created_at into O, d0 from public.offres where user_id = U and status = 'active' limit 1;
  -- identité vérifiée pour passer la limite des 3 annonces gratuites (annulé avec le reste)
  insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (U, 'verifie', 'cni', '1234', now(), current_date + 365, 'T94DATE');
  perform pg_temp.qui(U); execute 'set local role authenticated';
  r := r || 'modification de la date par un membre : ' || pg_temp.e(format('update public.offres set created_at = %L where id = %L', '2020-01-01', O)) || E'\n';
  update public.offres set price = price where id = O;
  reset role;
  r := r || 'modification du prix : date inchangée=' || ((select created_at from public.offres where id = O) = d0) || E'\n';
  perform pg_temp.qui(U); execute 'set local role authenticated';
  insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status, created_at)
  select U, 't94-' || gen_random_uuid(), product_slug, product_label, 'abidjan', 'Abidjan', 10, unit, price, 'active', '2020-01-01' from public.offres where id = O;
  reset role;
  r := r || 'nouvelle annonce datée 2020 : enregistrée le ' || (select to_char(created_at, 'YYYY-MM-DD') from public.offres where user_id = U and client_id like 't94-%') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- Résultat obtenu (24/10/2026) : modifier la date : refusé (« permission denied », déjà le cas avant) ; modifier le prix : date inchangée ;
-- nouvelle annonce envoyée avec 2020-01-01 : enregistrée le 2026-10-24 (audit T6 : 2020-01-01).
