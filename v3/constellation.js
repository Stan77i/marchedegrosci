/* ═════════ Catégories — constellation (ORDRE-DE-MISSION § XX, VII) ═════════
   Les familles sont des nœuds ; leurs produits, des grains autour. Taille et forme du grain = données réelles :
   cercle vert = quelqu'un le vend, carré jaune = quelqu'un le cherche et personne ne le vend encore, grain pâle = ni vendu ni recherché.
   Curseur = force : les familles proches glissent vers lui (ressort amorti), les lointaines restent immobiles.
   Toucher une famille : elle passe au centre, les autres reculent dans le flou, ses produits émergent avec leur nom.
   La liste en dessous reste la voie rapide et s'ouvre sur la même famille (les deux restent synchronisés). */
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  V3.constel = function (view, rows, I) {
    const list = view.querySelector('.ct-list'); if (!list) return null;
    const box = document.createElement('div'); box.className = 'cs'; box.setAttribute('data-fl-skip', '');
    const N = rows.length;
    // familles sur une ellipse, légèrement décalées pour éviter la rigidité d'un cadran
    const pos = rows.map((r, i) => { const a = -Math.PI / 2 + (i / N) * Math.PI * 2; return { x: 50 + Math.cos(a) * 38, y: 50 + Math.sin(a) * (i % 2 ? 34 : 39) }; });
    const all = rows.flatMap(r => r.prods), nO = all.filter(x => x.o.length).length, nD = all.filter(x => !x.o.length && x.d.length).length, nb = n => n ? ` <b>${n}</b>` : '';
    box.innerHTML = `<p class="cs-leg"><span class="cs-lt">Chaque grain est un produit</span><span><i class="cs-g on"></i>Quelqu'un le vend${nb(nO)}</span><span><i class="cs-g dm"></i>Recherché, personne ne le vend encore${nb(nD)}</span><span><i class="cs-g"></i>Ni vendu ni recherché</span><span class="cs-lt">plus il est gros, plus il y a de publications</span></p>
      <div class="cs-sky" role="group" aria-label="Familles de produits">${rows.map((r, i) => {
        const ps = r.prods.slice(0, 12), k = ps.length;
        return `<div class="cs-f${r.no || r.nd ? ' live' : ''}" data-c="${r.c.slug}" style="--x:${pos[i].x}%;--y:${pos[i].y}%">
          <button type="button" class="cs-n" aria-pressed="false" aria-label="${esc(r.c.name)}, ${r.prods.length} produits"><img src="v2/img/famille-${r.c.slug}.webp" alt="" loading="lazy" decoding="async" width="56" height="56"><b>${esc(r.c.name)}</b></button>
          ${ps.map((x, j) => { const a = (j / k) * 360 - 90 + (i * 23) % 40; const g = x.o.length ? 'on' : x.d.length ? 'dm' : ''; const w = Math.min(10, 4 + (x.o.length + x.d.length) * 1.5);
            return `<a class="cs-p${j % 2 ? ' alt' : ''}" href="#/produits/${x.p.slug}" tabindex="-1" style="--a:${a}deg;--r0:${30 + (j % 3) * 6}px;--w:${w}px"><i class="cs-ln"></i><i class="cs-g ${g}"></i><span>${esc(x.p.name)}</span></a>`; }).join('')}
        </div>`; }).join('')}</div>`;
    list.parentNode.insertBefore(box, list);
    const sky = box.querySelector('.cs-sky'), fams = [...box.querySelectorAll('.cs-f')];

    function focus(slug) {
      box.classList.toggle('has-f', !!slug);
      fams.forEach(f => { const on = f.dataset.c === slug; f.classList.toggle('is-f', on); f.querySelector('.cs-n').setAttribute('aria-pressed', String(on)); f.querySelectorAll('.cs-p').forEach(a => a.tabIndex = on ? 0 : -1); });
      window.MDGEtat && slug && window.MDGEtat.set('focus', 1200);
    }
    fams.forEach(f => f.querySelector('.cs-n').addEventListener('click', () => {
      const b = view.querySelector(`.ct-row[data-c="${f.dataset.c}"] .ct-a`); if (b) b.click();
    }));
    // la liste reste la source : chaque ouverture / fermeture y est reflétée
    const mo = new MutationObserver(() => { const o = view.querySelector('.ct-a[aria-expanded="true"]'); focus(o ? o.closest('.ct-row').dataset.c : null); });
    view.querySelectorAll('.ct-a').forEach(b => mo.observe(b, { attributes: true, attributeFilter: ['aria-expanded'] }));
    { const o = view.querySelector('.ct-a[aria-expanded="true"]'); if (o) focus(o.closest('.ct-row').dataset.c); }
    sky.addEventListener('click', e => { if (e.target === sky && box.classList.contains('has-f')) { const o = view.querySelector('.ct-a[aria-expanded="true"]'); o && o.click(); } });

    // curseur = force (ressort amorti, frame-rate indépendant)
    let raf = 0, mx = -1e4, my = -1e4, on = false, last = 0;
    const st = fams.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    function step(now) {
      const dt = Math.min(1 / 30, (now - (last || now)) / 1000 || 1 / 60); last = now;
      const R = sky.getBoundingClientRect(); let moving = false;
      fams.forEach((f, i) => {
        const s = st[i], cx = R.left + R.width * parseFloat(f.style.getPropertyValue('--x')) / 100, cy = R.top + R.height * parseFloat(f.style.getPropertyValue('--y')) / 100;
        const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy), fall = on && !f.classList.contains('is-f') ? Math.max(0, 1 - d / 260) : 0;
        const tx = d ? dx / d * 14 * fall * fall : 0, ty = d ? dy / d * 14 * fall * fall : 0;
        s.vx += ((tx - s.x) * 60 - s.vx * 11) * dt; s.vy += ((ty - s.y) * 60 - s.vy * 11) * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        f.style.setProperty('--fx', s.x.toFixed(2) + 'px'); f.style.setProperty('--fy', s.y.toFixed(2) + 'px');
        f.style.setProperty('--near', fall.toFixed(3));
        if (Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(tx - s.x) + Math.abs(ty - s.y) > 0.05) moving = true;
      });
      raf = moving || on ? requestAnimationFrame(step) : 0; if (!raf) last = 0;
    }
    if (!reduced && matchMedia('(pointer:fine)').matches) {
      sky.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; on = true; if (!raf) raf = requestAnimationFrame(step); });
      sky.addEventListener('pointerleave', () => { on = false; if (!raf) raf = requestAnimationFrame(step); });
    }
    return () => { cancelAnimationFrame(raf); mo.disconnect(); };
  };
})();
