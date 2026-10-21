-- ═════════ Marché de Gros CI — schéma 29 : position du chauffeur et itinéraire ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop.
--
-- Principe (aucun faux suivi en direct) :
--   • le chauffeur choisit de partager sa position, seulement pendant le transport (transport, transbordement, arrivée),
--     et seulement quand l'application est ouverte : une page web ne peut pas envoyer sa position écran éteint ;
--   • le serveur garde une position toutes les 15 s au plus, pour la commande en cours ; les membres voient la dernière,
--     avec son heure exacte ; au-delà de 5 min, l'application dit « position non actualisée » ;
--   • les positions sont effacées 30 jours après la fin de la commande (tâche planifiée chaque nuit) ;
--   • l'itinéraire est calculé UNE fois par commande par la fonction Edge « itineraire » (openrouteservice, clé gardée
--     dans les secrets Supabase) et rangé ici ; si le calcul échoue, une ligne « à vol d'oiseau » le dit clairement.

-- ——— 1) Tables ———
create table if not exists public.positions (
  id              bigint generated always as identity primary key,
  commande_id     uuid not null references public.commandes (id) on delete cascade,
  transporteur_id uuid references public.transporteurs (id) on delete set null,
  lat             double precision not null check (lat between -90 and 90),
  lon             double precision not null check (lon between -180 and 180),
  precision_m     real check (precision_m is null or precision_m >= 0),
  at              timestamptz not null default now()
);
create index if not exists positions_cmd on public.positions (commande_id, at desc);

create table if not exists public.commande_itineraires (
  commande_id  uuid primary key references public.commandes (id) on delete cascade,
  source       text not null check (source in ('ors', 'vol_oiseau', 'introuvable')),
  depart       double precision[] check (depart is null or cardinality(depart) = 2),     -- [lon, lat]
  arrivee      double precision[] check (arrivee is null or cardinality(arrivee) = 2),
  ligne        jsonb,                                                                    -- [[lon, lat], …] (simplifiée)
  distance_m   numeric,
  duree_s      numeric,
  calcule_le   timestamptz not null default now()
);

alter table public.positions enable row level security;
alter table public.commande_itineraires enable row level security;
revoke all on public.positions, public.commande_itineraires from anon, authenticated;
grant select, insert, update on public.commande_itineraires to service_role;
grant select on public.commandes, public.transporteurs to service_role;

-- ——— 2) Le chauffeur envoie sa position ———
create or replace function public.chauffeur_position(p_cmd uuid, p_lat double precision, p_lon double precision, p_precision real default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; der timestamptz;
begin
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or public._cmd_role2(c, me) is distinct from 'chauffeur' then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' or c.etape not in ('transport', 'transbordement', 'arrivee') then
    return json_build_object('ok', false, 'arreter', true, 'message', 'Le partage s''arrête : la marchandise n''est plus en route.');
  end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'Position invalide.'; end if;
  select max(at) into der from public.positions where commande_id = c.id;
  if der is not null and der > now() - interval '15 seconds' then return json_build_object('ok', false, 'arreter', false, 'message', 'trop tôt'); end if;
  insert into public.positions (commande_id, transporteur_id, lat, lon, precision_m) values (c.id, c.transporteur_id, p_lat, p_lon, p_precision);
  return json_build_object('ok', true, 'arreter', false);
end $$;

-- ——— 3) Lire : dernière position, trace récente, itinéraire ———
create or replace function public.commande_position(p_cmd uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when c.id is null or not (public._cmd_role2(c, auth.uid()) is not null or public.est_admin()) then null else json_build_object(
    'derniere', (select json_build_object('lat', p.lat, 'lon', p.lon, 'at', p.at, 'precision', p.precision_m)
                 from public.positions p where p.commande_id = c.id order by p.at desc limit 1),
    'trace', (select coalesce(json_agg(json_build_array(x.lon, x.lat) order by x.at), '[]'::json)
              from (select p.lon, p.lat, p.at from public.positions p where p.commande_id = c.id order by p.at desc limit 120) x),
    'itineraire', (select json_build_object('source', i.source, 'depart', i.depart, 'arrivee', i.arrivee, 'ligne', i.ligne,
                     'distance_m', i.distance_m, 'duree_s', i.duree_s, 'calcule_le', i.calcule_le)
                   from public.commande_itineraires i where i.commande_id = c.id)) end
  from (select 1) z left join public.commandes c on c.id = p_cmd;
$$;

-- ——— 4) Effacer les positions 30 jours après la fin de la commande (chaque nuit) ———
create or replace function public.positions_purger() returns int
language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  delete from public.positions p using public.commandes c
  where c.id = p.commande_id and c.etat in ('terminee', 'annulee') and coalesce(c.termine_le, c.updated_at) < now() - interval '30 days';
  get diagnostics n = row_count;
  -- garde-fou : aucune position de plus de 120 jours, quelle que soit la commande
  delete from public.positions where at < now() - interval '120 days';
  return n;
end $$;
select cron.schedule('mdg-purger-positions', '23 3 * * *', 'select public.positions_purger()');

-- ——— 5) Droits ———
revoke execute on function public.positions_purger() from public, anon, authenticated;
revoke execute on function public.chauffeur_position(uuid, double precision, double precision, real), public.commande_position(uuid) from public, anon;
grant execute on function public.chauffeur_position(uuid, double precision, double precision, real), public.commande_position(uuid) to authenticated;
