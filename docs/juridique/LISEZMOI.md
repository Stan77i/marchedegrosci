# Textes juridiques : PROJET

**Statut : PROJET, à faire relire par un juriste. Rien n'est en ligne.**

- Ces textes ne sont affichés nulle part : ni dans l'application, ni sur le site.
- Aucune case « J'accepte » n'est branchée à l'inscription.
- Ils ne valent pas conseil juridique. Ils décrivent le fonctionnement réel de l'application au 24/10/2026, pour que le juriste parte des faits.

## Les fichiers

| Fichier | Contenu |
|---|---|
| `conditions-utilisation.md` | Les règles entre MGCI et les membres : rôle, comptes, annonces, négociation, commande, transport, paiement, commission, annulations, litiges, responsabilité. |
| `confidentialite.md` | Les données gardées, pourquoi, qui les voit, combien de temps, les droits de chacun. |
| `mentions-legales.md` | Gabarit : éditeur, adresse, RCCM, contact, hébergeurs. Tout est à remplir. |
| `regles-manquantes.md` | Les 32 questions à trancher, avec le statut de chacune (25/10/2026). |
| `DECISIONS-A-PRENDRE.md` | Le point des 32 questions : tranchées, restantes avec un conseil, à confirmer par un juriste. Le propriétaire répond « ok pour tout » ou change un numéro. |

## Les marques dans les textes

- **[À VALIDER]** : une proposition de règle. Le propriétaire et le juriste disent oui, non, ou la changent.
- **[À VALIDER PAR LE JURISTE]** : un point de droit. Seul un juriste peut trancher.
- **[DÉCISION DU PROPRIÉTAIRE]** : la règle n'existe pas encore. Il faut la décider.
- **[À REMPLIR]** : une information que seul le propriétaire connaît (adresse, RCCM…).
- **[À VÉRIFIER AVANT PUBLICATION]** : le texte décrit une règle en cours de construction. Vérifier qu'elle est bien en service le jour de la mise en ligne.
- `<!-- source: … -->` : commentaire invisible qui dit où la règle se trouve dans le code. À garder tant que le texte est un projet ; à retirer dans la version publiée.

## Limite de la vérification

Les règles ont été lues dans les fichiers du dépôt (`supabase/schema-*.sql`, `v3/`, `app/`), pas dans la base de production. Plusieurs fichiers SQL cités disent dans leur en-tête « testé, pas encore en production » (par exemple 83a, 83c, 83d, 84a). Avant de publier, vérifier que chaque règle décrite est bien en service en production.

## Étapes avant la mise en ligne

1. Le propriétaire répond aux questions de `regles-manquantes.md`.
2. Un juriste relit les quatre textes, avec le droit ivoirien.
3. Le propriétaire vérifie la formalité auprès de l'ARTCI (protection des données, loi n° 2013-450) avec le juriste.
4. On remplit `mentions-legales.md`.
5. Ensuite seulement : afficher les textes dans l'application et sur le site, et ajouter l'acceptation à l'inscription (une PR à part, avec l'accord du propriétaire).

## Tenir à jour

Quand une règle change dans l'application (prix, commission, délai, transport…), mettre à jour ces textes dans la même PR. Une fois publiés, chaque changement suit la règle « Modification des conditions » des conditions d'utilisation.
