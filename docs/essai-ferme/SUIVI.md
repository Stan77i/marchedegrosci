# Suivi de l'essai fermé

**Aucune donnée personnelle dans ce fichier** : pas de nom, pas de numéro, pas de pseudo. Seulement des codes (P01, P02…). La correspondance code → personne reste dans votre téléphone ou votre carnet.

Paramètres de l'essai (à remplir) :
- Ville : …
- Produits : … et …
- Début : … ; fin prévue : … (4 semaines)
- Canal d'aide et horaires : …
- **Décision de lancer** (`LANCER-EN-1-HEURE.md`, étape 0) : lancé le … par le propriétaire, conditions non cochées acceptées : …

---

## 1. Les participants

Une ligne par personne. Mettre la date (jj/mm) quand l'étape est faite, sinon laisser vide.

| Code | Rôle | Produit | Invité | Oui | Compte créé | 1re annonce | 1re proposition de prix | 1er accord | 1re commande | 1re commande clôturée | Problème vu (écran, étape) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P01 | vendeur | | | | | | | | | | |
| P02 | vendeur | | | | | | | | | | |
| P03 | vendeur | | | | | | | | | | |
| P04 | vendeur | | | | | | | | | | |
| P05 | vendeur | | | | | | | | | | |
| P06 | vendeur | | | | | | | | | | |
| P07 | vendeur | | | | | | | | | | |
| P08 | vendeur | | | | | | | | | | |
| P09 | vendeur | | | | | | | | | | |
| P10 | vendeur | | | | | | | | | | |
| P11 | acheteur | | | | | | | | | | |
| P12 | acheteur | | | | | | | | | | |
| P13 | acheteur | | | | | | | | | | |
| P14 | acheteur | | | | | | | | | | |
| P15 | acheteur | | | | | | | | | | |
| P16 | acheteur | | | | | | | | | | |
| P17 | acheteur | | | | | | | | | | |
| P18 | acheteur | | | | | | | | | | |
| P19 | acheteur | | | | | | | | | | |
| P20 | acheteur | | | | | | | | | | |

**Les abandons** se lisent dans ce tableau : la dernière case remplie d'une ligne dit où la personne s'est arrêtée. L'application ne mesure pas les abandons étape par étape (voir partie 4) : ce tableau, rempli avec ce que vous voyez et ce que les gens vous disent, est la seule source.

---

## 2. Les chiffres de chaque semaine, et où les lire

Tableau de bord : `https://stan77i.github.io/marchedegrosci/admin.html`, avec votre compte administrateur (numéro et code secret). Sur ordinateur, le menu est à gauche ; sur téléphone, en haut (onglets qui défilent).

**Important** : le tableau de bord compte **toute** la production, pas seulement l'essai. Avant de commencer, il y avait déjà quelques comptes, annonces et commandes (le 25/10/2026 : 4 offres, 3 demandes, 3 négociations, 2 commandes, 3 profils, d'après `docs/PASSATION.md`). Notez la **semaine 0** avant d'inviter, puis comptez la différence.

| Chiffre | Où cliquer dans le tableau de bord | Ce qu'on lit |
|---|---|---|
| Comptes | **Aperçu** (tuile « comptes · … cette semaine ») ou **Comptes** | nombre total ; nouveaux de la semaine |
| Annonces en ligne | **Aperçu** : tuiles « offres en ligne » et « demandes en ligne » | annonces actives maintenant |
| Annonces publiées (y compris retirées, masquées) | **Annonces** (phrase du haut : « … offres et … demandes au total ») | total depuis le début |
| Annonces des 14 derniers jours | **Aperçu** : « Le pouls du marché » | une barre par jour |
| Négociations en cours / accords | **Négociations** (phrase du haut : « … en cours, … conclues ») ; **Aperçu** : « accords conclus » | |
| Commandes | **Commandes** → bouton **Toutes** : chaque commande a son état (À confirmer, En cours, Terminée, Annulée, Litige) | compter à la main par état |
| Commandes terminées | **Commandes** → **Toutes**, étiquette « Terminée » | aussi dans `stats_publiques()` (« commandes_terminees », pas affiché dans le tableau de bord : demander à Claude) |
| Litiges | **Commandes** → **À traiter** (les litiges y arrivent, avec leur échéance) | à trancher en 72 h |
| Annulations et motifs | **Fiabilité** : « Dernières annulations », « Contestations à traiter », « Suspensions en cours » | |
| Signalements d'annonces | **À traiter** | |
| Identités à vérifier | **Identités** (et tuile de l'**Aperçu**) | après 3 annonces, un vendeur en a besoin |
| Venus par le lien de l'essai | **Visites** → 7 / 30 / 90 jours → provenances : campagnes `essai-vendeurs` et `essai-acheteurs` (ouvertures de l'application, puis connexions) | des visites, pas des personnes ; vos visites ne comptent pas |
| Notifications | **Notifications** : envoyées, ouvertes, action | pas l'affichage réel sur le téléphone |
| Questions et bugs signalés | Dans l'application : **Messages** (conversations « Écrire au Marché de Gros ») ; tableau de bord : **Messages** | compter à la main |
| Temps de l'équipe | rien d'automatique | noter à la main |

### Le relevé (une ligne par semaine)

| Semaine | Date | Comptes | Offres en ligne | Demandes en ligne | Annonces au total | Négos en cours | Accords conclus | Commandes (toutes) | Terminées | Litiges | Annulations | Ouvertures lien essai | Connexions lien essai | Bugs signalés | Heures équipe |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 (départ) | | | | | | | | | | | | | | | |
| 1 | | | | | | | | | | | | | | | |
| 2 | | | | | | | | | | | | | | | |
| 3 | | | | | | | | | | | | | | | |
| 4 (fin) | | | | | | | | | | | | | | | |

Ce qui n'est pas mesuré s'écrit **« non mesuré »**, jamais estimé.

---

## 3. Le journal de la semaine

À recopier chaque semaine ; Claude l'enregistre dans `docs/essai-ferme/journal-semaine-N.md` (modèle de `PLAN.md`, partie 10).

```
Semaine N (du … au …)
- Participants actifs : vendeurs … / acheteurs …
- Annonces publiées : … ; négociations : … ; commandes : … ; clôturées : …
- Abandons vus (et à quelle étape) :
- Litiges : … ; annulations (motifs) : … ; suspensions : …
- Temps de l'équipe (heures) : identités … / litiges … / aide … / autre …
- Problèmes techniques (écran, téléphone, réseau) :
- Demandes des participants :
- Décision de la semaine :
```

---

## 4. Ce qui n'existe pas (dit honnêtement)

- **Pas d'entonnoir des abandons** : l'application compte l'ouverture du lien et la connexion qui suit (écran **Visites**), puis plus rien étape par étape. Le tableau de la partie 1 le remplace. Claude peut aussi compter, à votre demande, par une lecture de la base (comptes sans annonce, annonces sans négociation, etc.).
- **Pas de bouton « signaler un bug »** : les participants écrivent par « Écrire au Marché de Gros » ou par votre canal d'aide. Comptez à la main.
- **Pas de nombre de commandes terminées à l'écran** : il faut compter dans **Commandes → Toutes**, ou demander le chiffre à Claude (`stats_publiques()`).
- **Pas de filtre « essai seulement »** dans le tableau de bord : d'où la semaine 0.
- **Le temps de l'équipe** et la **satisfaction** ne sont pas mesurés : journal et questionnaire.
- Les **délais** (chargement, litige) se règlent par une fonction du serveur, pas par un écran.
