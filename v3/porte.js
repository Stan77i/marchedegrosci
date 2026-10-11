/* ═════════ Marché de Gros CI — la porte d'entrée : « Deux mondes. Un même marché. » ═════════
   Scène 2D (canvas) derrière la connexion et l'inscription : à gauche les sillons d'un champ et des points verts (ceux qui produisent),
   à droite les étals d'un marché et des carrés jaunes (ceux qui cherchent) ; des trajectoires les relient et une lumière commune
   apparaît au centre. Les formes reprennent le langage de la carte (cercle = offre, carré = demande, ligne = rencontre) :
   ce sont des métaphores, aucune donnée n'est affichée ni inventée.
   Pourquoi pas WebGL : quelques centaines de traits suffisent ; un canvas 2D coûte moins (batterie, petits téléphones) et n'échoue pas.
   L'intensité suit l'état réel du formulaire : repos · saisie · envoi · réussite · erreur. Mouvement réduit : une image fixe.
   API : MDGPorte.monter(el, { compact }) → { etat(nom), arreter() } */
(function () {
  'use strict';
  const RECIT = [
    ['v', 'Ceux qui produisent', 'Tout commence par une récolte.'],
    ['a', 'Ceux qui cherchent', 'Chaque besoin ouvre une possibilité.'],
    ['v', 'Ceux qui produisent', 'Derrière chaque produit, il y a un territoire.'],
    ['a', 'Ceux qui cherchent', 'Le bon produit, au bon endroit, au bon moment.'],
    ['l', 'La rencontre', 'Deux mondes. Un même marché.']
  ];
  const C = { v: '#6CC58C', a: '#F2C94C', l: '#6AAEF0', terre: '#C9A27A', sable: '#F5F0E6' };
  const REDUIT = matchMedia('(prefers-reduced-motion: reduce)');
  const CIBLE = { repos: .18, saisie: .38, envoi: .78, ok: 1, erreur: .1 };

  function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  function monter(el, opt = {}) {
    const compact = !!opt.compact;
    el.classList.add('pt');
    el.innerHTML = `<canvas class="pt-cv" aria-hidden="true"></canvas><div class="pt-txt" aria-hidden="true"><span class="pt-k"><i></i><em></em></span><p class="pt-m"></p></div><p class="pt-sr">Deux mondes, un même marché : le Marché de Gros relie ceux qui produisent et ceux qui cherchent, partout en Côte d'Ivoire.</p>`;
    const cv = el.querySelector('canvas'), ctx = cv.getContext('2d'), tx = el.querySelector('.pt-txt'), k = el.querySelector('.pt-k em'), ki = el.querySelector('.pt-k i'), m = el.querySelector('.pt-m');
    let W = 0, H = 0, dpr = 1, raf = 0, t0 = performance.now(), vivant = true, etat = 'repos', I = CIBLE.repos, flash = 0, ix = 0, side = 'v', px = 0, py = 0, pxT = 0, pyT = 0;
    const R = rng(20261012);
    // les acteurs : positions relatives (0..1), fixes, tirées d'une graine (même image à chaque ouverture)
    const V = [...Array(compact ? 5 : 7)].map(() => ({ x: .06 + R() * .3, y: .2 + R() * .62, r: 3 + R() * 2.4, ph: R() * 6.28 }));
    const A = [...Array(compact ? 5 : 7)].map(() => ({ x: .64 + R() * .3, y: .2 + R() * .62, r: 3 + R() * 2.2, ph: R() * 6.28 }));
    // chaque producteur rejoint l'acheteur de même rang en hauteur : des trajectoires qui se croisent peu, comme des routes
    const Vs = [...V].sort((p, q) => p.y - q.y), As = [...A].sort((p, q) => p.y - q.y);
    const L = Vs.map((v, i) => ({ v, a: As[i % As.length], off: R(), sp: .05 + R() * .05 }));
    function taille() {
      const b = el.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2); W = Math.max(1, b.width); H = Math.max(1, b.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { taille(); if (REDUIT.matches) dessin(0); }) : null; ro && ro.observe(el); taille();
    function dessin(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const cx = W * .5 + px * 10, cy = H * (compact ? .5 : .46) + py * 8;
      // sol : chaleur à gauche, fraîcheur de la ville à droite, une lumière commune au centre qui grandit avec l'intensité
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * (.25 + I * .4));
      g.addColorStop(0, `rgba(245,214,160,${.05 + I * .16 + flash * .25})`); g.addColorStop(1, 'rgba(245,214,160,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // champ : sillons courbes qui dérivent lentement
      ctx.lineWidth = 1; ctx.strokeStyle = C.terre;
      const nS = compact ? 7 : 12;
      for (let i = 0; i < nS; i++) {
        const y0 = H * (.12 + i * (.8 / nS)); ctx.globalAlpha = (side === 'v' ? .2 : .11) * (1 - i / nS * .4);
        ctx.beginPath();
        for (let x = 0; x <= W * .46; x += 8) { const y = y0 + Math.sin(x / (W * .16) + i * .5 + t * .00012) * H * .025 + (x / W) * H * .06; x ? ctx.lineTo(x + px * 4, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      // marché : étals en perspective douce
      const nC = compact ? 5 : 7, nR = compact ? 3 : 5;
      for (let r = 0; r < nR; r++) for (let c = 0; c < nC; c++) {
        const x = W * (.58 + c * (.4 / nC)) + px * 4, y = H * (.18 + r * (.66 / nR)), s = 6 + r * 1.4;
        ctx.globalAlpha = (side === 'a' ? .16 : .08); ctx.strokeStyle = C.sable; ctx.strokeRect(x, y, s * 1.8, s);
      }
      // trajectoires : chaque producteur rejoint un acheteur ; plus l'intensité monte, plus les lignes se tendent vers la lumière centrale
      L.forEach((l, i) => {
        const ax = l.v.x * W, ay = l.v.y * H, bx = l.a.x * W, by = l.a.y * H, qx = cx + (ax + bx - 2 * cx) * .12 * (1 - I), qy = cy + ((ay + by) / 2 - cy) * (1 - I * .85);
        ctx.globalAlpha = .1 + I * .32 + (side === 'l' ? .12 : 0); ctx.strokeStyle = C.l; ctx.lineWidth = 1 + I * .6;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, bx, by); ctx.stroke();
        // la lumière qui circule
        const u = ((t * .001 * l.sp * (1 + I * 2.4)) + l.off) % 1, w = 1 - u;
        const x = w * w * ax + 2 * w * u * qx + u * u * bx, y = w * w * ay + 2 * w * u * qy + u * u * by;
        ctx.globalAlpha = (.35 + I * .6) * Math.sin(u * Math.PI); ctx.fillStyle = C.sable;
        ctx.beginPath(); ctx.arc(x, y, 1.6 + I * 1.2, 0, 6.283); ctx.fill();
      });
      // les deux mondes : cercles verts, carrés jaunes (respiration lente)
      V.forEach(v => { const r = v.r * (1 + Math.sin(t * .0012 + v.ph) * .08); ctx.globalAlpha = side === 'v' ? .95 : .6; ctx.fillStyle = C.v; ctx.beginPath(); ctx.arc(v.x * W + px * 6, v.y * H + py * 4, r, 0, 6.283); ctx.fill(); });
      A.forEach(a => { const s = a.r * 2 * (1 + Math.sin(t * .0012 + a.ph) * .08); ctx.globalAlpha = side === 'a' ? .95 : .6; ctx.fillStyle = C.a; ctx.fillRect(a.x * W - s / 2 + px * 6, a.y * H - s / 2 + py * 4, s, s); });
      // le point de rencontre
      ctx.globalAlpha = .2 + I * .7 + flash * .3; ctx.fillStyle = C.l; ctx.beginPath(); ctx.arc(cx, cy, 2.5 + I * 3 + flash * 6, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1;
    }
    function boucle(now) {
      if (!vivant) return;
      const t = now - t0;
      I += (CIBLE[etat] - I) * .045; flash *= .94; px += (pxT - px) * .06; py += (pyT - py) * .06;
      dessin(t);
      raf = requestAnimationFrame(boucle);
    }
    // récit : un message toutes les 6,5 s, fondu lent ; l'écran ne bouge pas pendant la lecture
    function montrer(i) {
      const [s, kk, mm] = RECIT[i % RECIT.length]; side = s;
      tx.classList.add('is-out');
      setTimeout(() => { if (!vivant) return; k.textContent = kk; m.textContent = mm; ki.className = 'pt-i-' + s; tx.classList.remove('is-out'); if (REDUIT.matches) dessin(0); }, REDUIT.matches ? 0 : 420);
    }
    montrer(0);
    const tm = setInterval(() => { if (document.hidden) return; ix++; montrer(ix); }, 6500);
    const onMove = e => { const b = el.getBoundingClientRect(); pxT = ((e.clientX - b.left) / b.width - .5) * 2; pyT = ((e.clientY - b.top) / b.height - .5) * 2; };
    const fin = matchMedia('(pointer:fine)').matches; if (fin && !compact) addEventListener('pointermove', onMove, { passive: true });
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (vivant && !REDUIT.matches) raf = requestAnimationFrame(boucle); };
    document.addEventListener('visibilitychange', onVis);
    if (REDUIT.matches) dessin(0); else raf = requestAnimationFrame(boucle);
    return {
      etat(n) { if (!(n in CIBLE)) return; etat = n; if (n === 'ok') { flash = 1; side = 'l'; k.textContent = 'La rencontre'; m.textContent = 'La bonne connexion change la suite.'; ki.className = 'pt-i-l'; } if (REDUIT.matches) { I = CIBLE[n]; dessin(0); } },
      arreter() { vivant = false; cancelAnimationFrame(raf); clearInterval(tm); ro && ro.disconnect(); removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); }
    };
  }
  window.MDGPorte = { monter };
})();
