-- ═════════ Marché de Gros CI — n° 18 : un compte banni peut contester (7 jours), l'équipe répond en 7 jours ═════════
-- Décision du propriétaire du 25/10/2026 (« ok pour tout », docs/juridique/DECISIONS-A-PRENDRE.md, n° 18).
-- Appliqué sur le projet de TEST seulement (yowdymdnoiubatxlwhfv) le 25/10/2026. Production : après la fusion, avec l'accord du propriétaire.
-- Ne touche à rien d'existant : une table nouvelle et quatre fonctions nouvelles. Peut être relancé sans danger.
--
--   • bannissement_etat()            : le membre banni lit son motif, la date, la date limite pour contester et sa contestation.
--   • bannissement_contester(texte)  : une seule contestation par bannissement, dans les 7 jours (10 à 500 caractères, sans lien ni numéro).
--   • admin_bannissements_contestes(): l'équipe lit les contestations ouvertes.
--   • admin_bannissement_decider(id, lever, reponse) : l'équipe maintient ou lève (lever passe par admin_lever_bannissement, noté au journal).
-- La table garde la contestation même quand le bannissement est levé (la ligne de « bannis » disparaît alors).
-- Pas de clé vers auth.users : la table ne bloque pas la fermeture d'un compte.

create table if not exists public.bannis_contestations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null,
  banni_le       timestamptz not null,
  motif          text,
  texte          text not null check (char_length(texte) between 10 and 500),
  cree_le        timestamptz not null default now(),
  repondre_avant timestamptz not null,
  statut         text not null default 'ouverte' check (statut in ('ouverte', 'maintenu', 'leve')),
  reponse        text check (reponse is null or char_length(reponse) <= 500),
  decide_le      timestamptz,
  decide_par     uuid,
  unique (user_id, banni_le)
);
alter table public.bannis_contestations enable row level security;
revoke all on public.bannis_contestations from anon, authenticated;

create or replace function public.bannissement_etat() returns json
language sql stable security definer set search_path = public as $$
  select case when b.user_id is null then null else json_build_object(
    'banni', true, 'motif', b.motif, 'le', b.le, 'contester_avant', b.le + interval '7 days',
    'contestation', (select json_build_object('texte', c.texte, 'cree_le', c.cree_le, 'repondre_avant', c.repondre_avant,
                                              'statut', c.statut, 'reponse', c.reponse, 'decide_le', c.decide_le)
                     from public.bannis_contestations c where c.user_id = b.user_id and c.banni_le = b.le))
  end
  from (select 1) x left join public.bannis b on b.user_id = auth.uid();
$$;
revoke all on function public.bannissement_etat() from public, anon;
grant execute on function public.bannissement_etat() to authenticated;

create or replace function public.bannissement_contester(p_texte text) returns json
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); b public.bannis; t text := btrim(coalesce(p_texte, '')); r text; cid uuid;
begin
  if me is null then raise exception 'Connectez-vous.'; end if;
  select * into b from public.bannis where user_id = me;
  if b.user_id is null then raise exception 'TEXTE_REFUSE : Ce compte n’est pas banni.' using errcode = 'P0001'; end if;
  if now() > b.le + interval '7 days' then raise exception 'TEXTE_REFUSE : Le délai pour contester est passé (7 jours).' using errcode = 'P0001'; end if;
  if char_length(t) < 10 or char_length(t) > 500 then raise exception 'TEXTE_REFUSE : Expliquez en quelques mots (10 à 500 caractères).' using errcode = 'P0001'; end if;
  r := public.texte_refus(t);
  if r is not null then raise exception 'TEXTE_REFUSE : %', r using errcode = 'P0001'; end if;
  insert into public.bannis_contestations (user_id, banni_le, motif, texte, repondre_avant)
  values (me, b.le, b.motif, t, now() + interval '7 days')
  on conflict (user_id, banni_le) do nothing returning id into cid;
  if cid is null then raise exception 'TEXTE_REFUSE : Vous avez déjà contesté. L’équipe vous répond ici.' using errcode = 'P0001'; end if;
  return json_build_object('ok', true, 'repondre_avant', now() + interval '7 days');
end $$;
revoke all on function public.bannissement_contester(text) from public, anon;
grant execute on function public.bannissement_contester(text) to authenticated;

create or replace function public.admin_bannissements_contestes() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  return coalesce((select json_agg(json_build_object('id', c.id, 'user_id', c.user_id, 'motif', c.motif, 'banni_le', c.banni_le,
      'texte', c.texte, 'cree_le', c.cree_le, 'repondre_avant', c.repondre_avant) order by c.repondre_avant)
    from public.bannis_contestations c
    where c.statut = 'ouverte'), '[]'::json);
end $$;
revoke all on function public.admin_bannissements_contestes() from public, anon;
grant execute on function public.admin_bannissements_contestes() to authenticated;

create or replace function public.admin_bannissement_decider(p_id uuid, p_lever boolean, p_reponse text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.bannis_contestations; t text := left(nullif(btrim(coalesce(p_reponse, '')), ''), 500);
begin
  if not public.est_admin() then raise exception 'Accès réservé à l''administrateur.'; end if;
  select * into c from public.bannis_contestations where id = p_id for update;
  if c.id is null or c.statut <> 'ouverte' then raise exception 'Contestation introuvable ou déjà décidée.'; end if;
  if t is null then raise exception 'Écrivez la réponse donnée au membre.'; end if;
  update public.bannis_contestations set statut = case when p_lever then 'leve' else 'maintenu' end,
    reponse = t, decide_le = now(), decide_par = auth.uid() where id = c.id;
  if p_lever then perform public.admin_lever_bannissement(c.user_id); end if;
end $$;
revoke all on function public.admin_bannissement_decider(uuid, boolean, text) from public, anon;
grant execute on function public.admin_bannissement_decider(uuid, boolean, text) to authenticated;
