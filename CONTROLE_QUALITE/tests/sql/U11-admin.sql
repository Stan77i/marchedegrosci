-- U11 Administration : exercices SQL reproductibles (système de contrôle MGCI, 25/10/2026).
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

-- ADM-01 (normal) : chaque action sensible de l'équipe laisse-t-elle une trace (admin_journal ou ligne signée) ?
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  Y uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c'; Z uuid := 'd353320a-68b5-4c05-83f9-b26b0b938a52'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; bad boolean := false; v text; j json; sid uuid; vid uuid; trx uuid; c1 uuid; c2 uuid; o uuid; aj int; sans_trace text := '';
begin
  -- données synthétiques
  insert into public.verifications (user_id, statut, piece, defi, expire_le, nom_saisi, numero_lu) values (Y, 'en_attente', 'cni', '2222', current_date + 300, 'Test Y', 'CQADM1') returning id into vid;
  insert into public.transporteurs (user_id, code, nom, vehicule, statut) values (X, 'T-CQA1', 'Transport CQ', 'camion', 'en_attente') returning id into trx;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ-ADM1-T', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'terminee', 'terminee', now()) returning id into c1;
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le, litige_motif)
    values ('CQ-ADM1-L', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'litige', 'arrivee', B, now(), 'Sacs abîmés') returning id into c2;
  select id into o from public.offres where user_id = S and status = 'active' limit 1;
  -- chaque action sensible : y a-t-il une trace (journal de l'équipe ou ligne signée par l'admin) ?
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_suspendre(%L, %L, 7)', X, 'CQ test abus')); select id into sid from public.sanctions where user_id = X and motif = 'CQ test abus';
  r := r || '1 suspendre: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.sanctions where id = sid and par = ADM);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_suspension_lever(%L, %L)', sid, 'Erreur de l''équipe'));
  r := r || ' | 2 lever suspension: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.sanctions where id = sid and levee_par = ADM);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_bannir(%L, %L, %L)', Z, 'arnaque', 'CQ test'));
  r := r || ' | 3 bannir: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.bannis where user_id = Z and par = ADM);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_lever_bannissement(%L)', Z));
  r := r || ' | 4 lever bannissement: ' || left(v, 25);
  v := ((select count(*) from public.admin_journal) - aj)::text;
  r := r || ' journal+' || v || ' reste une trace=' || exists (select 1 from public.bannis where user_id = Z);
  if v = '0' and not exists (select 1 from public.bannis where user_id = Z) then sans_trace := sans_trace || 'lever_bannissement '; end if;
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_identite_decider(%L, %L, null, null, %L, %L)', vid, 'verifie', current_date + 300, 'CQADM1'));
  r := r || ' | 5 identité vérifiée: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.verifications where id = vid and decide_par = ADM);
  v := pg_temp.en(ADM, format('select public.admin_identite_decider(%L, %L, %L, null, null, null)', vid, 'refuse', 'Changement d''avis'));
  r := r || ' ; puis refusée: statut=' || (select statut from public.verifications where id = vid) || ' trace de la 1re décision=' || exists (select 1 from public.admin_journal where cible_id = Y);
  if not exists (select 1 from public.admin_journal where cible_id = Y) then sans_trace := sans_trace || 'identite_decider(historique) '; end if;
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_transporteur_decider(%L, %L, null)', trx, 'verifie'));
  r := r || ' | 6 transporteur vérifié: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.transporteurs where id = trx and decide_par = ADM);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, 'select public.admin_fiabilite_regler(''{"suspension_jours": 9}''::jsonb)');
  r := r || ' | 7 règle fiabilité: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.reglages where cle = 'fiabilite' and maj_par = ADM and maj_le > now() - interval '1 minute');
  if not exists (select 1 from public.reglages where cle = 'fiabilite' and maj_par = ADM and maj_le > now() - interval '1 minute') and (select count(*) from public.admin_journal) = aj then sans_trace := sans_trace || 'fiabilite_regler '; end if;
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, 'select public.admin_commandes_regler(''{"litige_heures": 2}''::jsonb)');
  r := r || ' | 8 règle commandes: ' || left(v, 40) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.reglages where maj_par = ADM and maj_le > now() - interval '1 minute' and cle ~ 'command');
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_liberer(%L, %L)', c1, 'Clôture par l''équipe'));
  r := r || ' | 9 libérer: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.commande_etapes where commande_id = c1 and par = ADM and role = 'admin');
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c2, 'terminee', 'Photos de départ propres', 'acheteur'));
  r := r || ' | 10 trancher litige: ' || left(v, 30) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' signé=' || exists (select 1 from public.commande_etapes where commande_id = c2 and par = ADM);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_annonce_maintenir(%L, %L, %L)', 'offre', o, 'CQ'));
  r := r || ' | 11 annonce maintenue: ' || left(v, 30) || ' journal+' || ((select count(*) from public.admin_journal) - aj);
  aj := (select count(*) from public.admin_journal);
  v := pg_temp.en(ADM, format('select public.admin_diffuser(%L)', 'CQ message à tous'));
  r := r || ' | 12 message à tous: ' || left(v, 25) || ' journal+' || ((select count(*) from public.admin_journal) - aj) || ' messages=' || (select count(*) from public.dm where auteur_id = ADM and texte = 'CQ message à tous');
  r := r || ' || actions sans aucune trace : ' || coalesce(nullif(sans_trace, ''), 'aucune');
  if sans_trace <> '' then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST ECHEC : admin_journal +0 pour les 12 actions ; signées dans leur table : suspension, levée, bannissement, identité, transporteur, réglages, clôture, litige, message à tous (99 messages) ;
-- SANS AUCUNE TRACE : levée du bannissement (ligne effacée) et 1re décision d'identité écrasée par la 2e. admin_annonce_maintenir non testé (aucun masquage en attente).

-- ADM-02 (limite + erreur + malveillant) : valeurs absurdes dans les réglages et sanctions ; l'admin juge un litige où il est partie
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922'; ADM2 uuid;
  r text := ''; bad boolean := false; v text; q text; attendu text; i int; c uuid; avant jsonb;
  cas text[][] := array[
    array['select public.admin_fiabilite_regler(''{"suspension_jours": 0}''::jsonb)', 'ERR'],
    array['select public.admin_fiabilite_regler(''{"suspension_jours": -7}''::jsonb)', 'ERR'],
    array['select public.admin_fiabilite_regler(''{"suspension_jours": 100000}''::jsonb)', 'ERR'],
    array['select public.admin_fiabilite_regler(''{"suspension_jours": "7; select 1"}''::jsonb)', 'ERR'],
    array['select public.admin_fiabilite_regler(''{"cle_inconnue": 3}''::jsonb)', 'ERR'],
    array['select public.admin_commandes_regler(''{"litige_heures": 0}''::jsonb)', 'ERR'],
    array['select public.admin_commandes_regler(''{"litige_heures": -5}''::jsonb)', 'ERR'],
    array['select public.admin_commandes_regler(''{"litige_heures": 1000000}''::jsonb)', 'ERR'],
    array['select public.admin_annonces_regler(''{"duree_jours": 0}''::jsonb)', 'ERR'],
    array['select public.admin_annonces_regler(''{"duree_jours": -1}''::jsonb)', 'ERR'],
    array['select public.admin_niveaux_regle_modifier(''vendeur'', ''fiable'', ''{"commandes": -1}''::jsonb)', 'ERR'],
    array['select public.notif_regles_regler(-1, 4, 21, 7)', 'ERR'],
    array['select public.notif_regles_regler(8, 4, 25, 7)', 'ERR'],
    array['select public.admin_suspendre(''1bfd5713-2525-44a6-8403-084ebb9ddad3'', ''motif'', 0)', 'ERR'],
    array['select public.admin_suspendre(''1bfd5713-2525-44a6-8403-084ebb9ddad3'', ''motif'', -3)', 'ERR'],
    array['select public.admin_suspendre(''1bfd5713-2525-44a6-8403-084ebb9ddad3'', ''motif'', 100000)', 'ERR'],
    array['select public.admin_suspendre(''1bfd5713-2525-44a6-8403-084ebb9ddad3'', '''', 7)', 'ERR'],
    array['select public.admin_suspendre(''981961d4-25ba-4e1b-a732-8fd68cd6c922'', ''se suspendre soi-même'', 7)', 'ERR'],
    array['select public.admin_bannir(''981961d4-25ba-4e1b-a732-8fd68cd6c922'', ''autre'', ''soi-même'')', 'ERR'],
    array['select public.admin_diffuser('''')', 'ERR'],
    array['select public.admin_diffuser(repeat(''a'', 2001))', 'ERR'],
    array['select public.admin_transporteur_decider(''00000000-0000-0000-0000-000000000000'', ''verifie'', null)', 'ERR'],
    array['select public.admin_transporteur_decider(null, ''refuse'', '''')', 'ERR']
  ];
begin
  avant := (select jsonb_object_agg(cle, valeur) from public.reglages);
  for i in 1 .. array_length(cas, 1) loop
    q := cas[i][1]; attendu := cas[i][2];
    v := pg_temp.en(ADM, q);
    if (attendu = 'ok') <> (v = 'ok') then bad := true; r := r || ' | ' || i || ' ACCEPTE (attendu refus): ' || left(q, 75); else r := r || ' | ' || i || ':' || left(v, 32); end if;
  end loop;
  r := r || ' || réglages modifiés par des valeurs refusées=' || ((select jsonb_object_agg(cle, valeur) from public.reglages) <> avant);
  -- conflit d'intérêts : l'admin tranche un litige sur une commande où il est lui-même vendeur
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le, litige_motif)
    values ('CQ-ADM2', ADM, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'litige', 'arrivee', B, now(), 'Sacs abîmés') returning id into c;
  v := pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c, 'terminee', 'Je me donne raison', 'acheteur'));
  r := r || ' || admin juge son propre litige: ' || left(v, 60) || ' -> ' || (select etat from public.commandes where id = c);
  if v = 'ok' then bad := true; r := r || ' [CONFLIT D''INTÉRÊTS NON BLOQUÉ]'; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST ECHEC : 23/23 valeurs absurdes refusées, réglages inchangés ; MAIS l'admin tranche son propre litige (accepté).

-- ADM-03 (concurrent + panne dans une transaction) : double suspension, double clôture, décisions de litige invalides
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; X uuid := 'ca27004f-17de-494a-8db8-8c85a7cbd65c';
  ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  r text := ''; bad boolean := false; v text; c1 uuid; c2 uuid; av text; ap text;
begin
  -- double suspension du même membre (double clic)
  r := r || 'suspendre 1: ' || pg_temp.en(ADM, format('select public.admin_suspendre(%L, %L, 7)', X, 'CQ double 1'))
     || ' ; suspendre 2: ' || left(pg_temp.en(ADM, format('select public.admin_suspendre(%L, %L, 7)', X, 'CQ double 2')), 60);
  -- lecture dans une instruction à part (une sous-requête de la même expression lit l'état d'avant l'appel)
  r := r || ' ; suspensions actives=' || (select count(*) from public.sanctions where user_id = X and type = 'suspension' and levee_le is null and fin > now());
  if (select count(*) from public.sanctions where user_id = X and type = 'suspension' and levee_le is null and fin > now()) > 1 then bad := true; r := r || ' [DOUBLE SUSPENSION]'; end if;
  -- double clôture par l'équipe
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, termine_le)
    values ('CQ-ADM3-T', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'terminee', 'terminee', now()) returning id into c1;
  r := r || ' | libérer 1: ' || pg_temp.en(ADM, format('select public.admin_liberer(%L, %L)', c1, 'Clôture équipe'))
     || ' ; libérer 2: ' || left(pg_temp.en(ADM, format('select public.admin_liberer(%L, %L)', c1, 'Clôture équipe')), 50);
  r := r || ' ; étapes terminee par admin=' || (select count(*) from public.commande_etapes where commande_id = c1 and role = 'admin');
  if (select count(*) from public.commande_etapes where commande_id = c1 and role = 'admin') <> 1 then bad := true; end if;
  -- panne : décision de litige avec une issue inconnue, puis avec un fautif inconnu : rien ne doit changer
  insert into public.commandes (numero, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant, mode_transport, etat, etape, litige_par, litige_le, litige_motif)
    values ('CQ-ADM3-L', S, B, B, 'mais', 10, 'sac', 20000, 200000, 'vendeur', 'litige', 'arrivee', B, now(), 'Sacs abîmés') returning id into c2;
  av := (select concat_ws('|', etat, etape, libere_le, termine_le, (select count(*) from public.commande_etapes where commande_id = c2), (select count(*) from public.annulations where commande_id = c2)) from public.commandes where id = c2);
  r := r || ' | litige issue inconnue: ' || left(pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c2, 'nimporte', 'note', 'acheteur')), 45)
     || ' ; fautif inconnu: ' || left(pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c2, 'annulee', 'note', 'pirate')), 45)
     || ' ; sans note: ' || left(pg_temp.en(ADM, format('select public.admin_litige_clore(%L, %L, %L, %L)', c2, 'terminee', '', 'acheteur')), 45);
  ap := (select concat_ws('|', etat, etape, libere_le, termine_le, (select count(*) from public.commande_etapes where commande_id = c2), (select count(*) from public.annulations where commande_id = c2)) from public.commandes where id = c2);
  r := r || ' ; rien à moitié=' || (av = ap);
  if av <> ap then bad := true; end if;
  raise exception '%: %', case when bad then 'TEST ECHEC' else 'TEST OK' end, r;
end $$;
-- Résultat (25/10/2026) : TEST OK : « déjà suspendu », « Rien à clôturer », 3 décisions invalides refusées, rien à moitié.
-- ADM-04 (malveillant) et ADM-05 (régression) : voir SEC-04 dans securite-u02-scenarios.sql (61 fonctions admin_* appelées par un membre : 59 refus + 2 compteurs à 0 ; jeton service_role sans effet).
