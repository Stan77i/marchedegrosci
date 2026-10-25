-- ═════════ Marché de Gros CI — schéma 97b : litige en 1 h quand l'acheteur se tait après « livré » ═════════
-- Règle du propriétaire (24-25/10/2026) :
--   • le vendeur (ou le chauffeur) déclare « livré » ; l'acheteur a 1 h pour confirmer la réception (mot secret) ou signaler un problème ;
--   • sans réaction : le litige s'ouvre tout seul (avant : 24 h, rappel à 12 h) ;
--   • si l'acheteur ne réagit toujours pas 1 h après l'ouverture du litige (ni message dans le litige, ni réception, ni refus avec photos),
--     la commande est close en faveur du vendeur : « honorée », clôture automatique (liberation = 'auto').
-- Aucun paiement n'est branché : rien n'est versé, la commission reste « calculée » (schéma 95b, _cmd_argent_passe).
-- LE JOUR DU SÉQUESTRE : cette clôture (libere_le posé) débloquera l'argent du vendeur par le déclencheur _seq_commande,
-- comme la clôture 1 h après la réception. Ne pas brancher ce passage sans relire cette règle avec le propriétaire.
-- Pendant ce litige automatique, l'acheteur peut encore confirmer la réception avec le mot secret, ou refuser avec des photos
-- (il devient alors l'auteur du litige, l'équipe tranche). Un message de l'acheteur dans le litige arrête la clôture automatique :
-- le litige continue avec l'équipe.
-- Délais réglables par l'administrateur (admin_commandes_regler) : reception_minutes (60), litige_sans_reponse_minutes (60).
-- Les avis : « livré » (étape arrivee), litige ouvert (étape litige du système), clôture (étape terminee du système) partent par le
-- déclencheur des étapes (push_commande → pousser) ; le rappel à mi-délai part par commande_alertes (schéma 92d).
-- Tâche mdg-commandes-delais : toutes les 5 minutes (avant : 15). Rien n'est effacé. Testé sur le projet de test
-- (supabase/tests/litige-quantites-97-scenarios.sql).

-- 1. Réglages en minutes (les valeurs déjà posées par l'administrateur sont gardées)
update public.reglages set valeur = jsonb_build_object('reception_minutes', 60, 'litige_sans_reponse_minutes', 60) || valeur
where cle = 'commandes';

create or replace function public.commandes_regles() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('accord_sans_suite_heures', public._cmd_regle('accord_sans_suite_heures', 72),
    'chargement_heures', public._cmd_regle('chargement_heures', 72), 'rappel_chargement_heures', public._cmd_regle('rappel_chargement_heures', 12),
    'reception_minutes', public._cmd_regle('reception_minutes', 60), 'litige_sans_reponse_minutes', public._cmd_regle('litige_sans_reponse_minutes', 60),
    'litige_heures', public._cmd_regle('litige_heures', 72), 'mot_essais', public._cmd_regle('mot_essais', 5));
$$;

create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; x numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'commandes' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('accord_sans_suite_heures', 'chargement_heures', 'rappel_chargement_heures', 'reception_heures', 'litige_heures', 'mot_essais',
                 'reception_minutes', 'litige_sans_reponse_minutes') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    if jsonb_typeof(v) <> 'number' then raise exception 'Valeur incorrecte pour %.', k; end if;
    x := (v #>> '{}')::numeric;
    if x <> floor(x) then raise exception 'Valeur incorrecte pour % (nombre entier).', k; end if;
    if k like '%_minutes' then
      if x < 15 or x > 2880 then raise exception 'Valeur incorrecte pour % (de 15 à 2880 minutes).', k; end if;
    elsif x < 1 or x > 720 then
      raise exception 'Valeur incorrecte pour % (de 1 à 720).', k;
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  if (cur ->> 'rappel_chargement_heures')::int >= (cur ->> 'chargement_heures')::int then
    raise exception 'Le rappel doit partir avant la fin du délai de chargement.';
  end if;
  if (cur ->> 'mot_essais')::int > 20 then raise exception 'Mot secret : 20 essais au plus.'; end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'commandes';
  return cur::json;
end $$;
revoke all on function public.admin_commandes_regler(jsonb) from public, anon;
grant execute on function public.admin_commandes_regler(jsonb) to authenticated;

-- 2. Le litige ouvert tout seul (sans réponse de l'acheteur) : sa date
alter table public.commandes add column if not exists litige_auto_le timestamptz;

-- l'acheteur a-t-il réagi pendant ce litige automatique ? (message, refus avec photos, ou il en est devenu l'auteur)
create or replace function public._cmd_acheteur_a_reagi(c public.commandes) returns boolean
language sql stable security definer set search_path = public as $$
  select c.litige_par is not null
      or (c.refus_le is not null and c.refus_le >= c.litige_auto_le)
      or exists (select 1 from public.litige_messages m where m.commande_id = c.id and m.auteur_id = c.acheteur_id and m.at >= c.litige_auto_le);
$$;
revoke all on function public._cmd_acheteur_a_reagi(public.commandes) from public, anon, authenticated;

-- 3. Les délais, passés toutes les 5 minutes
create or replace function public.commandes_delais() returns json
language plpgsql security definer set search_path = public as $$
declare c record; k public.commandes; hc integer := public._cmd_regle('chargement_heures', 72); hr integer := public._cmd_regle('rappel_chargement_heures', 12);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  hl integer := public._cmd_regle('litige_heures', 72);
  n1 integer := 0; n2 integer := 0; n3 integer := 0; n4 integer := 0; n5 integer := 0; n6 integer; n7 integer := 0;
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
  -- livrée : rappel à l'acheteur à mi-délai (30 min sur 60)
  for c in select id, livre_le from public.commandes where etat = 'en_cours' and etape = 'arrivee' and livre_le is not null and rappel_reception_le is null
      and now() >= livre_le + make_interval(secs => mrec * 30) and now() < livre_le + make_interval(mins => mrec) for update skip locked loop
    update public.commandes set rappel_reception_le = now() where id = c.id;
    perform public._cmd_alerte(c.id, 'rappel_reception',
      format('Livraison déclarée : l''acheteur confirme la réception ou signale un problème avant %s. Sinon, un litige s''ouvre.',
        to_char((c.livre_le + make_interval(mins => mrec)) at time zone 'UTC', 'HH24"h"MI')));
    n3 := n3 + 1;
  end loop;
  -- livrée, sans réception ni réclamation dans le délai : litige automatique (l'acheteur est prévenu par l'étape « litige »)
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
  -- litige automatique, l'acheteur ne réagit toujours pas : clôture en faveur du vendeur.
  -- Aucun argent n'est versé (pas de paiement branché) ; le jour du séquestre, ce passage débloquera l'argent du vendeur.
  for k in select * from public.commandes where etat = 'litige' and litige_auto_le is not null and litige_par is null
      and now() >= litige_auto_le + make_interval(mins => mlit) for update skip locked loop
    if public._cmd_acheteur_a_reagi(k) then continue; end if;
    update public.commandes set etat = 'terminee', etape = 'terminee', termine_le = coalesce(termine_le, now()),
      libere_le = now(), liberation = 'auto', montant_refuse = 0 where id = k.id;
    perform public._seq_journal(k.id, 'liberee_auto', null, 'systeme',
      format('Clôture en faveur du vendeur : pas de réponse de l''acheteur %s min après l''ouverture du litige', mlit));
    perform public._cmd_journal(k.id, 'terminee', null, 'systeme', 'auto', null, null, null,
      'En faveur du vendeur : l''acheteur n''a pas répondu');
    n7 := n7 + 1;
  end loop;
  -- litiges : échéance de traitement dépassée (signalée à l'équipe dans l'écran admin)
  update public.commandes set litige_retard_le = now()
  where etat = 'litige' and litige_echeance is not null and litige_echeance < now() and litige_retard_le is null;
  get diagnostics n5 = row_count;
  n6 := public.accords_sans_suite();
  return json_build_object('rappels_chargement', n1, 'retards_chargement', n2, 'rappels_reception', n3, 'litiges_reception', n4,
    'clotures_sans_reponse', n7, 'litiges_en_retard', n5, 'accords_sans_suite', n6);
end $$;
revoke all on function public.commandes_delais() from public, anon, authenticated;

-- 4. Les délais d'une commande, pour l'écran
create or replace function public.commande_delais(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; hc integer := public._cmd_regle('chargement_heures', 72);
  mrec integer := public._cmd_regle('reception_minutes', 60); mlit integer := public._cmd_regle('litige_sans_reponse_minutes', 60);
  mx integer := public._cmd_regle('mot_essais', 5); ech timestamptz; auto boolean;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if c.id is null or (r is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  ech := case when c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation') then coalesce(c.confirme_le, c.created_at) + make_interval(hours => hc) end;
  auto := c.etat = 'litige' and c.litige_auto_le is not null and not public._cmd_acheteur_a_reagi(c);
  return json_build_object(
    'confirme_le', c.confirme_le,
    'chargement_echeance', ech,
    'peut_annuler_retard', r = 'acheteur' and ech is not null and now() >= ech,
    'je_transporte', coalesce(public._cmd_transporte(c, r), false),
    'peut_declarer_arrivee', c.etat = 'en_cours' and ((r = 'acheteur' and c.etape in ('chargement', 'transport', 'transbordement'))
      or (r in ('vendeur', 'chauffeur') and c.livre_le is null and c.etape in ('chargement', 'transport', 'transbordement', 'arrivee'))),
    'livre_le', c.livre_le,
    'reception_echeance', case when c.etat = 'en_cours' and c.etape = 'arrivee' and c.livre_le is not null then c.livre_le + make_interval(mins => mrec) end,
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
revoke all on function public.commande_delais(uuid) from public, anon;
grant execute on function public.commande_delais(uuid) to authenticated;

-- 5. L'avis « rappel de réception » : échéance en minutes
create or replace function public._cmd_alerte_notif() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.commandes; u uuid; dests uuid[]; t text := 'cmd_' || new.evenement;
begin
  select * into c from public.commandes where id = new.commande_id;
  if c.id is null then return new; end if;
  dests := case new.evenement
    when 'rappel_chargement' then array[c.vendeur_id]
    when 'retard_chargement' then array[c.acheteur_id, c.vendeur_id]
    when 'rappel_reception' then array[c.acheteur_id]
    when 'mot_bloque' then array[c.acheteur_id, c.vendeur_id]
    else array[]::uuid[] end;
  foreach u in array dests loop
    perform public._notif_mettre(u, 'commande', t, 'cmdal:' || new.id || ':' || u, 'cmd:' || c.id, c.id::text, null, c.produit,
      'application.dc.html#/?commande=' || c.id,
      jsonb_build_object('role', case when u = c.vendeur_id then 'vendeur' else 'acheteur' end, 'numero', c.numero,
        'echeance', case new.evenement
          when 'rappel_chargement' then coalesce(c.confirme_le, c.created_at) + make_interval(hours => public._cmd_regle('chargement_heures', 72))
          when 'rappel_reception' then c.livre_le + make_interval(mins => public._cmd_regle('reception_minutes', 60)) end));
  end loop;
  return new;
exception when others then return new;
end $$;
revoke all on function public._cmd_alerte_notif() from public, anon, authenticated;

-- 6. Pendant le litige automatique, l'acheteur peut encore confirmer la réception avec le mot secret
create or replace function public.commande_reception_mot(p_id uuid, p_mot text default null, p_sans_mot boolean default false,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; nt text; sans boolean := coalesce(p_sans_mot, false);
  mx integer := public._cmd_regle('mot_essais', 5); auto boolean;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  auto := c.etat = 'litige' and c.litige_auto_le is not null and c.litige_par is null and c.etape = 'arrivee';
  if c.etat <> 'en_cours' and not auto then raise exception 'Cette commande n''est pas en cours.'; end if;
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

-- 7. Pendant le litige automatique, l'acheteur peut aussi refuser avec des photos (il devient l'auteur du litige, l'équipe tranche)
do $$
declare d text; a text := $a$if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)) then$a$;
begin
  select pg_get_functiondef('public.commande_refuser2(uuid, numeric, text, text[], text, boolean)'::regprocedure) into d;
  if position('c.litige_auto_le is not null' in d) > 0 then return; end if;   -- déjà fait
  if position(a in d) = 0 then raise exception 'commande_refuser2 : motif introuvable'; end if;
  d := replace(d, a, $b$if not ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)
      or (c.etat = 'litige' and c.litige_auto_le is not null and c.litige_par is null)) then$b$);
  execute d;
end $$;

-- 8. Tâche planifiée : toutes les 5 minutes (un délai d'1 h demande un passage fréquent)
select cron.schedule('mdg-commandes-delais', '*/5 * * * *', 'select public.commandes_delais()');
