-- Schéma 101b : la commande d'un achat groupé reprend le transport écrit dans l'offre (décision juridique n° 14).
-- Avant (schéma 93d) : toujours mode_transport = 'vendeur', sans règle de transport.
-- Maintenant, pour chaque participant :
--   offre « inclus » (ou « hors_ville » livré dans une autre ville)  → le vendeur livre, transport inclus (transport_regle = 'inclus') ;
--   offre « non » ou « hors_ville » dans la même ville :
--     frais de transport donnés par le vendeur pour le groupe        → le vendeur livre, transport à part (transport_regle = 'a_part'),
--                                                                       prix = part du participant, au prorata de sa quantité ;
--     sinon                                                           → transport à la charge de l'acheteur (mode 'acheteur', transport_regle = 'acheteur') ;
--   offre sans transport écrit (anciennes annonces)                   → inchangé : 'vendeur', sans règle.
-- total_convenu = marchandise (+ part du transport à part), comme commande_creer2. Le reste de la fonction est celui du schéma 93d.
create or replace function public._groupe_evaluer(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; o public.offres; total numeric; pf numeric; p record; cid uuid; num text; offi boolean; arr text;
  meme boolean; mode text; regle text; part numeric; mt numeric;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.statut <> 'en_attente_confirmation' then return g.statut; end if;
  total := public._groupe_total(g.id);
  if total < g.objectif or public._groupe_n(g.id) < g.min_participants then
    if g.confirmer_avant <= now() or g.date_limite <= now() then update public.groupes_achat set statut = 'expire', updated_at = now() where id = g.id; return 'expire'; end if;
    update public.groupes_achat set statut = 'ouvert', prix_final = null, confirmer_avant = null, updated_at = now() where id = g.id;
    update public.groupe_participants set statut = 'inscrit', confirme_le = null where groupe_id = g.id and statut = 'confirme';
    return 'ouvert';
  end if;
  pf := public._groupe_prix(g, total);
  if pf > coalesce(g.prix_final, pf) then
    update public.groupe_participants set statut = 'inscrit', confirme_le = null where groupe_id = g.id and statut = 'confirme';
  end if;
  update public.groupes_achat set prix_final = pf, updated_at = now() where id = g.id;
  if exists (select 1 from public.groupe_participants where groupe_id = g.id and statut = 'inscrit') then return 'en_attente_confirmation'; end if;
  select * into o from public.offres where id = g.offre_id for update;
  if o.status <> 'active' or coalesce(o.quantity, 0) < total then
    update public.groupes_achat set statut = 'expire', updated_at = now() where id = g.id;
    return 'stock_insuffisant';
  end if;
  offi := public.est_admin_id(g.vendeur_id);
  arr := case when coalesce(o.ville_seulement, false) and public._ville_cle(o.city) <> '' then public._ville_ref(o.city) end;
  meme := case when arr is not null then true
               when public._ville_cle(coalesce(o.city, '')) <> '' and public._ville_cle(coalesce(g.zone, '')) <> ''
                 then public._ville_cle(public._ville_ref(o.city)) = public._ville_cle(public._ville_ref(g.zone))
               else false end;
  perform set_config('mdg.groupe_en_cours', g.id::text, true);
  update public.offres set quantity = quantity - total where id = o.id;
  update public.offres set status = 'retiree' where id = o.id and quantity <= 0 and status = 'active';
  perform set_config('mdg.groupe_en_cours', '', true);
  for p in select * from public.groupe_participants where groupe_id = g.id and statut = 'confirme' loop
    num := 'MDG-G-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || p.id::text), 1, 6));
    mt := round(pf * p.quantite, 0);
    part := case when coalesce(g.frais_transport, 0) > 0 and total > 0 then nullif(round(g.frais_transport * p.quantite / total, 0), 0) end;
    if o.transport is null then mode := 'vendeur'; regle := null; part := null;
    elsif o.transport = 'inclus' or (o.transport = 'hors_ville' and not meme) then mode := 'vendeur'; regle := 'inclus'; part := null;
    elsif part is not null and part < 100000000 then mode := 'vendeur'; regle := 'a_part';
    else mode := 'acheteur'; regle := 'acheteur'; part := null;
    end if;
    insert into public.commandes (numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
      ville_depart, ville_arrivee, lieu_livraison, commission_montant, mode_transport, validation, etat, etape, groupe_id,
      meme_ville, transport_regle, prix_transport, total_convenu)
    values (num, null, g.vendeur_id, p.user_id, g.vendeur_id, g.produit, p.quantite, g.unite, pf, mt,
      left(o.city, 80), left(arr, 80), left(g.zone, 120), case when offi then 0 else round(mt * 0.035, 0) end,
      mode, 'declaration', 'en_cours', 'confirmee', g.id,
      meme, regle, part, case when regle is null then null else mt + coalesce(part, 0) end)
    returning id into cid;
    perform public._cmd_journal(cid, 'confirmee', p.user_id, 'acheteur', 'declaration', null, null, null, 'Achat groupé : participation confirmée');
    update public.groupe_participants set commande_id = cid where id = p.id;
  end loop;
  update public.groupes_achat set statut = 'confirme', updated_at = now() where id = g.id;
  return 'confirme';
end $$;
