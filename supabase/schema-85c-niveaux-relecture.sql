-- Schéma 85c : niveaux de confiance (chantier 3). Partie 3 : corrections de relecture.
-- 1. Un sursis déjà levé (ou un sursis « Acheteur en gros » levé) ne se conteste plus : rien n'a baissé.
-- 2. Accepter une contestation demande un niveau à rendre (jamais un niveau vide décidé par l'équipe).
-- À appliquer après 85a et 85b. Testé sur le projet de test, pas encore appliqué en production.

-- Une baisse est encore contestable : une descente ou un retrait, ou un sursis encore en cours
create or replace function public._niv_baisse_active(p_uid uuid, p_role text, p_evenement text)
returns boolean language sql stable security definer set search_path = public as $$
  select case p_evenement
    when 'grace' then exists (select 1 from public.niveaux_membres m where m.user_id = p_uid and m.role = p_role and m.grace_jusqua is not null)
    when 'gros_grace' then exists (select 1 from public.niveaux_membres m where m.user_id = p_uid and m.role = p_role and m.gros and m.gros_grace_jusqua is not null)
    else true end;
$$;
revoke all on function public._niv_baisse_active(uuid, text, text) from public, anon, authenticated;

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
              and public._niv_baisse_active(me, role, evenement)
            order by role, at desc) j),
    'non_vus', (select count(*) from public.niveaux_journal j where j.user_id = me
      and j.evenement in ('monte', 'grace', 'descend', 'retire', 'gros', 'gros_grace', 'gros_retire', 'force')
      and j.at > coalesce((select max(m.vu_le) from public.niveaux_membres m where m.user_id = me), '-infinity'::timestamptz)));
end $$;
revoke all on function public.niveaux_moi() from public, anon;
grant execute on function public.niveaux_moi() to authenticated;

create or replace function public.niveaux_contester(p_role text, p_texte text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t text; j record; cid uuid; cj integer := public._niv_regle('contestation_jours', 7)::integer;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if p_role not in ('vendeur', 'acheteur') then raise exception 'Rôle inconnu.'; end if;
  select * into j from public.niveaux_journal
  where user_id = me and role = p_role and evenement in ('grace', 'descend', 'retire', 'gros_grace', 'gros_retire')
    and at > now() - make_interval(days => cj) and public._niv_baisse_active(me, p_role, evenement)
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
    if niv is null then raise exception 'Choisissez le niveau à rendre.'; end if;
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
