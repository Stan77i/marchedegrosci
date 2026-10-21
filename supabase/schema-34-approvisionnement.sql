-- ═════════ Marché de Gros CI — schéma 34 : approvisionnement professionnel ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop ; une colonne ajoutée (nullable) à demandes, rien d'effacé.
--
-- Un BESOIN (restaurant, hôtel, cantine, revendeur…) regroupe plusieurs produits. Chaque produit devient une vraie DEMANDE
-- (table demandes, besoin_id) : elle profite de tout l'existant (alertes produit, carte, « J'ai / Je cherche », négociation).
--   • le besoin précise : fréquence (ponctuelle, hebdomadaire, mensuelle), période de livraison, zone, prix cible facultatif
--     par produit (= budget de la demande), exigences ;
--   • un vendeur répond par produit avec prix, quantité, stock disponible et délai (besoin_repondre → nego_ouvrir) ;
--   • l'acheteur compare les propositions (besoin_comparer) et choisit en ouvrant la négociation, où il accepte ;
--   • une demande ou une proposition n'est PAS une vente : la commission (schéma 30) ne naît qu'avec une commande.
-- Chaque ligne compte comme une annonce publiée (règle des 3 annonces gratuites, puis vérification d'identité).

create table if not exists public.besoins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  titre           text not null check (char_length(titre) between 3 and 80),
  type_acheteur   text not null check (type_acheteur in ('restaurant', 'hotel', 'cantine', 'revendeur', 'autre')),
  frequence       text not null check (frequence in ('ponctuelle', 'hebdomadaire', 'mensuelle')),
  livraison_debut date not null,
  livraison_fin   date,
  region_slug     text not null check (char_length(region_slug) <= 60),
  ville           text check (char_length(ville) <= 80),
  exigences       text check (char_length(exigences) <= 400),
  statut          text not null default 'ouvert' check (statut in ('ouvert', 'pourvu', 'clos')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (livraison_fin is null or livraison_fin >= livraison_debut)
);
create index if not exists besoins_ouverts on public.besoins (statut, region_slug, created_at desc);
create index if not exists besoins_user on public.besoins (user_id, created_at desc);
alter table public.besoins enable row level security;
revoke all on public.besoins from anon, authenticated;

alter table public.demandes add column if not exists besoin_id uuid references public.besoins (id) on delete set null;
create index if not exists demandes_besoin on public.demandes (besoin_id) where besoin_id is not null;

create table if not exists public.proposition_details (
  negociation_id uuid primary key references public.negociations (id) on delete cascade,
  stock          numeric check (stock >= 0),
  delai_jours    smallint check (delai_jours between 0 and 90),
  updated_at     timestamptz not null default now()
);
alter table public.proposition_details enable row level security;
revoke all on public.proposition_details from anon, authenticated;

-- ——— Publier un besoin (avec ses produits) ———
create or replace function public.besoin_creer(p_titre text, p_type text, p_frequence text, p_debut date, p_fin date,
  p_region text, p_ville text, p_exigences text, p_lignes jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b uuid; l jsonb; i int := 0; t text; r text; dl text; nom text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if (select count(*) from public.besoins where user_id = me and statut = 'ouvert') >= 10 then raise exception 'Limite : 10 besoins ouverts. Clôturez-en un d''abord.'; end if;
  if p_debut is null or p_debut < current_date then raise exception 'La date de livraison doit être aujourd''hui ou plus tard.'; end if;
  if p_fin is not null and p_fin < p_debut then raise exception 'La fin de la période doit suivre son début.'; end if;
  if p_debut > current_date + 365 then raise exception 'Date de livraison trop lointaine (un an au plus).'; end if;
  if jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 10 then raise exception 'De 1 à 10 produits par besoin.'; end if;
  t := concat_ws(' · ', p_titre, p_ville, p_exigences);
  if not public.est_admin() then r := public.texte_refus(t); if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if; end if;
  insert into public.besoins (user_id, titre, type_acheteur, frequence, livraison_debut, livraison_fin, region_slug, ville, exigences)
  values (me, btrim(p_titre), p_type, p_frequence, p_debut, p_fin, p_region, nullif(btrim(p_ville), ''), nullif(btrim(p_exigences), ''))
  returning id into b;
  dl := case when p_debut <= current_date + 3 then 'vite' when p_debut <= current_date + 10 then 'semaine' else 'mois' end;
  nom := coalesce(public.nom_public(me), 'Acheteur');
  for l in select * from jsonb_array_elements(p_lignes) loop
    i := i + 1;
    if coalesce((l->>'quantite')::numeric, 0) <= 0 then raise exception 'Quantité manquante pour le produit %.', i; end if;
    if coalesce(l->>'slug', '') !~ '^[a-z0-9-]{1,80}$' then raise exception 'Produit inconnu (ligne %).', i; end if;
    insert into public.demandes (user_id, client_id, product_slug, product_label, region_slug, city, quantity, unit, budget, deadline,
      buyer_type, buyer_name, phone, status, negociable, besoin_id)
    values (me, 'besoin-' || b || '-' || i, l->>'slug', left(coalesce(l->>'label', l->>'slug'), 120), p_region, nullif(btrim(p_ville), ''),
      (l->>'quantite')::numeric, left(coalesce(nullif(l->>'unite', ''), 'kg'), 20), nullif((l->>'prix_cible')::numeric, 0), dl,
      case p_type when 'restaurant' then 'Restaurant' when 'hotel' then 'Hôtel' when 'cantine' then 'Cantine' when 'revendeur' then 'Revendeur' else 'Professionnel' end,
      nom, null, 'active', true, b);
  end loop;
  return b;
end $$;

-- ——— Lire un besoin (public, comme les demandes) ———
create or replace function public.besoin_public(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', b.id, 'titre', b.titre, 'type', b.type_acheteur, 'frequence', b.frequence,
    'debut', b.livraison_debut, 'fin', b.livraison_fin, 'region', b.region_slug, 'ville', b.ville, 'exigences', b.exigences,
    'statut', b.statut, 'cree_le', b.created_at, 'acheteur_id', b.user_id, 'acheteur', coalesce(public.nom_public(b.user_id), 'Acheteur'),
    'verifie', public.identite_ok(b.user_id), 'moi', b.user_id = auth.uid(),
    'lignes', coalesce((select json_agg(json_build_object('demande_id', d.id, 'slug', d.product_slug, 'produit', d.product_label, 'quantite', d.quantity,
                 'unite', d.unit, 'prix_cible', d.budget, 'statut', d.status,
                 'ma_nego', (select g.id from public.negociations g where g.cible = 'demande' and g.cible_id = d.id and g.auteur_id = auth.uid()),
                 'propositions', (select count(*) from public.negociations g where g.cible = 'demande' and g.cible_id = d.id))
               order by d.client_id) from public.demandes d where d.besoin_id = b.id), '[]'::json))
  from public.besoins b
  where b.id = p_id and not exists (select 1 from public.bannis x where x.user_id = b.user_id);
$$;

-- ——— Les besoins ouverts (pour les vendeurs), et les miens ———
create or replace function public.besoins_liste(p_vue text, p_region text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.cree_le desc), '[]'::json) from (
    select b.id, b.titre, b.type_acheteur type, b.frequence, b.livraison_debut debut, b.livraison_fin fin, b.region_slug region, b.ville,
      b.statut, b.created_at cree_le, coalesce(public.nom_public(b.user_id), 'Acheteur') acheteur, public.identite_ok(b.user_id) verifie,
      (select count(*) from public.demandes d where d.besoin_id = b.id and d.status = 'active') lignes,
      (select string_agg(d.product_label, ', ' order by d.client_id) from public.demandes d where d.besoin_id = b.id) produits,
      (select count(*) from public.negociations g join public.demandes d on g.cible = 'demande' and g.cible_id = d.id where d.besoin_id = b.id) propositions
    from public.besoins b
    where (p_vue = 'miens' and b.user_id = auth.uid())
       or (p_vue = 'ouverts' and b.statut = 'ouvert' and b.user_id is distinct from auth.uid()
           and (p_region is null or b.region_slug = p_region)
           and coalesce(b.livraison_fin, b.livraison_debut) >= current_date
           and not exists (select 1 from public.bannis x where x.user_id = b.user_id))
    order by b.created_at desc limit 100) x;
$$;

-- ——— Répondre à une ligne (vendeur) : prix, quantité, stock, délai ———
create or replace function public.besoin_repondre(p_demande uuid, p_prix numeric, p_quantite numeric, p_stock numeric, p_delai_jours int, p_note text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare d public.demandes; n uuid; b public.besoins;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into d from public.demandes where id = p_demande;
  if d.id is null or d.besoin_id is null then raise exception 'Besoin introuvable.'; end if;
  select * into b from public.besoins where id = d.besoin_id;
  if b.statut <> 'ouvert' then raise exception 'Ce besoin n''accepte plus de propositions.'; end if;
  if p_prix is null or p_prix <= 0 then raise exception 'Indiquez votre prix.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Indiquez la quantité proposée.'; end if;
  if p_stock is not null and p_stock < p_quantite then raise exception 'Le stock disponible doit couvrir la quantité proposée.'; end if;
  if p_delai_jours is not null and p_delai_jours not between 0 and 90 then raise exception 'Délai entre 0 et 90 jours.'; end if;
  n := public.nego_ouvrir('demande', p_demande, p_prix, p_quantite, nullif(btrim(p_note), ''));
  insert into public.proposition_details (negociation_id, stock, delai_jours) values (n, p_stock, p_delai_jours)
  on conflict (negociation_id) do update set stock = excluded.stock, delai_jours = excluded.delai_jours, updated_at = now();
  return n;
end $$;

-- ——— Comparer les propositions (l'acheteur seulement) ———
create or replace function public.besoin_comparer(p_besoin uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('demande_id', d.id, 'produit', d.product_label, 'quantite', d.quantity, 'unite', d.unit,
      'prix_cible', d.budget, 'statut', d.status,
      'propositions', coalesce((select json_agg(json_build_object(
            'nego_id', g.id, 'statut', g.statut, 'vendeur_id', g.auteur_id, 'vendeur', coalesce(public.nom_public(g.auteur_id), 'Vendeur'),
            'prix', g.dernier_prix, 'quantite', coalesce(g.dernier_quantite, g.quantite), 'dernier_par_moi', g.dernier_par = auth.uid(),
            'stock', p.stock, 'delai_jours', p.delai_jours, 'maj', g.updated_at, 'verifie', public.identite_ok(g.auteur_id),
            'reputation', (select r->'vendeur' from (select public.reputation_publique(g.auteur_id) r) z))
          order by g.dernier_prix asc nulls last)
        from public.negociations g left join public.proposition_details p on p.negociation_id = g.id
        where g.cible = 'demande' and g.cible_id = d.id and g.statut in ('ouverte', 'conclue')), '[]'::json))
    order by d.client_id), '[]'::json)
  from public.demandes d join public.besoins b on b.id = d.besoin_id
  where d.besoin_id = p_besoin and b.user_id = auth.uid();
$$;

-- ——— Changer le statut (l'acheteur) : pourvu ou clos retire les produits encore en ligne ———
create or replace function public.besoin_statut(p_id uuid, p_statut text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_statut not in ('ouvert', 'pourvu', 'clos') then raise exception 'Statut inconnu.'; end if;
  update public.besoins set statut = p_statut, updated_at = now() where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Besoin introuvable.'; end if;
  if p_statut <> 'ouvert' then
    update public.demandes set status = 'retiree' where besoin_id = p_id and status = 'active';
  end if;
end $$;

revoke all on function public.besoin_creer(text, text, text, date, date, text, text, text, jsonb), public.besoin_repondre(uuid, numeric, numeric, numeric, int, text),
  public.besoin_comparer(uuid), public.besoin_statut(uuid, text) from public, anon;
grant execute on function public.besoin_creer(text, text, text, date, date, text, text, text, jsonb), public.besoin_repondre(uuid, numeric, numeric, numeric, int, text),
  public.besoin_comparer(uuid), public.besoin_statut(uuid, text) to authenticated;
revoke all on function public.besoin_public(uuid), public.besoins_liste(text, text) from public;
grant execute on function public.besoin_public(uuid), public.besoins_liste(text, text) to anon, authenticated;
