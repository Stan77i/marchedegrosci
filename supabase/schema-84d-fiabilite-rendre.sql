-- Schéma 84d : fiabilité (chantier 2). Partie 4 : remettre en ligne les annonces à la fin d'une suspension.
-- garde_publication garde une annonce « masquee » quand ce n'est pas un administrateur qui la change : la tâche planifiée
-- (fin naturelle d'une suspension) ne pouvait donc pas rendre les annonces. Un drapeau posé seulement par _fiab_rendre_annonces
-- (comme « mdg.stock_rendu » pour le stock) laisse passer ce seul cas. Le reste de garde_publication est inchangé (lu en direct).
-- Testé sur le projet de test, pas encore appliqué en production.

create or replace function public.garde_publication()
returns trigger language plpgsql security definer set search_path = public as $function$
declare c int;
begin
  if tg_op = 'UPDATE' then
    if current_setting('mdg.fiab_rendre', true) = '1' then return new; end if;
    if public.est_admin() then return new; end if;
    if new.user_id = auth.uid() and public.est_banni(new.user_id) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
    if old.status = 'masquee' then new.status := 'masquee'; end if;
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
end $function$;

create or replace function public._fiab_rendre_annonces(p_sanction uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.sanctions;
begin
  select * into s from public.sanctions where id = p_sanction;
  if s.id is null or s.annonces_rendues_le is not null then return; end if;
  if not public.est_banni(s.user_id) then
    perform set_config('mdg.fiab_rendre', '1', true);
    update public.offres set status = 'active', suspension_id = null where suspension_id = s.id and status = 'masquee';
    update public.demandes set status = 'active', suspension_id = null where suspension_id = s.id and status = 'masquee';
    perform set_config('mdg.fiab_rendre', '', true);
  end if;
  update public.sanctions set annonces_rendues_le = now() where id = s.id;
end $$;
revoke all on function public._fiab_rendre_annonces(uuid) from public, anon, authenticated;
