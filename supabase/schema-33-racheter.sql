-- ═════════ Marché de Gros CI — schéma 33 : racheter et rappels d'achat ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune donnée existante modifiée.
--
-- Principe : RIEN n'est acheté tout seul. Le serveur PRÉPARE (prix du jour, stock restant, offres actives) ; l'acheteur
-- choisit, ajuste les quantités, puis envoie lui-même une proposition au vendeur (nego_ouvrir, qui revérifie tout).
-- Le vendeur doit encore accepter : une proposition n'est ni une commande ni une dépense.
--   • recommande_preparer(commande) : la même offre (si elle est encore active), les autres offres actives du même vendeur
--     pour ce produit, et jusqu'à 5 offres d'autres vendeurs ; avec le prix du jour et la quantité restante ;
--   • mes_achats_habituels() : les produits achetés (commandes terminées), dernière quantité, dernier prix, combien de fois ;
--   • rappels d'achat quotidiens ou hebdomadaires (10 au plus par compte) : une notification « Racheter … ? » à l'heure choisie
--     (heure d'Abidjan = UTC). Le rappel ouvre l'écran de préparation ; il n'envoie aucune proposition.
-- Limite connue (contrainte negociations_cible_cible_id_auteur_id_key) : un acheteur n'a qu'UNE négociation par annonce,
-- pour toujours. La même annonce déjà achetée est donc signalée « bloquee » tant que le propriétaire n'a pas décidé
-- de remplacer cette contrainte (voir docs/PASSATION.md, décision en attente).

-- ——— Préparer un rachat ———
create or replace function public.recommande_preparer(p_cmd uuid) returns json
language sql stable security definer set search_path = public as $$
  with c as (
    select k.*, n.cible, n.cible_id,
      coalesce(o.product_slug, d.product_slug) slug, coalesce(o.region_slug, d.region_slug) region
    from public.commandes k
    left join public.negociations n on n.id = k.negociation_id
    left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
    left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
    where k.id = p_cmd and k.acheteur_id = auth.uid()
  ),
  cand as (
    select o.id, o.user_id, o.price prix, o.quantity dispo, o.unit unite, o.city ville, o.region_slug region, o.negociable, o.created_at,
      case when o.id = c.cible_id and c.cible = 'offre' then 'meme_offre' when o.user_id = c.vendeur_id then 'meme_vendeur' else 'autre' end genre,
      (select g.statut from public.negociations g where g.cible = 'offre' and g.cible_id = o.id and g.auteur_id = auth.uid()) deja_statut,
      (select g.id from public.negociations g where g.cible = 'offre' and g.cible_id = o.id and g.auteur_id = auth.uid()) deja_id
    from public.offres o, c
    where o.status = 'active' and o.product_slug = c.slug and o.user_id <> auth.uid()
      and not exists (select 1 from public.bannis b where b.user_id = o.user_id)
  ),
  autres as (
    select * from cand where genre = 'autre'
    order by (region = (select region from c)) desc, (unite = (select unite from c)) desc, prix asc nulls last limit 5
  ),
  sel as (select * from cand where genre <> 'autre' union all select * from autres)
  select json_build_object(
    'commande', (select json_build_object('id', id, 'numero', numero, 'produit', produit, 'slug', slug, 'quantite', quantite, 'unite', unite,
                   'prix_unitaire', prix_unitaire, 'vendeur_id', vendeur_id, 'vendeur', coalesce(public.nom_public(vendeur_id), 'Membre'),
                   'termine_le', termine_le, 'etat', etat, 'source', cible) from c),
    'offres', coalesce((select json_agg(json_build_object('id', s.id, 'genre', s.genre, 'prix', s.prix, 'dispo', s.dispo, 'unite', s.unite,
                   'ville', s.ville, 'region', s.region, 'negociable', s.negociable, 'publiee_le', s.created_at,
                   'vendeur_id', s.user_id, 'vendeur', coalesce(public.nom_public(s.user_id), 'Membre'), 'verifie', public.identite_ok(s.user_id),
                   'ouverte_id', case when s.deja_statut = 'ouverte' then s.deja_id end,
                   'bloquee', s.deja_statut is not null and s.deja_statut <> 'ouverte')
                 order by case s.genre when 'meme_offre' then 0 when 'meme_vendeur' then 1 else 2 end, s.prix) from sel s), '[]'::json),
    'calcule_le', now())
  where exists (select 1 from c);
$$;

-- ——— Rappels d'achat ———
create table if not exists public.rappels_achat (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  commande_id   uuid not null references public.commandes (id) on delete cascade,
  produit       text not null check (char_length(produit) <= 120),
  frequence     text not null check (frequence in ('quotidien', 'hebdomadaire')),
  jour          smallint check (jour between 1 and 7),
  heure         smallint not null check (heure between 5 and 21),
  actif         boolean not null default true,
  prochain_le   timestamptz not null,
  dernier_envoi timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, commande_id),
  check ((frequence = 'quotidien' and jour is null) or (frequence = 'hebdomadaire' and jour is not null))
);
create index if not exists rappels_achat_prochain on public.rappels_achat (prochain_le) where actif;
alter table public.rappels_achat enable row level security;
revoke all on public.rappels_achat from anon, authenticated;

-- ——— Mes achats habituels ———
create or replace function public.mes_achats_habituels() returns json
language sql stable security definer set search_path = public as $$
  with t as (
    select k.*, coalesce(o.product_slug, d.product_slug) slug
    from public.commandes k
    left join public.negociations n on n.id = k.negociation_id
    left join public.offres o on n.cible = 'offre' and o.id = n.cible_id
    left join public.demandes d on n.cible = 'demande' and d.id = n.cible_id
    where k.acheteur_id = auth.uid() and k.etat = 'terminee'
  ),
  g as (
    select distinct on (coalesce(slug, produit), unite) coalesce(slug, produit) cle, slug, produit, unite, id derniere_commande, quantite, prix_unitaire,
      vendeur_id, termine_le,
      count(*) over (partition by coalesce(slug, produit), unite) fois
    from t order by coalesce(slug, produit), unite, termine_le desc nulls last
  )
  select coalesce(json_agg(json_build_object('cle', cle, 'slug', slug, 'produit', produit, 'unite', unite, 'commande_id', derniere_commande,
           'quantite', quantite, 'prix_unitaire', prix_unitaire, 'vendeur', coalesce(public.nom_public(vendeur_id), 'Membre'),
           'dernier', termine_le, 'fois', fois,
           'rappel', (select json_build_object('id', r.id, 'frequence', r.frequence, 'jour', r.jour, 'heure', r.heure, 'actif', r.actif, 'prochain_le', r.prochain_le)
                      from public.rappels_achat r where r.user_id = auth.uid() and r.commande_id = g.derniere_commande))
         order by termine_le desc), '[]'::json)
  from g;
$$;

-- prochaine échéance (heure d'Abidjan = UTC, sans heure d'été)
create or replace function public._rappel_prochain(p_freq text, p_jour smallint, p_heure smallint, p_apres timestamptz) returns timestamptz
language plpgsql immutable set search_path = public as $$
declare base timestamptz := date_trunc('day', p_apres at time zone 'UTC') at time zone 'UTC' + make_interval(hours => p_heure); k int;
begin
  if p_freq = 'quotidien' then
    if base <= p_apres then base := base + interval '1 day'; end if;
    return base;
  end if;
  k := (p_jour - extract(isodow from base)::int + 7) % 7;
  base := base + make_interval(days => k);
  if base <= p_apres then base := base + interval '7 days'; end if;
  return base;
end $$;

create or replace function public.rappel_regler(p_cmd uuid, p_frequence text, p_jour int, p_heure int) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r public.rappels_achat; n int;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into c from public.commandes where id = p_cmd and acheteur_id = me;
  if c.id is null then raise exception 'Commande introuvable.'; end if;
  if c.etat <> 'terminee' then raise exception 'Un rappel se règle à partir d''une commande terminée.'; end if;
  if p_frequence not in ('quotidien', 'hebdomadaire') then raise exception 'Fréquence : quotidien ou hebdomadaire.'; end if;
  if p_heure is null or p_heure not between 5 and 21 then raise exception 'Heure entre 5 h et 21 h.'; end if;
  if p_frequence = 'hebdomadaire' and (p_jour is null or p_jour not between 1 and 7) then raise exception 'Choisissez le jour de la semaine.'; end if;
  select count(*) into n from public.rappels_achat where user_id = me and actif and commande_id <> c.id;
  if n >= 10 then raise exception 'Limite : 10 rappels actifs. Arrêtez-en un d''abord.'; end if;
  insert into public.rappels_achat (user_id, commande_id, produit, frequence, jour, heure, prochain_le)
  values (me, c.id, coalesce(c.produit, 'Produit'), p_frequence, case when p_frequence = 'hebdomadaire' then p_jour end, p_heure,
          public._rappel_prochain(p_frequence, case when p_frequence = 'hebdomadaire' then p_jour end::smallint, p_heure::smallint, now()))
  on conflict (user_id, commande_id) do update set frequence = excluded.frequence, jour = excluded.jour, heure = excluded.heure,
    actif = true, prochain_le = excluded.prochain_le, updated_at = now()
  returning * into r;
  return json_build_object('id', r.id, 'frequence', r.frequence, 'jour', r.jour, 'heure', r.heure, 'actif', r.actif, 'prochain_le', r.prochain_le);
end $$;

create or replace function public.rappel_arreter(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.rappels_achat set actif = false, updated_at = now() where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Rappel introuvable.'; end if;
end $$;

create or replace function public.mes_rappels() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', id, 'commande_id', commande_id, 'produit', produit, 'frequence', frequence, 'jour', jour,
           'heure', heure, 'actif', actif, 'prochain_le', prochain_le, 'dernier_envoi', dernier_envoi) order by actif desc, prochain_le), '[]'::json)
  from public.rappels_achat where user_id = auth.uid();
$$;

-- envoi (pg_cron, toutes les 15 minutes) : une notification par rappel échu, puis l'échéance suivante
create or replace function public.rappels_envoyer() returns int
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; r record; n int := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  for r in select * from public.rappels_achat where actif and prochain_le <= now() for update skip locked loop
    if v_url is not null and v_cle is not null and not public.est_banni(r.user_id) then
      perform net.http_post(url := v_url, body := jsonb_build_object('rappel_id', r.id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
      n := n + 1;
    end if;
    update public.rappels_achat set dernier_envoi = now(),
      prochain_le = public._rappel_prochain(r.frequence, r.jour, r.heure, greatest(now(), r.prochain_le)) where id = r.id;
  end loop;
  return n;
end $$;

revoke all on function public._rappel_prochain(text, smallint, smallint, timestamptz), public.rappels_envoyer() from public, anon, authenticated;
revoke all on function public.recommande_preparer(uuid), public.mes_achats_habituels(), public.rappel_regler(uuid, text, int, int),
  public.rappel_arreter(uuid), public.mes_rappels() from public, anon;
grant execute on function public.recommande_preparer(uuid), public.mes_achats_habituels(), public.rappel_regler(uuid, text, int, int),
  public.rappel_arreter(uuid), public.mes_rappels() to authenticated;

select cron.schedule('mdg-rappels-achat', '*/15 * * * *', 'select public.rappels_envoyer()');
