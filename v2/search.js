// Portage JS de src/lib/search/parse-query.ts (dépôt marcheDG) — même logique :
// produit (nom/alias exact → faute légère → mots partiels = candidats), quantité + unité, lieu, intention.
// Ce qui n'est pas reconnu reste null et part dans `rest`. On ne devine pas.
(function () {
  const { products, regions, producers } = window.MDG;
  const normalizeText = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase();
  const stem = n => (n.length > 3 && /[sx]$/.test(n) ? n.slice(0, -1) : n);
  const STOP = new Set('de d du des la le les l un une en a au aux et pour sur vers pres dans avec par ou'.split(' '));

  function tokenize(text) {
    const raw = [...text.matchAll(/[\p{L}\p{M}]+|\d+(?:[.,]\d+)?/gu)].map(m => ({ surface: m[0], index: m.index }));
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      let surface = raw[i].surface;
      if (/^\d{1,3}$/.test(surface)) {
        let end = raw[i].index + surface.length;
        while (i + 1 < raw.length && /^\d{3}$/.test(raw[i + 1].surface) && text.slice(end, raw[i + 1].index) === ' ') { surface += ' ' + raw[i + 1].surface; end = raw[i + 1].index + raw[i + 1].surface.length; i++; }
      }
      const norm = normalizeText(surface), isNum = /^\d/.test(surface);
      out.push({ surface, norm, stem: isNum ? norm : stem(norm), num: isNum ? Number(surface.replace(/ /g, '').replace(',', '.')) : null });
    }
    return out;
  }
  const termKey = s => tokenize(s).filter(t => !STOP.has(t.norm)).map(t => t.stem);
  function editDistance(a, b) {
    let prev2 = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur.push(v);
      }
      prev2 = prev; prev = cur;
    }
    return prev[b.length];
  }
  const maxTypos = len => (len < 5 ? 0 : len <= 8 ? 1 : 2);

  const UNITS = [
    ['kg', 'kg', 'kg kgs kilo kilos kilogramme kilogrammes'], ['g', 'g', 'gramme grammes', 'g gr'], ['tonne', 'tonne', 'tonne tonnes', 't'],
    ['sac', 'sac', 'sac sacs'], ['sachet', 'sachet', 'sachet sachets'], ['carton', 'carton', 'carton cartons'], ['plateau', 'plateau', 'plateau plateaux alveole alveoles'],
    ['regime', 'régime', 'regime regimes'], ['tas', 'tas', 'tas'], ['litre', 'litre', 'litre litres lt', 'l'], ['bidon', 'bidon', 'bidon bidons'], ['seau', 'seau', 'seau seaux'],
    ['panier', 'panier', 'panier paniers'], ['cuvette', 'cuvette', 'cuvette cuvettes bassine bassines'], ['botte', 'botte', 'botte bottes'], ['caisse', 'caisse', 'caisse caisses'],
    ['piece', 'pièce', 'piece pieces'], ['tete', 'tête', 'tete tetes'], ['douzaine', 'douzaine', 'douzaine douzaines'], ['filet', 'filet', 'filet filets'], ['boite', 'boîte', 'boite boites'],
  ].map(([code, label, w, s]) => ({ code, label, words: w.split(' '), short: s ? s.split(' ') : [] }));
  const U_STEM = new Map(), U_SHORT = new Map();
  UNITS.forEach(u => { u.words.forEach(w => U_STEM.set(stem(w), u)); u.short.forEach(w => U_SHORT.set(w, u)); });
  const NUMW = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100, mille: 1000 };
  const INTENTS = [
    ['acheter', ['acheter', 'achete', 'achat', 'j achete', 'cherche', 'je cherche', 'recherche', 'besoin', 'j ai besoin', 'il me faut', 'veux', 'je veux', 'commande', 'commander']],
    ['vendre', ['vendre', 'vends', 'je vends', 'vente', 'a vendre', 'j ai', 'je propose', 'propose']],
    ['prix', ['prix', 'combien', 'tarif', 'cout']],
  ].flatMap(([intent, ps]) => ps.map(p => ({ intent, words: p.split(' ') }))).sort((a, b) => b.words.length - a.words.length);

  // Index
  const terms = [];
  products.forEach(p => {
    const seen = new Set();
    const add = (surface, via) => { const key = termKey(surface), k = key.join(' '); if (!k || seen.has(k)) return; seen.add(k); terms.push({ product: p, surface, via, key, words: tokenize(surface).map(t => t.norm).filter(w => !STOP.has(w)) }); };
    add(p.name, 'nom');
    const short = p.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim(); if (short !== p.name) add(short, 'nom');
    p.aliases.forEach(a => add(a, 'alias'));
  });
  const exact = new Map(); terms.forEach(t => { const k = t.key.join(' '); exact.set(k, [...(exact.get(k) || []), t]); });
  const cities = new Map(); producers.forEach(p => { if (!cities.has(p.city)) cities.set(p.city, p.regionSlug); });
  const places = [...cities].map(([name, regionSlug]) => ({ name, kind: 'ville', regionSlug, key: termKey(name) }))
    .concat(regions.map(r => ({ name: r.name, kind: 'region', regionSlug: r.slug, key: termKey(r.name) })));
  const regionName = new Map(regions.map(r => [r.slug, r.name]));
  const order = new Map(products.map((p, i) => [p.slug, i]));
  const rankTerm = t => (t.via === 'nom' ? 0 : 1000) + t.key.length * 10;
  const toHit = (t, match) => ({ slug: t.product.slug, name: t.product.name, categorySlug: t.product.categorySlug, matchedTerm: t.surface, via: t.via, match });
  function dedupe(ts, match) {
    const best = new Map();
    ts.forEach(t => { const c = best.get(t.product.slug); if (!c || rankTerm(t) < rankTerm(c)) best.set(t.product.slug, t); });
    return [...best.values()].sort((a, b) => rankTerm(a) - rankTerm(b) || order.get(a.product.slug) - order.get(b.product.slug)).map(t => toHit(t, match));
  }
  const freeContent = (tk, used) => tk.map((_, i) => i).filter(i => !used[i] && !STOP.has(tk[i].norm));

  function findPlace(tk, used) {
    const free = freeContent(tk, used).filter(i => tk[i].num === null);
    const maxLen = Math.max(0, ...places.map(p => p.key.length));
    for (let len = Math.min(maxLen, free.length); len >= 1; len--) for (let s = 0; s + len <= free.length; s++) {
      const span = free.slice(s, s + len), text = span.map(i => tk[i].stem).join(' ');
      const f = places.find(p => p.key.join(' ') === text) || places.find(p => { const k = p.key.join(' '); return p.key.length === len && editDistance(k, text) <= maxTypos(k.length); });
      if (f) { span.forEach(i => (used[i] = true)); return { name: f.name, kind: f.kind, regionSlug: f.regionSlug, regionName: regionName.get(f.regionSlug), city: f.kind === 'ville' ? f.name : null }; }
    }
    return null;
  }
  function findIntent(tk, used) {
    for (let i = 0; i < tk.length; i++) for (const { intent, words } of INTENTS) {
      if (words.every((w, k) => tk[i + k] && !used[i + k] && tk[i + k].norm === w)) { words.forEach((_, k) => (used[i + k] = true)); return intent; }
    }
    return null;
  }
  function findProduct(tk, used) {
    const free = freeContent(tk, used).filter(i => tk[i].num === null);
    const none = { product: null, candidates: [], span: [] };
    if (!free.length) return none;
    const decide = (hits, span) => ({ product: hits.length === 1 ? hits[0] : null, candidates: hits, span });
    for (let len = free.length; len >= 1; len--) {
      for (let s = 0; s + len <= free.length; s++) { const span = free.slice(s, s + len), e = exact.get(span.map(i => tk[i].stem).join(' ')); if (e) return decide(dedupe(e, 'exact'), span); }
      for (let s = 0; s + len <= free.length; s++) {
        const span = free.slice(s, s + len), text = span.map(i => tk[i].stem).join(' '), tol = maxTypos(text.length);
        if (!tol) continue;
        let bd = Infinity, best = [];
        terms.forEach(t => { if (t.key.length !== len) return; const d = editDistance(t.key.join(' '), text); if (d > tol || d > bd) return; if (d < bd) { bd = d; best = []; } best.push(t); });
        if (best.length) return decide(dedupe(best, 'approche'), span);
      }
    }
    for (let len = free.length; len >= 1; len--) for (let s = 0; s + len <= free.length; s++) {
      const span = free.slice(s, s + len), words = span.map(i => tk[i].stem);
      if (words.some(w => w.length < 3)) continue;
      const hits = terms.filter(t => words.includes(t.key[0]) && words.every(w => t.key.includes(w)));
      if (hits.length) return { product: null, candidates: dedupe(hits, 'partiel'), span };
    }
    return none;
  }
  const unitOf = (t, afterNum) => t && (U_STEM.get(t.stem) || (afterNum ? U_SHORT.get(t.norm) : undefined));
  function findQuantity(tk, used) {
    for (let i = 0; i < tk.length - 1; i++) {
      const v = tk[i].num ?? NUMW[tk[i].norm] ?? null, u = unitOf(tk[i + 1], true);
      if (v !== null && u && !used[i] && !used[i + 1]) { used[i] = used[i + 1] = true; return { quantity: v, unit: { code: u.code, label: u.label, text: tk[i + 1].surface } }; }
    }
    const i = tk.findIndex((t, k) => t.num !== null && !used[k]);
    if (i >= 0) { used[i] = true; return { quantity: tk[i].num, unit: null }; }
    return { quantity: null, unit: null };
  }
  function findBareUnit(tk, used) { const i = tk.findIndex((t, k) => !used[k] && unitOf(t, false)); if (i < 0) return null; used[i] = true; const u = unitOf(tk[i], false); return { code: u.code, label: u.label, text: tk[i].surface }; }
  function restText(tk, used) {
    const drop = [...used]; let ch = true;
    while (ch) { ch = false; tk.forEach((t, i) => { if (drop[i] || !STOP.has(t.norm)) return; if (i === 0 || drop[i - 1] || i === tk.length - 1 || drop[i + 1]) { drop[i] = true; ch = true; } }); }
    return tk.filter((_, i) => !drop[i]).map(t => t.surface).join(' ');
  }
  function parse(text) {
    const tk = tokenize(text), used = tk.map(() => false);
    const { quantity, unit: uq } = findQuantity(tk, used);
    const intent = findIntent(tk, used), location = findPlace(tk, used);
    const { product, candidates, span } = findProduct(tk, used);
    span.forEach(i => (used[i] = true));
    const unit = uq || findBareUnit(tk, used);
    return { raw: text, product, candidates, productText: span.length ? tk.slice(span[0], span[span.length - 1] + 1).map(t => t.surface).join(' ') : null, quantity, unit, location, intent, rest: restText(tk, used) };
  }
  function prefixPos(q, words) {
    const last = q.length - 1;
    for (let k = 0; k + q.length <= words.length; k++) if (q.every((w, j) => stem(words[k + j]) === stem(w) || (j === last && words[k + j].startsWith(w)))) return k;
    return -1;
  }
  function suggest(prefix, limit = 6) {
    const toks = tokenize(prefix).map(t => t.norm), content = toks.filter(w => !STOP.has(w));
    if (!content.length) return [];
    const readings = [content], tail = toks[toks.length - 1];
    if (STOP.has(tail) && !/[^\p{L}\p{N}]$/u.test(prefix)) readings.push([...content, tail]);
    const best = new Map();
    terms.forEach(t => {
      let pos = -1; readings.forEach(r => { const p = prefixPos(r, t.words); if (p >= 0 && (pos < 0 || p < pos)) pos = p; });
      if (pos < 0) return;
      const score = (pos === 0 ? 0 : 2) + (t.via === 'alias' ? 1 : 0), c = best.get(t.product.slug);
      if (!c || score < c.score) best.set(t.product.slug, { term: t, score });
    });
    return [...best.values()].sort((a, b) => a.score - b.score || a.term.product.name.length - b.term.product.name.length || a.term.product.name.localeCompare(b.term.product.name, 'fr'))
      .slice(0, limit).map(({ term }) => ({ slug: term.product.slug, name: term.product.name, categorySlug: term.product.categorySlug, matchedAlias: term.via === 'alias' ? term.surface : null }));
  }
  function km(a, b) { const R = 6371, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); }
  window.MDG.search = { parse, suggest, normalizeText, km };
})();
