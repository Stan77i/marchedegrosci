-- ═════════ Marché de Gros CI — schéma 54 : le relevé et le bon disent d'où part la marchandise, où elle va, et où en est la livraison ═════════
-- Demandé par le propriétaire le 22/10/2026 : un tampon rouge en bas du relevé PDF (Marché de Gros, vendu / acheté, la date,
-- le départ, la destination, l'acheteur…). Le tampon ne dit JAMAIS « payé » : l'application ne voit pas l'argent
-- (paiement à la livraison, hors application). Il dit ce que le serveur sait : accord conclu, livraison confirmée, ou commande annulée.
-- mes_transactions (schéma 24) reste telle quelle (changer ses colonnes demanderait de la supprimer) : mes_transactions2 y ajoute la commande.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée modifiée.

create or replace function public.mes_transactions2(p_debut date default null, p_fin date default null)
returns table(id uuid, numero text, conclu_le timestamptz, sens text, produit text, quantite numeric, unite text, prix_unitaire numeric,
              total numeric, ville text, cible text, partenaire_id uuid, partenaire_nom text,
              depart text, destination text, commande_numero text, commande_etat text, commande_etape text, livre_le timestamptz, mode_transport text)
language sql stable security definer set search_path = public as $$
  select t.id, t.numero, t.conclu_le, t.sens, t.produit, t.quantite, t.unite, t.prix_unitaire, t.total, t.ville, t.cible, t.partenaire_id, t.partenaire_nom,
    coalesce(nullif(c.ville_depart, ''), nullif(t.ville, '')), nullif(c.lieu_livraison, ''), c.numero, c.etat, c.etape, c.termine_le, c.mode_transport
  from public.mes_transactions(p_debut, p_fin) t
  left join lateral (select * from public.commandes c where c.negociation_id = t.id order by c.created_at desc limit 1) c on true
  order by t.conclu_le desc
$$;
revoke all on function public.mes_transactions2(date, date) from public, anon;
grant execute on function public.mes_transactions2(date, date) to authenticated;
