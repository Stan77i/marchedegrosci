-- Schéma 88c : retirer un droit inutile (audit des notifications du 24/10/2026, défaut 13).
-- En production, le rôle « authenticated » (membres connectés) a le droit TRUNCATE sur alertes, alertes_produits et zones.
-- L'API ne permet pas de s'en servir, le risque est faible, mais ce droit ne sert à rien.
-- Ce fichier contient un mot que l'outil MCP refuse : il n'a PAS été appliqué par Claude.
-- À coller par le propriétaire dans l'éditeur SQL de Supabase (projet de test, puis production). Rien n'est effacé :
-- « revoke » retire seulement le droit.
revoke truncate on public.alertes, public.alertes_produits, public.zones from authenticated;
