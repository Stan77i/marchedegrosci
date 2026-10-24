-- Schéma 85a : niveaux de confiance (chantier 3, décisions 22 à 33). Partie 1 : réglages, tables et calcul.
-- Vendeur fiable, Bon, Excellent, Grand vendeur ; mêmes paliers pour les acheteurs ; badge à part « Acheteur en gros ».
-- Calcul seulement côté serveur, sur les commandes terminées des 12 derniers mois (jamais les annonces ni les annulées).
-- Les seuils sont dans des tables modifiables par l'administrateur (écran Niveaux), sans changer le code.
-- Tables fermées (RLS active, aucun droit pour les visiteurs ni les membres) : personne ne peut s'attribuer un niveau.
-- Testé sur le projet de test, pas encore appliqué en production.

-- 1. Les réglages généraux (valeurs de départ, réglables par l'administrateur)
insert into public.reglages (cle, valeur, maj_le)
values ('niveaux', jsonb_build_object(
  'fenetre_jours', 365, 'grace_jours', 30, 'contestation_jours', 7, 'reponse_jours', 7, 'force_jours', 90,
  'gros_commandes', 5, 'gros_montant', 500000), now())
on conflict (cle) do nothing;

create or replace function public._niv_regle(p_cle text, p_def numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> p_cle)::numeric from public.reglages where cle = 'niveaux'), p_def);
$$;
revoke all on function public._niv_regle(text, numeric) from public, anon, authenticated;

-- 2. Les paliers (un par rôle et par niveau)
create table if not exists public.niveaux_regles (
  role text not null,
  cle text not null,
  ordre integer not null,
  libelle text not null,
  commandes integer not null,
  mois integer not null default 1,
  abus_max numeric not null,
  note_min numeric,
  volume_min numeric,
  code_requis boolean not null default false,
  identite_requise boolean not null default false,
  plafond_partenaire integer,
  maj_le timestamptz not null default now(),
  maj_par uuid,
  constraint niveaux_regles_pk primary key (role, cle),
  constraint niveaux_regles_ordre_unique unique (role, ordre),
  constraint niveaux_regles_check check (
    role in ('vendeur', 'acheteur') and cle in ('fiable', 'bon', 'excellent', 'grand') and ordre between 1 and 4
    and char_length(libelle) between 3 and 40
    and commandes between 1 and 100000 and mois between 1 and 12 and abus_max between 0 and 100
    and (note_min is null or note_min between 1 and 5)
    and (volume_min is null or volume_min between 0 and 100000000000)
    and (plafond_partenaire is null or plafond_partenaire between 1 and 1000))
);
alter table public.niveaux_regles enable row level security;
revoke all on public.niveaux_regles from anon, authenticated;

insert into public.niveaux_regles (role, cle, ordre, libelle, commandes, mois, abus_max, note_min, volume_min, code_requis, identite_requise, plafond_partenaire) values
  ('vendeur', 'fiable', 1, 'Vendeur fiable', 3, 1, 10, null, null, false, false, null),
  ('vendeur', 'bon', 2, 'Bon vendeur', 10, 3, 7, null, null, false, false, null),
  ('vendeur', 'excellent', 3, 'Excellent vendeur', 30, 6, 5, 4.5, null, true, true, 5),
  ('vendeur', 'grand', 4, 'Grand vendeur', 100, 9, 3, null, 25000000, true, true, 5),
  ('acheteur', 'fiable', 1, 'Acheteur fiable', 3, 1, 10, null, null, false, false, null),
  ('acheteur', 'bon', 2, 'Bon acheteur', 10, 3, 7, null, null, false, false, null),
  ('acheteur', 'excellent', 3, 'Excellent acheteur', 30, 6, 5, 4.5, null, true, true, 5),
  ('acheteur', 'grand', 4, 'Grand acheteur', 100, 9, 3, null, 25000000, true, true, 5)
on conflict (role, cle) do nothing;

-- 3. L'état de chaque membre, par rôle (écrit seulement par le serveur)
create table if not exists public.niveaux_membres (
  user_id uuid not null,
  role text not null,
  niveau text,
  depuis timestamptz,
  niveau_calcule text,
  grace_jusqua timestamptz,
  grace_vers text,
  force_niveau text,
  force_jusqua timestamptz,
  gros boolean not null default false,
  gros_depuis timestamptz,
  gros_grace_jusqua timestamptz,
  chiffres jsonb,
  calcule_le timestamptz,
  vu_le timestamptz,
  constraint niveaux_membres_pk primary key (user_id, role),
  constraint niveaux_membres_role_check check (role in ('vendeur', 'acheteur'))
);
alter table public.niveaux_membres enable row level security;
revoke all on public.niveaux_membres from anon, authenticated;

-- 4. L'historique (en ajout seulement)
create table if not exists public.niveaux_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  evenement text not null,
  ancien text,
  nouveau text,
  raison text,
  chiffres jsonb,
  par uuid,
  at timestamptz not null default now(),
  constraint niveaux_journal_check check (role in ('vendeur', 'acheteur')
    and evenement in ('monte', 'grace', 'grace_levee', 'descend', 'retire', 'force', 'force_fin', 'gros', 'gros_grace', 'gros_grace_levee', 'gros_retire')
    and (raison is null or char_length(raison) <= 300))
);
alter table public.niveaux_journal enable row level security;
revoke all on public.niveaux_journal from anon, authenticated;
create index if not exists niveaux_journal_user_idx on public.niveaux_journal (user_id, at desc);
-- l'heure exacte de chaque ligne (plusieurs changements dans la même opération restent dans l'ordre)
alter table public.niveaux_journal alter column at set default clock_timestamp();

create or replace function public._niv_journal_fige()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'L''historique des niveaux ne se modifie pas.';
end $$;
revoke all on function public._niv_journal_fige() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'niveaux_journal_fige') then
    create trigger niveaux_journal_fige before update on public.niveaux_journal for each row execute function public._niv_journal_fige();
  end if;
end $$;

-- 5. Les contestations (une seule ouverte à la fois par membre)
create table if not exists public.niveaux_contestations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null,
  niveau_avant text,
  niveau_actuel text,
  texte text not null,
  statut text not null default 'ouverte',
  reponse text,
  force_niveau text,
  force_jusqua timestamptz,
  decide_par uuid,
  decide_le timestamptz,
  repondre_avant timestamptz not null,
  cree_le timestamptz not null default now(),
  constraint niveaux_contestations_check check (role in ('vendeur', 'acheteur') and statut in ('ouverte', 'acceptee', 'refusee')
    and char_length(texte) between 5 and 300 and (reponse is null or char_length(reponse) <= 300))
);
alter table public.niveaux_contestations enable row level security;
revoke all on public.niveaux_contestations from anon, authenticated;
create unique index if not exists niveaux_contestations_ouverte on public.niveaux_contestations (user_id) where statut = 'ouverte';

-- 6. Le calcul (lecture seule) : les chiffres d'un membre dans un rôle et le niveau atteint
create or replace function public._niv_ordre(p_role text, p_cle text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select ordre from public.niveaux_regles where role = p_role and cle = p_cle), 0);
$$;
revoke all on function public._niv_ordre(text, text) from public, anon, authenticated;

create or replace function public._niv_calculer(p_uid uuid, p_role text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  depuis timestamptz := now() - make_interval(days => public._niv_regle('fenetre_jours', 365)::integer);
  exclu boolean; idok boolean; n_all integer; abus integer; pct numeric; note numeric; navis integer;
  vol_all numeric; mois_all integer; gros_n integer; gros boolean := false;
  r record; n integer; m integer; vol numeric; ok boolean; tous boolean := true; niv text; detail jsonb := '[]'::jsonb;
begin
  exclu := p_uid is null or public.est_banni(p_uid) or public.est_admin_id(p_uid)
           or exists (select 1 from public.profils p where p.user_id = p_uid and p.supprime_le is not null);
  idok := public.identite_ok(p_uid);
  -- commandes comptées : terminées dans la fenêtre, pas entièrement refusées, avec un partenaire ni lui-même ni banni
  with c as (
    select k.termine_le, k.montant - coalesce(k.montant_refuse, 0) valeur
    from public.commandes k
    where k.etat = 'terminee' and k.termine_le >= depuis
      and (case when p_role = 'vendeur' then k.vendeur_id else k.acheteur_id end) = p_uid
      and coalesce(k.montant_refuse, 0) < k.montant and k.vendeur_id <> k.acheteur_id
      and not exists (select 1 from public.bannis b where b.user_id = (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end)))
  select count(*), coalesce(sum(valeur), 0), count(distinct date_trunc('month', termine_le)),
         count(*) filter (where valeur >= public._niv_regle('gros_montant', 500000))
    into n_all, vol_all, mois_all, gros_n from c;
  -- annulations abusives et litiges perdus imputés dans ce rôle (un achat groupé compte une fois) ;
  -- les annulations légitimes, les litiges en cours et les litiges partagés ne comptent pas
  select count(distinct coalesce(a.groupe_id, a.commande_id)) into abus from public.annulations a
  where a.imputable_id = p_uid and a.role_imputable = p_role and a.categorie in ('abusive', 'litige') and a.cree_le >= depuis;
  pct := case when n_all + abus = 0 then 0 else round(abus * 100.0 / (n_all + abus), 1) end;
  -- note : un avis par auteur (le plus récent), donné dans la fenêtre
  select round(avg(z.note)::numeric, 1), count(*) into note, navis from (
    select distinct on (k.auteur_id) k.note from public.avis_commandes k
    where k.cible_id = p_uid and k.role_cible = p_role and k.created_at >= depuis and k.auteur_id <> p_uid
    order by k.auteur_id, k.updated_at desc) z;
  for r in select * from public.niveaux_regles where role = p_role order by ordre loop
    with c as (
      select k.termine_le, k.montant - coalesce(k.montant_refuse, 0) valeur,
        row_number() over (partition by (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end) order by k.termine_le desc) rn
      from public.commandes k
      where k.etat = 'terminee' and k.termine_le >= depuis
        and (case when p_role = 'vendeur' then k.vendeur_id else k.acheteur_id end) = p_uid
        and coalesce(k.montant_refuse, 0) < k.montant and k.vendeur_id <> k.acheteur_id
        and (not r.code_requis or k.validation = 'code')
        and not exists (select 1 from public.bannis b where b.user_id = (case when p_role = 'vendeur' then k.acheteur_id else k.vendeur_id end)))
    select count(*), count(distinct date_trunc('month', termine_le)), coalesce(sum(valeur), 0) into n, m, vol
    from c where r.plafond_partenaire is null or rn <= r.plafond_partenaire;
    ok := not exclu and n >= r.commandes and m >= r.mois and pct <= r.abus_max
          and (r.note_min is null or (note is not null and note >= r.note_min))
          and (r.volume_min is null or vol >= r.volume_min)
          and (not r.identite_requise or idok);
    tous := tous and ok;          -- un niveau demande aussi tous les niveaux d'en dessous
    if tous then niv := r.cle; end if;
    detail := detail || jsonb_build_object('cle', r.cle, 'ordre', r.ordre, 'libelle', r.libelle, 'ok', ok, 'atteint', tous,
      'commandes', n, 'mois', m, 'volume', vol);
  end loop;
  if p_role = 'acheteur' and not exclu then gros := gros_n >= public._niv_regle('gros_commandes', 5); end if;
  return jsonb_build_object('niveau', niv, 'ordre', public._niv_ordre(p_role, niv), 'gros', gros, 'gros_commandes', gros_n,
    'commandes', n_all, 'volume', vol_all, 'mois', mois_all, 'abusives', abus, 'abus_pct', pct, 'note', note, 'avis', navis,
    'identite', idok, 'exclu', exclu, 'fenetre_jours', public._niv_regle('fenetre_jours', 365)::integer, 'detail', detail);
end $$;
revoke all on function public._niv_calculer(uuid, text) from public, anon, authenticated;

-- 7. Appliquer le calcul : montée tout de suite ; descente après une grâce (30 jours) ; historique à chaque changement
create or replace function public._niv_appliquer(p_uid uuid, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r jsonb; cal text; m public.niveaux_membres; oc integer; om integer; ofo integer; gr boolean;
  g interval := make_interval(days => public._niv_regle('grace_jours', 30)::integer);
begin
  if p_uid is null or p_role not in ('vendeur', 'acheteur') then return null; end if;
  r := public._niv_calculer(p_uid, p_role);
  cal := r ->> 'niveau'; gr := coalesce((r ->> 'gros')::boolean, false);
  insert into public.niveaux_membres (user_id, role) values (p_uid, p_role) on conflict (user_id, role) do nothing;
  select * into m from public.niveaux_membres where user_id = p_uid and role = p_role for update;
  oc := public._niv_ordre(p_role, cal); om := public._niv_ordre(p_role, m.niveau);

  -- un niveau tenu par décision de l'équipe (contestation acceptée) : gardé jusqu'à sa date, sauf si le calcul fait mieux
  if m.force_jusqua is not null then
    ofo := public._niv_ordre(p_role, m.force_niveau);
    if m.force_jusqua <= now() or oc > ofo then
      insert into public.niveaux_journal (user_id, role, evenement, ancien, raison, chiffres)
      values (p_uid, p_role, 'force_fin', m.force_niveau, case when oc > ofo then 'Le calcul dépasse le niveau décidé par l''équipe.' else 'Fin du niveau décidé par l''équipe.' end, r);
      update public.niveaux_membres set force_niveau = null, force_jusqua = null, grace_jusqua = null, grace_vers = null, niveau = m.force_niveau
      where user_id = p_uid and role = p_role;
      select * into m from public.niveaux_membres where user_id = p_uid and role = p_role;
      om := public._niv_ordre(p_role, m.niveau);
    end if;
  end if;
  if m.force_jusqua is null then
    if oc > om then
      update public.niveaux_membres set niveau = cal, depuis = now(), grace_jusqua = null, grace_vers = null where user_id = p_uid and role = p_role;
      insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, chiffres) values (p_uid, p_role, 'monte', m.niveau, cal, r);
    elsif oc = om then
      if m.grace_jusqua is not null then
        update public.niveaux_membres set grace_jusqua = null, grace_vers = null where user_id = p_uid and role = p_role;
        insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, chiffres) values (p_uid, p_role, 'grace_levee', m.niveau, m.niveau, r);
      end if;
    else
      if m.grace_jusqua is null then
        update public.niveaux_membres set grace_jusqua = now() + g, grace_vers = cal where user_id = p_uid and role = p_role;
        insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, raison, chiffres)
        values (p_uid, p_role, 'grace', m.niveau, cal, 'Jusqu''au ' || to_char((now() + g) at time zone 'Africa/Abidjan', 'DD/MM/YYYY'), r);
      elsif now() >= m.grace_jusqua then
        update public.niveaux_membres set niveau = cal, depuis = case when cal is null then null else now() end, grace_jusqua = null, grace_vers = null
        where user_id = p_uid and role = p_role;
        insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, chiffres)
        values (p_uid, p_role, case when cal is null then 'retire' else 'descend' end, m.niveau, cal, r);
      elsif m.grace_vers is distinct from cal then
        update public.niveaux_membres set grace_vers = cal where user_id = p_uid and role = p_role;
      end if;
    end if;
  end if;

  -- le badge à part « Acheteur en gros » (même grâce)
  if p_role = 'acheteur' then
    if gr and not m.gros then
      update public.niveaux_membres set gros = true, gros_depuis = now(), gros_grace_jusqua = null where user_id = p_uid and role = p_role;
      insert into public.niveaux_journal (user_id, role, evenement, nouveau, chiffres) values (p_uid, p_role, 'gros', 'gros', r);
    elsif gr and m.gros_grace_jusqua is not null then
      update public.niveaux_membres set gros_grace_jusqua = null where user_id = p_uid and role = p_role;
      insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, chiffres) values (p_uid, p_role, 'gros_grace_levee', 'gros', 'gros', r);
    elsif not gr and m.gros then
      if m.gros_grace_jusqua is null then
        update public.niveaux_membres set gros_grace_jusqua = now() + g where user_id = p_uid and role = p_role;
        insert into public.niveaux_journal (user_id, role, evenement, ancien, raison, chiffres)
        values (p_uid, p_role, 'gros_grace', 'gros', 'Jusqu''au ' || to_char((now() + g) at time zone 'Africa/Abidjan', 'DD/MM/YYYY'), r);
      elsif now() >= m.gros_grace_jusqua then
        update public.niveaux_membres set gros = false, gros_depuis = null, gros_grace_jusqua = null where user_id = p_uid and role = p_role;
        insert into public.niveaux_journal (user_id, role, evenement, ancien, chiffres) values (p_uid, p_role, 'gros_retire', 'gros', r);
      end if;
    end if;
  end if;

  update public.niveaux_membres set niveau_calcule = cal, chiffres = r, calcule_le = now() where user_id = p_uid and role = p_role;
  return cal;
end $$;
revoke all on function public._niv_appliquer(uuid, text) from public, anon, authenticated;

-- 8. Recalcul de tout le monde (tâche planifiée chaque nuit) : membres déjà notés et membres avec une commande dans la fenêtre
create or replace function public.niveaux_recalculer()
returns integer language plpgsql security definer set search_path = public as $$
declare x record; n integer := 0;
  depuis timestamptz := now() - make_interval(days => public._niv_regle('fenetre_jours', 365)::integer);
begin
  for x in
    select user_id, role from public.niveaux_membres
    union select vendeur_id, 'vendeur' from public.commandes where etat = 'terminee' and termine_le >= depuis and vendeur_id is not null
    union select acheteur_id, 'acheteur' from public.commandes where etat = 'terminee' and termine_le >= depuis and acheteur_id is not null
  loop
    begin
      perform public._niv_appliquer(x.user_id, x.role); n := n + 1;
    exception when others then null;   -- un compte en erreur ne bloque pas les autres
    end;
  end loop;
  return n;
end $$;
revoke all on function public.niveaux_recalculer() from public, anon, authenticated;

-- 9. Recalcul aussitôt : fin d'une commande, annulation classée ou requalifiée, avis donné.
--    Jamais bloquant : une erreur du calcul ne doit pas empêcher la commande d'avancer.
create or replace function public._niv_paire(p_vendeur uuid, p_acheteur uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  begin
    if p_vendeur is not null then perform public._niv_appliquer(p_vendeur, 'vendeur'); end if;
    if p_acheteur is not null then perform public._niv_appliquer(p_acheteur, 'acheteur'); end if;
  exception when others then null;
  end;
end $$;
revoke all on function public._niv_paire(uuid, uuid) from public, anon, authenticated;

create or replace function public._niv_declencheur()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'commandes' then
    if new.etat = 'terminee' and old.etat is distinct from 'terminee'
       or (new.etat = 'terminee' and new.montant_refuse is distinct from old.montant_refuse) then
      perform public._niv_paire(new.vendeur_id, new.acheteur_id);
    end if;
  elsif tg_table_name = 'annulations' then
    perform public._niv_paire(new.vendeur_id, new.acheteur_id);
  elsif tg_table_name = 'avis_commandes' then
    begin
      perform public._niv_appliquer(new.cible_id, new.role_cible);
    exception when others then null;
    end;
  end if;
  return new;
end $$;
revoke all on function public._niv_declencheur() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'commandes_niveaux') then
    create trigger commandes_niveaux after update of etat, montant_refuse on public.commandes for each row execute function public._niv_declencheur();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'annulations_niveaux') then
    create trigger annulations_niveaux after insert or update of categorie, imputable_id on public.annulations for each row execute function public._niv_declencheur();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'avis_commandes_niveaux') then
    create trigger avis_commandes_niveaux after insert or update of note on public.avis_commandes for each row execute function public._niv_declencheur();
  end if;
end $$;
