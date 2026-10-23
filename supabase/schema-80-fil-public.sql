-- ═════════ Marché de Gros CI — schéma 80 : le fil public du nouveau site (carte du réseau, « En ce moment ») ═════════
-- Décision du propriétaire (23/10/2026) : le site montre l'activité réelle de l'application, anonymisée.
-- Seulement : prénom + initiale, ville, produit, quantité, unité, prix demandé ou budget, date. Jamais de numéro,
-- de nom complet ni d'identifiant de compte (user_id). Annonces actives des 90 derniers jours.
-- Lecture seule. Appliqué par Claude avec l'outil Supabase. Aucune donnée modifiée.

create or replace function public.fil_public(p_limite int default 40)
returns table(cle text, sens text, product_slug text, produit text, quantite numeric, unite text,
              ville text, region_slug text, nom text, prix numeric, publie_le timestamptz)
language sql stable security definer set search_path = public as $$
  with a as (
    select 'offre'::text s, o.id, o.product_slug, nullif(o.product_label, '') lab, o.quantity, o.unit, o.city, o.region_slug,
           o.seller_name nm, o.price px, o.created_at, o.user_id
    from public.offres o where o.status = 'active' and o.created_at > now() - interval '90 days'
    union all
    select 'demande', d.id, d.product_slug, nullif(d.product_label, ''), d.quantity, d.unit, d.city, d.region_slug,
           d.buyer_name, d.budget, d.created_at, d.user_id
    from public.demandes d where d.status = 'active' and d.created_at > now() - interval '90 days'
  )
  select left(md5(a.id::text), 12), a.s, a.product_slug, coalesce(a.lab, a.product_slug), a.quantity, a.unit,
         nullif(a.city, ''), a.region_slug,
         -- prénom + initiale du deuxième mot (« Aya Kouassi » → « Aya K. ») ; rien si le nom est vide ou contient des chiffres
         -- le compte officiel (administrateur, reconnu par le serveur) s'affiche « Marché de Gros », comme dans l'application
         case when public.est_admin_id(a.user_id) then 'Marché de Gros'
              when coalesce(btrim(a.nm), '') = '' or a.nm ~ '[0-9]' then null
              else left(split_part(btrim(a.nm), ' ', 1), 24)
                   || case when split_part(regexp_replace(btrim(a.nm), '\s+', ' ', 'g'), ' ', 2) <> ''
                           then ' ' || upper(left(split_part(regexp_replace(btrim(a.nm), '\s+', ' ', 'g'), ' ', 2), 1)) || '.' else '' end
         end,
         a.px, a.created_at
  from a
  order by a.created_at desc
  limit least(greatest(coalesce(p_limite, 40), 1), 120)
$$;
revoke all on function public.fil_public(int) from public;
grant execute on function public.fil_public(int) to anon, authenticated;
