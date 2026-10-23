-- ═════════ Schéma 79 (23/10/2026) — chiffres publics pour les PDF de stratégie ═════════
-- Les PDF de strategie/ se mettent à jour seuls (GitHub Actions) avec la clé publique de l'application.
-- Cette fonction ne renvoie que des totaux : aucun nom, aucun montant, aucune donnée personnelle.
-- Aucun « drop » : create or replace.

create or replace function public.stats_publiques()
returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'membres', (select count(*) from public.profils p where p.supprime_le is null and not exists (select 1 from public.bannis b where b.user_id = p.user_id)),
    'offres_actives', (select count(*) from public.offres where status = 'active'),
    'demandes_actives', (select count(*) from public.demandes where status = 'active'),
    'produits_actifs', (select count(distinct s) from (select product_slug s from public.offres where status = 'active' union all select product_slug from public.demandes where status = 'active') x),
    'regions_actives', (select count(distinct r) from (select region_slug r from public.offres where status = 'active' union all select region_slug from public.demandes where status = 'active') x where r is not null),
    'commandes_terminees', (select count(*) from public.commandes where etat = 'terminee'),
    'mesure_le', now()
  );
$$;
revoke execute on function public.stats_publiques() from public;
grant execute on function public.stats_publiques() to anon, authenticated;
