-- ═════════ Marché de Gros CI — schéma 42 : prix du transport et registre de la commission transport (6,9 %) ═════════
-- Demandé par le propriétaire le 21/10/2026 : « pour les transporteurs, notre commission est de 6,9 %, il faut l'appliquer ».
-- Ses choix (questions posées dans la session) :
--   • c'est le CHAUFFEUR qui fixe le prix du transport, en acceptant la mission (il peut le corriger jusqu'au chargement) ;
--   • la commission est DUE PAR LE CHAUFFEUR : il l'inclut dans son prix ; l'acheteur paie à la livraison le total
--     marchandise + transport (ex. 50 000 F + 10 000 F = 60 000 F).
-- Comme la commission de 3,5 % (schéma 30) : AUCUN paiement dans l'application, rien n'est prélevé ni encaissé.
--   « due » veut dire « devrait être perçue quand le paiement existera », jamais « perçue » (encaissement = 'aucun', seul permis).
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée existante modifiée (colonne ajoutée vide).
--
-- Règles :
--   • une ligne par mission acceptée qui a un prix (mission_id unique) : jamais comptée deux fois ;
--   • base = prix du transport arrondi au franc ; commission = 6,9 % arrondie au franc ; calcul UNIQUEMENT ici (déclencheurs) ;
--   • statut suit la commande : prevue → due (commande terminée) · suspendue (litige) · annulee (commande annulée,
--     mission refusée ou retirée) ;
--   • chaque changement ajoute une ligne au journal, qui ne se modifie pas ;
--   • tables fermées : lecture par mes_commissions_transport() (le chauffeur) et admin_commissions_transport().

-- ——— 1) le prix du transport, sur la mission ———
alter table public.transport_missions add column if not exists prix numeric;
do $$ begin
  alter table public.transport_missions add constraint transport_missions_prix_check check (prix is null or (prix > 0 and prix < 100000000));
exception when duplicate_object then null; end $$;

-- ——— 2) le registre ———
create table if not exists public.commissions_transport (
  id               uuid primary key default gen_random_uuid(),
  mission_id       uuid not null unique references public.transport_missions (id) on delete cascade,
  commande_id      uuid not null references public.commandes (id) on delete cascade,
  transporteur_id  uuid not null references public.transporteurs (id) on delete cascade,
  prix_transport   numeric not null check (prix_transport >= 0),
  taux             numeric not null default 0.069 check (taux = 0.069),
  commission       numeric not null check (commission >= 0),
  statut           text not null check (statut in ('prevue', 'due', 'suspendue', 'annulee')),
  encaissement     text not null default 'aucun' check (encaissement in ('aucun')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists commissions_transport_tr on public.commissions_transport (transporteur_id, updated_at desc);
create index if not exists commissions_transport_statut on public.commissions_transport (statut, updated_at desc);
create index if not exists commissions_transport_cmd on public.commissions_transport (commande_id);

create table if not exists public.commission_transport_journal (
  id             bigint generated always as identity primary key,
  commission_id  uuid not null references public.commissions_transport (id) on delete cascade,
  statut         text not null,
  prix_transport numeric not null,
  commission     numeric not null,
  motif          text not null,
  at             timestamptz not null default now()
);
create index if not exists commission_transport_journal_c on public.commission_transport_journal (commission_id, at);

alter table public.commissions_transport enable row level security;
alter table public.commission_transport_journal enable row level security;
revoke all on public.commissions_transport, public.commission_transport_journal from anon, authenticated;
create or replace trigger commission_transport_journal_fige before update on public.commission_transport_journal
  for each row execute function public._commission_journal_fige();

-- ——— 3) le calcul (côté serveur uniquement) ———
create or replace function public._ctr_sync(p_mission uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m public.transport_missions; c public.commandes; o public.commissions_transport; s text; p numeric; k numeric;
begin
  select * into m from public.transport_missions where id = p_mission;
  if m.id is null then return; end if;
  select * into o from public.commissions_transport where mission_id = m.id for update;
  -- pas (ou plus) de mission acceptée avec un prix : la ligne existante, s'il y en a une, est annulée
  if m.statut <> 'acceptee' or m.prix is null then
    if o.id is not null and o.statut <> 'annulee' then
      update public.commissions_transport set statut = 'annulee', updated_at = now() where id = o.id;
      insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
        values (o.id, 'annulee', o.prix_transport, o.commission, 'mission ' || m.statut || (case when m.prix is null then ', sans prix' else '' end));
    end if;
    return;
  end if;
  select * into c from public.commandes where id = m.commande_id;
  s := case c.etat when 'terminee' then 'due' when 'litige' then 'suspendue' when 'annulee' then 'annulee' else 'prevue' end;
  p := round(m.prix, 0); k := round(p * 0.069, 0);
  if o.id is null then
    insert into public.commissions_transport (mission_id, commande_id, transporteur_id, prix_transport, commission, statut)
      values (m.id, m.commande_id, m.transporteur_id, p, k, s) returning * into o;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : mission acceptée à ' || p || ' F');
  elsif o.statut <> s or o.prix_transport <> p then
    update public.commissions_transport set statut = s, prix_transport = p, commission = k, updated_at = now() where id = o.id;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : ' || (case when o.prix_transport <> p then 'prix ' || o.prix_transport || ' → ' || p || ' F' else o.statut || ' → ' || s end));
  end if;
end $$;
revoke all on function public._ctr_sync(uuid) from public, anon, authenticated;

create or replace function public._ctr_mission() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public._ctr_sync(new.id); return new; end $$;
revoke all on function public._ctr_mission() from public, anon, authenticated;
create or replace trigger transport_missions_commission after insert or update of statut, prix on public.transport_missions
  for each row execute function public._ctr_mission();

create or replace function public._ctr_commande() returns trigger
language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  if new.etat is not distinct from old.etat then return new; end if;
  for mid in select id from public.transport_missions where commande_id = new.id and statut = 'acceptee' loop perform public._ctr_sync(mid); end loop;
  return new;
end $$;
revoke all on function public._ctr_commande() from public, anon, authenticated;
create or replace trigger commandes_commission_transport after update of etat on public.commandes
  for each row execute function public._ctr_commande();

-- ——— 4) le chauffeur fixe son prix ———
create or replace function public._ctr_prix(p numeric) returns numeric
language plpgsql immutable set search_path = public as $$
begin
  if p is null or p <= 0 or p >= 100000000 then raise exception 'Indiquez le prix du transport, en francs (ex. 10 000).'; end if;
  return round(p, 0);
end $$;
revoke all on function public._ctr_prix(numeric) from public, anon, authenticated;

-- accepter (avec le prix) ou refuser une mission
create or replace function public.chauffeur_repondre2(p_mission uuid, p_oui boolean, p_prix numeric default null, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; px numeric;
begin
  select * into m from public.transport_missions where id = p_mission for update;
  select * into t from public.transporteurs where id = m.transporteur_id;
  if m.id is null or t.user_id is distinct from me then raise exception 'Mission introuvable.'; end if;
  if p_oui then
    px := public._ctr_prix(p_prix);
    update public.transport_missions set prix = px where id = m.id and statut = 'proposee';
  end if;
  return public.chauffeur_repondre(p_mission, p_oui, p_note);
end $$;

-- corriger son prix, jusqu'au chargement
create or replace function public.chauffeur_prix(p_mission uuid, p_prix numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; c public.commandes; px numeric := public._ctr_prix(p_prix);
begin
  select * into m from public.transport_missions where id = p_mission for update;
  select * into t from public.transporteurs where id = m.transporteur_id;
  if m.id is null or t.user_id is distinct from me then raise exception 'Mission introuvable.'; end if;
  if m.statut <> 'acceptee' then raise exception 'Le prix se fixe sur une mission acceptée.'; end if;
  select * into c from public.commandes where id = m.commande_id;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le prix ne se change plus après le chargement.';
  end if;
  update public.transport_missions set prix = px where id = m.id;
  update public.commandes set updated_at = now() where id = c.id;
  return px;
end $$;

-- l'équipe saisit le prix d'un chauffeur inscrit par elle (sans l'application)
create or replace function public.admin_mission_prix(p_mission uuid, p_prix numeric) returns numeric
language plpgsql security definer set search_path = public as $$
declare m public.transport_missions; c public.commandes; px numeric := public._ctr_prix(p_prix);
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into m from public.transport_missions where id = p_mission for update;
  if m.id is null or m.statut <> 'acceptee' then raise exception 'Mission acceptée introuvable.'; end if;
  select * into c from public.commandes where id = m.commande_id;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le prix ne se change plus après le chargement.';
  end if;
  update public.transport_missions set prix = px where id = m.id;
  update public.commandes set updated_at = now() where id = c.id;
  return px;
end $$;

-- ——— 5) lecture ———
-- le chauffeur voit son prix, la commission et ce qu'il garde
create or replace function public.chauffeur_missions() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at, 'note', m.note,
      'prix', m.prix, 'taux', 0.069, 'commission', case when m.prix is not null then round(round(m.prix, 0) * 0.069, 0) end,
      'net', case when m.prix is not null then round(m.prix, 0) - round(round(m.prix, 0) * 0.069, 0) end,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'validation', c.validation, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'maj', c.updated_at) order by (m.statut = 'proposee') desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$$;

-- l'acheteur et le vendeur voient le prix du transport et le total à payer à la livraison (marchandise + transport)
create or replace function public.commande_transport(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when c.id is null or not (public._cmd_role2(c, auth.uid()) is not null or public.est_admin()) then null else json_build_object(
    'mode', c.mode_transport,
    'peut_choisir', c.mode_transport = public._cmd_role(c, auth.uid()) and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation'),
    'mon_role', coalesce(public._cmd_role2(c, auth.uid()), 'admin'),
    'mission', (select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'vehicule', public._tr_vehicule(t.vehicule),
        'immatriculation', t.immatriculation, 'verifie', t.statut = 'verifie', 'avec_application', t.user_id is not null, 'le', coalesce(m.repondu_le, m.created_at),
        'prix', m.prix)
      from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
      where m.commande_id = c.id order by m.created_at desc limit 1),
    'prix_transport', (select round(m.prix, 0) from public.transport_missions m where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is not null order by m.created_at desc limit 1),
    'total_livraison', (select round(c.montant, 0) + round(m.prix, 0) from public.transport_missions m where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is not null and c.montant is not null order by m.created_at desc limit 1)) end
  from (select 1) x left join public.commandes c on c.id = p_id;
$$;

create or replace function public.mes_commissions_transport() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'taux', 0.069, 'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(statut, json_build_object('n', n, 'transports', v, 'commission', k)), '{}'::json)
               from (select k.statut, count(*) n, sum(k.prix_transport) v, sum(k.commission) k from public.commissions_transport k
                     join public.transporteurs t on t.id = k.transporteur_id where t.user_id = auth.uid() group by k.statut) x),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, k.prix_transport, k.taux, k.commission, k.statut, k.encaissement, k.updated_at
               from public.commissions_transport k join public.transporteurs t on t.id = k.transporteur_id join public.commandes c on c.id = k.commande_id
               where t.user_id = auth.uid() order by k.updated_at desc limit 200) x))
  where auth.uid() is not null;
$$;

create or replace function public.admin_commissions_transport() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'taux', 0.069, 'encaisse', 0,
    'totaux', (select coalesce(json_object_agg(statut, json_build_object('n', n, 'transports', v, 'commission', k)), '{}'::json)
               from (select statut, count(*) n, sum(prix_transport) v, sum(commission) k from public.commissions_transport group by statut) x),
    'lignes', (select coalesce(json_agg(x order by x.updated_at desc), '[]'::json) from (
               select k.commande_id, c.numero, c.produit, t.nom transporteur, k.prix_transport, k.commission, k.statut, k.updated_at
               from public.commissions_transport k join public.transporteurs t on t.id = k.transporteur_id join public.commandes c on c.id = k.commande_id
               order by k.updated_at desc limit 300) x));
end $$;

revoke execute on function public.chauffeur_repondre2(uuid, boolean, numeric, text), public.chauffeur_prix(uuid, numeric), public.admin_mission_prix(uuid, numeric),
  public.mes_commissions_transport(), public.admin_commissions_transport() from public, anon;
grant execute on function public.chauffeur_repondre2(uuid, boolean, numeric, text), public.chauffeur_prix(uuid, numeric), public.admin_mission_prix(uuid, numeric),
  public.mes_commissions_transport(), public.admin_commissions_transport() to authenticated;

-- ——— 6) administration : la liste des commandes montre la mission (id, prix, avec ou sans application) ;
--        « À traiter » inclut les missions acceptées d'un chauffeur sans application dont le prix reste à saisir ———
do $$
declare d text;
begin
  select pg_get_functiondef('public.admin_commandes(text)'::regprocedure) into d;
  if position('''prix'', m.prix' in d) > 0 then return; end if;
  d := replace(d, $a$(select json_build_object('statut', m.statut, 'nom', t.nom) from$a$,
    $a$(select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'prix', m.prix, 'avec_application', t.user_id is not null) from$a$);
  d := replace(d, $a$and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))$a$,
    $a$and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))
        or (c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and exists (select 1 from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
                        where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is null and t.user_id is null))$a$);
  if position('''prix'', m.prix' in d) = 0 or position('m.prix is null and t.user_id is null' in d) = 0 then raise exception 'admin_commandes : motif introuvable'; end if;
  execute d;
end $$;
