-- ═════════ Marché de Gros CI — schéma 97c : quantité minimale aussi sur les demandes, quantité obligatoire ═════════
-- Règle du propriétaire (25/10/2026) : « nous sommes un marché de gros ; il faut la quantité pour les acheteurs et pour les vendeurs ;
-- il faut une quantité minimale ». Ce qui existait déjà (vérifié par test le 25/10/2026) :
--   • une offre se vend par parties : chaque accord retire sa quantité, l'annonce reste en ligne tant qu'il en reste (schéma 92a) ;
--   • une proposition plus grande que ce qui reste est refusée (nego_agir : « l'annonce porte sur … au plus ») ;
--   • offres.qte_min (schéma 37) : un acheteur ne peut pas proposer moins ; quand le reste devient plus petit que le minimum,
--     le reste se prend en entier (le minimum devient le reste : le stock n'est jamais bloqué).
-- Ce schéma ajoute, de façon symétrique :
--   • demandes.qte_min : l'acheteur fixe le minimum par vendeur ; un vendeur qui répond à la demande ne peut pas proposer moins
--     (même règle du reste) ; l'auteur de l'annonce, lui, reste libre dans ses contre-propositions ;
--   • à la publication (et quand on change le minimum) : la quantité est obligatoire et le minimum ne dépasse pas la quantité ;
--   • le tableau du marché donne aussi le minimum des demandes.
-- Rien n'est effacé ; la colonne est vide par défaut (pas de minimum). Testé sur le projet de test
-- (supabase/tests/litige-quantites-97-scenarios.sql).

-- 1. Le minimum des demandes
alter table public.demandes add column if not exists qte_min numeric;
do $$ begin
  alter table public.demandes add constraint demandes_qte_min_check check (qte_min is null or (qte_min > 0 and qte_min < 1e9));
exception when duplicate_object then null; end $$;
grant select (qte_min) on public.demandes to anon, authenticated;
grant insert (qte_min), update (qte_min) on public.demandes to authenticated;

-- 2. Quantité obligatoire à la publication, minimum jamais au-dessus de la quantité (le serveur refuse ce que l'écran refuse)
create or replace function public._annonce_quantites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and (new.quantity is null or new.quantity <= 0) then
    raise exception 'QUANTITE_REQUISE : indiquez la quantité.';
  end if;
  if new.qte_min is not null and new.quantity is not null and new.qte_min > new.quantity
     and (tg_op = 'INSERT' or new.qte_min is distinct from old.qte_min) then
    raise exception 'QTE_MIN : la quantité minimale ne peut pas dépasser la quantité.';
  end if;
  return new;
end $$;
revoke all on function public._annonce_quantites() from public, anon, authenticated;
create or replace trigger offres_quantites before insert or update of qte_min on public.offres
  for each row execute function public._annonce_quantites();
create or replace trigger demandes_quantites before insert or update of qte_min on public.demandes
  for each row execute function public._annonce_quantites();

-- 3. nego_agir : le minimum vaut pour celui qui répond à l'annonce, offre ou demande (réécrite à partir de sa définition actuelle)
do $$
declare d text;
  a text := $a$    if n.cible = 'offre' and me <> n.proprio_id then
      select o.qte_min into mn from public.offres o where o.id = n.cible_id;$a$;
  b text := $a$          raise exception 'Le vendeur vend à partir de % %. Proposez au moins cette quantité.', replace(trim_scale(mn)::text, '.', ','), coalesce(n.unite, '');$a$;
begin
  select pg_get_functiondef('public.nego_agir(uuid, text, numeric, numeric, text, uuid)'::regprocedure) into d;
  if position('from public.demandes d0 where d0.id = n.cible_id' in d) > 0 then return; end if;   -- déjà fait
  if position(a in d) = 0 or position(b in d) = 0 then raise exception 'nego_agir : motif introuvable'; end if;
  d := replace(d, a, $a$    if me <> n.proprio_id then
      if n.cible = 'offre' then select o.qte_min into mn from public.offres o where o.id = n.cible_id;
      else select d0.qte_min into mn from public.demandes d0 where d0.id = n.cible_id; end if;$a$);
  d := replace(d, b, $a$          raise exception '% à partir de % %. Proposez au moins cette quantité.',
            case when n.cible = 'offre' then 'Le vendeur vend' else 'L''acheteur achète' end, replace(trim_scale(mn)::text, '.', ','), coalesce(n.unite, '');$a$);
  execute d;
end $$;

-- 4. Le tableau du marché : le minimum des demandes aussi
do $$
declare d text;
begin
  select pg_get_functiondef('public.tableau_marche(text, text)'::regprocedure) into d;
  if position('d.quantity, d.qte_min, d.city' in d) > 0 then return; end if;
  if position('d.quantity, null, d.city' in d) = 0 or position($a$'quantite', quantity, 'ville'$a$ in d) = 0 then raise exception 'tableau_marche : motif introuvable'; end if;
  -- seule la liste des demandes n'a pas encore 'qte_min' entre la quantité et la ville
  execute replace(replace(d, 'd.quantity, null, d.city', 'd.quantity, d.qte_min, d.city'),
    $a$'quantite', quantity, 'ville'$a$, $a$'quantite', quantity, 'qte_min', qte_min, 'ville'$a$);
end $$;
