-- ═════════ Schéma 67 (23/10/2026) — zones de forte demande : de nouveau visibles sans compte ═════════
-- Bug trouvé par la simulation : « GET /rest/v1/zones » sans compte renvoyait 401
-- (« permission denied for function est_admin ») : la règle de lecture appelait est_admin(), que le rôle anon ne peut pas exécuter.
-- Résultat : les zones de forte demande ne s'affichaient chez aucun visiteur sans compte.
-- Correction : deux règles de lecture au lieu d'une.
--   • « zones visibles par tous » : seulement les zones encore valables (sans appel à est_admin) ;
--   • « admin voit toutes les zones » : l'admin connecté voit aussi les zones expirées (comme avant).
-- Aucun « drop » : la règle existante est modifiée (alter policy), une règle est ajoutée.

alter policy "zones visibles par tous" on public.zones
  to anon, authenticated
  using (expire_le > now());

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'zones' and policyname = 'admin voit toutes les zones') then
    create policy "admin voit toutes les zones" on public.zones for select to authenticated using ((select public.est_admin()));
  end if;
end $$;
