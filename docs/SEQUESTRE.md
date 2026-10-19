# Paiement par séquestre : l'argent passe par le Marché de Gros

> Proposition d'architecture, rien n'est construit. Il n'y a **aucun paiement** dans l'application aujourd'hui. Les bons de transaction disent honnêtement : « Paiement : à la livraison, hors application ».
> Rédigé le 20 octobre 2026. Les décisions marquées **À trancher** reviennent au propriétaire.

## 1. Le principe
Le Marché de Gros devient le **pont** entre l'acheteur et le vendeur :
1. Acheteur et vendeur concluent une négociation : prix et quantité fixés, comme aujourd'hui.
2. L'acheteur **paie le Marché de Gros**, pas le vendeur.
3. Le Marché de Gros **garde les fonds** tant que la livraison n'est pas confirmée.
4. L'acheteur confirme la réception, ou le délai de confirmation expire : le Marché de Gros **reverse au vendeur**, moins une éventuelle commission.
5. En cas de problème, l'acheteur ouvre un **litige**. L'équipe arbitre et décide de libérer, de rembourser ou de partager.

Le vendeur est sûr d'être payé, et l'acheteur est sûr de ne pas payer pour rien. C'est l'argument « Parcours sécurisé ».

## 2. Les états d'une transaction
```
conclue ──► paiement_attendu ──► fonds_deposes ──► livree ──► liberee
                 │                    │               │
                 └► expiree           └► litige ──────┴► remboursee | partagee | liberee
```
| État | Qui le déclenche | Ce qui se passe |
|---|---|---|
| `conclue` | les deux parties (négociation acceptée) | existe déjà (`negociations.statut = 'conclue'`) |
| `paiement_attendu` | l'acheteur choisit « Payer par le Marché de Gros » | une demande de paiement est créée chez l'opérateur |
| `fonds_deposes` | **l'opérateur** (notification signée, jamais l'application seule) | le vendeur est prévenu : il peut livrer |
| `livree` | le vendeur déclare la livraison (photo ou code de remise facultatifs) | le délai de confirmation démarre |
| `liberee` | l'acheteur confirme, ou le délai expire sans litige | virement au vendeur, moins la commission |
| `litige` | l'acheteur, avant la fin du délai | fonds gelés ; l'équipe reçoit les preuves des deux côtés |
| `remboursee` / `partagee` | l'administrateur | décision motivée, enregistrée et notifiée aux deux parties |
| `expiree` | délai de paiement dépassé | la négociation reste conclue, sans paiement |

## 3. Ce qui change dans la base (Supabase)
- **Table `paiements`** : `id`, `negociation_id` (unique), `acheteur_id`, `vendeur_id`, `montant`, `commission`, `devise` (XOF), `etat`, `operateur`, `reference_operateur`, `depose_le`, `livre_le`, `confirme_le`, `libere_le`, `delai_confirmation`, `cree_le`.
- **Table `paiements_journal`** : chaque changement d'état, avec qui, quand, pourquoi et la preuve. Rien ne s'efface. C'est la trace comptable et la défense en cas de contestation.
- **Table `litiges`** : `paiement_id`, `ouvert_par`, `motif`, preuves (stockage privé, comme les dossiers d'identité), `decision`, `decide_par`, `decide_le`.
- **Règles** : aucun membre ne peut écrire directement un état. Seules des fonctions `security definer` font les transitions autorisées. L'état `fonds_deposes` vient **uniquement** d'une fonction Edge qui vérifie la signature de l'opérateur.
- **`mes_transactions`** (schéma 24) gagne l'état du paiement. Le bon de transaction affiche alors « Payé via le Marché de Gros, réf. … », et devient un reçu.
- Le **profil public** ne change pas : des volumes, jamais de montants.

## 4. Rôles de l'administrateur
- Une file **« Paiements »** dans le tableau de bord : en attente, déposés, livrés, en litige ; et une alerte pour les délais dépassés.
- **Arbitrage des litiges** : voir les preuves, décider (libérer, rembourser, partager), motiver. Chaque décision est journalisée et notifiée.
- **Rapprochement** : chaque jour, comparer les fonds reçus de l'opérateur aux paiements `fonds_deposes`.
- Aucun bouton qui crée de l'argent : l'admin ne peut que libérer ou rembourser des fonds réellement déposés.

## 5. À trancher
1. **Opérateurs mobile money** : Orange Money, MTN MoMo, Moov Money et Wave en Côte d'Ivoire, directement ou via un agrégateur de paiement. Il faut comparer les frais, l'API d'encaissement et de reversement, et les notifications signées.
2. **Statut légal** : détenir les fonds de tiers relève de la réglementation BCEAO (UEMOA). Faut-il un agrément d'établissement de paiement, ou passer par un partenaire agréé qui détient les fonds pour le compte du Marché de Gros ? C'est la question la plus importante, à voir avec un juriste avant toute ligne de code.
3. **Délais** : temps pour payer après l'accord (24 h ?), temps de confirmation après livraison (48 h ? 72 h ?), libération automatique ou non.
4. **Frais** : commission du Marché de Gros (pourcentage, minimum, plafond) ; qui paie les frais de l'opérateur, l'acheteur, le vendeur ou les deux ?
5. **Livraison** : simple déclaration, code de remise donné par l'acheteur au moment de la livraison, ou photo ?
6. **Factures** : quand un vrai paiement existe, faut-il une facture fiscale (numérotation légale, identifiants fiscaux des structures) ?

## 6. Ce qu'on ne fait pas
- Pas de faux bouton « Payer », pas de paiement simulé : tant que les points 1 et 2 ne sont pas tranchés, l'application dit la vérité (« Paiement à la livraison, hors application »).
- Jamais de numéro de compte ou de mobile money échangé dans les messages : c'est déjà refusé par le serveur (schéma 22).
