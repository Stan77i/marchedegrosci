# Founder Context : Marché de Gros CI

Fiche lue par les compétences « founder-skills » (`.claude/skills/`). Les détails à jour sont dans `strategie/sources/` (textes du pitch, de la présentation, du marketing) et `strategie/sources/donnees-marche.json` (chiffres du marché, avec leurs sources).

## L'entreprise

- **Nom** : Marché de Gros CI (« de Gros » en maïs `#F2C230`).
- **Secteur** : vivrier ivoirien vendu en gros (igname, plantain, manioc, tomate, riz local…).
- **Pour qui** : vendeurs (producteurs, grossistes, coopératives), acheteurs (grossistes, détaillants), pros (restaurants, cantines, commerces), transporteurs. En Côte d'Ivoire, surtout sur téléphone.
- **Promesse** : « Le marché de gros du vivrier ivoirien, dans le téléphone. » Vendeurs et acheteurs se trouvent, comparent les prix, négocient et suivent la livraison au même endroit.

## Le produit

- Application mobile `application.dc.html` (la priorité). Site web : un nouveau site public (`site/`, pour ordinateur : accueil, 27 pages produits, 7 guides, 14 districts, calendrier des récoltes, carte du réseau, annonces et prix en direct) est prêt mais **encore caché** (page de maintenance pour le public) ; l'ouverture est la décision du propriétaire. L'ancien site (`index-v3.html`) reste caché, visible par l'administrateur seulement.
- Six étapes : publier (offre « J'ai » ou demande « Je cherche ») → comparer les prix → négocier sans numéro visible → commander (prix et quantité figés) → livrer (camion suivi par un lien) → réceptionner (mot secret, 24 h pour réclamer).
- Pour les pros : approvisionnement, achats groupés, « Racheter ».

## Modèle économique

- Inscription, annonces et négociation gratuites. Pas d'abonnement, pas de publicité.
- Commissions (voir `strategie/sources/parametres.json`) : 3,5 % du prix de la marchandise sur une vente définitive (0 quand le vendeur est le Marché de Gros), 6,9 % du prix du transport fait par un transporteur vérifié du réseau Marché de Gros, retenue sur son prix. Aucune commission sur le livreur du vendeur ou de l'acheteur. Rien n'est encaissé : aucun paiement ne passe par l'application.
- Transport (schéma 83) : même ville, le vendeur organise son livreur et l'acheteur paie les frais au livreur, hors Marché de Gros (retrait possible si le vendeur l'accepte) ; villes différentes, le transport est inclus ou à part, son prix se négocie dans la même proposition que la marchandise et le total est figé. Le transporteur du réseau (prix convenu à trois) est construit mais fermé.
- **Aucun paiement n'est encore opérationnel** : ne jamais écrire qu'un paiement ou une commission a été encaissé.

## Voix de la marque

- Français simple, phrases courtes, ton direct et respectueux. Parler comme au marché, pas comme une start-up.
- Mots : « vivrier », « en gros », « prix du moment », « mot secret ». Jamais « PAYÉ ».

## Contraintes du fondateur

- Pas de budget pour l'instant : seulement des actions gratuites (pas de publicité payante, pas de SMS/WhatsApp payants, pas d'abonnement).
- Aucun chiffre inventé : un chiffre du marché vient de `donnees-marche.json` ou d'une source ouverte vérifiée (lien, année).
- Concurrents : à documenter avec des sources ; ne rien affirmer sans preuve.
