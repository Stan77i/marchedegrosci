-- Schéma 88b : notifications, les événements (24/10/2026). Suite du 88a.
-- File d'attente des messages non urgents (regroupés par personne et par sujet, envoyés par la tâche « mdg-notif » toutes
-- les 15 minutes), cibles personnalisées (produits suivis, déjà achetés, région, vendeurs du produit), annonces du marché
-- corrigées (elles partaient seulement s'il y avait un suiveur), achat groupé proche du seuil et veille de la date limite,
-- approvisionnement à renouveler (rythme des commandes passées), actions après une ouverture, rappels qui ne se perdent plus.
-- Rien n'est commandé ni payé par ces messages. Fichier sans les mots interdits par le MCP.
-- Appliqué sur le projet de test le 24/10/2026 (tests : supabase/tests/notifications-88-scenarios.sql). PAS appliqué en production.

-- ───────── 1. File d'attente (une ligne par personne et par événement ; la clé unique empêche les doublons)
create table if not exists public.notif_file (
  id bigserial primary key,
  user_id uuid not null,
  cat text not null references public.notif_categories (cat),
  type text not null,
  cle text not null unique,
  regroupe text not null,
  objet_id text,
  slug text,
  libelle text,
  url text,
  donnees jsonb not null default '{}'::jsonb,
  cree_le timestamptz not null default now(),
  etat text not null default 'attente' check (etat in ('attente', 'pris', 'perime')),
  pris_le timestamptz
);
create index if not exists notif_file_attente_idx on public.notif_file (cree_le) where etat = 'attente';
alter table public.notif_file enable row level security;
revoke all on public.notif_file from anon, authenticated;
grant select on public.notif_file to service_role;

-- ───────── 2. Le produit (slug) d'une commande : par la négociation (offre ou demande), sinon par l'achat groupé
create or replace function public._notif_slug_commande(p_commande uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select o.product_slug from public.commandes c join public.negociations n on n.id = c.negociation_id
       join public.offres o on n.cible = 'offre' and o.id = n.cible_id where c.id = p_commande),
    (select d.product_slug from public.commandes c join public.negociations n on n.id = c.negociation_id
       join public.demandes d on n.cible = 'demande' and d.id = n.cible_id where c.id = p_commande),
    (select o.product_slug from public.commandes c join public.groupes_achat g on g.id = c.groupe_id
       join public.offres o on o.id = g.offre_id where c.id = p_commande))
$$;
revoke execute on function public._notif_slug_commande(uuid) from public, anon, authenticated;

-- une personne joignable par notification (téléphone abonné, compte actif, non banni)
create or replace function public._notif_joignable(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_abonnements a where a.user_id = p_user)
     and not exists (select 1 from public.profils p where p.user_id = p_user and p.supprime_le is not null)
     and not public.est_banni(p_user)
$$;
revoke execute on function public._notif_joignable(uuid) from public, anon, authenticated;

-- ───────── 3. Cibles d'une nouvelle annonce
-- Offre (catégorie « offres ») : ceux qui suivent le produit, puis ceux qui l'ont déjà acheté (12 mois), puis les acheteurs de la
-- même région ; 200 au plus. Demande (catégorie « pour_vendeur ») : ceux qui suivent le produit, puis les vendeurs qui en ont une
-- offre active ou en ont vendu depuis 12 mois, même région d'abord, 50 vendeurs au plus.
-- « Ville seulement » (schéma 87) : seulement les personnes de cette ville. L'auteur n'est jamais prévenu de sa propre annonce.
create or replace function public.notif_cible_annonce(p_table text, p_id uuid)
returns table (user_id uuid, raison text)
language plpgsql stable security definer set search_path = public as $$
declare v_slug text; v_auteur uuid; v_region text; v_ville text; v_seule boolean;
begin
  if p_table = 'offres' then
    select o.product_slug, o.user_id, o.region_slug, o.city, coalesce(o.ville_seulement, false) into v_slug, v_auteur, v_region, v_ville, v_seule
    from public.offres o where o.id = p_id;
  elsif p_table = 'demandes' then
    select d.product_slug, d.user_id, d.region_slug, d.city, coalesce(d.ville_seulement, false) into v_slug, v_auteur, v_region, v_ville, v_seule
    from public.demandes d where d.id = p_id;
  else raise exception 'table inconnue'; end if;
  if v_slug is null then return; end if;

  if p_table = 'offres' then
    return query
    with c as (
      select a.user_id u, 1 rang, 'suivi'::text r from public.alertes_produits a where a.product_slug = v_slug and a.offres
      union all
      select k.acheteur_id, 2, 'deja_achete' from public.commandes k
      where k.etat = 'terminee' and coalesce(k.termine_le, k.updated_at) > now() - interval '365 days'
        and public._notif_slug_commande(k.id) = v_slug
      union all
      (select p.user_id, 3, 'region' from public.profils p
       where v_region is not null and p.region_slug = v_region and coalesce(p.role, 'acheteur') in ('acheteur', 'les_deux')
         and exists (select 1 from public.push_abonnements s where s.user_id = p.user_id) limit 500)
    ), u as (
      select distinct on (c.u) c.u, c.rang, c.r from c where c.u is not null and c.u <> v_auteur order by c.u, c.rang
    )
    select u.u, u.r from u
    left join public.profils p on p.user_id = u.u
    where public._notif_joignable(u.u)
      and (not v_seule or public._ville_cle(p.ville) = public._ville_cle(v_ville))
    order by u.rang, u.u
    limit 200;
  else
    return query
    with v as (
      select o.user_id u, (o.region_slug is not distinct from v_region) meme, o.city vil from public.offres o
      where o.product_slug = v_slug and o.status = 'active'
      union all
      select k.vendeur_id, false, null::text from public.commandes k
      where k.etat = 'terminee' and coalesce(k.termine_le, k.updated_at) > now() - interval '365 days'
        and public._notif_slug_commande(k.id) = v_slug
    ), vend as (
      select v.u, bool_or(v.meme) meme, bool_or(v_seule and public._ville_cle(v.vil) = public._ville_cle(v_ville)) dans_ville
      from v where v.u is not null and v.u <> v_auteur group by v.u
    ), vend_ok as (
      select vend.u, case when vend.meme or p.region_slug is not distinct from v_region then 2 else 3 end rang
      from vend left join public.profils p on p.user_id = vend.u
      where public._notif_joignable(vend.u)
        and (not v_seule or vend.dans_ville or public._ville_cle(p.ville) = public._ville_cle(v_ville))
      order by 2, vend.u
      limit 50
    ), suiv as (
      select a.user_id u from public.alertes_produits a left join public.profils p on p.user_id = a.user_id
      where a.product_slug = v_slug and a.demandes and a.user_id <> v_auteur and public._notif_joignable(a.user_id)
        and (not v_seule or public._ville_cle(p.ville) = public._ville_cle(v_ville))
      limit 200
    ), tout as (
      select suiv.u, 1 rang, 'suivi'::text r from suiv
      union all select vend_ok.u, vend_ok.rang, case when vend_ok.rang = 2 then 'vendeur_region' else 'vendeur' end from vend_ok
    )
    select distinct on (tout.u) tout.u, tout.r from tout order by tout.u, tout.rang;
  end if;
end $$;
revoke execute on function public.notif_cible_annonce(text, uuid) from public, anon, authenticated;
grant execute on function public.notif_cible_annonce(text, uuid) to service_role;

-- ───────── 4. Nouvelle annonce (déclencheur des offres et des demandes) : les cibles sont mises en file d'attente.
-- Avant (schéma 75) : rien ne partait s'il n'y avait aucun suiveur du produit. Le plafond de 10 annonces par auteur et par jour
-- est gardé. Une demande qui fait partie d'un besoin professionnel est annoncée une fois avec le besoin (push_besoin).
create or replace function public.push_annonce()
returns trigger language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_n int; r record; v_cat text; v_type text; v_lib text;
begin
  if tg_table_name = 'demandes' then
    if (to_jsonb(new) ->> 'besoin_id') is not null then return new; end if;
  end if;
  if coalesce(new.status, 'active') <> 'active' then return new; end if;
  insert into public.push_annonce_jour as j (user_id, jour, n) values (new.user_id, (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, jour) do update set n = j.n + 1 returning j.n into v_n;
  if v_n > 10 then return new; end if;
  v_cat := case when tg_table_name = 'offres' then 'offres' else 'pour_vendeur' end;
  v_type := case when tg_table_name = 'offres' then 'offre' else 'demande' end;
  v_lib := coalesce(nullif(new.product_label, ''), new.product_slug);
  for r in select * from public.notif_cible_annonce(tg_table_name, new.id) loop
    insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (r.user_id, v_cat, v_type, 'annonce:' || new.id || ':' || r.user_id, v_cat || ':' || new.product_slug, new.id::text,
      new.product_slug, v_lib, 'application.dc.html#/produits/' || new.product_slug,
      jsonb_build_object('quantite', new.quantity, 'unite', new.unit, 'ville', public._ville_nom(new.city), 'raison', r.raison,
        'prix', case when tg_table_name = 'offres' then to_jsonb(new) -> 'price' else to_jsonb(new) -> 'budget' end))
    on conflict (cle) do nothing;
  end loop;
  return new;
exception when others then
  raise warning 'push_annonce : %', sqlerrm;
  return new;
end $$;

-- ───────── 5. Achat groupé proche du seuil : un seul message quand la quantité atteint 80 % de l'objectif,
-- aux inscrits (catégorie « groupe_suivi ») et à ceux qui suivent le produit dans la région (catégorie « groupes »).
create or replace function public.notif_groupe_proche()
returns trigger language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; total numeric; v_slug text; r record; d jsonb;
begin
  select * into g from public.groupes_achat where id = new.groupe_id;
  if g.id is null or g.statut <> 'ouvert' or coalesce(g.objectif, 0) <= 0 then return new; end if;
  total := public._groupe_total(g.id);
  if total < 0.8 * g.objectif or total >= g.objectif then return new; end if;
  select o.product_slug into v_slug from public.offres o where o.id = g.offre_id;
  d := jsonb_build_object('manque', g.objectif - total, 'unite', g.unite, 'produit', g.produit, 'objectif', g.objectif);
  for r in
    select p.user_id u, 'groupe_suivi'::text c from public.groupe_participants p
    where p.groupe_id = g.id and p.statut <> 'retire'
    union
    select a.user_id, 'groupes' from public.alertes_produits a left join public.profils pr on pr.user_id = a.user_id
    where v_slug is not null and a.product_slug = v_slug and a.offres
      and (g.region_slug is null or pr.region_slug = g.region_slug)
      and not exists (select 1 from public.groupe_participants p2 where p2.groupe_id = g.id and p2.user_id = a.user_id)
  loop
    if r.u is null or r.u = g.vendeur_id or not public._notif_joignable(r.u) then continue; end if;
    insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (r.u, r.c, 'groupe_proche', 'groupe80:' || g.id || ':' || r.u, 'groupe80:' || g.id, g.id::text, v_slug,
      coalesce(g.produit, 'Achat groupé'), 'application.dc.html#/?groupe=' || g.id, d)
    on conflict (cle) do nothing;
  end loop;
  return new;
exception when others then
  raise warning 'notif_groupe_proche : %', sqlerrm;
  return new;
end $$;
revoke execute on function public.notif_groupe_proche() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'groupe_participants_notif') then
    create trigger groupe_participants_notif after insert or update of quantite, statut on public.groupe_participants
      for each row execute function public.notif_groupe_proche();
  end if;
end $$;

-- ───────── 6. Veille de la date limite d'un achat groupé : un message aux inscrits, une seule fois
create or replace function public.notif_groupes_veille()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    select g.id, g.produit, g.unite, g.objectif, g.statut, p.user_id u, o.product_slug slug, public._groupe_total(g.id) total
    from public.groupes_achat g join public.groupe_participants p on p.groupe_id = g.id and p.statut <> 'retire'
    left join public.offres o on o.id = g.offre_id
    where g.statut in ('ouvert', 'seuil_atteint') and g.date_limite between now() + interval '12 hours' and now() + interval '36 hours'
  loop
    if not public._notif_joignable(r.u) then continue; end if;
    insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (r.u, 'groupe_suivi', 'groupe_veille', 'groupe_veille:' || r.id || ':' || r.u, 'groupe_veille:' || r.id, r.id::text, r.slug,
      coalesce(r.produit, 'Achat groupé'), 'application.dc.html#/?groupe=' || r.id,
      jsonb_build_object('statut', r.statut, 'manque', greatest(0, coalesce(r.objectif, 0) - r.total), 'unite', r.unite))
    on conflict (cle) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.notif_groupes_veille() from public, anon, authenticated;

-- ───────── 7. Approvisionnement à renouveler : au moins 2 commandes terminées du même produit ; à la date attendue
-- (dernière commande + écart moyen), un seul message par cycle. Pas de message si un rappel choisi existe déjà pour ce produit
-- ou si une nouvelle commande du produit est en cours. Rien n'est commandé.
create or replace function public.notif_renouveler_calculer()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  for r in
    with k as (
      select c.id, c.acheteur_id u, public._notif_slug_commande(c.id) slug, coalesce(c.termine_le, c.updated_at) t, c.produit
      from public.commandes c where c.etat = 'terminee' and c.acheteur_id is not null
        and coalesce(c.termine_le, c.updated_at) > now() - interval '400 days'
    ), s as (
      select k.u, k.slug, count(*) nb, max(k.t) dernier, (max(k.t) - min(k.t)) / (count(*) - 1) ecart,
        (array_agg(k.id order by k.t desc))[1] dernier_id, (array_agg(k.produit order by k.t desc))[1] produit
      from k where k.slug is not null group by k.u, k.slug having count(*) >= 2
    )
    select s.* from s
    where s.ecart between interval '1 day' and interval '120 days'
      and s.dernier + s.ecart <= now() and s.dernier + s.ecart > now() - interval '3 days'
  loop
    if not public._notif_joignable(r.u) then continue; end if;
    if exists (select 1 from public.rappels_achat ra where ra.user_id = r.u and ra.actif and public._notif_slug_commande(ra.commande_id) = r.slug) then continue; end if;
    if exists (select 1 from public.commandes c2 where c2.acheteur_id = r.u and c2.created_at > r.dernier
               and c2.etat not in ('terminee', 'annulee', 'refusee') and public._notif_slug_commande(c2.id) = r.slug) then continue; end if;
    insert into public.notif_file (user_id, cat, type, cle, regroupe, objet_id, slug, libelle, url, donnees)
    values (r.u, 'renouveler', 'renouveler', 'renouveler:' || r.u || ':' || r.dernier_id, 'renouveler:' || r.slug, r.dernier_id::text,
      r.slug, coalesce(r.produit, r.slug), 'application.dc.html#/?racheter=' || r.dernier_id,
      jsonb_build_object('jours', round(extract(epoch from r.ecart) / 86400), 'commandes', r.nb))
    on conflict (cle) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
revoke execute on function public.notif_renouveler_calculer() from public, anon, authenticated;

-- ───────── 8. Prendre les messages en attente, regroupés par personne et par sujet (appelé par « pousser »)
-- Le commercial attend la fin des heures calmes ; ce qui a trop attendu est marqué « perime » (rien n'est effacé).
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
    where f.etat = 'attente' and (c.nature = 'trans' or not calme)
    order by f.id limit greatest(1, least(coalesce(p_max, 300), 2000))
    for update of f skip locked) x;
  if ids is null then return '[]'::json; end if;
  update public.notif_file set etat = 'pris', pris_le = now() where id = any (ids);
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

-- ───────── 9. Cibles d'une annonce à tous (achat groupé ouvert, besoin professionnel) : préférence active, pas de plafond
-- atteint, même région d'abord. Remplace push_diffusion_cible (gardée pour les anciennes versions de « pousser »).
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
    and (not p_identite or exists (select 1 from public.identite_verifiee(array[x.user_id]) i where i = x.user_id))
  order by x.meme desc, x.user_id
  limit greatest(1, least(coalesce(p_limite, 300), 2000))
$$;
revoke execute on function public.notif_cible_marche(text, uuid[], text, boolean, int) from public, anon, authenticated;
grant execute on function public.notif_cible_marche(text, uuid[], text, boolean, int) to service_role;

-- ───────── 10. Cibles du conseil du jour, avec ce qu'il faut pour le choisir (rôle, région, activité réelle)
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
    and public._notif_pref(x.user_id, 'conseils') and public._notif_com_jour(x.user_id) = 0
  limit 5000
$$;
revoke execute on function public.notif_cible_conseils() from public, anon, authenticated;
grant execute on function public.notif_cible_conseils() to service_role;

-- fourchette de prix réelle par produit et par unité (au moins 3 offres actives), région de la personne d'abord
create or replace function public.notif_fourchette(p_region text default null)
returns table (slug text, libelle text, unite text, nb int, prix_min numeric, prix_max numeric, region boolean)
language sql stable security definer set search_path = public as $$
  (select o.product_slug, min(coalesce(nullif(o.product_label, ''), o.product_slug)), coalesce(o.unit, 'kg'), count(*)::int, min(o.price), max(o.price), true
   from public.offres o
   where p_region is not null and o.region_slug = p_region and o.status = 'active' and o.price > 0
   group by o.product_slug, coalesce(o.unit, 'kg') having count(*) >= 3 order by count(*) desc limit 5)
  union all
  (select o.product_slug, min(coalesce(nullif(o.product_label, ''), o.product_slug)), coalesce(o.unit, 'kg'), count(*)::int, min(o.price), max(o.price), false
   from (select * from public.offres where status = 'active' and price > 0 order by created_at desc limit 3000) o
   group by o.product_slug, coalesce(o.unit, 'kg') having count(*) >= 3 order by count(*) desc limit 5)
$$;
revoke execute on function public.notif_fourchette(text) from public, anon, authenticated;
grant execute on function public.notif_fourchette(text) to service_role;

-- ───────── 11. Action après une ouverture (24 h) : réponse, proposition, commande, offre publiée, groupe rejoint.
-- Calculé par le serveur ; sur le même objet ou le même produit quand on les connaît.
create or replace function public.notif_actions_calculer()
returns int language plpgsql security definer set search_path = public as $$
declare j record; a text; t timestamptz; n int := 0; fin timestamptz;
begin
  for j in select * from public.notif_journal
           where ouvert_le is not null and action_le is null and ouvert_le > now() - interval '48 hours' limit 2000 loop
    a := null; t := null; fin := j.ouvert_le + interval '24 hours';
    if j.cat = 'negociation' and j.objet_id is not null then
      select 'reponse', min(m.created_at) into a, t from public.messages m
      where m.negociation_id::text = j.objet_id and m.auteur_id = j.user_id and m.created_at between j.ouvert_le and fin having count(*) > 0;
    elsif j.cat = 'reponses' and j.objet_id is not null then
      select 'reponse', min(m.created_at) into a, t from public.dm m
      where m.discussion_id::text = j.objet_id and m.auteur_id = j.user_id and m.created_at between j.ouvert_le and fin having count(*) > 0;
    elsif j.cat = 'commande' and j.objet_id is not null then
      select 'commande_etape', min(e.at) into a, t from public.commande_etapes e
      where e.commande_id::text = j.objet_id and e.par = j.user_id and e.at between j.ouvert_le and fin having count(*) > 0;
    end if;
    if a is null then
      select 'commande', min(c.created_at) into a, t from public.commandes c
      where c.cree_par = j.user_id and c.created_at between j.ouvert_le and fin
        and (j.slug is null or public._notif_slug_commande(c.id) = j.slug) having count(*) > 0;
    end if;
    if a is null then
      select 'groupe_rejoint', min(p.created_at) into a, t from public.groupe_participants p
      left join public.groupes_achat g on g.id = p.groupe_id left join public.offres o on o.id = g.offre_id
      where p.user_id = j.user_id and p.created_at between j.ouvert_le and fin
        and (p.groupe_id::text = j.objet_id or (j.slug is not null and o.product_slug = j.slug) or (j.slug is null and j.cat in ('groupes', 'conseils')))
      having count(*) > 0;
    end if;
    if a is null then
      select 'proposition', min(ng.created_at) into a, t from public.negociations ng
      left join public.offres o on ng.cible = 'offre' and o.id = ng.cible_id
      left join public.demandes d on ng.cible = 'demande' and d.id = ng.cible_id
      where ng.auteur_id = j.user_id and ng.created_at between j.ouvert_le and fin
        and (j.slug is null or coalesce(o.product_slug, d.product_slug) = j.slug) having count(*) > 0;
    end if;
    if a is null then
      select 'offre_publiee', min(o.created_at) into a, t from public.offres o
      where o.user_id = j.user_id and o.created_at between j.ouvert_le and fin
        and (j.slug is null or o.product_slug = j.slug) having count(*) > 0;
    end if;
    if a is not null then
      update public.notif_journal set action = a, action_le = t where id = j.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke execute on function public.notif_actions_calculer() from public, anon, authenticated;

-- ───────── 12. Rappels d'achat choisis : la date suivante n'avance que si l'envoi a été demandé (avant, un rappel était perdu
-- quand la clé du serveur manquait).
create or replace function public.rappels_envoyer()
returns integer language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; r record; n int := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return 0; end if;
  for r in select * from public.rappels_achat where actif and prochain_le <= now() for update skip locked loop
    if not public.est_banni(r.user_id) then
      perform net.http_post(url := v_url, body := jsonb_build_object('rappel_id', r.id, 'prevu', r.prochain_le),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
      n := n + 1;
    end if;
    update public.rappels_achat set dernier_envoi = now(),
      prochain_le = public._rappel_prochain(r.frequence, r.jour, r.heure, greatest(now(), r.prochain_le)) where id = r.id;
  end loop;
  return n;
end $$;

-- ───────── 13. La tâche « mdg-notif » (toutes les 15 minutes)
create or replace function public.notif_tick()
returns text language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; nv int; nr int := 0; na int; attente int;
begin
  nv := public.notif_groupes_veille();
  if extract(minute from now()) < 15 then nr := public.notif_renouveler_calculer(); end if;
  na := public.notif_actions_calculer();
  select count(*) into attente from public.notif_file f join public.notif_categories c on c.cat = f.cat
  where f.etat = 'attente' and (c.nature = 'trans' or not public._notif_calme());
  if attente = 0 then return format('veille %s, renouveler %s, actions %s, rien à envoyer', nv, nr, na); end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return format('veille %s, renouveler %s, actions %s, %s en attente, pas de clé', nv, nr, na, attente); end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('lots', true),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 60000);
  return format('veille %s, renouveler %s, actions %s, %s en attente, envoi demandé', nv, nr, na, attente);
end $$;
revoke execute on function public.notif_tick() from public, anon, authenticated;

select cron.schedule('mdg-notif', '*/15 * * * *', 'select public.notif_tick()');

-- la fonction Edge lit ces tables (en production, chaque table doit donner ce droit à part)
grant select on public.notif_file, public.notif_categories, public.notif_regles, public.notif_prefs, public.notif_journal,
  public.notif_desactivations, public.groupes_achat, public.groupe_participants, public.alertes_produits to service_role;
