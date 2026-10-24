-- Schéma 91 : notifications commerciales automatiques (24/10/2026). Suite des schémas 88a et 88b.
-- Décision du propriétaire : comme Orange Max it, les notifications partent toutes seules, plusieurs fois par jour, de façon
-- intelligente et espacée, jamais la nuit, toujours fondées sur un vrai événement ou une vraie donnée du marché.
-- Plan : docs/audits/notifications-commerciales-2026-10-24.md. Fichier sans les mots interdits par le MCP.
--  1. Rythme : 8 messages commerciaux au plus par personne et par jour, 90 minutes au moins entre deux (180 si les
--     5 derniers n'ont pas été ouverts : on espace, on ne s'arrête pas), rien entre 21 h et 7 h ; 4 « contenus du marché » par jour.
--  2. Nouveaux déclencheurs (tâche « mdg-notif », toutes les 15 minutes, seulement de 7 h à 21 h) : N1 offre pour ma demande,
--     N2 proposition sans réponse, N3 proposition qui expire, N4 offre à mettre à jour, N5 demande sans offre mais des offres
--     ailleurs, N6 demande qui arrive à sa date limite, N7 visites de la boutique (lundi), N8 boutique pas encore ouverte,
--     N9 accord conclu sans commande. Chacun a une clé anti-doublon. Aucune nouvelle catégorie, aucun nouveau réglage.

-- ───────── 1. Rythme
alter table public.notif_regles add column if not exists ecart_min int not null default 90;
update public.notif_regles set max_com_jour = 8, max_conseils_jour = 4, ecart_min = 90, maj_le = now() where id = 1;

-- Décision du propriétaire « aucun réglage » : les notifications partent toutes seules, seule l'autorisation du téléphone compte.
-- Les préférences anciennes (notif_prefs, notif_reglages.diffusions) restent en base mais ne sont plus appliquées.
create or replace function public._notif_pref(p_user uuid, p_cat text)
returns boolean language sql stable security definer set search_path = public as $$
  select true
$$;
revoke execute on function public._notif_pref(uuid, text) from public, anon, authenticated;

-- N5 cherche les offres déjà annoncées pour une demande par notif_file.regroupe
create index if not exists notif_file_regroupe_idx on public.notif_file (regroupe);

-- dernier message commercial parti (ou en cours) pour une personne
create or replace function public._notif_dernier_com(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select max(cree_le) from public.notif_journal where user_id = p_user and nature = 'com' and resultat in ('ok', 'en_cours')
$$;
revoke execute on function public._notif_dernier_com(uuid) from public, anon, authenticated;

-- l'écart minimum est-il passé ? Doublé si les 5 derniers messages commerciaux envoyés n'ont pas été ouverts.
create or replace function public._notif_ecart_ok(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with d as (select public._notif_dernier_com(p_user) t),
  ign as (select count(*) filter (where ouvert_le is null) n, count(*) tot from (
    select ouvert_le from public.notif_journal where user_id = p_user and nature = 'com' and resultat = 'ok'
    order by cree_le desc limit 5) x)
  select d.t is null or d.t < now() - make_interval(mins => (select ecart_min from public.notif_regles where id = 1)
    * case when ign.tot = 5 and ign.n = 5 then 2 else 1 end)
  from d, ign
$$;
revoke execute on function public._notif_ecart_ok(uuid) from public, anon, authenticated;

-- ───────── 2. Préparer un envoi : l'écart est vérifié ; le contenu du marché n'attend plus une journée sans autre message
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
    elsif not public._notif_ecart_ok(p_user) then raison := 'plafond';
    elsif p_cat = 'conseils' and public._notif_com_jour(p_user, 'conseils') >= r.max_conseils_jour then raison := 'plafond';
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

-- ───────── 3. File d'attente : le commercial attend que l'écart soit passé ; un seul sujet commercial par personne et par tour,
-- le plus utile d'abord (offre pour ma demande, puis acheteur pour mes produits, etc.). Le reste attend le tour suivant.
create or replace function public._notif_rang(p_type text)
returns int language sql immutable as $$
  select case p_type when 'offre_pour_demande' then 1 when 'demande' then 2 when 'besoin' then 2 when 'demande_seule' then 3
    when 'groupe_proche' then 4 when 'offre' then 5 when 'stock_ancien' then 6 when 'boutique_visites' then 6
    when 'renouveler' then 7 when 'boutique_ouvrir' then 8 else 5 end
$$;

create or replace function public.notif_lots_prendre(p_max int default 300)
returns json language plpgsql security definer set search_path = public as $$
declare ids bigint[]; res json; calme boolean := public._notif_calme();
begin
  update public.notif_file f set etat = 'perime', pris_le = now()
  from public.notif_categories c
  where f.etat = 'attente' and c.cat = f.cat
    and f.cree_le < now() - case when c.nature = 'com' then interval '18 hours' else interval '36 hours' end;
  select array_agg(x.id) into ids from (
    select f.id from public.notif_file f join public.notif_categories c on c.cat = f.cat
    where f.etat = 'attente' and c.nature = 'trans'
      -- les relances automatiques ne partent pas la nuit : elles attendent 7 h
      and not (calme and coalesce(f.type, '') in ('relance_prix', 'expire_bientot', 'accord_sans_commande', 'demande_fin'))
    union
    select f.id from public.notif_file f
    join (
      select distinct on (f2.user_id) f2.user_id, f2.regroupe
      from public.notif_file f2 join public.notif_categories c2 on c2.cat = f2.cat
      where f2.etat = 'attente' and c2.nature = 'com' and not calme and public._notif_ecart_ok(f2.user_id)
        -- plafond du jour vérifié avant de prendre : sinon le message serait pris puis refusé « plafond » et perdu
        and public._notif_com_jour(f2.user_id) < (select r.max_com_jour from public.notif_regles r where r.id = 1)
        and (f2.cat <> 'conseils' or public._notif_com_jour(f2.user_id, 'conseils') < (select r.max_conseils_jour from public.notif_regles r where r.id = 1))
      order by f2.user_id, public._notif_rang(f2.type), f2.id
    ) choix on choix.user_id = f.user_id and choix.regroupe = f.regroupe
    where f.etat = 'attente'
    limit greatest(1, least(coalesce(p_max, 300), 2000))) x;
  if ids is null then return '[]'::json; end if;
  perform 1 from public.notif_file where id = any (ids) for update skip locked;
  update public.notif_file set etat = 'pris', pris_le = now() where id = any (ids) and etat = 'attente';
  select coalesce(json_agg(l order by l.premier_id), '[]'::json) into res from (
    select f.user_id, f.regroupe, min(f.cat) cat, min(f.type) type, count(*) n, min(f.id) premier_id,
      (array_agg(f.slug order by f.id desc))[1] slug, (array_agg(f.libelle order by f.id desc))[1] libelle,
      (array_agg(f.objet_id order by f.id desc))[1] objet_id, (array_agg(f.url order by f.id desc))[1] url,
      (array_agg(f.donnees order by f.id desc))[1] donnees
    from public.notif_file f where f.id = any (ids)
    group by f.user_id, f.regroupe) l;
  return res;
end $$;
revoke execute on function public.notif_lots_prendre(int) from public, anon, authenticated;
grant execute on function public.notif_lots_prendre(int) to service_role;

-- ───────── 4. Cibles des annonces à tous et du contenu du marché : plafond du jour et écart respectés
create or replace function public.notif_cible_marche(p_cat text, p_exclure uuid[] default '{}', p_region text default null,
  p_identite boolean default false, p_limite int default 300)
returns setof uuid language sql stable security definer set search_path = public as $$
  select x.user_id from (
    select distinct a.user_id, (p.region_slug is not distinct from p_region and p_region is not null) meme
    from public.push_abonnements a left join public.profils p on p.user_id = a.user_id
    where p.supprime_le is null and not (a.user_id = any (coalesce(p_exclure, '{}')))
  ) x
  where not public.est_banni(x.user_id) and public._notif_pref(x.user_id, p_cat)
    and public._notif_com_jour(x.user_id) < (select max_com_jour from public.notif_regles where id = 1)
    and public._notif_ecart_ok(x.user_id)
    and (not p_identite or exists (select 1 from public.identite_verifiee(array[x.user_id]) i where i = x.user_id))
  order by x.meme desc, x.user_id
  limit greatest(1, least(coalesce(p_limite, 300), 2000))
$$;
revoke execute on function public.notif_cible_marche(text, uuid[], text, boolean, int) from public, anon, authenticated;
grant execute on function public.notif_cible_marche(text, uuid[], text, boolean, int) to service_role;

create or replace function public.notif_cible_conseils()
returns table (user_id uuid, role text, region_slug text, vend boolean, achete boolean, suit text[])
language sql stable security definer set search_path = public as $$
  select x.user_id, coalesce(p.role, 'acheteur'), p.region_slug,
    exists (select 1 from public.offres o where o.user_id = x.user_id and o.status = 'active'),
    exists (select 1 from public.commandes c where c.acheteur_id = x.user_id)
      or exists (select 1 from public.demandes d where d.user_id = x.user_id and d.status = 'active'),
    array(select a.product_slug from public.alertes_produits a where a.user_id = x.user_id order by a.created_at desc limit 5)
  from (select distinct a.user_id from public.push_abonnements a) x
  left join public.profils p on p.user_id = x.user_id
  where coalesce((select max_jour from public.marketing_reglage where id = 1), 0) > 0
    and p.supprime_le is null and not public.est_banni(x.user_id)
    and public._notif_pref(x.user_id, 'conseils')
    and public._notif_com_jour(x.user_id) < (select max_com_jour from public.notif_regles where id = 1)
    and public._notif_com_jour(x.user_id, 'conseils') < (select max_conseils_jour from public.notif_regles where id = 1)
    and public._notif_ecart_ok(x.user_id)
    and not public._notif_calme()
  limit 5000
$$;
revoke execute on function public.notif_cible_conseils() from public, anon, authenticated;
grant execute on function public.notif_cible_conseils() to service_role;

-- objets déjà montrés à une personne ces 3 derniers jours (le contenu du marché ne répète pas la même offre ou demande)
create or replace function public.notif_deja_vus(p_users uuid[])
returns table (user_id uuid, objet_id text, slug text)
language sql stable security definer set search_path = public as $$
  select j.user_id, j.objet_id, j.slug from public.notif_journal j
  where j.user_id = any (p_users) and j.nature = 'com' and j.cree_le > now() - interval '3 days' and j.resultat in ('ok', 'en_cours')
$$;
revoke execute on function public.notif_deja_vus(uuid[]) from public, anon, authenticated;
grant execute on function public.notif_deja_vus(uuid[]) to service_role;

-- annonces réelles pour le contenu du marché : dernières offres et demandes actives (jamais l'auteur, filtré par « pousser »)
create or replace function public.notif_annonces_recentes()
returns table (sens text, id uuid, user_id uuid, slug text, libelle text, quantite numeric, unite text, prix numeric, ville text, region_slug text, cree_le timestamptz, ville_seulement boolean)
language sql stable security definer set search_path = public as $$
  (select 'offre', o.id, o.user_id, o.product_slug, coalesce(nullif(o.product_label, ''), o.product_slug), o.quantity, coalesce(o.unit, 'kg'), o.price, o.city, o.region_slug, o.created_at, coalesce(o.ville_seulement, false)
   from public.offres o where o.status = 'active' and o.pause_le is null order by o.created_at desc limit 200)
  union all
  (select 'demande', d.id, d.user_id, d.product_slug, coalesce(nullif(d.product_label, ''), d.product_slug), d.quantity, coalesce(d.unit, 'kg'), d.budget, d.city, d.region_slug, d.created_at, coalesce(d.ville_seulement, false)
   from public.demandes d where d.status = 'active' order by d.created_at desc limit 200)
$$;
revoke execute on function public.notif_annonces_recentes() from public, anon, authenticated;
grant execute on function public.notif_annonces_recentes() to service_role;

-- ───────── 5. Les nouveaux déclencheurs (mis en file d'attente ; les textes sont écrits par « pousser »)
create or replace function public._notif_mettre(p_user uuid, p_cat text, p_type text, p_cle text, p_regroupe text,
  p_objet text, p_slug text, p_libelle text, p_url text, p_donnees jsonb)
returns int language sql security definer set search_path = public as $$
  with i as (
    insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    select p_user, p_cat, p_type, p_cle, p_regroupe, p_objet, p_slug, p_libelle, p_url, coalesce(p_donnees, '{}'::jsonb)
    where p_user is not null and public._notif_joignable(p_user)
    on conflict (cle) do nothing returning 1)
  select count(*)::int from i
$$;
revoke execute on function public._notif_mettre(uuid, text, text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.notif_relances()
returns json language plpgsql security definer set search_path = public as $$
declare n1 int := 0; n2 int := 0; n3 int := 0; n4 int := 0; n5 int := 0; n6 int := 0; n7 int := 0; n8 int := 0; n9 int := 0;
  sem text := to_char(now() at time zone 'UTC', 'IYYY-IW'); r record;
begin
  if public._notif_calme() then return json_build_object('calme', true); end if;

  -- N1 : une offre récente (2 jours) répond à une demande active du même produit (budget respecté si même unité ; ville de
  -- référence si « ville seulement », règle 87b/87c). La meilleure offre par demande ; celles déjà en file sont écartées avant la limite.
  for r in
    select * from (
      select distinct on (d.id) d.user_id u, o.id oid, d.id did, o.product_slug slug, coalesce(nullif(o.product_label, ''), o.product_slug) lib,
        o.quantity q, coalesce(o.unit, 'kg') un, o.price px, o.city vi, d.quantity dq, coalesce(d.unit, 'kg') dun,
        (d.budget is not null and o.price is not null and coalesce(d.unit, 'kg') = coalesce(o.unit, 'kg') and o.price <= d.budget) bok
      from public.offres o join public.demandes d on d.product_slug = o.product_slug and d.status = 'active' and d.user_id <> o.user_id
      where o.status = 'active' and o.pause_le is null and o.created_at > now() - interval '2 days' and exists (select 1 from public.push_abonnements s where s.user_id = d.user_id)
        and (d.budget is null or o.price is null or coalesce(d.unit, 'kg') <> coalesce(o.unit, 'kg') or o.price <= d.budget)
        and (not (coalesce(o.ville_seulement, false) or coalesce(d.ville_seulement, false))
             or public._ville_cle(public._ville_ref(o.city)) = public._ville_cle(public._ville_ref(d.city)))
      order by d.id, o.price nulls last, o.created_at desc
    ) m
    where not exists (select 1 from public.notif_file f where f.cle = 'n1:' || m.oid || ':' || m.did)
    limit 300
  loop
    n1 := n1 + public._notif_mettre(r.u, 'offres', 'offre_pour_demande', 'n1:' || r.oid || ':' || r.did, 'n1:' || r.did, r.oid::text, r.slug, r.lib,
      'application.dc.html#/produits/' || r.slug, jsonb_build_object('quantite', r.q, 'unite', r.un, 'prix', r.px, 'ville', public._ville_nom(r.vi), 'demande_qte', r.dq,
        'demande_unite', r.dun, 'budget_ok', r.bok));
    -- l'annonce générale de la même offre devient inutile pour cette personne (rien n'est effacé)
    update public.notif_file set etat = 'perime', pris_le = now()
    where etat = 'attente' and user_id = r.u and type = 'offre' and objet_id = r.oid::text;
  end loop;

  -- N2 : proposition de prix en attente depuis plus de 24 h (et encore valable plus de 6 h) → celui qui doit répondre, une fois
  -- N3 : la même, 6 h avant son expiration → une fois
  for r in
    select n.id nid, m.id mid, m.auteur_id par, case when m.auteur_id = n.auteur_id then n.proprio_id else n.auteur_id end u,
      n.produit, n.unite, m.prix, m.created_at quand, n.expire_le
    from public.negociations n join public.messages m on m.id = n.dernier_msg
    where n.statut = 'ouverte' and m.genre = 'prix' and m.issue = 'en_attente' and n.expire_le > now()
      and exists (select 1 from public.push_abonnements s where s.user_id = case when m.auteur_id = n.auteur_id then n.proprio_id else n.auteur_id end)
    limit 300
  loop
    if r.quand < now() - interval '24 hours' and r.expire_le > now() + interval '6 hours' then
      n2 := n2 + public._notif_mettre(r.u, 'negociation', 'relance_prix', 'n2:' || r.mid, 'n2:' || r.nid, r.nid::text, null, r.produit,
        'application.dc.html#/?nego=' || r.nid, jsonb_build_object('par', r.par, 'prix', r.prix, 'unite', r.unite, 'expire', r.expire_le));
    end if;
    if r.expire_le < now() + interval '6 hours' then
      n3 := n3 + public._notif_mettre(r.u, 'negociation', 'expire_bientot', 'n3:' || r.mid, 'n3:' || r.nid, r.nid::text, null, r.produit,
        'application.dc.html#/?nego=' || r.nid, jsonb_build_object('par', r.par, 'prix', r.prix, 'unite', r.unite, 'expire', r.expire_le));
    end if;
  end loop;

  -- N9 : accord conclu depuis plus de 2 h (moins de 7 jours), aucune commande → les deux, une fois
  for r in
    select n.id nid, n.produit, x.u, case when x.u = n.auteur_id then n.proprio_id else n.auteur_id end autre, n.prix_final, n.unite
    from public.negociations n cross join lateral (values (n.auteur_id), (n.proprio_id)) x(u)
    where n.statut = 'conclue' and n.conclu_le < now() - interval '2 hours' and n.conclu_le > now() - interval '7 days'
      and not exists (select 1 from public.commandes c where c.negociation_id = n.id) and exists (select 1 from public.push_abonnements s where s.user_id = x.u)
    limit 300
  loop
    n9 := n9 + public._notif_mettre(r.u, 'negociation', 'accord_sans_commande', 'n9:' || r.nid || ':' || r.u, 'n9:' || r.nid, r.nid::text, null, r.produit,
      'application.dc.html#/?nego=' || r.nid, jsonb_build_object('par', r.autre, 'prix', r.prix_final, 'unite', r.unite));
  end loop;

  -- N4 : offre active sans mise à jour depuis 7 jours → le vendeur, une fois par offre et par semaine
  for r in
    select o.id, o.user_id u, o.product_slug slug, coalesce(nullif(o.product_label, ''), o.product_slug) lib, o.quantity q, coalesce(o.unit, 'kg') un,
      o.price px, coalesce(o.maj_le, o.created_at) depuis
    from public.offres o
    where o.status = 'active' and o.pause_le is null and coalesce(o.maj_le, o.created_at) < now() - interval '7 days' and exists (select 1 from public.push_abonnements s where s.user_id = o.user_id)
      and not exists (select 1 from public.notif_file f where f.cle = 'n4:' || o.id || ':' || sem)
    order by coalesce(o.maj_le, o.created_at)
    limit 300
  loop
    n4 := n4 + public._notif_mettre(r.u, 'pour_vendeur', 'stock_ancien', 'n4:' || r.id || ':' || sem, 'n4:' || r.u, r.id::text, r.slug, r.lib,
      'application.dc.html#/mes-publications', jsonb_build_object('quantite', r.q, 'unite', r.un, 'prix', r.px, 'depuis', r.depuis));
  end loop;

  -- N5 : demande active de plus de 48 h, sans négociation, alors que le produit est proposé dans une autre ville par des offres
  -- commandables (pas « ville seulement ») → l'acheteur, une fois. nb et villes ne comptent que ces offres.
  for r in
    select d.id, d.user_id u, d.product_slug slug, coalesce(nullif(d.product_label, ''), d.product_slug) lib, d.city,
      count(o.id) nb, (array_agg(distinct public._ville_nom(o.city)) filter (where o.city is not null))[1:2] villes
    from public.demandes d join public.offres o on o.product_slug = d.product_slug and o.status = 'active' and o.pause_le is null and o.user_id <> d.user_id
      and not coalesce(o.ville_seulement, false)
      and public._ville_cle(public._ville_ref(o.city)) is distinct from public._ville_cle(public._ville_ref(d.city))
    where d.status = 'active' and d.created_at < now() - interval '48 hours' and exists (select 1 from public.push_abonnements s where s.user_id = d.user_id)
      and not exists (select 1 from public.negociations n where n.cible = 'demande' and n.cible_id = d.id)
      and not exists (select 1 from public.notif_file f where f.regroupe = 'n1:' || d.id)   -- déjà prévenu d'une offre pour cette demande
      and not exists (select 1 from public.notif_file f where f.cle = 'n5:' || d.id)
      and not coalesce(d.ville_seulement, false)
    group by d.id, d.user_id, d.product_slug, d.product_label, d.city
    limit 300
  loop
    n5 := n5 + public._notif_mettre(r.u, 'offres', 'demande_seule', 'n5:' || r.id, 'n5:' || r.id, r.id::text, r.slug, r.lib,
      'application.dc.html#/produits/' || r.slug, jsonb_build_object('nb', r.nb, 'villes', to_jsonb(r.villes), 'ville', public._ville_nom(r.city)));
  end loop;

  -- N6 : demande active dont l'échéance tombe dans 12 à 36 h → l'acheteur, une fois. demandes.deadline est un texte libre
  -- (« vite », « semaine », « mois ») : l'échéance se calcule depuis created_at, le texte n'est jamais converti en date.
  for r in
    select * from (
      select d.id, d.user_id u, d.product_slug slug, coalesce(nullif(d.product_label, ''), d.product_slug) lib,
        d.created_at + case lower(btrim(d.deadline)) when 'vite' then interval '2 days' when 'semaine' then interval '7 days'
          when 'mois' then interval '30 days' end limite
      from public.demandes d
      where d.status = 'active' and exists (select 1 from public.push_abonnements s where s.user_id = d.user_id)
        and not exists (select 1 from public.notif_file f where f.cle = 'n6:' || d.id)
    ) e
    where e.limite between now() + interval '12 hours' and now() + interval '36 hours'
    limit 300
  loop
    n6 := n6 + public._notif_mettre(r.u, 'rappel', 'demande_fin', 'n6:' || r.id, 'n6:' || r.id, r.id::text, r.slug, r.lib,
      'application.dc.html#/mes-publications', jsonb_build_object('limite', r.limite));
  end loop;

  -- N7 : le lundi, visites de la boutique sur 7 jours (3 au moins) → le vendeur, une fois par semaine
  if extract(isodow from now() at time zone 'UTC') = 1 then
    for r in
      select b.user_id u, b.code, count(*) filter (where p.evenement in ('vue', 'produit')) vues, count(*) filter (where p.evenement in ('partage', 'lien', 'qr')) partages
      from public.boutiques b join public.boutique_passages p on p.code = b.code and p.jour > (now() at time zone 'UTC')::date - 7
      where b.active and exists (select 1 from public.push_abonnements s where s.user_id = b.user_id) group by b.user_id, b.code having count(*) filter (where p.evenement in ('vue', 'produit')) >= 3
      limit 300
    loop
      n7 := n7 + public._notif_mettre(r.u, 'conseils', 'boutique_visites', 'n7:' || r.u || ':' || sem, 'n7:' || r.u, r.code, null, null,
        'application.dc.html#/boutique/' || r.code, jsonb_build_object('vues', r.vues, 'partages', r.partages));
    end loop;
  end if;

  -- N8 : vendeur avec au moins une offre active depuis 1 jour, sans boutique → une seule fois dans la vie du compte
  for r in
    select o.user_id u, count(*) nb
    from public.offres o
    where o.status = 'active' and o.created_at < now() - interval '1 day' and exists (select 1 from public.push_abonnements s where s.user_id = o.user_id)
      and not exists (select 1 from public.boutiques b where b.user_id = o.user_id)
      and not exists (select 1 from public.notif_file f where f.cle = 'n8:' || o.user_id)
    group by o.user_id
    limit 300
  loop
    n8 := n8 + public._notif_mettre(r.u, 'conseils', 'boutique_ouvrir', 'n8:' || r.u, 'n8:' || r.u, null, null, null,
      'application.dc.html#/?maboutique=1', jsonb_build_object('offres', r.nb));
  end loop;

  return json_build_object('n1', n1, 'n2', n2, 'n3', n3, 'n4', n4, 'n5', n5, 'n6', n6, 'n7', n7, 'n8', n8, 'n9', n9);
end $$;
revoke execute on function public.notif_relances() from public, anon, authenticated;

-- ───────── 6. La tâche « mdg-notif » (toutes les 15 minutes) appelle aussi les nouveaux déclencheurs
create or replace function public.notif_tick()
returns text language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; nv int; nr int := 0; na int; attente int; rel json;
begin
  nv := public.notif_groupes_veille();
  if extract(minute from now()) < 15 then nr := public.notif_renouveler_calculer(); end if;
  na := public.notif_actions_calculer();
  -- une erreur dans les relances n'empêche jamais l'envoi des notifications transactionnelles
  begin
    rel := public.notif_relances();
  exception when others then
    rel := json_build_object('erreur', left(sqlerrm, 200));
  end;
  select count(*) into attente from public.notif_file f join public.notif_categories c on c.cat = f.cat
  where f.etat = 'attente' and (not public._notif_calme()
    or (c.nature = 'trans' and coalesce(f.type, '') not in ('relance_prix', 'expire_bientot', 'accord_sans_commande', 'demande_fin')));
  if attente = 0 then return format('veille %s, renouveler %s, actions %s, relances %s, rien à envoyer', nv, nr, na, rel); end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return format('veille %s, renouveler %s, actions %s, relances %s, %s en attente, pas de clé', nv, nr, na, rel, attente); end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('lots', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 60000);
  return format('veille %s, renouveler %s, actions %s, relances %s, %s en attente, envoi demandé', nv, nr, na, rel, attente);
end $$;
revoke execute on function public.notif_tick() from public, anon, authenticated;

-- l'écran Réglages : le texte d'aide des conseils suit le nouveau rythme
update public.notif_categories set aide = 'Prix, nouvelles offres et demandes du marché, quelques fois par jour.' where cat = 'conseils';

-- la fonction Edge lit ces tables (en production, chaque table doit donner ce droit à part)
grant select on public.boutiques, public.boutique_passages to service_role;
