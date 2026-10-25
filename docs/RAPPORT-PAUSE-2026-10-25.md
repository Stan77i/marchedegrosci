# Rapport de pause · 25/10/2026

Le propriétaire a mis le travail en pause (plus de crédit). Voici l'état exact. Au retour : écrire « On reprend ».

## 1. En production (vérifié)

- Corrections de l'audit (schémas 92 à 98b) et du contrôle qualité.
- Commandes : litige en 1 h après « arrivé », **rien d'automatique avant « arrivé »**, retard signalé par le vendeur, nouvelles demandées par l'acheteur sans limite, délai justifié de l'acheteur (2, 6 ou 24 h, une fois), mot secret bloqué → l'équipe (schémas 97b à 99d).
- Sécurité et équipe : quota d'annonces, journal de chaque geste de l'équipe, conflit d'intérêts, commandes impossibles refusées, avis des seules commandes terminées (100a à 100f).
- Décisions juridiques : profil public sans compte (totaux), achat groupé, numéro contesté (pièce vue + appel fait), compte banni avec contestation, durées de conservation (la tâche compte seulement, tant que 101e n'est pas collé) (101a à 101d, 101c, 101z).
- Fonctions : `pousser` (notifications) et `itineraire` (trajets de la carte par notre serveur).
- Écrans en ligne : corrections du contrôle, boutons « J'ai / Je cherche » en noir, aide claire sur la casse et le refus, compte banni, numéro contesté.

## 2. Prêt, à fusionner par le propriétaire

| PR | Quoi | Quand |
|---|---|---|
| #326 (si pas encore fusionnée) | Écrans du suivi de livraison | Maintenant |
| #322 | Participation de l'acheteur, négociation à trois, prix à l'unité obligatoire (serveur) | Maintenant |
| #327 | PDF « Le cube du Marché de Gros » | Maintenant |
| #323 | Les 15 règles des commandes, transport retiré si refus accepté (serveur) | Après #322 (marques de conflit retirées et vérifiées) |

## 3. Interrompu, à reprendre en premier

1. (Fait : #323 débloquée et vérifiée.)
2. Écrans de « participer » et des 15 règles (branche `claude/participer-ecrans` : rien de codé ; la liste de ce qui reste est dans sa section de `docs/PASSATION.md`) : finir, captures, PR.
3. Mettre en production 102a, 102b, 102c, 102d, 103a, 103b, 103c, puis `pousser` v30, après fusion de #322 et #323.
4. Ajouter au cube la brique du juge « proposer un arrangement ».
5. Contrôle général complet (« Lance le contrôle général MGCI »).

## 4. Pour le propriétaire

- Coller le fichier 101e dans Supabase (mode d'emploi : `docs/A-FAIRE-PROPRIETAIRE.md`, partie 4 ter).
- Essayer les itinéraires de la carte sur un vrai téléphone (la clé du service d'itinéraires n'a pas été vérifiée).
- Recréer la tâche des gardiens avec l'accès Supabase (claude.ai, tâches programmées).
- Essai fermé : choisir la ville et les 2 produits, inviter 20 personnes (`docs/essai-ferme/LANCER-EN-1-HEURE.md`).
- Juriste gratuit et déclaration ARTCI.
- Plus tard, avec un budget : SMS de vérification du numéro, partenaire de paiement.

## 5. Règles nouvelles de la journée (déjà dans CLAUDE.md)

- Rien ne se déclenche avant « arrivé » ; après, 1 h.
- « Transport à la charge de l'acheteur » = transport pas compris dans le prix ; le risque reste au vendeur jusqu'à la réception conforme ; marchandise abîmée : l'acheteur ne paie ni la marchandise ni le transport.
- L'acheteur peut participer volontairement ; négociation à trois ; ce que les deux acceptent est validé.
- L'équipe peut lire les messages (mise en relation, pas WhatsApp).
- Penser à la place de chacun, puis **proposer** ; rien de nouveau sans l'accord du propriétaire.
- Un message qui dit quoi faire reste ; pas de sur-explication.
