-- ═════════ Marché de Gros CI — étape 4 : profil, avatar, confidentialité, suppression du compte (12 octobre 2026) ═════════
-- À lancer APRÈS les étapes 1 à 3. Peut être relancé sans danger.
--
-- Le compte (auth.users : numéro + code secret) reste séparé du profil (public.profils : comment on vous appelle).
-- Le numéro n'est PAS vérifié par SMS (aucun service payant) : il est affiché comme « non vérifié ».
-- Ce que les autres voient passe par profils_publics() : un nom d'affichage (pseudonyme, ou prénom + initiale du nom
-- sauf si vous choisissez d'afficher votre nom), l'avatar et le rôle. Jamais le nom complet sans votre accord.

create table if not exists public.profils (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  prenom      text check (prenom is null or prenom ~ '^[[:alpha:]][[:alpha:] ''’.-]{0,39}$'),
  nom         text check (nom is null or nom ~ '^[[:alpha:]][[:alpha:] ''’.-]{0,59}$'),
  pseudo      text check (pseudo is null or pseudo ~ '^[A-Za-z0-9_.-]{3,24}$'),
  avatar      text check (avatar is null or char_length(avatar) <= 200),
  role        text check (role in ('acheteur', 'vendeur', 'les_deux')),
  region_slug text check (char_length(region_slug) <= 60),
  ville       text check (char_length(ville) <= 80),
  nom_public  boolean not null default false,
  supprime_le timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists profils_pseudo_unique on public.profils (lower(pseudo)) where pseudo is not null;
alter table public.profils enable row level security;

create policy "voir mon profil"    on public.profils for select to authenticated using (user_id = auth.uid() or (select public.est_admin()));
create policy "créer mon profil"   on public.profils for insert to authenticated with check (user_id = auth.uid() and supprime_le is null);
create policy "modifier mon profil" on public.profils for update to authenticated using (user_id = auth.uid() and supprime_le is null) with check (user_id = auth.uid() and supprime_le is null);
grant select, insert, update (user_id, prenom, nom, pseudo, avatar, role, region_slug, ville, nom_public, updated_at) on public.profils to authenticated;  -- user_id : l'enregistrement « crée ou remplace » le réécrit ; la règle ci-dessus interdit d'en changer
revoke truncate, references, trigger, delete on public.profils from anon, authenticated;

create or replace function public.profil_maj() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); new.prenom := nullif(btrim(new.prenom), ''); new.nom := nullif(btrim(new.nom), ''); new.pseudo := nullif(btrim(new.pseudo), ''); return new; end $$;
create trigger profil_maj before insert or update on public.profils for each row execute function public.profil_maj();

-- ce que tout le monde peut voir d'un compte (pour les annonces et les négociations)
create or replace function public.profils_publics(ids uuid[])
returns table (user_id uuid, affichage text, avatar text, role text)
language sql stable security definer set search_path = public as $$
  select p.user_id,
    case when p.supprime_le is not null then 'Compte supprimé'
         when p.pseudo is not null then p.pseudo
         when p.prenom is not null then p.prenom || coalesce(' ' || case when p.nom_public then p.nom else left(p.nom, 1) || '.' end, '')
         else null end,
    case when p.supprime_le is null then p.avatar end,
    case when p.supprime_le is null then p.role end
  from public.profils p where p.user_id = any (ids[1:200]);
$$;

-- suppression du compte : les annonces sont retirées (les négociations ouvertes se ferment), le profil est effacé,
-- le code de secours supprimé et la connexion bloquée. Les accords conclus et les messages restent, pour la traçabilité
-- des échanges entre les deux parties ; l'autre partie y voit « Compte supprimé ».
create or replace function public.supprimer_compte() returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  update public.offres   set status = 'retiree' where user_id = me and status = 'active';
  update public.demandes set status = 'retiree' where user_id = me and status = 'active';
  insert into public.profils (user_id) values (me) on conflict (user_id) do nothing;
  update public.profils set prenom = null, nom = null, pseudo = null, avatar = null, role = null, region_slug = null, ville = null, supprime_le = now() where user_id = me;
  delete from public.secours where user_id = me;
  update auth.users set banned_until = 'infinity' where id = me;
end $$;

revoke execute on function public.profil_maj() from public, anon, authenticated;
revoke execute on function public.profils_publics(uuid[]), public.supprimer_compte() from public;
grant execute on function public.profils_publics(uuid[]) to anon, authenticated;
grant execute on function public.supprimer_compte() to authenticated;
