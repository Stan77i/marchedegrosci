-- Tests des corrections du contrôle qualité (schémas 98a et 98b, 25/10/2026). Projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- LOG-10 : pas de suppression du compte avec une commande en cours, un litige, un accord sans commande ou une suspension.
-- LOG-12 : un membre suspendu (ou son partenaire) ne peut plus proposer un prix ni conclure un accord.
-- Chaque bloc finit par raise exception 'TEST …' : tout est annulé, rien ne reste dans la base.
-- Comptes de simulation du projet de test (aucune donnée réelle). Les résultats obtenus sont écrits sous chaque bloc.

-- outils (à lancer avec chaque bloc, dans le même appel)
create or replace function pg_temp.qui(u uuid) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); $f$;
create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;

-- Bloc 1 : LOG-10, suppression du compte
do $$
declare V uuid := '9e4efebe-bed1-43e4-a121-6e3033ab2bf0';   -- vendeur avec 4 commandes ouvertes
  X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';          -- membre sans commande
  NG uuid := 'de41185e-405d-4cdb-b8fe-2b8d30f5765e'; A uuid; P uuid; r text := '';
begin
  select auteur_id, proprio_id into A, P from public.negociations where id = NG;
  set local role authenticated;
  perform pg_temp.qui(V);
  r := r || 'E vendeur, 4 commandes ouvertes : ' || pg_temp.e('select public.supprimer_compte()') || E'\n';
  reset role;
  r := r || '  commandes encore ouvertes : ' || (select string_agg(distinct etat, ',') from public.commandes where V in (vendeur_id, acheteur_id) and etat in ('a_confirmer', 'en_cours', 'litige'))
     || ' ; compte supprimé=' || ((select supprime_le from public.profils where user_id = V) is not null) || E'\n';
  set local role authenticated;
  perform pg_temp.qui(P);
  r := r || 'G accord conclu : ' || pg_temp.e(format('select public.nego_agir(%L, %L)', NG, 'accord')) || E'\n';
  r := r || 'G proprio, accord sans commande : ' || pg_temp.e('select public.supprimer_compte()') || E'\n';
  reset role;
  insert into public.sanctions (user_id, type, debut, fin, motif) values (X, 'suspension', now(), now() + interval '7 days', 'TEST');
  set local role authenticated;
  perform pg_temp.qui(X);
  r := r || 'H membre suspendu sans commande : ' || pg_temp.e('select public.supprimer_compte()') || E'\n';
  r := r || 'H vérification sans rien faire : ' || coalesce(public.compte_suppression_verifier(), 'null') || E'\n';
  r := r || 'porte appelable par un membre : ' || pg_temp.e('select public._supprimer_compte_effacer()') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- AVANT 98a (25/10/2026) : E ok (compte supprimé=true, commande restée en_cours) ; G accord conclu ok, suppression ok ; H ok.
-- APRÈS 98a (25/10/2026) : E « COMPTE_OCCUPE : Terminez d’abord vos commandes en cours : 4 commandes. » (compte supprimé=false,
-- commande toujours en_cours) ; G « … : 1 accord sans commande. » ; H « COMPTE_SUSPENDU : votre compte est suspendu
-- pour l'instant. Vous pourrez le supprimer à la fin de la suspension. » (même texte par compte_suppression_verifier) ;
-- porte : « permission denied for function _supprimer_compte_effacer ».

-- Bloc 2 : LOG-10, membre sans rien en cours : la suppression reste possible
do $$
declare X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c'; r text := '';
begin
  set local role authenticated;
  perform pg_temp.qui(X);
  r := r || 'F vérification : ' || coalesce(public.compte_suppression_verifier(), 'null') || E'\n';
  r := r || 'F sans commande : ' || pg_temp.e('select public.supprimer_compte()') || E'\n';
  reset role;
  r := r || '  supprime_le rempli=' || ((select supprime_le from public.profils where user_id = X) is not null)
     || ' banni=' || ((select banned_until from auth.users where id = X) = 'infinity') || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- APRÈS 98a (25/10/2026) : F vérification null ; suppression ok ; supprime_le rempli=true banni=true (non-régression).

-- Bloc 3 : LOG-12, suspension pendant une négociation (proposition de A en attente, P doit répondre)
do $$
declare NG uuid := 'de41185e-405d-4cdb-b8fe-2b8d30f5765e'; A uuid; P uuid; r text := ''; s uuid;
begin
  select auteur_id, proprio_id into A, P from public.negociations where id = NG;
  -- A : l'auteur de la proposition est suspendu, P accepte
  insert into public.sanctions (user_id, type, debut, fin, motif) values (A, 'suspension', now(), now() + interval '7 days', 'TEST') returning id into s;
  set local role authenticated;
  perform pg_temp.qui(P);
  r := r || 'A partenaire suspendu, accord : ' || pg_temp.e(format('select public.nego_agir(%L, %L)', NG, 'accord')) || E'\n';
  reset role;
  r := r || '  statut=' || (select statut from public.negociations where id = NG) || E'\n';
  set local role authenticated;
  r := r || 'A2 partenaire suspendu, contre-proposition : ' || pg_temp.e(format('select public.nego_agir(%L, %L, 1000)', NG, 'prix')) || E'\n';
  perform pg_temp.qui(A);
  r := r || 'C suspendu, nouvelle proposition : ' || pg_temp.e(format('select public.nego_agir(%L, %L, 1000)', NG, 'prix')) || E'\n';
  r := r || 'C2 suspendu, simple message : ' || pg_temp.e(format('select public.nego_agir(%L, %L, null, null, %L)', NG, 'texte', 'Bonjour')) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- AVANT 98b (25/10/2026) : A accord ok (statut=conclue : accord avec un membre suspendu) ; A2 et C refusés seulement parce que c'est conclu ; C2 ok.
-- APRÈS 98b (25/10/2026) : A « Ce membre est suspendu pour l'instant : pas de nouvel accord avec lui. » (statut=ouverte) ;
-- A2 « … pas de nouvelle proposition avec lui. » ; C « COMPTE_SUSPENDU : votre compte est suspendu pour l'instant. Vos commandes
-- en cours continuent. » ; C2 simple message : ok.

-- Bloc 4 : LOG-12, celui qui accepte est lui-même suspendu ; puis sans suspension (non-régression)
do $$
declare NG uuid := 'de41185e-405d-4cdb-b8fe-2b8d30f5765e'; A uuid; P uuid; r text := '';
begin
  select auteur_id, proprio_id into A, P from public.negociations where id = NG;
  set local role authenticated;
  perform pg_temp.qui(P);
  r := r || 'D0 sans suspension, contre-proposition : ' || pg_temp.e(format('select public.nego_agir(%L, %L, 1000)', NG, 'prix')) || E'\n';
  perform pg_temp.qui(A);
  r := r || 'D sans suspension, accord : ' || pg_temp.e(format('select public.nego_agir(%L, %L)', NG, 'accord')) || E'\n';
  reset role;
  r := r || '  statut=' || (select statut from public.negociations where id = NG) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- APRÈS 98b (25/10/2026) : D0 ok ; D ok, statut=conclue (non-régression).

do $$
declare NG uuid := 'de41185e-405d-4cdb-b8fe-2b8d30f5765e'; A uuid; P uuid; r text := '';
begin
  select auteur_id, proprio_id into A, P from public.negociations where id = NG;
  insert into public.sanctions (user_id, type, debut, fin, motif) values (P, 'suspension', now(), now() + interval '7 days', 'TEST');
  set local role authenticated;
  perform pg_temp.qui(P);
  r := r || 'B suspendu, accepte : ' || pg_temp.e(format('select public.nego_agir(%L, %L)', NG, 'accord')) || E'\n';
  r := r || 'B2 suspendu, refuse : ' || pg_temp.e(format('select public.nego_agir(%L, %L)', NG, 'refus')) || E'\n';
  raise exception E'TEST\n%', r;
end $$;
-- AVANT 98b (25/10/2026) : B accepte ok (accord conclu par un membre suspendu) ; B2 refusé parce que c'est conclu.
-- APRÈS 98b (25/10/2026) : B « COMPTE_SUSPENDU : votre compte est suspendu pour l'instant. Vos commandes en cours continuent. » ;
-- B2 refuser reste possible : ok.
