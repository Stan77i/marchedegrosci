# Lancer l'essai fermé en une heure

Pour le propriétaire. Gratuit : votre téléphone, WhatsApp ou SMS de votre forfait, et un ordinateur ou un téléphone pour le tableau de bord.

**Le choix de départ** (conseil du rapport, gardé ici) : **20 personnes** (10 vendeurs et 10 acheteurs), **2 produits**, **1 ville**, **4 semaines**.

Les autres fichiers de ce dossier :
- `MESSAGES.md` : les messages à copier ;
- `GUIDE-PARTICIPANT.md` : le mode d'emploi à envoyer ;
- `SUIVI.md` : le tableau de suivi et où lire les chiffres ;
- `QUESTIONNAIRE.md` : les questions de la fin ;
- `CRITERES-DE-REUSSITE.md` : quand on peut ouvrir au public (seuils validés par vous le 25/10/2026) ;
- `PLAN.md` : le plan complet (règles, quand arrêter).

---

## Étape 0 : avant d'inviter (5 minutes)

Le plan (`PLAN.md`, partie 2) demande de cocher ces cases avant d'inviter. Voici leur état, lu dans le dépôt le 25/10/2026 :

| Condition | État |
|---|---|
| Stock rendu, commande jamais bloquée, noms réservés, numéro contesté, textes d'argent, service worker | **Fait** : schémas 92 à 96 en production depuis le 25/10/2026 |
| Litige en 1 h après « livré », quantité minimale (schémas 97b, 97c, 97d) | **Fait** : en production depuis le 25/10/2026 (PR #308). |
| Conditions d'utilisation acceptées à l'inscription | **Pas fait** : les textes sont des projets (`docs/juridique/`), aucune case dans l'application |
| Audit de sécurité refait | **Pas fait** |
| Vos décisions (délais, annonces, badges, questions juridiques) | **Prises le 25/10/2026** (« ok pour tout » : `docs/juridique/DECISIONS-A-PRENDRE.md`, PR #309). Une partie reste à construire dans l'application ; les valeurs actuelles marchent pour l'essai |
| Seuils de réussite (`CRITERES-DE-REUSSITE.md`) | **Validés le 25/10/2026** : on ne les change plus pendant l'essai |
| Une personne de l'équipe disponible chaque jour | **À vous** |

Vous avez dit « vas-y ». Si vous lancez sans les cases « Pas fait », écrivez-le dans `SUIVI.md` (case « Décision de lancer ») avec la date : c'est votre décision, et l'essai reste petit et accompagné.

---

## Étape 1 : choisir (10 minutes)

1. **La ville** : celle où vous connaissez le plus de vendeurs **et** d'acheteurs.
   - Obligatoire : tout le monde dans **la même ville**. L'application ne laisse vendre et acheter que dans la ville de l'annonce (règle « ville seulement ») : une commande vers une autre ville est refusée.
   - Abidjan compte pour une seule ville (Cocody et Yopougon, c'est la même ville).
2. **Les 2 produits** : ceux que vos contacts vendent et achètent vraiment chaque semaine. Notez leur nom tel qu'il est dans l'application :

   | Produit | Mot à mettre dans le lien |
   |---|---|
   | Igname | `igname` |
   | Banane plantain | `banane-plantain` |
   | Manioc | `manioc` |
   | Tomate | `tomate` |
   | Oignon | `oignon` |
   | Riz local | `riz-local` |
   | Maïs grain | `mais-grain` |
   | Attiéké | `attieke` |
   | Piment frais | `piment-frais` |
   | Aubergine | `aubergine` |
   | Gombo | `gombo` |

   (Les autres sont dans `site/produits/` : le nom du dossier est le mot à mettre.)
3. **Le canal d'aide** : votre numéro WhatsApp, ou seulement « Écrire au Marché de Gros » dans l'application. Un seul canal. Écrivez-le dans `MESSAGES.md` à la place de `[AIDE]`.
4. **Les horaires** où vous répondez (par exemple 8 h à 18 h). Ne promettez pas plus.

---

## Étape 2 : faire la liste (15 minutes)

Sur un papier ou dans votre téléphone (**jamais dans le dépôt** : pas de noms ni de numéros ici) :

- **10 vendeurs** du vivrier de la ville : producteurs, coopératives, grossistes. Des gens que vous connaissez ou que vous pouvez appeler.
- **10 acheteurs** de la même ville : grossistes, détaillantes du marché, restaurants, cantines.
- Donnez à chacun un code : **P01 à P10** pour les vendeurs, **P11 à P20** pour les acheteurs. Gardez la correspondance code → nom chez vous. Dans `SUIVI.md`, on n'écrit que les codes.
- Un grossiste qui vend et achète : mettez-le côté vendeur, il peut aussi acheter avec le même compte.

---

## Étape 3 : préparer les liens (5 minutes)

L'adresse de l'application est `https://stan77i.github.io/marchedegrosci/` (sur téléphone, elle ouvre l'application ; sur ordinateur, une page de maintenance avec un QR code).

Remplacez `PRODUIT` par le mot du tableau de l'étape 1 :

- **Lien vendeurs** (ouvre « J'ai » avec le produit déjà choisi) :
  `https://stan77i.github.io/marchedegrosci/?utm_source=whatsapp&utm_medium=message&utm_campaign=essai-vendeurs#/publier?sens=offre&produit=PRODUIT`
- **Lien acheteurs** (ouvre « Je cherche ») :
  `https://stan77i.github.io/marchedegrosci/?utm_source=whatsapp&utm_medium=message&utm_campaign=essai-acheteurs#/publier?sens=demande&produit=PRODUIT`

Le morceau `utm_campaign=essai-vendeurs` (ou `essai-acheteurs`) permet de compter, dans le tableau de bord (écran **Visites**), combien ont ouvert le lien puis se sont connectés. Aucune donnée personnelle n'est gardée.

Avant d'envoyer : ouvrez chaque lien sur **votre** téléphone. La fenêtre « J'ai » (ou « Je cherche ») doit s'ouvrir avec le produit. Fermez-la sans publier.

---

## Étape 4 : inviter les vendeurs d'abord (20 minutes)

Les acheteurs doivent trouver des offres en arrivant.

1. Envoyez à chaque vendeur, un par un, le message **« Invitation vendeur »** de `MESSAGES.md` (avec son lien).
2. Quand il dit oui, envoyez la **version courte du guide** (`GUIDE-PARTICIPANT.md`, en haut).
3. Mieux : appelez-le, ou passez le voir, et faites la première annonce avec lui (comment installer : `GUIDE-PARTICIPANT.md`, partie 1).
4. Notez dans `SUIVI.md` : code, rôle, produit, date d'invitation.

**Invitez les acheteurs quand au moins 5 offres réelles sont en ligne** (2 ou 3 jours plus tard). Même méthode, avec le message « Invitation acheteur ».

---

## Étape 5 : votre compte administrateur (5 minutes)

- Ouvrez `https://stan77i.github.io/marchedegrosci/admin.html` et connectez-vous avec votre compte administrateur (numéro et code secret).
- **Notez les chiffres de départ** dans `SUIVI.md` (semaine 0) : la production a déjà quelques comptes et annonces d'avant l'essai. On comptera la différence.
- Vérifiez que vous recevez les messages : dans l'application, **Messages** (les participants vous écrivent par « Écrire au Marché de Gros »).

---

## Le jour 1 de chaque participant

Pour chaque vendeur :
1. il installe l'application et crée son compte ;
2. il **note son code de secours** (12 caractères, montré une seule fois) ;
3. il publie une offre réelle : produit, quantité, prix, ville ;
4. il active les notifications : menu → **Réglages** → **Activer les notifications** (sur iPhone, seulement après « Sur l'écran d'accueil »).

Pour chaque acheteur : les mêmes étapes avec « Je cherche », puis il regarde les offres et touche **Proposer un prix** sur l'une d'elles.

Suivez **la première vente de chaque vendeur et le premier achat de chaque acheteur jusqu'à la réception** (règle du plan). Notez ce qui bloque, avec l'écran.

---

## Chaque semaine (30 minutes, le même jour)

1. Ouvrez le tableau de bord et relevez les chiffres : `SUIVI.md`, partie 2, dit où cliquer.
2. Remplissez le tableau des participants (`SUIVI.md`, partie 1).
3. Écrivez le journal de la semaine (`SUIVI.md`, partie 3), puis demandez à Claude de l'enregistrer dans `docs/essai-ferme/journal-semaine-N.md`.
4. Envoyez les messages prévus : **rappel J+3**, **avis J+7** (`MESSAGES.md`).
5. Un problème grave (fuite de données, quelqu'un trompé, commande bloquée sans issue) : **arrêtez l'essai** (`PLAN.md`, partie 9) et envoyez le message « Pause de l'essai ».

| Semaine | Ce qui se passe |
|---|---|
| 0 | Vendeurs invités, premières offres |
| 1 | Acheteurs invités, premières négociations et commandes, suivies pas à pas |
| 2 et 3 | Les participants font seuls ; vous regardez et aidez |
| 4 | Questionnaire, bilan, décision |

---

## La fin (semaine 4)

1. Envoyez le message **« Fin de l'essai »** avec le lien du questionnaire (`QUESTIONNAIRE.md` : à copier dans un Google Forms gratuit).
2. Relevez les chiffres une dernière fois.
3. Remplissez la grille de `CRITERES-DE-REUSSITE.md` avec les seuils validés le 25/10/2026 (au moins 10 commandes clôturées, 5 vendeurs et 5 acheteurs différents, 0 commande bloquée, litiges en 72 h ou moins…). Un critère obligatoire manqué : on corrige d'abord.
4. Décidez : **on ouvre au public** ou **on corrige d'abord**. Écrivez la décision et la date dans `SUIVI.md`.
5. Dites aux participants ce que vous avez décidé. Leurs comptes et leurs annonces restent.
