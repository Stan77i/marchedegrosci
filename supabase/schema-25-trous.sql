-- ═════════ Marché de Gros CI — schéma 25 : boucher les trous de l'audit du 21 octobre 2026 ═════════
-- Appliqué par Claude avec l'outil Supabase (pas de drop : seulement create or replace, revoke, alter).
--
-- 1) Une annonce retirée remise en ligne passait sans contrôle : la limite de 30 annonces actives
--    ne regardait que les nouvelles annonces. Elle s'applique maintenant aussi à la remise en ligne.
--    (La limite de 3 annonces gratuites n'était pas contournable : un compte non vérifié n'a que ses 3 annonces.)
-- 2) Les anciennes versions de trois fonctions restaient appelables et pouvaient éviter des règles récentes
--    (pièce expirée, preuves d'un signalement). L'application n'utilise que les versions récentes :
--    les anciennes ne sont plus appelables par personne.
-- 3) Sept petites fonctions reçoivent un chemin de recherche fixe (avertissement de sécurité Supabase).

-- ——— 1) Remise en ligne d'une annonce : même plafond que pour une nouvelle annonce ———
create or replace function public.garde_publication() returns trigger
language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if tg_op = 'UPDATE' then
    if public.est_admin() then return new; end if;
    if new.user_id = auth.uid() and public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
    if old.status = 'masquee' then new.status := 'masquee'; end if;   -- une annonce masquée par l'administration le reste
    -- une annonce retirée qui revient en ligne compte comme une annonce active de plus
    if old.status <> 'active' and new.status = 'active' then
      execute format('select count(*) from public.%I where user_id = $1 and status = ''active'' and id <> $2', tg_table_name)
        into c using new.user_id, new.id;
      if c >= 30 then raise exception 'Limite atteinte : 30 annonces actives par compte. Retirez-en une avant d''en remettre une en ligne.'; end if;
    end if;
    return new;
  end if;
  if public.est_admin_id(new.user_id) then return new; end if;
  if public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  -- l'application renvoie une annonce déjà publiée quand elle est modifiée (même client_id) : ce n'est pas une nouvelle annonce
  execute format('select count(*) from public.%I where user_id = $1 and client_id = $2', tg_table_name) into c using new.user_id, new.client_id;
  if c > 0 then return new; end if;
  select n into c from public.annonces_publiees where user_id = new.user_id;
  if coalesce(c, 0) >= public.annonces_gratuites() and not public.identite_ok(new.user_id) then
    raise exception 'VERIFICATION_REQUISE : vous avez publié vos % annonces gratuites. Faites vérifier votre identité (Mon compte, Identité) pour publier les suivantes.', public.annonces_gratuites();
  end if;
  insert into public.annonces_publiees (user_id, n) values (new.user_id, 1)
  on conflict (user_id) do update set n = public.annonces_publiees.n + 1;
  return new;
end $$;
revoke execute on function public.garde_publication() from public, anon, authenticated;

-- ——— 2) Anciennes versions : plus appelables ———
revoke execute on function public.identite_soumettre(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.identite_soumettre(uuid, text, text, boolean, date, date, text) from public, anon, authenticated;
revoke execute on function public.admin_identite_decider(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.signaler_membre(uuid, text, text, text, uuid) from public, anon, authenticated;

-- ——— 3) Chemin de recherche fixe ———
alter function public.annonces_gratuites() set search_path = public;
alter function public.dm_duree() set search_path = public;
alter function public.identite_dossier(public.verifications) set search_path = public;
alter function public.identite_fige_dossier() set search_path = public;
alter function public.identite_nom_concorde(text, text) set search_path = public;
alter function public.identite_norm_nom(text) set search_path = public;
alter function public.identite_purgeable(public.verifications) set search_path = public;
