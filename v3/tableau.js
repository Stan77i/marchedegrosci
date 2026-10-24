/* ═════════ Marché de Gros CI — le tableau du marché (onglet « Prix » de l'accueil) ═════════
   Demandé par le propriétaire le 22/10/2026 : la même philosophie que Binance P2P.
   • Onglet « Acheter » : les offres des vendeurs, du MOINS cher au plus cher. Onglet « Vendre » : les demandes des acheteurs,
     du budget le PLUS haut au plus bas. Celui qui baisse son prix (ou monte son budget) remonte tout seul.
   • À prix égal : transport compris d'abord, puis le membre qui a un niveau (schéma 85), l'identité vérifiée, les commandes honorées, le plus récent.
     Le classement est fait par le serveur (supabase/schema-59-tableau-marche.sql : tableau_produits, tableau_marche).
   • On ne compare que des prix dans la même unité (kg, sac, régime…) ; filtre par zone (région).
   • Le seul intermédiaire, c'est le Marché de Gros : aucun numéro, aucun contact. « Acheter » / « Vendre » ouvre la négociation
     dans l'application (connexion demandée si besoin). Lecture publique, sans compte.
   • Couleurs (23/10/2026), comme les boutons « J'ai à vendre » (vert) / « Je cherche » (maïs) : les offres et « Acheter » en vert, les demandes et « Vendre » en maïs.
   • Relu toutes les 30 s quand l'onglet est visible : une annonce qui monte est signalée « ↑ monte ». */
(function () {
  'use strict';
  if (!window.customElements || customElements.get('mdg-tableau')) return;
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0);
  const F = v => nf(v) + ' F';
  const REG = { abidjan: 'Abidjan', yamoussoukro: 'Yamoussoukro', 'bas-sassandra': 'Bas-Sassandra', comoe: 'Comoé', denguele: 'Denguélé', 'goh-djiboua': 'Gôh-Djiboua',
    lacs: 'Lacs', lagunes: 'Lagunes', montagnes: 'Montagnes', 'sassandra-marahoue': 'Sassandra-Marahoué', savanes: 'Savanes', 'vallee-du-bandama': 'Vallée du Bandama',
    woroba: 'Woroba', zanzan: 'Zanzan' };
  const TR_O = { inclus: ['Transport compris', 'v'], hors_ville: ['Transport compris hors de sa ville', 'v'], non: ['Transport à part', ''] };
  const TR_D = { acheteur: ['L’acheteur prend le transport', 'v'], vendeur: ['Le vendeur doit livrer', ''] };
  const pluriel = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const nomProduit = slug => { const p = window.MDG && MDG.products && MDG.products.find(x => x.slug === slug); return p ? p.name : slug; };
  // l'image du produit : le sac détouré quand il existe (comme sur l'orbite de l'accueil), sinon la photo de sa famille ; la teinte vient du produit
  const visuel = slug => {
    const A = window.MDGApp, p = window.MDG && MDG.products && MDG.products.find(x => x.slug === slug), cat = p && p.categorySlug;
    if (A && A.SACK && A.SACK[slug] != null) return { src: (A.IMG || 'v2/img/') + 'produit-' + slug + '.webp', h: A.SACK[slug], sac: true };
    // pas d'image propre à ce produit : son initiale sur la teinte de sa famille (la photo de famille tromperait : des poivrons pour la carotte)
    return { src: null, h: (A && A.FAMHUE && A.FAMHUE[cat]) || 70, sac: false, l: (p ? p.name : slug).charAt(0).toUpperCase() };
  };
  const vignette = (slug, cls) => { const v = visuel(slug); return `<span class="tb-v${v.sac ? '' : ' ini'}${cls ? ' ' + cls : ''}" style="--h:${v.h}" aria-hidden="true">${v.src ? `<img src="${esc(v.src)}" alt="" loading="lazy" decoding="async">` : `<b>${esc(v.l)}</b>`}</span>`; };
  const ilya = t => { const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000)); return m < 60 ? 'il y a ' + (m || 1) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j'; };
  const KS = 'mdg-tableau';
  const lireS = () => { try { return JSON.parse(sessionStorage.getItem(KS)) || {}; } catch (_) { return {}; } };
  const ecrireS = o => { try { sessionStorage.setItem(KS, JSON.stringify(o)); } catch (_) {} };

  const CSS = `
mdg-tableau{display:block;padding:6px 16px 24px;font:400 15px/1.45 Jost,system-ui,sans-serif;color:#171512}
.tb-h{margin:10px 0 2px;font:600 26px/1.15 Jost,sans-serif;letter-spacing:-.01em}.tb-h em{font-style:italic;font-weight:900;color:#10392B}
.tb-s{margin:0 0 12px;color:#5E5546;font-size:14px}
.tb-zone{display:flex;align-items:center;gap:8px;margin:0 0 12px}.tb-zone label{font-size:13px;color:#5E5546}
.tb-zone select{flex:1;min-height:44px;border:1px solid rgba(23,21,18,.18);border-radius:14px;background:#FFFDF8;padding:0 12px;font:500 15px Jost,sans-serif;color:#171512}
.tb-l{display:flex;flex-direction:column;gap:8px;list-style:none;margin:0;padding:0}
.tb-p{display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center;width:100%;padding:12px 14px;border:0;border-radius:18px;background:#FFFDF8;text-align:left;font:inherit;color:inherit;cursor:pointer;box-shadow:0 1px 2px rgba(23,21,18,.05)}
.tb-p b{font-weight:600;font-size:16px}.tb-p small{display:block;font-size:12.5px;color:#5E5546}
.tb-p .px{text-align:right}.tb-p .px b{display:block;color:#10392B;font-size:16px}.tb-p .px small{white-space:nowrap}
.tb-p .px .d b{color:#7A5A00}
.tb-dos{display:inline-flex;align-items:center;gap:6px;min-height:44px;margin:4px 0 6px -6px;padding:0 10px;border:0;border-radius:22px;background:none;color:#10392B;font:600 15px Jost,sans-serif;cursor:pointer}
.tb-seg{display:flex;padding:3px;border-radius:16px;background:rgba(23,21,18,.07);margin:0 0 10px}
.tb-seg button{flex:1;min-height:46px;border:0;border-radius:13px;background:none;color:#4B4436;font:600 15px Jost,sans-serif;cursor:pointer}
.tb-seg button[aria-pressed=true].a{background:#10392B;color:#F3EFE4}.tb-seg button[aria-pressed=true].v{background:#F2C230;color:#171512}.tb-seg button[aria-pressed=true].v .nbul.d{background:#171512;color:#F2C230}
.tb-ch{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -16px 10px;padding:0 16px}.tb-ch::-webkit-scrollbar{display:none}
.tb-ch button{flex:none;min-height:44px;padding:0 14px;border:1px solid rgba(23,21,18,.16);border-radius:19px;background:#FFFDF8;color:#3B342A;font:500 14px Jost,sans-serif;cursor:pointer}
.tb-ch button[aria-pressed=true]{background:#171512;border-color:#171512;color:#FFFDF8}
.tb-r{position:relative;display:grid;grid-template-columns:28px 1fr;gap:10px;padding:14px 12px;border-radius:18px;background:#FFFDF8;box-shadow:0 1px 2px rgba(23,21,18,.05);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.tb-r.top{box-shadow:inset 0 0 0 2px #F2C230}
.tb-rg{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#EFE9DA;color:#4B4436;font:700 13px Jost,sans-serif}.tb-r.top .tb-rg{background:#F2C230;color:#10392B}
.tb-l1{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap}
.tb-prix{font:800 22px/1.1 Jost,sans-serif;color:#10392B}.tb-prix small{font:500 13px Jost,sans-serif;color:#5E5546}.tb-r.vd .tb-prix{color:#7A5A00}
.tb-nom{font-weight:600}.tb-b{display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding:1px 7px;border-radius:10px;font:600 11.5px/1.6 Jost,sans-serif;background:rgba(16,57,43,.1);color:#10392B;vertical-align:1px}
.tb-b.or{background:rgba(242,194,48,.35);color:#4A3700}.tb-b.of{background:#10392B;color:#F2C230}
.tb-i{margin:3px 0 0;font-size:13px;color:#4B4436}.tb-i .x+.x::before{content:' · '}
.tb-t{display:inline-block;margin:6px 6px 0 0;padding:2px 9px;border-radius:10px;background:#EFE9DA;font:500 12.5px Jost,sans-serif;color:#4B4436}.tb-t.v{background:rgba(108,197,140,.22);color:#1F6B40}
.tb-ec{font-size:12.5px;color:#8A2414}.tb-ec.ok{color:#1F6B40;font-weight:600}
.tb-go{grid-column:2;justify-self:start;margin-top:8px;min-height:44px;padding:0 22px;border:0;border-radius:22px;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer}.tb-r.vd .tb-go{background:#F2C230;color:#171512}
.tb-monte{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;background:#1F6B40;color:#fff;font:700 11.5px/1.6 Jost,sans-serif;animation:tbM 2.4s ease-out both}
@keyframes tbM{0%{opacity:0;transform:translateY(6px)}15%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.tb-vide{padding:22px 16px;border-radius:18px;background:#FFFDF8;text-align:center;color:#5E5546}.tb-vide b{display:block;color:#171512;margin-bottom:4px}
.tb-dort{display:grid;justify-items:center;gap:2px;padding:20px 18px 24px;font-size:15px;line-height:1.45}.tb-dort svg{margin-bottom:6px}.tb-dort b{font-size:18px}
.tb-n{margin:14px 2px 0;font-size:12.5px;color:#5E5546}
.tb-charge{height:72px;border-radius:18px;background:linear-gradient(90deg,rgba(128,118,96,.12),rgba(128,118,96,.22),rgba(128,118,96,.12));background-size:200% 100%;animation:tbC 1.2s linear infinite}@keyframes tbC{to{background-position:-200% 0}}
html[data-theme=sombre] mdg-tableau{color:#F3EFE4}
html[data-theme=sombre] .tb-h{color:#F3EFE4}
html[data-theme=sombre] .tb-vide{box-shadow:inset 0 0 0 1px rgba(243,239,228,.1)}html[data-theme=sombre] .tb-vide b{color:#F3EFE4}html[data-theme=sombre] .tb-vide{color:#CFC4B1}
html[data-theme=sombre] .tb-seg{background:#1E1B16;box-shadow:inset 0 0 0 1px rgba(243,239,228,.1)}
html[data-theme=sombre] .tb-seg button{color:#E8DFCC}
html[data-theme=sombre] .tb-seg button[aria-pressed=true].a{background:#9FDCB2;color:#0E2A1F}html[data-theme=sombre] .tb-seg button[aria-pressed=true].v{background:#F2C230;color:#171512}
html[data-theme=sombre] .tb-go{background:#9FDCB2;color:#0E2A1F}html[data-theme=sombre] .tb-r.vd .tb-go{background:#F2C230;color:#171512}
html[data-theme=sombre] .tb-r.vd .tb-prix,html[data-theme=sombre] .tb-p .px .d b{color:#F2C230}
html[data-theme=sombre] .tb-ec{color:#F3A08C}html[data-theme=sombre] .tb-ec.ok{color:#9FDCB2}
html[data-theme=sombre] .tb-b{background:rgba(159,220,178,.16);color:#9FDCB2}html[data-theme=sombre] .tb-b.or{background:rgba(242,194,48,.18);color:#F2C230}html[data-theme=sombre] .tb-b.of{background:#F2C230;color:#171512}
html[data-theme=sombre] .tb-t.v{background:rgba(159,220,178,.16);color:#9FDCB2}
html[data-theme=sombre] .tb-r.top .tb-rg{background:#F2C230;color:#171512}html[data-theme=sombre] .tb-nom{color:#F3EFE4}
html[data-theme=sombre] .tb-charge{background:linear-gradient(90deg,#1E1B16,#2A261F,#1E1B16);background-size:200% 100%}
.tb-attente .tb-l,.tb-attente .tb-vide{opacity:.45;transition:opacity .15s}
html[data-theme=sombre] .tb-p,html[data-theme=sombre] .tb-r,html[data-theme=sombre] .tb-vide,html[data-theme=sombre] .tb-zone select,html[data-theme=sombre] .tb-ch button{background:#1E1B16;color:#F3EFE4;border-color:rgba(243,239,228,.12)}
html[data-theme=sombre] .tb-s,html[data-theme=sombre] .tb-p small,html[data-theme=sombre] .tb-i,html[data-theme=sombre] .tb-n,html[data-theme=sombre] .tb-zone label,html[data-theme=sombre] .tb-prix small{color:#CFC4B1}
html[data-theme=sombre] .tb-h em,html[data-theme=sombre] .tb-dos{color:#F2C230}html[data-theme=sombre] .tb-prix,html[data-theme=sombre] .tb-p .px b{color:#9FDCB2}
html[data-theme=sombre] .tb-rg,html[data-theme=sombre] .tb-t{background:#2A261F;color:#E8DFCC}html[data-theme=sombre] .tb-ch button[aria-pressed=true]{background:#F3EFE4;color:#171512}
@media (prefers-reduced-motion:reduce){.tb-r,.tb-monte,.tb-charge{animation:none!important;transition:none!important}}
/* la liste des produits : la vignette du produit (le sac sort de sa tuile), le nom, le meilleur prix ; elle s'installe en cascade */
.tb-l.tb-pl{gap:10px}
.tb-p{grid-template-columns:64px minmax(0,1fr) auto;gap:4px 14px;min-height:84px;padding:10px 16px 10px 10px;border-radius:22px;transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .2s}
.tb-p:active{transform:scale(.985)}
.tb-p:focus-visible{outline:2px solid #10392B;outline-offset:2px}html[data-theme=sombre] .tb-p:focus-visible{outline-color:#F2C230}
.tb-v{position:relative;display:block;width:64px;height:64px;border-radius:20px;background:radial-gradient(120% 90% at 50% 100%,oklch(.9 .07 var(--h)) 0%,oklch(.965 .025 var(--h)) 70%)}
.tb-v img{position:absolute;left:50%;bottom:3px;width:74px;height:74px;margin-left:-37px;object-fit:contain;filter:drop-shadow(0 6px 6px rgba(23,21,18,.22));transition:transform .35s cubic-bezier(.22,1.4,.36,1)}
.tb-v.ini{display:grid;place-items:center}.tb-v.ini b{font:900 italic 30px/1 Jost,sans-serif;color:oklch(.42 .09 var(--h));letter-spacing:-.02em}

html[data-theme=sombre] .tb-v.ini b{color:oklch(.86 .08 var(--h))}
.tb-p:hover .tb-v img,.tb-p:active .tb-v img{transform:translateY(-4px) scale(1.06) rotate(-2deg)}
.tb-p .tb-tx b{display:block;font:600 17px/1.2 Jost,sans-serif;letter-spacing:-.005em}.tb-p .tb-tx small{margin-top:3px}
/* le nombre d'offres / de demandes : une pastille avec le panier (offre) ou le caddie (demande), demandé le 23/10/2026 */
.tb-pils{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.tb-pil{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:0 10px 0 5px;border-radius:999px;font:700 13.5px/1 Jost,sans-serif;font-variant-numeric:tabular-nums}
.tb-pil i{width:20px;height:20px;flex:none;background:var(--sym-o) center/contain no-repeat}.tb-pil.d i{background-image:var(--sym-d-jour,var(--sym-d))}
.tb-pil.o{background:#6CC58C;color:#0E3323}.tb-pil.d{background:#F2C230;color:#171512}
@keyframes tbPil{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}@media (prefers-reduced-motion:reduce){.tb-pil{animation:none}}
.tb-p .px b{font:700 17px/1.2 Jost,sans-serif;font-variant-numeric:tabular-nums}.tb-p .px small{margin-top:2px}
.tb-p .px>span+span{margin-top:6px}.tb-p .px>span{display:block}
@keyframes tbIn{from{opacity:0;transform:translateY(14px)}}
@keyframes tbSac{from{opacity:0;transform:translateY(10px) scale(.7) rotate(-8deg)}}
.tb-hd{display:flex;align-items:center;gap:14px;margin:6px 0 4px}.tb-hd .tb-h{margin:0;flex:1;min-width:0}
.tb-hd .tb-v{width:72px;height:72px;border-radius:22px;flex:none}.tb-hd .tb-v img{width:84px;height:84px;margin-left:-42px}
html[data-theme=sombre] .tb-v{background:radial-gradient(120% 90% at 50% 100%,oklch(.4 .08 var(--h)) 0%,oklch(.27 .035 var(--h)) 72%)}
html[data-theme=sombre] .tb-v img{filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))}
@media (prefers-reduced-motion:reduce){.tb-pl.anim>li,.tb-pl.anim .tb-v img,.tb-hd .tb-v img{animation:none!important}.tb-v img{transition:none}}`;

  class Tableau extends HTMLElement {
    connectedCallback() {
      if (!document.getElementById('tbCss')) { const s = document.createElement('style'); s.id = 'tbCss'; s.textContent = CSS; document.head.appendChild(s); }
      const m = lireS();
      this.st = { slug: m.slug || null, sens: m.sens || 'acheter', unite: m.unite || null, region: m.region || '', produits: null, data: null, rangs: {}, monte: {} };
      this.peindre(); this.charger();
      this._t = setInterval(() => { if (!document.hidden && this.offsetParent !== null) this.charger(true); }, 30000);
      this._v = () => { if (!document.hidden && this.offsetParent !== null) this.charger(true); };
      document.addEventListener('visibilitychange', this._v);
      this._r = () => this.charger(); addEventListener('online', this._r); addEventListener('mdg:reessayer', this._r);
      // l'onglet devient visible : on relit (au plus une fois toutes les 10 s)
      this._o = new IntersectionObserver(e => { if (e.some(x => x.isIntersecting) && Date.now() - (this._lu || 0) > 10000) this.charger(true); });
      this._o.observe(this);
    }
    disconnectedCallback() { clearInterval(this._t); document.removeEventListener('visibilitychange', this._v); removeEventListener('online', this._r); removeEventListener('mdg:reessayer', this._r); if (this._o) this._o.disconnect(); }
    memo() { const s = this.st; ecrireS({ slug: s.slug, sens: s.sens, unite: s.unite, region: s.region }); }
    async charger(discret) {
      const n = N(); if (!n || !n.rpc) { setTimeout(() => this.charger(discret), 600); return; }
      const s = this.st, region = s.region || null; this._lu = Date.now();
      try {
        if (s.slug) {
          const d = await n.rpc('tableau_marche', { p_slug: s.slug, p_region: region }, false);
          // repérer qui monte : on compare le rang d'avant (même onglet, même unité)
          const avant = s.rangs, apres = {}, monte = {};
          ['offres', 'demandes'].forEach(k => { const parU = {}; (d && d[k] || []).forEach(x => { const u = x.unite || ''; parU[u] = (parU[u] || 0) + 1; const cle = k + ':' + x.id; apres[cle] = parU[u]; if (discret && avant[cle] && parU[u] < avant[cle]) monte[cle] = 1; }); });
          if (!discret && !s.sensChoisi && d) { const no = (d.offres || []).length, nd = (d.demandes || []).length; if (s.sens === 'acheter' && !no && nd) s.sens = 'vendre'; else if (s.sens === 'vendre' && !nd && no) s.sens = 'acheter'; }
          s.data = d; s.rangs = apres; s.monte = monte;
        } else s.produits = (await n.rpc('tableau_produits', { p_region: region }, false)) || [];
        s.err = null;
        if (window.MDGSac && MDGSac.reseau) MDGSac.reseau(true);
      } catch (e) {
        const hors = navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET/i.test(String((e && e.message) || e || ''));
        if (hors && window.MDGSac && MDGSac.reseau) MDGSac.reseau(false);
        if (!discret || (hors && !(s.slug ? s.data : s.produits))) s.err = hors ? 'hors' : 'Le tableau ne se charge pas pour l’instant. Réessayez dans un moment.';
      }
      this.peindre();
    }
    // hors connexion (choix B) : le bandeau rouge est en haut de l'écran (app/sac.js) ; ici, une carte calme avec le sac qui dort
    erreur() {
      const s = this.st;
      if (s.err !== 'hors') return `<div class="tb-vide"><b>Le tableau ne répond pas</b>${esc(s.err)}</div>`;
      return `<div class="tb-vide tb-dort" role="status">${window.MDGSac ? MDGSac.svg('ferme', { t: 80 }) : ''}<b>Le tableau dort un peu</b>Il se met à jour tout seul dès que le réseau revient.</div>`;
    }
    choixZone() {
      return `<div class="tb-zone"><label for="tbZ">Zone</label><select id="tbZ" data-zone>
        <option value="">Toute la Côte d’Ivoire</option>${Object.keys(REG).map(k => `<option value="${k}"${this.st.region === k ? ' selected' : ''}>${esc(REG[k])}</option>`).join('')}</select></div>`;
    }
    peindre() {
      const s = this.st;
      if (s.slug) return this.peindreProduit();
      const P = s.produits;
      // la cascade ne se joue qu'à la première apparition de la liste (ou après un changement de zone), pas à chaque relecture de 30 s
      const cle = 'l:' + (s.region || ''), anim = !!(P && P.length) && this._anim !== cle; if (anim) this._anim = cle;
      this.poser(`<h2 class="tb-h">Le tableau du <em>marché</em></h2>
        <p class="tb-s">Les meilleurs prix du moment. Pour acheter, le moins cher est en haut ; pour vendre, le meilleur budget est en haut. Baissez votre prix : vous montez.</p>
        ${this.choixZone()}
        ${s.err ? this.erreur() : !P ? '<div class="tb-l"><div class="tb-charge"></div><div class="tb-charge"></div><div class="tb-charge"></div></div>'
          : !P.length ? `<div class="tb-vide"><b>Aucune annonce${s.region ? ' dans cette zone' : ''} pour l’instant</b>Publiez la première avec « J’ai » ou « Je cherche » sur l’onglet Marché.</div>`
          : `<ul class="tb-l tb-pl${anim ? ' anim' : ''}">${P.map((p, i) => `<li style="--i:${Math.min(i, 10)}"><button type="button" class="tb-p" data-slug="${esc(p.slug)}" aria-label="${esc(p.lab || nomProduit(p.slug))} : voir le tableau">
              ${vignette(p.slug)}<span class="tb-tx"><b>${esc(p.lab || nomProduit(p.slug))}</b><span class="tb-pils">${(p.n_offres ? `<span class="tb-pil o"><i aria-hidden="true"></i>${nf(p.n_offres)} offre${p.n_offres > 1 ? 's' : ''}</span>` : '') + (p.n_demandes ? `<span class="tb-pil d"><i aria-hidden="true"></i>${nf(p.n_demandes)} demande${p.n_demandes > 1 ? 's' : ''}</span>` : '') || '<small>Aucune annonce</small>'}</span></span>
              <span class="px">${p.meilleure_offre != null ? `<span><b>dès ${F(p.meilleure_offre)}</b><small>le ${esc(p.unite_offre || 'kg')} · pour acheter</small></span>` : ''}
                ${p.meilleure_demande != null ? `<span class="d"><b>jusqu’à ${F(p.meilleure_demande)}</b><small>le ${esc(p.unite_demande || 'kg')} · pour vendre</small></span>` : ''}</span></button></li>`).join('')}</ul>`}
        <p class="tb-n">Le Marché de Gros est le seul intermédiaire : aucun numéro n’est affiché, tout se négocie dans l’application.</p>`);
      this.lier();
    }
    peindreProduit() {
      const s = this.st, d = s.data, lab = (d && d.lab) || nomProduit(s.slug), ach = s.sens === 'acheter';
      const tous = d ? (ach ? d.offres : d.demandes) || [] : null;
      const unites = tous ? [...new Set(tous.map(x => x.unite || ''))] : [];
      // vrais totaux par unité envoyés par le serveur (schéma 70 : au plus 50 annonces par unité dans la liste) ; sinon on compte la liste
      const tot = d && d.totaux, totK = tot && tot[ach ? 'offres' : 'demandes'];
      const somme = o => Object.keys(o || {}).reduce((t, k) => t + (+o[k] || 0), 0);
      const parU = u => totK ? (+totK[u] || 0) : (tous || []).filter(x => (x.unite || '') === u).length;
      unites.sort((a, b) => parU(b) - parU(a));
      if (tous && (!s.unite || !unites.includes(s.unite))) s.unite = unites[0] || null;
      const L = (tous || []).filter(x => (x.unite || '') === (s.unite || ''));
      const meilleur = L.length && L[0].prix != null ? +L[0].prix : null;
      const no = d ? (tot ? somme(tot.offres) : (d.offres || []).length) : 0, nd = d ? (tot ? somme(tot.demandes) : (d.demandes || []).length) : 0;
      const coupe = L.length && parU(s.unite || '') > L.length;
      const ligne = (x, i) => {
        const T = ach ? TR_O[x.transport] : TR_D[x.transport], cle = (ach ? 'offres:' : 'demandes:') + x.id;
        const ec = meilleur && x.prix != null && i > 0 && +x.prix !== meilleur ? Math.round(Math.abs(+x.prix - meilleur) / meilleur * 100) : 0;
        const badges = (x.officiel ? '<span class="tb-b of">Officiel</span>' : '') + (x.verifie ? '<span class="tb-b" title="Identité vérifiée par l’équipe">✓ vérifié</span>' : '') + (x.niveau ? '<span class="tb-b or">' + esc(x.niveau) + '</span>' : x.fiable ? '<span class="tb-b or">★ fiable</span>' : '');
        const lieu = [x.ville, x.region && REG[x.region]].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(', ');
        return `<li class="tb-r${i === 0 && x.prix != null ? ' top' : ''}${ach ? '' : ' vd'}">
          <span class="tb-rg" aria-label="Rang ${i + 1}">${i + 1}</span>
          <div>
            <div class="tb-l1"><span class="tb-prix">${x.prix != null ? F(x.prix) : 'Prix à discuter'}<small>${x.prix != null ? ' / ' + esc(x.unite || 'unité') : ''}</small></span>
              <span>${i === 0 && x.prix != null ? `<span class="tb-ec ok">${ach ? 'Meilleur prix' : 'Meilleur budget'}</span>` : ec ? `<span class="tb-ec">${ach ? '+' : '−'}${ec} % ${ach ? 'plus cher' : 'en dessous'}</span>` : ''}${s.monte[cle] ? '<span class="tb-monte">↑ monte</span>' : ''}</span></div>
            <p class="tb-i"><span class="tb-nom">${esc(x.nom)}</span>${badges}</p>
            <p class="tb-i">${x.quantite ? `<span class="x">${nf(x.quantite, 2)} ${esc(pluriel(x.quantite, x.unite))} ${ach ? 'disponible' : 'recherché'}${x.quantite > 1 ? 's' : ''}</span>` : ''}${x.qte_min ? `<span class="x">min. ${nf(x.qte_min, 2)}</span>` : ''}${lieu ? `<span class="x">${esc(lieu)}</span>` : ''}<span class="x">${ilya(x.le)}</span></p>
            <p class="tb-i">${x.terminees ? `<span class="x">${nf(x.terminees)} commande${x.terminees > 1 ? 's' : ''} honorée${x.terminees > 1 ? 's' : ''}</span>` : '<span class="x">Nouveau sur le marché</span>'}${x.note != null ? `<span class="x">★ ${nf(x.note, 1)}/5</span>` : ''}</p>
            ${T ? `<span class="tb-t ${T[1]}">${T[0]}</span>` : ''}${x.negociable === false ? '<span class="tb-t">Prix ferme</span>' : '<span class="tb-t">Négociable</span>'}
          </div>
          <button type="button" class="tb-go" data-go="${esc(x.id)}">${ach ? 'Acheter' : 'Vendre'}</button></li>`;
      };
      this.poser(`<button type="button" class="tb-dos" data-dos>${window.MDGIco ? '<span class="ic-t" aria-hidden="true">' + MDGIco.svg('retour', 17, 2) + '</span>' : '‹ '}Tous les produits</button>
        <div class="tb-hd"><h2 class="tb-h">${esc(lab)}</h2>${vignette(s.slug)}</div>
        <p class="tb-s">${ach ? 'Les vendeurs, du moins cher au plus cher. À prix égal, le transport compris passe devant.' : 'Les acheteurs, du meilleur budget au plus bas. Vous avez ce produit ? Vendez au meilleur prix.'}</p>
        <div class="tb-seg" role="group" aria-label="Je veux"><button type="button" class="a" data-sens="acheter" aria-pressed="${ach}">Acheter<span class="nbul o">${nf(no)}</span></button><button type="button" class="v" data-sens="vendre" aria-pressed="${!ach}">Vendre<span class="nbul d">${nf(nd)}</span></button></div>
        ${this.choixZone()}
        ${unites.length > 1 ? `<div class="tb-ch" role="group" aria-label="Unité">${unites.map(u => `<button type="button" data-u="${esc(u)}" aria-pressed="${u === s.unite}">Prix par ${esc(u || 'unité')}<span class="nbul">${nf(parU(u))}</span></button>`).join('')}</div>` : ''}
        ${s.err ? this.erreur() : !d ? '<div class="tb-l"><div class="tb-charge"></div><div class="tb-charge"></div></div>'
          : !L.length ? `<div class="tb-vide"><b>${ach ? 'Aucune offre' : 'Aucune demande'}${s.region ? ' dans cette zone' : ''} pour l’instant</b>${ach ? 'Publiez une demande avec « Je cherche » : les vendeurs seront prévenus.' : 'Publiez votre offre avec « J’ai » : les acheteurs seront prévenus.'}</div>`
          : `<ul class="tb-l">${L.map(ligne).join('')}</ul>${coupe ? `<p class="tb-n tb-coupe">Les ${L.length} meilleures sur ${nf(parU(s.unite || ''))}. Choisissez une zone pour affiner.</p>` : ''}`}
        <p class="tb-n">Comment c’est classé : le prix d’abord (dans la même unité), puis le transport, la fiabilité, l’identité vérifiée et les commandes honorées. Mis à jour toutes les 30 secondes. Aucun numéro affiché : vous négociez dans l’application, le Marché de Gros est le seul intermédiaire.</p>`);
      this.lier();
    }
    // relecture toutes les 30 s : seul ce qui a changé est retouché (app/stable.js), les photos ne clignotent plus pendant qu'on fait défiler
    poser(html) { if (window.MDGStable && MDGStable.poser) MDGStable.poser(this, html); else this.innerHTML = html; }
    lier() {
      const s = this.st;
      const z = this.querySelector('[data-zone]'); if (z) z.onchange = async () => { s.region = z.value; s.rangs = {}; this.memo(); this.classList.add('tb-attente'); await this.charger(); this.classList.remove('tb-attente'); };
      this.querySelectorAll('[data-slug]').forEach(b => b.onclick = () => { s.slug = b.dataset.slug; s.data = null; s.sensChoisi = false; s.unite = null; s.rangs = {}; this.memo(); this.peindre(); this.charger(); this.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
      const dos = this.querySelector('[data-dos]'); if (dos) dos.onclick = () => { this._anim = null; s.slug = null; s.data = null; this.memo(); this.peindre(); this.charger(); };
      this.querySelectorAll('[data-sens]').forEach(b => b.onclick = () => { s.sens = b.dataset.sens; s.sensChoisi = true; s.unite = null; this.memo(); this.peindre(); });
      this.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { s.unite = b.dataset.u; this.memo(); this.peindre(); });
      this.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
        const ach = s.sens === 'acheter', x = ((s.data || {})[ach ? 'offres' : 'demandes'] || []).find(y => y.id === b.dataset.go); if (!x) return;
        if (!window.MDGNegoce) { if (N() && N().toast) N().toast('Un instant : l’application se prépare.'); return; }
        MDGNegoce.proposer({ cible: ach ? 'offre' : 'demande', id: x.id, transport: x.transport || '', produit: (s.data && s.data.lab) || nomProduit(s.slug),
          prix: x.prix, unite: x.unite, quantite: x.quantite || null, qmin: ach ? x.qte_min || null : null, ville: x.ville || '', nom: x.nom, negociable: x.negociable !== false });
      });
    }
  }
  customElements.define('mdg-tableau', Tableau);
  window.MDGTableau = { ouvrir(slug) { const el = document.querySelector('mdg-tableau'); if (el && el.st) { el.st.slug = slug || null; el.st.data = null; el.memo(); el.peindre(); el.charger(); } } };
})();
