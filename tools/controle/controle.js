#!/usr/bin/env node
/* Contrôle statique du Marché de Gros (« les gardiens ») : doublons, sur-explications, bugs, incohérences.
   Lancement : node tools/controle/controle.js  →  écrit rapport-controle.md à la racine du dépôt.
   Option : --json <fichier> (ou CONTROLE_JSON) écrit aussi les constats en JSON (lu par tools/controle/lancer.js).
   Point d'entrée de tous les contrôles : tools/controle/lancer.sh (centre de commande : CONTROLE_QUALITE/README.md).
   Aucune dépendance à installer. La partie navigateur (erreurs JavaScript au chargement) ne tourne que si Playwright est trouvé.
   Le script se termine toujours avec le code 0 : un constat ne fait jamais échouer la tâche GitHub.
   Mode d'emploi, liste des contrôles et exceptions : tools/controle/README.md. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const cp = require('child_process');

const RACINE = path.resolve(__dirname, '..', '..');
const SORTIE = process.env.CONTROLE_SORTIE || process.env.GARDIENS_SORTIE || path.join(RACINE, 'rapport-controle.md');
const iJson = process.argv.indexOf('--json');
const SORTIE_JSON = iJson > 0 ? process.argv[iJson + 1] : process.env.CONTROLE_JSON;
const EXC = lireJSON(path.join(__dirname, 'exceptions.json')) || { seuils: {}, ignorer: [] };
const SEUILS = Object.assign({ motsMax: 25, doublonMin: 40, doublonMax: 30, parGroupe: 25 }, EXC.seuils || {});

const constats = [];      // { niveau: 'rouge' | 'orange' | 'info', controle, lieu, message }
const passes = [];        // { controle, texte } : contrôles faits sans rien trouver
const nonVerifies = [];   // { controle, raison }
let ignores = 0;

const NOMS = {
  syntaxe: 'Syntaxe du code',
  cache: 'Versions et cache (sw.js)',
  'mots-interdits': 'Mots interdits',
  communes: 'Communes d’Abidjan',
  'doublon-texte': 'Textes en double',
  'doublon-fonction': 'Fonctions définies deux fois',
  'doublon-id': 'Identifiants HTML en double',
  'long-texte': 'Textes trop longs (sur-explication)',
  slogan: 'Phrases-slogans',
  police: 'Police autre que Jost',
  bleu: 'Couleurs bleues',
  sql: 'Fichiers SQL avec drop / delete / truncate',
  liens: 'Fichiers cités qui n’existent plus',
  navigateur: 'Erreurs dans le navigateur'
};

/* ---------- outils ---------- */
function lireJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } }
function lire(rel) { return fs.readFileSync(path.join(RACINE, rel), 'utf8'); }
const cacheLignes = {};
function lignesDe(rel) { return cacheLignes[rel] || (cacheLignes[rel] = lire(rel).split('\n')); }
function existe(rel) { return fs.existsSync(path.join(RACINE, rel)); }
function liste(dir, re) {
  const d = path.join(RACINE, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => dir + '/' + f);
}
function ligneDe(src, index) { let n = 1; for (let i = 0; i < index; i++) if (src.charCodeAt(i) === 10) n++; return n; }
function court(t, n = 120) { t = String(t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; }
function globVersRe(g) { return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'); }

function estIgnore(c) {
  for (const e of EXC.ignorer || []) {
    if (e.controle !== c.controle) continue;
    const fichier = (c.lieu || '').split(':')[0];
    if (e.fichier && !globVersRe(e.fichier).test(fichier)) continue;
    if (e.contient && !(c.cle || c.message || '').includes(e.contient)) continue;
    return true;
  }
  return false;
}
function signaler(niveau, controle, lieu, message, cle) {
  const c = { niveau, controle, lieu, message, cle };
  if (estIgnore(c)) { ignores++; return; }
  constats.push(c);
}
function controle(nom, fn) {
  const avant = constats.length;
  try {
    const r = fn();
    if (r && r.nonVerifie) { nonVerifies.push({ controle: nom, raison: r.nonVerifie }); return; }
    const miens = constats.slice(avant).filter(c => c.controle === nom);
    if (!miens.some(c => c.niveau !== 'info'))
      passes.push({ controle: nom, texte: ((r && r.texte) || '') + (miens.length ? ' ; voir « Pour information »' : '') });
  } catch (e) {
    nonVerifies.push({ controle: nom, raison: 'le contrôle s’est arrêté sur une erreur : ' + court(e.message, 200) });
  }
}

/* ---------- lecture du JavaScript : chaînes de texte et fonctions, sans dépendance ----------
   Petit lecteur qui sépare le code, les commentaires, les chaînes ('…', "…", `…`) et les expressions régulières.
   Il garde chaque chaîne (avec sa ligne) et chaque « function nom( » avec le bloc { } où elle est déclarée. */
const MOTS_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
function lireJS(src, ligne0 = 1) {
  const chaines = [], fonctions = [];
  let i = 0, ligne = ligne0, prec = '(';     // dernier élément significatif : '(' = début, ponctuation, 'id', 'mot', 'val'
  let blocs = [0], seq = 0;
  const n = src.length;
  function avance(k) { for (let j = 0; j < k; j++) { if (src.charCodeAt(i) === 10) ligne++; i++; } }
  function chaine(q) {
    const l = ligne; let v = ''; avance(1);
    while (i < n && src[i] !== q) {
      if (src[i] === '\\') { v += src[i + 1] === 'n' ? '\n' : (src[i + 1] || ''); avance(2); continue; }
      if (src[i] === '\n') break;           // chaîne non fermée : on s'arrête à la ligne
      v += src[i]; avance(1);
    }
    avance(1);
    chaines.push({ v, ligne: l });
    prec = 'val';
  }
  function gabarit() {
    const l = ligne; let v = ''; avance(1);
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { v += src[i + 1] === 'n' ? '\n' : (src[i + 1] || ''); avance(2); continue; }
      if (src[i] === '$' && src[i + 1] === '{') { avance(2); code(true); v += '…'; continue; }
      v += src[i]; avance(1);
    }
    avance(1);
    chaines.push({ v, ligne: l, gabarit: true });
    prec = 'val';
  }
  function regex() {
    avance(1); let classe = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { avance(2); continue; }
      if (c === '\n') break;
      if (c === '[') classe = true; else if (c === ']') classe = false;
      else if (c === '/' && !classe) { avance(1); break; }
      avance(1);
    }
    while (i < n && /[a-z]/i.test(src[i])) avance(1);
    prec = 'val';
  }
  function code(dansGabarit) {
    let prof = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') avance(1); continue; }
      if (c === '/' && d === '*') { avance(2); while (i < n && !(src[i] === '*' && src[i + 1] === '/')) avance(1); avance(2); continue; }
      if (c === '"' || c === "'") { chaine(c); continue; }
      if (c === '`') { gabarit(); continue; }
      if (c === '/') {
        if (prec === 'id' || prec === 'val' || prec === ')' || prec === ']') { avance(1); prec = '/'; continue; }
        regex(); continue;
      }
      if (/[A-Za-z_$À-￿]/.test(c)) {
        let j = i; while (j < n && /[\w$À-￿]/.test(src[j])) j++;
        const mot = src.slice(i, j);
        if (mot === 'function') {
          const m = /^function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i, i + 200));
          if (m && !/[=(,:?&|!]\s*$/.test(src.slice(Math.max(0, i - 40), i))) fonctions.push({ nom: m[1], ligne, bloc: blocs[blocs.length - 1] });
        }
        avance(j - i);
        prec = MOTS_REGEX.has(mot) ? 'mot' : 'id';
        continue;
      }
      if (/[0-9]/.test(c)) { let j = i; while (j < n && /[\w.]/.test(src[j])) j++; avance(j - i); prec = 'val'; continue; }
      if (c === '{') { prof++; blocs.push(++seq); avance(1); prec = '{'; continue; }
      if (c === '}') {
        if (dansGabarit && prof === 0) { avance(1); return; }
        prof--; if (blocs.length > 1) blocs.pop(); avance(1); prec = '}'; continue;
      }
      if (/\s/.test(c)) { avance(1); continue; }
      prec = c; avance(1);
    }
  }
  code(false);
  return { chaines, fonctions };
}

/* ---------- textes visibles ---------- */
const BLOCS_HTML = /<\/?(div|p|li|ul|ol|h[1-6]|button|br|section|article|header|footer|label|option|select|td|th|tr|table|nav|aside|figure|figcaption|summary|details|dialog|form|input|textarea|svg|g|path|main|img)\b[^>]*>/gi;
function decoder(t) {
  return t.replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&rsquo;/g, '’').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&hellip;/g, '…').replace(/&middot;/g, '·');
}
/* découpe une chaîne (ou un morceau de HTML) en phrases d'écran */
function segments(v) {
  let t = v;
  if (/<[a-z!\/]/i.test(t)) {
    t = t.replace(/<style[\s\S]*?<\/style>/gi, '\n').replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<!--[\s\S]*?-->/g, '\n')
      .replace(BLOCS_HTML, '\n').replace(/<[^>]*>/g, '').replace(/<[^>]*$/g, '\n').replace(/^[^<]*>/g, '\n');
  }
  return decoder(t).split(/\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
/* une phrase qu'on lit à l'écran, pas du code, du CSS, une liste de classes ou un chemin */
function estTexte(s) {
  if (s.length < 4) return false;
  const mots = s.split(' ');
  if (mots.length < 2) return false;
  if (/[{};]|=>|\(\)|&&|\|\||===|!==|\bvar\(|\bfunction\b|\$\{|^\s*[.#][\w-]+\s*[,{]|https?:|\bpx\b|\d(px|rem|em|vh|vw|ms|deg)\b|rgba?\(|#[0-9a-f]{3,8}\b/i.test(s)) return false;
  const lettres = (s.match(/[A-Za-zÀ-ÿœŒ’']/g) || []).length;
  if (lettres / s.replace(/\s/g, '').length < 0.6) return false;
  const techniques = mots.filter(m => /[_=\/\\]|^[a-z]+-[a-z-]+$|^[a-z]+[A-Z]\w*$|\.\w/.test(m)).length;
  if (techniques / mots.length > 0.3) return false;
  if (!/[A-ZÀ-Ý]|[à-ÿœ’']|\b(le|la|les|un|une|des|de|du|et|ou|vous|votre|vos|pour|avec|sur|dans|par|pas|est|sont)\b/.test(s)) return false;
  return true;
}

/* tous les textes d'un fichier front : { fichier, ligne, texte } */
const cacheTextes = {};
function textesDe(rel) {
  if (cacheTextes[rel]) return cacheTextes[rel];
  const src = lire(rel), out = [];
  const ajouterJS = (code, ligne0) => {
    for (const ch of lireJS(code, ligne0).chaines)
      for (const s of segments(ch.v)) if (estTexte(s)) out.push({ fichier: rel, ligne: ch.ligne, texte: s, brut: ch.v });
  };
  if (/\.html?$/.test(rel)) {
    // scripts en ligne : leurs chaînes ; le reste du HTML : son texte
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m, dernier = 0, morceaux = [];
    while ((m = re.exec(src))) {
      morceaux.push([dernier, m.index]);
      if (!/\bsrc=/.test(m[1]) && !/json|babel/.test(m[1])) ajouterJS(m[2], ligneDe(src, m.index + m[0].indexOf('>') + 1));
      dernier = m.index + m[0].length;
    }
    morceaux.push([dernier, src.length]);
    for (const [a, b] of morceaux) {
      let html = src.slice(a, b).replace(/<style[\s\S]*?<\/style>/gi, s => s.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, s => s.replace(/[^\n]/g, ' '));
      const reT = />([^<]+)</g; let t;
      while ((t = reT.exec(html))) {
        for (const s of segments(t[1])) if (estTexte(s)) out.push({ fichier: rel, ligne: ligneDe(src, a + t.index + 1), texte: s, brut: t[1] });
      }
      const reA = /\b(placeholder|title|alt)="([^"]{3,})"/g;
      while ((t = reA.exec(html))) {
        const s = decoder(t[2]).trim();
        if (estTexte(s)) out.push({ fichier: rel, ligne: ligneDe(src, a + t.index), texte: s, brut: t[0], attribut: t[1] });
      }
    }
  } else ajouterJS(src, 1);
  return (cacheTextes[rel] = out);
}

/* ---------- fichiers concernés ---------- */
const JS_FRONT = [...liste('app', /\.js$/), ...liste('v3', /\.js$/), 'sw.js'];
const PAGES = ['application.dc.html', 'index-v3.html'].filter(existe);
const FRONT_TEXTES = [...PAGES, ...liste('app', /\.js$/), ...liste('v3', /\.js$/), ...liste('v2', /\.js$/)];
const APP_TEXTES = ['application.dc.html', ...liste('app', /\.js$/), ...liste('v3', /\.js$/)];
const CSS_FRONT = [...liste('css', /\.css$/), ...liste('v3', /\.css$/)];

/* a. Syntaxe */
controle('syntaxe', () => {
  let n = 0;
  for (const f of JS_FRONT) {
    n++;
    const r = cp.spawnSync(process.execPath, ['--check', path.join(RACINE, f)], { encoding: 'utf8' });
    if (r.status !== 0) {
      const err = (r.stderr || '').split('\n');
      const m = /:(\d+)\s*$/.exec(err[0] || '');
      const msg = err.find(l => /Error/.test(l)) || err[0] || 'erreur de syntaxe';
      signaler('rouge', 'syntaxe', f + ':' + (m ? m[1] : '1'), 'le fichier ne se lit pas : ' + court(msg, 160) + ' (toute la page peut s’arrêter)');
    }
  }
  for (const p of PAGES) {
    const src = lire(p), re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(src))) {
      if (/\bsrc=/.test(m[1]) || !m[2].trim() || /babel/.test(m[1])) continue;
      n++;
      const l = ligneDe(src, m.index);
      if (/json/.test(m[1])) { try { JSON.parse(m[2]); } catch (e) { signaler('rouge', 'syntaxe', p + ':' + l, 'données JSON illisibles : ' + court(e.message, 120)); } continue; }
      try { new vm.Script(m[2], { filename: p }); }
      catch (e) {
        const lm = /:(\d+)/.exec((e.stack || '').split('\n')[0]);
        signaler('rouge', 'syntaxe', p + ':' + (lm ? l + +lm[1] - 1 : l), 'script illisible : ' + court(e.message, 160));
      }
    }
  }
  return { texte: n + ' fichiers et scripts lus sans erreur' };
});

/* b. Cache et versions */
controle('cache', () => {
  let nRefs = 0; const versions = {};   // fichier → { v → [lieux] }
  const sources = [...PAGES, 'sw.js', ...liste('app', /\.js$/), ...liste('v3', /\.js$/)];
  for (const f of sources) {
    const src = lire(f), re = /["'(]((?:\.\/)?[\w\/.-]+\.(?:js|css|jsx|json|webp|png|svg|webmanifest|html))\?v=([\w.-]+)/g; let m;
    while ((m = re.exec(src))) {
      const cible = m[1].replace(/^\.\//, '');
      nRefs++; const lieu = f + ':' + ligneDe(src, m.index);
      if (!existe(cible)) signaler('rouge', 'cache', lieu, '« ' + cible + '?v=' + m[2] + ' » : ce fichier n’existe pas');
      if (!PAGES.includes(f)) continue;
      ((versions[cible] = versions[cible] || {})[m[2]] = versions[cible][m[2]] || []).push(lieu);
    }
  }
  for (const [cible, vs] of Object.entries(versions)) {
    const cles = Object.keys(vs);
    if (cles.length > 1)
      signaler('orange', 'cache', vs[cles[0]][0], '« ' + cible + ' » est appelé avec ' + cles.length + ' versions différentes (' +
        cles.map(v => '?v=' + v + ' dans ' + vs[v].map(x => x.split(':')[0] + ':' + x.split(':')[1]).join(', ')).join(' ; ') + ') : mettre la même');
  }
  // sw.js : chaque fichier « indispensable » (CORE) doit exister, sinon l'installation de la nouvelle version échoue
  const sw = lire('sw.js');
  const core = /const CORE = \[([\s\S]*?)\n\];/.exec(sw);
  if (core) {
    const re = /"([^"]+)"/g; let m;
    while ((m = re.exec(core[1]))) {
      const f = m[1].split('?')[0];
      if (f === './' || f === '') continue;
      if (!existe(f)) signaler('rouge', 'cache', 'sw.js:' + ligneDe(sw, core.index + m.index), 'fichier indispensable « ' + f + ' » absent : la mise à jour hors connexion échouera');
    }
  } else signaler('orange', 'cache', 'sw.js:1', 'liste CORE introuvable dans sw.js (le contrôle ne sait plus la lire)');
  if (!/const CACHE = 'mgci-v\d{3,}'/.test(sw)) signaler('orange', 'cache', 'sw.js:1', 'CACHE n’a pas la forme « mgci-vNNN »');
  // IMAGES : chaque image listée existe ; chaque photo de produit a son identifiant dans A.SACK (sinon elle ne s'affiche pas)
  const im = /const IMAGES = \[([^\]]*)\]/.exec(sw);
  if (im) {
    const noms = (im[1].match(/"([^"]+)"/g) || []).map(s => s.slice(1, -1).split('?')[0]);
    for (const nom of noms) if (!existe('v2/img/' + nom)) signaler('rouge', 'cache', 'sw.js:' + ligneDe(sw, im.index), 'image « v2/img/' + nom + ' » listée dans IMAGES mais absente');
    const absentes = liste('v2/img', /\.webp$/).filter(f => !noms.includes(f.slice(7)));
    if (absentes.length) signaler('info', 'cache', 'sw.js:' + ligneDe(sw, im.index), absentes.length + ' images de v2/img ne sont pas gardées hors connexion (pas dans IMAGES) : normal pour les photos chargées à la demande');
  }
  const app = existe('app/marche-app.js') ? lire('app/marche-app.js') : '';
  const sack = /A\.SACK = \{([^}]*)\}/.exec(app);
  if (sack) {
    const ids = new Set((sack[1].match(/(?:'([^']+)'|([\w-]+))\s*:/g) || []).map(s => s.replace(/['\s:]/g, '')));
    for (const f of liste('v2/img', /^produit-.*\.webp$/)) {
      const id = f.slice('v2/img/produit-'.length, -5);
      if (!ids.has(id)) signaler('orange', 'cache', f, 'photo de produit « ' + id + ' » sans entrée dans A.SACK (app/marche-app.js) : elle ne s’affiche pas');
    }
  }
  return { texte: nRefs + ' appels avec ?v=, liste CORE et images de sw.js' };
});

/* c. Mots interdits (et communes d'Abidjan) */
const INTERDITS = [
  { re: /\bPAY[ÉE]E?S?\b/, niveau: 'rouge', msg: '« PAYÉ » est interdit (aucun paiement n’est branché)' },
  { re: /^Pay[ée]e?s?$/, niveau: 'rouge', msg: '« Payé » seul comme statut : interdit (aucun paiement n’est branché)' },
  { re: /\bnon inclus\b/i, niveau: 'rouge', msg: 'transport : écrire « Transport à la charge de l’acheteur », jamais « Non inclus »' },
  { re: /\bsans transport\b/i, niveau: 'rouge', msg: 'transport : écrire « Transport à la charge de l’acheteur », jamais « Sans transport »' },
  { re: /l[’']acheteur vient (le |la |les )?cherch/i, niveau: 'rouge', msg: 'transport : jamais « l’acheteur vient chercher »', retrait: true }
];
const COMMUNES = ['Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Brofodoumé', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon'];
controle('mots-interdits', () => {
  let n = 0;
  for (const f of FRONT_TEXTES) for (const t of textesDe(f)) {
    n++;
    for (const r of INTERDITS) {
      if (!r.re.test(t.texte)) continue;
      // « retrait » (l'acheteur passe prendre, si le vendeur l'accepte) est un autre choix : à regarder seulement (orange)
      const avant = (lignesDe(f)[t.ligne - 1] || '').split(t.texte.slice(0, 12))[0];
      if (r.retrait && !/\bacheteur\s*:\s*[^,]*$/.test(avant))
        signaler('orange', 'mots-interdits', f + ':' + t.ligne, 'transport : « l’acheteur vient chercher » est interdit pour « à la charge de l’acheteur » ; vérifier qu’il s’agit bien d’un retrait accepté par le vendeur : « ' + court(t.texte, 100) + ' »', t.texte);
      else signaler(r.niveau, 'mots-interdits', f + ':' + t.ligne, r.msg + ' : « ' + court(t.texte, 100) + ' »', t.texte);
    }
    if (/encaiss/i.test(t.texte) && /commission/i.test(t.texte) && !/\b(jamais|pas|aucune?|ni|non|rien)\b|n[’']/i.test(t.texte))
      signaler('rouge', 'mots-interdits', f + ':' + t.ligne, 'une commission n’est jamais présentée comme encaissée : « ' + court(t.texte, 100) + ' »', t.texte);
  }
  // les chaînes très courtes (étiquettes d'un mot) ne passent pas par estTexte : « PAYÉ » y est cherché à part
  for (const f of FRONT_TEXTES) {
    const src = lire(f), re = /(['"`>])\s*(PAY[ÉE]E?S?)\s*(['"`<])/g; let m;
    while ((m = re.exec(src))) signaler('rouge', 'mots-interdits', f + ':' + ligneDe(src, m.index), '« ' + m[2] + ' » en étiquette : interdit (aucun paiement n’est branché)', m[2]);
  }
  return { texte: n + ' textes relus'};
});
controle('communes', () => {
  const ou = COMMUNES.join('|');
  const reVille = new RegExp('\\b(uniquement|seulement)\\s+(à|a)\\s+(' + ou + ')\\b|\\b(Vente|Achat|vends|achète)\\b[^.]{0,25}\\b(à|a)\\s+(' + ou + ')\\b|^(' + ou + ') uniquement$', 'i');
  for (const f of FRONT_TEXTES) for (const t of textesDe(f))
    if (reVille.test(t.texte)) signaler('orange', 'communes', f + ':' + t.ligne, 'une commune d’Abidjan semble proposée comme ville (Abidjan est une seule ville) : « ' + court(t.texte, 100) + ' »', t.texte);
  for (const f of FRONT_TEXTES) {
    const src = lire(f), re = new RegExp('data-k="ville"[^>]*placeholder="[^"]*\\b(' + ou + ')\\b|placeholder="[^"]*\\b(' + ou + ')\\b[^"]*"[^>]*data-k="ville"', 'g'); let m;
    while ((m = re.exec(src))) signaler('orange', 'communes', f + ':' + ligneDe(src, m.index), 'exemple « ' + (m[1] || m[2]) + ' » dans un champ ville : une commune d’Abidjan n’est pas une ville', 'placeholder ' + (m[1] || m[2]));
  }
  if (existe('app/villes.js')) {
    const src = lire('app/villes.js'), v = /const V = \{([\s\S]*?)\n\s*\};/.exec(src);
    if (v) for (const c of COMMUNES) {
      const re = new RegExp("'" + c + "'"), m = re.exec(v[1]);
      if (m) signaler('rouge', 'communes', 'app/villes.js:' + ligneDe(src, v.index + m.index), 'la commune « ' + c + ' » est dans la liste des villes : Abidjan est une seule ville');
    }
  }
  return { texte: 'textes, champs ville et liste des villes (app/villes.js)' };
});

/* d. Doublons */
controle('doublon-texte', () => {
  const par = new Map();
  for (const f of FRONT_TEXTES) for (const t of textesDe(f)) {
    if (t.texte.length <= SEUILS.doublonMin) continue;
    const k = t.texte.replace(/…/g, '…');
    if (!par.has(k)) par.set(k, new Map());
    const m = par.get(k); if (!m.has(f)) m.set(f, t.ligne);
  }
  const groupes = [...par.entries()].filter(([, m]) => m.size > 1).sort((a, b) => b[1].size - a[1].size || b[0].length - a[0].length);
  for (const [txt, m] of groupes.slice(0, SEUILS.doublonMax)) {
    const lieux = [...m.entries()].map(([f, l]) => f + ':' + l);
    signaler('orange', 'doublon-texte', lieux[0], 'même texte dans ' + m.size + ' fichiers (' + lieux.join(', ') + ') : « ' + court(txt, 90) + ' »', txt + ' ' + [...m.keys()].join(' '));
  }
  if (groupes.length > SEUILS.doublonMax) signaler('info', 'doublon-texte', '', (groupes.length - SEUILS.doublonMax) + ' autres textes en double non listés (les plus répétés sont en haut)');
  return { texte: 'textes de plus de ' + SEUILS.doublonMin + ' caractères' };
});
controle('doublon-fonction', () => {
  const fichiers = [...JS_FRONT.filter(f => f !== 'sw.js'), ...liste('v2', /\.js$/)];
  const analyser = (rel, code, ligne0) => {
    const vus = new Map();
    for (const fn of lireJS(code, ligne0).fonctions) {
      const k = fn.bloc + ' ' + fn.nom;
      if (vus.has(k)) signaler('orange', 'doublon-fonction', rel + ':' + fn.ligne, 'la fonction « ' + fn.nom + ' » est déjà définie au même endroit (ligne ' + vus.get(k) + ') : la seconde remplace la première');
      else vus.set(k, fn.ligne);
    }
  };
  for (const f of fichiers) analyser(f, lire(f), 1);
  for (const p of PAGES) {
    const src = lire(p), re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(src))) if (!/\bsrc=|json|babel/.test(m[1])) analyser(p, m[2], ligneDe(src, m.index + m[0].indexOf('>') + 1));
  }
  return { texte: fichiers.length + ' fichiers JS et les scripts des pages' };
});
controle('doublon-id', () => {
  for (const p of PAGES) {
    const src = lire(p).replace(/<script\b[\s\S]*?<\/script>/gi, s => s.replace(/[^\n]/g, ' ')).replace(/<!--[\s\S]*?-->/g, s => s.replace(/[^\n]/g, ' '));
    const vus = new Map(), re = /\sid="([^"]+)"/g; let m;
    while ((m = re.exec(src))) {
      const l = ligneDe(src, m.index);
      if (vus.has(m[1])) signaler('rouge', 'doublon-id', p + ':' + l, 'l’identifiant « ' + m[1] + ' » existe deux fois (déjà ligne ' + vus.get(m[1]) + ') : le code ne trouvera que le premier');
      else vus.set(m[1], l);
    }
  }
  return { texte: 'identifiants du HTML de ' + PAGES.join(' et ') };
});

/* e. Sur-explications */
const SLOGANS = /\b(révolution\w*|en quelques clics|simple,? (et )?rapide|rapide et simple|ne manquez pas|rejoignez (des milliers|la communauté|le mouvement)|découvrez dès (maintenant|aujourd)|n°\s?1|numéro 1|incroyable|facilement et rapidement|en toute simplicité|sans effort|boostez|transformez votre|propulsez|à portée de (main|clic)|nouvelle ère|game[- ]changer|tout-en-un|n[’']attendez plus|sans plus attendre)\b|!!|!\s*$.*!\s*$/i;
controle('long-texte', () => {
  const longs = [];
  for (const f of APP_TEXTES) for (const t of textesDe(f)) {
    if (t.attribut === 'alt') continue;
    if (/aria-label="[^"]*$/.test(t.brut.split(t.texte)[0] || '')) continue;
    const mots = t.texte.split(' ').filter(m => /[A-Za-zÀ-ÿ0-9]/.test(m)).length;
    if (mots > SEUILS.motsMax) longs.push({ t, mots });
  }
  longs.sort((a, b) => b.mots - a.mots);
  for (const { t, mots } of longs) signaler('orange', 'long-texte', t.fichier + ':' + t.ligne, mots + ' mots à l’écran : « ' + court(t.texte, 110) + ' »', t.texte);
  return { texte: 'textes de l’application de plus de ' + SEUILS.motsMax + ' mots' };
});
controle('slogan', () => {
  for (const f of FRONT_TEXTES) for (const t of textesDe(f))
    if (SLOGANS.test(t.texte)) signaler('orange', 'slogan', f + ':' + t.ligne, 'tournure de slogan : « ' + court(t.texte, 110) + ' »', t.texte);
  return { texte: 'tournures publicitaires toutes faites' };
});

/* f. Design : police et bleu */
const FICHIERS_STYLE = [...CSS_FRONT, ...PAGES, ...liste('app', /\.js$/), ...liste('v3', /\.js$/)];
controle('police', () => {
  const ok = /^(jost|inherit|initial|unset|var\(|-apple-system$)/i;
  for (const f of FICHIERS_STYLE) {
    const src = lire(f);
    const re = /font-family\s*:\s*([^;}"'`\n]+|"[^"]*"[^;}`\n]*|'[^']*'[^;}`\n]*)/gi; let m;
    while ((m = re.exec(src))) {
      const premiere = m[1].split(',')[0].replace(/\\/g, '').trim().replace(/^["']|["']$/g, '');
      if (!premiere || ok.test(premiere) || /^\$\{|^\w+\s*\+/.test(premiere)) continue;
      signaler('orange', 'police', f + ':' + ligneDe(src, m.index), 'police « ' + court(premiere, 40) + ' » : une seule police, Jost', f + ' ' + premiere);
    }
    const reF = /(?:^|[;{\s"'`])font\s*:\s*([^;}"'`\n]+)/g;
    while ((m = reF.exec(src))) {
      const v = m[1].trim();
      const fm = /(?:^|\s)[\d.]+(?:px|rem|em|%|pt|vw|vh)(?:\s*\/\s*[\d.]+\w*)?\s+(.+)$/.exec(v);
      if (!fm) continue;
      const premiere = fm[1].split(',')[0].replace(/\\/g, '').trim().replace(/^["']|["']$/g, '');
      if (!premiere || ok.test(premiere) || /^\$\{|\+/.test(premiere)) continue;   // vide : nom entre guillemets échappés (\'Jost\'), lu à part
      signaler('orange', 'police', f + ':' + ligneDe(src, m.index), 'police « ' + court(premiere, 40) + ' » : une seule police, Jost', f + ' ' + premiere);
    }
  }
  return { texte: FICHIERS_STYLE.length + ' fichiers de style et de code' };
});
function teinte(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join('');
  h = h.slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let t = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  t *= 60; if (t < 0) t += 360;
  return { h: t, s, l };
}
controle('bleu', () => {
  const vus = new Map();   // fichier → { couleur → première ligne, nombre }
  for (const f of FICHIERS_STYLE) {
    const src = lire(f), re = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g; let m;
    while ((m = re.exec(src))) {
      const avant = src.slice(Math.max(0, m.index - 12), m.index);
      if (/(href|url\(|id|#)\s*=?\s*["']?$|[\w-]$|(\$|querySelector(All)?|closest|matches)\(\s*["'`]$/.test(avant)) continue;   // ancre ou sélecteur, pas une couleur
      if (/[a-f]/.test(m[1]) && /[A-F]/.test(m[1])) continue;   // casse mélangée (#acF) : un identifiant, pas une couleur
      const c = teinte(m[0]);
      if (c.h >= 190 && c.h <= 250 && c.s >= 0.35 && c.l >= 0.15 && c.l <= 0.9) {
        const k = m[0].toUpperCase();
        if (!vus.has(f)) vus.set(f, new Map());
        const mf = vus.get(f);
        if (!mf.has(k)) mf.set(k, { ligne: ligneDe(src, m.index), n: 0 });
        mf.get(k).n++;
      }
    }
  }
  for (const [f, mf] of vus) for (const [k, o] of mf)
    signaler('orange', 'bleu', f + ':' + o.ligne, 'couleur bleue ' + k + (o.n > 1 ? ' (' + o.n + ' fois dans ce fichier)' : '') + ' : pas de bleu, sauf le lien « compatible » et l’eau des cartes', k);
  return { texte: 'couleurs #hex des fichiers de style et de code' };
});

/* g. SQL */
controle('sql', () => {
  // la plupart sont attendus (« drop policy », « drop function », règles « for delete ») : une seule ligne de résumé,
  // puis une ligne par fichier seulement pour ce qui efface des données (drop table, truncate, delete from)
  const fichiers = liste('supabase', /^schema-.*\.sql$/);
  const avec = [];
  for (const f of fichiers) {
    const src = lire(f), sans = src.replace(/--[^\n]*/g, s => s.replace(/[^\n]/g, ' ')).replace(/\b(revoke|grant)\b[^;]*;/gi, s => s.replace(/[^\n]/g, ' '));
    if (/\b(drop|delete|truncate)\b/i.test(sans)) avec.push(f.replace('supabase/', ''));
    const re = /\b(drop\s+table|truncate|delete\s+from)\b/gi; let m; const vus = {};
    while ((m = re.exec(sans))) {
      const k = m[1].toLowerCase().replace(/\s+/g, ' ');
      if (vus[k]) { vus[k].n++; continue; }
      vus[k] = { n: 1, ligne: ligneDe(src, m.index) };
    }
    const k = Object.keys(vus);
    if (k.length) signaler('info', 'sql', f + ':' + vus[k[0]].ligne, k.map(x => '« ' + x + ' » ×' + vus[x].n).join(', ') + ' : efface des données quand il tourne (fichier relancé ou fonction appelée) : à relire avant de relancer ce fichier');
  }
  if (avec.length) signaler('info', 'sql', '', avec.length + ' fichiers sur ' + fichiers.length + ' contiennent drop, delete ou truncate (le plus souvent « drop policy », « drop function » ou une règle « for delete », sans danger) : ' + avec.join(', '));
  return { texte: fichiers.length + ' fichiers supabase/schema-*.sql' };
});

/* h. Liens vers des fichiers */
controle('liens', () => {
  const docsCQ = (function tous(dir) {
    if (!existe(dir)) return [];
    return fs.readdirSync(path.join(RACINE, dir), { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? (e.name === 'rapports' ? [] : tous(dir + '/' + e.name)) : (/\.md$/.test(e.name) ? [dir + '/' + e.name] : []));
  })('CONTROLE_QUALITE');   // les rapports datés sont des photos d'un jour : leurs liens ne sont pas relus
  const docs = [...(EXC.documentsLiens || ['CLAUDE.md']), ...docsCQ].filter(existe);
  // nom de fichier seul (« regles-93-scenarios.sql ») : il suffit qu'un fichier du dépôt porte ce nom
  let noms = new Set();
  let suivis = [];
  try { suivis = cp.execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: RACINE, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean); } catch (_) { }
  noms = new Set(suivis.map(f => f.split('/').pop()));
  const dossiers = new Set(suivis.flatMap(f => f.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/') + '/')));
  const dejaVus = new Set();
  for (const d of [...new Set(docs)]) {
    const src = lire(d);
    const re = /`([^`\s]+)`|\]\(([^)\s#]+)(?:#[^)]*)?\)/g; let m;
    while ((m = re.exec(src))) {
      let p = (m[1] || m[2]).replace(/[?#].*$/, '').replace(/:\d[\d,-]*$/, '').replace(/[),.;:]+$/, '');   // « fichier.js:12 » → « fichier.js »
      if (/^(https?:|mailto:|\/)/.test(p)) continue;                        // adresse web ou chemin de la machine (/opt/…)
      if (/^[\w.-]+\/[\w.-]+$/.test(p) && !/\.\w+$/.test(p) && !existe(p.split('/')[0])) continue;   // dépôt GitHub (auteur/nom)
      if (!/\//.test(p) && !/\.(md|js|html|json|sql|yml|css|py|txt|pdf|webp|png)$/.test(p)) continue;
      if (/[<>*{}$|]|\bNN\b|XX|AAAA|JJ|\.\.\.|…/.test(p) || /^[-.]/.test(p) || /\s/.test(p)) continue;
      if (!/\//.test(p) && noms.has(p)) continue;
      if (/^(origin|claude|refs)\//.test(p) || /^[\w-]+\/[\w.-]+$/.test(p) && !/\./.test(p.split('/').pop()) && !existe(p) && /^[A-Z]/.test(p)) continue;
      const base = d.startsWith('CONTROLE_QUALITE/') ? path.posix.dirname(d) : '';
      const cand = [p, base ? path.posix.normalize(base + '/' + p) : null, base ? 'CONTROLE_QUALITE/' + p : null].filter(Boolean);
      if (cand.some(existe) || cand.some(c => dossiers.has(c.replace(/\/?$/, '/')))) continue;
      if (/^repos\/|^Stan77i\/|\/(pulls|issues)\b/.test(p)) continue;     // adresses GitHub, pas des fichiers
      const cle = d + ' ' + p;
      if (dejaVus.has(cle)) continue; dejaVus.add(cle);
      signaler('orange', 'liens', d + ':' + ligneDe(src, m.index), '« ' + p + ' » est cité mais n’existe pas dans le dépôt', p);
    }
  }
  return { texte: docs.join(', ') };
});

/* Navigateur (facultatif) : ouvre l'application en iPhone émulé et relève les erreurs JavaScript */
function trouverPlaywright() {
  const essais = [process.env.PLAYWRIGHT_MODULE, 'playwright', path.join(RACINE, 'node_modules', 'playwright'), '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const e of essais) { try { return require(e); } catch (_) { } }
  return null;
}
async function controleNavigateur() {
  const pw = trouverPlaywright();
  if (!pw) { nonVerifies.push({ controle: 'navigateur', raison: 'Playwright n’est pas installé ici : les erreurs au chargement de l’application n’ont pas été cherchées' }); return; }
  const http = require('http');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.pbf': 'application/x-protobuf' };
  const serveur = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(RACINE, path.normalize(p).replace(/^(\.\.[\/\\])+/, ''));
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => serveur.listen(0, '127.0.0.1', r));
  const port = serveur.address().port;
  let navigateur;
  try {
    const lanceur = {};
    const chemins = [process.env.CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean);
    for (const c of chemins) if (fs.existsSync(c)) { lanceur.executablePath = c; break; }
    navigateur = await pw.chromium.launch(lanceur);
    const ctx = await navigateur.newContext({ ...pw.devices['iPhone 13'], serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const vus = new Set();
    page.on('pageerror', e => {
      const k = court(e.message, 200); if (vus.has(k)) return; vus.add(k);
      const pile = /(https?:\/\/127\.0\.0\.1:\d+\/)([^\s:)]+):(\d+)/.exec(e.stack || '');
      signaler('rouge', 'navigateur', pile ? pile[2] + ':' + pile[3] : 'application.dc.html', 'erreur JavaScript à l’ouverture de l’application : ' + k, k);
    });
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/Failed to load resource|net::ERR|supabase|ERR_NAME|ERR_CONNECTION|CORS|fetch/i.test(t)) return;   // réseau coupé pendant le contrôle
      const k = court(t, 200); if (vus.has(k)) return; vus.add(k);
      signaler('orange', 'navigateur', 'application.dc.html', 'message d’erreur dans la console : ' + k, k);
    });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.goto('http://127.0.0.1:' + port + '/application.dc.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(6000);
    const vide = await page.evaluate(() => (document.body && document.body.innerText || '').trim().length);
    if (vide < 20) signaler('rouge', 'navigateur', 'application.dc.html', 'écran presque vide après 6 secondes (' + vide + ' caractères visibles)');
    if (![...constats].some(c => c.controle === 'navigateur')) passes.push({ controle: 'navigateur', texte: 'application ouverte en iPhone émulé, sans erreur JavaScript (réseau extérieur coupé)' });
  } catch (e) {
    nonVerifies.push({ controle: 'navigateur', raison: 'le navigateur n’a pas pu s’ouvrir : ' + court(e.message, 160) });
  } finally {
    if (navigateur) await navigateur.close().catch(() => { });
    serveur.close();
  }
}

/* ---------- rapport ---------- */
function lien(lieu) {
  if (!lieu) return '';
  const [f, l] = lieu.split(':');
  const depot = process.env.GITHUB_REPOSITORY, sha = process.env.GITHUB_SHA;
  if (depot && sha && f && existe(f)) return '[`' + lieu + '`](https://github.com/' + depot + '/blob/' + sha + '/' + f + (l ? '#L' + l : '') + ')';
  return '`' + lieu + '`';
}
function rapport() {
  const date = new Date();
  const jour = date.toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  const r = constats.filter(c => c.niveau === 'rouge'), o = constats.filter(c => c.niveau === 'orange'), inf = constats.filter(c => c.niveau === 'info');
  const L = [];
  L.push('# Rapport du contrôle statique · ' + jour, '');
  L.push('**En bref** : ' + (r.length ? r.length + ' rouge' + (r.length > 1 ? 's' : '') + ' (à corriger vite)' : 'aucun rouge') + ', ' +
    (o.length ? o.length + ' orange' + (o.length > 1 ? 's' : '') + ' (à regarder)' : 'aucun orange') + ', ' +
    passes.length + ' contrôle' + (passes.length > 1 ? 's' : '') + ' sans rien à signaler' +
    (nonVerifies.length ? ', ' + nonVerifies.length + ' non vérifié' + (nonVerifies.length > 1 ? 's' : '') : '') + '.', '');
  if (ignores) L.push('_' + ignores + ' constat' + (ignores > 1 ? 's' : '') + ' mis de côté par les exceptions connues (`tools/controle/exceptions.json`)._', '');
  const section = (titre, liste) => {
    if (!liste.length) return;
    L.push('## ' + titre, '');
    const par = {};
    for (const c of liste) (par[c.controle] = par[c.controle] || []).push(c);
    for (const [k, cs] of Object.entries(par)) {
      L.push('### ' + (NOMS[k] || k) + ' (' + cs.length + ')', '');
      for (const c of cs.slice(0, SEUILS.parGroupe)) L.push('- ' + (c.lieu ? lien(c.lieu) + ' : ' : '') + c.message);
      if (cs.length > SEUILS.parGroupe) L.push('- … et ' + (cs.length - SEUILS.parGroupe) + ' autres (lancer `node tools/controle/controle.js` pour la liste complète)');
      L.push('');
    }
  };
  section('Rouge : à corriger', r);
  section('Orange : à regarder', o);
  section('Pour information', inf);
  L.push('## Vérifié', '');
  for (const p of passes) L.push('- ' + (NOMS[p.controle] || p.controle) + ' : rien à signaler' + (p.texte ? ' (' + p.texte + ')' : '') + '.');
  if (!passes.length) L.push('- Aucun contrôle n’est passé sans constat.');
  L.push('');
  L.push('## Non vérifié', '');
  if (nonVerifies.length) for (const n of nonVerifies) L.push('- ' + (NOMS[n.controle] || n.controle) + ' : ' + n.raison + '.');
  else L.push('- Tout a été vérifié.');
  L.push('', '---', '_Fait par `tools/controle/controle.js`' + (process.env.GITHUB_SHA ? ' sur la version ' + process.env.GITHUB_SHA.slice(0, 7) : '') + '. Mode d’emploi : `tools/controle/README.md`._');
  let texte = L.join('\n') + '\n';
  if (texte.length > 60000) texte = texte.slice(0, 59000) + '\n\n… rapport coupé (trop long pour GitHub). Lancer `node tools/controle/controle.js` pour tout voir.\n';
  return { texte, r: r.length, o: o.length };
}

(async () => {
  try {
    if (!process.argv.includes('--sans-navigateur')) await controleNavigateur();
    else nonVerifies.push({ controle: 'navigateur', raison: 'désactivé (--sans-navigateur)' });
  } catch (e) { nonVerifies.push({ controle: 'navigateur', raison: court(e.message, 160) }); }
  const ordre = Object.keys(NOMS);
  const rang = c => ordre.indexOf(c.controle);
  constats.sort((a, b) => rang(a) - rang(b));
  passes.sort((a, b) => ordre.indexOf(a.controle) - ordre.indexOf(b.controle));
  const { texte, r, o } = rapport();
  fs.writeFileSync(SORTIE, texte);
  if (SORTIE_JSON) fs.writeFileSync(SORTIE_JSON, JSON.stringify({
    date: new Date().toISOString(), constats: constats.map(({ niveau, controle, lieu, message, cle }) => ({ niveau, controle, lieu, message, cle: cle || null })),
    passes, nonVerifies, ignores
  }, null, 1));
  console.log('Contrôle statique : ' + r + ' rouge(s), ' + o + ' orange(s) → ' + path.relative(process.cwd(), SORTIE));
  process.exit(0);
})().catch(e => { console.error(e); try { fs.writeFileSync(SORTIE, '# Rapport du contrôle statique\n\nLe contrôle s’est arrêté sur une erreur : ' + e.message + '\n'); } catch (_) { } process.exit(0); });
