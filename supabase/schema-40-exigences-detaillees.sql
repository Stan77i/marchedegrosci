-- ═════════ Marché de Gros CI — schéma 40 : exigences détaillées d'un besoin pro ═════════
-- Demandé par le propriétaire le 21/10/2026 (« plus profond dans les exigences », tonnes ou litres).
-- Appliqué par Claude avec l'outil Supabase. Aucune donnée effacée, aucune règle retirée.
--
-- besoins.detail (jsonb) : des exigences AVEC VALEURS, toutes facultatives, nettoyées par le serveur
-- (clé inconnue ou valeur hors liste → refus). Les 12 cases à cocher du schéma 38 restent (criteres).
--   capacite   {q, u, p}  le vendeur doit pouvoir fournir au moins q u (kg, tonne, litre, sac) par semaine ou par mois
--   tolerance  1–20       écart de quantité accepté, en %
--   cond       conditionnement : sac_25, sac_50, sac_100, cageot, carton, bidon_5, bidon_20, fut_200, vrac, palette
--   choix      premier, deuxieme, industriel
--   calibre    petit, moyen, gros, homogene
--   maturite   vert, tournant, mur
--   humidite   5–30       humidité au plus, en % (céréales, cacao, café, arachide…)
--   recolte    1–60       récolté il y a moins de N jours
--   origine    région d'origine (slug)
--   jours      jours de livraison : lun … dim
--   heure      avant_6, avant_7, avant_9, matin, apres_midi
--   paiement   délai de paiement souhaité (information entre les parties, aucun paiement dans l'application) :
--              livraison, 7j, 15j, 30j
--   plus       sans_moisissure, sans_insectes, scelle, date_prod, tracabilite, controle, dechargement, reprise

alter table public.besoins add column if not exists detail jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.besoins add constraint besoins_detail_check check (jsonb_typeof(detail) = 'object' and pg_column_size(detail) < 4000);
exception when duplicate_object then null; end $$;

create or replace function public._besoin_detail(p jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare d jsonb := coalesce(p, '{}'::jsonb); r jsonb := '{}'::jsonb; k text; v jsonb; x numeric; a text[];
  enums constant jsonb := '{
    "cond": ["sac_25","sac_50","sac_100","cageot","carton","bidon_5","bidon_20","fut_200","vrac","palette"],
    "choix": ["premier","deuxieme","industriel"], "calibre": ["petit","moyen","gros","homogene"], "maturite": ["vert","tournant","mur"],
    "heure": ["avant_6","avant_7","avant_9","matin","apres_midi"], "paiement": ["livraison","7j","15j","30j"] }'::jsonb;
  listes constant jsonb := '{
    "jours": ["lun","mar","mer","jeu","ven","sam","dim"],
    "plus": ["sans_moisissure","sans_insectes","scelle","date_prod","tracabilite","controle","dechargement","reprise"] }'::jsonb;
begin
  if jsonb_typeof(d) <> 'object' then raise exception 'Exigences invalides.'; end if;
  for k, v in select * from jsonb_each(d) loop
    if v is null or v = 'null'::jsonb or v = '""'::jsonb or v = '[]'::jsonb then continue; end if;
    if enums ? k then
      if jsonb_typeof(v) <> 'string' or not (enums -> k) ? (v #>> '{}') then raise exception 'Exigence invalide : %.', k; end if;
      r := r || jsonb_build_object(k, v);
    elsif listes ? k then
      if jsonb_typeof(v) <> 'array' then raise exception 'Exigence invalide : %.', k; end if;
      select array_agg(distinct e) into a from jsonb_array_elements_text(v) e;
      if exists (select 1 from unnest(a) e where not (listes -> k) ? e) then raise exception 'Exigence invalide : %.', k; end if;
      r := r || jsonb_build_object(k, to_jsonb(a));
    elsif k in ('tolerance', 'humidite', 'recolte') then
      begin x := (v #>> '{}')::numeric; exception when others then raise exception 'Exigence invalide : %.', k; end;
      if (k = 'tolerance' and x not between 1 and 20) or (k = 'humidite' and x not between 5 and 30) or (k = 'recolte' and x not between 1 and 60) then
        raise exception '%', case k when 'tolerance' then 'Écart de quantité : entre 1 et 20 %.' when 'humidite' then 'Humidité : entre 5 et 30 %.' else 'Récolte : entre 1 et 60 jours.' end;
      end if;
      r := r || jsonb_build_object(k, case when k = 'humidite' then round(x, 1) else round(x) end);
    elsif k = 'origine' then
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[a-z0-9-]{2,60}$' then raise exception 'Exigence invalide : origine.'; end if;
      r := r || jsonb_build_object(k, v);
    elsif k = 'capacite' then
      if jsonb_typeof(v) <> 'object' then raise exception 'Exigence invalide : capacité.'; end if;
      begin x := (v ->> 'q')::numeric; exception when others then raise exception 'Capacité : indiquez une quantité.'; end;
      if x is null or x <= 0 or x >= 1e7 then raise exception 'Capacité : indiquez une quantité.'; end if;
      if coalesce(v ->> 'u', '') not in ('kg', 'tonne', 'litre', 'sac') or coalesce(v ->> 'p', '') not in ('semaine', 'mois') then
        raise exception 'Exigence invalide : capacité.';
      end if;
      r := r || jsonb_build_object(k, jsonb_build_object('q', x, 'u', v ->> 'u', 'p', v ->> 'p'));
    else
      raise exception 'Exigence inconnue : %.', k;
    end if;
  end loop;
  return r;
end $$;
revoke execute on function public._besoin_detail(jsonb) from public, anon, authenticated;

-- créer un besoin avec cases à cocher ET exigences détaillées, en un seul appel
create or replace function public.besoin_creer3(p_titre text, p_type text, p_frequence text, p_debut date, p_fin date,
  p_region text, p_ville text, p_exigences text, p_lignes jsonb, p_criteres text[], p_detail jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; dt jsonb := public._besoin_detail(p_detail);
begin
  v_id := public.besoin_creer2(p_titre, p_type, p_frequence, p_debut, p_fin, p_region, p_ville, p_exigences, p_lignes, p_criteres);
  update public.besoins set detail = dt where besoins.id = v_id and besoins.user_id = auth.uid();
  return v_id;
end $$;
revoke execute on function public.besoin_creer3(text, text, text, date, date, text, text, text, jsonb, text[], jsonb) from public, anon;
grant execute on function public.besoin_creer3(text, text, text, date, date, text, text, text, jsonb, text[], jsonb) to authenticated;

-- besoin_public renvoie aussi le détail (réécrite à partir de sa définition actuelle)
do $$
declare d text;
begin
  select pg_get_functiondef('public.besoin_public(uuid)'::regprocedure) into d;
  if position('''detail''' in d) > 0 then return; end if;
  d := replace(d, '''criteres'', b.criteres,', '''criteres'', b.criteres, ''detail'', b.detail,');
  if position('''detail''' in d) = 0 then raise exception 'besoin_public : motif introuvable'; end if;
  execute d;
end $$;
