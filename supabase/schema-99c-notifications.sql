-- Schéma 99c : notifications (contrôle qualité du 25/10/2026 : ANO-025, ANO-046, ANO-047).
--
-- ANO-025 : une notification en attente (jusqu'à 18 h pour une commerciale) annonçait la quantité et le prix du jour où l'annonce
--   a été publiée. Au moment de prendre le lot (notif_lots_prendre), la quantité, l'unité, le prix et la ville sont relus dans
--   l'annonce ; pour « une offre pour votre demande », « dans votre budget » est recalculé. Le texte envoyé par « pousser »
--   est donc fait avec les valeurs du moment. Une annonce retirée, en pause ou épuisée était déjà écartée (schéma 96b).
-- ANO-046 : notif_ouverte : un membre connecté ne peut marquer « ouverte » que ses propres notifications. Sans connexion
--   (service worker, clé publique), l'identifiant d'envoi « nid » (uuid au hasard, seulement dans la notification reçue) suffit
--   toujours, pendant 30 jours.
-- ANO-047 : notif_preparer ne prépare plus rien pour un compte supprimé, transactionnel compris.

create or replace function public._notif_donnees_fraiches(p_type text, p_objet text, p_regroupe text, p_donnees jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb := coalesce(p_donnees, '{}'::jsonb); u uuid; o record; dm record; did uuid;
begin
  if p_objet is null or p_objet !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return d; end if;
  u := p_objet::uuid;
  if p_type in ('offre', 'offre_pour_demande', 'stock_ancien') then
    select x.quantity, x.unit, x.price, x.city into o from public.offres x where x.id = u;
    if not found then return d; end if;
  elsif p_type in ('demande', 'demande_seule', 'demande_fin', 'contenu_demande') then
    select x.quantity, x.unit, x.budget as price, x.city into o from public.demandes x where x.id = u;
    if not found then return d; end if;
  else
    return d;
  end if;
  if d ? 'quantite' then d := d || jsonb_build_object('quantite', o.quantity); end if;
  if d ? 'unite' then d := d || jsonb_build_object('unite', coalesce(o.unit, 'kg')); end if;
  if d ? 'prix' then d := d || jsonb_build_object('prix', o.price); end if;
  if d ? 'ville' and o.city is not null then d := d || jsonb_build_object('ville', public._ville_nom(o.city)); end if;
  if p_type = 'offre_pour_demande' then
    did := case when split_part(coalesce(p_regroupe, ''), ':', 2) ~* '^[0-9a-f-]{36}$' then split_part(p_regroupe, ':', 2)::uuid end;
    select x.quantity, x.unit, x.budget into dm from public.demandes x where x.id = did;
    if found then
      d := d || jsonb_build_object('demande_qte', dm.quantity, 'demande_unite', coalesce(dm.unit, 'kg'),
        'budget_ok', (dm.budget is not null and o.price is not null and coalesce(dm.unit, 'kg') = coalesce(o.unit, 'kg') and o.price <= dm.budget));
    else
      d := d - 'budget_ok';
    end if;
  end if;
  return d;
end $$;
revoke all on function public._notif_donnees_fraiches(text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.notif_lots_prendre(p_max integer default 300) returns json
language plpgsql security definer set search_path = public as $$
declare ids bigint[]; res json; calme boolean := public._notif_calme();
begin
  update public.notif_file f set etat = 'perime', pris_le = now()
  from public.notif_categories c
  where f.etat = 'attente' and c.cat = f.cat
    and (f.cree_le < now() - case when c.nature = 'com' then interval '18 hours' else interval '36 hours' end
      or (f.type in ('expire_bientot', 'relance_prix') and (f.donnees->>'expire') is not null and (f.donnees->>'expire')::timestamptz <= now()));
  update public.notif_file f set etat = 'perime', pris_le = now()
  where f.etat = 'attente' and not public._notif_objet_vivant(f.type, f.objet_id, f.regroupe);
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
  -- 99c : les valeurs de l'annonce sont relues au moment de l'envoi (jamais celles du jour de la publication)
  select coalesce(json_agg(l2 order by l2.premier_id), '[]'::json) into res from (
    select l.user_id, l.regroupe, l.cat, l.type, l.n, l.premier_id, l.slug, l.libelle, l.objet_id, l.url,
      public._notif_donnees_fraiches(l.type, l.objet_id, l.regroupe, l.donnees) donnees
    from (
      select f.user_id, f.regroupe, min(f.cat) cat, min(f.type) type, count(*) n, min(f.id) premier_id,
        (array_agg(f.slug order by f.id desc))[1] slug, (array_agg(f.libelle order by f.id desc))[1] libelle,
        (array_agg(f.objet_id order by f.id desc))[1] objet_id, (array_agg(f.url order by f.id desc))[1] url,
        (array_agg(f.donnees order by f.id desc))[1] donnees
      from public.notif_file f where f.id = any (ids)
      group by f.user_id, f.regroupe) l) l2;
  return res;
end $$;

create or replace function public.notif_ouverte(p_nid uuid, p_par text default 'push') returns boolean
language plpgsql security definer set search_path = public as $$
declare n int; me uuid := auth.uid();
begin
  if p_nid is null then return false; end if;
  update public.notif_journal set ouvert_le = now(), ouvert_par = case when p_par = 'liste' then 'liste' else 'push' end
  where nid = p_nid and ouvert_le is null and resultat in ('ok', 'en_cours', 'aucun_telephone', 'echec')
    and (me is null or user_id = me) and cree_le > now() - interval '30 days';
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function public.notif_preparer(p_user uuid, p_cat text, p_cle text, p_type text default null, p_objet text default null,
  p_slug text default null, p_url text default null, p_titre text default null, p_corps text default null) returns json
language plpgsql security definer set search_path = public as $$
declare c public.notif_categories; r public.notif_regles; raison text; v_detail text; v_nid uuid; v_cle text := coalesce(nullif(p_cle, ''), 'auto:' || gen_random_uuid());
begin
  if p_user is null then return json_build_object('envoyer', false, 'raison', 'personne'); end if;
  select * into c from public.notif_categories where cat = p_cat;
  if c.cat is null then raise exception 'catégorie inconnue : %', p_cat; end if;
  select * into r from public.notif_regles where id = 1;
  if exists (select 1 from public.profils p where p.user_id = p_user and p.supprime_le is not null) then
    -- 99c : compte supprimé : rien, même transactionnel
    raison := 'ignore'; v_detail := 'compte_supprime';
  elsif not public._notif_objet_vivant(p_type, p_objet,
       case when v_cle like 'lot:%' and v_cle ~ '^lot:[0-9]+$' then (select f.regroupe from public.notif_file f where f.id = substr(v_cle, 5)::bigint) end) then
    raison := 'ignore'; v_detail := 'objet_perime';
  elsif c.nature = 'com' then
    perform pg_advisory_xact_lock(hashtext('notif:' || p_user::text));
    if public.est_banni(p_user) then raison := 'ignore';
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
