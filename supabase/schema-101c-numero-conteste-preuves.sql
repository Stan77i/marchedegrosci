-- Schéma 101c : « Numéro contesté », deux preuves obligatoires avant de libérer (décision juridique n° 16, et D).
-- L'équipe doit cocher « pièce d'identité vue » et « appel fait sur ce numéro » ; les deux sont notées dans admin_journal.
-- Méthode « porte » (comme 98a) : la fonction du schéma 94b est renommée _admin_numero_rendre_base, fermée aux membres ;
-- admin_numero_rendre(tel, motif, piece_vue, appel_fait) vérifie les deux cases puis l'appelle.
-- L'ancien appel à deux paramètres répond un message clair : l'écran de l'équipe doit envoyer les deux cases.
do $$ begin
  if to_regprocedure('public._admin_numero_rendre_base(text, text)') is null then
    alter function public.admin_numero_rendre(text, text) rename to _admin_numero_rendre_base;
  end if;
end $$;
revoke all on function public._admin_numero_rendre_base(text, text) from public, anon, authenticated;

create or replace function public.admin_numero_rendre(p_tel text, p_motif text, p_piece_vue boolean, p_appel_fait boolean)
returns json language plpgsql security definer set search_path = public as $$
declare r json; j uuid;
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if not coalesce(p_piece_vue, false) or not coalesce(p_appel_fait, false) then
    raise exception 'Avant de libérer : cochez « Pièce d''identité vue » et « Appel fait sur ce numéro ».';
  end if;
  r := public._admin_numero_rendre_base(p_tel, p_motif);
  select id into j from public.admin_journal
   where admin_id = auth.uid() and action = 'numero_rendu' and cible_id = (r ->> 'compte')::uuid
   order by at desc limit 1;
  update public.admin_journal
     set detail = coalesce(detail, '{}'::jsonb) || jsonb_build_object('piece_vue', true, 'appel_fait', true)
   where id = j;
  return r;
end $$;
revoke all on function public.admin_numero_rendre(text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_numero_rendre(text, text, boolean, boolean) to authenticated;

create or replace function public.admin_numero_rendre(p_tel text, p_motif text)
returns json language plpgsql security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  raise exception 'Avant de libérer : cochez « Pièce d''identité vue » et « Appel fait sur ce numéro » (mettez l''application à jour).';
end $$;
revoke all on function public.admin_numero_rendre(text, text) from public, anon;
grant execute on function public.admin_numero_rendre(text, text) to authenticated;
