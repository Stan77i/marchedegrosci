#!/usr/bin/env node
/* Point d'entrée unique du contrôle qualité MGCI. Centre de commande : CONTROLE_QUALITE/README.md.
   Usage : bash tools/controle/lancer.sh <mode> [options]
     tout            statique + navigateur + batteries navigateur ; liste toutes les batteries SQL « à exécuter par Claude (MCP) »
     statique        contrôle statique seul (tools/controle/controle.js, sans navigateur)
     navigateur      ouverture de l'application en iPhone émulé + batteries CONTROLE_QUALITE/tests/navigateur/
     unite U04       les contrôles d'une unité (statique filtré, batteries navigateur de l'unité, liste des tests SQL de l'unité)
     apres-modif     contrôle ciblé sur les fichiers changés depuis la base (origin/main par défaut)
     pr              comme apres-modif, pour GitHub Actions : n'écrit rien dans CONTROLE_QUALITE/, code de sortie 1 en cas d'échec
   Options :
     --base <réf>      base de comparaison (défaut : origin/main ; variable CONTROLE_BASE)
     --sortie <f>      écrit le rapport dans <f> au lieu de CONTROLE_QUALITE/rapports/ (pas de mise à jour de DERNIER_RAPPORT ni d'HISTORIQUE)
     --resume <f>      écrit aussi un résumé JSON (nouveaux rouges, empreinte) dans <f>
     --sans-navigateur saute la partie navigateur
   Code de sortie : 0 = aucun échec bloquant ; 1 = échec bloquant (nouveau rouge par rapport à tools/controle/reference-rouges.json,
   erreur de syntaxe, CACHE de sw.js ou ?v= non montés) ; 2 = mauvaise commande.
   Les tests SQL ne sont JAMAIS exécutés ni déclarés réussis ici : il n'y a aucun accès à la base. Ils sont listés « à exécuter par Claude (MCP) ». */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const http = require('http');
const crypto = require('crypto');

const RACINE = path.resolve(__dirname, '..', '..');
const CQ = path.join(RACINE, 'CONTROLE_QUALITE');
const CARTE = JSON.parse(fs.readFileSync(path.join(__dirname, 'unites.json'), 'utf8'));
const REF_ROUGES = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'reference-rouges.json'), 'utf8')); } catch (_) { return { rouges: [] }; } })();
const FRONT = new RegExp(CARTE.front);

/* ---------- arguments ---------- */
const args = process.argv.slice(2);
const opt = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
const drapeau = (nom) => args.includes(nom);
const MODES = ['tout', 'statique', 'navigateur', 'unite', 'apres-modif', 'pr'];
const mode = args[0];
if (!MODES.includes(mode)) {
  console.error('Mode inconnu. Modes : ' + MODES.join(', ') + '. Exemple : bash tools/controle/lancer.sh unite U04');
  process.exit(2);
}
let unite = null;
if (mode === 'unite') {
  unite = (args[1] || '').toUpperCase();
  if (!CARTE.unites[unite]) { console.error('Unité inconnue « ' + (args[1] || '') + ' ». Unités : ' + Object.keys(CARTE.unites).join(', ')); process.exit(2); }
}
const BASE = opt('--base') || process.env.CONTROLE_BASE || 'origin/main';
const SORTIE = opt('--sortie');
const RESUME = opt('--resume');
const SANS_NAV = drapeau('--sans-navigateur');

/* ---------- outils ---------- */
const sh = (cmd, a, o = {}) => cp.spawnSync(cmd, a, Object.assign({ cwd: RACINE, encoding: 'utf8', maxBuffer: 64 << 20 }, o));
const git = (...a) => { const r = sh('git', a); return r.status === 0 ? r.stdout.trim() : null; };
const existe = (rel) => fs.existsSync(path.join(RACINE, rel));
const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');
function maintenant() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return { iso: d.toISOString(), jour: d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()),
    heure: p(d.getUTCHours()) + 'h' + p(d.getUTCMinutes()), fr: p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear() + ' à ' + p(d.getUTCHours()) + ' h ' + p(d.getUTCMinutes()) };
}
const T0 = Date.now();
const QUAND = maintenant();
const COMMIT = git('rev-parse', '--short', 'HEAD') || 'inconnu';
const BRANCHE = git('rev-parse', '--abbrev-ref', 'HEAD') || 'inconnue';
const SALE = (git('status', '--porcelain') || '').length > 0;

/* Résultats : un tableau de tests au format commun (CONTROLE_QUALITE/modeles/RAPPORT.md) */
const tests = [];   // { id, unite, type, scenario, attendu, obtenu, statut, gravite, preuve }
const echecsBloquants = [];
function noter(t) { tests.push(Object.assign({ type: 'normal', gravite: '', preuve: '' }, t)); }

/* ---------- 1. contrôle statique (controle.js) ---------- */
function statique(avecNavigateur) {
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cq-'));
  const json = path.join(tmp, 'constats.json'), md = path.join(tmp, 'statique.md');
  const a = [path.join(__dirname, 'controle.js'), '--json', json];
  if (!avecNavigateur) a.push('--sans-navigateur');
  const r = sh(process.execPath, a, { env: Object.assign({}, process.env, { CONTROLE_SORTIE: md }), timeout: 10 * 60 * 1000 });
  let res = null;
  try { res = JSON.parse(fs.readFileSync(json, 'utf8')); } catch (_) { }
  if (!res) {
    noter({ id: 'STA-00', unite: 'U10', scenario: 'Lancer le contrôle statique', attendu: 'le script tourne jusqu’au bout', obtenu: 'arrêt : ' + ((r.stderr || r.stdout || '').trim().split('\n').pop() || 'sans message'), statut: 'bloqué', gravite: 'P1', preuve: 'node tools/controle/controle.js' });
    echecsBloquants.push('le contrôle statique ne tourne pas');
    return null;
  }
  return res;
}
const cleDe = (c) => c.controle + '|' + (c.lieu || '').split(':')[0] + '|' + (c.cle || c.message.replace(/\s*\(déjà ligne \d+\)|ligne \d+/g, ''));
const gravite = (c) => c.niveau === 'rouge' ? ((c.controle === 'syntaxe' || c.controle === 'navigateur') ? 'P0' : 'P1') : c.niveau === 'orange' ? 'P2' : 'P3';
let nouveauxRouges = [];
function noterStatique(res, filtreUnite, seulement) {
  const refs = new Set(REF_ROUGES.rouges || []);
  const toutes = Object.entries(CARTE.statique);
  for (const [nom, info] of toutes) {
    if (filtreUnite && !info.unites.includes(filtreUnite)) continue;
    if (seulement && !seulement.includes(nom)) continue;
    if (nom === 'navigateur' && !res.passes.some(p => p.controle === nom) && !res.nonVerifies.some(n => n.controle === nom) && !res.constats.some(c => c.controle === nom)) continue;
    const cs = res.constats.filter(c => c.controle === nom && c.niveau !== 'info');
    const nv = res.nonVerifies.find(n => n.controle === nom);
    const u = info.unites.join(', ');
    if (nv) { noter({ id: info.id, unite: u, scenario: 'Contrôle « ' + nom + ' »', attendu: 'contrôle fait', obtenu: nv.raison, statut: nom === 'navigateur' && /désactivé/.test(nv.raison) ? 'non exécuté' : 'bloqué', preuve: 'tools/controle/controle.js' }); continue; }
    if (!cs.length) { const p = res.passes.find(x => x.controle === nom); noter({ id: info.id, unite: u, scenario: 'Contrôle « ' + nom + ' »', attendu: 'aucun constat', obtenu: 'rien à signaler' + (p && p.texte ? ' (' + p.texte + ')' : ''), statut: 'réussi', preuve: 'tools/controle/controle.js' }); continue; }
    const rouges = cs.filter(c => c.niveau === 'rouge');
    const neufs = rouges.filter(c => !refs.has(cleDe(c)));
    nouveauxRouges.push(...neufs);
    const pire = cs.map(gravite).sort()[0];
    noter({ id: info.id, unite: u, scenario: 'Contrôle « ' + nom + ' »', attendu: 'aucun constat',
      obtenu: rouges.length + ' rouge(s) dont ' + neufs.length + ' nouveau(x), ' + (cs.length - rouges.length) + ' orange(s)',
      statut: 'échoué', gravite: pire, preuve: cs.slice(0, 3).map(c => c.lieu).filter(Boolean).join(' ; ') + (cs.length > 3 ? ' ; …' : '') });
  }
  for (const c of nouveauxRouges) echecsBloquants.push('nouveau rouge (' + c.controle + ') ' + (c.lieu || '') + ' : ' + c.message);
}

/* ---------- 2. fichiers changés (apres-modif, pr) ---------- */
function fichiersChanges() {
  const mb = git('merge-base', BASE, 'HEAD');
  if (!mb) return { base: null, fichiers: [] };
  const l = new Set();
  for (const s of [git('diff', '--name-only', mb, 'HEAD'), git('diff', '--name-only', 'HEAD'), git('ls-files', '--others', '--exclude-standard')])
    for (const f of (s || '').split('\n')) if (f.trim()) l.add(f.trim());
  return { base: mb, fichiers: [...l].sort() };
}
function versionsDe(src, fichier) {
  const re = new RegExp('["\'(](?:\\./)?' + fichier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\?v=([\\w.-]+)', 'g');
  const v = new Set(); let m; while ((m = re.exec(src))) v.add(m[1]); return v;
}
function apresModif(base, fichiers, lectureSeule) {
  const mbCourt = base ? base.slice(0, 7) : '?';
  if (!base) {
    noter({ id: 'APM-00', unite: 'U10', scenario: 'Trouver la base « ' + BASE + ' »', attendu: 'base trouvée', obtenu: 'introuvable (git fetch origin ?)', statut: 'bloqué', gravite: 'P2', preuve: 'git merge-base ' + BASE + ' HEAD' });
    return;
  }
  noter({ id: 'APM-01', unite: 'U10', scenario: 'Lister les fichiers changés depuis ' + BASE + ' (' + mbCourt + ')', attendu: 'liste', obtenu: fichiers.length + ' fichier(s)', statut: 'réussi', preuve: 'git diff --name-only ' + mbCourt });
  // a. syntaxe des JS changés (y compris tools/ et strategie/), JSON et YAML changés
  const js = fichiers.filter(f => /\.(js|mjs|cjs)$/.test(f) && existe(f));
  let errs = [];
  for (const f of js) { const r = sh(process.execPath, ['--check', f]); if (r.status !== 0) errs.push(f + ' : ' + ((r.stderr || '').split('\n').find(x => /Error/.test(x)) || 'erreur')); }
  noter({ id: 'APM-02', unite: 'U10', type: 'régression', scenario: 'node --check sur les ' + js.length + ' fichier(s) JS changé(s)', attendu: 'aucune erreur', obtenu: errs.length ? errs.join(' | ') : 'aucune erreur', statut: errs.length ? 'échoué' : (js.length ? 'réussi' : 'non exécuté'), gravite: errs.length ? 'P0' : '', preuve: js.join(', ') || 'aucun JS changé' });
  if (errs.length) echecsBloquants.push('erreur de syntaxe : ' + errs.join(' | '));
  const jsons = fichiers.filter(f => /\.json$/.test(f) && existe(f)); errs = [];
  for (const f of jsons) { try { JSON.parse(lire(f)); } catch (e) { errs.push(f + ' : ' + e.message); } }
  if (jsons.length) { noter({ id: 'APM-03', unite: 'U10', scenario: 'JSON changés lisibles', attendu: 'lisibles', obtenu: errs.join(' | ') || 'lisibles', statut: errs.length ? 'échoué' : 'réussi', gravite: errs.length ? 'P1' : '', preuve: jsons.join(', ') }); if (errs.length) echecsBloquants.push('JSON illisible : ' + errs.join(' | ')); }
  const ymls = fichiers.filter(f => /^\.github\/workflows\/.*\.ya?ml$/.test(f) && existe(f)); errs = [];
  if (ymls.length) {
    const r = sh('python3', ['-c', 'import sys,yaml\nfor f in sys.argv[1:]:\n  yaml.safe_load(open(f))', ...ymls]);
    if (r.error || /No module named/.test(r.stderr || '')) noter({ id: 'APM-04', unite: 'U10', scenario: 'YAML des tâches GitHub lisible', attendu: 'lisible', obtenu: 'python3 + yaml absents', statut: 'bloqué', preuve: ymls.join(', ') });
    else { const ok = r.status === 0; noter({ id: 'APM-04', unite: 'U10', scenario: 'YAML des tâches GitHub lisible', attendu: 'lisible', obtenu: ok ? 'lisible' : (r.stderr || '').trim().split('\n').pop(), statut: ok ? 'réussi' : 'échoué', gravite: ok ? '' : 'P1', preuve: ymls.join(', ') }); if (!ok) echecsBloquants.push('YAML illisible'); }
  }
  // b. front changé → CACHE de sw.js et ?v= montés
  const front = fichiers.filter(f => FRONT.test(f));
  if (front.length) {
    const swAvant = git('show', base + ':sw.js') || '';
    const swApres = existe('sw.js') ? lire('sw.js') : '';
    const cache = (s) => (/const CACHE = '([^']+)'/.exec(s) || [])[1];
    const monte = cache(swAvant) !== cache(swApres);
    noter({ id: 'APM-05', unite: 'U10', type: 'régression', scenario: front.length + ' fichier(s) du front changé(s) : CACHE de sw.js monté', attendu: 'CACHE différent de la base', obtenu: (cache(swAvant) || '?') + ' → ' + (cache(swApres) || '?'), statut: monte ? 'réussi' : 'échoué', gravite: monte ? '' : 'P1', preuve: 'sw.js ; fichiers : ' + front.slice(0, 6).join(', ') + (front.length > 6 ? '…' : '') });
    if (!monte) echecsBloquants.push('fichiers du front changés mais CACHE de sw.js inchangé (' + (cache(swApres) || '?') + ')');
    // ?v= : pour chaque JS/CSS changé appelé avec ?v= quelque part, la version doit avoir changé
    const appelants = ['application.dc.html', 'index-v3.html', 'index.html', 'admin.html', 'suivi.html', 'sw.js'].filter(existe);
    const pasMontes = [];
    for (const f of front.filter(x => /\.(js|css)$/.test(x) && existe(x))) {
      const apres = new Set(), avant = new Set();
      for (const a of appelants) { versionsDe(lire(a), f).forEach(v => apres.add(v)); versionsDe(git('show', base + ':' + a) || '', f).forEach(v => avant.add(v)); }
      if (!apres.size) continue;                       // pas appelé avec ?v= : rien à monter
      if ([...apres].every(v => avant.has(v))) pasMontes.push(f + '?v=' + [...apres].join('/'));
    }
    noter({ id: 'APM-06', unite: 'U10', type: 'régression', scenario: '?v= monté pour chaque JS/CSS changé appelé avec ?v=', attendu: 'nouvelle version', obtenu: pasMontes.length ? 'non monté : ' + pasMontes.join(', ') : 'monté partout', statut: pasMontes.length ? 'échoué' : 'réussi', gravite: pasMontes.length ? 'P1' : '', preuve: appelants.join(', ') });
    if (pasMontes.length) echecsBloquants.push('?v= non monté : ' + pasMontes.join(', '));
    // nouvelles images : dans IMAGES de sw.js (avertissement seulement)
    const ajoutees = (git('diff', '--name-only', '--diff-filter=A', base, 'HEAD') || '').split('\n').filter(f => /^v2\/img\/.*\.webp$/.test(f));
    if (ajoutees.length) {
      const absentes = ajoutees.filter(f => !swApres.includes('"' + f.slice(7) + '"'));
      noter({ id: 'APM-07', unite: 'U10', scenario: 'Nouvelles images listées dans IMAGES de sw.js', attendu: 'listées', obtenu: absentes.length ? 'absentes : ' + absentes.join(', ') : 'listées', statut: absentes.length ? 'échoué' : 'réussi', gravite: absentes.length ? 'P3' : '', preuve: 'sw.js IMAGES' });
    }
  } else noter({ id: 'APM-05', unite: 'U10', scenario: 'CACHE et ?v= (front changé ?)', attendu: '—', obtenu: 'aucun fichier du front changé', statut: 'non exécuté', preuve: 'motif : ' + CARTE.front });
  // c. schéma SQL changé → tests SQL liés à lancer par Claude (MCP), jamais ici
  const schemas = fichiers.filter(f => /^supabase\/schema-[\w-]+\.sql$/.test(f));
  for (const s of schemas) {
    const id = (/schema-(\d+[a-z]?)/.exec(s) || [])[1];
    const lies = id ? testsPourSchema(id) : [];
    const enCours = (CARTE.enCours || []).find(e => e.schemas.some(x => id && (x === id || id.startsWith(x))));
    noter({ id: 'APM-SQL-' + (id || '?'), unite: [...new Set(lies.flatMap(t => t.unites))].join(', ') || 'U09', scenario: 'Schéma changé : ' + s, attendu: 'tests SQL liés rejoués sur le projet de TEST',
      obtenu: lies.length ? 'à lancer par Claude via MCP : ' + lies.map(t => t.fichier).join(', ') : 'aucun test lié trouvé : en écrire un (U09)' , statut: 'non exécuté',
      gravite: lies.length ? '' : 'P2', preuve: (enCours ? 'en cours de changement (' + enCours.branche + ') ; ' : '') + 'procédure : CONTROLE_QUALITE/procedures/APRES_MODIFICATION.md' });
  }
  const fonctions = [...new Set(fichiers.filter(f => /^supabase\/functions\//.test(f)).map(f => f.split('/')[2]))];
  for (const fn of fonctions) noter({ id: 'APM-FN-' + fn, unite: 'U10, U08', scenario: 'Fonction externe changée : ' + fn, attendu: 'testée', obtenu: 'impossible ici (ni Deno ni clés push ni réseau Supabase)', statut: 'en attente', preuve: 'prérequis : clés push du projet de test et accès réseau (CONTROLE_QUALITE/INVENTAIRE_OUTILS.md)' });
  const tests = fichiers.filter(f => /^(supabase\/tests|CONTROLE_QUALITE\/tests\/sql)\/.*\.sql$/.test(f));
  if (tests.length) noter({ id: 'APM-08', unite: 'U09', scenario: 'Tests SQL ajoutés ou changés', attendu: 'rejoués sur le projet de TEST', obtenu: 'à lancer par Claude via MCP : ' + tests.join(', '), statut: 'non exécuté', preuve: 'aucun accès base depuis ce script' });
}

/* ---------- 3. tests SQL : liste seulement ---------- */
function batteriesSql() {
  const l = [];
  for (const [f, i] of Object.entries(CARTE.testsSql)) if (existe(f)) l.push({ fichier: f, unites: i.unites, schemas: i.schemas });
  const d = path.join(CQ, 'tests', 'sql');
  if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter(x => /\.sql$/.test(x)).sort()) {
    const u = (/^(U\d\d)/i.exec(f) || [])[1];
    const src = fs.readFileSync(path.join(d, f), 'utf8');
    const sch = [...new Set((src.match(/sch[ée]mas?\s+(\d+[a-z]?)/gi) || []).map(x => x.replace(/sch[ée]mas?\s+/i, '').toLowerCase()))];
    l.push({ fichier: 'CONTROLE_QUALITE/tests/sql/' + f, unites: u ? [u.toUpperCase()] : [], schemas: sch });
  }
  return l;
}
function testsPourSchema(id) {
  const num = (/^\d+/.exec(id) || [''])[0];
  return batteriesSql().filter(t => t.schemas.some(s => s === id || (/^\d+$/.test(s) && s === num)));
}
function noterSql(filtreUnite) {
  const enCours = CARTE.enCours || [];
  for (const t of batteriesSql()) {
    if (filtreUnite && !t.unites.includes(filtreUnite)) continue;
    const ec = enCours.find(e => e.schemas.some(s => t.schemas.includes(s)));
    noter({ id: 'SQL-' + path.basename(t.fichier, '.sql'), unite: t.unites.join(', ') || '?', scenario: 'Batterie SQL ' + t.fichier, attendu: 'chaque bloc donne le résultat écrit dans le fichier',
      obtenu: 'à exécuter par Claude (MCP) sur le projet de TEST yowdymdnoiubatxlwhfv', statut: 'non exécuté', preuve: ec ? 'en cours de changement : ' + ec.sujet + ' (' + ec.branche + ')' : 'aucun accès base depuis ce script' });
  }
}

/* ---------- 4. batteries navigateur (CONTROLE_QUALITE/tests/navigateur/Uxx-*.js) ---------- */
function serveurStatique() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RACINE, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r(s)));
}
async function batteriesNavigateur(filtreUnite) {
  const d = path.join(CQ, 'tests', 'navigateur');
  const fichiers = fs.existsSync(d) ? fs.readdirSync(d).filter(f => /^U\d\d.*\.(js|mjs|cjs)$/i.test(f)).sort() : [];
  const choisis = fichiers.filter(f => !filtreUnite || f.toUpperCase().startsWith(filtreUnite));
  if (!choisis.length) {
    if (!filtreUnite || ['U10', 'U12'].includes(filtreUnite))
      noter({ id: 'NAV-00', unite: filtreUnite || 'U10, U12', scenario: 'Batteries navigateur de CONTROLE_QUALITE/tests/navigateur/', attendu: 'au moins une batterie', obtenu: 'aucune batterie trouvée (à ajouter par l’intégration)', statut: 'non exécuté', preuve: 'CONTROLE_QUALITE/tests/navigateur/' });
    return;
  }
  const serveur = await serveurStatique();
  const url = 'http://127.0.0.1:' + serveur.address().port + '/';
  const pw = [process.env.PLAYWRIGHT_MODULE, path.join(RACINE, 'node_modules', 'playwright'), '/opt/node-tools/node_modules/playwright'].filter(Boolean).find(p => { try { require.resolve(p); return true; } catch (_) { return false; } });
  try {
    for (const f of choisis) {
      const env = Object.assign({}, process.env, { CQ_URL: url, CQ_RACINE: RACINE });
      if (pw) env.PLAYWRIGHT_MODULE = pw;
      if (!env.CHROMIUM && fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome')) env.CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
      const r = await new Promise(res => {
        const p = cp.spawn(process.execPath, [path.join(d, f)], { cwd: RACINE, env });
        let out = ''; p.stdout.on('data', x => out += x); p.stderr.on('data', x => out += x);
        const minuteur = setTimeout(() => p.kill('SIGKILL'), 10 * 60 * 1000);
        p.on('close', code => { clearTimeout(minuteur); res({ code, out }); });
      });
      const statut = r.code === 0 ? 'réussi' : r.code === 3 ? 'bloqué' : 'échoué';
      const fin = r.out.trim().split('\n').slice(-3).join(' | ').slice(0, 400);
      noter({ id: 'NAV-' + path.basename(f).replace(/\.\w+$/, ''), unite: (/^(U\d\d)/i.exec(f) || [])[1].toUpperCase(), scenario: 'Batterie navigateur ' + f, attendu: 'code de sortie 0',
        obtenu: 'code ' + r.code + (fin ? ' : ' + fin : ''), statut, gravite: statut === 'échoué' ? 'P2' : '', preuve: 'node CONTROLE_QUALITE/tests/navigateur/' + f });
    }
  } finally { serveur.close(); }
}

/* ---------- 5. rapport ---------- */
function rapport(titreMode) {
  const compte = (s) => tests.filter(t => t.statut === s).length;
  const c = { 'réussi': compte('réussi'), 'échoué': compte('échoué'), 'bloqué': compte('bloqué'), 'non exécuté': compte('non exécuté'), 'en attente': compte('en attente') };
  const unitesVues = new Set(), unitesNon = new Set();
  for (const t of tests) for (const u of String(t.unite).split(/,\s*/)) if (CARTE.unites[u]) (['réussi', 'échoué'].includes(t.statut) ? unitesVues : unitesNon).add(u);
  const nonExec = Object.keys(CARTE.unites).filter(u => !unitesVues.has(u));
  const L = [];
  L.push('# Rapport du contrôle qualité · ' + QUAND.fr + ' (UTC = heure d’Abidjan)', '');
  L.push('> Gabarit : `CONTROLE_QUALITE/modeles/RAPPORT.md`. Fait par `tools/controle/lancer.sh ' + titreMode + '`. Les tests SQL ne sont jamais exécutés par ce script : ils sont « non exécuté » tant que Claude ne les a pas joués via MCP sur le projet de test.', '');
  L.push('## 1. Identité du passage', '');
  L.push('| Champ | Valeur |', '|---|---|');
  L.push('| Date | ' + QUAND.fr + ' |', '| Commit | `' + COMMIT + '` (branche `' + BRANCHE + '`' + (SALE ? ', avec des changements non enregistrés' : '') + ') |');
  L.push('| Mode | `' + titreMode + '` |', '| Base de comparaison | ' + (['apres-modif', 'pr'].includes(mode) ? '`' + BASE + '`' : '—') + ' |');
  L.push('| Durée | ' + Math.round((Date.now() - T0) / 1000) + ' s |', '| Lancé par | ' + (process.env.GITHUB_ACTIONS ? 'GitHub Actions (' + (process.env.GITHUB_WORKFLOW || '?') + ')' : 'à la main ou par Claude') + ' |', '');
  L.push('## 2. En bref', '');
  L.push('- **' + (echecsBloquants.length ? 'ÉCHEC BLOQUANT (' + echecsBloquants.length + ')' : 'Aucun échec bloquant') + '** ; réussis ' + c['réussi'] + ', échoués ' + c['échoué'] + ', bloqués ' + c['bloqué'] + ', non exécutés ' + c['non exécuté'] + ', en attente ' + c['en attente'] + '.');
  L.push('- Unités avec au moins un contrôle exécuté : ' + ([...unitesVues].sort().join(', ') || 'aucune') + '.');
  L.push('- Unités non exécutées dans ce passage : ' + (nonExec.join(', ') || 'aucune') + '.');
  if (echecsBloquants.length) for (const e of echecsBloquants) L.push('- Bloquant : ' + e);
  L.push('');
  L.push('## 3. Tests', '');
  L.push('| ID | Unité | Type | Scénario | Attendu | Obtenu | Statut | Gravité | Preuve |', '|---|---|---|---|---|---|---|---|---|');
  const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  for (const t of tests) L.push('| ' + [t.id, t.unite, t.type, t.scenario, t.attendu, t.obtenu, t.statut, t.gravite || '—', t.preuve].map(esc).join(' | ') + ' |');
  L.push('');
  L.push('## 4. Anomalies (P0 à P3)', '');
  const anomalies = tests.filter(t => t.statut === 'échoué');
  if (!anomalies.length) L.push('Aucune anomalie relevée par les contrôles automatiques de ce passage (cela ne prouve pas l’absence de faille : voir partie 6).');
  else {
    L.push('Gravité donnée par le script, à confirmer par Claude dans `CONTROLE_QUALITE/REGISTRE_ANOMALIES.md` (rouge du contrôle statique = P1, erreur de syntaxe ou du navigateur = P0, orange = P2).', '');
    for (const t of anomalies) L.push('- **' + t.id + '** (' + (t.gravite || '?') + ', ' + t.unite + ') : ' + esc(t.obtenu) + '. Preuve reproductible : `bash tools/controle/lancer.sh ' + (mode === 'pr' ? 'apres-modif' : titreMode) + '` ; ' + esc(t.preuve) + '.');
  }
  if (nouveauxRouges.length) { L.push('', 'Nouveaux rouges (absents de `tools/controle/reference-rouges.json`) :'); for (const r of nouveauxRouges) L.push('- `' + (r.lieu || '') + '` : ' + esc(r.message)); }
  L.push('');
  L.push('## 5. Risque métier, correctif, non-régression', '');
  L.push('À remplir par Claude pour chaque anomalie retenue, dans `CONTROLE_QUALITE/REGISTRE_ANOMALIES.md` (le script ne juge pas le risque métier). Détail des constats statiques : `node tools/controle/controle.js` puis `rapport-controle.md`.', '');
  L.push('## 6. Risques résiduels et limites de ce passage', '');
  const nSql = tests.filter(t => /^(SQL-|APM-SQL-|APM-08)/.test(t.id)).length;
  L.push('- Aucun test SQL exécuté par ce script (aucun accès à la base)' + (nSql ? ' : ' + nSql + ' ligne(s) SQL restent « non exécuté », à jouer par Claude via MCP sur le projet de test.' : '.'));
  L.push('- Le navigateur ne joint pas Supabase : l’application est ouverte sans données réelles.');
  L.push('- Non vérifiables ici : vrais paiements (aucun branché), charge simultanée, fonctions externes `pousser` et `itineraire`, vrai téléphone, SMS (voir `CONTROLE_QUALITE/INVENTAIRE_OUTILS.md`).');
  for (const e of CARTE.enCours || []) L.push('- En cours de changement : ' + e.sujet + ' (schémas ' + e.schemas.join(', ') + ', branche `' + e.branche + '`) : ' + e.consigne + '.');
  L.push('');
  return { texte: L.join('\n') + '\n', c };
}

/* ---------- déroulé ---------- */
(async () => {
  let titreMode = mode + (unite ? ' ' + unite : '');
  {
    const avecNav = !SANS_NAV && (mode === 'tout' || mode === 'navigateur' || (mode === 'unite' && unite === 'U10'));
    const res = statique(avecNav);
    if (res) {
      noterStatique(res, unite, mode === 'navigateur' ? ['navigateur'] : null);
    }
  }
  if (mode === 'apres-modif' || mode === 'pr') { const { base, fichiers } = fichiersChanges(); apresModif(base, fichiers); }
  if (!SANS_NAV && (mode === 'tout' || mode === 'navigateur' || mode === 'unite')) await batteriesNavigateur(unite);
  if (mode === 'tout' || mode === 'unite') noterSql(unite);

  const { texte, c } = rapport(titreMode);
  let ou;
  if (mode === 'pr' || SORTIE) {
    ou = SORTIE || path.join(RACINE, 'rapport-controle-pr.md');
    fs.writeFileSync(ou, texte);
    if (process.env.GITHUB_STEP_SUMMARY) try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, texte); } catch (_) { }
  } else {
    const nom = QUAND.jour + '-' + QUAND.heure + '-' + titreMode.replace(/\s+/g, '-') + '.md';
    fs.mkdirSync(path.join(CQ, 'rapports'), { recursive: true });
    ou = path.join(CQ, 'rapports', nom);
    fs.writeFileSync(ou, texte);
    fs.writeFileSync(path.join(CQ, 'DERNIER_RAPPORT.md'), '<!-- Copie du dernier rapport écrit par tools/controle/lancer.sh (fichier daté : rapports/' + nom + '). Ne pas modifier à la main. -->\n' + texte);
    const h = path.join(CQ, 'HISTORIQUE.md');
    const ligne = '| ' + QUAND.fr + ' | `' + titreMode + '` | `' + COMMIT + '` | ' + c['réussi'] + ' | ' + c['échoué'] + ' | ' + c['bloqué'] + ' | ' + c['non exécuté'] + ' | ' + c['en attente'] + ' | ' + (echecsBloquants.length ? 'oui (' + echecsBloquants.length + ')' : 'non') + ' | [rapport](rapports/' + nom + ') |\n';
    if (fs.existsSync(h)) fs.appendFileSync(h, ligne);
  }
  const empreinte = crypto.createHash('sha1').update(nouveauxRouges.map(cleDe).sort().join('\n') + '\n' + echecsBloquants.join('\n')).digest('hex').slice(0, 12);
  if (RESUME) fs.writeFileSync(RESUME, JSON.stringify({ date: QUAND.iso, commit: COMMIT, mode: titreMode, comptes: c, echecsBloquants, nouveauxRouges: nouveauxRouges.map(cleDe), empreinte }, null, 1));
  console.log('Contrôle qualité (' + titreMode + ') : réussis ' + c['réussi'] + ', échoués ' + c['échoué'] + ', bloqués ' + c['bloqué'] + ', non exécutés ' + c['non exécuté'] + ', en attente ' + c['en attente'] + (echecsBloquants.length ? ' ; ÉCHEC BLOQUANT : ' + echecsBloquants.join(' ; ') : ' ; aucun échec bloquant') + '\nRapport : ' + path.relative(process.cwd(), ou));
  process.exit(echecsBloquants.length ? 1 : 0);
})().catch(e => { console.error('Le lanceur s’est arrêté : ' + (e && e.stack || e)); process.exit(1); });
