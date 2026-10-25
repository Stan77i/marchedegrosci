# À faire par le propriétaire

Les petites choses que seul le propriétaire peut faire (réglages de comptes, décisions). Claude les rappelle au début d'une discussion ; une ligne faite est cochée puis retirée.

## 1. Autoriser le serveur de l'application dans l'environnement Claude (2 minutes, gratuit)

**Pourquoi** : aujourd'hui, l'ordinateur de travail de Claude ne peut pas joindre le serveur de l'application (Supabase). Il voit donc l'application sans données et sans compte, et ne peut vérifier à l'écran ni les commandes, ni les négociations, ni les messages : seulement dans le code.

**Comment** :
1. Dans une discussion Claude Code, en haut de l'écran, touchez le **nom de l'environnement**, puis **Modifier**.
2. Dans **Accès réseau**, choisissez **Limité** (ou **Personnalisé** si c'est ce qui est proposé).
3. Dans **Domaines autorisés**, ajoutez exactement : `catmsypctymgkjkfzdkt.supabase.co`
4. Laissez cochée la case « Autoriser les gestionnaires de paquets ». Enregistrez.
5. Ouvrez une **nouvelle** discussion et écrivez « serveur autorisé » : Claude vérifiera que ça répond.

Guide officiel (en anglais) : https://code.claude.com/docs/en/cloud-environments#network-access

- [ ] Fait

## 2. Un compte de test pour que Claude se connecte (après l'étape 1)

**Pourquoi** : pour ouvrir les écrans avec compte et finir l'audit à l'écran (point n° 59 et les fenêtres vérifiées seulement dans le code : `docs/anti-slop/audit-001-2026-10-24.md`).

**Comment** : on le décide ensemble le jour venu, de la façon la plus sûre (un compte créé exprès, jamais votre compte à vous). **Ne jamais écrire un code secret dans la discussion.**

- [ ] Fait

## 3. Coller une ligne dans Supabase (notifications, 1 minute)

**Pourquoi** : retirer un droit inutile sur trois tables (alertes, alertes_produits, zones). L'outil de Claude refuse ce mot (« truncate »), il faut le coller à la main. Rien n'est effacé.

**Comment** : Supabase → projet de production `catmsypctymgkjkfzdkt` → **SQL Editor** → coller la ligne ci-dessous → **Run**. Puis dire « 88c collé » : Claude vérifiera.

```
revoke truncate on public.alertes, public.alertes_produits, public.zones from authenticated;
```

- [x] Fait (24/10/2026, vérifié par Claude : la permission est retirée sur les trois tables)


## 4. Corrections de l'audit : la production et les décisions (24/10/2026)

Les corrections de l'audit (schémas 92 à 96, plus 97a) sont **en production depuis le 25/10/2026**, avec la fonction `pousser` v24. Les schémas 97b, 97c, 97d, 98a et 98b (litige en 1 h, quantité minimale, suppression du compte, suspension) sont aussi **en production depuis le 25/10/2026**, avec `pousser` v25.

Les schémas 99 à 101 (corrections du contrôle qualité, journal de l'équipe, durées de conservation) sont **en production depuis le 25/10/2026** (« Allons directement dans la production »), sauf 101c et 101z (ils attendent la PR #321 des écrans) et 101e (à coller par vous, partie 4 ter).

- [x] Donner le « OK production » pour les schémas 99 à 101 (fait le 25/10/2026 ; Claude a appliqué 99a à 99d, 100a à 100f, 101a, 101b, 101d, puis redéployé `pousser`).

- [x] Donner le « OK production » pour les schémas 92 à 96 (fait le 25/10/2026 ; Claude les a appliqués avec 97a, puis a déployé `pousser` v24).
  - [x] litige automatique après le « livré » du vendeur : tranché le 25/10/2026 (1 h, puis clôture en faveur du vendeur, schéma 97b) ;
  - [x] valeurs des badges et du masquage d'une annonce (point C) : gardées, tranché le 25/10/2026 (« ok pour tout ») ;
  - [x] lecture des messages par l'équipe : tranché le 25/10/2026 (l'équipe peut tout lire ; écrit dans les textes) ;
  - [x] les 15 questions restantes des 32 de `docs/juridique/regles-manquantes.md` : tranchées le 25/10/2026 (« ok pour tout »).
- [x] Donner le « OK production » pour les schémas 97b à 98b (fait le 25/10/2026 : « C'EST FAIT, MET EN PRODUCTION » ; Claude les a appliqués, puis a déployé `pousser` v25).
- [x] Répondre aux décisions en attente : **fait le 25/10/2026, « ok pour tout »** (détail et ce qui reste à construire : `docs/juridique/DECISIONS-A-PRENDRE.md`) :
  - [x] annonces déjà en ligne : 7 jours de grâce gardés (point A) ;
  - [x] rôle acheteur / vendeur : simple affichage, tout membre peut acheter et vendre (point B) ;
  - [x] litige automatique après le « livré » du vendeur : 1 h (schéma 97b) ;
  - [x] valeurs des badges et du masquage : gardées (point C) ;
  - [x] lecture des messages par l'équipe : l'équipe peut tout lire ;
  - [x] les 32 questions de `docs/juridique/regles-manquantes.md` ;
  - [x] numéros des comptes supprimés avant le 25/10/2026 : libérés sur demande, avec « Numéro contesté » (point D).
- [ ] Trouver un juriste : d'abord une aide gratuite (clinique juridique d'une faculté de droit, chambre de commerce), décision du 25/10/2026. Il relit les textes de `docs/juridique/` (conditions, confidentialité, mentions légales) et la formalité ARTCI.
- [ ] Remplir `docs/juridique/mentions-legales.md` (éditeur, adresse, RCCM, contact).
- [ ] Démarche ARTCI (déclaration des données personnelles) : vous, avec le juriste, **avant l'ouverture au public** (décision du 25/10/2026).

## 4 ter. Coller le fichier « 101e » dans Supabase (5 minutes, gratuit)

**Pourquoi** : c'est la dernière pièce des durées de conservation que vous avez acceptées (« ok pour tout », décision n° 22) : journal des notifications après 90 jours, photos de preuve après 1 an, signalements et sanctions après 2 ans, commandes et négociations après 5 ans. L'outil de Claude refuse tout texte qui contient le mot « supprimer » en anglais : vous seul pouvez le coller. **Coller le fichier n'efface rien sur le moment** : c'est la tâche de nuit (2 h 41) qui s'en sert. Aujourd'hui, en production, rien n'est assez vieux : rien ne partira avant le 22/01/2027.

**Comment** (d'abord le projet de TEST, puis la PRODUCTION) :
1. Sur GitHub, ouvrez le dépôt `Stan77i/marchedegrosci`, puis le dossier **supabase**, puis le fichier **schema-101e-conservation-effacer-a-coller.sql**.
2. En haut à droite du texte, touchez le bouton **Copier** (deux petits carrés) : tout le fichier est copié.
3. Ouvrez https://supabase.com/dashboard et choisissez le projet de **test** : **mgci-test** (`yowdymdnoiubatxlwhfv`).
4. Dans la colonne de gauche, touchez **SQL Editor**, puis **New query** (nouvelle requête).
5. Collez le texte dans la grande zone blanche, puis touchez **Run** (en bas à droite).
6. Si Supabase affiche un avertissement (« opération destructive » ou « potential issue »), touchez **Run this query** pour confirmer : le fichier ne fait que créer une fonction, rien n'est effacé à ce moment.
7. Le résultat doit dire **Success. No rows returned**.
8. Écrivez à Claude « 101e collé sur le test » : il relance les essais du fichier `supabase/tests/juridique-101-scenarios.sql` et vous dit si tout va bien.
9. Ensuite seulement, refaites les étapes 3 à 7 avec le projet de **production** : **mgci** (`catmsypctymgkjkfzdkt`). Puis écrivez « 101e collé en production » : Claude vérifiera (lecture seule).

- [ ] Collé sur le test
- [ ] Collé en production

## 4 bis. Lancer l'essai fermé (une heure, gratuit)

Tout est prêt dans `docs/essai-ferme/`. Commencez par **[LANCER-EN-1-HEURE.md](essai-ferme/LANCER-EN-1-HEURE.md)** : étapes numérotées, messages à copier (`MESSAGES.md`), guide à envoyer (`GUIDE-PARTICIPANT.md`), suivi (`SUIVI.md`), questionnaire (`QUESTIONNAIRE.md`), critères (`CRITERES-DE-REUSSITE.md`). Conseil : 20 personnes (10 vendeurs, 10 acheteurs), 2 produits, 1 ville, 4 semaines.

- [x] Valider ou changer les seuils de `CRITERES-DE-REUSSITE.md` (validés le 25/10/2026 : « ok pour tout »)
- [ ] Choisir la ville, les 2 produits, le canal d'aide et les horaires
- [ ] Décider de lancer malgré les cases « Pas fait » de l'étape 0 (conditions d'utilisation, audit de sécurité), ou attendre
- [ ] Lancer l'essai fermé

## 5. Le jour où vous aurez votre partenaire de paiement

Aucun paiement ne passe par l'application aujourd'hui, et il n'y a pas de budget. Le jour où vous aurez un partenaire (par exemple un service de Mobile Money agréé), revenez dans une discussion avec :

- [ ] le **nom du partenaire** et sa **documentation technique** ;
- [ ] ses **clés de TEST**. Elles se mettent dans les réglages du serveur Supabase (secrets des fonctions), **jamais dans l'application** ni dans une discussion ;
- [ ] vos **décisions sur l'argent** :
  - [ ] qui paie quand (à la commande, à la confirmation, à la réception) ;
  - [ ] ce que devient l'argent en cas de litige ;
  - [ ] quand la commission devient « due » (aujourd'hui elle est seulement « calculée » et jamais réclamée) ;
  - [ ] ce qu'on fait des commissions « calculées » d'avant.

Avant de brancher le paiement, Claude refera un **audit de sécurité** (règle du projet). Rien n'est présenté comme encaissé tant que le partenaire n'est pas branché et testé.
