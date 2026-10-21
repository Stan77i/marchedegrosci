-- ═════════ Marché de Gros CI — schéma 27 : les transporteurs ═════════
-- Appliqué par Claude avec l'outil Supabase. Aucun drop.
--
-- Principe :
--   • un transporteur s'inscrit lui-même (Mon compte → Espace chauffeur) ou est inscrit par l'administration
--     (chauffeur sans application : nom et numéro gardés pour l'équipe seulement) ;
--   • l'équipe le vérifie (vérifié / refusé / suspendu, avec un motif) ; seul un transporteur vérifié peut se dire « disponible » ;
--   • chaque transporteur a un code court (T-4K7P) : l'acheteur ou le vendeur qui a choisi son propre transporteur
--     le saisit dans la commande (mode « acheteur » ou « vendeur ») ; pour le mode « réseau », c'est l'équipe qui affecte ;
--   • une affectation est une MISSION (transport_missions) : proposée → acceptée ou refusée par le chauffeur, ou retirée ;
--     un chauffeur inscrit par l'équipe (sans compte) est accepté d'office ;
--   • le chauffeur qui a accepté peut signaler l'arrivée et un transbordement ; le chargement reste déclaré par le vendeur
--     et la réception par l'acheteur (les codes arriveront à l'étape suivante) ;
--   • l'administration peut trancher un litige : commande terminée ou annulée, écrit dans l'historique ;
--   • données personnelles : le numéro d'un chauffeur n'est visible que de l'administration ; les parties voient
--     son nom, son véhicule et sa plaque (utile au chargement) ; le chauffeur voit les noms publics et les lieux, jamais les numéros.

-- ——— 1) Tables ———
create table if not exists public.transporteurs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users (id) on delete cascade,
  code           text not null unique,
  nom            text not null check (char_length(nom) between 2 and 80),
  tel            text check (tel is null or tel ~ '^[0-9]{10}$'),            -- seulement pour un chauffeur inscrit par l'équipe
  vehicule       text not null check (vehicule in ('moto', 'tricycle', 'camionnette', 'camion', 'semi', 'autre')),
  immatriculation text check (char_length(immatriculation) <= 20),
  capacite_kg    numeric check (capacite_kg is null or (capacite_kg > 0 and capacite_kg < 1e6)),
  zones          text[] not null default '{}' check (cardinality(zones) <= 31),
  statut         text not null default 'en_attente' check (statut in ('en_attente', 'verifie', 'refuse', 'suspendu')),
  disponible     boolean not null default false,
  motif          text check (char_length(motif) <= 300),
  decide_par     uuid,
  decide_le      timestamptz,
  cree_par       uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists transporteurs_dispo on public.transporteurs (statut, disponible);

create table if not exists public.transport_missions (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid not null references public.commandes (id) on delete cascade,
  transporteur_id uuid not null references public.transporteurs (id) on delete cascade,
  propose_par     uuid,
  propose_role    text not null check (propose_role in ('admin', 'acheteur', 'vendeur')),
  statut          text not null default 'proposee' check (statut in ('proposee', 'acceptee', 'refusee', 'retiree')),
  note            text check (char_length(note) <= 300),
  created_at      timestamptz not null default now(),
  repondu_le      timestamptz
);
create index if not exists transport_missions_cmd on public.transport_missions (commande_id, created_at desc);
create index if not exists transport_missions_tr on public.transport_missions (transporteur_id, statut);
-- une seule mission vivante (proposée ou acceptée) par commande
create unique index if not exists transport_missions_vivante on public.transport_missions (commande_id) where statut in ('proposee', 'acceptee');

alter table public.transporteurs enable row level security;
alter table public.transport_missions enable row level security;
revoke all on public.transporteurs, public.transport_missions from anon, authenticated;
grant select on public.transporteurs, public.transport_missions to service_role;

-- commandes.transporteur_id (schéma 26) pointe vers le transporteur dont la mission est acceptée
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'commandes_transporteur_fk') then
    alter table public.commandes add constraint commandes_transporteur_fk foreign key (transporteur_id) references public.transporteurs (id) on delete set null;
  end if;
end $$;

-- ——— 2) Outils ———
create or replace function public._tr_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare c text;
begin
  loop
    c := 'T-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
                  from (select gen_random_bytes(4) b) r, generate_series(0, 3) i);
    exit when not exists (select 1 from public.transporteurs where code = c);
  end loop;
  return c;
end $$;

create or replace function public._tr_moi() returns public.transporteurs
language sql stable security definer set search_path = public as $$
  select * from public.transporteurs where user_id = auth.uid();
$$;

-- le rôle d'une personne dans une commande, chauffeur compris (mission acceptée)
create or replace function public._cmd_role2(c public.commandes, u uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(public._cmd_role(c, u),
    case when exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id = u) then 'chauffeur' end);
$$;

create or replace function public._tr_vehicule(v text) returns text language sql immutable set search_path = public as $$
  select case v when 'moto' then 'Moto' when 'tricycle' then 'Tricycle' when 'camionnette' then 'Camionnette'
    when 'camion' then 'Camion' when 'semi' then 'Semi-remorque' else 'Autre véhicule' end;
$$;

-- ——— 3) Côté chauffeur ———
create or replace function public.transporteur_inscrire(p_nom text, p_vehicule text, p_immat text default null,
  p_capacite numeric default null, p_zones text[] default '{}') returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); t public.transporteurs; v_nom text; im text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  v_nom := public._cmd_texte(p_nom, 80);
  if v_nom is null or char_length(v_nom) < 2 then raise exception 'Indiquez votre nom.'; end if;
  if p_vehicule not in ('moto', 'tricycle', 'camionnette', 'camion', 'semi', 'autre') then raise exception 'Choisissez votre véhicule.'; end if;
  im := upper(nullif(regexp_replace(coalesce(p_immat, ''), '\s+', ' ', 'g'), ''));
  if im is not null and (char_length(im) > 20 or im !~ '^[A-Z0-9 -]+$') then raise exception 'Plaque d''immatriculation invalide.'; end if;
  if p_capacite is not null and (p_capacite <= 0 or p_capacite >= 1e6) then raise exception 'Capacité invalide.'; end if;
  if cardinality(coalesce(p_zones, '{}')) > 31 then raise exception 'Trop de zones.'; end if;
  select * into t from public.transporteurs where user_id = me for update;
  if t.id is null then
    insert into public.transporteurs (user_id, code, nom, vehicule, immatriculation, capacite_kg, zones, cree_par)
    values (me, public._tr_code(), v_nom, p_vehicule, im, p_capacite, coalesce(p_zones, '{}'), me) returning * into t;
  else
    if t.statut = 'suspendu' then raise exception 'Votre profil de transporteur est suspendu. Écrivez au Marché de Gros.'; end if;
    update public.transporteurs set nom = v_nom, vehicule = p_vehicule, immatriculation = im, capacite_kg = p_capacite, zones = coalesce(p_zones, '{}'),
      -- un changement de véhicule ou de plaque se revérifie
      statut = case when t.statut = 'verifie' and (t.vehicule is distinct from p_vehicule or t.immatriculation is distinct from im) then 'en_attente' else t.statut end,
      disponible = case when t.statut = 'verifie' and (t.vehicule is distinct from p_vehicule or t.immatriculation is distinct from im) then false else t.disponible end,
      updated_at = now()
    where id = t.id returning * into t;
  end if;
  return json_build_object('code', t.code, 'statut', t.statut);
end $$;

create or replace function public.transporteur_moi() returns json
language sql stable security definer set search_path = public as $$
  select case when t.id is null then null else json_build_object('id', t.id, 'code', t.code, 'nom', t.nom, 'vehicule', t.vehicule,
    'immatriculation', t.immatriculation, 'capacite_kg', t.capacite_kg, 'zones', t.zones, 'statut', t.statut, 'disponible', t.disponible,
    'motif', t.motif, 'identite', public.identite_ok(auth.uid())) end
  from (select 1) x left join public.transporteurs t on t.user_id = auth.uid();
$$;

create or replace function public.transporteur_disponible(p_oui boolean) returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare t public.transporteurs := public._tr_moi();
begin
  if t.id is null then raise exception 'Inscrivez-vous d''abord comme transporteur.'; end if;
  if p_oui and t.statut <> 'verifie' then raise exception 'Votre profil doit d''abord être vérifié par l''équipe.'; end if;
  update public.transporteurs set disponible = p_oui, updated_at = now() where id = t.id;
  return p_oui;
end $$;

create or replace function public.chauffeur_missions() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'mission_id', m.id, 'mission', m.statut, 'propose_role', m.propose_role, 'propose_le', m.created_at,
      'commande_id', c.id, 'numero', c.numero, 'etat', c.etat, 'etape', c.etape, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
      'ville_depart', c.ville_depart, 'lieu_livraison', c.lieu_livraison,
      'vendeur', coalesce(public.nom_public(c.vendeur_id), 'Membre'), 'acheteur', coalesce(public.nom_public(c.acheteur_id), 'Membre'),
      'maj', c.updated_at) order by (m.statut = 'proposee') desc, c.updated_at desc), '[]'::json)
  from public.transport_missions m
  join public.transporteurs t on t.id = m.transporteur_id and t.user_id = auth.uid()
  join public.commandes c on c.id = m.commande_id
  where m.statut in ('proposee', 'acceptee') or (m.statut = 'refusee' and m.repondu_le > now() - interval '7 days');
$$;

create or replace function public.chauffeur_repondre(p_mission uuid, p_oui boolean, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
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
  nt := public._cmd_texte(p_note, 300);
  update public.transport_missions set statut = case when p_oui then 'acceptee' else 'refusee' end, repondu_le = now(), note = coalesce(nt, note) where id = m.id;
  if p_oui then update public.commandes set transporteur_id = t.id, updated_at = now() where id = c.id;
  else update public.commandes set updated_at = now() where id = c.id; end if;
  return case when p_oui then 'acceptee' else 'refusee' end;
end $$;

-- ——— 4) Côté acheteur / vendeur : choisir son transporteur par son code ———
create or replace function public.commande_choisir_transporteur(p_cmd uuid, p_code text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; t public.transporteurs; cd text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into c from public.commandes where id = p_cmd for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.mode_transport = 'reseau' then raise exception 'Pour un transporteur du réseau, c''est l''équipe du Marché de Gros qui l''affecte.'; end if;
  if c.mode_transport <> r then raise exception 'C''est % qui choisit le transporteur de cette commande.', case when c.mode_transport = 'acheteur' then 'l''acheteur' else 'le vendeur' end; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then
    raise exception 'Le transporteur se choisit avant le chargement.';
  end if;
  if cd !~ '^T[A-Z0-9]{4}$' then raise exception 'Code transporteur invalide (exemple : T-4K7P).'; end if;
  select * into t from public.transporteurs where replace(code, '-', '') = cd;
  if t.id is null then raise exception 'Aucun transporteur avec ce code.'; end if;
  if t.statut in ('refuse', 'suspendu') then raise exception 'Ce transporteur ne peut pas recevoir de mission.'; end if;
  if t.user_id is null then raise exception 'Ce transporteur n''a pas l''application.'; end if;
  if t.user_id in (c.vendeur_id, c.acheteur_id) then raise exception 'Vous ne pouvez pas être le transporteur de votre propre commande.'; end if;
  update public.transport_missions set statut = 'retiree', repondu_le = now() where commande_id = c.id and statut in ('proposee', 'acceptee');
  update public.commandes set transporteur_id = null, updated_at = now() where id = c.id;
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role) values (c.id, t.id, me, r);
  return json_build_object('nom', t.nom, 'vehicule', public._tr_vehicule(t.vehicule), 'verifie', t.statut = 'verifie');
end $$;

create or replace function public.commande_retirer_transporteur(p_cmd uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text;
begin
  select * into c from public.commandes where id = p_cmd for update;
  r := public._cmd_role(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if c.mode_transport <> r then raise exception 'Seule la personne qui choisit le transporteur peut le retirer.'; end if;
  if coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then raise exception 'La marchandise est chargée : le transporteur ne peut plus changer.'; end if;
  update public.transport_missions set statut = 'retiree', repondu_le = now() where commande_id = c.id and statut in ('proposee', 'acceptee');
  update public.commandes set transporteur_id = null, updated_at = now() where id = c.id;
end $$;

-- ce que les parties (et le chauffeur, et l'équipe) voient du transport d'une commande
create or replace function public.commande_transport(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when c.id is null or not (public._cmd_role2(c, auth.uid()) is not null or public.est_admin()) then null else json_build_object(
    'mode', c.mode_transport,
    'peut_choisir', c.mode_transport = public._cmd_role(c, auth.uid()) and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation'),
    'mon_role', coalesce(public._cmd_role2(c, auth.uid()), 'admin'),
    'mission', (select json_build_object('id', m.id, 'statut', m.statut, 'nom', t.nom, 'vehicule', public._tr_vehicule(t.vehicule),
        'immatriculation', t.immatriculation, 'verifie', t.statut = 'verifie', 'avec_application', t.user_id is not null, 'le', coalesce(m.repondu_le, m.created_at))
      from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
      where m.commande_id = c.id order by m.created_at desc limit 1)) end
  from (select 1) x left join public.commandes c on c.id = p_id;
$$;

-- ——— 5) Le chauffeur dans la commande : arrivée et transbordement ———
-- (même signature et même résultat qu'au schéma 26 ; ajoute le rôle « chauffeur »)
create or replace function public.commande_avancer(p_id uuid, p_etape text, p_lieu text default null,
  p_lat double precision default null, p_lon double precision default null, p_note text default null) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; lieu text; nt text; pv text;
begin
  select * into c from public.commandes where id = p_id for update;
  r := public._cmd_role2(c, me);
  if c.id is null or r is null then raise exception 'Commande introuvable.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if c.etat <> 'en_cours' then raise exception 'Cette commande n''est pas en cours.'; end if;
  if c.validation = 'code' then raise exception 'Cette étape se valide avec le code du chauffeur.'; end if;
  if (p_lat is null) <> (p_lon is null) or (p_lat is not null and (p_lat not between -90 and 90 or p_lon not between -180 and 180)) then
    raise exception 'Position invalide.';
  end if;
  lieu := public._cmd_texte(p_lieu, 120); nt := public._cmd_texte(p_note, 300);
  pv := case when p_lat is not null then 'gps' else 'declaration' end;
  if p_etape = 'preparation' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui prépare la marchandise.'; end if;
    if c.etape <> 'confirmee' then raise exception 'Étape déjà passée.'; end if;
  elsif p_etape = 'chargement' then
    if r <> 'vendeur' then raise exception 'C''est le vendeur qui confirme le chargement.'; end if;
    if c.etape not in ('confirmee', 'preparation') then raise exception 'Le chargement est déjà confirmé.'; end if;
  elsif p_etape = 'transbordement' then
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le transbordement se signale pendant le transport.'; end if;
    if lieu is null then raise exception 'Indiquez le lieu du transbordement.'; end if;
  elsif p_etape = 'arrivee' then
    if r not in ('acheteur', 'chauffeur') then raise exception 'C''est l''acheteur ou le chauffeur qui signale l''arrivée.'; end if;
    if c.etape not in ('transport', 'transbordement') then raise exception 'Le chauffeur doit d''abord être en route.'; end if;
  elsif p_etape = 'reception' then
    if r <> 'acheteur' then raise exception 'C''est l''acheteur qui confirme la réception.'; end if;
    if c.etape not in ('transport', 'transbordement', 'arrivee') then raise exception 'La marchandise doit d''abord être chargée.'; end if;
  else
    raise exception 'Étape inconnue.';
  end if;
  update public.commandes set etape = p_etape where id = p_id;
  perform public._cmd_journal(p_id, p_etape, me, r, pv, lieu, p_lat, p_lon, nt);
  if p_etape = 'chargement' then
    update public.commandes set etape = 'transport' where id = p_id;
    perform public._cmd_journal(p_id, 'transport', null, 'systeme', 'auto');
    return 'transport';
  elsif p_etape = 'reception' then
    update public.commandes set etape = 'terminee', etat = 'terminee', termine_le = now() where id = p_id;
    perform public._cmd_journal(p_id, 'terminee', null, 'systeme', 'auto');
    return 'terminee';
  end if;
  return p_etape;
end $$;

-- le journal : le chauffeur le lit aussi, et les missions y apparaissent (même résultat qu'au schéma 26)
create or replace function public.commande_journal(p_id uuid) returns table (evenement text, role text, preuve text, lieu text,
  lat double precision, lon double precision, note text, at timestamptz, par_moi boolean)
language sql stable security definer set search_path = public as $$
  with ok as (select 1 from public.commandes c0 where c0.id = p_id and auth.uid() is not null
              and (public._cmd_role2(c0, auth.uid()) is not null or public.est_admin()))
  select * from (
    select e.evenement, e.role, e.preuve, e.lieu, e.lat, e.lon, e.note, e.at, e.par = auth.uid()
    from public.commande_etapes e where e.commande_id = p_id and exists (select 1 from ok)
    union all
    select 'transporteur_' || m.statut, case when m.statut = 'proposee' then m.propose_role else 'chauffeur' end, case when m.propose_role = 'admin' then 'admin' else 'declaration' end,
      t.nom || ' · ' || public._tr_vehicule(t.vehicule), null, null, m.note, coalesce(m.repondu_le, m.created_at),
      (m.statut = 'proposee' and m.propose_par = auth.uid()) or (m.statut <> 'proposee' and t.user_id = auth.uid())
    from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
    where m.commande_id = p_id and exists (select 1 from ok)
  ) j order by j.at;
$$;

-- ——— 6) Côté administration ———
create or replace function public.admin_transporteurs() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return (select coalesce(json_agg(json_build_object('id', t.id, 'code', t.code, 'nom', t.nom, 'tel', t.tel, 'vehicule', t.vehicule,
      'immatriculation', t.immatriculation, 'capacite_kg', t.capacite_kg, 'zones', t.zones, 'statut', t.statut, 'disponible', t.disponible,
      'motif', t.motif, 'avec_application', t.user_id is not null, 'identite', case when t.user_id is null then null else public.identite_ok(t.user_id) end,
      'missions', (select count(*) from public.transport_missions m where m.transporteur_id = t.id and m.statut = 'acceptee'),
      'cree_le', t.created_at) order by (t.statut = 'en_attente') desc, t.created_at desc), '[]'::json) from public.transporteurs t);
end $$;

create or replace function public.admin_transporteur_creer(p_nom text, p_tel text, p_vehicule text, p_immat text default null,
  p_capacite numeric default null, p_zones text[] default '{}') returns text
language plpgsql volatile security definer set search_path = public as $$
declare t text := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'); c text := public._tr_code();
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if length(t) = 13 and left(t, 3) = '225' then t := substr(t, 4); end if;
  if t !~ '^[0-9]{10}$' then raise exception 'Numéro à 10 chiffres.'; end if;
  if coalesce(btrim(p_nom), '') = '' then raise exception 'Indiquez le nom.'; end if;
  insert into public.transporteurs (code, nom, tel, vehicule, immatriculation, capacite_kg, zones, statut, decide_par, decide_le, cree_par)
  values (c, btrim(p_nom), t, p_vehicule, upper(nullif(btrim(coalesce(p_immat, '')), '')), p_capacite, coalesce(p_zones, '{}'), 'verifie', auth.uid(), now(), auth.uid());
  return c;
end $$;

create or replace function public.admin_transporteur_decider(p_id uuid, p_statut text, p_motif text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_statut not in ('verifie', 'refuse', 'suspendu', 'en_attente') then raise exception 'Décision inconnue.'; end if;
  if p_statut in ('refuse', 'suspendu') and coalesce(btrim(p_motif), '') = '' then raise exception 'Indiquez un motif.'; end if;
  update public.transporteurs set statut = p_statut, motif = nullif(btrim(coalesce(p_motif, '')), ''), decide_par = auth.uid(), decide_le = now(),
    disponible = case when p_statut = 'verifie' then disponible else false end, updated_at = now() where id = p_id;
  if not found then raise exception 'Transporteur introuvable.'; end if;
end $$;

create or replace function public.admin_commandes(p_vue text default 'a_traiter') returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  return (select coalesce(json_agg(x order by x.maj desc), '[]'::json) from (
    select c.id, c.numero, c.etat, c.etape, c.produit, c.quantite, c.unite, c.montant, c.commission_montant, c.mode_transport,
      c.ville_depart, c.lieu_livraison, c.litige_motif, c.litige_le, c.updated_at maj,
      coalesce(public.nom_public(c.vendeur_id), 'Membre') vendeur, coalesce(public.nom_public(c.acheteur_id), 'Membre') acheteur,
      (select json_build_object('statut', m.statut, 'nom', t.nom) from public.transport_missions m join public.transporteurs t on t.id = m.transporteur_id
        where m.commande_id = c.id order by m.created_at desc limit 1) mission
    from public.commandes c
    where case p_vue
      when 'a_traiter' then c.etat = 'litige'
        or (c.mode_transport = 'reseau' and c.etat in ('a_confirmer', 'en_cours') and coalesce(c.etape, 'confirmee') in ('confirmee', 'preparation')
            and not exists (select 1 from public.transport_missions m where m.commande_id = c.id and m.statut in ('proposee', 'acceptee')))
      when 'en_cours' then c.etat in ('a_confirmer', 'en_cours')
      else true end
    order by c.updated_at desc limit 300) x);
end $$;

create or replace function public.admin_affecter(p_cmd uuid, p_transporteur uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; t public.transporteurs;
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  select * into t from public.transporteurs where id = p_transporteur;
  if c.id is null or t.id is null then raise exception 'Commande ou transporteur introuvable.'; end if;
  if t.statut <> 'verifie' then raise exception 'Seul un transporteur vérifié peut être affecté par l''équipe.'; end if;
  if c.etat not in ('a_confirmer', 'en_cours') or coalesce(c.etape, 'confirmee') not in ('confirmee', 'preparation') then raise exception 'Le transporteur s''affecte avant le chargement.'; end if;
  update public.transport_missions set statut = 'retiree', repondu_le = now() where commande_id = c.id and statut in ('proposee', 'acceptee');
  -- chauffeur sans application : accepté d'office (l'équipe l'a appelé)
  insert into public.transport_missions (commande_id, transporteur_id, propose_par, propose_role, statut, repondu_le)
  values (c.id, t.id, auth.uid(), 'admin', case when t.user_id is null then 'acceptee' else 'proposee' end, case when t.user_id is null then now() end);
  update public.commandes set transporteur_id = case when t.user_id is null then t.id end, updated_at = now() where id = c.id;
  return case when t.user_id is null then 'acceptee' else 'proposee' end;
end $$;

create or replace function public.admin_litige_trancher(p_cmd uuid, p_issue text, p_note text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.commandes; nt text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_issue not in ('terminee', 'annulee') then raise exception 'Issue inconnue.'; end if;
  if nt is null or char_length(nt) > 300 then raise exception 'Expliquez la décision (300 caractères au plus).'; end if;
  select * into c from public.commandes where id = p_cmd for update;
  if c.id is null or c.etat <> 'litige' then raise exception 'Cette commande n''est pas en litige.'; end if;
  update public.commandes set etat = p_issue, etape = case when p_issue = 'terminee' then 'terminee' else etape end,
    termine_le = case when p_issue = 'terminee' then coalesce(termine_le, now()) else termine_le end where id = c.id;
  perform public._cmd_journal(c.id, p_issue, auth.uid(), 'admin', 'admin', null, null, null, nt);
end $$;

-- ——— 7) Notifications (fonction Edge « pousser ») ———
create or replace function public.push_mission() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if tg_op = 'UPDATE' and new.statut is not distinct from old.statut then return new; end if;
  if new.statut = 'retiree' then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('mission_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
create trigger transport_missions_push after insert or update of statut on public.transport_missions for each row execute function public.push_mission();

create or replace function public.push_transporteur() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if new.user_id is null or new.statut is not distinct from old.statut or new.statut = 'en_attente' then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('transporteur_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
create trigger transporteurs_push after update of statut on public.transporteurs for each row execute function public.push_transporteur();

-- ——— 8) Droits ———
revoke execute on function public._tr_code(), public._tr_moi(), public._cmd_role2(public.commandes, uuid), public._tr_vehicule(text),
  public.push_mission(), public.push_transporteur() from public, anon, authenticated;
revoke execute on function public.transporteur_inscrire(text, text, text, numeric, text[]), public.transporteur_moi(), public.transporteur_disponible(boolean),
  public.chauffeur_missions(), public.chauffeur_repondre(uuid, boolean, text), public.commande_choisir_transporteur(uuid, text),
  public.commande_retirer_transporteur(uuid), public.commande_transport(uuid), public.admin_transporteurs(),
  public.admin_transporteur_creer(text, text, text, text, numeric, text[]), public.admin_transporteur_decider(uuid, text, text),
  public.admin_commandes(text), public.admin_affecter(uuid, uuid), public.admin_litige_trancher(uuid, text, text) from public, anon;
grant execute on function public.transporteur_inscrire(text, text, text, numeric, text[]), public.transporteur_moi(), public.transporteur_disponible(boolean),
  public.chauffeur_missions(), public.chauffeur_repondre(uuid, boolean, text), public.commande_choisir_transporteur(uuid, text),
  public.commande_retirer_transporteur(uuid), public.commande_transport(uuid), public.admin_transporteurs(),
  public.admin_transporteur_creer(text, text, text, text, numeric, text[]), public.admin_transporteur_decider(uuid, text, text),
  public.admin_commandes(text), public.admin_affecter(uuid, uuid), public.admin_litige_trancher(uuid, text, text) to authenticated;
