-- ═════════ Marché de Gros CI — schéma 24 : relevés, bons de transaction et transparence publique (20 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 20 octobre 2026.)
--
-- Une transaction = une négociation « conclue » (prix_final, quantite_finale, unite). Sur une OFFRE, le propriétaire vend
-- et l'autre achète ; sur une DEMANDE, c'est l'inverse. Il n'y a pas encore de paiement dans l'application.
--
-- 1) mes_transactions(p_debut, p_fin) : l'historique complet de l'appelant SEUL (montants compris), pour Mon compte →
--    « Mes ventes et achats » (v3/releve.js) : relevés, bons de transaction imprimables, export.
-- 2) profil_public : l'historique public ne montre plus aucun prix ni montant ; il donne des VOLUMES (« 12 t vendues »)
--    et le nombre de transactions. Les montants ne sont visibles que par la personne elle-même.
--    (Seules les clés « historique », « volumes » et « transactions » changent ; le reste de la fonction est inchangé.)

-- ——— 1) ———
create or replace function public.mes_transactions(p_debut date default null, p_fin date default null)
returns table (id uuid, numero text, conclu_le timestamptz, sens text, produit text, quantite numeric, unite text,
               prix_unitaire numeric, total numeric, ville text, cible text, partenaire_id uuid, partenaire_nom text)
language sql stable security definer set search_path = public as $f$
  select g.id,
    'MDG-' || to_char(coalesce(g.conclu_le, g.updated_at), 'YYYYMMDD') || '-' || upper(left(replace(g.id::text, '-', ''), 6)),
    coalesce(g.conclu_le, g.updated_at),
    case when (g.cible like 'offre%' and g.proprio_id = auth.uid()) or (g.cible like 'demande%' and g.auteur_id = auth.uid()) then 'vente' else 'achat' end,
    g.produit, coalesce(g.quantite_finale, g.quantite), g.unite, g.prix_final,
    case when g.prix_final is not null and coalesce(g.quantite_finale, g.quantite) is not null then round(g.prix_final * coalesce(g.quantite_finale, g.quantite)) end,
    g.ville, g.cible,
    case when g.proprio_id = auth.uid() then g.auteur_id else g.proprio_id end,
    coalesce(public.nom_public(case when g.proprio_id = auth.uid() then g.auteur_id else g.proprio_id end), 'Membre')
  from public.negociations g
  where auth.uid() is not null and g.statut = 'conclue' and auth.uid() in (g.auteur_id, g.proprio_id)
    and (p_debut is null or coalesce(g.conclu_le, g.updated_at) >= p_debut)
    and (p_fin is null or coalesce(g.conclu_le, g.updated_at) < p_fin + 1)
  order by coalesce(g.conclu_le, g.updated_at) desc
  limit 2000;
$f$;
revoke execute on function public.mes_transactions(date, date) from public, anon;
grant execute on function public.mes_transactions(date, date) to authenticated;

-- ——— 2) profil_public : voir la fonction en base (appliquée le 20 octobre 2026). Changements par rapport au schéma 20 :
--   'historique' : produit, quantite, unite, ville, quand, sens — plus de « prix » ;
--   'volumes'    : [{ sens: 'vente'|'achat', unite, quantite }] cumulés sur toutes les transactions conclues ;
--   'transactions' : nombre total de transactions conclues (ventes + achats).
