/* ═════════ Marché de Gros CI — « Comment ça marche » : le guide de l'application, pour tout le monde ═════════
   Écrit simple : phrases courtes, un geste par étape, des mots de tous les jours, vouvoiement.
   Un sommaire en tuiles → une fiche par partie de l'application (à quoi ça sert, comment faire, un conseil)
   → « Montrer dans l'app » ouvre la page concernée (événement « mdg:aller » écouté par l'application).
   Une seule fois, à la première ouverture, une petite pastille « Comment ça marche ? » s'affiche en haut.
   API : MDGGuide.ouvrir(id?) · fermer() */
(function () {
  'use strict';
  const IC = (n, t, s) => window.MDGIco ? MDGIco.svg(n, t || 26, s || 1.8) : '';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // aller quelque part dans l'application : une page (l'application écoute « mdg:aller ») ou une fenêtre (module chargé)
  const PAGE = p => () => dispatchEvent(new CustomEvent('mdg:aller', { detail: { page: p } }));
  const FEN = (mod, fn) => () => { const m = window[mod]; if (m && typeof m[fn] === 'function') m[fn](); };
  // un onglet de l'accueil (Marché, Prix, Activité, Alertes)
  const ONGLET = nom => () => { if (location.hash && location.hash !== '#/') location.hash = '#/';
    setTimeout(() => { const b = [...document.querySelectorAll('.acc-ong button')].find(x => x.textContent.trim().startsWith(nom)); if (b) b.click(); }, 450); };

  /* ——— le contenu ——— (ton : couleur de la tuile ; aller : ce que fait « Montrer dans l'app ») */
  const GESTES = [
    { ico: 'chercher', ton: 'marche', t: 'Cherchez un produit', x: 'Touchez la barre en haut et écrivez un nom : tomate, aloco, gombo… Ou faites tourner la roue avec le doigt.' },
    { ico: 'vendre', ton: 'offre', t: 'Vous vendez ? Touchez « J’ai »', x: 'Le bouton vert, en bas. Vous publiez une offre : les acheteurs vous trouvent.' },
    { ico: 'acheter', ton: 'demande', t: 'Vous achetez ? Touchez « Je cherche »', x: 'Le bouton jaune, en bas. Vous publiez une demande : les vendeurs viennent à vous.' }
  ];
  const FICHES = [
    { id: 'accueil', ico: 'apercu', ton: 'marche', t: 'L’accueil et la roue', sert: 'L’accueil montre un produit à la fois, avec ses offres et ses demandes du moment.',
      etapes: ['Glissez le doigt vers la gauche ou la droite pour changer de produit.', 'Touchez le nom de la famille en haut (par exemple « Légumes et fruits ») pour en choisir une autre.', 'Touchez « Voir la fiche » pour tout savoir sur ce produit.'],
      conseil: 'Le menu (les trois traits en haut à gauche) mène partout dans l’application.' },
    { id: 'vendre', ico: 'vendre', ton: 'offre', t: 'Vendre : publier une offre', sert: 'Vous avez un produit ? Dites-le, et les acheteurs vous écrivent.',
      etapes: ['Touchez « J’ai » (le bouton vert), ou « Vendre » dans le menu.', 'Choisissez le produit, ajoutez une photo si vous pouvez, puis la quantité. Touchez « Suivant ».', 'Écrivez votre prix, ou laissez « À discuter ». Dites où se trouve la marchandise.', 'Vérifiez, puis touchez « Publier mon offre ».'],
      conseil: 'Une photo et un prix clair attirent beaucoup plus d’acheteurs.', aller: PAGE('vendre') },
    { id: 'demande', ico: 'demander', ton: 'demande', t: 'Acheter : publier une demande', sert: 'Vous cherchez un produit ? Dites ce qu’il vous faut, et les vendeurs viennent à vous.',
      etapes: ['Touchez « Je cherche » (le bouton jaune), ou « Demander » dans le menu.', 'Dites quoi, combien, où et pour quand.', 'Donnez votre budget si vous le connaissez.', 'Touchez « Publier ma demande ».'],
      conseil: 'Avec un budget, les vendeurs savent tout de suite s’ils peuvent vous servir.', aller: PAGE('demande') },
    { id: 'acheter', ico: 'acheter', ton: 'offre', t: 'Trouver une offre', sert: 'Voir tout ce qui est à vendre, et contacter le vendeur.',
      etapes: ['Touchez « Acheter » dans le menu, ou cherchez un produit en haut de l’accueil.', 'Faites défiler les offres : produit, quantité, prix, lieu et nom du vendeur.', 'Touchez « Écrire » pour lui parler, ou « Proposer un prix » pour négocier.'],
      conseil: 'Le sceau bleu à côté d’un nom veut dire : identité vérifiée par l’équipe.', aller: PAGE('acheter') },
    { id: 'reseau', ico: 'reseau', ton: 'lien', t: 'Le réseau : la carte', sert: 'La carte de la Côte d’Ivoire montre où sont les offres et les demandes.',
      etapes: ['Touchez « Le réseau » dans le menu.', 'Chaque bulle est une ville : verte pour les offres, jaune pour les demandes. Touchez-en une pour voir les annonces.', 'En haut, choisissez un produit ou « Où êtes-vous ? » pour voir ce qui est près de vous.', 'Touchez + ou − en bas pour vous approcher ou vous éloigner.'],
      conseil: 'La position est toujours celle de la ville, jamais l’adresse exacte d’une personne.', aller: PAGE('carte') },
    { id: 'messages', ico: 'messages', ton: 'lien', t: 'Écrire à quelqu’un', sert: 'Parler avec un vendeur ou un acheteur, sans donner votre numéro.',
      etapes: ['Sur une annonce, touchez « Écrire ».', 'Écrivez votre message et envoyez-le.', 'Retrouvez vos conversations dans le menu, à « Messages ».'],
      conseil: 'Restez dans les messages de l’application : votre numéro reste caché. L’équipe peut relire les échanges en cas de litige.', aller: FEN('MDGMessages', 'boite') },
    { id: 'negoce', ico: 'negoce', ton: 'marche', t: 'Proposer un prix', sert: 'Négocier calmement, par écrit, jusqu’à un accord.',
      etapes: ['Sur une annonce, touchez « Proposer un prix ». Écrivez votre prix et la quantité.', 'L’autre personne a 48 heures pour accepter, refuser ou proposer un autre prix.', 'Quand vous êtes d’accord, l’accord est conclu : le prix et la quantité ne bougent plus.', 'Ensuite, touchez « Suivre la commande » : vous choisissez qui transporte et où livrer.'],
      conseil: 'Un accord conclu n’est pas un paiement. La négociation n’est pas secrète : l’équipe peut la relire en cas de litige.', aller: FEN('MDGNegoce', 'inbox') },
    { id: 'tableau', ico: 'tableau', ton: 'marche', t: 'L’onglet Prix : le tableau du marché', sert: 'Voir tout de suite qui vend le moins cher et qui achète le plus cher, comme sur un marché P2P.',
      etapes: ['Sur l’accueil, touchez l’onglet « Prix ».', 'Touchez un produit. « Acheter » : les vendeurs, le moins cher en haut. « Vendre » : les acheteurs, le meilleur budget en haut.', 'À prix égal, le transport compris passe devant. Les prix ne se comparent que dans la même unité (kg, sac, régime…).', 'Touchez « Acheter » ou « Vendre » sur une ligne pour proposer votre prix.'],
      conseil: 'Vous vendez ? Baissez votre prix : vous montez dans le tableau. Aucun numéro n’est affiché : le Marché de Gros est le seul intermédiaire.', aller: ONGLET('Prix') },
    { id: 'commande', ico: 'camion', ton: 'offre', t: 'La commande et la livraison', sert: 'Suivre la marchandise, du « oui » jusqu’à la livraison.',
      etapes: ['Après un accord, touchez « Suivre la commande ». Dites qui transporte et où livrer. L’autre partie confirme.', 'Vendeur : un mot secret s’affiche (par exemple « MANGUE 47 »). Écrivez-le sur un papier et glissez-le dans la marchandise.', 'Chaque étape s’affiche avec son heure : préparation, chargement, transport, arrivée, réception. Avec les codes, le chauffeur tape le code du vendeur, puis celui de l’acheteur.', 'Une commande confirmée ne s’annule plus du côté de l’acheteur : seul le vendeur peut demander l’annulation, avant le chargement.'],
      conseil: 'Ne donnez jamais vos codes ni le mot secret par message : seulement sur place.', aller: FEN('MDGCommandes', 'ouvrir') },
    { id: 'sequestre', ico: 'cadenas', ton: 'lien', t: 'Le paiement sécurisé (séquestre)', sert: 'Protéger le vendeur, qui paie le transport, et l’acheteur, qui ne paie pas pour rien.',
      etapes: ['Aujourd’hui : paiement à la livraison, après avoir vu la marchandise. Le séquestre est en construction.', 'Bientôt : dès la commande confirmée, l’acheteur paie par Wave, Orange Money ou MTN MoMo. L’argent reste bloqué.', 'À la réception, l’acheteur vérifie. Tout est bon : il libère. Sans réclamation, le paiement se libère tout seul 24 h après la réception.', 'À la libération, chacun reçoit sa part : le vendeur moins 3,5 %, le transporteur moins 6,9 %. Le Marché de Gros n’est payé qu’à ce moment-là.'],
      conseil: 'Chaque commande montre « qui reçoit quoi » dans le bloc « Paiement sécurisé ».', aller: FEN('MDGCommandes', 'ouvrir') },
    { id: 'refus', ico: 'signaler', ton: 'aide', t: 'Un problème à la livraison', sert: 'Refuser une marchandise gâtée, avec de vraies preuves.',
      etapes: ['Quand le chauffeur est arrivé, ou dans les 24 h après la réception, touchez « Refuser la marchandise ».', 'Tapez le mot secret du vendeur (sur le papier dans le colis) et ajoutez des photos : la marchandise et le papier. Sans le mot, pas de remboursement.', 'Si le vendeur reconnaît le problème (ou si un chauffeur vérifié par l’équipe le confirme), la partie refusée vous est rendue. Le transport reste dû.', 'Sinon, on en parle à trois dans la « Discussion » : vous, le vendeur et le Marché de Gros. L’équipe juge.'],
      conseil: 'Pas de papier dans le colis ? Touchez « Signaler un problème » : l’équipe juge avec tous les échanges. Les échanges ne sont pas secrets sur le Marché de Gros.', aller: FEN('MDGCommandes', 'ouvrir') },
    { id: 'chauffeur', ico: 'camion', ton: 'lien', t: 'Vous êtes chauffeur', sert: 'Recevoir des missions de transport et être payé de votre prix.',
      etapes: ['Dans le menu, touchez « Espace chauffeur » et inscrivez-vous (gratuit). L’équipe vérifie votre profil.', 'Donnez votre code transporteur (T-4K7P) au vendeur ou à l’acheteur. Acceptez la mission en fixant votre prix.', 'Au chargement, puis à la livraison, tapez le code qu’on vous montre sur place.', 'Si l’acheteur refuse la marchandise, dites ce que vous avez vu. Votre transport reste dû.'],
      conseil: 'La commission du Marché de Gros est de 6,9 % de votre prix : comptez-la dedans.' },
    { id: 'categories', ico: 'categories', ton: 'marche', t: 'Les familles de produits', sert: 'Tous les produits vivriers, rangés en 12 familles.',
      etapes: ['Touchez « Catégories » dans le menu.', 'Touchez une famille, par exemple « Tubercules et féculents ».', 'Touchez un produit pour ouvrir sa fiche.'],
      conseil: 'La recherche en haut comprend aussi les noms locaux.', aller: PAGE('categories') },
    { id: 'prix', ico: 'prix', ton: 'offre', t: 'Le prix du marché', sert: 'Savoir combien demandent les vendeurs et combien proposent les acheteurs.',
      etapes: ['Touchez « Prix du marché » dans le menu.', 'Pour chaque produit : les ronds verts sont les prix des vendeurs, les carrés jaunes les budgets des acheteurs.', 'Lisez la phrase en dessous : « Accord possible » veut dire qu’un acheteur paie au moins le prix d’un vendeur.'],
      conseil: 'Tous les prix viennent d’annonces publiées : rien n’est inventé.', aller: PAGE('prix') },
    { id: 'annee', ico: 'annee', ton: 'demande', t: 'L’année du marché', sert: 'Savoir quels produits sont en récolte, mois par mois.',
      etapes: ['Touchez « L’année du marché » dans le menu.', 'Touchez un mois, ou glissez le doigt sur le cercle.', 'Touchez un produit pour voir ses mois de récolte.'],
      conseil: 'En pleine récolte, il y a beaucoup de marchandise : les prix baissent souvent.', aller: PAGE('annee') },
    { id: 'confiance', ico: 'confiance', ton: 'vous', t: 'Notes et statuts', sert: 'Savoir à qui vous avez affaire avant d’acheter ou de vendre.',
      etapes: ['Touchez le nom d’un membre pour voir son profil, ses notes et ses statuts.', 'Après une négociation, vous pouvez noter l’autre personne.', '« Vendeur de confiance », « Acheteur sérieux », « Répond vite » : ces statuts se gagnent par des ventes et des réponses réelles.'],
      conseil: 'Un statut ne s’achète pas. « Nouveau membre » veut dire : soyez encore plus prudent.', aller: FEN('MDGRep', 'classement') },
    { id: 'identite', ico: 'verifie', ton: 'lien', t: 'Faire vérifier son identité', sert: 'Le sceau bleu rassure vos acheteurs et vos vendeurs.',
      etapes: ['Dans Mon compte, touchez « Identité ».', 'Prenez en photo votre pièce (recto et verso), puis un selfie en tenant le code affiché, écrit sur un papier.', 'Une personne de l’équipe compare et décide, en quelques jours.'],
      conseil: 'Vos 3 premières annonces sont gratuites ; ensuite, la vérification est demandée. Une pièce expirée est refusée.', aller: FEN('MDGIdentite', 'ouvrir') },
    { id: 'compte', ico: 'compte', ton: 'vous', t: 'Mon compte', sert: 'Votre profil, vos annonces, vos réglages.',
      etapes: ['Touchez le petit bonhomme en haut à droite.', 'Retrouvez vos offres, vos demandes, vos négociations et vos statuts.', 'Réglez les notifications, les sons et votre code secret.'],
      conseil: 'Dans le menu, « Alertes produits » vous prévient quand votre produit arrive.', aller: FEN('MDGCompte', 'ouvrir') },
    { id: 'securite', ico: 'cadenas', ton: 'aide', t: 'Pour être en sécurité', sert: 'Quelques règles simples protègent contre les arnaques.',
      etapes: ['Voyez toujours la marchandise avant de payer. Ne payez jamais d’avance à quelqu’un (le séquestre du Marché de Gros, quand il ouvrira, sera dans l’application, jamais par un numéro).', 'Restez dans les messages de l’application : votre numéro reste caché.', 'Préférez les membres avec le sceau bleu et de bonnes notes.', 'Quelque chose ne va pas ? Touchez « Signaler » sur l’annonce ou sur le profil : l’équipe regarde chaque signalement.', 'Le Marché de Gros ne vous demandera jamais d’argent ni de code par message ou par téléphone.'],
      conseil: 'Si quelqu’un vous presse de payer vite, arrêtez l’échange.' },
    { id: 'probleme', ico: 'bouee', ton: 'aide', t: 'Si ça ne marche pas', sert: 'Les solutions aux soucis les plus courants.',
      etapes: ['Pas de réseau : les annonces déjà vues restent affichées. Réessayez quand le réseau revient.', 'L’application semble bloquée : fermez-la complètement, puis rouvrez-la.', 'Toujours un souci : dans le menu, touchez « Écrire au Marché de Gros ». Écrivez votre question : les réponses toutes prêtes s’affichent. Rien ne vous aide ? Touchez « Je veux parler à une personne » : l’équipe vous répond.'],
      conseil: 'Vos annonces publiées restent en ligne, même si votre téléphone s’éteint.', aller: FEN('MDGAide', 'ouvrir') }
  ];
  const TON = { marche: ['#10392B', '#F2C230'], offre: ['#DDF0E3', '#23744A'], demande: ['#FBEFC4', '#7A5600'], lien: ['#DDE9F6', '#1F5A96'], vous: ['#EFE3F5', '#6B3C86'], aide: ['#F7E1DA', '#9A3B22'] };

  const CSS = `.gd{position:fixed;inset:0;z-index:9000;background:#F6F1E7;color:#171512;display:flex;flex-direction:column;font:400 17px/1.5 Jost,system-ui,sans-serif;
  transform:translateY(100%);transition:transform .38s cubic-bezier(.22,1,.36,1);padding-top:env(safe-area-inset-top)}
.gd.on{transform:none}
.gd-h{flex:none;display:flex;align-items:center;gap:4px;height:56px;padding:0 6px;border-bottom:1px solid rgba(23,21,18,.08)}
.gd-h button{width:48px;height:48px;border:0;background:none;border-radius:24px;display:grid;place-items:center;color:#171512}
.gd-h b{flex:1;text-align:center;font-weight:600;font-size:17px}
.gd-b{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:20px 18px calc(36px + env(safe-area-inset-bottom))}
.gd-t{margin:0;font:600 31px/1.02 Jost,sans-serif;letter-spacing:-.015em}.gd-t em{color:#10392B}
.gd-lead{margin:10px 0 0;color:#5b5348;font-size:17px}
.gd-3{margin:20px 0 0;background:#10392B;color:#F3EFE4;border-radius:24px;padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.gd-3 h2{margin:0;font:600 13px/1 Jost,sans-serif;letter-spacing:0;color:#F2C230}
.gd-g{display:flex;gap:12px;align-items:flex-start}
.gd-g i{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font:700 16px Jost,sans-serif;font-style:normal;background:#F2C230;color:#10392B}
.gd-g b{display:block;font-size:18px;font-weight:600;line-height:1.3}.gd-g span{display:block;color:rgba(243,239,228,.82);font-size:16px;margin-top:2px}
.gd-sh{margin:28px 0 12px;font:600 13px/1 Jost,sans-serif;letter-spacing:0;color:#7a7064}
.gd-tu{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.gd-tu button{min-height:118px;border:0;border-radius:20px;background:#FFFCF6;box-shadow:0 1px 2px rgba(23,21,18,.06),0 6px 16px rgba(23,21,18,.05);padding:14px;text-align:left;color:#171512;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font:inherit}
.gd-tu button span{width:44px;height:44px;border-radius:14px;display:grid;place-items:center}
.gd-tu button b{font-size:16.5px;font-weight:600;line-height:1.25}
.gd-tu .large{grid-column:1/-1;min-height:0;flex-direction:row;align-items:center}
.gd-f h2{margin:16px 0 0;font:600 28px/1.05 Jost,sans-serif;letter-spacing:-.015em}
.gd-f .gd-ico{width:64px;height:64px;border-radius:20px;display:grid;place-items:center}
.gd-sert{margin:10px 0 0;font-size:18px;color:#3d372f}
.gd-et{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-direction:column;gap:14px;counter-reset:e}
.gd-et li{counter-increment:e;display:flex;gap:14px;align-items:flex-start;background:#FFFCF6;border-radius:18px;padding:14px;font-size:17px}
.gd-et li::before{content:counter(e);flex:none;width:34px;height:34px;border-radius:50%;background:#10392B;color:#F3EFE4;display:grid;place-items:center;font-weight:700;font-size:16px}
.gd-cs{margin:18px 0 0;display:flex;gap:12px;align-items:flex-start;background:#FBEFC4;border-radius:18px;padding:14px 16px;color:#4d3a00;font-size:16.5px}
.gd-cs b{display:block;font-size:13px;letter-spacing:0;margin-bottom:2px}
.gd-go{margin:22px 0 0;width:100%;min-height:54px;border:0;border-radius:27px;background:#10392B;color:#F3EFE4;font:600 17px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px}
.gd-nav{margin:12px 0 0;display:flex;gap:10px}
.gd-nav button{flex:1;min-height:48px;border-radius:24px;border:1px solid rgba(23,21,18,.16);background:none;color:#171512;font:500 16px Jost,sans-serif;padding:0 12px}
.gd-pied{margin:28px 0 0;text-align:center;color:#7a7064;font-size:15px}
.gd-pastille{position:fixed;left:50%;bottom:calc(98px + env(safe-area-inset-bottom));z-index:8500;transform:translate(-50%,10px);opacity:0;transition:opacity .35s,transform .35s;
  display:flex;align-items:center;gap:8px;min-height:44px;padding:0 6px 0 16px;border-radius:22px;background:#10392B;color:#F3EFE4;box-shadow:0 10px 26px rgba(0,0,0,.35);font:500 15px Jost,sans-serif;white-space:nowrap}
.gd-pastille.on{opacity:1;transform:translate(-50%,0)}
.gd-pastille button{border:0;background:none;color:inherit;font:inherit;min-height:44px;padding:0;display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.gd-pastille .x{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;color:rgba(243,239,228,.7)}
@media (prefers-reduced-motion:reduce){.gd,.gd-pastille{transition:none}}`;

  let el = null, pile = [];
  function style() { if (document.getElementById('gdCss')) return; const s = document.createElement('style'); s.id = 'gdCss'; s.textContent = CSS; document.head.appendChild(s); }
  const pastille = ([fond, encre]) => `style="background:${fond};color:${encre}"`;

  function sommaire() {
    return `<h1 class="gd-t">Comment ça <em>marche</em></h1>
      <p class="gd-lead">Le Marché de Gros met en relation ceux qui vendent et ceux qui achètent des produits vivriers, partout en Côte d’Ivoire. Voici l’essentiel.</p>
      <section class="gd-3" aria-label="L’essentiel en 3 gestes"><h2>L’essentiel en 3 gestes</h2>
        ${GESTES.map((g, i) => `<div class="gd-g"><i>${i + 1}</i><div><b>${esc(g.t)}</b><span>${esc(g.x)}</span></div></div>`).join('')}</section>
      <h2 class="gd-sh">Partie par partie</h2>
      <div class="gd-tu">${FICHES.filter(f => !['securite', 'probleme'].includes(f.id)).map((f, i, L) => `<button type="button"${L.length % 2 && i === L.length - 1 ? ' class="large"' : ''} data-f="${f.id}"><span ${pastille(TON[f.ton])}>${IC(f.ico, 24)}</span><b>${esc(f.t)}</b></button>`).join('')}</div>
      <h2 class="gd-sh">Bon à savoir</h2>
      <div class="gd-tu">${['securite', 'probleme'].map(id => FICHES.find(f => f.id === id)).map(f => `<button type="button" class="large" data-f="${f.id}"><span ${pastille(TON[f.ton])}>${IC(f.ico, 24)}</span><b>${esc(f.t)}</b></button>`).join('')}</div>
      <p class="gd-pied">Une question ? <button type="button" data-aide style="border:0;background:none;padding:0;font:inherit;color:#10392B;text-decoration:underline;min-height:44px">Ouvrir l’aide : questions et réponses</button></p>`;
  }
  function fiche(f) {
    const i = FICHES.indexOf(f), av = FICHES[i - 1], ap = FICHES[i + 1];
    return `<article class="gd-f"><span class="gd-ico" ${pastille(TON[f.ton])}>${IC(f.ico, 32)}</span><h2>${esc(f.t)}</h2><p class="gd-sert">${esc(f.sert)}</p>
      <ol class="gd-et">${f.etapes.map(e => `<li>${esc(e)}</li>`).join('')}</ol>
      <p class="gd-cs">${IC('info', 22)}<span><b>Conseil</b>${esc(f.conseil)}</span></p>
      ${f.aller ? `<button type="button" class="gd-go" data-aller>Montrer dans l’app ${IC('fleche', 20, 2)}</button>` : ''}
      <div class="gd-nav">${av ? `<button type="button" data-f="${av.id}">‹ ${esc(av.t)}</button>` : ''}${ap ? `<button type="button" data-f="${ap.id}">${esc(ap.t)} ›</button>` : ''}</div></article>`;
  }
  function dessiner() {
    const id = pile[pile.length - 1], f = id && FICHES.find(x => x.id === id), b = el.querySelector('.gd-b');
    b.innerHTML = f ? fiche(f) : sommaire(); b.scrollTop = 0;
    el.querySelector('.gd-h b').textContent = f ? 'Comment ça marche' : 'Le guide';
    b.querySelectorAll('[data-f]').forEach(x => x.onclick = () => { pile.push(x.dataset.f); dessiner(); });
    const aide = b.querySelector('[data-aide]'); if (aide) aide.onclick = () => { if (window.MDGAide) MDGAide.ouvrir(); };
    const go = b.querySelector('[data-aller]'); if (go) go.onclick = () => { const a = f.aller; fermer(); setTimeout(a, 380); };
  }
  function ouvrir(id) {
    style(); vu();
    if (!el) {
      el = document.createElement('div'); el.className = 'gd'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Comment ça marche');
      el.innerHTML = `<div class="gd-h"><button type="button" data-r aria-label="Retour">${IC('retour', 24, 2)}</button><b>Le guide</b><button type="button" data-x aria-label="Fermer">${IC('fermer', 22, 2)}</button></div><div class="gd-b"></div>`;
      document.body.appendChild(el);
      el.querySelector('[data-x]').onclick = fermer;
      el.querySelector('[data-r]').onclick = () => { if (pile.length) { pile.pop(); dessiner(); } else fermer(); };
      el.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });
    }
    pile = id && FICHES.some(f => f.id === id) ? [id] : [];
    dessiner();
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('on'); const x = el.querySelector('[data-x]'); if (x) x.focus({ preventScroll: true }); }));
  }
  function fermer() { if (!el) return; el.classList.remove('on'); const e = el; el = null; setTimeout(() => e.remove(), 400); }

  // la pastille de la première ouverture (une seule fois)
  const CLE = 'mdg-guide:vu';
  function vu() { try { localStorage.setItem(CLE, '1'); } catch (_) {} const p = document.querySelector('.gd-pastille'); if (p) p.remove(); }
  function proposer() {
    try { if (localStorage.getItem(CLE)) return; } catch (_) { return; }
    // seulement sur l'accueil : sur une autre page, elle couvrait le titre ; on la propose au retour à l'accueil
    if (location.hash && location.hash !== '#/') { addEventListener('hashchange', function f() { if (!location.hash || location.hash === '#/') { removeEventListener('hashchange', f); setTimeout(proposer, 600); } }); return; }
    if (document.getElementById('mdg-icone')) return;   // la carte « Nouveau logo » passe d'abord
    style();
    const p = document.createElement('div'); p.className = 'gd-pastille'; p.setAttribute('role', 'status');
    p.innerHTML = `<button type="button" data-o>${IC('comment', 18, 2)} Comment ça marche ?</button><button type="button" class="x" data-x aria-label="Fermer">${IC('fermer', 16, 2)}</button>`;
    document.body.appendChild(p);
    requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('on')));
    p.querySelector('[data-o]').onclick = () => ouvrir();
    p.querySelector('[data-x]').onclick = vu;
    // un toucher ailleurs (ouvrir le menu, une fenêtre…) : la pastille s'efface, elle ne reste pas par-dessus
    const ailleurs = e => { if (p.contains(e.target)) return; removeEventListener('pointerdown', ailleurs, true); if (p.isConnected) { p.classList.remove('on'); setTimeout(() => p.remove(), 400); } try { localStorage.setItem(CLE, '1'); } catch (_) {} };
    addEventListener('pointerdown', ailleurs, true);
    setTimeout(() => { if (p.isConnected) { p.classList.remove('on'); setTimeout(() => p.remove(), 400); try { localStorage.setItem(CLE, '1'); } catch (_) {} } }, 10000);
  }
  setTimeout(proposer, 3200);

  window.MDGGuide = { ouvrir, fermer, FICHES };
})();
