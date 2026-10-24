-- ═════════ Schéma 96b (24/10/2026) — notifications : l'objet existe encore, un envoi raté est réessayé, besoins à jour ═════════
-- Audit P2 n° 22 : une notification « Nouvelle offre » partait même si l'offre venait d'être retirée (test de l'audit :
-- notif_file restait « attente », 1 lot pris) ; un envoi raté (service de notification en panne) était perdu.
-- Correction :
--   • _notif_objet_vivant(type, objet, regroupe) : l'offre est encore active (et pas en pause), la demande encore active,
--     la négociation encore ouverte (et la proposition toujours en attente), l'accord toujours sans commande, l'achat groupé
--     encore ouvert ; les autres types ne sont pas vérifiés (l'événement lui-même est l'objet) ;
--   • notif_lots_prendre : les messages en attente dont l'objet n'existe plus passent « perime » avant d'être regroupés ;
--     chaque message pris garde le numéro de son lot (lot_id) ;
--   • notif_preparer : revérifie l'objet juste avant l'envoi (aussi pour les envois directs de la fonction pousser) ; refus
--     noté « ignore » avec le détail « objet_perime » dans le journal ;
--   • notif_resultat : un lot dont l'envoi a échoué (téléphones connus, aucun envoi réussi) est remis en attente, 3 essais au
--     plus (puis « perime ») ; la ligne ratée du journal garde sa trace sous une clé « lot:N#echec… » pour libérer la clé ;
--     un lot pris mais jamais préparé (fonction interrompue) est remis en attente après 30 min ;
--   • notif_besoins_ouverts() : nombre de besoins professionnels encore actuels (ouverts, date de fin non passée ; sans date de
--     fin : créés ou modifiés depuis moins de 30 jours), pour « N professionnels cherchent un fournisseur ».
-- Ajouts seulement (add column if not exists, create or replace) ; aucune donnée existante n'est modifiée.

alter table public.notif_file    add column if not exists essais int not null default 0;
alter table public.notif_file    add column if not exists lot_id bigint;
alter table public.notif_journal add column if not exists detail text;
create index if not exists notif_file_lot on public.notif_file (lot_id) where lot_id is not null;

create or replace function public._notif_objet_vivant(p_type text, p_objet text, p_regroupe text default null)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare u uuid; d uuid;
begin
  if p_objet is null or p_objet !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return true; end if;
  u := p_objet::uuid;
  case p_type
    when 'offre', 'stock_ancien' then
      return exists (select 1 from public.offres o where o.id = u and o.status = 'active' and o.pause_le is null);
    when 'offre_pour_demande' then
      d := case when split_part(coalesce(p_regroupe, ''), ':', 2) ~* '^[0-9a-f-]{36}$' then split_part(p_regroupe, ':', 2)::uuid end;
      return exists (select 1 from public.offres o where o.id = u and o.status = 'active' and o.pause_le is null)
        and (d is null or exists (select 1 from public.demandes x where x.id = d and x.status = 'active'));
    when 'offre_fin' then   -- rappel de fin d'une offre (schéma 93c) : seulement si elle est encore en ligne
      return exists (select 1 from public.offres o where o.id = u and o.status = 'active');
    when 'demande', 'demande_seule', 'demande_fin', 'contenu_demande' then
      return exists (select 1 from public.demandes x where x.id = u and x.status = 'active');
    when 'relance_prix', 'expire_bientot' then
      return exists (select 1 from public.negociations n join public.messages m on m.id = n.dernier_msg
                     where n.id = u and n.statut = 'ouverte' and n.expire_le > now() and m.genre = 'prix' and m.issue = 'en_attente');
    when 'accord_sans_commande' then
      return exists (select 1 from public.negociations n where n.id = u and n.statut = 'conclue')
        and not exists (select 1 from public.commandes c where c.negociation_id = u);
    when 'groupe_proche', 'groupe_veille' then
      return exists (select 1 from public.groupes_achat g where g.id = u and g.statut in ('ouvert', 'seuil_atteint'));
    else
      return true;
  end case;
end $$;
revoke execute on function public._notif_objet_vivant(text, text, text) from public, anon, authenticated;

-- schéma 91, plus : objets disparus mis de côté, lots numérotés, lots perdus remis en attente
create or replace function public.notif_lots_prendre(p_max integer default 300)
returns json language plpgsql security definer set search_path = public as $$
declare ids bigint[]; res json; calme boolean := public._notif_calme();
begin
  update public.notif_file f set etat = 'perime', pris_le = now()
  from public.notif_categories c
  where f.etat = 'attente' and c.cat = f.cat
    and (f.cree_le < now() - case when c.nature = 'com' then interval '18 hours' else interval '36 hours' end
      or (f.type in ('expire_bientot', 'relance_prix') and (f.donnees->>'expire') is not null and (f.donnees->>'expire')::timestamptz <= now()));
  -- l'objet n'existe plus (offre retirée, négociation close…) : on ne l'annonce pas
  update public.notif_file f set etat = 'perime', pris_le = now()
  where f.etat = 'attente' and not public._notif_objet_vivant(f.type, f.objet_id, f.regroupe);
  -- lot pris il y a plus de 30 min mais jamais préparé (fonction interrompue) : remis en attente, 3 essais au plus
  update public.notif_file f set etat = case when f.essais + 1 < 3 then 'attente' else 'perime' end, essais = f.essais + 1
  where f.etat = 'pris' and f.lot_id is not null and f.pris_le < now() - interval '30 minutes' and f.pris_le > now() - interval '1 day'
    and not exists (select 1 from public.notif_journal j where j.cle = 'lot:' || f.lot_id);
  select array_agg(x.id) into ids from (
    select f.id from public.notif_file f join public.notif_categories c on c.cat = f.cat
    where f.etat = 'attente' and c.nature = 'trans'
      and not (calme and coalesce(f.type, '') in ('relance_prix', 'expire_bientot', 'accord_sans_commande', 'demande_fin'))
    union
    select f.id from public.notif_file f
    join (
      select distinct on (f2.user_id) f2.user_id, f2.regroupe
      from public.notif_file f2 join public.notif_categories c2 on c2.cat = f2.cat
      where f2.etat = 'attente' and c2.nature = 'com' and not calme and public._notif_ecart_ok(f2.user_id)
        and public._notif_com_jour(f2.user_id) < (select r.max_com_jour from public.notif_regles r where r.id = 1)
        and (f2.cat <> 'conseils' or public._notif_com_jour(f2.user_id, 'conseils') < (select r.max_conseils_jour from public.notif_regles r where r.id = 1))
      order by f2.user_id, public._notif_rang(f2.type), f2.id
    ) choix on choix.user_id = f.user_id and choix.regroupe = f.regroupe
    where f.etat = 'attente'
    limit greatest(1, least(coalesce(p_max, 300), 2000))) x;
  if ids is null then return '[]'::json; end if;
  perform 1 from public.notif_file where id = any (ids) for update skip locked;
  update public.notif_file f set etat = 'pris', pris_le = now(), lot_id = m.premier
  from (select user_id, regroupe, min(id) premier from public.notif_file where id = any (ids) group by 1, 2) m
  where f.id = any (ids) and f.etat = 'attente' and m.user_id = f.user_id and m.regroupe = f.regroupe;
  select coalesce(json_agg(l order by l.premier_id), '[]'::json) into res from (
    select f.user_id, f.regroupe, min(f.cat) cat, min(f.type) type, count(*) n, min(f.id) premier_id,
      (array_agg(f.slug order by f.id desc))[1] slug, (array_agg(f.libelle order by f.id desc))[1] libelle,
      (array_agg(f.objet_id order by f.id desc))[1] objet_id, (array_agg(f.url order by f.id desc))[1] url,
      (array_agg(f.donnees order by f.id desc))[1] donnees
    from public.notif_file f where f.id = any (ids)
    group by f.user_id, f.regroupe) l;
  return res;
end $$;
revoke execute on function public.notif_lots_prendre(integer) from public, anon, authenticated;
grant execute on function public.notif_lots_prendre(integer) to service_role;

-- schéma 91, plus : l'objet est revérifié juste avant l'envoi
create or replace function public.notif_preparer(p_user uuid, p_cat text, p_cle text, p_type text default null, p_objet text default null,
  p_slug text default null, p_url text default null, p_titre text default null, p_corps text default null)
returns json language plpgsql security definer set search_path = public as $$
declare c public.notif_categories; r public.notif_regles; raison text; v_detail text; v_nid uuid; v_cle text := coalesce(nullif(p_cle, ''), 'auto:' || gen_random_uuid());
begin
  if p_user is null then return json_build_object('envoyer', false, 'raison', 'personne'); end if;
  select * into c from public.notif_categories where cat = p_cat;
  if c.cat is null then raise exception 'catégorie inconnue : %', p_cat; end if;
  select * into r from public.notif_regles where id = 1;
  if not public._notif_objet_vivant(p_type, p_objet,
       case when v_cle like 'lot:%' and v_cle ~ '^lot:[0-9]+$' then (select f.regroupe from public.notif_file f where f.id = substr(v_cle, 5)::bigint) end) then
    raison := 'ignore'; v_detail := 'objet_perime';
  elsif c.nature = 'com' then
    perform pg_advisory_xact_lock(hashtext('notif:' || p_user::text));
    if exists (select 1 from public.profils p where p.user_id = p_user and p.supprime_le is not null) or public.est_banni(p_user) then raison := 'ignore';
    elsif not public._notif_pref(p_user, p_cat) then raison := 'pref';
    elsif public._notif_calme() then raison := 'calme';
    elsif public._notif_com_jour(p_user) >= r.max_com_jour then raison := 'plafond';
    elsif not public._notif_ecart_ok(p_user) then raison := 'plafond';
    elsif p_cat = 'conseils' and public._notif_com_jour(p_user, 'conseils') >= r.max_conseils_jour then raison := 'plafond';
    end if;
  elsif not public._notif_pref(p_user, p_cat) then raison := 'pref';
  end if;
  insert into public.notif_journal (user_id, cat, nature, type, objet_id, slug, cle, url, titre, corps, resultat, detail)
  values (p_user, p_cat, c.nature, left(p_type, 40), left(p_objet, 80), left(p_slug, 80), left(v_cle, 200), left(p_url, 300),
          left(p_titre, 120), left(p_corps, 300), coalesce(raison, 'en_cours'), v_detail)
  on conflict (cle) do nothing
  returning nid into v_nid;
  if v_nid is null then return json_build_object('envoyer', false, 'raison', 'doublon'); end if;
  if raison is not null then return json_build_object('envoyer', false, 'raison', coalesce(v_detail, raison)); end if;
  return json_build_object('envoyer', true, 'nid', v_nid, 'nature', c.nature);
end $$;
revoke execute on function public.notif_preparer(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.notif_preparer(uuid, text, text, text, text, text, text, text, text) to service_role;

-- schéma 88a, plus : un lot raté repart (3 essais au plus)
create or replace function public.notif_resultat(p_nid uuid, p_telephones integer, p_envoyees integer)
returns void language plpgsql security definer set search_path = public as $$
declare j public.notif_journal; v_res text; v_lot bigint;
begin
  v_res := case when coalesce(p_telephones, 0) = 0 then 'aucun_telephone' when coalesce(p_envoyees, 0) > 0 then 'ok' else 'echec' end;
  update public.notif_journal set envoye_le = now(), telephones = coalesce(p_telephones, 0), resultat = v_res
  where nid = p_nid and resultat = 'en_cours'
  returning * into j;
  if j.id is null or v_res <> 'echec' or j.cle !~ '^lot:[0-9]+$' then return; end if;
  v_lot := substr(j.cle, 5)::bigint;
  -- la clé est libérée pour le prochain essai ; la ligne ratée reste dans le journal
  update public.notif_journal set cle = left(j.cle || '#echec:' || p_nid, 200) where id = j.id;
  update public.notif_file set etat = case when essais + 1 < 3 then 'attente' else 'perime' end, essais = essais + 1
  where lot_id = v_lot and etat = 'pris';
end $$;
revoke execute on function public.notif_resultat(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.notif_resultat(uuid, integer, integer) to service_role;

-- besoins professionnels encore actuels (pour « N professionnels cherchent un fournisseur », fonction pousser)
create or replace function public.notif_besoins_ouverts()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.besoins b
  where b.statut = 'ouvert'
    and (b.livraison_fin >= (now() at time zone 'UTC')::date
      or (b.livraison_fin is null and greatest(b.created_at, coalesce(b.updated_at, b.created_at)) >= now() - interval '30 days'));
$$;
revoke execute on function public.notif_besoins_ouverts() from public, anon, authenticated;
grant execute on function public.notif_besoins_ouverts() to service_role;
