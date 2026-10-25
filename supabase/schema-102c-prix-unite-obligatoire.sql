-- Schéma 102c : prix à l'unité obligatoire (règle du propriétaire, 25/10/2026, validée « Ok »).
-- Projet de TEST d'abord (yowdymdnoiubatxlwhfv) ; production seulement après fusion et accord du propriétaire. À appliquer après 102b.
--
-- But : « je garde 6 sacs sur 10 » donne un montant indiscutable (quantité gardée × prix au sac). Chaque offre, demande,
-- proposition de négociation et commande porte donc un prix par unité (au sac, au kg, au carton… selon l'unité choisie).
--
-- État relevé le 25/10/2026 (lecture seule) :
--   - offres.price et demandes.budget : prix par unité, mais FACULTATIFS (« Prix à discuter », « Budget à discuter » dans
--     l'application) ; contrainte d'avant : null permis, 0 permis ;
--   - propositions de négociation (nego_agir « prix », nego_ouvrir, nego_agir2, nego_ouvrir2) : prix par unité DÉJÀ obligatoire
--     (« Indiquez un prix. », au moins 1 F, 99d) ; l'accord recopie le prix de la proposition ; messages.prix permis vide
--     (les messages « texte », « fin » n'ont pas de prix) ;
--   - commandes.prix_unitaire : permis vide (100d : null ou > 0) ; rempli en pratique (copie de negociations.prix_final, ou prix
--     de l'offre pour un achat groupé : groupe_creer refuse déjà une offre sans prix) ;
--   - lignes sans prix : TEST 0 offre sur 100 144, 0 demande sur 50 080, 0 commande sur 62 ;
--     PRODUCTION 0 offre sur 4, 1 DEMANDE ACTIVE SANS BUDGET sur 3, 0 commande sur 2, 0 message de prix sans prix,
--     0 négociation conclue sans prix.
--
-- Ce que fait ce schéma (rien n'est effacé, aucune ligne existante n'est modifiée) :
--   1. offres et demandes : un déclencheur refuse une NOUVELLE annonce sans prix (ou à moins de 1 F), et une modification qui
--      vide le prix : « PRIX_UNITE : Indiquez le prix au sac. » (l'unité de l'annonce). Choix d'un déclencheur plutôt qu'une
--      contrainte NOT VALID : une contrainte NOT VALID bloquerait TOUTE modification de la demande de production sans budget
--      (expiration automatique, retrait, pause…) ; le déclencheur ne contrôle que le prix quand il est écrit ;
--   2. messages : un message « prix » ou « accord » porte un prix (contrainte, 0 ligne fautive connue) ;
--   3. négociations : une négociation conclue porte un prix final (contrainte) ;
--   4. commandes : prix à l'unité obligatoire (contrainte).
--   Méthode des contraintes (comme 100d) : ajoutées NOT VALID (elles valent tout de suite pour les nouvelles écritures), puis
--   validées ; si des lignes existantes les violent le jour de l'application, elles restent NOT VALID (rien n'est modifié).
-- La demande de production sans budget reste telle quelle : elle se lit « Budget à discuter » jusqu'à ce que son auteur
-- la modifie (il devra alors donner un budget) ou qu'elle expire.

-- 0. « au sac », « au kg », « à la tonne »… (pour le message)
create or replace function public._prix_par_unite(p_unite text) returns text
language sql immutable set search_path = public as $$
  select case lower(btrim(coalesce(p_unite, '')))
    when 'kg' then 'au kg' when 'sac' then 'au sac' when 'carton' then 'au carton' when 'tonne' then 'à la tonne'
    when 'litre' then 'au litre' when 'régime' then 'au régime' when 'cageot' then 'au cageot' when 'unité' then 'à l''unité'
    when 'tas' then 'au tas' when 'pièce' then 'à la pièce' when 'alvéole' then 'à l''alvéole' when 'caisse' then 'à la caisse'
    when 'cagette' then 'à la cagette' when 'botte' then 'à la botte' else 'par unité' end;
$$;

-- 1. annonces : prix (offre) ou budget (demande) par unité, obligatoire à l'écriture
create or replace function public._annonce_prix_unite() returns trigger
language plpgsql security definer set search_path = public as $$
declare col text := case when tg_table_name = 'offres' then 'price' else 'budget' end;
  v numeric := (to_jsonb(new) ->> col)::numeric;
begin
  if tg_op = 'UPDATE' and v is not distinct from (to_jsonb(old) ->> col)::numeric then return new; end if;
  if v is null or v < 1 then
    raise exception 'PRIX_UNITE : Indiquez le prix %.', public._prix_par_unite(new.unit);
  end if;
  return new;
end $$;
revoke all on function public._annonce_prix_unite() from public, anon, authenticated;
create or replace trigger offres_ab_prix_unite before insert or update of price on public.offres
  for each row execute function public._annonce_prix_unite();
create or replace trigger demandes_ab_prix_unite before insert or update of budget on public.demandes
  for each row execute function public._annonce_prix_unite();

-- 2 à 4. contraintes
do $$
declare k record;
begin
  for k in select * from (values
    ('messages', 'messages_c102_prix_unite', 'genre not in (''prix'', ''accord'') or prix is not null'),
    ('negociations', 'negociations_c102_prix_conclue', 'statut is distinct from ''conclue'' or prix_final is not null'),
    ('commandes', 'commandes_c102_prix_unite', 'prix_unitaire is not null')
  ) v(t, nom, expr) loop
    if not exists (select 1 from pg_constraint where conname = k.nom and conrelid = ('public.' || k.t)::regclass) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', k.t, k.nom, k.expr);
    end if;
    begin
      execute format('alter table public.%I validate constraint %I', k.t, k.nom);
    exception when check_violation then
      raise notice 'Contrainte % laissée NOT VALID : des lignes existantes la violent.', k.nom;
    end;
  end loop;
end $$;
