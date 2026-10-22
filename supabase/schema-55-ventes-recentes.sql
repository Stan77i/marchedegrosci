-- ═════════ Marché de Gros CI — schéma 55 : les ventes conclues, dans le fil public « Dernières annonces » ═════════
-- Demandé par le propriétaire le 22/10/2026 : n'importe qui, n'importe où (même sans compte), voit l'activité du marché :
-- les offres, les demandes, et maintenant les ventes conclues. Anonymes : produit, quantité, ville, date — jamais de nom, de prix ni de numéro.
-- Lecture seule. Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée modifiée.

create or replace function public.ventes_recentes(p_limite int default 12)
returns table(cle text, product_slug text, produit text, quantite numeric, unite text, ville text, conclu_le timestamptz)
language sql stable security definer set search_path = public as $$
  select left(md5(n.id::text), 12), coalesce(o.product_slug, d.product_slug), n.produit, n.quantite_finale, n.unite,
         nullif(coalesce(nullif(n.ville, ''), o.city, d.city), ''), n.conclu_le
  from public.negociations n
  left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
  left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
  where n.statut = 'conclue' and n.conclu_le > now() - interval '30 days'
  order by n.conclu_le desc
  limit least(greatest(coalesce(p_limite, 12), 1), 30)
$$;
revoke all on function public.ventes_recentes(int) from public;
grant execute on function public.ventes_recentes(int) to anon, authenticated;
