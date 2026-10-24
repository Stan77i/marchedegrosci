-- ═════════ Schéma 96d (24/10/2026) — politiques d'accès : auth.uid() lu une fois par requête, pas une fois par ligne ═════════
-- Audit P3 n° 39 (conseiller de performance Supabase, « auth_rls_initplan ») : écrire (select auth.uid()) au lieu de auth.uid()
-- dans une politique fait calculer l'identifiant une seule fois. Même règle d'accès qu'avant, mot pour mot.
-- Tables de l'équipe messages / notifications : messages (négociation), notif_journal, push_abonnements.
-- « alter policy » change la condition sans retirer la politique.
-- Restent à faire par leurs équipes (même changement) : offres (3 politiques), demandes (3), negociations (1), profils (3).
-- Index en double (sim_tmp_offres_produit, sim_tmp_demandes_produit) : restes de la simulation, sur le projet de test seulement ;
-- les retirer demande un « drop index », refusé par l'outil : à faire par le propriétaire s'il le souhaite.

alter policy "voir mes messages" on public.messages
  using ((exists (select 1 from public.negociations n
                  where n.id = messages.negociation_id and (n.auteur_id = (select auth.uid()) or n.proprio_id = (select auth.uid()))))
         or (select public.est_admin() as est_admin));

alter policy "notif_journal_moi" on public.notif_journal using (user_id = (select auth.uid()));

alter policy "voir mes téléphones" on public.push_abonnements using (user_id = (select auth.uid()));
