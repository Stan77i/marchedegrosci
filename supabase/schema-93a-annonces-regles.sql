-- Schéma 93a : règles des annonces sans contournement (audit du 24/10/2026, P2 n° 7, 9, 10 ; P3 n° 30 ; contradictions 2 et 15).
-- Fichier sans les mots interdits par le MCP. À appliquer avant 93b, 93c et 93d.
--  1. Réglages « annonces » (durée de vie, rappel, délai après un arrêt de négociation), modifiables seulement par l'administrateur.
--  2. Liste des villes par région (la même que app/villes.js) : une ville inconnue ou d'une autre région est refusée.
--  3. Déclencheur _annonce_regles (offres et demandes, passe avant les autres) :
--     - à la publication : produit obligatoire, ville de la liste (ou « X (près de Ville) »), prix > 0 pour une offre à prix ferme,
--       pas deux fois la même annonce en ligne, date d'expiration posée ;
--     - à la modification par le membre : produit, unité, région, ville et « ville seulement » figés pendant une négociation
--       ouverte ou un accord qui attend sa commande ; quantité vide refusée sur une offre ; une quantité plus haute que celle du
--       serveur n'est acceptée que si le téléphone a vu la quantité actuelle (colonne quantite_vue) : fin du « 160 sacs vendus pour 100 » ;
--       quantité 0 sur une offre en ligne : l'offre sort du marché (épuisée) ;
--     - remise en ligne : nouvelle date d'expiration.
--  4. annonce_maj_le : ne bouge pas pour les écritures techniques de la tâche d'expiration (mdg.systeme = 1).
--  5. Les membres ne peuvent plus effacer une annonce (décision 37 : retirer cache sans effacer). L'administration le peut encore.

-- ───────── 1. Colonnes et réglages
alter table public.offres add column if not exists expire_le timestamptz;
alter table public.offres add column if not exists expiree_le timestamptz;
alter table public.offres add column if not exists quantite_vue numeric;
alter table public.demandes add column if not exists expire_le timestamptz;
alter table public.demandes add column if not exists expiree_le timestamptz;
alter table public.demandes add column if not exists quantite_vue numeric;
-- le téléphone envoie la quantité du serveur qu'il a vue (droit de colonne) ; expire_le et expiree_le restent au serveur
grant update (quantite_vue) on public.offres to authenticated;
grant update (quantite_vue) on public.demandes to authenticated;

insert into public.reglages (cle, valeur, maj_le)
values ('annonces', jsonb_build_object('duree_jours', 30, 'rappel_jours', 3, 'grace_jours', 7, 'nego_arret_heures', 24, 'lot', 500,
  'debut', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')), now())
on conflict (cle) do nothing;

create or replace function public._ann_regle(p_cle text, p_def numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (valeur ->> p_cle)::numeric from public.reglages where cle = 'annonces'), p_def);
$$;

-- fin de vie d'une annonce : la date posée, sinon (annonces d'avant ce schéma) 30 jours après la publication,
-- jamais avant « début + délai de grâce » (le temps de prévenir les vendeurs)
create or replace function public._ann_fin(p_expire timestamptz, p_cree timestamptz)
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(p_expire, greatest(coalesce(p_cree, now()) + make_interval(days => public._ann_regle('duree_jours', 30)::int),
    coalesce((select (valeur ->> 'debut')::timestamptz from public.reglages where cle = 'annonces'), now())
      + make_interval(days => public._ann_regle('grace_jours', 7)::int)));
$$;

create or replace function public.admin_annonces_regler(p_valeurs jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare k text; v jsonb; cur jsonb; lim numeric[];
begin
  if not public.est_admin() then raise exception 'Réservé à l''administration.'; end if;
  select valeur into cur from public.reglages where cle = 'annonces' for update;
  for k, v in select * from jsonb_each(coalesce(p_valeurs, '{}'::jsonb)) loop
    lim := case k when 'duree_jours' then array[7, 365] when 'rappel_jours' then array[0, 30] when 'grace_jours' then array[0, 60]
      when 'nego_arret_heures' then array[0, 168] when 'lot' then array[50, 5000] end;
    if lim is null then raise exception 'Réglage inconnu : %', k; end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> floor((v #>> '{}')::numeric)
       or (v #>> '{}')::numeric < lim[1] or (v #>> '{}')::numeric > lim[2] then
      raise exception 'Valeur incorrecte pour % (de % à %)', k, lim[1], lim[2];
    end if;
    cur := jsonb_set(cur, array[k], v);
  end loop;
  update public.reglages set valeur = cur, maj_le = now(), maj_par = auth.uid() where cle = 'annonces';
  return cur::json;
end $$;
revoke all on function public.admin_annonces_regler(jsonb) from public, anon;
grant execute on function public.admin_annonces_regler(jsonb) to authenticated;

-- durée de vie lisible par l'application (bouton « Prolonger 30 jours »)
create or replace function public.annonces_duree_jours()
returns integer language sql stable security definer set search_path = public as $$
  select public._ann_regle('duree_jours', 30)::int;
$$;
grant execute on function public.annonces_duree_jours() to anon, authenticated;

-- ───────── 2. Villes de chaque région (copie de app/villes.js ; une seule ville pour Abidjan)
create table if not exists public.villes_ref (
  region_slug text not null,
  nom text not null,
  cle text not null,
  primary key (region_slug, cle)
);
alter table public.villes_ref enable row level security;
insert into public.villes_ref (region_slug, nom, cle)
select r, n, public._ville_cle(n) from (values
  ('abidjan', 'Abidjan'),
  ('yamoussoukro', 'Yamoussoukro'), ('yamoussoukro', 'Attiégouakro'), ('yamoussoukro', 'Kossou'),
  ('bas-sassandra', 'San-Pédro'), ('bas-sassandra', 'Buyo'), ('bas-sassandra', 'Fresco'), ('bas-sassandra', 'Grand-Béréby'),
  ('bas-sassandra', 'Guéyo'), ('bas-sassandra', 'Méagui'), ('bas-sassandra', 'Sassandra'), ('bas-sassandra', 'Soubré'), ('bas-sassandra', 'Tabou'),
  ('comoe', 'Abengourou'), ('comoe', 'Aboisso'), ('comoe', 'Adiaké'), ('comoe', 'Agnibilékrou'), ('comoe', 'Ayamé'), ('comoe', 'Bettié'),
  ('comoe', 'Bonoua'), ('comoe', 'Grand-Bassam'), ('comoe', 'Maféré'), ('comoe', 'Tiapoum'),
  ('denguele', 'Odienné'), ('denguele', 'Gbéléban'), ('denguele', 'Kaniasso'), ('denguele', 'Madinani'), ('denguele', 'Minignan'),
  ('denguele', 'Samatiguila'), ('denguele', 'Séguélon'),
  ('goh-djiboua', 'Gagnoa'), ('goh-djiboua', 'Divo'), ('goh-djiboua', 'Guitry'), ('goh-djiboua', 'Hiré'), ('goh-djiboua', 'Lakota'), ('goh-djiboua', 'Oumé'),
  ('lacs', 'Dimbokro'), ('lacs', 'Arrah'), ('lacs', 'Bocanda'), ('lacs', 'Bongouanou'), ('lacs', 'Daoukro'), ('lacs', 'Didiévi'), ('lacs', 'Djékanou'),
  ('lacs', 'Kouassi-Kouassikro'), ('lacs', 'M’Bahiakro'), ('lacs', 'M’Batto'), ('lacs', 'Prikro'), ('lacs', 'Tiébissou'), ('lacs', 'Toumodi'),
  ('lagunes', 'Dabou'), ('lagunes', 'Adzopé'), ('lagunes', 'Agboville'), ('lagunes', 'Akoupé'), ('lagunes', 'Alépé'), ('lagunes', 'Grand-Lahou'),
  ('lagunes', 'Jacqueville'), ('lagunes', 'N’Douci'), ('lagunes', 'Sikensi'), ('lagunes', 'Taabo'), ('lagunes', 'Tiassalé'), ('lagunes', 'Yakassé-Attobrou'),
  ('montagnes', 'Man'), ('montagnes', 'Bangolo'), ('montagnes', 'Biankouma'), ('montagnes', 'Bloléquin'), ('montagnes', 'Danané'), ('montagnes', 'Duékoué'),
  ('montagnes', 'Facobly'), ('montagnes', 'Guiglo'), ('montagnes', 'Kouibly'), ('montagnes', 'Sipilou'), ('montagnes', 'Taï'), ('montagnes', 'Toulépleu'),
  ('montagnes', 'Zouan-Hounien'),
  ('sassandra-marahoue', 'Daloa'), ('sassandra-marahoue', 'Bonon'), ('sassandra-marahoue', 'Bouaflé'), ('sassandra-marahoue', 'Gohitafla'),
  ('sassandra-marahoue', 'Issia'), ('sassandra-marahoue', 'Sinfra'), ('sassandra-marahoue', 'Vavoua'), ('sassandra-marahoue', 'Zoukougbeu'),
  ('sassandra-marahoue', 'Zuénoula'),
  ('savanes', 'Korhogo'), ('savanes', 'Boundiali'), ('savanes', 'Diawala'), ('savanes', 'Dikodougou'), ('savanes', 'Ferkessédougou'), ('savanes', 'Kong'),
  ('savanes', 'Kouto'), ('savanes', 'M’Bengué'), ('savanes', 'Ouangolodougou'), ('savanes', 'Sinématiali'), ('savanes', 'Tengréla'),
  ('vallee-du-bandama', 'Bouaké'), ('vallee-du-bandama', 'Béoumi'), ('vallee-du-bandama', 'Botro'), ('vallee-du-bandama', 'Brobo'),
  ('vallee-du-bandama', 'Dabakala'), ('vallee-du-bandama', 'Djébonoua'), ('vallee-du-bandama', 'Fronan'), ('vallee-du-bandama', 'Katiola'),
  ('vallee-du-bandama', 'Niakaramandougou'), ('vallee-du-bandama', 'Sakassou'), ('vallee-du-bandama', 'Tafiré'),
  ('woroba', 'Séguéla'), ('woroba', 'Dianra'), ('woroba', 'Kani'), ('woroba', 'Koro'), ('woroba', 'Kounahiri'), ('woroba', 'Mankono'),
  ('woroba', 'Massala'), ('woroba', 'Ouaninou'), ('woroba', 'Touba'),
  ('zanzan', 'Bondoukou'), ('zanzan', 'Bouna'), ('zanzan', 'Doropo'), ('zanzan', 'Koun-Fao'), ('zanzan', 'Kouassi-Datékro'), ('zanzan', 'Nassian'),
  ('zanzan', 'Sandégué'), ('zanzan', 'Tanda'), ('zanzan', 'Téhini'), ('zanzan', 'Transua')
) v(r, n)
on conflict (region_slug, cle) do nothing;

-- la ville d'une annonce : vide (permis), une ville de la région, ou « Localité (près de Ville) » avec Ville dans la région
create or replace function public._ann_ville_ok(p_region text, p_city text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when public._ville_cle(p_city) = '' then true
    else exists (select 1 from public.villes_ref v where v.region_slug = p_region and v.cle = public._ville_cle(public._ville_ref(p_city))) end;
$$;

-- ───────── 3. Le déclencheur des règles
create or replace function public._annonce_regles()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); offre boolean := tg_table_name = 'offres'; c text; existe boolean := false; membre boolean; dup boolean;
  -- champs propres à une table (prix, budget, besoin) lus par le JSON de la ligne : le même code sert aux deux tables
  prix numeric := (to_jsonb(new) ->> case when tg_table_name = 'offres' then 'price' else 'budget' end)::numeric;
  bes text := to_jsonb(new) ->> 'besoin_id';
  duree interval := make_interval(days => public._ann_regle('duree_jours', 30)::int);
begin
  c := case when offre then 'offre' else 'demande' end;
  membre := me is not null and me = new.user_id and pg_trigger_depth() = 1 and not public.est_admin_id(me)
    and coalesce(current_setting('mdg.stock_rendu', true), '') <> '1' and coalesce(current_setting('mdg.fiab_rendre', true), '') <> '1';

  if tg_op = 'INSERT' then
    execute format('select exists (select 1 from public.%I where user_id = $1 and client_id = $2)', tg_table_name)
      into existe using new.user_id, new.client_id;
    if existe then return new; end if;   -- renvoi d'une annonce déjà publiée (upsert) : les règles de modification s'appliquent
    new.quantite_vue := null;
    new.expiree_le := null;
    new.expire_le := now() + duree;
    if membre then
      if coalesce(btrim(new.product_slug), '') = '' then raise exception 'PRODUIT_REQUIS : choisissez le produit de l''annonce.'; end if;
      if bes is null and not public._ann_ville_ok(new.region_slug, new.city) then
        raise exception 'VILLE_INCONNUE : choisissez une ville de la liste de votre région (ou écrivez votre village et la ville la plus proche).';
      end if;
      if offre and new.negociable = false and coalesce(prix, 0) <= 0 then
        raise exception 'PRIX_REQUIS : un prix ferme doit être supérieur à 0 F.';
      end if;
      execute format('select exists (select 1 from public.%I x where x.user_id = $1 and x.status = ''active'' and x.client_id is distinct from $2
          and x.product_slug = $3 and coalesce(x.unit, '''') = coalesce($4, '''') and public._ville_cle(x.city) = public._ville_cle($5)
          and x.quantity is not distinct from $6 and %s)', tg_table_name,
          case when offre then 'x.price is not distinct from $7' else 'x.budget is not distinct from $7' end)
        into dup using new.user_id, new.client_id, new.product_slug, new.unit, new.city, new.quantity, prix;
      if dup then raise exception 'DOUBLON : cette annonce est déjà en ligne. Modifiez-la dans Mes publications.'; end if;
    end if;
    return new;
  end if;

  -- modification
  if membre then
    if new.product_slug is distinct from old.product_slug or coalesce(new.unit, '') is distinct from coalesce(old.unit, '')
       or coalesce(new.region_slug, '') is distinct from coalesce(old.region_slug, '') or public._ville_cle(new.city) is distinct from public._ville_cle(old.city)
       or coalesce(new.ville_seulement, false) is distinct from coalesce(old.ville_seulement, false) then
      if exists (select 1 from public.negociations n where n.cible = c and n.cible_id = old.id
                 and (n.statut = 'ouverte' or (n.statut = 'conclue' and not exists (select 1 from public.commandes k where k.negociation_id = n.id)))) then
        raise exception 'ANNONCE_FIGEE : une négociation ou un accord est en cours sur cette annonce. Le produit, l''unité et la ville ne changent plus. Retirez-la et publiez-en une autre.';
      end if;
      if bes is null and (coalesce(new.region_slug, '') is distinct from coalesce(old.region_slug, '')
          or public._ville_cle(new.city) is distinct from public._ville_cle(old.city))
         and not public._ann_ville_ok(new.region_slug, new.city) then
        raise exception 'VILLE_INCONNUE : choisissez une ville de la liste de votre région (ou écrivez votre village et la ville la plus proche).';
      end if;
    end if;
    if offre and new.negociable = false and coalesce(prix, 0) <= 0
       and (prix is distinct from (to_jsonb(old) ->> 'price')::numeric or new.negociable is distinct from old.negociable) then
      raise exception 'PRIX_REQUIS : un prix ferme doit être supérieur à 0 F.';
    end if;
    if new.quantity is distinct from old.quantity then
      if offre and new.quantity is null and new.status = 'active' then
        raise exception 'QUANTITE_REQUISE : indiquez la quantité disponible (0 si tout est vendu).';
      end if;
      -- le téléphone n'a pas vu la quantité actuelle du serveur (ventes conclues entre-temps) : il ne peut pas la remonter
      if new.quantity > coalesce(old.quantity, 0) and old.quantity is not null and new.quantite_vue is distinct from old.quantity then
        new.quantity := old.quantity;
      end if;
    end if;
    if offre and new.status = 'active' and old.quantity is not null and coalesce(new.quantity, 0) <= 0 then
      new.status := 'retiree';   -- stock à zéro : l'offre sort du marché (épuisée), elle reste dans Mes publications
    end if;
  end if;
  if offre and membre and new.status = 'active' and old.status <> 'active' and new.quantity is null then
    raise exception 'QUANTITE_REQUISE : indiquez la quantité disponible pour remettre cette offre en ligne.';
  end if;
  -- remise en ligne (prolongation, stock rendu, fin de pause de compte) : une nouvelle durée de vie
  if new.status = 'active' and old.status is distinct from 'active' then
    new.expire_le := now() + duree;
    new.expiree_le := null;
  end if;
  new.quantite_vue := null;
  return new;
end $$;

-- le nom commence par « aa » : il passe avant les autres déclencheurs (ordre alphabétique), donc avant le calcul du stock de départ
create or replace trigger offres_aa_regles before insert or update on public.offres
  for each row execute function public._annonce_regles();
create or replace trigger demandes_aa_regles before insert or update on public.demandes
  for each row execute function public._annonce_regles();

-- ───────── 4. Date de mise à jour : inchangée pour les écritures techniques (date d'expiration posée par lots)
create or replace function public.annonce_maj_le()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and coalesce(current_setting('mdg.systeme', true), '') = '1' then
    new.maj_le := old.maj_le;
    return new;
  end if;
  new.maj_le := clock_timestamp();
  return new;
end $$;

-- ───────── 5. Plus d'effacement direct d'une annonce par un membre : « Retirer » la cache (retiree_le), la ligne reste
alter policy "retirer ses offres" on public.offres to authenticated using (false);
alter policy "retirer ses demandes" on public.demandes to authenticated using (false);

-- verrou anti-survente aussi pour les demandes (deux vendeurs qui concluent en même temps sur la même demande)
create or replace function public._boutique_verrou_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare q numeric; u text; t text;
begin
  if new.statut = 'conclue' and old.statut is distinct from 'conclue' and coalesce(new.quantite_finale, 0) > 0 then
    if new.cible = 'offre' then
      select x.quantity, x.unit into q, u from public.offres x where x.id = new.cible_id for update;
    else
      select x.quantity, x.unit into q, u from public.demandes x where x.id = new.cible_id for update;
    end if;
    if q is not null and q < new.quantite_finale then
      t := case when q = trunc(q) then trunc(q)::text else trim(to_char(q, 'FM999999990.###')) end;
      raise exception 'STOCK_INSUFFISANT : il ne reste que % % %. Proposez une quantité plus petite.', t, coalesce(nullif(u, ''), 'unités'),
        case when new.cible = 'offre' then 'de ce produit' else 'à fournir sur cette demande' end;
    end if;
  end if;
  return new;
end $$;
