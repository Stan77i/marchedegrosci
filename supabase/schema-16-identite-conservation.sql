-- ═════════ Marché de Gros CI — schéma 16 : pièces expirées refusées ; dossiers d'identité conservés 5 ans (18 octobre 2026) ═════════
-- À lancer APRÈS les schémas 13, 14 et 15. Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 18 octobre 2026.)
-- Aucun « drop » : les anciennes fonctions restent et renvoient un message demandant la mise à jour.
--
-- Pourquoi : en cas de fraude ou de plainte, le Marché de Gros doit pouvoir remettre l'identité d'un membre aux autorités
-- (sur réquisition). Avant ce schéma, les photos étaient effacées juste après la décision et aucun numéro n'était gardé.
--
-- Ce qui change :
--   • PIÈCE EXPIRÉE : la date d'expiration est obligatoire à l'envoi (pré-remplie depuis la bande MRZ quand elle est lue).
--     Une pièce expirée est refusée à l'envoi, et l'administrateur ne peut pas la déclarer vérifiée.
--     Le badge « Identité vérifiée » disparaît le jour où la pièce expire ; la personne peut refaire la vérification.
--   • CONSERVATION : tout dossier ENVOYÉ (vérifié, refusé, remplacé, retiré après envoi) est gardé : photos, nom, numéro,
--     date d'expiration, téléphone du compte. Il est gardé tant que le compte existe, puis 5 ans après la suppression
--     du compte ; un dossier refusé, remplacé ou retiré est gardé 5 ans après cette date. Ensuite, les photos et les
--     données personnelles sont effacées (le tableau de bord le fait tout seul à chaque ouverture).
--     Un brouillon jamais envoyé n'est pas gardé (effacé au bout de 30 jours, ou dès que la personne le retire).
--   • Supprimer le compte ne supprime plus le dossier (sinon un fraudeur effacerait sa pièce en supprimant son compte).
--   • Le stockage n'autorise plus l'administrateur à effacer un dossier encore sous conservation : c'est le serveur qui décide.
--   • REGISTRE : l'administrateur peut retrouver un dossier (téléphone, nom, numéro de pièce). Chaque ouverture des photos
--     est notée (qui, quand, pourquoi) dans public.identite_acces.

-- ——— 1) nouvelles colonnes ———
alter table public.verifications add column if not exists expire_le date;        -- date d'expiration retenue (saisie, puis confirmée par l'admin)
alter table public.verifications add column if not exists expire_lu date;        -- lue sur la bande MRZ (indication)
alter table public.verifications add column if not exists numero_lu text check (numero_lu is null or char_length(numero_lu) <= 40);
alter table public.verifications add column if not exists numero text check (numero is null or char_length(numero) <= 40);  -- confirmé par l'admin
alter table public.verifications add column if not exists tel text check (tel is null or char_length(tel) <= 30);              -- téléphone du compte à l'envoi
alter table public.verifications add column if not exists garder_jusquau timestamptz;   -- null = tant que le compte existe
alter table public.verifications add column if not exists donnees_effacees_le timestamptz;

-- le dossier survit à la suppression du compte (user_id devient vide, le téléphone gardé suffit)
alter table public.verifications alter column user_id drop not null;
alter table public.verifications drop constraint if exists verifications_user_id_fkey;
alter table public.verifications add constraint verifications_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- dossier de stockage : inchangé (« uid/id »), mais il faut le garder même si user_id devient vide → on le fige
alter table public.verifications add column if not exists dossier text;
update public.verifications set dossier = user_id::text || '/' || id::text where dossier is null and user_id is not null;
create or replace function public.identite_dossier(v public.verifications) returns text
language sql immutable as $f$ select coalesce(v.dossier, v.user_id::text || '/' || v.id::text) $f$;
create or replace function public.identite_fige_dossier() returns trigger language plpgsql as $f$
begin if new.dossier is null and new.user_id is not null then new.dossier := new.user_id::text || '/' || new.id::text; end if; return new; end $f$;
create or replace trigger identite_fige_dossier before insert on public.verifications for each row execute function public.identite_fige_dossier();

create index if not exists verifications_registre_tel on public.verifications (tel);
create index if not exists verifications_garder on public.verifications (garder_jusquau) where garder_jusquau is not null and photos_effacees_le is null;

-- ——— 2) journal des accès (qui a ouvert quel dossier, quand, pourquoi) ———
create table if not exists public.identite_acces (
  id              bigint generated always as identity primary key,
  verification_id uuid not null references public.verifications(id) on delete cascade,
  admin_id        uuid references auth.users(id) on delete set null,
  motif           text not null check (char_length(motif) between 3 and 300),
  created_at      timestamptz not null default now()
);
alter table public.identite_acces enable row level security;   -- aucune politique : lisible seulement par les fonctions
revoke all on public.identite_acces from anon, authenticated;

-- ——— 3) qui peut effacer des photos ? ———
-- la personne : seulement son brouillon (une fois envoyé, le dossier est conservé)
create or replace function public.identite_dossier_effacable(p_name text) returns boolean
language sql stable security definer set search_path = public as $f$
  select exists (
    select 1 from public.verifications v
    where v.user_id = auth.uid() and v.statut = 'brouillon'
      and split_part(p_name, '/', 1) = v.user_id::text
      and split_part(p_name, '/', 2) = v.id::text);
$f$;
-- un dossier dont la conservation est finie (ou jamais envoyé et abandonné)
create or replace function public.identite_purgeable(v public.verifications) returns boolean
language sql stable as $f$
  select v.photos_effacees_le is null and (
       (v.soumis_le is null and (v.statut in ('retire', 'remplace') or (v.statut = 'brouillon' and v.created_at < now() - interval '30 days')))
    or (v.soumis_le is not null and v.garder_jusquau is not null and v.garder_jusquau < now()));
$f$;
create or replace function public.identite_photo_purgeable(p_name text) returns boolean
language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.verifications v
                 where public.identite_dossier(v) = split_part(p_name, '/', 1) || '/' || split_part(p_name, '/', 2)
                   and public.identite_purgeable(v));
$f$;
revoke execute on function public.identite_dossier_effacable(text), public.identite_photo_purgeable(text), public.identite_purgeable(public.verifications) from public, anon;
grant execute on function public.identite_dossier_effacable(text), public.identite_photo_purgeable(text) to authenticated;

alter policy "identite : effacer" on storage.objects
  using (bucket_id = 'identite' and ((select public.identite_dossier_effacable(name))
                                     or ((select public.est_admin()) and (select public.identite_photo_purgeable(name)))));

-- ——— 4) côté membre ———
-- statut : « expire » quand la pièce vérifiée a dépassé sa date
create or replace function public.identite_statut() returns json
language sql stable security definer set search_path = public as $f$
  select coalesce((
    select json_build_object('id', v.id,
             'statut', case when v.statut = 'verifie' and (v.expire_le is null or v.expire_le < current_date) then 'expire' else v.statut end,
             'piece', v.piece, 'motif', v.motif, 'soumis_le', v.soumis_le, 'decide_le', v.decide_le, 'expire_le', v.expire_le,
             'nouvel_essai_le', case when v.statut = 'refuse' then v.decide_le + interval '7 days' end,
             'defi', case when v.statut = 'brouillon' then v.defi end,
             'dossier', case when v.statut = 'brouillon' then public.identite_dossier(v) end)
    from public.verifications v
    where v.user_id = auth.uid() and v.statut not in ('remplace', 'retire')
    order by v.created_at desc limit 1),
    json_build_object('statut', 'non_verifie'));
$f$;

create or replace function public.identite_commencer(p_piece text) returns json
language plpgsql volatile security definer set search_path = public as $f$
declare me uuid := auth.uid(); v public.verifications; dernier public.verifications;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_piece not in ('cni', 'passeport', 'carte_consulaire', 'permis') then raise exception 'Type de pièce inconnu.'; end if;
  if exists (select 1 from public.profils p where p.user_id = me and p.supprime_le is not null) then raise exception 'Compte supprimé.'; end if;
  if exists (select 1 from public.bannis b where b.user_id = me) then raise exception 'Ce compte ne peut pas faire vérifier son identité.'; end if;
  select * into dernier from public.verifications where user_id = me and statut not in ('remplace', 'retire', 'brouillon') order by created_at desc limit 1;
  if dernier.statut = 'en_attente' then raise exception 'Votre dossier est déjà en cours d''examen.'; end if;
  if dernier.statut = 'verifie' and dernier.expire_le >= current_date then raise exception 'Votre identité est déjà vérifiée.'; end if;
  if dernier.statut = 'refuse' and dernier.decide_le > now() - interval '7 days' then
    raise exception 'Nouvel essai possible à partir du %.', to_char(dernier.decide_le + interval '7 days', 'DD/MM/YYYY');
  end if;
  -- « à revoir » : l'ancien dossier est remplacé par le nouveau (et conservé 5 ans)
  update public.verifications set statut = 'remplace', garder_jusquau = now() + interval '5 years'
   where user_id = me and statut = 'verification_manuelle';
  select * into v from public.verifications where user_id = me and statut = 'brouillon';
  if found then
    update public.verifications set piece = p_piece where id = v.id returning * into v;
  else
    insert into public.verifications (user_id, piece, defi)
    values (me, p_piece, lpad((floor(random() * 10000))::int::text, 4, '0')) returning * into v;
  end if;
  return json_build_object('id', v.id, 'defi', v.defi, 'dossier', public.identite_dossier(v), 'piece', v.piece);
end $f$;

-- envoyer : la date d'expiration est obligatoire et doit être dans le futur
-- (l'ancienne version à 4 paramètres reste, mais demande de mettre l'application à jour : aucun « drop » nécessaire)
create or replace function public.identite_soumettre(p_id uuid, p_nom text, p_nom_lu text default null, p_mrz_ok boolean default null) returns void
language plpgsql volatile security definer set search_path = public as $f$
begin raise exception 'Mettez l''application à jour : la date d''expiration de la pièce est maintenant demandée.'; end $f$;
create or replace function public.identite_soumettre(p_id uuid, p_nom text, p_nom_lu text, p_mrz_ok boolean,
    p_expire date, p_expire_lu date, p_numero_lu text) returns void
language plpgsql volatile security definer set search_path = public, storage as $f$
declare me uuid := auth.uid(); v public.verifications; d text; n text := nullif(btrim(p_nom), '');
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into v from public.verifications where id = p_id and user_id = me and statut = 'brouillon' for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if n is null or char_length(n) < 3 or char_length(n) > 120 then raise exception 'Écrivez votre nom comme sur la pièce.'; end if;
  if p_expire is null then raise exception 'Indiquez la date d''expiration écrite sur votre pièce. (Mettez l''application à jour si ce champ n''apparaît pas.)'; end if;
  if p_expire < current_date then raise exception 'Cette pièce a expiré le %. Utilisez une pièce encore valide.', to_char(p_expire, 'DD/MM/YYYY'); end if;
  if p_expire_lu is not null and p_expire_lu < current_date then
    raise exception 'La bande de votre pièce indique qu''elle a expiré le %. Utilisez une pièce encore valide.', to_char(p_expire_lu, 'DD/MM/YYYY');
  end if;
  if p_expire > current_date + interval '20 years' then raise exception 'Date d''expiration impossible. Vérifiez-la.'; end if;
  d := public.identite_dossier(v);
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/recto.jpg') then raise exception 'Photo du recto manquante.'; end if;
  if v.piece <> 'passeport' and not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/verso.jpg') then raise exception 'Photo du verso manquante.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/selfie.jpg') then raise exception 'Selfie manquant.'; end if;
  update public.verifications set statut = 'en_attente', soumis_le = now(), nom_saisi = n,
    nom_lu = left(nullif(btrim(p_nom_lu), ''), 120), mrz_ok = p_mrz_ok,
    expire_le = p_expire, expire_lu = p_expire_lu, numero_lu = left(nullif(upper(btrim(p_numero_lu)), ''), 40),
    tel = (select split_part(u.email, '@', 1) from auth.users u where u.id = me)
  where id = v.id;
end $f$;

-- retirer : un brouillon disparaît ; un dossier déjà envoyé est fermé mais conservé 5 ans
create or replace function public.identite_retirer() returns void
language sql volatile security definer set search_path = public as $f$
  update public.verifications
     set statut = 'retire', garder_jusquau = case when soumis_le is not null then now() + interval '5 years' end
   where user_id = auth.uid() and statut in ('brouillon', 'en_attente', 'verification_manuelle');
$f$;

-- ——— 5) le badge : seulement si la pièce n'est pas expirée ———
create or replace function public.identite_verifiee(ids uuid[]) returns setof uuid
language sql stable security definer set search_path = public as $f$
  select x.user_id from (
    select distinct on (v.user_id) v.user_id, v.statut, v.expire_le
    from public.verifications v
    where v.user_id = any (ids[1:200]) and v.statut in ('verifie', 'refuse') and v.decide_le is not null
    order by v.user_id, v.decide_le desc) x
  where x.statut = 'verifie' and x.expire_le >= current_date
    and not exists (select 1 from public.profils p where p.user_id = x.user_id and p.supprime_le is not null)
    and not exists (select 1 from public.bannis b where b.user_id = x.user_id);
$f$;
create or replace function public.identite_ok(uid uuid) returns boolean
language sql stable security definer set search_path = public as $f$
  select coalesce((select v.statut = 'verifie' and v.expire_le >= current_date from public.verifications v
                   where v.user_id = uid and v.statut in ('verifie', 'refuse') and v.decide_le is not null
                   order by v.decide_le desc limit 1), false);
$f$;

-- ——— 6) côté administrateur ———
-- nouvelle liste (avec dates et numéro) ; l'ancienne admin_identite_file() reste pour les pages pas encore rechargées
create or replace function public.admin_identite_dossiers()
returns table (id uuid, user_id uuid, statut text, piece text, defi text, nom_saisi text, nom_lu text, mrz_ok boolean,
               motif text, soumis_le timestamptz, dossier text, tel text, profil_nom text, profil_pseudo text, membre_depuis timestamptz,
               essais bigint, nom_banni boolean, expire_le date, expire_lu date, numero_lu text)
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query
  select v.id, v.user_id, v.statut, v.piece, v.defi, v.nom_saisi, v.nom_lu, v.mrz_ok, v.motif, v.soumis_le,
    public.identite_dossier(v), coalesce(split_part(u.email, '@', 1), v.tel)::text,
    nullif(btrim(coalesce(p.prenom, '') || ' ' || coalesce(p.nom, '')), ''), p.pseudo, u.created_at,
    (select count(*) from public.verifications w where w.user_id = v.user_id and w.soumis_le is not null),
    exists (select 1 from public.bannis b where b.nom_confirme is not null
            and (upper(btrim(b.nom_confirme)) = upper(btrim(v.nom_saisi)) or upper(btrim(b.nom_confirme)) = upper(btrim(coalesce(v.nom_lu, ''))))),
    v.expire_le, v.expire_lu, v.numero_lu
  from public.verifications v
  join auth.users u on u.id = v.user_id
  left join public.profils p on p.user_id = v.user_id
  where v.statut in ('en_attente', 'verification_manuelle')
  order by v.statut = 'verification_manuelle', v.soumis_le;
end $f$;

-- décider : « vérifiée » impossible si la pièce est expirée ; l'admin confirme la date et le numéro lus sur la photo
-- l'ancienne version (4 paramètres) ne contrôlait pas l'expiration : elle demande désormais de recharger la page
create or replace function public.admin_identite_decider(p_id uuid, p_statut text, p_motif text default null, p_nom text default null) returns void
language plpgsql volatile security definer set search_path = public as $f$
begin raise exception 'Rechargez le tableau de bord : une nouvelle version contrôle la date d''expiration.'; end $f$;
create or replace function public.admin_identite_decider(p_id uuid, p_statut text, p_motif text, p_nom text,
    p_expire date, p_numero text) returns void
language plpgsql volatile security definer set search_path = public as $f$
declare v public.verifications; m text := nullif(btrim(p_motif), ''); e date;
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if p_statut not in ('verifie', 'verification_manuelle', 'refuse') then raise exception 'Décision inconnue.'; end if;
  if p_statut <> 'verifie' and m is null then raise exception 'Indiquez le motif.'; end if;
  select * into v from public.verifications where id = p_id for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if v.statut not in ('en_attente', 'verification_manuelle') and not (v.statut = 'verifie' and p_statut = 'refuse') then
    raise exception 'Ce dossier n''est plus à examiner.';
  end if;
  e := coalesce(p_expire, v.expire_le);
  if p_statut = 'verifie' then
    if e is null then raise exception 'Indiquez la date d''expiration lue sur la photo de la pièce.'; end if;
    if e < current_date then raise exception 'Pièce expirée le % : elle ne peut pas être vérifiée. Refusez avec le motif « pièce expirée ».', to_char(e, 'DD/MM/YYYY'); end if;
  end if;
  update public.verifications set statut = p_statut, motif = case when p_statut = 'verifie' then null else left(m, 300) end,
    nom_confirme = case when p_statut = 'verifie' then left(coalesce(nullif(btrim(p_nom), ''), v.nom_saisi), 120) else nom_confirme end,
    expire_le = e, numero = left(coalesce(nullif(upper(btrim(p_numero)), ''), v.numero, v.numero_lu), 40),
    garder_jusquau = case when p_statut = 'refuse' then now() + interval '5 years' else null end,
    decide_le = now(), decide_par = auth.uid()
  where id = p_id;
end $f$;

-- l'ancienne page admin effaçait les photos après chaque décision : désormais seulement si la conservation est finie
create or replace function public.admin_identite_photos_effacees(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.verifications v set photos_effacees_le = now() where v.id = p_id and public.identite_purgeable(v);
end $f$;

-- à effacer : brouillons abandonnés ou jamais envoyés, et dossiers dont les 5 ans sont passés
create or replace function public.admin_identite_a_purger()
returns table (id uuid, dossier text, statut text)
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query select v.id, public.identite_dossier(v), v.statut from public.verifications v
   where public.identite_purgeable(v) order by v.created_at limit 50;
end $f$;
-- après l'effacement des photos : brouillon fermé ; dossier conservé → ses données personnelles sont effacées aussi
create or replace function public.admin_identite_purger(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  update public.verifications v
     set photos_effacees_le = now(),
         statut = case when v.statut = 'brouillon' then 'retire' else v.statut end,
         nom_saisi = null, nom_lu = null, nom_confirme = null, numero = null, numero_lu = null, tel = null,
         donnees_effacees_le = case when v.soumis_le is not null then now() end
   where v.id = p_id and public.identite_purgeable(v);
end $f$;

-- registre : retrouver un dossier conservé (téléphone, nom ou numéro de pièce), tous statuts sauf brouillon
create or replace function public.admin_identite_registre(p_q text)
returns table (id uuid, user_id uuid, statut text, piece text, nom text, numero text, expire_le date, tel text,
               soumis_le timestamptz, decide_le timestamptz, garder_jusquau timestamptz, photos boolean, compte_supprime boolean, acces bigint)
language plpgsql stable security definer set search_path = public as $f$
declare q text := upper(btrim(coalesce(p_q, ''))); chiffres text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if char_length(q) < 3 then raise exception 'Tapez au moins 3 caractères (téléphone, nom ou numéro de pièce).'; end if;
  return query
  select v.id, v.user_id, v.statut, v.piece, coalesce(v.nom_confirme, v.nom_saisi), coalesce(v.numero, v.numero_lu), v.expire_le,
    coalesce(v.tel, split_part(u.email, '@', 1))::text, v.soumis_le, v.decide_le, v.garder_jusquau, v.photos_effacees_le is null,
    v.user_id is null or exists (select 1 from public.profils p where p.user_id = v.user_id and p.supprime_le is not null),
    (select count(*) from public.identite_acces a where a.verification_id = v.id)
  from public.verifications v left join auth.users u on u.id = v.user_id
  where v.soumis_le is not null and v.donnees_effacees_le is null
    and (   (char_length(chiffres) >= 6 and coalesce(v.tel, split_part(u.email, '@', 1), '') like '%' || right(chiffres, 8) || '%')
         or upper(coalesce(v.nom_confirme, '')) like '%' || q || '%' or upper(coalesce(v.nom_saisi, '')) like '%' || q || '%'
         or upper(coalesce(v.nom_lu, '')) like '%' || q || '%'
         or replace(upper(coalesce(v.numero, v.numero_lu, '')), ' ', '') like '%' || replace(q, ' ', '') || '%')
  order by v.soumis_le desc limit 50;
end $f$;

-- ouvrir les photos d'un dossier : le motif est obligatoire et noté (examen, réquisition n°…, plainte…)
create or replace function public.admin_identite_ouvrir(p_id uuid, p_motif text) returns json
language plpgsql volatile security definer set search_path = public as $f$
declare v public.verifications; m text := nullif(btrim(p_motif), '');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if m is null or char_length(m) < 3 then raise exception 'Indiquez pourquoi vous ouvrez ce dossier.'; end if;
  select * into v from public.verifications where id = p_id;
  if not found then raise exception 'Dossier introuvable.'; end if;
  insert into public.identite_acces (verification_id, admin_id, motif) values (p_id, auth.uid(), left(m, 300));
  return json_build_object('dossier', public.identite_dossier(v), 'piece', v.piece, 'photos', v.photos_effacees_le is null);
end $f$;

-- historique des accès d'un dossier
create or replace function public.admin_identite_acces(p_id uuid)
returns table (quand timestamptz, admin_tel text, motif text)
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query select a.created_at, split_part(u.email, '@', 1)::text, a.motif
    from public.identite_acces a left join auth.users u on u.id = a.admin_id
   where a.verification_id = p_id order by a.created_at desc;
end $f$;

-- ——— 7) compte supprimé : le dossier ouvert est fermé ; tout dossier envoyé est gardé 5 ans à partir de maintenant ———
create or replace function public.identite_compte_supprime() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if new.supprime_le is not null and old.supprime_le is null then
    update public.verifications set statut = 'retire' where user_id = new.user_id and statut in ('brouillon', 'en_attente', 'verification_manuelle');
    update public.verifications set garder_jusquau = greatest(coalesce(garder_jusquau, now()), now() + interval '5 years')
     where user_id = new.user_id and soumis_le is not null;
  end if;
  return new;
end $f$;
-- compte réellement effacé (auth.users) : même règle, avant que user_id devienne vide
create or replace function public.identite_compte_efface() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  update public.verifications set garder_jusquau = greatest(coalesce(garder_jusquau, now()), now() + interval '5 years'),
         tel = coalesce(tel, split_part(old.email, '@', 1))
   where user_id = old.id and soumis_le is not null;
  return old;
end $f$;
create or replace trigger identite_compte_efface before delete on auth.users for each row execute function public.identite_compte_efface();

-- ——— 8) droits ———
revoke execute on function public.identite_soumettre(uuid, text, text, boolean, date, date, text), public.admin_identite_dossiers(),
  public.admin_identite_decider(uuid, text, text, text, date, text), public.admin_identite_a_purger(), public.admin_identite_purger(uuid),
  public.admin_identite_registre(text), public.admin_identite_ouvrir(uuid, text), public.admin_identite_acces(uuid),
  public.identite_compte_efface(), public.identite_fige_dossier() from public, anon;
grant execute on function public.identite_soumettre(uuid, text, text, boolean, date, date, text), public.admin_identite_dossiers(),
  public.admin_identite_decider(uuid, text, text, text, date, text), public.admin_identite_a_purger(), public.admin_identite_purger(uuid),
  public.admin_identite_registre(text), public.admin_identite_ouvrir(uuid, text), public.admin_identite_acces(uuid) to authenticated;
revoke execute on function public.identite_compte_efface(), public.identite_fige_dossier() from authenticated;

-- contrôle : « identite | false » puis le nombre de dossiers conservés
select id, public from storage.buckets where id = 'identite';
select count(*) filter (where soumis_le is not null and photos_effacees_le is null) as dossiers_conserves from public.verifications;
