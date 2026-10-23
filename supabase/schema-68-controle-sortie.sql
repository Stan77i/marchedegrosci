-- ═════════ Schéma 68 (23/10/2026) — messages avec un numéro ou un lien : le filtre ne plante plus ═════════
-- Bug trouvé par la simulation : le déclencheur controle_sortie() (avant chaque message privé « dm » et chaque message
-- de négociation « messages ») plantait avec « record "new" has no field "negociation_id" » (ou "discussion_id")
-- dès qu'un texte contenait un numéro ou un lien : l'expression lisait les deux colonnes alors que chaque table n'en a qu'une.
-- Conséquences : le message était refusé avec « problème technique », le masquage du numéro et l'alerte admin ne marchaient jamais.
-- Correction : la référence est lue selon la table (to_jsonb), le reste est inchangé. Aucun « drop » (create or replace).

create or replace function public.controle_sortie() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare m text; v_ref uuid;
begin
  if new.texte is null or public.est_admin_id(new.auteur_id) then return new; end if;
  m := public.sortie_motif(new.texte);
  if m is null then return new; end if;
  v_ref := (to_jsonb(new) ->> case when tg_table_name = 'dm' then 'discussion_id' else 'negociation_id' end)::uuid;
  insert into public.alertes (user_id, source, ref_id, motif, extrait)
  values (new.auteur_id, case when tg_table_name = 'dm' then 'dm' else 'negociation' end, v_ref, m, left(new.texte, 300));
  new.texte := public.sortie_masquer(new.texte);
  return new;
end $function$;
