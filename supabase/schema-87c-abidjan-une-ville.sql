-- Schéma 87c : Abidjan est une seule ville (règle du propriétaire, 24/10/2026).
-- Une commune d'Abidjan (Cocody, Yopougon…) compte comme « Abidjan » pour « vendre / acheter uniquement à » et pour « même ville ».
-- Même liste que app/villes.js (région abidjan) et app/ville-seule.js.
create or replace function public._ville_ref(v text)
returns text language sql immutable set search_path = public as $$
  select case when public._ville_cle(r) in ('abidjan', 'abobo', 'adjame', 'anyama', 'attecoube', 'bingerville', 'cocody', 'koumassi',
      'marcory', 'plateau', 'portbouet', 'songon', 'treichville', 'yopougon') then 'Abidjan' else r end
  from (select btrim(coalesce(substring(coalesce(v, '') from '\(près de ([^)]+)\)\s*$'), coalesce(v, ''))) as r) x
$$;

create or replace function public._ville_seulement_refus(p_cible text, p_id uuid, p_dep text, p_arr text)
returns text language plpgsql stable security definer set search_path = public as $$
declare vs boolean; c text; nom text;
begin
  if p_cible = 'offre' then select o.ville_seulement, o.city into vs, c from public.offres o where o.id = p_id;
  else select d.ville_seulement, d.city into vs, c from public.demandes d where d.id = p_id; end if;
  if not coalesce(vs, false) or public._ville_cle(c) = '' then return null; end if;
  nom := public._ville_ref(c);
  if p_cible = 'offre' then
    if public._ville_cle(public._ville_ref(p_arr)) is distinct from public._ville_cle(nom) then
      return 'Ce vendeur vend uniquement à ' || nom || ' : la livraison doit se faire à ' || nom || '.';
    end if;
  elsif public._ville_cle(public._ville_ref(p_dep)) is distinct from public._ville_cle(nom) then
    return 'Cet acheteur achète uniquement à ' || nom || ' : la marchandise doit se trouver à ' || nom || '.';
  end if;
  return null;
end $$;
revoke execute on function public._ville_seulement_refus(text, uuid, text, text) from public, anon, authenticated;

-- « même ville » : Cocody → Yopougon, c'est la même ville (Abidjan)
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
  meme := public._ville_cle(public._ville_ref(dep)) = public._ville_cle(public._ville_ref(arr));
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
