-- Schéma 84a : fiabilité (chantier 2, décisions 11 à 21). Partie 1 : le registre des annulations.
-- Une ligne par commande annulée (clé unique : pas de double pénalité), remplie par un déclencheur sur commandes :
-- les fonctions existantes (commande_annuler, commande_repondre, admin_litige_trancher) ne sont pas réécrites.
-- Le motif et l'accord de l'autre partie arrivent par des fonctions « porte » qui les posent, puis appellent l'ancienne fonction.
-- Pas de rétroactivité : le registre commence vide, le comptage part de la mise en service (réglage « debut »).
-- Testé sur le projet de test, pas encore appliqué en production.

-- 1. Les réglages (valeurs de départ, réglables par l'administrateur sans toucher au code)
insert into public.reglages (cle, valeur, maj_le)
values ('fiabilite', jsonb_build_object(
  'debut', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'fenetre_jours', 90, 'seuil_avertissement', 1, 'seuil_baisse', 3, 'seuil_examen', 5,
  'suspension_jours', 7, 'recidive_jours', 30, 'contestation_jours', 7, 'reponse_jours', 7, 'expiration_heures', 48), now())
on conflict (cle) do nothing;

create or replace function public._fiab_regle(p_cle text, p_def integer)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> p_cle)::integer from public.reglages where cle = 'fiabilite'), p_def);
$$;
create or replace function public._fiab_debut()
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> 'debut')::timestamptz from public.reglages where cle = 'fiabilite'), now());
$$;
revoke all on function public._fiab_regle(text, integer) from public, anon, authenticated;
revoke all on function public._fiab_debut() from public, anon, authenticated;

-- 2. Le motif de la demande d'annulation (en attente de la réponse de l'autre partie)
alter table public.commandes add column if not exists annulation_motif text;
alter table public.commandes add column if not exists annulation_motif_texte text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_annulation_motif_check') then
    alter table public.commandes add constraint commandes_annulation_motif_check check (
      (annulation_motif is null or annulation_motif in ('stock_epuise', 'prix_change', 'sans_reponse', 'erreur_saisie', 'panne_meteo', 'autre'))
      and (annulation_motif_texte is null or char_length(annulation_motif_texte) <= 300));
  end if;
end $$;

-- 3. Le registre des annulations (lu seulement par des fonctions)
create table if not exists public.annulations (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null,
  groupe_id uuid,
  vendeur_id uuid,
  acheteur_id uuid,
  auteur_id uuid,
  demandeur_id uuid,
  imputable_id uuid,
  role_imputable text,
  etat_avant text,
  etape_avant text,
  chemin text not null,
  motif_code text,
  motif_texte text,
  accord boolean,
  categorie text not null,
  categorie_auto text not null,
  decide_par uuid,
  decide_le timestamptz,
  note_admin text,
  cree_le timestamptz not null default now(),
  constraint annulations_commande_unique unique (commande_id),
  constraint annulations_role_check check (role_imputable is null or role_imputable in ('vendeur', 'acheteur')),
  constraint annulations_chemin_check check (chemin in ('retrait', 'refus', 'accord', 'litige', 'expiration', 'autre')),
  constraint annulations_motif_check check (motif_code is null or motif_code in ('stock_epuise', 'prix_change', 'sans_reponse', 'erreur_saisie', 'panne_meteo', 'autre')),
  constraint annulations_textes_check check ((motif_texte is null or char_length(motif_texte) <= 300) and (note_admin is null or char_length(note_admin) <= 300)),
  constraint annulations_categorie_check check (categorie in ('abusive', 'legitime', 'litige', 'technique') and categorie_auto in ('abusive', 'legitime', 'litige', 'technique'))
);
alter table public.annulations enable row level security;
revoke all on public.annulations from anon, authenticated;
create index if not exists annulations_imputable_idx on public.annulations (imputable_id, cree_le);
create index if not exists annulations_vendeur_idx on public.annulations (vendeur_id);
create index if not exists annulations_acheteur_idx on public.annulations (acheteur_id);

-- 4. Les sanctions : avertissement, baisse, examen (automatiques, privées), suspension (décidée par l'administrateur)
create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  annulation_id uuid references public.annulations (id),
  nb_90j integer,
  debut timestamptz not null default now(),
  fin timestamptz,
  motif text,
  par uuid,
  levee_le timestamptz,
  levee_par uuid,
  levee_motif text,
  annonces_rendues_le timestamptz,
  vue_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint sanctions_type_check check (type in ('avertissement', 'baisse', 'examen', 'suspension')),
  constraint sanctions_textes_check check ((motif is null or char_length(motif) <= 300) and (levee_motif is null or char_length(levee_motif) <= 300)),
  constraint sanctions_suspension_check check (type <> 'suspension' or fin is not null)
);
alter table public.sanctions enable row level security;
revoke all on public.sanctions from anon, authenticated;
create unique index if not exists sanctions_annulation_unique on public.sanctions (annulation_id) where annulation_id is not null;
create index if not exists sanctions_user_idx on public.sanctions (user_id, type, fin);

-- 5. Les contestations (une par annulation)
create table if not exists public.contestations (
  id uuid primary key default gen_random_uuid(),
  annulation_id uuid not null references public.annulations (id),
  auteur_id uuid not null,
  texte text not null,
  statut text not null default 'ouverte',
  reponse text,
  decide_par uuid,
  decide_le timestamptz,
  repondre_avant timestamptz not null,
  cree_le timestamptz not null default now(),
  constraint contestations_annulation_unique unique (annulation_id),
  constraint contestations_statut_check check (statut in ('ouverte', 'acceptee', 'refusee')),
  constraint contestations_textes_check check (char_length(texte) between 5 and 600 and (reponse is null or char_length(reponse) <= 600))
);
alter table public.contestations enable row level security;
revoke all on public.contestations from anon, authenticated;

-- 6. Comptage sur la fenêtre glissante : un achat groupé ne compte qu'une fois
create or replace function public._fiab_n90(p_uid uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(distinct coalesce(a.groupe_id, a.commande_id))::integer from public.annulations a
  where a.imputable_id = p_uid and a.categorie = 'abusive'
    and a.cree_le > now() - make_interval(days => public._fiab_regle('fenetre_jours', 90));
$$;
revoke all on function public._fiab_n90(uuid) from public, anon, authenticated;

-- 7. Le palier après une annulation abusive : avertissement, baisse du score, examen (jamais de suspension automatique)
create or replace function public._fiab_paliers(p_uid uuid, p_annulation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n integer; t text; a public.annulations;
begin
  if p_uid is null or p_annulation is null then return; end if;
  select * into a from public.annulations where id = p_annulation;
  -- achat groupé : une seule sanction pour tout le groupe
  if a.groupe_id is not null and exists (select 1 from public.sanctions s join public.annulations b on b.id = s.annulation_id
      where b.groupe_id = a.groupe_id and b.imputable_id = p_uid and b.id <> a.id and s.levee_le is null) then return; end if;
  n := public._fiab_n90(p_uid);
  t := case when n >= public._fiab_regle('seuil_examen', 5) then 'examen'
            when n >= public._fiab_regle('seuil_baisse', 3) then 'baisse'
            when n >= public._fiab_regle('seuil_avertissement', 1) then 'avertissement' end;
  if t is null then return; end if;
  insert into public.sanctions (user_id, type, annulation_id, nb_90j)
  values (p_uid, t, p_annulation, n)
  on conflict (annulation_id) where annulation_id is not null
  do update set levee_le = null, levee_par = null, levee_motif = null, nb_90j = excluded.nb_90j, type = excluded.type;
end $$;
revoke all on function public._fiab_paliers(uuid, uuid) from public, anon, authenticated;

-- 8. Le déclencheur : chaque passage à « annulee » écrit une ligne, classée par une règle simple
--   retrait ou refus avant confirmation, expiration sans réponse : légitime, imputée à personne ;
--   annulation après confirmation : légitime si l'autre partie accepte le motif (commun accord), sinon abusive pour le demandeur ;
--   litige tranché « annulée » : catégorie litige, imputée à la partie désignée par l'administrateur (ou à personne).
create or replace function public._fiab_annulation()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ch text; dem uuid; imp uuid; cat text; mc text; mt text; acc boolean; aid uuid; f text;
begin
  if new.etat <> 'annulee' or old.etat = 'annulee' then return new; end if;
  mc := nullif(current_setting('mdg.fiab_motif', true), '');
  mt := nullif(current_setting('mdg.fiab_motif_texte', true), '');
  acc := nullif(current_setting('mdg.fiab_accord', true), '')::boolean;
  f := nullif(current_setting('mdg.fiab_fautif', true), '');
  if current_setting('mdg.fiab_chemin', true) = 'expiration' then
    ch := 'expiration'; dem := null; imp := null; cat := 'legitime'; mc := 'sans_reponse'; mt := null;
  elsif old.etat = 'a_confirmer' then
    ch := case when me is not null and me = old.cree_par then 'retrait' when me is not null then 'refus' else 'expiration' end;
    dem := me; imp := null; cat := 'legitime';
  elsif old.etat = 'litige' then
    ch := 'litige'; dem := old.litige_par; cat := 'litige';
    imp := case when f is not null and f::uuid in (old.vendeur_id, old.acheteur_id) then f::uuid end;
  elsif old.etat = 'en_cours' then
    ch := 'accord'; dem := old.annulation_par;
    mc := coalesce(old.annulation_motif, mc); mt := coalesce(old.annulation_motif_texte, mt);
    if acc is true then cat := 'legitime'; imp := null; else cat := 'abusive'; imp := dem; end if;
  else
    ch := 'autre'; dem := me; imp := null; cat := 'legitime';
  end if;
  insert into public.annulations (commande_id, groupe_id, vendeur_id, acheteur_id, auteur_id, demandeur_id, imputable_id, role_imputable,
    etat_avant, etape_avant, chemin, motif_code, motif_texte, accord, categorie, categorie_auto)
  values (new.id, new.groupe_id, new.vendeur_id, new.acheteur_id, me, dem, imp,
    case when imp is null then null when imp = new.vendeur_id then 'vendeur' else 'acheteur' end,
    old.etat, old.etape, ch, mc, left(mt, 300), acc, cat, cat)
  on conflict (commande_id) do nothing
  returning id into aid;
  if aid is not null and cat = 'abusive' and imp is not null then perform public._fiab_paliers(imp, aid); end if;
  return new;
end $$;
revoke all on function public._fiab_annulation() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'commandes_fiabilite' and tgrelid = 'public.commandes'::regclass) then
    create trigger commandes_fiabilite after update of etat on public.commandes
      for each row execute function public._fiab_annulation();
  end if;
end $$;

-- 9. Les portes : motif obligatoire à l'écran, puis appel de la fonction existante (signatures inchangées)
create or replace function public._fiab_motif_ok(p_motif text, p_texte text)
returns text language plpgsql stable set search_path = public as $$
declare t text;
begin
  if p_motif is null or p_motif not in ('stock_epuise', 'prix_change', 'sans_reponse', 'erreur_saisie', 'panne_meteo', 'autre') then
    raise exception 'Choisissez un motif.';
  end if;
  t := public._cmd_texte(p_texte, 300);
  if p_motif = 'autre' and (t is null or char_length(t) < 3) then raise exception 'Motif « autre » : écrivez quelques mots.'; end if;
  return t;
end $$;
revoke all on function public._fiab_motif_ok(text, text) from public, anon, authenticated;

create or replace function public._fiab_poser(p_motif text, p_texte text, p_accord boolean, p_fautif uuid, p_chemin text)
returns void language sql set search_path = public as $$
  select set_config('mdg.fiab_motif', coalesce(p_motif, ''), true), set_config('mdg.fiab_motif_texte', coalesce(p_texte, ''), true),
         set_config('mdg.fiab_accord', coalesce(p_accord::text, ''), true), set_config('mdg.fiab_fautif', coalesce(p_fautif::text, ''), true),
         set_config('mdg.fiab_chemin', coalesce(p_chemin, ''), true);
$$;
revoke all on function public._fiab_poser(text, text, boolean, uuid, text) from public, anon, authenticated;

-- retirer (avant confirmation), demander, accepter (avec ou sans accord sur le motif) ou refuser une annulation
create or replace function public.commande_annuler_motif(p_id uuid, p_oui boolean default true, p_note text default null,
  p_motif text default null, p_motif_texte text default null, p_accord boolean default null)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t text; r text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  if c.id is null or me not in (c.vendeur_id, c.acheteur_id) then raise exception 'Commande introuvable.'; end if;
  if c.etat = 'a_confirmer' or (c.etat = 'en_cours' and p_oui and c.annulation_par is null) then
    t := public._fiab_motif_ok(p_motif, p_motif_texte);
    perform public._fiab_poser(p_motif, t, null, null, null);
  elsif c.etat = 'en_cours' and p_oui and c.annulation_par is not null and c.annulation_par <> me then
    if p_accord is null then raise exception 'Dites si vous êtes d''accord avec le motif.'; end if;
    perform public._fiab_poser(null, null, p_accord, null, null);
  end if;
  r := public.commande_annuler(p_id, p_oui, p_note);
  if r = 'annulation_demandee' then
    update public.commandes set annulation_motif = p_motif, annulation_motif_texte = t where id = p_id;
  elsif r = 'en_cours' then
    update public.commandes set annulation_motif = null, annulation_motif_texte = null where id = p_id;
  end if;
  perform public._fiab_poser(null, null, null, null, null);
  return r;
end $$;
revoke all on function public.commande_annuler_motif(uuid, boolean, text, text, text, boolean) from public, anon;
grant execute on function public.commande_annuler_motif(uuid, boolean, text, text, text, boolean) to authenticated;

-- refuser une commande proposée (avant confirmation : ne compte pas, mais le motif est noté)
create or replace function public.commande_repondre_motif(p_id uuid, p_oui boolean, p_note text default null,
  p_motif text default null, p_motif_texte text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  if not p_oui then
    t := public._fiab_motif_ok(p_motif, p_motif_texte);
    perform public._fiab_poser(p_motif, t, null, null, null);
  end if;
  perform public.commande_repondre(p_id, p_oui, p_note);
  perform public._fiab_poser(null, null, null, null, null);
end $$;
revoke all on function public.commande_repondre_motif(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.commande_repondre_motif(uuid, boolean, text, text, text) to authenticated;

-- litige tranché par l'administrateur, en désignant (ou non) la partie fautive ; l'ancienne fonction reste pour l'ancien écran
create or replace function public.admin_litige_trancher2(p_cmd uuid, p_issue text, p_note text, p_fautif uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.commandes;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where id = p_cmd;
  if p_fautif is not null and (c.id is null or p_fautif not in (c.vendeur_id, c.acheteur_id)) then
    raise exception 'La partie fautive doit être le vendeur ou l''acheteur.';
  end if;
  perform public._fiab_poser(null, null, null, p_fautif, null);
  perform public.admin_litige_trancher(p_cmd, p_issue, p_note);
  perform public._fiab_poser(null, null, null, null, null);
end $$;
revoke all on function public.admin_litige_trancher2(uuid, text, text, uuid) from public, anon;
grant execute on function public.admin_litige_trancher2(uuid, text, text, uuid) to authenticated;

-- le motif d'une demande d'annulation en attente, pour l'autre partie qui doit répondre
create or replace function public.commande_annulation_motif(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('motif', c.annulation_motif, 'texte', c.annulation_motif_texte,
    'par', case when c.annulation_par = auth.uid() then 'moi' when c.annulation_par is not null then 'autre' end)
  from public.commandes c where c.id = p_id and auth.uid() in (c.vendeur_id, c.acheteur_id);
$$;
revoke all on function public.commande_annulation_motif(uuid) from public, anon;
grant execute on function public.commande_annulation_motif(uuid) to authenticated;

-- 10. Commande sans réponse : elle expire après 48 h (réglable) et ne compte contre personne
create or replace function public.commandes_expirer()
returns integer language plpgsql security definer set search_path = public as $$
declare c record; n integer := 0;
begin
  perform public._fiab_poser(null, null, null, null, 'expiration');
  for c in select id from public.commandes where etat = 'a_confirmer'
      and created_at < now() - make_interval(hours => public._fiab_regle('expiration_heures', 48)) for update skip locked loop
    update public.commandes set etat = 'annulee' where id = c.id;
    perform public._cmd_journal(c.id, 'annulee', null, 'systeme', 'auto', null, null, null, format('Sans réponse en %s h : la commande a expiré. Elle ne compte contre personne.', public._fiab_regle('expiration_heures', 48)));
    n := n + 1;
  end loop;
  perform public._fiab_poser(null, null, null, null, null);
  return n;
end $$;
revoke all on function public.commandes_expirer() from public, anon, authenticated;
