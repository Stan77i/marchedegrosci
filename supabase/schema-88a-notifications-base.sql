-- Schéma 88a : notifications, la base (24/10/2026). Plan : docs/audits/audit-notifications-2026-10-24.md, partie 4.
-- Catégories (transactionnel / commercial), préférences par catégorie, plafonds et heures calmes, journal des envois
-- (anti-doublon par clé unique), ouverture signalée par le téléphone, désactivations, statistiques pour l'administrateur.
-- Toutes les écritures passent par des fonctions security definer (en production, service_role n'écrit pas directement).
-- Fichier sans les mots interdits par le MCP : create ... if not exists, create or replace, add column if not exists.
-- Appliqué sur le projet de test le 24/10/2026 (tests : supabase/tests/notifications-88-scenarios.sql). Appliqué en production le 24/10/2026 (fonctions identiques au test).

-- ───────── 1. Catégories (référence lisible par tous : libellés de l'écran Réglages)
create table if not exists public.notif_categories (
  cat text primary key,
  nature text not null check (nature in ('trans', 'com')),
  coupable boolean not null,
  libelle text not null,
  aide text,
  ordre int
);
alter table public.notif_categories enable row level security;
revoke all on public.notif_categories from anon, authenticated;
grant select on public.notif_categories to anon, authenticated, service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'notif_categories_lire') then
    create policy notif_categories_lire on public.notif_categories for select using (true);
  end if;
end $$;

insert into public.notif_categories (cat, nature, coupable, libelle, aide, ordre) values
  ('reponses',     'trans', false, 'Messages',                      'Quand on vous écrit.', 1),
  ('negociation',  'trans', false, 'Négociations',                  'Prix proposé, accord, refus.', 2),
  ('commande',     'trans', false, 'Commandes et livraisons',       'Chaque étape de vos commandes.', 3),
  ('litige',       'trans', false, 'Litiges',                       'Messages d''un litige en cours.', 4),
  ('securite',     'trans', false, 'Sécurité du compte',            'Alertes de l''équipe.', 5),
  ('essai',        'trans', false, 'Essai',                         null, null),
  ('fiabilite',    'trans', true,  'Fiabilité',                     'Avertissements et contestations.', 6),
  ('niveaux',      'trans', true,  'Niveaux et badges',             'Nouveau niveau, sursis, retrait.', 7),
  ('groupe_suivi', 'trans', true,  'Mes achats groupés',            'Les groupes que vous avez rejoints ou que vous vendez.', 8),
  ('rappel',       'trans', true,  'Mes rappels d''achat',          'Les rappels que vous avez choisis.', 9),
  ('offres',       'com',   true,  'Nouvelles offres',              'Produits suivis, déjà achetés ou de votre région.', 10),
  ('pour_vendeur', 'com',   true,  'Acheteurs pour mes produits',   'Demandes pour ce que vous vendez.', 11),
  ('groupes',      'com',   true,  'Achats groupés ouverts',        'Groupes sur vos produits ou près de vous.', 12),
  ('renouveler',   'com',   true,  'Produits à racheter',           'D''après le rythme de vos commandes.', 13),
  ('conseils',     'com',   true,  'Conseils et prix du marché',    'Un message par jour au plus.', 14)
on conflict (cat) do update set nature = excluded.nature, coupable = excluded.coupable, libelle = excluded.libelle,
  aide = excluded.aide, ordre = excluded.ordre;

-- ───────── 2. Règles réglables par l'administrateur (une seule ligne)
create table if not exists public.notif_regles (
  id int primary key default 1 check (id = 1),
  max_com_jour int not null default 6,
  max_conseils_jour int not null default 1,
  calme_debut int not null default 21,
  calme_fin int not null default 7,
  maj_le timestamptz not null default now()
);
insert into public.notif_regles (id) values (1) on conflict (id) do nothing;
alter table public.notif_regles enable row level security;
revoke all on public.notif_regles from anon, authenticated;
grant select on public.notif_regles to service_role;

-- ───────── 3. Préférences par catégorie (pas de ligne = valeur par défaut)
create table if not exists public.notif_prefs (
  user_id uuid not null,
  cat text not null references public.notif_categories (cat),
  actif boolean not null,
  maj_le timestamptz not null default now(),
  primary key (user_id, cat)
);
alter table public.notif_prefs enable row level security;
revoke all on public.notif_prefs from anon, authenticated;
grant select on public.notif_prefs to service_role;

-- ───────── 4. Journal des envois (une ligne par personne et par événement)
create table if not exists public.notif_journal (
  id bigserial primary key,
  nid uuid not null unique default gen_random_uuid(),
  user_id uuid not null,
  cat text not null references public.notif_categories (cat),
  nature text not null check (nature in ('trans', 'com')),
  type text,
  objet_id text,
  slug text,
  cle text not null unique,
  url text,
  titre text,
  corps text,
  cree_le timestamptz not null default now(),
  envoye_le timestamptz,
  resultat text not null default 'en_cours'
    check (resultat in ('en_cours', 'ok', 'echec', 'aucun_telephone', 'pref', 'plafond', 'calme', 'ignore')),
  telephones int,
  ouvert_le timestamptz,
  ouvert_par text,
  action_le timestamptz,
  action text
);
create index if not exists notif_journal_user_idx on public.notif_journal (user_id, cree_le desc);
create index if not exists notif_journal_cree_idx on public.notif_journal (cree_le);
create index if not exists notif_journal_ouvert_idx on public.notif_journal (ouvert_le) where ouvert_le is not null and action_le is null;
alter table public.notif_journal enable row level security;
revoke all on public.notif_journal from anon, authenticated;
grant select on public.notif_journal to authenticated, service_role;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and policyname = 'notif_journal_moi') then
    create policy notif_journal_moi on public.notif_journal for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ───────── 5. Désactivations (désabonnement, téléphone expiré, préférence coupée, permission retirée)
create table if not exists public.notif_desactivations (
  id bigserial primary key,
  user_id uuid,
  origine text not null check (origine in ('desabonnement', 'deconnexion', 'expire', 'preference', 'permission')),
  cat text,
  quand timestamptz not null default now()
);
create index if not exists notif_desactivations_quand_idx on public.notif_desactivations (quand);
alter table public.notif_desactivations enable row level security;
revoke all on public.notif_desactivations from anon, authenticated;
grant select on public.notif_desactivations to service_role;

-- ───────── 6. La préférence d'une personne pour une catégorie
-- Catégories qui ne se coupent pas : toujours vrai. L'ancien réglage « diffusions » (notif_reglages) vaut pour
-- offres, groupes, pour_vendeur et conseils tant qu'aucune préférence n'est posée pour elles.
create or replace function public._notif_pref(p_user uuid, p_cat text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when not coalesce((select coupable from public.notif_categories where cat = p_cat), true) then true
    when exists (select 1 from public.notif_prefs where user_id = p_user and cat = p_cat)
      then (select actif from public.notif_prefs where user_id = p_user and cat = p_cat)
    when p_cat in ('offres', 'groupes', 'pour_vendeur', 'conseils')
      then coalesce((select diffusions from public.notif_reglages where user_id = p_user), true)
    else true end
$$;
revoke execute on function public._notif_pref(uuid, text) from public, anon, authenticated;

-- heures calmes (heure d'Abidjan = UTC) : rien de commercial
create or replace function public._notif_calme()
returns boolean language sql stable security definer set search_path = public as $$
  select case when r.calme_debut > r.calme_fin
              then extract(hour from now() at time zone 'UTC') >= r.calme_debut or extract(hour from now() at time zone 'UTC') < r.calme_fin
              else extract(hour from now() at time zone 'UTC') >= r.calme_debut and extract(hour from now() at time zone 'UTC') < r.calme_fin end
  from public.notif_regles r where r.id = 1
$$;
revoke execute on function public._notif_calme() from public, anon, authenticated;

-- messages commerciaux du jour (envoyés ou en cours) ; un envoi raté ne compte pas
create or replace function public._notif_com_jour(p_user uuid, p_cat text default null)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.notif_journal
  where user_id = p_user and nature = 'com' and resultat in ('ok', 'en_cours')
    and cree_le >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
    and (p_cat is null or cat = p_cat)
$$;
revoke execute on function public._notif_com_jour(uuid, text) from public, anon, authenticated;

-- ───────── 7. Préparer un envoi (appelé par la fonction Edge « pousser », rôle service)
-- Décide s'il faut envoyer, écrit la ligne du journal (la clé unique empêche les doublons) et rend l'identifiant d'envoi.
create or replace function public.notif_preparer(p_user uuid, p_cat text, p_cle text, p_type text default null,
  p_objet text default null, p_slug text default null, p_url text default null, p_titre text default null, p_corps text default null)
returns json language plpgsql security definer set search_path = public as $$
declare c public.notif_categories; r public.notif_regles; raison text; v_nid uuid; v_cle text := coalesce(nullif(p_cle, ''), 'auto:' || gen_random_uuid());
begin
  if p_user is null then return json_build_object('envoyer', false, 'raison', 'personne'); end if;
  select * into c from public.notif_categories where cat = p_cat;
  if c.cat is null then raise exception 'catégorie inconnue : %', p_cat; end if;
  select * into r from public.notif_regles where id = 1;
  if c.nature = 'com' then
    perform pg_advisory_xact_lock(hashtext('notif:' || p_user::text));
    if exists (select 1 from public.profils p where p.user_id = p_user and p.supprime_le is not null) or public.est_banni(p_user) then raison := 'ignore';
    elsif not public._notif_pref(p_user, p_cat) then raison := 'pref';
    elsif public._notif_calme() then raison := 'calme';
    elsif public._notif_com_jour(p_user) >= r.max_com_jour then raison := 'plafond';
    elsif p_cat = 'conseils' and (public._notif_com_jour(p_user, 'conseils') >= r.max_conseils_jour or public._notif_com_jour(p_user) > 0) then raison := 'plafond';
    end if;
  elsif not public._notif_pref(p_user, p_cat) then raison := 'pref';
  end if;
  insert into public.notif_journal (user_id, cat, nature, type, objet_id, slug, cle, url, titre, corps, resultat)
  values (p_user, p_cat, c.nature, left(p_type, 40), left(p_objet, 80), left(p_slug, 80), left(v_cle, 200), left(p_url, 300),
          left(p_titre, 120), left(p_corps, 300), coalesce(raison, 'en_cours'))
  on conflict (cle) do nothing
  returning nid into v_nid;
  if v_nid is null then return json_build_object('envoyer', false, 'raison', 'doublon'); end if;
  if raison is not null then return json_build_object('envoyer', false, 'raison', raison); end if;
  return json_build_object('envoyer', true, 'nid', v_nid, 'nature', c.nature);
end $$;
revoke execute on function public.notif_preparer(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notif_preparer(uuid, text, text, text, text, text, text, text, text) to service_role;

-- résultat réel de l'envoi (après la réponse du service de notification)
create or replace function public.notif_resultat(p_nid uuid, p_telephones int, p_envoyees int)
returns void language sql security definer set search_path = public as $$
  update public.notif_journal set envoye_le = now(), telephones = coalesce(p_telephones, 0),
    resultat = case when coalesce(p_telephones, 0) = 0 then 'aucun_telephone' when coalesce(p_envoyees, 0) > 0 then 'ok' else 'echec' end
  where nid = p_nid and resultat = 'en_cours';
$$;
revoke execute on function public.notif_resultat(uuid, int, int) from public, anon, authenticated;
grant execute on function public.notif_resultat(uuid, int, int) to service_role;

-- ───────── 8. Ouverture : le téléphone (service worker) ou la liste de Mon espace signale l'identifiant d'envoi.
-- L'identifiant est un uuid aléatoire sans donnée personnelle ; seule la première ouverture compte ; un faux identifiant rend false.
create or replace function public.notif_ouverte(p_nid uuid, p_par text default 'push')
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_nid is null then return false; end if;
  update public.notif_journal set ouvert_le = now(), ouvert_par = case when p_par = 'liste' then 'liste' else 'push' end
  where nid = p_nid and ouvert_le is null and resultat in ('ok', 'en_cours', 'aucun_telephone', 'echec');
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke execute on function public.notif_ouverte(uuid, text) from public;
grant execute on function public.notif_ouverte(uuid, text) to anon, authenticated, service_role;

-- ───────── 9. Désactivations
create or replace function public.notif_desactivation_noter(p_user uuid, p_origine text, p_cat text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notif_desactivations (user_id, origine, cat) values (p_user, p_origine, p_cat);
$$;
revoke execute on function public.notif_desactivation_noter(uuid, text, text) from public, anon, authenticated;
grant execute on function public.notif_desactivation_noter(uuid, text, text) to service_role;

-- se désabonner en laissant une trace (porte autour de push_desabonner, qui reste en service)
create or replace function public.push_quitter(p_endpoint text, p_origine text default 'desabonnement')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if exists (select 1 from public.push_abonnements where endpoint = p_endpoint and user_id = auth.uid()) then
    insert into public.notif_desactivations (user_id, origine)
    values (auth.uid(), case when p_origine = 'deconnexion' then 'deconnexion' else 'desabonnement' end);
  end if;
  perform public.push_desabonner(p_endpoint);
end $$;
revoke execute on function public.push_quitter(text, text) from public, anon;
grant execute on function public.push_quitter(text, text) to authenticated;

-- l'application voit que la permission est passée à « refusée » alors qu'un abonnement existait (une trace par jour au plus)
create or replace function public.notif_permission_retiree()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  -- seulement pour un compte qui a encore un téléphone abonné (sinon, rien à compter : pas de chiffre gonflé)
  if not exists (select 1 from public.push_abonnements where user_id = auth.uid()) then return false; end if;
  if exists (select 1 from public.notif_desactivations where user_id = auth.uid() and origine = 'permission' and quand > now() - interval '1 day') then return false; end if;
  insert into public.notif_desactivations (user_id, origine) values (auth.uid(), 'permission');
  return true;
end $$;
revoke execute on function public.notif_permission_retiree() from public, anon;
grant execute on function public.notif_permission_retiree() to authenticated;

-- ───────── 10. Préférences : lecture et réglage par la personne connectée
create or replace function public.notif_prefs_moi()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('cat', c.cat, 'libelle', c.libelle, 'aide', c.aide, 'nature', c.nature,
           'coupable', c.coupable, 'actif', public._notif_pref(auth.uid(), c.cat)) order by c.ordre), '[]'::json)
  from public.notif_categories c where c.ordre is not null and auth.uid() is not null
$$;
revoke execute on function public.notif_prefs_moi() from public, anon;
grant execute on function public.notif_prefs_moi() to authenticated;

create or replace function public.notif_pref_regler(p_cat text, p_actif boolean)
returns json language plpgsql security definer set search_path = public as $$
declare c public.notif_categories; avant boolean;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into c from public.notif_categories where cat = p_cat and ordre is not null;
  if c.cat is null then raise exception 'Catégorie inconnue.'; end if;
  if not c.coupable then raise exception 'Ces notifications ne se coupent pas : elles concernent vos négociations, commandes ou votre sécurité.'; end if;
  if p_actif is null then raise exception 'Choisissez oui ou non.'; end if;
  avant := public._notif_pref(auth.uid(), p_cat);
  insert into public.notif_prefs (user_id, cat, actif) values (auth.uid(), p_cat, p_actif)
  on conflict (user_id, cat) do update set actif = excluded.actif, maj_le = now();
  if avant and not p_actif then insert into public.notif_desactivations (user_id, origine, cat) values (auth.uid(), 'preference', p_cat); end if;
  return public.notif_prefs_moi();
end $$;
revoke execute on function public.notif_pref_regler(text, boolean) from public, anon;
grant execute on function public.notif_pref_regler(text, boolean) to authenticated;

-- l'ancien réglage « diffusions » reste en service (anciennes versions de l'application) et règle les 4 catégories commerciales
create or replace function public.notif_reglage_diffusions(p_oui boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  insert into public.notif_reglages (user_id, diffusions) values (auth.uid(), coalesce(p_oui, true))
  on conflict (user_id) do update set diffusions = excluded.diffusions, updated_at = now();
  foreach k in array array['offres', 'groupes', 'pour_vendeur', 'conseils'] loop
    if public._notif_pref(auth.uid(), k) and not coalesce(p_oui, true) then
      insert into public.notif_desactivations (user_id, origine, cat) values (auth.uid(), 'preference', k);
    end if;
    insert into public.notif_prefs (user_id, cat, actif) values (auth.uid(), k, coalesce(p_oui, true))
    on conflict (user_id, cat) do update set actif = excluded.actif, maj_le = now();
  end loop;
  return coalesce(p_oui, true);
end $$;

-- ───────── 11. Statistiques pour l'administrateur : totaux seulement, aucun nom ni numéro.
-- Ce qui n'est pas mesurable n'est pas prétendu : l'affichage réel à l'écran et la notification balayée sans clic.
create or replace function public.notif_stats(p_jours int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare depuis timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_jours, 30), 365)));
begin
  if not public.est_admin() then raise exception 'Réservé à l''équipe.'; end if;
  return json_build_object(
    'depuis', depuis,
    'abonnes', (select count(distinct user_id) from public.push_abonnements),
    'categories', coalesce((select json_agg(x order by x.ordre) from (
      select c.cat, c.libelle, c.nature, c.ordre,
        count(j.id) filter (where j.resultat = 'ok') as envoyees,
        count(j.id) filter (where j.resultat = 'echec') as echecs,
        count(j.id) filter (where j.resultat = 'aucun_telephone') as sans_telephone,
        count(j.id) filter (where j.resultat in ('pref', 'plafond', 'calme', 'ignore')) as bloquees,
        count(j.id) filter (where j.ouvert_le is not null and j.ouvert_par = 'push') as ouvertes,
        count(j.id) filter (where j.ouvert_le is not null and j.ouvert_par = 'liste') as lues_liste,
        count(j.id) filter (where j.action_le is not null) as actions,
        count(j.id) filter (where j.action in ('commande', 'groupe_rejoint')) as conversions
      from public.notif_categories c
      left join public.notif_journal j on j.cat = c.cat and j.cree_le >= depuis
      where c.cat <> 'essai'
      group by c.cat, c.libelle, c.nature, c.ordre) x), '[]'::json),
    'desactivations', coalesce((select json_agg(json_build_object('origine', origine, 'cat', cat, 'n', n)) from (
      select origine, cat, count(*) n from public.notif_desactivations where quand >= depuis group by origine, cat) d), '[]'::json),
    'limites', 'Mesuré : envoi accepté par le service de notification, clic sur la notification, action dans les 24 h après le clic. Non mesurable : affichage réel à l''écran, notification balayée sans clic.'
  );
end $$;
revoke execute on function public.notif_stats(int) from public, anon;
grant execute on function public.notif_stats(int) to authenticated;

-- réglage des plafonds et des heures calmes par l'administrateur
create or replace function public.notif_regles_regler(p_max_com int, p_max_conseils int, p_calme_debut int, p_calme_fin int)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''équipe.'; end if;
  if p_max_com not between 0 and 20 or p_max_conseils not between 0 and 5 or p_calme_debut not between 0 and 23 or p_calme_fin not between 0 and 23 then
    raise exception 'Valeurs hors limites.';
  end if;
  update public.notif_regles set max_com_jour = p_max_com, max_conseils_jour = p_max_conseils, calme_debut = p_calme_debut,
    calme_fin = p_calme_fin, maj_le = now() where id = 1;
  return (select row_to_json(r) from public.notif_regles r where id = 1);
end $$;
revoke execute on function public.notif_regles_regler(int, int, int, int) from public, anon;
grant execute on function public.notif_regles_regler(int, int, int, int) to authenticated;
