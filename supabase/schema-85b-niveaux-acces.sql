-- Schéma 85b : niveaux de confiance (chantier 3). Partie 2 : lecture publique, espace du membre, contestation,
-- espace admin, notifications, tâche de nuit, réputation et tableau du marché.
-- Public : seulement le niveau (libellé) et le badge « Acheteur en gros », jamais les chiffres privés ni la grâce.
-- Testé sur le projet de test, pas encore appliqué en production.

-- 1. Le niveau affiché (un niveau décidé par l'équipe passe avant le calcul) ; rien pour un compte banni, supprimé ou officiel
create or replace function public._niv_effectif(p_uid uuid, p_role text)
returns text language sql stable security definer set search_path = public as $$
  select case when m.force_jusqua is not null and m.force_jusqua > now() then m.force_niveau else m.niveau end
  from public.niveaux_membres m
  where m.user_id = p_uid and m.role = p_role
    and not public.est_banni(p_uid) and not public.est_admin_id(p_uid)
    and not exists (select 1 from public.profils p where p.user_id = p_uid and p.supprime_le is not null);
$$;
revoke all on function public._niv_effectif(uuid, text) from public, anon, authenticated;

-- 2. Lecture publique pour l'affichage (cartes, fiches, négociations, site) : 200 comptes au plus par appel
create or replace function public.niveaux_publics(ids uuid[])
returns table (user_id uuid, vendeur text, vendeur_libelle text, vendeur_ordre integer,
               acheteur text, acheteur_libelle text, acheteur_ordre integer, gros boolean)
language sql stable security definer set search_path = public as $$
  with u as (
    select distinct x.id from unnest(ids[1:200]) as x(id)
    where x.id is not null and not public.est_banni(x.id) and not public.est_admin_id(x.id)
      and not exists (select 1 from public.profils p where p.user_id = x.id and p.supprime_le is not null)
  ),
  e as (select u.id, public._niv_effectif(u.id, 'vendeur') v, public._niv_effectif(u.id, 'acheteur') a from u)
  select e.id, e.v, rv.libelle, rv.ordre, e.a, ra.libelle, ra.ordre,
    coalesce((select m.gros from public.niveaux_membres m where m.user_id = e.id and m.role = 'acheteur'), false)
  from e
  left join public.niveaux_regles rv on rv.role = 'vendeur' and rv.cle = e.v
  left join public.niveaux_regles ra on ra.role = 'acheteur' and ra.cle = e.a
  where e.v is not null or e.a is not null
     or exists (select 1 from public.niveaux_membres m where m.user_id = e.id and m.role = 'acheteur' and m.gros);
$$;
revoke all on function public.niveaux_publics(uuid[]) from public;
grant execute on function public.niveaux_publics(uuid[]) to anon, authenticated;

-- 3. Les critères, pour la transparence (aucune donnée de membre)
create or replace function public.niveaux_criteres()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'fenetre_jours', public._niv_regle('fenetre_jours', 365)::integer,
    'grace_jours', public._niv_regle('grace_jours', 30)::integer,
    'contestation_jours', public._niv_regle('contestation_jours', 7)::integer,
    'gros', json_build_object('commandes', public._niv_regle('gros_commandes', 5)::integer, 'montant', public._niv_regle('gros_montant', 500000)),
    'niveaux', (select coalesce(json_agg(json_build_object('role', role, 'cle', cle, 'ordre', ordre, 'libelle', libelle, 'commandes', commandes,
        'mois', mois, 'abus_max', abus_max, 'note_min', note_min, 'volume_min', volume_min, 'code_requis', code_requis,
        'identite_requise', identite_requise, 'plafond_partenaire', plafond_partenaire) order by role desc, ordre), '[]'::json)
      from public.niveaux_regles));
$$;
revoke all on function public.niveaux_criteres() from public;
grant execute on function public.niveaux_criteres() to anon, authenticated;

-- Le texte court des critères (pour reputation_publique et le site)
create or replace function public._niv_texte()
returns text language sql stable security definer set search_path = public as $$
  select 'Niveaux calculés par le serveur sur les commandes terminées des ' || public._niv_regle('fenetre_jours', 365)::integer || ' derniers jours. '
    || string_agg(case cle when 'fiable' then 'Fiable' when 'bon' then 'Bon' when 'excellent' then 'Excellent' else 'Grand' end || ' : ' || commandes || ' commandes'
       || case when mois > 1 then ' sur ' || mois || ' mois différents' else '' end
       || case when code_requis then ' validées par code' else '' end
       || ', au plus ' || replace(abus_max::text, '.', ',') || ' % d''annulations abusives'
       || case when note_min is not null then ', note d''au moins ' || replace(note_min::text, '.', ',') || '/5' else '' end
       || case when volume_min is not null then ', au moins ' || replace(to_char(volume_min, 'FM999,999,999,999'), ',', ' ') || ' F CFA' else '' end
       || case when identite_requise then ', identité vérifiée' else '' end, ' ; ' order by ordre) || '.'
  from public.niveaux_regles where role = 'vendeur';
$$;
revoke all on function public._niv_texte() from public, anon, authenticated;

-- 4. L'espace du membre : son niveau, ce qui manque, sa grâce, son historique, sa contestation
create or replace function public.niveaux_moi()
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  return json_build_object(
    'criteres', public.niveaux_criteres(),
    'roles', (select json_object_agg(ro.role, json_build_object(
        'niveau', public._niv_effectif(me, ro.role),
        'libelle', (select libelle from public.niveaux_regles where role = ro.role and cle = public._niv_effectif(me, ro.role)),
        'depuis', m.depuis, 'grace_jusqua', m.grace_jusqua, 'grace_vers', m.grace_vers,
        'force_jusqua', case when m.force_jusqua > now() then m.force_jusqua end,
        'gros', coalesce(m.gros, false), 'gros_grace_jusqua', m.gros_grace_jusqua,
        'calcul', public._niv_calculer(me, ro.role)))
      from (values ('vendeur'), ('acheteur')) ro(role)
      left join public.niveaux_membres m on m.user_id = me and m.role = ro.role),
    'historique', coalesce((select json_agg(json_build_object('id', j.id, 'role', j.role, 'evenement', j.evenement, 'ancien', j.ancien,
        'nouveau', j.nouveau, 'raison', j.raison, 'at', j.at) order by j.at desc)
      from (select * from public.niveaux_journal where user_id = me order by at desc limit 30) j), '[]'::json),
    'contestation', (select json_build_object('id', c.id, 'role', c.role, 'statut', c.statut, 'texte', c.texte, 'reponse', c.reponse,
        'cree_le', c.cree_le, 'decide_le', c.decide_le, 'repondre_avant', c.repondre_avant)
      from public.niveaux_contestations c where c.user_id = me order by c.cree_le desc limit 1),
    'contestable', (select json_agg(json_build_object('role', j.role, 'evenement', j.evenement, 'at', j.at))
      from (select distinct on (role) role, evenement, at from public.niveaux_journal
            where user_id = me and evenement in ('grace', 'descend', 'retire', 'gros_grace', 'gros_retire')
              and at > now() - make_interval(days => public._niv_regle('contestation_jours', 7)::integer)
            order by role, at desc) j),
    'non_vus', (select count(*) from public.niveaux_journal j where j.user_id = me
      and j.evenement in ('monte', 'grace', 'descend', 'retire', 'gros', 'gros_grace', 'gros_retire', 'force')
      and j.at > coalesce((select max(m.vu_le) from public.niveaux_membres m where m.user_id = me), '-infinity'::timestamptz)));
end $$;
revoke all on function public.niveaux_moi() from public, anon;
grant execute on function public.niveaux_moi() to authenticated;

create or replace function public.niveaux_vu()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  insert into public.niveaux_membres (user_id, role, vu_le) values (me, 'vendeur', now()), (me, 'acheteur', now())
  on conflict (user_id, role) do update set vu_le = now();
end $$;
revoke all on function public.niveaux_vu() from public, anon;
grant execute on function public.niveaux_vu() to authenticated;

-- 5. Contester : dans les 7 jours qui suivent une baisse (grâce, descente, retrait), une contestation ouverte à la fois
create or replace function public.niveaux_contester(p_role text, p_texte text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text; j record; cid uuid; cj integer := public._niv_regle('contestation_jours', 7)::integer;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if p_role not in ('vendeur', 'acheteur') then raise exception 'Rôle inconnu.'; end if;
  select * into j from public.niveaux_journal
  where user_id = me and role = p_role and evenement in ('grace', 'descend', 'retire', 'gros_grace', 'gros_retire')
    and at > now() - make_interval(days => cj)
  order by at desc limit 1;
  if j.id is null then raise exception 'Rien à contester : on conteste dans les % jours qui suivent une baisse de niveau.', cj; end if;
  t := public._cmd_texte(p_texte, 300);
  if t is null or char_length(t) < 5 then raise exception 'Expliquez en quelques mots pourquoi.'; end if;
  if exists (select 1 from public.niveaux_contestations where user_id = me and statut = 'ouverte') then
    raise exception 'Vous avez déjà une contestation en attente.';
  end if;
  if exists (select 1 from public.niveaux_contestations where user_id = me and role = p_role and cree_le > j.at) then
    raise exception 'Vous avez déjà contesté ce changement.';
  end if;
  insert into public.niveaux_contestations (user_id, role, niveau_avant, niveau_actuel, texte, repondre_avant)
  values (me, p_role, j.ancien, public._niv_effectif(me, p_role), t, now() + make_interval(days => public._niv_regle('reponse_jours', 7)::integer))
  returning id into cid;
  return cid;
end $$;
revoke all on function public.niveaux_contester(text, text) from public, anon;
grant execute on function public.niveaux_contester(text, text) to authenticated;

-- 6. Espace admin
create or replace function public.admin_niveaux()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object(
    'reglages', (select valeur from public.reglages where cle = 'niveaux'),
    'regles', (select json_agg(row_to_json(r) order by r.role desc, r.ordre) from public.niveaux_regles r),
    'repartition', (select coalesce(json_agg(json_build_object('role', z.role, 'niveau', z.niv, 'n', z.n)), '[]'::json) from (
        select y.role, y.niv, count(*) n from (select m.role, public._niv_effectif(m.user_id, m.role) niv from public.niveaux_membres m) y
        where y.niv is not null group by 1, 2) z),
    'gros', (select count(*) from public.niveaux_membres where role = 'acheteur' and gros),
    'en_grace', (select coalesce(json_agg(json_build_object('qui', public._fiab_qui(m.user_id), 'role', m.role, 'niveau', m.niveau,
        'vers', m.grace_vers, 'jusqua', m.grace_jusqua) order by m.grace_jusqua), '[]'::json)
      from public.niveaux_membres m where m.grace_jusqua is not null),
    'contestations', (select coalesce(json_agg(json_build_object('id', c.id, 'qui', public._fiab_qui(c.user_id), 'role', c.role,
        'niveau_avant', c.niveau_avant, 'niveau_actuel', c.niveau_actuel, 'texte', c.texte, 'statut', c.statut, 'reponse', c.reponse,
        'ouverte', c.statut = 'ouverte', 'cree_le', c.cree_le, 'repondre_avant', c.repondre_avant,
        'chiffres', (select m.chiffres from public.niveaux_membres m where m.user_id = c.user_id and m.role = c.role)) order by c.statut = 'ouverte' desc, c.cree_le desc), '[]'::json)
      from (select * from public.niveaux_contestations order by statut = 'ouverte' desc, cree_le desc limit 40) c),
    'journal', (select coalesce(json_agg(json_build_object('qui', public._fiab_qui(j.user_id), 'role', j.role, 'evenement', j.evenement,
        'ancien', j.ancien, 'nouveau', j.nouveau, 'raison', j.raison, 'at', j.at) order by j.at desc), '[]'::json)
      from (select * from public.niveaux_journal order by at desc limit 60) j));
end $$;
revoke all on function public.admin_niveaux() from public, anon;
grant execute on function public.admin_niveaux() to authenticated;

create or replace function public.admin_niveaux_journal(p_uid uuid)
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return json_build_object('qui', public._fiab_qui(p_uid),
    'etat', (select json_agg(row_to_json(m)) from public.niveaux_membres m where m.user_id = p_uid),
    'calcul', json_build_object('vendeur', public._niv_calculer(p_uid, 'vendeur'), 'acheteur', public._niv_calculer(p_uid, 'acheteur')),
    'journal', coalesce((select json_agg(row_to_json(j) order by j.at desc) from public.niveaux_journal j where j.user_id = p_uid), '[]'::json));
end $$;
revoke all on function public.admin_niveaux_journal(uuid) from public, anon;
grant execute on function public.admin_niveaux_journal(uuid) to authenticated;

-- Modifier un palier, puis tout recalculer (les baisses passent par la grâce)
create or replace function public.admin_niveaux_regle_modifier(p_role text, p_cle text, p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; r public.niveaux_regles; prev integer := 0; x record;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into r from public.niveaux_regles where role = p_role and cle = p_cle for update;
  if r.role is null then raise exception 'Niveau inconnu.'; end if;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    if k = 'libelle' then r.libelle := btrim(v #>> '{}');
    elsif k in ('commandes', 'mois', 'plafond_partenaire') then
      if jsonb_typeof(v) = 'null' and k = 'plafond_partenaire' then r.plafond_partenaire := null;
      elsif jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric) then raise exception 'Valeur incorrecte pour %', k;
      elsif k = 'commandes' then r.commandes := (v #>> '{}')::integer;
      elsif k = 'mois' then r.mois := (v #>> '{}')::integer;
      else r.plafond_partenaire := (v #>> '{}')::integer; end if;
    elsif k in ('abus_max', 'note_min', 'volume_min') then
      if jsonb_typeof(v) = 'null' and k <> 'abus_max' then
        if k = 'note_min' then r.note_min := null; else r.volume_min := null; end if;
      elsif jsonb_typeof(v) <> 'number' then raise exception 'Valeur incorrecte pour %', k;
      elsif k = 'abus_max' then r.abus_max := (v #>> '{}')::numeric;
      elsif k = 'note_min' then r.note_min := (v #>> '{}')::numeric;
      else r.volume_min := (v #>> '{}')::numeric; end if;
    elsif k in ('code_requis', 'identite_requise') then
      if jsonb_typeof(v) <> 'boolean' then raise exception 'Valeur incorrecte pour %', k; end if;
      if k = 'code_requis' then r.code_requis := (v #>> '{}')::boolean; else r.identite_requise := (v #>> '{}')::boolean; end if;
    else raise exception 'Réglage inconnu : %', k;
    end if;
  end loop;
  update public.niveaux_regles set libelle = r.libelle, commandes = r.commandes, mois = r.mois, abus_max = r.abus_max, note_min = r.note_min,
    volume_min = r.volume_min, code_requis = r.code_requis, identite_requise = r.identite_requise, plafond_partenaire = r.plafond_partenaire,
    maj_le = now(), maj_par = auth.uid()
  where role = p_role and cle = p_cle;
  for x in select commandes from public.niveaux_regles where role = p_role order by ordre loop
    if x.commandes < prev then raise exception 'Le nombre de commandes doit monter d''un niveau à l''autre.'; end if;
    prev := x.commandes;
  end loop;
  perform public.niveaux_recalculer();
  return public.admin_niveaux();
end $$;
revoke all on function public.admin_niveaux_regle_modifier(text, text, jsonb) from public, anon;
grant execute on function public.admin_niveaux_regle_modifier(text, text, jsonb) to authenticated;

create or replace function public.admin_niveaux_regler(p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; lim numeric[];
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'niveaux' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    lim := case k when 'fenetre_jours' then array[30, 1095] when 'grace_jours' then array[0, 365] when 'contestation_jours' then array[1, 60]
      when 'reponse_jours' then array[1, 60] when 'force_jours' then array[1, 365] when 'gros_commandes' then array[1, 1000]
      when 'gros_montant' then array[1, 10000000000] end;
    if lim is null then raise exception 'Réglage inconnu : %', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric)
       or (v #>> '{}')::numeric < lim[1] or (v #>> '{}')::numeric > lim[2] then
      raise exception 'Valeur incorrecte pour % (de % à %)', k, lim[1], lim[2];
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'niveaux';
  perform public.niveaux_recalculer();
  return cur::json;
end $$;
revoke all on function public.admin_niveaux_regler(jsonb) from public, anon;
grant execute on function public.admin_niveaux_regler(jsonb) to authenticated;

-- Trancher une contestation : accepter = garder (ou rendre) un niveau pendant N jours ; refuser = rien ne change
create or replace function public.admin_niveaux_decider(p_id uuid, p_accepter boolean, p_reponse text, p_niveau text default null, p_jours integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.niveaux_contestations; rep text; niv text; jours integer; ancien text;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.niveaux_contestations where id = p_id for update;
  if c.id is null or c.statut <> 'ouverte' then raise exception 'Contestation introuvable ou déjà traitée.'; end if;
  rep := public._cmd_texte(p_reponse, 300);
  if rep is null or char_length(rep) < 2 then raise exception 'Écrivez la réponse au membre.'; end if;
  if p_accepter then
    niv := coalesce(p_niveau, c.niveau_avant);
    if niv = 'gros' and c.role <> 'acheteur' then raise exception 'Niveau inconnu.'; end if;
    if niv is not null and niv <> 'gros' and not exists (select 1 from public.niveaux_regles where role = c.role and cle = niv) then
      raise exception 'Niveau inconnu.';
    end if;
    jours := coalesce(p_jours, public._niv_regle('force_jours', 90)::integer);
    if jours < 1 or jours > 365 then raise exception 'Durée de 1 à 365 jours.'; end if;
    insert into public.niveaux_membres (user_id, role) values (c.user_id, c.role) on conflict (user_id, role) do nothing;
    if niv = 'gros' then
      update public.niveaux_membres set gros = true, gros_depuis = coalesce(gros_depuis, now()), gros_grace_jusqua = now() + make_interval(days => jours)
      where user_id = c.user_id and role = 'acheteur';
    else
      select niveau into ancien from public.niveaux_membres where user_id = c.user_id and role = c.role;
      update public.niveaux_membres set niveau = niv, depuis = coalesce(depuis, now()), force_niveau = niv, force_jusqua = now() + make_interval(days => jours),
        grace_jusqua = null, grace_vers = null
      where user_id = c.user_id and role = c.role;
    end if;
    insert into public.niveaux_journal (user_id, role, evenement, ancien, nouveau, raison, par)
    values (c.user_id, c.role, 'force', ancien, niv, left('Contestation acceptée : ' || rep, 300), auth.uid());
    update public.niveaux_contestations set statut = 'acceptee', reponse = rep, decide_par = auth.uid(), decide_le = now(),
      force_niveau = niv, force_jusqua = now() + make_interval(days => jours) where id = p_id;
  else
    update public.niveaux_contestations set statut = 'refusee', reponse = rep, decide_par = auth.uid(), decide_le = now() where id = p_id;
  end if;
end $$;
revoke all on function public.admin_niveaux_decider(uuid, boolean, text, text, integer) from public, anon;
grant execute on function public.admin_niveaux_decider(uuid, boolean, text, text, integer) to authenticated;

-- 7. Notifications sur le téléphone (fonction « pousser », cas 17) : montée, grâce, descente, retrait, réponse à une contestation
create or replace function public.push_niveaux()
returns trigger language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text; corps jsonb;
begin
  if tg_table_name = 'niveaux_journal' then
    if new.evenement not in ('monte', 'grace', 'descend', 'retire', 'gros', 'gros_grace', 'gros_retire') then return new; end if;
    corps := jsonb_build_object('niveau_journal_id', new.id);
  elsif tg_table_name = 'niveaux_contestations' and new.statut <> 'ouverte' and old.statut = 'ouverte' then
    corps := jsonb_build_object('niveau_contestation_id', new.id);
  else return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := corps,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
revoke all on function public.push_niveaux() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'niveaux_journal_push') then
    create trigger niveaux_journal_push after insert on public.niveaux_journal for each row execute function public.push_niveaux();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'niveaux_contestations_push') then
    create trigger niveaux_contestations_push after update of statut on public.niveaux_contestations for each row execute function public.push_niveaux();
  end if;
end $$;

-- 8. Recalcul chaque nuit (fenêtre glissante, fin des grâces, identité, avis) : 4 h 37, heure d'Abidjan (UTC)
select cron.schedule('mdg-niveaux', '37 4 * * *', 'select public.niveaux_recalculer()');

-- 9. La réputation publique garde tous ses champs ; « fiable » veut dire maintenant « a un niveau » dans ce rôle,
--    et chaque rôle gagne 'niveau' et 'niveau_libelle'. Les critères affichés viennent des paliers réglables.
create or replace function public.reputation_publique(p_uid uuid)
returns json language sql stable security definer set search_path = public as $$
  with
  c as (select * from public.commandes where p_uid in (vendeur_id, acheteur_id) and etat <> 'a_confirmer'),
  r as (
    select role,
      count(*) filter (where etat = 'terminee') terminees,
      count(*) filter (where etat = 'annulee' and annulation_par = p_uid) annul_demandees,
      count(*) filter (where etat = 'annulee') annulees,
      count(*) filter (where litige_par is not null and litige_par <> p_uid) litiges_contre,
      count(*) total
    from (select *, case when vendeur_id = p_uid then 'vendeur' else 'acheteur' end role from c) x group by role
  ),
  ab as (select a.role_imputable role, count(distinct coalesce(a.groupe_id, a.commande_id)) n
         from public.annulations a where a.imputable_id = p_uid and a.categorie = 'abusive' group by a.role_imputable),
  n as (select role_cible role, round(avg(note)::numeric, 1) moyenne, count(*) nombre
        from (select distinct on (k.auteur_id, k.role_cible) k.role_cible, k.note from public.avis_commandes k
              where k.cible_id = p_uid order by k.auteur_id, k.role_cible, k.updated_at desc) z
        group by role_cible),
  d as (
    select percentile_cont(0.5) within group (order by extract(epoch from (rc.at - cf.at)) / 3600.0) h, count(*) n
    from public.commandes k
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'confirmee') cf on true
    join lateral (select min(at) at from public.commande_etapes e where e.commande_id = k.id and e.evenement = 'reception') rc on true
    where k.vendeur_id = p_uid and k.etat = 'terminee' and cf.at is not null and rc.at is not null
  ),
  nv as (select ro.role, public._niv_effectif(p_uid, ro.role) niv from (values ('vendeur'), ('acheteur')) ro(role)),
  role_json as (
    select ro.role, json_build_object(
      'terminees', coalesce(r.terminees, 0), 'annulations_demandees', coalesce(r.annul_demandees, 0), 'annulees', coalesce(r.annulees, 0),
      'annulations_abusives', coalesce(ab.n, 0),
      'litiges_contre', coalesce(r.litiges_contre, 0), 'total', coalesce(r.total, 0),
      'note', n.moyenne, 'avis', coalesce(n.nombre, 0),
      'fiable', nv.niv is not null,
      'niveau', nv.niv,
      'niveau_libelle', (select libelle from public.niveaux_regles g where g.role = ro.role and g.cle = nv.niv),
      'gros', case when ro.role = 'acheteur' then coalesce((select m.gros from public.niveaux_membres m where m.user_id = p_uid and m.role = 'acheteur'), false) end) j
    from (values ('vendeur'), ('acheteur')) ro(role)
    left join r on r.role = ro.role left join n on n.role = ro.role left join ab on ab.role = ro.role left join nv on nv.role = ro.role
  )
  select json_build_object(
    'verifie', public.identite_ok(p_uid),
    'vendeur', (select j from role_json where role = 'vendeur'),
    'acheteur', (select j from role_json where role = 'acheteur'),
    'fiabilite', public.fiabilite_publique(p_uid),
    'delai_median_h', (select case when n >= 3 then round(h::numeric, 0) end from d),
    'delai_n', (select n from d),
    'criteres_fiable', public._niv_texte(),
    'ensemble', case when auth.uid() is not null and auth.uid() <> p_uid then
      (select count(*) from public.commandes x where x.etat = 'terminee'
        and ((x.vendeur_id = auth.uid() and x.acheteur_id = p_uid) or (x.vendeur_id = p_uid and x.acheteur_id = auth.uid()))) end)
  where not exists (select 1 from public.bannis b where b.user_id = p_uid)
    and not public.est_admin_id(p_uid);
$$;

-- 10. Le tableau du marché : même classement ; chaque ligne gagne 'niveau' (le libellé, ou rien)
create or replace function public.tableau_marche(p_slug text, p_region text default null)
returns json language sql stable security definer set search_path = public as $$
  with a0 as (
    select 'offre' sens, o.id, o.user_id, o.price prix, o.unit, o.quantity, o.qte_min, o.city, o.region_slug, o.transport, o.negociable, o.created_at, o.available_from::text dispo,
      case o.transport when 'inclus' then 0 when 'hors_ville' then 1 else 2 end tr_rang
    from public.offres o where o.status = 'active' and o.product_slug = p_slug and (p_region is null or o.region_slug = p_region)
    union all
    select 'demande', d.id, d.user_id, d.budget, d.unit, d.quantity, null, d.city, d.region_slug, d.transport, d.negociable, d.created_at, d.deadline::text,
      case d.transport when 'acheteur' then 0 when 'vendeur' then 1 else 2 end
    from public.demandes d where d.status = 'active' and d.product_slug = p_slug and (p_region is null or d.region_slug = p_region)
  ),
  t as (select sens, coalesce(unit, '') u, count(*) n from a0 group by 1, 2),
  a as (select * from (select a0.*, rank() over (partition by sens, coalesce(unit, '')
          order by (prix is null), case when sens = 'offre' then prix else -prix end, tr_rang) rk1 from a0) z where rk1 <= 50),
  u as (select distinct user_id from a where user_id is not null),
  rep as (select u.user_id, public.reputation_publique(u.user_id) j from u),
  r0 as (
    select a.*, coalesce(public.nom_public(a.user_id), 'Membre') nom,
      coalesce((rep.j->>'verifie')::boolean, false) verifie,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'fiable')::boolean, false) fiable,
      rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'niveau_libelle' niveau,
      coalesce((rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'terminees')::int, 0) terminees,
      (rep.j->(case a.sens when 'offre' then 'vendeur' else 'acheteur' end)->>'note')::numeric note,
      public.est_admin_id(a.user_id) officiel
    from a left join rep on rep.user_id = a.user_id
  ),
  r as (select * from (select r0.*, row_number() over (partition by sens, coalesce(unit, '')
          order by (prix is null), case when sens = 'offre' then prix else -prix end, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id) rk from r0) z where rk <= 50)
  select json_build_object(
    'slug', p_slug,
    'lab', (select coalesce(nullif(product_label, ''), product_slug) from (select product_label, product_slug from public.offres where product_slug = p_slug
              union all select product_label, product_slug from public.demandes where product_slug = p_slug) x limit 1),
    'regions', (select coalesce(json_agg(json_build_object('slug', region_slug, 'n', n) order by n desc), '[]'::json)
                from (select region_slug, count(*) n from (select region_slug from public.offres where status = 'active' and product_slug = p_slug
                      union all select region_slug from public.demandes where status = 'active' and product_slug = p_slug) z where region_slug is not null group by 1) y),
    'totaux', json_build_object(
      'offres', (select coalesce(json_object_agg(t.u, t.n), '{}'::json) from t where t.sens = 'offre'),
      'demandes', (select coalesce(json_object_agg(t.u, t.n), '{}'::json) from t where t.sens = 'demande')),
    'offres', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'qte_min', qte_min, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'dispo', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'niveau', niveau, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix asc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id), '[]'::json)
               from r where sens = 'offre'),
    'demandes', (select coalesce(json_agg(json_build_object('id', id, 'prix', prix, 'unite', unit, 'quantite', quantity, 'ville', city, 'region', region_slug,
                 'transport', transport, 'negociable', negociable, 'le', created_at, 'echeance', dispo, 'nom', nom, 'verifie', verifie, 'fiable', fiable, 'niveau', niveau, 'terminees', terminees, 'note', note, 'officiel', officiel)
                 order by (prix is null), prix desc, tr_rang, fiable desc, verifie desc, terminees desc, created_at desc, id), '[]'::json)
               from r where sens = 'demande'));
$$;

-- 11. Premier calcul pour tous les membres (aucune notification n'est perdue : les montées sont prévenues)
select public.niveaux_recalculer();
