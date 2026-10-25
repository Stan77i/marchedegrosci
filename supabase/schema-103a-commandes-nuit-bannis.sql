-- Schéma 103a : nuit, membres bannis ou suspendus, demande d'annulation sans réponse (propositions validées par le propriétaire,
-- « Ok » du 25/10/2026, docs/regles/SCENARIOS-COMMANDE.md, partie 6, n° 1, 2, 3, 4, 5 et 7).
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire.
--  n° 1  « Arrivé » déclaré entre 21 h et 7 h (heure d'Abidjan = UTC) : l'heure de l'acheteur commence à 7 h (_cmd_nuit_report,
--        utilisé par _cmd_reception_base : rappel, litige automatique, écran et avis suivent tout seuls). Pas de règle pour les jours fériés.
--  n° 2  Vendeur banni après le chargement (marchandise en route) : la commande passe en litige pour l'équipe (tâche des délais, 5 min) ;
--        l'acheteur peut encore confirmer la réception avec le mot secret (schéma 103b).
--  n° 3  Acheteur banni : avant le chargement, le vendeur annule tout de suite (commande_annuler_acheteur_banni), l'annulation compte
--        contre l'acheteur ; après le chargement (et après « arrivé »), litige pour l'équipe, sans clôture automatique ni « litige perdu »
--        automatique ; un litige automatique déjà ouvert passe à l'équipe.
--  n° 4  Pas de nouvelle commande ni de nouvel accord avec un membre banni ; au bannissement, ses accords sans commande s'arrêtent et la
--        quantité revient tout de suite sur l'annonce (déclencheur sur bannis). Achats groupés : inchangés (commandes créées ensemble).
--  n° 5  Demande d'annulation du vendeur sans réponse de l'acheteur en 24 h : acceptée, sans faute pour personne (catégorie « légitime »).
--  n° 7  Membre suspendu : ses accords sans commande passent « sans suite » tout de suite (déclencheur sur sanctions).
-- Rien n'est effacé : create or replace, add column if not exists. Aucun argent ne passe (aucun paiement branché).

-- n° 5 : date de la demande d'annulation (les demandes ouvertes avant ce schéma prennent la date du journal)
alter table public.commandes add column if not exists annulation_demande_le timestamptz;
alter table public.commandes add column if not exists annulation_demandes_acheteur integer not null default 0;
update public.commandes c set annulation_demande_le = (select max(e.at) from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'annulation_demandee')
where c.annulation_par is not null and c.annulation_demande_le is null and c.etat = 'en_cours';

-- n° 1 : la nuit (21 h - 7 h, heure d'Abidjan = UTC) reporte le départ à 7 h
create or replace function public._cmd_nuit_report(p timestamptz) returns timestamptz
language sql immutable set search_path = public as $$
  select case
    when p is null then null
    when extract(hour from p at time zone 'UTC') >= 21 then (date_trunc('day', p at time zone 'UTC') + interval '1 day 7 hours') at time zone 'UTC'
    when extract(hour from p at time zone 'UTC') < 7 then (date_trunc('day', p at time zone 'UTC') + interval '7 hours') at time zone 'UTC'
    else p end;
$$;
revoke all on function public._cmd_nuit_report(timestamptz) from public, anon, authenticated;

create or replace function public._cmd_reception_base(p_cmd uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select public._cmd_nuit_report(coalesce(k.livre_le, public._cmd_arrivee_acheteur(k.id))) + make_interval(hours => coalesce(k.delai_heures, 0))
  from public.commandes k where k.id = p_cmd;
$$;
revoke all on function public._cmd_reception_base(uuid) from public, anon, authenticated;

-- n° 4 et 7 : arrêter les accords sans commande d'un membre (la quantité revient sur l'annonce)
create or replace function public._accords_arreter(p_uid uuid, p_raison text) returns integer
language plpgsql security definer set search_path = public as $$
declare m record; k integer := 0;
  deb timestamptz := coalesce((select (valeur ->> 'debut')::timestamptz from public.reglages where cle = 'commandes'), now());
begin
  if p_uid is null then return 0; end if;
  for m in select s.* from public.stock_mouvements s join public.negociations n on n.id = s.negociation_id
      where s.sans_suite_le is null and s.rendu = 0 and s.created_at >= deb and n.statut = 'conclue'
        and p_uid in (n.auteur_id, n.proprio_id)
        and not exists (select 1 from public.commandes c where c.negociation_id = s.negociation_id)
      for update of s loop
    update public.stock_mouvements set sans_suite_le = now(), raison = p_raison where negociation_id = m.negociation_id;
    -- la quantité revient sur l'annonce ; si l'annonce appartient au membre banni, ses gardes refusent l'écriture : l'accord
    -- s'arrête quand même (le bannissement ne doit jamais échouer pour ça), la quantité reste notée « non rendue » (rendu = 0)
    begin
      perform public._stock_remettre(m.cible, m.cible_id, m.pris);
      update public.stock_mouvements set rendu = pris, rendu_le = now() where negociation_id = m.negociation_id;
    exception when others then null;
    end;
    k := k + 1;
  end loop;
  return k;
end $$;
revoke all on function public._accords_arreter(uuid, text) from public, anon, authenticated;

create or replace function public._accords_arret_banni() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._accords_arreter(new.user_id, 'membre_banni');
  return new;
end $$;
revoke all on function public._accords_arret_banni() from public, anon, authenticated;
create or replace trigger bannis_accords_arret after insert on public.bannis
  for each row execute function public._accords_arret_banni();

create or replace function public._accords_arret_suspendu() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'suspension' and new.levee_le is null and new.debut <= now() and (new.fin is null or new.fin > now()) then
    perform public._accords_arreter(new.user_id, 'membre_suspendu');
  end if;
  return new;
end $$;
revoke all on function public._accords_arret_suspendu() from public, anon, authenticated;
create or replace trigger sanctions_accords_arret after insert on public.sanctions
  for each row execute function public._accords_arret_suspendu();

-- n° 4 et 7 : une commande sur un accord arrêté par un bannissement ou une suspension reçoit un message juste (pas « 72 h »)
create or replace function public._cmd_accord_vivant() returns trigger
language plpgsql security definer set search_path = public as $$
declare s timestamptz; ra text;
begin
  if new.negociation_id is not null then
    select sans_suite_le, raison into s, ra from public.stock_mouvements where negociation_id = new.negociation_id for share;
    if s is not null and ra in ('membre_banni', 'membre_suspendu') then
      raise exception 'ACCORD_ARRETE : cet accord a pris fin, l''un des deux membres ne peut plus commander pour l''instant.';
    end if;
    if s is not null then
      raise exception 'ACCORD_SANS_SUITE : sans commande dans les % h, cet accord a pris fin et le stock est revenu sur l''annonce. Faites une nouvelle proposition.',
        public._cmd_regle('accord_sans_suite_heures', 72);
    end if;
  end if;
  return new;
end $$;
revoke all on function public._cmd_accord_vivant() from public, anon, authenticated;

-- n° 4 : pas de nouvelle commande avec un membre banni (comme avec un membre suspendu)
create or replace function public._fiab_garde_commande()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.groupe_id is not null then return new; end if;   -- achat groupé déjà engagé : il continue
  if public.est_suspendu(auth.uid()) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_banni(new.vendeur_id) or public.est_banni(new.acheteur_id) then
    raise exception 'Ce membre ne fait plus partie du Marché de Gros : pas de nouvelle commande avec lui.';
  end if;
  if public.est_suspendu(new.vendeur_id) or public.est_suspendu(new.acheteur_id) then
    raise exception 'Ce membre est suspendu pour l''instant : pas de nouvelle commande avec lui.';
  end if;
  return new;
end $$;
revoke all on function public._fiab_garde_commande() from public, anon, authenticated;

-- n° 4 : ni proposition de prix ni accord avec un membre banni (gardes du schéma 98b)
create or replace function public._fiab_garde_suspendus(p_moi uuid, p_a uuid, p_b uuid, p_quoi text)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_moi is not null and p_moi in (p_a, p_b) and public.est_suspendu(p_moi) then
    raise exception 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vos commandes en cours continuent.';
  end if;
  if public.est_banni(p_a) or public.est_banni(p_b) then
    raise exception 'Ce membre ne fait plus partie du Marché de Gros : pas de % avec lui.', p_quoi;
  end if;
  if public.est_suspendu(p_a) or public.est_suspendu(p_b) then
    raise exception 'Ce membre est suspendu pour l''instant : pas de % avec lui.', p_quoi;
  end if;
end $$;
revoke all on function public._fiab_garde_suspendus(uuid, uuid, uuid, text) from public, anon, authenticated;

-- n° 3 : acheteur banni, marchandise pas encore chargée → le vendeur annule tout de suite ; compte contre l'acheteur
create or replace function public.commande_annuler_acheteur_banni(p_id uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; nt text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not public.est_banni(c.acheteur_id) then raise exception 'L''acheteur est toujours membre : demandez l''annulation avec un motif.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then
    raise exception 'La marchandise est chargée : l''équipe du Marché de Gros s''occupe de cette commande.';
  end if;
  nt := public._cmd_texte(p_note, 200);
  update public.commandes set annulation_par = c.acheteur_id, annulation_motif = 'autre',
    annulation_motif_texte = left('Acheteur banni du Marché de Gros' || coalesce(' · ' || nt, ''), 300)
  where id = p_id;
  perform public._fiab_poser('autre', 'Acheteur banni du Marché de Gros', false, null, null);
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._fiab_poser(null, null, null, null, null);
  perform public._cmd_journal(p_id, 'annulee', me, 'vendeur', 'declaration', null, null, null,
    'Annulée par le vendeur : l''acheteur a été banni du Marché de Gros. Elle compte contre l''acheteur.' || coalesce(' · ' || nt, ''));
  return 'annulee';
end $$;
revoke all on function public.commande_annuler_acheteur_banni(uuid, text) from public, anon;
grant execute on function public.commande_annuler_acheteur_banni(uuid, text) to authenticated;

-- La tâche des délais (toutes les 5 minutes) : version 99a + n° 1 (par _cmd_reception_base), n° 2, n° 3 et n° 5.
create or replace function public.commandes_delais() returns json
language plpgsql security definer set search_path = public as $$
declare c record; k public.commandes; hc integer := public._cmd_regle('chargement_heures', 72); hr integer := public._cmd_regle('rappel_chargement_heures', 12);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  hl integer := public._cmd_regle('litige_heures', 72); mx integer := public._cmd_regle('mot_essais', 5);
  ha integer := public._cmd_regle('annulation_reponse_heures', 24);
  n1 integer := 0; n2 integer := 0; n3 integer := 0; n4 integer := 0; n5 integer := 0; n6 integer; n7 integer := 0; n12 integer := 0;
  n13 integer := 0; n14 integer := 0; n15 integer := 0; n16 integer := 0;
begin
  for c in select id, confirme_le from public.commandes where etat = 'en_cours' and etape in ('confirmee', 'preparation')
      and confirme_le is not null and rappel_chargement_le is null
      and now() >= confirme_le + make_interval(hours => greatest(hc - hr, 0)) and now() < confirme_le + make_interval(hours => hc)
      for update skip locked loop
    update public.commandes set rappel_chargement_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_chargement',
      format('Chargement attendu avant le %s. Sans chargement, l''acheteur pourra annuler.', to_char((c.confirme_le + make_interval(hours => hc)) at time zone 'UTC', 'DD/MM à HH24"h"MI')));
    n1 := n1 + 1;
  end loop;
  for c in select id from public.commandes where etat = 'en_cours' and etape in ('confirmee', 'preparation')
      and confirme_le is not null and retard_chargement_le is null and now() >= confirme_le + make_interval(hours => hc)
      for update skip locked loop
    update public.commandes set retard_chargement_le = now(), rappel_chargement_le = coalesce(rappel_chargement_le, now()) where id = c.id;
    perform public._cmd_alerte(c.id, 'retard_chargement',
      format('Pas de chargement %s h après la confirmation : l''acheteur peut annuler, ou signaler un problème.', hc));
    n2 := n2 + 1;
  end loop;
  -- 103a n° 5 : demande d'annulation du vendeur sans réponse de l'acheteur en 24 h → acceptée, personne en faute
  for k in select * from public.commandes x where x.etat = 'en_cours' and x.etape in ('confirmee', 'preparation')
      and x.annulation_par is not null and x.annulation_par = x.vendeur_id
      and coalesce(x.annulation_demande_le, (select max(e.at) from public.commande_etapes e where e.commande_id = x.id and e.evenement = 'annulation_demandee'))
          <= now() - make_interval(hours => ha)
      for update skip locked loop
    perform public._fiab_poser(null, null, true, null, null);
    update public.commandes set etat = 'annulee' where id = k.id;
    perform public._fiab_poser(null, null, null, null, null);
    perform public._cmd_journal(k.id, 'annulee', null, 'systeme', 'auto', null, null, null,
      format('Annulation acceptée : l''acheteur n''a pas répondu en %s h. Personne n''est en faute.', ha));
    n15 := n15 + 1;
  end loop;
  -- 103a n° 2 : vendeur banni pendant le transport → l'équipe
  for c in select x.id from public.commandes x where x.etat = 'en_cours' and x.etape in ('chargement', 'transport', 'transbordement')
      and exists (select 1 from public.bannis b where b.user_id = x.vendeur_id) for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      'Vendeur banni du Marché de Gros pendant le transport : l''équipe examine la commande. L''acheteur peut confirmer la réception avec le mot secret.');
    n13 := n13 + 1;
  end loop;
  -- 103a n° 3 : acheteur banni après le chargement (ou après « arrivé ») → l'équipe, sans clôture ni « litige perdu » automatiques
  for c in select x.id from public.commandes x where x.etat = 'en_cours' and x.etape in ('chargement', 'transport', 'transbordement', 'arrivee')
      and exists (select 1 from public.bannis b where b.user_id = x.acheteur_id) for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      'Acheteur banni du Marché de Gros après le chargement : l''équipe examine la commande.');
    n14 := n14 + 1;
  end loop;
  for c in select id from public.commandes where etat = 'en_cours' and etape = 'arrivee' and coalesce(mot_essais, 0) >= mx
      for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      'Mot secret bloqué après l''arrivée : l''acheteur ne peut plus confirmer la réception. L''équipe du Marché de Gros examine la commande.');
    n12 := n12 + 1;
  end loop;
  -- rappel à mi-délai (n° 1 : l'heure part à 7 h pour un « arrivé » de nuit, par _cmd_reception_base)
  for c in select id, livre_le, public._cmd_reception_base(id) arr from public.commandes
      where etat = 'en_cours' and etape = 'arrivee' and rappel_reception_le is null
        and now() >= public._cmd_reception_base(id) + make_interval(secs => mrec * 30)
        and now() < public._cmd_reception_base(id) + make_interval(mins => mrec) for update skip locked loop
    update public.commandes set rappel_reception_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_reception',
      format(case when c.livre_le is null
               then 'Arrivée signalée par l''acheteur : il confirme la réception ou signale un problème avant %s. Sinon, un litige s''ouvre.'
               else 'Livraison déclarée : l''acheteur confirme la réception ou signale un problème avant %s. Sinon, un litige s''ouvre.' end,
        to_char((c.arr + make_interval(mins => mrec)) at time zone 'UTC', 'HH24"h"MI')));
    n3 := n3 + 1;
  end loop;
  for c in select id, livre_le from public.commandes where etat = 'en_cours' and etape = 'arrivee'
      and now() >= public._cmd_reception_base(id) + make_interval(mins => mrec) for update skip locked loop
    update public.commandes set etat = 'litige', litige_par = null, litige_le = now(), litige_auto_le = now(),
      rappel_reception_le = coalesce(rappel_reception_le, now()),
      litige_motif = format(case when c.livre_le is null then 'Réception non confirmée %s min après l''arrivée signalée par l''acheteur'
                                 else 'Réception non confirmée %s min après la livraison déclarée' end, mrec),
      litige_echeance = now() + make_interval(hours => hl), litige_retard_le = null where id = c.id;
    perform public._cmd_journal(c.id, 'litige', null, 'systeme', 'auto', null, null, null,
      format(case when c.livre_le is null
               then 'Pas de réponse de l''acheteur %s min après l''arrivée qu''il a signalée. Sans réponse de sa part dans les %s min, la commande sera close en faveur du vendeur.'
               else 'Pas de réponse de l''acheteur %s min après la livraison déclarée. Sans réponse de sa part dans les %s min, la commande sera close en faveur du vendeur.' end, mrec, mlit));
    n4 := n4 + 1;
  end loop;
  for k in select * from public.commandes where etat = 'litige' and litige_auto_le is not null and litige_par is null
      and now() >= litige_auto_le + make_interval(mins => mlit) for update skip locked loop
    if public._cmd_acheteur_a_reagi(k) then continue; end if;
    -- 103a n° 3 : un acheteur banni ne peut plus répondre → l'équipe tranche, pas de clôture ni de « litige perdu » automatiques
    if public.est_banni(k.acheteur_id) then
      update public.commandes set litige_auto_le = null where id = k.id;
      n16 := n16 + 1;
      continue;
    end if;
    perform set_config('mdg.fiab_fautif', k.acheteur_id::text, true);
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
      libere_le = now(), liberation = 'auto', montant_refuse = 0 where id = k.id;
    perform set_config('mdg.fiab_fautif', '', true);
    perform public._seq_journal(k.id, 'liberee_auto', null, 'systeme',
      format('Clôture en faveur du vendeur : pas de réponse de l''acheteur %s min après l''ouverture du litige', mlit));
    perform public._cmd_journal(k.id, 'terminee', null, 'systeme', 'auto', null, null, null,
      'En faveur du vendeur : l''acheteur n''a pas répondu');
    n7 := n7 + 1;
  end loop;
  update public.commandes set litige_retard_le = now()
  where etat = 'litige' and litige_echeance is not null and litige_echeance < now() and litige_retard_le is null;
  get diagnostics n5 = row_count;
  n6 := public.accords_sans_suite();
  return json_build_object('rappels_chargement', n1, 'retards_chargement', n2, 'rappels_reception', n3, 'litiges_reception', n4,
    'clotures_sans_reponse', n7, 'litiges_en_retard', n5, 'accords_sans_suite', n6, 'litiges_mot_bloque', n12,
    'annulations_sans_reponse', n15, 'litiges_vendeur_banni', n13, 'litiges_acheteur_banni', n14, 'litiges_auto_acheteur_banni', n16);
end $$;
revoke all on function public.commandes_delais() from public, anon, authenticated;
