-- Scénarios des schémas 99a à 99d (corrections du contrôle qualité du 25/10/2026, équipe serveur commandes, argent, notifications).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Chaque bloc finit par raise exception 'TEST …' : rien ne reste en base.
-- Joués deux fois le 25/10/2026 : avant les schémas 99 (l'anomalie se voit) et après (elle est corrigée). Résultats sous chaque bloc.
-- S = vendeur, B = acheteur, Cm et D = autres membres, ADM = administrateur (comptes de simulation du projet de test).
-- Outils : à lancer dans le même appel que chaque bloc (mêmes outils que CONTROLE_QUALITE/tests/sql/_outils.sql, plus l2).

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
-- lecture qui rend « ERR … » au lieu d'arrêter le bloc (colonne ou fonction absente avant les schémas 99)
create or replace function pg_temp.l2(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role';
  begin execute q into v; exception when others then v := 'ERR ' || sqlerrm; end;
  if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
create or replace function pg_temp.cs(c uuid) returns text language sql as $f$
select pg_temp.lire(format($q$select etat || '/' || etape from public.commandes where id = %L$q$, c)) $f$;
create or replace function pg_temp.verif(u uuid) returns void language plpgsql as $f$
begin execute 'reset role';
  begin insert into public.verifications (user_id, statut, piece, defi, decide_le, expire_le, numero) values (u, 'verifie', 'cni', '1234', now(), current_date + 365, 'CQ-' || left(u::text, 8));
  exception when others then null; end; end $f$;
create or replace function pg_temp.offre(s uuid, q numeric, px numeric, tag text) returns uuid language plpgsql as $f$
declare o uuid := gen_random_uuid();
begin execute 'reset role';
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o, s, 'cq-' || tag || '-' || o, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', q, 'sac', px, 'active');
  return o; end $f$;
create or replace function pg_temp.accord(s uuid, b uuid, o uuid, px numeric, q numeric) returns uuid language plpgsql as $f$
declare n uuid;
begin perform pg_temp.qui(b); n := public.nego_ouvrir('offre', o, px, q, null);
  perform pg_temp.qui(s);
  perform public.nego_agir(n, 'accord', null, null, null, pg_temp.lire(format('select dernier_msg::text from public.negociations where id = %L', n))::uuid);
  execute 'reset role'; return n; end $f$;
create or replace function pg_temp.cmd(s uuid, b uuid, n uuid, confirmer boolean) returns uuid language plpgsql as $f$
declare c uuid;
begin perform pg_temp.qui(b); c := public.commande_creer2(n, 'vendeur', null, 'Daloa', null);
  if confirmer then perform pg_temp.qui(s); perform public.commande_repondre(c, true, null); end if;
  execute 'reset role'; return c; end $f$;
create or replace function pg_temp.preuves(s uuid, c uuid) returns void language plpgsql as $f$
declare p text[] := array[s || '/cq/' || c || '-1.jpg', s || '/cq/' || c || '-2.jpg', s || '/motpapier-cq-' || c || '.jpg'];
begin perform pg_temp.qui(s); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], s, now() + interval '1 second'), ('preuves', p[2], s, now() + interval '1 second'), ('preuves', p[3], s, now() + interval '1 second');
  perform pg_temp.qui(s);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 2500);
  perform public.commande_depart_mot(c, p[3]);
  execute 'reset role'; end $f$;
create or replace function pg_temp.vieillir(n uuid, u uuid) returns void language plpgsql as $f$
begin execute 'reset role'; update public.messages set created_at = created_at - interval '10 seconds' where negociation_id = n;
  perform pg_temp.qui(u); end $f$;
create or replace function pg_temp.partir(s uuid, c uuid) returns void language plpgsql as $f$
begin perform pg_temp.preuves(s, c);
  perform pg_temp.qui(s);
  perform public.commande_avancer(c, 'chargement', null, null, null, null);
  perform public.commande_avancer(c, 'transport', null, null, null, null);
  execute 'reset role'; end $f$;

-- ══ Bloc 99-A (ANO-023, règle du propriétaire du 25/10/2026 : rien ne se déclenche avant « arrivé ») ══
-- c1 en route depuis un an (rien), retard du vendeur, relances de l'acheteur ; c2 « arrivée » de l'acheteur (règle de 1 h) ;
-- c3 mot bloqué après « livré » (équipe tout de suite) ; c4 délai de 6 h demandé par l'acheteur après « livré ».
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid; n uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; k int; res text := '';
  q_etat text := $q$select concat_ws(' ', etat || '/' || etape, 'auto=' || (litige_auto_le is not null)) from public.commandes where id = %L$q$;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'c99a');
  n := pg_temp.accord(S, B, o, 20000, 10); c1 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c1);
  n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c2);
  perform pg_temp.qui(B); perform public.commande_avancer(c2, 'arrivee', null, null, null, null);
  n := pg_temp.accord(S, B, o, 20000, 10); c3 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c3);
  perform pg_temp.qui(S); perform public.commande_avancer(c3, 'arrivee', null, null, null, null);
  perform pg_temp.qui(B);
  for k in 1..5 loop perform public.commande_reception_mot(c3, 'faux' || k, false, null, null, null); end loop;
  n := pg_temp.accord(S, B, o, 20000, 10); c4 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c4);
  perform pg_temp.qui(S); perform public.commande_avancer(c4, 'arrivee', null, null, null, null);
  execute 'reset role';
  res := 'règles=' || pg_temp.l2('select public.commandes_regles()::text');
  update public.commande_etapes set at = at - interval '365 days' where commande_id = c1;
  update public.commandes set confirme_le = confirme_le - interval '365 days', created_at = created_at - interval '365 days' where id = c1;
  perform public.commandes_delais();
  res := res || ' | c1 en route depuis 1 an: ' || pg_temp.cs(c1);
  perform pg_temp.qui(S);
  res := res || ' ; retard vendeur (panne, +2 j): ' || pg_temp.e(format('select public.commande_retard_signaler(%L, %L, now() + interval %L, null)', c1, 'panne', '2 days'))
     || ' ; retard « autre » sans texte: ' || pg_temp.e(format('select public.commande_retard_signaler(%L, %L, null, null)', c1, 'autre'))
     || ' ; le vendeur demande des nouvelles: ' || pg_temp.e(format('select public.commande_nouvelles_demander(%L)', c1));
  perform pg_temp.qui(B);
  res := res || ' ; relance 1: ' || public.commande_nouvelles_demander(c1)
     || ' ; relance 2 dans la minute: ' || public.commande_nouvelles_demander(c1);
  execute 'reset role';
  update public.commandes set nouvelles_le = nouvelles_le - interval '2 minutes' where id = c1;
  perform pg_temp.qui(B);
  res := res || ' ; relance 3 (2 min après): ' || public.commande_nouvelles_demander(c1)
     || ' ; acheteur signale un retard: ' || pg_temp.e(format('select public.commande_retard_signaler(%L, %L, null, null)', c1, 'route'))
     || ' ; suivi lu=' || pg_temp.l2(format('select json_array_length(public.commande_suivi_lire(%L))::text', c1))
     || ' ; écran: ' || pg_temp.l2(format('select concat_ws(%L, %L || (j ->> %L), %L || (j ->> %L)) from (select public.commande_delais(%L) j) x', ' ', 'nouvelles=', 'peut_demander_nouvelles', 'estimée=', 'arrivee_estimee', c1));
  execute 'reset role';
  res := res || ' ; file cmd_nouvelles=' || (select count(*) from public.notif_file where objet_id = c1::text and type = 'cmd_nouvelles')
     || ' cmd_retard=' || (select count(*) from public.notif_file where objet_id = c1::text and type = 'cmd_retard') || ' (0 sans abonnement push)';
  update public.commande_etapes set at = at - interval '31 minutes' where commande_id = c2;
  perform public.commandes_delais();
  res := res || ' | c2 arrivée acheteur +31 min: ' || pg_temp.cs(c2) || ' rappel=' || (select (rappel_reception_le is not null)::text from public.commandes where id = c2)
     || ' note=' || coalesce((select left(note, 40) from public.commande_alertes where commande_id = c2 and evenement = 'rappel_reception'), '-');
  update public.commande_etapes set at = at - interval '30 minutes' where commande_id = c2;
  perform public.commandes_delais();
  res := res || ' ; +61 min: ' || pg_temp.l2(format(q_etat, c2)) || ' journal=' || coalesce((select left(note, 60) from public.commande_etapes where commande_id = c2 and evenement = 'litige'), '-');
  update public.commandes set litige_auto_le = litige_auto_le - interval '61 minutes' where id = c2;
  perform public.commandes_delais();
  res := res || ' ; litige +61 min sans réponse: ' || pg_temp.cs(c2);
  perform public.commandes_delais();
  res := res || ' | c3 mot bloqué après livré: ' || pg_temp.l2(format(q_etat, c3));
  perform pg_temp.qui(B);
  res := res || ' | c4 délai 6 h: ' || pg_temp.e(format('select public.commande_delai_demander(%L, 6, %L, null)', c4, 'pas_sur_place'))
     || ' ; 2e délai: ' || pg_temp.e(format('select public.commande_delai_demander(%L, 2, %L, null)', c4, 'controle'))
     || ' ; 5 h demandées: ' || pg_temp.e(format('select public.commande_delai_demander(%L, 5, %L, null)', c4, 'controle'));
  execute 'reset role';
  update public.commandes set livre_le = livre_le - interval '61 minutes' where id = c4;
  perform public.commandes_delais();
  res := res || ' ; +61 min: ' || pg_temp.cs(c4);
  update public.commandes set livre_le = livre_le - interval '6 hours' where id = c4;
  perform public.commandes_delais();
  res := res || ' ; +7 h 01: ' || pg_temp.l2(format(q_etat, c4))
     || ' ; suivi=' || (select string_agg(genre || ':' || coalesce(motif, '-') || ':' || coalesce(heures::text, '-'), ',' order by at) from public.commande_suivi where commande_id in (c1, c4));
  perform pg_temp.qui(ADM);
  res := res || ' | ancien réglage livraison_litige_heures: ' || pg_temp.e($q$select public.admin_commandes_regler('{"livraison_litige_heures": 120}')$q$)
     || ' ; montant_max 5 milliards: ' || pg_temp.e($q$select public.admin_commandes_regler('{"montant_max": 5000000000}')$q$);
  raise exception 'TEST 99-A: %', res;
end $$;
-- Première version (avant la règle « rien avant arrivé ») : sans 99a, rien ; avec, c1 en route basculait en litige à 96 h (retiré).
-- Résultat (25/10/2026, projet de test, règle « rien avant arrivé ») : règles sans les délais de livraison, montant_max 1 000 000 000 ;
-- c1 en route depuis 1 an : en_cours/transport (rien) ; retard vendeur ok ; « autre » sans texte refusé ; vendeur ne peut pas demander
-- de nouvelles ; relance 1 « nouvelles_demandees », relance 2 dans la minute « nouvelles_deja », relance 3 deux minutes plus tard
-- « nouvelles_demandees » ; l'acheteur ne peut pas signaler un retard ; suivi lu 3 lignes ; écran : nouvelles=true, arrivée estimée posée ;
-- file 0 (pas d'abonnement push sur les comptes de test). c2 « arrivée » de l'acheteur : rappel à 31 min (« Arrivée signalée par
-- l'acheteur… »), litige automatique à 61 min (« Pas de réponse de l'acheteur 60 min après l'arrivée qu'il a signalée… »), clôture
-- en faveur du vendeur 61 min plus tard sans réponse. c3 mot bloqué après « livré » : litige pour l'équipe tout de suite (auto=false).
-- c4 délai de 6 h ok, 2e délai refusé (DELAI_DEJA) ; à +61 min toujours en_cours ; à +7 h 01 litige automatique.
-- Ancien réglage livraison_litige_heures refusé (inconnu) ; montant_max 5 milliards accepté.
-- ══ Bloc 99-B (ANO-024, CMD-09) : le vendeur demande l'annulation, puis charge ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; res text := '';
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'c99b');
  n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
  perform pg_temp.qui(S);
  res := 'demande: ' || public.commande_annuler_motif(c, true, null, 'prix_change', null, null);
  perform pg_temp.preuves(S, c);
  perform pg_temp.qui(S);
  res := res || ' | chargement: ' || pg_temp.e(format('select public.commande_avancer(%L, %L, null, null, null, null)', c, 'chargement')) || ' ' || pg_temp.cs(c)
     || ' annulation_par=' || pg_temp.lire(format('select coalesce(annulation_par::text, %L) || %L || coalesce(annulation_motif, %L) from public.commandes where id = %L', 'vide', ' motif=', 'vide', c))
     || ' journal=' || pg_temp.lire(format('select coalesce(string_agg(evenement || %L || coalesce(note, %L), %L order by at), %L) from public.commande_etapes where commande_id = %L and evenement like %L', ':', '', ' > ', 'aucun', c, 'annulation%'));
  perform pg_temp.qui(B);
  res := res || ' | acheteur accepte ensuite: ' || pg_temp.e(format('select public.commande_annuler_motif(%L, true, null, null, null, true)', c)) || ' ' || pg_temp.cs(c);
  raise exception 'TEST 99-B: %', res;
end $$;
-- Avant : chargement accepté, annulation_par reste rempli (motif prix_change) ; l'acheteur ne peut plus répondre (« La marchandise est chargée »).
-- Après (99a) : chargement accepté, annulation_par vide, motif vide, journal « annulation_demandee > annulation_refusee : Demande d'annulation
-- retirée : la marchandise est chargée. » ; l'acheteur n'a plus de demande à accepter (message « Choisissez un motif. », voir le rapport).

-- ══ Bloc 99-C (ANO-026, EXT-06) : vendeur banni après la confirmation ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; c2 uuid; res text := '';
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'c99c');
  n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
  n := pg_temp.accord(S, B, o, 20000, 5); c2 := pg_temp.cmd(S, B, n, true);
  res := 'avant bannissement, acheteur annule: ';
  perform pg_temp.qui(B);
  res := res || pg_temp.e(format('select public.commande_annuler_retard(%L, null)', c2));
  execute 'reset role';
  insert into public.bannis (user_id, motif) values (S, 'autre');
  perform pg_temp.qui(B);
  res := res || ' | après : écran peut_annuler=' || pg_temp.l2(format('select (public.commande_delais(%L) ->> %L)', c, 'peut_annuler_retard'));
  res := res || ' | annule: ' || pg_temp.e(format('select public.commande_annuler_retard(%L, %L)', c, 'vendeur banni')) || ' ' || pg_temp.cs(c)
     || ' stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o))
     || ' fiabilité=' || pg_temp.lire(format('select concat_ws(%L, categorie, role_imputable, motif_code, motif_texte) from public.annulations where commande_id = %L', ' ', c))
     || ' commission=' || pg_temp.lire(format('select coalesce(statut_registre, statut) from public.commissions where commande_id = %L', c));
  raise exception 'TEST 99-C: %', res;
end $$;
-- Avant : TROP_TOT (72 h) même avec le vendeur banni ; écran peut_annuler=false.
-- Après (99a) : sans bannissement TROP_TOT (inchangé) ; vendeur banni : peut_annuler=true, annulation acceptée, stock rendu (85 → 95),
-- fiabilité « abusive, vendeur, autre, Vendeur banni du Marché de Gros », commission annulée.

-- ══ Bloc 99-D (ANO-022, ANO-013, ANO-045) : 2e dépôt, anciennes « due », montant énorme ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; n uuid; c uuid; res text := ''; tot numeric; r text;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 10000, 'c99d');
  n := pg_temp.accord(S, B, o, 10000, 10); c := pg_temp.cmd(S, B, n, true);
  tot := (public._seq_repartition(c) ->> 'total')::numeric;
  r := public.sequestre_depot_confirme(c, 'orange', 'cq99-A', tot); res := 'réf. A: ' || r;
  r := public.sequestre_depot_confirme(c, 'orange', 'cq99-B', tot); res := res || ' ; réf. B: ' || r;
  r := public.sequestre_depot_confirme(c, 'orange', 'cq99-B', tot); res := res || ' ; réf. B encore: ' || r;
  r := public.sequestre_depot_confirme(c, 'orange', 'cq99-A', tot); res := res || ' ; réf. A encore: ' || r;
  res := res || ' ; séquestres=' || (select count(*) from public.sequestres where commande_id = c)
     || ' traces réf. B=' || pg_temp.l2(format('select count(*)::text from public.sequestre_depots_doubles where commande_id = %L and reference = %L', c, 'cq99-B'));
  res := res || ' | ARG-06b due sans séquestre=' || (select count(*) from public.commissions k where coalesce(k.statut_registre, k.statut) = 'due'
       and not exists (select 1 from public.sequestres q where q.commande_id = k.commande_id))
     || ' (transport ' || (select count(*) from public.commissions_transport k where coalesce(k.statut_registre, k.statut) = 'due'
       and not exists (select 1 from public.sequestres q where q.commande_id = k.commande_id)) || ')'
     || ' avant_regle=' || pg_temp.l2('select count(*)::text || '' (transport '' || (select count(*) from public.commissions_transport where avant_regle) || '')'' from public.commissions where avant_regle');
  o := pg_temp.offre(S, 999999, 999999998, 'c99d2');
  perform pg_temp.qui(B);
  res := res || ' | ARG-10b 999 999 998 F × 999 999: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 999999998, 999999, null)', 'offre', o));
  execute 'reset role';
  o := pg_temp.offre(S, 100000, 20000, 'c99d3');
  perform pg_temp.qui(B);
  res := res || ' | 20 000 F × 50 000 (= 1 milliard): ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 20000, 50000, null)', 'offre', o))
     || ' ; 20 000 F × 50 001: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 20000, 50001, null)', 'offre', o));
  raise exception 'TEST 99-D: %', res;
end $$;
-- Avant : réf. B → « bloque », aucune trace ; 51 commissions « due » sans séquestre (20 transport) ; 999 999 998 F × 999 999 accepté.
-- Après (99b, 99d) : réf. B → « depot_double », 1 trace (2e appel : pas de 2e trace), réf. A → « bloque », 1 séquestre ;
-- 0 « due » sans séquestre (0 transport), avant_regle=51 (transport 20) ; montant énorme refusé (MONTANT_MAX), 1 milliard pile accepté, 50 001 sacs refusés.

-- ══ Bloc 99-E (ANO-025, ANO-046, ANO-047 ; NOT-02, NOT-03, NOT-11d, NOT-12) ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; Cm uuid := 'e0191bd5-e039-4948-9143-6a30cfdeaf6c';
  D uuid := '86c69f98-e113-4bfb-bb2a-0bd32fba7830'; o uuid; n uuid; res text := ''; l json; j json; v_nid uuid;
begin
  perform pg_temp.verif(S);
  update public.notif_regles set calme_debut = 0, calme_fin = 0, ecart_min = 1 where id = 1;
  o := pg_temp.offre(S, 1000, 20000, 'c99e');
  insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (B, 'reponses', 'offre', 'c99e:' || o, 'c99e:' || o, o::text, 'mais', 'Maïs', 'x',
      jsonb_build_object('quantite', 1000, 'unite', 'sac', 'prix', 20000, 'ville', 'Yamoussoukro'));
  n := pg_temp.accord(S, Cm, o, 20000, 990);
  update public.offres set price = 30000 where id = o;
  l := public.notif_lots_prendre(2000);
  res := 'NOT-02/03 offre ' || (select quantity || ' sacs à ' || price from public.offres where id = o) || ' → lot envoyé: '
     || coalesce((select x ->> 'donnees' from json_array_elements(l) x where x ->> 'regroupe' = 'c99e:' || o), 'pas dans le lot');
  -- NOT-11d
  j := public.notif_preparer(D, 'commande', 'c99e-11d', 'creee', null, null, 'x', 'Commande', 'Texte');
  v_nid := (j ->> 'nid')::uuid;
  perform pg_temp.qui(B);
  res := res || ' | NOT-11d un autre membre: ' || public.notif_ouverte(v_nid, 'clic');
  perform pg_temp.qui(D);
  res := res || ' ; le destinataire: ' || public.notif_ouverte(v_nid, 'clic');
  execute 'reset role';
  update public.notif_journal set ouvert_le = null where nid = v_nid;
  perform set_config('request.jwt.claims', '', true); execute 'set local role anon';
  res := res || ' ; sans connexion (service worker): ' || public.notif_ouverte(v_nid, 'push');
  execute 'reset role';
  -- NOT-12
  update public.profils set supprime_le = now() where user_id = Cm;
  res := res || ' | NOT-12 compte supprimé : commercial=' || coalesce(public.notif_preparer(Cm, 'offres', 'c99e-12a') ->> 'raison', 'envoyer')
     || ' transactionnel=' || coalesce(public.notif_preparer(Cm, 'commande', 'c99e-12b') ->> 'raison', 'envoyer');
  raise exception 'TEST 99-E: %', res;
end $$;
-- Avant : lot envoyé {quantite 1000, prix 20000} alors que l'offre a 10 sacs à 30 000 ; un autre membre marque « ouverte » (true) ;
-- compte supprimé : transactionnel « envoyer ».
-- Après (99c) : lot envoyé {quantite 10, prix 30000} ; autre membre false, destinataire true, service worker sans connexion true ;
-- compte supprimé : commercial et transactionnel « compte_supprime ».

-- ══ Bloc 99-F (ANO-044, ANO-048 ; STK-03, STK-07f, EXT-02) ══
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d';
  o uuid; o2 uuid := gen_random_uuid(); n uuid; res text := '';
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 100, 20000, 'c99f');
  perform pg_temp.qui(B);
  res := 'prix 0,001 F: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 0.001, 10, null)', 'offre', o))
     || ' | 0,5 sac: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 20000, 0.5, null)', 'offre', o));
  execute 'reset role';
  insert into public.offres (id, user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status)
    values (o2, S, 'cq-c99f-' || o2, 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 100, 'kg', 300, 'active');
  perform pg_temp.qui(B);
  res := res || ' | 2,5 kg: ' || pg_temp.e(format('select public.nego_ouvrir(%L, %L, 300, 2.5, null)', 'offre', o2));
  execute 'reset role';
  res := res || ' | unité « camion »: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 1, %L, 5000000, %L)',
       S, 'cq-c99f-camion', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'camion', 'active'))
     || ' ; unité « tonne »: ' || pg_temp.e(format('insert into public.offres (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, price, status) values (%L, %L, %L, %L, %L, %L, 1, %L, 200000, %L)',
       S, 'cq-c99f-tonne', 'mais', 'Maïs', 'yamoussoukro', 'Yamoussoukro', 'tonne', 'active'));
  -- un bloc = une seule transaction : tous les messages auraient la même heure ; on recule les précédents de 10 s avant chaque envoi
  perform pg_temp.qui(B);
  n := public.nego_ouvrir('offre', o, 19000, 10, null);
  perform pg_temp.vieillir(n, B);
  perform public.nego_agir(n, 'texte', null, null, 'Je passe demain', null);
  perform pg_temp.vieillir(n, B);
  perform public.nego_agir(n, 'texte', null, null, 'Je passe demain', null);
  res := res || ' | EXT-02 même texte renvoyé: lignes=' || pg_temp.lire(format('select count(*)::text from public.messages where negociation_id = %L and texte = %L', n, 'Je passe demain'));
  perform pg_temp.vieillir(n, B);
  perform public.nego_agir(n, 'texte', null, null, 'Et le prix ?', null);
  perform pg_temp.vieillir(n, B);
  perform public.nego_agir(n, 'texte', null, null, 'Je passe demain', null);
  res := res || ' ; répété après un autre message: lignes=' || pg_temp.lire(format('select count(*)::text from public.messages where negociation_id = %L and texte = %L', n, 'Je passe demain'));
  raise exception 'TEST 99-F: %', res;
end $$;
-- Avant : prix 0,001 F accepté, 0,5 sac accepté, unité « camion » acceptée, même texte renvoyé → 2 lignes.
-- Après (99d) : prix 0,001 F refusé, 0,5 sac refusé, 2,5 kg accepté, « camion » refusé (offres_unite_connue), « tonne » accepté ;
-- même texte renvoyé → 1 ligne. Version sans vieillir() (tous les messages du bloc à la même heure) : le texte répété après un autre
-- message était aussi écarté (1 ligne au lieu de 2) ; vieillir() reproduit deux envois séparés. Rejouée le 25/10/2026 : 1 ligne, puis 2.
