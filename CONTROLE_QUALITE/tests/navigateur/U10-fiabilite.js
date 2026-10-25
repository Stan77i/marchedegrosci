#!/usr/bin/env node
/* Batterie navigateur U10 Fiabilité technique (contrôle qualité MGCI, 25/10/2026). Centre de commande : CONTROLE_QUALITE/README.md.
   Lancement : bash tools/controle/lancer.sh navigateur | unite U10 | tout (le lanceur sert le dépôt et donne CQ_URL).
   Seul : CQ_URL=http://127.0.0.1:8765/ node CONTROLE_QUALITE/tests/navigateur/U10-fiabilite.js (sans CQ_URL, un petit serveur local est lancé).
   Variables : CQ_URL (adresse du dépôt servi, finit par /), PLAYWRIGHT_MODULE (chemin de playwright), CHROMIUM (navigateur ; absent sur GitHub),
   CQ_RACINE (dépôt), CQ_SORTIE (dossier des résultats et captures ; par défaut un dossier temporaire, jamais le dépôt).
   - ouvre application.dc.html en iPhone 13 émulé (clair et sombre) et en petit écran 320 px ;
   - Supabase n'est pas joignable : une session et des données FACTICES sont injectées (_faux-serveur.js) ;
   - mesure : erreurs JS, écran vide, débordement horizontal, texte technique, temps de chargement, poids,
     réseau lent (3G), coupure, double envoi, panne du serveur, service worker (mise à jour simulée en mémoire, sw.js n'est pas modifié).
   Code de sortie : 0 tout réussi (ou en attente d'un prérequis), 1 au moins un échec, 3 bloqué (navigateur absent).
   Les 3 dernières lignes affichées sont le résumé repris dans le rapport. */
let PW;
try { PW = require(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/playwright'); }
catch (_) { try { PW = require('playwright'); } catch (e) { console.log('U10 bloqué : Playwright introuvable (PLAYWRIGHT_MODULE)'); process.exit(3); } }
const { chromium, devices } = PW;
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs'), path = require('path'), os = require('os');
const F = require('./_faux-serveur.js');

const DEPOT = path.resolve(process.env.CQ_RACINE || path.join(__dirname, '..', '..', '..'));
const OUT = path.resolve(process.env.CQ_SORTIE || fs.mkdtempSync(path.join(os.tmpdir(), 'cq-U10-')));
const CHROME = process.env.CHROMIUM && fs.existsSync(process.env.CHROMIUM) ? process.env.CHROMIUM : null;
let URLB = process.env.CQ_URL || null;   // adresse du dépôt servi (donnée par tools/controle/lancer.js)
const CAP = path.join(OUT, 'captures');
fs.mkdirSync(CAP, { recursive: true });
const DATE = new Date().toISOString().slice(0, 10);
const tests = [];
let nId = 0;
const T = (o) => { const t = Object.assign({ id: 'FIA-' + String(++nId).padStart(2, '0'), unite: 'U10', date: DATE }, o); tests.push(t); console.log(t.id, t.statut, '·', t.scenario, '→', String(t.obtenu).slice(0, 160)); sauver(); return t; };
const sauver = () => { fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify({ depot: DEPOT, commit: commit(), date: new Date().toISOString(), tests }, null, 1)); };
let _c; const commit = () => { if (_c !== undefined) return _c; try { _c = execSync('git -C ' + JSON.stringify(DEPOT) + ' rev-parse --short HEAD 2>/dev/null').toString().trim(); } catch (_) { _c = (fs.existsSync(path.join(DEPOT, '.commit')) ? fs.readFileSync(path.join(DEPOT, '.commit'), 'utf8').trim() : 'inconnu'); } return _c; };

/* petit serveur statique du dépôt ; « remplace » permet de servir un autre contenu pour un fichier (mise à jour du service worker) */
function serveur(dir, remplace = {}) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    if (remplace[p] != null) { res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'text/plain', 'Cache-Control': 'no-cache' }); res.end(remplace[p]); return; }
    const f = path.join(dir, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => { s.url = 'http://127.0.0.1:' + s.address().port + '/'; r(s); }));
}

const PROFILS = {
  'iphone13-clair': { ...devices['iPhone 13'], colorScheme: 'light' },
  'iphone13-sombre': { ...devices['iPhone 13'], colorScheme: 'dark' },
  'ecran320-clair': { ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, screen: { width: 320, height: 568 }, colorScheme: 'light' },
  'ecran320-sombre': { ...devices['iPhone SE'], viewport: { width: 320, height: 568 }, screen: { width: 320, height: 568 }, colorScheme: 'dark' },
};

async function contexte(browser, profil, opt = {}) {
  const ctx = await browser.newContext({ ...PROFILS[profil], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', serviceWorkers: opt.sw ? 'allow' : 'block' });
  const journal = []; const etat = { mode: 'ok', retard: 0 };
  await F.brancher(ctx, journal, etat);
  await ctx.addInitScript(([MOI, tutos, theme]) => {
    if (sessionStorage.getItem('mdg-ctrl-init')) return; sessionStorage.setItem('mdg-ctrl-init', '1');
    localStorage.setItem('mdg-nuage:session', JSON.stringify({ access_token: 'faux', refresh_token: 'faux', expires_at: 4102444800, user: { id: MOI, tel: '0701020304' } }));
    localStorage.setItem('mdg-nuage:proprio', JSON.stringify(MOI));
    localStorage.setItem('mdg-compte:profil', JSON.stringify({ user_id: MOI, prenom: 'Test', nom: 'Contrôle', role: 'les_deux', region_slug: 'abidjan', ville: 'Abidjan' }));
    if (!tutos) { localStorage.setItem('mdg-astuces:off', 'true'); localStorage.setItem('mdg-guide:vu', 'true'); }
    if (theme) localStorage.setItem('mdg-theme', JSON.stringify(theme));
  }, [F.MOI, !!opt.tutos, opt.theme || null]);
  return { ctx, journal, etat };
}

// mesures faites DANS la page
const MESURE = () => {
  const W = innerWidth, vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && +c.opacity > 0.05; };
  const clippe = e => { for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' && c.overflowX !== 'clip' || c.overflow === 'hidden') { const r = a.getBoundingClientRect(); if (r.right <= W + 1 && r.left >= -1) return true; } } return false; };
  const deb = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    if ((r.right > W + 2 || r.left < -2) && r.width < W * 3 && !clippe(e) && getComputedStyle(e).position !== 'fixed') deb.push({ el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), txt: (e.innerText || '').trim().slice(0, 40), gauche: Math.round(r.left), droite: Math.round(r.right) });
  }
  // texte technique visible ([object Object], undefined, NaN, null)
  const tech = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const v = n.nodeValue; if (n.parentElement.closest('script,style,noscript,template')) continue; if (/\[object Object\]|\bundefined\b|\bNaN\b|^\s*null\s*$/.test(v)) { const e = n.parentElement; let op = 1, cache = false; for (let a = e; a; a = a.parentElement) { const c = getComputedStyle(a); op *= +c.opacity; if (a.getAttribute && a.getAttribute('aria-hidden') === 'true') cache = true; } tech.push({ texte: v.trim().slice(0, 60), el: e.tagName.toLowerCase() + '.' + String(e.className || '').split(' ')[0], visibleAEcran: op > 0.05 && vis(e), luParLecteurEcran: !cache }); } }
  // le contenu au centre de l'écran (la fenêtre du dessus)
  // la fenêtre du dessus = le premier ancêtre de l'élément central qui couvre au moins 40 % de l'écran
  const pt = document.elementFromPoint(W / 2, innerHeight / 2); let haut = null; for (let a = pt; a && !haut; a = a.parentElement) { const r = a.getBoundingClientRect(); if (r.width * Math.min(r.height, innerHeight) >= 0.4 * W * innerHeight) haut = a; }
  const txtHaut = haut ? (haut.innerText || '').trim() : '';
  const nb = [...document.querySelectorAll('button,a,input,select,textarea')].filter(vis).length;
  // cibles tactiles trop petites (< 32 px) dans la fenêtre visible
  const petits = [...document.querySelectorAll('button,a,[role=button],input[type=checkbox],input[type=radio]')].filter(e => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= W && (r.width < 32 || r.height < 32); }).map(e => (e.getAttribute('aria-label') || e.innerText || e.className || '').toString().trim().slice(0, 30));
  return { largeurPage: document.documentElement.scrollWidth, largeurEcran: W, debordePage: document.documentElement.scrollWidth > W + 1, elementsQuiDebordent: deb.slice(0, 8), nbDebordements: deb.length, texteTechnique: tech.slice(0, 5), texteFenetreHaut: txtHaut.slice(0, 300), longueurTexteHaut: txtHaut.length, longueurTexteTotal: (document.documentElement.innerText || '').trim().length, elementsInteractifs: nb, ciblesPetites: petits.slice(0, 10), nbCiblesPetites: petits.length };
};

const ECRANS = [
  { cle: 'accueil', nom: 'Accueil', hash: '#/' },
  { cle: 'carte', nom: 'Carte du réseau', hash: '#/carte' },
  { cle: 'annonces', nom: 'Annonces (catalogue)', hash: '#/catalogue' },
  { cle: 'publier-offre', nom: 'Publier une offre', hash: '#/vendre' },
  { cle: 'publier-demande', nom: 'Publier une demande', hash: '#/demande' },
  { cle: 'prix', nom: 'Prix', hash: '#/prix' },
  { cle: 'negociations', nom: 'Liste des négociations', hash: '#/', js: 'MDGNegoce.inbox()', attend: 'MDGNegoce' },
  { cle: 'negociation', nom: 'Une négociation', hash: '#/', js: `MDGNegoce.thread('${F.NEGOS[0].id}')`, attend: 'MDGNegoce' },
  { cle: 'commandes', nom: 'Mes commandes', hash: '#/', js: 'MDGCommandes.ouvrir()', attend: 'MDGCommandes' },
  { cle: 'commande', nom: 'Une commande (en route)', hash: '#/', js: `MDGCommandes.ouvrir('${F.CMDS[0].id}')`, attend: 'MDGCommandes' },
  { cle: 'messages', nom: 'Messages', hash: '#/', js: 'MDGMessages.boite()', attend: 'MDGMessages' },
  { cle: 'compte', nom: 'Mon compte', hash: '#/', js: 'MDGCompte.ouvrir()', attend: 'MDGCompte' },
  { cle: 'reglages', nom: 'Réglages', hash: '#/', js: 'MDGTheme.ouvrir()', attend: 'MDGTheme' },
  { cle: 'aide', nom: 'L’aide', hash: '#/', js: 'MDGAide.ouvrir()', attend: 'MDGAide' },
];

async function ouvrirEcran(p, e, base = URLB) {
  await p.goto(base + 'application.dc.html' + e.hash, { waitUntil: 'load', timeout: 60000 });
  await p.waitForFunction(() => { const s = document.querySelector('.spl'); return !s || getComputedStyle(s).opacity === '0' || getComputedStyle(s).pointerEvents === 'none'; }, null, { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1200);
  if (e.js) {
    const pret = await p.waitForFunction(n => !!window[n], e.attend, { timeout: 8000 }).then(() => true).catch(() => false);
    if (!pret) return 'module ' + e.attend + ' absent';
    await p.evaluate(e.js).catch(x => { throw new Error('ouverture : ' + x.message); });
    await p.waitForTimeout(1500);
  }
  return null;
}

(async () => {
  let srv = null;
  if (!URLB) { srv = await serveur(DEPOT); URLB = srv.url; }
  let browser;
  try { browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {}); }
  catch (e) { console.log('U10 bloqué : le navigateur ne démarre pas (' + String(e.message).split('\n')[0].slice(0, 120) + ')'); if (srv) srv.close(); process.exit(3); }
  const ecransRes = [];
  try {
    /* ——— 1. chaque écran principal, 4 profils ——— */
    for (const profil of Object.keys(PROFILS)) {
      const { ctx, journal } = await contexte(browser, profil);
      for (const e of ECRANS) {
        const p = await ctx.newPage(); const err = [];
        p.on('pageerror', x => err.push('exception : ' + x.message.slice(0, 200)));
        p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) err.push('console : ' + m.text().slice(0, 200)); });
        let pb = null, m = null;
        try { pb = await ouvrirEcran(p, e); m = await p.evaluate(MESURE); m.ariaObjet = /\[object Object\]|undefined|Invalid Date|NaN/.test(await p.locator('body').ariaSnapshot().catch(() => '')) ? ((await p.locator('body').ariaSnapshot()).match(/.{0,60}(\[object Object\]|undefined|Invalid Date|NaN).{0,20}/) || [''])[0] : ''; await p.screenshot({ path: path.join(CAP, `${profil}-${e.cle}.png`) }); }
        catch (x) { pb = x.message.slice(0, 200); }
        ecransRes.push({ profil, ecran: e.cle, nom: e.nom, probleme: pb, erreurs: err, mesure: m });
        await p.close();
      }
      await ctx.close();
    }
    // tests par écran : erreurs JS / vide / débordement / texte technique (regroupés par écran sur les 4 profils)
    for (const e of ECRANS) {
      const L = ecransRes.filter(r => r.ecran === e.cle);
      const errs = L.filter(r => r.erreurs.length || r.probleme);
      T({ type: 'normal', scenario: `Écran « ${e.nom} » : erreurs JavaScript (4 profils)`, attendu: 'aucune exception ni erreur console', obtenu: errs.length ? errs.map(r => r.profil + ' : ' + (r.probleme || '') + ' ' + r.erreurs.slice(0, 2).join(' | ')).join(' ; ') : 'aucune erreur', statut: errs.length ? 'échoué' : 'réussi', preuve: `captures/*-${e.cle}.png` });
      const vides = L.filter(r => r.mesure && (r.mesure.longueurTexteHaut < 15 && r.mesure.elementsInteractifs < 3));
      T({ type: 'normal', scenario: `Écran « ${e.nom} » : pas d’écran vide`, attendu: 'du contenu visible au centre', obtenu: vides.length ? 'vide sur : ' + vides.map(r => r.profil).join(', ') : 'contenu présent (' + L.map(r => r.mesure ? r.mesure.longueurTexteHaut : '?').join('/') + ' caractères au centre)', statut: vides.length ? 'échoué' : 'réussi', preuve: `captures/*-${e.cle}.png` });
      const deb = L.filter(r => r.mesure && (r.mesure.debordePage || r.mesure.nbDebordements));
      T({ type: 'limite', scenario: `Écran « ${e.nom} » : débordement horizontal (390 et 320 px)`, attendu: 'rien ne dépasse la largeur de l’écran', obtenu: deb.length ? deb.map(r => `${r.profil} : page ${r.mesure.largeurPage}/${r.mesure.largeurEcran}px, ${r.mesure.nbDebordements} élément(s) ${JSON.stringify(r.mesure.elementsQuiDebordent.slice(0, 3))}`).join(' ; ') : 'aucun débordement', statut: deb.length ? 'échoué' : 'réussi', preuve: `captures/*-${e.cle}.png` });
      const tech = L.filter(r => r.mesure && (r.mesure.texteTechnique.length || r.mesure.ariaObjet));
      T({ type: 'erreur', scenario: `Écran « ${e.nom} » : texte technique (« [object Object] », « undefined », « NaN », « Invalid Date »)`, attendu: 'jamais à l’écran ni pour le lecteur d’écran', obtenu: tech.length ? tech.map(r => r.profil + ' : ' + JSON.stringify(r.mesure.texteTechnique.slice(0, 2)) + (r.mesure.ariaObjet ? ' ; lu par le lecteur d’écran : « ' + r.mesure.ariaObjet.trim() + ' »' : '')).join(' ; ') : 'aucun', statut: tech.some(r => r.mesure.ariaObjet || r.mesure.texteTechnique.some(x => x.visibleAEcran)) ? 'échoué' : 'réussi', preuve: 'MESURE.texteTechnique + ariaSnapshot' });
    }
    fs.writeFileSync(path.join(OUT, 'ecrans.json'), JSON.stringify(ecransRes, null, 1));

    /* ——— 2. chargement : temps et poids (cache vide, réseau local) ——— */
    {
      const { ctx } = await contexte(browser, 'iphone13-clair');
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      let octets = 0, n = 0; const parType = {}; const types = {};
      cdp.on('Network.responseReceived', x => { types[x.requestId] = x.type; });
      cdp.on('Network.loadingFinished', x => { octets += x.encodedDataLength; n++; const t = types[x.requestId] || 'autre'; parType[t] = (parType[t] || 0) + x.encodedDataLength; });
      const t0 = Date.now();
      await p.goto(URLB + 'application.dc.html#/', { waitUntil: 'load', timeout: 60000 });
      const nav = await p.evaluate(() => { const x = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(x.domContentLoadedEventEnd), load: Math.round(x.loadEventEnd) }; });
      const pret = await p.waitForFunction(() => /Bonjour/.test(document.documentElement.innerText), null, { timeout: 30000 }).then(() => Date.now() - t0).catch(() => null);
      await p.waitForTimeout(3000);
      const ko = Math.round(octets / 1024);
      T({ type: 'normal', scenario: 'Chargement de l’accueil, cache vide, réseau local (iPhone 13)', attendu: 'DOMContentLoaded < 2 s et load < 4 s en local', obtenu: `DOMContentLoaded ${nav.dcl} ms, load ${nav.load} ms, accueil lisible (« Bonjour ») à ${pret} ms`, statut: nav.dcl < 2000 && nav.load < 4000 ? 'réussi' : 'échoué', preuve: 'performance navigation' });
      T({ type: 'limite', scenario: 'Poids téléchargé à la première ouverture (sans cache, sans polices ni tuiles extérieures)', attendu: '< 3 Mo (repère pour forfait mobile)', obtenu: `${ko} Ko en ${n} fichiers ; par type : ${Object.entries(parType).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(v / 1024) + ' Ko').join(', ')}`, statut: ko < 3072 ? 'réussi' : 'échoué', preuve: 'CDP Network.loadingFinished' });
      await ctx.close();
    }

    /* ——— 3. réseau lent : « Slow 3G » (400 ms, 400 kbit/s) ——— */
    {
      const { ctx, etat } = await contexte(browser, 'iphone13-clair'); etat.retard = 2000;   // le serveur répond aussi lentement (2 s)
      const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
      const t0 = Date.now(); const shots = [];
      await p.goto(URLB + 'application.dc.html#/', { waitUntil: 'commit', timeout: 180000 });
      for (const s of [3, 8, 15]) { await p.waitForTimeout(s * 1000 - (Date.now() - t0)).catch(() => {}); const f = path.join(CAP, `3g-${s}s.png`); await p.screenshot({ path: f }); shots.push({ s, txt: await p.evaluate(() => { const s = document.querySelector('.spl'); return s && getComputedStyle(s).opacity !== '0' ? 'écran d’attente : ' + s.innerText.trim() : 'app : ' + (document.documentElement.innerText || '').trim().slice(0, 60).replace(/\n/g, ' '); }).catch(() => '?') }); }
      const pret = await p.waitForFunction(() => /Bonjour/.test(document.documentElement.innerText), null, { timeout: 150000 }).then(() => Date.now() - t0).catch(() => null);
      const nav = await p.evaluate(() => { const x = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(x.domContentLoadedEventEnd), load: Math.round(x.loadEventEnd) }; }).catch(() => ({}));
      T({ type: 'panne', scenario: 'Réseau lent « Slow 3G » + serveur lent (2 s), première ouverture', attendu: 'un écran d’attente clair, puis l’accueil lisible en moins de 30 s ; jamais d’écran blanc', obtenu: `DOMContentLoaded ${nav.dcl} ms, load ${nav.load} ms, accueil lisible à ${pret == null ? 'jamais (> 150 s)' : pret + ' ms'} ; ${shots.map(x => x.s + ' s → ' + x.txt).join(' ; ')}`, statut: pret != null && pret < 30000 && !shots.some(x => /^app : $/.test(x.txt)) ? 'réussi' : 'échoué', preuve: 'captures/3g-*.png' });
      await ctx.close();
    }

    /* ——— 4. coupure du réseau ——— */
    {
      const { ctx, journal } = await contexte(browser, 'iphone13-clair');
      const p = await ctx.newPage(); const err = []; p.on('pageerror', x => err.push(x.message));
      await ouvrirEcran(p, ECRANS[0]);
      await ctx.setOffline(true); await p.evaluate(() => dispatchEvent(new Event('offline'))); await p.waitForTimeout(1500);
      const bandeau = await p.evaluate(() => (document.documentElement.innerText.match(/[^\n]*(hors connexion|pas de connexion|sans réseau|pas de réseau|pas d.internet|connexion (perdue|coupée)|hors ligne)[^\n]*/i) || [null])[0]);
      await p.screenshot({ path: path.join(CAP, 'coupure-accueil.png') });
      T({ type: 'panne', scenario: 'Coupure du réseau sur l’accueil', attendu: 'un message clair « hors connexion » (ou équivalent), l’app reste utilisable', obtenu: bandeau ? 'message : « ' + bandeau.trim().slice(0, 120) + ' »' : 'aucun message visible de coupure ; ' + (err.length ? 'exceptions : ' + err.slice(0, 2).join(' | ') : 'pas d’exception'), statut: bandeau ? 'réussi' : 'échoué', preuve: 'captures/coupure-accueil.png' });
      // négociation : écrire hors connexion
      await p.evaluate(`MDGNegoce.thread('${F.NEGOS[0].id}')`).catch(() => {}); await p.waitForTimeout(1500);
      const ta = p.locator('textarea').last();
      let r = { envoi: 'champ introuvable' };
      if (await ta.count()) {
        await ta.fill('Message écrit sans réseau');
        const avant = journal.length;
        await ta.press('Enter').catch(() => {});
        const bt = p.locator('button[aria-label*="nvoyer"], button:has-text("Envoyer")').last(); if (await bt.count()) await bt.click({ timeout: 2000 }).catch(() => {});
        await p.waitForTimeout(1500);
        r = await p.evaluate(() => ({ garde: [...document.querySelectorAll('textarea')].map(t => t.value).filter(Boolean), msg: (document.documentElement.innerText.match(/[^\n]*(réseau|connexion|ne répond pas|réessayez|plus tard|enverra|partira)[^\n]*/i) || [null])[0] }));
        r.requetes = journal.length - avant;
      }
      await p.screenshot({ path: path.join(CAP, 'coupure-negociation.png') });
      const bulle = await p.evaluate(() => /Message écrit sans réseau/.test([...document.querySelectorAll('.nx *')].filter(e => !e.matches('textarea')).map(e => e.childNodes.length === 1 ? e.textContent : '').join(' ')));
      T({ type: 'panne', scenario: 'Négociation : envoyer un message sans réseau', attendu: 'message clair, texte gardé (dans le champ ou en attente d’envoi), pas d’erreur muette', obtenu: JSON.stringify(Object.assign(r, { affichéCommeEnvoyé: bulle })), statut: r.msg && (r.garde && r.garde.length || bulle) ? 'réussi' : 'échoué', preuve: 'captures/coupure-negociation.png' });
      // formulaire de vente : brouillon gardé après rechargement
      await ctx.setOffline(false);
      await p.goto('about:blank'); await p.goto(URLB + 'application.dc.html#/vendre', { waitUntil: 'load' }); await p.waitForTimeout(2500);
      let br = '';
      try {
        await p.getByRole('button', { name: /Choisir un produit/ }).last().click({ timeout: 4000 }); await p.waitForTimeout(800);
        await p.keyboard.type('igname'); await p.waitForTimeout(600); await p.getByRole('button', { name: /^Igname/ }).first().click({ timeout: 4000 }); await p.waitForTimeout(600);
        const qv = p.locator('.sc-host input[placeholder="ex. 20"]').filter({ visible: true }).first(); await qv.scrollIntoViewIfNeeded(); await qv.click(); await p.keyboard.type('37'); await p.waitForTimeout(500);
        await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
        br = 'après rechargement : ' + await p.locator('.sc-host input[placeholder="ex. 20"]').first().inputValue() + ' ; produit : ' + (await p.evaluate(() => (JSON.parse(localStorage.getItem('mdg-app:brouillon-offre') || '{}').slug) || ''));
      } catch (x) { br = 'introuvable : ' + x.message.slice(0, 80); }
      T({ type: 'panne', scenario: 'Publier une offre : la saisie survit à une fermeture/rechargement', attendu: 'la quantité tapée est retrouvée', obtenu: br, statut: /après rechargement : 37/.test(br) ? 'réussi' : /introuvable/.test(br) ? 'non exécuté' : 'échoué', preuve: 'application.dc.html setVf (mdg-app:brouillon-offre)' });
      await ctx.close();
    }

    /* ——— 5. panne du serveur (503) ——— */
    {
      const { ctx, etat } = await contexte(browser, 'iphone13-clair');
      const p = await ctx.newPage(); const err = []; p.on('pageerror', x => err.push(x.message));
      await ouvrirEcran(p, ECRANS[0]);
      // vider les copies locales des commandes pour voir le vrai comportement en panne
      await p.evaluate(() => Object.keys(localStorage).filter(k => /^mdg-commandes:/.test(k)).forEach(k => localStorage.removeItem(k)));
      etat.mode = 'panne';
      await p.evaluate('MDGCommandes.ouvrir()'); await p.waitForTimeout(2500);
      const t = await p.evaluate(() => (document.documentElement.innerText.match(/[^\n]*(indisponible|réessayez|ne répond pas|problème|erreur)[^\n]*/i) || [null])[0]);
      await p.screenshot({ path: path.join(CAP, 'panne-commandes.png') });
      T({ type: 'panne', scenario: 'Serveur en panne (503) à l’ouverture de « Mes commandes »', attendu: 'message clair (« indisponible, réessayez »), pas d’écran « aucune commande » trompeur', obtenu: (t ? 'message : « ' + t.trim().slice(0, 140) + ' »' : 'aucun message d’erreur') + ' ; texte central : ' + (await p.evaluate(() => (document.documentElement.innerText.match(/[^\n]*(aucune commande|pas encore de commande)[^\n]*/i) || ['—'])[0])), statut: t ? 'réussi' : 'échoué', preuve: 'captures/panne-commandes.png' });
      etat.mode = 'panne';
      await p.goto(URLB + 'application.dc.html#/', { waitUntil: 'load' }); await p.waitForTimeout(4000);
      const accueil = await p.evaluate(() => /Bonjour/.test(document.documentElement.innerText));
      T({ type: 'panne', scenario: 'Serveur en panne (503) au rechargement de l’accueil', attendu: 'l’accueil s’affiche avec les annonces gardées sur le téléphone', obtenu: accueil ? 'accueil affiché' : 'accueil absent', statut: accueil ? 'réussi' : 'échoué', preuve: 'v3/nuage.js refresh (cache mdg-nuage:offres)' });
      await ctx.close();
    }

    /* ——— 6. double clic : un seul envoi ? (serveur lent 1,5 s) ——— */
    {
      const { ctx, journal, etat } = await contexte(browser, 'iphone13-clair');
      const p = await ctx.newPage();
      await ouvrirEcran(p, ECRANS[0]);
      etat.retard = 1500;
      // a) message dans une négociation
      await p.evaluate(`MDGNegoce.thread('${F.NEGOS[0].id}')`); await p.waitForTimeout(2500);
      const ta = p.locator('textarea').last(); let res = 'champ introuvable';
      if (await ta.count()) {
        await ta.fill('Double envoi ?');
        const bt = p.locator('.nx button[aria-label*="nvoyer"], .nx button:has-text("Envoyer")').last();
        if (await bt.count()) {
          const avant = journal.length; await bt.dblclick({ timeout: 3000 }).catch(() => {}); await bt.click({ timeout: 500, force: true }).catch(() => {}); await p.waitForTimeout(4000);
          const env = journal.slice(avant).filter(x => x.m === 'POST' && (/messages/.test(x.p) || /nego_agir|message/.test(x.fn || '')));
          res = `${env.length} envoi(s) pour 3 clics rapides (${env.map(x => x.fn || x.p).join(', ')})`;
          T({ type: 'concurrent', scenario: 'Négociation : 3 clics rapides sur « Envoyer », serveur lent', attendu: 'un seul envoi', obtenu: res, statut: env.length === 1 ? 'réussi' : env.length === 0 ? 'bloqué' : 'échoué', preuve: 'requêtes interceptées (faux-serveur.js)' });
        } else T({ type: 'concurrent', scenario: 'Négociation : clics rapides sur « Envoyer »', attendu: 'un seul envoi', obtenu: 'bouton Envoyer introuvable', statut: 'non exécuté', preuve: '—' });
      }
      await p.screenshot({ path: path.join(CAP, 'double-negociation.png') });
      // b) commande à confirmer (vendeur) : bouton principal
      await p.goto(URLB + 'application.dc.html#/', { waitUntil: 'load' }); await p.waitForTimeout(2500);
      await p.evaluate(`MDGCommandes.ouvrir('${F.CMDS[1].id}')`); await p.waitForTimeout(2500);
      const bc = p.locator('button:has-text("Confirmer la commande")').first();
      if (await bc.count() && await bc.isVisible().catch(() => false)) {
        const lib = (await bc.innerText()).trim(); const avant = journal.length;
        await bc.dblclick({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(800);
        // une fenêtre de confirmation peut s'ouvrir : on la valide deux fois
        const conf = p.locator('button:has-text("Confirmer"), button:has-text("Oui")').last(); if (await conf.count()) { await conf.dblclick({ timeout: 2000 }).catch(() => {}); }
        await p.waitForTimeout(4000);
        const env = journal.slice(avant).filter(x => x.m === 'POST' && /commande_(repondre|confirmer)/.test(x.fn || ''));
        T({ type: 'concurrent', scenario: `Commande à confirmer : double clic sur « ${lib} », serveur lent`, attendu: 'un seul envoi', obtenu: `${env.length} envoi(s) (${env.map(x => x.fn).join(', ')})`, statut: env.length === 1 ? 'réussi' : env.length === 0 ? 'bloqué' : 'échoué', preuve: 'captures/double-commande.png' });
      } else T({ type: 'concurrent', scenario: 'Commande à confirmer : double clic', attendu: 'un seul envoi', obtenu: 'bouton « Confirmer/Accepter » introuvable avec les données factices', statut: 'non exécuté', preuve: 'captures/double-commande.png' });
      await p.screenshot({ path: path.join(CAP, 'double-commande.png') });
      fs.writeFileSync(path.join(OUT, 'journal-double.json'), JSON.stringify(journal.filter(x => x.m === 'POST').map(x => x.fn || x.p)));
      await ctx.close();
    }

    /* ——— 7. tutoriels au premier lancement (gênent-ils l'écran ?) ——— */
    {
      const { ctx } = await contexte(browser, 'iphone13-clair', { tutos: true });
      const p = await ctx.newPage();
      await ouvrirEcran(p, ECRANS[7]);
      const t = await p.evaluate(() => { const e = document.querySelector('.as-off'); if (!e) return null; let c = e.parentElement; while (c && !c.querySelector('h2,h3,b,strong')) c = c.parentElement; return (c || e.parentElement).innerText.trim().slice(0, 200).replace(/\n+/g, ' / '); });
      await p.screenshot({ path: path.join(CAP, 'tutoriel-sur-negociation.png') });
      T({ type: 'normal', scenario: 'Premier lancement : ouverture directe d’une négociation (depuis une notification)', attendu: 'le tutoriel correspond à l’écran ouvert', obtenu: t ? 'tutoriel affiché : ' + t : 'pas de tutoriel', statut: t && /Chaque ligne est une négociation/.test(t) ? 'échoué' : 'réussi', preuve: 'captures/tutoriel-sur-negociation.png', note: 'tutoriel de la LISTE affiché sur une négociation ouverte' });
      await ctx.close();
    }

    /* ——— 8. service worker : cache et mise à jour (sur une COPIE) ——— */
    {
      const remplace = {}; const s2 = await serveur(DEPOT, remplace);   // serveur à part : sw.js est remplacé en mémoire, le dépôt n'est pas touché
      const { ctx } = await contexte(browser, 'iphone13-clair', { sw: true });
      const p = await ctx.newPage();
      await p.goto(s2.url + 'application.dc.html#/', { waitUntil: 'load' });
      await p.waitForTimeout(8000);
      const etat1 = await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const k = await caches.keys(); const n = {}; for (const c of k) n[c] = (await (await caches.open(c)).keys()).length; return { actif: !!(r && r.active), controle: !!navigator.serviceWorker.controller, caches: n }; });
      T({ type: 'normal', scenario: 'Service worker : installation et mise en cache', attendu: 'actif, réserve « mgci-vNNN » remplie', obtenu: JSON.stringify(etat1), statut: etat1.actif && Object.keys(etat1.caches).some(k => /^mgci-v\d+/.test(k) && etat1.caches[k] > 20) ? 'réussi' : 'échoué', preuve: 'sw.js' });
      // hors connexion : l'app s'ouvre-t-elle depuis le cache ?
      await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
      await ctx.setOffline(true);
      const okHors = await p.reload({ waitUntil: 'load', timeout: 30000 }).then(() => p.waitForFunction(() => /Bonjour/.test(document.documentElement.innerText), null, { timeout: 20000 })).then(() => true).catch(e => e.message.slice(0, 80));
      await p.screenshot({ path: path.join(CAP, 'sw-hors-connexion.png') });
      T({ type: 'panne', scenario: 'Service worker : ouvrir l’app sans réseau (après une première visite)', attendu: 'l’accueil s’affiche depuis le cache', obtenu: okHors === true ? 'accueil affiché hors connexion' : 'échec : ' + okHors, statut: okHors === true ? 'réussi' : 'échoué', preuve: 'captures/sw-hors-connexion.png' });
      await ctx.setOffline(false);
      // nouvelle version : CACHE change
      const src = fs.readFileSync(path.join(DEPOT, 'sw.js'), 'utf8'); const m = src.match(/const CACHE = 'mgci-v(\d+)'/);
      if (m) {
        const neuf = 'mgci-v' + (+m[1] + 1);
        remplace['/sw.js'] = src.replace(m[0], `const CACHE = '${neuf}'`);
        await p.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update())).catch(() => {});
        await p.waitForTimeout(10000);
        const e2 = await p.evaluate(async () => ({ caches: await caches.keys() })).catch(e => ({ err: e.message }));
        await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(2000);
        const e3 = await p.evaluate(async () => ({ caches: await caches.keys() })).catch(e => ({ err: e.message }));
        const ok = e3.caches && e3.caches.includes(neuf) && !e3.caches.includes('mgci-v' + m[1]);
        T({ type: 'régression', scenario: `Service worker : mise à jour (CACHE ${'mgci-v' + m[1]} → ${neuf})`, attendu: 'la nouvelle réserve remplace l’ancienne, sans perdre les annonces locales', obtenu: 'après update : ' + JSON.stringify(e2) + ' ; après rechargement : ' + JSON.stringify(e3), statut: ok ? 'réussi' : 'échoué', preuve: 'sw.js install/activate' });
      }
      await ctx.close(); s2.close();
    }

    /* ——— prérequis manquants ——— */
    T({ type: 'normal', scenario: 'Notifications poussées réelles (réception, ouverture du bon écran)', attendu: 'la notification ouvre l’écran précis', obtenu: 'non testable ici', statut: 'en attente : prérequis', preuve: 'prérequis : vrai téléphone + serveur Supabase joignable + clés VAPID' });
    T({ type: 'normal', scenario: 'Parcours complet contre le vrai serveur (publication, négociation, commande)', attendu: 'mêmes écrans avec de vraies réponses', obtenu: 'serveur bloqué par le proxy de l’environnement', statut: 'en attente : prérequis', preuve: 'prérequis : autoriser catmsypctymgkjkfzdkt.supabase.co (docs/A-FAIRE-PROPRIETAIRE.md)' });
    T({ type: 'panne', scenario: 'Réseau réel ivoirien (2G/3G instable, coupures courtes) sur un téléphone d’entrée de gamme', attendu: 'temps et mémoire acceptables', obtenu: 'émulation seulement (CPU de l’ordinateur)', statut: 'en attente : prérequis', preuve: 'prérequis : vrai téléphone Android d’entrée de gamme' });
  } finally {
    await browser.close(); if (srv) srv.close(); sauver(); ecrireMd();
  }
  const c = {}; tests.forEach(t => { c[t.statut] = (c[t.statut] || 0) + 1; });
  const ech = tests.filter(t => t.statut === 'échoué');
  console.log('Résultats et captures (hors dépôt) : ' + OUT);
  console.log('U10 : ' + tests.length + ' tests · ' + Object.entries(c).map(([k, v]) => k + ' ' + v).join(' · '));
  console.log(ech.length ? 'Échoués : ' + ech.map(t => t.id).join(', ') : 'Aucun échec');
  process.exit(ech.length ? 1 : 0);
})().catch(e => { console.log('U10 arrêt : ' + String(e && e.message || e).slice(0, 200)); process.exit(1); });

function ecrireMd() {
  const c = {}; tests.forEach(t => { c[t.statut] = (c[t.statut] || 0) + 1; });
  const L = ['# Contrôle navigateur — résultats', '', `Dépôt : \`${DEPOT}\` · commit ${commit()} · ${new Date().toISOString()}`, '', 'Données factices injectées (faux-serveur.js) : le vrai serveur n’est pas joignable.', '', 'Bilan : ' + Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · '), '',
    '| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Preuve | Date |', '|---|---|---|---|---|---|---|---|---|'];
  const e = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  tests.forEach(t => L.push(`| ${t.id} | ${t.unite} | ${t.type} | ${e(t.scenario)} | ${e(t.attendu)} | ${e(t.obtenu)} | ${t.statut} | ${e(t.preuve)} | ${t.date} |`));
  fs.writeFileSync(path.join(OUT, 'resultats.md'), L.join('\n') + '\n');
}
