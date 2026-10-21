-- ═════════ Marché de Gros CI — schéma 30 : registre de la commission de 3,5 % ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée existante modifiée.
--
-- Principe :
--   • une seule ligne par commande (commande_id unique) : la commission ne peut pas être comptée deux fois ;
--   • base = montant final de la commande (quantité finale × prix final de l'accord), calculé par le serveur ;
--   • taux = 3,5 %, arrondi au franc ; le calcul se fait UNIQUEMENT dans le déclencheur ci-dessous ;
--   • statuts : prevue (commande à confirmer ou en cours) → due (commande terminée, vente réalisée)
--               suspendue (litige ouvert) · annulee (commande annulée, y compris après litige) ;
--   • encaissement = 'aucun' et rien d'autre n'est permis : il n'y a PAS de paiement dans l'application.
--     « due » veut dire « devrait être perçue quand le paiement existera », jamais « perçue » ;
--   • chaque changement (statut ou montant) ajoute une ligne au journal, qu'on ne peut ni modifier ni effacer ;
--   • le compte officiel « Marché de Gros » ne se doit pas de commission : ses ventes ne sont pas inscrites ;
--   • la commission transport (6,9 %) n'est PAS traitée ici ;
--   • tables fermées (RLS sans politique, aucun droit) : lecture par mes_commissions() et admin_commissions().

create table if not exists public.commissions (
  id             uuid primary key default gen_random_uuid(),
  commande_id    uuid not null unique references public.commandes (id) on delete cascade,
  vendeur_id     uuid not null,
  acheteur_id    uuid not null,
  montant_vente  numeric not null check (montant_vente >= 0),
  taux           numeric not null default 0.035 check (taux = 0.035),
  commission     numeric not null check (commission >= 0),
  statut         text not null check (statut in ('prevue', 'due', 'suspendue', 'annulee')),
  encaissement   text not null default 'aucun' check (encaissement in ('aucun')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists commissions_vendeur on public.commissions (vendeur_id, updated_at desc);
create index if not exists commissions_statut on public.commissions (statut, updated_at desc);

create table if not exists public.commission_journal (
  id             bigint generated always as identity primary key,
  commission_id  uuid not null references public.commissions (id) on delete cascade,
  statut         text not null,
  montant_vente  numeric not null,
  commission     numeric not null,
  motif          text not null,
  at             timestamptz not null default now()
);
create index if not exists commission_journal_c on public.commission_journal (commission_id, at);

alter table public.commissions enable row level security;
alter table public.commission_journal enable row level security;
revoke all on public.commissions, public.commission_journal from anon, authenticated;

-- Le journal ne se réécrit pas (l'effacement ne vient que de la suppression d'un compte, en cascade).
create or replace function public._commission_journal_fige() returns trigger
language plpgsql set search_path = public as $$
begin raise exception 'Le journal des commissions ne se modifie pas.'; end $$;
create or replace trigger commission_journal_fige before update on public.commission_journal
  for each row execute function public._commission_journal_fige();

-- Le calcul, côté serveur uniquement.
create or replace function public._commission_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare s text; m numeric; k numeric; old_c public.commissions; motif text;
begin
  if new.montant is null or public.est_admin_id(new.vendeur_id) then return new; end if;
  s := case new.etat when 'terminee' then 'due' when 'litige' then 'suspendue' when 'annulee' then 'annulee' else 'prevue' end;
  m := round(new.montant, 0);
  k := round(m * 0.035, 0);
  select * into old_c from public.commissions where commande_id = new.id for update;
  if old_c.id is null then
    insert into public.commissions (commande_id, vendeur_id, acheteur_id, montant_vente, commission, statut)
      values (new.id, new.vendeur_id, new.acheteur_id, m, k, s) returning * into old_c;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, 'commande ' || new.numero || ' : ' || new.etat);
  elsif old_c.statut <> s or old_c.montant_vente <> m then
    motif := 'commande ' || new.numero || ' : ' || old_c.statut || ' → ' || s;
    update public.commissions set statut = s, montant_vente = m, commission = k, updated_at = now() where id = old_c.id;
    insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
      values (old_c.id, s, m, k, motif);
  end if;
  return new;
end $$;
revoke all on function public._commission_sync() from public, anon, authenticated;
create or replace trigger commission_sync after insert or update of etat, montant on public.commandes
  for each row execute function public._commission_sync();

-- Commandes déjà existantes : inscrites une fois (sans rien changer aux commandes).
insert into public.commissions (commande_id, vendeur_id, acheteur_id, montant_vente, commission, statut)
select c.id, c.vendeur_id, c.acheteur_id, round(c.montant, 0), round(round(c.montant, 0) * 0.035, 0),
  case c.etat when 'terminee' then 'due' when 'litige' then 'suspendue' when 'annulee' then 'annulee' else 'prevue' end
from public.commandes c
where c.montant is not null and not public.est_admin_id(c.vendeur_id)
on conflict (commande_id) do nothing;
insert into public.commission_journal (commission_id, statut, montant_vente, commission, motif)
select k.id, k.statut, k.montant_vente, k.commission, 'inscription initiale (schéma 30)'
from public.commissions k where not exists (select 1 from public.commission_journal j where j.commission_id = k.id);

-- Lecture : le vendeur voit les siennes.
create or replace function public.mes_commissions() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(statut, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select statut, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions
                     where vendeur_id = auth.uid() group by statut) t),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, k.montant_vente, k.taux, k.commission, k.statut, k.encaissement, k.updated_at
               from public.commissions k join public.commandes c on c.id = k.commande_id
               where k.vendeur_id = auth.uid() order by k.updated_at desc limit 200) x))
  where auth.uid() is not null;
$$;

-- Lecture : l'administration voit le registre et son journal.
create or replace function public.admin_commissions() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.035,
    'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(statut, json_build_object('n', n, 'ventes', v, 'commission', k)), '{}'::json)
               from (select statut, count(*) n, sum(montant_vente) v, sum(commission) k from public.commissions group by statut) t),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.id, c.numero, c.produit, public.nom_public(k.vendeur_id) vendeur, k.montant_vente, k.commission, k.statut,
                 k.updated_at, (select json_agg(json_build_object('statut', j.statut, 'commission', j.commission, 'motif', j.motif, 'at', j.at) order by j.at)
                                from public.commission_journal j where j.commission_id = k.id) journal
               from public.commissions k join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

revoke all on function public.mes_commissions(), public.admin_commissions() from public, anon;
grant execute on function public.mes_commissions(), public.admin_commissions() to authenticated;
