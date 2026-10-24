-- Schéma 93d : achats groupés, racheter et besoins sans contournement (audit du 24/10/2026, P2 n° 11 ; P3 n° 34 ; contradictions 2 et 6).
-- Après 93a. Fichier sans les mots interdits par le MCP.
--  1. groupe_creer, groupe_rejoindre, groupe_confirmer, groupe_valider : compte suspendu refusé (le membre et le vendeur) ;
--     offre en pause refusée ; « ville seulement » : la zone de livraison du groupe doit être dans la ville de l'offre.
--  2. _groupe_evaluer : si le stock manque au moment de confirmer, le groupe passe « expiré » (les participants sont prévenus par
--     push_groupe) au lieu de rester bloqué ; la ville d'arrivée est posée sur les commandes ; compte officiel : commission 0
--     (comme commande_creer).
--  3. Offre retirée ou épuisée : ses groupes en cours sont annulés (prévenus par push_groupe).
--  4. recommande_preparer (Racheter) : plus d'offres en pause, ni d'offres « ville seulement » d'une autre ville.
--  5. besoin_repondre : refusé après la fin de la période de livraison du besoin.

-- ───────── 1. Contrôles communs d'un groupe (le texte du refus, ou null)
create or replace function public._groupe_refus(p_offre uuid, p_zone text, p_membre uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare o public.offres;
begin
  select * into o from public.offres where id = p_offre;
  if o.id is null or o.status <> 'active' then return 'L''offre du vendeur n''est plus disponible.'; end if;
  if o.pause_le is not null then return 'ANNONCE_EN_PAUSE : ce vendeur a mis cette offre en pause. Revenez plus tard.'; end if;
  if p_membre is not null and public.est_suspendu(p_membre) then
    return 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_suspendu(o.user_id) then return 'Ce vendeur est suspendu pour l''instant : pas de nouvel achat groupé avec lui.'; end if;
  if coalesce(o.ville_seulement, false) and public._ville_cle(o.city) <> '' and p_zone is not null
     and position(public._ville_cle(public._ville_ref(o.city)) in public._ville_cle(public._ville_ref(p_zone))) = 0 then
    return 'Ce vendeur vend uniquement à ' || public._ville_ref(o.city) || ' : la livraison du groupe doit se faire à ' || public._ville_ref(o.city) || '.';
  end if;
  return null;
end $$;
revoke all on function public._groupe_refus(uuid, text, uuid) from public, anon, authenticated;

create or replace function public.groupe_creer(p_offre uuid, p_zone text, p_objectif numeric, p_min integer, p_date_limite timestamp with time zone,
  p_paliers jsonb, p_frais numeric, p_ma_quantite numeric, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); o public.offres; g uuid; vend boolean; r text; ouverts int;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into o from public.offres where id = p_offre;
  if o.id is null or o.status <> 'active' then raise exception 'Cette offre n''est plus disponible.'; end if;
  r := public._groupe_refus(p_offre, p_zone, me);
  if r is not null then raise exception '%', r; end if;
  if o.price is null or o.price <= 0 then raise exception 'Un achat groupé demande une offre avec un prix.'; end if;
  vend := o.user_id = me;
  if p_objectif is null or p_objectif <= 0 then raise exception 'Indiquez la quantité visée.'; end if;
  if p_objectif > coalesce(o.quantity, 0) then raise exception 'L''objectif dépasse la quantité de l''offre (%).', o.quantity; end if;
  if p_date_limite is null or p_date_limite < now() + interval '6 hours' or p_date_limite > now() + interval '30 days' then
    raise exception 'Date limite : entre 6 heures et 30 jours.'; end if;
  if coalesce(p_min, 2) not between 2 and 50 then raise exception 'Entre 2 et 50 participants au minimum.'; end if;
  r := public.texte_refus(concat_ws(' · ', p_zone, p_note)); if r is not null and not public.est_admin() then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  select count(*) into ouverts from public.groupes_achat where createur_id = me and statut in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation');
  if ouverts >= 10 then raise exception 'Limite : 10 achats groupés en cours.'; end if;
  if not vend and coalesce(p_ma_quantite, 0) <= 0 then raise exception 'Indiquez votre quantité.'; end if;
  insert into public.groupes_achat (offre_id, vendeur_id, createur_id, produit, unite, zone, region_slug, objectif, min_participants, date_limite,
    prix_base, paliers, frais_transport, statut, note)
  values (o.id, o.user_id, me, coalesce(o.product_label, 'Produit'), coalesce(o.unit, 'kg'), btrim(p_zone), o.region_slug, p_objectif, coalesce(p_min, 2), p_date_limite,
    o.price, case when vend then public._groupe_paliers(p_paliers, o.price) else '[]'::jsonb end, case when vend then p_frais end,
    case when vend then 'ouvert' else 'propose' end, nullif(btrim(p_note), ''))
  returning id into g;
  if not vend then
    if p_ma_quantite > p_objectif then raise exception 'Votre quantité dépasse l''objectif.'; end if;
    insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g, me, p_ma_quantite, o.price);
  end if;
  return g;
end $$;

create or replace function public.groupe_rejoindre(p_id uuid, p_quantite numeric)
returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g public.groupes_achat; o public.offres; autres numeric; prix numeric; r text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null then raise exception 'Achat groupé introuvable.'; end if;
  if g.vendeur_id = me then raise exception 'Vous êtes le vendeur de ce groupe.'; end if;
  if g.statut not in ('ouvert', 'seuil_atteint') then raise exception 'Les inscriptions sont fermées.'; end if;
  if g.date_limite <= now() then raise exception 'La date limite est passée.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Indiquez votre quantité.'; end if;
  r := public._groupe_refus(g.offre_id, g.zone, me);
  if r is not null then raise exception '%', r; end if;
  select * into o from public.offres where id = g.offre_id;
  select coalesce(sum(quantite), 0) into autres from public.groupe_participants where groupe_id = g.id and statut <> 'retire' and user_id <> me;
  if autres + p_quantite > coalesce(o.quantity, 0) then raise exception 'Il reste % % disponibles dans ce groupe.', greatest(0, coalesce(o.quantity, 0) - autres), g.unite; end if;
  prix := public._groupe_prix(g, autres + p_quantite);
  insert into public.groupe_participants (groupe_id, user_id, quantite, prix_vu) values (g.id, me, p_quantite, prix)
  on conflict (groupe_id, user_id) do update set quantite = excluded.quantite, prix_vu = excluded.prix_vu, statut = 'inscrit', confirme_le = null, updated_at = now();
  perform public._groupe_recalculer(g.id);
  return json_build_object('prix', prix, 'total', autres + p_quantite);
end $$;

create or replace function public.groupe_confirmer(p_id uuid, p_oui boolean)
returns text language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; r text;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut <> 'en_attente_confirmation' then raise exception 'Ce groupe n''attend pas de confirmation.'; end if;
  if g.confirmer_avant <= now() then raise exception 'Le délai de confirmation est passé.'; end if;
  if p_oui then
    r := public._groupe_refus(g.offre_id, null, auth.uid());   -- la zone a été contrôlée à la création
    if r is not null then raise exception '%', r; end if;
  end if;
  update public.groupe_participants set statut = case when p_oui then 'confirme' else 'retire' end, confirme_le = case when p_oui then now() end, updated_at = now()
  where groupe_id = g.id and user_id = auth.uid() and statut <> 'retire';
  if not found then raise exception 'Vous ne participez pas à ce groupe.'; end if;
  return public._groupe_evaluer(g.id);
end $$;

create or replace function public.groupe_valider(p_id uuid, p_oui boolean, p_paliers jsonb, p_frais numeric)
returns void language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; r text;
begin
  select * into g from public.groupes_achat where id = p_id for update;
  if g.id is null or g.vendeur_id <> auth.uid() then raise exception 'Achat groupé introuvable.'; end if;
  if g.statut <> 'propose' then raise exception 'Ce groupe n''attend pas votre validation.'; end if;
  if not p_oui then update public.groupes_achat set statut = 'annule', updated_at = now() where id = g.id; return; end if;
  r := public._groupe_refus(g.offre_id, g.zone, auth.uid());
  if r is not null then raise exception '%', r; end if;
  update public.groupes_achat set statut = 'ouvert', paliers = public._groupe_paliers(p_paliers, g.prix_base), frais_transport = p_frais, updated_at = now() where id = g.id;
  perform public._groupe_recalculer(g.id);
end $$;

-- ───────── 2. Évaluation : stock manquant → groupe expiré ; ville d'arrivée ; compte officiel sans commission
create or replace function public._groupe_evaluer(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare g public.groupes_achat; o public.offres; total numeric; pf numeric; p record; cid uuid; num text; offi boolean; arr text;
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
    -- le stock ne suffit plus : le groupe s'arrête (les participants sont prévenus) au lieu de rester bloqué
    update public.groupes_achat set statut = 'expire', updated_at = now() where id = g.id;
    return 'stock_insuffisant';
  end if;
  offi := public.est_admin_id(g.vendeur_id);
  arr := case when coalesce(o.ville_seulement, false) and public._ville_cle(o.city) <> '' then public._ville_ref(o.city) end;
  perform set_config('mdg.groupe_en_cours', g.id::text, true);
  update public.offres set quantity = quantity - total where id = o.id;
  update public.offres set status = 'retiree' where id = o.id and quantity <= 0 and status = 'active';
  perform set_config('mdg.groupe_en_cours', '', true);
  for p in select * from public.groupe_participants where groupe_id = g.id and statut = 'confirme' loop
    num := 'MDG-G-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text || p.id::text), 1, 6));
    insert into public.commandes (numero, negociation_id, vendeur_id, acheteur_id, cree_par, produit, quantite, unite, prix_unitaire, montant,
      ville_depart, ville_arrivee, lieu_livraison, commission_montant, mode_transport, validation, etat, etape, groupe_id)
    values (num, null, g.vendeur_id, p.user_id, g.vendeur_id, g.produit, p.quantite, g.unite, pf, round(pf * p.quantite, 0),
      left(o.city, 80), left(arr, 80), left(g.zone, 120), case when offi then 0 else round(round(pf * p.quantite, 0) * 0.035, 0) end,
      'vendeur', 'declaration', 'en_cours', 'confirmee', g.id)
    returning id into cid;
    perform public._cmd_journal(cid, 'confirmee', p.user_id, 'acheteur', 'declaration', null, null, null, 'Achat groupé : participation confirmée');
    update public.groupe_participants set commande_id = cid where id = p.id;
  end loop;
  update public.groupes_achat set statut = 'confirme', updated_at = now() where id = g.id;
  return 'confirme';
end $$;

-- ───────── 3. Offre retirée ou épuisée : ses groupes en cours s'arrêtent
create or replace function public._groupe_offre_sortie()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'active' and old.status = 'active' then
    update public.groupes_achat set statut = case when new.retiree_le is not null or new.status = 'masquee' then 'annule' else 'expire' end, updated_at = now()
    where offre_id = new.id and statut in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation')
      and id::text is distinct from nullif(current_setting('mdg.groupe_en_cours', true), '');
  end if;
  return new;
end $$;
-- sans liste de colonnes : « retirer » ne touche que retiree_le, le statut change dans un déclencheur BEFORE
create or replace trigger offres_groupes_sortie after update on public.offres
  for each row when (old.status is distinct from new.status) execute function public._groupe_offre_sortie();

-- ───────── 4. Racheter : seulement des offres qu'on peut vraiment commander
create or replace function public.recommande_preparer(p_cmd uuid)
returns json language sql stable security definer set search_path = public as $$
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
      (select g.statut from public.negociations g where g.cible = 'offre' and g.cible_id = o.id and g.auteur_id = auth.uid() and g.statut = 'ouverte' limit 1) deja_statut,
      (select g.id from public.negociations g where g.cible = 'offre' and g.cible_id = o.id and g.auteur_id = auth.uid() and g.statut = 'ouverte' limit 1) deja_id
    from public.offres o, c
    where o.status = 'active' and o.pause_le is null and o.product_slug = c.slug and o.user_id <> auth.uid()
      and not exists (select 1 from public.bannis b where b.user_id = o.user_id)
      and (not coalesce(o.ville_seulement, false) or public._ville_cle(o.city) = ''
           or public._ville_cle(public._ville_ref(o.city)) = public._ville_cle(public._ville_ref(coalesce(c.ville_arrivee, c.lieu_livraison))))
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

-- ───────── 5. Besoin pro : plus de réponse après la fin de la période de livraison
create or replace function public.besoin_repondre(p_demande uuid, p_prix numeric, p_quantite numeric, p_stock numeric, p_delai_jours integer, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare d public.demandes; n uuid; b public.besoins;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into d from public.demandes where id = p_demande;
  if d.id is null or d.besoin_id is null then raise exception 'Besoin introuvable.'; end if;
  select * into b from public.besoins where id = d.besoin_id;
  if b.statut <> 'ouvert' then raise exception 'Ce besoin n''accepte plus de propositions.'; end if;
  if coalesce(b.livraison_fin, b.livraison_debut) < current_date then raise exception 'La période de livraison de ce besoin est passée.'; end if;
  if p_prix is null or p_prix <= 0 then raise exception 'Indiquez votre prix.'; end if;
  if p_quantite is null or p_quantite <= 0 then raise exception 'Indiquez la quantité proposée.'; end if;
  if p_stock is not null and p_stock < p_quantite then raise exception 'Le stock disponible doit couvrir la quantité proposée.'; end if;
  if p_delai_jours is not null and p_delai_jours not between 0 and 90 then raise exception 'Délai entre 0 et 90 jours.'; end if;
  n := public.nego_ouvrir('demande', p_demande, p_prix, p_quantite, nullif(btrim(p_note), ''));
  insert into public.proposition_details (negociation_id, stock, delai_jours) values (n, p_stock, p_delai_jours)
  on conflict (negociation_id) do update set stock = excluded.stock, delai_jours = excluded.delai_jours, updated_at = now();
  return n;
end $$;
