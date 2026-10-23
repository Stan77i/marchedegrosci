-- ═════════ Schéma 73 (23/10/2026) — annonces : la date de publication et l'auteur ne se modifient plus ═════════
-- Faille trouvée à l'audit : un membre pouvait modifier « created_at » de ses offres et demandes (droit de colonne),
-- donc remonter artificiellement son annonce en tête des listes, ou lui donner une date dans le futur.
-- Correction : le droit de modification est redonné colonne par colonne, SANS created_at, id et user_id
-- (l'application ne les envoie jamais : elle les laisse à la base). Toutes les autres colonnes restent modifiables comme avant.
-- Les fonctions du serveur (security definer) ne sont pas concernées. Aucun « drop ».

revoke update on public.offres from anon, authenticated;
grant update (agent, available_from, city, client_id, lieu, negociable, phone, price, product_label, product_slug, qte_min, quantity,
              region_slug, seller_name, status, transport, unit) on public.offres to authenticated;

revoke update on public.demandes from anon, authenticated;
grant update (besoin_id, budget, buyer_name, buyer_type, city, client_id, criteres, deadline, detail, exigences, lieu, negociable, phone,
              product_label, product_slug, quantity, region_slug, status, transport, unit) on public.demandes to authenticated;
