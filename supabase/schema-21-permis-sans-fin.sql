-- ═════════ Marché de Gros CI — schéma 21 : permis de conduire sans date de fin (19 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 19 octobre 2026.)
--
-- En Côte d'Ivoire, les permis A et B sont aujourd'hui à validité permanente : la durée de 10 ans prévue par les textes
-- n'est pas encore appliquée (Fratmat, « durées de validité des différentes catégories de permis »). Un tel permis n'a donc
-- pas de date d'expiration. Le membre coche « Mon permis n'a pas de date de fin » : le badge est alors valable 5 ans,
-- puis une nouvelle vérification est demandée (même règle que pour une pièce qui expire). L'administrateur voit la mention
-- et vérifie sur la photo qu'aucune date de fin n'est écrite.

alter table public.verifications add column if not exists sans_fin boolean not null default false;

-- nouvelle version de l'envoi du dossier : p_sans_fin (l'ancienne reste pour les téléphones pas encore à jour)
create or replace function public.identite_soumettre(p_id uuid, p_nom text, p_nom_lu text, p_mrz_ok boolean, p_expire date, p_expire_lu date, p_numero_lu text, p_sans_fin boolean)
returns void language plpgsql security definer set search_path = public, storage as $f$
declare me uuid := auth.uid(); v public.verifications; d text; n text := nullif(btrim(p_nom), ''); e date := p_expire; sf boolean := false;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into v from public.verifications where id = p_id and user_id = me and statut = 'brouillon' for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if n is null or char_length(n) < 3 or char_length(n) > 120 then raise exception 'Écrivez votre nom comme sur la pièce.'; end if;
  if coalesce(p_sans_fin, false) then
    if v.piece <> 'permis' then raise exception 'Seul un permis de conduire peut n''avoir aucune date de fin. Indiquez la date d''expiration de votre pièce.'; end if;
    sf := true; e := (current_date + interval '5 years')::date;
  end if;
  if e is null then raise exception 'Indiquez la date d''expiration écrite sur votre pièce.'; end if;
  if e < current_date then raise exception 'Cette pièce a expiré le %. Utilisez une pièce encore valide.', to_char(e, 'DD/MM/YYYY'); end if;
  if p_expire_lu is not null and p_expire_lu < current_date then
    raise exception 'La bande de votre pièce indique qu''elle a expiré le %. Utilisez une pièce encore valide.', to_char(p_expire_lu, 'DD/MM/YYYY');
  end if;
  if e > current_date + interval '20 years' then raise exception 'Date d''expiration impossible. Vérifiez-la.'; end if;
  d := public.identite_dossier(v);
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/recto.jpg') then raise exception 'Photo du recto manquante.'; end if;
  if v.piece <> 'passeport' and not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/verso.jpg') then raise exception 'Photo du verso manquante.'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'identite' and name = d || '/selfie.jpg') then raise exception 'Selfie manquant.'; end if;
  update public.verifications set statut = 'en_attente', soumis_le = now(), nom_saisi = n,
    nom_lu = left(nullif(btrim(p_nom_lu), ''), 120), mrz_ok = p_mrz_ok, sans_fin = sf,
    expire_le = e, expire_lu = p_expire_lu, numero_lu = left(nullif(upper(btrim(p_numero_lu)), ''), 40),
    tel = (select split_part(u.email, '@', 1) from auth.users u where u.id = me)
  where id = v.id;
end $f$;
revoke execute on function public.identite_soumettre(uuid, text, text, boolean, date, date, text, boolean) from public, anon;
grant execute on function public.identite_soumettre(uuid, text, text, boolean, date, date, text, boolean) to authenticated;

-- l'administrateur : quels dossiers à examiner sont des permis « sans date de fin »
create or replace function public.admin_identite_sans_fin() returns setof uuid
language plpgsql stable security definer set search_path = public as $f$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return query select v.id from public.verifications v where v.sans_fin and v.statut in ('en_attente', 'verification_manuelle', 'verifie');
end $f$;
revoke execute on function public.admin_identite_sans_fin() from public, anon;
grant execute on function public.admin_identite_sans_fin() to authenticated;

-- le membre : son statut dit aussi « sans date de fin » (le badge est alors à refaire dans 5 ans)
create or replace function public.identite_statut() returns json
language sql stable security definer set search_path = public as $f$
  select (coalesce((
    select jsonb_build_object('id', v.id,
             'statut', case when v.statut = 'verifie' and (v.expire_le is null or v.expire_le < current_date) then 'expire' else v.statut end,
             'piece', v.piece, 'motif', v.motif, 'soumis_le', v.soumis_le, 'decide_le', v.decide_le, 'expire_le', v.expire_le, 'sans_fin', v.sans_fin,
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
