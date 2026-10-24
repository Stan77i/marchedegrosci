-- ═════════ Marché de Gros CI — schéma 92a : le stock revient quand la vente tombe ═════════
-- Audit du 24/10/2026, P1 n° 1 (contradiction 1) : le stock ne revenait que dans 1 cas sur 5.
-- Ce schéma :
--   • réglages des délais des commandes (table reglages, clé « commandes »), modifiables seulement par un administrateur ;
--   • stock_mouvements : ce que chaque accord a vraiment pris sur l'annonce, et ce qui en a été rendu (jamais plus que pris) ;
--   • un seul déclencheur rend le stock à chaque passage d'une commande à « annulée » sans marchandise partie
--     (refus, retrait, expiration, annulation acceptée, litige ou décision de l'équipe avant le chargement), une seule fois ;
--   • l'annonce retirée pour épuisement revient en ligne ;
--   • un accord sans commande pendant 72 h (réglable) devient « sans suite » : son stock est rendu et il ne peut plus servir ;
--   • _stock_garde dit clairement pourquoi il refuse, au lieu de corriger en silence.
-- Rien n'est effacé. Testé sur le projet de test (supabase/tests/stock-commandes-scenarios.sql).

-- 1. Réglages (heures) — lus par _cmd_regle, changés par admin_commandes_regler
insert into public.reglages (cle, valeur)
values ('commandes', jsonb_build_object('debut', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'accord_sans_suite_heures', 72, 'chargement_heures', 72, 'rappel_chargement_heures', 12,
  'reception_heures', 24, 'litige_heures', 72, 'mot_essais', 5))
on conflict (cle) do nothing;

create or replace function public._cmd_regle(p_cle text, p_def integer) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> p_cle)::integer from public.reglages where cle = 'commandes'), p_def);
$$;
revoke all on function public._cmd_regle(text, integer) from public, anon, authenticated;

-- les délais, lisibles par les membres (affichage)
create or replace function public.commandes_regles() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('accord_sans_suite_heures', public._cmd_regle('accord_sans_suite_heures', 72),
    'chargement_heures', public._cmd_regle('chargement_heures', 72), 'rappel_chargement_heures', public._cmd_regle('rappel_chargement_heures', 12),
    'reception_heures', public._cmd_regle('reception_heures', 24), 'litige_heures', public._cmd_regle('litige_heures', 72),
    'mot_essais', public._cmd_regle('mot_essais', 5));
$$;
revoke all on function public.commandes_regles() from public, anon;
grant execute on function public.commandes_regles() to authenticated;

create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'commandes' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('accord_sans_suite_heures', 'chargement_heures', 'rappel_chargement_heures', 'reception_heures', 'litige_heures', 'mot_essais') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) or (v #>> '{}')::numeric < 1 or (v #>> '{}')::numeric > 720 then
      raise exception 'Valeur incorrecte pour % (de 1 à 720).', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'rappel_chargement_heures')::int >= (cur ->> 'chargement_heures')::int then
    raise exception 'Le rappel doit partir avant la fin du délai de chargement.';
  end if;
  if (cur ->> 'mot_essais')::int > 20 then raise exception 'Mot secret : 20 essais au plus.'; end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'commandes';
  return cur::json;
end $$;
revoke all on function public.admin_commandes_regler(jsonb) from public, anon;
grant execute on function public.admin_commandes_regler(jsonb) to authenticated;

-- 2. Colonnes des commandes (dates des délais, garde-fous)
alter table public.commandes add column if not exists stock_rendu_le timestamptz;
alter table public.commandes add column if not exists confirme_le timestamptz;
alter table public.commandes add column if not exists rappel_chargement_le timestamptz;
alter table public.commandes add column if not exists retard_chargement_le timestamptz;
alter table public.commandes add column if not exists annulation_demandes integer not null default 0;
alter table public.commandes add column if not exists livre_le timestamptz;
alter table public.commandes add column if not exists livre_par uuid;
alter table public.commandes add column if not exists rappel_reception_le timestamptz;
alter table public.commandes add column if not exists mot_bloque_le timestamptz;
alter table public.commandes add column if not exists litige_echeance timestamptz;
alter table public.commandes add column if not exists litige_retard_le timestamptz;

-- 3. Ce que chaque accord a pris sur l'annonce, et ce qui en est revenu
create table if not exists public.stock_mouvements (
  negociation_id uuid primary key,
  cible text not null check (cible in ('offre', 'demande')),
  cible_id uuid not null,
  pris numeric not null default 0 check (pris >= 0),
  rendu numeric not null default 0 check (rendu >= 0),
  retiree_epuisement boolean not null default false,
  sans_suite_le timestamptz,
  rendu_le timestamptz,
  raison text,
  created_at timestamptz not null default now(),
  constraint stock_mouvements_rendu_max check (rendu <= pris)
);
alter table public.stock_mouvements enable row level security;
revoke all on public.stock_mouvements from anon, authenticated;
create index if not exists stock_mouvements_attente on public.stock_mouvements (created_at) where sans_suite_le is null and rendu = 0;

-- accords conclus avant ce schéma : on note ce qu'ils ont pris (la quantité convenue) ; ils ne passent jamais « sans suite » tout seuls
insert into public.stock_mouvements (negociation_id, cible, cible_id, pris, created_at, raison)
select n.id, n.cible, n.cible_id, n.quantite_finale, coalesce(n.conclu_le, n.updated_at, now()), 'avant_92'
from public.negociations n where n.statut = 'conclue' and coalesce(n.quantite_finale, 0) > 0
on conflict (negociation_id) do nothing;

-- 4. L'accord prend le stock : on note combien (jamais plus que ce que l'annonce avait)
create or replace function public.stock_apres_accord() returns trigger
language plpgsql security definer set search_path = public as $$
declare q0 numeric; q numeric; ret boolean := false;
begin
  if new.statut = 'conclue' and old.statut is distinct from 'conclue' and coalesce(new.quantite_finale, 0) > 0 then
    if new.cible = 'offre' then
      select quantity into q0 from public.offres where id = new.cible_id for update;
      update public.offres set quantity = greatest(0, coalesce(quantity, 0) - new.quantite_finale) where id = new.cible_id returning quantity into q;
      if q is not null and q <= 0 then update public.offres set status = 'retiree' where id = new.cible_id and status = 'active'; ret := found; end if;
    else
      select quantity into q0 from public.demandes where id = new.cible_id for update;
      update public.demandes set quantity = greatest(0, coalesce(quantity, 0) - new.quantite_finale) where id = new.cible_id returning quantity into q;
      if q is not null and q <= 0 then update public.demandes set status = 'retiree' where id = new.cible_id and status = 'active'; ret := found; end if;
    end if;
    insert into public.stock_mouvements (negociation_id, cible, cible_id, pris, retiree_epuisement)
    values (new.id, new.cible, new.cible_id, least(new.quantite_finale, greatest(coalesce(q0, 0), 0)), ret)
    on conflict (negociation_id) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.stock_apres_accord() from public, anon, authenticated;

-- 5. Remettre une quantité sur une annonce ; retirée pour épuisement (stock à zéro, pas cachée par son auteur) : elle revient en ligne
create or replace function public._stock_remettre(p_cible text, p_id uuid, p_n numeric) returns void
language plpgsql security definer set search_path = public as $$
declare q0 numeric; st text; rl timestamptz;
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  perform set_config('mdg.stock_rendu', '1', true);
  if p_cible = 'offre' then
    select quantity, status, retiree_le into q0, st, rl from public.offres where id = p_id for update;
    if not found then perform set_config('mdg.stock_rendu', '', true); return; end if;
    update public.offres set quantity = coalesce(quantity, 0) + p_n where id = p_id;
    if st = 'retiree' and coalesce(q0, 0) <= 0 and rl is null then
      begin
        update public.offres set status = 'active' where id = p_id and status = 'retiree';
      exception when others then null;   -- remise en ligne refusée par une autre règle (limite d'annonces…) : le stock est rendu quand même
      end;
    end if;
  else
    select quantity, status, retiree_le into q0, st, rl from public.demandes where id = p_id for update;
    if not found then perform set_config('mdg.stock_rendu', '', true); return; end if;
    update public.demandes set quantity = coalesce(quantity, 0) + p_n where id = p_id;
    if st = 'retiree' and coalesce(q0, 0) <= 0 and rl is null then
      begin
        update public.demandes set status = 'active' where id = p_id and status = 'retiree';
      exception when others then null;
      end;
    end if;
  end if;
  perform set_config('mdg.stock_rendu', '', true);
end $$;
revoke all on function public._stock_remettre(text, uuid, numeric) from public, anon, authenticated;

-- 6. Rendre le stock d'une commande : une seule fois par commande, jamais plus que ce que l'accord a pris
create or replace function public._cmd_rendre_stock(c public.commandes) returns void
language plpgsql security definer set search_path = public as $$
declare m public.stock_mouvements; n numeric; o uuid;
begin
  if coalesce(c.quantite, 0) <= 0 then return; end if;
  update public.commandes set stock_rendu_le = now() where id = c.id and stock_rendu_le is null;
  if not found then return; end if;   -- déjà rendu
  if c.groupe_id is not null then
    select offre_id into o from public.groupes_achat where id = c.groupe_id;
    if o is not null then perform public._stock_remettre('offre', o, c.quantite); end if;
    return;
  end if;
  if c.negociation_id is null then return; end if;
  select * into m from public.stock_mouvements where negociation_id = c.negociation_id for update;
  if m.negociation_id is null then return; end if;
  n := least(c.quantite, m.pris - m.rendu);
  if n <= 0 then return; end if;
  update public.stock_mouvements set rendu = rendu + n, rendu_le = now(), raison = coalesce(raison, 'commande_annulee')
  where negociation_id = m.negociation_id;
  perform public._stock_remettre(m.cible, m.cible_id, n);
end $$;
revoke all on function public._cmd_rendre_stock(public.commandes) from public, anon, authenticated;

-- 7. Le déclencheur unique : commande annulée sans marchandise partie (pas encore chargée) → le stock revient
create or replace function public._cmd_stock_retour() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etat = 'annulee' and old.etat is distinct from 'annulee'
     and (old.etat = 'a_confirmer' or coalesce(old.etape, 'confirmee') in ('confirmee', 'preparation')) then
    perform public._cmd_rendre_stock(new);
  end if;
  return new;
end $$;
revoke all on function public._cmd_stock_retour() from public, anon, authenticated;
create or replace trigger commandes_stock_retour after update of etat on public.commandes
  for each row execute function public._cmd_stock_retour();

-- 8. Accord sans commande : « sans suite » après le délai, stock rendu (accords conclus depuis ce schéma seulement)
create or replace function public.accords_sans_suite() returns integer
language plpgsql security definer set search_path = public as $$
declare m record; k integer := 0; h integer := public._cmd_regle('accord_sans_suite_heures', 72);
  deb timestamptz := coalesce((select (valeur ->> 'debut')::timestamptz from public.reglages where cle = 'commandes'), now());
begin
  for m in select s.* from public.stock_mouvements s join public.negociations n on n.id = s.negociation_id
      where s.sans_suite_le is null and s.rendu = 0 and s.created_at >= deb and n.statut = 'conclue'
        and coalesce(n.conclu_le, s.created_at) < now() - make_interval(hours => h)
        and not exists (select 1 from public.commandes c where c.negociation_id = s.negociation_id)
      for update of s skip locked loop
    update public.stock_mouvements set sans_suite_le = now(), rendu = pris, rendu_le = now(), raison = 'sans_suite'
    where negociation_id = m.negociation_id;
    perform public._stock_remettre(m.cible, m.cible_id, m.pris);
    k := k + 1;
  end loop;
  return k;
end $$;
revoke all on function public.accords_sans_suite() from public, anon, authenticated;

-- une commande ne se crée plus sur un accord « sans suite » (son stock est déjà revenu sur l'annonce)
create or replace function public._cmd_accord_vivant() returns trigger
language plpgsql security definer set search_path = public as $$
declare s timestamptz;
begin
  if new.negociation_id is not null then
    select sans_suite_le into s from public.stock_mouvements where negociation_id = new.negociation_id for share;
    if s is not null then
      raise exception 'ACCORD_SANS_SUITE : sans commande dans les % h, cet accord a pris fin et le stock est revenu sur l''annonce. Faites une nouvelle proposition.',
        public._cmd_regle('accord_sans_suite_heures', 72);
    end if;
  end if;
  return new;
end $$;
revoke all on function public._cmd_accord_vivant() from public, anon, authenticated;
create or replace trigger commandes_accord_vivant before insert on public.commandes
  for each row execute function public._cmd_accord_vivant();

-- 9. _stock_garde : un message clair au lieu de la correction silencieuse
create or replace function public._stock_garde() returns trigger
language plpgsql security definer set search_path = public as $$
declare vendu boolean;
begin
  if old.quantity is null or current_setting('mdg.stock_rendu', true) = '1' then return new; end if;
  vendu := exists (select 1 from public.negociations n where n.cible = case tg_table_name when 'offres' then 'offre' else 'demande' end
                     and n.cible_id = old.id and n.statut = 'conclue' and coalesce(n.quantite_finale, 0) > 0);
  if not vendu then return new; end if;
  if old.status = 'retiree' and old.quantity <= 0 and coalesce(new.quantity, 0) > old.quantity then
    raise exception 'STOCK_EPUISE : cette annonce est épuisée, tout a été vendu. Pour un nouveau lot, publiez une nouvelle annonce.';
  end if;
  if new.status = 'active' and old.status is distinct from 'active' and coalesce(new.quantity, 0) <= 0 then
    raise exception 'STOCK_VIDE : la quantité est à zéro. Indiquez la quantité disponible avant de remettre l''annonce en ligne.';
  end if;
  return new;
end $$;
revoke all on function public._stock_garde() from public, anon, authenticated;
