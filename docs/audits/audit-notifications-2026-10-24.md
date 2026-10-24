# Audit des notifications (24/10/2026)

Demande du propriétaire du 24/10/2026 : auditer puis développer les notifications pour aider la rétention, les achats, les ventes et les approvisionnements.

Méthode : lecture du code (`supabase/functions/pousser/index.ts`, `sw.js`, `v3/pousse.js`, `app/theme.js`, `v3/alertes.js`, `v3/compte.js`) et de la base. Production `catmsypctymgkjkfzdkt` en **lecture seule** (requêtes `select` seulement). Le navigateur de l'environnement ne joint pas Supabase : aucun écran connecté n'a été vu et aucun push n'a été reçu ici.

## 1. Ce qui existe et marche

**Envoi.** 18 déclencheurs SQL `push_*` appellent la fonction Edge `pousser` (version 20 en production) par `pg_net`. Elle envoie en Web Push (clés VAPID dans le coffre, gratuit). Les 19 réponses gardées par `net._http_response` (24/10, 9 h 55 à 15 h 47 UTC) sont toutes en HTTP 200. Les envois marketing répondent `{"comptes":1,"envoyees":2}` : le serveur envoie bien. La réception sur le téléphone n'est pas vérifiable d'ici.

**Événements déjà couverts.**
- Réponse de négociation (prix, accord, refus, retrait, fin, texte), message direct, litige, demande de code (le code n'est jamais dans la notification).
- 14 étapes de commande, missions de transport, profil transporteur.
- Achat groupé : proposé, ouvert, nouvel acheteur, seuil atteint (vendeur), à confirmer (48 h), confirmé, expiré, annulé, prix changé.
- Fiabilité (sanction, contestation), niveaux et badges, identité (admin).
- Annonce d'un produit suivi (`alertes_produits`), besoin d'un professionnel (vendeurs qui ont une offre active du produit + suiveurs).
- Rappel d'achat choisi par l'acheteur (`rappels_achat`, tâche toutes les 15 min) : « Racheter … ? », rien n'est commandé.
- Conseils et chiffres du marché (`marketing_tick`, 7 h à 21 h, 30 par jour au plus).

**Téléphone.** `v3/pousse.js` lit la vraie permission et le vrai abonnement, gère l'iPhone non installé, réabonne à chaque connexion, désabonne à la déconnexion. `sw.js` affiche une seule notification par sujet (contournement iPhone documenté).

**Ouverture à froid.** Les 14 formes d'adresse envoyées ont un écran qui les lit (`?nego=`, `?dm=`, `?commande=`, `?groupe=`, `?besoin=`, `?racheter=`, `?chauffeur=1`, `?fiabilite=1`, `?niveaux=1`, `#/produits/<slug>`, etc.). Lecture du code seulement.

**Sécurité.** Fonctions `security definer` avec `search_path` fixé. `push_abonnements` : lecture de ses lignes seulement, écriture par fonctions. `notif_reglages`, compteurs du jour, `rappels_achat` : aucun accès direct. Aucun numéro ni nom complet dans les textes (`nomDe`). L'auteur ne reçoit pas sa propre annonce.

**Production mesurée (24/10/2026).** 4 comptes, 3 profils actifs ; 2 abonnements push pour 1 seul compte ; `alertes_produits` 0, `notif_reglages` 0, `rappels_achat` 0, `groupes_achat` 0 ; offres 4, demandes 3, commandes 2 ; `push_marketing_jour` total 118 (22/10 : 59 pour 2 comptes ; 23/10 : 37 ; 24/10 : 22 pour 1 compte).

## 2. Défauts trouvés

Vérifiés moi-même en production (lecture) ou dans le code :

1. **Les annonces du marché ne partent jamais.** `push_annonce()` sort tout de suite s'il n'y a aucun suiveur du produit. L'étape « annonce à tous les abonnés » (décision du 22/10, schéma 43) n'est donc jamais atteinte. Avec 0 ligne dans `alertes_produits`, aucune annonce du marché n'est partie (0 ligne dans `push_annonce_jour`).
2. **Le prix affiché dans les conseils mélange les unités.** La fourchette « Aubergine : de 1 000 à 25 000 F / kg » vient de `index.ts` l.441-443 : les prix d'un produit sont réunis sans tenir compte de l'unité (kg, sac…), et l'unité affichée est celle de la dernière offre lue. Les chiffres sont réels mais le message est faux.
3. **Le clic ne mène pas toujours au bon écran.** Si l'application est déjà ouverte, `#/produits/<slug>`, `#/catalogue`, `#/vendre`, `#/demande`, `#/prix`, `#/annee`, `#/carte` et `#/` ne font que remettre l'application au premier plan (aucun écouteur de `mdg-lien` pour ces adresses). Les liens `admin.html#…` ne s'ouvrent pas si une fenêtre de l'application existe. Les boutons « Répondre » et « Voir la proposition » font la même chose que la notification elle-même.
4. **Sans connexion, l'écran demandé est perdu.** Les modules réessaient pendant 6 s puis abandonnent, et l'adresse est déjà nettoyée.
5. **Trop de messages commerciaux.** Jusqu'à 30 conseils par jour et 10 diffusions par jour, soit 40, sans compter les alertes produit, qui n'ont pas de plafond. Les 22 et 23/10, un compte a reçu 30 conseils par jour. Les conseils sont les mêmes pour tout le monde (un acheteur reçoit « Vendez en direct »).
6. **Un seul réglage.** `notif_reglages.diffusions` coupe à la fois les annonces, les groupes, les besoins et les conseils. On ne peut pas couper les conseils et garder les offres. Les alertes produit et les suiveurs d'un besoin ne passent pas par ce réglage.
7. **Pas de journal, pas de protection contre les doublons, pas de statistiques.** Aucune table d'envois. Le clic n'est pas signalé. Les désabonnements (y compris le retrait automatique sur 404/410) ne laissent aucune trace. Les déclencheurs taisent toutes leurs erreurs. Le compteur de 10 par jour est augmenté avant l'envoi : un envoi raté le consomme quand même.
8. **Étiquettes partagées.** `cmd-<id>` sert à la confirmation, à la demande de code et à la mission : une demande de code peut être effacée par la notification suivante.
9. **La zone n'est jamais utilisée.** `region_slug` et `ville` existent sur `profils`, `offres`, `demandes`, `besoins` et `groupes_achat`, mais aucun envoi ne s'en sert.
10. **Achat groupé.** « Seuil atteint » est envoyé au vendeur seulement, pas aux acheteurs inscrits. Rien n'est envoyé quand le groupe approche du seuil.
11. **Promesses non vérifiées dans les textes.** « Ils sont prévenus tout de suite », « payez moins cher » (4 fois), « un profil vérifié inspire confiance… », « Une notification d'essai arrive » (affiché sans attendre le résultat de l'essai). 12 corps de message dépassent 80 caractères (jusqu'à 118).
12. **Même priorité pour tout.** `urgency: high` et TTL de 24 h pour tout, y compris les conseils.
13. **Droits trop larges.** En production, `authenticated` a le droit TRUNCATE sur `alertes`, `alertes_produits` et `zones` (vérifié). PostgREST ne donne pas accès à TRUNCATE, donc le risque est faible, mais ce droit ne sert à rien.
14. **Le test ne reflète pas la production.** `service_role` a moins de droits en production qu'en test. Le projet de test n'a aucun secret `mdg_*` : aucun push n'y part. Toute écriture nouvelle doit donc passer par une fonction `security definer`.
15. **Liste interne locale.** La liste « Notifications » de Mon espace est stockée dans `localStorage` et ne reçoit que les négociations. Toucher une autre entrée ne fait que la marquer comme lue.
16. **Invitation à activer les notifications** : proposée une seule fois dans la vie de l'appareil.

## 3. Ce qui manque, face aux 10 demandes

| # | Demande | État |
|---|---|---|
| 1 | Auditer l'existant | Fait (ce document). |
| 2 | Événements réels | Faits : réponse, commande, groupe (statuts), produit suivi, besoin pro. **Manquent** : annonces du marché (défaut 1) ; demande simple → vendeurs qui vendent ou ont vendu ce produit ; groupe proche du seuil (80 %) et seuil atteint pour les acheteurs ; approvisionnement à renouveler proposé d'après les commandes terminées. |
| 3 | Personnalisation | **Manque** presque tout : la zone, le rôle (`profils.role`), les produits achetés et vendus, l'activité. Seuls les produits suivis et l'identité vérifiée (besoins) sont utilisés. |
| 4 | Messages courts et vrais | **À reprendre** : 12 textes trop longs, promesses non vérifiées, fourchette de prix fausse. |
| 5 | Transactionnel séparé du commercial | **Manque** : aucune catégorie dans l'envoi. |
| 6 | Préférences, fréquence, regroupement, doublons | **Manque** : un seul réglage, pas de plafond par personne pour les alertes, pas de résumé, pas de clé anti-doublon. |
| 7 | Ouvrir le bon écran | Fait à froid. **À corriger** quand l'application est déjà ouverte, pour l'administrateur et sans connexion. Certains conseils ouvrent l'accueil. |
| 8 | Droits, vie privée, RLS | Bon dans l'ensemble. **À corriger** : TRUNCATE à retirer ; les nouvelles tables doivent suivre les mêmes règles. |
| 9 | Statistiques | **Manque** tout. |
| 10 | Rien de payant, aucune fausse promesse sur le push | Rien de payant. **À corriger** : le message d'essai annonce une arrivée sans vérifier. |

## 4. Plan de construction retenu

Tout est gratuit : Postgres, `pg_net`, `pg_cron`, Web Push. Tout est construit et testé sur le projet de test, puis appliqué en production. Un fichier `supabase/schema-86-notifications.sql`. Aucun `drop`, `delete` ni `truncate` dans le SQL.

### 4.1 Catégories (dans chaque envoi)
Chaque charge porte `cat`, `nature` (`trans` ou `com`) et `nid`.
- **Transactionnel** : `reponses` (messages directs), `negociation`, `commande` (avec missions et code), `litige`, `fiabilite`, `niveaux`, `securite` (identité, alertes admin), `groupe_suivi` (groupe que l'on a rejoint ou que l'on vend), `rappel` (rappel choisi par l'acheteur).
- **Commercial** : `offres` (nouvelles offres et demandes du marché, produits suivis compris), `pour_vendeur` (demandes et besoins pour ce que l'on vend), `groupes` (groupes ouverts près de soi), `renouveler` (proposition calculée), `conseils` (marketing).
- Transactionnel : `urgency: high`, TTL de 24 h. Commercial : `urgency: normal` (`low` pour les conseils), TTL de 6 h.

### 4.2 Préférences par catégorie (côté serveur)
- Nouvelle table `notif_prefs(user_id, cat, actif, maj_le)`, RLS activée, sans politique, accès par fonctions `notif_prefs_moi()` et `notif_pref_regler(cat, actif)`. Pas de ligne = valeur par défaut.
- **Ne se coupent pas** (seul le désabonnement du téléphone les arrête) : `negociation`, `commande`, `litige`, `securite`, `reponses`. Se coupent : `fiabilite`, `niveaux`, `groupe_suivi`, `rappel` et tout le commercial.
- Reprise de l'ancien réglage : `diffusions = false` coupe `offres`, `groupes`, `pour_vendeur` et `conseils`. `notif_reglage_diffusions` reste en service et règle ces 4 catégories.
- Écran Réglages : une ligne par catégorie (interrupteur), plus le bouton « Envoyer un essai » qui affiche le vrai résultat.

### 4.3 Fréquence, heures calmes, regroupement, doublons
- **Plafond commercial : 6 par personne et par jour**, toutes catégories commerciales ensemble. Dont **conseils : 1 par jour au plus**, et seulement si la personne n'a reçu aucun autre message commercial ce jour-là. *À valider : la décision du 22/10 fixait 30 conseils par jour ; la réponse prudente retenue est 1, à cause du risque de désabonnement mesuré (30 par jour pour un seul compte).* `marketing_reglage.max_jour` reste réglable par l'administrateur.
- **Plafond transactionnel** : aucun, mais une rafale sur le même sujet (même `nego-<id>` ou `dm-<id>` en moins de 2 min) remplace la notification au lieu d'en ajouter une.
- **Heures calmes** : pas de commercial entre 21 h et 7 h (heure d'Abidjan = UTC). Le transactionnel part toujours.
- **Regroupement** : les nouvelles offres du même produit pour une même personne sont réunies. Une tâche toutes les 15 min envoie « 3 nouvelles offres de tomate près de vous » avec une seule étiquette `offres-<slug>`.
- **Anti-doublon** : `notif_journal.cle` unique (par exemple `groupe80:<id>:<user>`, `annonce:<id>:<user>`, `cmd:<etape_id>:<user>`). Si l'insertion est refusée, rien ne part.
- Le quota est compté **après** un envoi réussi.
- Étiquettes distinctes par événement de commande (`cmd-<id>-code`, `cmd-<id>-mission`…).

### 4.4 Journal, ouverture, action, désactivation
- Table `notif_journal(id, nid uuid aléatoire, user_id, cat, nature, type, objet_id, cle unique, url, cree_le, envoye_le, resultat, ouvert_le, action_le, action)`. RLS : chacun **lit** ses lignes ; écriture par fonctions seulement (`notif_noter`, `notif_resultat`, réservées à `service_role`, `security definer`, car en production `service_role` n'a pas les droits directs).
- **Ouverture** : au clic, `sw.js` appelle la fonction `notif_ouverte(nid)`, ouverte à `anon` (le `nid` est un uuid aléatoire, non devinable, qui ne contient aucune donnée personnelle ; seul le premier clic compte). L'adresse ouverte porte aussi `&n=<nid>`.
- **Action et conversion**, calculées côté serveur par la tâche de statistiques : après une ouverture, une proposition, une commande, une offre publiée ou un groupe rejoint par la même personne **dans les 24 h** et sur le même objet ou produit.
- **Désactivations** : table `notif_desactivations(user_id, quand, origine)` : `desabonnement` (`push_desabonner`), `expire` (404/410 côté Edge), `preference:<cat>`, `permission` (l'application voit que la permission est passée à « refusée » alors qu'un abonnement existait).
- Mesure impossible et non prétendue : l'affichage réel sur l'écran et la notification balayée sans clic.
- Rétention : 90 jours, puis effacement par une tâche (purge ajoutée seulement **avec l'accord du propriétaire**, car c'est un `delete` ; d'ici là, rien n'est effacé).

### 4.5 Écran de statistiques (administrateur)
Fonction `notif_stats(jours)`, vérification `est_admin()`, **totaux seulement** par catégorie : envoyées, échecs, ouvertes (taux), actions, désactivations. Une vue dans `admin.html` (« Notifications »). Aucun nom ni numéro.

### 4.6 Événements à brancher ou à corriger
- **Annonces du marché** : corriger `push_annonce()` pour qu'elle appelle aussi l'envoi quand personne ne suit le produit. La cible devient : suiveurs du produit, puis personnes qui ont **déjà acheté** ce produit (commandes terminées, via `negociation_id` → `offres.product_slug`), puis abonnés de la **même région**. Plafond de 4.3, regroupement par produit.
- **Demande pour un vendeur** : une demande simple prévient les vendeurs qui ont une offre active du produit **ou** une commande terminée comme vendeur depuis 12 mois. Même région en premier, 50 au plus.
- **Achat groupé** : « bientôt complet » envoyé une seule fois quand la quantité atteint 80 % de l'objectif (clé `groupe80:<id>:<user>`), aux inscrits et aux suiveurs du produit dans la zone, avec le chiffre réel (« il manque 40 kg »). « Seuil atteint » envoyé aussi aux inscrits. « Date limite demain » envoyé une seule fois aux inscrits.
- **Approvisionnement à renouveler** : les rappels manuels sont gardés, mais un rappel qui n'a pas pu partir n'est plus perdu (`prochain_le` n'avance qu'après un envoi). Nouveau : si un acheteur a au moins 2 commandes terminées du même produit, on calcule l'écart moyen entre elles ; à la date prévue, un seul message « Racheter de la tomate ? » qui ouvre `#/?racheter=<commande>`. Catégorie `renouveler`, réglable, rien n'est commandé.
- **Conseils** : choisis selon le rôle (`profils.role` acheteur, vendeur ou les deux ; activité réelle : offres actives, commandes) et la région. Fourchette de prix calculée par **produit et unité**, avec au moins 3 offres. Chaque conseil ouvre un écran précis, jamais l'accueil seul.

### 4.7 Ouvrir le bon écran
- `sw.js` : si l'adresse n'est pas celle de l'application (admin), ouvrir ou mettre au premier plan cette page. Traiter `e.action`.
- Application : un écouteur `mdg-lien` général qui applique l'adresse (`fromHash`) pour `#/produits/…`, `#/catalogue`, `#/prix`, etc.
- Intention gardée dans `sessionStorage` si la personne n'est pas connectée, puis rejouée après la connexion.

### 4.8 Textes
Titre de 45 caractères au plus et corps de 80 au plus, une action claire, aucune urgence inventée. On retire « payez moins cher », « prévenus tout de suite », « inspire confiance » et les répétitions de « Rien n'est commandé… » (gardé seulement pour les rappels et les groupes). Le message d'essai dit « Essai envoyé » seulement si le serveur a répondu `envoyees > 0`, sinon il dit que l'essai a échoué.

### 4.9 Sécurité
- `revoke truncate on public.alertes, public.alertes_produits, public.zones from authenticated` (test puis production).
- Nouvelles tables : RLS activée ; nouvelles fonctions : `security definer`, `search_path` fixé, droits d'exécution donnés un par un.
- La clé VAPID privée reste dans le coffre. Copier les secrets dans le projet de test est un choix du propriétaire, pas fait. Les envois se testent donc en SQL (journal, cibles, plafonds) et non de bout en bout.

### 4.10 Liste interne
La liste « Notifications » de Mon espace lit `notif_journal` (ses lignes, 50 dernières) quand la personne est connectée, garde le `localStorage` en secours, et chaque entrée ouvre son `url`. Une entrée est marquée comme lue par `notif_ouverte`.

### Ordre
1. Base de données (schéma 86) : tables, fonctions, réglages, correction de `push_annonce`, nouveaux déclencheurs, droits.
2. Fonction `pousser` : catégories, préférences, plafonds, journal, textes, conseils ciblés.
3. `sw.js` et application : clic, ouverture, réglages par catégorie, essai vérifié, liste interne, statistiques admin.
4. Tests sur le projet de test (blocs `do $$ … raise exception 'TEST' $$`), puis documentation (`FONCTIONNALITES.md` D1, `ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/PASSATION.md`, `docs/REPRISE.md`, `PORTAGE-SITE.md` partie 4).

**À valider par le propriétaire** : (a) conseils limités à 1 par jour au lieu de 30 ; (b) effacement du journal au bout de 90 jours ; (c) copie des secrets push dans le projet de test.
