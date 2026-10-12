/* ═════════ Marché de Gros CI — langage sonore ═════════
   Des sons courts de balafon, synthétisés dans le navigateur (aucun fichier, aucune bibliothèque).
   Désactivés par défaut : ils ne jouent qu'après activation dans « Mon compte → Sons ».
   Hiérarchie (un seul son par lot d'événements, le plus important gagne) :
     1. accord      — une proposition est acceptée (quatre notes montantes)
     2. proposition — une proposition ou une contre-proposition arrive (deux notes montantes)
     3. message     — un message direct arrive (deux notes douces et rapides)
     4. refus       — refusée, retirée, expirée ou négociation arrêtée (deux notes descendantes, plus basses)
     5. annonce     — une nouvelle offre ou demande sur un produit qui vous concerne (une note légère)
   Heures calmes (facultatif) : aucun son de 21 h à 6 h ; le message à l'écran reste.
   Onglet en arrière-plan : rien ne joue ; le titre affiche le nombre d'événements, un seul son joue au retour.
   iPhone : le son n'est permis qu'après un geste ; il est « déverrouillé » au premier toucher (tampon muet + reprise
   du contexte audio), et chaque son attend que le contexte soit vraiment prêt. Le mode silencieux de l'iPhone coupe les sons.
   API : MDGSons.signal(cat) · reglages() · regler(r) · essayer(cat) · panneau() · CATS */
(function () {
  'use strict';
  const KS = 'mdg-sons:reglages';
  const CATS = {
    accord: { nom: 'Accords conclus', p: 5 },
    proposition: { nom: 'Propositions reçues', p: 4 },
    message: { nom: 'Messages', p: 3 },
    refus: { nom: 'Refus et retraits', p: 2 },
    annonce: { nom: 'Nouvelles annonces', p: 1 }
  };
  const DEF = { on: false, volume: 0.7, calme: false, vibre: true, cats: { accord: true, proposition: true, message: true, refus: true, annonce: false } };
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const reglages = () => { const s = J(KS, {}); return Object.assign({}, DEF, s, { cats: Object.assign({}, DEF.cats, s.cats || {}) }); };
  const regler = r => { try { localStorage.setItem(KS, JSON.stringify(Object.assign(reglages(), r))); } catch (_) {} };
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const vibreOk = 'vibrate' in navigator && !ios;
  const calmeMaintenant = () => { const h = new Date().getHours(); return h >= 21 || h < 6; };

  // ——— le contexte audio ———
  let ctx = null;
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (_) {}  // se mêle à la musique en cours, respecte le mode silencieux
  function audio() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    if (!ctx) { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (_) { ctx = new AC(); } }
    return ctx;
  }
  async function pret() {
    const c = audio(); if (!c) return null;
    if (c.state !== 'running') { try { await c.resume(); } catch (_) {} }
    return c.state === 'running' ? c : null;
  }
  // iPhone : un tampon muet joué pendant un vrai geste (toucher, clic, touche) ouvre la sortie audio pour la suite
  function deverrouiller(force) {
    if (force !== true && !reglages().on && !document.querySelector('.sn-bg')) return;  // panneau ouvert : on peut écouter même sons coupés
    const c = audio(); if (!c) return;
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (_) {}
    if (c.state !== 'running') c.resume().catch(() => {});
  }
  ['touchend', 'click', 'keydown'].forEach(t => addEventListener(t, deverrouiller, { capture: true, passive: true }));

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
  // gamme pentatonique ; les huit lames du balafon dessiné dans le panneau
  const N = { C4: 261.6, E4: 329.6, G4: 392, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784, A5: 880 };
  const LAMES = Object.keys(N);
  const MOTIFS = {
    accord: [['G4', 0], ['C5', 0.11], ['E5', 0.22], ['G5', 0.36]],
    proposition: [['D5', 0], ['G5', 0.12]],
    message: [['C5', 0], ['E5', 0.08]],
    refus: [['E4', 0], ['C4', 0.16]],
    annonce: [['A5', 0]]
  };
  const VOL = { accord: 0.34, proposition: 0.28, message: 0.24, refus: 0.2, annonce: 0.14, lame: 0.26 };
  const VIBRE = { accord: [60, 50, 60, 50, 120], proposition: [70, 40, 70], message: [40, 30, 40], refus: [120], annonce: [30] };
  // joue des notes et prévient le panneau (les lames s'allument en même temps que le son)
  async function notes(liste, g) {
    const c = await pret(); if (!c) return false;
    const t0 = c.currentTime + 0.03, v = reglages().volume;
    liste.forEach(([note, dt]) => lame(c, t0 + dt, N[note], g * v));
    dispatchEvent(new CustomEvent('mdg:son', { detail: { notes: liste } }));
    return true;
  }
  const jouer = cat => notes(MOTIFS[cat], VOL[cat]);

  // file : regroupe les événements rapprochés (1,2 s) et ceux reçus onglet caché
  let file = [], timer = 0, cache = 0;
  const titre0 = document.title;
  function vider() {
    timer = 0; if (!file.length) return;
    const r = reglages(), top = file.filter(c => r.cats[c]).sort((a, b) => CATS[b].p - CATS[a].p)[0];
    file = [];
    if (!r.on || !top || (r.calme && calmeMaintenant())) return;
    jouer(top);
    if (vibreOk && r.vibre) try { navigator.vibrate(VIBRE[top]); } catch (_) {}
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

  // ——— le panneau : un balafon qui s'allume quand un son joue, des oreilles pour écouter, des interrupteurs ———
  const I = {
    oreille: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M5 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0"/><path class="o" d="M14 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4"/><path class="w w1" d="M20.6 6.4a5.5 5.5 0 0 1 0 5.2"/><path class="w w2" d="M22.8 4.6a8.6 8.6 0 0 1 0 8.8"/></svg>',
    bas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/></svg>',
    haut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5h3.5L11 6v12l-4.5-3.5H3z"/><path d="M14.5 9.2a4 4 0 0 1 0 5.6M17.3 6.6a7.6 7.6 0 0 1 0 10.8" fill="none"/></svg>',
    lune: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg>',
    vibre: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 9v6M2 10.5v3M19.5 9v6M22 10.5v3"/></svg>'
  };
  const CSS = `.sn-bg{position:fixed;inset:0;z-index:9300;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,9,7,.6);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:snIn .2s ease both}
.sn{--ink:#F5F0E6;--mute:#B9AD98;--line:rgba(245,240,230,.09);--acc:#E07A3F;--bois:#B98250;position:relative;width:100%;max-width:520px;max-height:92dvh;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:20px 20px calc(18px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:#1d1a15;color:var(--ink);font:400 15px/1.45 Jost,system-ui,sans-serif;box-shadow:0 -10px 50px rgba(0,0,0,.5);animation:snUp .4s cubic-bezier(.22,1,.36,1) both}
@media (min-width:720px){.sn-bg{align-items:center}.sn{border-radius:28px}}
.sn h2{margin:0 52px 2px 0;font:500 30px/1.1 'Cormorant Garamond',Georgia,serif}.sn>p{margin:0;color:var(--mute);font-size:14px}
.sn-x{position:absolute;right:14px;top:14px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:var(--ink);font-size:0;cursor:pointer}
.sn-x::before,.sn-x::after{content:"";position:absolute;left:50%;top:50%;width:15px;height:2px;border-radius:2px;background:currentColor;transform:translate(-50%,-50%) rotate(45deg)}.sn-x::after{transform:translate(-50%,-50%) rotate(-45deg)}
.sn button:focus-visible,.sn [role=slider]:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
/* le balafon */
.sn-bal{display:block;width:100%;height:auto;margin:16px 0 0;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.sn-bal .k{outline:none;-webkit-tap-highlight-color:transparent;cursor:pointer;transform-box:fill-box;transform-origin:50% 50%;transition:filter .3s}
.sn-bal .k rect{fill:url(#snBois);stroke:rgba(0,0,0,.35);stroke-width:1}
.sn-bal .k .g{fill:#3a2c1f;stroke:rgba(245,240,230,.08);transform-box:fill-box;transform-origin:50% 0}
.sn-bal .k.hit rect{animation:snFrappe .5s cubic-bezier(.22,1,.36,1)}.sn-bal .k.hit .g{animation:snCaleb .6s ease-out}
.sn-bal .k.hit{filter:drop-shadow(0 0 10px rgba(242,201,76,.75)) brightness(1.25)}
.sn-bal.off .k{filter:saturate(.35) brightness(.7)}.sn-bal.off .k.hit{filter:drop-shadow(0 0 8px rgba(242,201,76,.5)) brightness(1.05)}
.sn-aide{min-height:0;margin:2px 0 0;text-align:center;color:var(--mute);font-size:12.5px;transition:opacity .3s}
/* rangées */
.sn-grp{margin:12px 0 0;border-radius:20px;background:rgba(245,240,230,.04);overflow:hidden}
.sn-r{display:flex;align-items:center;gap:10px;min-height:58px;padding:6px 10px 6px 16px}.sn-r+.sn-r{border-top:1px solid var(--line)}
.sn-r .t{flex:1;min-width:0}.sn-r .t b{display:block;font-weight:500;font-size:16px}.sn-r .t small{display:block;color:var(--mute);font-size:12.5px}
.sn-r.maitre .t b{font-weight:600;font-size:17px}
.sn-r>svg{flex:none;width:22px;height:22px;fill:none;stroke:var(--mute);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.sn-grp.dim .sn-r .t,.sn-grp.dim .sn-sw{opacity:.42}
/* l'oreille : écouter */
.sn-ec{flex:none;position:relative;width:44px;height:44px;border:0;border-radius:50%;background:rgba(245,240,230,.06);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:background .2s}
.sn-ec svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
.sn-ec .w{opacity:0;stroke:#F2C94C}.sn-ec.joue{background:rgba(242,201,76,.14);color:#F2DC9A}.sn-ec.joue .w1{animation:snOnde .9s ease-out}.sn-ec.joue .w2{animation:snOnde .9s ease-out .12s}
.sn-ec:active{transform:scale(.92)}
/* interrupteur */
.sn-sw{flex:none;position:relative;width:52px;height:32px;border:0;border-radius:16px;background:rgba(245,240,230,.16);cursor:pointer;transition:background .25s;padding:0}
.sn-sw::after{content:"";position:absolute;left:3px;top:3px;width:26px;height:26px;border-radius:50%;background:#F5F0E6;box-shadow:0 2px 6px rgba(0,0,0,.35);transition:transform .28s cubic-bezier(.22,1,.36,1)}
.sn-sw[aria-checked=true]{background:var(--acc)}.sn-sw[aria-checked=true]::after{transform:translateX(20px)}
.sn-sw::before{content:"";position:absolute;inset:-6px -4px}
/* volume */
.sn-vr{display:flex;align-items:center;gap:12px;min-height:64px;padding:4px 14px}
.sn-vr>svg{flex:none;width:22px;height:22px;fill:var(--mute);stroke:var(--mute);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.sn-vol{position:relative;flex:1;height:44px;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sn-vol i{position:absolute;left:0;right:0;top:50%;height:6px;margin-top:-3px;border-radius:3px;background:rgba(245,240,230,.16);overflow:hidden}
.sn-vol i b{display:block;height:100%;background:linear-gradient(90deg,#C9712F,var(--acc));border-radius:3px}
.sn-vol span{position:absolute;top:50%;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:#F5F0E6;box-shadow:0 2px 8px rgba(0,0,0,.4);transition:transform .15s}
.sn-vol.tient span{transform:scale(1.15)}
.sn-vol em{position:absolute;bottom:calc(50% + 20px);margin-left:-20px;width:40px;text-align:center;font:600 12px Jost,sans-serif;font-style:normal;color:var(--ink);opacity:0;transition:opacity .15s}.sn-vol.tient em{opacity:1}
@keyframes snIn{from{opacity:0}}@keyframes snUp{from{transform:translateY(30px);opacity:0}}
@keyframes snFrappe{0%{transform:translateY(0)}25%{transform:translateY(3px)}100%{transform:translateY(0)}}
@keyframes snCaleb{0%{transform:scaleY(1)}30%{transform:scaleY(1.12)}100%{transform:scaleY(1)}}
@keyframes snOnde{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.sn-bg,.sn,.sn-bal .k.hit rect,.sn-bal .k.hit .g,.sn-ec.joue .w{animation:none}.sn-sw::after{transition:none}}`;

  function balafon() {
    // huit lames de bois, de la plus grave (longue, à gauche) à la plus aiguë ; calebasses dessous ; deux cordes
    const W = 320, n = LAMES.length, pas = W / n;
    const lames = LAMES.map((note, i) => {
      const h = 78 - i * 5.2, x = i * pas + 4, w = pas - 8, y = (78 - h) / 2 + 4, r = 13 - i * 0.9;
      return `<g class="k" data-n="${note}"><ellipse class="g" cx="${x + w / 2}" cy="${y + h + 12}" rx="${r}" ry="${r * 0.9}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/></g>`;
    }).join('');
    return `<svg class="sn-bal" viewBox="0 0 ${W} 104" aria-hidden="true"><defs><linearGradient id="snBois" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D8A266"/><stop offset=".55" stop-color="#B98250"/><stop offset="1" stop-color="#8A5A30"/></linearGradient></defs>
      <path d="M2 22 Q160 30 318 26 M2 70 Q160 62 318 60" stroke="rgba(245,240,230,.25)" stroke-width="1.2" fill="none"/>${lames}</svg>`;
  }

  function panneau() {
    const r0 = reglages();
    document.querySelector('.sn-bg')?.remove();
    if (!document.getElementById('snCss2')) { const st = document.createElement('style'); st.id = 'snCss2'; st.textContent = CSS; document.head.appendChild(st); }
    const sw = (k, on, label) => `<button type="button" class="sn-sw" role="switch" aria-checked="${on}" data-sw="${k}" aria-label="${label}"></button>`;
    const bg = document.createElement('div'); bg.className = 'sn-bg';
    bg.innerHTML = `<div class="sn" role="dialog" aria-modal="true" aria-labelledby="snT"><button type="button" class="sn-x" aria-label="Fermer">Fermer</button>
      <h2 id="snT">Sons</h2><p>Des notes de balafon quand on vous répond.</p>
      ${balafon()}<p class="sn-aide" aria-live="polite"></p>
      <div class="sn-grp"><div class="sn-r maitre"><span class="t"><b>Sons activés</b></span>${sw('on', r0.on, 'Activer les sons')}</div></div>
      <div class="sn-grp sn-cats${r0.on ? '' : ' dim'}">${Object.entries(CATS).map(([k, c]) => `<div class="sn-r"><span class="t"><b>${c.nom}</b></span><button type="button" class="sn-ec" data-ec="${k}" aria-label="Écouter : ${c.nom}">${I.oreille}</button>${sw('c:' + k, !!r0.cats[k], c.nom)}</div>`).join('')}</div>
      <div class="sn-grp"><div class="sn-vr">${I.bas}<div class="sn-vol" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="5" aria-valuemax="100"><i><b></b></i><span></span><em></em></div>${I.haut}</div></div>
      <div class="sn-grp">
        <div class="sn-r">${I.lune}<span class="t"><b>Heures calmes</b><small>Silence de 21 h à 6 h</small></span>${sw('calme', r0.calme, 'Heures calmes, silence de 21 h à 6 h')}</div>
        ${vibreOk ? `<div class="sn-r">${I.vibre}<span class="t"><b>Vibrer aussi</b></span>${sw('vibre', r0.vibre, 'Vibrer aussi')}</div>` : ''}
      </div></div>`;
    document.body.appendChild(bg);
    const $ = s => bg.querySelector(s), bal = $('.sn-bal'), aide = $('.sn-aide');
    const rendre = window.MDGNuage && MDGNuage.piege ? MDGNuage.piege(bg) : () => {};
    const fermer = () => { removeEventListener('mdg:son', allumer); bg.remove(); rendre(); };
    $('.sn-x').onclick = fermer; bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.addEventListener('keydown', e => { if (e.key === 'Escape') fermer(); });
    bal.classList.toggle('off', !r0.on);

    // les lames s'allument au rythme du son (on voit qu'il joue, même téléphone en silencieux)
    function allumer(e) {
      (e.detail.notes || []).forEach(([note, dt]) => setTimeout(() => {
        const k = bal.querySelector(`[data-n="${note}"]`); if (!k) return;
        k.classList.remove('hit'); void k.getBoundingClientRect(); k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 520);
      }, dt * 1000 + 30));
    }
    addEventListener('mdg:son', allumer);
    let aideT = 0;
    const essai = async (cat, el) => {
      deverrouiller(true);
      const ok = cat ? await jouer(cat) : false;
      if (el) { el.classList.remove('joue'); void el.offsetWidth; el.classList.add('joue'); setTimeout(() => el.classList.remove('joue'), 1100); }
      clearTimeout(aideT);
      aide.textContent = !ok ? 'Ce téléphone ne peut pas jouer de son ici.' : ios ? 'Pas de son ? Coupez le mode silencieux de l’iPhone.' : '';
      aideT = setTimeout(() => { aide.textContent = ''; }, 6000);
    };
    bal.addEventListener('click', e => { const k = e.target.closest('.k'); if (!k) return; deverrouiller(true); notes([[k.dataset.n, 0]], VOL.lame); });
    bg.querySelectorAll('[data-ec]').forEach(b => b.onclick = () => essai(b.dataset.ec, b));

    // interrupteurs
    bg.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => {
      const on = b.getAttribute('aria-checked') !== 'true', k = b.dataset.sw; b.setAttribute('aria-checked', on);
      if (k === 'on') { regler({ on }); $('.sn-cats').classList.toggle('dim', !on); bal.classList.toggle('off', !on); if (on) essai('accord'); }
      else if (k.startsWith('c:')) { const c = reglages().cats; c[k.slice(2)] = on; regler({ cats: c }); if (on) essai(k.slice(2), b.previousElementSibling); }
      else { regler({ [k]: on }); if (k === 'vibre' && on && vibreOk) try { navigator.vibrate(VIBRE.proposition); } catch (_) {} }
    });

    // volume : curseur maison (le curseur natif était bloqué par le glissement de l'application)
    const vol = $('.sn-vol'), barre = vol.querySelector('b'), bouton = vol.querySelector('span'), bulle = vol.querySelector('em');
    let v = reglages().volume;
    const poser = x => { v = Math.round(Math.min(1, Math.max(0.05, x)) * 100) / 100; const p = v * 100 + '%'; barre.style.width = p; bouton.style.left = p; bulle.style.left = p; bulle.textContent = Math.round(v * 100) + ' %'; vol.setAttribute('aria-valuenow', Math.round(v * 100)); vol.setAttribute('aria-valuetext', Math.round(v * 100) + ' %'); };
    const depuis = e => { const r = vol.getBoundingClientRect(); poser((e.clientX - r.left) / r.width); };
    const finir = () => { regler({ volume: v }); essai('proposition'); };
    poser(v);
    vol.addEventListener('pointerdown', e => { e.preventDefault(); deverrouiller(true); vol.setPointerCapture(e.pointerId); vol.classList.add('tient'); depuis(e); });
    vol.addEventListener('pointermove', e => { if (vol.classList.contains('tient')) depuis(e); });
    const lacher = () => { if (!vol.classList.contains('tient')) return; vol.classList.remove('tient'); finir(); };
    vol.addEventListener('touchend', () => deverrouiller(true), { passive: true });  // iPhone : le son n'est permis qu'à la fin du toucher
    vol.addEventListener('pointerup', lacher); vol.addEventListener('pointercancel', lacher);
    vol.addEventListener('keydown', e => { const d = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 }[e.key]; if (d) { e.preventDefault(); poser(v + d); finir(); } else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); poser(e.key === 'Home' ? 0.05 : 1); finir(); } });
    setTimeout(() => $('[data-sw="on"]').focus({ preventScroll: true }), 60);
  }

  window.MDGSons = { signal, reglages, regler, essayer: c => { deverrouiller(true); return jouer(c); }, panneau, CATS };
})();
