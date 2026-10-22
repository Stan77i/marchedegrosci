-- ═════════ Marché de Gros CI — schéma 44 : la fonction « pousser » peut LIRE ce qu'elle annonce ═════════
-- Trouvé le 22/10/2026 en cherchant pourquoi une demande (gombo, 20 tonnes) n'avait prévenu personne :
-- le rôle service (utilisé seulement par la fonction Edge « pousser », jamais dans l'application) n'avait pas le droit
-- de lire ces tables. Ces notifications ne partaient donc jamais : nouvelles annonces, achats groupés, rappels d'achat,
-- alertes aux administrateurs, dossiers d'identité, besoins pro.
-- Lecture seulement. Appliqué par Claude avec l'outil Supabase. Vérifié : la demande de gombo envoie maintenant
-- « Nouvelle demande : Gombo » (1 compte, 2 téléphones).
grant select on public.admins, public.alertes, public.alertes_produits, public.besoins, public.demandes, public.groupe_participants,
  public.groupes_achat, public.offres, public.rappels_achat, public.verifications to service_role;
