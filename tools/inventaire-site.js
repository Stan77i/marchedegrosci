#!/usr/bin/env node
/* Marché de Gros CI — inventaire automatique du site et de l'application.
   Réécrit la partie entre <!-- INVENTAIRE:DEBUT --> et <!-- INVENTAIRE:FIN --> de PORTAGE-SITE.md :
   pages, fichiers chargés (avec leur poids), modules communs / propres à l'application / propres au site,
   ce qui utilise WebGL, les fichiers lourds, et les fichiers que plus aucune page ne charge.
   Sans dépendance : `node tools/inventaire-site.js`. Lancé aussi par .github/workflows/rapport-site.yml.
   La date ne change que si le contenu change (pas de commit inutile). */
'use strict';
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
const lire = f => { try { return fs.readFileSync(path.join(R, f), 'utf8'); } catch (_) { return ''; } };
const taille = f => { try { return fs.statSync(path.join(R, f)).size; } catch (_) { return 0; } };
const ko = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' ko';

const PAGES = [
  ['application.dc.html', 'Application mobile (la priorité). S’ouvre sur téléphone ; sur ordinateur, seulement pour l’administrateur.'],
  ['index-v3.html', 'Site pour ordinateur. Aujourd’hui caché derrière la maintenance, ouvert seulement à l’administrateur.'],
  ['index.html', 'Aiguillage : téléphone → application, ordinateur → maintenance (ou site pour l’administrateur).'],
  ['maintenance.html', 'Page « site en maintenance » avec QR code vers l’application.'],
  ['suivi.html', 'Lien de suivi envoyé au chauffeur (sans compte).'],
  ['admin.html', 'Tableau de bord de l’administrateur.']
];

// fichiers chargés par une page : <script src>, <link href>, et les listes de chargement différé ('v3/x.js?v=…')
function charges(page) {
  const s = lire(page), L = new Set();
  for (const m of s.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)) L.add(m[1]);
  for (const m of s.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) L.add(m[1]);
  for (const m of s.matchAll(/['"](?:\.\/)?((?:app|v2|v3|css|vendor)\/[\w\-./]+\.(?:js|jsx|css|mjs))(?:\?v=[\w]+)?['"]/g)) L.add(m[1]);
  // modules chargés à la demande par un module déjà chargé (import('./…'))
  return [...L];
}
function avecImports(liste) {
  const L = new Set(liste.map(u => u.replace(/^\.\//, '').replace(/\?.*$/, '')));
  let ajout = true;
  while (ajout) { ajout = false;
    for (const f of [...L]) { if (/^https?:/.test(f)) continue; const dir = path.posix.dirname(f);
      for (const m of lire(f).matchAll(/(?:import\(|from\s+)['"](\.{1,2}\/[\w\-./]+\.m?js)['"]/g)) { const g = path.posix.normalize(dir + '/' + m[1]); if (!L.has(g)) { L.add(g); ajout = true; } } } }
  return [...L];
  return [...L].map(u => u.replace(/^\.\//, '')).filter(u => !/^https?:/.test(u) || true);
}
const propre = u => u.replace(/\?.*$/, '');

const parPage = {};
for (const [p] of PAGES) parPage[p] = avecImports(charges(p).map(propre));
const app = new Set(parPage['application.dc.html']), site = new Set(parPage['index-v3.html']);
const communs = [...app].filter(f => site.has(f) && !/^https?:/.test(f)).sort();
const appSeule = [...app].filter(f => !site.has(f) && !/^https?:/.test(f)).sort();
const siteSeul = [...site].filter(f => !app.has(f)).sort();

// WebGL : fichiers chargés par le site qui ouvrent un contexte WebGL (ou MapLibre / three.js)
const webgl = f => /^https?:/.test(f) ? false : /getContext\(\s*['"](?:webgl2?|experimental-webgl)['"]|new\s+maplibregl\.Map|THREE\.WebGLRenderer/.test(lire(f));
const siteGL = [...site].filter(webgl).sort(), appGL = [...app].filter(webgl).sort();

// fichiers lourds chargés par le site
const lourdsSite = [...site].filter(f => !/^https?:/.test(f)).map(f => [f, taille(f)]).filter(x => x[1] > 150 * 1024).sort((a, b) => b[1] - a[1]);
const externes = [...site].filter(f => /^https?:/.test(f));

// fichiers JS/CSS de app/, v2/, v3/, css/ que plus rien ne cite (ni une page, ni un autre fichier)
const tout = [];
for (const d of ['app', 'v2', 'v3', 'css']) for (const f of fs.readdirSync(path.join(R, d))) if (/\.(js|jsx|css)$/.test(f)) tout.push(d + '/' + f);
// un fichier qui se cite lui-même ne compte pas ; la liste hors connexion de sw.js non plus (elle suit les pages)
const autres = PAGES.map(p => lire(p[0])).join('\n');
const orphelins = tout.filter(f => { const b = path.basename(f), re = new RegExp('[\'"/]' + b.replace(/\./g, '\\.') + '[\'"?]');
  const corpus = autres + '\n' + tout.filter(g => g !== f).map(lire).join('\n'); return !corpus.includes(f) && !re.test(corpus); }).sort();

const L = [];
L.push('_Partie mise à jour automatiquement par `tools/inventaire-site.js` (tâche GitHub `rapport-site.yml`). Ne pas modifier à la main._', '');
L.push('### Les pages', '', '| Page | Rôle | Fichiers chargés | Poids chargé |', '|---|---|---|---|');
for (const [p, role] of PAGES) { const F = parPage[p].filter(f => !/^https?:/.test(f)); L.push(`| \`${p}\` | ${role} | ${F.length} | ${ko(F.reduce((t, f) => t + taille(f), 0) + taille(p))} |`); }
L.push('', `### Modules communs à l’application et au site (${communs.length})`, '', 'Ce qu’ils font est déjà sur les deux : une correction dans l’un de ces fichiers profite aux deux.', '', communs.map(f => '`' + f + '`').join(' · '), '');
L.push(`### Propres à l’application (${appSeule.length}) : ce que le site n’a pas`, '', appSeule.map(f => '`' + f + '`').join(' · '), '');
L.push(`### Propres au site (${siteSeul.length})`, '', siteSeul.map(f => '`' + f + '`').join(' · '), '');
L.push('### WebGL', '', '- Site : ' + (siteGL.length ? siteGL.map(f => '`' + f + '`').join(', ') : 'aucun'), '- Application : ' + (appGL.length ? appGL.map(f => '`' + f + '`').join(', ') : 'aucun'), '');
L.push('### Fichiers lourds chargés par le site (plus de 150 ko)', '');
L.push(lourdsSite.length ? lourdsSite.map(([f, n]) => `- \`${f}\` : ${ko(n)}`).join('\n') : '- aucun');
if (externes.length) L.push('', 'Chargés depuis Internet : ' + externes.map(f => '`' + f + '`').join(', '));
L.push('', `### Fichiers que plus aucune page ne charge (${orphelins.length})`, '', orphelins.length ? orphelins.map(f => `- \`${f}\` (${ko(taille(f))})`).join('\n') : '- aucun');

const corps = L.join('\n');
const doc = path.join(R, 'PORTAGE-SITE.md'), src = fs.readFileSync(doc, 'utf8');
const A = '<!-- INVENTAIRE:DEBUT -->', B = '<!-- INVENTAIRE:FIN -->';
const i = src.indexOf(A), j = src.indexOf(B);
if (i < 0 || j < 0) { console.error('Marqueurs INVENTAIRE absents de PORTAGE-SITE.md'); process.exit(1); }
const ancien = src.slice(i + A.length, j);
const sansDate = t => t.replace(/_Inventaire du [^_]*_\n?/, '');
if (sansDate(ancien).trim() === corps.trim()) { console.log('Inventaire inchangé.'); process.exit(0); }
const d = new Date(), date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Abidjan' });
fs.writeFileSync(doc, src.slice(0, i + A.length) + '\n_Inventaire du ' + date + '_\n' + corps + '\n' + src.slice(j));
console.log('Inventaire mis à jour : ' + communs.length + ' communs, ' + appSeule.length + ' propres à l’application, ' + siteSeul.length + ' propres au site, ' + orphelins.length + ' orphelins.');
