-- ═════════ Marché de Gros CI — schéma 17 : statuts publics des comptes (18 octobre 2026) ═════════
-- Peut être relancé sans danger. (Déjà appliqué sur le projet mgci le 18 octobre 2026.)
--
-- Une seule fonction, lisible sans compte, qui donne pour chaque membre affiché des CHIFFRES (jamais de données privées) ;
-- l'application en déduit les statuts (v3/statuts.js) :
--   • Identité vérifiée   : public.identite_ok (pièce valide, décision d'un administrateur)
--   • Actif aujourd'hui / cette semaine : dernière annonce, dernier message de négociation ou de discussion
--   • Vendeur de confiance : au moins 3 ventes conclues, et une note d'au moins 4,2 sur 5 s'il a au moins 3 avis
--   • Acheteur sérieux     : au moins 3 achats conclus, et une note d'au moins 4 sur 5 s'il a au moins 3 avis
--   • Répond vite          : au moins 3 personnes l'ont contacté (négociation) et il a répondu en moins de 24 h à 80 % d'entre elles
--   • Nouveau membre       : inscrit depuis moins de 30 jours
-- Vente / achat : sur une OFFRE, le propriétaire vend et l'autre achète ; sur une DEMANDE, c'est l'inverse.
-- Un compte banni ou supprimé n'a aucun statut.

create or replace function public.statuts_publics(ids uuid[])
returns table (user_id uuid, verifie boolean, actif_le timestamptz, ventes int, achats int, note numeric, avis int,
               contacts int, reponses_24h int, membre_depuis timestamptz)
language sql stable security definer set search_path = public as $f$
  with u as (
    select x.id from unnest(ids[1:200]) as x(id)
    where not exists (select 1 from public.bannis b where b.user_id = x.id)
      and not exists (select 1 from public.profils p where p.user_id = x.id and p.supprime_le is not null)
  ),
  conclues as (
    select n.proprio_id, n.auteur_id, n.cible from public.negociations n
    where n.statut = 'conclue' and (n.proprio_id in (select id from u) or n.auteur_id in (select id from u))
  )
  select u.id,
    public.identite_ok(u.id),
    greatest(
      (select max(o.created_at) from public.offres o where o.user_id = u.id),
      (select max(d.created_at) from public.demandes d where d.user_id = u.id),
      (select max(m.created_at) from public.messages m where m.auteur_id = u.id),
      (select max(s.updated_at) from public.discussions s where s.dernier_par = u.id)),
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.proprio_id = u.id) or (c.cible like 'demande%' and c.auteur_id = u.id)),
    (select count(*)::int from conclues c where (c.cible like 'offre%' and c.auteur_id = u.id) or (c.cible like 'demande%' and c.proprio_id = u.id)),
    (select round(avg(a.note)::numeric, 1) from public.avis a where a.cible_id = u.id),
    (select count(*)::int from public.avis a where a.cible_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id),
    (select count(*)::int from public.negociations n where n.proprio_id = u.id
       and exists (select 1 from public.messages m where m.negociation_id = n.id and m.auteur_id = u.id and m.created_at < n.created_at + interval '24 hours')),
    coalesce((select p.created_at from public.profils p where p.user_id = u.id), (select au.created_at from auth.users au where au.id = u.id))
  from u;
$f$;
revoke execute on function public.statuts_publics(uuid[]) from public;
grant execute on function public.statuts_publics(uuid[]) to anon, authenticated;

create index if not exists negociations_proprio on public.negociations (proprio_id);
create index if not exists negociations_auteur on public.negociations (auteur_id);
create index if not exists messages_auteur on public.messages (auteur_id, created_at desc);
