-- ═════════ Schéma 96e (24/10/2026) — suivi du volume des photos (lecture seule, rien n'est effacé) ═════════
-- Audit P2 n° 24 : personne ne voyait combien de place prennent les photos (pièces d'identité, preuves, photos de profil,
-- avatars). stockage_volume() rend, pour chaque espace de stockage : nombre de fichiers, poids total, poids ajouté sur 30 jours
-- et le plus ancien fichier. Réservé à l'administrateur (est_admin). Aucune suppression : la durée de conservation après
-- clôture reste à décider par le propriétaire.

create or replace function public.stockage_volume()
returns json language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.est_admin(), false) then raise exception 'Réservé à l''équipe.'; end if;
  return (select json_build_object(
    'mesure_le', now(),
    'total_octets', coalesce(sum(x.octets), 0),
    'espaces', coalesce(json_agg(json_build_object('espace', x.bucket_id, 'fichiers', x.n, 'octets', x.octets,
                 'octets_30_jours', x.recents, 'plus_ancien', x.ancien) order by x.octets desc), '[]'::json))
    from (select b.id bucket_id, count(o.id) n, coalesce(sum((o.metadata ->> 'size')::bigint), 0) octets,
                 coalesce(sum((o.metadata ->> 'size')::bigint) filter (where o.created_at > now() - interval '30 days'), 0) recents,
                 min(o.created_at) ancien
          from storage.buckets b left join storage.objects o on o.bucket_id = b.id
          group by b.id) x);
end $$;
revoke execute on function public.stockage_volume() from public, anon;
grant execute on function public.stockage_volume() to authenticated;
