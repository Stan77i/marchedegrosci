-- Schéma 100b : à la suppression du compte, la présentation et la structure sont vidées aussi (contrôle qualité ANO-015, PRO-02 b, 25/10/2026).
-- Avant : supprimer_compte vidait prénom, nom, pseudo, avatar, rôle, région et ville, mais gardait en base
-- la présentation (bio), les activités, les photos et la structure (type, nom, logo, preuves).
-- Maintenant : ces colonnes sont vidées dans la même opération. Aucune ligne n'est effacée (la ligne du profil reste,
-- avec supprime_le, pour l'historique des commandes). La « porte » du schéma 98a ne change pas :
-- supprimer_compte vérifie (rien en cours), appelle _supprimer_compte_effacer, puis vide ces colonnes.
-- Reste à faire (accord du propriétaire, car il faut effacer des fichiers) : les fichiers déjà envoyés
-- (photos, logo, preuves de structure) restent dans le stockage ; ils ne sont plus liés au profil.
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

create or replace function public.supprimer_compte()
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); m text;
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  m := public._compte_obstacles(me);
  if m is not null then raise exception '%', m; end if;
  perform public._supprimer_compte_effacer();
  update public.profils set bio = null, activites = null, photos = '{}', structure_type = null, structure_nom = null,
    structure_logo = null, structure_preuves = '{}'
  where user_id = me;
end $$;
revoke all on function public.supprimer_compte() from public, anon;
grant execute on function public.supprimer_compte() to authenticated;
