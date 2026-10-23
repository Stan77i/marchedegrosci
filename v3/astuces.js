/* ═════════ Marché de Gros CI — astuces et petits tutoriels, pour les nouveaux ═════════
   Demandé par le propriétaire le 22/10/2026 : l'application est riche (codes, transport, négociation…) ;
   il faut de petits signes qui montrent quoi toucher, et un court tutoriel avant une opération un peu compliquée.
   • Signes animés sur l'accueil (un seul par ouverture) : le panier en haut à gauche glisse de gauche à droite
     → « touchez ici : le menu » ; puis la roue des produits ; puis les onglets. Chacun s'arrête dès qu'on a compris
     (menu ouvert) ou après 3 fois.
   • Tutoriels (quelques cartes, « Passer » toujours visible) : la première fois qu'on ouvre une négociation,
     la création d'une commande, le choix du chauffeur, un code, l'Espace chauffeur. Une seule fois chacun.
   • Réglages → « Aide pour débuter » : tout couper, ou revoir un tutoriel. Rien ne part au serveur : tout reste sur ce téléphone.
   Mouvement réduit (réglage du téléphone) : pas de déplacement, seulement la bulle.
   API : MDGAstuces.actif() · regler(oui) · tour(id, force) · revoir() · frequence(f?) · TOURS */
(function () {
  'use strict';
  if (window.MDGAstuces) return;
  const KOFF = 'mdg-astuces:off', KVU = 'mdg-astuces:vu';
  const lire = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const actif = () => lire(KOFF, false) !== true;
  const vus = () => lire(KVU, {});
  const noter = (k, n) => { const v = vus(); v[k] = n == null ? (v[k] || 0) + 1 : n; ecrire(KVU, v); };
  const REDUIT = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const gras = s => esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>');

  // le pictogramme de chaque carte : une icône de l'application (app/icones.js), jamais un emoji (chaque téléphone dessine
  // les emoji à sa façon, et ils font « généré »). Les cartes gardent leur emoji dans le code pour rester lisibles ; voici la correspondance.
  const PICTO = { '🤝': 'echanger', '🪪': 'verifie', '👀': 'oeil', '👆': 'fleche', '✅': 'traiter', '📦': 'boite', '🚚': 'camion', '🚛': 'camion', '🚫': 'signaler', '💰': 'prix', '💵': 'prix',
    '🧾': 'etiquette', '⚖️': 'confiance', '🛡️': 'confiance', '📊': 'tableau', '🔎': 'chercher', '🔍': 'chercher', '🧺': 'offre', '⏳': 'sablier', '⏰': 'horloge', '🔐': 'cadenas', '🔒': 'cadenas', '🤐': 'cadenas',
    '🔓': 'cle', '📍': 'lieu', '✍️': 'crayon', '📝': 'crayon', '✏️': 'crayon', '💬': 'messages', '🔔': 'cloche', '👍': 'traiter', '⌨️': 'ecran', '🗣️': 'comment', '📸': 'photo', '🤳': 'photo',
    '⚠️': 'signaler', '📄': 'donnees', '⬆️': 'haut', '🛒': 'panier', '🗺️': 'pays', '🗂️': 'categories', '📈': 'tendance', '🌾': 'annee', '🌱': 'producteur', '💡': 'info', '👤': 'compte', '⚙️': 'reglages',
    '📣': 'partager', '🏅': 'notes', '🎯': 'localiser' };
  const pictogramme = e => { const n = PICTO[e]; return n && window.MDGIco && MDGIco.a(n) ? MDGIco.svg(n, 40, 1.7) : esc(e); };

  /* ——— les tutoriels : des phrases courtes, un geste par carte (ce que l'application fait vraiment, rien d'autre) ——— */
  const TOURS = {
    placer: { t: 'La roue et les prix', cartes: [
      ['🧺', 'La roue des produits', 'Glissez le doigt sur le *sac*, ou touchez les flèches : chaque produit a son sac et son *meilleur prix*.'],
      ['💰', 'Le meilleur prix, en direct', 'Sous la roue : le prix le *moins cher* publié. Il change dès que quelqu’un place un meilleur prix. *Touchez-le.*'],
      ['📊', 'L’échelle des prix', 'Du moins cher au plus cher : qui a publié, d’où, combien il en a. En *vert* les vendeurs, en *jaune* les acheteurs.'],
      ['⬆️', 'Votre place', 'Proposez *moins* que le meilleur prix : vous passez en tête. Vous achetez ? Proposez un budget *plus haut*.'],
      ['✍️', 'Placez votre prix', 'Touchez *« Placer mon prix »*, ou négociez avec le vendeur. Le bouton *Démo*, au-dessus de la roue, rejoue la démonstration.']] },
    negoce: { t: 'Proposer un prix', cartes: [
      ['🤝', 'Proposez votre prix', 'Écrivez votre *prix* et la *quantité*. L’autre personne reçoit votre proposition dans l’application.'],
      ['⏳', 'Elle a 48 heures pour répondre', 'Elle *accepte*, elle *refuse*, ou elle propose un autre prix. Vous pouvez retirer votre proposition tant qu’elle n’a pas répondu.'],
      ['✅', 'L’accord est conclu', 'Le prix et la quantité ne bougent plus. L’annonce baisse de la quantité convenue.'],
      ['📦', 'Ensuite, la commande', 'Depuis l’accord, créez la commande : qui transporte, où livrer. Pour l’instant, *paiement à la livraison*, après avoir vu la marchandise.'],
      ['👀', 'Rien n’est secret', 'La négociation reste dans l’application. En cas de litige, l’équipe du Marché de Gros peut la *relire*.']] },
    commande: { t: 'Créer la commande', cartes: [
      ['🚚', 'Qui transporte ?', 'Le *vendeur* livre, ou l’*acheteur* s’en charge. Le transporteur du réseau Marché de Gros arrive *bientôt*.'],
      ['🔐', 'Avec codes : le plus sûr', 'Le chauffeur a l’application : il tape le code du *vendeur* au chargement, puis celui de l’*acheteur* à la réception. Personne ne peut valider à votre place.'],
      ['👍', 'L’autre partie confirme', 'Puis chaque étape s’affiche avec son heure : préparation, chargement, transport, arrivée, réception.'],
      ['🚫', 'Confirmée = engagée', 'Une fois la commande confirmée, l’*acheteur ne peut plus l’annuler*. Seul le vendeur peut demander l’annulation, avant le chargement.']] },
    transport: { t: 'Choisir le chauffeur', cartes: [
      ['🪪', 'Chaque chauffeur a son code', 'Il le trouve dans son *Espace chauffeur*. Il ressemble à *T-4K7P*.'],
      ['⌨️', 'Tapez son code ici', 'Demandez-lui son code, tapez-le, puis touchez *« Choisir »*. La mission arrive dans son application.'],
      ['💰', 'Il accepte et fixe son prix', 'Sa réponse et le prix du transport s’affichent dans la commande. Vous le payez à la livraison, avec la marchandise.'],
      ['🛡️', '« Vérifié par l’équipe »', 'Ce badge veut dire que l’équipe a contrôlé ce chauffeur. Sans lui, soyez prudent.']] },
    codes: { t: 'Les codes', cartes: [
      ['🔐', 'Votre code secret', 'Vendeur : le code de *prise en charge*. Acheteur : le code de *réception*. Il ne sert qu’une seule fois.'],
      ['🚚', 'Vérifiez d’abord le chauffeur', 'Exigez qu’il vous montre son *code transporteur* (T-4K7P) dans son application. S’il ne l’a pas, ce n’est pas le bon chauffeur.'],
      ['👀', 'Donnez-le au bon moment', 'Vendeur : quand la marchandise est *dans le camion*. Acheteur : *après avoir vérifié* la quantité et la qualité.'],
      ['🗣️', 'De vive voix seulement', 'Ne l’envoyez jamais par message ni par WhatsApp. Le chauffeur le tape dans son application : l’étape est validée. Vos codes sont aussi dans *Accueil → Alertes*.']] },
    chauffeur: { t: 'L’Espace chauffeur', cartes: [
      ['🚛', 'Bienvenue, chauffeur', 'Inscrivez-vous, c’est *gratuit*. L’équipe du Marché de Gros vérifie votre profil.'],
      ['🪪', 'Votre code transporteur', 'Donnez-le au vendeur ou à l’acheteur : il le tape pour vous confier la mission. Vous *acceptez* en fixant votre prix, ou vous refusez.'],
      ['📦', 'Au chargement', 'Montrez votre code transporteur au vendeur. Il vous dit son *code de prise en charge* : tapez-le. Besoin ? Touchez *« Demander le code »*.'],
      ['📍', 'À la livraison', 'Même chose avec l’acheteur : il vérifie la marchandise, puis vous dit le *code de réception*. Vous le tapez : la livraison est validée.'],
      ['💰', 'Votre prix, moins 6,9 %', 'C’est la commission du Marché de Gros. Si l’acheteur refuse la marchandise, dites honnêtement ce que vous avez vu : *votre transport reste dû*.']] },
    // ——— schémas 57 à 61 : séquestre, mot secret, refus, discussion, tableau des prix (montrés jusqu'à 3 fois, tant que « J’ai compris » n’est pas touché) ———
    mot: { t: 'Le mot secret', insiste: 3, cartes: [
      ['📝', 'Votre mot secret', 'Il s’affiche en jaune dans votre commande, par exemple *MANGUE 47*.'],
      ['✍️', 'Sur un papier, dans le colis', 'Écrivez-le sur un papier et *glissez-le dans la marchandise* avant le chargement.'],
      ['📸', 'C’est votre protection', 'Pour refuser la marchandise, l’acheteur *doit taper ce mot* et le photographier. Sans lui, il ne peut pas se faire rembourser.'],
      ['🤐', 'Ne le donnez à personne', 'Ni par message, ni au téléphone. Il est *dans le colis*, c’est tout.']] },
    verifier: { t: 'Vérifier et libérer', insiste: 3, cartes: [
      ['🔍', 'Vérifiez la marchandise', 'Quantité, qualité, et le *papier du vendeur* glissé dans le colis.'],
      ['✅', 'Tout est bon ?', 'Touchez *« Tout est conforme »*. Le vendeur et le transporteur reçoivent leur part.'],
      ['⏰', 'Sans réponse : 24 h', 'Si vous ne réclamez pas, le paiement est *libéré tout seul 24 h après la réception*. L’heure exacte est affichée.'],
      ['⚠️', 'Un problème ?', 'Touchez *« Refuser la marchandise »* avant la fin du délai, avec le mot du vendeur et des photos.']] },
    refus: { t: 'Refuser la marchandise', insiste: 3, cartes: [
      ['🧾', 'Il faut des preuves réelles', 'Le *mot secret du vendeur* (le papier dans le colis) et *1 à 4 photos* : la marchandise et le papier.'],
      ['🤝', 'Si le vendeur reconnaît', 'La partie refusée vous revient, le reste va au vendeur. Le *transport reste dû* : le chauffeur a fait son travail.'],
      ['⚖️', 'Sinon, on en parle à trois', 'Vous, le vendeur et le *Marché de Gros*, dans la discussion de la commande. L’équipe juge avec tous les échanges.'],
      ['📄', 'Pas de papier ?', 'Revenez en arrière et touchez *« Signaler un problème »* : rien n’est rendu tout seul, l’équipe juge.']] },
    discussion: { t: 'La discussion à trois', insiste: 2, cartes: [
      ['💬', 'Acheteur, vendeur, Marché de Gros', 'Expliquez-vous ici, calmement. Chaque message prévient les deux autres.'],
      ['👀', 'Rien n’est secret', 'L’équipe lit *tout* : la négociation, vos messages, les photos, le mot du vendeur. C’est comme ça qu’elle juge.'],
      ['🚫', 'Pas de numéro, pas de lien', 'Tout se règle dans l’application. Le Marché de Gros ne vous demandera *jamais d’argent* par message.']] },
    sequestre: { t: 'Le paiement sécurisé', insiste: 2, cartes: [
      ['💵', 'Aujourd’hui : à la livraison', 'Vous payez *à la livraison*, après avoir vu la marchandise. Le séquestre est *en construction*.'],
      ['🔒', 'Bientôt : l’argent bloqué', 'Dès la commande confirmée, l’acheteur paiera par Wave, Orange Money ou MTN MoMo. L’argent restera *bloqué* : le vendeur ne fera plus le voyage pour rien.'],
      ['🔓', 'La libération', 'L’acheteur valide, ou *24 h* passent sans réclamation : chacun reçoit sa part. Vendeur : moins *3,5 %*. Transporteur : moins *6,9 %*.']] },
    prix: { t: 'Le tableau des prix', insiste: 2, cartes: [
      ['📊', 'Comme un marché P2P', '*Acheter* : les vendeurs, le moins cher en haut. *Vendre* : les acheteurs, le meilleur budget en haut.'],
      ['⬆️', 'Baissez votre prix, vous montez', 'Le tableau se met à jour tout seul. À prix égal, le *transport compris* passe devant.'],
      ['🤝', 'Touchez « Acheter » ou « Vendre »', 'Vous proposez votre prix dans l’application. *Aucun numéro* : le Marché de Gros est le seul intermédiaire.']] },
    // ——— un tutoriel à l'entrée de chaque écran du menu (montré 2 fois au plus, tant que « J’ai compris » n’est pas touché) ———
    p_acheter: { t: 'Acheter', insiste: 2, cartes: [
      ['🔎', 'Tout ce qui est à vendre', 'Cherchez un produit en haut : les noms locaux sont compris (aloco, gnangnan…). Affinez avec les *filtres*.'],
      ['🧺', 'Chaque offre en un coup d’œil', 'Produit, quantité, prix, lieu et nom du vendeur. Le *sceau bleu* : identité vérifiée par l’équipe.'],
      ['🤝', 'Écrire ou proposer un prix', 'Touchez une offre, puis *« Écrire »* ou *« Proposer un prix »*. Votre numéro reste caché.']] },
    p_vendre: { t: 'Vendre', insiste: 2, cartes: [
      ['🧺', 'Publiez votre offre', 'Choisissez le *produit*, ajoutez une *photo* si vous pouvez, puis la *quantité*.'],
      ['💰', 'Votre prix et votre transport', 'Écrivez votre prix, ou laissez *« À discuter »*. Dites si le *transport est compris*. Un bon prix vous fait monter dans l’onglet *Prix*.'],
      ['🪪', 'Votre nom, toujours', 'L’annonce porte le *nom de votre compte* : il ne se change pas ici. Les acheteurs vous écrivent dans l’application.']] },
    p_demande: { t: 'Demander', insiste: 2, cartes: [
      ['🛒', 'Dites ce qu’il vous faut', '*Quoi*, *combien*, *où* et *pour quand*.'],
      ['💵', 'Donnez votre budget', 'Avec un budget, les vendeurs savent tout de suite s’ils peuvent vous servir. Dites aussi qui s’occupe du *transport*.'],
      ['🔔', 'Les vendeurs sont prévenus', 'Ceux qui ont ce produit reçoivent votre demande et vous proposent leur prix, dans l’application.']] },
    p_carte: { t: 'Le réseau', insiste: 2, cartes: [
      ['🗺️', 'La carte du marché', 'Chaque bulle est une *ville* : *verte* pour les offres, *jaune* pour les demandes.'],
      ['👆', 'Touchez une bulle', 'Vous voyez les annonces de cette ville. En haut, choisissez un *produit* ou *« Où êtes-vous ? »*.'],
      ['📍', 'Jamais d’adresse exacte', 'La position montrée est celle de la *ville*, jamais l’adresse d’une personne.']] },
    p_categories: { t: 'Catégories', insiste: 2, cartes: [
      ['🗂️', 'Tous les produits vivriers', 'Rangés en *12 familles* : céréales, tubercules, légumes et fruits, poissons…'],
      ['👆', 'Touchez une famille, puis un produit', 'Vous ouvrez sa *fiche* : ses offres, ses demandes et sa saison.']] },
    p_prix: { t: 'Prix du marché', insiste: 2, cartes: [
      ['📈', 'Ce que demandent les vendeurs', 'Pour chaque produit : les *ronds verts* sont les prix des vendeurs, les *carrés jaunes* les budgets des acheteurs.'],
      ['🤝', '« Accord possible »', 'Un acheteur paie au moins le prix d’un vendeur : il y a une affaire à faire.'],
      ['📊', 'Le classement est dans « Prix »', 'Pour voir qui est le moins cher, en direct, ouvrez l’onglet *Prix* de l’accueil. Tous les prix viennent de vraies annonces.']] },
    p_annee: { t: 'L’année du marché', insiste: 2, cartes: [
      ['🌾', 'La saison de chaque produit', 'Touchez un *mois*, ou glissez le doigt sur le *cercle*.'],
      ['🌱', 'Touchez un produit', 'Vous voyez ses mois de *récolte* : début, pleine récolte, fin.'],
      ['💡', 'Achetez au bon moment', 'En *pleine récolte*, il y a beaucoup de marchandise : les prix baissent souvent.']] },
    p_fiche: { t: 'La fiche produit', insiste: 2, cartes: [
      ['🧺', 'Tout sur un produit', 'Ses *offres* (vendeurs) et ses *demandes* (acheteurs) du moment, avec les prix et les lieux.'],
      ['🤝', 'Agissez depuis la fiche', 'Touchez une annonce pour *écrire* ou *proposer un prix*. Ou publiez la vôtre avec *« J’ai »* / *« Je cherche »*.']] },
    p_pubs: { t: 'Mes publications', insiste: 2, cartes: [
      ['📦', 'Vos annonces et votre stock', 'Toutes vos offres et demandes publiées, au même endroit.'],
      ['✏️', 'Gardez-les à jour', 'Quand vous vendez, mettez à jour la *quantité* : les acheteurs voient le vrai stock. Retirez une annonce qui n’est plus valable.']] },
    m_compte: { t: 'Mon compte', insiste: 2, cartes: [
      ['👤', 'Votre espace', 'Votre profil, vos annonces, vos négociations et vos statuts.'],
      ['✅', 'Faites vérifier votre identité', 'Le *sceau bleu* rassure vos acheteurs et vos vendeurs.'],
      ['⚙️', 'Vos réglages', 'Notifications, sons, thème clair ou sombre, *aide pour débuter* (ces tutoriels).']] },
    m_negos: { t: 'Mes négociations', insiste: 2, cartes: [
      ['🤝', 'Toutes vos propositions', 'Chaque ligne est une négociation : la *dernière proposition* et qui doit répondre.'],
      ['⏳', 'Répondez dans les 48 h', 'Touchez une ligne pour *accepter*, *refuser* ou *proposer un autre prix*.'],
      ['📦', 'Accord conclu ?', 'Touchez *« Suivre la commande »* pour organiser la livraison.']] },
    m_messages: { t: 'Messages', insiste: 2, cartes: [
      ['💬', 'Vos conversations', 'Écrivez aux vendeurs et aux acheteurs *sans donner votre numéro*.'],
      ['👀', 'Rien n’est secret', 'Les échanges sont *gardés 1 an*. L’équipe du Marché de Gros peut les lire pour régler un litige.'],
      ['🚫', 'Quelqu’un vous dérange ?', 'Vous pouvez le *bloquer*. Les liens, numéros et réseaux sociaux sont refusés.']] },
    m_diffuser: { t: 'Message à tous', insiste: 2, cartes: [
      ['📣', 'Au nom du Marché de Gros', 'Ce message part à *tous les membres*, avec le logo, comme une annonce officielle.'],
      ['✍️', 'Court et utile', 'Une information vraie et utile à tous. Relisez avant d’envoyer : on ne peut pas le reprendre.']] },
    m_profil: { t: 'Mon profil public', insiste: 2, cartes: [
      ['🪪', 'Ce que voient les autres', 'Quand on touche votre nom : qui vous êtes, ce que vous faites, vos notes et vos statuts.'],
      ['🔒', 'Votre numéro reste caché', 'Il n’est jamais affiché. Votre nom de famille complet s’affiche seulement si vous le choisissez (Réglages).']] },
    m_notes: { t: 'Les mieux notés', insiste: 2, cartes: [
      ['🏅', 'Les membres recommandés', 'Classés d’après les *notes réelles* laissées après une négociation.'],
      ['👆', 'Touchez un nom', 'Vous voyez son profil, ses notes et ses statuts. Un statut ne s’achète pas.']] },
    m_alertes: { t: 'Alertes produits', insiste: 2, cartes: [
      ['🔔', 'Soyez prévenu', 'Choisissez vos produits (igname, tomate…) : une *notification* arrive dès qu’une annonce est publiée.'],
      ['🎯', 'Offres, demandes, ou les deux', 'Vendeur ? Suivez les *demandes*. Acheteur ? Suivez les *offres*.']] },
    m_commandes: { t: 'Mes commandes', insiste: 2, cartes: [
      ['🚚', 'Du « oui » à la livraison', 'Chaque commande, avec ses étapes et leur heure. *En cours* d’un côté, *terminées* de l’autre.'],
      ['👆', 'Touchez une commande', 'Le camion avance avec elle. Les boutons vous disent quoi faire maintenant.']] },
    m_identite: { t: 'Vérifier son identité', insiste: 2, cartes: [
      ['🪪', 'Votre pièce d’identité', 'Prenez-la en photo, *recto* et *verso*, bien nette, sans reflet.'],
      ['🤳', 'Un selfie avec le code', 'Écrivez le code affiché sur un papier et tenez-le près de votre visage.'],
      ['👀', 'L’équipe décide', 'Une personne compare et décide, en quelques jours. Une pièce expirée est refusée.']] },
    aide: { t: 'L’aide', insiste: 2, cartes: [
      ['🔎', 'Écrivez votre question', 'Avec vos mots : *payer*, *marchandise gâtée*, *code oublié*… Les questions s’affichent *pendant que vous tapez*.'],
      ['👆', 'Touchez une question', 'La *réponse* s’ouvre tout de suite. Souvent, un bouton vous emmène au bon endroit de l’application.'],
      ['🙋', 'Rien ne vous aide ?', 'Touchez *« Je veux parler à une personne »* en bas. L’équipe reçoit une notification et vous répond dans vos *Messages*.']] },
    // administrateur (admin.html)
    a_tableau: { t: 'Tableau de bord', insiste: 2, cartes: [
      ['📊', 'L’administration', 'Le menu donne chaque partie : aperçu, à traiter, annonces, comptes, négociations, messages, identités, commandes, transporteurs.'],
      ['🧾', 'Commencez par « À traiter »', 'Signalements, alertes, dossiers en attente : ce qui demande une décision.'],
      ['⚖️', 'Les litiges', 'Dans *Commandes* : on décide sur des *preuves* (mot du vendeur, photos, échanges). Suivez la procédure « Traiter un litige ».']] },
    a_commandes: { t: 'Commandes et litiges', insiste: 2, cartes: [
      ['🔎', 'Tout voir', 'Tapez le *numéro de commande* en haut, ou touchez *« Tout voir »* : accord, négociation, messages, mot secret, historique.'],
      ['🧾', 'Vérifiez les preuves', '*Photos*, mot du vendeur retrouvé, réponse du chauffeur et du vendeur. Une preuve manque ? Demandez-la une fois dans la *Discussion*.'],
      ['⚖️', 'Décidez', '*Accepter le refus* (quantité retenue) ou *le rejeter*. « Clore : annulée » rend tout à l’acheteur : seulement si rien n’a été livré.']] },
    a_identites: { t: 'Identités', insiste: 2, cartes: [
      ['🪪', 'Comparer et décider', 'Pièce recto et verso, selfie avec le code écrit : même personne, pièce valide, code lisible.'],
      ['✅', 'Valider ou refuser', 'Refusez une pièce expirée, floue, ou un selfie sans le bon code, en donnant la raison.']] }
  };
  // quand le tutoriel se montre : le premier écran trouvé dans la page (ordre = priorité)
  const DECLENCHE = [
    ['refus', '.cm-bg #cmRm'],
    ['discussion', '.cm-bg [data-disc]'],
    ['mot', '.cm-bg .cm-mot.fort'],
    ['verifier', '.cm-bg [data-g="liberer"]'],
    ['codes', '.cm-bg [data-code-bloc]'],
    ['transport', '.cm-bg [data-trf]'],
    ['commande', '.cm-bg input[name="val"]'],
    ['chauffeur', '.cm-bg[aria-label="Espace chauffeur"] .cm-st, .cm-bg[aria-label="Espace chauffeur"] form'],
    ['negoce', '.nx-bg .nx-edbox'],
    ['sequestre', '.cm-bg .cm-sq'],
    ['prix', 'mdg-tableau .tb-seg'],
    // fenêtres du menu
    ['m_identite', '.idv-bg'],
    ['m_diffuser', '.dm-bg .dm-dif'],
    ['m_messages', '.dm-bg .dm-l'],
    ['m_negos', '.nx-bg:not(:has(.nx-edbox))'],
    ['m_notes', '.rp[aria-label="Les mieux notés"]'],
    ['m_profil', '.rp[aria-label="Mon profil public"]'],
    ['m_alertes', '.al-bg'],
    ['m_commandes', '.cm-bg[aria-label="Mes commandes"] .cm-seg'],
    ['m_compte', '.cp-bg'],
    // pages (adresse de l'application)
    ['p_acheter', 'hash:^#/catalogue'],
    ['p_vendre', 'hash:^#/vendre'],
    ['p_demande', 'hash:^#/demande'],
    ['p_carte', 'hash:^#/carte'],
    ['p_categories', 'hash:^#/categories'],
    ['p_prix', 'hash:^#/prix'],
    ['p_annee', 'hash:^#/annee'],
    ['p_pubs', 'hash:^#/mes-publications'],
    ['p_fiche', 'hash:^#/produits/'],
    // administrateur
    ['a_commandes', 'admin:^#commandes'],
    ['a_identites', 'admin:^#identites'],
    ['a_tableau', 'admin:^(#apercu)?$']
  ];
  // « hash:… » : la page de l'application ouverte ; « admin:… » : la partie du tableau de bord ouverte ; sinon un sélecteur
  const ADMIN = /admin\.html$/.test(location.pathname);
  const present = sel => { try {
    if (sel.startsWith('hash:')) return !ADMIN && new RegExp(sel.slice(5)).test(location.hash);
    if (sel.startsWith('admin:')) return ADMIN && !!document.querySelector('#main') && new RegExp(sel.slice(6)).test(location.hash);
    return !!document.querySelector(sel);
  } catch (_) { return false; } };
  // déjà vu ? Un tutoriel « insistant » revient (jusqu'à N fois) tant qu'on n'a pas touché « J’ai compris » à la dernière carte
  const fini = id => { const v = vus(), T = TOURS[id] || {}; return !!v['ok:' + id] || (v['tour:' + id] || 0) >= (T.insiste || 1); };

  const CSS = `.as-tour{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,24,18,.55);font-family:Jost,system-ui,sans-serif;animation:asFond .25s ease both}
.as-c{width:100%;max-width:440px;margin:0 12px calc(14px + env(safe-area-inset-bottom));background:#FFFDF8;color:#171512;border-radius:28px;padding:18px 20px 16px;box-shadow:0 20px 50px rgba(0,0,0,.35);animation:asMonte .4s cubic-bezier(.22,1,.36,1) both}
.as-haut{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}
.as-titre{font:600 13px/1 Jost,sans-serif;letter-spacing:0;color:#655C4D}
.as-passer{border:0;background:rgba(23,21,18,.06);color:#171512;font:600 14px Jost,sans-serif;min-height:40px;padding:0 16px;border-radius:20px;cursor:pointer}
.as-vue{min-height:206px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px}
.as-vue.in{animation:asCarte .38s cubic-bezier(.22,1,.36,1) both}
.as-ill{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;font-size:46px;line-height:1;background:radial-gradient(circle at 35% 30%,#FFF6D6,#F2C230);box-shadow:0 0 0 8px rgba(242,194,48,.18);margin:4px 0 2px}
.as-ill span{display:block;line-height:0;color:#10392B;animation:asBouge 2.4s ease-in-out infinite}.as-ill span svg{display:block}
.as-vue h3{margin:0;font:700 22px/1.2 Jost,sans-serif;letter-spacing:-.01em;text-wrap:balance}
.as-vue p{margin:0;font:400 16px/1.45 Jost,sans-serif;color:#3E382C;text-wrap:pretty}.as-vue p b{color:#10392B;font-weight:600}
.as-pts{display:flex;justify-content:center;gap:6px;margin:14px 0 12px}.as-pts i{width:7px;height:7px;border-radius:4px;background:rgba(23,21,18,.18);transition:width .3s,background .3s}.as-pts i.on{width:22px;background:#10392B}
.as-bas{display:flex;gap:10px}.as-bas button{flex:1;min-height:52px;border-radius:26px;border:0;font:600 16px Jost,sans-serif;cursor:pointer}
.as-ret{background:rgba(23,21,18,.07);color:#171512}.as-ret[hidden]{display:none}.as-suiv{background:#10392B;color:#F3EFE4}
.as-off{display:block;margin:12px auto 0;border:0;background:none;color:#655C4D;font:400 13px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;min-height:36px;cursor:pointer}
.as-c button:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.as-bulle{position:fixed;z-index:9000;max-width:250px;padding:12px 14px;border-radius:16px;background:#10392B;color:#F3EFE4;font:500 14px/1.35 Jost,system-ui,sans-serif;box-shadow:0 10px 28px rgba(16,57,43,.35);opacity:0;transform:translateY(6px);transition:opacity .3s,transform .3s;pointer-events:auto}
.as-bulle.on{opacity:1;transform:none}.as-bulle b{color:#F2C230;font-weight:600}
.as-bulle::before{content:"";position:absolute;top:-6px;left:var(--fl,22px);width:14px;height:14px;background:#10392B;transform:rotate(45deg);border-radius:3px}
.as-bulle.bas::before{top:auto;bottom:-6px}
.as-bulle small{display:block;margin-top:4px;color:rgba(243,239,228,.7);font-size:12px}
.as-main{position:fixed;z-index:9001;font-size:34px;line-height:1;pointer-events:none;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}
html[data-theme=sombre] .as-c{background:#1C1915;color:#F3EFE4}html[data-theme=sombre] .as-titre,html[data-theme=sombre] .as-off{color:#B9AD98}
html[data-theme=sombre] .as-vue p{color:#D9D0BE}html[data-theme=sombre] .as-vue p b{color:#F2C230}
html[data-theme=sombre] .as-passer,html[data-theme=sombre] .as-ret{background:rgba(243,239,228,.08);color:#F3EFE4}
html[data-theme=sombre] .as-pts i{background:rgba(243,239,228,.2)}html[data-theme=sombre] .as-pts i.on{background:#F2C230}
html[data-theme=sombre] .as-suiv{background:#F2C230;color:#171512}
@keyframes asFond{from{opacity:0}}@keyframes asMonte{from{transform:translateY(40px);opacity:0}}
@keyframes asCarte{from{opacity:0;transform:translateX(24px)}}
@keyframes asBouge{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(-6px) rotate(-6deg)}60%{transform:translateY(0) rotate(4deg)}}
@media (prefers-reduced-motion:reduce){.as-tour,.as-c,.as-vue.in,.as-ill span{animation:none}.as-bulle{transition:none}}`;
  const style = () => { if (document.getElementById('asCss')) return; const s = document.createElement('style'); s.id = 'asCss'; s.textContent = CSS; document.head.appendChild(s); };

  /* ——— le tutoriel : des cartes qui se suivent ——— */
  let tourEl = null;
  function tour(id, force) {
    const T = TOURS[id]; if (!T || tourEl) return false;
    if (!force && (!actif() || fini(id))) return false;
    style(); bulleFermer(); noter('tour:' + id);
    const retour = document.activeElement; let i = 0;
    tourEl = document.createElement('div'); tourEl.className = 'as-tour';
    tourEl.setAttribute('role', 'dialog'); tourEl.setAttribute('aria-modal', 'true'); tourEl.setAttribute('aria-label', 'Comment ça marche : ' + T.t);
    tourEl.innerHTML = `<div class="as-c"><div class="as-haut"><span class="as-titre">${esc(T.t)}</span><button type="button" class="as-passer" data-passer>Passer</button></div>
      <div class="as-vue" aria-live="polite"></div><div class="as-pts" aria-hidden="true">${T.cartes.map(() => '<i></i>').join('')}</div>
      <div class="as-bas"><button type="button" class="as-ret" data-ret>Retour</button><button type="button" class="as-suiv" data-suiv></button></div>
      ${force ? '' : '<button type="button" class="as-off" data-off>Ne plus montrer les tutoriels</button>'}</div>`;
    const vue = tourEl.querySelector('.as-vue'), suiv = tourEl.querySelector('[data-suiv]'), ret = tourEl.querySelector('[data-ret]');
    const fermer = () => { if (!tourEl) return; const e = tourEl; tourEl = null; e.remove(); removeEventListener('keydown', cle, true); try { retour && retour.focus && retour.focus(); } catch (_) {} setTimeout(guetter, 400); };
    const montrer = () => { const [ill, h, p] = T.cartes[i];
      vue.classList.remove('in'); void vue.offsetWidth; vue.classList.add('in');
      vue.innerHTML = `<div class="as-ill" aria-hidden="true"><span>${pictogramme(ill)}</span></div><h3>${esc(h)}</h3><p>${gras(p)}</p>`;
      tourEl.querySelectorAll('.as-pts i').forEach((x, k) => x.classList.toggle('on', k === i));
      ret.hidden = i === 0; suiv.textContent = i === T.cartes.length - 1 ? 'J’ai compris' : 'Suivant'; };
    const cle = e => { if (!tourEl) return; if (e.key === 'Escape') { e.stopPropagation(); fermer(); } else if (e.key === 'ArrowRight' && i < T.cartes.length - 1) { i++; montrer(); } else if (e.key === 'ArrowLeft' && i > 0) { i--; montrer(); } };
    suiv.onclick = () => { if (i < T.cartes.length - 1) { i++; montrer(); } else { noter('ok:' + id, 1); fermer(); } };
    ret.onclick = () => { if (i > 0) { i--; montrer(); } };
    tourEl.querySelector('[data-passer]').onclick = fermer;
    const off = tourEl.querySelector('[data-off]'); if (off) off.onclick = () => { regler(false); fermer(); if (window.MDGToast) MDGToast.dire('Tutoriels *coupés*', { type: 'info', sous: 'Réglages → Aide pour débuter, pour les revoir.' }); };
    // glisser la carte du doigt : à gauche = suivant, à droite = retour
    let x0 = null; vue.addEventListener('pointerdown', e => { x0 = e.clientX; }); vue.addEventListener('pointerup', e => { if (x0 == null) return; const d = e.clientX - x0; x0 = null; if (d < -50 && i < T.cartes.length - 1) { i++; montrer(); } else if (d > 50 && i > 0) { i--; montrer(); } });
    addEventListener('keydown', cle, true);
    document.body.appendChild(tourEl); montrer(); setTimeout(() => { try { suiv.focus(); } catch (_) {} }, 60);
    return true;
  }

  // un écran compliqué vient de s'ouvrir ? (on regarde la page quand elle change, au plus une fois par image)
  let guetT = 0; const vu1 = new Set();   // une seule fois par ouverture de l'application, même pour un tutoriel insistant
  function guetter() {
    if (guetT || tourEl || !actif()) return;
    guetT = requestAnimationFrame(() => { guetT = 0; if (tourEl) return; const v = vus();
      for (const [id, sel] of DECLENCHE) if (!fini(id) && !vu1.has(id) && present(sel)) { vu1.add(id); setTimeout(() => { if (present(sel)) tour(id); }, 900); return; } });
  }
  function surveiller() { if (!document.body || !window.MutationObserver) return; new MutationObserver(guetter).observe(document.body, { childList: true, subtree: true }); }

  /* ——— les signes de l'accueil : une bulle près d'un bouton, et un petit mouvement ——— */
  let bulle = null, main = null, bulleT = 0, anims = [];
  function bulleFermer() {
    clearTimeout(bulleT); anims.forEach(a => { try { a.cancel(); } catch (_) {} }); anims = [];
    [bulle, main].forEach(e => { if (!e) return; e.classList.remove('on'); setTimeout(() => e.remove(), 300); }); bulle = main = null;
    removeEventListener('pointerdown', bulleTouche, true);
  }
  function bulleTouche() { bulleFermer(); }
  function pointer(cible, html, opts) {
    opts = opts || {}; style(); bulleFermer();
    const r = cible.getBoundingClientRect(); if (!r.width) return;
    bulle = document.createElement('div'); bulle.className = 'as-bulle'; bulle.setAttribute('role', 'status'); bulle.innerHTML = html + '<small>Touchez n’importe où pour fermer</small>';
    document.body.appendChild(bulle);
    const w = bulle.offsetWidth, h = bulle.offsetHeight, vw = innerWidth;
    const left = Math.max(12, Math.min(vw - w - 12, r.left + r.width / 2 - 26)), dessus = opts.dessus;
    bulle.style.left = left + 'px'; bulle.style.top = (dessus ? r.top - h - 12 : r.bottom + 12) + 'px';
    if (dessus) bulle.classList.add('bas');
    bulle.style.setProperty('--fl', Math.max(14, Math.min(w - 28, r.left + r.width / 2 - left - 7)) + 'px');
    requestAnimationFrame(() => bulle && bulle.classList.add('on'));
    if (!REDUIT() && cible.animate) {
      // le geste « glisser de gauche à droite », comme pour retirer une ligne : il part, revient, trois fois
      if (opts.glisse) anims.push(cible.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(14px)', offset: .35 }, { transform: 'translateX(14px)', offset: .5 }, { transform: 'translateX(0)' }],
        { duration: 1100, iterations: 3, easing: 'cubic-bezier(.22,1,.36,1)', delay: 300 }));
      if (opts.main) { main = document.createElement('div'); main.className = 'as-main'; main.textContent = '👆'; main.setAttribute('aria-hidden', 'true'); document.body.appendChild(main);
        main.style.left = (r.left + r.width / 2 - 60) + 'px'; main.style.top = (r.top + r.height / 2) + 'px';
        anims.push(main.animate([{ transform: 'translateX(0)', opacity: 0 }, { opacity: 1, offset: .15 }, { transform: 'translateX(110px)', opacity: 1, offset: .7 }, { transform: 'translateX(110px)', opacity: 0 }],
          { duration: 1500, iterations: 3, easing: 'ease-in-out', delay: 300 })); }
    }
    setTimeout(() => addEventListener('pointerdown', bulleTouche, true), 50);
    bulleT = setTimeout(bulleFermer, opts.duree || 7000);
  }

  // un seul signe par ouverture de l'application, le premier pas encore compris
  const SIGNES = [
    { k: 'menu', max: 3, sel: '.acc-mq', html: 'Touchez le <b>panier</b> : c’est le menu.<br>Le réseau, vos messages, vos commandes… tout est là.', glisse: true },
    { k: 'roue', max: 2, sel: '.acc-flotte', html: 'Glissez le doigt sur le <b>sac</b> pour changer de produit.', main: true, dessus: true },
    { k: 'onglets', max: 2, sel: '.acc-ong', html: '<b>Activité</b> : vos négociations et commandes.<br><b>Alertes</b> : ce qui vous attend, et vos codes.' },
    { k: 'prix', max: 3, sel: '.acc-ong', html: 'Nouveau : l’onglet <b>Prix</b>.<br>Qui vend le moins cher, qui achète le plus cher, en direct.' }
  ];
  let signeFait = false;
  // une fenêtre réellement à l'écran (le menu fermé et les feuilles cachées restent dans la page : on ne les compte pas)
  const aLEcran = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && c.visibility !== 'hidden' && c.display !== 'none' && +c.opacity > .05; };
  const libre = () => ![...document.querySelectorAll('.cm-bg,.nx-bg,.rg-bg,.gd-pastille,.gd.on,.as-tour,[role="dialog"]')].some(aLEcran) && (!location.hash || location.hash === '#/');
  function signe(essai) {
    if (signeFait || !actif()) return;
    const v = vus(), s = SIGNES.find(x => (v[x.k] || 0) < x.max); if (!s) return;
    const el = document.querySelector('[data-pg="home"] ' + s.sel) || document.querySelector(s.sel), r = el && el.getBoundingClientRect();
    const visible = r && r.width && r.top >= 0 && r.bottom <= innerHeight;
    if (!visible || !libre() || document.hidden) { if ((essai || 0) < 15) setTimeout(() => signe((essai || 0) + 1), 1500); return; }
    signeFait = true; noter(s.k); pointer(el, s.html, s);
  }
  // le menu ouvert une fois : c'est compris, plus besoin du signe
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('.acc-mq')) noter('menu', 99); }, true);

  // fréquence (Réglages → Aide pour débuter) : « une » = chaque astuce, tutoriel et démo une seule fois ; « semaine » = tout revient
  // une fois par semaine ; « toujours » = tout revient à chaque ouverture de l'application. Appliquée une fois, au chargement.
  const KFREQ = 'mdg-aide:freq', KDEP = 'mdg-aide:depuis', FREQS = ['une', 'semaine', 'toujours'];
  const frequence = f => { if (f == null) { const v = lire(KFREQ, 'une'); return FREQS.includes(v) ? v : 'une'; } if (FREQS.includes(f)) { ecrire(KFREQ, f); ecrire(KDEP, Date.now()); } return f; };
  (function appliquerFrequence() {
    const f = frequence(), d = +lire(KDEP, 0) || 0, t = Date.now(); if (f === 'une') return;
    if (f === 'toujours' || t - d > 7 * 864e5) { ecrire(KVU, {}); try { localStorage.removeItem('mdg-demo:orbite'); } catch (_) {} ecrire(KDEP, t); }
  })();
  function regler(oui) { ecrire(KOFF, !oui); if (!oui) bulleFermer(); }
  function revoir() { ecrire(KVU, {}); regler(true); }

  window.MDGAstuces = { actif, regler, revoir, tour, TOURS, pointer, frequence };
  const go = () => { surveiller(); guetter(); addEventListener('hashchange', () => setTimeout(guetter, 300)); if (!ADMIN) setTimeout(signe, 4500); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', go); else go();
})();
