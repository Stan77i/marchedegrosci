-- Schéma 93c : les annonces expirent (audit du 24/10/2026, P2 n° 10). Après 93a. Fichier sans les mots interdits par le MCP.
--  - Une offre ou une demande en ligne expire 30 jours après sa publication ou sa dernière prolongation (réglable :
--    reglages.annonces.duree_jours). Expirée = cachée du marché (status « retiree » + expiree_le), jamais effacée.
--  - Les annonces d'avant ce schéma (expire_le vide) : 30 jours après leur publication, mais jamais avant « mise en place + 7 jours »
--    (grace_jours), pour laisser le temps de prévenir.
--  - Pas d'expiration pendant une négociation ouverte, un accord qui attend sa commande ou un achat groupé en cours.
--  - Rappel au membre 3 jours avant (rappel_jours), seulement de 7 h à 21 h, une fois par date de fin : type « demande_fin »
--    (texte déjà dans la fonction pousser) pour une demande, type « offre_fin » pour une offre (texte à ajouter dans pousser).
--  - annonce_prolonger : bouton « Prolonger 30 jours » de Mes publications ; remet aussi en ligne une annonce expirée.
--  - Tâche « mdg-annonces-expirer » toutes les 15 minutes, par lots (reglages.annonces.lot, 500) : aucune mise à jour massive.

create or replace function public.annonce_prolonger(p_cible text, p_client_id text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r record; fin timestamptz := now() + make_interval(days => public._ann_regle('duree_jours', 30)::int);
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_cible = 'offre' then
    select id, status, expiree_le, retiree_le, quantity into r from public.offres where user_id = me and client_id = p_client_id for update;
  elsif p_cible = 'demande' then
    select id, status, expiree_le, retiree_le, quantity into r from public.demandes where user_id = me and client_id = p_client_id for update;
  else raise exception 'Annonce inconnue.'; end if;
  if r.id is null then raise exception 'Annonce introuvable : elle n''est pas encore envoyée. Réessayez avec du réseau.'; end if;
  if r.status = 'masquee' then raise exception 'Cette annonce est masquée par l''équipe du Marché de Gros.'; end if;
  if r.retiree_le is not null then raise exception 'Cette annonce a été retirée. Publiez-la de nouveau.'; end if;
  if r.status <> 'active' and r.expiree_le is null then raise exception 'Cette annonce n''est plus en ligne : tout est vendu. Mettez à jour la quantité.'; end if;
  if p_cible = 'offre' and coalesce(r.quantity, 0) <= 0 then raise exception 'Indiquez d''abord la quantité disponible.'; end if;
  if r.status = 'active' then
    if p_cible = 'offre' then update public.offres set expire_le = fin where id = r.id;
    else update public.demandes set expire_le = fin where id = r.id; end if;
  else
    -- remise en ligne : le déclencheur _annonce_regles pose la nouvelle date de fin
    if p_cible = 'offre' then update public.offres set status = 'active', expiree_le = null where id = r.id returning expire_le into fin;
    else update public.demandes set status = 'active', expiree_le = null where id = r.id returning expire_le into fin; end if;
  end if;
  return fin;
end $$;
revoke all on function public.annonce_prolonger(text, text) from public, anon;
grant execute on function public.annonce_prolonger(text, text) to authenticated;

create or replace function public.annonces_expirer()
returns json language plpgsql security definer set search_path = public as $$
declare lot int := greatest(50, public._ann_regle('lot', 500)::int);
  d interval := make_interval(days => public._ann_regle('duree_jours', 30)::int);
  rap interval := make_interval(days => public._ann_regle('rappel_jours', 3)::int);
  g timestamptz := coalesce((select (valeur ->> 'debut')::timestamptz from public.reglages where cle = 'annonces'), now())
    + make_interval(days => public._ann_regle('grace_jours', 7)::int);
  r record; n_o int := 0; n_d int := 0; n_err int := 0; n_r int := 0;
begin
  -- 1. offres arrivées à leur fin
  for r in
    select o.id from public.offres o
    where o.status = 'active' and coalesce(o.expire_le, greatest(o.created_at + d, g)) <= now()
      and not exists (select 1 from public.negociations n where n.cible = 'offre' and n.cible_id = o.id
        and (n.statut = 'ouverte' or (n.statut = 'conclue' and not exists (select 1 from public.commandes k where k.negociation_id = n.id))))
      and not exists (select 1 from public.groupes_achat ga where ga.offre_id = o.id and ga.statut in ('propose', 'ouvert', 'seuil_atteint', 'en_attente_confirmation'))
    order by o.created_at limit lot
  loop
    begin
      update public.offres set status = 'retiree', expiree_le = now() where id = r.id and status = 'active';
      n_o := n_o + 1;
    exception when others then n_err := n_err + 1;
    end;
  end loop;
  -- 2. demandes arrivées à leur fin
  for r in
    select x.id from public.demandes x
    where x.status = 'active' and coalesce(x.expire_le, greatest(x.created_at + d, g)) <= now()
      and not exists (select 1 from public.negociations n where n.cible = 'demande' and n.cible_id = x.id
        and (n.statut = 'ouverte' or (n.statut = 'conclue' and not exists (select 1 from public.commandes k where k.negociation_id = n.id))))
    order by x.created_at limit lot
  loop
    begin
      update public.demandes set status = 'retiree', expiree_le = now() where id = r.id and status = 'active';
      n_d := n_d + 1;
    exception when others then n_err := n_err + 1;
    end;
  end loop;
  -- 3. rappel quelques jours avant la fin (jamais la nuit), une fois par date de fin
  if not public._notif_calme() and rap > interval '0' then
    for r in
      select * from (
        select 'offre' k, o.id, o.user_id u, o.product_slug slug, coalesce(nullif(o.product_label, ''), o.product_slug) lib,
          coalesce(o.expire_le, greatest(o.created_at + d, g)) fin
        from public.offres o
        where o.status = 'active' and coalesce(o.expire_le, greatest(o.created_at + d, g)) between now() and now() + rap
          and exists (select 1 from public.push_abonnements s where s.user_id = o.user_id)
        union all
        select 'demande', x.id, x.user_id, x.product_slug, coalesce(nullif(x.product_label, ''), x.product_slug),
          coalesce(x.expire_le, greatest(x.created_at + d, g))
        from public.demandes x
        where x.status = 'active' and coalesce(x.expire_le, greatest(x.created_at + d, g)) between now() and now() + rap
          and exists (select 1 from public.push_abonnements s where s.user_id = x.user_id)
      ) e
      where not exists (select 1 from public.notif_file f where f.cle = 'x1:' || e.id || ':' || to_char(e.fin, 'YYYYMMDD'))
      limit 300
    loop
      n_r := n_r + public._notif_mettre(r.u, 'rappel', case when r.k = 'offre' then 'offre_fin' else 'demande_fin' end,
        'x1:' || r.id || ':' || to_char(r.fin, 'YYYYMMDD'), 'x1:' || r.id, r.id::text, r.slug, r.lib,
        'application.dc.html#/mes-publications', jsonb_build_object('limite', r.fin, 'annonce', r.k));
    end loop;
  end if;
  return json_build_object('offres', n_o, 'demandes', n_d, 'refus', n_err, 'rappels', n_r);
end $$;
revoke all on function public.annonces_expirer() from public, anon, authenticated;

select cron.schedule('mdg-annonces-expirer', '*/15 * * * *', 'select public.annonces_expirer()');
