-- Schéma 100c : journal central des gestes de l'équipe, historique des décisions, conflit d'intérêts
-- (contrôle qualité ANO-016, ANO-017, ANO-018, ANO-021 ; batteries ADM-01, ADM-02, PRO-04 ; 25/10/2026).
--
-- Avant : admin_journal n'était écrit que par 4 fonctions (code changé, numéro rendu, annonce maintenue ou rétablie).
--   Les autres gestes sensibles (suspendre, bannir, lever, décider une identité, trancher un litige, changer un réglage…)
--   n'y laissaient rien ; la levée d'un bannissement effaçait la ligne sans trace ; une 2e décision d'identité écrasait la 1re ;
--   l'administrateur pouvait trancher un litige sur sa propre vente.
-- Maintenant : chaque fonction de l'équipe qui écrit passe par une « porte » du même nom (méthode du schéma 98a) :
--   1. l'ancienne fonction est renommée _j_<nom> et n'est plus appelable par un membre ni par un visiteur ;
--   2. la porte <nom> garde exactement les mêmes paramètres (l'application ne change pas d'appel) ;
--   3. pour les décisions sur une commande, la porte refuse si l'appelant est vendeur, acheteur ou transporteur de la commande
--      (CONFLIT_INTERETS) ;
--   4. elle appelle l'ancienne fonction, puis écrit UNE ligne dans admin_journal : qui, quel geste, sur qui ou quoi (cible_id),
--      le motif ou la note, les paramètres, le résultat, et l'état d'avant quand il compte :
--      bannissement levé (le bannissement d'origine, motif compris), dossier d'identité (statut et décision d'avant, puis d'après),
--      réglages (seulement ce qui a changé : avant / après).
--   Une décision qui en appelle d'autres (ex. admin_commande_issue -> admin_litige_clore -> admin_litige_trancher2 ->
--   admin_litige_trancher) n'écrit qu'une ligne : celle du geste fait par la personne (réglage local mdg.adm_dans).
--   Si le geste échoue, rien n'est écrit (tout est annulé ensemble).
--   Les traces existantes ne bougent pas : les 4 fonctions qui écrivaient déjà le journal ne passent pas par une porte,
--   et les tables signées (sanctions.par, bannis.par, verifications.decide_par, commande_etapes…) sont toujours remplies.
-- Rien n'est effacé ni supprimé par ce schéma. Le schéma peut être rejoué (une fonction déjà renommée n'est pas renommée deux fois).
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

-- 1. Conflit d'intérêts : l'appelant est-il partie à la commande ?
create or replace function public._adm_conflit(p_nom text, a jsonb)
returns void language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); cmd uuid;
begin
  -- un membre qui n'est pas de l'équipe reçoit le refus habituel de la fonction d'origine (« Réservé à l'administration »)
  if me is null or not public.est_admin() or p_nom not in ('admin_litige_clore', 'admin_litige_trancher', 'admin_litige_trancher2', 'admin_commande_issue',
     'admin_refus_trancher', 'admin_litige_partager', 'admin_liberer', 'admin_affecter', 'admin_mission_prix') then
    return;
  end if;
  cmd := coalesce((a ->> 'p_cmd')::uuid, (select m.commande_id from public.transport_missions m where m.id = (a ->> 'p_mission')::uuid));
  if cmd is null then return; end if;
  if exists (select 1 from public.commandes c where c.id = cmd and me in (c.vendeur_id, c.acheteur_id))
     or exists (select 1 from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
                where m.commande_id = cmd and t.user_id = me) then
    raise exception 'CONFLIT_INTERETS : vous êtes partie à cette commande. Un autre membre de l''équipe doit décider.';
  end if;
end $$;

-- 2. État des réglages (pour noter l'ancienne et la nouvelle valeur)
create or replace function public._adm_reglages_etat()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reglages', coalesce((select jsonb_object_agg(r.cle, r.valeur) from public.reglages r), '{}'::jsonb),
    'notif_regles', coalesce((select jsonb_agg(to_jsonb(n) - 'maj_le' order by n.id) from public.notif_regles n), '[]'::jsonb),
    'niveaux_regles', coalesce((select jsonb_object_agg(g.role || '/' || g.cle, to_jsonb(g) - 'maj_le' - 'maj_par') from public.niveaux_regles g), '{}'::jsonb));
$$;

create or replace function public._adm_est_reglage(p_nom text)
returns boolean language sql immutable set search_path = public as $$
  select p_nom in ('admin_commandes_regler', 'admin_fiabilite_regler', 'admin_annonces_regler', 'admin_niveaux_regler',
                   'admin_niveaux_regle_modifier', 'notif_regles_regler', 'admin_transport_reseau');
$$;

-- 3. Ce qu'il faut garder de l'état d'avant
create or replace function public._adm_avant(p_nom text, a jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_nom = 'admin_lever_bannissement' then
    return jsonb_build_object('bannissement', (select to_jsonb(b) from public.bannis b where b.user_id = (a ->> 'p_user')::uuid));
  elsif p_nom = 'admin_identite_decider' then
    return jsonb_build_object('dossier', (select jsonb_build_object('user_id', v.user_id, 'statut', v.statut, 'motif', v.motif,
      'decide_le', v.decide_le, 'decide_par', v.decide_par, 'expire_le', v.expire_le) from public.verifications v where v.id = (a ->> 'p_id')::uuid));
  elsif public._adm_est_reglage(p_nom) then
    return public._adm_reglages_etat();
  end if;
  return null;
end $$;

-- 4. Écrire la ligne du journal
create or replace function public._adm_noter(p_nom text, a jsonb, p_avant jsonb, p_resultat jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare apres jsonb; d jsonb := '{}'::jsonb; k text; t text; cible uuid; detail jsonb;
begin
  detail := jsonb_build_object('parametres', a, 'resultat', p_resultat);
  if public._adm_est_reglage(p_nom) and p_avant is not null then
    apres := public._adm_reglages_etat();
    foreach t in array array['reglages', 'niveaux_regles'] loop
      for k in select x from (select jsonb_object_keys(coalesce(p_avant -> t, '{}'::jsonb)) x
                              union select jsonb_object_keys(coalesce(apres -> t, '{}'::jsonb))) z loop
        if (p_avant -> t -> k) is distinct from (apres -> t -> k) then
          d := d || jsonb_build_object(t || '.' || k, jsonb_build_object('avant', p_avant -> t -> k, 'apres', apres -> t -> k));
        end if;
      end loop;
    end loop;
    if (p_avant -> 'notif_regles') is distinct from (apres -> 'notif_regles') then
      d := d || jsonb_build_object('notif_regles', jsonb_build_object('avant', p_avant -> 'notif_regles', 'apres', apres -> 'notif_regles'));
    end if;
    detail := detail || jsonb_build_object('changements', d);
  elsif p_nom = 'admin_identite_decider' then
    detail := detail || jsonb_build_object('avant', p_avant, 'apres', jsonb_build_object('dossier', (select jsonb_build_object('user_id', v.user_id,
      'statut', v.statut, 'motif', v.motif, 'decide_le', v.decide_le, 'decide_par', v.decide_par, 'expire_le', v.expire_le)
      from public.verifications v where v.id = (a ->> 'p_id')::uuid)));
  elsif p_avant is not null then
    detail := detail || jsonb_build_object('avant', p_avant);
  end if;
  -- cible : le membre concerné quand on le connaît, sinon l'objet (commande, mission, dossier…)
  if p_nom like 'admin\_identite\_%' and a ? 'p_id' then
    cible := (select v.user_id from public.verifications v where v.id = (a ->> 'p_id')::uuid);
  end if;
  cible := coalesce(cible, (a ->> 'p_user')::uuid, (a ->> 'compte')::uuid, (a ->> 'p_cmd')::uuid, (a ->> 'p_sanction')::uuid,
                    (a ->> 'p_mission')::uuid, (a ->> 'p_cible')::uuid, (a ->> 'p_id')::uuid);
  insert into public.admin_journal (admin_id, action, cible_id, motif, detail)
  values (auth.uid(), p_nom, cible,
          left(nullif(btrim(coalesce(a ->> 'p_motif', a ->> 'p_note', a ->> 'p_reponse', a ->> 'p_texte', '')), ''), 300),
          detail);
end $$;

revoke all on function public._adm_conflit(text, jsonb) from public, anon, authenticated;
revoke all on function public._adm_reglages_etat() from public, anon, authenticated;
revoke all on function public._adm_est_reglage(text) from public, anon, authenticated;
revoke all on function public._adm_avant(text, jsonb) from public, anon, authenticated;
revoke all on function public._adm_noter(text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- 5. Les portes : une par fonction de l'équipe qui écrit (liste fixe, relue à la main)
do $gen$
declare
  noms text[] := array[
    'admin_affecter', 'admin_annonces_regler', 'admin_annulation_classer', 'admin_bannir', 'admin_commande_issue',
    'admin_commandes_regler', 'admin_contestation_decider', 'admin_diffuser', 'admin_fiabilite_regler',
    'admin_identite_decider', 'admin_identite_ouvrir', 'admin_identite_photos_effacees', 'admin_identite_purger',
    'admin_lever_bannissement', 'admin_liberer', 'admin_litige_clore', 'admin_litige_partager', 'admin_litige_trancher',
    'admin_litige_trancher2', 'admin_mission_prix', 'admin_niveaux_decider', 'admin_niveaux_regle_modifier',
    'admin_niveaux_regler', 'admin_refus_trancher', 'admin_signalement_membre_traite', 'admin_signalements_cible_traites',
    'admin_structure_decider', 'admin_suspendre', 'admin_suspension_lever', 'admin_transport_reseau',
    'admin_transporteur_creer', 'admin_transporteur_decider', 'notif_regles_regler'];
  f record; interne text; appel text; params text; corps text; vide boolean; n int;
begin
  for f in
    select p.oid, p.proname, p.pronargs, p.proargnames, pg_get_function_arguments(p.oid) args,
           pg_get_function_identity_arguments(p.oid) idargs, oidvectortypes(p.proargtypes) types, pg_get_function_result(p.oid) res
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = any (noms)
      and not (p.proname = 'admin_identite_decider' and p.pronargs <> 6)   -- l'ancienne version à 4 paramètres refuse déjà tout
  loop
    interne := '_j_' || f.proname;
    if to_regprocedure(format('public.%I(%s)', interne, f.types)) is null then
      execute format('alter function public.%I(%s) rename to %I', f.proname, f.idargs, interne);
    end if;
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', interne, f.idargs);
    appel := ''; params := '';
    for n in 1 .. f.pronargs loop
      appel := appel || case when n > 1 then ', ' else '' end || quote_ident(f.proargnames[n]);
      params := params || case when n > 1 then ', ' else '' end || quote_literal(f.proargnames[n]) || ', ' || quote_ident(f.proargnames[n]);
    end loop;
    params := 'jsonb_build_object(' || params || ')';
    vide := f.res = 'void';
    corps := format($c$
declare a jsonb := %2$s; av jsonb;%5$s
begin
  perform public._adm_conflit(%1$L, a);
  if coalesce(current_setting('mdg.adm_dans', true), '') = '1' then
    %3$s
  end if;
  av := public._adm_avant(%1$L, a);
  perform set_config('mdg.adm_dans', '1', true);
  %4$s
  perform set_config('mdg.adm_dans', '', true);
  perform public._adm_noter(%1$L, a, av, %6$s);
  %7$s
end $c$,
      f.proname, params,
      case when vide then format('perform public.%I(%s); return;', interne, appel) else format('return public.%I(%s);', interne, appel) end,
      case when vide then format('perform public.%I(%s);', interne, appel) else format('r := public.%I(%s);', interne, appel) end,
      case when vide then '' else ' r ' || f.res || ';' end,
      case when vide then 'null' else 'to_jsonb(r)' end,
      case when vide then 'return;' else 'return r;' end);
    execute format('create or replace function public.%I(%s) returns %s language plpgsql security definer set search_path = public as %L',
                   f.proname, f.args, f.res, corps);
    execute format('revoke all on function public.%I(%s) from public, anon', f.proname, f.idargs);
    execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.idargs);
  end loop;
end $gen$;
