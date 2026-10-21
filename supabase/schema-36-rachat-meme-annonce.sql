-- ═════════ Marché de Gros CI — schéma 36 : racheter sur la même annonce ═════════
-- Décidé par le propriétaire le 21/10/2026 (« OUI vas y »). Appliqué par Claude avec l'outil Supabase.
-- Aucune donnée effacée : on remplace une RÈGLE, pas des lignes.
--
-- Avant : contrainte unique (cible, cible_id, auteur_id) → un acheteur n'avait qu'UNE négociation par annonce, pour toujours.
-- Après : index unique partiel → une seule négociation OUVERTE à la fois par acheteur et par annonce ;
--         une fois conclue ou terminée, il peut en ouvrir une nouvelle (racheter). L'historique reste entier.
-- Ordre : la nouvelle règle est créée AVANT de retirer l'ancienne (aucun instant sans protection).
-- Retour arrière possible tant qu'aucun acheteur n'a deux négociations sur la même annonce :
--   alter table public.negociations add constraint negociations_cible_cible_id_auteur_id_key unique (cible, cible_id, auteur_id);

create unique index if not exists negociations_une_ouverte on public.negociations (cible, cible_id, auteur_id) where statut = 'ouverte';
create index if not exists negociations_cible_auteur on public.negociations (cible, cible_id, auteur_id, created_at desc);
alter table public.negociations drop constraint if exists negociations_cible_cible_id_auteur_id_key;

-- Les fonctions qui supposaient « une seule négociation » sont réécrites à partir de leur définition actuelle :
do $$
declare d text;
begin
  -- nego_ouvrir : reprend la négociation OUVERTE s'il y en a une, sinon en crée une nouvelle
  select pg_get_functiondef('public.nego_ouvrir(text, uuid, numeric, numeric, text)'::regprocedure) into d;
  d := replace(d, 'on conflict on constraint negociations_cible_cible_id_auteur_id_key do nothing',
                  'on conflict (cible, cible_id, auteur_id) where statut = ''ouverte'' do nothing');
  d := replace(d, 'g.cible_id = nego_ouvrir.cible_id and g.auteur_id = me; end if;',
                  'g.cible_id = nego_ouvrir.cible_id and g.auteur_id = me and g.statut = ''ouverte''; end if;');
  -- les paramètres « cible » et « cible_id » portent le nom des colonnes : sans cette directive, la cible du conflit est ambiguë
  if position('#variable_conflict' in d) = 0 then d := regexp_replace(d, 'AS \$function\$\s*', E'AS $function$\n#variable_conflict use_column\n'); end if;
  if position('where statut = ''ouverte'' do nothing' in d) = 0 or position('g.statut = ''ouverte''; end if;' in d) = 0 then raise exception 'nego_ouvrir : motif introuvable'; end if;
  execute d;

  -- recommande_preparer : seule une négociation ouverte compte ; plus jamais « bloquée »
  select pg_get_functiondef('public.recommande_preparer(uuid)'::regprocedure) into d;
  d := replace(d, '(select g.statut from public.negociations g where g.cible = ''offre'' and g.cible_id = o.id and g.auteur_id = auth.uid()) deja_statut',
                  '(select g.statut from public.negociations g where g.cible = ''offre'' and g.cible_id = o.id and g.auteur_id = auth.uid() and g.statut = ''ouverte'' limit 1) deja_statut');
  d := replace(d, '(select g.id from public.negociations g where g.cible = ''offre'' and g.cible_id = o.id and g.auteur_id = auth.uid()) deja_id',
                  '(select g.id from public.negociations g where g.cible = ''offre'' and g.cible_id = o.id and g.auteur_id = auth.uid() and g.statut = ''ouverte'' limit 1) deja_id');
  if position('and g.statut = ''ouverte'' limit 1) deja_id' in d) = 0 then raise exception 'recommande_preparer : motif introuvable'; end if;
  execute d;

  -- besoin_public : ma proposition = l'ouverte, sinon la plus récente
  select pg_get_functiondef('public.besoin_public(uuid)'::regprocedure) into d;
  d := replace(d, '''ma_nego'', (select g.id from public.negociations g where g.cible = ''demande'' and g.cible_id = d.id and g.auteur_id = auth.uid())',
                  '''ma_nego'', (select g.id from public.negociations g where g.cible = ''demande'' and g.cible_id = d.id and g.auteur_id = auth.uid() order by (g.statut = ''ouverte'') desc, g.created_at desc limit 1)');
  if position('order by (g.statut = ''ouverte'') desc, g.created_at desc limit 1)' in d) = 0 then raise exception 'besoin_public : motif introuvable'; end if;
  execute d;
end $$;
