/* ═════════ Marché de Gros CI — langage sonore ═════════
   Des sons courts de balafon, synthétisés dans le navigateur (aucun fichier, aucune bibliothèque).
   Désactivés par défaut : ils ne jouent qu'après activation explicite dans « Mon compte → Sons ».
   Hiérarchie (un seul son par lot d'événements, le plus important gagne) :
     1. accord      — une proposition est acceptée : la connexion commerciale est établie (trois notes montantes)
     2. proposition — une proposition ou une contre-proposition arrive (deux notes montantes)
     3. refus       — refusée, retirée, expirée ou négociation arrêtée (deux notes descendantes, plus basses)
     4. annonce     — une nouvelle offre ou demande sur un produit qui vous concerne (une note légère)
   Les messages écrits ne font pas de son (le compteur et le message à l'écran suffisent).
   Onglet en arrière-plan : rien ne joue ; le titre de l'onglet affiche le nombre d'événements, et un seul son
   (le plus important) joue au retour. Chaque son a toujours son équivalent visuel (message à l'écran, compteur).
   Aucun son pour une activité fictive : seuls les événements reçus de la base déclenchent un son.
   API : MDGSons.signal(cat, texte) · reglages() · regler(r) · essayer(cat) · CATS */
(function () {
  'use strict';
  const KS = 'mdg-sons:reglages';
  const CATS = {
    accord: { nom: 'Accords conclus', p: 4 },
    proposition: { nom: 'Propositions et contre-propositions reçues', p: 3 },
    refus: { nom: 'Refus, retraits et expirations', p: 2 },
    annonce: { nom: 'Nouvelles annonces sur vos produits', p: 1 }
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const reglages = () => Object.assign({ on: false, volume: 0.6, cats: { accord: true, proposition: true, refus: true, annonce: false } }, J(KS, {}));
  const regler = r => { try { localStorage.setItem(KS, JSON.stringify(Object.assign(reglages(), r))); } catch (_) {} };

  let ctx = null;
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  // déverrouillage : le navigateur exige un geste de l'utilisateur avant tout son
  const unlock = () => { if (reglages().on) audio(); };
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, unlock, { once: true, passive: true }));

  // une lame de balafon : fondamentale, partiel inharmonique (≈ ×3,9) très bref, petit coup de mailloche filtré
  function lame(c, t, f, g) {
    const out = c.createGain(); out.gain.value = g; out.connect(c.destination);
    const env = (node, a, d, peak) => { const e = c.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(peak, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + d); node.connect(e); e.connect(out); return e; };
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f; env(o1, 0.004, 0.55, 1);
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.93; env(o2, 0.002, 0.09, 0.28);
    const o3 = c.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 2.01; env(o3, 0.003, 0.18, 0.12);
    const n = c.createBufferSource(), b = c.createBuffer(1, Math.floor(c.sampleRate * 0.03), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = b; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 1.2; n.connect(bp); env(bp, 0.001, 0.03, 0.35);
    [o1, o2, o3, n].forEach(x => { x.start(t); x.stop(t + 0.6); });
  }
  // gamme pentatonique sur sol
  const N = { G3: 196, C4: 261.6, D4: 293.7, E4: 329.6, G4: 392, A4: 440, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880 };
  const MOTIFS = {
    accord: [['G4', 0], ['C5', 0.11], ['E5', 0.22], ['G5', 0.36]],
    proposition: [['D5', 0], ['G5', 0.12]],
    refus: [['E4', 0], ['C4', 0.16]],
    annonce: [['A5', 0]]
  };
  const VOL = { accord: 0.32, proposition: 0.26, refus: 0.18, annonce: 0.12 };
  function jouer(cat) {
    const c = audio(); if (!c || c.state !== 'running') return false;
    const r = reglages(), t0 = c.currentTime + 0.02;
    MOTIFS[cat].forEach(([note, dt]) => lame(c, t0 + dt, N[note], VOL[cat] * r.volume));
    return true;
  }

  // file : regroupe les événements rapprochés (1,2 s) et ceux reçus onglet caché
  let file = [], timer = 0, cache = 0;
  const titre0 = document.title;
  function vider() {
    timer = 0; if (!file.length) return;
    const r = reglages(), top = file.filter(c => r.cats[c]).sort((a, b) => CATS[b].p - CATS[a].p)[0];
    file = [];
    if (r.on && top) jouer(top);
  }
  function signal(cat) {
    if (!CATS[cat]) return;
    if (document.hidden) { cache++; document.title = '(' + cache + ') ' + titre0.replace(/^\(\d+\) /, ''); file.push(cat); return; }
    file.push(cat); clearTimeout(timer); timer = setTimeout(vider, 1200);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (cache) { cache = 0; document.title = document.title.replace(/^\(\d+\) /, ''); }
    if (file.length) { clearTimeout(timer); timer = setTimeout(vider, 400); }
  });

  // une nouvelle annonce « vous concerne » si elle porte sur un produit de vos propres annonces (offre ↔ demande)
  addEventListener('mdg:nouvelles', e => {
    const mine = k => { try { return new Set((JSON.parse(localStorage.getItem('mdg-v2:' + k)) || []).map(x => x && x.productSlug).filter(Boolean)); } catch (_) { return new Set(); } };
    const mesOffres = mine('offres'), mesDemandes = mine('demandes'), d = e.detail || {};
    const utiles = (d.offres || []).filter(x => mesDemandes.has(x.productSlug)).length + (d.demandes || []).filter(x => mesOffres.has(x.productSlug)).length;
    if (!utiles) return;
    signal('annonce');
    if (window.MDGNuage) MDGNuage.toast(utiles > 1 ? utiles + ' nouvelles annonces sur vos produits.' : 'Une nouvelle annonce sur un de vos produits.');
  });

  // réglages : panneau ouvert depuis « Mon compte »
  function panneau() {
    if (window.MDGNuage && MDGNuage.style) MDGNuage.style();
    const r = reglages(), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bg = document.createElement('div'); bg.className = 'ng-bg';
    bg.innerHTML = `<div class="ng" role="dialog" aria-modal="true" aria-labelledby="sT"><button type="button" class="ng-x" aria-label="Fermer">×</button>
      <h2 id="sT">Sons</h2><p>De courtes notes de balafon pour ce qui compte : une proposition qui arrive, un accord. Chaque son s'accompagne toujours d'un message à l'écran.</p>
      <label class="sn-row sn-main"><span>Activer les sons</span><input type="checkbox" class="sn-on" ${r.on ? 'checked' : ''}></label>
      <div class="sn-cats" ${r.on ? '' : 'aria-disabled="true"'}>${Object.entries(CATS).map(([k, c]) => `<div class="sn-row"><label for="sn-${k}">${esc(c.nom)}</label><span><button type="button" class="sn-try" data-k="${k}" aria-label="Écouter : ${esc(c.nom)}">Écouter</button><input id="sn-${k}" type="checkbox" data-k="${k}" ${r.cats[k] ? 'checked' : ''}></span></div>`).join('')}</div>
      <label class="sn-row"><span>Volume</span><input type="range" class="sn-vol" min="0.1" max="1" step="0.05" value="${r.volume}" aria-label="Volume des sons"></label>
      <p class="ng-note">Le volume suit aussi celui de votre appareil. En mode silencieux, rien ne joue. Quand l'onglet est en arrière-plan, le nombre d'événements s'affiche dans son titre et un seul son joue au retour.</p></div>`;
    if (!document.getElementById('snCss')) { const st = document.createElement('style'); st.id = 'snCss'; st.textContent = `.ng label.sn-row,.sn-row label{margin:0;letter-spacing:0;font:500 15px/1.35 Jost,sans-serif;color:#F5F0E6}.ng label.sn-row{display:flex}.sn-row{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:52px;padding:6px 0;border-top:1px solid rgba(245,240,230,.1);font-size:15px;color:#F5F0E6}.sn-row span{display:flex;align-items:center;gap:10px}.sn-main{font-weight:600;border-top:0}.sn-row input[type=checkbox]{width:22px;height:22px;accent-color:#E07A3F}.sn-row input[type=range]{width:50%;accent-color:#E07A3F}.sn-cats[aria-disabled=true]{opacity:.45}.sn-try{min-height:36px;padding:0 12px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:#F5F0E6;font:600 13px Jost,sans-serif;cursor:pointer}`; document.head.appendChild(st); }
    document.querySelector('.ng-bg')?.remove(); document.body.appendChild(bg);
    const rendre = window.MDGNuage && MDGNuage.piege ? MDGNuage.piege(bg) : () => {}, close = () => { bg.remove(); rendre(); }; bg.querySelector('.ng-x').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    bg.querySelector('.sn-on').onchange = e => { regler({ on: e.target.checked }); bg.querySelector('.sn-cats').toggleAttribute('aria-disabled', !e.target.checked); if (e.target.checked) { audio(); setTimeout(() => jouer('proposition'), 60); } };
    bg.querySelectorAll('.sn-cats input').forEach(i => i.onchange = () => { const c = reglages().cats; c[i.dataset.k] = i.checked; regler({ cats: c }); });
    bg.querySelectorAll('.sn-try').forEach(b => b.onclick = () => { audio(); setTimeout(() => jouer(b.dataset.k), 40); });
    bg.querySelector('.sn-vol').onchange = e => { regler({ volume: +e.target.value }); audio(); setTimeout(() => jouer('proposition'), 40); };
    setTimeout(() => bg.querySelector('.sn-on').focus(), 50);
  }

  window.MDGSons = { signal, reglages, regler, essayer: c => { audio(); setTimeout(() => jouer(c), 40); }, panneau, CATS };
})();
