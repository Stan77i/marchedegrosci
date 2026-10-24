-- ═════════ Marché de Gros CI — schéma 92b : plus de commande bloquée, réception et mot secret encadrés ═════════
-- Audit du 24/10/2026 : P1 n° 2, P2 n° 14 et 15 (en partie), contradictions 7, 8 et 9, P3 n° 32.
--   • confirme_le posé à la confirmation (et pour les achats groupés, créés déjà confirmés) ;
--   • délai de chargement (72 h, réglable) : rappel au vendeur 12 h avant, puis l'acheteur peut annuler seul
--     (commande_annuler_retard : annulation « abusive » imputée au vendeur, par la fiabilité du schéma 84) ;
--   • « Signaler un problème » dès la confirmation ; message « 1 h » au lieu de « 24 h » ; échéance de traitement du litige (72 h) ;
--   • une seule redemande d'annulation par le vendeur : ensuite, l'équipe tranche ;
--   • motif obligatoire même par les anciennes fonctions commande_repondre / commande_annuler (elles restent appelées par le téléphone) ;
--   • « Arrivée / livré » déclarée seulement par celui qui transporte ; 24 h (réglable) sans réception après : litige automatique
--     (règle prudente : personne n'est réputé avoir reçu ni livré, l'équipe regarde ; aucune faute imputée) ;
--   • mot secret : 5 essais (réglable), compteur commun réception et refus, blocage noté et visible par l'équipe ;
--     une seule normalisation du mot (_mot_norme ; _mot_norm la reprend) ;
--   • journal des commandes horodaté par clock_timestamp (ordre fiable dans une même transaction).
--   • rappels, retard et mot bloqué notés dans commande_alertes (lue avec le journal) : commande_etapes refuse les étapes
--     inconnues ; ces avis ne partent donc pas encore en notification (voir plus bas).
-- Tâche planifiée mdg-commandes-delais (*/15) : commandes_delais(). Testé sur le projet de test.

-- 1. Journal trié de façon fiable
alter table public.commande_etapes alter column at set default clock_timestamp();

-- 2. Date de confirmation
create or replace function public._cmd_dates() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.etat = 'en_cours' and new.confirme_le is null then new.confirme_le := now(); end if;
  return new;
end $$;
revoke all on function public._cmd_dates() from public, anon, authenticated;
create or replace trigger commandes_dates before insert or update of etat on public.commandes
  for each row execute function public._cmd_dates();

-- commandes déjà en cours : la date de leur confirmation (journal), sinon leur création
update public.commandes c set confirme_le = coalesce(
  (select min(e.at) from public.commande_etapes e where e.commande_id = c.id and e.evenement = 'confirmee'), c.created_at)
where c.confirme_le is null and c.etat in ('en_cours', 'litige', 'terminee');
-- litiges déjà ouverts : échéance de traitement comptée depuis leur ouverture
update public.commandes set litige_echeance = coalesce(litige_le, updated_at) + make_interval(hours => public._cmd_regle('litige_heures', 72))
where etat = 'litige' and litige_echeance is null;

-- 3. Qui transporte (seul lui déclare l'arrivée / la livraison)
create or replace function public._cmd_transporte(c public.commandes, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(r = 'chauffeur'
    or (c.mode_transport = 'vendeur' and r = 'vendeur')
    or (c.mode_transport = 'acheteur' and r = 'acheteur')
    or (c.mode_transport = 'reseau' and r = 'vendeur'
        and not exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null)), false);
$$;
revoke all on function public._cmd_transporte(public.commandes, text) from public, anon, authenticated;

-- 3 bis. Les avis du système (rappels, retard, mot bloqué) : une table à part, lue avec le journal.
--   commande_etapes n'accepte que les étapes connues (contrainte commande_etapes_evenement_check) ; l'élargir demande de
--   remplacer la contrainte, ce qui attend l'accord du propriétaire. Conséquence : ces avis ne partent pas encore en notification.
create table if not exists public.commande_alertes (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null,
  evenement text not null check (evenement in ('rappel_chargement', 'retard_chargement', 'rappel_reception', 'mot_bloque')),
  note text check (char_length(note) <= 300),
  at timestamptz not null default clock_timestamp()
);
alter table public.commande_alertes enable row level security;
revoke all on public.commande_alertes from anon, authenticated;
create index if not exists commande_alertes_cmd on public.commande_alertes (commande_id, at);

create or replace function public._cmd_alerte(p_cmd uuid, p_ev text, p_note text) returns void
language sql security definer set search_path = public as $$
  insert into public.commande_alertes (commande_id, evenement, note) values (p_cmd, p_ev, left(p_note, 300));
  update public.commandes set updated_at = now() where id = p_cmd;
$$;
revoke all on function public._cmd_alerte(uuid, text, text) from public, anon, authenticated;

-- le journal d'une commande : étapes, transport, codes, séquestre, et maintenant les avis du système
create or replace function public.commande_journal(p_id uuid)
returns table(evenement text, role text, preuve text, lieu text, lat double precision, lon double precision, note text, at timestamptz, par_moi boolean)
language sql stable security definer set search_path = public as $$
  with ok as (select 1 from public.commandes c0 where c0.id = p_id and auth.uid() is not null
              and (public._cmd_role2(c0, auth.uid()) is not null or public.est_admin()))
  select * from (
    select e.evenement, e.role, e.preuve, e.lieu, e.lat, e.lon, e.note, e.at, e.par = auth.uid()
    from public.commande_etapes e where e.commande_id = p_id and exists (select 1 from ok)
    union all
    select a.evenement, 'systeme', 'auto', null, null, null, a.note, a.at, false
    from public.commande_alertes a where a.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'transporteur_' || m.statut, case when m.statut = 'proposee' then m.propose_role else 'chauffeur' end, case when m.propose_role = 'admin' then 'admin' else 'declaration' end,
      t.nom || ' · ' || public._tr_vehicule(t.vehicule), null, null, m.note, coalesce(m.repondu_le, m.created_at),
      (m.statut = 'proposee' and m.propose_par = auth.uid()) or (m.statut <> 'proposee' and t.user_id = auth.uid())
    from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
    where m.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'code_' || k.etape || '_cree', case k.etape when 'prise_en_charge' then 'vendeur' when 'reception' then 'acheteur' else 'chauffeur' end,
      'code', k.lieu, null, null, null, k.cree_le, k.detenteur_id = auth.uid()
    from public.commande_codes k where k.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'code_' || k.etape || '_bloque', 'systeme', 'auto', null, null, null, '5 essais faux', k.cree_le + interval '1 second', false
    from public.commande_codes k where k.commande_id = p_id and k.essais >= 5 and k.utilise_le is null and exists (select 1 from ok)
    union all
    select 'sq_' || q.evenement, q.role, case when q.role = 'systeme' then 'auto' when q.role = 'admin' then 'admin' else 'declaration' end,
      null, null, null, q.note, q.at, q.par = auth.uid()
    from public.sequestre_journal q where q.commande_id = p_id and exists (select 1 from ok)
  ) j order by j.at;
$$;

-- 4. Une seule normalisation du mot secret
create or replace function public._mot_norme(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(upper(translate(coalesce(t, ''), 'àâäáéèêëîïíôöóùûüúçÀÂÄÁÉÈÊËÎÏÍÔÖÓÙÛÜÚÇ', 'aaaaeeeeiiiooouuuucAAAAEEEEIIIOOOUUUUC')), '[^A-Z0-9]', '', 'g')
$$;
create or replace function public._mot_norm(t text) returns text
language sql immutable set search_path = public as $$
  select public._mot_norme(t)
$$;

-- 5. Répondre à une commande : refus avec motif obligatoire (aussi par l'ancienne fonction)
create or replace function public.commande_repondre(p_id uuid, p_oui boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'a_confirmer' then raise exception 'Cette commande a déjà reçu une réponse.'; end if;
  if me = c.cree_par then raise exception 'C''est l''autre partie qui confirme la commande.'; end if;
  nt := public._cmd_texte(p_note, 300);
  if p_oui then
    update public.commandes set etat = 'en_cours', etape = 'confirmee' where id = p_id;
    perform public._cmd_journal(p_id, 'confirmee', me, r, 'declaration', null, null, null, nt);
  else
    if nullif(current_setting('mdg.fiab_motif', true), '') is null then raise exception 'Choisissez un motif.'; end if;
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'refusee', me, r, 'declaration', null, null, null, nt);
  end if;
end $$;

-- 6. Annuler : motif obligatoire, une seule redemande du vendeur, stock rendu par le déclencheur du schéma 92a
create or replace function public.commande_annuler(p_id uuid, p_oui boolean default true, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text;
  mo text := nullif(current_setting('mdg.fiab_motif', true), ''); acc text := nullif(current_setting('mdg.fiab_accord', true), '');
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  nt := public._cmd_texte(p_note, 300);
  if c.etat = 'a_confirmer' then
    if me <> c.cree_par then raise exception 'Répondez plutôt à la commande (confirmer ou refuser).'; end if;
    if mo is null then raise exception 'Choisissez un motif.'; end if;
    update public.commandes set etat = 'annulee' where id = p_id;
    perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
    return 'annulee';
  end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible. Un problème : touchez « Signaler un problème ».'; end if;
  if not p_oui then
    if c.annulation_par is null or c.annulation_par = me then raise exception 'Il n''y a pas de demande d''annulation à refuser.'; end if;
    update public.commandes set annulation_par = null where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_refusee', me, r, 'declaration', null, null, null,
      coalesce(nt || ' · ', '') || case when c.annulation_demandes >= 2 then 'Deuxième refus : l''équipe du Marché de Gros décidera si on lui signale un problème.' else 'Le vendeur peut redemander une fois.' end);
    return 'en_cours';
  end if;
  if c.annulation_par = me then raise exception 'Vous avez déjà demandé l''annulation. L''autre partie doit l''accepter.'; end if;
  if c.annulation_par is null then
    if me = c.acheteur_id then
      raise exception 'Commande confirmée : vous pourrez l''annuler seul si le vendeur n''a pas chargé % h après la confirmation. Avant, en cas de problème : « Signaler un problème ».',
        public._cmd_regle('chargement_heures', 72);
    end if;
    if mo is null then raise exception 'Choisissez un motif.'; end if;
    if c.annulation_demandes >= 2 then
      raise exception 'ANNULATION_LIMITE : l''acheteur a déjà refusé votre annulation deux fois. Touchez « Signaler un problème » : l''équipe du Marché de Gros tranchera.';
    end if;
    update public.commandes set annulation_par = me, annulation_demandes = annulation_demandes + 1 where id = p_id;
    perform public._cmd_journal(p_id, 'annulation_demandee', me, r, 'declaration', null, null, null, nt);
    return 'annulation_demandee';
  end if;
  if acc is null then raise exception 'Dites si vous êtes d''accord avec le motif.'; end if;
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._cmd_journal(p_id, 'annulee', me, r, 'declaration', null, null, null, nt);
  return 'annulee';
end $$;

-- 7. L'acheteur annule seul quand le vendeur n'a pas chargé à temps (imputée au vendeur : fiabilité du schéma 84, catégorie « abusive »)
create or replace function public.commande_annuler_retard(p_id uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; nt text; h integer := public._cmd_regle('chargement_heures', 72); ech timestamptz;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible. Un problème : touchez « Signaler un problème ».'; end if;
  ech := coalesce(c.confirme_le, c.created_at) + make_interval(hours => h);
  if now() < ech then
    raise exception 'TROP_TOT : le vendeur a jusqu''au % pour charger. Après, vous pourrez annuler.', to_char(ech at time zone 'UTC', 'DD/MM à HH24"h"MI');
  end if;
  nt := public._cmd_texte(p_note, 200);
  update public.commandes set annulation_par = c.vendeur_id, annulation_motif = 'sans_reponse',
    annulation_motif_texte = left(format('Pas chargé dans les %s h après la confirmation', h) || coalesce(' · ' || nt, ''), 300)
  where id = p_id;
  perform public._fiab_poser('sans_reponse', null, false, null, null);
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._fiab_poser(null, null, null, null, null);
  perform public._cmd_journal(p_id, 'annulee', me, 'acheteur', 'declaration', null, null, null,
    format('Annulée par l''acheteur : le vendeur n''a pas chargé dans les %s h. Elle compte dans la fiabilité du vendeur.', h) || coalesce(' · ' || nt, ''));
  return 'annulee';
end $$;
revoke all on function public.commande_annuler_retard(uuid, text) from public, anon;
grant execute on function public.commande_annuler_retard(uuid, text) to authenticated;

-- 8. Signaler un problème dès la confirmation, jusqu'à la clôture (1 h après la réception)
create or replace function public.commande_litige(p_id uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; m text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème en quelques mots.'; end if;
  if not (c.etat = 'en_cours' or (c.etat = 'terminee' and c.libere_le is null)) then
    raise exception 'Un problème se signale dès la confirmation de la commande, et jusqu''à sa clôture (1 h après la réception).';
  end if;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now(),
    litige_echeance = now() + make_interval(hours => public._cmd_regle('litige_heures', 72)), litige_retard_le = null where id = p_id;
  perform public._cmd_journal(p_id, 'litige', me, r, 'declaration', null, null, null, m);
end $$;

-- 9. Avancer : « Arrivée » (livré) seulement par celui qui transporte ; on note quand
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null, p_lat double precision default null,
  p_lon double precision default null, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' and p_etape = 'chargement' then raise exception 'Commande avec codes : le chauffeur tape le code de prise en charge que lui donne le vendeur.'; end if;
  if c.validation = 'code' and p_etape = 'reception' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.validation = 'declaration' and c.mode_transport <> 'reseau' and p_etape = 'reception' then
    raise exception 'MOT_REQUIS : pour confirmer la réception, tapez le mot secret du vendeur trouvé dans la marchandise. Mettez l''application à jour si vous ne voyez pas la case.';
  end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120); nt := public._cmd_texte(p_note, 300);
  pv := case when p_lat is not null then 'gps' else 'declaration' end;
  if p_etape = 'preparation' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui prépare la marchandise.'; end if;
    if c.etape <> 'confirmee' then raise exception 'Étape déjà passée.'; end if;
  elsif p_etape = 'chargement' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui confirme le chargement.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'Le chargement est déjà confirmé.'; end if;
  elsif p_etape = 'transport' then
    if c.mode_transport = 'reseau' then raise exception 'Avec le transporteur du réseau, le départ suit son code de prise en charge.'; end if;
    if r <> 'vendeur' and r <> c.mode_transport then raise exception 'C''est le vendeur ou celui qui s''occupe du transport qui signale le départ.'; end if;
    if c.etape <> 'chargement' then raise exception 'Confirmez d''abord le chargement.'; end if;
  elsif p_etape = 'transbordement' then
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le transbordement se signale pendant le transport.'; end if;
    if lieu is null then raise exception 'Indiquez le lieu du transbordement.'; end if;
  elsif p_etape = 'arrivee' then
    if not public._cmd_transporte(c, r) then
      raise exception 'C''est celui qui transporte qui déclare la livraison (%). Vous, confirmez la réception après avoir vérifié.',
        case c.mode_transport when 'vendeur' then 'le vendeur' when 'acheteur' then 'l''acheteur' else 'le chauffeur' end;
    end if;
    if c.etape not in ('chargement', 'transport', 'transbordement') then raise exception 'La marchandise doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('chargement', 'transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;
  update public.commandes set etape = p_etape,
    livre_le = case when p_etape = 'arrivee' then now() else livre_le end,
    livre_par = case when p_etape = 'arrivee' then me else livre_par end where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon,
    case when p_etape = 'arrivee' then coalesce(nt, 'Livraison déclarée') else nt end);
  if p_etape = 'chargement' and c.mode_transport = 'reseau' then
    update public.commandes set etape = 'transport' where id = p_id;
    perform public._cmd_journal(p_id, 'transport', null, 'systeme', 'auto');
    return 'transport';
  elsif p_etape = 'reception' then
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
    perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
    return 'terminee';
  end if;
  return p_etape;
end $$;

-- 10. Réception avec le mot secret : un essai faux ne lève plus d'erreur (sinon le compteur s'efface avec elle) ;
--     réponse « mot_incorrect:<essais restants> » ou « mot_bloque »
create or replace function public.commande_reception_mot(p_id uuid, p_mot text default null, p_sans_mot boolean default false,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; sans boolean := coalesce(p_sans_mot, false);
  mx integer := public._cmd_regle('mot_essais', 5);
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
  if c.validation = 'code' then raise exception 'Commande avec codes : le chauffeur tape le code de réception que lui donne l''acheteur.'; end if;
  if c.etape not in ('chargement', 'transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  if not sans then
    if public._mot_norme(p_mot) = '' then raise exception 'Tapez le mot secret écrit sur le papier glissé dans la marchandise.'; end if;
    if c.mot_essais >= mx then return 'mot_bloque'; end if;
    if c.mot_secret is null or public._mot_norme(p_mot) <> public._mot_norme(c.mot_secret) then
      update public.commandes set mot_essais = mot_essais + 1,
        mot_bloque_le = case when mot_essais + 1 >= mx then now() else mot_bloque_le end where id = p_id;
      if c.mot_essais + 1 >= mx then
        perform public._cmd_alerte(p_id, 'mot_bloque',
          format('%s essais faux : le mot secret est bloqué. L''équipe du Marché de Gros est prévenue.', mx));
        return 'mot_bloque';
      end if;
      return 'mot_incorrect:' || (mx - c.mot_essais - 1);
    end if;
  end if;
  nt := public._cmd_texte(p_note, 240);
  update public.commandes set etape = 'reception' where id = p_id;
  perform public._cmd_journal(p_id, 'reception', me, 'acheteur', case when sans then 'declaration' else 'code' end, null, p_lat, p_lon,
    case when sans then 'Réception confirmée sans le mot secret du vendeur' else 'Mot secret du vendeur retrouvé dans la marchandise' end || coalesce(' · ' || nt, ''));
  update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
  perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
  return 'terminee';
end $$;

-- 11. Refus de la marchandise : même compteur, même normalisation, même blocage
create or replace function public.commande_refuser2(p_id uuid, p_quantite numeric, p_motif text, p_photos text[], p_mot text default null,
  p_sans_mot boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; m text; x text; q numeric; mot text; mx integer := public._cmd_regle('mot_essais', 5);
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Seul l''acheteur peut refuser la marchandise.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)) then
    raise exception 'Le refus se fait quand la marchandise est livrée, ou dans l''heure qui suit la réception, avant la clôture de la commande.';
  end if;
  m := public._cmd_texte(p_motif, 300);
  if m is null then raise exception 'Expliquez le problème (marchandise gâtée, abîmée, quantité manquante…).'; end if;
  if p_photos is null or cardinality(p_photos) < 1 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 1 à 4 photos : la marchandise, et le papier du vendeur.'; end if;
  foreach x in array p_photos loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
  end loop;
  if p_quantite is not null and p_quantite <= 0 then raise exception 'Quantité refusée invalide.'; end if;
  if c.mot_secret is not null then
    if coalesce(p_sans_mot, false) or coalesce(btrim(p_mot), '') = '' then
      raise exception 'Sans le mot secret du vendeur, le refus n''est pas accepté : la partie refusée reste due. S''il n''y avait pas de papier, touchez « Signaler un problème » : l''équipe jugera.';
    end if;
    if c.mot_essais >= mx then return 'mot_bloque'; end if;
    if public._mot_norme(p_mot) <> public._mot_norme(c.mot_secret) then
      update public.commandes set mot_essais = mot_essais + 1,
        mot_bloque_le = case when mot_essais + 1 >= mx then now() else mot_bloque_le end where id = c.id;
      if c.mot_essais + 1 >= mx then
        perform public._cmd_alerte(c.id, 'mot_bloque',
          format('%s essais faux : le mot secret est bloqué. L''équipe du Marché de Gros est prévenue.', mx));
        return 'mot_bloque';
      end if;
      return 'mot_incorrect:' || (mx - c.mot_essais - 1);
    end if;
    mot := 'retrouve';
  end if;
  q := case when p_quantite is null or c.quantite is null or p_quantite >= c.quantite then null else p_quantite end;
  update public.commandes set etat = 'litige', litige_par = me, litige_motif = m, litige_le = now(),
    litige_echeance = now() + make_interval(hours => public._cmd_regle('litige_heures', 72)), litige_retard_le = null,
    refus_quantite = q, refus_motif = m, refus_photos = p_photos, refus_le = now(), refus_mot = mot,
    refus_chauffeur = null, refus_chauffeur_le = null, refus_vendeur = null, refus_vendeur_le = null where id = c.id;
  perform public._seq_journal(c.id, 'refus', me, 'acheteur',
    case when q is null then 'toute la marchandise' else q || ' ' || coalesce(c.unite, '') end || ' : ' || m || case when mot = 'retrouve' then ' · mot du vendeur retrouvé' else '' end);
  perform public._cmd_journal(c.id, 'litige', me, 'acheteur', 'declaration', null, null, null, 'Marchandise refusée : ' || m);
  return 'ok';
end $$;

-- 12. Les délais, passés toutes les 15 minutes
create or replace function public.commandes_delais() returns json
language plpgsql security definer set search_path = public as $$
declare c record; hc integer := public._cmd_regle('chargement_heures', 72); hr integer := public._cmd_regle('rappel_chargement_heures', 12);
  hrec integer := public._cmd_regle('reception_heures', 24); hl integer := public._cmd_regle('litige_heures', 72);
  n1 integer := 0; n2 integer := 0; n3 integer := 0; n4 integer := 0; n5 integer := 0; n6 integer;
begin
  -- rappel au vendeur avant la fin du délai de chargement
  for c in select id, confirme_le from public.commandes where etat = 'en_cours' and etape in ('confirmee', 'preparation')
      and confirme_le is not null and rappel_chargement_le is null
      and now() >= confirme_le + make_interval(hours => greatest(hc - hr, 0)) and now() < confirme_le + make_interval(hours => hc)
      for update skip locked loop
    update public.commandes set rappel_chargement_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_chargement',
      format('Chargement attendu avant le %s. Sans chargement, l''acheteur pourra annuler.', to_char((c.confirme_le + make_interval(hours => hc)) at time zone 'UTC', 'DD/MM à HH24"h"MI')));
    n1 := n1 + 1;
  end loop;
  -- délai de chargement passé : l'acheteur peut annuler (une seule fois dans le journal)
  for c in select id from public.commandes where etat = 'en_cours' and etape in ('confirmee', 'preparation')
      and confirme_le is not null and retard_chargement_le is null and now() >= confirme_le + make_interval(hours => hc)
      for update skip locked loop
    update public.commandes set retard_chargement_le = now(), rappel_chargement_le = coalesce(rappel_chargement_le, now()) where id = c.id;
    perform public._cmd_alerte(c.id, 'retard_chargement',
      format('Pas de chargement %s h après la confirmation : l''acheteur peut annuler, ou signaler un problème.', hc));
    n2 := n2 + 1;
  end loop;
  -- livrée : rappel à l'acheteur à mi-délai
  for c in select id from public.commandes where etat = 'en_cours' and etape = 'arrivee' and livre_le is not null and rappel_reception_le is null
      and now() >= livre_le + make_interval(mins => hrec * 30) for update skip locked loop
    update public.commandes set rappel_reception_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_reception',
      'Livraison déclarée : l''acheteur vérifie, puis confirme la réception ou refuse avec des photos.');
    n3 := n3 + 1;
  end loop;
  -- livrée sans réception dans le délai : litige automatique (personne n'est réputé fautif ; l'équipe vérifie)
  for c in select id from public.commandes where etat = 'en_cours' and etape = 'arrivee' and livre_le is not null
      and now() >= livre_le + make_interval(hours => hrec) for update skip locked loop
    update public.commandes set etat = 'litige', litige_par = null, litige_le = now(),
      litige_motif = format('Réception non confirmée %s h après la livraison déclarée', hrec),
      litige_echeance = now() + make_interval(hours => hl), litige_retard_le = null where id = c.id;
    perform public._cmd_journal(c.id, 'litige', null, 'systeme', 'auto', null, null, null,
      format('Réception non confirmée %s h après la livraison déclarée : l''équipe du Marché de Gros vérifie avec les deux parties. Personne n''est mis en faute.', hrec));
    n4 := n4 + 1;
  end loop;
  -- litiges : échéance de traitement dépassée (signalée à l'équipe dans l'écran admin)
  update public.commandes set litige_retard_le = now()
  where etat = 'litige' and litige_echeance is not null and litige_echeance < now() and litige_retard_le is null;
  get diagnostics n5 = row_count;
  n6 := public.accords_sans_suite();
  return json_build_object('rappels_chargement', n1, 'retards_chargement', n2, 'rappels_reception', n3, 'litiges_reception', n4,
    'litiges_en_retard', n5, 'accords_sans_suite', n6);
end $$;
revoke all on function public.commandes_delais() from public, anon, authenticated;

-- 13. Les délais d'une commande, pour l'écran (les deux parties, le chauffeur, l'équipe)
create or replace function public.commande_delais(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; hc integer := public._cmd_regle('chargement_heures', 72);
  hrec integer := public._cmd_regle('reception_heures', 24); mx integer := public._cmd_regle('mot_essais', 5); ech timestamptz;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if c.id is null or (r is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  ech := case when c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') then coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) end;
  return json_build_object(
    'confirme_le', c.confirme_le,
    'chargement_echeance', ech,
    'peut_annuler_retard', r = 'acheteur' and ech is not null and now() >= ech,
    'je_transporte', coalesce(public._cmd_transporte(c, r), false),
    'livre_le', c.livre_le,
    'reception_echeance', case when c.etat = 'en_cours' and c.etape = 'arrivee' and c.livre_le is not null then c.livre_le + make_interval(hours => hrec) end,
    'mot_essais_restants', greatest(mx - coalesce(c.mot_essais, 0), 0),
    'mot_bloque', coalesce(c.mot_essais, 0) >= mx,
    'annulation_demandes', c.annulation_demandes,
    'peut_redemander', c.annulation_demandes < 2,
    'litige_echeance', c.litige_echeance,
    'chargement_heures', hc, 'reception_heures', hrec);
end $$;
revoke all on function public.commande_delais(uuid) from public, anon;
grant execute on function public.commande_delais(uuid) to authenticated;

-- 14. Tâche planifiée
select cron.schedule('mdg-commandes-delais', '*/15 * * * *', 'select public.commandes_delais()');
