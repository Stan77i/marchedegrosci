-- ═════════ Marché de Gros CI — schéma 41 : notifications des achats groupés, complétées ═════════
-- Demandé le 21/10/2026 (« si ça doit alerter d'autres personnes, que tout passe proprement »). Appliqué par Claude.
-- Aucun drop, aucune donnée touchée : la fonction de déclenchement est réécrite, un déclencheur est élargi à l'insertion.
--
-- Avant : seuls « proposé », « seuil atteint », « à confirmer », « confirmé », « expiré », « annulé » prévenaient.
-- Ajouté :
--   • « ouvert » (le vendeur a fixé ses conditions) → le créateur du groupe, et ceux qui suivent ce produit (alertes produit,
--     nouvelles offres) : ils peuvent rejoindre ;
--   • un acheteur REJOINT le groupe → le créateur et le vendeur (une seule notification qui se remplace : étiquette du groupe).
-- Le texte des notifications est dans la fonction Edge « pousser » (cas 11).

create or replace function public.push_groupe() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; corps jsonb;
begin
  if tg_table_name = 'groupes_achat' then
    if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then return new; end if;
    if new.statut not in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation', 'confirme', 'expire', 'annule') then return new; end if;
    -- « ouvert » seulement à l'ouverture (pas quand un départ fait redescendre sous le seuil : ce serait une fausse annonce)
    if new.statut = 'ouvert' and tg_op = 'UPDATE' and old.statut <> 'propose' then return new; end if;
    corps := jsonb_build_object('groupe_id', new.id, 'statut', new.statut);
  elsif tg_op = 'INSERT' then
    corps := jsonb_build_object('groupe_id', new.groupe_id, 'rejoint', new.user_id);
  else
    if not (old.statut = 'confirme' and new.statut = 'inscrit') then return new; end if;
    corps := jsonb_build_object('groupe_id', new.groupe_id, 'reconfirmer', new.user_id);
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := corps, headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_groupe() from public, anon, authenticated;
create or replace trigger groupe_participants_push after insert or update of statut on public.groupe_participants for each row execute function public.push_groupe();
