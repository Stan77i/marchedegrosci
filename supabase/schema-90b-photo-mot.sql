-- ═════════ Marché de Gros CI — schéma 90b : photo du papier du mot secret, avec un code au hasard ═════════
-- Demandé par le propriétaire le 24/10/2026 : l'équipe doit pouvoir voir le papier du mot secret glissé dans le colis.
-- Le serveur donne un code au hasard quand le vendeur le demande ; il a 3 minutes pour l'écrire à côté du mot et envoyer la photo du papier.
-- Seule l'équipe voit cette photo (jamais l'acheteur, sinon il connaîtrait le mot). Pas de chargement sans elle.

alter table public.commandes add column if not exists depart_defi text;
alter table public.commandes add column if not exists depart_defi_le timestamptz;
alter table public.commandes add column if not exists depart_mot_photo text;

-- le code : 4 signes faciles à lire (sans 0/O, 1/I, 2/Z, 5/S, 6/G, 8/B)
create or replace function public.commande_depart_defi(p_id uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; a text := 'ACDEFHJKMNPRTUVWXY3479'; k text := ''; i int;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Seul le vendeur prépare le colis.'; end if;
  if not (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation')) then raise exception 'Les photos du départ se prennent avant le chargement.'; end if;
  if c.depart_defi is not null and c.depart_defi_le > now() - interval '3 minutes' then return c.depart_defi; end if;
  for i in 1..4 loop k := k || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
  update public.commandes set depart_defi = k, depart_defi_le = now() where id = c.id;
  return k;
end $$;
revoke all on function public.commande_depart_defi(uuid) from public, anon;
grant execute on function public.commande_depart_defi(uuid) to authenticated;

-- la photo du papier : envoyée dans les 3 minutes qui suivent l'affichage du code
create or replace function public.commande_depart_mot(p_id uuid, p_photo text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.commandes; t timestamptz;
begin
  select * into c from public.commandes where id = p_id for update;
  if c.id is null or me is distinct from c.vendeur_id then raise exception 'Seul le vendeur photographie le papier.'; end if;
  if not (c.etat = 'en_cours' and c.etape in ('confirmee', 'preparation')) then raise exception 'Les photos du départ se prennent avant le chargement.'; end if;
  if c.depart_defi is null then raise exception 'Affichez d''abord le code.'; end if;
  select o.created_at into t from storage.objects o where o.bucket_id = 'preuves' and o.name = p_photo;
  if t is null or split_part(p_photo, '/', 1) <> me::text or split_part(p_photo, '/', 2) not like 'motpapier-%' then raise exception 'Photo introuvable : renvoyez-la.'; end if;
  if t < c.depart_defi_le then raise exception 'La photo doit être prise après l''affichage du code.'; end if;
  if t > c.depart_defi_le + interval '3 minutes' then raise exception 'DEFI_EXPIRE : plus de 3 minutes. Demandez un nouveau code.'; end if;
  update public.commandes set depart_mot_photo = p_photo where id = c.id;
end $$;
revoke all on function public.commande_depart_mot(uuid, text) from public, anon;
grant execute on function public.commande_depart_mot(uuid, text) to authenticated;

-- pas de chargement sans les photos, le poids et (quand il y a un mot secret) la photo du papier
create or replace function public._cmd_chargement_preuves() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.evenement = 'chargement' and exists (select 1 from public.commandes c where c.id = new.commande_id
      and (c.depart_photos is null or cardinality(c.depart_photos) < 2 or c.depart_poids_kg is null
           or (c.mot_secret is not null and c.depart_mot_photo is null))) then
    raise exception 'DEPART_PREUVES : le vendeur doit d''abord photographier le colis emballé, le papier du mot secret, et indiquer le poids.';
  end if;
  return new;
end $$;

-- le détail : la photo du papier et le code, seulement pour l'équipe
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
    'depart', case when c.depart_le is null then null else json_build_object('photos', c.depart_photos, 'poids_kg', c.depart_poids_kg, 'le', c.depart_le,
      'mot_ok', c.depart_mot_photo is not null,
      'mot_photo', case when r = 'admin' then c.depart_mot_photo end, 'defi', case when r = 'admin' then c.depart_defi end) end,
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

