-- ═════════ Marché de Gros CI — étape 4, à coller vous-même dans Supabase (SQL Editor → New query → coller → Run) ═════════
-- Le reste de l'étape 4 (profils, avatars, profils publics) est déjà installé.
-- Cette fonction bloque la connexion d'un compte supprimé : Supabase demande que ce soit le propriétaire du projet qui la crée.
-- Tant qu'elle n'est pas lancée, le bouton « Supprimer mon compte » affiche « pas encore activé ».

create or replace function public.supprimer_compte() returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Connectez-vous d''abord.'; end if;
  update public.offres   set status = 'retiree' where user_id = me and status = 'active';
  update public.demandes set status = 'retiree' where user_id = me and status = 'active';
  insert into public.profils (user_id) values (me) on conflict (user_id) do nothing;
  update public.profils set prenom = null, nom = null, pseudo = null, avatar = null, role = null, region_slug = null, ville = null, supprime_le = now() where user_id = me;
  delete from public.secours where user_id = me;
  update auth.users set banned_until = 'infinity' where id = me;
end $$;

revoke execute on function public.supprimer_compte() from public, anon;
grant execute on function public.supprimer_compte() to authenticated;

-- nettoyage : fonctions d'essai vides créées pendant l'installation, anciennes fonctions de négociation (déjà inaccessibles)
drop function if exists public._essai_ban();
drop function if exists public._essai_tmp();
drop function if exists public.proposer_prix(text, uuid, numeric, text);
drop function if exists public.negocier(uuid, text, numeric, text);

select 'Terminé' as resultat;
