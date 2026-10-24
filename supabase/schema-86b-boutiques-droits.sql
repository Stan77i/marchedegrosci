-- Schéma 86b : droits de colonnes pour la pause et le retrait (complément du schéma 86).
-- Les membres ne modifient leurs annonces que colonne par colonne (droits UPDATE par colonne) :
-- on ouvre seulement pause_le et retiree_le. quantite_depart reste réglée par le serveur.
grant update (pause_le, retiree_le) on public.offres to authenticated;
grant update (retiree_le) on public.demandes to authenticated;
