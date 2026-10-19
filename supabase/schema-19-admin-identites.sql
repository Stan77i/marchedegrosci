-- ═════════ Marché de Gros CI — schéma 19 : l'administrateur et les dossiers d'identité (19 octobre 2026) ═════════
-- À lancer APRÈS les schémas 13 à 18. Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 19 octobre 2026.)
-- Aucun « drop » : seulement des « create or replace ».
--
--   1. Notification aux administrateurs à chaque dossier envoyé (fonction Edge « pousser », { identite_id }) :
--      « Nouveau dossier d'identité · N dossiers à examiner ». Aucune donnée personnelle dans la notification.
--      Même étiquette à chaque fois : la nouvelle remplace l'ancienne (regroupement quand beaucoup arrivent d'un coup).
--   2. Résumé chaque matin à 7 h 45 (heure d'Abidjan = UTC) : tâche pg_cron « mdg-identites-matin » → { resume_identites: true }.
--      Rien n'est envoyé s'il n'y a aucun dossier en attente.
--   3. admin_identite_compte() : le nombre de dossiers à examiner (compteur du menu de l'application ; 0 pour un non-administrateur).
--   4. admin_identite_examen() : les dossiers en attente avec les contrôles automatiques et une pile
--      (propre · regarder · suspect). C'est une aide au tri, jamais une décision : l'administrateur regarde chaque dossier.

-- ——— 1) notification à chaque dossier envoyé ———
create or replace function public.push_identite() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $f$
declare v_url text; v_cle text;
begin
  if new.statut <> 'en_attente' or old.statut = 'en_attente' then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('identite_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $f$;
create or replace trigger verifications_push after update of statut on public.verifications
  for each row execute function public.push_identite();

-- ——— 2) résumé du matin ———
create or replace function public.push_resume_identites() returns void
language plpgsql security definer set search_path = public, vault, extensions as $f$
declare v_url text; v_cle text;
begin
  if not exists (select 1 from public.verifications where statut = 'en_attente') then return; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('resume_identites', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
end $f$;
revoke execute on function public.push_resume_identites(), public.push_identite() from public, anon, authenticated;
do $f$ begin
  if not exists (select 1 from cron.job where jobname = 'mdg-identites-matin') then
    perform cron.schedule('mdg-identites-matin', '45 7 * * *', 'select public.push_resume_identites()');
  end if;
end $f$;

-- ——— 3) compteur du menu ———
create or replace function public.admin_identite_compte() returns int
language sql stable security definer set search_path = public as $f$
  select case when public.est_admin() then (select count(*)::int from public.verifications where statut = 'en_attente') else 0 end;
$f$;
revoke execute on function public.admin_identite_compte() from public, anon;
grant execute on function public.admin_identite_compte() to authenticated;

-- ——— 4) tri automatique ———
-- un nom comparable : minuscules, sans accents ni ponctuation, mots triés (l'ordre nom / prénoms ne compte pas)
create or replace function public.identite_norm_nom(t text) returns text
language sql immutable as $f$
  select coalesce(string_agg(w, ' ' order by w), '') from unnest(regexp_split_to_array(
    regexp_replace(translate(lower(coalesce(t, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'), '[^a-z]+', ' ', 'g'), '\s+')) as w
  where w <> '';
$f$;
-- tous les mots lus sur la pièce sont-ils dans le nom saisi ? (la bande coupe souvent la fin des prénoms : on accepte un début de mot)
create or replace function public.identite_nom_concorde(saisi text, lu text) returns boolean
language sql immutable as $f$
  select case when coalesce(btrim(lu), '') = '' then null else not exists (
    select 1 from unnest(string_to_array(public.identite_norm_nom(lu), ' ')) l
    where not exists (select 1 from unnest(string_to_array(public.identite_norm_nom(saisi), ' ')) s where s = l or (char_length(l) >= 3 and s like l || '%')))
  end;
$f$;
create or replace function public.admin_identite_examen()
returns table (id uuid, user_id uuid, piece text, defi text, nom_saisi text, nom_lu text, mrz_ok boolean, soumis_le timestamptz, dossier text,
               tel text, profil_nom text, membre_depuis timestamptz, essais bigint, expire_le date, expire_lu date, numero_lu text,
               nom_ok boolean, expire_ok boolean, expire_coherent boolean, doublon boolean, nom_banni boolean, pile text, raisons text[])
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  with base as (
    select v.*, public.identite_dossier(v) as dos, coalesce(split_part(u.email, '@', 1), v.tel)::text as tel2,
      nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), '') as pnom, u.created_at as depuis,
      (select count(*) from public.verifications w where w.user_id = v.user_id and w.soumis_le is not null) as nb,
      public.identite_nom_concorde(v.nom_saisi, v.nom_lu) as n_ok,
      v.expire_le is not null and v.expire_le >= current_date as e_ok,
      v.expire_lu is null or v.expire_le is null or v.expire_lu = v.expire_le as e_coh,
      coalesce(nullif(regexp_replace(upper(coalesce(v.numero_lu, '')), '[^A-Z0-9]', '', 'g'), ''), null) as num,
      exists (select 1 from public.bannis b where b.nom_confirme is not null
              and (public.identite_norm_nom(b.nom_confirme) = public.identite_norm_nom(v.nom_saisi)
                   or (v.nom_lu is not null and public.identite_norm_nom(b.nom_confirme) = public.identite_norm_nom(v.nom_lu)))) as banni
    from public.verifications v
    join auth.users u on u.id = v.user_id
    left join public.profils p on p.user_id = v.user_id
    where v.statut = 'en_attente'
  ), ctrl as (
    select b.*, b.num is not null and exists (select 1 from public.verifications w where w.user_id is distinct from b.user_id and w.soumis_le is not null
        and regexp_replace(upper(coalesce(w.numero, w.numero_lu, '')), '[^A-Z0-9]', '', 'g') = b.num) as dbl
    from base b
  )
  select c.id, c.user_id, c.piece, c.defi, c.nom_saisi, c.nom_lu, c.mrz_ok, c.soumis_le, c.dos, c.tel2, c.pnom, c.depuis, c.nb,
    c.expire_le, c.expire_lu, c.numero_lu, c.n_ok, c.e_ok, c.e_coh, c.dbl, c.banni,
    case when c.dbl or c.banni or not c.e_ok or not c.e_coh then 'suspect'
         when coalesce(c.mrz_ok, false) and coalesce(c.n_ok, false) and c.nb <= 2 then 'propre'
         else 'regarder' end,
    array_remove(array[
      case when c.dbl then 'Numéro de pièce déjà utilisé par un autre compte' end,
      case when c.banni then 'Nom identique à celui d''une personne bannie' end,
      case when not c.e_ok then 'Pièce expirée ou sans date' end,
      case when not c.e_coh then 'La date lue sur la bande diffère de la date saisie' end,
      case when c.mrz_ok is null then 'Bande de la pièce non lue' when not c.mrz_ok then 'Bande lue, chiffres de contrôle faux' end,
      case when c.n_ok = false then 'Nom saisi différent du nom lu' end,
      case when c.nb > 2 then c.nb || 'e envoi' end], null)
  from ctrl c
  order by case when c.dbl or c.banni or not c.e_ok or not c.e_coh then 2 when coalesce(c.mrz_ok, false) and coalesce(c.n_ok, false) and c.nb <= 2 then 0 else 1 end, c.soumis_le;
end $f$;
revoke execute on function public.admin_identite_examen() from public, anon;
grant execute on function public.admin_identite_examen() to authenticated;

-- contrôle : la tâche du matin et le déclencheur existent
select jobname, schedule from cron.job where jobname = 'mdg-identites-matin';
select tgname from pg_trigger where tgname = 'verifications_push';
