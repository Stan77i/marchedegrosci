/* ═════════ Marché de Gros CI — l'aide : des questions et des réponses toutes prêtes, puis une personne ═════════
   Demandé par le propriétaire le 22/10/2026 : « des pré-questions et des pré-réponses à tout ce qui est dans l'application ;
   pendant que la personne écrit, les questions s'affichent ; un toucher montre la réponse. Si rien ne l'aide, elle dit
   “je veux parler à une personne”, et je reçois une notification. »
   • « Écrire au Marché de Gros » (menu, Mon compte, guide) ouvre d'abord cette aide.
   • La recherche tourne sur le téléphone, sans serveur : elle comprend les mots sans accent, les débuts de mots et les
     mots de tous les jours (argent, gâté, arnaque, camion…).
   • « Je veux parler à une personne » : la personne écrit (ou garde) sa question et touche « Envoyer à l'équipe ».
     Le message part dans la conversation avec le Marché de Gros (dm_envoyer) : l'administrateur reçoit la notification
     habituelle des messages (déclencheur push_dm → fonction Edge « pousser »). Rien ne part sans ce toucher.
   • Dans la conversation avec le Marché de Gros, pendant qu'on écrit, les réponses toutes prêtes s'affichent aussi (v3/messages.js).
   Les réponses décrivent ce que l'application fait vraiment (mêmes règles que v3/guide.js et v3/astuces.js). Une règle change ?
   Mettre la réponse à jour ici aussi.
   API : MDGAide.ouvrir({ q, id }?) · fermer() · chercher(texte, n) → [{ id, q }] · frequentes(n) · QR */
(function () {
  'use strict';
  if (window.MDGAide) return;
  const IC = (n, t, s) => window.MDGIco ? MDGIco.svg(n, t || 22, s || 1.9) : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gras = s => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');
  const N = () => window.MDGNuage;

  // aller quelque part dans l'application (comme le guide)
  const PAGE = p => () => dispatchEvent(new CustomEvent('mdg:aller', { detail: { page: p } }));
  const FEN = (mod, fn) => () => { const m = window[mod]; if (m && typeof m[fn] === 'function') m[fn](); };
  const ONGLET = nom => () => { if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(() => { const b = [...document.querySelectorAll('.acc-ong button')].find(x => x.textContent.trim().startsWith(nom)); if (b) b.click(); }, 450); };
  const ALLER = {
    vendre: ['Publier une offre', PAGE('vendre')], demande: ['Publier une demande', PAGE('demande')], acheter: ['Voir les offres', PAGE('acheter')],
    carte: ['Ouvrir la carte', PAGE('carte')], categories: ['Ouvrir les catégories', PAGE('categories')], prix: ['Ouvrir le prix du marché', PAGE('prix')],
    annee: ['Ouvrir l’année du marché', PAGE('annee')], pubs: ['Ouvrir Mes publications', PAGE('pubs')], tableau: ['Ouvrir l’onglet Prix', ONGLET('Prix')],
    messages: ['Ouvrir mes messages', FEN('MDGMessages', 'boite')], negoce: ['Ouvrir mes négociations', FEN('MDGNegoce', 'inbox')],
    commandes: ['Ouvrir mes commandes', FEN('MDGCommandes', 'ouvrir')], compte: ['Ouvrir Mon compte', FEN('MDGCompte', 'ouvrir')],
    identite: ['Faire vérifier mon identité', FEN('MDGIdentite', 'ouvrir')], notes: ['Voir les mieux notés', FEN('MDGRep', 'classement')],
    alertes: ['Gérer mes alertes', FEN('MDGAlertes', 'gerer')], reglages: ['Ouvrir les réglages', FEN('MDGTheme', 'ouvrir')],
    chauffeur: ['Ouvrir l’Espace chauffeur', FEN('MDGChauffeur', 'ouvrir')], releve: ['Ouvrir mes ventes et achats', FEN('MDGReleve', 'ouvrir')],
    racheter: ['Racheter', FEN('MDGRacheter', 'ouvrir')], appro: ['Ouvrir Approvisionnement pro', FEN('MDGAppro', 'ouvrir')],
    groupes: ['Voir les achats groupés', FEN('MDGGroupes', 'ouvrir')], guide: ['Ouvrir le guide', FEN('MDGGuide', 'ouvrir')]
  };

  /* ——— les thèmes ——— */
  const THEMES = [
    ['debut', 'Débuter', 'compte'], ['vendre', 'Vendre', 'vendre'], ['acheter', 'Acheter', 'acheter'], ['negoce', 'Négocier', 'negoce'],
    ['commande', 'Commande et transport', 'camion'], ['paiement', 'Paiement', 'cadenas'], ['litige', 'Problème et litige', 'signaler'],
    ['confiance', 'Confiance et sécurité', 'verifie'], ['outils', 'Prix, carte, saisons', 'tableau'], ['chauffeur', 'Chauffeurs', 'camion'],
    ['appli', 'L’application', 'apercu']
  ];

  /* ——— les questions et les réponses : [thème, question, réponse, mots que les gens écrivent, aller] ———
     Réponse : phrases courtes ; *mot* = en gras. */
  const QR = [
    // Débuter
    ['debut', 'C’est quoi, le Marché de Gros ?', 'Le Marché de Gros met en relation ceux qui *vendent* et ceux qui *achètent* des produits vivriers en gros, partout en Côte d’Ivoire. Vous publiez une offre ou une demande, vous négociez dans l’application, puis vous suivez la commande jusqu’à la livraison. Le Marché de Gros est le *seul intermédiaire* : les numéros restent cachés.', 'quoi sert application plateforme marche gros presentation c est quoi', 'guide'],
    ['debut', 'Comment créer un compte ?', 'Touchez le petit bonhomme en haut à droite, puis « Se connecter ». Il faut votre *numéro de téléphone* et un *code secret à 6 chiffres* que vous choisissez. Pas de SMS : aucun frais. À la création, vous recevez aussi un *code de secours* : notez-le sur un papier.', 'inscription inscrire creer compte ouvrir compte s inscrire enregistrer', 'compte'],
    ['debut', 'C’est payant ?', 'Créer un compte, publier, négocier et écrire sont *gratuits*. Le Marché de Gros prend une commission seulement sur une vente terminée : *3,5 %* pour le vendeur, *6,9 %* pour le transporteur. Pour l’instant, le paiement se fait *à la livraison* et rien n’est prélevé dans l’application.', 'payant gratuit prix abonnement frais combien coute cout tarif', null],
    ['debut', 'J’ai oublié mon code secret', 'Touchez « Se connecter », puis « Code oublié ». Tapez votre numéro, le *code de secours* reçu à la création du compte, puis un nouveau code secret. Sans code de secours, un code oublié *ne peut pas être récupéré* : écrivez à l’équipe ci-dessous.', 'oublie code secret mot de passe mdp perdu connexion impossible recuperer pin', 'compte'],
    ['debut', 'C’est quoi, le code de secours ?', 'Un code de *12 caractères*, donné à la création du compte. Il sert à choisir un nouveau code secret si vous l’oubliez. Notez-le sur papier ou prenez une photo de l’écran. Vous n’en avez pas ? Dans Mon compte, touchez « Créer mon code de secours ».', 'code secours 12 caracteres sauvegarde', 'compte'],
    ['debut', 'Je n’arrive pas à me connecter', 'Vérifiez le *numéro* et le *code secret* (6 chiffres). Vérifiez aussi le réseau. Code oublié ? Utilisez votre code de secours. Toujours bloqué ? Écrivez à l’équipe ci-dessous.', 'connecter connexion marche pas erreur bloque impossible entrer login', 'compte'],
    ['debut', 'Comment changer mon nom ou ma photo ?', 'Ouvrez Mon compte, puis votre profil. Vos annonces portent toujours le *nom de votre compte* : on ne peut pas en mettre un autre sur une annonce.', 'changer nom photo avatar profil modifier pseudo', 'compte'],
    ['debut', 'Je suis une coopérative, un groupement ou une entreprise', 'Dans votre profil, choisissez votre *structure* : coopérative, groupement, entreprise ou marché. Ajoutez son nom, son logo et des preuves. Une coopérative ou un marché peut demander le badge *vérifié par l’équipe* (identité déjà vérifiée, document officiel en photo).', 'cooperative groupement entreprise structure societe association marche badge', 'compte'],
    ['debut', 'Comment supprimer mon compte ?', 'Mon compte → « Supprimer mon compte ». C’est *définitif* : vos annonces sont retirées et les négociations en cours fermées. Les accords déjà conclus et les messages restent visibles des deux parties, pour la trace ; l’autre partie voit « Compte supprimé ».', 'supprimer effacer fermer compte desinscrire quitter', 'compte'],
    // Vendre
    ['vendre', 'Comment vendre mon produit ?', 'Touchez *« J’ai »* (le bouton vert en bas), ou « Vendre » dans le menu. Choisissez le produit, ajoutez une photo si vous pouvez, la quantité, votre prix (ou « À discuter ») et le lieu. Touchez « Publier mon offre » : les acheteurs vous trouvent et vous écrivent.', 'vendre publier offre j ai annonce mettre en vente marchandise poster', 'vendre'],
    ['vendre', 'Combien d’annonces gratuites ?', 'Vos *3 premières annonces* sont gratuites sans vérification. Ensuite, il faut faire *vérifier votre identité* (gratuit) pour continuer à publier.', 'annonces gratuites limite 3 trois publier bloque plus publier', 'identite'],
    ['vendre', 'Comment mettre à jour mon stock ?', 'Menu → *Mes publications*. Touchez « Stock » sur votre offre et écrivez la quantité qui reste. À chaque vente conclue dans l’application, la quantité baisse toute seule. À zéro, l’offre n’est plus proposée.', 'stock quantite modifier mettre a jour reste epuise fini', 'pubs'],
    ['vendre', 'Comment retirer une annonce ?', 'Menu → *Mes publications*, puis « Retirer » sur l’annonce. Retirez toujours une annonce qui n’est plus valable : les acheteurs vous font confiance.', 'retirer supprimer annonce enlever offre demande arreter', 'pubs'],
    ['vendre', 'Je peux fixer une quantité minimum ?', 'Oui. À la première étape de « Vendre », remplissez « *Vendu à partir de* » (par exemple 50 kg). Les acheteurs ne peuvent pas proposer moins. S’il vous reste moins que ce minimum, le dernier lot peut se vendre.', 'minimum quantite minimale a partir de petit acheteur', 'vendre'],
    ['vendre', 'Je suis intermédiaire, je peux vendre ?', 'Oui. Dans « Vendre », cochez « *Je suis intermédiaire* ». Vous pouvez aussi dire « J’ai un stock ici aussi » si la marchandise est à plusieurs endroits.', 'intermediaire commercant revendeur grossiste demarcheur', 'vendre'],
    ['vendre', 'Comment être en haut de la liste ?', 'Dans l’onglet *Prix*, l’offre la *moins chère* est en haut. Baissez votre prix : vous montez. À prix égal, le *transport compris* passe devant, puis les membres fiables et vérifiés. Une photo et un prix clair aident beaucoup.', 'haut liste premier classement visible voir plus acheteurs remonter', 'tableau'],
    ['vendre', 'Personne ne répond à mon offre', 'Ajoutez une *photo*, un *prix clair* et dites si le *transport est compris*. Regardez l’onglet Prix pour comparer. Faites vérifier votre identité : le sceau bleu rassure. Et répondez vite aux messages : « Répond vite » se gagne.', 'personne repond pas acheteur aucun client vend pas', 'tableau'],
    // Acheter
    ['acheter', 'Comment acheter ?', 'Touchez « Acheter » dans le menu, ou cherchez un produit en haut de l’accueil. Touchez une offre, puis *« Écrire »* ou *« Proposer un prix »*. Vous pouvez aussi publier une demande avec *« Je cherche »* (le bouton jaune) : les vendeurs viennent à vous.', 'acheter commander trouver produit achat besoin', 'acheter'],
    ['acheter', 'Comment publier une demande ?', 'Touchez *« Je cherche »* (le bouton jaune en bas). Dites quoi, combien, où et pour quand. Donnez votre *budget* si vous le connaissez, et qui s’occupe du transport. Les vendeurs de ce produit sont prévenus.', 'demande je cherche publier besoin chercher produit', 'demande'],
    ['acheter', 'Je ne trouve pas mon produit', 'Cherchez avec le nom local : la recherche comprend *aloco, gnangnan, attiéké…* Regardez aussi « Catégories » (12 familles). Personne ne le vend en ce moment ? Publiez une demande et activez une *alerte* sur ce produit.', 'trouve pas produit introuvable existe pas manque catalogue', 'categories'],
    ['acheter', 'Je peux demander une qualité précise ?', 'Oui. Dans une demande, ajoutez vos *exigences*. Pour un restaurant, une cantine ou un commerce, « *Approvisionnement pro* » (Mon compte) permet de tout détailler : volume, calibre, conditionnement, jours de livraison.', 'qualite exigence calibre precis conditionnement sac restaurant cantine', 'appro'],
    ['acheter', 'C’est quoi, l’Approvisionnement pro ?', 'Pour les acheteurs réguliers (restaurant, hôtel, cantine, commerce). Vous décrivez votre besoin une fois ; les vendeurs répondent avec prix, quantité et délai. Vous *comparez* et vous choisissez. Mon compte → « Approvisionnement pro ».', 'appro approvisionnement pro professionnel restaurant hotel regulier besoin comparer', 'appro'],
    ['acheter', 'Comment acheter à plusieurs (achat groupé) ?', 'Sur une offre, touchez « *Acheter à plusieurs* ». Plus il y a d’acheteurs, plus le prix baisse (par paliers). Chacun *confirme lui-même* le prix final. Si un seuil n’est pas atteint, rien n’est acheté.', 'acheter a plusieurs achat achats groupe groupes ensemble cotiser palier', 'groupes'],
    ['acheter', 'Comment racheter la même chose ?', 'Mon compte → « *Racheter* », ou le bouton dans une commande terminée. Vous cochez les produits et vous confirmez : une proposition part au vendeur, qui doit accepter. *Rien n’est acheté tout seul.* Vous pouvez aussi régler un rappel.', 'racheter encore meme commande habituelle rappel recommander', 'racheter'],
    // Négocier
    ['negoce', 'Comment proposer un prix ?', 'Sur une annonce, touchez « *Proposer un prix* ». Écrivez votre prix et la quantité. L’autre personne a *48 heures* pour accepter, refuser ou proposer un autre prix.', 'proposer prix negocier discuter marchander baisser offre prix', 'negoce'],
    ['negoce', 'Combien de temps pour répondre ?', '*48 heures*. Retrouvez toutes vos propositions dans « Mes négociations » : chaque ligne dit qui doit répondre.', 'temps delai repondre 48 heures expire combien de temps', 'negoce'],
    ['negoce', 'L’accord est conclu, et après ?', 'Le prix et la quantité *ne bougent plus*. Touchez « *Suivre la commande* » : vous dites qui transporte et où livrer, l’autre partie confirme. Un accord n’est pas un paiement.', 'accord conclu apres suite accepte deal ensuite', 'negoce'],
    ['negoce', 'Je peux retirer ma proposition ?', 'Oui, tant que l’autre personne n’a *pas encore répondu*.', 'retirer annuler proposition changer avis', 'negoce'],
    // Commande et transport
    ['commande', 'Comment suivre ma commande ?', 'Menu → « Mes commandes ». Chaque étape s’affiche avec son heure : préparation, chargement, départ du camion, arrivée, réception. Le camion avance avec elle, et les boutons disent quoi faire maintenant.', 'suivre commande ou est livraison etape colis camion avance', 'commandes'],
    ['commande', 'Qui transporte la marchandise ?', 'À la création de la commande, vous choisissez : le *vendeur* livre, ou l’*acheteur* s’en charge (avec son camion ou son chauffeur). Le *transporteur du réseau Marché de Gros* arrive bientôt : il n’est pas encore disponible. Le transport se négocie comme le prix.', 'transport qui transporte livraison livrer camion transporteur', 'commandes'],
    ['commande', 'Mon propre chauffeur peut transporter ?', 'Oui, et il n’a *rien à faire dans l’application* : ni inscription, ni code. Le vendeur glisse un *mot secret* dans la marchandise ; à la réception, l’acheteur le tape pour confirmer. Vous pouvez aussi donner au chauffeur le *lien de suivi* de la commande (ou son code court, à dicter au téléphone) : il l’ouvre, accepte la position, et vous voyez le camion avancer. Ni compte, ni application pour lui. Il n’utilise pas le lien ? Le vendeur indique lui-même les étapes : « Chargement confirmé », puis « Le camion est parti ».', 'mon chauffeur propre camion lien suivi gps', 'commandes'],
    ['commande', 'C’est quoi, les codes de la commande ?', 'Les codes servent seulement avec le *transporteur du réseau Marché de Gros*. Vendeur : le code de *prise en charge*. Acheteur : le code de *réception*. Le chauffeur tape le code du vendeur au chargement, puis celui de l’acheteur à la livraison. Donnez-le *de vive voix*, jamais par message. Avec votre propre transporteur, pas de code : c’est le *mot secret* du vendeur qui confirme la réception.', 'code prise en charge reception chauffeur taper valider', 'commandes'],
    ['commande', 'C’est quoi, le mot secret ?', 'Le vendeur voit un mot dans sa commande, par exemple *MANGUE 47*. Il l’écrit sur un papier et le *glisse dans la marchandise*. À la réception, l’acheteur *tape ce mot* pour confirmer qu’il a bien reçu le colis. Pour refuser la marchandise, il doit aussi le taper et le photographier : c’est la preuve que le colis vient bien de ce vendeur.', 'mot secret papier colis vendeur mangue preuve', 'commandes'],
    ['commande', 'Je peux annuler une commande ?', 'Une fois la commande *confirmée*, l’acheteur ne peut plus l’annuler. Seul le *vendeur* peut demander l’annulation, *avant le chargement*. Après la livraison, s’il y a un problème, on passe par le refus ou le signalement.', 'annuler commande annulation changer avis plus besoin', 'commandes'],
    ['commande', 'Où sont mes bons et mes relevés ?', 'Mon compte → « *Mes ventes et achats* » : l’historique par période, les totaux, les *bons de transaction* en PDF et le relevé en PDF ou CSV.', 'releve bon facture recu pdf historique ventes achats', 'releve'],
    // Paiement
    ['paiement', 'Comment se passe le paiement ?', 'Aujourd’hui : *paiement à la livraison*, après avoir vu la marchandise. Le paiement sécurisé (séquestre) est *en construction* : aucun paiement ne passe encore par l’application.', 'paiement payer argent comment payer livraison cash especes regler', null],
    ['paiement', 'C’est quoi, le séquestre ?', 'Bientôt, dès la commande confirmée, l’acheteur paiera par *Wave, Orange Money ou MTN MoMo*. L’argent restera *bloqué* jusqu’à la réception. L’acheteur vérifie et libère ; sans réclamation, l’argent se libère tout seul *24 h après la réception*. Ce n’est pas encore ouvert.', 'sequestre bloque argent securise wave orange money mtn momo moov', 'commandes'],
    ['paiement', 'Quelle est la commission ?', '*3,5 %* du montant pour le vendeur, *6,9 %* du prix du transport pour le transporteur. Elle n’est due qu’à la *libération* du paiement, sur une vente terminée. Publier, négocier et acheter ne coûtent rien.', 'commission pourcentage frais 3,5 6,9 combien prend prenez gagnez marche benefice part', null],
    ['paiement', 'On me demande de payer d’avance', '*Ne payez pas.* Ne payez jamais d’avance à quelqu’un par un numéro. Le Marché de Gros ne vous demandera *jamais d’argent ni de code* par message ou par téléphone. Signalez la personne (« Signaler » sur son profil ou l’annonce).', 'payer avance acompte transfert envoyer argent avant numero depot', null],
    ['paiement', 'Quand le vendeur est-il payé ?', 'Aujourd’hui, à la livraison, directement par l’acheteur. Avec le séquestre (bientôt) : à la libération, quand l’acheteur valide ou 24 h après la réception sans réclamation. Chacun reçoit alors sa part.', 'vendeur paye quand recevoir argent virement part', null],
    // Problème et litige
    ['litige', 'La marchandise est gâtée, je fais quoi ?', 'Quand le chauffeur est arrivé, ou dans les *24 h* après la réception, touchez « *Refuser la marchandise* » dans la commande. Tapez le *mot secret* du vendeur (le papier dans le colis) et ajoutez *1 à 4 photos* : la marchandise et le papier.', 'gate pourri abime mauvais avarie degrade probleme marchandise refuser qualite', 'commandes'],
    ['litige', 'Il n’y a pas de papier dans le colis', 'Touchez « *Pas de papier ? Signaler un problème* ». Rien n’est rendu tout seul : l’*équipe juge*, avec tous les échanges et les photos.', 'pas de papier mot secret absent sans papier oublie', 'commandes'],
    ['litige', 'Vais-je être remboursé ?', 'Aujourd’hui, le paiement se fait *à la livraison*, entre vous : aucun argent ne passe par l’application. Si le vendeur reconnaît le problème (ou si un chauffeur *vérifié par l’équipe* le confirme), vous ne devez *que la partie acceptée*. Sinon, on en parle à trois et l’équipe juge. *Sans preuves, pas de refus.* Le transport reste dû.', 'rembourse remboursement recuperer argent rendu', 'commandes'],
    ['litige', 'C’est quoi, la discussion à trois ?', 'Dans la commande, la « *Discussion* » réunit l’acheteur, le vendeur et le *Marché de Gros*. Chaque message prévient les deux autres. L’équipe lit tout (négociation, messages, photos, mot secret) pour juger.', 'discussion trois litige equipe juge conflit desaccord', 'commandes'],
    ['litige', 'Qui paie le transport si je refuse ?', 'Le *transport reste dû* : le chauffeur a fait son travail.', 'transport du refus qui paie chauffeur payer', 'commandes'],
    ['litige', 'Combien de temps pour réclamer ?', 'Jusqu’à *24 h après la réception*. Après, sans réclamation, la commande est considérée comme bonne. L’heure exacte est affichée dans la commande.', 'delai reclamer combien temps 24 heures trop tard', 'commandes'],
    ['litige', 'Un membre ne respecte pas l’accord', 'Expliquez-le dans la *Discussion* de la commande, ou touchez « Signaler » sur son profil. L’équipe regarde chaque signalement. Les échanges sont gardés et lus pour juger.', 'respecte pas accord menteur pas livre pas venu disparu', 'commandes'],
    // Confiance et sécurité
    ['confiance', 'Que veut dire le sceau bleu ?', '*Identité vérifiée par l’équipe* : une personne a comparé la pièce et le selfie. « Vérifié » ne veut pas dire « fiable » : regardez aussi les notes et les commandes honorées.', 'sceau bleu badge verifie certifie coche bleue', 'notes'],
    ['confiance', 'Comment faire vérifier mon identité ?', 'Mon compte → « *Identité* ». Photographiez votre pièce (recto et verso), puis faites un selfie en tenant le code affiché, écrit sur un papier. Une personne de l’équipe décide en quelques jours. C’est *gratuit*.', 'verifier identite piece cni passeport selfie badge verification', 'identite'],
    ['confiance', 'Quelles pièces sont acceptées ?', 'La *CNI*, le *passeport*, la *carte consulaire* et le *permis de conduire*. Une pièce *expirée* est refusée.', 'piece acceptee cni carte identite passeport permis consulaire', 'identite'],
    ['confiance', 'Mon identité a été refusée', 'La raison s’affiche dans Mon compte → Identité. Souvent : photo floue, reflet, pièce expirée ou code mal lisible sur le selfie. Recommencez avec des photos nettes.', 'identite refusee rejetee refus verification echoue', 'identite'],
    ['confiance', 'Que veulent dire les statuts ?', '« *Vendeur de confiance* », « *Acheteur sérieux* », « *Répond vite* », « *Fiable* » : ils se gagnent par des ventes et des réponses réelles. Un statut *ne s’achète pas*. « Nouveau membre » veut dire : soyez encore plus prudent.', 'statut badge confiance serieux repond vite fiable nouveau membre note etoile', 'notes'],
    ['confiance', 'Comment noter un membre ?', 'Après une *commande terminée*, ouvrez-la et laissez votre avis, dans les 30 jours. Vous pouvez le corriger pendant 24 h.', 'noter avis etoile evaluer commentaire', 'commandes'],
    ['confiance', 'Pourquoi je ne vois pas les numéros ?', 'Pour votre sécurité, les numéros restent cachés. Tout se dit dans les *messages de l’application*. Les numéros, liens, e-mails et réseaux sociaux sont refusés dans les messages.', 'numero telephone voir appeler whatsapp contact cache', 'messages'],
    ['confiance', 'L’équipe lit-elle mes messages ?', 'Oui. Les échanges *ne sont pas secrets* : l’équipe du Marché de Gros peut lire les négociations et les messages pour vérifier un accord ou régler un litige. Ils sont *gardés 1 an*.', 'lire messages prive secret confidentiel equipe lit espionne garde', 'messages'],
    ['confiance', 'Comment signaler une arnaque ?', 'Touchez « *Signaler* » sur l’annonce ou sur le profil, et dites ce qui ne va pas. L’équipe regarde chaque signalement. Vous pouvez aussi *bloquer* la personne dans la conversation.', 'arnaque escroc voleur fraude signaler faux faux compte bizarre', null],
    ['confiance', 'Comment bloquer quelqu’un ?', 'Dans la conversation, touchez les trois points, puis « *Bloquer* ». Vous ne pourrez plus vous écrire tant que vous ne le débloquez pas.', 'bloquer deranger harceler insulte bloquer quelqu un', 'messages'],
    ['confiance', 'Mon message est refusé', 'Les *liens*, *e-mails*, *numéros*, *réseaux sociaux* et *codes de transfert* sont refusés dans les messages, pour éviter les arnaques. Enlevez-les et renvoyez le message.', 'message refuse bloque envoie pas interdit lien numero', 'messages'],
    ['confiance', 'Quelqu’un dit qu’il travaille pour le Marché de Gros', 'Le Marché de Gros écrit seulement depuis son compte *officiel*, avec le logo et la mention « Officiel ». Il ne demande *jamais* d’argent, de code secret ni de code de commande.', 'travaille marche gros agent faux officiel equipe appel', null],
    // Prix, carte, saisons
    ['outils', 'Comment voir le prix du marché ?', 'Deux endroits. L’onglet *Prix* de l’accueil : qui vend le moins cher et qui achète le plus cher, en direct. Et « *Prix du marché* » dans le menu : prix des vendeurs, budgets des acheteurs, et « Accord possible ». Tous les prix viennent de vraies annonces.', 'prix marche combien coute cours tarif valeur kg sac', 'tableau'],
    ['outils', 'Comment lire l’onglet Prix ?', '« *Acheter* » : les vendeurs, le moins cher en haut. « *Vendre* » : les acheteurs, le meilleur budget en haut. On ne compare que des prix dans la *même unité* (kg, sac, régime…). Touchez une ligne pour proposer votre prix.', 'onglet prix tableau classement lire comprendre p2p', 'tableau'],
    ['outils', 'Les prix par zone et la tendance', 'Dans « Prix du marché », touchez « *Par zone et tendance* » sur un produit : les prix par district et l’évolution sur 30 jours. S’il n’y a pas assez d’annonces, on vous le dit.', 'zone region district tendance evolution hausse baisse', 'prix'],
    ['outils', 'Comment marche la carte ?', 'Menu → « *Le réseau* ». Chaque bulle est une ville : *verte* pour les offres, *jaune* pour les demandes. Touchez-en une pour voir les annonces. La position est celle de la ville, jamais l’adresse d’une personne.', 'carte reseau map bulle ville localisation pres de moi', 'carte'],
    ['outils', 'Quels produits sont en saison ?', 'Menu → « *L’année du marché* ». Touchez un mois pour voir ce qui est en récolte. En pleine récolte, il y a beaucoup de marchandise : les prix baissent souvent. Le calendrier est indicatif : il varie selon les pluies et les régions.', 'saison recolte mois calendrier annee periode', 'annee'],
    ['outils', 'Comment être prévenu quand mon produit arrive ?', 'Menu → « *Alertes produits* ». Choisissez vos produits : une notification arrive dès qu’une annonce est publiée. Vendeur ? Suivez les demandes. Acheteur ? Suivez les offres.', 'alerte prevenu notification produit arrive suivre', 'alertes'],
    ['outils', 'Les familles de produits', 'Menu → « *Catégories* » : tous les produits vivriers, rangés en *12 familles* (céréales, tubercules, légumes et fruits, poissons, produits surgelés…). Touchez un produit pour ouvrir sa fiche.', 'categorie famille liste produits catalogue', 'categories'],
    // Chauffeurs
    ['chauffeur', 'Je suis chauffeur, comment travailler ?', 'Vous voulez devenir *transporteur du réseau Marché de Gros* ? Menu → « *Espace chauffeur* ». Inscrivez-vous, c’est *gratuit* : l’équipe vérifie votre profil et vous confie des missions ; vous les acceptez en fixant votre prix. Un vendeur ou un acheteur vous a appelé lui-même ? Vous n’avez *rien à faire* dans l’application.', 'chauffeur transporteur camion travailler mission inscrire livreur', 'chauffeur'],
    ['chauffeur', 'Chauffeur : comment valider le chargement et la livraison ?', 'Pour une mission du réseau : au chargement, montrez votre code transporteur au vendeur ; il vous dit son *code de prise en charge* : tapez-le. À la livraison, l’acheteur vérifie, puis vous dit le *code de réception* : tapez-le.', 'chauffeur valider chargement livraison code taper', 'chauffeur'],
    ['chauffeur', 'Chauffeur : combien je gagne ?', 'Votre prix, *moins 6,9 %* (la commission du Marché de Gros) : comptez-la dans votre prix. Si l’acheteur refuse la marchandise, votre transport *reste dû*.', 'chauffeur gagne payer commission 6,9 prix transport', 'chauffeur'],
    ['chauffeur', 'Chauffeur : l’acheteur refuse la marchandise', 'L’application vous demande ce que vous avez vu. Répondez *honnêtement*. Si vous êtes vérifié par l’équipe, votre réponse compte dans la décision. Votre transport reste dû.', 'chauffeur refus vu temoin confirmer', 'chauffeur'],
    // L'application
    ['appli', 'Comment installer l’application ?', 'Ouvrez le Marché de Gros dans le navigateur du téléphone. Sur iPhone : touchez le bouton *Partager*, puis « *Sur l’écran d’accueil* ». Sur Android : menu du navigateur, puis « *Installer l’application* » ou « Ajouter à l’écran d’accueil ».', 'installer telecharger application ecran accueil icone play store', null],
    ['appli', 'Je ne reçois pas les notifications', 'Mon compte → *Notifications* : activez-les sur ce téléphone. Vérifiez aussi les réglages du téléphone (Notifications → Marché de Gros). Sur iPhone, l’application doit être installée sur l’écran d’accueil.', 'notification recois pas alerte son prevenu push', 'compte'],
    ['appli', 'Comment passer en mode sombre ?', 'Menu → « *Réglages* » : Clair, Sombre, ou Comme le téléphone.', 'mode sombre nuit noir clair theme couleur', 'reglages'],
    ['appli', 'Ça marche sans internet ?', 'Les annonces déjà vues restent affichées. Ce que vous publiez sans réseau est gardé sur le téléphone, puis envoyé dès que le réseau revient.', 'sans internet hors ligne reseau connexion data pas de reseau', null],
    ['appli', 'L’application est bloquée ou lente', 'Fermez-la *complètement*, puis rouvrez-la. Vérifiez le réseau. Après une mise à jour, attendez une minute avant de rouvrir. Toujours un souci ? Écrivez à l’équipe ci-dessous.', 'bloque lent bug plante marche pas erreur page blanche', null],
    ['appli', 'Revoir les tutoriels', 'Menu → Réglages → « *Aide pour débuter* » : revoir un tutoriel ou tout couper. Le guide complet est dans le menu : « *Comment ça marche* ».', 'tutoriel tuto aide revoir guide comment ca marche explication', 'guide']
  ].map(([t, q, r, m, a], i) => ({ id: 'q' + i, t, q, r, m: m || '', a }));

  // les plus utiles d'abord, quand rien n'est encore écrit
  const FREQ = ['Comment se passe le paiement ?', 'La marchandise est gâtée, je fais quoi ?', 'Comment vendre mon produit ?', 'Comment acheter ?', 'J’ai oublié mon code secret', 'On me demande de payer d’avance', 'Que veut dire le sceau bleu ?', 'Comment suivre ma commande ?'];

  /* ——— la recherche (sur le téléphone, sans serveur) ——— */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/[^a-z0-9,]+/g, ' ').trim();
  const VIDES = new Set('le la les l de des du d un une et ou est sont je j me m mon ma mes on pour que qu qui quoi ce c a au aux en il elle ils vous nous ne n pas y s t se sa son ses ca cela comment faire fait peut peux veux dois avec sur dans par plus tres bien bonjour svp merci etre avoir faut ai as moi mais donc alors'.split(' '));
  const mots = s => norm(s).split(' ').filter(w => w.length > 1 && !VIDES.has(w));
  QR.forEach(e => { e._q = mots(e.q); e._m = mots(e.m); e._r = mots(e.r.replace(/\*/g, '')); });
  const proche = (a, b) => {   // une faute de frappe (une lettre de trop, de moins ou changée), pour les mots de 5 lettres et plus
    if (Math.abs(a.length - b.length) > 1 || a.length < 5) return false;
    let i = 0, j = 0, d = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { i++; j++; continue; } if (++d > 1) return false; if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; } }
    return d + (a.length - i) + (b.length - j) <= 1; };
  const touche = (w, L) => L.some(x => x === w || (w.length >= 3 && x.startsWith(w)) || (x.length >= 4 && w.startsWith(x)) || proche(w, x));
  function chercher(texte, n = 8) {
    const W = mots(texte); if (!W.length) return [];
    return QR.map(e => { let s = 0, vus = 0; W.forEach(w => { const a = touche(w, e._q) ? 3 : 0, b = touche(w, e._m) ? 3 : 0, c = touche(w, e._r) ? 1 : 0; const p = Math.max(a, b) + (a && b ? 1 : 0) + c; if (p) { s += p; vus++; } });
      return { e, s: vus ? s + vus * 2 + (vus === W.length ? 3 : 0) + (FREQ.includes(e.q) ? 2 : 0) : 0 }; })
      .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.e);
  }

  /* ——— l'affichage ——— */
  const CSS = `.ai{position:fixed;inset:0;z-index:9300;background:#F6F1E7;color:#171512;display:flex;flex-direction:column;font:400 17px/1.5 Jost,system-ui,sans-serif;
  transform:translateY(100%);transition:transform .38s cubic-bezier(.22,1,.36,1);padding-top:env(safe-area-inset-top)}
.ai.on{transform:none}
.ai-h{flex:none;display:flex;align-items:center;gap:4px;height:56px;padding:0 6px;border-bottom:1px solid rgba(23,21,18,.08)}
.ai-h button{width:48px;height:48px;border:0;background:none;border-radius:24px;display:grid;place-items:center;color:#171512}
.ai-h b{flex:1;text-align:center;font-weight:600;font-size:17px}
.ai-b{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:18px 16px 24px;overscroll-behavior:contain}
.ai-t{margin:0;font:600 30px/1.04 Jost,sans-serif;letter-spacing:-.015em}.ai-t em{font-style:italic;font-weight:800;background:linear-gradient(transparent 62%,rgba(242,194,48,.55) 62%);padding:0 2px}
.ai-lead{margin:8px 0 0;color:#5b5348;font-size:16px}
.ai-s{position:sticky;top:-18px;z-index:2;margin:14px -16px 0;padding:10px 16px;background:#F6F1E7}
.ai-s label{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 8px 0 16px;border-radius:28px;background:#FFFCF6;box-shadow:0 1px 2px rgba(23,21,18,.08),0 8px 22px rgba(23,21,18,.07);border:2px solid transparent;color:#5b5348}
.ai-s label:focus-within{border-color:#10392B}
.ai-s input{flex:1;min-width:0;border:0;background:none;font:500 17px Jost,sans-serif;color:#171512;outline:none;height:52px}
.ai-s input::placeholder{color:#8a7f72}
.ai-s input:focus,.ai-s input:focus-visible{outline:none!important;box-shadow:none!important}
.ai-s .ai-eff{width:44px;height:44px;border:0;border-radius:22px;background:none;display:grid;place-items:center;color:#5b5348}
.ai-s .ai-eff[hidden]{display:none}
.ai-s input::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
.ai-th{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}
.ai-th button{min-height:44px;padding:0 14px;border-radius:22px;border:1px solid rgba(23,21,18,.14);background:#FFFCF6;color:#171512;font:500 15px Jost,sans-serif;display:inline-flex;align-items:center;gap:7px}
.ai-th button[aria-pressed=true]{background:#10392B;border-color:#10392B;color:#F3EFE4}
.ai-sh{margin:22px 0 10px;font:600 13px/1 Jost,sans-serif;letter-spacing:0;color:#7a7064}
.ai-l{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.ai-it{background:#FFFCF6;border-radius:18px;box-shadow:0 1px 2px rgba(23,21,18,.06)}
.ai-q{width:100%;min-height:56px;border:0;background:none;text-align:left;padding:12px 14px;display:flex;align-items:center;gap:12px;font:500 16.5px/1.3 Jost,sans-serif;color:#171512}
.ai-q i{flex:none;width:30px;height:30px;border-radius:50%;background:#FBEFC4;color:#7A5600;display:grid;place-items:center;font:700 15px Jost,sans-serif;font-style:normal}
.ai-q span{flex:1}.ai-q mark{background:linear-gradient(transparent 60%,rgba(242,194,48,.6) 60%);color:inherit;padding:0}
.ai-q svg{flex:none;transition:transform .25s;color:#7a7064}
.ai-it.ouv .ai-q svg{transform:rotate(90deg)}
.ai-r{display:none;padding:0 16px 16px 56px;color:#3d372f;font-size:16.5px}
.ai-it.ouv .ai-r{display:block;animation:aiIn .25s ease}
@keyframes aiIn{from{opacity:0;transform:translateY(-4px)}}
.ai-r p{margin:0}
.ai-r .ai-go{margin:12px 0 0;min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;display:inline-flex;align-items:center;gap:8px}
.ai-ok{margin:14px 0 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14.5px;color:#7a7064}
.ai-ok button{min-height:40px;padding:0 14px;border-radius:20px;border:1px solid rgba(23,21,18,.16);background:none;color:#171512;font:500 14.5px Jost,sans-serif}
.ai-ok b{color:#23744A;font-weight:600}
.ai-rien{margin:18px 0 0;background:#FFFCF6;border-radius:20px;padding:18px 16px;text-align:center;color:#5b5348}
.ai-rien b{display:block;color:#171512;font-size:18px;margin-bottom:4px}
.ai-p{flex:none;padding:10px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid rgba(23,21,18,.08);background:#F6F1E7}
.ai-p p{margin:0 0 8px;text-align:center;font-size:14px;color:#7a7064}
.ai-hum{width:100%;min-height:54px;border:0;border-radius:27px;background:#10392B;color:#F3EFE4;font:600 17px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px}
.ai-hum.vif{animation:aiVif 1.1s ease 2}
@keyframes aiVif{0%,100%{box-shadow:0 0 0 0 rgba(242,194,48,0)}40%{box-shadow:0 0 0 7px rgba(242,194,48,.65)}}
.ai-f h2{margin:4px 0 0;font:600 26px/1.08 Jost,sans-serif}
.ai-f > p{margin:8px 0 0;color:#5b5348;font-size:16px}
.ai-f textarea{margin:16px 0 0;width:100%;box-sizing:border-box;min-height:150px;border:2px solid rgba(23,21,18,.12);border-radius:18px;background:#FFFCF6;padding:14px;font:400 17px/1.45 Jost,sans-serif;color:#171512;resize:vertical;outline:none}
.ai-f textarea:focus{border-color:#10392B}
.ai-f .ai-info{margin:12px 0 0;display:flex;gap:10px;align-items:flex-start;background:#DDE9F6;color:#1F5A96;border-radius:16px;padding:12px 14px;font-size:14.5px}
.ai-f .ai-env{margin:16px 0 0;width:100%;min-height:54px;border:0;border-radius:27px;background:#10392B;color:#F3EFE4;font:600 17px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px}
.ai-f .ai-env:disabled{opacity:.5}
/* la rangée d'aide dans la conversation avec le Marché de Gros (v3/messages.js) : défile de gauche à droite */
.dm-f:has(.dm-sug){flex-wrap:wrap}
.dm-sug{flex-basis:100%;display:flex;gap:6px;margin:0 -10px 8px;padding:0 10px 2px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.dm-sug::-webkit-scrollbar{display:none}
.dm-sug button{flex:none;max-width:78%;min-height:40px;border:1px solid rgba(23,21,18,.12);border-radius:20px;background:#FFFCF6;color:#171512;font:500 14.5px/1.2 Jost,sans-serif;padding:0 14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dm-sug button.trouve{background:#FBEFC4;border-color:rgba(122,86,0,.25);color:#4d3a00}
.dm-sug .dm-sug-aide{background:#10392B;border-color:#10392B;color:#F3EFE4;font-weight:600}
@media (prefers-reduced-motion:reduce){.ai,.ai-it.ouv .ai-r,.ai-hum.vif{transition:none;animation:none}}`;
  function style() { if (document.getElementById('aiCss')) return; const s = document.createElement('style'); s.id = 'aiCss'; s.textContent = CSS; document.head.appendChild(s); }
  style();

  let el = null, etat = { q: '', theme: '', ouv: '', vue: 'liste', dernier: null };
  const surligner = (q, W) => { let h = esc(q); if (!W.length) return h;
    // le texte sans accents, lettre pour lettre (même longueur que la question) : les positions trouvées valent pour la question
    const n = [...q].map(ch => { const x = ch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return /^[a-z0-9]$/.test(x) ? x : ' '; }).join(''); const plages = [];
    W.forEach(w => { if (w.length < 3) return; const re = new RegExp('\\b' + w.replace(/[^a-z0-9]/g, ''), 'g'); let m; while ((m = re.exec(n))) plages.push([m.index, m.index + w.length]); });
    if (!plages.length || n.length !== q.length) return h;
    plages.sort((a, b) => a[0] - b[0]); let out = '', i = 0;
    plages.forEach(([a, b]) => { if (a < i) return; out += esc(q.slice(i, a)) + '<mark>' + esc(q.slice(a, b)) + '</mark>'; i = b; });
    return out + esc(q.slice(i)); };
  const item = (e, W) => `<li class="ai-it${etat.ouv === e.id ? ' ouv' : ''}" data-id="${e.id}"><button type="button" class="ai-q" aria-expanded="${etat.ouv === e.id}"><i aria-hidden="true">?</i><span>${surligner(e.q, W || [])}</span>${IC('fleche', 18, 2)}</button>
    <div class="ai-r"><p>${gras(e.r)}</p>${e.a && ALLER[e.a] ? `<button type="button" class="ai-go" data-aller="${e.a}">${esc(ALLER[e.a][0])} ${IC('fleche', 18, 2)}</button>` : ''}
    <div class="ai-ok" data-ok><span>Ça vous a aidé ?</span><button type="button" data-oui>Oui</button><button type="button" data-non>Non</button></div></div></li>`;

  function liste() {
    const q = etat.q.trim(), W = mots(q);
    let corps;
    if (q) {
      const r = chercher(q, 10);
      corps = r.length ? `<h2 class="ai-sh">Réponses toutes prêtes</h2><ul class="ai-l">${r.map(e => item(e, W)).join('')}</ul>`
        : `<div class="ai-rien">${window.MDGSac ? MDGSac.svg('vide', { t: 56 }) : ''}<b>Pas de réponse toute prête</b>Essayez avec d’autres mots, ou parlez directement à une personne de l’équipe.</div>`;
    } else if (etat.theme) {
      const th = THEMES.find(x => x[0] === etat.theme);
      corps = `<h2 class="ai-sh">${esc(th ? th[1] : '')}</h2><ul class="ai-l">${QR.filter(e => e.t === etat.theme).map(e => item(e)).join('')}</ul>`;
    } else {
      corps = `<h2 class="ai-sh">Les questions les plus posées</h2><ul class="ai-l">${FREQ.map(t => QR.find(e => e.q === t)).filter(Boolean).map(e => item(e)).join('')}</ul>`;
    }
    return `<h1 class="ai-t">Une <em>question</em> ?</h1>
      <p class="ai-lead">Écrivez-la : les réponses s’affichent pendant que vous tapez. Rien ne vous aide ? Une personne de l’équipe vous répond.</p>
      <div class="ai-s"><label>${IC('chercher', 22, 2)}<input type="search" enterkeyhint="search" autocomplete="off" placeholder="Ex. : payer, colis gâté, code…" aria-label="Votre question" value="${esc(etat.q)}"><button type="button" class="ai-eff" aria-label="Effacer"${q ? '' : ' hidden'}>${IC('fermer', 18, 2)}</button></label></div>
      ${q ? '' : `<div class="ai-th" role="group" aria-label="Thèmes">${THEMES.map(([id, nom, ico]) => `<button type="button" data-th="${id}" aria-pressed="${etat.theme === id}">${IC(ico, 18, 2)}${esc(nom)}</button>`).join('')}</div>`}
      <div data-res>${corps}</div>`;
  }
  function formulaire() {
    const ss = N() && N().session && N().session();
    const base = etat.q.trim() || (etat.dernier ? 'À propos de : « ' + etat.dernier + ' »\n' : '');
    return `<div class="ai-f"><h2>Parler à une personne</h2>
      <p>Écrivez votre question. L’équipe du Marché de Gros reçoit une *notification* et vous répond dans vos Messages.</p>`.replace(/\*([^*]+)\*/g, '<b>$1</b>') +
      (ss ? `<textarea maxlength="1800" aria-label="Votre question pour l’équipe" placeholder="Bonjour, j’ai besoin d’aide pour…">${esc(base)}</textarea>
      <p class="ai-info">${IC('info', 20, 2)}<span>Ne donnez jamais votre code secret ni un code de commande. Les numéros et les liens sont refusés. Les échanges sont gardés 1 an et lisibles par l’équipe.</span></p>
      <button type="button" class="ai-env" disabled>${IC('envoyer', 20, 2)} Envoyer à l’équipe</button>`
      : `<p class="ai-info">${IC('info', 20, 2)}<span>Pour qu’on puisse vous répondre, connectez-vous d’abord (numéro et code secret).</span></p>
      <button type="button" class="ai-env" data-cnx>Se connecter</button>`) + `</div>`;
  }

  function dessiner(garderFocus) {
    const b = el.querySelector('.ai-b'), pied = el.querySelector('.ai-p');
    if (etat.vue === 'personne') { b.innerHTML = formulaire(); pied.hidden = true; el.querySelector('.ai-h b').textContent = 'L’équipe'; brancherForm(b); b.scrollTop = 0; return; }
    pied.hidden = false; el.querySelector('.ai-h b').textContent = 'Aide';
    b.innerHTML = liste(); brancher(b);
    if (garderFocus) { const i = b.querySelector('input'); i.focus({ preventScroll: true }); try { i.setSelectionRange(i.value.length, i.value.length); } catch (_) {} }
  }
  // pendant la frappe : on ne redessine que les résultats (le clavier reste ouvert)
  function resultats(b) {
    const tmp = document.createElement('div'); tmp.innerHTML = liste();
    const res = b.querySelector('[data-res]'); res.innerHTML = tmp.querySelector('[data-res]').innerHTML;
    const th = b.querySelector('.ai-th'), thN = tmp.querySelector('.ai-th');
    if (th && !thN) th.remove(); else if (!th && thN) b.querySelector('.ai-s').after(thN);
    b.querySelector('.ai-eff').hidden = !etat.q.trim();
    brancherRes(b);
  }
  function brancherRes(b) {
    b.querySelectorAll('.ai-th button').forEach(x => x.onclick = () => { etat.theme = etat.theme === x.dataset.th ? '' : x.dataset.th; etat.ouv = ''; dessiner(); });
    b.querySelectorAll('.ai-it').forEach(li => {
      li.querySelector('.ai-q').onclick = () => { const id = li.dataset.id, ouvre = etat.ouv !== id; etat.ouv = ouvre ? id : '';
        b.querySelectorAll('.ai-it').forEach(x => { const o = x.dataset.id === etat.ouv; x.classList.toggle('ouv', o); x.querySelector('.ai-q').setAttribute('aria-expanded', o); });
        if (ouvre) { const e = QR.find(x => x.id === id); etat.dernier = e && e.q; setTimeout(() => li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60); } };
      const go = li.querySelector('[data-aller]'); if (go) go.onclick = () => { const a = ALLER[go.dataset.aller]; fermer(); setTimeout(a[1], 400); };
      const ok = li.querySelector('[data-ok]');
      ok.querySelector('[data-oui]').onclick = () => { ok.innerHTML = '<b>Merci ! Content que ça vous aide.</b>'; };
      ok.querySelector('[data-non]').onclick = () => { ok.innerHTML = '<span>Désolé. Touchez « Je veux parler à une personne » en bas : l’équipe vous répond.</span>'; const h = el.querySelector('.ai-hum'); h.classList.remove('vif'); void h.offsetWidth; h.classList.add('vif'); };
    });
  }
  function brancher(b) {
    const i = b.querySelector('input'); let t = 0;
    i.oninput = () => { etat.q = i.value; etat.ouv = ''; clearTimeout(t); t = setTimeout(() => resultats(b), 120); };
    i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } };
    b.querySelector('.ai-eff').onclick = () => { etat.q = ''; etat.ouv = ''; i.value = ''; resultats(b); i.focus(); };
    brancherRes(b);
  }
  function brancherForm(b) {
    const cnx = b.querySelector('[data-cnx]');
    if (cnx) { cnx.onclick = () => { N() && N().open('Connectez-vous pour écrire à l’équipe du Marché de Gros.'); const apres = () => { removeEventListener('mdg:connecte', apres); if (el && etat.vue === 'personne') setTimeout(() => dessiner(), 400); }; addEventListener('mdg:connecte', apres); }; return; }
    const ta = b.querySelector('textarea'), go = b.querySelector('.ai-env');
    const maj = () => { go.disabled = !ta.value.trim(); }; ta.oninput = maj; maj();
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 350);
    go.onclick = async () => {
      const t = ta.value.trim(); if (!t) return;
      const refus = N() && N().texteRefus ? N().texteRefus(t) : ''; if (refus) { N().toast(refus); ta.focus(); return; }
      if (!window.MDGMessages || !MDGMessages.parlerPersonne) { N() && N().toast('Messagerie indisponible pour l’instant. Réessayez.'); return; }
      go.disabled = true; go.textContent = 'Envoi…';
      const ok = await MDGMessages.parlerPersonne(t);
      if (ok) { etat.q = ''; etat.vue = 'liste'; fermer(); }
      else { go.disabled = false; go.innerHTML = IC('envoyer', 20, 2) + ' Envoyer à l’équipe'; }
    };
  }

  function ouvrir(o = {}) {
    style();
    etat = { q: o.q || '', theme: '', ouv: o.id || '', vue: o.personne ? 'personne' : 'liste', dernier: null };
    if (o.id) { const e = QR.find(x => x.id === o.id); if (e) { etat.theme = e.t; etat.dernier = e.q; } }
    if (!el) {
      el = document.createElement('div'); el.className = 'ai'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Aide du Marché de Gros');
      el.innerHTML = `<div class="ai-h"><button type="button" data-r aria-label="Retour">${IC('retour', 24, 2)}</button><b>Aide</b><button type="button" data-x aria-label="Fermer">${IC('fermer', 22, 2)}</button></div>
        <div class="ai-b"></div><div class="ai-p"><p>Rien ne vous aide ?</p><button type="button" class="ai-hum">${IC('messages', 22, 2)} Je veux parler à une personne</button></div>`;
      document.body.appendChild(el);
      el.querySelector('[data-x]').onclick = fermer;
      el.querySelector('[data-r]').onclick = () => { if (etat.vue === 'personne') { etat.vue = 'liste'; dessiner(); } else if (etat.theme && !etat.q) { etat.theme = ''; etat.ouv = ''; dessiner(); } else fermer(); };
      el.querySelector('.ai-hum').onclick = () => { etat.vue = 'personne'; dessiner(); };
      el.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });
    }
    dessiner();
    if (o.id) setTimeout(() => { const li = el && el.querySelector(`.ai-it[data-id="${o.id}"]`); if (li) li.scrollIntoView({ block: 'center' }); }, 420);
    requestAnimationFrame(() => requestAnimationFrame(() => { if (!el) return; el.classList.add('on');
      const i = el.querySelector('.ai-s input'); if (i && matchMedia('(hover:hover) and (pointer:fine)').matches) i.focus({ preventScroll: true }); }));
    if (window.MDGAstuces && MDGAstuces.tour && etat.vue === 'liste') setTimeout(() => { if (el) MDGAstuces.tour('aide'); }, 700);
  }
  function fermer() { if (!el) return; el.classList.remove('on'); const e = el; el = null; setTimeout(() => e.remove(), 400); }

  window.MDGAide = { ouvrir, fermer, chercher: (t, n) => chercher(t, n).map(e => ({ id: e.id, q: e.q })),
    frequentes: n => FREQ.slice(0, n || 4).map(t => QR.find(e => e.q === t)).filter(Boolean).map(e => ({ id: e.id, q: e.q })), QR, THEMES };
})();
