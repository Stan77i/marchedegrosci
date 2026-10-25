-- Schéma 100a : le quota de 3 annonces gratuites ne se contourne plus (contrôle qualité ANO-014, SEC-05 c, 25/10/2026).
-- Avant : un membre non vérifié qui avait publié ses 3 annonces gratuites pouvait reprendre une ancienne annonce retirée,
-- changer le produit (riz -> igname) et la remettre en ligne : c'était une 4e annonce, le compteur restait à 3.
-- Maintenant : changer le produit d'une annonce (offre ou demande) compte comme une nouvelle publication
-- pour un membre non vérifié : le quota est contrôlé, puis le compteur augmente de 1.
-- Remettre en ligne la même annonce (même produit) reste libre. Membre vérifié et équipe : rien ne change.
-- Seule la partie « UPDATE » de garde_publication change ; la partie « INSERT » est recopiée telle quelle.
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

create or replace function public.garde_publication()
returns trigger language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if tg_op = 'UPDATE' then
    if current_setting('mdg.fiab_rendre', true) = '1' then return new; end if;
    if public.est_admin() then return new; end if;
    if new.user_id = auth.uid() and public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
    if old.status = 'masquee' then new.status := 'masquee'; end if;
    -- schéma 100a : autre produit = nouvelle annonce pour le quota des non-vérifiés
    if new.product_slug is distinct from old.product_slug and new.user_id = auth.uid()
       and not public.est_admin_id(new.user_id) and not public.identite_ok(new.user_id) then
      select n into c from public.annonces_publiees where user_id = new.user_id;
      if coalesce(c, 0) >= public.annonces_gratuites() then
        raise exception 'VERIFICATION_REQUISE : changer de produit compte comme une nouvelle annonce. Vos % annonces gratuites sont utilisées : faites vérifier votre identité (Mon compte, Identité).', public.annonces_gratuites();
      end if;
      insert into public.annonces_publiees (user_id, n) values (new.user_id, 1)
      on conflict (user_id) do update set n = public.annonces_publiees.n + 1;
    end if;
    if old.status <> 'active' and new.status = 'active' then
      execute format('select count(*) from public.%I where user_id = $1 and status = ''active'' and id <> $2', tg_table_name)
        into c using new.user_id, new.id;
      if c >= 30 then raise exception 'Limite atteinte : 30 annonces actives par compte. Retirez-en une avant d''en remettre une en ligne.'; end if;
    end if;
    return new;
  end if;
  if public.est_admin_id(new.user_id) then return new; end if;
  if public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
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
