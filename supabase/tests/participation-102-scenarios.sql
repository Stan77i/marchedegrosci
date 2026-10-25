-- Scénarios des schémas 102a et 102b : participation de l'acheteur après un problème (règle du propriétaire du 25/10/2026).
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Le bloc finit par raise exception 'TEST …' : rien ne reste en base.
-- Joué deux fois le 25/10/2026 : avant les schémas 102 (les fonctions n'existent pas) et après. Résultats sous le bloc.
-- S = vendeur, B = acheteur, ADM = administrateur (comptes de simulation du projet de test).
-- Outils : à lancer dans le même appel que le bloc (repris de corrections-99-scenarios.sql).

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

-- ══ Bloc 102-A : participation de l'acheteur (le même bloc est joué avant et après les schémas 102) ══
-- c1 « partie » proposée à l'arrivée (ouvre le litige), double appui, contrôles de rôle, acceptée : commande terminée, commission
--    calculée sur la part gardée, aucun litige perdu ; c2 « montant » : contrôles, refus, nouvelle proposition, retrait, plafond de 3 ;
-- c3 litige automatique : la proposition est une réaction (pas de clôture pour le vendeur), puis sans réponse du vendeur elle expire ;
-- c4 en route : refusée ; c5 l'équipe tranche pendant une proposition ouverte : caduque ; c6 « transport » (transport à part).
do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid; n uuid; c1 uuid; c2 uuid; c3 uuid; c4 uuid; c5 uuid; c6 uuid; res text := '';
  q_cmd text := $q$select concat_ws(' ', etat || '/' || etape, 'refusé=' || montant_refuse, 'total=' || total_convenu, 'initial=' || total_initial, 'lib=' || liberation) from public.commandes where id = %L$q$;
  q_com text := $q$select coalesce(statut_registre, statut) || ' base=' || montant_vente || ' com=' || commission from public.commissions where commande_id = %L$q$;
  q_ann text := $q$select count(*)::text from public.annulations where commande_id = %L$q$;
  q_part text := $q$select string_agg(mode || ':' || montant || ':' || statut, ',' order by id) from public.commande_participations where commande_id = %L$q$;
begin
  perform pg_temp.verif(S);
  o := pg_temp.offre(S, 1000, 20000, 'p102');
  n := pg_temp.accord(S, B, o, 20000, 10); c1 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c1);
  n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c2);
  n := pg_temp.accord(S, B, o, 20000, 10); c3 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c3);
  n := pg_temp.accord(S, B, o, 20000, 10); c4 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c4);
  n := pg_temp.accord(S, B, o, 20000, 10); c5 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c5);
  n := pg_temp.accord(S, B, o, 20000, 10); c6 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c6);
  perform pg_temp.qui(S);
  perform public.commande_avancer(c1, 'arrivee', null, null, null, null);
  perform public.commande_avancer(c2, 'arrivee', null, null, null, null);
  perform public.commande_avancer(c3, 'arrivee', null, null, null, null);
  perform public.commande_avancer(c5, 'arrivee', null, null, null, null);
  perform public.commande_avancer(c6, 'arrivee', null, null, null, null);
  execute 'reset role';
  update public.commandes set transport_regle = 'a_part', prix_transport = 3000, total_convenu = montant + 3000 where id = c6;

  -- c1 : « partie », 6 sacs gardés sur 10 à 20 000 F
  perform pg_temp.qui(B);
  res := 'c1 sans motif: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, 6, null, null)', c1, 'partie'))
     || ' ; 11 sacs: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, 11, null, %L)', c1, 'partie', '4 sacs mouillés'))
     || ' ; 6 sacs: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, 6, null, %L)', c1, 'partie', '4 sacs mouillés'))
     || ' ; double appui: ' || pg_temp.l2(format('select public.commande_participation_proposer(%L, %L, 6, null, null)::json ->> %L', c1, 'partie', 'statut'))
     || ' ; autre pendant ouverte: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, 5, null, null)', c1, 'partie'))
     || ' ; état=' || pg_temp.cs(c1)
     || ' ; acheteur répond: ' || pg_temp.e(format('select public.commande_participation_repondre(%L, true, null)', c1));
  perform pg_temp.qui(S);
  res := res || ' ; vendeur propose: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 1000, null)', c1, 'montant'))
     || ' ; vendeur accepte: ' || pg_temp.e(format('select public.commande_participation_repondre(%L, true, null)', c1))
     || ' ; 2e appui: ' || pg_temp.l2(format('select public.commande_participation_repondre(%L, true, null)::json ->> %L', c1, 'statut'))
     || ' | après: ' || pg_temp.l2(format(q_cmd, c1)) || ' ; commission ' || pg_temp.l2(format(q_com, c1))
     || ' ; litiges perdus=' || pg_temp.l2(format(q_ann, c1)) || ' ; journal=' || pg_temp.l2(format($q$select left(note, 70) from public.commande_etapes where commande_id = %L and evenement = 'terminee' order by at desc limit 1$q$, c1));

  -- c2 : « montant »
  perform pg_temp.qui(B);
  res := res || ' || c2 transport sans prix à part: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, null, %L)', c2, 'transport', 'cassé'))
     || ' ; 0 F: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 0, %L)', c2, 'montant', 'cassé'))
     || ' ; 250 000 F (> total): ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 250000, %L)', c2, 'montant', 'cassé'))
     || ' ; 50 000 F: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 50000, %L)', c2, 'montant', 'cassé'));
  perform pg_temp.qui(S);
  res := res || ' ; vendeur refuse: ' || pg_temp.l2(format('select public.commande_participation_repondre(%L, false, %L)::json ->> %L', c2, 'Trop peu', 'statut'))
     || ' ; état=' || pg_temp.cs(c2);
  perform pg_temp.qui(B);
  res := res || ' ; 2e proposition 80 000: ' || pg_temp.l2(format('select public.commande_participation_proposer(%L, %L, null, 80000, null)::json ->> %L', c2, 'montant', 'statut'))
     || ' ; retrait: ' || pg_temp.l2(format('select public.commande_participation_retirer(%L)::json ->> %L', c2, 'statut'))
     || ' ; 2e retrait: ' || pg_temp.l2(format('select public.commande_participation_retirer(%L)::json ->> %L', c2, 'statut'))
     || ' ; 3e: ' || pg_temp.l2(format('select public.commande_participation_proposer(%L, %L, null, 90000, null)::json ->> %L', c2, 'montant', 'statut'))
     || ' ; retrait: ' || pg_temp.l2(format('select public.commande_participation_retirer(%L)::json ->> %L', c2, 'statut'))
     || ' ; 4e: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 95000, null)', c2, 'montant'))
     || ' ; écran acheteur: ' || pg_temp.l2(format($q$select concat_ws(' ', 'proposer=' || (j ->> 'peut_proposer'), 'restantes=' || (j ->> 'restantes'), 'n=' || json_array_length(j -> 'propositions')) from (select public.commande_participation_lire(%L) j) x$q$, c2))
     || ' ; suivi=' || pg_temp.l2(format('select json_array_length(public.commande_suivi_lire(%L))::text', c2))
     || ' ; ' || pg_temp.l2(format(q_part, c2));

  -- c3 : litige automatique, l'acheteur propose pendant ce litige
  execute 'reset role';
  update public.commandes set livre_le = livre_le - interval '61 minutes' where id = c3;
  perform public.commandes_delais();
  res := res || ' || c3 +61 min: ' || pg_temp.l2(format($q$select etat || ' auto=' || (litige_auto_le is not null) from public.commandes where id = %L$q$, c3));
  perform pg_temp.qui(B);
  res := res || ' ; proposition 100 000 sans motif: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 100000, null)', c3, 'montant'));
  execute 'reset role';
  update public.commandes set litige_auto_le = litige_auto_le - interval '61 minutes' where id = c3;
  perform public.commandes_delais();
  res := res || ' ; litige +61 min: ' || pg_temp.cs(c3);
  begin
    update public.commande_participations set echeance = now() - interval '1 minute' where commande_id = c3 and statut = 'ouverte';
    res := res || ' ; 24 h sans réponse: ' || pg_temp.l2('select public.participations_delais()::text') || ' ' || pg_temp.l2(format(q_part, c3)) || ' état=' || pg_temp.cs(c3);
  exception when others then res := res || ' ; 24 h: ERR ' || sqlerrm;
  end;

  -- c4 : en route
  perform pg_temp.qui(B);
  res := res || ' || c4 en route: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, null, 1000, %L)', c4, 'montant', 'rien reçu'));

  -- c5 : proposition ouverte, l'équipe tranche (partage)
  res := res || ' || c5 proposition: ' || pg_temp.e(format('select public.commande_participation_proposer(%L, %L, 8, null, %L)', c5, 'partie', '2 sacs cassés'));
  perform pg_temp.qui(ADM);
  res := res || ' ; équipe partage: ' || pg_temp.e(format('select public.admin_litige_partager(%L, 2, %L)', c5, 'Deux sacs cassés'));
  perform pg_temp.qui(S);
  res := res || ' ; ' || pg_temp.l2(format(q_part, c5)) || ' ; vendeur répond après: ' || pg_temp.e(format('select public.commande_participation_repondre(%L, true, null)', c5));

  -- c6 : « transport » (3 000 F à part)
  perform pg_temp.qui(B);
  res := res || ' || c6 transport: ' || pg_temp.l2(format('select public.commande_participation_proposer(%L, %L, null, null, %L)::json ->> %L', c6, 'transport', 'tout est gâté', 'montant'));
  perform pg_temp.qui(S);
  res := res || ' ; accepté: ' || pg_temp.l2(format('select public.commande_participation_repondre(%L, true, null)::json ->> %L', c6, 'statut'))
     || ' ; ' || pg_temp.l2(format(q_cmd, c6)) || ' ; commission ' || pg_temp.l2(format(q_com, c6)) || ' ; litiges perdus=' || pg_temp.l2(format(q_ann, c6));
  execute 'reset role';
  res := res || ' || règles=' || pg_temp.l2($q$select (j ->> 'participation_reponse_heures') || '/' || (j ->> 'participation_max') from (select public.commandes_regles() j) x$q$);
  perform pg_temp.qui(ADM);
  res := res || ' ; admin participation_max 20: ' || pg_temp.e($q$select public.admin_commandes_regler('{"participation_max": 20}')$q$);
  raise exception 'TEST 102-A: %', res;
end $$;
-- Résultat AVANT les schémas 102 (25/10/2026, projet de test) : toutes les fonctions de participation n'existent pas ; c3 (litige
-- automatique) est clos en faveur du vendeur 61 min après (terminee/terminee) ; réglage participation_max inconnu.
-- Résultat APRÈS 102a et 102b (25/10/2026, projet de test) :
-- c1 : sans motif refusé (« Expliquez le problème ») ; 11 sacs sur 10 refusé ; 6 sacs ok (litige/arrivee, auteur l'acheteur) ;
--      double appui « deja_proposee » ; autre proposition pendant qu'une attend : PARTICIPATION_OUVERTE ; l'acheteur ne peut pas
--      répondre, le vendeur ne peut pas proposer (« Commande introuvable ») ; vendeur accepte : ok, 2e appui « acceptee » ;
--      commande terminee/terminee, montant_refuse 80 000, total 120 000, total initial 200 000, liberation « refus » ;
--      commission calculee base 120 000, 4 200 F ; 0 litige perdu ; journal « Participation de l'acheteur acceptée… 120 000 F ».
-- c2 : « transport » sans prix à part refusé ; 0 F et 250 000 F refusés (« au plus 200 000 ») ; 50 000 ok ; refusée par le
--      vendeur (litige/arrivee) ; 80 000 proposée puis retirée, 2e retrait « retiree » ; 90 000 proposée puis retirée ; 4e :
--      PARTICIPATION_MAX ; écran : peut_proposer false, restantes 0, 3 propositions ; suivi 3 lignes.
-- c3 : litige automatique à 61 min ; proposition 100 000 sans motif ok ; 61 min plus tard : toujours litige/arrivee (plus de
--      clôture pour le vendeur) ; échéance passée : participations_delais → 1 expirée, commande toujours en litige (équipe).
-- c4 : en route : PARTICIPATION_ETAT.
-- c5 : proposition « partie » 8 sacs, l'équipe partage : proposition caduque ; le vendeur ne peut plus répondre (PARTICIPATION_AUCUNE).
-- c6 : « transport » 3 000 F proposé et accepté : terminee, montant_refuse 200 000, total 3 000, total initial 203 000 ;
--      commission annulee base 0 (jamais de commission sur le transport) ; 0 litige perdu.
-- Réglages : 24 h / 3 ; participation_max 20 refusé (de 1 à 10).
