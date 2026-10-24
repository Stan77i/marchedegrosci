-- Schéma 85d : la fonction « pousser » (notifications) lit les tables des chantiers fiabilité et badges.
-- En production, chaque table doit donner ce droit à part (comme le schéma 44). Les schémas 84 et 85 l'avaient oublié,
-- ainsi que code_demandes et litige_messages : sans lui, les notifications de ces cas ne partaient pas.
-- Lecture seule, réservée au serveur. Appliqué sur le test puis en production le 24/10/2026.
grant select on public.sanctions, public.contestations, public.niveaux_journal, public.niveaux_regles,
  public.niveaux_contestations, public.code_demandes, public.litige_messages to service_role;
