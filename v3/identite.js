/* ═════════ Marché de Gros CI — vérification d'identité (supabase/schema-13-identite.sql) ═════════
   Parcours : la pièce (recto, verso), un selfie tenant un code écrit à la main, le nom comme sur la pièce, puis l'envoi.
   Un administrateur décide (admin.html, onglet Identités). Rien n'est jamais déclaré « vérifié » automatiquement :
   la lecture de la bande MRZ (Tesseract.js, dans le téléphone) pré-remplit le nom et n'est qu'une indication pour l'administrateur.
   API : MDGIdentite.ouvrir() · statut(force) · estVerifie(uid) · badge(taille, texte?) · lireMRZ(blob, piece) · analyserMRZ(texte)
   Événement « mdg:identite » quand un statut ou un badge arrive. Aucune donnée de la pièce n'est écrite dans la console. */
(function () {
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const IC = (n, t, w) => (window.MDGIco && window.MDGIco.svg(n, t || 20, w || 1.9)) || '';
  const me = () => { const s = N() && N().session(); return s && s.user; };
  const dire = () => { dispatchEvent(new CustomEvent('mdg:identite')); dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'nuage' } })); };
  const PIECES = [['cni', 'Carte nationale d’identité', 'La CNI ivoirienne, recto et verso'], ['passeport', 'Passeport', 'La page avec votre photo'], ['carte_consulaire', 'Carte consulaire', 'Recto et verso'], ['permis', 'Permis de conduire', 'Recto et verso']];
  const PIECE_TXT = Object.fromEntries(PIECES.map(p => [p[0], p[1]]));
  const dateFr = t => t ? new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  /* ——— le badge ——— */
  const badge = (t = 16, texte) => `<span class="idv-badge${texte ? ' txt' : ''}" title="Identité vérifiée par le Marché de Gros" role="img" aria-label="Identité vérifiée"><svg width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 1.6l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.2L12 22.4l-2.6-1.9-3.2.2-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.2z"/><path d="m8 12.2 2.7 2.7L16.2 9.4" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>${texte ? '<b>' + esc(texte === true ? 'Identité vérifiée' : texte) + '</b>' : ''}</span>`;

  // qui est vérifié ? petit cache (6 h) et demandes groupées : identite_verifiee(ids) est lisible sans compte
  const KV = 'mdg-identite:v', TTL = 6 * 3600e3;
  let file = new Set(), minuterie = 0;
  function estVerifie(uid) {
    if (!uid) return false;
    const c = J(KV, {})[uid];
    if (!c || Date.now() - c.t > TTL) { file.add(uid); clearTimeout(minuterie); minuterie = setTimeout(demander, 60); }
    return !!(c && c.v);
  }
  async function demander() {
    const ids = [...file].slice(0, 200); file = new Set(); if (!ids.length || !N()) return;
    try {
      const r = await N().rpc('identite_verifiee', { ids }, false), ok = new Set((r || []).map(x => typeof x === 'string' ? x : x.identite_verifiee));
      const c = J(KV, {}), t = Date.now(); let change = false;
      ids.forEach(id => { const v = ok.has(id); if (!c[id] || c[id].v !== v) change = true; c[id] = { v, t }; });
      const cles = Object.keys(c); if (cles.length > 800) cles.sort((a, b) => c[a].t - c[b].t).slice(0, cles.length - 800).forEach(k => delete c[k]);
      W(KV, c); if (change) dire();
    } catch (_) { /* hors connexion ou schéma pas encore lancé : pas de badge */ }
  }

  // mon statut (gardé pour s'afficher hors connexion)
  const KS = 'mdg-identite:statut';
  async function statut(force) {
    const u = me(); if (!u) return { statut: 'non_verifie' };
    const c = J(KS, null);
    if (!force && c && c.uid === u.id && Date.now() - c.t < 60e3) return c.s;
    try { const s = await N().rpc('identite_statut'); W(KS, { uid: u.id, t: Date.now(), s }); if (!c || JSON.stringify(c.s) !== JSON.stringify(s)) dire(); return s; }
    catch (e) { if (c && c.uid === u.id) return c.s; throw e; }
  }
  const statutCache = () => { const u = me(), c = J(KS, null); return u && c && c.uid === u.id ? c.s : null; };
  const RESUME = { non_verifie: ['Non vérifiée', 'Faire vérifier mon identité'], brouillon: ['À terminer', 'Reprendre l’envoi des photos'], en_attente: ['En cours d’examen', 'Dossier envoyé'], verification_manuelle: ['À revoir', 'Des photos sont à refaire'], verifie: ['Vérifiée', 'Badge visible sur votre profil'], refuse: ['Refusée', 'Voir le motif'] };

  /* ——— photos : réduites dans le téléphone (≈ 300 Ko, JPEG) ——— */
  async function reduire(fichier, cote = 1600) {
    const url = URL.createObjectURL(fichier);
    try {
      const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Photo illisible. Réessayez.')); i.src = url; });
      const k = Math.min(1, cote / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
      cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      for (const q of [0.82, 0.7, 0.58]) { const b = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', q)); if (b && b.size < 1400000) return b; }
      throw new Error('Photo trop lourde. Reprenez-la de plus loin.');
    } finally { URL.revokeObjectURL(url); }
  }

  /* ——— lecture de la bande MRZ (indication seulement) ——— */
  const VAL = c => c === '<' ? 0 : /[0-9]/.test(c) ? +c : /[A-Z]/.test(c) ? c.charCodeAt(0) - 55 : -1;
  const cle = s => { let t = 0; for (let i = 0; i < s.length; i++) { const v = VAL(s[i]); if (v < 0) return -1; t += v * [7, 3, 1][i % 3]; } return t % 10; };
  const chiffre = s => s.replace(/[OQD]/g, '0').replace(/[IL]/g, '1').replace(/Z/g, '2').replace(/S/g, '5').replace(/B/g, '8').replace(/G/g, '6');
  const ok1 = (champ, c) => cle(champ) === +chiffre(c);
  const NORM = l => String(l || '').toUpperCase().replace(/[\s«»]/g, '').replace(/[^A-Z0-9<]/g, '<');
  const nomDe = l => { const [nom, prenoms] = l.replace(/<+$/, '').split('<<'); const net = s => (s || '').replace(/</g, ' ').replace(/\s+/g, ' ').trim(); return { nom: net(nom), prenoms: net(prenoms) }; };
  const cale = (l, n) => (l + '<'.repeat(n)).slice(0, n);
  // les quatre contrôles d'une carte (TD1) ; le numéro long (CNI ivoirienne : CI002829027) met « < » dans la case de contrôle,
  // la suite du numéro et sa clé au début du champ facultatif
  function notesTD1(l1, l2) {
    let docOk;
    if (l1[14] === '<') { const suite = (l1.slice(15).match(/^[A-Z0-9]+/) || [''])[0]; docOk = suite.length >= 2 && ok1(l1.slice(5, 14) + suite.slice(0, -1), suite.slice(-1)); }
    else docOk = ok1(l1.slice(5, 14), l1[14]);
    const naiss = chiffre(l2.slice(0, 6)), exp = chiffre(l2.slice(8, 14));
    return [docOk, ok1(naiss, l2[6]), ok1(exp, l2[14]), ok1(l1.slice(5, 30) + naiss + l2[6] + exp + l2[14] + l2.slice(18, 29), l2[29])].filter(Boolean).length;
  }
  function notesTD3(l2) {
    const doc = l2.slice(0, 9), naiss = chiffre(l2.slice(13, 19)), exp = chiffre(l2.slice(21, 27));
    return [ok1(doc, l2[9]), ok1(naiss, l2[19]), ok1(exp, l2[27]), ok1(doc + l2[9] + naiss + l2[19] + exp + l2[27] + l2.slice(28, 43), l2[43])].filter(Boolean).length;
  }
  // Corrections permises : seulement des confusions typiques à des endroits où elles sont plausibles (O/N/D lus pour 0 dans le
  // numéro, L/K/4 lus pour « < » dans le remplissage), deux au plus, et seulement si elles font passer des contrôles.
  // « valide » n'est donné que si les quatre chiffres de contrôle sont justes. Un chiffre juste mais mal placé n'est jamais « corrigé ».
  const remplissage = (l, i) => 'LK4SRE'.includes(l[i]) && (l[i - 1] === '<' || l[i + 1] === '<') ? '<' : '';
  const versChiffre = c => ({ O: '0', D: '0', Q: '0', N: '0', I: '1', L: '1' })[c] || '';
  function alternatives(l, i, zones) { const z = zones.find(z => i >= z[0] && i < z[1]); return z ? [versChiffre(l[i]), remplissage(l, i)].filter(Boolean) : []; }
  function corriger(lignes, noter, zones) {
    let cur = lignes.slice(), best = noter(...cur), n = 0;
    while (best < 4 && n < 2) {
      let gain = null;
      cur.forEach((l, k) => { for (let i = 0; i < l.length; i++) for (const a of alternatives(l, i, zones[k] || [])) {
        const t = cur.slice(); t[k] = l.slice(0, i) + a + l.slice(i + 1); const v = noter(...t);
        if (v > best && (!gain || v > gain.v)) gain = { v, t }; } });
      if (!gain) break; cur = gain.t; best = gain.v; n++;
    }
    return { lignes: cur, note: best };
  }
  // le nom : chaque mot doit avoir été lu au moins deux fois (une lecture isolée est souvent un morceau ou du bruit)
  function choisirNom(L) {
    const N = L.map(nomDe).filter(n => n.nom); if (!N.length) return { nom: '', prenoms: '' };
    if (N.length === 1) return N[0];
    const nom = vote(N.map(n => n.nom)), c = {};
    N.forEach(n => new Set(n.prenoms.split(' ').filter(Boolean)).forEach(m => { c[m] = (c[m] || 0) + 1; }));
    const ordre = N.filter(n => n.nom === nom).map(n => n.prenoms.split(' ').filter(m => c[m] >= 2)).sort((a, b) => b.length - a.length)[0] || [];
    return { nom, prenoms: ordre.join(' ') };
  }
  const vote = L => { const c = {}; L.forEach(x => { if (x) c[x] = (c[x] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a] || b.length - a.length)[0] || ''; };
  // lectures : pour chaque ligne de la bande (de haut en bas), une ou plusieurs lectures → { format, nom, prenoms, valide }
  function analyserLectures(lect) {
    lect = lect.map(c => c.map(NORM).filter(l => l.length >= 10));
    if (lect.length < 2 || lect.some(c => !c.length)) return null;
    const moy = lect.map(c => Math.max(...c.map(l => l.length))).reduce((a, b) => a + b, 0) / lect.length;
    if (lect.length === 2 && moy > 37) {   // passeport (TD3) : 2 lignes de 44
      let mieux = null;
      for (const b of lect[1]) { const r = corriger([cale(b, 44)], notesTD3, [[[0, 9], [28, 43]]]); if (!mieux || r.note > mieux.note) mieux = r; }
      const n = choisirNom(lect[0].filter(l => l[0] === 'P').map(l => cale(l, 44).slice(5)));
      return n.nom ? { format: 'TD3', nom: n.nom, prenoms: n.prenoms, valide: mieux.note === 4 } : null;
    }
    const L3 = lect.slice(-3);   // carte (TD1) : 3 lignes de 30
    if (L3.length < 3) return null;
    // un bord de carte lu comme une lettre en tête de ligne : on essaie aussi sans les un ou deux premiers caractères
    const sans = (L, ok) => [...new Set(L.flatMap(l => [l, l.slice(1), l.slice(2)].filter(ok)))];
    L3[0] = sans(L3[0], l => /^[ACI]/.test(l) && l.length >= 26);
    L3[1] = sans(L3[1], l => /^\d{6}/.test(chiffre(l.slice(0, 6))) && l.length >= 20);
    L3[2] = L3[2].map(l => l.replace(/^[^A-Z]+/, ''));
    if (L3.some(c => !c.length)) return null;
    let mieux = null;
    for (const a of L3[0]) for (const b of L3[1]) { const r = corriger([cale(a, 30), cale(b, 30)], notesTD1, [[[5, 30]], [[18, 29]]]); if (!mieux || r.note > mieux.note) mieux = r; if (r.note === 4) break; }
    const n = choisirNom(L3[2].map(l => l.replace(/[^A-Z<]/g, '<')));
    return n.nom ? { format: 'TD1', nom: n.nom, prenoms: n.prenoms, valide: mieux.note === 4 } : null;
  }
  // texte OCR brut (une lecture par ligne) → même résultat
  function analyserMRZ(texte) {
    const L = String(texte || '').split(/\n+/).map(NORM).filter(l => l.length >= 28 && l.includes('<'));
    for (let i = 0; i + 1 < L.length; i++) if (L[i][0] === 'P' && L[i].length >= 40) return analyserLectures([[L[i]], [L[i + 1]]]);
    for (let i = 0; i + 2 < L.length; i++) if (/^[ACI]/.test(L[i])) return analyserLectures([[L[i]], [L[i + 1]], [L[i + 2]]]);
    return null;
  }
  let ocr = null;
  function chargerScript(src) { return new Promise((ok, ko) => { if (window.Tesseract) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => ko(new Error('Lecture automatique indisponible')); document.head.appendChild(s); }); }
  async function moteur() {
    if (ocr) return ocr;
    ocr = (async () => {
      await chargerScript('vendor/tesseract/tesseract.min.js');
      const base = new URL('vendor/tesseract/', location.href).href;
      const w = await window.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base + 'core/', langPath: base + 'lang', gzip: true, workerBlobURL: false, logger: () => {} }, { load_system_dawg: '0', load_freq_dawg: '0' });   // pas de dictionnaire : la bande n'a pas de vrais mots
      await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<', preserve_interword_spaces: '0' });
      return w;
    })();
    ocr.catch(() => { ocr = null; });
    return ocr;
  }
  // La photo peut être prise de travers (carte couchée dans une photo en hauteur) : on essaie les quatre sens.
  // Une première lecture trouve les lignes de la bande ; chacune est ensuite relue seule, de plusieurs façons,
  // car les lettres très espacées de la bande font perdre des morceaux de ligne à une lecture d'ensemble.
  async function lireMRZ(blob) {
    const w = await moteur(), url = URL.createObjectURL(blob);
    try {
      const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
      const vue = (rot, y0, h) => {
        const tourne = rot % 180 !== 0, W = tourne ? im.naturalHeight : im.naturalWidth, H = tourne ? im.naturalWidth : im.naturalHeight, k = Math.min(2, 1500 / W);
        const cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * h * k);
        const x = cv.getContext('2d'); x.filter = 'grayscale(1)';
        x.translate(0, -H * y0 * k); x.translate(W * k / 2, H * k / 2); x.rotate(rot * Math.PI / 180); x.scale(k, k);
        x.drawImage(im, -im.naturalWidth / 2, -im.naturalHeight / 2);
        return cv;
      };
      for (const rot of [0, 90, 270, 180]) {
        for (const [y0, h] of [[0.5, 0.5], [0, 1]]) {   // la bande est en bas : le bas d'abord, puis tout
          const cv = vue(rot, y0, h);
          await w.setParameters({ tessedit_pageseg_mode: '6' });
          const r = await w.recognize(cv, {}, { blocks: true }), L = [];
          ((r && r.data && r.data.blocks) || []).forEach(b => b.paragraphs.forEach(p => p.lines.forEach(l => L.push({ t: NORM(l.text), b: l.bbox }))));
          const M = L.filter(l => l.t.length >= 12 && ((l.t.match(/</g) || []).length >= 2 || /\d{6}/.test(l.t))).slice(-3);
          if (M.length < 2) continue;
          const lect = M.map(l => [l.t]), hl = Math.min(...M.map(l => l.b.y1 - l.b.y0));
          // une fois les contrôles justes, on ne relit plus que la ligne du nom (pour l'avoir en entier)
          let res = analyserLectures(lect);
          await w.setParameters({ tessedit_pageseg_mode: '7' });
          for (const [f, sc] of [[0.6, 1], [1, 1], [1, 0.75], [1, 0.6]]) {   // bande plus ou moins haute, lettres resserrées
            for (let k = 0; k < M.length; k++) {
              if (res && res.valide && k < M.length - 1) continue;
              const tdNom = k === M.length - 1 && M.length === 3;   // la ligne du nom d'une carte : rien que des lettres et des « < »
              await w.setParameters({ tessedit_char_whitelist: tdNom ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ<' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
              const hb = Math.round(hl * (1 + f)), c = document.createElement('canvas'); c.width = Math.round(cv.width * sc); c.height = hb;
              c.getContext('2d').drawImage(cv, 0, Math.round(M[k].b.y0 + hl / 2 - hb / 2), cv.width, hb, 0, 0, c.width, hb);
              lect[k].push((await w.recognize(c)).data.text);
            }
            await w.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
            const r2 = analyserLectures(lect); if (r2 && (!res || !res.valide || r2.valide)) res = r2;
          }
          return res;   // la bande est trouvée dans ce sens : inutile d'essayer les autres
        }
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }

  /* ——— apparence (papier clair, comme Mon compte) ——— */
  const CSS = `.idv-badge{display:inline-flex;align-items:center;gap:5px;color:#2C6CB0;vertical-align:-3px;flex:none}
.idv-badge svg{display:block}
.idv-badge.txt{padding:3px 10px 3px 6px;border-radius:999px;background:rgba(106,174,240,.18);font:600 12.5px/1.2 Jost,system-ui,sans-serif;vertical-align:middle}
.idv-bg{position:fixed;inset:0;z-index:8900;background:rgba(8,7,5,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:idvF .2s both}
@media (min-width:760px){.idv-bg{align-items:center;padding:24px}}
.idv{--bg:#F4EEE3;--card:#FFFDF8;--card2:#EFE7D9;--ink:#171512;--mute:#655C4D;--faint:#857A67;--line2:rgba(23,21,18,.14);--acc:#E07A3F;--acc-t:#A0492A;--ok:#2E7D4F;--bad:#C0442B;--blue:#2C6CB0;
  position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:min(94dvh,860px);background:var(--bg);color:var(--ink);border-radius:28px 28px 0 0;font:400 15px/1.45 Jost,system-ui,sans-serif;overflow:hidden;animation:idvUp .32s cubic-bezier(.22,1,.36,1) both}
@media (min-width:760px){.idv{border-radius:28px;height:min(90dvh,820px);box-shadow:0 30px 90px rgba(0,0,0,.5)}}
.idv-top{flex:none;display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;min-height:60px;padding:10px 8px 4px}
.idv-top b{text-align:center;font:600 16px/1.2 Jost,sans-serif}
.idv-ib{width:44px;height:44px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(23,21,18,.07);color:var(--ink);cursor:pointer;font-size:22px;line-height:1}
.idv-ib[hidden]{visibility:hidden}
.idv-ib:focus-visible,.idv button:focus-visible,.idv input:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.idv-pas{display:flex;gap:5px;justify-content:center;padding:0 0 6px}.idv-pas i{width:22px;height:4px;border-radius:2px;background:rgba(23,21,18,.14)}.idv-pas i.on{background:var(--acc)}
.idv-main{flex:1;overflow-y:auto;padding:8px 20px calc(26px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px}
.idv h2{margin:4px 0 0;font:500 30px/1.08 'Cormorant Garamond',Georgia,serif}
.idv p{margin:0;color:var(--mute);line-height:1.5}
.idv-card{background:var(--card);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04)}
.idv-li{display:flex;gap:12px;align-items:flex-start;font-size:14.5px;line-height:1.45}.idv-li svg{flex:none;margin-top:1px;color:var(--acc-t)}
.idv-choix{display:flex;flex-direction:column;gap:8px}
.idv-choix button{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border:1.5px solid transparent;border-radius:16px;background:var(--card);color:var(--ink);text-align:left;cursor:pointer;font:inherit}
.idv-choix button b{display:block;font-weight:600}.idv-choix button small{display:block;color:var(--faint);font-size:13px}
.idv-choix button[aria-pressed=true]{border-color:var(--acc);background:#fff}
.idv-photo{position:relative;display:grid;place-items:center;min-height:210px;border:1.5px dashed rgba(23,21,18,.25);border-radius:20px;background:var(--card);overflow:hidden;cursor:pointer;color:var(--mute);text-align:center;padding:16px}
.idv-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#1d1a15}
.idv-photo span{display:flex;flex-direction:column;align-items:center;gap:8px;font-weight:500}
.idv-photo input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.idv-cadre{width:72%;aspect-ratio:1.586;border:2px solid currentColor;border-radius:10px;opacity:.35}
.idv-code{display:flex;justify-content:center;gap:8px;font:600 44px/1 Jost,sans-serif;letter-spacing:.06em;color:var(--ink)}
.idv-code i{font-style:normal;display:grid;place-items:center;width:58px;height:70px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line2)}
.idv-l{display:block;margin:0 0 6px;font-size:13px;font-weight:500;color:var(--mute)}
.idv-in{width:100%;box-sizing:border-box;height:52px;padding:0 14px;border:1px solid var(--line2);border-radius:13px;background:#fff;color:var(--ink);font:500 17px Jost,sans-serif}
.idv-lu{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:rgba(106,174,240,.14);color:#234f80;font-size:13.5px;line-height:1.4}
.idv-lu.doute{background:rgba(242,201,76,.22);color:#6b4e00}
.idv-act{display:flex;flex-direction:column;gap:8px;margin-top:auto;padding-top:6px}
.idv-go{min-height:54px;border:0;border-radius:27px;background:var(--ink);color:#F5F0E6;font:600 16px Jost,sans-serif;cursor:pointer}
.idv-go[disabled]{opacity:.45;cursor:default}
.idv-alt{min-height:46px;border:0;border-radius:23px;background:rgba(23,21,18,.07);color:var(--ink);font:500 15px Jost,sans-serif;cursor:pointer}
.idv-bad{color:var(--bad);font-size:14px}
.idv-chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45;color:var(--ink)}.idv-chk input{width:22px;height:22px;flex:none;margin:0;accent-color:var(--acc)}
.idv-etat{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:18px 6px}
.idv-etat .rond{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:rgba(23,21,18,.06);color:var(--mute)}
.idv-etat .rond.ok{background:rgba(106,174,240,.18);color:var(--blue)}.idv-etat .rond.att{background:rgba(242,201,76,.24);color:#8A6400}.idv-etat .rond.ko{background:rgba(192,68,43,.12);color:var(--bad)}
.idv-motif{padding:12px 14px;border-radius:14px;background:#fff;box-shadow:inset 0 0 0 1px var(--line2);text-align:left;color:var(--ink);font-size:14.5px;width:100%;box-sizing:border-box}
.idv-barre{height:6px;border-radius:3px;background:rgba(23,21,18,.1);overflow:hidden}.idv-barre i{display:block;height:100%;width:0;background:var(--acc);transition:width .3s}
@keyframes idvUp{from{transform:translateY(40px);opacity:.4}}@keyframes idvF{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.idv-bg,.idv{animation:none}}`;
  let css = false;
  const style = () => { if (css) return; const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); css = true; };
  style();

  /* ——— la fenêtre ——— */
  let bg = null, rendre = null, onKey = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', onKey); if (rendre) { rendre(); rendre = null; } }
  function feuille() {
    style(); fermer();
    bg = document.createElement('div'); bg.className = 'idv-bg';
    bg.innerHTML = `<div class="idv" role="dialog" aria-modal="true" aria-label="Vérifier mon identité"><header class="idv-top"><button type="button" class="idv-ib" data-ret aria-label="Retour" hidden>${IC('retour', 22)}</button><b>Vérifier mon identité</b><button type="button" class="idv-ib" data-x aria-label="Fermer">×</button></header><div class="idv-pas" aria-hidden="true"></div><div class="idv-main" aria-live="polite"></div></div>`;
    document.body.appendChild(bg);
    rendre = N() && N().piege ? N().piege(bg) : null;
    bg.querySelector('[data-x]').onclick = fermer;
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    onKey = e => { if (e.key === 'Escape' && bg && !bg.dataset.lock) fermer(); }; document.addEventListener('keydown', onKey);
    return bg;
  }

  async function ouvrir() {
    if (!me()) { if (N()) N().open(); return; }
    feuille();
    const main = bg.querySelector('.idv-main');
    main.innerHTML = '<p>Chargement…</p>';
    let s; try { s = await statut(true); } catch (e) { main.innerHTML = `<div class="idv-etat"><p class="idv-bad">${!navigator.onLine ? 'Pas de connexion internet : réessayez quand le réseau revient.' : 'La vérification n’est pas encore disponible. Réessayez plus tard.'}</p></div>`; return; }
    if (!bg) return;
    if (s.statut === 'non_verifie' || s.statut === 'brouillon') return parcours(s);
    etat(s);
  }

  // dossier déjà envoyé, à revoir, vérifié ou refusé
  function etat(s) {
    const main = bg.querySelector('.idv-main'); bg.querySelector('.idv-pas').innerHTML = ''; bg.querySelector('[data-ret]').hidden = true;
    const V = {
      en_attente: ['att', IC('horloge', 34), 'Votre dossier est en cours d’examen', `Envoyé le ${dateFr(s.soumis_le)} (${esc(PIECE_TXT[s.piece] || 'pièce')}). Une personne de l’équipe compare votre pièce et votre selfie. Vous serez prévenu ici.`],
      verification_manuelle: ['att', IC('photo', 34), 'Quelques photos sont à refaire', 'L’équipe n’a pas pu terminer l’examen. Voici ce qu’elle demande :'],
      verifie: ['ok', badge(40), 'Identité vérifiée', `Vérifiée le ${dateFr(s.decide_le)}. Le badge apparaît sur votre profil et à côté de votre nom sur vos annonces.`],
      refuse: ['ko', IC('fermer', 34), 'Vérification refusée', 'Motif donné par l’équipe :']
    }[s.statut] || ['', '', 'Statut inconnu', ''];
    main.innerHTML = `<div class="idv-etat"><div class="rond ${V[0]}">${V[1]}</div><h2>${V[2]}</h2><p>${V[3]}</p>${s.motif ? `<div class="idv-motif">${esc(s.motif)}</div>` : ''}
      ${s.statut === 'refuse' && s.nouvel_essai_le ? `<p>Vous pourrez refaire une demande à partir du ${dateFr(s.nouvel_essai_le)}.</p>` : ''}</div>
      <div class="idv-act">${s.statut === 'verification_manuelle' ? '<button type="button" class="idv-go" data-refaire>Renvoyer mes photos</button>' : ''}
      ${s.statut === 'refuse' && (!s.nouvel_essai_le || Date.parse(s.nouvel_essai_le) <= Date.now()) ? '<button type="button" class="idv-go" data-refaire>Refaire une demande</button>' : ''}
      ${['en_attente', 'verification_manuelle'].includes(s.statut) ? '<button type="button" class="idv-alt" data-retirer>Retirer mon dossier</button>' : ''}
      <button type="button" class="idv-alt" data-fin>Fermer</button></div>`;
    const q = x => main.querySelector(x);
    q('[data-fin]').onclick = fermer;
    if (q('[data-refaire]')) q('[data-refaire]').onclick = () => parcours({ statut: 'non_verifie' });
    if (q('[data-retirer]')) q('[data-retirer]').onclick = async e => {
      if (!confirm('Retirer votre dossier ? Vos photos seront effacées et l’examen s’arrête.')) return;
      e.target.disabled = true;
      try { await retirer(s); N().toast('Dossier retiré, photos effacées.'); fermer(); }
      catch (x) { e.target.disabled = false; N().toast('Impossible pour l’instant : ' + x.message); }
    };
  }
  async function retirer(s) {
    if (s && s.dossier) await N().effacerPrive('identite', ['recto.jpg', 'verso.jpg', 'selfie.jpg'].map(f => s.dossier + '/' + f)).catch(() => {});
    await N().rpc('identite_retirer'); await statut(true);
  }

  // le parcours en étapes
  function parcours(s0) {
    const main = bg.querySelector('.idv-main'), ret = bg.querySelector('[data-ret]');
    const st = { piece: s0.piece || '', dossier: null, id: null, defi: s0.defi || '', recto: null, verso: null, selfie: null, mrz: null, mrzEtat: '', nom: '' };
    const ETAPES = ['intro', 'piece', 'recto', 'verso', 'selfie', 'nom', 'envoi'];
    const liste = () => ETAPES.filter(e => !(e === 'verso' && st.piece === 'passeport'));
    let i = 0;
    const aller = n => { i = Math.max(0, Math.min(liste().length - 1, n)); dessiner(); main.scrollTop = 0; };
    ret.onclick = () => aller(i - 1);
    const pas = () => { const L = liste(); bg.querySelector('.idv-pas').innerHTML = L.slice(1, -1).map((_, k) => `<i class="${k < i ? 'on' : ''}"></i>`).join(''); ret.hidden = i === 0 || L[i] === 'envoi'; };
    const actions = (go, label, alt) => `<div class="idv-act"><button type="button" class="idv-go" data-go ${go ? '' : 'disabled'}>${label}</button>${alt || ''}</div>`;
    const prendre = (cle, titre, aide, face) => {
      const b = st[cle];
      main.innerHTML = `<h2>${titre}</h2><p>${aide}</p>
        <label class="idv-photo">${b ? `<img src="${URL.createObjectURL(b)}" alt="${esc(titre)}">` : `<span>${face ? IC('compte', 40, 1.6) : '<i class="idv-cadre"></i>'}${IC('photo', 26)}Toucher pour prendre la photo</span>`}
          <input type="file" accept="image/*" capture="${face ? 'user' : 'environment'}" aria-label="${esc(titre)}"></label>
        ${cle === 'selfie' ? '' : '<p style="font-size:13.5px">Toute la pièce dans le cadre, à plat, sans reflet ni doigt sur le texte.</p>'}
        <p class="idv-bad" data-err></p>
        ${actions(!!b, 'Continuer', b ? '<button type="button" class="idv-alt" data-re>Reprendre la photo</button>' : '')}`;
      const inp = main.querySelector('input[type=file]'), err = main.querySelector('[data-err]');
      inp.onchange = async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        try { st[cle] = await reduire(f); if (cle === 'verso' || (cle === 'recto' && st.piece === 'passeport')) lireEnFond(st[cle]); dessiner(); }
        catch (x) { err.textContent = x.message; }
      };
      const re = main.querySelector('[data-re]'); if (re) re.onclick = () => inp.click();
      main.querySelector('[data-go]').onclick = () => aller(i + 1);
    };
    // la lecture de la bande MRZ tourne pendant que la personne prend le selfie
    function lireEnFond(blob) {
      st.mrz = null; st.mrzEtat = 'lecture';
      lireMRZ(blob).then(m => { st.mrz = m; st.mrzEtat = m ? 'ok' : 'vide'; if (m && !st.nom) st.nom = [m.prenoms, m.nom].filter(Boolean).join(' '); if (liste()[i] === 'nom') dessiner(); })
        .catch(() => { st.mrzEtat = 'vide'; if (liste()[i] === 'nom') dessiner(); });
    }
    function dessiner() {
      pas(); const e = liste()[i];
      if (e === 'intro') {
        main.innerHTML = `<h2>Faites vérifier votre identité</h2><p>Les acheteurs et les vendeurs échangent plus volontiers avec une personne vérifiée. Le badge apparaît sur votre profil et à côté de votre nom.</p>
          <div class="idv-card">
            <div class="idv-li">${IC('photo')}<span><b>Trois photos</b> : votre pièce (recto et verso) et un selfie en tenant un code écrit sur un papier.</span></div>
            <div class="idv-li">${IC('comptes')}<span><b>Examinées par une personne</b> de l’équipe du Marché de Gros, jamais par une machine seule. Comptez quelques jours.</span></div>
            <div class="idv-li">${IC('cadenas')}<span><b>Gardées à l’abri</b> : personne d’autre ne les voit, et elles sont effacées dès que l’équipe a décidé. Nous ne gardons pas le numéro de votre pièce.</span></div>
            <div class="idv-li">${IC('verifie')}<span><b>Ce que dit le badge</b> : l’équipe a comparé votre pièce et votre selfie. Il ne remplace pas une vérification officielle.</span></div>
          </div>
          <label class="idv-chk"><input type="checkbox" data-ok> <span>J’accepte d’envoyer ces photos au Marché de Gros pour vérifier mon identité.</span></label>
          ${actions(false, 'Commencer')}`;
        const ok = main.querySelector('[data-ok]'), go = main.querySelector('[data-go]');
        ok.onchange = () => { go.disabled = !ok.checked; };
        go.onclick = () => aller(1);
      } else if (e === 'piece') {
        main.innerHTML = `<h2>Quelle pièce avez-vous&nbsp;?</h2><p>Une pièce en cours de validité, à votre nom.</p>
          <div class="idv-choix" role="group" aria-label="Type de pièce">${PIECES.map(p => `<button type="button" data-p="${p[0]}" aria-pressed="${st.piece === p[0]}">${IC('etiquette', 22)}<span><b>${p[1]}</b><small>${p[2]}</small></span></button>`).join('')}</div>
          <p class="idv-bad" data-err></p>${actions(!!st.piece, 'Continuer')}`;
        main.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { st.piece = b.dataset.p; main.querySelectorAll('[data-p]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); main.querySelector('[data-go]').disabled = false; });
        main.querySelector('[data-go]').onclick = async ev => {
          const go = ev.currentTarget, err = main.querySelector('[data-err]'); go.disabled = true; go.textContent = 'Un instant…'; err.textContent = '';
          try { const r = await N().rpc('identite_commencer', { p_piece: st.piece }); st.id = r.id; st.dossier = r.dossier; st.defi = r.defi; aller(2); }
          catch (x) { go.disabled = false; go.textContent = 'Continuer'; err.textContent = !navigator.onLine ? 'Pas de connexion internet.' : x.message; }
        };
      } else if (e === 'recto') prendre('recto', st.piece === 'passeport' ? 'La page avec votre photo' : 'Le recto de la pièce', st.piece === 'passeport' ? 'Ouvrez le passeport à la page de la photo, avec les deux lignes du bas.' : 'Le côté avec votre photo et votre nom.');
      else if (e === 'verso') prendre('verso', 'Le verso de la pièce', 'Le dos, avec les lignes de lettres et de chevrons &lt;&lt;&lt; en bas : elles nous aident à lire votre nom.');
      else if (e === 'selfie') {
        const code = String(st.defi || '').split('').map(c => `<i>${esc(c)}</i>`).join('');
        prendre('selfie', 'Un selfie avec ce code', 'Écrivez ce code en gros sur un papier, puis prenez-vous en photo en le tenant à côté de votre visage, bien éclairé.', true);
        main.querySelector('p').insertAdjacentHTML('afterend', `<div class="idv-code" aria-label="Code ${esc(st.defi)}">${code}</div>`);
      } else if (e === 'nom') {
        const lu = st.mrz ? [st.mrz.prenoms, st.mrz.nom].filter(Boolean).join(' ') : '';
        const info = st.mrzEtat === 'lecture' ? `<div class="idv-lu">${IC('horloge', 18)}<span>Lecture de votre pièce en cours… Vous pouvez aussi écrire votre nom.</span></div>`
          : st.mrz && st.mrz.valide ? `<div class="idv-lu">${IC('verifie', 18)}<span>Lu sur la pièce : <b>${esc(lu)}</b>. Vérifiez surtout vos prénoms : la lecture en coupe parfois la fin. Ajoutez les accents si besoin.</span></div>`
          : st.mrz ? `<div class="idv-lu doute">${IC('info', 18)}<span>Lu sur la pièce, peut-être mal : <b>${esc(lu)}</b>. Vérifiez.</span></div>`
          : st.mrzEtat === 'vide' ? `<div class="idv-lu doute">${IC('info', 18)}<span>Votre pièce n’a pas pu être lue automatiquement. Ce n’est pas grave : écrivez votre nom.</span></div>` : '';
        main.innerHTML = `<h2>Votre nom, comme sur la pièce</h2><p>Prénoms et nom, tels qu’ils sont écrits.</p>${info}
          <div><label class="idv-l" for="idv-nom">Nom complet</label><input id="idv-nom" class="idv-in" maxlength="120" autocomplete="name" value="${esc(st.nom)}"></div>
          <p class="idv-bad" data-err></p>${actions(st.nom.trim().length >= 3, 'Envoyer mon dossier')}`;
        const inp = main.querySelector('#idv-nom'), go = main.querySelector('[data-go]');
        inp.oninput = () => { st.nom = inp.value; go.disabled = inp.value.trim().length < 3; };
        go.onclick = () => aller(i + 1);
      } else if (e === 'envoi') envoyer();
    }
    async function envoyer() {
      bg.dataset.lock = '1'; pas();
      main.innerHTML = `<div class="idv-etat"><div class="rond">${IC('envoyer', 32)}</div><h2>Envoi de votre dossier…</h2><p data-m>Envoi des photos</p></div><div class="idv-barre"><i></i></div>`;
      const barre = main.querySelector('.idv-barre i'), m = main.querySelector('[data-m]');
      const fichiers = [['recto.jpg', st.recto], ['verso.jpg', st.verso], ['selfie.jpg', st.selfie]].filter(f => f[1] && !(f[0] === 'verso.jpg' && st.piece === 'passeport'));
      try {
        let k = 0;
        for (const [nom, blob] of fichiers) {
          const chemin = st.dossier + '/' + nom;
          try { await N().deposerPrive('identite', chemin, blob); }
          catch (x) { if (x.status === 409 || /exist|duplicate/i.test(x.message)) { await N().effacerPrive('identite', [chemin]); await N().deposerPrive('identite', chemin, blob); } else throw x; }
          barre.style.width = Math.round(++k / (fichiers.length + 1) * 100) + '%';
        }
        m.textContent = 'Enregistrement du dossier';
        await N().rpc('identite_soumettre', { p_id: st.id, p_nom: st.nom.trim(), p_nom_lu: st.mrz ? [st.mrz.prenoms, st.mrz.nom].filter(Boolean).join(' ') : null, p_mrz_ok: st.mrz ? !!st.mrz.valide : null });
        barre.style.width = '100%';
        await statut(true).catch(() => {});
        delete bg.dataset.lock;
        main.innerHTML = `<div class="idv-etat"><div class="rond att">${IC('horloge', 34)}</div><h2>Dossier envoyé</h2><p>Une personne de l’équipe va comparer votre pièce et votre selfie. Vous verrez le résultat dans Mon compte. Vos photos seront effacées après la décision.</p></div><div class="idv-act"><button type="button" class="idv-go" data-fin>Terminer</button></div>`;
        main.querySelector('[data-fin]').onclick = fermer;
      } catch (x) {
        delete bg.dataset.lock;
        main.innerHTML = `<div class="idv-etat"><div class="rond ko">${IC('info', 32)}</div><h2>L’envoi n’a pas abouti</h2><p class="idv-bad">${!navigator.onLine ? 'Pas de connexion internet.' : esc(x.message)}</p><p>Vos photos sont gardées sur ce téléphone tant que cette fenêtre reste ouverte.</p></div><div class="idv-act"><button type="button" class="idv-go" data-re>Réessayer</button><button type="button" class="idv-alt" data-fin>Fermer</button></div>`;
        main.querySelector('[data-re]').onclick = envoyer; main.querySelector('[data-fin]').onclick = fermer;
      }
    }
    // reprise d'un brouillon : le code et le dossier existent déjà côté serveur
    if (s0.statut === 'brouillon' && s0.id) { st.id = s0.id; st.dossier = s0.dossier; }
    dessiner();
  }

  // vider le cache de statut quand on change de compte
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte') { const u = me(), c = J(KS, null); if (!u || (c && c.uid !== u.id)) { try { localStorage.removeItem(KS); } catch (_) {} dire(); } } });

  window.MDGIdentite = { ouvrir, statut, statutCache, RESUME, estVerifie, badge, lireMRZ, analyserMRZ, retirer };
})();
