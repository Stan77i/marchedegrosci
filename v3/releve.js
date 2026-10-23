/* ═════════ Marché de Gros CI — Mes ventes et achats : historique, relevés, bons de transaction ═════════
   Une transaction = une négociation conclue (prix et quantité fixés). Il n'y a pas encore de paiement dans l'application :
   le bon de transaction le dit (« Paiement : à la livraison, hors application »).
   Privé : seule la personne voit ses montants (serveur : supabase/schema-24-releves.sql → mes_transactions ; schéma 54 → mes_transactions2 : départ, destination, livraison).
   Tampon rouge du Marché de Gros en bas du bon et du relevé : VENDU / ACHETÉ / LIVRÉ / ANNULÉ (ou RELEVÉ), la date, le numéro — jamais « payé ».
   Public : le profil ne montre que des volumes (« 12 t vendues »), jamais de montants.
   • période : ce mois, 3 mois, cette année, tout, ou des dates choisies ;
   • totaux : nombre de ventes et d'achats, montants, volumes par unité (kg et tonnes ensemble ; sacs, litres… à part, sans conversion inventée) ;
   • chaque transaction a son bon (numéro, date, parties, produit, quantité, prix, total) à imprimer ou enregistrer en PDF ;
   • relevé de la période à imprimer (PDF) ou à exporter en tableur (CSV).
   API : MDGReleve.ouvrir() */
(function () {
  'use strict';
  if (window.MDGReleve) return;
  const N = () => window.MDGNuage;
  const KC = 'mdg-releve:cache';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = (n, t) => window.MDGIco ? MDGIco.svg(n, t || 18, 1.9) : '';
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0);
  const F = v => nf(v) + ' F';
  const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const moi = () => { const C = window.MDGCompte, p = C && C.profil && C.profil(); return (p && C.nomAffiche && C.nomAffiche(p)) || 'Vous'; };

  // unités : kg et tonnes se cumulent (affichés en t au-delà d'une tonne) ; litres ensemble ; le reste tel quel (un sac n'a pas de poids fixe)
  const norm = u => { u = String(u || 'unité').toLowerCase().trim(); return /^(kg|kilo)/.test(u) ? 'kg' : /^(t|tonne)/.test(u) ? 't' : /^(l|litre)/.test(u) ? 'L' : u; };
  const pluriel = (u, q) => q > 1 && !/[sx]$|^(kg|t|L)$/.test(u) ? u + 's' : u;
  function volumes(L) {
    const v = {};
    L.forEach(x => { if (x.quantite == null) return; let u = norm(x.unite), q = +x.quantite; if (u === 't') { u = 'kg'; q *= 1000; } const k = x.sens + '|' + u; v[k] = (v[k] || 0) + q; });
    return Object.entries(v).map(([k, q]) => { const [sens, u] = k.split('|'); return u === 'kg' && q >= 1000 ? { sens, q: q / 1000, u: 't' } : { sens, q, u }; })
      .sort((a, b) => (a.sens === b.sens ? b.q - a.q : a.sens === 'vente' ? -1 : 1));
  }
  const fem = u => /^(t|tonne|unité|caisse|cagette|botte|boîte|bassine)/i.test(u);
  const vTxt = v => nf(v.q, v.q < 10 ? 2 : 1) + ' ' + pluriel(v.u, v.q) + (v.sens === 'vente' ? ' vendu' : ' acheté') + (fem(v.u) ? 'e' : '') + (v.q > 1 ? 's' : '');

  const PERIODES = [['mois', 'Ce mois'], ['3m', '3 mois'], ['an', 'Cette année'], ['tout', 'Tout'], ['dates', 'Dates…']];
  function bornes(k, d1, d2) {
    const a = new Date();
    if (k === 'mois') return [iso(new Date(a.getFullYear(), a.getMonth(), 1)), iso(a)];
    if (k === '3m') return [iso(new Date(a.getFullYear(), a.getMonth() - 2, 1)), iso(a)];
    if (k === 'an') return [iso(new Date(a.getFullYear(), 0, 1)), iso(a)];
    if (k === 'dates') return [d1 || null, d2 || null];
    return [null, null];
  }
  const libelle = (k, d1, d2) => k === 'dates' ? (d1 && d2 ? 'du ' + jour(d1) + ' au ' + jour(d2) : d1 ? 'depuis le ' + jour(d1) : d2 ? 'jusqu’au ' + jour(d2) : 'toutes dates')
    : ({ tout: 'depuis votre inscription', mois: 'ce mois-ci', '3m': 'ces 3 derniers mois', an: 'cette année' })[k] || '';

  const CSS = `.rl-bg{position:fixed;inset:0;z-index:9300;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
@media (min-width:720px){.rl-bg{align-items:center;padding:24px}}
.rl{position:relative;width:100%;max-width:520px;max-height:min(92dvh,860px);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:#F4EEE3;color:#171512;border-radius:28px 28px 0 0;padding:22px 18px calc(22px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif}
@media (min-width:720px){.rl{border-radius:28px}}
.rl h2{margin:0 52px 4px 0;font:600 24px/1.08 Jost,sans-serif;letter-spacing:-.015em}
.rl h2 em{font:900 italic 1em Jost,sans-serif;color:#10392B;letter-spacing:-.02em;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%)}
.rl-sous{margin:0 0 16px;color:#655C4D;font-size:14px;display:flex;gap:6px;align-items:center}.rl-sous svg{flex:none;color:#10392B}
.rl-x{position:absolute;right:12px;top:12px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:#171512;display:grid;place-items:center;cursor:pointer}
.rl-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -18px 12px;padding:0 18px}.rl-chips::-webkit-scrollbar{display:none}
.rl-chip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:22px;border:1px solid rgba(23,21,18,.16);background:#FFFDF8;color:#171512;font:500 14px Jost,sans-serif;cursor:pointer}
.rl-chip[aria-pressed=true]{background:#10392B;border-color:#10392B;color:#F3EFE4}
.rl-dates{display:flex;gap:8px;margin:0 0 12px}.rl-dates label{flex:1;display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:#655C4D}
.rl-dates input{min-height:44px;border:1px solid rgba(23,21,18,.2);border-radius:12px;background:#FFFDF8;padding:0 10px;font:500 15px Jost,sans-serif;color:#171512}
.rl-tot{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px}
.rl-t{padding:14px 14px 12px;border-radius:18px;background:#FFFDF8;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.05)}
.rl-t.v{background:#10392B;color:#F3EFE4}.rl-t small{display:block;font-size:12.5px;opacity:.78}
.rl-t b{display:block;margin-top:2px;font:800 26px/1.05 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}
.rl-t span{display:block;margin-top:4px;font:600 15px/1.2 Jost,sans-serif;font-variant-numeric:tabular-nums}
.rl-t.v span{color:#F2C230}
.rl-vol{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;min-height:30px}.rl-vol span{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:15px;background:rgba(16,57,43,.08);color:#10392B;font:600 13.5px Jost,sans-serif}
.rl-seg{display:flex;padding:3px;border-radius:14px;background:rgba(23,21,18,.07);margin:0 0 10px}
.rl-seg button{flex:1;min-height:44px;border:0;border-radius:11px;background:none;color:#4B4436;font:500 14px Jost,sans-serif;cursor:pointer}
.rl-seg button[aria-pressed=true]{background:#FFFDF8;color:#171512;font-weight:600;box-shadow:0 1px 3px rgba(23,21,18,.12)}
.rl-li{display:flex;flex-direction:column;gap:6px}
.rl-r{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 12px;border:0;border-radius:16px;background:#FFFDF8;text-align:left;color:inherit;cursor:pointer;font:inherit}
.rl-r .o{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(108,197,140,.22);color:#10392B}.rl-r.a .o{background:rgba(242,194,48,.28);color:#5B4300}
.rl-r b{display:block;font-weight:600}.rl-r small{display:block;font-size:12.5px;color:#655C4D}
.rl-r .m{text-align:right;font:700 15px Jost,sans-serif;font-variant-numeric:tabular-nums}.rl-r .m small{font:400 12px Jost,sans-serif}
.rl-act{display:flex;gap:8px;margin:16px 0 0}.rl-act button{flex:1;min-height:48px;border-radius:24px;border:1px solid #10392B;background:none;color:#10392B;font:600 15px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
.rl-act button.p{background:#10392B;color:#F3EFE4}
.rl-note{margin:14px 2px 0;font-size:12.5px;color:#655C4D}
.rl-bon{background:#FFFDF8;border-radius:20px;padding:20px 18px;box-shadow:0 1px 2px rgba(23,21,18,.05),0 8px 24px rgba(23,21,18,.06)}
.rl-bon header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:14px;border-bottom:1px dashed rgba(23,21,18,.2)}
.rl-bon h3{margin:0;font:900 italic 20px/1.05 Jost,sans-serif;letter-spacing:-.02em}.rl-bon header small{display:block;color:#655C4D;font-size:12.5px;margin-top:4px}
.rl-bon dl{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;margin:14px 0}.rl-bon dt{color:#655C4D;font-size:13.5px}.rl-bon dd{margin:0;font-weight:600;text-align:right}
.rl-bon .tot{display:flex;justify-content:space-between;align-items:baseline;padding-top:12px;border-top:1px dashed rgba(23,21,18,.2)}
.rl-bon .tot b{font:800 28px Jost,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.rl-bon .pay{margin:14px 0 0;padding:10px 12px;border-radius:12px;background:rgba(242,194,48,.2);font-size:13.5px}
.rl-tp{display:flex;justify-content:flex-end;margin:6px -4px -8px 0}.rl-tampon{transform:rotate(-9deg);opacity:.9;mix-blend-mode:multiply}
.rl-print{display:none}
@media print{@page{margin:1.4cm}:root,html,html[data-theme],body{background:#fff!important;background-image:none!important;color-scheme:light!important}body>*:not(.rl-print){display:none!important}.rl-print{display:block!important;color:#000;background:#fff;font:400 12pt/1.4 Jost,Arial,sans-serif;padding:0}
  .rl-print h1{font:900 italic 20pt Jost,sans-serif;margin:0 0 4pt}.rl-print table{width:100%;border-collapse:collapse;margin-top:10pt}.rl-print th,.rl-print td{border-bottom:1px solid #bbb;padding:4pt 3pt;text-align:left;font-size:9pt;vertical-align:top}.rl-print td.n{white-space:nowrap}.rl-print td.num{font-size:7.5pt;color:#444;word-break:break-all}
  .rl-print td.n,.rl-print th.n{text-align:right}.rl-print .pied{margin-top:14pt;font-size:9.5pt;color:#444}.rl-print .bon{max-width:15cm}.rl-print .tp{display:flex;justify-content:flex-end;margin:12pt 1cm 0 0;page-break-inside:avoid;break-inside:avoid}.rl-print .rl-tampon{width:4.2cm;height:4.2cm;transform:rotate(-9deg);opacity:.9;-webkit-print-color-adjust:exact;print-color-adjust:exact}.rl-print dl{display:grid;grid-template-columns:5cm 1fr;gap:4pt}.rl-print dd{margin:0;font-weight:600}
  @page{margin:16mm}}
@media (prefers-reduced-motion:reduce){.rl *{transition:none!important}}`;
  function css() { if (document.getElementById('rlCss')) return; const s = document.createElement('style'); s.id = 'rlCss'; s.textContent = CSS; document.head.appendChild(s); }

  let bg = null, etat = { p: 'an', sens: 'tout', d1: '', d2: '' }, liste = [], charge = false;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', clavier); }
  const clavier = e => { if (e.key === 'Escape') fermer(); };

  async function lire() {
    const [d1, d2] = bornes(etat.p, etat.d1, etat.d2), cle = etat.p + '|' + d1 + '|' + d2;
    const c = J(KC, {}); if (c[cle]) liste = c[cle];
    if (!navigator.onLine) return;
    charge = true; peindre();
    try { liste = (await N().rpc('mes_transactions2', { p_debut: d1, p_fin: d2 }).catch(() => N().rpc('mes_transactions', { p_debut: d1, p_fin: d2 }))) || []; c[cle] = liste; const k = Object.keys(c); if (k.length > 8) delete c[k[0]]; W(KC, c); }
    catch (e) { if (window.MDGToast) MDGToast.dire('Relevé indisponible pour l’instant', { type: 'erreur', sous: /mes_transactions|schema cache|Could not find/i.test(e.message) ? 'Le serveur n’est pas encore à jour.' : e.message }); }
    charge = false; peindre();
  }
  const visibles = () => liste.filter(x => etat.sens === 'tout' || x.sens === etat.sens);

  function peindre() {
    if (!bg) return;
    const box = bg.querySelector('.rl'), L = visibles(), V = liste.filter(x => x.sens === 'vente'), A = liste.filter(x => x.sens === 'achat');
    const som = l => l.reduce((s, x) => s + (+x.total || 0), 0), vol = volumes(liste);
    const t = (cls, lab, n, m) => `<div class="rl-t ${cls}"><small>${lab}</small><b>${nf(n)}</b><span>${m ? F(m) : '—'}</span></div>`;
    box.innerHTML = `<button type="button" class="rl-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Mes ventes et <em>achats</em></h2>
      <p class="rl-sous">${IC('cadenas', 15)}<span>Vous seul voyez les montants. Votre profil public ne montre que les volumes.</span></p>
      <div class="rl-chips" role="group" aria-label="Période">${PERIODES.map(([k, l]) => `<button type="button" class="rl-chip" data-p="${k}" aria-pressed="${etat.p === k}">${l}</button>`).join('')}</div>
      ${etat.p === 'dates' ? `<div class="rl-dates"><label>Du<input type="date" data-d1 value="${esc(etat.d1)}"></label><label>Au<input type="date" data-d2 value="${esc(etat.d2)}"></label></div>` : ''}
      <div class="rl-tot">${t('v', V.length > 1 ? 'Ventes' : 'Vente', V.length, som(V))}${t('', A.length > 1 ? 'Achats' : 'Achat', A.length, som(A))}</div>
      ${vol.length ? `<div class="rl-vol" aria-label="Volumes">${vol.map(v => `<span>${esc(vTxt(v))}</span>`).join('')}</div>` : '<div class="rl-vol" aria-hidden="true"></div>'}
      <div class="rl-seg" role="group" aria-label="Afficher">${[['tout', 'Tout'], ['vente', 'Ventes'], ['achat', 'Achats']].map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${etat.sens === k}">${l}</button>`).join('')}</div>
      <div class="rl-li">${charge && !liste.length ? (window.MDGSac ? MDGSac.charge('Vos transactions arrivent…') : '<p>Chargement…</p>')
        : L.length ? L.map((x, i) => `<button type="button" class="rl-r${x.sens === 'achat' ? ' a' : ''}" data-i="${liste.indexOf(x)}"><span class="o" aria-hidden="true">${IC(x.sens === 'vente' ? 'vendre' : 'acheter', 20)}</span>
            <span><b>${esc(x.produit || 'Produit')}${x.quantite != null ? ' · ' + nf(x.quantite, 2) + ' ' + esc(pluriel(x.unite || '', x.quantite)) : ''}</b><small>${x.sens === 'vente' ? 'Vendu à' : 'Acheté à'} ${esc(x.partenaire_nom)} · ${jour(x.conclu_le)}</small></span>
            <span class="m">${x.total != null ? F(x.total) : '—'}<small>${x.prix_unitaire != null ? nf(x.prix_unitaire) + ' F / ' + esc(x.unite || 'u') : ''}</small></span></button>`).join('')
        : (window.MDGSac ? MDGSac.vide((etat.sens === 'achat' ? 'Aucun achat' : etat.sens === 'vente' ? 'Aucune vente' : 'Aucune vente ni achat') + ' ' + libelle(etat.p, etat.d1, etat.d2), 'Quand une négociation se conclut, elle s’ajoute ici avec son bon de transaction.') : '<p>Aucune transaction sur cette période.</p>')}</div>
      ${L.length ? `<div class="rl-act"><button type="button" class="p" data-pdf>${IC('publications', 18)}Relevé PDF</button><button type="button" data-csv>${IC('barres', 18)}Tableur (CSV)</button></div>` : ''}
      <p class="rl-note">Une transaction compte ici quand la négociation est conclue : prix et quantité acceptés par les deux. Le paiement se fait à la livraison, hors application, pour l’instant.</p>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { etat.p = b.dataset.p; peindre(); if (etat.p !== 'dates' || etat.d1 || etat.d2) lire(); });
    box.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { etat.sens = b.dataset.s; peindre(); });
    const d1 = box.querySelector('[data-d1]'), d2 = box.querySelector('[data-d2]');
    if (d1) d1.onchange = () => { etat.d1 = d1.value; lire(); }; if (d2) d2.onchange = () => { etat.d2 = d2.value; lire(); };
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => bon(liste[+b.dataset.i]));
    const pdf = box.querySelector('[data-pdf]'); if (pdf) pdf.onclick = () => imprimer(releveHTML());
    const csv = box.querySelector('[data-csv]'); if (csv) csv.onclick = exporter;
  }

  // ——— le bon de transaction ———
  const parties = x => x.sens === 'vente' ? [moi(), x.partenaire_nom] : [x.partenaire_nom, moi()];
  // ——— le tampon rouge du Marché de Gros (22/10/2026) ———
  // Il dit ce que le serveur sait, rien de plus : VENDU / ACHETÉ (accord conclu), LIVRÉ (réception confirmée), ANNULÉ.
  // Jamais « PAYÉ » : l'application ne voit pas l'argent (paiement à la livraison, hors application).
  const dcourt = t => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const ETAT_CMD = { a_confirmer: 'Commande à confirmer', en_cours: 'Livraison en cours', terminee: 'Livrée · réception confirmée', annulee: 'Commande annulée', litige: 'Litige en cours d’examen', refusee: 'Commande refusée' };
  function motTampon(x) { return x.commande_etat === 'terminee' ? 'LIVRÉ' : x.commande_etat === 'annulee' ? 'ANNULÉ' : x.sens === 'vente' ? 'VENDU' : 'ACHETÉ'; }
  function tampon(mot, haut, bas, aria) {
    const R = '#B3261E', fs = mot.length > 7 ? 24 : mot.length > 6 ? 27 : 30;
    return `<svg class="rl-tampon" viewBox="0 0 200 200" width="150" height="150" role="img" aria-label="${esc(aria)}">
      <defs><path id="rlTpH" d="M30,100 a70,70 0 1,1 140,0"/><path id="rlTpB" d="M24,100 a76,76 0 0,0 152,0"/></defs>
      <g fill="none" stroke="${R}"><circle cx="100" cy="100" r="94" stroke-width="4"/><circle cx="100" cy="100" r="87" stroke-width="1.4"/><circle cx="100" cy="100" r="57" stroke-width="1.4"/></g>
      <g fill="${R}" font-family="Jost,Arial,sans-serif">
        <text font-size="13.5" font-weight="700" letter-spacing="2.2"><textPath href="#rlTpH" startOffset="50%" text-anchor="middle">MARCHÉ DE GROS</textPath></text>
        <text font-size="11.5" font-weight="700" letter-spacing="3"><textPath href="#rlTpB" startOffset="50%" text-anchor="middle">★ CÔTE D’IVOIRE ★</textPath></text>
        <text x="100" y="72" font-size="11" font-weight="600" text-anchor="middle">${esc(haut)}</text>
        <text x="100" y="140" font-size="8.5" font-weight="600" text-anchor="middle" letter-spacing=".5">${esc(bas)}</text>
      </g>
      <rect x="8" y="81" width="184" height="38" fill="#fff" fill-opacity=".9" stroke="${R}" stroke-width="2.4"/>
      <text x="100" y="${100 + fs * .36}" fill="${R}" font-family="Jost,Arial,sans-serif" font-size="${fs}" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="1.5">${esc(mot)}</text></svg>`;
  }
  function tamponBon(x) {
    const mot = motTampon(x), d = mot === 'LIVRÉ' && x.livre_le ? x.livre_le : x.conclu_le;
    return tampon(mot, dcourt(d), x.numero ? 'N° ' + String(x.numero).split('-').pop() : '', 'Tampon du Marché de Gros : ' + mot.toLowerCase() + ' le ' + dcourt(d));
  }
  function bonHTML(x, imp) {
    const [v, a] = parties(x), q = x.quantite != null ? nf(x.quantite, 2) + ' ' + pluriel(x.unite || '', x.quantite) : '—';
    const lignes = [['Accord conclu le', jour(x.conclu_le)], ['Vendeur', v], ['Acheteur', a], ['Produit', x.produit || '—'], ['Quantité', q],
      ['Prix unitaire', x.prix_unitaire != null ? F(x.prix_unitaire) + ' / ' + (x.unite || 'unité') : '—'],
      ['Départ', x.depart || x.ville || '—'], ['Destination', x.destination || (x.commande_numero ? 'Non précisée' : '—')]];
    if (x.commande_numero) lignes.push(['Commande', x.commande_numero], ['Livraison', (ETAT_CMD[x.commande_etat] || '—') + (x.commande_etat === 'terminee' && x.livre_le ? ', le ' + jour(x.livre_le) : '')]);
    else lignes.push(['Livraison', 'Pas encore de commande']);
    if (imp) return `<div class="bon"><h1>marché de Gros</h1><p>Bon de transaction n° <b>${esc(x.numero)}</b></p><dl>${lignes.map(([k, w]) => `<dt>${k}</dt><dd>${esc(w)}</dd>`).join('')}<dt>Total</dt><dd>${x.total != null ? F(x.total) : '—'}</dd><dt>Paiement</dt><dd>À la livraison, hors application</dd></dl>
      <div class="tp">${tamponBon(x)}</div>
      <p class="pied">Ce bon récapitule l’accord conclu sur le Marché de Gros (négociation acceptée par les deux parties). Il ne remplace pas une facture fiscale. Établi le ${jour(Date.now())}.</p></div>`;
    return `<div class="rl-bon"><header><div><h3>Bon de transaction</h3><small>n° ${esc(x.numero)}</small></div>${window.MDGMarque ? MDGMarque.dg(42, { fond: 'vert' }) : ''}</header>
      <dl>${lignes.map(([k, w]) => `<dt>${k}</dt><dd>${esc(w)}</dd>`).join('')}</dl>
      <div class="tot"><span>Total</span><b>${x.total != null ? F(x.total) : '—'}</b></div>
      <p class="pay"><b>Paiement :</b> à la livraison, hors application. Voyez la marchandise avant de payer.</p><div class="rl-tp">${tamponBon(x)}</div></div>`;
  }
  function bon(x) {
    if (!x || !bg) return;
    const box = bg.querySelector('.rl');
    box.innerHTML = `<button type="button" class="rl-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <button type="button" class="rl-chip" data-retour style="margin:0 0 14px">${IC('retour', 16)} Retour</button>
      ${bonHTML(x)}
      <div class="rl-act"><button type="button" class="p" data-imp>${IC('publications', 18)}Imprimer ou PDF</button></div>
      <p class="rl-note">Ce bon récapitule l’accord conclu sur le Marché de Gros. Il ne remplace pas une facture fiscale.</p>`;
    box.querySelector('[data-x]').onclick = fermer; box.querySelector('[data-retour]').onclick = peindre;
    box.querySelector('[data-imp]').onclick = () => imprimer(bonHTML(x, true));
    box.scrollTop = 0;
  }

  // ——— relevé de période ———
  function releveHTML() {
    const L = visibles(), V = L.filter(x => x.sens === 'vente'), A = L.filter(x => x.sens === 'achat'), som = l => l.reduce((s, x) => s + (+x.total || 0), 0);
    return `<h1>marché de Gros</h1><p>Relevé de ${esc(moi())} · ${esc(libelle(etat.p, etat.d1, etat.d2))}${etat.sens !== 'tout' ? ' · ' + (etat.sens === 'vente' ? 'ventes' : 'achats') : ''}</p>
      <p>${V.length} vente${V.length > 1 ? 's' : ''} : <b>${F(som(V))}</b> · ${A.length} achat${A.length > 1 ? 's' : ''} : <b>${F(som(A))}</b>${volumes(L).length ? ' · ' + volumes(L).map(vTxt).join(', ') : ''}</p>
      <table><thead><tr><th>Date</th><th>N°</th><th>Sens</th><th>Produit</th><th class="n">Quantité</th><th class="n">Prix unit.</th><th class="n">Total</th><th>Avec</th><th>Trajet</th><th>Livraison</th></tr></thead><tbody>
      ${L.map(x => `<tr><td>${new Date(x.conclu_le).toLocaleDateString('fr-FR')}</td><td class="num">${esc(x.numero)}</td><td>${x.sens === 'vente' ? 'Vente' : 'Achat'}</td><td>${esc(x.produit || '')}</td><td class="n">${x.quantite != null ? nf(x.quantite, 2) + ' ' + esc(x.unite || '') : ''}</td><td class="n">${x.prix_unitaire != null ? F(x.prix_unitaire) : ''}</td><td class="n">${x.total != null ? F(x.total) : ''}</td><td>${esc(x.partenaire_nom)}</td><td>${esc((x.depart || x.ville || '—') + ' → ' + (x.destination || '—'))}</td><td>${esc(x.commande_numero ? (ETAT_CMD[x.commande_etat] || '—') : '—')}</td></tr>`).join('')}
      </tbody></table><p class="pied">Transactions conclues sur le Marché de Gros (négociations acceptées par les deux parties). Paiement à la livraison, hors application. Ce relevé ne remplace pas une comptabilité certifiée. Établi le ${jour(Date.now())}.</p>
      <div class="tp">${tampon('RELEVÉ', dcourt(Date.now()), V.length + ' vente' + (V.length > 1 ? 's' : '') + ' · ' + A.length + ' achat' + (A.length > 1 ? 's' : ''), 'Tampon du Marché de Gros : relevé établi le ' + dcourt(Date.now()))}</div>`;
  }
  function imprimer(html) {
    let z = document.querySelector('.rl-print'); if (!z) { z = document.createElement('div'); z.className = 'rl-print'; document.body.appendChild(z); }
    z.innerHTML = html; setTimeout(() => { try { window.print(); } catch (_) {} }, 60);
  }
  function exporter() {
    const L = visibles(), q = s => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const t = [['Date', 'Numéro', 'Sens', 'Produit', 'Quantité', 'Unité', 'Prix unitaire (F)', 'Total (F)', 'Avec', 'Lieu']]
      .concat(L.map(x => [iso(new Date(x.conclu_le)), x.numero, x.sens, x.produit, x.quantite, x.unite, x.prix_unitaire, x.total, x.partenaire_nom, x.ville]));
    const blob = new Blob(['﻿' + t.map(r => r.map(q).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'releve-marche-de-gros-' + iso(new Date()) + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    if (window.MDGToast) MDGToast.dire('Relevé enregistré', { type: 'ok', sous: L.length + ' transaction' + (L.length > 1 ? 's' : '') + ' · fichier CSV (tableur)' });
  }

  function ouvrir() {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    css(); fermer();
    bg = document.createElement('div'); bg.className = 'rl-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Mes ventes et achats');
    bg.innerHTML = '<div class="rl"></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    peindre(); lire();
  }
  window.MDGReleve = { ouvrir };
})();
