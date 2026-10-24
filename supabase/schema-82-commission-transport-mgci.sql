-- Schéma 82 : commission transport réservée au service Marché de Gros (correctifs C1 et C2 de l'audit des 4 chantiers, 24/10/2026).
-- Appliqué sur le projet de test (5 tests passés, annulés) puis en production le 24/10/2026.
-- C1 : une commission transport de 6,9 % ne naît que pour une commande en mode « reseau » avec un transporteur vérifié ;
--      un livreur choisi par l'acheteur ou le vendeur est hors Marché de Gros (aucune commission).
--      Un transporteur non vérifié ne peut plus accepter une mission du réseau.
-- C2 : droits inutiles retirés sur alertes, alertes_produits, zones (visiteurs : plus rien, sauf lecture de zones ;
--      membres : plus de REFERENCES ni TRIGGER). Le dernier droit en trop des membres ne peut pas être retiré par l'outil
--      (mot interdit) : voir docs/audits/decisions-chantiers-2026-10-24.md, C2.

create or replace function public._ctr_sync(p_mission uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare m public.transport_missions; c public.commandes; o public.commissions_transport; s text; p numeric; k numeric; tv text; hors boolean;
begin
  select * into m from public.transport_missions where id = p_mission;
  if m.id is null then return; end if;
  select * into o from public.commissions_transport where mission_id = m.id for update;
  select * into c from public.commandes where id = m.commande_id;
  select statut into tv from public.transporteurs where id = m.transporteur_id;
  -- Commission transport : seulement le service MGCI (mode réseau) avec un transporteur vérifié.
  hors := c.mode_transport is distinct from 'reseau' or tv is distinct from 'verifie';
  if m.statut <> 'acceptee' or m.prix is null or public._cmd_transport_inclus(m.commande_id) or hors then
    if o.id is not null and o.statut <> 'annulee' then
      update public.commissions_transport set statut = 'annulee', updated_at = now() where id = o.id;
      insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
        values (o.id, 'annulee', o.prix_transport, o.commission, 'mission ' || m.statut || (case when m.statut <> 'acceptee' then '' when hors then ', livreur hors service Marché de Gros' when m.prix is null then ', sans prix' else ', transport compris dans le prix du vendeur' end));
    end if;
    return;
  end if;
  s := case
         when c.etat = 'terminee' and c.libere_le is not null then 'due'
         when c.etat = 'litige' then 'suspendue'
         when c.etat = 'annulee' then 'annulee'
         else 'prevue' end;
  p := round(m.prix, 0); k := round(p * 0.069, 0);
  if o.id is null then
    insert into public.commissions_transport (mission_id, commande_id, transporteur_id, prix_transport, commission, statut)
      values (m.id, m.commande_id, m.transporteur_id, p, k, s) returning * into o;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : mission acceptée à ' || p || ' F');
  elsif o.statut <> s or o.prix_transport <> p then
    update public.commissions_transport set statut = s, prix_transport = p, commission = k, updated_at = now() where id = o.id;
    insert into public.commission_transport_journal (commission_id, statut, prix_transport, commission, motif)
      values (o.id, s, p, k, 'commande ' || c.numero || ' : ' || (case when o.prix_transport <> p then 'prix ' || o.prix_transport || ' → ' || p || ' F' else o.statut || ' → ' || s end));
  end if;
end $function$;

create or replace function public.chauffeur_repondre(p_mission uuid, p_oui boolean, p_note text default null::text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; c public.commandes; nt text;
begin
  select * into m from public.transport_missions where id = p_mission for update;
  select * into t from public.transporteurs where id = m.transporteur_id;
  if m.id is null or t.user_id is distinct from me then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if m.statut <> 'proposee' then raise exception 'Cette mission a déjà reçu une réponse.'; end if;
  if t.statut in ('refuse', 'suspendu') then raise exception 'Votre profil de transporteur ne permet pas d''accepter de mission.'; end if;
  select * into c from public.commandes where id = m.commande_id for update;
  if c.etat not in ('a_confirmer', 'en_cours') then raise exception 'Cette commande n''est plus en cours.'; end if;
  if p_oui and c.mode_transport = 'reseau' and t.statut <> 'verifie' then
    raise exception 'Seuls les transporteurs vérifiés par le Marché de Gros acceptent une mission du réseau.';
  end if;
  nt := public._cmd_texte(p_note, 300);
  update public.transport_missions set statut = case when p_oui then 'acceptee' else 'refusee' end, repondu_le = now(), note = coalesce(nt, note) where id = m.id;
  if p_oui then update public.commandes set transporteur_id = t.id, updated_at = now() where id = c.id;
  else update public.commandes set updated_at = now() where id = c.id; end if;
  return case when p_oui then 'acceptee' else 'refusee' end;
end $function$;

revoke all on public.alertes from anon;
revoke all on public.alertes_produits from anon;
revoke all on public.zones from anon;
grant select on public.zones to anon;
revoke references, trigger on public.alertes, public.alertes_produits, public.zones from authenticated;
