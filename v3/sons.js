/* ═════════ Marché de Gros CI — langage sonore ═════════
   Des sons courts de balafon, synthétisés dans le navigateur (aucun fichier, aucune bibliothèque).
   Activés par défaut, discrets ; tout se coupe ou se règle dans « Mon compte → Sons ».
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
    annonce: { nom: 'Nouvelles annonces sur vos produits', p: 1 },
    confirmation: { nom: 'Confirmations à l’écran (connecté, annonce en ligne…)', p: 0 }
  };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  // sons activés par défaut, discrets ; chacun se coupe dans Mon compte → Sons
  const reglages = () => { const r = Object.assign({ on: true, volume: 0.6 }, J(KS, {})); r.cats = Object.assign({ accord: true, proposition: true, refus: true, annonce: false, confirmation: true }, r.cats || {}); return r; };
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
    annonce: [['A5', 0]],
    ok: [['C5', 0], ['G5', 0.09]],
    info: [['E5', 0]],
    alerte: [['A4', 0], ['A4', 0.13]],
    erreur: [['D4', 0], ['G3', 0.12]]
  };
  const VOL = { accord: 0.32, proposition: 0.26, refus: 0.18, annonce: 0.12, ok: 0.14, info: 0.09, alerte: 0.13, erreur: 0.15 };
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
    if (window.MDGNuage && !window.MDGAnnonceHaut) MDGNuage.toast(utiles > 1 ? utiles + ' nouvelles annonces sur vos produits.' : 'Une nouvelle annonce sur un de vos produits.');
  });

  // réglages : panneau ouvert depuis « Mon compte »
  /* le réglage des sons : même papier clair que « Mon compte » ; un interrupteur général, puis une ligne par moment
     (👂 pour écouter, un interrupteur pour l'activer), et le volume entre 🔈 et 🔊 */
  const PCSS = `.snp-bg{position:fixed;inset:0;z-index:9300;background:rgba(8,7,5,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:snpIn .2s ease both}
@media (min-width:720px){.snp-bg{align-items:center;padding:24px}}
.snp{outline:none;position:relative;width:100%;max-width:520px;max-height:92dvh;overflow:auto;box-sizing:border-box;padding:12px 16px calc(24px + env(safe-area-inset-bottom));background:#F4EEE3;color:#171512;border-radius:28px 28px 0 0;font:400 15px/1.45 Jost,system-ui,sans-serif;box-shadow:0 -10px 60px rgba(0,0,0,.5);animation:snpUp .32s cubic-bezier(.22,1,.36,1) both}
@media (min-width:720px){.snp{border-radius:28px;padding-bottom:24px}.snp::before{visibility:hidden}}
.snp::before{content:"";display:block;width:38px;height:5px;margin:0 auto 10px;border-radius:3px;background:rgba(23,21,18,.16)}
.snp-x{position:absolute;right:14px;top:16px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:#171512;cursor:pointer}
.snp h2{margin:8px 60px 4px 4px;font:500 32px/1.08 'Cormorant Garamond',Georgia,serif}
.snp>p{margin:0 4px 16px;color:#655C4D;font-size:14px;line-height:1.5}
.snp-lab{margin:22px 16px 8px;font:600 12px/1.2 Jost,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#857A67}
.snp-grp{background:#FFFDF8;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04);transition:opacity .2s}
.snp-grp.off{opacity:.45}
.snp-r{position:relative;display:flex;align-items:center;gap:12px;min-height:62px;padding:9px 14px}
.snp-r+.snp-r::before{content:"";position:absolute;left:14px;right:0;top:0;height:1px;background:rgba(23,21,18,.08)}
.snp-ti{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-size:19px;line-height:1;background:rgba(16,57,43,.14)}
.snp-t{flex:1;min-width:0}.snp-t b{display:block;font-weight:500;font-size:15.5px;line-height:1.25}.snp-t small{display:block;margin-top:2px;color:#655C4D;font-size:12.5px;line-height:1.3}
.snp-ec{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:#EFE7D9;font-size:21px;line-height:1;cursor:pointer;transition:transform .15s}
.snp-ec:active{transform:scale(.9)}.snp-ec.joue{background:rgba(16,57,43,.22)}
.snp-ec:disabled{opacity:.5;cursor:default}
.snp-tog{-webkit-appearance:none;appearance:none;flex:none;position:relative;width:51px;height:31px;margin:0;border-radius:16px;background:rgba(23,21,18,.16);cursor:pointer;transition:background .2s}
.snp-tog::after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:transform .2s cubic-bezier(.22,1,.36,1)}
.snp-tog:checked{background:#10392B}.snp-tog:checked::after{transform:translateX(20px)}
.snp-tog:disabled{cursor:default}
.snp-tog:focus-visible,.snp-ec:focus-visible,.snp-x:focus-visible,.snp-vol:focus-visible{outline:2px solid #E07A3F;outline-offset:2px}
.snp-v{display:flex;align-items:center;gap:12px;min-height:64px;padding:8px 16px}
.snp-v span{flex:none;font-size:20px;line-height:1}
.snp-vol{flex:1;min-width:0;height:44px;margin:0;background:none;-webkit-appearance:none;appearance:none;cursor:pointer;--p:60%}
.snp-vol::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:linear-gradient(90deg,#E07A3F var(--p),rgba(23,21,18,.14) var(--p))}
.snp-vol::-moz-range-track{height:6px;border-radius:3px;background:rgba(23,21,18,.14)}.snp-vol::-moz-range-progress{height:6px;border-radius:3px;background:#10392B}
.snp-vol::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;margin-top:-11px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.snp-vol::-moz-range-thumb{width:28px;height:28px;border:0;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}
.snp-note{margin:12px 16px 0;color:#857A67;font-size:12.5px;line-height:1.45}
@keyframes snpIn{from{opacity:0}}@keyframes snpUp{from{transform:translateY(30px);opacity:0}}
@media (prefers-reduced-motion:reduce){.snp-bg,.snp{animation:none}.snp-tog,.snp-tog::after{transition:none}}`;
  const EMO = { accord: '🤝', proposition: '💬', refus: '⏳', annonce: '🧺', confirmation: '✅' };
  const SOUS = { accord: 'Un prix accepté des deux côtés', proposition: 'Quelqu’un vous propose un prix', refus: 'Une proposition sans suite', annonce: 'Un produit que vous suivez', confirmation: 'Connecté, annonce en ligne, message envoyé…' };
  function panneau() {
    const r = reglages(), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (!document.getElementById('snpCss')) { const st = document.createElement('style'); st.id = 'snpCss'; st.textContent = PCSS; document.head.appendChild(st); }
    const bg = document.createElement('div'); bg.className = 'snp-bg';
    bg.innerHTML = `<div class="snp" role="dialog" aria-modal="true" aria-labelledby="snpT"><button type="button" class="snp-x ui-x" aria-label="Fermer"></button>
      <h2 id="snpT">Sons</h2><p>De courtes notes de balafon pour ce qui compte. Chaque son s’accompagne toujours d’un message à l’écran.</p>
      <div class="snp-grp"><label class="snp-r"><span class="snp-ti" aria-hidden="true">🎶</span><span class="snp-t"><b>Sons du marché</b><small>Notes de balafon</small></span><input type="checkbox" class="snp-tog" role="switch" data-on ${r.on ? 'checked' : ''}></label></div>
      <p class="snp-lab">Quand jouer</p>
      <div class="snp-grp${r.on ? '' : ' off'}" data-cats>${Object.entries(CATS).map(([k, c]) => `<div class="snp-r"><span class="snp-ti" aria-hidden="true">${EMO[k] || '🔔'}</span><label class="snp-t" for="snp-${k}"><b>${esc(c.nom)}</b><small>${esc(SOUS[k] || '')}</small></label><button type="button" class="snp-ec" data-k="${k}" aria-label="Écouter : ${esc(c.nom)}" title="Écouter" ${r.on ? '' : 'disabled'}>👂</button><input id="snp-${k}" type="checkbox" class="snp-tog" role="switch" data-k="${k}" ${r.cats[k] !== false ? 'checked' : ''} ${r.on ? '' : 'disabled'}></div>`).join('')}</div>
      <p class="snp-lab">Volume</p>
      <div class="snp-grp${r.on ? '' : ' off'}" data-volg><div class="snp-v"><span aria-hidden="true">🔈</span><input type="range" class="snp-vol" min="0.1" max="1" step="0.05" value="${r.volume}" aria-label="Volume des sons" ${r.on ? '' : 'disabled'}><span aria-hidden="true">🔊</span></div></div>
      <p class="snp-note">Le volume suit aussi celui du téléphone ; en mode silencieux, rien ne joue. Application en arrière-plan : un seul son au retour.</p></div>`;
    document.querySelector('.snp-bg')?.remove(); document.querySelector('.ng-bg .sn-on')?.closest('.ng-bg')?.remove(); document.body.appendChild(bg);
    const rendre = window.MDGNuage && MDGNuage.piege ? MDGNuage.piege(bg) : () => {}, close = () => { bg.remove(); rendre(); };
    bg.querySelector('.snp-x').onclick = close; bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    const vol = bg.querySelector('.snp-vol'), remplir = () => vol.style.setProperty('--p', ((vol.value - vol.min) / (vol.max - vol.min) * 100) + '%'); remplir();
    const etat = on => { bg.querySelector('[data-cats]').classList.toggle('off', !on); bg.querySelector('[data-volg]').classList.toggle('off', !on); bg.querySelectorAll('[data-cats] button, [data-cats] input, .snp-vol').forEach(x => { x.disabled = !on; }); };
    bg.querySelector('[data-on]').onchange = e => { regler({ on: e.target.checked }); etat(e.target.checked); if (e.target.checked) { audio(); setTimeout(() => jouer('proposition'), 60); } };
    bg.querySelectorAll('[data-cats] input').forEach(i => i.onchange = () => { const c = reglages().cats; c[i.dataset.k] = i.checked; regler({ cats: c }); });
    bg.querySelectorAll('.snp-ec').forEach(b => b.onclick = () => { audio(); b.classList.add('joue'); setTimeout(() => jouer(b.dataset.k), 40); setTimeout(() => b.classList.remove('joue'), 700); });
    vol.oninput = remplir;
    vol.onchange = () => { regler({ volume: +vol.value }); audio(); setTimeout(() => jouer('proposition'), 40); };
    bg.querySelector('.snp').setAttribute('tabindex', '-1'); setTimeout(() => bg.querySelector('.snp').focus({ preventScroll: true }), 50);   // la fenêtre prend la main (lecteur d'écran, clavier), sans anneau sur un bouton
  }

  // un message à l'écran (app/toast.js) : son immédiat et léger, selon son sens (réussi, à savoir, attention, échec)
  function confirmer(type) { const r = reglages(); if (!r.on || !r.cats.confirmation || document.hidden || !MOTIFS[type]) return; audio(); setTimeout(() => jouer(type), 30); }
  window.MDGSons = { signal, reglages, regler, confirmer, essayer: c => { audio(); setTimeout(() => jouer(c === 'confirmation' ? 'ok' : c), 40); }, panneau, CATS };
})();
