-- ═════════ Marché de Gros CI — étape 7 : avis (étoiles), signalements avec raison visible, négociations masquées (12 octobre 2026) ═════════
-- À lancer APRÈS les étapes 1 à 6. Peut être relancé sans danger.
--
-- Avis : on ne note que quelqu'un avec qui on a vraiment négocié (au moins une négociation ensemble) — comme les plateformes
-- d'échange entre particuliers : pas de note de complaisance ni de dénigrement par un inconnu. Une note par personne notée,
-- modifiable. Tout le monde voit la moyenne, le nombre d'avis et les derniers commentaires (avec le nom d'affichage de l'auteur).
-- Signalements : la raison est choisie dans une liste ; les autres voient les raisons (catégories) et le nombre de signalements
-- d'une annonce ; la précision écrite reste réservée à l'administration.
-- Négociations masquées : chacun peut retirer une négociation de SA liste ; elle reste chez l'autre, et revient chez soi si l'autre écrit.

-- ——— avis ———
create table if not exists public.avis (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auteur_id  uuid not null references auth.users(id) on delete cascade,
  cible_id   uuid not null references auth.users(id) on delete cascade,
  note       smallint not null check (note between 1 and 5),
  texte      text check (char_length(texte) <= 300),
  unique (auteur_id, cible_id),
  check (auteur_id <> cible_id)
);
create index if not exists avis_cible on public.avis (cible_id);
alter table public.avis enable row level security;
revoke all on public.avis from anon, authenticated;
grant select, delete on public.avis to service_role;

create or replace function public.peut_noter(p_cible uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'peut', auth.uid() is not null and p_cible <> auth.uid() and exists (select 1 from public.negociations n where (n.auteur_id = auth.uid() and n.proprio_id = p_cible) or (n.proprio_id = auth.uid() and n.auteur_id = p_cible)),
    'note', (select note from public.avis where auteur_id = auth.uid() and cible_id = p_cible),
    'texte', (select texte from public.avis where auteur_id = auth.uid() and cible_id = p_cible));
$$;

create or replace function public.noter(p_cible uuid, p_note int, p_texte text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_cible = auth.uid() then raise exception 'On ne se note pas soi-même.'; end if;
  if p_note not between 1 and 5 then raise exception 'Une note de 1 à 5 étoiles.'; end if;
  if not exists (select 1 from public.negociations n where (n.auteur_id = auth.uid() and n.proprio_id = p_cible) or (n.proprio_id = auth.uid() and n.auteur_id = p_cible)) then
    raise exception 'PAS_DE_NEGOCIATION'; end if;
  insert into public.avis (auteur_id, cible_id, note, texte) values (auth.uid(), p_cible, p_note, nullif(btrim(left(p_texte, 300)), ''))
  on conflict (auteur_id, cible_id) do update set note = excluded.note, texte = excluded.texte, updated_at = now();
end $$;

-- nom d'affichage public (même règle que profils_publics)
create or replace function public.nom_public(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when p.supprime_le is not null then 'Compte supprimé' when p.pseudo is not null then p.pseudo
              when p.prenom is not null then p.prenom || coalesce(' ' || case when p.nom_public then p.nom else left(p.nom, 1) || '.' end, '') end
  from public.profils p where p.user_id = uid;
$$;

create or replace function public.notes_publiques(ids uuid[]) returns table (user_id uuid, moyenne numeric, nombre int)
language sql stable security definer set search_path = public as $$
  select a.cible_id, round(avg(a.note)::numeric, 1), count(*)::int from public.avis a where a.cible_id = any (ids[1:200]) group by a.cible_id;
$$;

create or replace function public.avis_de(p_cible uuid) returns table (note smallint, texte text, quand timestamptz, auteur text, avatar text)
language sql stable security definer set search_path = public as $$
  select a.note, a.texte, a.updated_at, coalesce(public.nom_public(a.auteur_id), 'Un membre'), p.avatar
  from public.avis a left join public.profils p on p.user_id = a.auteur_id and p.supprime_le is null
  where a.cible_id = p_cible order by a.updated_at desc limit 30;
$$;

-- les mieux notés : moyenne pondérée (une seule note 5/5 ne passe pas devant vingt notes 4,8) ; au moins un avis
create or replace function public.mieux_notes(n int default 30) returns table (user_id uuid, affichage text, avatar text, role text, moyenne numeric, nombre int, annonces int)
language sql stable security definer set search_path = public as $$
  with s as (select cible_id, avg(note) m, count(*) c from public.avis group by cible_id)
  select s.cible_id, coalesce(public.nom_public(s.cible_id), 'Membre'), p.avatar, p.role, round(s.m::numeric, 1), s.c::int,
         ((select count(*) from public.offres o where o.user_id = s.cible_id and o.status = 'active') + (select count(*) from public.demandes d where d.user_id = s.cible_id and d.status = 'active'))::int
  from s left join public.profils p on p.user_id = s.cible_id
  where p.supprime_le is null
  order by (s.c * s.m + 3 * 4.0) / (s.c + 3) desc, s.c desc limit least(greatest(n, 1), 100);
$$;

-- ——— signalements : la raison visible des autres (catégorie seulement) ———
create or replace function public.signalements_publics(ids uuid[]) returns table (cible_id uuid, nombre int, raisons text[])
language sql stable security definer set search_path = public as $$
  select s.cible_id, count(*)::int, (array_agg(distinct split_part(s.motif, ' — ', 1)) filter (where s.motif is not null))[1:4]
  from public.signalements s where s.cible_id = any (ids[1:300]) group by s.cible_id;
$$;

-- ——— négociations masquées (pour soi seulement) ———
alter table public.negociations add column if not exists cache_auteur timestamptz, add column if not exists cache_proprio timestamptz;
create or replace function public.nego_masquer(p_nego uuid) returns void
language sql volatile security definer set search_path = public as $$
  update public.negociations set cache_auteur = case when auteur_id = auth.uid() then now() else cache_auteur end,
                                 cache_proprio = case when proprio_id = auth.uid() then now() else cache_proprio end
  where id = p_nego and auth.uid() in (auteur_id, proprio_id);
$$;
-- masquer ne doit pas compter comme une « activité » (updated_at) : le déclencheur de mise à jour éventuel n'est pas concerné,
-- car seul cache_* change ; la négociation réapparaît si updated_at dépasse l'heure du masquage (nouveau message de l'autre).

revoke execute on function public.peut_noter(uuid), public.noter(uuid, int, text), public.nom_public(uuid), public.notes_publiques(uuid[]), public.avis_de(uuid), public.mieux_notes(int), public.signalements_publics(uuid[]), public.nego_masquer(uuid) from public;
grant execute on function public.notes_publiques(uuid[]), public.avis_de(uuid), public.mieux_notes(int), public.signalements_publics(uuid[]) to anon, authenticated;
grant execute on function public.peut_noter(uuid), public.noter(uuid, int, text), public.nego_masquer(uuid) to authenticated;
