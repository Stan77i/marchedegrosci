/* ═════════ V3 — VENDRE : l'offre se construit sous vos yeux ═════════
   Une question à la fois. À droite, l'étiquette telle que l'acheteur la lira,
   puis les demandes qui correspondent au produit saisi (comme le panneau « J'ai »).
   ?p=slug préremplit le produit (lien depuis « J'ai »). */
(function () {
  'use strict';
  const V3 = window.MDGV3; if (!V3) return;
  const UF = { tonne: 1000, sac: 50, cageot: 25, 'régime': 15, tas: 3, 'alvéole': 1.8 };
  const STEPS = [['Le produit', 'Que vendez-vous ?'], ['Le lieu', 'Où est la marchandise ?'], ['Le prix', 'À quel prix, et quand ?'], ['Le contact', 'Comment l’acheteur vous joint ?']];

  V3.vendre = function (view, qs) {
    const C = window.MDGCTX, { M, OFFERS, prodBy, prBy, regBy, esc, fmt, plural, reduced, S, UNITS, store, toast, regCenter, demandsOf, previewCard } = C;
    const L = C.LIGHT; if (L && (L.fam || L.source === 'recherche')) L.off();
    const famIdx = Object.fromEntries(M.categories.map((c, i) => [c.slug, i]));
    const famCol = slug => V3.FAMC[famIdx[slug] % V3.FAMC.length];
    const prodIdx = Object.fromEntries(M.products.map((p, i) => [p.slug, i]));
    const DK = 'mdg-v2:brouillon-offre';

    view.innerHTML = `<div class="v3v">
  ${V3.head('vendre', { label: 'Vendre — en-tête', kicker: 'Vendre', title: 'Dites ce que vous avez. Les acheteurs vous écrivent.', sub: 'Quatre questions. L’étiquette se remplit à droite, telle que l’acheteur la lira.' })}
  <section class="vs" id="vs" data-tone="dark" aria-label="Votre offre">
    <div class="vs-panel" id="vbox">
      <form id="vform" data-s="0" novalidate>
        <div class="vs-top"><p class="vs-k">Votre offre</p>
          <div class="vs-who" role="group" aria-label="Qui publie ?"><button type="button" class="vs-o sm" data-w="moi" aria-pressed="true">Je vends</button><button type="button" class="vs-o sm" data-w="agent" aria-pressed="false">Pour un producteur</button></div></div>
        <ol class="vs-steps" aria-label="Étapes">${STEPS.map(([l], i) => `<li><button type="button" data-t="${i}"><i></i><span>${l}</span></button></li>`).join('')}</ol>
        <fieldset class="vs-st" data-s="0"><legend class="vs-q">${STEPS[0][1]}</legend>
          <div class="vs-f full"><label for="vP" class="sr">Produit</label><input class="vs-in xl" id="vP" autocomplete="off" placeholder="Poisson fumé, djoumblé, aloco…"><div class="vs-sug" id="vPs"></div></div>
          <div class="vs-f"><label for="vQ">Quantité</label><input class="vs-in" id="vQ" inputmode="decimal" placeholder="2 000"></div>
          <div class="vs-f"><label for="vU">Unité</label><select class="vs-in" id="vU">${UNITS.map(u => `<option>${u}</option>`).join('')}</select></div>
          <label class="vs-ph full" for="vF"><span class="vs-phc" id="vFc"><svg class="ico" aria-hidden="true"><use href="#i-camera"/></svg></span><span><b id="vFt">Ajouter une photo</b> <i>facultatif</i><small>Nette, en pleine lumière. Elle est réduite automatiquement.</small></span><input type="file" id="vF" accept="image/*" capture="environment" class="sr"></label>
        </fieldset>
        <fieldset class="vs-st" data-s="1"><legend class="vs-q">${STEPS[1][1]}</legend>
          <div class="vs-f full"><label for="vR">Région</label><select class="vs-in" id="vR"><option value="">Choisissez une région</option>${M.regions.map(r => `<option value="${r.slug}">${esc(r.name)}</option>`).join('')}</select></div>
          <div class="vs-f full"><label for="vC">Ville ou village</label><input class="vs-in" id="vC" list="vCl" placeholder="Ex. Bouaké"><datalist id="vCl"></datalist></div>
        </fieldset>
        <fieldset class="vs-st" data-s="2"><legend class="vs-q">${STEPS[2][1]}</legend>
          <div class="vs-f full"><label for="vPr">Prix vendeur par <span id="vPu">kg</span> (FCFA) <i>facultatif</i></label><input class="vs-in xl" id="vPr" inputmode="numeric" placeholder="Vide = prix à discuter"></div>
          <div class="vs-f full"><span class="vs-l">Disponibilité</span><div class="vs-sug" id="vA" role="group" aria-label="Disponibilité"></div></div>
          <div class="vs-f full" id="vAd" hidden><label for="vAdi">Disponible à partir du</label><input class="vs-in" type="date" id="vAdi"></div>
        </fieldset>
        <fieldset class="vs-st" data-s="3"><legend class="vs-q">${STEPS[3][1]}</legend>
          <div class="vs-f full" id="vAgN" hidden><label for="vAgNi">Votre nom (agent terrain)</label><input class="vs-in" id="vAgNi" autocomplete="name"></div>
          <div class="vs-f full"><label for="vN" id="vNl">Votre nom</label><input class="vs-in" id="vN" autocomplete="name"></div>
          <div class="vs-f full"><label for="vT" id="vTl">Téléphone WhatsApp</label><input class="vs-in" id="vT" type="tel" inputmode="tel" autocomplete="tel" placeholder="07 01 02 03 04"></div>
        </fieldset>
        <p class="vs-err" id="vE" role="alert"></p>
        <div class="vs-nav"><button type="button" class="btn btn-secondary" id="vB">Retour</button><span class="vs-dr" id="vDr" aria-live="polite"></span><button type="button" class="btn btn-primary" id="vN2">Suivant <svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button><button type="submit" class="btn btn-primary" id="vS">Publier l’offre <svg class="ico" aria-hidden="true"><use href="#i-arrow"/></svg></button></div>
        <p class="vs-local"><svg class="ico" aria-hidden="true"><use href="#i-phone-off"/></svg>Enregistrée sur cet appareil pour l’instant : l’envoi aux autres utilisateurs arrive avec le serveur.</p>
      </form>
    </div>
    <aside class="vs-side" aria-label="Aperçu de l’offre"><p class="vs-k">Ce que l’acheteur verra</p><div class="vs-tag" id="vsTag"></div><p class="vs-hint" id="vsHint" aria-live="polite"></p><div class="vs-dm" id="vsDm" hidden></div></aside>
  </section>
  <section class="vm" id="vm" data-tone="dark" hidden aria-labelledby="vmT"><div class="wrap"><h2 class="vm-t" id="vmT">Mes offres</h2><div class="vm-l" id="mineO"></div><p class="vm-n">Gardées sur ce téléphone, 12 au maximum.</p></div></section>
</div>`;
    const $ = (s, r = view) => r.querySelector(s), $$ = (s, r = view) => [...r.querySelectorAll(s)];
    const stage = $('#vs'), tag = $('#vsTag'), hintEl = $('#vsHint');
    let prod = null, photo = null, avail = 'maintenant', agent = false, s = 0, done = false, api = null, alive = true, dT = 0;
    const vp = $('#vP'), val = id => $(id).value;
    const qNum = () => +val('#vQ').replace(/\s/g, '').replace(',', '.') || 0;
    const nameOf = () => prod ? prod.name : vp.value.trim();
    const grains = () => { if (nameOf().length < 2) return 0; const q = qNum(); return q ? Math.round(110 + 2300 * Math.min(1, Math.log10(q * (UF[val('#vU')] || 1) + 1) / 5)) : 110; };
    const meXY = () => { const r = val('#vR'), c = val('#vC').trim().toLowerCase(); const pr = c && M.producers.find(x => x.city.toLowerCase() === c); return pr ? [pr.latitude, pr.longitude] : r ? regCenter(r) : null; };
    const dems = () => prod ? demandsOf(prod.slug) : [];
    const lc = t => esc(t.toLowerCase());

    /* ——— ce que l'acheteur lira, posé au-dessus du tas ——— */
    function tagHTML() {
      const name = nameOf(); if (name.length < 2) return '';
      const q = qNum(), pr = val('#vPr').replace(/\s/g, ''), r = val('#vR'), city = val('#vC').trim(), u = esc(val('#vU'));
      const miss = t => `<em>${t}</em>`;
      const where = [city, r && regBy[r].name].filter(Boolean).map(esc).join(' · ');
      const when = avail === 'date' && val('#vAdi') ? 'À partir du ' + new Date(val('#vAdi')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : s >= 2 || done ? 'Disponible maintenant' : '';
      return `<b>${esc(name)}</b><span class="r">${q ? `${fmt(q)} ${u}` : miss('quantité')}<i></i>${/^\d+$/.test(pr) ? `${fmt(+pr)} F/${u}` : s >= 2 || done ? 'Prix à discuter' : miss('prix')}</span><small>${where || miss('lieu')}</small>${when ? `<small>${when}</small>` : ''}`;
    }
    function hint() {
      const name = nameOf(), nd = dems().length;
      if (done) return nd ? `<b>Votre offre est posée.</b> ${plural(nd, 'acheteur cherche', 'acheteurs cherchent')} ${lc(name)} : ils peuvent vous écrire.` : `<b>Votre offre est posée.</b> Aucune demande pour ${lc(name)} en ce moment.`;
      if (s === 0) return name.length < 2 ? 'Écrivez votre produit : <b>l’étiquette se remplit</b> au fil de la saisie.' : qNum() ? 'Bien. Ensuite : <b>où se trouve la marchandise</b>.' : 'Indiquez la quantité disponible.';
      if (s === 1) { if (!meXY()) return 'Choisissez la région et la ville.'; if (!prod) return 'Les acheteurs de la région verront votre offre.'; const n = new Set(OFFERS.filter(o => o.productSlug === prod.slug).map(o => o.producerId)).size; return n ? `En clair : ${plural(n, 'autre producteur propose', 'autres producteurs proposent')} ${lc(prod.name)}.` : `Personne ne propose encore ${lc(prod.name)} : <b>vous serez le premier</b>.`; }
      if (s === 2) return 'Cette étiquette, <b>c’est ce que l’acheteur lira</b>.';
      return prod ? (nd ? `<b>${plural(nd, 'acheteur cherche', 'acheteurs cherchent')}</b> ${lc(prod.name)}. Ils vous écriront sur WhatsApp.` : `Aucune demande pour ${lc(prod.name)} en ce moment. L’acheteur vous écrira sur WhatsApp.`) : 'L’acheteur vous écrit directement sur WhatsApp.';
    }
    // demandes correspondantes, pendant la saisie (comme « J'ai »)
    let lastDm = '';
    function demList() {
      const el = $('#vsDm'), list = dems(), K = prod ? prod.slug + ':' + list.length : '';
      if (K === lastDm) return; lastDm = K;
      if (!prod || !list.length) { el.hidden = true; el.innerHTML = ''; return; }
      const MK = window.MDGMarche, I = MK.ICO;
      const ct = (ph, txt) => { const t = MK.tel(ph); return t ? `<span class="vs-dm-ct"><a href="tel:+225${t}">Appeler</a><a href="https://wa.me/225${t}?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener">WhatsApp</a></span>` : ''; };
      el.innerHTML = `<p class="vs-k">${list.length > 1 ? list.length + ' demandes correspondent' : '1 demande correspond'}</p><ul>${list.slice(0, 3).map(d => `<li><i class="vs-dm-i">${I.demande}</i><span><b>${fmt(d.quantity)} ${esc(d.unit)}</b><small>${esc(d.city || (regBy[d.regionSlug] || {}).name || '')}${d.mine ? ' · votre demande' : ''}</small></span>${d.mine ? '' : ct(d.phone, 'Bonjour, j’ai du ' + prod.name.toLowerCase() + ' pour votre demande sur Marché de Gros.')}</li>`).join('')}</ul>`;
      el.hidden = false;
    }
    let lastHint = '';
    function sync(save = true) {
      const th = tagHTML(); tag.innerHTML = th; tag.classList.toggle('on', !!th); demList();
      const h = hint(); if (h !== lastHint) { lastHint = h; hintEl.innerHTML = h; if (!reduced) hintEl.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
      $('#vPu') && ($('#vPu').textContent = val('#vU'));
      if (false) { const xy = meXY(); api.set({ col: prod ? famCol(prod.categorySlug) : '#B9AD98', n: grains(), pos: xy ? V3.proj(xy[0], xy[1]) : null, step: done ? 4 : s, prod: prod ? prodIdx[prod.slug] : -1, threads: (s >= 3 || done) && xy ? dems().map(d => V3.proj(d.latitude, d.longitude)) : [] }); }
      if (!save || done) return;
      clearTimeout(dT); dT = setTimeout(() => { try { localStorage.setItem(DK, JSON.stringify(draft())); $('#vDr').textContent = 'Brouillon gardé sur ce téléphone'; } catch (_) {} }, 400);
    }
    const draft = () => ({ p: vp.value, q: val('#vQ'), u: val('#vU'), pr: val('#vPr'), r: val('#vR'), c: val('#vC'), a: avail, ad: val('#vAdi'), ag: agent, agn: val('#vAgNi'), n: val('#vN'), t: val('#vT') });

    /* ——— champs ——— */
    const readP = () => {
      const r = S.parse(vp.value); prod = r.product ? prodBy[r.product.slug] : null;
      $('#vPs').innerHTML = (prod ? `<span class="vs-ok" style="--fc:${famCol(prod.categorySlug)}"><i></i>${esc(prod.name)}</span>` : '') + S.suggest(vp.value, 4).filter(x => !prod || x.slug !== prod.slug).map(x => `<button type="button" class="vs-o sm" data-n="${esc(x.name)}">${esc(x.name)}</button>`).join('');
      $$('[data-n]', $('#vPs')).forEach(b => b.onclick = () => { vp.value = b.dataset.n; readP(); sync(); });
    };
    vp.addEventListener('input', readP);
    const cities = () => { const r = val('#vR'); $('#vCl').innerHTML = [...new Set(M.producers.filter(p => !r || p.regionSlug === r).map(p => p.city))].sort((a, b) => a.localeCompare(b, 'fr')).map(c => `<option value="${esc(c)}">`).join(''); };
    $('#vR').addEventListener('change', cities);
    const paintAvail = () => { const el = $('#vA'); el.innerHTML = [['maintenant', 'Maintenant'], ['date', 'À partir d’une date']].map(([v, l]) => `<button type="button" class="vs-o" aria-pressed="${v === avail}" data-v="${v}">${l}</button>`).join(''); $('#vAd').hidden = avail !== 'date'; };
    $('#vA').onclick = e => { const b = e.target.closest('.vs-o'); if (!b) return; avail = b.dataset.v; paintAvail(); sync(); };
    const setAgent = a => { agent = a; $$('.vs-who .vs-o').forEach(b => b.setAttribute('aria-pressed', (b.dataset.w === 'agent') === a)); $('#vAgN').hidden = !a; $('#vNl').textContent = a ? 'Nom du producteur' : 'Votre nom'; $('#vTl').textContent = a ? 'Téléphone WhatsApp du producteur' : 'Téléphone WhatsApp'; };
    $$('.vs-who .vs-o').forEach(b => b.onclick = () => { setAgent(b.dataset.w === 'agent'); sync(); });
    $('#vform').addEventListener('input', () => sync()); $('#vform').addEventListener('change', () => sync());
    $('#vF').onchange = e => {
      const f = e.target.files[0]; if (!f) return; $('#vFt').textContent = 'Réduction de la photo…';
      const im = new Image(); im.onload = () => { const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); photo = c.toDataURL('image/webp', .72); $('#vFc').innerHTML = `<img src="${photo}" alt="Photo de l’offre">`; $('#vFt').textContent = `Photo prête · ${Math.round(photo.length * .75 / 1024)} Ko`; URL.revokeObjectURL(im.src); };
      im.onerror = () => { $('#vFt').textContent = 'Photo illisible. Essayez une autre (JPEG ou PNG).'; };
      im.src = URL.createObjectURL(f);
    };

    /* ——— étapes ——— */
    const errOf = n => {
      if (n === 0) { if (vp.value.trim().length < 2) return 'Écrivez le nom du produit.'; if (!(qNum() > 0)) return 'Indiquez une quantité supérieure à 0 (chiffres uniquement).'; }
      if (n === 1) { if (!val('#vR')) return 'Choisissez une région.'; if (!val('#vC').trim()) return 'Indiquez la ville ou le village.'; }
      if (n === 2) { const pr = val('#vPr').replace(/\s/g, ''); if (pr && !/^\d+$/.test(pr)) return 'Prix invalide : chiffres uniquement.'; if (avail === 'date' && !val('#vAdi')) return 'Choisissez une date.'; }
      if (n === 3) { if (!val('#vN').trim()) return agent ? 'Écrivez le nom du producteur.' : 'Écrivez votre nom.'; if (!window.MDGMarche.tel(val('#vT'))) return 'Numéro ivoirien : 10 chiffres, par exemple 07 01 02 03 04 (+225 facultatif).'; }
      return '';
    };
    function go2(n, focus = true) {
      s = Math.max(0, Math.min(3, n)); $('#vform').dataset.s = s; $('#vE').textContent = '';
      $$('.vs-st').forEach(f => f.classList.toggle('on', +f.dataset.s === s));
      $$('.vs-steps button').forEach(b => { const t = +b.dataset.t; b.classList.toggle('on', t === s); b.classList.toggle('ok', t < s); if (t === s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
      if (focus) { const f = $(`.vs-st[data-s="${s}"] input:not([type=file]), .vs-st[data-s="${s}"] select`); if (f) setTimeout(() => f.focus({ preventScroll: true }), 60); }
      sync(false);
    }
    const tryGo = t => { for (let i = 0; i < t; i++) { const e = errOf(i); if (e) { go2(i); $('#vE').textContent = e; return; } } go2(t); };
    $$('.vs-steps button').forEach(b => b.onclick = () => tryGo(+b.dataset.t));
    $('#vB').onclick = () => go2(s - 1);
    $('#vN2').onclick = () => tryGo(s + 1);
    $('#vform').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input') && s < 3) { e.preventDefault(); tryGo(s + 1); } });
    $('#vform').addEventListener('submit', e => {
      e.preventDefault();
      for (let i = 0; i < 4; i++) { const er = errOf(i); if (er) { go2(i); $('#vE').textContent = er; return; } }
      const reg = val('#vR'), name = val('#vN').trim(), tel = window.MDGMarche.tel(val('#vT')) || '', city = val('#vC').trim(), pr = val('#vPr').replace(/\s/g, '');
      const o = { id: 'loc-' + Date.now(), createdAt: new Date().toISOString(), productSlug: prod ? prod.slug : null, productLabel: nameOf(), productName: nameOf(), quantity: qNum(), unit: val('#vU'), price: /^\d+$/.test(pr) ? +pr : null, regionSlug: reg, regionName: regBy[reg].name, city, availableFrom: avail === 'date' && val('#vAdi') ? val('#vAdi') : 'maintenant', producer: { name, phone: tel }, producerName: name, agent: agent ? { name: val('#vAgNi').trim() || 'Agent' } : null, photo: photo ? { dataUrl: photo } : null };
      if (!store('offres', [o, ...store('offres')].slice(0, 12))) { $('#vE').textContent = 'La mémoire de ce navigateur est pleine. Supprimez une ancienne offre plus bas, puis réessayez.'; return; }
      try { localStorage.removeItem(DK); } catch (_) {}
      try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
      done = true; sync(false);
      $('#vbox').innerHTML = `<div class="vs-done"><p class="vs-k">Offre enregistrée sur ce téléphone</p><h2 class="vs-q">Voici ce que l’acheteur verra.</h2><div class="vs-card">${previewCard(o)}</div><p class="vs-local">Elle apparaît dans Acheter et sur la carte. Enregistrée sur cet appareil pour l’instant : l’envoi aux autres utilisateurs arrive avec le serveur.</p>
        <div class="vs-nav">${agent ? '<button type="button" class="btn btn-primary" id="same">Autre offre pour ce producteur</button>' : ''}<button type="button" class="btn btn-secondary" id="newO">Nouvelle offre</button></div></div>`;
      $('#newO').onclick = () => C.route();
      const sm = $('#same'); if (sm) sm.onclick = () => { try { localStorage.setItem(DK, JSON.stringify({ ag: true, agn: o.agent.name, n: name, t: tel, r: reg, c: city, a: 'maintenant' })); } catch (_) {} C.route(); };
      mineO(); toast('Offre enregistrée sur ce téléphone'); V3.onMarket && V3.onMarket();
    });
    function mineO() {
      const list = store('offres'); $('#vm').hidden = !list.length;
      $('#mineO').innerHTML = list.map(d => `<div class="vm-i"><span><b>${fmt(d.quantity)} ${esc(d.unit)} · ${esc(d.productLabel)}</b><small>${esc(d.city)}, ${esc(d.regionName)}${d.agent ? ' · saisie par l’agent' : ''}</small></span><button type="button" data-del="${d.id}">Supprimer</button></div>`).join('');
      $$('[data-del]', $('#mineO')).forEach(b => b.onclick = () => { store('offres', store('offres').filter(x => x.id !== b.dataset.del)); mineO(); toast('Offre supprimée'); });
    }

    // brouillon
    try { const d = JSON.parse(localStorage.getItem(DK) || 'null'); if (d) { vp.value = d.p || ''; $('#vQ').value = d.q || ''; if (d.u && UNITS.includes(d.u)) $('#vU').value = d.u; $('#vPr').value = d.pr || ''; $('#vR').value = d.r || ''; $('#vC').value = d.c || ''; avail = d.a || 'maintenant'; $('#vAdi').value = d.ad || ''; setAgent(!!d.ag); $('#vAgNi').value = d.agn || ''; $('#vN').value = d.n || ''; $('#vT').value = d.t || ''; if (d.p || d.q) $('#vDr').textContent = 'Brouillon repris'; } } catch (_) {}
    // produit prérempli depuis « J'ai » (#/vendre?p=slug) : prioritaire sur le brouillon
    const pre = qs && qs.get && prodBy[qs.get('p')];
    if (pre) { vp.value = pre.name; const q0 = qs.get('q'); if (q0 && /^\d+$/.test(q0)) $('#vQ').value = q0; $('#vDr').textContent = ''; }
    readP(); cities(); paintAvail(); mineO(); go2(0, false);
    if (pre) setTimeout(() => $('#vQ').focus({ preventScroll: true }), 80);

    const headOff = V3.headBind(view, p => { vp.value = p.name; readP(); go2(0, false); sync(); vp.focus({ preventScroll: true }); const y = $('#vs').getBoundingClientRect().top + scrollY - 90; scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' }); });
    return () => { alive = false; clearTimeout(dT); headOff(); };
  };

})();
