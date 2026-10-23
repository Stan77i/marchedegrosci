/* ═════════ Marché de Gros CI — la démo de la roue et du prix ═════════
   Demande du propriétaire (23/10/2026) : un tutoriel sur le sélectionneur orbital, avec un « switch démo » —
   en arrivant, l'application montre toute seule comment ça se fait ; un bouton « Démo » permet de la revoir.
   La démo pilote la VRAIE interface : la roue tourne (boutons suivant), le prix défile, on touche le prix, le pop-up
   « Ici, chacun place son prix » s'ouvre, et une carte de commentaire explique chaque étape (5 étapes, ~18 s).
   • Toucher l'écran, « Passer » ou le bouton Démo arrête tout ; la roue revient où elle était.
   • Une fois automatiquement, la première fois qu'on voit l'accueil (si les astuces sont actives) ; ensuite, à la demande.
   • Aucune donnée inventée : la démo montre les vrais prix ; si aucun produit proche n'a de prix publié, le pop-up s'ouvre
     avec un exemple MARQUÉ « Exemple de démonstration : ces prix ne sont pas réels ».
   • Réglages → Aide pour débuter : démo au démarrage oui/non, bouton « Démo » visible ou non ; la fréquence (une fois, chaque semaine,
     à chaque ouverture) est celle des astuces (MDGAstuces.frequence).
   API : MDGDemo.lancer() · arreter() · basculer() · enCours() · reglages() · regler({auto, bouton}) */
(function () {
  'use strict';
  if (window.MDGDemo) return;
  const KVU = 'mdg-demo:orbite';
  const lu = () => { try { return localStorage.getItem(KVU) === '1'; } catch (_) { return true; } };
  // réglages (Réglages → Aide pour débuter) : la démo au démarrage, et le bouton « Démo » sur l'accueil (oui par défaut)
  const KAUTO = 'mdg-demo:auto', KBTN = 'mdg-demo:bouton';
  const oui = k => { try { return localStorage.getItem(k) !== '0'; } catch (_) { return true; } };
  const reglages = () => ({ auto: oui(KAUTO), bouton: oui(KBTN) });
  const montrerBouton = () => document.documentElement.classList.toggle('dm-cache', !oui(KBTN));
  function regler(o) { try { if ('auto' in o) localStorage.setItem(KAUTO, o.auto ? '1' : '0'); if ('bouton' in o) localStorage.setItem(KBTN, o.bouton ? '1' : '0'); } catch (_) {} montrerBouton(); }
  montrerBouton();
  const noterVu = () => { try { localStorage.setItem(KVU, '1'); } catch (_) {} };
  const REDUIT = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS = `
.dm-carte{position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:2147483300;max-width:460px;margin:0 auto;padding:12px 14px 12px 16px;border-radius:20px;
  background:rgba(23,21,18,.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);color:#F3EFE4;font:400 14px/1.4 Jost,system-ui,sans-serif;
  box-shadow:0 18px 40px rgba(0,0,0,.45),inset 0 0 0 1px rgba(242,194,48,.35);opacity:0;transform:translateY(-14px);transition:opacity .3s,transform .4s cubic-bezier(.22,1,.36,1)}
.dm-carte.on{opacity:1;transform:none}
.dm-hd{display:flex;align-items:center;gap:10px}
.dm-k{flex:none;display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:10px;background:#F2C230;color:#171512;font:700 11px/1.4 Jost,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.dm-k i{width:6px;height:6px;border-radius:50%;background:#171512;animation:dmRec 1.2s ease-in-out infinite}
@keyframes dmRec{50%{opacity:.25}}
.dm-n{color:#B9AD98;font:500 12px Jost,sans-serif}
.dm-passer{margin-left:auto;min-height:36px;padding:0 12px;border:0;border-radius:18px;background:rgba(243,239,228,.1);color:#F3EFE4;font:600 13px Jost,sans-serif;cursor:pointer}
.dm-ti{margin:8px 0 2px;font:600 16.5px/1.25 Jost,sans-serif}.dm-ti em{font-style:italic;font-weight:900;color:#F2C230}
.dm-x{margin:0;color:#CFC4B1;font-size:13.5px}
.dm-bar{height:3px;margin-top:10px;border-radius:2px;background:rgba(243,239,228,.12);overflow:hidden}.dm-bar i{display:block;height:100%;width:100%;background:#F2C230;transform-origin:left;transform:scaleX(0);transition:transform .5s cubic-bezier(.22,1,.36,1)}
.dm-tap{position:fixed;z-index:2147483250;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:2.5px solid #FFFDF8;background:rgba(255,253,248,.18);box-shadow:0 4px 14px rgba(0,0,0,.35);pointer-events:none;animation:dmTap .9s cubic-bezier(.22,1,.36,1) both}
@keyframes dmTap{0%{transform:scale(1.6);opacity:0}35%{transform:scale(1);opacity:1}55%{transform:scale(.82)}100%{transform:scale(1.25);opacity:0}}
.dm-anneau{outline:2px solid #F2C230!important;outline-offset:5px;border-radius:16px;animation:dmAnneau 1.3s ease-in-out infinite}
@keyframes dmAnneau{50%{outline-offset:9px;outline-color:rgba(242,194,48,.35)}}
/* le switch « Démo », en haut à gauche de la roue, en face de « Tout » */
.dm-sw{position:absolute;z-index:3;top:0;left:10px;display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 8px;border-radius:17px;border:1px solid rgba(245,240,230,.16);
  background:rgba(245,240,230,.07);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#F5F0E6;font:600 13px/1 Jost,sans-serif;cursor:pointer;transition:background .2s,transform .15s}
.dm-sw:active{transform:scale(.96)}.dm-sw:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
.dm-sw .pi{position:relative;width:28px;height:16px;border-radius:8px;background:rgba(245,240,230,.22);transition:background .25s}
.dm-sw .pi::after{content:"";position:absolute;left:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#F5F0E6;transition:transform .25s cubic-bezier(.22,1,.36,1)}
html.dm-on .dm-sw{background:rgba(242,194,48,.16);border-color:rgba(242,194,48,.55)}html.dm-on .dm-sw .pi{background:#F2C230}html.dm-on .dm-sw .pi::after{transform:translateX(12px);background:#171512}
html.dm-cache .dm-sw{display:none}
/* la roue reste foncée en mode jour : le switch garde ses couleurs claires, comme « Tout » */
@media (prefers-reduced-motion:reduce){.dm-tap,.dm-anneau,.dm-k i{animation:none!important}.dm-carte{transition:none}}`;
  function css() { if (document.getElementById('demoCss')) return; const s = document.createElement('style'); s.id = 'demoCss'; s.textContent = CSS; document.head.appendChild(s); }
  css();   // le switch « Démo » est dans la page dès le départ

  // les étapes : [titre, texte]
  const ETAPES = [
    ['La <em>roue</em> des produits', 'Faites tourner la roue avec le doigt ou les flèches : chaque produit, son sac et son meilleur prix.'],
    ['Le meilleur prix, <em>en direct</em>', 'C’est le prix le moins cher publié sur le marché. Il change quand quelqu’un place un meilleur prix. Touchez-le.'],
    ['L’échelle des <em>prix</em>', 'Du moins cher au plus cher : qui a publié, d’où, combien il en a. En vert, les vendeurs ; en jaune, les acheteurs.'],
    ['Votre <em>place</em>', 'Proposez moins que le meilleur prix : votre offre passe en tête. Vous achetez ? Montez votre budget.'],
    ['À vous de <em>placer</em> votre prix', 'Touchez « Placer mon prix », ou négociez directement avec le vendeur. Le Marché de Gros ne fixe aucun prix.']];

  let actif = false, timers = [], carte = null, anneau = null, depart = 0, tours = 0, exemple = false;
  const attendre = (ms, f) => timers.push(setTimeout(() => { if (actif) f(); }, REDUIT() ? Math.min(ms, ms * .8) : ms));
  function etape(i) {
    if (!carte) return;
    const [t, x] = ETAPES[i];
    carte.querySelector('.dm-n').textContent = (i + 1) + ' / ' + ETAPES.length;
    carte.querySelector('.dm-ti').innerHTML = t; carte.querySelector('.dm-x').textContent = x;
    carte.querySelector('.dm-bar i').style.transform = 'scaleX(' + ((i + 1) / ETAPES.length) + ')';
  }
  function entourer(el) { if (anneau) anneau.classList.remove('dm-anneau'); anneau = el || null; if (anneau) { anneau.classList.add('dm-anneau'); try { anneau.scrollIntoView({ block: 'nearest', behavior: REDUIT() ? 'auto' : 'smooth' }); } catch (_) {} } }
  function toucher(el) {
    if (!el) return; const r = el.getBoundingClientRect(); if (!r.width) return;
    const t = document.createElement('div'); t.className = 'dm-tap'; t.setAttribute('aria-hidden', 'true');
    t.style.left = (r.left + r.width / 2) + 'px'; t.style.top = (r.top + r.height / 2) + 'px'; document.body.appendChild(t); setTimeout(() => t.remove(), 950);
  }
  const suivant = () => { const b = $('[aria-label="Produit suivant"]'); toucher(b); setTimeout(() => { if (actif && b) { b.click(); tours++; } }, 260); };
  const aUnPrix = () => !!$('.acc-px .acc-px-v');

  function lancer() {
    if (actif) return; css();
    const px = $('.acc-px'); if (!px) return false;   // pas sur l'accueil
    actif = true; tours = 0; exemple = false; noterVu(); document.documentElement.classList.add('dm-on');
    try { px.scrollIntoView({ block: 'center', behavior: REDUIT() ? 'auto' : 'smooth' }); } catch (_) {}
    carte = document.createElement('div'); carte.className = 'dm-carte'; carte.setAttribute('role', 'status'); carte.setAttribute('aria-live', 'polite');
    carte.innerHTML = `<div class="dm-hd"><span class="dm-k"><i></i>Démo</span><span class="dm-n"></span><button type="button" class="dm-passer">Passer</button></div><p class="dm-ti"></p><p class="dm-x"></p><div class="dm-bar"><i></i></div>`;
    document.body.appendChild(carte); requestAnimationFrame(() => carte && carte.classList.add('on'));
    carte.querySelector('.dm-passer').onclick = e => { e.stopPropagation(); arreter(); };
    // la personne touche l'écran (hors de la carte) : elle reprend la main
    setTimeout(() => { if (actif) addEventListener('pointerdown', reprise, true); }, 300);
    depart = Date.now();
    etape(0); entourer($('.acc-flotte'));
    attendre(1300, suivant); attendre(3200, suivant);
    attendre(5000, () => {
      // pas de prix sur ce produit : on avance encore un peu (au plus 3 produits), sinon on montrera un exemple marqué comme tel
      if (!aUnPrix() && tours < 5) { suivant(); timers.push(setTimeout(() => actif && deux(), 1700)); } else deux();
    });
    return true;
  }
  function deux() {
    etape(1); const px = $('.acc-px'); entourer(px);
    attendre(2600, () => { toucher(px); attendre(300, () => {
      exemple = !aUnPrix();
      if (exemple && window.MDGPrixMoment) {
        const t = h => new Date(Date.now() - h * 3600e3).toISOString();
        MDGPrixMoment.ouvrir({ exemple: true, nom: 'Tomate', img: 'v2/img/produit-tomate.webp', art: 'le carton',
          offres: [{ prix: 12500, nom: 'Vendeuse A', lieu: 'Abidjan', at: t(2), qte: 40, unite: 'carton' }, { prix: 13000, nom: 'Vendeur B', lieu: 'Bouaké', at: t(5) }, { prix: 14000, nom: 'Coopérative C', lieu: 'Korhogo', at: t(20) }],
          demandes: [{ prix: 11000, nom: 'Acheteur D', lieu: 'Yopougon' }] });
      } else if (px) px.click();
      attendre(900, trois);
    }); });
  }
  function trois() { etape(2); entourer($('.pm-ech li.top')); attendre(3200, quatre); }
  function quatre() { etape(3); entourer($('.pm-vous')); attendre(3200, cinq); }
  function cinq() { etape(4); entourer($('.pm-act .go')); attendre(3400, () => finir(true)); }

  const reprise = e => { if (carte && carte.contains(e.target)) return; if (e.target.closest && e.target.closest('.dm-sw')) return;   // le switch lui-même : c'est basculer() qui arrête
    arreter(); };
  function finir(complet) {
    if (!actif) return; actif = false;
    timers.forEach(clearTimeout); timers = []; removeEventListener('pointerdown', reprise, true);
    entourer(null); document.documentElement.classList.remove('dm-on');
    if (window.MDGPrixMoment && (exemple || complet)) MDGPrixMoment.fermer();
    // la roue revient où elle était
    const prec = $('[aria-label="Produit précédent"]'); for (let k = 0; k < tours; k++) setTimeout(() => prec && prec.click(), 250 + k * 380);
    const c = carte; carte = null; if (c) { c.classList.remove('on'); setTimeout(() => c.remove(), 350); }
    if (complet && window.MDGToast) setTimeout(() => MDGToast.dire('À vous de *placer votre prix*', { type: 'info', sous: 'Touchez le prix sous la roue quand vous voulez. Le bouton « Démo » la rejoue.' }), 400 + tours * 380);
  }
  function arreter() { finir(false); }
  function basculer() { if (actif) arreter(); else lancer(); }

  // la première fois qu'on voit l'accueil (astuces actives) : la démo se lance seule, une fois, quand rien d'autre n'est à l'écran
  let touche = 0; addEventListener('pointerdown', () => { touche = Date.now(); }, true);
  function guetter(essai) {
    if (lu() || actif || !oui(KAUTO)) return;
    if (window.MDGAstuces && !MDGAstuces.actif()) return;
    const px = $('.acc-px'), r = px && px.getBoundingClientRect();
    const libre = r && r.width && r.top > 0 && r.bottom < innerHeight && !document.hidden && (!location.hash || location.hash === '#/')
      && !$('.as-bulle, .as-tour, .pm-bg, .cm-bg, .nx-bg, .ng-bg, .gd.on') && Date.now() - touche > 4000;
    if (libre) { lancer(); return; }
    if ((essai || 0) < 40) setTimeout(() => guetter((essai || 0) + 1), 2500);
  }
  if (document.readyState === 'complete') setTimeout(guetter, 6000); else addEventListener('load', () => setTimeout(guetter, 6000));

  window.MDGDemo = { lancer, arreter, basculer, enCours: () => actif, reglages, regler };
})();
