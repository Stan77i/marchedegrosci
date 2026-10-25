# Registre des anomalies

> Toutes les anomalies trouvées par le contrôle qualité, **jamais effacées** : une anomalie change de statut, elle ne disparaît pas.
> Statuts : **ouverte** · **corrigée non vérifiée** (correctif fait, test de non-régression pas encore rejoué) · **vérifiée** (test rejoué et réussi, avec date et preuve) · **risque accepté par le propriétaire** (seulement avec sa phrase écrite, sa date et le lieu où il l'a dite).
> Gravité : **P0** argent, sécurité ou perte de données, bloquant · **P1** grave · **P2** gênant · **P3** cosmétique.
> Règles : aucune anomalie masquée ; un test bloqué n'est pas réussi ; aucune donnée personnelle ni secret dans ce fichier.

## Gabarit (copier pour chaque nouvelle anomalie)

```markdown
### ANO-NNN · <titre court>
| Champ | Valeur |
|---|---|
| Date | JJ/MM/AAAA (rapport : `rapports/<fichier>.md`) |
| Unité | Uxx |
| Gravité | P0 / P1 / P2 / P3 |
| Preuve | commande ou requête qui la reproduit, `fichier:ligne`, sortie obtenue |
| Risque métier | ce qui peut arriver à un membre ou au Marché de Gros, en une phrase |
| Correctif | proposé / fait (PR n°…) |
| Test de non-régression | ID du test qui la surveille (ex. STA-03, SQL-regles-93 bloc A) |
| Statut | ouverte / corrigée non vérifiée / vérifiée (date, preuve) / risque accepté par le propriétaire (date, phrase) |
```

## Anomalies

### ANO-001 · « L’acheteur vient chercher la marchandise » (rouge du contrôle statique)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (premier rapport des gardiens ; toujours là au passage statique du 25/10/2026) |
| Unité | U13, U06 |
| Gravité | P2 provisoire (rouge du script, gravité à juger) |
| Preuve | `bash tools/controle/lancer.sh statique` → STA-03 ; `v3/commandes.js:1141` (libellé du choix « acheteur » quand vendeur et acheteur sont dans la même ville) ; même tournure en orange `v3/commandes.js:898` (`REGLE.retrait`) |
| Risque métier | Si la phrase désigne le choix « transport à la charge de l’acheteur », elle contredit la règle du 24/10/2026. Lecture du code : elle désigne le **retrait** accepté par le vendeur (même ville), un autre choix, que la règle n’interdit pas. |
| Correctif | à décider : si c’est bien le retrait, ajouter une exception motivée dans `tools/controle/exceptions.json` et retirer la clé de `tools/controle/reference-rouges.json` ; sinon écrire « Transport à la charge de l’acheteur » |
| Test de non-régression | STA-03 |
| Statut | ouverte |

### ANO-002 · Exemple « Cocody » dans un champ ville
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 (premier rapport des gardiens) |
| Unité | U01 |
| Gravité | P2 |
| Preuve | STA-04 ; `v3/appro.js:182` (texte d’exemple d’un champ `data-k="ville"`) |
| Risque métier | Laisse croire qu’une commune d’Abidjan est une ville, contre la règle « Abidjan est une seule ville » (schéma 87c). |
| Correctif | proposé : un exemple de vraie ville (ex. « Bouaké ») |
| Test de non-régression | STA-04 |
| Statut | ouverte |

### ANO-003 · Textes d’écran trop longs (53)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P2 (les plus longs : `v3/identite.js:493` 69 mots, `v3/commandes.js:760` 63 mots, `v3/compte.js:863` 56 mots) |
| Preuve | STA-08 ; liste complète : `node tools/controle/controle.js` puis `rapport-controle.md` |
| Risque métier | Règle « pas de long texte d’explication sur les écrans » : le membre ne lit pas, se trompe d’action. |
| Correctif | à choisir par le propriétaire, écran par écran (captures avant PR) |
| Test de non-régression | STA-08 |
| Statut | ouverte |

### ANO-004 · Textes copiés dans plusieurs fichiers (26)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12, U10 |
| Gravité | P3 |
| Preuve | STA-05 (ex. « Pas de connexion : rien n’a été enregistré… » dans `v3/chauffeur.js`, `v3/commandes.js`, `v3/groupes.js`) |
| Risque métier | Un texte corrigé à un endroit reste faux ailleurs. |
| Correctif | proposé : un module commun pour les messages répétés |
| Test de non-régression | STA-05 |
| Statut | ouverte |

### ANO-005 · Couleurs bleues hors exceptions (7)
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | STA-11 : `application.dc.html:302` #4A8FD6, `index-v3.html:2047` #B5CEDD, `v3/avatar.js:13-14`, `v3/identite.js:256` #234F80, `v3/personnages.js:52,151` |
| Risque métier | Règle « plus aucun bleu » (audit antislop du 24/10/2026). Certaines teintes peuvent être voulues (vêtements des personnages) : à juger. |
| Correctif | à juger : exception motivée ou couleur de la marque |
| Test de non-régression | STA-11 |
| Statut | ouverte |

### ANO-006 · Police autre que Jost
| Champ | Valeur |
|---|---|
| Date | 25/10/2026 |
| Unité | U12 |
| Gravité | P3 |
| Preuve | STA-10 : `index-v3.html:774` (`ui-monospace`) |
| Risque métier | Règle « une seule police ». Peut-être voulu pour un code ou un chiffre : à juger. |
| Correctif | à juger |
| Test de non-régression | STA-10 |
| Statut | ouverte |

### ANO-007 · La règle 93 garde l’ancienne quantité sans le dire
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (rapport de bout en bout, `docs/REPRISE.md` partie 1) |
| Unité | U04 |
| Gravité | P2 |
| Preuve | `_annonce_regles` (schéma 93) garde l’ancienne quantité avant le message `STOCK_EPUISE` de `_stock_garde` (schéma 92) ; `supabase/tests/boutiques-86-scenarios.sql` bloc B mis à jour pour ce comportement |
| Risque métier | Un vendeur qui vide la quantité croit l’avoir changée alors que l’ancienne reste (rien ne le lui dit). |
| Correctif | décision du propriétaire en attente ; chantier « quantité minimale / achat partiel » (schéma 97b) **en cours de changement** sur `claude/litige-1h-quantites` |
| Test de non-régression | SQL-boutiques-86 bloc B, SQL-regles-93 |
| Statut | ouverte (décision en attente) |

### ANO-008 · L’équipe peut lire tous les messages privés
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (`docs/REPRISE.md`, décisions en attente) |
| Unité | U02, U07 |
| Gravité | P1 (vie privée) |
| Preuve | texte affiché `v3/messages.js:292` (« l’équipe du Marché de Gros peut les lire… ») ; droits de lecture de l’équipe à confirmer par requête sur le projet de test |
| Risque métier | Confiance des membres, obligations de confidentialité (ARTCI non vérifié). |
| Correctif | décision du propriétaire en attente (lecture seulement en cas de litige ?) |
| Test de non-régression | à écrire (U02) |
| Statut | ouverte (décision en attente) |

### ANO-009 · Itinéraires par le serveur public OSRM
| Champ | Valeur |
|---|---|
| Date | 24/10/2026 (`docs/essai-ferme/A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`, point 6) |
| Unité | U10, U06 |
| Gravité | P2 |
| Preuve | `router.project-osrm.org` : serveur de démonstration sans garantie ; disponibilité jamais mesurée |
| Risque métier | Carte de livraison sans trajet si le serveur tombe ou limite. |
| Correctif | décision en attente : passer par la fonction `itineraire` ; mesurer d’abord |
| Test de non-régression | à écrire (U14, panne) |
| Statut | ouverte (décision en attente) |

### ANO-010 · Comptes créés sans preuve du numéro
| Champ | Valeur |
|---|---|
| Date | octobre 2026 (audit de sécurité, `CLAUDE.md`) |
| Unité | U02, U07 |
| Gravité | P1 |
| Preuve | aucun envoi de code (SMS ou WhatsApp) n’existe ; `A-CONFIRMER-AVANT-DE-CLORE-L-AUDIT.md`, point 20 |
| Risque métier | Faux comptes, numéro d’un autre utilisé. |
| Correctif | attend un budget (SMS/WhatsApp) |
| Test de non-régression | en attente : service d’envoi |
| Statut | ouverte |

### ANO-011 · Pas d’anti-robot (Turnstile)
| Champ | Valeur |
|---|---|
| Date | octobre 2026 (`CLAUDE.md`, décisions en attente) |
| Unité | U02 |
| Gravité | P2 |
| Preuve | aucune vérification anti-robot à l’inscription ; limite Supabase Auth de 20 par 5 minutes et par IP seulement |
| Risque métier | Inscriptions en masse par un robot. |
| Correctif | question à reposer au propriétaire (site seulement ou partout en mode invisible) ; compte Cloudflare gratuit |
| Test de non-régression | à écrire (U02, malveillant) |
| Statut | ouverte (décision en attente) |

## Points jamais vérifiés (pas des anomalies prouvées, pas des réussites non plus)

| Point | Unité | Prérequis exact | Statut |
|---|---|---|---|
| Vrais paiements (Mobile Money, séquestre) | U03 | partenaire de paiement agréé et accord du propriétaire ; rien n’est simulé | en attente : paiement |
| Charge simultanée (plusieurs acheteurs sur le même stock au même instant) | U14, U04 | script à plusieurs connexions sur le projet de test | non exécuté |
| Fonction `pousser` (envoi réel des notifications) | U08 | clés push gratuites sur le projet de test, téléphone du propriétaire | en attente : clés |
| Fonction `itineraire` | U06, U10 | appel réel sur le projet de test | non exécuté |
| Exécution réelle des tâches planifiées à échéance | U09 | attendre l’échéance sur le projet de test | non exécuté |
| Vrai téléphone (2G/3G, hors ligne, notifications) | U10, U08 | téléphone du propriétaire | en attente : matériel |

Détail complet : `REGISTRE_DES_TESTS.md`, partie 3.
