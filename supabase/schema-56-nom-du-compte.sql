-- ═════════ Marché de Gros CI — schéma 56 : une annonce porte le nom du compte, et aucun autre ═════════
-- Demandé par le propriétaire le 22/10/2026 : « si c'est Lévi, c'est Lévi qui reste ; si c'est Stan, c'est Stan. Impossible de mettre un autre nom. »
-- Avant : le formulaire laissait écrire n'importe quel nom (« Coopérative gg », « Levi 02 »…), enregistré tel quel dans seller_name / buyer_name.
-- Maintenant le serveur impose le nom public du compte (nom_public : pseudo, ou prénom + initiale / nom selon le réglage),
-- à chaque écriture ; le compte administrateur reste « Marché de Gros » (schéma annonce_officielle, inchangé).
-- Le mode « Pour un producteur » (agent terrain) reste possible, mais au nom du compte, lui aussi.
-- Si la personne change son nom dans son profil, ses annonces suivent.
-- Appliqué par Claude avec l'outil Supabase. Aucun drop, aucune ligne supprimée : les noms existants sont remplacés par le nom du compte.

create or replace function public.annonce_nom_compte() returns trigger
language plpgsql security definer set search_path = public as $$
declare n text;
begin
  if public.est_admin_id(new.user_id) then return new; end if;
  n := coalesce(public.nom_public(new.user_id), 'Membre');
  if tg_table_name = 'offres' then
    new.seller_name := n;
    new.agent := case when coalesce(new.agent, '') <> '' then n end;
  else
    new.buyer_name := n;
  end if;
  return new;
end $$;
revoke all on function public.annonce_nom_compte() from public, anon, authenticated;
create or replace trigger offres_nom_compte before insert or update on public.offres for each row execute function public.annonce_nom_compte();
create or replace trigger demandes_nom_compte before insert or update on public.demandes for each row execute function public.annonce_nom_compte();

-- le nom change dans le profil : les annonces de la personne suivent
create or replace function public.profil_nom_annonces() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.offres set seller_name = seller_name where user_id = new.user_id;
  update public.demandes set buyer_name = buyer_name where user_id = new.user_id;
  return new;
end $$;
revoke all on function public.profil_nom_annonces() from public, anon, authenticated;
create or replace trigger profils_nom_annonces after update of pseudo, prenom, nom, nom_public, supprime_le on public.profils
  for each row when (old.pseudo is distinct from new.pseudo or old.prenom is distinct from new.prenom or old.nom is distinct from new.nom
                     or old.nom_public is distinct from new.nom_public or old.supprime_le is distinct from new.supprime_le)
  execute function public.profil_nom_annonces();

-- les annonces déjà publiées prennent le nom du compte
update public.offres set seller_name = seller_name where not public.est_admin_id(user_id);
update public.demandes set buyer_name = buyer_name where not public.est_admin_id(user_id);
