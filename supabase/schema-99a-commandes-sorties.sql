-- Schéma 99a : commandes qui ne restent plus bloquées (contrôle qualité du 25/10/2026 : ANO-023, ANO-024, ANO-026, ANO-042).
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire.
--
-- ANO-023 : trois états sans sortie automatique deviennent : rappel, puis litige ouvert par le système et traité par l'équipe.
--   - marchandise partie (chargement, transport, transbordement), livraison jamais déclarée :
--     rappel au vendeur et à l'acheteur après livraison_rappel_heures (48 h), litige après livraison_litige_heures (96 h) ;
--   - « arrivée » déclarée par l'acheteur sans confirmation de réception (livre_le vide) :
--     rappel à l'acheteur après reception_minutes (60 min), litige après arrivee_litige_heures (24 h) ;
--   - mot secret bloqué (5 essais faux) : l'alerte existe déjà ; litige après mot_bloque_heures (24 h) si l'équipe n'a rien fait.
--   Ces litiges n'ont pas de clôture automatique (litige_auto_le reste vide) : jamais d'argent ni de commande close sans décision
--   de l'équipe. Ils ont l'échéance de litige habituelle (litige_heures, 72 h) puis passent « en retard » comme les autres.
--   Les délais sont dans reglages.commandes, réglables par l'administrateur (admin_commandes_regler).
-- ANO-024 : une demande d'annulation du vendeur encore ouverte est retirée quand la marchandise est chargée (le vendeur a choisi
--   de livrer) ; une ligne « annulation_refusee » écrite par le vendeur, preuve « auto », le dit dans le journal.
-- ANO-026 : vendeur banni : l'acheteur peut annuler tout de suite une commande confirmée et pas chargée ; l'annulation compte
--   contre le vendeur (comme le retard de 72 h), jamais contre l'acheteur.
-- ANO-042 : commande_annuler_motif lit la commande avec « for update ».

-- 1. réglages : valeurs par défaut ajoutées sans écraser une valeur déjà posée
update public.reglages
set valeur = jsonb_build_object('livraison_rappel_heures', 48, 'livraison_litige_heures', 96, 'arrivee_litige_heures', 24,
                                'mot_bloque_heures', 24, 'montant_max', 1000000000) || valeur
where cle = 'commandes';

alter table public.commandes add column if not exists rappel_livraison_le timestamptz;

-- montant le plus élevé accepté pour une commande (ANO-045, voir 99b) ; numeric, la valeur peut dépasser un entier
create or replace function public._cmd_montant_max() returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> 'montant_max')::numeric from public.reglages where cle = 'commandes'), 1000000000);
$$;

-- moment du départ : premier chargement ou départ inscrit au journal de la commande
create or replace function public._cmd_depart_moment(p_cmd uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select min(e.at) from public.commande_etapes e where e.commande_id = p_cmd and e.evenement in ('chargement', 'transport')),
                  (select coalesce(k.depart_le, k.confirme_le, k.created_at) from public.commandes k where k.id = p_cmd));
$$;

-- moment où l'acheteur a dit « arrivée »
create or replace function public._cmd_arrivee_acheteur(p_cmd uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((select max(e.at) from public.commande_etapes e where e.commande_id = p_cmd and e.evenement = 'arrivee' and e.role = 'acheteur'),
                  (select k.updated_at from public.commandes k where k.id = p_cmd));
$$;

-- litige ouvert par le système, pour l'équipe : pas de clôture automatique
create or replace function public._cmd_litige_equipe(p_cmd uuid, p_motif text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.commandes set etat = 'litige', litige_par = null, litige_le = now(), litige_auto_le = null,
    litige_motif = left(p_motif, 300), litige_echeance = now() + make_interval(hours => public._cmd_regle('litige_heures', 72)),
    litige_retard_le = null
  where id = p_cmd and etat = 'en_cours';
  if found then
    perform public._cmd_journal(p_cmd, 'litige', null, 'systeme', 'auto', null, null, null, left(p_motif, 300));
  end if;
end $$;

revoke all on function public._cmd_montant_max() from public, anon, authenticated;
revoke all on function public._cmd_depart_moment(uuid) from public, anon, authenticated;
revoke all on function public._cmd_arrivee_acheteur(uuid) from public, anon, authenticated;
revoke all on function public._cmd_litige_equipe(uuid, text) from public, anon, authenticated;

-- 2. les règles lues par l'application et réglées par l'administrateur
create or replace function public.commandes_regles() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('accord_sans_suite_heures', public._cmd_regle('accord_sans_suite_heures', 72),
    'chargement_heures', public._cmd_regle('chargement_heures', 72), 'rappel_chargement_heures', public._cmd_regle('rappel_chargement_heures', 12),
    'reception_minutes', public._cmd_regle('reception_minutes', 60), 'litige_sans_reponse_minutes', public._cmd_regle('litige_sans_reponse_minutes', 60),
    'litige_heures', public._cmd_regle('litige_heures', 72), 'mot_essais', public._cmd_regle('mot_essais', 5),
    'livraison_rappel_heures', public._cmd_regle('livraison_rappel_heures', 48), 'livraison_litige_heures', public._cmd_regle('livraison_litige_heures', 96),
    'arrivee_litige_heures', public._cmd_regle('arrivee_litige_heures', 24), 'mot_bloque_heures', public._cmd_regle('mot_bloque_heures', 24),
    'montant_max', public._cmd_montant_max());
$$;

create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; x numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'commandes' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('accord_sans_suite_heures', 'chargement_heures', 'rappel_chargement_heures', 'reception_heures', 'litige_heures', 'mot_essais',
                 'reception_minutes', 'litige_sans_reponse_minutes', 'livraison_rappel_heures', 'livraison_litige_heures',
                 'arrivee_litige_heures', 'mot_bloque_heures', 'montant_max') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    if jsonb_typeof(v) <> 'number' then raise exception 'Valeur incorrecte pour %.', k; end if;
    x := (v #>> '{}')::numeric;
    if x <> floor(x) then raise exception 'Valeur incorrecte pour % (nombre entier).', k; end if;
    if k = 'montant_max' then
      if x < 1000000 or x > 100000000000 then raise exception 'Valeur incorrecte pour montant_max (de 1 000 000 à 100 000 000 000 F CFA).'; end if;
    elsif k like '%_minutes' then
      if x < 15 or x > 2880 then raise exception 'Valeur incorrecte pour % (de 15 à 2880 minutes).', k; end if;
    elsif x < 1 or x > 720 then
      raise exception 'Valeur incorrecte pour % (de 1 à 720).', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'rappel_chargement_heures')::int >= (cur ->> 'chargement_heures')::int then
    raise exception 'Le rappel doit partir avant la fin du délai de chargement.';
  end if;
  if coalesce((cur ->> 'livraison_rappel_heures')::int, 48) >= coalesce((cur ->> 'livraison_litige_heures')::int, 96) then
    raise exception 'Le rappel de livraison doit partir avant l''ouverture du litige.';
  end if;
  if (cur ->> 'mot_essais')::int > 20 then raise exception 'Mot secret : 20 essais au plus.'; end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'commandes';
  return cur::json;
end $$;

-- 3. la tâche des délais (toutes les 5 minutes) : trois nouvelles sorties
create or replace function public.commandes_delais() returns json
language plpgsql security definer set search_path = public as $$
declare c record; k public.commandes; hc integer := public._cmd_regle('chargement_heures', 72); hr integer := public._cmd_regle('rappel_chargement_heures', 12);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  hl integer := public._cmd_regle('litige_heures', 72); mx integer := public._cmd_regle('mot_essais', 5);
  hlr integer := public._cmd_regle('livraison_rappel_heures', 48); hll integer := public._cmd_regle('livraison_litige_heures', 96);
  hal integer := public._cmd_regle('arrivee_litige_heures', 24); hmb integer := public._cmd_regle('mot_bloque_heures', 24);
  n1 integer := 0; n2 integer := 0; n3 integer := 0; n4 integer := 0; n5 integer := 0; n6 integer; n7 integer := 0;
  n8 integer := 0; n9 integer := 0; n10 integer := 0; n11 integer := 0; n12 integer := 0; u uuid;
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
  for c in select id, livre_le from public.commandes where etat = 'en_cours' and etape = 'arrivee' and livre_le is not null and rappel_reception_le is null
      and now() >= livre_le + make_interval(secs => mrec * 30) and now() < livre_le + make_interval(mins => mrec) for update skip locked loop
    update public.commandes set rappel_reception_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_reception',
      format('Livraison déclarée : l''acheteur confirme la réception ou signale un problème avant %s. Sinon, un litige s''ouvre.',
        to_char((c.livre_le + make_interval(mins => mrec)) at time zone 'UTC', 'HH24"h"MI')));
    n3 := n3 + 1;
  end loop;
  for c in select id from public.commandes where etat = 'en_cours' and etape = 'arrivee' and livre_le is not null
      and now() >= livre_le + make_interval(mins => mrec) for update skip locked loop
    update public.commandes set etat = 'litige', litige_par = null, litige_le = now(), litige_auto_le = now(),
      rappel_reception_le = coalesce(rappel_reception_le, now()),
      litige_motif = format('Réception non confirmée %s min après la livraison déclarée', mrec),
      litige_echeance = now() + make_interval(hours => hl), litige_retard_le = null where id = c.id;
    perform public._cmd_journal(c.id, 'litige', null, 'systeme', 'auto', null, null, null,
      format('Pas de réponse de l''acheteur %s min après la livraison déclarée. Sans réponse de sa part dans les %s min, la commande sera close en faveur du vendeur.', mrec, mlit));
    n4 := n4 + 1;
  end loop;
  for k in select * from public.commandes where etat = 'litige' and litige_auto_le is not null and litige_par is null
      and now() >= litige_auto_le + make_interval(mins => mlit) for update skip locked loop
    if public._cmd_acheteur_a_reagi(k) then continue; end if;
    -- l'acheteur n'a pas répondu : « litige perdu » imputé à l'acheteur (déclencheur _fiab_litige_perdu, schéma 94f)
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

  -- 99a : marchandise partie, livraison jamais déclarée → rappel au vendeur et à l'acheteur
  for c in select id, vendeur_id, acheteur_id, numero, produit from public.commandes
      where etat = 'en_cours' and etape in ('chargement', 'transport', 'transbordement') and livre_le is null
        and rappel_livraison_le is null and coalesce(mot_essais, 0) < mx
        and now() >= public._cmd_depart_moment(id) + make_interval(hours => hlr)
      for update skip locked loop
    update public.commandes set rappel_livraison_le = now() where id = c.id;
    foreach u in array array[c.vendeur_id, c.acheteur_id] loop
      perform public._notif_mettre(u, 'commande', 'cmd_rappel_livraison', 'cmdliv:' || c.id || ':' || u, 'cmd:' || c.id, c.id::text, null, c.produit,
        'application.dc.html#/?commande=' || c.id,
        jsonb_build_object('role', case when u = c.vendeur_id then 'vendeur' else 'acheteur' end, 'numero', c.numero,
          'echeance', public._cmd_depart_moment(c.id) + make_interval(hours => hll)));
    end loop;
    n8 := n8 + 1;
  end loop;
  -- … puis litige pour l'équipe
  for c in select id from public.commandes
      where etat = 'en_cours' and etape in ('chargement', 'transport', 'transbordement') and livre_le is null and coalesce(mot_essais, 0) < mx
        and now() >= public._cmd_depart_moment(id) + make_interval(hours => hll)
      for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      format('Livraison pas déclarée %s h après le départ de la marchandise. L''équipe du Marché de Gros examine la commande.', hll));
    n9 := n9 + 1;
  end loop;
  -- 99a : « arrivée » dite par l'acheteur, réception pas confirmée → rappel à l'acheteur
  for c in select id, acheteur_id, numero, produit from public.commandes
      where etat = 'en_cours' and etape = 'arrivee' and livre_le is null and rappel_reception_le is null and coalesce(mot_essais, 0) < mx
        and now() >= public._cmd_arrivee_acheteur(id) + make_interval(mins => mrec)
      for update skip locked loop
    update public.commandes set rappel_reception_le = now() where id = c.id;
    perform public._notif_mettre(c.acheteur_id, 'commande', 'cmd_rappel_arrivee', 'cmdarr:' || c.id, 'cmd:' || c.id, c.id::text, null, c.produit,
      'application.dc.html#/?commande=' || c.id,
      jsonb_build_object('role', 'acheteur', 'numero', c.numero, 'echeance', public._cmd_arrivee_acheteur(c.id) + make_interval(hours => hal)));
    n10 := n10 + 1;
  end loop;
  -- … puis litige pour l'équipe
  for c in select id from public.commandes
      where etat = 'en_cours' and etape = 'arrivee' and livre_le is null and coalesce(mot_essais, 0) < mx
        and now() >= public._cmd_arrivee_acheteur(id) + make_interval(hours => hal)
      for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      format('Arrivée signalée par l''acheteur, réception pas confirmée après %s h. L''équipe du Marché de Gros examine la commande.', hal));
    n11 := n11 + 1;
  end loop;
  -- 99a : mot secret bloqué, rien fait par l'équipe → litige (l'alerte « mot_bloque » est déjà partie)
  for c in select id from public.commandes
      where etat = 'en_cours' and coalesce(mot_essais, 0) >= mx
        and now() >= coalesce(mot_bloque_le, updated_at) + make_interval(hours => hmb)
      for update skip locked loop
    perform public._cmd_litige_equipe(c.id,
      format('Mot secret bloqué depuis %s h. L''équipe du Marché de Gros examine la commande.', hmb));
    n12 := n12 + 1;
  end loop;

  update public.commandes set litige_retard_le = now()
  where etat = 'litige' and litige_echeance is not null and litige_echeance < now() and litige_retard_le is null;
  get diagnostics n5 = row_count;
  n6 := public.accords_sans_suite();
  return json_build_object('rappels_chargement', n1, 'retards_chargement', n2, 'rappels_reception', n3, 'litiges_reception', n4,
    'clotures_sans_reponse', n7, 'litiges_en_retard', n5, 'accords_sans_suite', n6,
    'rappels_livraison', n8, 'litiges_livraison', n9, 'rappels_arrivee', n10, 'litiges_arrivee', n11, 'litiges_mot_bloque', n12);
end $$;

-- 4. ce que l'écran de la commande lit : les nouvelles échéances et l'annulation possible quand le vendeur est banni
create or replace function public.commande_delais(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; hc integer := public._cmd_regle('chargement_heures', 72);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  mx integer := public._cmd_regle('mot_essais', 5); ech timestamptz; auto boolean; vb boolean;
  hll integer := public._cmd_regle('livraison_litige_heures', 96); hal integer := public._cmd_regle('arrivee_litige_heures', 24);
  hmb integer := public._cmd_regle('mot_bloque_heures', 24);
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if c.id is null or (r is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  ech := case when c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') then coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) end;
  auto := c.etat = 'litige' and c.litige_auto_le is not null and not public._cmd_acheteur_a_reagi(c);
  vb := public.est_banni(c.vendeur_id);
  return json_build_object(
    'confirme_le', c.confirme_le,
    'chargement_echeance', ech,
    'peut_annuler_retard', r = 'acheteur' and ech is not null and (now() >= ech or vb),
    'vendeur_banni', r = 'acheteur' and vb,
    'je_transporte', coalesce(public._cmd_transporte(c, r), false),
    'peut_declarer_arrivee', c.etat = 'en_cours' and ((r = 'acheteur' and c.etape in ('chargement', 'transport', 'transbordement'))
      or (r in ('vendeur', 'chauffeur') and c.livre_le is null and c.etape in ('chargement', 'transport', 'transbordement', 'arrivee'))),
    'livre_le', c.livre_le,
    'reception_echeance', case when c.etat = 'en_cours' and c.etape = 'arrivee' and c.livre_le is not null then c.livre_le + make_interval(mins => mrec) end,
    'livraison_echeance', case when c.etat = 'en_cours' and c.etape in ('chargement', 'transport', 'transbordement') and c.livre_le is null
      then public._cmd_depart_moment(c.id) + make_interval(hours => hll) end,
    'arrivee_echeance', case when c.etat = 'en_cours' and c.etape = 'arrivee' and c.livre_le is null
      then public._cmd_arrivee_acheteur(c.id) + make_interval(hours => hal) end,
    'mot_echeance', case when c.etat = 'en_cours' and coalesce(c.mot_essais, 0) >= mx
      then coalesce(c.mot_bloque_le, c.updated_at) + make_interval(hours => hmb) end,
    'litige_auto', auto,
    'cloture_echeance', case when auto then c.litige_auto_le + make_interval(mins => mlit) end,
    'mot_essais_restants', greatest(mx - coalesce(c.mot_essais, 0), 0),
    'mot_bloque', coalesce(c.mot_essais, 0) >= mx,
    'annulation_demandes', c.annulation_demandes,
    'peut_redemander', c.annulation_demandes < 2,
    'litige_echeance', c.litige_echeance,
    'chargement_heures', hc, 'reception_minutes', mrec, 'litige_sans_reponse_minutes', mlit,
    'reception_heures', greatest(round(mrec / 60.0), 1));
end $$;

-- 5. ANO-026 : vendeur banni → l'acheteur annule sans attendre ; l'annulation compte contre le vendeur
create or replace function public.commande_annuler_retard(p_id uuid, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; nt text; h integer := public._cmd_regle('chargement_heures', 72); ech timestamptz; vb boolean;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.acheteur_id then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.etape not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : l''annulation n''est plus possible. Un problème : touchez « Signaler un problème ».'; end if;
  vb := public.est_banni(c.vendeur_id);
  ech := coalesce(c.confirme_le, c.created_at) + make_interval(hours => h);
  if now() < ech and not vb then
    raise exception 'TROP_TOT : le vendeur a jusqu''au % pour charger. Après, vous pourrez annuler.', to_char(ech at time zone 'UTC', 'DD/MM à HH24"h"MI');
  end if;
  nt := public._cmd_texte(p_note, 200);
  if vb then
    update public.commandes set annulation_par = c.vendeur_id, annulation_motif = 'autre',
      annulation_motif_texte = left('Vendeur banni du Marché de Gros' || coalesce(' · ' || nt, ''), 300)
    where id = p_id;
    perform public._fiab_poser('autre', 'Vendeur banni du Marché de Gros', false, null, null);
  else
    update public.commandes set annulation_par = c.vendeur_id, annulation_motif = 'sans_reponse',
      annulation_motif_texte = left(format('Pas chargé dans les %s h après la confirmation', h) || coalesce(' · ' || nt, ''), 300)
    where id = p_id;
    perform public._fiab_poser('sans_reponse', null, false, null, null);
  end if;
  update public.commandes set etat = 'annulee' where id = p_id;
  perform public._fiab_poser(null, null, null, null, null);
  perform public._cmd_journal(p_id, 'annulee', me, 'acheteur', 'declaration', null, null, null,
    case when vb then 'Annulée par l''acheteur : le vendeur a été banni du Marché de Gros. Elle compte contre le vendeur.'
         else format('Annulée par l''acheteur : le vendeur n''a pas chargé dans les %s h. Elle compte dans la fiabilité du vendeur.', h) end
    || coalesce(' · ' || nt, ''));
  return 'annulee';
end $$;

-- 6. ANO-042 : lecture verrouillée
create or replace function public.commande_annuler_motif(p_id uuid, p_oui boolean default true, p_note text default null, p_motif text default null,
  p_motif_texte text default null, p_accord boolean default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t text; r text;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me not in (c.vendeur_id, c.acheteur_id) then raise exception 'Commande introuvable.'; end if;
  if c.etat = 'a_confirmer' or (c.etat = 'en_cours' and p_oui and c.annulation_par is null) then
    t := public._fiab_motif_ok(p_motif, p_motif_texte);
    perform public._fiab_poser(p_motif, t, null, null, null);
  elsif c.etat = 'en_cours' and p_oui and c.annulation_par is not null and c.annulation_par <> me then
    if p_accord is null then raise exception 'Dites si vous êtes d''accord avec le motif.'; end if;
    perform public._fiab_poser(null, null, p_accord, null, null);
  end if;
  r := public.commande_annuler(p_id, p_oui, p_note);
  if r = 'annulation_demandee' then
    update public.commandes set annulation_motif = p_motif, annulation_motif_texte = t where id = p_id;
  elsif r = 'en_cours' then
    update public.commandes set annulation_motif = null, annulation_motif_texte = null where id = p_id;
  end if;
  perform public._fiab_poser(null, null, null, null, null);
  return r;
end $$;

-- 7. ANO-024 : la marchandise est chargée alors que le vendeur avait demandé l'annulation → la demande est retirée
create or replace function public._cmd_annulation_retiree() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.etat = 'en_cours' and new.annulation_par is not null and old.etape in ('confirmee', 'preparation')
     and new.etape not in ('confirmee', 'preparation') then
    update public.commandes set annulation_par = null, annulation_motif = null, annulation_motif_texte = null where id = new.id;
    insert into public.commande_etapes (commande_id, evenement, par, role, preuve, note)
    values (new.id, 'annulation_refusee', new.annulation_par,
      case when new.annulation_par = new.vendeur_id then 'vendeur' else 'acheteur' end, 'auto',
      'Demande d''annulation retirée : la marchandise est chargée.');
  end if;
  return new;
end $$;
revoke all on function public._cmd_annulation_retiree() from public, anon, authenticated;

create or replace trigger commandes_annulation_retiree after update of etape on public.commandes
  for each row execute function public._cmd_annulation_retiree();
