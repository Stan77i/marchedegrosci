-- Schéma 84f : fiabilité (chantier 2). Partie 6 : corrections de relecture.
-- 1. Après confirmation, une annulation acceptée sans réponse sur le motif (ancienne application, ou appel direct de
--    commande_annuler) ne compte plus contre personne : seul « je ne suis pas d'accord avec le motif » la rend abusive.
--    Sans cela, chaque annulation acceptée depuis l'application en ligne aurait donné un avertissement au vendeur.
-- 2. « Ma fiabilité » ne montre plus à l'autre partie la contestation, la note de l'équipe ni la catégorie
--    d'une annulation qui compte contre quelqu'un d'autre (le détail reste visible seulement par l'intéressé).
-- Testé sur le projet de test, pas encore appliqué en production.

create or replace function public._fiab_annulation()
returns trigger language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); ch text; dem uuid; imp uuid; cat text; mc text; mt text; acc boolean; aid uuid; f text;
begin
  if new.etat <> 'annulee' or old.etat = 'annulee' then return new; end if;
  mc := nullif(current_setting('mdg.fiab_motif', true), '');
  mt := nullif(current_setting('mdg.fiab_motif_texte', true), '');
  acc := nullif(current_setting('mdg.fiab_accord', true), '')::boolean;
  f := nullif(current_setting('mdg.fiab_fautif', true), '');
  if current_setting('mdg.fiab_chemin', true) = 'expiration' then
    ch := 'expiration'; dem := null; imp := null; cat := 'legitime'; mc := 'sans_reponse'; mt := null;
  elsif old.etat = 'a_confirmer' then
    ch := case when me is not null and me = old.cree_par then 'retrait' when me is not null then 'refus' else 'expiration' end;
    dem := me; imp := null; cat := 'legitime';
  elsif old.etat = 'litige' then
    ch := 'litige'; dem := old.litige_par; cat := 'litige';
    imp := case when f is not null and f::uuid in (old.vendeur_id, old.acheteur_id) then f::uuid end;
  elsif old.etat = 'en_cours' then
    ch := 'accord'; dem := old.annulation_par;
    mc := coalesce(old.annulation_motif, mc); mt := coalesce(old.annulation_motif_texte, mt);
    if acc is false then cat := 'abusive'; imp := dem; else cat := 'legitime'; imp := null; end if;
  else
    ch := 'autre'; dem := me; imp := null; cat := 'legitime';
  end if;
  insert into public.annulations (commande_id, groupe_id, vendeur_id, acheteur_id, auteur_id, demandeur_id, imputable_id, role_imputable,
    etat_avant, etape_avant, chemin, motif_code, motif_texte, accord, categorie, categorie_auto)
  values (new.id, new.groupe_id, new.vendeur_id, new.acheteur_id, me, dem, imp,
    case when imp is null then null when imp = new.vendeur_id then 'vendeur' else 'acheteur' end,
    old.etat, old.etape, ch, mc, left(mt, 300), acc, cat, cat)
  on conflict (commande_id) do nothing
  returning id into aid;
  if aid is not null and cat = 'abusive' and imp is not null then perform public._fiab_paliers(imp, aid); end if;
  return new;
end $$;

create or replace function public.ma_fiabilite()
returns json language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); cj integer := public._fiab_regle('contestation_jours', 7);
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  return json_build_object(
    'score', public._fiab_score(me),
    'debut', public._fiab_debut(),
    'fenetre_jours', public._fiab_regle('fenetre_jours', 90),
    'seuils', json_build_object('avertissement', public._fiab_regle('seuil_avertissement', 1), 'baisse', public._fiab_regle('seuil_baisse', 3), 'examen', public._fiab_regle('seuil_examen', 5)),
    'contestation_jours', cj,
    'suspension', (select json_build_object('fin', s.fin, 'motif', s.motif) from public.sanctions s where s.user_id = me and s.type = 'suspension'
                   and s.levee_le is null and now() >= s.debut and now() < s.fin order by s.fin desc limit 1),
    'non_vues', (select count(*) from public.sanctions s where s.user_id = me and s.vue_le is null and s.levee_le is null),
    'annulations', coalesce((select json_agg(x order by x.cree_le desc) from (
      select a.id, a.cree_le, a.chemin, a.motif_code, a.motif_texte,
        case when a.imputable_id is null or a.imputable_id = me then a.categorie end categorie, a.accord,
        case when a.imputable_id = me or t.id is not null then a.note_admin end note_admin,
        k.numero, k.produit,
        case when a.vendeur_id = me then 'vendeur' else 'acheteur' end mon_role,
        a.imputable_id = me contre_moi, a.demandeur_id = me demande_par_moi,
        (a.imputable_id = me and a.categorie in ('abusive', 'litige') and not exists (select 1 from public.contestations z where z.annulation_id = a.id)
          and now() <= greatest(a.cree_le, coalesce(a.decide_le, a.cree_le)) + make_interval(days => cj)) contestable,
        case when t.id is not null then json_build_object('statut', t.statut, 'texte', t.texte, 'reponse', t.reponse, 'cree_le', t.cree_le,
          'decide_le', t.decide_le, 'repondre_avant', t.repondre_avant) end contestation
      from public.annulations a
      left join public.commandes k on k.id = a.commande_id
      left join public.contestations t on t.annulation_id = a.id and t.auteur_id = me
      where me in (a.vendeur_id, a.acheteur_id)
      order by a.cree_le desc limit 100) x), '[]'::json),
    'sanctions', coalesce((select json_agg(y order by y.cree_le desc) from (
      select s.id, s.type, s.nb_90j, s.debut, s.fin, s.motif, s.levee_le, s.levee_motif, s.vue_le, s.cree_le
      from public.sanctions s where s.user_id = me order by s.cree_le desc limit 50) y), '[]'::json));
end $$;
revoke all on function public.ma_fiabilite() from public, anon;
grant execute on function public.ma_fiabilite() to authenticated;
