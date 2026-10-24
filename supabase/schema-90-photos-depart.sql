-- ═════════ Marché de Gros CI — schéma 90 : photos du colis et poids au départ, obligatoires ═════════
-- Demandé par le propriétaire le 24/10/2026 : le vendeur montre son colis propre et bien emballé avant le départ
-- (2 à 4 photos + poids pesé). Sans ces preuves, le chargement ne peut pas être confirmé. L'acheteur, le transporteur
-- et l'équipe les voient ; en cas de refus, elles sont comparées aux photos de l'acheteur.
-- Rien n'est effacé : colonnes ajoutées, fonctions remplacées.

alter table public.commandes add column if not exists depart_photos text[];
alter table public.commandes add column if not exists depart_poids_kg numeric;
alter table public.commandes add column if not exists depart_le timestamptz;

-- le vendeur dépose ses preuves de départ (avant le chargement ; il peut les refaire tant que le chargement n'est pas confirmé)
create or replace function public.commande_depart_preuves(p_id uuid, p_photos text[], p_poids_kg numeric) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; x text;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Seul le vendeur photographie le colis au départ.'; end if;
  if public.est_banni(me) then raise exception 'COMPTE_BANNI : ce compte a été banni du Marché de Gros.'; end if;
  if not (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation')) then raise exception 'Les photos du départ se prennent avant le chargement.'; end if;
  if p_photos is null or cardinality(p_photos) < 2 or cardinality(p_photos) > 4 then raise exception 'Ajoutez de 2 à 4 photos du colis emballé.'; end if;
  foreach x in array p_photos loop
    if split_part(x, '/', 1) <> me::text or not exists (select 1 from storage.objects o where o.bucket_id = 'preuves' and o.name = x) then
      raise exception 'Photo introuvable : renvoyez-la.';
    end if;
  end loop;
  if p_poids_kg is null or p_poids_kg <= 0 or p_poids_kg > 100000 then raise exception 'Indiquez le poids pesé, en kilos.'; end if;
  update public.commandes set depart_photos = p_photos, depart_poids_kg = round(p_poids_kg, 1), depart_le = now() where id = c.id;
end $$;
revoke all on function public.commande_depart_preuves(uuid, text[], numeric) from public, anon;
grant execute on function public.commande_depart_preuves(uuid, text[], numeric) to authenticated;

-- pas de chargement sans les preuves du départ
create or replace function public._cmd_chargement_preuves() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.evenement = 'chargement' and exists (select 1 from public.commandes c where c.id = new.commande_id
      and (c.depart_photos is null or cardinality(c.depart_photos) < 2 or c.depart_poids_kg is null)) then
    raise exception 'DEPART_PREUVES : le vendeur doit d''abord photographier le colis emballé et indiquer son poids.';
  end if;
  return new;
end $$;
create or replace trigger commande_etapes_chargement_preuves before insert on public.commande_etapes
  for each row when (new.evenement = 'chargement') execute function public._cmd_chargement_preuves();

-- les photos du départ se voient comme celles d'un refus : vendeur, acheteur, transporteur de la commande (et l'équipe)
create or replace function public._preuve_refus_visible(p_nom text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.commandes c
                 where (c.refus_photos @> array[p_nom] or c.depart_photos @> array[p_nom])
                   and (auth.uid() in (c.vendeur_id, c.acheteur_id)
                        or exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id = auth.uid())));
$$;

-- le détail de la commande donne les preuves du départ (même accès que le reste : vendeur, acheteur, transporteur, équipe)
CREATE OR REPLACE FUNCTION public.commande_sequestre(p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := auth.uid(); c public.commandes; r text; rep json; s public.sequestres;
begin
  select * into c from public.commandes where id = p_id;
  if c.id is null or me is null then return null; end if;
  r := public._cmd_role2(c, me);
  if r is null and public.est_admin() then r := 'admin'; end if;
  if r is null then return null; end if;
  rep := public._seq_repartition(c.id);
  select * into s from public.sequestres where commande_id = c.id;
  return json_build_object(
    'role', r,
    'actif', s.id is not null,
    'etat', coalesce(s.etat, 'non_ouvert'), 'operateur', s.operateur, 'depose_le', s.depose_le, 'solde_le', s.solde_le,
    'libere_le', c.libere_le, 'liberation', c.liberation, 'montant_refuse', c.montant_refuse,
    'echeance', case when c.etat = 'terminee' and c.libere_le is null then c.termine_le + interval '1 hour' end,
    'sans_reponse', false,
    'depart', case when c.depart_le is null then null else json_build_object('photos', c.depart_photos, 'poids_kg', c.depart_poids_kg, 'le', c.depart_le) end,
    'mot', case when r in ('vendeur', 'admin') then c.mot_secret end,
    'avec_mot', c.mot_secret is not null,
    'repartition', case when r = 'chauffeur' then json_build_object('transporteur_brut', rep->'transporteur_brut', 'transporteur_commission', rep->'transporteur_commission', 'transporteur_net', rep->'transporteur_net') else rep end,
    'refus', case when c.refus_le is null then null else json_build_object(
      'le', c.refus_le, 'quantite', c.refus_quantite, 'unite', c.unite, 'motif', c.refus_motif, 'photos', c.refus_photos, 'mot', c.refus_mot,
      'chauffeur', c.refus_chauffeur, 'chauffeur_le', c.refus_chauffeur_le, 'vendeur', c.refus_vendeur, 'vendeur_le', c.refus_vendeur_le,
      'chauffeur_suffit', public._cmd_chauffeur_independant(c) and coalesce(c.refus_mot, 'retrouve') = 'retrouve',
      'a_chauffeur', exists (select 1 from public.transporteurs t where t.id = c.transporteur_id and t.user_id is not null)) end,
    'peut_liberer', r = 'acheteur' and c.etat = 'terminee' and c.libere_le is null,
    'peut_refuser', r = 'acheteur' and ((c.etat = 'en_cours' and c.etape = 'arrivee') or (c.etat = 'terminee' and c.libere_le is null)),
    'mot_bloque', c.mot_essais >= 5,
    'peut_constater', r = 'chauffeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_chauffeur is null,
    'peut_repondre', r = 'vendeur' and c.etat = 'litige' and c.refus_le is not null and c.refus_vendeur is null);
end $function$;

