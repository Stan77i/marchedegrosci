/* ═════════ Marché de Gros CI — les boutiques des vendeurs (chantier 4, décisions 34 à 44 du 24/10/2026) ═════════
   Une page par vendeur, ouverte par lui d'un geste : son nom (pseudo, ou prénom et initiale), ses preuves (identité vérifiée,
   niveau, fiabilité, ventes réalisées), et toutes ses offres avec leur état (disponible, stock faible, en pause, épuisé).
   Adresse : le pseudo s'il existe, sinon un code court ; lien partagé = page d'aperçu du site (site/boutiques/<adresse>/),
   qui renvoie vers l'application (#/boutique/<adresse>). Serveur : supabase/schema-86-boutiques.sql.
   API : MDGBoutique.ouvrir(adresse, { offre, source, support }) · gerer() · adresseDe(uid) → Promise<adresse|null>
         · connue(uid) · chercher(texte) → [{ adresse, nom }] · lien(adresse, support, offre) */
(function () {
  'use strict';
  if (window.MDGBoutique) return;
  const N = () => window.MDGNuage, A = () => window.MDGApp;
  const SITE = 'https://stan77i.github.io/marchedegrosci/';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const auth = () => !!(N() && N().session());
  const fmt = n => A() ? A().fmt(n) : String(Math.round(n));
  const unites = (q, u) => A() ? A().unites(q, u) : u;
  const nb = (n, c) => `<span class="nbul${c ? ' ' + c : ''}">${fmt(n)}</span>`;
  const ICO = n => window.MDGIco ? MDGIco.svg(n, 20) : '';
  const SVG = (p, t = 20) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const I_QR = SVG('<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>');
  const I_LIEN = SVG('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');
  const I_RETOUR = SVG('<path d="m15 18-6-6 6-6"/>', 22);
  const ETATS = { disponible: ['Disponible', 'ok'], stock_faible: ['Stock faible', 'faible'], pause: ['En pause', 'pause'], epuise: ['Épuisé', 'epuise'] };

  // ——— adresses ———
  const de = n => (/^[aeiouyàâäéèêëîïôöûùü]/i.test(String(n || '')) ? 'd’' : 'de ') + n;   // « Boutique d’Awa », « Boutique de Koffi »
  const propre = a => String(a || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);
  function lien(adr, support, offre) {
    const q = new URLSearchParams(); if (offre) q.set('o', offre); q.set('utm_source', 'boutique'); q.set('utm_medium', support || 'lien');
    return SITE + 'site/boutiques/' + encodeURIComponent(propre(adr)) + '/?' + q;
  }
  const court = adr => 'stan77i.github.io/…/boutiques/' + propre(adr);   // l'adresse lisible : le bout qui compte reste visible

  // uid → adresse des boutiques ouvertes (par lots, une requête pour tout ce qui est affiché)
  const adr = {}, noms = {}, attente = new Set(); let tA = 0;
  function charger(uids) {
    (uids || []).forEach(u => { if (u && !(u in adr)) attente.add(u); });
    if (!attente.size || !N()) return; clearTimeout(tA);
    tA = setTimeout(async () => { const ids = [...attente].slice(0, 200); ids.forEach(u => { attente.delete(u); adr[u] = adr[u] || null; });
      try { const r = await N().rpc('boutiques_de', { ids }, auth()); (r || []).forEach(x => { adr[x.user_id] = x.adresse; }); dispatchEvent(new CustomEvent('mdg:boutiques')); } catch (_) {} }, 80);
  }
  const connue = uid => { if (!uid) return null; if (!(uid in adr)) charger([uid]); return adr[uid] || null; };
  function adresseDe(uid) {
    if (!uid) return Promise.resolve(null);
    if (adr[uid] !== undefined && !attente.has(uid)) return Promise.resolve(adr[uid]);
    return new Promise(ok => { const f = () => { if (adr[uid] !== undefined && !attente.has(uid)) { removeEventListener('mdg:boutiques', f); ok(adr[uid]); } };
      addEventListener('mdg:boutiques', f); charger([uid]); setTimeout(() => { removeEventListener('mdg:boutiques', f); ok(adr[uid] || null); }, 6000); });
  }
  // recherche : les vendeurs dont le nom ressemble au texte et qui ont une boutique ouverte (annonces déjà connues sur ce téléphone)
  function chercher(t) {
    const L = N() && N().list ? N().list('offres') : [], q = (A() ? A().norm(t) : String(t).toLowerCase()).trim(); if (q.length < 2) return [];
    const vus = new Set(), r = []; charger([...new Set(L.map(x => x._uid).filter(Boolean))].slice(0, 200));
    L.forEach(x => { const u = x._uid, nom = x.producerName || ''; if (!u || vus.has(u)) return; vus.add(u); noms[u] = nom;
      if (adr[u] && ((A() ? A().norm(nom) : nom.toLowerCase()).split(/\s+/).some(w => w.startsWith(q)) || propre(adr[u]).startsWith(propre(q)))) r.push({ adresse: adr[u], nom }); });
    return r.slice(0, 3);
  }

  // ——— mesure (schéma 86 : une fois par visiteur et par jour, jamais qui ; le vendeur ne compte pas ses propres visites) ———
  const mesurer = (a, ev, o) => { try { if (localStorage.getItem('mdg-site:admin') === '1') return; } catch (_) {}
    N() && N().rpc('boutique_mesurer', { p_adresse: propre(a), p_evenement: ev, p_source: (o && o.source) || null, p_support: (o && o.support) || null, p_offre: (o && o.offre) || null }, auth()).catch(() => {}); };

  // ——— styles (clair et sombre ; seule la page glisse, le contenu est là tout de suite) ———
  const STYLE = `.bq-bg{position:fixed;inset:0;z-index:9200;display:flex;justify-content:center;background:rgba(10,9,7,.45)}
.bq{position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:100%;background:#F2EBDD;color:#171512;font:400 15px/1.45 Jost,system-ui,sans-serif;animation:bqIn .28s cubic-bezier(.22,1,.36,1) both;overflow:hidden}
@keyframes bqIn{from{transform:translateX(36px);opacity:.6}}
.bq-h{display:flex;align-items:center;gap:4px;height:56px;padding:env(safe-area-inset-top) 8px 0;flex:none}
.bq-h b{flex:1;min-width:0;font:600 17px Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-ib{flex:none;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:inherit;display:grid;place-items:center;cursor:pointer}
.bq-ib:active{background:rgba(23,21,18,.08)}.bq-ib[hidden]{display:none}
.bq-c{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:4px 16px calc(28px + env(safe-area-inset-bottom))}
.bq-id{display:grid;grid-template-columns:64px 1fr;gap:14px;align-items:center;margin:4px 0 14px}
.bq-av{width:64px;height:64px;border-radius:20px;overflow:hidden;background:#FAF4E9;box-shadow:0 0 0 1px rgba(23,21,18,.08)}.bq-av img{display:block;width:100%;height:100%}
.bq-id h1{margin:0;font:700 23px/1.15 Jost,sans-serif;letter-spacing:-.015em;display:flex;align-items:center;gap:6px;min-width:0}
.bq-id h1 span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-id p{margin:3px 0 0;color:#655C4D;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-pr{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 6px}
.bq-pi{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:30px;padding:0 12px;border-radius:999px;background:#FAF4E9;box-shadow:inset 0 0 0 1px rgba(23,21,18,.1);color:#2A251E;font:500 13.5px Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-pi.niv{background:#10392B;box-shadow:none;color:#F3EFE4}
.bq-pi .nbul{margin-left:0}
.bq-org{margin:0 0 6px;color:#484236;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-gere{display:flex;gap:8px;margin:12px 0 4px}
.bq-gere button{flex:1;min-width:0;min-height:48px;padding:0 14px;border:0;border-radius:999px;font:600 15px Jost,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-gere .p{background:#10392B;color:#F3EFE4}.bq-gere .s{background:#FAF4E9;color:#171512;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.2)}
.bq-t{display:flex;align-items:center;margin:20px 0 10px;font:600 17px Jost,sans-serif}
.bq-l{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.bq-p{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:12px;border-radius:16px;background:#FAF4E9;box-shadow:0 1px 2px rgba(23,21,18,.05)}
.bq-p.vise{animation:bqVise 1.6s ease-out 1 both}
@keyframes bqVise{0%,35%{box-shadow:0 0 0 3px #F2C230}100%{box-shadow:0 1px 2px rgba(23,21,18,.05)}}
.bq-im{width:64px;height:64px;border-radius:12px;object-fit:contain;background:#F2EBDD}
.bq-im.ph{display:grid;place-items:center;font:700 24px Jost,sans-serif;color:#484236}
.bq-p[data-etat=epuise] .bq-im,.bq-p[data-etat=pause] .bq-im{opacity:.55}
.bq-pt{min-width:0;display:flex;flex-direction:column;gap:2px}
.bq-l1{display:flex;align-items:center;gap:8px;min-width:0}.bq-l1 b{min-width:0;font:600 16px Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-e{flex:none;max-width:52%;padding:3px 9px;border-radius:999px;font:600 12px/1.3 Jost,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-e.ok{background:#DDF0E3;color:#22492F}.bq-e.faible{background:#F8E7B0;color:#5E4600}.bq-e.pause{background:#E6DFD2;color:#3D372D}.bq-e.epuise{background:#F3D9D2;color:#7A2414}
.bq-pt small{color:#655C4D;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-l3{display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:8px;margin-top:6px;min-width:0}
.bq-px{flex:1 0 auto;font:600 15px Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;white-space:nowrap}
.bq-neg{flex:none;min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#10392B;color:#F3EFE4;font:600 14.5px Jost,sans-serif;cursor:pointer}
.bq-pt .bq-ib{width:44px;height:44px;margin:-6px 0;color:#484236}
.bq-vide{padding:28px 8px;text-align:center;color:#484236}.bq-vide b{display:block;margin-bottom:4px;color:#171512;font-size:17px}
.bq-vide button{margin-top:14px;min-height:46px;padding:0 20px;border:0;border-radius:999px;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer}
.bq-note{margin:18px 2px 0;color:#655C4D;font-size:13px}
.bq :focus-visible,.bqg :focus-visible{outline:3px solid #10392B;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.bq{animation:none}.bq-p.vise{animation:none;box-shadow:0 0 0 3px #F2C230}}
html[data-theme=sombre] .bq{background:#14120F;color:#F3EFE4}
html[data-theme=sombre] .bq-ib:active{background:rgba(243,239,228,.1)}
html[data-theme=sombre] .bq-p,html[data-theme=sombre] .bq-av,html[data-theme=sombre] .bq-pi{background:#1F1B16;box-shadow:inset 0 0 0 1px rgba(243,239,228,.1)}
html[data-theme=sombre] .bq-pi{color:#ECE4D4}html[data-theme=sombre] .bq-pi.niv{background:#F2C230;color:#171512;box-shadow:none}
html[data-theme=sombre] .bq-id p,html[data-theme=sombre] .bq-pt small,html[data-theme=sombre] .bq-note,html[data-theme=sombre] .bq-org{color:#BFB39E}
html[data-theme=sombre] .bq-im{background:#25211B}html[data-theme=sombre] .bq-im.ph{color:#DDD3C2}
html[data-theme=sombre] .bq-neg,html[data-theme=sombre] .bq-gere .p,html[data-theme=sombre] .bq-vide button{background:#F2C230;color:#171512}
html[data-theme=sombre] .bq-gere .s{background:#1F1B16;color:#F3EFE4;box-shadow:inset 0 0 0 1.5px rgba(243,239,228,.25)}
html[data-theme=sombre] .bq-pt .bq-ib{color:#DDD3C2}
html[data-theme=sombre] .bq .rp-et-f>svg g{fill:rgba(243,239,228,.28)}
html[data-theme=sombre] .bq-vide{color:#DDD3C2}html[data-theme=sombre] .bq-vide b{color:#F3EFE4}
html[data-theme=sombre] .bq-e.ok{background:#1E3A28;color:#BFE6CB}html[data-theme=sombre] .bq-e.faible{background:#3E3110;color:#F6DB8A}
html[data-theme=sombre] .bq-e.pause{background:#2E2922;color:#DDD3C2}html[data-theme=sombre] .bq-e.epuise{background:#3D1E17;color:#F2B8A8}
html[data-theme=sombre] .bq :focus-visible,html[data-theme=sombre] .bqg :focus-visible{outline-color:#F2C230}
.bqg-bg{position:fixed;inset:0;z-index:9300;display:flex;align-items:flex-end;justify-content:center;background:rgba(10,9,7,.55)}
@media (min-width:720px){.bqg-bg{align-items:center;padding:24px}}
.bqg{position:relative;width:100%;max-width:520px;max-height:min(92dvh,860px);overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:22px 18px calc(22px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:#F4EEE3;color:#171512;font:400 15px/1.45 Jost,system-ui,sans-serif;animation:bqUp .32s cubic-bezier(.22,1,.36,1) both}
@media (min-width:720px){.bqg{border-radius:28px}}
@keyframes bqUp{from{transform:translateY(40px)}}
.bqg h2{margin:0 52px 4px 0;font:600 23px/1.15 Jost,sans-serif;letter-spacing:-.015em;display:flex;align-items:center;gap:8px}
.bqg>p{margin:0 0 14px;color:#655C4D;font-size:14.5px}
.bqg-x{position:absolute;right:14px;top:14px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:inherit;cursor:pointer}
.bqg-x::before,.bqg-x::after{content:"";position:absolute;left:50%;top:50%;width:15px;height:2px;border-radius:2px;background:currentColor;transform:translate(-50%,-50%) rotate(45deg)}.bqg-x::after{transform:translate(-50%,-50%) rotate(-45deg)}
.bqg-on{padding:3px 10px;border-radius:999px;background:#DDF0E3;color:#22492F;font:600 12.5px Jost,sans-serif}
.bqg-adr{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 6px 0 14px;border-radius:16px;background:#FFFDF8;box-shadow:inset 0 0 0 1px rgba(23,21,18,.12)}
.bqg-adr span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#484236;font-size:14px}
.bqg-go{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:12px;border:0;border-radius:999px;background:#10392B;color:#F3EFE4;font:700 16px Jost,sans-serif;cursor:pointer}
.bqg-duo{display:flex;gap:8px;margin-top:8px}
.bqg-duo button{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 12px;border:0;border-radius:999px;background:#FAF4E9;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.2);color:#171512;font:600 14.5px Jost,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bqg-qr{display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center;margin:16px 0 0;padding:12px;border-radius:18px;background:#FFFDF8}
.bqg-qr div{width:96px;height:96px}.bqg-qr svg{display:block;width:100%;height:100%}
.bqg-qr p{margin:0;color:#484236;font-size:14px}
.bqg-st{margin:18px 0 0;display:grid;gap:2px}
.bqg-st h3{margin:0 0 6px;font:600 15px Jost,sans-serif}
.bqg-li{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:40px;font-size:14.5px}
.bqg-li span:first-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bqg-ln{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 4px;border:0;border-top:1px solid rgba(23,21,18,.1);background:none;color:inherit;font:500 15.5px Jost,sans-serif;text-align:left;cursor:pointer}
.bqg-ln span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bqg-ln.bad{color:#A13A22}
.bqg-n{margin:12px 2px 0;color:#655C4D;font-size:13px}
.bqg-msg{min-height:20px;margin:8px 2px 0;color:#8E2A1C;font-size:13.5px}
@media (prefers-reduced-motion:reduce){.bqg{animation:none}}
html[data-theme=sombre] .bqg{background:#1C1915;color:#F3EFE4}
html[data-theme=sombre] .bqg>p,html[data-theme=sombre] .bqg-n{color:#BFB39E}
html[data-theme=sombre] .bqg-x{background:rgba(243,239,228,.1)}
html[data-theme=sombre] .bqg-adr{background:#25211B;box-shadow:inset 0 0 0 1px rgba(243,239,228,.14)}html[data-theme=sombre] .bqg-adr span{color:#DDD3C2}
html[data-theme=sombre] .bqg-go{background:#F2C230;color:#171512}
html[data-theme=sombre] .bqg-duo button{background:#25211B;color:#F3EFE4;box-shadow:inset 0 0 0 1.5px rgba(243,239,228,.25)}
html[data-theme=sombre] .bqg-qr{background:#FFFDF8}
html[data-theme=sombre] .bqg-ln{border-top-color:rgba(243,239,228,.12)}html[data-theme=sombre] .bqg-ln.bad{color:#F2A08E}
html[data-theme=sombre] .bqg-on{background:#1E3A28;color:#BFE6CB}
html[data-theme=sombre] .bqg-msg{color:#F2A08E}`;
  const style = () => { if (document.getElementById('bqCss')) return; const s = document.createElement('style'); s.id = 'bqCss'; s.textContent = STYLE; document.head.appendChild(s); };

  // ——— la page boutique ———
  const photo = slug => { const a = A(); return a && a.SACK && a.SACK[slug] != null ? a.IMG + 'produit-' + slug + '.webp' : ''; };
  const nomProduit = (slug, lib) => { const p = window.MDG && MDG.products.find(x => x.slug === slug); return (p && p.name) || lib || slug; };
  const lieu = x => x.ville || (A() && A().REG[x.region_slug] ? A().REG[x.region_slug][2] : '') || '';
  const mois = t => { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); };
  function avatarHtml(b) {
    const Av = window.MDGAvatar; let src = '';
    try { if (Av) src = Av.uri(b.avatar, { size: 128, nom: b.nom || '?', seed: b.code || b.adresse }); } catch (_) {}
    return src ? `<img src="${esc(src)}" alt="" width="64" height="64">` : '';
  }
  function ligneProduit(x, moi) {
    const [et, cl] = ETATS[x.etat] || ETATS.disponible, im = photo(x.produit), nom = nomProduit(x.produit, x.libelle);
    const vend = x.etat === 'disponible' || x.etat === 'stock_faible';
    const q = +x.quantite || 0, u = x.unite || 'kg';
    const l2 = x.etat === 'pause' ? 'Indisponible pour l’instant' : x.etat === 'epuise' ? 'Tout est vendu' : fmt(q) + ' ' + unites(q, u) + ' disponible' + (q >= 2 ? 's' : '');
    const px = x.prix ? fmt(x.prix) + ' F / ' + u : 'Prix à discuter';
    return `<li class="bq-p" data-etat="${esc(x.etat)}" data-code="${esc(x.code)}">
      ${im ? `<img class="bq-im" src="${esc(im)}" alt="" width="64" height="64" loading="lazy">` : `<span class="bq-im ph" aria-hidden="true">${esc(nom.charAt(0).toUpperCase())}</span>`}
      <div class="bq-pt"><div class="bq-l1"><b>${esc(nom)}</b><span class="bq-e ${cl}">${et}</span></div>
        <small>${esc(l2)}${lieu(x) ? ' · ' + esc(lieu(x)) : ''}</small>
        <div class="bq-l3"><span class="bq-px">${esc(px)}</span><button type="button" class="bq-ib" data-part="${esc(x.code)}" aria-label="Partager cette offre">${ICO('partager')}</button>${vend && !moi ? `<button type="button" class="bq-neg" data-neg="${esc(x.code)}">Négocier</button>` : ''}</div></div></li>`;
  }
  function corps(b, o) {
    const L = b.catalogue || [], moi = !!b.moi;
    const f = b.fiabilite && b.fiabilite.pourcent != null && +b.fiabilite.sur > 0 ? b.fiabilite : null;
    const pi = [];
    if (b.niveau && b.niveau.libelle) pi.push(`<span class="bq-pi niv">${esc(b.niveau.libelle)}</span>`);
    if (b.verifie && window.MDGIdentite) pi.push(`<span class="bq-pi">${MDGIdentite.badge(15)}Identité vérifiée</span>`);
    if (+b.ventes > 0) pi.push(`<span class="bq-pi">Ventes réalisées ${nb(b.ventes)}</span>`);
    if (f) pi.push(`<span class="bq-pi">Fiabilité ${esc(String(f.pourcent))} % · ${esc(String(f.sur))} commande${+f.sur > 1 ? 's' : ''}</span>`);
    if (+b.avis > 0 && b.note != null) pi.push(`<span class="bq-pi">${window.MDGRep ? MDGRep.etoiles(+b.note, +b.avis, 12) : ''}${String(b.note).replace('.', ',')} · ${fmt(b.avis)} avis</span>`);
    const meta = [b.ville || (A() && A().REG[b.region_slug] ? A().REG[b.region_slug][2] : ''), b.membre_depuis ? 'membre depuis ' + mois(b.membre_depuis) : ''].filter(Boolean).join(' · ');
    return `<div class="bq-id"><div class="bq-av">${avatarHtml(b)}</div><div style="min-width:0"><h1><span>${esc(b.nom)}</span></h1>${meta ? `<p>${esc(meta)}</p>` : ''}</div></div>
      ${b.structure && b.structure.nom ? `<p class="bq-org">${esc(b.structure.type ? b.structure.type.charAt(0).toUpperCase() + b.structure.type.slice(1) + ' · ' : '')}${esc(b.structure.nom)}</p>` : ''}
      ${pi.length ? `<div class="bq-pr">${pi.join('')}</div>` : ''}
      ${moi ? `<div class="bq-gere"><button type="button" class="p" data-gerer>Gérer ma boutique</button><button type="button" class="s" data-stock>Mon stock</button></div>` : ''}
      <h2 class="bq-t">${moi ? 'Mes produits' : 'Ses produits'}${nb(L.length)}</h2>
      ${L.length ? `<ul class="bq-l">${L.map(x => ligneProduit(x, moi)).join('')}</ul>` : (t => window.MDGSac && MDGSac.vide ? MDGSac.vide('Rien en vente pour l’instant', t) : `<div class="bq-vide"><b>Rien en vente pour l’instant</b>${t}</div>`)(moi ? 'Publiez une offre : elle apparaîtra ici.' : 'Revenez plus tard : ce vendeur publie ses offres ici.')}
      <p class="bq-note">${moi ? 'Ce que voient vos visiteurs. Votre numéro n’apparaît jamais.' : 'Tout se négocie dans l’application. Le numéro du vendeur reste caché.'}</p>`;
  }

  let ouverte = null;
  async function ouvrir(adresse, o = {}) {
    adresse = propre(adresse); if (!adresse) return;
    style(); if (ouverte) ouverte.fermer();
    const retour = document.activeElement, bg = document.createElement('div'); bg.className = 'bq-bg';
    bg.innerHTML = `<div class="bq" role="dialog" aria-modal="true" aria-label="Boutique"><div class="bq-h"><button type="button" class="bq-ib" data-x aria-label="Retour">${I_RETOUR}</button><b data-titre>Boutique</b><button type="button" class="bq-ib" data-partager aria-label="Partager cette boutique">${ICO('partager')}</button></div>
      <div class="bq-c" data-c>${window.MDGSac ? MDGSac.charge('La boutique arrive…') : '<div class="bq-vide">Chargement…</div>'}</div></div>`;
    document.body.appendChild(bg); ouverte = bg;
    const rendre = N() && N().piege ? N().piege(bg) : null;
    const k = e => { if (e.key === 'Escape') fermer(); };
    function fermer() { bg.remove(); removeEventListener('keydown', k); if (ouverte === bg) ouverte = null; rendre && rendre(); if (retour && retour.isConnected && retour.focus) retour.focus({ preventScroll: true }); }
    bg.fermer = fermer; addEventListener('keydown', k);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.querySelector('[data-x]').onclick = fermer;
    const c = bg.querySelector('[data-c]');
    let b = null;
    const partager = (code) => { const u = lien(adresse, 'lien', code), t = (b ? b.nom : 'Boutique') + ' · Marché de Gros';
      if (navigator.share) navigator.share({ title: t, text: code ? 'Une offre à voir sur le Marché de Gros' : 'Ma boutique sur le Marché de Gros', url: u }).then(() => b && b.moi && mesurer(adresse, 'partage')).catch(() => {});
      else copier(u).then(ok => { N() && N().toast(ok ? 'Lien copié' : 'Copiez le lien : ' + u); if (ok && b && b.moi) mesurer(adresse, 'lien'); }); };
    bg.querySelector('[data-partager]').onclick = () => partager();
    async function charger1() {
      if (navigator.onLine === false) { c.innerHTML = `<div class="bq-vide"><b>Pas de connexion</b>La boutique s’affichera quand le réseau revient.<br><button type="button" data-re>Réessayer</button></div>`; c.querySelector('[data-re]').onclick = charger1; return; }
      try { b = await N().rpc('boutique_publique', { p_adresse: adresse }, auth()); }
      catch (x) { if (!bg.isConnected) return; c.innerHTML = `<div class="bq-vide"><b>La boutique n’a pas pu s’ouvrir</b>${esc(window.MDGErreur ? MDGErreur(x) : 'Réessayez dans un instant.')}<br><button type="button" data-re>Réessayer</button></div>`; c.querySelector('[data-re]').onclick = charger1; return; }
      if (!bg.isConnected) return;
      if (!b || !b.trouvee) { c.innerHTML = window.MDGSac && MDGSac.vide ? MDGSac.vide('Boutique introuvable', 'Le lien est peut-être incomplet, ou le vendeur a fermé sa boutique.') : `<div class="bq-vide"><b>Boutique introuvable</b>Le lien est peut-être incomplet, ou le vendeur a fermé sa boutique.</div>`; bg.querySelector('[data-partager]').hidden = true; return; }
      bg.querySelector('[data-titre]').textContent = 'Boutique ' + de(b.nom); bg.querySelector('.bq').setAttribute('aria-label', 'Boutique ' + de(b.nom));
      const html = corps(b, o);
      if (window.MDGStable && c.querySelector('.bq-id')) MDGStable.poser(c, html); else c.innerHTML = html;
      if (!b.moi) mesurer(adresse, 'vue', o);
      lier();
      // un lien vers une offre : seule la liste défile jusqu'à elle (pas la page derrière), puis l'offre est montrée une fois
      if (o.offre) { const li = c.querySelector(`[data-code="${CSS.escape(String(o.offre).slice(0, 12))}"]`); if (li) { c.scrollTop = Math.max(0, li.offsetTop - c.offsetTop - (c.clientHeight - li.offsetHeight) / 2); li.classList.add('vise'); mesurer(adresse, 'produit', { offre: o.offre }); } }
    }
    function lier() {
      c.querySelectorAll('[data-neg]').forEach(btn => btn.onclick = () => {
        const x = (b.catalogue || []).find(y => y.code === btn.dataset.neg); if (!x || !window.MDGNegoce) return;
        mesurer(adresse, 'produit', { offre: x.code });
        fermer();
        if (!b.verifie && window.MDGGaranties && MDGGaranties.avantContact) MDGGaranties.avantContact('boutique:' + adresse, b.nom);   // pas vérifié : « ne payez jamais d'avance »
        MDGNegoce.proposer({ cible: 'offre', id: x.id, transport: x.transport || '', produit: nomProduit(x.produit, x.libelle), prix: x.prix, unite: x.unite, quantite: +x.quantite || null, qmin: x.qte_min || null, ville: lieu(x), nom: b.nom, negociable: x.negociable !== false });
      });
      c.querySelectorAll('[data-part]').forEach(btn => btn.onclick = () => partager(btn.dataset.part));
      const g = c.querySelector('[data-gerer]'); if (g) g.onclick = () => gerer();
      const s = c.querySelector('[data-stock]'); if (s) s.onclick = () => { fermer(); dispatchEvent(new CustomEvent('mdg:aller', { detail: { page: 'pubs' } })); };
    }
    charger1();
    return bg;
  }

  // ——— copier, QR code ———
  async function copier(t) { try { await navigator.clipboard.writeText(t); return true; } catch (_) {
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (__) { return false; } } }
  function qrLib() { return window.qrcode ? Promise.resolve(window.qrcode) : new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'vendor/qrcode-generator-1.4.4.js'; s.onload = () => window.qrcode ? ok(window.qrcode) : ko(new Error('QR')); s.onerror = ko; document.head.appendChild(s); }); }
  async function qrSvg(u) { const q = (await qrLib())(0, 'M'); q.addData(u); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
  // l'image à imprimer ou à envoyer : fond vert, « Marché de Gros » (de Gros en maïs), le QR sur blanc, le nom de la boutique
  async function qrPng(u, nom, adresse) {
    const q = (await qrLib())(0, 'M'); q.addData(u); q.make();
    try { await Promise.all([document.fonts.load('700 64px Jost'), document.fonts.load('500 36px Jost')]); } catch (_) {}
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.fillStyle = '#10392B'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic'; g.font = '700 64px Jost, sans-serif';
    const m1 = 'Marché ', m2 = 'de Gros', w1 = g.measureText(m1).width, w2 = g.measureText(m2).width, x0 = (W - w1 - w2) / 2;
    g.fillStyle = '#F3EFE4'; g.fillText(m1, x0, 150); g.fillStyle = '#F2C230'; g.fillText(m2, x0 + w1, 150);
    const cx = 150, cy = 220, cs = 780, r = 44;
    g.fillStyle = '#FFFDF8'; g.beginPath(); g.moveTo(cx + r, cy); g.arcTo(cx + cs, cy, cx + cs, cy + cs, r); g.arcTo(cx + cs, cy + cs, cx, cy + cs, r); g.arcTo(cx, cy + cs, cx, cy, r); g.arcTo(cx, cy, cx + cs, cy, r); g.closePath(); g.fill();
    const n = q.getModuleCount(), pad = 64, cell = Math.floor((cs - 2 * pad) / n), off = cx + (cs - cell * n) / 2, offY = cy + (cs - cell * n) / 2;
    g.fillStyle = '#171512'; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (q.isDark(i, j)) g.fillRect(off + j * cell, offY + i * cell, cell, cell);
    const coupe = (t, f, max) => { g.font = f; if (g.measureText(t).width <= max) return t; while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
    g.textAlign = 'center'; g.fillStyle = '#F3EFE4'; g.fillText(coupe('Boutique ' + de(nom), '700 60px Jost, sans-serif', 940), W / 2, 1110);
    g.fillStyle = '#CFE0D6'; g.font = '500 38px Jost, sans-serif'; g.fillText('Scannez pour voir mes produits', W / 2, 1180);
    g.fillStyle = '#F2C230'; g.fillText(coupe('…/boutiques/' + propre(adresse), '500 32px Jost, sans-serif', 940), W / 2, 1250);
    return new Promise(ok => cv.toBlob(ok, 'image/png'));
  }
  async function telecharger(m) {
    const u = lien(m.adresse, 'qr'), blob = await qrPng(u, m.nom, m.adresse); if (!blob) throw new Error('Image impossible');
    const nomF = 'boutique-' + propre(m.adresse) + '-qr.png', url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nomF; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    mesurer(m.adresse, 'qr');
  }

  // ——— Ma boutique (le vendeur) ———
  async function gerer() {
    if (!N()) return;
    if (!N().session()) { N().open('Connectez-vous pour ouvrir votre boutique.'); addEventListener('mdg:connecte', () => setTimeout(gerer, 400), { once: true }); return; }
    style();
    const retour = document.activeElement, bg = document.createElement('div'); bg.className = 'bqg-bg';
    bg.innerHTML = `<div class="bqg" role="dialog" aria-modal="true" aria-labelledby="bqgT"><button type="button" class="bqg-x" aria-label="Fermer"></button><h2 id="bqgT">Ma boutique</h2><div data-c>${window.MDGSac ? MDGSac.charge('', { t: 56 }) : ''}</div></div>`;
    document.body.appendChild(bg);
    const rendre = N().piege ? N().piege(bg) : null, k = e => { if (e.key === 'Escape') fermer(); };
    function fermer() { bg.remove(); removeEventListener('keydown', k); rendre && rendre(); if (retour && retour.isConnected && retour.focus) retour.focus({ preventScroll: true }); }
    addEventListener('keydown', k); bg.addEventListener('click', e => { if (e.target === bg) fermer(); }); bg.querySelector('.bqg-x').onclick = fermer;
    const c = bg.querySelector('[data-c]'), h2 = bg.querySelector('h2');
    let m = null;
    const dire = t => { const z = c.querySelector('[data-msg]'); if (z) z.textContent = t || ''; };
    async function lire() {
      try { m = await N().rpc('ma_boutique', {}); } catch (x) { c.innerHTML = `<p class="bqg-msg">${esc(window.MDGErreur ? MDGErreur(x) : x.message)}</p><button type="button" class="bqg-go" data-re>Réessayer</button>`; c.querySelector('[data-re]').onclick = lire; return; }
      if (!bg.isConnected) return; dessiner();
    }
    function dessiner() {
      h2.innerHTML = 'Ma boutique' + (m.active ? ' <span class="bqg-on">Ouverte</span>' : '');
      if (!m.active) {
        c.innerHTML = `<p style="margin:0 0 14px;color:inherit;opacity:.85">Une page à votre nom avec toutes vos offres, à envoyer sur WhatsApp ou à imprimer en QR code. Vos clients voient vos produits, vos prix et ce qui reste. Votre numéro reste caché.</p>
          <button type="button" class="bqg-go" data-ouvrir>${ICO('vendre')}Ouvrir ma boutique</button>
          <p class="bqg-n">Vous pouvez la fermer quand vous voulez. ${m.pseudo ? 'Son adresse sera votre pseudo : ' + esc(m.pseudo) + '.' : 'Sans pseudo, elle reçoit un code court. Un pseudo se choisit dans Profil et avatar.'}</p><p class="bqg-msg" data-msg aria-live="polite"></p>`;
        c.querySelector('[data-ouvrir]').onclick = async ev => { ev.currentTarget.disabled = true; dire('');
          try { m = await N().rpc('boutique_activer', { p_oui: true }); dessiner(); N().toast('Votre boutique est ouverte'); }
          catch (x) { ev.currentTarget.disabled = false; dire(window.MDGErreur ? MDGErreur(x) : x.message); } };
        return;
      }
      const v = m.visites || {}, u = lien(m.adresse, 'lien');
      c.innerHTML = `${m.cachee ? '<p class="bqg-msg" style="margin:0 0 10px">Votre boutique est cachée pour l’instant : votre compte est suspendu.</p>' : ''}
        <div class="bqg-adr"><span>${esc(court(m.adresse))}</span><button type="button" class="bq-ib" data-copier aria-label="Copier le lien">${I_LIEN}</button></div>
        <button type="button" class="bqg-go" data-partager>${ICO('partager')}Partager ma boutique</button>
        <div class="bqg-duo"><button type="button" data-copier2>${I_LIEN}Copier le lien</button><button type="button" data-qr>${I_QR}Mon QR code</button></div>
        <div class="bqg-qr"><div data-qrv aria-hidden="true"></div><p>Imprimez-le ou collez-le sur votre stand : on le scanne avec l’appareil photo et votre boutique s’ouvre.</p></div>
        <div class="bqg-st"><h3>Visites</h3>
          <div class="bqg-li"><span>Ces 7 derniers jours</span>${nb(v.vues_7j || 0)}</div>
          <div class="bqg-li"><span>Ces 30 derniers jours</span>${nb(v.vues_30j || 0)}</div>
          <div class="bqg-li"><span>Produits ouverts (30 jours)</span>${nb(v.produits_30j || 0)}</div>
          <div class="bqg-li"><span>Vos partages</span>${nb(v.partages || 0)}</div>
          <p class="bqg-n">Des totaux seulement : on ne sait jamais qui a visité. Un visiteur compte une fois par jour.</p></div>
        <div style="margin-top:12px">
          <button type="button" class="bqg-ln" data-voir>${ICO('vendre')}<span>Voir ma boutique</span></button>
          <button type="button" class="bqg-ln" data-stock>${ICO('publications')}<span>Gérer mon stock</span></button>
          <button type="button" class="bqg-ln bad" data-fermer>${ICO('fermer')}<span>Fermer ma boutique</span></button></div>
        <p class="bqg-msg" data-msg aria-live="polite"></p>`;
      qrSvg(lien(m.adresse, 'qr')).then(s => { const z = c.querySelector('[data-qrv]'); if (z) z.innerHTML = s; }).catch(() => { const z = c.querySelector('.bqg-qr'); if (z) z.hidden = true; });
      const cp = async () => { const ok = await copier(u); N().toast(ok ? 'Lien copié' : 'Copie impossible : touchez et gardez le lien pour le copier'); if (ok) mesurer(m.adresse, 'lien'); };
      c.querySelector('[data-copier]').onclick = cp; c.querySelector('[data-copier2]').onclick = cp;
      c.querySelector('[data-partager]').onclick = () => { if (navigator.share) navigator.share({ title: 'Boutique ' + de(m.nom) + ' · Marché de Gros', text: 'Mes produits sur le Marché de Gros', url: u }).then(() => mesurer(m.adresse, 'partage')).catch(() => {}); else cp(); };
      c.querySelector('[data-qr]').onclick = async ev => { const bt = ev.currentTarget; bt.disabled = true; dire('');
        try { await telecharger(m); N().toast('QR code enregistré dans vos téléchargements'); } catch (x) { dire('L’image n’a pas pu être préparée. Réessayez.'); } finally { bt.disabled = false; } };
      c.querySelector('[data-voir]').onclick = () => { fermer(); ouvrir(m.adresse); };
      c.querySelector('[data-stock]').onclick = () => { fermer(); if (ouverte) ouverte.fermer(); dispatchEvent(new CustomEvent('mdg:aller', { detail: { page: 'pubs' } })); };
      c.querySelector('[data-fermer]').onclick = async () => {
        const oui = window.MDGDemande ? await MDGDemande.oui('Fermer votre boutique ? Son lien et son QR code ne montreront plus vos produits. Vos offres restent sur le marché.', { ok: 'Fermer', danger: true }) : true;
        if (!oui) return;
        try { m = await N().rpc('boutique_activer', { p_oui: false }); dessiner(); N().toast('Boutique fermée'); } catch (x) { dire(window.MDGErreur ? MDGErreur(x) : x.message); } };
    }
    lire();
  }

  window.MDGBoutique = { de, ouvrir, gerer, adresseDe, connue, charger, chercher, lien, court };
})();
