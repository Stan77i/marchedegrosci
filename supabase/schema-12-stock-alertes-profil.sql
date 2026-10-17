-- Marché de Gros CI — schéma 12 : stock, alertes par produit, profil public (appliqué le 17/10/2026)

-- 1) Stock : quand une négociation est conclue avec une quantité, l'annonce diminue d'autant.
--    À zéro, l'annonce est retirée (les autres négociations ouvertes sur elle se ferment, comme pour un retrait).
create or replace function public.stock_apres_accord() returns trigger
language plpgsql security definer set search_path = public as $$
declare q numeric;
begin
  if new.statut = 'conclue' and old.statut is distinct from 'conclue' and coalesce(new.quantite_finale, 0) > 0 then
    if new.cible = 'offre' then
      update public.offres set quantity = greatest(0, coalesce(quantity, 0) - new.quantite_finale) where id = new.cible_id returning quantity into q;
      if q is not null and q <= 0 then update public.offres set status = 'retiree' where id = new.cible_id and status = 'active'; end if;
    else
      update public.demandes set quantity = greatest(0, coalesce(quantity, 0) - new.quantite_finale) where id = new.cible_id returning quantity into q;
      if q is not null and q <= 0 then update public.demandes set status = 'retiree' where id = new.cible_id and status = 'active'; end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists negociation_stock on public.negociations;
create trigger negociation_stock after update of statut on public.negociations for each row execute function public.stock_apres_accord();

-- 2) Alertes par produit : chacun choisit les produits pour lesquels il veut une notification (offres, demandes, ou les deux).
create table if not exists public.alertes_produits (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_slug text not null check (char_length(product_slug) <= 80),
  offres boolean not null default true,
  demandes boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, product_slug)
);
create index if not exists alertes_produits_slug_idx on public.alertes_produits (product_slug);
alter table public.alertes_produits enable row level security;
create policy "voir mes alertes produits" on public.alertes_produits for select to authenticated using (user_id = (select auth.uid()));
create policy "créer mes alertes produits" on public.alertes_produits for insert to authenticated with check (user_id = (select auth.uid()));
create policy "modifier mes alertes produits" on public.alertes_produits for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "retirer mes alertes produits" on public.alertes_produits for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.alertes_produits to authenticated;

-- une nouvelle annonce prévient ceux qui suivent ce produit (fonction Edge « pousser », { annonce, id })
create or replace function public.push_annonce() returns trigger
language plpgsql security definer set search_path = public, vault, extensions as $$
declare v_url text; v_cle text;
begin
  if not exists (select 1 from public.alertes_produits a where a.product_slug = new.product_slug and a.user_id <> new.user_id
                 and ((tg_table_name = 'offres' and a.offres) or (tg_table_name = 'demandes' and a.demandes))) then return new; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'mdg_push_url';
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'mdg_push_cle';
  if v_url is null or v_cle is null then return new; end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('annonce', tg_table_name, 'id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-mdg-cle', v_cle), timeout_milliseconds := 8000);
  return new;
exception when others then return new;
end $$;
drop trigger if exists offres_push_annonce on public.offres;
create trigger offres_push_annonce after insert on public.offres for each row execute function public.push_annonce();
drop trigger if exists demandes_push_annonce on public.demandes;
create trigger demandes_push_annonce after insert on public.demandes for each row execute function public.push_annonce();

-- 3) Profil public : présentation, activités, photos ; ancienneté, dernière activité, ventes, annonces, lieux.
alter table public.profils add column if not exists bio text check (bio is null or char_length(bio) <= 600);
alter table public.profils add column if not exists activites text check (activites is null or char_length(activites) <= 200);
alter table public.profils add column if not exists photos text[] check (photos is null or coalesce(array_length(photos, 1), 0) <= 6);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activites', 'activites', true, 400000, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
create policy "activites : lecture" on storage.objects for select to public using (bucket_id = 'activites');
create policy "activites : déposer les miennes" on storage.objects for insert to authenticated with check (bucket_id = 'activites' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "activites : remplacer les miennes" on storage.objects for update to authenticated using (bucket_id = 'activites' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'activites' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "activites : retirer les miennes" on storage.objects for delete to authenticated using (bucket_id = 'activites' and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.profil_public(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'user_id', u.id,
    'affichage', case when public.est_admin_id(u.id) then 'Marché de Gros' else coalesce(public.nom_public(u.id), 'Membre') end,
    'officiel', public.est_admin_id(u.id),
    'avatar', p.avatar, 'role', p.role, 'bio', p.bio, 'activites', p.activites, 'photos', coalesce(p.photos, '{}'),
    'region_slug', p.region_slug, 'ville', p.ville,
    'membre_depuis', u.created_at,
    'vu_le', greatest(u.last_sign_in_at,
      (select max(vu_le) from public.push_abonnements pa where pa.user_id = u.id),
      (select max(created_at) from public.dm where auteur_id = u.id),
      (select max(created_at) from public.messages where auteur_id = u.id),
      (select max(created_at) from public.offres where user_id = u.id),
      (select max(created_at) from public.demandes where user_id = u.id)),
    'ventes', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id))),
    'achats', (select count(*) from public.negociations g where g.statut = 'conclue' and ((g.cible = 'offre' and g.auteur_id = u.id) or (g.cible = 'demande' and g.proprio_id = u.id))),
    'offres_actives', (select count(*) from public.offres where user_id = u.id and status = 'active'),
    'demandes_actives', (select count(*) from public.demandes where user_id = u.id and status = 'active'),
    'annonces_total', (select count(*) from public.offres where user_id = u.id) + (select count(*) from public.demandes where user_id = u.id),
    'lieux', (select coalesce(json_agg(distinct x.l), '[]') from (select coalesce(nullif(city, ''), region_slug) l from public.offres where user_id = u.id union select coalesce(nullif(city, ''), region_slug) from public.demandes where user_id = u.id) x where x.l is not null),
    'historique', (select coalesce(json_agg(h order by h.quand desc), '[]') from (
        select g.produit, g.quantite_finale as quantite, g.unite, g.prix_final as prix, g.ville, coalesce(g.conclu_le, g.updated_at) as quand,
               case when (g.cible = 'offre' and g.proprio_id = u.id) or (g.cible = 'demande' and g.auteur_id = u.id) then 'vente' else 'achat' end as sens
        from public.negociations g where g.statut = 'conclue' and u.id in (g.auteur_id, g.proprio_id)
        order by coalesce(g.conclu_le, g.updated_at) desc limit 12) h))
  from auth.users u left join public.profils p on p.user_id = u.id
  where u.id = p_uid and (p.user_id is null or p.supprime_le is null);
$$;
grant execute on function public.profil_public(uuid) to anon, authenticated;

-- 4) Les fonctions de déclencheur ne s'appellent pas depuis l'extérieur
revoke execute on function public.controle_sortie() from public, anon, authenticated;
revoke execute on function public.push_alerte() from public, anon, authenticated;
revoke execute on function public.push_annonce() from public, anon, authenticated;
revoke execute on function public.stock_apres_accord() from public, anon, authenticated;
revoke execute on function public.sans_numero_public() from public, anon, authenticated;
