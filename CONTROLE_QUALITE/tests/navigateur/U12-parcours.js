#!/usr/bin/env node
/* Batterie navigateur U12 Compréhension : écrans d'une commande à chaque étape (charger, recevoir, vérifier, litige, annulée),
   avec des données FACTICES (_faux-serveur.js). Contrôle qualité MGCI, 25/10/2026. Centre de commande : CONTROLE_QUALITE/README.md.
   Lancement : bash tools/controle/lancer.sh navigateur | unite U12 | tout. Variables : CQ_URL, PLAYWRIGHT_MODULE, CHROMIUM, CQ_RACINE, CQ_SORTIE.
   Ce que le script juge seul : écran ouvert sans erreur JavaScript, texte présent, au moins un bouton, aucun texte technique,
   aucune faute de liaison connue (« à le », « de le », « de igname »…). Le reste (clarté, sur-explication) se juge sur les captures :
   elles vont dans CQ_SORTIE (dossier temporaire par défaut), jamais dans le dépôt.
   Code de sortie : 0 réussi, 1 au moins un échec, 3 bloqué (navigateur absent). Les 3 dernières lignes sont le résumé. */
'use strict';
let PW;
try { PW = require(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/playwright'); }
catch (_) { try { PW = require('playwright'); } catch (e) { console.log('U12 bloqué : Playwright introuvable (PLAYWRIGHT_MODULE)'); process.exit(3); } }
const { chromium, devices } = PW;
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const F = require('./_faux-serveur.js');

const DEPOT = path.resolve(process.env.CQ_RACINE || path.join(__dirname, '..', '..', '..'));
const OUT = path.resolve(process.env.CQ_SORTIE || fs.mkdtempSync(path.join(os.tmpdir(), 'cq-U12-')));
const CHROME = process.env.CHROMIUM && fs.existsSync(process.env.CHROMIUM) ? process.env.CHROMIUM : null;
const H = h => new Date(Date.now() - h * 3600e3).toISOString();
const DATE = new Date().toISOString().slice(0, 10);

const base = { produit: 'Igname', quantite: 2000, unite: 'kg', prix_unitaire: 400, montant: 800000, commission_montant: 28000, partenaire_id: F.AUTRE, partenaire_nom: 'Awa K.', mode_transport: 'vendeur', ville_depart: 'Bouaké', lieu_livraison: 'Abidjan', ville_arrivee: 'Abidjan', created_at: H(30), updated_at: H(1), libere_le: null, validation: 'declaration', transport_regle: 'livreur_vendeur' };
const CAS = {
  charger: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000001', numero: 'MG-0101', role: 'vendeur', etat: 'en_cours', etape: 'confirmee', confirme_le: H(2), mot_secret: 'MANGUE 47' }),
  recevoir: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000002', numero: 'MG-0102', role: 'acheteur', etat: 'en_cours', etape: 'arrivee', livre_le: H(1), cree_par_moi: true }),
  verifier: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000003', numero: 'MG-0103', role: 'acheteur', etat: 'terminee', etape: 'terminee', termine_le: H(0.2), cree_par_moi: true }),
  litige: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000004', numero: 'MG-0104', role: 'acheteur', etat: 'litige', etape: 'arrivee', litige_le: H(3), litige_motif: 'Sacs abîmés', cree_par_moi: true }),
  annulee: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000005', numero: 'MG-0105', role: 'vendeur', etat: 'annulee', etape: 'confirmee', annulation_motif: 'stock', cree_par_moi: false }),
  route: Object.assign({}, base, { id: 'eeeeeeee-0000-4000-8000-000000000006', numero: 'MG-0106', role: 'acheteur', etat: 'en_cours', etape: 'transport', confirme_le: H(5), cree_par_moi: true }),
};
// fautes de liaison repérables sans jugement (CMP-02 « de igname », CMP-11 « à le vendeur »)
const FAUTES = /\b(à le|à les|de le|de les)\b|\bde (igname|arachide|ananas|aubergine|avocat|oignon|huile|attiéké|orange|une? )/i;

function serveur(dir) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(dir, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => { s.url = 'http://127.0.0.1:' + s.address().port + '/'; r(s); }));
}

(async () => {
  let srv = null, URLB = process.env.CQ_URL;
  if (!URLB) { srv = await serveur(DEPOT); URLB = srv.url; }
  let b;
  try { b = await chromium.launch(CHROME ? { executablePath: CHROME } : {}); }
  catch (e) { console.log('U12 bloqué : le navigateur ne démarre pas (' + String(e.message).split('\n')[0].slice(0, 120) + ')'); if (srv) srv.close(); process.exit(3); }
  const tests = []; let n = 20;
  const out = {};
  try {
    for (const [cle, cmd] of Object.entries(CAS)) {
      const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', serviceWorkers: 'block' });
      await F.brancher(ctx, []);
      await ctx.route(/\/rpc\/mes_commandes2/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([cmd]) }));
      await ctx.addInitScript(([MOI]) => {
        if (sessionStorage.getItem('i')) return; sessionStorage.setItem('i', '1'); localStorage.setItem('mdg-astuces:off', 'true'); localStorage.setItem('mdg-guide:vu', 'true');
        localStorage.setItem('mdg-nuage:session', JSON.stringify({ access_token: 'faux', refresh_token: 'faux', expires_at: 4102444800, user: { id: MOI, tel: '0701020304' } }));
        localStorage.setItem('mdg-nuage:proprio', JSON.stringify(MOI)); localStorage.setItem('mdg-compte:profil', JSON.stringify({ user_id: MOI, prenom: 'Test', role: 'les_deux', region_slug: 'abidjan', ville: 'Abidjan' }));
      }, [F.MOI]);
      const p = await ctx.newPage(); const err = []; p.on('pageerror', e => err.push(e.message.slice(0, 160)));
      let texte = '', boutons = [], pb = null;
      try {
        await p.goto(URLB + 'application.dc.html#/', { waitUntil: 'load', timeout: 60000 }); await p.waitForTimeout(3500);
        await p.waitForFunction(() => !!window.MDGCommandes, null, { timeout: 8000 });
        await p.evaluate(id => MDGCommandes.ouvrir(id), cmd.id); await p.waitForTimeout(2500);
        await p.screenshot({ path: path.join(OUT, cle + '.png') });
        texte = await p.evaluate(() => { const s = [...document.querySelectorAll('[class*="cm-"]')].sort((a, b) => b.innerText.length - a.innerText.length)[0]; return s ? s.innerText : ''; });
        boutons = await p.evaluate(() => [...document.querySelectorAll('[class*="cm"] button')].filter(e => e.getClientRects().length).map(e => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(Boolean));
      } catch (e) { pb = String(e.message).split('\n')[0].slice(0, 160); }
      out[cle] = { texte, boutons, erreurs: err, probleme: pb };
      const tech = (texte.match(/\[object Object\]|\bundefined\b|\bNaN\b|Invalid Date/) || [])[0];
      const faute = (texte.match(new RegExp('.{0,30}(' + FAUTES.source + ').{0,20}', 'i')) || [])[0];
      const defauts = [pb && 'ouverture : ' + pb, err.length && 'erreur JS : ' + err[0], texte.trim().length < 30 && 'écran presque vide', !boutons.length && 'aucun bouton', tech && 'texte technique « ' + tech + ' »', faute && 'faute : « ' + faute.replace(/\n/g, ' ').trim() + ' »'].filter(Boolean);
      tests.push({ id: 'CMP-' + (++n), unite: 'U12', type: 'normal', scenario: 'Commande « ' + cle + ' » (' + cmd.role + ', ' + cmd.etat + '/' + cmd.etape + ') : écran lisible', attendu: 'ouvert sans erreur, texte et boutons présents, pas de texte technique ni de faute de liaison', obtenu: defauts.length ? defauts.join(' ; ') : 'ok ; boutons : ' + boutons.slice(0, 5).join(' | '), statut: defauts.length ? 'échoué' : 'réussi', preuve: path.join(OUT, cle + '.png'), date: DATE });
      await ctx.close();
    }
  } finally { await b.close(); if (srv) srv.close(); }
  fs.writeFileSync(path.join(OUT, 'parcours.json'), JSON.stringify({ tests, ecrans: out }, null, 1));
  for (const t of tests) console.log(t.id, t.statut, '·', t.scenario, '→', t.obtenu.slice(0, 200));
  const ech = tests.filter(t => t.statut === 'échoué');
  console.log('Résultats et captures (hors dépôt) : ' + OUT);
  console.log('U12 : ' + tests.length + ' tests · réussi ' + (tests.length - ech.length) + ' · échoué ' + ech.length);
  console.log(ech.length ? 'Échoués : ' + ech.map(t => t.id + ' (' + t.obtenu.slice(0, 60) + ')').join(', ') : 'Aucun échec');
  process.exit(ech.length ? 1 : 0);
})().catch(e => { console.log('U12 arrêt : ' + String(e && e.message || e).slice(0, 200)); process.exit(1); });
