-- ═════════ Schéma 78 (23/10/2026) — l'heure de dernière activité n'est plus visible sans compte ═════════
-- Fuite trouvée à l'audit : profil_public (vu_le) et statuts_publics (actif_le), ouvertes à tous, donnaient à n'importe quel
-- visiteur sans compte l'heure exacte de la dernière connexion ou du dernier message d'un membre.
-- Correction : ces deux heures ne sont renvoyées qu'aux membres connectés (auth.uid() non vide) ; sans compte, elles sont vides
-- (l'application n'affiche alors simplement pas « actif il y a… »). Tout le reste est identique.
-- Non modifié volontairement : l'identifiant de l'admin (nécessaire pour écrire au Marché de Gros, et est_admin_id sert aussi
-- au filtre des textes) ; le mode « test » des notifications (n'envoie qu'au téléphone de la personne elle-même).
-- Aucun « drop » : create or replace, mêmes signatures.

create or replace function public.profil_public(p_uid uuid)
returns json
language sql stable security definer set search_path to 'public' as $function$
  select json_build_object(
    'user_id', u.id,
    'affichage', case when public.est_admin_id(u.id) then 'Marché de Gros' else coalesce(public.nom_public(u.id), 'Membre') end,
    'officiel', public.est_admin_id(u.id),
    'avatar', p.avatar, 'role', p.role, 'bio', p.bio, 'activites', p.activites, 'photos', coalesce(p.photos, '{}'),
    'region_slug', p.region_slug, 'ville', p.ville,
    'membre_depuis', u.created_at,
    -- heure de dernière activité : seulement pour les membres connectés (schéma 78)
    'vu_le', case when auth.uid() is not null then greatest(u.last_sign_in_at,
      (select max(vu_le) from public.push_abonnements pa where pa.user_id = u.id),
      (select max(created_at) from public.dm where auteur_id = u.id),
      (select max(created_at) from public.messages where auteur_id = u.id),
      (select max(created_at) from public.offres where user_id = u.id),
      (select max(created_at) from public.demandes where user_id = u.id)) end,
    'ventes', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id))),
    'achats', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.auteur_id = u.id) or (g.cible = 'demande' and g.proprio_id = u.id))),
    'transactions', (select count(*) from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id)),
    'volumes', (select coalesce(json_agg(v order by v.sens desc, v.quantite desc), '[]') from (
        select case when (g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id) then 'vente' else 'achat' end as sens,
               coalesce(g.unite, 'unité') as unite, sum(coalesce(g.quantite_finale, g.quantite)) as quantite
        from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id) and coalesce(g.quantite_finale, g.quantite) is not null
        group by 1, 2) v),
    'offres_actives', (select count(*) from public.offres where user_id = u.id and status = 'active'),
    'demandes_actives', (select count(*) from public.demandes where user_id = u.id and status = 'active'),
    'annonces_total', (select count(*) from public.offres where user_id = u.id) + (select count(*) from public.demandes where user_id = u.id),
    'lieux', (select coalesce(json_agg(distinct x.l), '[]') from (select coalesce(nullif(city, ''), region_slug) l from public.offres where user_id = u.id union select coalesce(nullif(city, ''), region_slug) from public.demandes where user_id = u.id) x where x.l is not null),
    'historique', (select coalesce(json_agg(h order by h.quand desc), '[]') from (
        select g.produit, g.quantite_finale as quantite, g.unite, g.ville, coalesce(g.conclu_le, g.updated_at) as quand,
               case when (g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id) then 'vente' else 'achat' end as sens
        from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id)
        order by coalesce(g.conclu_le, g.updated_at) desc limit 12) h))
  from auth.users u left join public.profils p on p.user_id = u.id
  where u.id = p_uid and (p.user_id is null or p.supprime_le is null);
$function$;

create or replace function public.statuts_publics(ids uuid[])
returns table(user_id uuid, verifie boolean, actif_le timestamptz, ventes integer, achats integer, note numeric, avis integer, contacts integer, reponses_24h integer, membre_depuis timestamptz)
language sql stable security definer set search_path = public as $$
  with u as (
    select x.id from unnest(ids[1:200]) as x(id)
    where not exists (select 1 from public.bannis b where b.user_id = x.id)
      and not exists (select 1 from public.profils p where p.user_id = x.id and p.supprime_le is not null)
  ),
  conclues as (
    select n.proprio_id, n.auteur_id, n.cible from public.negociations n
    where n.statut = 'conclue' and (n.proprio_id in (select id from u) or n.auteur_id in (select id from u))
  ),
  av as (select a.cible_id, a.note from public._avis_uniques() a where a.cible_id in (select id from u))
  select u.id,
    public.identite_ok(u.id),
    case when auth.uid() is not null then greatest(   -- dernière activité : seulement pour les membres connectés (schéma 78)
      (select max(o.created_at) from public.offres o where o.user_id = u.id),
      (select max(d.created_at) from public.demandes d where d.user_id = u.id),
      (select max(m.created_at) from public.messages m where m.auteur_id = u.id),
      (select max(s.updated_at) from public.discussions s where s.dernier_par = u.id)) end,
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.proprio_id = u.id) or (c.cible like 'demande%' and c.auteur_id = u.id)),
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.auteur_id = u.id) or (c.cible like 'demande%' and c.proprio_id = u.id)),
    (select round(avg(av.note)::numeric, 1) from av where av.cible_id = u.id),
    (select count(*)::int from av where av.cible_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id
       and exists (select 1 from public.messages m where m.negociation_id = n.id and m.auteur_id = u.id and m.created_at < n.created_at + interval '24 hours')),
    coalesce((select p.created_at from public.profils p where p.user_id = u.id), (select au.created_at from auth.users au where au.id = u.id))
  from u;
$$;
