-- ═════════ Marché de Gros CI — schéma 48 : transport inclus ou non, et lien de suivi pour son propre chauffeur ═════════
-- Demandé par le propriétaire le 22/10/2026. Appliqué par Claude avec l'outil Supabase. Aucune donnée effacée, aucun drop.
--
-- Règle du marché (comme à Abidjan) :
--   • entre deux villes, le vendeur livre : le transport est compris dans son prix ;
--   • dans la même ville, l'acheteur vient chercher (ou fait livrer à sa charge).
-- À la publication :
--   • offre   : transport = 'inclus' (partout) · 'hors_ville' (inclus hors de la ville du vendeur, règle du marché) · 'non' (à la charge de l'acheteur) ;
--   • demande : transport = 'vendeur' (je veux que le vendeur livre) · 'acheteur' (je peux prendre le transport).
-- À la commande : quand le transport est inclus chez le vendeur, le Marché de Gros ne propose pas de transporteur du réseau ;
--   c'est le vendeur qui transporte (commande_creer le refuse sinon).
-- Lien de suivi : celui qui s'occupe du transport (vendeur ou acheteur) crée un lien et le donne à SON chauffeur.
--   Le chauffeur l'ouvre, sans compte, et sa position s'affiche dans le suivi de la commande (table positions, schéma 29).
--   Le lien ne donne accès qu'au produit, à la quantité et aux villes ; ni nom, ni numéro. Il expire à la fin de la commande, au plus 10 jours.

-- ——— 1) Publication ———
alter table public.offres add column if not exists transport text;
alter table public.demandes add column if not exists transport text;
do $$ begin
  alter table public.offres add constraint offres_transport_check check (transport is null or transport in ('inclus', 'hors_ville', 'non'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.demandes add constraint demandes_transport_check check (transport is null or transport in ('vendeur', 'acheteur'));
exception when duplicate_object then null; end $$;

-- ——— 2) Commande : pas de transporteur du réseau quand le vendeur a inclus le transport ———
create or replace function public._transport_vendeur(p_cible text, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when p_cible = 'offre' then exists (select 1 from public.offres where id = p_id and transport = 'inclus')
              else exists (select 1 from public.demandes where id = p_id and transport = 'vendeur') end
$$;
revoke execute on function public._transport_vendeur(text, uuid) from public, anon, authenticated;
do $$ declare d text; begin
  d := pg_get_functiondef('public.commande_creer(uuid,text,text,text)'::regprocedure);
  if position('_transport_vendeur' in d) > 0 then return; end if;
  d := replace(d, $q$  if val not in ('declaration', 'code') then raise exception 'Mode de validation inconnu.'; end if;$q$,
    $q$  if val not in ('declaration', 'code') then raise exception 'Mode de validation inconnu.'; end if;
  if p_mode <> 'vendeur' and public._transport_vendeur(n.cible, n.cible_id) then
    raise exception 'Le transport est inclus dans le prix du vendeur : c''est lui qui transporte.';
  end if;$q$);
  if position('_transport_vendeur' in d) = 0 then raise exception 'commande_creer : motif introuvable'; end if;
  execute d;
end $$;

-- ——— 3) Liens de suivi ———
create table if not exists public.suivi_liens (
  jeton       text primary key,
  commande_id uuid not null references public.commandes (id) on delete cascade,
  cree_par    uuid not null,
  created_at  timestamptz not null default now(),
  expire_le   timestamptz not null default now() + interval '10 days',
  vu_le       timestamptz,
  actif       boolean not null default true
);
create index if not exists suivi_liens_cmd on public.suivi_liens (commande_id);
alter table public.suivi_liens enable row level security;
revoke all on public.suivi_liens from anon, authenticated;

-- créer (ou retrouver) le lien : seulement la partie qui s'occupe du transport
create or replace function public.suivi_lien_creer(p_cmd uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; r text; j text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into c from public.commandes where id = p_cmd;
  r := case when c.id is null then null else public._cmd_role2(c, me) end;
  if r is null or r not in ('vendeur', 'acheteur') then raise exception 'Commande introuvable.'; end if;
  if c.mode_transport = 'reseau' then raise exception 'Un transporteur du réseau suit la commande depuis son Espace chauffeur.'; end if;
  if c.mode_transport <> r then raise exception 'C''est % qui s''occupe du transport : c''est lui qui crée le lien.', case c.mode_transport when 'vendeur' then 'le vendeur' else 'l''acheteur' end; end if;
  if c.etat not in ('a_confirmer', 'en_cours') then raise exception 'La commande n''est plus en cours.'; end if;
  select jeton into j from public.suivi_liens where commande_id = c.id and actif and expire_le > now() order by created_at desc limit 1;
  if j is not null then return j; end if;
  j := replace(gen_random_uuid()::text, '-', '');
  insert into public.suivi_liens (jeton, commande_id, cree_par) values (j, c.id, me);
  return j;
end $$;

-- état du lien, pour les deux parties : le chauffeur a-t-il ouvert le lien ? (le jeton seulement pour la partie qui transporte)
create or replace function public.suivi_lien_etat(p_cmd uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when c.id is null or public._cmd_role2(c, auth.uid()) not in ('vendeur', 'acheteur') then null else
    (select json_build_object('existe', true, 'vu_le', l.vu_le, 'created_at', l.created_at,
       'jeton', case when c.mode_transport = public._cmd_role2(c, auth.uid()) then l.jeton end)
     from public.suivi_liens l where l.commande_id = c.id and l.actif and l.expire_le > now() order by l.created_at desc limit 1) end
  from (select 1) z left join public.commandes c on c.id = p_cmd;
$$;

-- ce que voit le chauffeur qui ouvre le lien : produit, quantité, villes, étape (ni nom ni numéro)
create or replace function public.suivi_lien_infos(p_jeton text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('numero', c.numero, 'produit', c.produit, 'quantite', c.quantite, 'unite', c.unite,
    'depart', c.ville_depart, 'arrivee', c.lieu_livraison, 'etat', c.etat, 'etape', c.etape)
  from public.suivi_liens l join public.commandes c on c.id = l.commande_id
  where l.jeton = p_jeton and l.actif and l.expire_le > now();
$$;

-- le chauffeur envoie sa position (une toutes les 15 s au plus), tant que la commande est en cours
create or replace function public.suivi_lien_position(p_jeton text, p_lat double precision, p_lon double precision, p_precision real default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare l public.suivi_liens; c public.commandes; der timestamptz;
begin
  select * into l from public.suivi_liens where jeton = p_jeton;
  if l.jeton is null or not l.actif or l.expire_le <= now() then
    return json_build_object('ok', false, 'arreter', true, 'message', 'Ce lien n''est plus valable.'); end if;
  select * into c from public.commandes where id = l.commande_id;
  if c.etat <> 'en_cours' or c.etape in ('reception', 'terminee') then
    return json_build_object('ok', false, 'arreter', true, 'message', 'La livraison est terminée : merci, le partage s''arrête.'); end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'Position invalide.'; end if;
  update public.suivi_liens set vu_le = now() where jeton = l.jeton;
  select max(at) into der from public.positions where commande_id = c.id;
  if der is not null and der > now() - interval '15 seconds' then return json_build_object('ok', false, 'arreter', false, 'message', 'trop tôt'); end if;
  insert into public.positions (commande_id, transporteur_id, lat, lon, precision_m) values (c.id, null, p_lat, p_lon, p_precision);
  return json_build_object('ok', true, 'arreter', false);
end $$;

revoke execute on function public.suivi_lien_creer(uuid), public.suivi_lien_etat(uuid) from public, anon;
grant execute on function public.suivi_lien_creer(uuid), public.suivi_lien_etat(uuid) to authenticated;
revoke execute on function public.suivi_lien_infos(text), public.suivi_lien_position(text, double precision, double precision, real) from public;
grant execute on function public.suivi_lien_infos(text), public.suivi_lien_position(text, double precision, double precision, real) to anon, authenticated;
