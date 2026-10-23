-- ═════════ Marché de Gros CI — schéma 81 : mesurer les visites du site et les arrivées dans l'application ═════════
-- Demandé par le propriétaire le 23/10/2026 : savoir d'où viennent les visiteurs et sur quoi ils cliquent, gratuitement.
-- AUCUNE donnée personnelle : ni adresse IP, ni compte, ni numéro, ni identifiant d'appareil. Seulement : l'évènement, la page,
-- le bouton, la provenance (utm_source / utm_medium / utm_campaign), ordinateur ou téléphone, la date.
-- La table est fermée : on n'y écrit que par mesurer(), on ne la lit que par mesures_resume() (administrateur).
-- Garde-fou du plan gratuit : 20 000 mesures par jour au plus. Appliqué par Claude avec l'outil Supabase. Aucune donnée modifiée.

create table if not exists public.site_mesures (
  id         bigserial primary key,
  le         timestamptz not null default now(),
  jour       date not null default ((now() at time zone 'Africa/Abidjan')::date),
  evenement  text not null check (evenement in ('vue', 'clic', 'ouverture_app', 'connexion_app')),
  page       text check (char_length(page) <= 80),
  cible      text check (char_length(cible) <= 60),
  source     text check (char_length(source) <= 40),
  support    text check (char_length(support) <= 40),
  campagne   text check (char_length(campagne) <= 60),
  appareil   text check (appareil in ('ordi', 'tel'))
);
alter table public.site_mesures enable row level security;
revoke all on public.site_mesures from anon, authenticated;
create index if not exists site_mesures_jour on public.site_mesures (jour);

create or replace function public.mesurer(p_evenement text, p_page text default null, p_cible text default null, p_source text default null,
                                          p_support text default null, p_campagne text default null, p_appareil text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  j date := (now() at time zone 'Africa/Abidjan')::date;
  propre text := '[^a-z0-9/._-]';
begin
  if p_evenement not in ('vue', 'clic', 'ouverture_app', 'connexion_app') then return; end if;
  if (select count(*) from public.site_mesures where jour = j) >= 20000 then return; end if;
  insert into public.site_mesures (jour, evenement, page, cible, source, support, campagne, appareil)
  values (j, p_evenement,
    left(nullif(regexp_replace(lower(coalesce(p_page, '')), propre, '', 'g'), ''), 80),
    left(nullif(regexp_replace(lower(coalesce(p_cible, '')), propre, '', 'g'), ''), 60),
    left(nullif(regexp_replace(lower(coalesce(p_source, '')), propre, '', 'g'), ''), 40),
    left(nullif(regexp_replace(lower(coalesce(p_support, '')), propre, '', 'g'), ''), 40),
    left(nullif(regexp_replace(lower(coalesce(p_campagne, '')), propre, '', 'g'), ''), 60),
    case when p_appareil in ('ordi', 'tel') then p_appareil end);
end $$;
revoke all on function public.mesurer(text, text, text, text, text, text, text) from public;
grant execute on function public.mesurer(text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.mesures_resume(p_jours int default 30)
returns json language sql stable security definer set search_path = public as $$
  with m as (select * from public.site_mesures where public.est_admin() and jour > ((now() at time zone 'Africa/Abidjan')::date - least(greatest(coalesce(p_jours, 30), 1), 365)))
  select case when not public.est_admin() then null else json_build_object(
    'jours', coalesce((select json_agg(r order by r.jour) from (select jour, count(*) filter (where evenement = 'vue') vues, count(*) filter (where evenement = 'clic') clics,
              count(*) filter (where evenement = 'ouverture_app') ouvertures, count(*) filter (where evenement = 'connexion_app') connexions from m group by jour) r), '[]'::json),
    'total', (select json_build_object('vues', count(*) filter (where evenement = 'vue'), 'clics', count(*) filter (where evenement = 'clic'),
              'ouvertures', count(*) filter (where evenement = 'ouverture_app'), 'connexions', count(*) filter (where evenement = 'connexion_app'),
              'ordi', count(*) filter (where evenement = 'vue' and appareil = 'ordi'), 'tel', count(*) filter (where evenement = 'vue' and appareil = 'tel')) from m),
    'pages', coalesce((select json_agg(r) from (select page, count(*) n from m where evenement = 'vue' group by page order by 2 desc limit 15) r), '[]'::json),
    'clics', coalesce((select json_agg(r) from (select cible, page, count(*) n from m where evenement = 'clic' group by cible, page order by 3 desc limit 15) r), '[]'::json),
    'provenances', coalesce((select json_agg(r) from (select evenement, coalesce(source, 'directe') source, support, campagne, count(*) n from m
              where evenement in ('vue', 'ouverture_app', 'connexion_app') group by 1, 2, 3, 4 order by 5 desc limit 20) r), '[]'::json)
  ) end
$$;
revoke all on function public.mesures_resume(int) from public;
grant execute on function public.mesures_resume(int) to authenticated;
