-- Schéma 103c : qui paie le transport quand la marchandise est refusée (règle du propriétaire du 25/10/2026, décision n° 11 de
-- docs/juridique/DECISIONS-A-PRENDRE.md, transmise avec les 15 propositions) :
--   • refus accepté (toute la marchandise) : l'acheteur ne paie ni la marchandise ni le transport ;
--   • refus rejeté (0 retenu) : l'acheteur paie tout (marchandise et transport) ;
--   • refus partiel accepté : l'acheteur paie la partie acceptée ; le transport est payé par le vendeur.
-- Un partage décidé par l'équipe (une partie n'est pas due) suit la règle du refus partiel accepté ; une commande annulée après le
-- chargement (litige donné à l'acheteur, « fausse arrivée ») aussi : rien n'est dû par l'acheteur, le transport fait reste au vendeur.
-- Avant : _seq_repartition ne retirait que la marchandise ; le transport (transporteur choisi, ou transport « à part ») restait dû par
-- l'acheteur, même refus accepté ; l'avis au chauffeur disait « Le transport reste dû ».
-- Maintenant : quand une quantité n'est pas due (montant_refuse > 0), le transport n'est plus dû par l'acheteur :
--   • transport « à part » (le vendeur livre lui-même) : le vendeur ne reçoit pas ce prix ;
--   • transporteur choisi (mission avec prix) : le transporteur garde son prix, payé par le vendeur (vendeur_net le retire) ;
--   • commission 6,9 % (service Marché de Gros seulement, fermé aujourd'hui) : toujours sur le prix du transporteur, qui a fait le trajet ;
--     une commande annulée après le chargement garde donc sa commission de transport « calculée » (_ctr_sync).
-- Aucun paiement réel : ce ne sont que des montants calculés ; rien n'est prélevé ni versé, rien n'est « encaissé ».
-- Les champs déjà lus par l'application gardent leur nom ; acheteur_rembourse et non_du comptent maintenant aussi le transport non dû.
-- Participation de l'acheteur (schéma 102a, autre équipe) : quand elle est acceptée, l'acheteur paie le montant convenu ; ce qui
-- dépasse la partie de marchandise gardée paie le transport (transport_paye_par peut valoir « partage »).
-- Projet de TEST d'abord ; production seulement après fusion et accord du propriétaire. Rien n'est effacé.

create or replace function public._seq_repartition(p_cmd uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare c public.commandes; m public.transport_missions; marchandise numeric; tr numeric := 0; ta numeric := 0; refuse numeric; vb numeric; vk numeric; tk numeric := 0;
  reseau boolean := false; apart boolean; refus_ok boolean; tnd numeric; tpb numeric;
begin
  select * into c from public.commandes where id = p_cmd;
  if c.id is null or c.montant is null then return null; end if;
  marchandise := round(c.montant, 0);
  apart := c.prix_transport is not null and (c.transport_regle = 'a_part' or (c.transport_regle is null and c.mode_transport is distinct from 'reseau'));
  if apart then
    ta := round(c.prix_transport, 0);
  elsif not public._cmd_transport_inclus(c.id) then
    select * into m from public.transport_missions where commande_id = c.id and statut = 'acceptee' and prix is not null order by created_at desc limit 1;
    if m.id is not null then
      tr := round(m.prix, 0);
      reseau := c.mode_transport = 'reseau' and exists (select 1 from public.transporteurs t where t.id = m.transporteur_id and t.statut = 'verifie');
      tk := case when reseau then round(tr * 0.069, 0) else 0 end;
    end if;
  end if;
  refuse := least(round(coalesce(c.montant_refuse, 0), 0), marchandise);
  -- commande annulée : rien n'est dû par l'acheteur ; avant le chargement, aucun transport n'a eu lieu
  if c.etat = 'annulee' then
    refuse := marchandise;
    if not exists (select 1 from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'chargement') then
      tr := 0; ta := 0; tk := 0;
    end if;
  end if;
  refus_ok := refuse > 0;
  tnd := case when refus_ok then tr + ta else 0 end;              -- transport que l'acheteur ne doit pas
  -- participation de l'acheteur acceptée par le vendeur (schéma 102a) : l'acheteur paie le montant convenu ; ce qui dépasse la
  -- partie de la marchandise gardée paie le transport (plafonné au prix du transport)
  if c.participation_montant is not null then
    tnd := tr + ta - least(greatest(round(c.participation_montant, 0) - (marchandise - refuse), 0), tr + ta);
  end if;
  tpb := tr + ta - tnd;                                           -- transport payé par l'acheteur
  vb := marchandise - refuse;
  vk := case when public.est_admin_id(c.vendeur_id) then 0 else round(vb * 0.035, 0) end;
  return json_build_object(
    'marchandise', marchandise, 'transport', tr + ta, 'total', marchandise + tr + ta,
    'transport_a_part', ta,
    'vendeur_brut', vb, 'vendeur_commission', vk,
    'vendeur_transport', least(ta, tpb),
    'vendeur_paie_transport', greatest(tr - tpb, 0),
    'vendeur_net', vb - vk + tpb - tr,
    'transporteur_brut', tr, 'transporteur_commission', tk, 'transporteur_net', tr - tk,
    'transport_reseau', reseau, 'taux_transport', case when reseau then 0.069 else 0 end,
    'transport_paye_par', case when tr + ta = 0 then null when tnd = 0 then 'acheteur' when tpb = 0 then 'vendeur' else 'partage' end,
    'marchandise_non_due', refuse, 'transport_non_du', tnd,
    'acheteur_paie', marchandise - refuse + tpb,
    'acheteur_rembourse', refuse + tnd, 'non_du', refuse + tnd, 'marche', vk + tk,
    'transporteur_user', (select t.user_id from public.transporteurs t where t.id = m.transporteur_id));
end $$;
revoke all on function public._seq_repartition(uuid) from public, anon, authenticated;

-- refus confirmé par le vendeur ou le chauffeur intégré : le journal dit qui paie le transport
create or replace function public._cmd_refus_appliquer(p_id uuid, p_par uuid, p_role text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; mr numeric; tr numeric;
begin
  select * into c from public.commandes where id = p_id for update;
  mr := case when c.refus_quantite is null or c.quantite is null or c.quantite = 0 then round(c.montant, 0)
             else least(round(c.refus_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
    libere_le = now(), liberation = 'refus', montant_refuse = mr where id = c.id;
  tr := coalesce((public._seq_repartition(c.id) ->> 'transport')::numeric, 0);
  perform public._seq_journal(c.id, 'refus_applique', p_par, p_role,
    mr || ' F de marchandise non dus par l''acheteur' || case when tr > 0 then ' ; transport (' || tr || ' F) à la charge du vendeur' else '' end
    || ' · ' || coalesce(p_note, ''));
  perform public._cmd_journal(c.id, 'terminee', p_par, p_role, 'declaration', null, null, null,
    'Refus confirmé : ' || mr || ' F non dus par l''acheteur' || case when mr < round(c.montant, 0) then ', le reste pour le vendeur' else '' end
    || case when tr > 0 then ' ; transport payé par le vendeur' else '' end);
end $$;
revoke all on function public._cmd_refus_appliquer(uuid, uuid, text, text) from public, anon, authenticated;

-- l'équipe tranche un refus (fonction interne de la porte admin_refus_trancher, schéma 100c)
create or replace function public._j_admin_refus_trancher(p_cmd uuid, p_quantite numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), ''); mr numeric; tr numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' or c.refus_le is null then raise exception 'Cette commande n''a pas de refus en cours.'; end if;
  if p_quantite is null or p_quantite < 0 then raise exception 'Indiquez la quantité refusée retenue (0 si le refus est rejeté).'; end if;
  mr := case when p_quantite = 0 then 0
             when c.quantite is null or p_quantite >= c.quantite then round(c.montant, 0)
             else least(round(p_quantite * c.prix_unitaire, 0), round(c.montant, 0)) end;
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
    libere_le = now(), liberation = 'admin', montant_refuse = mr where id = c.id;
  tr := coalesce((public._seq_repartition(c.id) ->> 'transport')::numeric, 0);
  perform public._seq_journal(c.id, 'refus_admin', auth.uid(), 'admin',
    case when mr = 0 then 'Refus rejeté : l''acheteur paie la marchandise' || case when tr > 0 then ' et le transport' else '' end
         else mr || ' F de marchandise non dus par l''acheteur' || case when tr > 0 then ' ; transport à la charge du vendeur' else '' end end
    || ' · ' || nt);
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null, nt);
end $$;
revoke all on function public._j_admin_refus_trancher(uuid, numeric, text) from public, anon, authenticated;

-- partage décidé par l'équipe (fonction interne de la porte admin_litige_partager) : le transport passe au vendeur
create or replace function public._j_admin_litige_partager(p_cmd uuid, p_quantite numeric, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), ''); mr numeric; tr numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' then raise exception 'Cette commande n''est pas en litige.'; end if;
  if c.quantite is null or c.prix_unitaire is null then raise exception 'Commande sans quantité ou sans prix : choisissez livrée ou annulée.'; end if;
  if p_quantite is null or p_quantite <= 0 or p_quantite >= c.quantite then
    raise exception 'Partage : indiquez la quantité qui n''est pas due, entre 0 et % (exclus).', c.quantite;
  end if;
  mr := least(round(p_quantite * c.prix_unitaire, 0), round(c.montant, 0));
  update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()), libere_le = now(),
    liberation = 'admin', montant_refuse = mr where id = c.id;
  tr := coalesce((public._seq_repartition(c.id) ->> 'transport')::numeric, 0);
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null,
    left(format('Partage décidé par l''équipe : %s %s ne sont pas dus (%s F)%s · ', p_quantite, coalesce(c.unite, ''), mr,
      case when tr > 0 then ', transport payé par le vendeur' else '' end) || nt, 300));
end $$;
revoke all on function public._j_admin_litige_partager(uuid, numeric, text) from public, anon, authenticated;

-- commission de transport (6,9 %, service Marché de Gros seulement) : le transporteur qui a fait le trajet garde son prix, payé par le
-- vendeur si le refus est accepté ; une commande annulée après le chargement garde sa commission « calculée » (jamais réclamée)
create or replace function public._ctr_sync(p_mission uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.transport_missions; c public.commandes; o public.commissions_transport; s text; p numeric; k numeric; tv text; hors boolean; avant text;
  parti boolean;
begin
  select * into m from public.transport_missions where id = p_mission;
  if m.id is null then return; end if;
  select * into o from public.commissions_transport where mission_id = m.id for update;
  select * into c from public.commandes where id = m.commande_id;
  select statut into tv from public.transporteurs where id = m.transporteur_id;
  hors := c.mode_transport is distinct from 'reseau' or tv is distinct from 'verifie';
  if m.statut <> 'acceptee' or m.prix is null or public._cmd_transport_inclus(m.commande_id) or hors then
    if o.id is not null and coalesce(o.statut_registre, o.statut) <> 'annulee' then
      update public.commissions_transport set statut = 'annulee', statut_registre = 'annulee', updated_at = now() where id = o.id;
      insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
        values (o.id, 'annulee', o.prix_transport, o.commission, 'mission ' || m.statut || (case when m.statut <> 'acceptee' then '' when hors then ', livreur hors service Marché de Gros' when m.prix is null then ', sans prix' else ', transport compris dans le prix du vendeur' end));
    end if;
    return;
  end if;
  parti := exists (select 1 from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'chargement');
  s := case
         when c.etat = 'terminee' and c.libere_le is not null then case when public._cmd_argent_passe(c.id) then 'due' else 'calculee' end
         when c.etat = 'litige' then 'suspendue'
         when c.etat = 'annulee' and parti then case when public._cmd_argent_passe(c.id) then 'due' else 'calculee' end
         when c.etat = 'annulee' then 'annulee'
         else 'prevue' end;
  p := round(m.prix, 0); k := round(p * 0.069, 0);
  if o.id is null then
    insert into public.commissions_transport (mission_id, commande_id, transporteur_id, prix_transport, commission, statut, statut_registre)
      values (m.id, m.commande_id, m.transporteur_id, p, k, case when s = 'calculee' then 'prevue' else s end, s) returning * into o;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : mission acceptée à ' || p || ' F');
    return;
  end if;
  avant := coalesce(o.statut_registre, o.statut);
  if o.statut_registre is null and o.statut = 'due' and s = 'calculee' and o.prix_transport = p then return; end if;
  if avant <> s or o.prix_transport <> p then
    update public.commissions_transport set statut = case when s = 'calculee' then 'prevue' else s end, statut_registre = s,
      prix_transport = p, commission = k, updated_at = now() where id = o.id;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : ' || (case when o.prix_transport <> p then 'prix ' || o.prix_transport || ' → ' || p || ' F' else avant || ' → ' || s end)
        || case when s = 'calculee' then ' (calculée seulement : rien ne sera réclamé)' else '' end
        || case when c.etat = 'annulee' and parti then ' ; commande annulée après le chargement : transport payé par le vendeur' else '' end);
  end if;
end $$;
revoke all on function public._ctr_sync(uuid) from public, anon, authenticated;
