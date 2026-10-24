-- Schéma 86 : boutiques des vendeurs (chantier 4, décisions 34 à 44 du 24/10/2026).
-- Appliqué d'abord sur le projet de TEST (yowdymdnoiubatxlwhfv). Production : seulement avec l'accord du propriétaire.
-- Rien n'est effacé : colonnes ajoutées « if not exists », fonctions « create or replace ».
-- Ne touche ni nego_agir, ni stock_apres_accord, ni les tables et fonctions des chantiers fiabilité (84), badges (85) et ville seulement (87).

-- ——— 1. Colonnes des annonces ———
-- retiree_le : « Retirer » cache l'annonce et garde une trace (plus d'effacement, décision 37).
-- pause_le : « Indisponible pour l'instant » ; l'annonce reste active, les négociations ouvertes continuent (décision 38).
-- quantite_depart : la quantité de départ, pour l'état « stock faible » (20 % ou moins, décision 36).
--   Annonces déjà publiées : pas de mise à jour en masse ; tant qu'elle est vide, le départ = ce qui reste + ce qui a été vendu.
alter table public.offres add column if not exists retiree_le timestamptz;
alter table public.offres add column if not exists pause_le timestamptz;
alter table public.offres add column if not exists quantite_depart numeric;
alter table public.demandes add column if not exists retiree_le timestamptz;

-- ——— 2. Tables (RLS, aucun droit direct : tout passe par les fonctions) ———
create table if not exists public.boutiques (
  user_id uuid primary key,
  code text not null unique check (code ~ '^[a-z0-9]{6,12}$'),
  active boolean not null default false,
  active_le timestamptz,
  fermee_le timestamptz,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
alter table public.boutiques enable row level security;
revoke all on public.boutiques from anon, authenticated;

-- passages comptés une fois par visiteur et par jour (empreinte du jour, jamais l'adresse IP ni la personne)
create table if not exists public.boutique_passages (
  jour date not null,
  empreinte text not null,
  code text not null,
  evenement text not null check (evenement in ('vue', 'produit', 'partage', 'lien', 'qr')),
  marque text not null default '',
  primary key (jour, empreinte, code, evenement, marque)
);
create index if not exists boutique_passages_code on public.boutique_passages (code, evenement, jour);
alter table public.boutique_passages enable row level security;
revoke all on public.boutique_passages from anon, authenticated;

-- un sel tiré au hasard chaque jour : l'empreinte d'un visiteur change chaque jour et ne se recalcule pas depuis une adresse IP
create table if not exists public.boutique_sels (
  jour date primary key,
  sel text not null
);
alter table public.boutique_sels enable row level security;
revoke all on public.boutique_sels from anon, authenticated;

-- ——— 3. Outils internes ———
create or replace function public._boutique_code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare a text := 'abcdefghjkmnpqrstuvwxyz23456789'; c text; b bytea; i int; essai int := 0;
begin
  loop
    b := decode(md5(gen_random_uuid()::text || clock_timestamp()::text), 'hex'); c := '';
    for i in 0..7 loop c := c || substr(a, 1 + (get_byte(b, i) % 31), 1); end loop;
    exit when not exists (select 1 from public.boutiques x where x.code = c)
          and not exists (select 1 from public.profils p where lower(p.pseudo) = c);
    essai := essai + 1; if essai > 20 then raise exception 'Code de boutique impossible pour l''instant. Réessayez.'; end if;
  end loop;
  return c;
end $$;

-- le nom montré : le pseudo, sinon le prénom et l'initiale du nom ; jamais le nom complet ni le numéro
create or replace function public._boutique_nom(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when public.est_admin_id(p_uid) then 'Marché de Gros' else (
    select case when p.supprime_le is not null then null
                when nullif(btrim(p.pseudo), '') is not null then btrim(p.pseudo)
                when nullif(btrim(p.prenom), '') is not null and btrim(p.prenom) !~ '[0-9]' then
                  left(split_part(btrim(p.prenom), ' ', 1), 24)
                  || coalesce(' ' || upper(left(nullif(regexp_replace(btrim(p.nom), '[^[:alpha:]]', '', 'g'), ''), 1)) || '.', '')
           end
    from public.profils p where p.user_id = p_uid) end;
$$;

-- une boutique est cachée si le compte est banni, supprimé ou suspendu (est_suspendu du chantier fiabilité, lu s'il existe)
create or replace function public._boutique_cachee(p_uid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare s boolean := false;
begin
  if p_uid is null or public.est_banni(p_uid) then return true; end if;
  if exists (select 1 from public.profils p where p.user_id = p_uid and p.supprime_le is not null) then return true; end if;
  if to_regprocedure('public.est_suspendu(uuid)') is not null then
    begin execute 'select public.est_suspendu($1)' into s using p_uid; exception when others then s := false; end;
  end if;
  return coalesce(s, false);
end $$;

-- l'adresse : le pseudo s'il existe, sinon le code court (le code reste toujours valable)
create or replace function public._boutique_adresse(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nullif(btrim(p.pseudo), '') from public.profils p where p.user_id = p_uid), (select b.code from public.boutiques b where b.user_id = p_uid));
$$;

create or replace function public._boutique_trouver(p_adresse text) returns uuid
language sql stable security definer set search_path = public as $$
  with a as (select lower(btrim(coalesce(p_adresse, ''))) v)
  select x.user_id from (
    select b.user_id, 1 r from public.boutiques b join public.profils p on p.user_id = b.user_id, a where b.active and lower(p.pseudo) = a.v
    union all
    select b.user_id, 2 from public.boutiques b, a where b.active and b.code = a.v
  ) x where not public._boutique_cachee(x.user_id) order by x.r limit 1;
$$;

-- l'état d'une annonce dans la boutique
create or replace function public._boutique_etat(o public.offres) returns text
language sql stable security definer set search_path = public as $$
  select case when o.status = 'active' and o.pause_le is not null then 'pause'
              when o.status <> 'active' or coalesce(o.quantity, 0) <= 0 then 'epuise'
              when o.quantity <= 0.2 * coalesce(o.quantite_depart, o.quantity + coalesce((select sum(n.quantite_finale) from public.negociations n
                     where n.cible = 'offre' and n.cible_id = o.id and n.statut = 'conclue' and coalesce(n.quantite_finale, 0) > 0), 0)) then 'stock_faible'
              else 'disponible' end;
$$;

-- ——— 4. Les annonces : quantité obligatoire, quantité de départ, retrait avec trace ———
create or replace function public._boutique_annonce() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if coalesce(new.quantity, 0) <= 0 and not public.est_admin_id(new.user_id)
       and not exists (select 1 from public.offres x where x.user_id = new.user_id and x.client_id = new.client_id) then
      raise exception 'QUANTITE_REQUISE : indiquez la quantité disponible pour publier cette offre.';
    end if;
    new.quantite_depart := case when new.quantity > 0 then new.quantity end;
    if new.retiree_le is not null and new.status <> 'masquee' then new.status := 'retiree'; end if;
    return new;
  end if;
  -- la quantité de départ ne se règle pas à la main : seulement par les règles ci-dessous
  new.quantite_depart := old.quantite_depart;
  if new.quantity is distinct from old.quantity and coalesce(new.quantity, 0) > 0 then
    if current_setting('mdg.stock_rendu', true) = '1' or pg_trigger_depth() > 1 then
      new.quantite_depart := greatest(coalesce(old.quantite_depart, old.quantity, 0), new.quantity);   -- stock rendu après une annulation
    elsif auth.uid() = new.user_id and new.quantity > coalesce(old.quantity, 0) then
      new.quantite_depart := new.quantity;                                                            -- le vendeur remet du stock : nouveau départ
    elsif old.quantite_depart is null then
      new.quantite_depart := greatest(coalesce(old.quantity, 0), new.quantity);
    end if;
  end if;
  -- retirer : l'annonce est cachée, la ligne reste (trace)
  if new.retiree_le is not null and old.retiree_le is null then
    if new.status <> 'masquee' then new.status := 'retiree'; end if;
    new.pause_le := null;
  elsif new.status = 'active' and old.status <> 'active' then
    new.retiree_le := null;
  end if;
  return new;
end $$;
create or replace trigger offres_boutique before insert or update on public.offres
  for each row execute function public._boutique_annonce();

create or replace function public._boutique_demande_retiree() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.retiree_le is not null and (tg_op = 'INSERT' or old.retiree_le is null) and new.status <> 'masquee' then new.status := 'retiree'; end if;
  if tg_op = 'UPDATE' and new.status = 'active' and old.status <> 'active' then new.retiree_le := null; end if;
  return new;
end $$;
create or replace trigger demandes_boutique before insert or update on public.demandes
  for each row execute function public._boutique_demande_retiree();

-- ——— 5. Pause : pas de nouvelle négociation ni de nouvel achat groupé sur une annonce en pause ———
create or replace function public._boutique_garde_pause() returns trigger
language plpgsql security definer set search_path = public as $$
declare o uuid;
begin
  if tg_table_name = 'negociations' then
    if new.cible = 'offre' then o := new.cible_id; end if;
  else
    o := new.offre_id;
  end if;
  if o is not null and exists (select 1 from public.offres x where x.id = o and x.pause_le is not null and x.status = 'active') then
    raise exception 'ANNONCE_EN_PAUSE : ce vendeur a mis cette offre en pause. Revenez plus tard ou regardez sa boutique.';
  end if;
  return new;
end $$;
create or replace trigger negociations_boutique_pause before insert on public.negociations
  for each row execute function public._boutique_garde_pause();
create or replace trigger groupes_achat_boutique_pause before insert on public.groupes_achat
  for each row execute function public._boutique_garde_pause();

-- ——— 6. Verrou contre la survente : deux accords en même temps sur la même offre ———
-- Avant que la négociation passe à « conclue », la ligne de l'offre est verrouillée (for update) et la quantité relue :
-- le second accord attend le premier, puis voit le stock à jour. nego_agir et stock_apres_accord ne changent pas.
create or replace function public._boutique_verrou_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare q numeric; u text; t text;
begin
  if new.statut = 'conclue' and old.statut is distinct from 'conclue' and new.cible = 'offre' and coalesce(new.quantite_finale, 0) > 0 then
    select x.quantity, x.unit into q, u from public.offres x where x.id = new.cible_id for update;
    if q is not null and q < new.quantite_finale then
      t := case when q = trunc(q) then trunc(q)::text else trim(to_char(q, 'FM999999990.###')) end;
      raise exception 'STOCK_INSUFFISANT : il ne reste que % % de ce produit. Proposez une quantité plus petite.', t, coalesce(nullif(u, ''), 'unités');
    end if;
  end if;
  return new;
end $$;
create or replace trigger negociations_verrou_stock before update of statut on public.negociations
  for each row execute function public._boutique_verrou_stock();

-- ——— 7. Pseudo : il ne peut pas prendre le code court d'une autre boutique ———
create or replace function public._boutique_pseudo_libre() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pseudo is not null and (tg_op = 'INSERT' or new.pseudo is distinct from old.pseudo)
     and exists (select 1 from public.boutiques b where b.code = lower(new.pseudo) and b.user_id <> new.user_id) then
    raise exception 'Ce pseudonyme est déjà pris. Choisissez-en un autre.';
  end if;
  return new;
end $$;
create or replace trigger profils_boutique_pseudo before insert or update of pseudo on public.profils
  for each row execute function public._boutique_pseudo_libre();

-- compte supprimé : la boutique se ferme (les annonces restent, sans nom, déjà retirées par supprimer_compte)
create or replace function public._boutique_compte_supprime() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.supprime_le is not null and old.supprime_le is null then
    update public.boutiques set active = false, fermee_le = now(), maj_le = now() where user_id = new.user_id and active;
  end if;
  return new;
end $$;
create or replace trigger profils_boutique_supprime after update of supprime_le on public.profils
  for each row execute function public._boutique_compte_supprime();

-- ——— 8. Fonctions publiques ———
-- le catalogue d'un vendeur (annonces actives, en pause, épuisées depuis moins de 30 jours ; jamais les retirées ni les masquées)
create or replace function public._boutique_catalogue(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(c order by c.rang, c.publie_le desc), '[]') from (
    select left(md5(o.id::text), 12) code, o.id, o.product_slug produit, coalesce(nullif(o.product_label, ''), o.product_slug) libelle,
           o.price prix, coalesce(nullif(o.unit, ''), 'kg') unite, greatest(coalesce(o.quantity, 0), 0) quantite, o.quantite_depart,
           nullif(o.city, '') ville, o.region_slug, o.transport, o.negociable, o.qte_min, o.created_at publie_le, o.maj_le,
           public._boutique_etat(o) etat,
           case public._boutique_etat(o) when 'disponible' then 1 when 'stock_faible' then 2 when 'pause' then 3 else 4 end rang
    from public.offres o
    where o.user_id = p_uid and o.retiree_le is null and o.status <> 'masquee'
      and (o.status = 'active'
           or (o.status = 'retiree' and coalesce(o.quantity, 0) <= 0 and o.maj_le > now() - interval '30 days'
               and exists (select 1 from public.negociations n where n.cible = 'offre' and n.cible_id = o.id and n.statut = 'conclue')))
    order by rang, publie_le desc limit 60
  ) c;
$$;

create or replace function public.boutique_publique(p_adresse text) returns json
language plpgsql stable security definer set search_path = public as $$
declare uid uuid; p public.profils; b public.boutiques; rep json; fia json; niv json; st json; ventes int;
begin
  uid := public._boutique_trouver(p_adresse);
  if uid is null then return json_build_object('trouvee', false); end if;
  select * into p from public.profils where user_id = uid;
  select * into b from public.boutiques where user_id = uid;
  begin rep := public.reputation_publique(uid); exception when others then rep := null; end;
  if to_regprocedure('public.fiabilite_publique(uuid)') is not null then
    begin execute 'select public.fiabilite_publique($1)' into fia using uid; exception when others then fia := null; end;
  end if;
  if to_regprocedure('public.niveaux_publics(uuid[])') is not null then
    begin execute 'select json_build_object(''cle'', n.vendeur, ''libelle'', n.vendeur_libelle, ''ordre'', n.vendeur_ordre) from public.niveaux_publics(array[$1]) n where n.vendeur is not null limit 1'
      into niv using uid; exception when others then niv := null; end;
  end if;
  begin
    if public._structure_verifiee(uid) then st := json_build_object('type', p.structure_type, 'nom', p.structure_nom); end if;
  exception when others then st := null; end;
  select count(*) into ventes from public.commandes k where k.vendeur_id = uid and k.etat = 'terminee';
  return json_build_object(
    'trouvee', true,
    'adresse', public._boutique_adresse(uid),
    'code', b.code,
    'nom', coalesce(public._boutique_nom(uid), 'Vendeur'),
    'officiel', public.est_admin_id(uid),
    'avatar', p.avatar,
    'ville', nullif(p.ville, ''),
    'region_slug', p.region_slug,
    'membre_depuis', date_trunc('month', coalesce((select u.created_at from auth.users u where u.id = uid), p.created_at)),
    'verifie', public.identite_ok(uid),
    'structure', st,
    'niveau', niv,
    'ventes', ventes,
    'note', rep -> 'vendeur' -> 'note',
    'avis', coalesce((rep -> 'vendeur' ->> 'avis')::int, 0),
    'fiabilite', fia,
    'moi', auth.uid() is not null and auth.uid() = uid,
    'catalogue', public._boutique_catalogue(uid));
end $$;

-- l'adresse des boutiques ouvertes, pour un lot de membres (profil, annonces, recherche)
create or replace function public.boutiques_de(ids uuid[]) returns table (user_id uuid, adresse text)
language sql stable security definer set search_path = public as $$
  select b.user_id, public._boutique_adresse(b.user_id) from public.boutiques b
  where b.active and b.user_id = any (ids[1:200]) and not public._boutique_cachee(b.user_id);
$$;

-- la liste des boutiques ouvertes (pages d'aperçu du site, fabriquées par tools/site-boutiques.js)
create or replace function public.boutiques_publiques() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(x order by x.adresse), '[]') from (
    select public._boutique_adresse(b.user_id) adresse, b.code, coalesce(public._boutique_nom(b.user_id), 'Vendeur') nom,
           nullif(p.ville, '') ville, p.region_slug,
           (select count(*) from public.offres o where o.user_id = b.user_id and o.status = 'active' and o.retiree_le is null and o.pause_le is null and coalesce(o.quantity, 0) > 0) disponibles,
           (select coalesce(json_agg(z.produit), '[]') from (select o.product_slug produit from public.offres o where o.user_id = b.user_id and o.status = 'active' and o.retiree_le is null
              group by o.product_slug order by max(o.created_at) desc limit 4) z) produits
    from public.boutiques b left join public.profils p on p.user_id = b.user_id
    where b.active and not public._boutique_cachee(b.user_id)
    limit 2000) x;
$$;

-- le vendeur : sa boutique et ses totaux de visites (jamais qui a visité)
create or replace function public.ma_boutique() returns json
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); b public.boutiques; v json;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  select * into b from public.boutiques where user_id = me;
  if b.code is not null then
    select json_build_object(
      'vues_7j', count(*) filter (where evenement = 'vue' and jour > current_date - 7),
      'vues_30j', count(*) filter (where evenement = 'vue' and jour > current_date - 30),
      'vues', count(*) filter (where evenement = 'vue'),
      'produits_30j', count(*) filter (where evenement = 'produit' and jour > current_date - 30),
      'partages', count(*) filter (where evenement in ('partage', 'lien', 'qr')))
    into v from public.boutique_passages where code = b.code;
  end if;
  return json_build_object(
    'active', coalesce(b.active, false),
    'code', b.code,
    'adresse', case when b.code is not null then public._boutique_adresse(me) end,
    'nom', coalesce(public._boutique_nom(me), 'Vendeur'),
    'pseudo', (select nullif(btrim(p.pseudo), '') from public.profils p where p.user_id = me),
    'cachee', public._boutique_cachee(me),
    'disponibles', (select count(*) from public.offres o where o.user_id = me and o.status = 'active' and o.retiree_le is null and o.pause_le is null and coalesce(o.quantity, 0) > 0),
    'en_pause', (select count(*) from public.offres o where o.user_id = me and o.status = 'active' and o.pause_le is not null),
    'visites', coalesce(v, json_build_object('vues_7j', 0, 'vues_30j', 0, 'vues', 0, 'produits_30j', 0, 'partages', 0)));
end $$;

-- ouvrir ou fermer sa boutique, d'un geste
create or replace function public.boutique_activer(p_oui boolean) returns json
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if exists (select 1 from public.profils p where p.user_id = me and p.supprime_le is not null) then raise exception 'Ce compte est supprimé.'; end if;
  if coalesce(p_oui, false) then
    insert into public.boutiques (user_id, code, active, active_le) values (me, public._boutique_code(), true, now())
    on conflict (user_id) do update set active = true, active_le = now(), maj_le = now();
  else
    update public.boutiques set active = false, fermee_le = now(), maj_le = now() where user_id = me;
  end if;
  return public.ma_boutique();
end $$;

-- mesure d'une boutique : comptée une fois par visiteur et par jour (vue, produit) ; partages : une fois par minute ; 40 au plus par visiteur et par jour.
-- Ni l'adresse IP ni la personne ne sont gardées : une empreinte salée qui change chaque jour. Le vendeur qui regarde sa boutique ne compte pas.
-- Appelle aussi mesurer() (schéma 81) pour les totaux du site.
create or replace function public.boutique_mesurer(p_adresse text, p_evenement text, p_source text default null, p_support text default null, p_offre text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid; c text; h json; ip text; s text; emp text; j date := (now() at time zone 'Africa/Abidjan')::date; m text := ''; n int;
begin
  if p_evenement is null or p_evenement not in ('vue', 'produit', 'partage', 'lien', 'qr') then return; end if;
  uid := public._boutique_trouver(p_adresse); if uid is null then return; end if;
  if public.est_admin() then return; end if;
  if p_evenement in ('vue', 'produit') and auth.uid() = uid then return; end if;
  if p_evenement in ('partage', 'lien', 'qr') and (auth.uid() is null or auth.uid() <> uid) then return; end if;
  select b.code into c from public.boutiques b where b.user_id = uid;
  begin h := nullif(current_setting('request.headers', true), '')::json; exception when others then h := null; end;
  ip := coalesce(h ->> 'cf-connecting-ip', nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''), h ->> 'x-real-ip', 'inconnu');
  insert into public.boutique_sels (jour, sel) values (j, md5(gen_random_uuid()::text || gen_random_uuid()::text)) on conflict (jour) do nothing;
  select x.sel into s from public.boutique_sels x where x.jour = j;
  emp := md5(s || '|' || coalesce(auth.uid()::text, ip));
  select count(*) into n from public.boutique_passages where jour = j and empreinte = emp;
  if n >= 40 then return; end if;
  if p_evenement = 'produit' then m := left(regexp_replace(lower(coalesce(p_offre, '')), '[^a-f0-9]', '', 'g'), 12);
  elsif p_evenement in ('partage', 'lien', 'qr') then m := to_char(now(), 'HH24MI'); end if;
  insert into public.boutique_passages (jour, empreinte, code, evenement, marque) values (j, emp, c, p_evenement, m) on conflict do nothing;
  if not found then return; end if;
  perform public.mesurer(case when p_evenement = 'vue' then 'vue' else 'clic' end,
    'app/boutique' || case when p_evenement = 'vue' then '' else '/' || p_evenement end, c, p_source, p_support, null, null);
end $$;

-- ——— 9. Droits ———
revoke execute on function public._boutique_code() from public, anon, authenticated;
revoke execute on function public._boutique_nom(uuid) from public, anon, authenticated;
revoke execute on function public._boutique_cachee(uuid) from public, anon, authenticated;
revoke execute on function public._boutique_adresse(uuid) from public, anon, authenticated;
revoke execute on function public._boutique_trouver(text) from public, anon, authenticated;
revoke execute on function public._boutique_etat(public.offres) from public, anon, authenticated;
revoke execute on function public._boutique_catalogue(uuid) from public, anon, authenticated;
revoke execute on function public._boutique_annonce() from public, anon, authenticated;
revoke execute on function public._boutique_demande_retiree() from public, anon, authenticated;
revoke execute on function public._boutique_garde_pause() from public, anon, authenticated;
revoke execute on function public._boutique_verrou_stock() from public, anon, authenticated;
revoke execute on function public._boutique_pseudo_libre() from public, anon, authenticated;
revoke execute on function public._boutique_compte_supprime() from public, anon, authenticated;
revoke execute on function public.ma_boutique() from public, anon;
revoke execute on function public.boutique_activer(boolean) from public, anon;
grant execute on function public.ma_boutique() to authenticated;
grant execute on function public.boutique_activer(boolean) to authenticated;
grant execute on function public.boutique_publique(text) to anon, authenticated;
grant execute on function public.boutiques_de(uuid[]) to anon, authenticated;
grant execute on function public.boutiques_publiques() to anon, authenticated;
grant execute on function public.boutique_mesurer(text, text, text, text, text) to anon, authenticated;
