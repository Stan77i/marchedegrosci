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

Les corrections de l'audit (schémas 92 à 96, plus 97a) sont **en production depuis le 25/10/2026**, avec la fonction `pousser` v24. Les schémas 97b et 97c restent sur le projet de test.

- [x] Donner le « OK production » pour les schémas 92 à 96 (fait le 25/10/2026 ; Claude les a appliqués avec 97a, puis a déployé `pousser` v24).
- [ ] Répondre aux décisions en attente :
  - [ ] annonces déjà en ligne : 7 jours de grâce avant leur expiration (30 jours de vie, rappel 3 jours avant) ;
  - [ ] rôle acheteur / vendeur : simple affichage (un membre peut acheter et vendre) ou bloquer selon le rôle ;
  - [ ] litige automatique 24 h après le « livré » du vendeur, si l'acheteur ne répond pas ;
  - [ ] valeurs des badges (3 commandes comptées par partenaire, 3 partenaires, 60 minutes) et du masquage d'une annonce (3 membres vérifiés inscrits depuis 30 jours, ou plus de masquage automatique) ;
  - [ ] lecture des messages par l'équipe (aujourd'hui sans condition) : garder ou encadrer ;
  - [ ] les 32 questions de `docs/juridique/regles-manquantes.md`.
- [ ] Trouver un juriste pour relire les textes de `docs/juridique/` (conditions, confidentialité, mentions légales) et la formalité ARTCI.
- [ ] Remplir `docs/juridique/mentions-legales.md` (éditeur, adresse, RCCM, contact).
- [ ] Démarche ARTCI (déclaration des données personnelles) : vérifier ce qui est obligatoire avec le juriste, puis la faire.

## 4 bis. Lancer l'essai fermé (une heure, gratuit)

Tout est prêt dans `docs/essai-ferme/`. Commencez par **[LANCER-EN-1-HEURE.md](essai-ferme/LANCER-EN-1-HEURE.md)** : étapes numérotées, messages à copier (`MESSAGES.md`), guide à envoyer (`GUIDE-PARTICIPANT.md`), suivi (`SUIVI.md`), questionnaire (`QUESTIONNAIRE.md`), critères (`CRITERES-DE-REUSSITE.md`). Conseil : 20 personnes (10 vendeurs, 10 acheteurs), 2 produits, 1 ville, 4 semaines.

- [ ] Valider ou changer les seuils de `CRITERES-DE-REUSSITE.md` (avant le premier jour)
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
