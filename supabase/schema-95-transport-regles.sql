-- Schéma 95 : transport et argent, règles alignées (audit du 24/10/2026, P2 n° 18 et 19, contradictions 3, 4, 5).
-- Testé sur le projet de test (yowdymdnoiubatxlwhfv). Pas encore en production.
-- 1. 6,9 % seulement pour le service transport Marché de Gros : mode « reseau » ET transporteur vérifié
--    (_seq_repartition, chauffeur_missions). Le livreur du vendeur ne doit rien au Marché de Gros.
-- 2. Transport « à part » (livré par le vendeur, prix ajouté) compté dans la répartition : total = marchandise + transport à part,
--    la part transport revient au vendeur, sans commission. Le total suit total_convenu (300 000 et non 270 000).
-- 3. admin_affecter refusé si le service réseau est fermé ou si la commande n'est pas en mode « reseau ».
-- 4. admin_transport_reseau refuse d'ouvrir le service sous 3 transporteurs vérifiés (seuil lisible dans reglages.transport_reseau_min).
-- 5. Messages du serveur : « clôturer » la commande, plus de « paiement libéré ».
-- Arrondis : chaque montant est arrondi au franc (round(x, 0)) avant les sommes, les parts s'additionnent exactement au total.

create or replace function public._transport_reseau_min()
returns integer language sql stable security definer set search_path = public as $$
  select greatest(coalesce((select (valeur #>> '{}')::int from public.reglages where cle = 'transport_reseau_min'), 3), 3)
$$;
revoke all on function public._transport_reseau_min() from public, anon, authenticated;

create or replace function public._seq_repartition(p_cmd uuid)
returns json language plpgsql stable security definer set search_path = public as $$
declare c public.commandes; m public.transport_missions; marchandise numeric; tr numeric := 0; ta numeric := 0; refuse numeric; vb numeric; vk numeric; tk numeric := 0;
  reseau boolean := false; apart boolean;
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
  vb := marchandise - refuse;
  vk := case when public.est_admin_id(c.vendeur_id) then 0 else round(vb * 0.035, 0) end;
  return json_build_object(
    'marchandise', marchandise, 'transport', tr + ta, 'total', marchandise + tr + ta,
    'transport_a_part', ta,
    'vendeur_brut', vb, 'vendeur_commission', vk, 'vendeur_transport', ta, 'vendeur_net', vb - vk + ta,
    'transporteur_brut', tr, 'transporteur_commission', tk, 'transporteur_net', tr - tk,
    'transport_reseau', reseau, 'taux_transport', case when reseau then 0.069 else 0 end,
    'acheteur_rembourse', refuse, 'non_du', refuse, 'marche', vk + tk,
    'transporteur_user', (select t.user_id from public.transporteurs t where t.id = m.transporteur_id));
end $$;
revoke all on function public._seq_repartition(uuid) from public, anon, authenticated;

create or replace function public.chauffeur_missions()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at, 'note', m.note,
      'prix', m.prix, 'reseau', x.reseau, 'taux', case when x.reseau then 0.069 else 0 end,
      'commission', case when m.prix is not null then case when x.reseau then round(round(m.prix, 0) * 0.069, 0) else 0 end end,
      'net', case when m.prix is not null then round(m.prix, 0) - case when x.reseau then round(round(m.prix, 0) * 0.069, 0) else 0 end end,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'validation', c.validation, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'libere_le', c.libere_le,
      'refus', case when c.refus_le is not null and c.transporteur_id = t.id then json_build_object(
          'le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos,
          'reponse', c.refus_chauffeur, 'a_repondre', c.etat = 'litige' and c.refus_chauffeur is null, 'suffit', public._cmd_chauffeur_independant(c)) end,
      'maj', c.updated_at,
      'mode', c.mode_transport, 'ville_arrivee', c.ville_arrivee,
      'prix_trois', case when c.mode_transport = 'reseau' then public._tr_tri_etat(m.id) end)
    order by (m.statut = 'proposee') desc, (c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null) desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  cross join lateral (select c.mode_transport = 'reseau' and t.statut = 'verifie' as reseau) x
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$$;

create or replace function public.admin_affecter(p_cmd uuid, p_transporteur uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c public.commandes; t public.transporteurs;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if not public._transport_reseau_ouvert() then
    raise exception 'Le service transport Marché de Gros n''est pas encore ouvert : l''équipe n''affecte pas de transporteur.';
  end if;
  select * into c from public.commandes where id = p_cmd for update;
  select * into t from public.transporteurs where id = p_transporteur;
  if c.id is null or t.id is null then raise exception 'Commande ou transporteur introuvable.'; end if;
  if c.mode_transport is distinct from 'reseau' then
    raise exception 'Cette commande n''a pas choisi le transporteur du Marché de Gros : le transport reste organisé par le vendeur ou l''acheteur.';
  end if;
  if t.statut <> 'verifie' then raise exception 'Seul un transporteur vérifié peut être affecté par l''équipe.'; end if;
  if c.validation = 'code' and t.user_id is null then raise exception 'Commande avec codes : choisissez un chauffeur qui a l''application.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then raise exception 'Le transporteur s''affecte avant le chargement.'; end if;
  update public.transport_missions set statut = 'retiree', repondu_le = now() where commande_id = c.id and statut in ('proposee', 'acceptee');
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le)
  values (c.id, t.id, auth.uid(), 'admin', case when t.user_id is null then 'acceptee' else 'proposee' end, case when t.user_id is null then now() end);
  update public.commandes set transporteur_id = case when t.user_id is null then t.id end, updated_at = now() where id = c.id;
  return case when t.user_id is null then 'acceptee' else 'proposee' end;
end $$;

create or replace function public.admin_transport_reseau(p_oui boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer; mini integer := public._transport_reseau_min();
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if coalesce(p_oui, false) then
    select count(*) into n from public.transporteurs where statut = 'verifie';
    if n < mini then
      raise exception 'Il faut au moins % transporteurs vérifiés pour ouvrir le service (aujourd''hui : %).', mini, n;
    end if;
  end if;
  insert into public.reglages (cle, valeur, maj_le, maj_par) values ('transport_reseau_ouvert', to_jsonb(coalesce(p_oui, false)), now(), auth.uid())
  on conflict (cle) do update set valeur = excluded.valeur, maj_le = now(), maj_par = auth.uid();
  return coalesce(p_oui, false);
end $$;

create or replace function public.commande_liberer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur peut clôturer la commande.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'terminee' then raise exception 'La commande se clôture après la réception.'; end if;
  if c.libere_le is not null then raise exception 'Commande déjà clôturée.'; end if;
  perform public._seq_journal(c.id, 'liberee', me, 'acheteur', 'marchandise conforme');
  update public.commandes set libere_le = now(), liberation = 'conforme' where id = c.id;
end $$;

create or replace function public.admin_liberer(p_cmd uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'terminee' or c.libere_le is not null then raise exception 'Rien à clôturer sur cette commande.'; end if;
  update public.commandes set libere_le = now(), liberation = 'admin' where id = c.id;
  perform public._cmd_journal(c.id, 'terminee', auth.uid(), 'admin', 'admin', null, null, null, 'Commande clôturée par l''équipe : ' || nt);
end $$;
