-- ═════════ Marché de Gros CI — schéma 15 : signaler une personne ; effacer les dossiers d'identité abandonnés (18 octobre 2026) ═════════
-- À lancer dans l'éditeur SQL de Supabase APRÈS schema-14-confiance.sql. Peut être relancé sans danger.
--
--   • « Signaler cette personne » (discussions, négociations, profil) : arnaque, insultes, mauvais produits, autre.
--     Le signalement arrive dans le tableau de bord (Messages), avec le bouton Bannir. La personne signalée n'en sait rien.
--     Une personne ne peut signaler la même personne qu'une fois par motif, et 10 fois par jour au plus.
--   • Dossiers d'identité abandonnés : photos encore stockées d'un dossier jamais envoyé (brouillon) ou laissé « à revoir »
--     depuis 30 jours, ou d'un dossier retiré / remplacé / décidé dont l'effacement avait échoué. Le tableau de bord les
--     efface tout seul à chaque ouverture (API Storage, droits administrateur), puis le note ici.
--
-- Sécurité : tables sans aucun accès direct (RLS active, aucune politique) ; tout passe par des fonctions qui vérifient
-- qui appelle. Aucune donnée de pièce d'identité n'est lue ni journalisée.

-- ——— 1) signaler une personne ———
create table if not exists public.signalements_membres (
  id         uuid primary key default gen_random_uuid(),
  auteur_id  uuid not null references auth.users(id) on delete cascade,
  cible_id   uuid not null references auth.users(id) on delete cascade,
  motif      text not null check (motif in ('arnaque', 'insultes', 'mauvais_produits', 'autre')),
  detail     text check (detail is null or char_length(detail) <= 500),
  source     text not null default 'profil' check (source in ('dm', 'negociation', 'profil')),
  ref_id     uuid,
  traite     boolean not null default false,
  created_at timestamptz not null default now(),
  unique (auteur_id, cible_id, motif),
  check (auteur_id <> cible_id)
);
create index if not exists signalements_membres_cible on public.signalements_membres (cible_id, created_at desc);
create index if not exists signalements_membres_file on public.signalements_membres (created_at desc) where not traite;
alter table public.signalements_membres enable row level security;
revoke all on public.signalements_membres from anon, authenticated;

create or replace function public.signaler_membre(p_cible uuid, p_motif text, p_detail text default null, p_source text default 'profil', p_ref uuid default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour signaler une personne.'; end if;
  if p_cible is null or p_cible = auth.uid() then raise exception 'Signalement impossible.'; end if;
  if p_motif not in ('arnaque', 'insultes', 'mauvais_produits', 'autre') then raise exception 'Motif inconnu.'; end if;
  if public.est_banni(auth.uid()) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select count(*) into n from public.signalements_membres where auteur_id = auth.uid() and created_at > now() - interval '1 day';
  if n >= 10 then raise exception 'Vous avez fait beaucoup de signalements aujourd''hui. Réessayez demain, ou écrivez au Marché de Gros.'; end if;
  insert into public.signalements_membres (auteur_id, cible_id, motif, detail, source, ref_id)
  values (auth.uid(), p_cible, p_motif, left(nullif(btrim(p_detail), ''), 500),
          case when p_source in ('dm', 'negociation', 'profil') then p_source else 'profil' end, p_ref)
  on conflict (auteur_id, cible_id, motif) do update
    set detail = coalesce(excluded.detail, public.signalements_membres.detail), source = excluded.source,
        ref_id = coalesce(excluded.ref_id, public.signalements_membres.ref_id), traite = false, created_at = now();
end $$;

-- le tableau de bord : les signalements, avec le nombre de personnes différentes qui ont signalé la même cible
create or replace function public.admin_signalements_membres()
returns table (id uuid, created_at timestamptz, motif text, detail text, source text, ref_id uuid, traite boolean,
               cible_id uuid, cible_tel text, auteur_id uuid, auteur_tel text, signale_par int, cible_banni boolean, cible_verifie boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select s.id, s.created_at, s.motif, s.detail, s.source, s.ref_id, s.traite,
         s.cible_id, split_part(c.email, '@', 1), s.auteur_id, split_part(a.email, '@', 1),
         (select count(distinct x.auteur_id)::int from public.signalements_membres x where x.cible_id = s.cible_id),
         public.est_banni(s.cible_id), public.identite_ok(s.cible_id)
  from public.signalements_membres s
  left join auth.users c on c.id = s.cible_id
  left join auth.users a on a.id = s.auteur_id
  where s.created_at > now() - interval '90 days'
  order by s.traite, s.created_at desc
  limit 300;
end $$;

create or replace function public.admin_signalement_membre_traite(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.signalements_membres set traite = true where id = p_id;
end $$;

-- ——— 2) dossiers d'identité abandonnés : photos à effacer ———
create or replace function public.admin_identite_a_purger()
returns table (id uuid, dossier text, statut text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select v.id, v.user_id::text || '/' || v.id::text, v.statut
  from public.verifications v
  where v.photos_effacees_le is null
    and (   v.statut in ('retire', 'remplace', 'verifie', 'refuse')
         or (v.statut = 'brouillon' and v.created_at < now() - interval '30 days')
         or (v.statut = 'verification_manuelle' and coalesce(v.decide_le, v.created_at) < now() - interval '30 days'))
  order by v.created_at
  limit 50;
end $$;

-- après l'effacement des photos : un dossier abandonné est fermé (la personne pourra en recommencer un)
create or replace function public.admin_identite_purger(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.verifications
     set photos_effacees_le = now(),
         statut = case when statut in ('brouillon', 'verification_manuelle') then 'retire' else statut end
   where id = p_id and photos_effacees_le is null
     and (   statut in ('retire', 'remplace', 'verifie', 'refuse')
          or (statut = 'brouillon' and created_at < now() - interval '30 days')
          or (statut = 'verification_manuelle' and coalesce(decide_le, created_at) < now() - interval '30 days'));
end $$;

-- ——— 3) droits ———
revoke execute on function public.signaler_membre(uuid, text, text, text, uuid), public.admin_signalements_membres(),
  public.admin_signalement_membre_traite(uuid), public.admin_identite_a_purger(), public.admin_identite_purger(uuid) from public, anon;
grant execute on function public.signaler_membre(uuid, text, text, text, uuid), public.admin_signalements_membres(),
  public.admin_signalement_membre_traite(uuid), public.admin_identite_a_purger(), public.admin_identite_purger(uuid) to authenticated;

-- contrôle : dossiers dont les photos seront effacées à la prochaine ouverture du tableau de bord
select count(*) as dossiers_a_effacer from public.verifications v
where v.photos_effacees_le is null
  and (v.statut in ('retire', 'remplace', 'verifie', 'refuse')
       or (v.statut = 'brouillon' and v.created_at < now() - interval '30 days')
       or (v.statut = 'verification_manuelle' and coalesce(v.decide_le, v.created_at) < now() - interval '30 days'));
