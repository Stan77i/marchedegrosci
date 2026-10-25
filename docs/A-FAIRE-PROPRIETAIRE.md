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

Les corrections de l'audit (schémas 92 à 97a) sont faites et testées sur le projet de **test** seulement. Rien n'est en production. **Tout est expliqué dans `docs/RAPPORT-CORRECTIONS-AUDIT-2026-10.md`** (avec mon conseil pour chaque décision, partie 5).

- [x] Fusionner #297, #298, #299 (fait le 24/10/2026).
- [ ] Fusionner #300 (tests de bout en bout, schéma 97a).
- [ ] Regarder les captures des « textes en trop » (branche `claude/moins-de-texte`), dire oui ou non ; puis fusionner sa PR, puis celle du rapport.
- [ ] Donner le « OK production » pour les schémas 92 à 97a (Claude les applique ensuite lui-même, un lot après l'autre, dans l'ordre du rapport, partie 3, puis déploie la fonction `pousser` v24).
- [ ] Répondre aux décisions en attente (rapport, partie 5 : 23 points) :
  - [ ] ancienne quantité renvoyée par un téléphone : la garder sans rien dire, ou afficher « La quantité a changé, vérifiez votre annonce » (conseillé) ;
  - [ ] annonces déjà en ligne : 7 jours de grâce avant leur expiration (30 jours de vie, rappel 3 jours avant) ;
  - [ ] rôle acheteur / vendeur : simple affichage (un membre peut acheter et vendre) ou bloquer selon le rôle ;
  - [ ] litige automatique 24 h après le « livré » du vendeur, si l'acheteur ne répond pas ;
  - [ ] délais : accord sans commande 72 h, chargement 72 h, litige traité en 72 h, négociation arrêtée 24 h ;
  - [ ] valeurs des badges (3 commandes comptées par partenaire, 3 partenaires, 60 minutes) et du masquage d'une annonce (3 membres vérifiés inscrits depuis 30 jours, ou plus de masquage automatique) ; avertissement dès le premier litige perdu ;
  - [ ] lecture des messages par l'équipe (aujourd'hui sans condition) : garder ou encadrer ;
  - [ ] itinéraires de la carte : serveur public OSRM, notre serveur, ou arrêter ;
  - [ ] numéros des comptes supprimés avant le schéma 94b ; pseudo d'un membre vérifié ; Turnstile ;
  - [ ] anciennes commissions « dues » (test) et commissions d'avant le paiement intégré (jamais réclamées ?) ;
  - [ ] notifications : effacer le journal après 90 jours ; clés push pour le projet de test ;
  - [ ] essai fermé : nombre, produits, villes, durée, critères, numéro et horaires de l'équipe (`docs/essai-ferme/PLAN.md`) ;
  - [ ] les 32 questions de `docs/juridique/regles-manquantes.md`.
- [ ] Une séance avec votre téléphone : notifications, carte en 3G, réseau lent (`docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`, points 3, 4, 8, 10).
- [ ] Facultatif : accord pour retirer les index en double `sim_tmp_*` du projet de test (« drop index »).
- [ ] Trouver un juriste pour relire les textes de `docs/juridique/` (conditions, confidentialité, mentions légales) et la formalité ARTCI.
- [ ] Remplir `docs/juridique/mentions-legales.md` (éditeur, adresse, RCCM, contact).
- [ ] Démarche ARTCI (déclaration des données personnelles) : vérifier ce qui est obligatoire avec le juriste, puis la faire.

## 5. Le jour où vous aurez votre partenaire de paiement

Aucun paiement ne passe par l'application aujourd'hui, et il n'y a pas de budget. Le jour où vous aurez un partenaire (par exemple un service de Mobile Money agréé), ouvrez une discussion et écrivez « J'ai mon partenaire de paiement : <nom> » (ce que Claude fera ensuite : rapport `docs/RAPPORT-CORRECTIONS-AUDIT-2026-10.md`, partie 7). Venez avec :

- [ ] le **nom du partenaire** et sa **documentation technique** ;
- [ ] ses **clés de TEST**. Elles se mettent dans les réglages du serveur Supabase (secrets des fonctions), **jamais dans l'application** ni dans une discussion ;
- [ ] vos **décisions sur l'argent** :
  - [ ] qui paie quand (à la commande, à la confirmation, à la réception) ;
  - [ ] ce que devient l'argent en cas de litige ;
  - [ ] quand la commission devient « due » (aujourd'hui elle est seulement « calculée » et jamais réclamée) ;
  - [ ] ce qu'on fait des commissions « calculées » d'avant.

Avant de brancher le paiement, Claude refera un **audit de sécurité** (règle du projet). Rien n'est présenté comme encaissé tant que le partenaire n'est pas branché et testé.
