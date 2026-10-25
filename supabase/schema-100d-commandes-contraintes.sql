-- Schéma 100d : la base refuse les commandes impossibles (contrôle qualité ANO-019, BDD-02, 25/10/2026).
-- Avant : la seule défense était dans les fonctions ; une écriture directe (fonction future boguée, script d'administration)
-- pouvait créer une commande avec une quantité négative ou nulle, un prix 0, un montant faux, le même compte vendeur et acheteur,
-- une commande « terminée » sans date de fin, une unité vide ; et une offre « prix ferme » à 0 F.
-- Maintenant : contraintes CHECK (les valeurs absentes restent permises, comme avant) :
--   quantité > 0 ; prix unitaire > 0 ; montant >= 0 ; montant = quantité × prix (écart d'arrondi de 1 F au plus) ;
--   vendeur différent de l'acheteur ; « terminee » => termine_le rempli ; unité non vide ; offre à prix ferme => prix > 0.
-- Lignes existantes comptées le 25/10/2026 (lecture seule) : 0 ligne fautive sur le test (62 commandes, 100 144 offres)
-- et 0 sur la production (2 commandes, 4 offres).
-- Méthode : chaque contrainte est ajoutée NOT VALID (elle vaut tout de suite pour les nouvelles écritures), puis validée ;
-- si des lignes existantes la violent le jour de l'application, elle reste NOT VALID et un avis le dit (rien n'est modifié ni effacé).
-- Appliqué sur le projet de TEST le 25/10/2026. Production : après fusion, avec l'accord du propriétaire.

do $$
declare k record;
begin
  for k in select * from (values
    ('commandes', 'commandes_c100_quantite', 'quantite is null or quantite > 0'),
    ('commandes', 'commandes_c100_prix', 'prix_unitaire is null or prix_unitaire > 0'),
    ('commandes', 'commandes_c100_montant', 'montant is null or montant >= 0'),
    ('commandes', 'commandes_c100_montant_calcul', 'montant is null or quantite is null or prix_unitaire is null or abs(montant - quantite * prix_unitaire) <= 1'),
    ('commandes', 'commandes_c100_parties', 'vendeur_id is null or acheteur_id is null or vendeur_id <> acheteur_id'),
    ('commandes', 'commandes_c100_terminee', 'etat is distinct from ''terminee'' or termine_le is not null'),
    ('commandes', 'commandes_c100_unite', 'unite is null or btrim(unite) <> '''''),
    ('offres', 'offres_c100_prix_ferme', 'negociable is distinct from false or coalesce(price, 0) > 0')
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
