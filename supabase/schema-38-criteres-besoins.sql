-- ═════════ Marché de Gros CI — schéma 38 : exigences à cocher dans un besoin pro ═════════
-- Demandé par le propriétaire le 21/10/2026 (point 2). Appliqué par Claude avec l'outil Supabase.
-- Aucune donnée effacée. Le texte libre « exigences » reste ; on ajoute une liste fermée de critères cochés.
-- besoin_creer garde sa signature (anciennes versions de l'app) ; besoin_creer2 = la même chose + les critères, en un seul appel.

alter table public.besoins add column if not exists criteres text[] not null default '{}';
do $$ begin
  alter table public.besoins add constraint besoins_criteres_check check (
    cardinality(criteres) <= 12 and criteres <@ array['calibre', 'frais', 'sec', 'trie', 'emballage', 'sac_50', 'echantillon',
      'livraison', 'tot', 'regulier', 'recu', 'pesee']::text[]);
exception when duplicate_object then null; end $$;

create or replace function public.besoin_creer2(p_titre text, p_type text, p_frequence text, p_debut date, p_fin date,
  p_region text, p_ville text, p_exigences text, p_lignes jsonb, p_criteres text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; c text[];
begin
  c := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(p_criteres, '{}')) x), '{}');
  if not c <@ array['calibre', 'frais', 'sec', 'trie', 'emballage', 'sac_50', 'echantillon', 'livraison', 'tot', 'regulier', 'recu', 'pesee']::text[] then
    raise exception 'Exigence inconnue.';
  end if;
  v_id := public.besoin_creer(p_titre, p_type, p_frequence, p_debut, p_fin, p_region, p_ville, p_exigences, p_lignes);
  update public.besoins set criteres = c where besoins.id = v_id and besoins.user_id = auth.uid();
  return v_id;
end $$;
revoke execute on function public.besoin_creer2(text, text, text, date, date, text, text, text, jsonb, text[]) from public, anon;
grant execute on function public.besoin_creer2(text, text, text, date, date, text, text, text, jsonb, text[]) to authenticated;

-- besoin_public renvoie aussi les critères (réécrite à partir de sa définition actuelle)
do $$
declare d text;
begin
  select pg_get_functiondef('public.besoin_public(uuid)'::regprocedure) into d;
  if position('''criteres''' in d) > 0 then return; end if;
  d := replace(d, '''exigences'', b.exigences,', '''exigences'', b.exigences, ''criteres'', b.criteres,');
  if position('''criteres''' in d) = 0 then raise exception 'besoin_public : motif introuvable'; end if;
  execute d;
end $$;
