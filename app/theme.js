/* Marché de Gros CI — thème jour / nuit et page « Réglages » (écrit pour l'app).
   Trois choix : clair, sombre, comme le téléphone (par défaut). Mémorisé sur ce téléphone (mdg-app:theme).
   <html data-theme="clair|sombre"> est posé avant l'affichage, pour éviter un éclair blanc.
   API : MDGTheme.mode() · MDGTheme.choisir('clair'|'sombre'|'auto') · MDGTheme.ouvrir() (la page Réglages) */
(function () {
  'use strict';
  if (window.MDGTheme) return;
  const K = 'mdg-app:theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const lire = () => { try { const v = localStorage.getItem(K); return v === 'clair' || v === 'sombre' ? v : 'auto'; } catch (_) { return 'auto'; } };
  function appliquer() {
    const m = lire(), sombre = m === 'sombre' || (m === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', sombre ? 'sombre' : 'clair');
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', sombre ? '#12110E' : '#F3EFE4');
    dispatchEvent(new CustomEvent('mdg:theme', { detail: { mode: m, sombre } }));
  }
  function choisir(m) { try { if (m === 'auto') localStorage.removeItem(K); else localStorage.setItem(K, m); } catch (_) {} appliquer(); }
  if (mq) (mq.addEventListener ? mq.addEventListener('change', () => { if (lire() === 'auto') appliquer(); }) : mq.addListener(() => { if (lire() === 'auto') appliquer(); }));
  appliquer();

  // ——— la page Réglages (feuille du bas) ———
  const CSS = `.rg-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,12,9,.45);display:flex;align-items:flex-end;justify-content:center;animation:rgIn .2s ease both}
.rg{width:100%;max-width:520px;background:#FFFDF8;color:#171512;border-radius:28px 28px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(16,57,43,.22);font-family:Jost,system-ui,sans-serif;animation:rgUp .38s cubic-bezier(.22,1,.36,1) both}
.rg-p{width:40px;height:4px;border-radius:2px;background:rgba(23,21,18,.16);margin:0 auto 12px}
.rg-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px}.rg-h h2{margin:0;font:600 24px/1.15 Jost,sans-serif;letter-spacing:-.015em}
.rg-x{width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.06);color:inherit;display:grid;place-items:center;cursor:pointer}
.rg-sec{margin:14px 0 8px;font:600 12px/1 Jost,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#655C4D}
.rg-l{display:grid;gap:8px}
.rg-o{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:8px 14px 8px 8px;border:1px solid rgba(23,21,18,.08);border-radius:18px;background:#F7F4EC;color:inherit;font:500 16px Jost,sans-serif;text-align:left;cursor:pointer;transition:background .2s,border-color .2s,transform .15s}
.rg-o:active{transform:scale(.985)}
.rg-o i{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:rgba(16,57,43,.08);color:#10392B;font-style:normal}
.rg-o span{flex:1;display:flex;flex-direction:column;gap:2px}.rg-o small{font:400 13px Jost,sans-serif;color:#655C4D}
.rg-o b.ok{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:transparent;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.2)}
.rg-o[aria-checked=true]{background:#EAF3EC;border-color:rgba(16,57,43,.35)}.rg-o[aria-checked=true] b.ok{background:#10392B;color:#FFFDF8;box-shadow:none}
.rg-o:focus-visible,.rg-x:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.rg-n{margin:12px 2px 0;font:400 13px/1.45 Jost,sans-serif;color:#655C4D}
html[data-theme=sombre] .rg{background:#1C1915;color:#F3EFE4}html[data-theme=sombre] .rg-p{background:rgba(243,239,228,.2)}
html[data-theme=sombre] .rg-x{background:rgba(243,239,228,.08)}html[data-theme=sombre] .rg-sec,html[data-theme=sombre] .rg-o small,html[data-theme=sombre] .rg-n{color:#B9AD98}
html[data-theme=sombre] .rg-o{background:#25211B;border-color:rgba(243,239,228,.08)}html[data-theme=sombre] .rg-o i{background:rgba(242,194,48,.14);color:#F2C230}
html[data-theme=sombre] .rg-o b.ok{box-shadow:inset 0 0 0 1.5px rgba(243,239,228,.25)}html[data-theme=sombre] .rg-o[aria-checked=true]{background:rgba(242,194,48,.1);border-color:rgba(242,194,48,.45)}
html[data-theme=sombre] .rg-o[aria-checked=true] b.ok{background:#F2C230;color:#171512}
@keyframes rgIn{from{opacity:0}}@keyframes rgUp{from{transform:translateY(40px);opacity:.4}}
@media (prefers-reduced-motion:reduce){.rg-bg,.rg{animation:none}.rg-o{transition:none}}`;
  const I = n => (window.MDGIco ? MDGIco.svg(n, 22, 1.9) : '');
  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; removeEventListener('keydown', cle); try { retour && retour.focus(); } catch (_) {} }
  function cle(e) { if (e.key === 'Escape') fermer(); }
  function ouvrir() {
    if (!document.getElementById('rgCss')) { const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st); }
    fermer(); retour = document.activeElement;
    bg = document.createElement('div'); bg.className = 'rg-bg';
    const peindre = () => { const m = lire();
      const o = (k, ico, t, s) => `<button type="button" class="rg-o" role="radio" aria-checked="${m === k}" data-m="${k}"><i>${I(ico)}</i><span>${t}<small>${s}</small></span><b class="ok" aria-hidden="true">✓</b></button>`;
      bg.innerHTML = `<div class="rg" role="dialog" aria-modal="true" aria-labelledby="rgT"><div class="rg-p"></div>
        <div class="rg-h"><h2 id="rgT">Réglages</h2><button type="button" class="rg-x" aria-label="Fermer">${I('fermer')}</button></div>
        <p class="rg-sec">Apparence</p>
        <div class="rg-l" role="radiogroup" aria-label="Apparence">${o('clair', 'jour', 'Clair', 'Fond crème, idéal en plein jour')}${o('sombre', 'nuit', 'Sombre', 'Fond foncé, plus doux le soir')}${o('auto', 'telephone', 'Comme le téléphone', 'Suit le réglage jour / nuit du téléphone')}</div>
        <p class="rg-n">Ce choix reste sur ce téléphone.</p></div>`;
      bg.querySelector('.rg-x').onclick = fermer;
      bg.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { choisir(b.dataset.m); peindre(); const f = bg.querySelector(`[data-m="${b.dataset.m}"]`); if (f) f.focus(); });
    };
    peindre();
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    addEventListener('keydown', cle); document.body.appendChild(bg);
    setTimeout(() => { const f = bg && bg.querySelector('[aria-checked=true]'); if (f) f.focus(); }, 60);
  }
  window.MDGTheme = { mode: lire, choisir, ouvrir };
})();
