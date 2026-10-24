-- Schéma 87 : « Ville seulement » (24/10/2026)
-- Un vendeur peut dire « je vends uniquement dans ma ville » (offre) et un acheteur « j'achète uniquement dans ma ville » (demande).
-- La ville de référence est la ville déjà saisie dans l'annonce (colonne city).
-- Règle serveur : commande_creer2 refuse une commande dont la ville de livraison (offre) ou la ville de la marchandise (demande)
-- n'est pas cette ville (comparaison _ville_cle). L'ancienne commande_creer (anciennes versions de l'application) refuse aussi
-- une offre « ville seulement » si le lieu de livraison ne nomme pas la ville.
-- fil_public2 : comme fil_public (schéma 80), avec ville_seulement en plus (aucune donnée privée).
-- Appliqué sur le projet de test puis en production le 24/10/2026.
-- (fichier sans les mots interdits par le MCP ; tout est en add column if not exists / create or replace)

alter table public.offres add column if not exists ville_seulement boolean not null default false;
alter table public.demandes add column if not exists ville_seulement boolean not null default false;
comment on column public.offres.ville_seulement is 'Vente uniquement dans la ville de l''annonce (city) : la livraison doit se faire dans cette ville (schéma 87).';
comment on column public.demandes.ville_seulement is 'Achat uniquement dans la ville de l''annonce (city) : la marchandise doit se trouver dans cette ville (schéma 87).';
grant update (ville_seulement) on public.offres to authenticated;
grant update (ville_seulement) on public.demandes to authenticated;

-- la ville affichée : « Napié (près de Ferkessédougou) » → « Napié »
create or replace function public._ville_nom(v text)
returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(coalesce(v, ''), '\s*\(près de [^)]*\)\s*$', ''))
$$;

-- le refus « ville seulement », ou null si la commande respecte la règle
create or replace function public._ville_seulement_refus(p_cible text, p_id uuid, p_dep text, p_arr text)
returns text language plpgsql stable security definer set search_path = public as $$
declare vs boolean; c text; nom text;
begin
  if p_cible = 'offre' then select o.ville_seulement, o.city into vs, c from public.offres o where o.id = p_id;
  else select d.ville_seulement, d.city into vs, c from public.demandes d where d.id = p_id; end if;
  if not coalesce(vs, false) or public._ville_cle(c) = '' then return null; end if;
  nom := public._ville_nom(c);
  if p_cible = 'offre' then
    if public._ville_cle(p_arr) is distinct from public._ville_cle(c) then
      return 'Ce vendeur vend uniquement à ' || nom || ' : la livraison doit se faire à ' || nom || '.';
    end if;
  elsif public._ville_cle(p_dep) is distinct from public._ville_cle(c) then
    return 'Cet acheteur achète uniquement à ' || nom || ' : la marchandise doit se trouver à ' || nom || '.';
  end if;
  return null;
end $$;
revoke execute on function public._ville_seulement_refus(text, uuid, text, text) from public, anon, authenticated;

-- commande_creer2 (schéma 83b) + la règle « ville seulement »
create or replace function public.commande_creer2(p_nego uuid, p_mode text, p_lieu text default null, p_ville_arrivee text default null, p_ville_depart text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); n public.negociations; dep text; arr text; meme boolean; inclus boolean; apart boolean; regle text; cid uuid; mt numeric; refus text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into n from public.negociations where id = p_nego;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.cible = 'offre' then
    select city into dep from public.offres where id = n.cible_id;
    dep := coalesce(dep, n.ville);
    arr := public._cmd_texte(p_ville_arrivee, 80);
    if arr is null then raise exception 'Choisissez la ville de livraison.'; end if;
  else
    arr := coalesce(public._cmd_texte(p_ville_arrivee, 80), n.ville);
    dep := public._cmd_texte(p_ville_depart, 80);
    if dep is null then raise exception 'Choisissez la ville où se trouve la marchandise.'; end if;
  end if;
  refus := public._ville_seulement_refus(n.cible, n.cible_id, dep, arr);
  if refus is not null then raise exception '%', refus; end if;
  perform set_config('mgci.ville_verifiee', '1', true);
  meme := public._ville_cle(dep) = public._ville_cle(arr);
  inclus := coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id));
  apart := not inclus and n.prix_transport_final is not null;
  if p_mode = 'acheteur' and apart then
    raise exception 'Le transport à part est convenu avec le vendeur : c''est lui qui livre, ou un transporteur du réseau Marché de Gros.';
  end if;
  regle := case when p_mode = 'reseau' then 'mgci' when inclus then 'inclus' when apart then 'a_part'
                when p_mode = 'vendeur' then 'livreur_vendeur' when meme then 'retrait' else 'acheteur' end;
  cid := public.commande_creer(p_nego, p_mode, p_lieu, case when p_mode = 'reseau' then 'code' else 'declaration' end);
  perform set_config('mgci.ville_verifiee', '', true);
  select montant into mt from public.commandes where id = cid;
  update public.commandes set ville_depart = left(dep, 80), ville_arrivee = left(arr, 80), meme_ville = meme, transport_regle = regle,
    prix_transport = case when regle = 'a_part' then round(n.prix_transport_final, 0) end,
    total_convenu = case when mt is null or regle = 'mgci' then null when regle = 'a_part' then round(mt, 0) + round(n.prix_transport_final, 0) else round(mt, 0) end
  where id = cid;
  return cid;
end $function$;

-- commande_creer (ancienne application) : une offre « ville seulement » exige que le lieu de livraison nomme la ville
create or replace function public.commande_creer(p_nego uuid, p_mode text, p_lieu text default null, p_validation text default 'declaration')
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); n public.negociations; v uuid; a uuid; dep text; mt numeric; cid uuid := gen_random_uuid(); lieu text; val text; vs boolean;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into n from public.negociations where id = p_nego for update;
  if n.id is null or me not in (n.auteur_id, n.proprio_id) then raise exception 'Accord introuvable.'; end if;
  if n.statut <> 'conclue' then raise exception 'La commande se crée après un accord conclu.'; end if;
  if exists (select 1 from public.commandes where negociation_id = p_nego) then raise exception 'Une commande existe déjà pour cet accord.'; end if;
  if p_mode not in ('reseau', 'acheteur', 'vendeur') then raise exception 'Choisissez qui transporte la marchandise.'; end if;
  val := case when p_mode = 'reseau' then 'code' else 'declaration' end;
  if p_mode <> 'vendeur' and coalesce(n.transport_final, public._transport_vendeur(n.cible, n.cible_id)) then
    raise exception 'Le transport est inclus dans le prix du vendeur : c''est lui qui transporte.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if n.cible = 'offre' then v := n.proprio_id; a := n.auteur_id; select city, ville_seulement into dep, vs from public.offres where id = n.cible_id;
  else v := n.auteur_id; a := n.proprio_id; end if;
  -- schéma 87 : appel direct (ancienne application), sans ville de livraison choisie
  if coalesce(vs, false) and public._ville_cle(dep) <> '' and coalesce(current_setting('mgci.ville_verifiee', true), '') <> '1'
     and position(public._ville_cle(public._ville_nom(dep)) in public._ville_cle(lieu)) = 0 then
    raise exception 'Ce vendeur vend uniquement à % : la livraison doit se faire à %. Mettez à jour l''application, ou écrivez % dans le lieu de livraison.',
      public._ville_nom(dep), public._ville_nom(dep), public._ville_nom(dep);
  end if;
  mt := case when n.prix_final is not null and coalesce(n.quantite_finale, n.quantite) is not null then round(n.prix_final * coalesce(n.quantite_finale, n.quantite)) end;
  insert into public.commandes (id, numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
    ville_depart, lieu_livraison, commission_montant, mode_transport, validation)
  values (cid, 'MDG-C-' || to_char(now(), 'YYMMDD') || '-' || upper(left(replace(cid::text, '-', ''), 6)), p_nego, v, a, me,
    n.produit, coalesce(n.quantite_finale, n.quantite), n.unite, n.prix_final, mt,
    coalesce(dep, n.ville), lieu, case when mt is null then null when public.est_admin_id(v) then 0 else round(mt * 0.035) end, p_mode, val);
  perform public._cmd_journal(cid, 'creee', me, case when me = v then 'vendeur' else 'acheteur' end, 'declaration', lieu);
  return cid;
end $function$;

-- le fil public du site (schéma 80) avec « ville seulement » : même contenu, une colonne en plus
create or replace function public.fil_public2(p_limite integer default 40)
returns table(cle text, sens text, product_slug text, produit text, quantite numeric, unite text, ville text, region_slug text, nom text, prix numeric, publie_le timestamp with time zone, ville_seulement boolean)
language sql stable security definer set search_path to 'public' as $function$
  with a as (
    select 'offre'::text s, o.id, o.product_slug, nullif(o.product_label, '') lab, o.quantity, o.unit, o.city, o.region_slug,
           o.seller_name nm, o.price px, o.created_at, o.user_id, o.ville_seulement vs
    from public.offres o where o.status = 'active' and o.created_at > now() - interval '90 days'
    union all
    select 'demande', d.id, d.product_slug, nullif(d.product_label, ''), d.quantity, d.unit, d.city, d.region_slug,
           d.buyer_name, d.budget, d.created_at, d.user_id, d.ville_seulement
    from public.demandes d where d.status = 'active' and d.created_at > now() - interval '90 days'
  )
  select left(md5(a.id::text), 12), a.s, a.product_slug, coalesce(a.lab, a.product_slug), a.quantity, a.unit,
         nullif(a.city, ''), a.region_slug,
         case when public.est_admin_id(a.user_id) then 'Marché de Gros'
              when coalesce(btrim(a.nm), '') = '' or a.nm ~ '[0-9]' then null
              else left(split_part(btrim(a.nm), ' ', 1), 24)
                   || case when split_part(regexp_replace(btrim(a.nm), '\s+', ' ', 'g'), ' ', 2) <> ''
                           then ' ' || upper(left(split_part(regexp_replace(btrim(a.nm), '\s+', ' ', 'g'), ' ', 2), 1)) || '.' else '' end
         end,
         a.px, a.created_at, coalesce(a.vs, false) and nullif(a.city, '') is not null
  from a
  order by a.created_at desc
  limit least(greatest(coalesce(p_limite, 40), 1), 120)
$function$;
grant execute on function public.fil_public2(integer) to anon, authenticated;
