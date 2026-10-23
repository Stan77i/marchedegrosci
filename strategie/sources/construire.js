/* Fabrique les PDF de stratégie (strategie/*.pdf) à partir des modèles HTML de ce dossier.
   Lancé tout seul par GitHub Actions (.github/workflows/strategie-pdf.yml), ou à la main :
     node strategie/sources/construire.js            (CHROMIUM=/chemin/chrome si besoin)
   Les chiffres viennent de trois endroits, jamais inventés :
     1. le dépôt (catalogue v2/data.js, photos v2/img/, A.SACK) ;
     2. la base, par la fonction publique stats_publiques() (clé publique de l'application, aucune clé secrète) ;
     3. donnees-marche.json : chiffres du marché ivoirien, chacun avec sa source et son lien.
   Un PDF n'est refait que si son contenu a changé (empreinte dans empreintes.json). */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ICI = __dirname, RACINE = path.join(ICI, '..', '..'), SORTIE = path.join(ICI, '..');
const lire = f => fs.readFileSync(path.join(ICI, f), 'utf8');
const jsonL = (f, d) => { try { return JSON.parse(lire(f)); } catch (_) { return d; } };
const ecrireJ = (f, o) => fs.writeFileSync(path.join(ICI, f), JSON.stringify(o, null, 2) + '\n');
const nf = n => Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
const dateFr = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* 1. le dépôt */
function depot() {
  const c = {}; c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(RACINE, 'v2/data.js'), 'utf8'), c);
  const M = c.MDG, app = fs.readFileSync(path.join(RACINE, 'app/marche-app.js'), 'utf8');
  const sack = new Set([...(app.match(/A\.SACK = \{([^}]*)\}/) || ['', ''])[1].matchAll(/'?([a-z0-9-]+)'?\s*:\s*\d+/g)].map(m => m[1]));
  const photo = M.products.filter(p => sack.has(p.slug) && fs.existsSync(path.join(RACINE, 'v2/img/produit-' + p.slug + '.webp'))).length;
  return { produits: M.products.length, familles: M.categories.length, regions: M.regions.length, produits_photo: photo,
    familles_liste: M.categories.map(x => x.name).join(', ') };
}

/* 2. la base : seulement des totaux publics */
async function base() {
  const P = jsonL('parametres.json', {});
  const ancien = jsonL('chiffres-base.json', null);
  try {
    const r = await fetch(P.supabase_url + '/rest/v1/rpc/stats_publiques', { method: 'POST', headers: { apikey: P.cle_publique, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const s = await r.json();
    if (typeof s.membres !== 'number') throw new Error('réponse inattendue');
    // la date de mesure ne change l'empreinte que si un chiffre change
    const memes = ancien && Object.keys(s).every(k => k === 'mesure_le' || s[k] === ancien[k]);
    const garde = memes ? ancien : s;
    ecrireJ('chiffres-base.json', garde);
    return Object.assign({ base_ok: true }, garde);
  } catch (e) {
    console.warn('Base injoignable (' + e.message + ') : derniers chiffres connus gardés.');
    if (!ancien) throw new Error('Aucun chiffre de la base disponible.');
    return Object.assign({ base_ok: false }, ancien);
  }
}

/* 3. remplissage d'un modèle : {{cle}} = valeur ; {{m:id}} = chiffre sourcé (avec renvoi) ; {{sources}} = liste des sources citées */
function remplir(html, V, marche) {
  const citees = [];
  html = html.replace(/\{\{m:([a-z0-9_-]+)(?:\|([a-z]+))?\}\}/g, (_, id, mode) => {
    const f = marche.find(x => x.id === id); if (!f) throw new Error('chiffre du marché inconnu : ' + id);
    let n = citees.indexOf(f) + 1; if (!n) { citees.push(f); n = citees.length; }
    return (mode === 'libelle' ? esc(f.libelle) : esc(f.chiffre)) + '<sup class="ref">' + n + '</sup>';
  });
  html = html.replace(/\{\{sources\}\}/g, () => citees.length ? '<ol class="sources">' + citees.map(f =>
    `<li>${esc(f.libelle)} : ${esc(f.chiffre)} (${esc(f.annee)}). ${esc(f.source)}. <span class="url">${esc(f.url)}</span></li>`).join('') + '</ol>' : '');
  html = html.replace(/\{\{([a-z_]+)\}\}/g, (_, k) => { if (k === 'date') return '{{date}}'; if (!(k in V)) throw new Error('valeur inconnue : ' + k); return esc(V[k]); });
  return html;
}

(async () => {
  const P = jsonL('parametres.json', {}), marche = jsonL('donnees-marche.json', []), D = depot(), B = await base();
  const V = Object.assign({}, P.valeurs || {}, {
    produits: nf(D.produits), familles: nf(D.familles), regions: nf(D.regions), produits_photo: nf(D.produits_photo), familles_liste: D.familles_liste,
    membres: nf(B.membres), offres_actives: nf(B.offres_actives), demandes_actives: nf(B.demandes_actives), annonces_actives: nf(B.offres_actives + B.demandes_actives),
    produits_actifs: nf(B.produits_actifs), regions_actives: nf(B.regions_actives), commandes_terminees: nf(B.commandes_terminees),
    date_base: dateFr(B.mesure_le),
  });
  const style = lire('style.css'), emp = jsonL('empreintes.json', {});
  const filtre = process.argv.slice(2);   // ex. node construire.js marketing.html : un seul document
  const docs = (P.documents || []).filter(d => !filtre.length || filtre.includes(d.modele));
  let navigateur = null;
  for (const d of docs) {
    const brut = lire(d.modele);
    const corps = remplir(brut, V, marche);
    const h = crypto.createHash('sha256').update(style + corps).digest('hex').slice(0, 16);
    const pdf = path.join(SORTIE, d.pdf);
    if (emp[d.pdf] && emp[d.pdf].h === h && fs.existsSync(pdf)) { console.log('inchangé :', d.pdf); continue; }
    const date = dateFr(Date.now());
    const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(d.titre)}</title><base href="file://${RACINE}/"><style>${style}</style></head>`
      + `<body class="${d.format}">${corps.replace(/\{\{date\}\}/g, date)}</body></html>`;
    if (!navigateur) {
      let pw; try { pw = require('playwright'); } catch (_) { pw = require('/opt/node-tools/node_modules/playwright'); }
      navigateur = await pw.chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
    }
    const p = await navigateur.newPage(); const tmp = path.join(ICI, '.page.html'); fs.writeFileSync(tmp, page);
    await p.goto('file://' + tmp, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
    const paysage = d.format === 'diapo';
    await p.pdf({ path: pdf, printBackground: true, preferCSSPageSize: true,
      ...(paysage ? {} : { format: 'A4', displayHeaderFooter: true, headerTemplate: '<div></div>', margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
        footerTemplate: `<div style="width:100%;padding:0 16mm;font:8px sans-serif;color:#8F846F;display:flex;justify-content:space-between"><span>Marché de Gros CI · ${esc(d.titre)} · mis à jour le ${date}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` }) });
    await p.close(); fs.unlinkSync(tmp);
    emp[d.pdf] = { h, le: date }; console.log('refait :', d.pdf);
  }
  if (navigateur) await navigateur.close();
  ecrireJ('empreintes.json', emp);
})().catch(e => { console.error(e.message || e); process.exit(1); });
