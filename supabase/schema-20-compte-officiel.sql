-- ═════════ Marché de Gros CI — schéma 20 : le compte administrateur parle au nom du « Marché de Gros » (19 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 19 octobre 2026.)
--
-- 1) identite_statut : le schéma 16 avait réécrit la fonction et perdu 'exempt' (l'admin se voyait demander sa pièce),
--    'annonces', 'gratuites' et 'banni' (le compteur « annonces gratuites » ne s'affichait plus). On les remet.
-- 2) Un administrateur s'affiche partout « Marché de Gros » : nom public, annonces (nom du vendeur / de l'acheteur),
--    messages et classements. Jamais son prénom, jamais son numéro (les numéros sont déjà retirés de toutes les annonces).
-- 3) Le compte officiel ne reçoit pas d'étoiles et n'entre pas dans le classement des mieux notés.
-- 4) officiels() : la liste des comptes officiels, pour que l'application affiche le badge « Officiel ».
-- 5) La table alertes avait ses règles (seul l'admin lit) mais pas le droit de base : « permission denied ». Réparé.

-- ——— 1) ———
create or replace function public.identite_statut() returns json
language sql stable security definer set search_path = public as $f$
  select (coalesce((
    select jsonb_build_object('id', v.id,
             'statut', case when v.statut = 'verifie' and (v.expire_le is null or v.expire_le < current_date) then 'expire' else v.statut end,
             'piece', v.piece, 'motif', v.motif, 'soumis_le', v.soumis_le, 'decide_le', v.decide_le, 'expire_le', v.expire_le,
             'nouvel_essai_le', case when v.statut = 'refuse' then v.decide_le + interval '7 days' end,
             'defi', case when v.statut = 'brouillon' then v.defi end,
             'dossier', case when v.statut = 'brouillon' then public.identite_dossier(v) end)
    from public.verifications v
    where v.user_id = auth.uid() and v.statut not in ('remplace', 'retire')
    order by v.created_at desc limit 1),
    jsonb_build_object('statut', 'non_verifie'))
  || jsonb_build_object(
       'annonces', coalesce((select n from public.annonces_publiees where user_id = auth.uid()), 0),
       'gratuites', public.annonces_gratuites(),
       'exempt', public.est_admin(),
       'officiel', public.est_admin(),
       'banni', public.est_banni(auth.uid())))::json;
$f$;
grant execute on function public.identite_statut() to authenticated;

-- ——— 2) ———
create or replace function public.nom_public(uid uuid) returns text
language sql stable security definer set search_path = public as $f$
  select case when public.est_admin_id(uid) then 'Marché de Gros' else (
    select case when p.supprime_le is not null then 'Compte supprimé' when p.pseudo is not null then p.pseudo
                when p.prenom is not null then p.prenom || coalesce(' ' || case when p.nom_public then p.nom else left(p.nom, 1) || '.' end, '') end
    from public.profils p where p.user_id = uid) end;
$f$;

create or replace function public.annonce_officielle() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if public.est_admin_id(new.user_id) then
    new.phone := null;
    if tg_table_name = 'offres' then new.seller_name := 'Marché de Gros'; else new.buyer_name := 'Marché de Gros'; end if;
  end if;
  return new;
end $f$;
create or replace trigger offres_officielle before insert or update on public.offres for each row execute function public.annonce_officielle();
create or replace trigger demandes_officielle before insert or update on public.demandes for each row execute function public.annonce_officielle();
update public.offres set seller_name = 'Marché de Gros' where public.est_admin_id(user_id) and seller_name is distinct from 'Marché de Gros';
update public.demandes set buyer_name = 'Marché de Gros' where public.est_admin_id(user_id) and buyer_name is distinct from 'Marché de Gros';

-- ——— 3) ———
create or replace function public.noter(p_cible uuid, p_note integer, p_texte text default null) returns void
language plpgsql security definer set search_path = public as $f$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_cible = auth.uid() then raise exception 'On ne se note pas soi-même.'; end if;
  if public.est_admin_id(p_cible) then raise exception 'Le Marché de Gros officiel ne reçoit pas de note.'; end if;
  if p_note not between 1 and 5 then raise exception 'Une note de 1 à 5 étoiles.'; end if;
  if not exists (select 1 from public.negociations n where (n.auteur_id = auth.uid() and n.proprio_id = p_cible) or (n.proprio_id = auth.uid() and n.auteur_id = p_cible)) then
    raise exception 'PAS_DE_NEGOCIATION'; end if;
  insert into public.avis (auteur_id, cible_id, note, texte) values (auth.uid(), p_cible, p_note, nullif(btrim(left(p_texte, 300)), ''))
  on conflict (auteur_id, cible_id) do update set note = excluded.note, texte = excluded.texte, updated_at = now();
end $f$;

create or replace function public.mieux_notes(n integer default 30)
returns table (user_id uuid, affichage text, avatar text, role text, moyenne numeric, nombre integer, annonces integer)
language sql stable security definer set search_path = public as $f$
  with s as (select cible_id, avg(note) m, count(*) c from public.avis where not public.est_admin_id(cible_id) group by cible_id)
  select s.cible_id, coalesce(public.nom_public(s.cible_id), 'Membre'), p.avatar, p.role, round(s.m::numeric, 1), s.c::int,
         ((select count(*) from public.offres o where o.user_id = s.cible_id and o.status = 'active') + (select count(*) from public.demandes d where d.user_id = s.cible_id and d.status = 'active'))::int
  from s left join public.profils p on p.user_id = s.cible_id
  where p.supprime_le is null
  order by (s.c * s.m + 3 * 4.0) / (s.c + 3) desc, s.c desc limit least(greatest(n, 1), 100);
$f$;

-- ——— 4) ———
create or replace function public.officiels() returns setof uuid
language sql stable security definer set search_path = public as $f$ select user_id from public.admins; $f$;
revoke execute on function public.officiels() from public;
grant execute on function public.officiels() to anon, authenticated;

-- ——— 5) ———
grant select, update, delete on public.alertes to authenticated;
