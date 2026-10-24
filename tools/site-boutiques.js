#!/usr/bin/env node
/* ═════════ Marché de Gros CI — pages d'aperçu des boutiques (site/boutiques/<adresse>/) ═════════
   Décision 40 du propriétaire (24/10/2026) : un lien de boutique partagé sur WhatsApp ou Facebook doit montrer un aperçu
   (nom, description, image, lien). Les robots d'aperçu ignorent la partie « # » des adresses de l'application :
   on fabrique donc une petite page par boutique ouverte, en noindex et hors du plan du site, qui renvoie le visiteur
   vers la boutique dans l'application.
   Données : la fonction publique boutiques_publiques() (supabase/schema-86-boutiques.sql), lue avec la clé publique.
   Seulement le nom montré (pseudo, ou prénom et initiale), la ville et les produits : jamais de numéro ni de nom complet.
   Une boutique fermée perd sa page à la passe suivante. Sans réponse du serveur, rien n'est touché.
   Commande : node tools/site-boutiques.js   (la tâche .github/workflows/site-public.yml le relance chaque jour)
   Essai hors ligne : BOUTIQUES_JSON=fichier.json node tools/site-boutiques.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const RACINE = path.join(__dirname, '..'), DOSSIER = path.join(RACINE, 'site', 'boutiques');
const URL0 = 'https://catmsypctymgkjkfzdkt.supabase.co', CLE = 'sb_publishable_KC2au-t8dqasp5ez9Lq6XQ_JvbTtVQ5';   // clé publique (la même que dans l'application)
const SITE = 'https://stan77i.github.io/marchedegrosci/site/boutiques/';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const propre = a => String(a || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 24);

const ctx = {}; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(RACINE, 'v2/data.js'), 'utf8'), ctx);
const NOM = Object.fromEntries(ctx.MDG.products.map(p => [p.slug, p.name]));
const REG = (() => { const m = {}, t = fs.readFileSync(path.join(RACINE, 'app/marche-app.js'), 'utf8'), i = t.indexOf('A.REG = {'); if (i < 0) return m;
  const bloc = t.slice(i, t.indexOf('};', i)); for (const x of bloc.matchAll(/'?([a-z-]+)'?:\s*\[[-\d.]+,\s*[-\d.]+,\s*'([^']+)'\]/g)) m[x[1]] = x[2]; return m; })();
// « Boutique d’Awa », « Boutique de Koffi »
const de = n => (/^[aeiouyàâäéèêëîïôöûùü]/i.test(n) ? 'd’' : 'de ') + n;

async function lire() {
  if (process.env.BOUTIQUES_JSON) return JSON.parse(fs.readFileSync(process.env.BOUTIQUES_JSON, 'utf8'));
  const r = await fetch(URL0 + '/rest/v1/rpc/boutiques_publiques', { method: 'POST', headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error('serveur ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

(async () => {
  let liste;
  try { liste = await lire(); } catch (e) { console.log('boutiques : lecture impossible, rien n’est changé (' + e.message + ')'); return; }
  if (!Array.isArray(liste)) { console.log('boutiques : réponse inattendue, rien n’est changé'); return; }
  const GAB = fs.readFileSync(path.join(__dirname, 'site', 'boutique.html'), 'utf8');
  const remplir = v => GAB.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in v)) throw new Error('gabarit : {{' + k + '}} inconnu'); return v[k]; });
  const gardes = new Set();
  for (const b of liste) {
    const adr = propre(b.adresse), code = propre(b.code); if (!adr || adr.length < 3) continue;
    const nom = String(b.nom || 'Vendeur').slice(0, 40), ville = b.ville || REG[b.region_slug] || '';
    const prods = (b.produits || []).map(s => NOM[s] || s).slice(0, 4), n = +b.disponibles || 0;
    const resume = (n ? n + (n > 1 ? ' produits disponibles' : ' produit disponible') : 'Ses offres') + (ville ? ' à ' + ville : '') + (prods.length ? ' : ' + prods.join(', ') : '') + '. Prix et quantités à jour, négociation dans l’application.';
    for (const cle of new Set([adr, code].filter(x => x && x.length >= 3))) {
      const html = remplir({ TITRE: esc('Boutique ' + de(nom) + ' · Marché de Gros'), DESCRIPTION: esc(resume), URL: SITE + encodeURIComponent(adr) + '/', ADRESSE: esc(adr), NOM: esc(de(nom)), RESUME: esc(resume),
        PRODUITS: prods.length ? '<ul>' + prods.map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>' : '' });
      const f = path.join(DOSSIER, cle, 'index.html'); fs.mkdirSync(path.dirname(f), { recursive: true });
      if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== html) { fs.writeFileSync(f, html); console.log('écrit', path.relative(RACINE, f)); }
      gardes.add(cle);
    }
  }
  // une boutique fermée (ou un pseudo changé) : sa page d'aperçu disparaît (le code court, lui, reste tant que la boutique est ouverte)
  if (fs.existsSync(DOSSIER)) for (const d of fs.readdirSync(DOSSIER)) {
    const p = path.join(DOSSIER, d); if (fs.statSync(p).isDirectory() && !gardes.has(d)) { fs.rmSync(p, { recursive: true, force: true }); console.log('retiré', path.relative(RACINE, p)); }
  }
  console.log('boutiques : ' + liste.length + ' ouverte' + (liste.length > 1 ? 's' : '') + ', ' + gardes.size + ' page' + (gardes.size > 1 ? 's' : ''));
})();
