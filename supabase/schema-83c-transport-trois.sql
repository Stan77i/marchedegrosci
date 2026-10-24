-- Schéma 83c : chantier 1 (commande et transport), négociation à trois avec le transporteur du réseau Marché de Gros.
-- Appliqué sur le projet de TEST le 24/10/2026. Pas encore en production. Le service reste FERMÉ (réglage transport_reseau_ouvert = false).
-- Règles (décisions 3 à 9) :
--   le transporteur vérifié propose son prix ; l'acheteur et le vendeur acceptent, refusent ou contre-proposent ; 48 h par proposition ;
--   le prix est arrêté quand les trois ont accepté la même proposition, puis recopié dans la mission (commission 6,9 % du schéma 82) ;
--   si quelqu'un refuse, la commande continue avec le livreur du vendeur ; après un transbordement, le prix ne change pas ;
--   pas de messages privés entre le transporteur et les parties pendant la mission.

create table if not exists public.transport_propositions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.transport_missions(id),
  commande_id uuid not null references public.commandes(id),
  auteur_id uuid not null,
  role text not null check (role in ('transporteur', 'acheteur', 'vendeur')),
  prix numeric not null check (prix > 0 and prix < 100000000),
  issue text not null default 'en_attente' check (issue in ('en_attente', 'acceptee', 'refusee', 'remplacee', 'expiree', 'retiree')),
  refuse_par text check (refuse_par in ('transporteur', 'acheteur', 'vendeur')),
  ok_transporteur timestamptz,
  ok_acheteur timestamptz,
  ok_vendeur timestamptz,
  expire_le timestamptz not null,
  created_at timestamptz not null default now(),
  clos_le timestamptz
);
create index if not exists transport_propositions_mission_idx on public.transport_propositions (mission_id, created_at desc);
alter table public.transport_propositions enable row level security;
revoke all on public.transport_propositions from anon, authenticated;

-- état de la négociation à trois d'une mission (sans aucun nom ni numéro)
create or replace function public._tr_tri_etat(p_mission uuid)
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select json_build_object(
    'mission_id', m.id, 'mission_statut', m.statut,
    'convenu', (select p.prix from public.transport_propositions p where p.mission_id = m.id and p.issue = 'acceptee' order by p.created_at desc limit 1),
    'en_attente', (select json_build_object('id', p.id, 'role', p.role, 'prix', p.prix, 'expire_le', p.expire_le,
        'ok_transporteur', p.ok_transporteur is not null, 'ok_acheteur', p.ok_acheteur is not null, 'ok_vendeur', p.ok_vendeur is not null)
      from public.transport_propositions p where p.mission_id = m.id and p.issue = 'en_attente' and p.expire_le > now() order by p.created_at desc limit 1),
    'historique', coalesce((select json_agg(json_build_object('role', x.role, 'prix', x.prix,
        'issue', case when x.issue = 'en_attente' and x.expire_le <= now() then 'expiree' else x.issue end,
        'refuse_par', x.refuse_par, 'le', x.created_at) order by x.created_at)
      from (select * from public.transport_propositions p where p.mission_id = m.id order by p.created_at desc limit 12) x), '[]'::json))
  from public.transport_missions m where m.id = p_mission
$function$;
revoke execute on function public._tr_tri_etat(uuid) from public, anon, authenticated;

create or replace function public.transport_agir(p_mission uuid, p_action text, p_prix numeric default null, p_ref uuid default null)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; c public.commandes; n public.negociations;
  r text; p public.transport_propositions; px numeric; pa numeric; expire boolean := false;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into m from public.transport_missions where id = p_mission for update;
  if m.id is null then raise exception 'Mission introuvable.'; end if;
  select * into t from public.transporteurs where id = m.transporteur_id;
  select * into c from public.commandes where id = m.commande_id for update;
  r := case when t.user_id = me then 'transporteur' when me = c.acheteur_id then 'acheteur' when me = c.vendeur_id then 'vendeur'
            when t.user_id is null and public.est_admin() then 'transporteur' end;
  if r is null then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not public._transport_reseau_ouvert() then
    raise exception 'Le transporteur du réseau Marché de Gros arrive bientôt. Pour l’instant, le transport se fait par l’acheteur ou par le vendeur.';
  end if;
  if c.mode_transport <> 'reseau' then raise exception 'Le prix du transport se convient à trois seulement avec un transporteur du réseau Marché de Gros.'; end if;
  if m.statut not in ('proposee', 'acceptee') then raise exception 'Cette mission n''est plus en cours.'; end if;
  if t.statut <> 'verifie' then raise exception 'Seuls les transporteurs vérifiés par le Marché de Gros font une mission du réseau.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le prix du transport se convient avant le chargement.';
  end if;
  if exists (select 1 from public.transport_propositions where mission_id = m.id and issue = 'acceptee') then
    raise exception 'Le prix du transport est déjà convenu : il ne change plus.';
  end if;
  if p_action not in ('prix', 'accord', 'refus', 'retrait') then raise exception 'Action inconnue.'; end if;

  select * into p from public.transport_propositions where mission_id = m.id and issue = 'en_attente' order by created_at desc limit 1 for update;
  if p.id is not null and p.expire_le <= now() then
    update public.transport_propositions set issue = 'expiree', clos_le = now() where id = p.id;
    p := null; expire := true;
  end if;

  if p_action = 'prix' then
    px := public._ctr_prix(p_prix);
    if p.id is null and r <> 'transporteur' and not exists (select 1 from public.transport_propositions where mission_id = m.id) then
      raise exception 'Le transporteur propose son prix en premier.';
    end if;
    if p.id is not null then update public.transport_propositions set issue = 'remplacee', clos_le = now() where id = p.id; end if;
    insert into public.transport_propositions (mission_id, commande_id, auteur_id, role, prix, expire_le, ok_transporteur, ok_acheteur, ok_vendeur)
    values (m.id, c.id, me, r, px, now() + interval '48 hours',
            case when r = 'transporteur' then now() end, case when r = 'acheteur' then now() end, case when r = 'vendeur' then now() end);

  elsif p_action = 'accord' then
    if p.id is null then
      raise exception '%', case when expire then 'Ce prix a expiré (48 h sans réponse). Faites une nouvelle proposition.' else 'Il n''y a pas de prix de transport en attente.' end;
    end if;
    if p_ref is not null and p_ref <> p.id then raise exception 'Le prix a changé entre-temps. Relisez la dernière proposition.'; end if;
    update public.transport_propositions set
      ok_transporteur = case when r = 'transporteur' then coalesce(ok_transporteur, now()) else ok_transporteur end,
      ok_acheteur = case when r = 'acheteur' then coalesce(ok_acheteur, now()) else ok_acheteur end,
      ok_vendeur = case when r = 'vendeur' then coalesce(ok_vendeur, now()) else ok_vendeur end
    where id = p.id returning * into p;
    if p.ok_transporteur is not null and p.ok_acheteur is not null and p.ok_vendeur is not null then
      update public.transport_propositions set issue = 'acceptee', clos_le = now() where id = p.id;
      update public.transport_missions set statut = 'acceptee', prix = p.prix, repondu_le = coalesce(repondu_le, now()) where id = m.id;
      update public.commandes set transporteur_id = t.id, total_convenu = case when montant is not null then round(montant, 0) + p.prix end, updated_at = now()
      where id = c.id;
    end if;

  elsif p_action = 'refus' then
    if p.id is null then
      raise exception '%', case when expire then 'Ce prix a expiré (48 h sans réponse).' else 'Il n''y a pas de prix de transport en attente.' end;
    end if;
    if p_ref is not null and p_ref <> p.id then raise exception 'Le prix a changé entre-temps. Relisez la dernière proposition.'; end if;
    if p.role = r then raise exception 'C''est votre propre prix : retirez-le ou proposez-en un autre.'; end if;
    update public.transport_propositions set issue = 'refusee', refuse_par = r, clos_le = now() where id = p.id;
    update public.transport_missions set statut = case when r = 'transporteur' then 'refusee' else 'retiree' end, repondu_le = now(),
      note = 'Prix du transport refusé par ' || case r when 'transporteur' then 'le transporteur' when 'acheteur' then 'l''acheteur' else 'le vendeur' end
             || ' : le livreur du vendeur prend le relais.'
    where id = m.id;
    -- la commande continue avec le livreur du vendeur (décision 6) ; un transport à part convenu dans l'accord reprend sa place
    select * into n from public.negociations where id = c.negociation_id;
    pa := case when coalesce(n.transport_final, false) then null else round(n.prix_transport_final, 0) end;
    update public.commandes set mode_transport = 'vendeur', validation = 'declaration', transporteur_id = null,
      transport_regle = case when pa is not null then 'a_part' else 'livreur_vendeur' end, prix_transport = pa,
      total_convenu = case when montant is null then null else round(montant, 0) + coalesce(pa, 0) end, updated_at = now()
    where id = c.id;

  else
    if p.id is null or p.role <> r then raise exception 'Vous n''avez pas de prix en attente à retirer.'; end if;
    update public.transport_propositions set issue = 'retiree', clos_le = now() where id = p.id;
  end if;

  update public.commandes set updated_at = now() where id = c.id;
  return public._tr_tri_etat(m.id);
end $function$;
revoke execute on function public.transport_agir(uuid, text, numeric, uuid) from public, anon;
grant execute on function public.transport_agir(uuid, text, numeric, uuid) to authenticated;

-- le transporteur du réseau n'accepte plus une mission seul : le prix se convient à trois (transport_agir)
create or replace function public.chauffeur_repondre(p_mission uuid, p_oui boolean, p_note text default null::text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; c public.commandes; nt text;
begin
  select * into m from public.transport_missions where id = p_mission for update;
  select * into t from public.transporteurs where id = m.transporteur_id;
  if m.id is null or t.user_id is distinct from me then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if m.statut <> 'proposee' then raise exception 'Cette mission a déjà reçu une réponse.'; end if;
  if t.statut in ('refuse', 'suspendu') then raise exception 'Votre profil de transporteur ne permet pas d''accepter de mission.'; end if;
  select * into c from public.commandes where id = m.commande_id for update;
  if c.etat not in ('a_confirmer', 'en_cours') then raise exception 'Cette commande n''est plus en cours.'; end if;
  if p_oui and c.mode_transport = 'reseau' and t.statut <> 'verifie' then
    raise exception 'Seuls les transporteurs vérifiés par le Marché de Gros acceptent une mission du réseau.';
  end if;
  if p_oui and c.mode_transport = 'reseau' then
    raise exception 'Proposez votre prix : la mission démarre quand l''acheteur et le vendeur l''ont accepté.';
  end if;
  nt := public._cmd_texte(p_note, 300);
  update public.transport_missions set statut = case when p_oui then 'acceptee' else 'refusee' end, repondu_le = now(), note = coalesce(nt, note) where id = m.id;
  if p_oui then update public.commandes set transporteur_id = t.id, updated_at = now() where id = c.id;
  else update public.commandes set updated_at = now() where id = c.id; end if;
  return case when p_oui then 'acceptee' else 'refusee' end;
end $function$;

create or replace function public.chauffeur_prix(p_mission uuid, p_prix numeric)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); m public.transport_missions; t public.transporteurs; c public.commandes; px numeric := public._ctr_prix(p_prix);
begin
  select * into m from public.transport_missions where id = p_mission for update;
  select * into t from public.transporteurs where id = m.transporteur_id;
  if m.id is null or t.user_id is distinct from me then raise exception 'Mission introuvable.'; end if;
  if m.statut <> 'acceptee' then raise exception 'Le prix se fixe sur une mission acceptée.'; end if;
  select * into c from public.commandes where id = m.commande_id;
  if c.mode_transport = 'reseau' then raise exception 'Avec le réseau Marché de Gros, le prix se convient à trois : proposez-le à l''acheteur et au vendeur.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le prix ne se change plus après le chargement.';
  end if;
  update public.transport_missions set prix = px where id = m.id;
  update public.commandes set updated_at = now() where id = c.id;
  return px;
end $function$;

create or replace function public.admin_mission_prix(p_mission uuid, p_prix numeric)
 returns numeric
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare m public.transport_missions; c public.commandes; px numeric := public._ctr_prix(p_prix);
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into m from public.transport_missions where id = p_mission for update;
  if m.id is null or m.statut <> 'acceptee' then raise exception 'Mission acceptée introuvable.'; end if;
  select * into c from public.commandes where id = m.commande_id;
  if c.mode_transport = 'reseau' then
    raise exception 'Avec le réseau Marché de Gros, le prix se convient à trois : le transporteur propose, l''acheteur et le vendeur acceptent.';
  end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le prix ne se change plus après le chargement.';
  end if;
  update public.transport_missions set prix = px where id = m.id;
  update public.commandes set updated_at = now() where id = c.id;
  return px;
end $function$;

-- transbordement : le nouveau chauffeur reprend le prix convenu (décision 8)
create or replace function public._tm_prix_transfert()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare px numeric;
begin
  if new.prix is null and new.statut = 'acceptee' and new.note like 'Transfert depuis%' then
    select m.prix into px from public.transport_missions m
    where m.commande_id = new.commande_id and m.statut = 'retiree' and m.prix is not null and m.note like 'Transmise à%'
    order by m.repondu_le desc nulls last limit 1;
    new.prix := px;
  end if;
  return new;
end $function$;
revoke execute on function public._tm_prix_transfert() from public, anon, authenticated;
create or replace trigger transport_missions_prix_transfert before insert on public.transport_missions
  for each row execute function public._tm_prix_transfert();

create or replace function public.commande_transfert_preparer(p_cmd uuid, p_code_transporteur text, p_lieu text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare me uuid := auth.uid(); c public.commandes; t public.transporteurs; lieu text; res json;
  cd text := upper(regexp_replace(coalesce(p_code_transporteur, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or public._cmd_role2(c, me) is distinct from 'chauffeur' then raise exception 'Mission introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' or c.etape not in ('transport', 'transbordement') then raise exception 'Un transfert se fait pendant le transport.'; end if;
  if c.validation <> 'code' then raise exception 'Cette commande se valide sans code : signalez simplement le transbordement.'; end if;
  lieu := public._cmd_texte(p_lieu, 120);
  if lieu is null then raise exception 'Indiquez le lieu du transfert.'; end if;
  if cd !~ '^T[A-Z0-9]{4}$' then raise exception 'Code transporteur invalide (exemple : T-4K7P).'; end if;
  select * into t from public.transporteurs where replace(code, '-', '') = cd;
  if t.id is null then raise exception 'Aucun transporteur avec ce code.'; end if;
  if t.id = c.transporteur_id then raise exception 'C''est votre propre code : demandez celui du nouveau chauffeur.'; end if;
  if t.statut in ('refuse', 'suspendu') then raise exception 'Ce transporteur ne peut pas recevoir de mission.'; end if;
  if c.mode_transport = 'reseau' and t.statut <> 'verifie' then raise exception 'Seul un transporteur vérifié par le Marché de Gros peut reprendre une mission du réseau.'; end if;
  if t.user_id is null then raise exception 'Ce transporteur n''a pas l''application.'; end if;
  if t.user_id in (c.vendeur_id, c.acheteur_id) then raise exception 'Ce transporteur est une des parties de la commande.'; end if;
  res := public._code_creer(c.id, 'transfert', me, interval '2 hours', t.id, lieu);
  return (res::jsonb || jsonb_build_object('nom', t.nom))::json;
end $function$;

-- ce que l'écran montre : le prix accepté seulement ; pas de total quand le livreur est hors Marché de Gros
create or replace function public.commande_transport(p_id uuid)
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case when c.id is null or not (public._cmd_role2(c, auth.uid()) is not null or public.est_admin()) then null else json_build_object(
    'mode', c.mode_transport,
    'peut_choisir', false,
    'mon_role', coalesce(public._cmd_role2(c, auth.uid()), 'admin'),
    'mission', (select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'vehicule', public._tr_vehicule(t.vehicule),
        'immatriculation', t.immatriculation, 'verifie', t.statut = 'verifie', 'avec_application', t.user_id is not null, 'le', coalesce(m.repondu_le, m.created_at),
        'prix', m.prix, 'code', case when m.statut = 'acceptee' then t.code end)
      from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
      where m.commande_id = c.id order by m.created_at desc limit 1),
    'regle', c.transport_regle, 'ville_depart', c.ville_depart, 'ville_arrivee', c.ville_arrivee, 'meme_ville', c.meme_ville,
    'hors_mgci', c.mode_transport <> 'reseau',
    'prix_transport', z.tp,
    'total_livraison', case when z.tp is not null and c.montant is not null then round(c.montant, 0) + z.tp end,
    'prix_trois', case when c.mode_transport = 'reseau' then (select public._tr_tri_etat(m.id) from public.transport_missions m
        where m.commande_id = c.id and m.statut in ('proposee', 'acceptee') order by m.created_at desc limit 1) end) end
  from (select 1) x left join public.commandes c on c.id = p_id
  left join lateral (select case
      when c.mode_transport = 'reseau' then (select round(m.prix, 0) from public.transport_missions m
        where m.commande_id = c.id and m.statut = 'acceptee' and m.prix is not null order by m.created_at desc limit 1)
      when c.transport_regle = 'a_part' then round(c.prix_transport, 0) end as tp) z on true;
$function$;

create or replace function public.chauffeur_missions()
 returns json
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at, 'note', m.note,
      'prix', m.prix, 'taux', 0.069, 'commission', case when m.prix is not null then round(round(m.prix, 0) * 0.069, 0) end,
      'net', case when m.prix is not null then round(m.prix, 0) - round(round(m.prix, 0) * 0.069, 0) end,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'validation', c.validation, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'libere_le', c.libere_le,
      'refus', case when c.refus_le is not null and c.transporteur_id = t.id then json_build_object(
          'le', c.refus_le, 'quantite', c.refus_quantite, 'motif', c.refus_motif, 'photos', c.refus_photos,
          'reponse', c.refus_chauffeur, 'a_repondre', c.etat = 'litige' and c.refus_chauffeur is null, 'suffit', public._cmd_chauffeur_independant(c)) end,
      'maj', c.updated_at,
      'mode', c.mode_transport, 'ville_arrivee', c.ville_arrivee,
      'prix_trois', case when c.mode_transport = 'reseau' then public._tr_tri_etat(m.id) end)
    order by (m.statut = 'proposee') desc, (c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null) desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$function$;

-- pas de messages privés entre le transporteur et les parties pendant une mission (décision 9)
create or replace function public._dm_mission_interdite(x uuid, y uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select not public.est_admin_id(x) and not public.est_admin_id(y) and exists (
    select 1 from public.transport_missions m
    join public.transporteurs t on t.id = m.transporteur_id
    join public.commandes c on c.id = m.commande_id
    where m.statut in ('proposee', 'acceptee') and c.etat in ('a_confirmer', 'en_cours', 'litige')
      and ((t.user_id = x and y in (c.acheteur_id, c.vendeur_id)) or (t.user_id = y and x in (c.acheteur_id, c.vendeur_id))))
$function$;
revoke execute on function public._dm_mission_interdite(uuid, uuid) from public, anon, authenticated;

create or replace function public.dm_ouvrir(p_autre uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_a uuid; v_b uuid; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  if p_autre is null or p_autre = auth.uid() then raise exception 'On ne s''écrit pas à soi-même.'; end if;
  if not exists (select 1 from auth.users where id = p_autre) or exists (select 1 from public.profils where user_id = p_autre and supprime_le is not null) then
    raise exception 'Ce compte n''existe plus.'; end if;
  if public._dm_mission_interdite(auth.uid(), p_autre) then
    raise exception 'Pendant une mission, le transporteur et les parties ne s''écrivent pas en privé. Le prix du transport se convient par propositions, dans la commande.';
  end if;
  v_a := least(auth.uid(), p_autre); v_b := greatest(auth.uid(), p_autre);
  select id into v_id from public.discussions where a_id = v_a and b_id = v_b;
  if v_id is null then
    insert into public.discussions (a_id, b_id) values (v_a, v_b) on conflict (a_id, b_id) do nothing returning id into v_id;
    if v_id is null then select id into v_id from public.discussions where a_id = v_a and b_id = v_b; end if;
  end if;
  return v_id;
end $function$;

create or replace function public.dm_envoyer(p_discussion uuid, p_texte text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare d public.discussions; v_autre uuid; v_t text := btrim(coalesce(p_texte, '')); r public.dm;
begin
  if auth.uid() is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into d from public.discussions where id = p_discussion and auth.uid() in (a_id, b_id);
  if d.id is null then raise exception 'Conversation introuvable.'; end if;
  v_autre := case when d.a_id = auth.uid() then d.b_id else d.a_id end;
  if public.dm_bloque(auth.uid(), v_autre) then raise exception 'BLOQUE'; end if;
  if exists (select 1 from public.profils where user_id = v_autre and supprime_le is not null) then raise exception 'Ce compte n''existe plus.'; end if;
  if public._dm_mission_interdite(auth.uid(), v_autre) then
    raise exception 'Pendant une mission, le transporteur et les parties ne s''écrivent pas en privé. Le prix du transport se convient par propositions, dans la commande.';
  end if;
  if v_t = '' then raise exception 'Message vide.'; end if;
  if char_length(v_t) > 2000 then raise exception 'Message trop long (2 000 caractères au plus).'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'TROP_VITE'; end if;
  if (select count(*) from public.dm where auteur_id = auth.uid() and created_at > now() - interval '1 day') >= 500 then raise exception 'TROP_VITE'; end if;
  insert into public.dm (discussion_id, auteur_id, texte) values (d.id, auth.uid(), v_t) returning * into r;
  update public.discussions set updated_at = r.created_at, dernier_texte = left(v_t, 140), dernier_par = auth.uid(),
    lu_a = case when a_id = auth.uid() then r.created_at else lu_a end, lu_b = case when b_id = auth.uid() then r.created_at else lu_b end,
    cache_a = case when a_id = auth.uid() then null else cache_a end, cache_b = case when b_id = auth.uid() then null else cache_b end
  where id = d.id;
  return json_build_object('id', r.id, 'created_at', r.created_at, 'auteur_id', r.auteur_id, 'texte', r.texte);
end $function$;
