-- Schéma 102b : la participation de l'acheteur dans les délais des commandes (97b, 99a) et dans le suivi.
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire. À appliquer après 102a.
--
-- - Une proposition de participation compte comme une réaction de l'acheteur : le litige automatique (acheteur muet 1 h après
--   « arrivé ») n'est plus clos en faveur du vendeur ; l'équipe tranche si le vendeur refuse ou ne répond pas.
-- - Le vendeur a participation_reponse_heures (24 h, réglable) pour répondre. Sans réponse : la proposition expire, le litige
--   reste à l'équipe (déjà prévenue par le litige ouvert) ; les deux sont prévenus. Proposition à valider par le propriétaire.
--   Tâche mdg-participations toutes les 5 minutes (séparée de commandes_delais pour ne pas réécrire cette fonction).
-- - Réglages : participation_reponse_heures (1 à 720), participation_max (1 à 10, 3 par défaut).
-- - commande_suivi_lire rend aussi les propositions (genre « participation »).
-- Rien n'est effacé.

-- 1. réglages par défaut (les valeurs déjà posées sont gardées)
update public.reglages set valeur = jsonb_build_object('participation_reponse_heures', 24, 'participation_max', 3) || valeur
where cle = 'commandes';

-- 2. l'acheteur a-t-il réagi pendant le litige automatique ? (message, refus avec photos, auteur du litige, ou participation)
create or replace function public._cmd_acheteur_a_reagi(c public.commandes) returns boolean
language sql stable security definer set search_path = public as $$
  select c.litige_par is not null
      or (c.refus_le is not null and c.refus_le >= c.litige_auto_le)
      or exists (select 1 from public.litige_messages m where m.commande_id = c.id and m.auteur_id = c.acheteur_id and m.at >= c.litige_auto_le)
      or exists (select 1 from public.commande_participations p where p.commande_id = c.id and p.par = c.acheteur_id and p.cree_le >= c.litige_auto_le);
$$;
revoke all on function public._cmd_acheteur_a_reagi(public.commandes) from public, anon, authenticated;

-- 3. proposition sans réponse du vendeur : elle expire, l'équipe tranche le litige
create or replace function public.participations_delais() returns json
language plpgsql security definer set search_path = public as $$
declare p public.commande_participations; c public.commandes; n integer := 0;
begin
  for p in select * from public.commande_participations where statut = 'ouverte' and echeance <= now() for update skip locked loop
    update public.commande_participations set statut = 'expiree', fin_le = now() where id = p.id returning * into p;
    select * into c from public.commandes where id = p.commande_id;
    update public.commandes set updated_at = now() where id = c.id;
    perform public._part_avis(c.acheteur_id, c, p, 'cmd_participation_expiree');
    perform public._part_avis(c.vendeur_id, c, p, 'cmd_participation_expiree');
    n := n + 1;
  end loop;
  return json_build_object('participations_expirees', n);
end $$;
revoke all on function public.participations_delais() from public, anon, authenticated;

select cron.schedule('mdg-participations', '*/5 * * * *', 'select public.participations_delais()');

-- 4. les règles lues par l'application et réglées par l'administrateur (99a + participation)
create or replace function public.commandes_regles() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('accord_sans_suite_heures', public._cmd_regle('accord_sans_suite_heures', 72),
    'chargement_heures', public._cmd_regle('chargement_heures', 72), 'rappel_chargement_heures', public._cmd_regle('rappel_chargement_heures', 12),
    'reception_minutes', public._cmd_regle('reception_minutes', 60), 'litige_sans_reponse_minutes', public._cmd_regle('litige_sans_reponse_minutes', 60),
    'litige_heures', public._cmd_regle('litige_heures', 72), 'mot_essais', public._cmd_regle('mot_essais', 5),
    'montant_max', public._cmd_montant_max(),
    'participation_reponse_heures', public._cmd_regle('participation_reponse_heures', 24), 'participation_max', public._cmd_regle('participation_max', 3));
$$;

create or replace function public.admin_commandes_regler(p_valeurs jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; x numeric;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'commandes' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k not in ('accord_sans_suite_heures', 'chargement_heures', 'rappel_chargement_heures', 'reception_heures', 'litige_heures', 'mot_essais',
                 'reception_minutes', 'litige_sans_reponse_minutes', 'montant_max', 'participation_reponse_heures', 'participation_max') then
      raise exception 'Réglage inconnu : %', k;
    end if;
    if jsonb_typeof(v) <> 'number' then raise exception 'Valeur incorrecte pour %.', k; end if;
    x := (v #>> '{}')::numeric;
    if x <> floor(x) then raise exception 'Valeur incorrecte pour % (nombre entier).', k; end if;
    if k = 'montant_max' then
      if x < 1000000 or x > 100000000000 then raise exception 'Valeur incorrecte pour montant_max (de 1 000 000 à 100 000 000 000 F CFA).'; end if;
    elsif k = 'participation_max' then
      if x < 1 or x > 10 then raise exception 'Valeur incorrecte pour participation_max (de 1 à 10).'; end if;
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
  if (cur ->> 'mot_essais')::int > 20 then raise exception 'Mot secret : 20 essais au plus.'; end if;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'commandes';
  return cur::json;
end $$;

-- 5. le suivi lu par les parties et l'équipe : retards, nouvelles, délais (99a) et participations (102)
create or replace function public.commande_suivi_lire(p_id uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into c from public.commandes where id = p_id;
  if c.id is null or (public._cmd_role2(c, me) is null and not public.est_admin()) then raise exception 'Commande introuvable.'; end if;
  return (select coalesce(json_agg(x.j order by x.at), '[]'::json) from (
    select s.at, json_build_object('genre', s.genre, 'role', s.role, 'motif', s.motif, 'texte', s.texte,
      'date_estimee', s.date_estimee, 'heures', s.heures, 'at', s.at) j
    from public.commande_suivi s where s.commande_id = c.id
    union all
    select p.cree_le, json_build_object('genre', 'participation', 'role', 'acheteur', 'mode', p.mode, 'quantite_gardee', p.quantite_gardee,
      'montant', p.montant, 'statut', p.statut, 'echeance', p.echeance, 'fin_le', p.fin_le, 'texte', p.note, 'at', p.cree_le)
    from public.commande_participations p where p.commande_id = c.id) x);
end $$;
revoke all on function public.commande_suivi_lire(uuid) from public, anon;
grant execute on function public.commande_suivi_lire(uuid) to authenticated;
