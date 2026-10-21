-- ═════════ Marché de Gros CI — schéma 39 : badges Coopérative et Marché vérifiés ═════════
-- Demandé par le propriétaire le 21/10/2026 (point 3). Appliqué par Claude avec l'outil Supabase.
-- Le propriétaire a choisi le nom « Marché » (pas « Marché de gros », qui est le nom du compte officiel)
-- et autorisé le remplacement de la règle des types de structure (aucune donnée effacée).
--
-- Règle :
--   • Une coopérative ou un marché envoie un dossier : 1 à 3 photos d'un document officiel (agrément, RCCM,
--     autorisation du marché…) et la fonction du responsable. Le responsable, c'est le membre lui-même :
--     son identité doit déjà être vérifiée (pièce + selfie, schéma 13) ; son nom confirmé est repris tel quel.
--   • Les photos vont dans le stockage privé « preuves » : seul l'administrateur peut les voir.
--   • L'administrateur valide ou refuse (motif obligatoire pour un refus).
--   • Le badge n'existe que si : dossier validé + même type et même nom de structure qu'aujourd'hui +
--     identité toujours valide. Si le membre change le nom ou le type, le badge disparaît tout seul.

-- ——— 1) le type « marche » (la nouvelle règle est posée avant de retirer l'ancienne) ———
do $$ begin
  alter table public.profils add constraint profils_structure_type_check2
    check (structure_type is null or structure_type in ('particulier', 'cooperative', 'groupement', 'entreprise', 'marche'));
exception when duplicate_object then null; end $$;
alter table public.profils drop constraint if exists profils_structure_type_check;

-- ——— 2) les dossiers ———
create table if not exists public.structure_verifs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  type        text not null check (type in ('cooperative', 'marche')),
  nom         text not null check (char_length(nom) between 2 and 80),
  responsable text not null check (char_length(responsable) between 2 and 120),
  fonction    text not null check (char_length(fonction) between 2 and 60),
  documents   text[] not null check (cardinality(documents) between 1 and 3),
  statut      text not null default 'en_attente' check (statut in ('en_attente', 'verifiee', 'refusee', 'retiree')),
  motif       text check (char_length(motif) <= 300),
  decide_par  uuid,
  decide_le   timestamptz,
  created_at  timestamptz not null default now()
);
create unique index if not exists structure_verifs_une_attente on public.structure_verifs (user_id) where statut = 'en_attente';
create index if not exists structure_verifs_user on public.structure_verifs (user_id, created_at desc);
create index if not exists structure_verifs_statut on public.structure_verifs (statut, created_at);
alter table public.structure_verifs enable row level security;
revoke all on public.structure_verifs from anon, authenticated;

-- ——— 3) le badge : vrai seulement si tout est encore à jour ———
create or replace function public._structure_verifiee(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.structure_verifs v join public.profils p on p.user_id = v.user_id
    where v.user_id = p_uid and v.statut = 'verifiee' and p.supprime_le is null
      and p.structure_type = v.type and p.structure_nom = v.nom
      and exists (select 1 from public.identite_verifiee(array[p_uid]) i where i = p_uid));
$$;
revoke execute on function public._structure_verifiee(uuid) from public, anon, authenticated;

-- ——— 4) envoyer un dossier ———
create or replace function public.structure_dossier_envoyer(p_fonction text, p_documents text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.profils; resp text; f text := btrim(coalesce(p_fonction, '')); d text[]; n int; v_id uuid;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into p from public.profils where user_id = me;
  if p.user_id is null or p.supprime_le is not null then raise exception 'Profil introuvable.'; end if;
  if p.structure_type not in ('cooperative', 'marche') or p.structure_nom is null then
    raise exception 'Choisissez d''abord « Coopérative » ou « Marché » dans votre profil, avec son nom.';
  end if;
  if not exists (select 1 from public.identite_verifiee(array[me]) i where i = me) then
    raise exception 'IDENTITE_REQUISE : faites d''abord vérifier votre identité (pièce et selfie).';
  end if;
  select coalesce(v.nom_confirme, v.nom_saisi) into resp from public.verifications v
    where v.user_id = me and v.statut = 'verifie' order by v.decide_le desc nulls last limit 1;
  if resp is null or char_length(btrim(resp)) < 2 then raise exception 'Nom du responsable introuvable sur l''identité vérifiée.'; end if;
  if char_length(f) not between 2 and 60 or f !~ '^[[:alpha:][:space:]''’.-]+$' then
    raise exception 'Indiquez votre fonction en lettres (ex. Président, Gérant, Délégué du marché).';
  end if;
  d := coalesce((select array_agg(distinct x) from unnest(coalesce(p_documents, '{}')) x where x is not null), '{}');
  if cardinality(d) not between 1 and 3 then raise exception 'Ajoutez 1 à 3 photos du document officiel.'; end if;
  if exists (select 1 from unnest(d) x where x !~ ('^' || me::text || '/structure-[0-9]{10,16}-[0-9]\.jpg$')) then
    raise exception 'Document invalide.';
  end if;
  select count(*) into n from public.structure_verifs where user_id = me and created_at > now() - interval '30 days';
  if n >= 5 then raise exception 'Limite atteinte : 5 dossiers par mois. Réessayez plus tard.'; end if;
  if exists (select 1 from public.structure_verifs where user_id = me and statut = 'en_attente') then
    raise exception 'Un dossier est déjà en cours d''examen.';
  end if;
  insert into public.structure_verifs (user_id, type, nom, responsable, fonction, documents)
  values (me, p.structure_type, p.structure_nom, btrim(resp), f, d) returning id into v_id;
  return v_id;
end $$;

-- ——— 5) mon dossier (Mon compte) ———
create or replace function public.structure_dossier_moi() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'type', p.structure_type, 'nom', p.structure_nom,
    'identite', exists (select 1 from public.identite_verifiee(array[p.user_id]) i where i = p.user_id),
    'verifiee', public._structure_verifiee(p.user_id),
    'dernier', (select json_build_object('id', v.id, 'statut', v.statut, 'motif', v.motif, 'type', v.type, 'nom', v.nom,
                  'fonction', v.fonction, 'envoye_le', v.created_at, 'decide_le', v.decide_le)
                from public.structure_verifs v where v.user_id = p.user_id order by v.created_at desc limit 1))
  from public.profils p where p.user_id = auth.uid();
$$;

-- retirer son dossier en attente (avant décision)
create or replace function public.structure_dossier_retirer() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connectez-vous.'; end if;
  update public.structure_verifs set statut = 'retiree', decide_le = now() where user_id = auth.uid() and statut = 'en_attente';
end $$;

-- ——— 6) administrateur ———
create or replace function public.admin_structures() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return coalesce((select json_agg(x order by x.ordre, x.created_at desc) from (
    select v.id, v.user_id, v.type, v.nom, v.responsable, v.fonction, v.documents, v.statut, v.motif, v.created_at, v.decide_le,
      (p.structure_type is distinct from v.type or p.structure_nom is distinct from v.nom) as profil_change,
      exists (select 1 from public.identite_verifiee(array[v.user_id]) i where i = v.user_id) as identite_ok,
      case when v.statut = 'en_attente' then 0 else 1 end as ordre
    from public.structure_verifs v left join public.profils p on p.user_id = v.user_id
    where v.statut = 'en_attente' or v.created_at > now() - interval '90 days'
    limit 300) x), '[]'::json);
end $$;

create or replace function public.admin_structure_decider(p_id uuid, p_decision text, p_motif text default null) returns void
language plpgsql security definer set search_path = public as $$
declare m text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  if p_decision not in ('verifiee', 'refusee') then raise exception 'Décision inconnue.'; end if;
  if p_decision = 'refusee' and m is null then raise exception 'Écrivez le motif du refus : le membre le lira.'; end if;
  if char_length(m) > 300 then raise exception 'Motif trop long (300 caractères au plus).'; end if;
  update public.structure_verifs set statut = p_decision, motif = m, decide_par = auth.uid(), decide_le = now()
  where id = p_id and statut = 'en_attente';
  if not found then raise exception 'Dossier introuvable ou déjà traité.'; end if;
end $$;

create or replace function public.admin_structures_compte() returns int
language sql stable security definer set search_path = public as $$
  select case when public.est_admin() then (select count(*)::int from public.structure_verifs where statut = 'en_attente') else 0 end;
$$;

-- ——— 7) lecture publique : le badge sur le profil et les annonces ———
create or replace function public.structure_publique(p_uid uuid) returns json
language sql stable security definer set search_path = public as $$
  select case when public.est_admin_id(p.user_id) or p.supprime_le is not null or p.structure_type is null or p.structure_type = 'particulier' or p.structure_nom is null
              then json_build_object('type', case when public.est_admin_id(p.user_id) then null else p.structure_type end)
              else json_build_object('type', p.structure_type, 'nom', p.structure_nom, 'logo', p.structure_logo, 'preuves', coalesce(p.structure_preuves, '{}'),
                'verifiee', public._structure_verifiee(p.user_id),
                'fonction', case when public._structure_verifiee(p.user_id) then (select v.fonction from public.structure_verifs v
                  where v.user_id = p.user_id and v.statut = 'verifiee' order by v.decide_le desc limit 1) end) end
  from public.profils p where p.user_id = p_uid;
$$;

create or replace function public.profils_publics3(ids uuid[])
returns table (user_id uuid, affichage text, avatar text, role text, structure_type text, structure_nom text, structure_logo text, structure_verifiee boolean)
language sql stable security definer set search_path = public as $$
  select q.*, case when q.structure_nom is not null and q.structure_type in ('cooperative', 'marche') then public._structure_verifiee(q.user_id) else false end
  from public.profils_publics2(ids) q;
$$;

revoke execute on function public.structure_dossier_envoyer(text, text[]), public.structure_dossier_moi(), public.structure_dossier_retirer(),
  public.admin_structures(), public.admin_structure_decider(uuid, text, text), public.admin_structures_compte() from public, anon;
grant execute on function public.structure_dossier_envoyer(text, text[]), public.structure_dossier_moi(), public.structure_dossier_retirer(),
  public.admin_structures(), public.admin_structure_decider(uuid, text, text), public.admin_structures_compte() to authenticated;
revoke execute on function public.profils_publics3(uuid[]) from public;
grant execute on function public.profils_publics3(uuid[]) to anon, authenticated;

-- Retour arrière de la règle des types (seulement si aucun profil n'a le type « marche ») :
--   alter table public.profils add constraint profils_structure_type_check check (structure_type is null or structure_type in ('particulier', 'cooperative', 'groupement', 'entreprise'));
