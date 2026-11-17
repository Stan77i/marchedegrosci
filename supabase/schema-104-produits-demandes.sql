-- Schéma 104 : demander un nouveau produit (ou un nom local), réponse de l'équipe, produits ajoutés sans code,
-- mots cherchés sans résultat (règles validées par le propriétaire, « ok pour tout », 17/11/2026).
--
-- 1. Un membre connecté demande un produit absent du catalogue : nom et famille obligatoires, unité et nom local facultatifs.
--    3 demandes en attente au plus par membre (PRODUIT_LIMITE). Nom de 2 à 60 caractères, sans numéro, lien ni nom réservé.
--    Une demande identique déjà en attente (nom normalisé : minuscules, sans accents, espaces réduits) n'est pas doublée :
--    le membre dit « Moi aussi » (produits_demandes_soutiens).
-- 2. Il peut aussi proposer un nom local pour un produit existant (type 'alias').
-- 3. L'équipe répond (délai affiché : reglages.produits.reponse_heures, 72 h par défaut) par trois gestes, chacun avec un motif
--    et noté dans admin_journal (même écriture que les portes du schéma 100c, _adm_noter) :
--    admin_produit_accepter (crée le produit dans produits_ajoutes), admin_produit_fusionner (le nom devient un nom local d'un
--    produit existant), admin_produit_refuser (motif lu par le membre).
-- 4. produits_ajoutes est lisible par tous (l'application l'ajoute à son catalogue au démarrage) ; seules les fonctions de
--    l'équipe y écrivent.
-- 5. Le demandeur et ceux qui ont dit « Moi aussi » sont prévenus (catégorie transactionnelle « produits », textes dans
--    « pousser » v31) ; la notification ouvre Publier avec le produit choisi.
-- 6. recherches_vides : les mots cherchés sans résultat, comptés sans aucune donnée personnelle (mot normalisé, nombre, dates).
-- Rien n'est effacé ni supprimé par ce schéma. Il peut être rejoué.
-- Appliqué sur le projet de TEST le 17/11/2026. Production : avec l'accord du propriétaire.

-- 0. outils
create or replace function public._produit_norm(t text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(
    translate(replace(replace(lower(coalesce(t, '')), 'œ', 'oe'), 'æ', 'ae'), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ’''-', 'aaaaaaceeeeiiiinooooouuuuyy   '),
    '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g'));
$$;

create or replace function public._produit_famille_ok(f text)
returns boolean language sql immutable set search_path = public as $$
  select f in ('cereales-et-riz-local', 'tubercules-et-feculents', 'legumes-et-fruits', 'viande-de-brousse', 'viandes-et-abats',
               'poissons', 'volaille', 'oeufs', 'produits-surgeles', 'assaisonnements-epices-condiments',
               'arachide-noix-et-oleagineux', 'autres-produits-vivriers');
$$;

-- 1. les tables
create table if not exists public.produits_demandes (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'produit' check (type in ('produit', 'alias')),
  user_id uuid not null references auth.users (id),
  nom text not null check (char_length(nom) between 2 and 60),
  nom_norm text not null,
  famille text check (famille is null or public._produit_famille_ok(famille)),
  unite text check (unite is null or char_length(unite) <= 20),
  nom_local text check (nom_local is null or char_length(nom_local) <= 60),
  produit_slug text check (produit_slug is null or produit_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(produit_slug) <= 80),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'ajoute', 'existant', 'refuse')),
  motif text check (motif is null or char_length(motif) <= 300),
  decide_le timestamptz,
  decide_par uuid,
  cree_le timestamptz not null default now(),
  check (type = 'alias' and produit_slug is not null or type = 'produit' and famille is not null)
);
create unique index if not exists produits_demandes_une_attente
  on public.produits_demandes (type, nom_norm, coalesce(produit_slug, '')) where statut = 'en_attente';
create index if not exists produits_demandes_user on public.produits_demandes (user_id, statut);
alter table public.produits_demandes enable row level security;
revoke all on public.produits_demandes from anon, authenticated;

create table if not exists public.produits_demandes_soutiens (
  demande_id uuid not null references public.produits_demandes (id),
  user_id uuid not null references auth.users (id),
  cree_le timestamptz not null default now(),
  primary key (demande_id, user_id)
);
create index if not exists produits_demandes_soutiens_user on public.produits_demandes_soutiens (user_id);
alter table public.produits_demandes_soutiens enable row level security;
revoke all on public.produits_demandes_soutiens from anon, authenticated;

-- type 'produit' : un produit nouveau (nom et famille) ; type 'alias' : des noms locaux d'un produit du catalogue de l'application
create table if not exists public.produits_ajoutes (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  type text not null default 'produit' check (type in ('produit', 'alias')),
  nom text check (nom is null or char_length(nom) between 2 and 60),
  famille text check (famille is null or public._produit_famille_ok(famille)),
  unite text check (unite is null or char_length(unite) <= 20),
  alias text[] not null default '{}',
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  cree_par uuid,
  demande_id uuid references public.produits_demandes (id),
  check (type = 'alias' or nom is not null and famille is not null)
);
alter table public.produits_ajoutes enable row level security;
revoke all on public.produits_ajoutes from anon, authenticated;
grant select on public.produits_ajoutes to anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'produits_ajoutes' and policyname = 'produits_ajoutes_lire') then
    create policy produits_ajoutes_lire on public.produits_ajoutes for select using (actif);
  end if;
end $$;

create table if not exists public.recherches_vides (
  mot text primary key check (char_length(mot) between 2 and 60),
  n integer not null default 1,
  premier_le timestamptz not null default now(),
  dernier_le timestamptz not null default now()
);
alter table public.recherches_vides enable row level security;
revoke all on public.recherches_vides from anon, authenticated;

-- réglage du délai de réponse de l'équipe (affiché à l'équipe ; rien d'automatique)
insert into public.reglages (cle, valeur) values ('produits', '{"reponse_heures": 72}'::jsonb) on conflict (cle) do nothing;

-- catégorie de notification transactionnelle (pas de réglage par catégorie depuis le schéma 91)
insert into public.notif_categories (cat, nature, coupable, libelle, aide, ordre)
values ('produits', 'trans', false, 'Mes demandes de produit', 'Réponse de l''équipe à vos demandes de produit.', null)
on conflict (cat) do nothing;

-- 2. côté membre
-- une demande identique en attente ? (pour le bouton « Moi aussi ») ; rien de personnel n'est renvoyé
create or replace function public.produit_demande_trouver(p_nom text, p_type text default 'produit', p_slug text default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.produits_demandes;
begin
  if me is null then return null; end if;
  select * into d from public.produits_demandes x
  where x.statut = 'en_attente' and x.type = coalesce(p_type, 'produit') and x.nom_norm = public._produit_norm(p_nom)
    and coalesce(x.produit_slug, '') = coalesce(case when p_type = 'alias' then p_slug end, '');
  if d.id is null then return null; end if;
  return json_build_object('id', d.id, 'nom', d.nom, 'famille', d.famille,
    'soutiens', 1 + (select count(*) from public.produits_demandes_soutiens s where s.demande_id = d.id),
    'moi', d.user_id = me or exists (select 1 from public.produits_demandes_soutiens s where s.demande_id = d.id and s.user_id = me));
end $$;

create or replace function public.produit_moi_aussi(p_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d public.produits_demandes;
begin
  if me is null then raise exception 'NON_CONNECTE : connectez-vous pour demander un produit.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte ne peut plus faire de demande.'; end if;
  select * into d from public.produits_demandes where id = p_id for update;
  if d.id is null or d.statut <> 'en_attente' then raise exception 'DEMANDE_FERMEE : cette demande a déjà reçu une réponse.'; end if;
  if d.user_id <> me then
    insert into public.produits_demandes_soutiens (demande_id, user_id) values (d.id, me) on conflict do nothing;
  end if;
  return json_build_object('id', d.id, 'moi_aussi', true,
    'soutiens', 1 + (select count(*) from public.produits_demandes_soutiens s where s.demande_id = d.id));
end $$;

create or replace function public.produit_demander(p_nom text, p_famille text default null, p_unite text default null,
  p_nom_local text default null, p_type text default 'produit', p_slug text default null)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')); t text := coalesce(p_type, 'produit');
  nl text := nullif(btrim(regexp_replace(coalesce(p_nom_local, ''), '\s+', ' ', 'g')), ''); u text := nullif(btrim(coalesce(p_unite, '')), '');
  r text; ex uuid; nid uuid;
begin
  if me is null then raise exception 'NON_CONNECTE : connectez-vous pour demander un produit.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte ne peut plus faire de demande.'; end if;
  if t not in ('produit', 'alias') then raise exception 'TYPE_INCONNU : type de demande inconnu.'; end if;
  if char_length(n) < 2 or char_length(n) > 60 or public._produit_norm(n) !~ '[a-z]{2}' then
    raise exception 'NOM_INVALIDE : écrivez le nom du produit (2 à 60 lettres).'; end if;
  if nl is not null and char_length(nl) > 60 then raise exception 'NOM_INVALIDE : le nom local fait 60 lettres au plus.'; end if;
  r := coalesce(public.texte_refus(n), public.texte_refus(nl));
  if r is not null then raise exception 'TEXTE_REFUSE : %', r; end if;
  if public._nom_reserve(n) or public._nom_reserve(nl) then raise exception 'NOM_RESERVE : ce nom ne peut pas être un produit.'; end if;
  if t = 'produit' and not public._produit_famille_ok(p_famille) then raise exception 'FAMILLE : choisissez la famille du produit.'; end if;
  if t = 'alias' and (p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80) then
    raise exception 'PRODUIT : choisissez le produit.'; end if;
  if u is not null and (char_length(u) > 20 or u !~ '^[[:alpha:] ]+$') then raise exception 'UNITE : unité inconnue.'; end if;
  -- la même demande attend déjà : « Moi aussi », pas de doublon
  select x.id into ex from public.produits_demandes x
  where x.statut = 'en_attente' and x.type = t and x.nom_norm = public._produit_norm(n)
    and coalesce(x.produit_slug, '') = coalesce(case when t = 'alias' then p_slug end, '');
  if ex is not null then return public.produit_moi_aussi(ex); end if;
  perform pg_advisory_xact_lock(hashtext('produit_demande:' || me::text));
  if (select count(*) from public.produits_demandes x where x.user_id = me and x.statut = 'en_attente') >= 3 then
    raise exception 'PRODUIT_LIMITE : vous avez déjà 3 demandes en attente. Attendez la réponse de l''équipe.'; end if;
  insert into public.produits_demandes (type, user_id, nom, nom_norm, famille, unite, nom_local, produit_slug)
  values (t, me, n, public._produit_norm(n), case when t = 'produit' then p_famille end, u, nl, case when t = 'alias' then p_slug end)
  returning id into nid;
  return json_build_object('id', nid, 'moi_aussi', false, 'soutiens', 1);
end $$;

-- mes demandes, et celles où j'ai dit « Moi aussi » (Activité)
create or replace function public.mes_produits_demandes()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', d.id, 'type', d.type, 'nom', d.nom, 'famille', d.famille, 'statut', d.statut,
      'motif', case when d.statut <> 'en_attente' then d.motif end, 'produit_slug', d.produit_slug, 'cree_le', d.cree_le,
      'decide_le', d.decide_le, 'moi_aussi', d.user_id <> auth.uid(),
      'soutiens', 1 + (select count(*) from public.produits_demandes_soutiens s where s.demande_id = d.id))
    order by d.cree_le desc), '[]'::json)
  from public.produits_demandes d
  where auth.uid() is not null
    and (d.user_id = auth.uid() or exists (select 1 from public.produits_demandes_soutiens s where s.demande_id = d.id and s.user_id = auth.uid()))
    and (d.statut = 'en_attente' or d.decide_le > now() - interval '90 days');
$$;

-- un mot cherché sans résultat (appelé au plus une fois par mot et par session) : aucune donnée personnelle
create or replace function public.recherche_vide(p_mot text)
returns void language plpgsql security definer set search_path = public as $$
declare m text := btrim(regexp_replace(public._produit_norm(left(coalesce(p_mot, ''), 120)), '[0-9]+', ' ', 'g'));
begin
  -- les quantités et les unités ne sont pas des produits (« zaban 25 kg » → « zaban »)
  m := regexp_replace(m, '\m(kg|kgs|kilos?|g|gr|t|tonnes?|sacs?|cartons?|litres?|l|de|du|des|d)\M', ' ', 'g');
  m := btrim(regexp_replace(m, '\s+', ' ', 'g'));
  if char_length(m) < 2 or char_length(m) > 60 or m !~ '[a-z]{2}' or public.texte_refus(p_mot) is not null then return; end if;
  insert into public.recherches_vides as r (mot) values (m)
  on conflict (mot) do update set n = r.n + 1, dernier_le = now();
end $$;

-- 3. côté équipe
create or replace function public.admin_produits_demandes()
returns json language plpgsql stable security definer set search_path = public as $$
declare h int;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration'; end if;
  h := coalesce((select (r.valeur ->> 'reponse_heures')::int from public.reglages r where r.cle = 'produits'), 72);
  return json_build_object('reponse_heures', h,
    'demandes', coalesce((select json_agg(json_build_object('id', d.id, 'type', d.type, 'nom', d.nom, 'famille', d.famille, 'unite', d.unite,
        'nom_local', d.nom_local, 'produit_slug', d.produit_slug, 'statut', d.statut, 'motif', d.motif, 'cree_le', d.cree_le,
        'decide_le', d.decide_le, 'echeance', d.cree_le + make_interval(hours => h),
        'soutiens', 1 + (select count(*) from public.produits_demandes_soutiens s where s.demande_id = d.id),
        'qui', coalesce(nullif(left(btrim(coalesce(p.prenom, p.pseudo, '')), 1), ''), '?'), 'ville', p.ville)
      order by (d.statut = 'en_attente') desc, d.cree_le)
      from public.produits_demandes d left join public.profils p on p.user_id = d.user_id
      where d.statut = 'en_attente' or d.decide_le > now() - interval '30 days'), '[]'::json),
    'vides', coalesce((select json_agg(json_build_object('mot', v.mot, 'n', v.n, 'dernier_le', v.dernier_le) order by v.n desc, v.dernier_le desc)
      from (select * from public.recherches_vides order by n desc, dernier_le desc limit 30) v), '[]'::json),
    'ajoutes', coalesce((select json_agg(a.slug) from public.produits_ajoutes a), '[]'::json));
end $$;

-- prévenir le demandeur et ceux qui ont dit « Moi aussi » (un avis raté ne bloque jamais la décision)
create or replace function public._produit_avis(d public.produits_demandes, p_type text, p_slug text, p_nom text)
returns int language plpgsql security definer set search_path = public as $$
declare u uuid; n int := 0;
begin
  for u in select d.user_id union select s.user_id from public.produits_demandes_soutiens s where s.demande_id = d.id loop
    begin
      n := n + public._notif_mettre(u, 'produits', p_type, 'prod:' || d.id || ':' || u, 'prod:' || d.id, null, p_slug, p_nom,
        case when p_slug is not null and p_type <> 'produit_refuse' then 'application.dc.html#/publier?produit=' || p_slug else 'application.dc.html#/' end,
        jsonb_build_object('demande', d.id, 'nom', d.nom, 'motif', left(coalesce(d.motif, ''), 120)));
    exception when others then null;
    end;
  end loop;
  return n;
end $$;
revoke all on function public._produit_avis(public.produits_demandes, text, text, text) from public, anon, authenticated;

create or replace function public.admin_produit_accepter(p_id uuid, p_slug text, p_nom text, p_famille text, p_unite text default null,
  p_alias text[] default null, p_motif text default null)
returns json language plpgsql security definer set search_path = public as $$
declare d public.produits_demandes; s text; n text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g')); al text[]; res json; nb int;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration'; end if;
  if char_length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'MOTIF : écrivez la raison en quelques mots.'; end if;
  select * into d from public.produits_demandes where id = p_id for update;
  if d.id is null or d.statut <> 'en_attente' then raise exception 'DEMANDE_FERMEE : cette demande a déjà reçu une réponse.'; end if;
  if d.type <> 'produit' then raise exception 'TYPE : un nom local se rattache à un produit (« C''est déjà un produit »).'; end if;
  if char_length(n) < 2 or char_length(n) > 60 then raise exception 'NOM_INVALIDE : nom de 2 à 60 lettres.'; end if;
  if not public._produit_famille_ok(p_famille) then raise exception 'FAMILLE : famille inconnue.'; end if;
  s := coalesce(nullif(btrim(p_slug), ''), replace(public._produit_norm(n), ' ', '-'));
  if s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(s) > 80 then raise exception 'SLUG : identifiant invalide (lettres, chiffres et tirets).'; end if;
  if exists (select 1 from public.produits_ajoutes a where a.slug = s) then raise exception 'SLUG_PRIS : ce produit existe déjà (%).', s; end if;
  select coalesce(array_agg(distinct x), '{}') into al from (
    select btrim(x) x from unnest(coalesce(p_alias, '{}') || array[d.nom_local]) x where btrim(coalesce(x, '')) <> ''
      and public._produit_norm(x) <> public._produit_norm(n) and char_length(btrim(x)) <= 60) z;
  insert into public.produits_ajoutes (slug, type, nom, famille, unite, alias, cree_par, demande_id)
  values (s, 'produit', n, p_famille, nullif(btrim(coalesce(p_unite, '')), ''), al, auth.uid(), d.id);
  update public.produits_demandes set statut = 'ajoute', produit_slug = s, motif = left(btrim(p_motif), 300), decide_le = now(), decide_par = auth.uid()
  where id = d.id returning * into d;
  nb := public._produit_avis(d, 'produit_ajoute', s, n);
  res := json_build_object('slug', s, 'nom', n, 'prevenus', nb);
  perform public._adm_noter('admin_produit_accepter', jsonb_build_object('p_id', p_id, 'p_slug', s, 'p_nom', n, 'p_famille', p_famille,
    'p_unite', p_unite, 'p_alias', al, 'p_motif', p_motif), null, res::jsonb);
  return res;
end $$;

-- « C'est déjà un produit » : le nom demandé devient un nom local du produit choisi (ou, pour une demande de nom local, il est accepté)
create or replace function public.admin_produit_fusionner(p_id uuid, p_slug text, p_motif text default null)
returns json language plpgsql security definer set search_path = public as $$
declare d public.produits_demandes; s text := btrim(coalesce(p_slug, '')); res json; nb int; nv text[];
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration'; end if;
  if char_length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'MOTIF : écrivez la raison en quelques mots.'; end if;
  select * into d from public.produits_demandes where id = p_id for update;
  if d.id is null or d.statut <> 'en_attente' then raise exception 'DEMANDE_FERMEE : cette demande a déjà reçu une réponse.'; end if;
  if s !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(s) > 80 then raise exception 'PRODUIT : choisissez le produit existant.'; end if;
  nv := array_remove(array[d.nom, d.nom_local], null);
  insert into public.produits_ajoutes as a (slug, type, alias, cree_par, demande_id)
  values (s, 'alias', nv, auth.uid(), d.id)
  on conflict (slug) do update set alias = (select coalesce(array_agg(distinct x), '{}') from unnest(a.alias || excluded.alias) x), actif = true;
  update public.produits_demandes set statut = case when d.type = 'alias' then 'ajoute' else 'existant' end, produit_slug = s,
    motif = left(btrim(p_motif), 300), decide_le = now(), decide_par = auth.uid()
  where id = d.id returning * into d;
  nb := public._produit_avis(d, case when d.type = 'alias' then 'alias_ajoute' else 'produit_existant' end, s, d.nom);
  res := json_build_object('slug', s, 'statut', d.statut, 'prevenus', nb);
  perform public._adm_noter('admin_produit_fusionner', jsonb_build_object('p_id', p_id, 'p_slug', s, 'p_motif', p_motif), null, res::jsonb);
  return res;
end $$;

create or replace function public.admin_produit_refuser(p_id uuid, p_motif text)
returns json language plpgsql security definer set search_path = public as $$
declare d public.produits_demandes; res json; nb int;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration'; end if;
  if char_length(btrim(coalesce(p_motif, ''))) < 3 then raise exception 'MOTIF : écrivez la raison en quelques mots. Le membre la lira.'; end if;
  select * into d from public.produits_demandes where id = p_id for update;
  if d.id is null or d.statut <> 'en_attente' then raise exception 'DEMANDE_FERMEE : cette demande a déjà reçu une réponse.'; end if;
  update public.produits_demandes set statut = 'refuse', motif = left(btrim(p_motif), 300), decide_le = now(), decide_par = auth.uid()
  where id = d.id returning * into d;
  nb := public._produit_avis(d, 'produit_refuse', d.produit_slug, d.nom);
  res := json_build_object('statut', 'refuse', 'prevenus', nb);
  perform public._adm_noter('admin_produit_refuser', jsonb_build_object('p_id', p_id, 'p_motif', p_motif), null, res::jsonb);
  return res;
end $$;

-- 4. droits
revoke all on function public.produit_demande_trouver(text, text, text) from public, anon;
revoke all on function public.produit_moi_aussi(uuid) from public, anon;
revoke all on function public.produit_demander(text, text, text, text, text, text) from public, anon;
revoke all on function public.mes_produits_demandes() from public, anon;
revoke all on function public.admin_produits_demandes() from public, anon;
revoke all on function public.admin_produit_accepter(uuid, text, text, text, text, text[], text) from public, anon;
revoke all on function public.admin_produit_fusionner(uuid, text, text) from public, anon;
revoke all on function public.admin_produit_refuser(uuid, text) from public, anon;
grant execute on function public.produit_demande_trouver(text, text, text), public.produit_moi_aussi(uuid),
  public.produit_demander(text, text, text, text, text, text), public.mes_produits_demandes(), public.admin_produits_demandes(),
  public.admin_produit_accepter(uuid, text, text, text, text, text[], text), public.admin_produit_fusionner(uuid, text, text),
  public.admin_produit_refuser(uuid, text) to authenticated;
revoke all on function public.recherche_vide(text) from public;
grant execute on function public.recherche_vide(text) to anon, authenticated;
