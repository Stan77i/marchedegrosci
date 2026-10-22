-- Marché de Gros CI — schéma 47 : les exigences dans une demande ordinaire (« Je cherche »), pas seulement dans un besoin pro.
-- Demandé par le propriétaire le 22/10/2026 : « quand je publie une demande, les exigences (frais, calibre…) ne se voient pas ».
-- Aucune donnée effacée ; trois colonnes ajoutées, vides par défaut (les anciennes demandes et les anciennes versions de l'app ne changent pas).
--   criteres  : cases cochées, même liste fermée que les besoins (schéma 38) ;
--   detail    : précisions avec valeur (qualité, calibre, maturité, conditionnement…), vérifiées par _besoin_detail (schéma 40) ;
--   exigences : texte libre, 300 caractères au plus, passé au filtre des textes (pas de numéro ni de lien).
alter table public.demandes add column if not exists criteres text[] not null default '{}';
alter table public.demandes add column if not exists detail jsonb not null default '{}'::jsonb;
alter table public.demandes add column if not exists exigences text;
do $$ begin
  alter table public.demandes add constraint demandes_criteres_check check (cardinality(criteres) <= 12 and criteres <@ array['calibre', 'frais', 'sec', 'trie',
    'emballage', 'sac_50', 'echantillon', 'livraison', 'tot', 'regulier', 'recu', 'pesee']::text[]);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.demandes add constraint demandes_exigences_check check (exigences is null or char_length(exigences) <= 300);
exception when duplicate_object then null; end $$;

-- normalise avant l'enregistrement (security definer : _besoin_detail n'est pas ouverte aux comptes)
create or replace function public.demande_exigences() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.detail := public._besoin_detail(coalesce(new.detail, '{}'::jsonb));
  new.criteres := coalesce((select array_agg(distinct x order by x) from unnest(coalesce(new.criteres, '{}')) x), '{}');
  new.exigences := nullif(btrim(coalesce(new.exigences, '')), '');
  return new;
end $$;
revoke execute on function public.demande_exigences() from public, anon, authenticated;
create or replace trigger demandes_exigences before insert or update of criteres, detail, exigences on public.demandes
  for each row execute function public.demande_exigences();

-- le texte libre passe par le même filtre que le nom et la ville (pas de numéro, pas de lien)
do $$ declare d text; begin
  d := pg_get_functiondef('public.garde_textes()'::regprocedure);
  if position('new.product_label, new.exigences' in d) > 0 then return; end if;
  d := replace(d, $q$t := concat_ws(' · ', new.buyer_name, new.city, new.product_label);$q$, $q$t := concat_ws(' · ', new.buyer_name, new.city, new.product_label, new.exigences);$q$);
  if position('new.product_label, new.exigences' in d) = 0 then raise exception 'garde_textes : motif introuvable'; end if;
  execute d;
end $$;
