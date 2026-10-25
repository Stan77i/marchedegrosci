-- Schéma 98a : pas de suppression du compte tant qu'il reste quelque chose en cours (contrôle qualité LOG-10, 25/10/2026).
-- Avant : un vendeur avec 4 commandes ouvertes pouvait supprimer son compte ; la commande restait « en_cours »,
-- l'acheteur attendait un vendeur qui ne pouvait plus se connecter (moyen d'échapper à un litige ou à une suspension).
-- Maintenant la suppression est refusée tant qu'il reste :
--   une commande « a_confirmer » ou « en_cours » (vendeur ou acheteur), un litige ouvert (commande « litige »),
--   un accord conclu sans commande et pas encore « sans suite » (délai accord_sans_suite_heures, 72 h par défaut),
--   une suspension en cours.
-- Méthode « porte » : l'ancienne fonction (qui efface le code de secours) est renommée _supprimer_compte_effacer
-- et n'est plus appelable par un membre ; supprimer_compte() garde son nom (l'application ne change pas d'appel),
-- vérifie, puis l'appelle. Rien n'est effacé ni supprimé par ce schéma.
-- compte_suppression_verifier() : la même vérification, sans rien faire, pour prévenir dans Mon compte avant de demander le code.
-- Appliqué sur le projet de TEST le 25/10/2026. Production : à appliquer par l'équipe qui y travaille.

do $$
begin
  if to_regprocedure('public._supprimer_compte_effacer()') is null then
    alter function public.supprimer_compte() rename to _supprimer_compte_effacer;
  end if;
end $$;
revoke all on function public._supprimer_compte_effacer() from public, anon, authenticated;

create or replace function public._compte_obstacles(p_uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare nc integer; nl integer; na integer; l text[] := '{}';
  h integer := coalesce(public._cmd_regle('accord_sans_suite_heures', 72), 72);
begin
  if p_uid is null then return null; end if;
  select count(*) filter (where etat in ('a_confirmer', 'en_cours')), count(*) filter (where etat = 'litige')
    into nc, nl
  from public.commandes where p_uid in (vendeur_id, acheteur_id) and etat in ('a_confirmer', 'en_cours', 'litige');
  select count(*) into na from public.negociations n
  where p_uid in (n.auteur_id, n.proprio_id) and n.statut = 'conclue'
    and n.conclu_le > now() - make_interval(hours => h)
    and not exists (select 1 from public.commandes c where c.negociation_id = n.id)
    and not exists (select 1 from public.stock_mouvements s where s.negociation_id = n.id and s.sans_suite_le is not null);
  if nc > 0 then l := l || (nc || case when nc > 1 then ' commandes' else ' commande' end); end if;
  if nl > 0 then l := l || (nl || case when nl > 1 then ' litiges ouverts' else ' litige ouvert' end); end if;
  if na > 0 then l := l || (na || case when na > 1 then ' accords sans commande' else ' accord sans commande' end); end if;
  if cardinality(l) > 0 then
    return 'COMPTE_OCCUPE : Terminez d’abord vos commandes en cours : ' || array_to_string(l, ', ') || '.';
  end if;
  if public.est_suspendu(p_uid) then
    return 'COMPTE_SUSPENDU : votre compte est suspendu pour l''instant. Vous pourrez le supprimer à la fin de la suspension.';
  end if;
  return null;
end $$;
revoke all on function public._compte_obstacles(uuid) from public, anon, authenticated;

create or replace function public.compte_suppression_verifier()
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  return public._compte_obstacles(auth.uid());
end $$;
revoke all on function public.compte_suppression_verifier() from public, anon;
grant execute on function public.compte_suppression_verifier() to authenticated;

create or replace function public.supprimer_compte()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  m := public._compte_obstacles(me);
  if m is not null then raise exception '%', m; end if;
  perform public._supprimer_compte_effacer();
end $$;
revoke all on function public.supprimer_compte() from public, anon;
grant execute on function public.supprimer_compte() to authenticated;
