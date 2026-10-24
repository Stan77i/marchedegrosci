-- Schéma 94c (équipe Confiance, audit du 24/10/2026, P2 n° 27) : une pièce d'identité ne vérifie qu'un seul compte.
-- À appliquer sur le projet de TEST d'abord (yowdymdnoiubatxlwhfv), puis en production avec l'accord du propriétaire.
-- Pour vérifier un dossier, l'équipe doit recopier le numéro de la pièce (lu sur la photo, pas celui envoyé par le téléphone seul).
-- Si ce numéro est déjà vérifié sur un autre compte encore ouvert, la vérification est refusée.
-- Comparaison sans espaces, tirets ni points, en majuscules. Le reste de la fonction est identique au schéma précédent.

create or replace function public._piece_norm(t text)
returns text language sql immutable set search_path = public as $$
  select nullif(upper(regexp_replace(coalesce(t, ''), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function public.admin_identite_decider(p_id uuid, p_statut text, p_motif text, p_nom text, p_expire date, p_numero text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.verifications; m text := nullif(btrim(p_motif), ''); e date; num text; autre uuid;
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
    num := public._piece_norm(coalesce(nullif(btrim(p_numero), ''), v.numero));
    if num is null or char_length(num) < 5 then raise exception 'Recopiez le numéro de la pièce, lu sur la photo.'; end if;
    select x.user_id into autre from public.verifications x
     where x.statut = 'verifie' and x.user_id is distinct from v.user_id and x.user_id is not null
       and public._piece_norm(x.numero) = num
       and not exists (select 1 from public.profils p where p.user_id = x.user_id and p.supprime_le is not null)
     limit 1;
    if autre is not null then
      raise exception 'Cette pièce est déjà vérifiée sur un autre compte. Refusez avec le motif « pièce déjà utilisée sur un autre compte ».';
    end if;
  end if;
  update public.verifications set statut = p_statut, motif = case when p_statut = 'verifie' then null else left(m, 300) end,
    nom_confirme = case when p_statut = 'verifie' then left(coalesce(nullif(btrim(p_nom), ''), v.nom_saisi), 120) else nom_confirme end,
    expire_le = e, numero = left(coalesce(nullif(upper(btrim(p_numero)), ''), v.numero, v.numero_lu), 40),
    garder_jusquau = case when p_statut = 'refuse' then now() + interval '5 years' else null end,
    decide_le = now(), decide_par = auth.uid()
  where id = p_id;
end $$;

revoke execute on function public._piece_norm(text) from public, anon;
