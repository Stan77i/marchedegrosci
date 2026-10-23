-- ═════════ Schéma 66 (23/10/2026) — signalements d'annonces : l'auteur est toujours fixé par la base ═════════
-- Faille trouvée à l'audit : la table « signalements » acceptait un « user_id » choisi par le téléphone, même sans compte.
-- Trois signalements avec trois faux user_id masquaient n'importe quelle annonce (masquage automatique à 3 comptes différents).
-- Correction, sans rien casser pour les membres :
--   • le téléphone ne peut plus écrire que cible, cible_id et motif ; l'auteur prend la valeur par défaut auth.uid()
--     (le compte connecté, ou vide sans compte — un signalement sans compte ne compte pas pour le masquage, comme avant) ;
--   • la règle d'écriture refuse tout auteur différent du compte connecté (seconde protection).
-- Aucun « drop » : droits retirés puis redonnés colonne par colonne, règle modifiée par « alter policy ».

revoke insert on public.signalements from anon, authenticated;
grant insert (cible, cible_id, motif) on public.signalements to anon, authenticated;

alter policy "signaler une annonce" on public.signalements
  to anon, authenticated
  with check (user_id is not distinct from (select auth.uid()));
