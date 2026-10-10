/* ═════════ V3 — En-tête commun des pages Acheter · Vendre · Demander ═════════
   V3.head(kind, o) → HTML ; V3.headBind(root, onUse) → halo au curseur + action « Depuis l'étal ». */
(function () {
  'use strict';
  const V3 = window.MDGV3 = window.MDGV3 || {};
  const FLOW = [['acheter', '#/catalogue', 'Acheter', 'Ce qui est disponible'], ['vendre', '#/vendre', 'Vendre', 'Ce que vous avez'], ['demander', '#/demande', 'Demander', 'Ce qu’il vous faut']];
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ACT = {
    acheter: n => n ? (n > 1 ? 'Voir les ' + n + ' offres' : 'Voir l’offre') : 'Personne n’en vend : le demander',
    vendre: () => 'J’en vends aussi',
    demander: () => 'J’en cherche'
  };
  V3.head = function (kind, o) {
    const C = window.MDGCTX, { esc, fmt, img, prodBy, catBy, OFFERS, M, demandsOf } = C, L = C.LIGHT;
    const p = L && L.slug && prodBy[L.slug];
    const nO = p ? OFFERS.filter(x => x.productSlug === p.slug).length : OFFERS.length;
    const nD = p ? demandsOf(p.slug).length : (M.demands || []).length;
    const im = p && img(p.slug);
    const flow = FLOW.map(([k, h, t, s], i) => (i ? '<span class="pg-fil" aria-hidden="true"><em></em></span>' : '')
      + '<a class="pg-node' + (k === kind ? ' on' : '') + '" href="' + h + '"' + (k === kind ? ' aria-current="page"' : '') + '><i aria-hidden="true">' + (k === kind ? '<span class="pg-dot"></span>' : '') + '</i><span><b>' + t + '</b><small>' + s + '</small></span></a>').join('');
    const ctx = p
      ? '<p class="pg-ck">Depuis l’étal<a href="#/">Changer de produit</a></p><div class="pg-cp">' + (im ? '<img src="' + im + '" alt="">' : '<span class="pg-ci" aria-hidden="true">' + esc(p.name.charAt(0)) + '</span>')
        + '<div><b>' + esc(p.name) + '</b><small>' + esc(catBy[p.categorySlug].name) + '</small></div></div>' + window.MDGMarche.prixHTML(p.slug, { short: true })
      : '<p class="pg-ck">Le marché, maintenant<a href="#/">Choisir un produit</a></p>';
    const link = !nO && !nD ? '' : '<div class="pg-link" aria-label="' + nO + ' offres, ' + nD + ' demandes"><span><b>' + nO + '</b>' + (nO > 1 ? 'offres' : 'offre') + '</span><i class="pg-wire" aria-hidden="true"><em></em><em></em></i><span><b>' + nD + '</b>' + (nD > 1 ? 'demandes' : 'demande') + '</span></div>';
    const act = p && ACT[kind] ? '<button type="button" class="pg-use" data-use="' + p.slug + '">' + ACT[kind](nO) + ARROW + '</button>' : '';
    void fmt;
    return '<section class="pg" data-tone="dark" data-k="' + kind + '" data-screen-label="' + esc(o.label || kind) + '"><div class="pg-in">'
      + '<nav class="pg-flow" aria-label="Le marché en direct">' + flow + '</nav>'
      + '<div class="pg-main"><div class="pg-copy"><p class="pg-k">' + o.kicker + '</p><h1 class="pg-t">' + o.title + '</h1>' + (o.sub ? '<p class="pg-s">' + o.sub + '</p>' : '') + (o.extra || '') + '</div>'
      + '<aside class="pg-ctx" aria-label="Le produit regardé">' + ctx + link + act + '</aside></div></div><span class="pg-seam" aria-hidden="true"></span></section>';
  };
  V3.headBind = function (root, onUse) {
    const el = root.querySelector('.pg'); if (!el) return () => {};
    const mv = e => { const r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left) + 'px'); el.style.setProperty('--my', (e.clientY - r.top) + 'px'); };
    el.addEventListener('pointermove', mv, { passive: true });
    const b = el.querySelector('.pg-use'); if (b && onUse) b.onclick = () => onUse(window.MDGCTX.prodBy[b.dataset.use]);
    return () => el.removeEventListener('pointermove', mv);
  };

  /* état neutre : jamais une page vide — un message court et l'action « J'ai / Je cherche » */
  V3.nst = function (o) {
    const I = window.MDGMarche.ICO, esc = window.MDGCTX.esc;
    const a = o.slug
      ? '<button type="button" class="nst-b nst-b--jai" data-match="jai" data-slug="' + o.slug + '">' + I.offre + 'J’ai ce produit</button><button type="button" class="nst-b nst-b--ch" data-match="cherche" data-slug="' + o.slug + '">' + I.demande + 'Je le cherche</button>'
      : '<a class="nst-b nst-b--jai" href="#/vendre">' + I.offre + 'J’ai une offre</a><a class="nst-b nst-b--ch" href="#/demande">' + I.demande + 'Je cherche une offre</a>';
    return '<div class="nst" role="status"><span class="nst-i" aria-hidden="true">' + I.match + '</span><h3>' + esc(o.title) + '</h3>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') + (o.actions === false ? '' : '<div class="nst-a">' + a + '</div>') + '</div>';
  };

  /* Prix du marché : observer le marché (PHILOSOPHIE § 22) — rien n'est calculé sous le seuil */
  V3.prixPage = function (view) {
    const C = window.MDGCTX, MK = window.MDGMarche, { M, OFFERS, esc, img } = C, S = MK.SEUIL;
    const rows = M.categories.map(c => ({ c, ps: M.products.filter(p => p.categorySlug === c.slug).map(p => ({ p, P: MK.prix(p.slug) })) })).filter(g => g.ps.length);
    const nObs = rows.reduce((a, g) => a + g.ps.filter(x => x.P.type === 'observe').length, 0), nDec = rows.reduce((a, g) => a + g.ps.filter(x => x.P.type === 'vendeur').length, 0);
    view.innerHTML = '<div class="v3p">' + V3.head('prix', { label: 'Prix du marché — en-tête', kicker: 'Prix du marché', title: 'Ce que coûte le marché, quand on peut le savoir.', sub: 'Un prix du marché n’apparaît qu’avec au moins ' + S.obs + ' prix vendeurs venant de ' + S.vendeurs + ' vendeurs différents sur ' + S.jours + ' jours. Avant, il n’y a que des prix vendeurs, présentés comme tels.' })
      + '<section class="pp" data-tone="dark"><div class="pp-in">'
      + '<div class="pp-leg"><span><i class="pp-ic pp-ic--obs">' + MK.ICO.observe + '</i><b>Prix observé</b>calculé sur plusieurs vendeurs</span><span><i class="pp-ic pp-ic--decl">' + MK.ICO.vendeur + '</i><b>Prix vendeur</b>fixé par un seul vendeur</span><span><i class="pp-ic">' + MK.ICO.vide + '</i><b>Pas assez de données</b>aucun prix calculé</span></div>'
      + (!nObs && !nDec ? V3.nst({ title: 'Données en cours de constitution', text: 'Aucun prix n’a encore été publié. Chaque offre avec un prix vendeur rapproche le premier prix observé du marché.' }) : '')
      + rows.map(g => '<details class="pp-f"' + (g.ps.some(x => x.P.type !== 'aucun') ? ' open' : '') + '><summary><b>' + esc(g.c.name) + '</b><span>' + g.ps.length + ' produits</span></summary><ul>'
        + g.ps.map(({ p, P }) => '<li><a href="#/produits/' + p.slug + '"><span class="pp-p">' + (img(p.slug) ? '<img src="' + img(p.slug) + '" alt="" loading="lazy">' : '<i>' + esc(p.name.charAt(0)) + '</i>') + esc(p.name) + '</span>'
          + (P.type === 'observe' ? '<span class="pp-v pp-v--obs">' + MK.ICO.observe + Math.round(P.min) + '–' + Math.round(P.max) + ' F/' + esc(P.unit) + '<small>' + P.n + ' obs.</small></span>'
            : P.type === 'vendeur' ? '<span class="pp-v pp-v--decl">' + MK.ICO.vendeur + Math.round(P.offre.price) + ' F/' + esc(P.offre.unit) + '<small>prix vendeur</small></span>'
            : '<span class="pp-v">' + MK.ICO.vide + '<small>Pas assez de données</small></span>') + '</a></li>').join('') + '</ul></details>').join('')
      + '</div></section></div>';
    void OFFERS;
    return V3.headBind(view);
  };
})();
