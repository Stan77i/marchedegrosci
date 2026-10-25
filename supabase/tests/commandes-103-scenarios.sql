-- Scénarios des schémas 103a, 103b, 103c (15 propositions validées par le propriétaire le 25/10/2026, et qui paie le transport
-- quand la marchandise est refusée). Projet de TEST seulement (yowdymdnoiubatxlwhfv).
-- Un seul appel : les outils, puis un bloc qui joue chaque proposition dans son propre sous-bloc (point de reprise) ;
-- chaque sous-bloc finit par raise exception 'FIN' (tout ce qu'il a écrit est annulé), et le bloc entier finit par
-- raise exception 'TEST 103 …' avec tous les résultats : rien ne reste en base.
-- Joué deux fois le 25/10/2026 : avant les schémas 103 (la règle n'est pas encore là) et après. Résultats en bas du fichier.
-- S = vendeur, B = acheteur, ADM = administrateur (comptes de simulation du projet de test, comme les tests 99).

create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.v(q text) returns text language plpgsql as $f$
declare x text; begin execute q into x; return coalesce(x, 'NULL'); exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role';
  begin execute q into v; exception when others then v := 'ERR ' || sqlerrm; end;
  if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
create or replace function pg_temp.cs(c uuid) returns text language sql as $f$
select pg_temp.lire(format($q$select etat || '/' || etape || ' auto=' || (litige_auto_le is not null) from public.commandes where id = %L$q$, c)) $f$;
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
-- clock_timestamp : le journal des étapes est horodaté à l'horloge (le bloc dure plusieurs secondes)
create or replace function pg_temp.preuves(s uuid, c uuid) returns void language plpgsql as $f$
declare p text[] := array[s || '/cq/' || c || '-1.jpg', s || '/cq/' || c || '-2.jpg', s || '/motpapier-cq-' || c || '.jpg'];
begin perform pg_temp.qui(s); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], s, clock_timestamp() + interval '1 second'), ('preuves', p[2], s, clock_timestamp() + interval '1 second'), ('preuves', p[3], s, clock_timestamp() + interval '1 second');
  perform pg_temp.qui(s);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 2500);
  perform public.commande_depart_mot(c, p[3]);
  execute 'reset role'; end $f$;
create or replace function pg_temp.partir(s uuid, c uuid) returns void language plpgsql as $f$
begin perform pg_temp.preuves(s, c);
  perform pg_temp.qui(s);
  perform public.commande_avancer(c, 'chargement', null, null, null, null);
  perform public.commande_avancer(c, 'transport', null, null, null, null);
  execute 'reset role'; end $f$;
-- marchandise en route, puis « livré » déclaré par le vendeur
create or replace function pg_temp.arrive(s uuid, c uuid) returns void language plpgsql as $f$
begin perform pg_temp.partir(s, c); perform pg_temp.qui(s);
  perform public.commande_avancer(c, 'arrivee', null, null, null, null); execute 'reset role'; end $f$;
create or replace function pg_temp.photo(u uuid, nom text) returns text language plpgsql as $f$
declare p text := u || '/cq103/' || nom || '-' || gen_random_uuid() || '.jpg';
begin execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p, u, now()); return p; end $f$;
create or replace function pg_temp.mot(c uuid) returns text language sql as $f$
select pg_temp.lire(format('select mot_secret from public.commandes where id = %L', c)) $f$;
create or replace function pg_temp.annul(c uuid) returns text language sql as $f$
select pg_temp.lire(format($q$select coalesce((select concat_ws(' ', categorie, coalesce(role_imputable, 'personne'), chemin) from public.annulations where commande_id = %L), 'aucune ligne')$q$, c)) $f$;
create or replace function pg_temp.rep(c uuid, cles text) returns text language sql as $f$
select pg_temp.lire(format($q$select string_agg(k || '=' || coalesce(j ->> k, 'NULL'), ' ') from (select public._seq_repartition(%L) j) x, unnest(string_to_array(%L, ',')) k$q$, c, cles)) $f$;

do $$
declare S uuid := '1bfd5713-2525-44a6-8403-084ebb9ddad3'; B uuid := '68345d7a-9d64-410a-a4c7-92a750d9888d'; ADM uuid := '981961d4-25ba-4e1b-a732-8fd68cd6c922';
  o uuid; n uuid; c uuid; c2 uuid; c3 uuid; res text := ''; x text; p1 text; p2 text;
begin
  perform pg_temp.verif(S);

  -- ══ n° 1 : « arrivé » entre 21 h et 7 h : l'heure part à 7 h ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-1');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.arrive(S, c);
    update public.commandes set livre_le = date_trunc('day', now()) - interval '90 minutes' where id = c;   -- hier à 22 h 30
    res := res || E'\n[1] arrivé hier 22h30 → départ ' || pg_temp.lire(format('select to_char(public._cmd_reception_base(%L) at time zone %L, %L)', c, 'UTC', 'DD HH24:MI'));
    update public.commandes set livre_le = date_trunc('day', now()) + interval '3 hours' where id = c;      -- aujourd'hui à 3 h
    res := res || ' ; arrivé 3h → ' || pg_temp.lire(format('select to_char(public._cmd_reception_base(%L) at time zone %L, %L)', c, 'UTC', 'DD HH24:MI'));
    update public.commandes set livre_le = date_trunc('day', now()) + interval '12 hours' where id = c;     -- aujourd'hui à 12 h
    res := res || ' ; arrivé 12h → ' || pg_temp.lire(format('select to_char(public._cmd_reception_base(%L) at time zone %L, %L)', c, 'UTC', 'DD HH24:MI'));
    update public.commandes set livre_le = date_trunc('day', now()) + interval '20 hours 59 minutes' where id = c;
    res := res || ' ; arrivé 20h59 → ' || pg_temp.lire(format('select to_char(public._cmd_reception_base(%L) at time zone %L, %L)', c, 'UTC', 'DD HH24:MI'));
    update public.commandes set livre_le = date_trunc('day', now()) - interval '90 minutes' where id = c;
    perform pg_temp.qui(B);
    res := res || ' ; écran nuit_reportee=' || pg_temp.v(format('select public.commande_delais(%L) ->> %L', c, 'nuit_reportee'));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 2 : vendeur banni pendant le transport → litige pour l'équipe ; l'acheteur peut confirmer avec le mot ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-2');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c);
    insert into public.bannis (user_id, motif) values (S, 'autre');
    perform public.commandes_delais();
    res := res || E'\n[2] vendeur banni en route, après la tâche : ' || pg_temp.cs(c);
    x := pg_temp.mot(c);
    perform pg_temp.qui(B);
    res := res || ' ; l''acheteur confirme avec le mot : ' || pg_temp.v(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, x)) || ' → ' || pg_temp.cs(c);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 3 : acheteur banni : avant chargement le vendeur annule (contre l'acheteur) ; après, l'équipe ; litige auto → équipe ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-3');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);                              -- confirmée, pas chargée
    n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c2); -- en route
    n := pg_temp.accord(S, B, o, 20000, 10); c3 := pg_temp.cmd(S, B, n, true); perform pg_temp.arrive(S, c3);  -- litige automatique
    update public.commandes set livre_le = now() - interval '61 minutes' where id = c3;
    perform public.commandes_delais();
    res := res || E'\n[3] c3 avant bannissement : ' || pg_temp.cs(c3);
    insert into public.bannis (user_id, motif) values (B, 'autre');
    perform pg_temp.qui(S);
    res := res || ' | c1 vendeur annule : ' || pg_temp.e(format('select public.commande_annuler_acheteur_banni(%L, %L)', c, 'acheteur banni'))
       || ' → ' || pg_temp.cs(c) || ' fiabilité=' || pg_temp.annul(c);
    execute 'reset role';
    update public.commandes set litige_auto_le = now() - interval '61 minutes' where id = c3;
    perform public.commandes_delais();
    res := res || ' | c2 en route après la tâche : ' || pg_temp.cs(c2) || ' | c3 litige auto +61 min : ' || pg_temp.cs(c3) || ' fiabilité=' || pg_temp.annul(c3);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 4 : pas de commande avec un banni ; ses accords sans commande s'arrêtent, la quantité revient tout de suite ══
  -- (acheteur banni : la quantité revient sur l'annonce du vendeur ; vendeur banni : l'accord s'arrête, son annonce reste telle quelle)
  begin
    o := pg_temp.offre(S, 100, 20000, 'c103-4');
    n := pg_temp.accord(S, B, o, 20000, 10);
    res := res || E'\n[4] stock après accord=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o));
    insert into public.bannis (user_id, motif) values (B, 'autre');
    res := res || ' ; après bannissement de l''acheteur : stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o))
       || ' accord=' || pg_temp.lire(format('select coalesce(raison, %L) || %L || (sans_suite_le is not null) || %L || rendu from public.stock_mouvements where negociation_id = %L', 'en cours', ' sans_suite=', ' rendu=', n));
    perform pg_temp.qui(S);
    res := res || ' ; le vendeur crée la commande : ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;
  begin
    o := pg_temp.offre(S, 100, 20000, 'c103-4b');
    n := pg_temp.accord(S, B, o, 20000, 10);
    insert into public.bannis (user_id, motif) values (S, 'autre');
    res := res || ' | vendeur banni : bannissement accepté, accord=' || pg_temp.lire(format('select coalesce(raison, %L) || %L || (sans_suite_le is not null) || %L || rendu from public.stock_mouvements where negociation_id = %L', 'en cours', ' sans_suite=', ' rendu=', n));
    perform pg_temp.qui(B);
    res := res || ' ; l''acheteur crée la commande : ' || pg_temp.e(format('select public.commande_creer2(%L, %L, null, %L, null)', n, 'vendeur', 'Daloa'));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 5 : demande d'annulation du vendeur sans réponse en 24 h : acceptée, sans faute ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-5');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
    perform pg_temp.qui(S);
    res := res || E'\n[5] demande vendeur : ' || public.commande_annuler_motif(c, true, null, 'stock_epuise', null, null);
    execute 'reset role';
    update public.commande_etapes set at = at - interval '25 hours' where commande_id = c and evenement = 'annulation_demandee';
    perform pg_temp.e(format('update public.commandes set annulation_demande_le = now() - interval %L where id = %L', '25 hours', c));
    perform public.commandes_delais();
    res := res || ' ; 25 h sans réponse, après la tâche : ' || pg_temp.cs(c) || ' fiabilité=' || pg_temp.annul(c)
       || ' journal=' || pg_temp.lire(format('select left(note, 60) from public.commande_etapes where commande_id = %L and evenement = %L', c, 'annulee'));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 6 : l'acheteur demande une annulation d'un commun accord avant le chargement ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-6');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
    n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true);
    perform pg_temp.qui(B);
    res := res || E'\n[6] c1 demande acheteur : ' || pg_temp.v(format('select public.commande_annuler_motif(%L, true, null, %L, null, null)', c, 'erreur_saisie'));
    perform pg_temp.qui(S);
    res := res || ' ; le vendeur accepte : ' || pg_temp.v(format('select public.commande_annuler_motif(%L, true, null, null, null, null)', c))
       || ' → ' || pg_temp.cs(c) || ' fiabilité=' || pg_temp.annul(c);
    perform pg_temp.qui(B);
    res := res || ' | c2 demande acheteur : ' || pg_temp.v(format('select public.commande_annuler_motif(%L, true, null, %L, null, null)', c2, 'prix_change'));
    perform pg_temp.qui(S);
    res := res || ' ; le vendeur refuse : ' || pg_temp.v(format('select public.commande_annuler_motif(%L, false, null, null, null, null)', c2)) || ' → ' || pg_temp.cs(c2);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 7 : membre suspendu : ses accords sans commande passent « sans suite » tout de suite ══
  begin
    o := pg_temp.offre(S, 100, 20000, 'c103-7');
    n := pg_temp.accord(S, B, o, 20000, 10);
    insert into public.sanctions (user_id, type, debut, fin, motif, par) values (B, 'suspension', now(), now() + interval '7 days', 'test 103', ADM);
    res := res || E'\n[7] acheteur suspendu : stock=' || pg_temp.lire(format('select quantity::text from public.offres where id = %L', o))
       || ' accord=' || pg_temp.lire(format('select coalesce(raison, %L) || %L || (sans_suite_le is not null) from public.stock_mouvements where negociation_id = %L', 'en cours', ' sans_suite=', n));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 8 : retrait par l'acheteur : la remise au départ vaut « arrivé » (pas pour le simple transport à la charge de l'acheteur) ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-8');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
    n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true);
    update public.commandes set transport_regle = 'retrait' where id = c;
    update public.commandes set transport_regle = 'acheteur' where id = c2;
    perform pg_temp.preuves(S, c); perform pg_temp.qui(S);
    perform public.commande_avancer(c, 'chargement', null, null, null, null);
    res := res || E'\n[8] retrait : remise déclarée par le vendeur après le chargement : ' || pg_temp.v(format('select public.commande_avancer(%L, %L, null, null, null, %L)', c, 'arrivee', 'Remis à l''acheteur'))
       || ' → ' || pg_temp.cs(c);
    perform pg_temp.qui(B);
    res := res || ' ; écran remise_vaut_arrivee=' || pg_temp.v(format('select public.commande_delais(%L) ->> %L', c, 'remise_vaut_arrivee'))
       || ' (transport à la charge de l''acheteur : ' || pg_temp.v(format('select public.commande_delais(%L) ->> %L', c2, 'remise_vaut_arrivee')) || ')';
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 9 : fausse déclaration « arrivé » constatée par l'équipe : litige perdu pour le vendeur ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-9');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.arrive(S, c);
    perform pg_temp.qui(B);
    perform public.commande_litige(c, 'Rien n''est arrivé');
    perform pg_temp.qui(S);
    res := res || E'\n[9] le vendeur essaie l''outil : ' || pg_temp.e(format('select public.admin_litige_fausse_arrivee(%L, %L)', c, 'x'));
    perform pg_temp.qui(ADM);
    res := res || ' ; l''équipe : ' || pg_temp.v(format('select public.admin_litige_fausse_arrivee(%L, %L)', c, 'Camion vu à Bouaké au moment de la déclaration'))
       || ' → ' || pg_temp.cs(c) || ' fiabilité=' || pg_temp.annul(c)
       || ' journal équipe=' || pg_temp.lire(format('select count(*)::text from public.admin_journal where cible_id = %L', c));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 10 : date d'arrivée annoncée dépassée → indicateur ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-10');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c);
    perform pg_temp.qui(S);
    perform public.commande_retard_signaler(c, 'panne', now() + interval '2 hours', null);
    perform pg_temp.qui(B);
    res := res || E'\n[10] date à venir : ' || pg_temp.v(format('select concat_ws(%L, j ->> %L, j ->> %L) from (select public.commande_delais(%L) j) z', '/', 'date_depassee', 'mettre_en_avant_probleme', c));
    execute 'reset role';
    update public.commandes set arrivee_estimee = now() - interval '1 hour' where id = c;
    perform pg_temp.qui(B);
    res := res || ' ; date passée : ' || pg_temp.v(format('select concat_ws(%L, j ->> %L, j ->> %L) from (select public.commande_delais(%L) j) z', '/', 'date_depassee', 'mettre_en_avant_probleme', c))
       || ' ; état=' || pg_temp.cs(c);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 11 : 2 demandes de nouvelles sans réponse → indicateur ; relances sans limite ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-11');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.partir(S, c);
    -- le journal des étapes suit l'horloge, le suivi l'heure du début du bloc : on vieillit les étapes du départ
    update public.commande_etapes set at = at - interval '1 hour' where commande_id = c;
    perform pg_temp.qui(B);
    perform public.commande_nouvelles_demander(c);
    execute 'reset role'; update public.commandes set nouvelles_le = now() - interval '2 minutes' where id = c;
    update public.commande_suivi set at = at - interval '2 minutes' where commande_id = c;
    perform pg_temp.qui(B);
    res := res || E'\n[11] après 1 demande : ' || pg_temp.v(format('select concat_ws(%L, j ->> %L, j ->> %L) from (select public.commande_delais(%L) j) z', '/', 'nouvelles_sans_reponse', 'mettre_en_avant_probleme', c));
    perform public.commande_nouvelles_demander(c);
    res := res || ' ; après 2 : ' || pg_temp.v(format('select concat_ws(%L, j ->> %L, j ->> %L) from (select public.commande_delais(%L) j) z', '/', 'nouvelles_sans_reponse', 'mettre_en_avant_probleme', c));
    execute 'reset role'; update public.commandes set nouvelles_le = now() - interval '2 minutes' where id = c;
    perform pg_temp.qui(B);
    res := res || ' ; 3e relance : ' || public.commande_nouvelles_demander(c);
    perform pg_temp.qui(S);
    perform public.commande_retard_signaler(c, 'route', null, null);
    perform pg_temp.qui(B);
    res := res || ' ; le vendeur répond (retard) : ' || pg_temp.v(format('select concat_ws(%L, j ->> %L, j ->> %L) from (select public.commande_delais(%L) j) z', '/', 'nouvelles_sans_reponse', 'mettre_en_avant_probleme', c));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 12 : « Signaler un problème » en 5 choix, photo pour « cassé » et « mauvaise qualité » ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-12');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.arrive(S, c);
    p1 := pg_temp.photo(B, 'casse');
    perform pg_temp.qui(B);
    res := res || E'\n[12] choix inconnu : ' || pg_temp.e(format('select public.commande_probleme(%L, %L, null, null)', c, 'vol'))
       || ' ; cassé sans photo : ' || pg_temp.e(format('select public.commande_probleme(%L, %L, null, null)', c, 'casse'))
       || ' ; autre sans texte : ' || pg_temp.e(format('select public.commande_probleme(%L, %L, null, null)', c, 'autre'))
       || ' ; photo d''un autre membre : ' || pg_temp.e(format('select public.commande_probleme(%L, %L, null, array[%L])', c, 'casse', S || '/x.jpg'))
       || ' ; cassé avec photo : ' || pg_temp.v(format('select public.commande_probleme(%L, %L, %L, array[%L])', c, 'casse', '3 sacs déchirés', p1))
       || ' → ' || pg_temp.cs(c) || ' ' || pg_temp.lire(format('select concat_ws(%L, litige_type, cardinality(litige_photos)::text, litige_motif) from public.commandes where id = %L', ' | ', c));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 13 : clôture en faveur du vendeur : l'avis part aux deux (push_commande ne saute plus une étape « terminee » avec note) ══
  begin
    res := res || E'\n[13] push_commande saute toute fin : ' || pg_temp.lire($q$select (position('new.evenement = ''terminee'' or' in pg_get_functiondef('public.push_commande()'::regprocedure)) > 0)::text$q$)
       || ' ; saute seulement la fin sans note : ' || pg_temp.lire($q$select (position('new.evenement = ''terminee'' and new.note is null' in pg_get_functiondef('public.push_commande()'::regprocedure)) > 0)::text$q$);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 14 : confirmation renvoyée après une coupure ; message du litige verrouillé ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-14');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true); perform pg_temp.arrive(S, c);
    x := pg_temp.mot(c);
    perform pg_temp.qui(B);
    res := res || E'\n[14] 1re confirmation : ' || pg_temp.v(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, x))
       || ' ; renvoyée : ' || pg_temp.v(format('select public.commande_reception_mot(%L, %L, false, null, null, null)', c, x))
       || ' ; litige_ecrire verrouille : ' || pg_temp.lire($q$select (position('for update' in pg_get_functiondef('public.litige_ecrire(uuid, text)'::regprocedure)) > 0)::text$q$);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ n° 15 : délai de chargement de 72 h inchangé ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-15');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);
    perform pg_temp.qui(B);
    res := res || E'\n[15] chargement_heures=' || pg_temp.v('select public.commandes_regles() ->> ''chargement_heures''')
       || ' ; l''acheteur annule à 71 h : ' || pg_temp.e(format('select public.commande_annuler_retard(%L, null)', c));
    execute 'reset role';
    update public.commandes set confirme_le = now() - interval '73 hours' where id = c;
    perform pg_temp.qui(B);
    res := res || ' ; à 73 h : ' || pg_temp.v(format('select public.commande_annuler_retard(%L, null)', c)) || ' fiabilité=' || pg_temp.annul(c);
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  -- ══ T : refus de la marchandise et transport « à part » (30 000 F) ══
  begin
    o := pg_temp.offre(S, 1000, 20000, 'c103-T');
    n := pg_temp.accord(S, B, o, 20000, 10); c := pg_temp.cmd(S, B, n, true);    -- refus total accepté
    n := pg_temp.accord(S, B, o, 20000, 10); c2 := pg_temp.cmd(S, B, n, true);   -- refus rejeté
    n := pg_temp.accord(S, B, o, 20000, 10); c3 := pg_temp.cmd(S, B, n, true);   -- refus partiel accepté (4 sur 10)
    update public.commandes set transport_regle = 'a_part', prix_transport = 30000 where id in (c, c2, c3);
    perform pg_temp.arrive(S, c); perform pg_temp.arrive(S, c2); perform pg_temp.arrive(S, c3);
    p1 := pg_temp.photo(B, 'r1'); p2 := pg_temp.photo(B, 'r2'); x := pg_temp.photo(B, 'r3');
    perform pg_temp.qui(B);
    perform public.commande_refuser2(c, null, 'Maïs moisi', array[p1], pg_temp.mot(c), false);
    perform public.commande_refuser2(c2, null, 'Maïs moisi', array[p2], pg_temp.mot(c2), false);
    perform public.commande_refuser2(c3, 4, 'Sacs mouillés', array[x], pg_temp.mot(c3), false);
    perform pg_temp.qui(ADM);
    perform public.admin_refus_trancher(c, 10, 'Photos nettes : refus accepté');
    perform public.admin_refus_trancher(c2, 0, 'Refus rejeté');
    perform public.admin_refus_trancher(c3, 4, 'Refus partiel accepté');
    x := 'marchandise,transport,acheteur_rembourse,vendeur_transport,vendeur_net,acheteur_paie,transport_paye_par';
    res := res || E'\n[T] refus total accepté : ' || pg_temp.rep(c, x)
       || E'\n[T] refus rejeté : ' || pg_temp.rep(c2, x)
       || E'\n[T] refus partiel accepté : ' || pg_temp.rep(c3, x)
       || E'\n[T] journal : ' || pg_temp.lire(format('select note from public.sequestre_journal where commande_id = %L and evenement = %L', c, 'refus_admin'));
    raise exception 'FIN';
  exception when others then if sqlerrm <> 'FIN' then res := res || ' !! ' || sqlerrm; end if; end;

  raise exception 'TEST 103 : %', res;
end $$;

-- ══ Résultats (25/10/2026, projet de test) ══
-- AVANT les schémas 103 (blocs 10, 11, 12, 14 et T non joués avant : l'outil de photos de départ datait les photos au début du bloc,
-- corrigé ensuite par clock_timestamp ; pour ces blocs, « avant » se lit dans le code : pas d'indicateur, pas de commande_probleme,
-- 2e confirmation = « Cette commande n'est pas en cours. », transport toujours dû par l'acheteur) :
-- [1] arrivé 22 h 30 → départ 22 h 30 (litige automatique à 23 h 30) ; 3 h → 3 h ; 12 h → 12 h ; écran : pas d'indicateur.
-- [2] vendeur banni en route : rien ne bouge (en_cours/transport).
-- [3] le vendeur ne peut pas annuler (fonction absente) ; c2 en route reste en_cours ; c3 litige automatique clos pour le vendeur
--     avec « litige perdu » imputé à l'acheteur banni.
-- [4] vendeur banni : l'accord reste en cours (stock 90) et l'acheteur crée la commande (« ok »).
-- [5] demande du vendeur sans réponse 25 h : toujours en_cours/confirmee.
-- [6] l'acheteur ne peut pas demander l'annulation (« vous pourrez l'annuler seul si le vendeur n'a pas chargé 72 h… »).
-- [7] acheteur suspendu : l'accord reste en cours (stock 90).
-- [8] retrait : « arrivée » déclarée, mais pas d'indicateur pour l'écran.
-- [9] outil « fausse arrivée » absent.
-- [13] push_commande saute toute étape « terminee » (l'avis « en faveur du vendeur » ne part jamais).
-- [15] 72 h : TROP_TOT avant, annulation possible à 73 h (abusive, vendeur).
-- APRÈS les schémas 103a, 103b, 103c :
-- [1] arrivé hier 22 h 30 → départ 7 h ; 3 h → 7 h ; 12 h → 12 h ; 20 h 59 → 20 h 59 ; écran nuit_reportee=true.
-- [2] vendeur banni en route : litige/transport pour l'équipe (auto=false) ; l'acheteur confirme avec le mot : terminee.
-- [3] c1 le vendeur annule : annulee, fiabilité « abusive, acheteur » ; c2 en route : litige pour l'équipe ;
--     c3 litige automatique +61 min : reste en litige, auto=false (l'équipe), aucune ligne de fiabilité.
-- [4] acheteur banni : stock 90 → 100, accord « membre_banni », rendu 10 ; commande refusée (accord arrêté).
--     Vendeur banni : le bannissement passe (avant correction, il échouait : la garde des annonces d'un banni refusait le retour du
--     stock), accord « membre_banni », rendu 0 (son annonce ne bouge pas) ; commande refusée.
--     Message changé ensuite en « ACCORD_ARRETE : cet accord a pris fin… » (pas rejoué).
-- [5] 25 h sans réponse : annulee, « légitime, personne » ; journal « Annulation acceptée : l'acheteur n'a pas répondu en 24 h… ».
-- [6] demande de l'acheteur : annulation_demandee ; le vendeur accepte : annulee, « légitime, personne » ; 2e commande : le vendeur
--     refuse : en_cours.
-- [7] acheteur suspendu : stock 90 → 100, accord « membre_suspendu ».
-- [8] retrait : remise déclarée après le chargement → en_cours/arrivee ; remise_vaut_arrivee=true (false pour « transport à la charge
--     de l'acheteur »).
-- [9] le vendeur : « Réservé à l'administration » ; l'équipe : annulee, fiabilité « litige, vendeur » ; 1 ligne au journal de l'équipe.
-- [10] date à venir : false/false ; date passée : date_depassee=true, mettre_en_avant_probleme=true ; commande toujours en route.
-- [11] 1 demande : 1/false ; 2 demandes : 2/true ; 3e relance acceptée ; le vendeur signale un retard : 0/false.
-- [12] choix inconnu, « cassé » sans photo (PHOTO_REQUISE), « autre » sans texte, photo d'un autre membre : refusés ;
--      « cassé » avec photo : litige, type casse, 1 photo, motif « Marchandise cassée · 3 sacs déchirés ».
-- [13] push_commande ne saute plus que la fin sans note.
-- [14] 1re confirmation : terminee ; renvoyée : deja_confirmee ; litige_ecrire verrouille la commande.
-- [15] 72 h inchangé : TROP_TOT à 71 h, annulation à 73 h (abusive, vendeur).
-- [T] transport à part 30 000 F, marchandise 200 000 F :
--     refus total accepté : acheteur paie 0, non dû 230 000, vendeur net 0, transport payé par le vendeur ;
--     refus rejeté : acheteur paie 230 000, vendeur net 223 000 (200 000 − 7 000 + 30 000), transport payé par l'acheteur ;
--     refus partiel accepté (4 sur 10) : acheteur paie 120 000, non dû 110 000, vendeur net 115 800, transport payé par le vendeur.
--     Journal : « 200000 F de marchandise non dus par l'acheteur ; transport à la charge du vendeur ».
-- Transport par un transporteur choisi (mission avec prix) : calcul relu, pas joué (pas de mission dans ce test).
-- Avec la participation de l'acheteur (schémas 102, autre équipe) : test participation-102-scenarios.sql rejoué le 25/10/2026 avec
-- 103 en place (même projet de test) : litige automatique puis proposition → pas de clôture pour le vendeur ; partage de l'équipe →
-- proposition caduque ; « transport » 3 000 F acceptée → _seq_repartition : acheteur paie 3 000, transport payé par l'acheteur,
-- vendeur net 3 000, non dû 200 000. Écarts du côté 102 sur le test (vendeur qui propose, 4e proposition, réglages participation
-- absents) : signalés à l'équipe participation, sans lien avec 103.

