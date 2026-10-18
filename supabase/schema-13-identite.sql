-- ═════════ Marché de Gros CI — schéma 13 : vérification d'identité (18 octobre 2026) ═════════
-- À lancer dans l'éditeur SQL de Supabase APRÈS les schémas 1 à 12. Peut être relancé sans danger.
--
-- Principe : la personne dépose ses photos (pièce recto, verso, selfie tenant un code écrit à la main) ;
-- SEUL un administrateur décide. Aucune décision automatique : la lecture de la carte faite dans le téléphone
-- (nom lu, bande MRZ valide) n'est qu'une indication montrée à l'administrateur.
--
-- Sécurité :
--   • table public.verifications : RLS active, AUCUNE politique, aucun droit direct pour anon / authenticated.
--     Tout passe par des fonctions qui vérifient qui appelle (auth.uid(), public.est_admin()).
--   • espace de stockage « identite » PRIVÉ : la personne dépose dans son dossier tant qu'il est en brouillon, ne peut rien
--     remplacer, et ne voit / n'efface ses photos que tant que le dossier n'est pas décidé ; les administrateurs lisent (liens signés courts).
--   • aucun numéro de pièce conservé ; aucune donnée personnelle dans les messages d'erreur.
--
-- Statuts visibles : non vérifié (aucun dossier), en_attente, verification_manuelle, verifie, refuse.
-- Statuts internes : brouillon (photos en cours d'envoi), remplace (renvoyé après « à revoir »), retire (retiré ou compte supprimé).

-- ——— 1) la table ———
create table if not exists public.verifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  statut       text not null default 'brouillon'
               check (statut in ('brouillon', 'en_attente', 'verification_manuelle', 'verifie', 'refuse', 'remplace', 'retire')),
  piece        text not null check (piece in ('cni', 'passeport', 'carte_consulaire', 'permis')),
  defi         text not null check (defi ~ '^[0-9]{4}$'),            -- code à écrire sur le papier du selfie
  nom_saisi    text check (nom_saisi is null or char_length(nom_saisi) <= 120),   -- nom confirmé par la personne
  nom_lu       text check (nom_lu is null or char_length(nom_lu) <= 120),         -- lu automatiquement (indication)
  mrz_ok       boolean,                                               -- chiffres de contrôle de la bande MRZ justes (indication)
  nom_confirme text check (nom_confirme is null or char_length(nom_confirme) <= 120), -- retenu par l'administrateur
  motif        text check (motif is null or char_length(motif) <= 300),
  created_at   timestamptz not null default now(),
  soumis_le    timestamptz,
  decide_le    timestamptz,
  decide_par   uuid references auth.users(id) on delete set null,
  photos_effacees_le timestamptz
);
-- un seul dossier ouvert à la fois par personne
create unique index if not exists verifications_un_ouvert on public.verifications (user_id)
  where statut in ('brouillon', 'en_attente', 'verification_manuelle');
create index if not exists verifications_user on public.verifications (user_id, created_at desc);
create index if not exists verifications_file on public.verifications (soumis_le) where statut in ('en_attente', 'verification_manuelle');

alter table public.verifications enable row level security;   -- aucune politique : illisible et inmodifiable en direct
revoke all on public.verifications from anon, authenticated;

-- dossier de stockage d'une vérification : <user_id>/<id>
create or replace function public.identite_dossier(v public.verifications) returns text
language sql immutable as $$ select v.user_id::text || '/' || v.id::text $$;

-- ——— 2) l'espace de stockage privé ———
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identite', 'identite', false, 1500000, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 1500000, allowed_mime_types = array['image/jpeg'];

-- le dossier (« uid/id ») appartient-il à un brouillon de la personne qui appelle ?
create or replace function public.identite_dossier_ouvert(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.verifications v
    where v.user_id = auth.uid() and v.statut = 'brouillon'
      and split_part(p_name, '/', 1) = v.user_id::text
      and split_part(p_name, '/', 2) = v.id::text
      and split_part(p_name, '/', 3) in ('recto.jpg', 'verso.jpg', 'selfie.jpg'));
$$;
revoke execute on function public.identite_dossier_ouvert(text) from public, anon;
grant execute on function public.identite_dossier_ouvert(text) to authenticated;

-- la personne peut effacer les photos de son dossier tant qu'il n'est pas décidé (pour le retirer)
create or replace function public.identite_dossier_effacable(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.verifications v
    where v.user_id = auth.uid() and v.statut in ('brouillon', 'en_attente', 'verification_manuelle')
      and split_part(p_name, '/', 1) = v.user_id::text
      and split_part(p_name, '/', 2) = v.id::text);
$$;
revoke execute on function public.identite_dossier_effacable(text) from public, anon;
grant execute on function public.identite_dossier_effacable(text) to authenticated;

drop policy if exists "identite : déposer dans mon brouillon" on storage.objects;
drop policy if exists "identite : lecture admin" on storage.objects;
drop policy if exists "identite : effacer" on storage.objects;
create policy "identite : déposer dans mon brouillon" on storage.objects for insert to authenticated
  with check (bucket_id = 'identite' and (select public.identite_dossier_ouvert(name)));
create policy "identite : lecture admin" on storage.objects for select to authenticated
  using (bucket_id = 'identite' and ((select public.est_admin()) or (select public.identite_dossier_effacable(name))));
-- (la personne voit ses propres photos tant que le dossier est ouvert : Postgres l'exige pour pouvoir les effacer)
create policy "identite : effacer" on storage.objects for delete to authenticated
  using (bucket_id = 'identite' and ((select public.est_admin()) or (select public.identite_dossier_effacable(name))));
-- pas de politique « update » : une photo déposée ne peut pas être remplacée

-- ——— 3) côté membre ———
-- où en est ma vérification ? (le dernier dossier qui compte)
create or replace function public.identite_statut() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object('id', v.id, 'statut', v.statut, 'piece', v.piece, 'motif', v.motif,
             'soumis_le', v.soumis_le, 'decide_le', v.decide_le,
             'nouvel_essai_le', case when v.statut = 'refuse' then v.decide_le + interval '7 days' end,
             'defi', case when v.statut = 'brouillon' then v.defi end,
             'dossier', case when v.statut = 'brouillon' then public.identite_dossier(v) end)
    from public.verifications v
    where v.user_id = auth.uid() and v.statut not in ('remplace', 'retire')
    order by v.created_at desc limit 1),
    json_build_object('statut', 'non_verifie'));
$$;

-- commencer (ou reprendre) un dossier : renvoie le code à écrire et le dossier où déposer les photos
create or replace function public.identite_commencer(p_piece text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); v public.verifications; dernier public.verifications;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_piece not in ('cni', 'passeport', 'carte_consulaire', 'permis') then raise exception 'Type de pièce inconnu.'; end if;
  if exists (select 1 from public.profils p where p.user_id = me and p.supprime_le is not null) then raise exception 'Compte supprimé.'; end if;
  select * into dernier from public.verifications where user_id = me and statut not in ('remplace', 'retire', 'brouillon') order by created_at desc limit 1;
  if dernier.statut = 'en_attente' then raise exception 'Votre dossier est déjà en cours d''examen.'; end if;
  if dernier.statut = 'verifie' then raise exception 'Votre identité est déjà vérifiée.'; end if;
  if dernier.statut = 'refuse' and dernier.decide_le > now() - interval '7 days' then
    raise exception 'Nouvel essai possible à partir du %.', to_char(dernier.decide_le + interval '7 days', 'DD/MM/YYYY');
  end if;
  -- « à revoir » : l'ancien dossier est remplacé par le nouveau
  update public.verifications set statut = 'remplace' where user_id = me and statut = 'verification_manuelle';
  -- un brouillon existe déjà : on le reprend (même code, même dossier), avec la pièce choisie
  select * into v from public.verifications where user_id = me and statut = 'brouillon';
  if found then
    update public.verifications set piece = p_piece where id = v.id returning * into v;
  else
    insert into public.verifications (user_id, piece, defi)
    values (me, p_piece, lpad((floor(random() * 10000))::int::text, 4, '0')) returning * into v;
  end if;
  return json_build_object('id', v.id, 'defi', v.defi, 'dossier', public.identite_dossier(v), 'piece', v.piece);
end $$;

-- envoyer le dossier : les photos doivent être dans le dossier (recto, selfie ; verso sauf passeport)
create or replace function public.identite_soumettre(p_id uuid, p_nom text, p_nom_lu text default null, p_mrz_ok boolean default null) returns void
language plpgsql volatile security definer set search_path = public, storage as $$
declare me uuid := auth.uid(); v public.verifications; d text; n text := nullif(btrim(p_nom), '');
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into v from public.verifications where id = p_id and user_id = me and statut = 'brouillon' for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if n is null or char_length(n) < 3 or char_length(n) > 120 then raise exception 'Écrivez votre nom comme sur la pièce.'; end if;
  d := public.identite_dossier(v);
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/recto.jpg') then raise exception 'Photo du recto manquante.'; end if;
  if v.piece <> 'passeport' and not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/verso.jpg') then raise exception 'Photo du verso manquante.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/selfie.jpg') then raise exception 'Selfie manquant.'; end if;
  update public.verifications set statut = 'en_attente', soumis_le = now(), nom_saisi = n,
    nom_lu = left(nullif(btrim(p_nom_lu), ''), 120), mrz_ok = p_mrz_ok
  where id = v.id;
end $$;

-- retirer mon dossier avant décision (l'application efface d'abord les photos, permis par identite_dossier_effacable)
create or replace function public.identite_retirer() returns void
language sql volatile security definer set search_path = public as $$
  update public.verifications set statut = 'retire' where user_id = auth.uid() and statut in ('brouillon', 'en_attente', 'verification_manuelle');
$$;

-- ——— 4) le badge public ———
-- parmi ces comptes, lesquels ont une identité vérifiée ? (la dernière décision compte : un administrateur peut retirer le badge)
create or replace function public.identite_verifiee(ids uuid[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select x.user_id from (
    select distinct on (v.user_id) v.user_id, v.statut
    from public.verifications v
    where v.user_id = any (ids[1:200]) and v.statut in ('verifie', 'refuse') and v.decide_le is not null
    order by v.user_id, v.decide_le desc) x
  where x.statut = 'verifie'
    and not exists (select 1 from public.profils p where p.user_id = x.user_id and p.supprime_le is not null);
$$;

-- ——— 5) côté administrateur ———
create or replace function public.admin_identite_file()
returns table (id uuid, user_id uuid, statut text, piece text, defi text, nom_saisi text, nom_lu text, mrz_ok boolean,
               motif text, soumis_le timestamptz, dossier text, tel text, profil_nom text, profil_pseudo text, membre_depuis timestamptz, essais bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select v.id, v.user_id, v.statut, v.piece, v.defi, v.nom_saisi, v.nom_lu, v.mrz_ok, v.motif, v.soumis_le,
    public.identite_dossier(v), split_part(u.email, '@', 1)::text,
    nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), p.pseudo, u.created_at,
    (select count(*) from public.verifications w where w.user_id = v.user_id and w.soumis_le is not null)
  from public.verifications v
  join auth.users u on u.id = v.user_id
  left join public.profils p on p.user_id = v.user_id
  where v.statut in ('en_attente', 'verification_manuelle')
  order by v.statut = 'verification_manuelle', v.soumis_le;
end $$;

-- décider : verifie, verification_manuelle (à revoir, motif = ce qu'il faut refaire) ou refuse (motif obligatoire).
-- Retirer un badge déjà donné : décider « refuse » sur le dossier vérifié.
create or replace function public.admin_identite_decider(p_id uuid, p_statut text, p_motif text default null, p_nom text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare v public.verifications; m text := nullif(btrim(p_motif), '');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if p_statut not in ('verifie', 'verification_manuelle', 'refuse') then raise exception 'Décision inconnue.'; end if;
  if p_statut <> 'verifie' and m is null then raise exception 'Indiquez le motif.'; end if;
  select * into v from public.verifications where id = p_id for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if v.statut not in ('en_attente', 'verification_manuelle') and not (v.statut = 'verifie' and p_statut = 'refuse') then
    raise exception 'Ce dossier n''est plus à examiner.';
  end if;
  update public.verifications set statut = p_statut, motif = case when p_statut = 'verifie' then null else left(m, 300) end,
    nom_confirme = case when p_statut = 'verifie' then left(coalesce(nullif(btrim(p_nom), ''), v.nom_saisi), 120) else nom_confirme end,
    decide_le = now(), decide_par = auth.uid()
  where id = p_id;
end $$;

-- après chaque décision, la page admin efface les photos du dossier (API Storage) puis le note ici
create or replace function public.admin_identite_photos_effacees(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.verifications set photos_effacees_le = now() where id = p_id and photos_effacees_le is null;
end $$;

-- ——— 6) compte supprimé : le dossier ouvert est retiré, le badge disparaît (profil_public et identite_verifiee) ———
create or replace function public.identite_compte_supprime() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.supprime_le is not null and old.supprime_le is null then
    update public.verifications set statut = 'retire' where user_id = new.user_id and statut in ('brouillon', 'en_attente', 'verification_manuelle');
  end if;
  return new;
end $$;
drop trigger if exists identite_compte_supprime on public.profils;
create trigger identite_compte_supprime after update of supprime_le on public.profils for each row execute function public.identite_compte_supprime();

-- ——— 7) droits d'exécution ———
revoke execute on function public.identite_dossier(public.verifications), public.identite_statut(), public.identite_commencer(text),
  public.identite_soumettre(uuid, text, text, boolean), public.identite_retirer(), public.identite_verifiee(uuid[]),
  public.admin_identite_file(), public.admin_identite_decider(uuid, text, text, text), public.admin_identite_photos_effacees(uuid),
  public.identite_compte_supprime() from public, anon, authenticated;
grant execute on function public.identite_statut(), public.identite_commencer(text), public.identite_soumettre(uuid, text, text, boolean),
  public.identite_retirer(), public.admin_identite_file(), public.admin_identite_decider(uuid, text, text, text),
  public.admin_identite_photos_effacees(uuid) to authenticated;
grant execute on function public.identite_verifiee(uuid[]) to anon, authenticated;

-- contrôle : doit afficher « identite | false »
select id, public from storage.buckets where id = 'identite';
