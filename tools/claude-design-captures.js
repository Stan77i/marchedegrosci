/* Captures d'écran pour Claude Design (dossier claude-design/application/captures et claude-design/site/captures).
   Application : iPhone 13, clair et sombre. Site : ordinateur 1440 px, page entière (le site n'a qu'un thème).
   Les données en direct ne sont pas chargées (réponses vides) : les captures ne changent que si le design change,
   et rien n'est inventé. Serveur local nécessaire : `python3 -m http.server 8765` lancé depuis le dépôt.
   Usage : node tools/claude-design-captures.js   (PLAYWRIGHT=chemin du module, CHROMIUM=chemin du navigateur) */
const path = require('path'), fs = require('fs');
const { chromium, devices } = require(process.env.PLAYWRIGHT || '/opt/node-tools/node_modules/playwright');
const R = path.join(__dirname, '..'), D = path.join(R, 'claude-design'), BASE = process.env.BASE || 'http://localhost:8765/';
const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const APP = [
  ['01-accueil-marche', '#/'],
  ['02-accueil-prix', '#/', 'Prix'],
  ['03-accueil-activite', '#/', 'Activité'],
  ['04-accueil-alertes', '#/', 'Alertes'],
  ['05-fiche-produit', '#/produits/tomate'],
  ['06-acheter', '#/catalogue'],
  ['07-vendre', '#/vendre'],
  ['08-demander', '#/demande'],
  ['09-categories', '#/categories'],
  ['10-prix', '#/prix'],
  ['11-annee', '#/annee'],
  ['12-carte', '#/carte'],
];
const SITE = [
  ['01-accueil', 'site/'],
  ['02-produit', 'site/produits/tomate/'],
  ['03-district', 'site/regions/vallee-du-bandama/'],
  ['04-districts', 'site/regions/'],
  ['05-calendrier', 'site/saisons/'],
  ['06-guide', 'site/guides/vendre-sa-recolte/'],
  ['07-guides', 'site/guides/'],
  ['08-a-propos', 'site/a-propos/'],
  ['09-carte', 'site/carte/'],
];

const vide = r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });

(async () => {
  const b = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined });
  for (const sc of ['clair', 'sombre']) {
    const dir = path.join(D, 'application', 'captures'); fs.mkdirSync(dir, { recursive: true });
    for (const [nom, h, onglet] of APP) {
      const c = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, colorScheme: sc === 'sombre' ? 'dark' : 'light' });
      await c.route(/supabase\.co/, vide);
      await c.addInitScript(() => { try { localStorage.setItem('mdg-astuces:off', 'true'); } catch (_) {} });
      const p = await c.newPage();
      await p.goto(BASE + 'application.dc.html?app=1' + h, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(2500);
      await p.getByText('Passer', { exact: true }).click({ timeout: 1500 }).catch(() => {});
      if (onglet) await p.getByText(onglet, { exact: true }).first().click({ timeout: 3000 }).catch(() => {});
      await p.waitForTimeout(nom.includes('carte') ? 4000 : 1500);
      await p.screenshot({ path: path.join(dir, nom + '-' + sc + '.jpg'), type: 'jpeg', quality: 72 });
      await c.close();
    }
    // le site n'a qu'un thème : une seule capture par page
    if (sc === 'sombre') continue;
    const dirS = path.join(D, 'site', 'captures'); fs.mkdirSync(dirS, { recursive: true });
    for (const [nom, u] of SITE) {
      const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: sc === 'sombre' ? 'dark' : 'light' });
      await c.route(/supabase\.co/, vide);
      // le voile « en construction » est levé pour la capture seulement (rien n'est changé sur le site)
      await c.route(/garde\.js/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
      await c.addInitScript(() => { try { localStorage.setItem('mdg-site:admin', '1'); } catch (_) {} });
      const p = await c.newPage();
      await p.goto(BASE + u, { waitUntil: 'networkidle' }).catch(() => {});
      await p.evaluate(() => { document.documentElement.classList.remove('garde'); document.dispatchEvent(new Event('site:ouvert')); });
      await p.waitForTimeout(nom.includes('carte') ? 4000 : 1200);
      await p.screenshot({ path: path.join(dirS, nom + '.jpg'), type: 'jpeg', quality: 62, fullPage: !nom.includes('carte') });
      await c.close();
    }
  }
  await b.close();
  console.log('captures faites');
})();
