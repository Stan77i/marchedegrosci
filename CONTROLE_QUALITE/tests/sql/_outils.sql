-- Outils communs (pg_temp) : à coller en tête de chaque appel, dans la même requête que le bloc.
-- Projet de TEST seulement (yowdymdnoiubatxlwhfv). Comptes de simulation : S vendeur, B acheteur, C et D autres membres, ADM administrateur.
create or replace function pg_temp.e(q text) returns text language plpgsql as $f$
begin execute q; return 'ok'; exception when others then return 'ERR ' || sqlerrm; end $f$;
create or replace function pg_temp.qui(u uuid) returns void language plpgsql as $f$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true); execute 'set local role authenticated'; end $f$;
create or replace function pg_temp.lire(q text) returns text language plpgsql as $f$
declare prev text := current_user; v text;
begin execute 'reset role'; execute q into v; if prev <> current_user then execute format('set local role %I', prev); end if; return coalesce(v, 'NULL'); end $f$;
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
-- preuves de départ (2 photos + poids + papier du mot), chargement, départ
create or replace function pg_temp.partir(s uuid, c uuid) returns void language plpgsql as $f$
declare p text[] := array[s || '/cq/' || c || '-1.jpg', s || '/cq/' || c || '-2.jpg', s || '/motpapier-cq-' || c || '.jpg'];
begin perform pg_temp.qui(s); perform public.commande_depart_defi(c);
  execute 'reset role';
  insert into storage.objects (bucket_id, name, owner, created_at) values ('preuves', p[1], s, now() + interval '1 second'), ('preuves', p[2], s, now() + interval '1 second'), ('preuves', p[3], s, now() + interval '1 second');
  perform pg_temp.qui(s);
  perform public.commande_depart_preuves(c, array[p[1], p[2]], 2500);
  perform public.commande_depart_mot(c, p[3]);
  perform public.commande_avancer(c, 'chargement', null, null, null, null);
  perform public.commande_avancer(c, 'transport', null, null, null, null);
  execute 'reset role'; end $f$;
