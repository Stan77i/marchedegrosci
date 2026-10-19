-- ═════════ Marché de Gros CI — schéma 23 : la structure qu'un membre représente (20 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 20 octobre 2026.)
--
-- Un membre dit s'il agit seul ou pour une structure : coopérative, groupement / association, entreprise.
-- Il donne son nom et, s'il le veut, son logo et jusqu'à 4 images qui prouvent qu'elle existe
-- (enseigne, entrepôt, agrément, parcelle). Les images vont dans le stockage public « activites » (comme les photos de profil).
-- Le profil public le montre en tête, les annonces et les messages portent une puce discrète « Coopérative · Nom ».
-- Le compte officiel (administrateur) reste « Marché de Gros » : on ne montre jamais de structure pour lui.
--
-- Aussi :
--  • « Mon profil public » (présentation, activités, photos) ne pouvait pas s'enregistrer : les colonnes bio, activites et photos
--    n'avaient pas le droit de modification. Réparé.
--  • profils_publics donnait le vrai prénom de l'administrateur (avatars, listes) : il donne maintenant « Marché de Gros ».

-- ——— 1) les colonnes ———
alter table public.profils add column if not exists structure_type text;
alter table public.profils add column if not exists structure_nom text;
alter table public.profils add column if not exists structure_logo text;
alter table public.profils add column if not exists structure_preuves text[] not null default '{}';
do $$ begin
  alter table public.profils add constraint profils_structure_type_check check (structure_type is null or structure_type in ('particulier', 'cooperative', 'groupement', 'entreprise'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profils add constraint profils_structure_nom_check check (structure_nom is null or char_length(btrim(structure_nom)) between 2 and 80);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profils add constraint profils_structure_preuves_check check (coalesce(array_length(structure_preuves, 1), 0) <= 4);
exception when duplicate_object then null; end $$;

grant insert (structure_type, structure_nom, structure_logo, structure_preuves) on public.profils to authenticated;
grant update (structure_type, structure_nom, structure_logo, structure_preuves, bio, activites, photos) on public.profils to authenticated;
grant select (structure_type, structure_nom, structure_logo, structure_preuves) on public.profils to authenticated;

-- une structure « particulier » n'a ni nom, ni logo, ni preuves ; les chemins d'images restent dans le dossier du membre
create or replace function public.structure_propre() returns trigger
language plpgsql set search_path = public as $f$
begin
  if new.structure_type is null or new.structure_type = 'particulier' then
    new.structure_nom := null; new.structure_logo := null; new.structure_preuves := '{}';
  else
    new.structure_nom := nullif(btrim(new.structure_nom), '');
    if new.structure_logo is not null and split_part(new.structure_logo, '/', 1) <> new.user_id::text then new.structure_logo := null; end if;
    new.structure_preuves := coalesce((select array_agg(x) from unnest(new.structure_preuves) x where split_part(x, '/', 1) = new.user_id::text), '{}');
  end if;
  return new;
end $f$;
create or replace trigger profils_structure_propre before insert or update on public.profils for each row execute function public.structure_propre();

-- ——— 2) pas de lien dans le nom de la structure (règle du schéma 22, une branche par table) ———
create or replace function public.garde_textes() returns trigger
language plpgsql set search_path = public as $f$
declare r text; t text;
begin
  -- l'administrateur (le « Marché de Gros » officiel) peut écrire des liens ; personne d'autre.
  -- Chaque table a sa propre branche : PL/pgSQL ne lit les champs de NEW que dans la branche exécutée.
  if public.est_admin() then return new; end if;
  if tg_table_name in ('dm', 'messages', 'avis') then
    t := new.texte;
  elsif tg_table_name = 'profils' then
    t := concat_ws(' · ', new.prenom, new.nom, new.pseudo, new.bio, new.activites, new.structure_nom);
  elsif tg_table_name = 'offres' then
    if public.est_admin_id(new.user_id) then return new; end if;
    t := concat_ws(' · ', new.seller_name, new.city, new.agent, new.product_label);
  elsif tg_table_name = 'demandes' then
    if public.est_admin_id(new.user_id) then return new; end if;
    t := concat_ws(' · ', new.buyer_name, new.city, new.product_label);
  end if;
  r := public.texte_refus(t);
  if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  return new;
end $f$;

-- ——— 3) lecture publique ———
-- la structure d'un membre (profil public) : à part de profil_public, pour ne pas la réécrire
create or replace function public.structure_publique(p_uid uuid) returns json
language sql stable security definer set search_path = public as $f$
  select case when public.est_admin_id(p.user_id) or p.supprime_le is not null or p.structure_type is null or p.structure_type = 'particulier' or p.structure_nom is null
              then json_build_object('type', case when public.est_admin_id(p.user_id) then null else p.structure_type end)
              else json_build_object('type', p.structure_type, 'nom', p.structure_nom, 'logo', p.structure_logo, 'preuves', coalesce(p.structure_preuves, '{}')) end
  from public.profils p where p.user_id = p_uid;
$f$;
revoke execute on function public.structure_publique(uuid) from public;
grant execute on function public.structure_publique(uuid) to anon, authenticated;

-- les noms affichés partout (avatars, cartes, messages) : l'administrateur s'appelle « Marché de Gros »
create or replace function public.profils_publics(ids uuid[])
returns table (user_id uuid, affichage text, avatar text, role text)
language sql stable security definer set search_path = public as $f$
  select p.user_id,
    case when public.est_admin_id(p.user_id) then 'Marché de Gros'
         when p.supprime_le is not null then 'Compte supprimé'
         when p.pseudo is not null then p.pseudo
         when p.prenom is not null then p.prenom || coalesce(' ' || case when p.nom_public then p.nom else left(p.nom, 1) || '.' end, '')
         else null end,
    case when p.supprime_le is null and not public.est_admin_id(p.user_id) then p.avatar end,
    case when p.supprime_le is null then p.role end
  from public.profils p where p.user_id = any (ids[1:200]);
$f$;

-- la même chose avec la structure (cartes d'annonce, messages : « Coopérative · Nom »)
create or replace function public.profils_publics2(ids uuid[])
returns table (user_id uuid, affichage text, avatar text, role text, structure_type text, structure_nom text, structure_logo text)
language sql stable security definer set search_path = public as $f$
  select p.user_id,
    case when public.est_admin_id(p.user_id) then 'Marché de Gros'
         when p.supprime_le is not null then 'Compte supprimé'
         when p.pseudo is not null then p.pseudo
         when p.prenom is not null then p.prenom || coalesce(' ' || case when p.nom_public then p.nom else left(p.nom, 1) || '.' end, '')
         else null end,
    case when p.supprime_le is null and not public.est_admin_id(p.user_id) then p.avatar end,
    case when p.supprime_le is null then p.role end,
    case when p.supprime_le is null and not public.est_admin_id(p.user_id) and p.structure_nom is not null then p.structure_type end,
    case when p.supprime_le is null and not public.est_admin_id(p.user_id) and p.structure_type <> 'particulier' then p.structure_nom end,
    case when p.supprime_le is null and not public.est_admin_id(p.user_id) and p.structure_nom is not null then p.structure_logo end
  from public.profils p where p.user_id = any (ids[1:200]);
$f$;
revoke execute on function public.profils_publics2(uuid[]) from public;
grant execute on function public.profils_publics2(uuid[]) to anon, authenticated;
