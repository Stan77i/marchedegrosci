-- Schéma 87b : « Ville seulement », la ville qui compte (24/10/2026, demande du propriétaire)
-- Pour une localité « Guiglo (près de Abidjan) », la vente ou l'achat « uniquement à » se rapporte à la ville de rattachement (Abidjan),
-- celle de la région choisie, pas au nom du village tapé. Même règle que l'application (app/ville-seule.js, nom()).

create or replace function public._ville_ref(v text)
returns text language sql immutable set search_path = public as $$
  select btrim(coalesce(substring(coalesce(v, '') from '\(près de ([^)]+)\)\s*$'), coalesce(v, '')))
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
    if public._ville_cle(p_arr) is distinct from public._ville_cle(nom) then
      return 'Ce vendeur vend uniquement à ' || nom || ' : la livraison doit se faire à ' || nom || '.';
    end if;
  elsif public._ville_cle(p_dep) is distinct from public._ville_cle(nom) then
    return 'Cet acheteur achète uniquement à ' || nom || ' : la marchandise doit se trouver à ' || nom || '.';
  end if;
  return null;
end $$;
revoke execute on function public._ville_seulement_refus(text, uuid, text, text) from public, anon, authenticated;

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
     and position(public._ville_cle(public._ville_ref(dep)) in public._ville_cle(lieu)) = 0 then
    raise exception 'Ce vendeur vend uniquement à % : la livraison doit se faire à %. Mettez à jour l''application, ou écrivez % dans le lieu de livraison.',
      public._ville_ref(dep), public._ville_ref(dep), public._ville_ref(dep);
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
