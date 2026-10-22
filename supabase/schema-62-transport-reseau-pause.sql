-- ═════════ Marché de Gros CI — schéma 62 : « Transporteur du réseau Marché de Gros » en pause ═════════
-- Demandé par le propriétaire le 22/10/2026 : « le Marché de Gros n'a pas de transporteur ; rendre cette fonctionnalité
-- indisponible partout, le temps que de vrais transporteurs se connectent et veuillent travailler avec nous ».
-- Au 22/10/2026 : 0 transporteur inscrit, aucune commande en mode « reseau ».
--   • Une nouvelle commande ne peut plus être créée avec mode_transport = 'reseau' (même depuis une ancienne version de l'app).
--   • L'Espace chauffeur reste ouvert : c'est par là que de vrais transporteurs s'inscriront.
-- Pour rouvrir : create or replace function public._transport_reseau_ouvert() … select true.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée touchée.

create or replace function public._transport_reseau_ouvert() returns boolean
language sql immutable set search_path = public as $$ select false $$;

create or replace function public._cmd_reseau_pause() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.mode_transport = 'reseau' and not public._transport_reseau_ouvert() then
    raise exception 'Le transporteur du réseau Marché de Gros arrive bientôt. Pour l’instant, le transport se fait par l’acheteur ou par le vendeur.';
  end if;
  return new;
end $$;

do $$ begin if not exists (select 1 from pg_trigger where tgname = 'commandes_reseau_pause' and tgrelid = 'public.commandes'::regclass) then
  create trigger commandes_reseau_pause before insert on public.commandes for each row execute function public._cmd_reseau_pause(); end if; end $$;

revoke execute on function public._cmd_reseau_pause() from public, anon, authenticated;
