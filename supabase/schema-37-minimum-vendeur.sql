-- ═════════ Marché de Gros CI — schéma 37 : le vendeur fixe un minimum de vente ═════════
-- Demandé par le propriétaire le 21/10/2026 (point 1). Appliqué par Claude avec l'outil Supabase.
-- Aucune donnée effacée, aucune annonce existante modifiée (la colonne est vide par défaut = pas de minimum).
--
-- Règle : sur son offre, le vendeur peut écrire « à partir de 50 kg ».
--   • Un acheteur ne peut pas proposer moins (le serveur refuse, dans nego_agir).
--   • Si le stock restant devient plus petit que le minimum, le minimum devient le stock restant :
--     le dernier lot peut toujours être vendu.
--   • Le vendeur, lui, peut proposer moins dans une contre-proposition (c'est son choix).
--   • Les achats groupés ne changent pas : c'est le vendeur qui fixe ou valide l'objectif du groupe.

alter table public.offres add column if not exists qte_min numeric;
do $$ begin
  alter table public.offres add constraint offres_qte_min_check check (qte_min is null or (qte_min > 0 and qte_min < 1e9));
exception when duplicate_object then null; end $$;
grant select (qte_min) on public.offres to anon, authenticated;
grant insert (qte_min), update (qte_min) on public.offres to authenticated;

-- nego_agir : refuse une proposition d'acheteur sous le minimum (réécrite à partir de sa définition actuelle)
do $$
declare d text;
begin
  select pg_get_functiondef('public.nego_agir(uuid, text, numeric, numeric, text, uuid)'::regprocedure) into d;
  if position('mn numeric;' in d) > 0 then return; end if;   -- déjà appliqué
  d := replace(d, 'prop public.messages;', 'prop public.messages; mn numeric;');
  d := replace(d, $a$raise exception 'Quantité trop grande : l''annonce porte sur % au plus.', a.quantity; end if;$a$,
    $a$raise exception 'Quantité trop grande : l''annonce porte sur % au plus.', a.quantity; end if;
    if n.cible = 'offre' and me <> n.proprio_id then
      select o.qte_min into mn from public.offres o where o.id = n.cible_id;
      if mn is not null then
        if a.quantity > 0 then mn := least(mn, a.quantity); end if;
        if q is null or q < mn then
          raise exception 'Le vendeur vend à partir de % %. Proposez au moins cette quantité.', replace(trim_scale(mn)::text, '.', ','), coalesce(n.unite, '');
        end if;
      end if;
    end if;$a$);
  if position('mn numeric;' in d) = 0 or position('Le vendeur vend à partir de' in d) = 0 then raise exception 'nego_agir : motif introuvable'; end if;
  execute d;
end $$;

-- Vérification : select column_name from information_schema.columns where table_name = 'offres' and column_name = 'qte_min';
