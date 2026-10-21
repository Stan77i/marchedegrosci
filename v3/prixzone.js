/* ═════════ Marché de Gros CI — Prix par zone (schéma 31, fonction prix_zones) ═════════
   Une feuille qui monte du bas, ouverte depuis « Prix du marché » : pour un produit, par district et par unité :
   prix demandés (médiane, fourchette, date), tendance sur 30 jours, quantité en vente, budgets acheteurs,
   prix des ventes réalisées (seulement à partir de 3 ventes de 2 vendeurs), et la médiane par mois.
   Tout est calculé par le serveur à partir de données traçables. Sans assez de données, on le dit : rien n'est estimé.
   API : MDGPrixZone.ouvrir(slug, nom) */
(function () {
  'use strict';
  if (window.MDGPrixZone) return;
  const N = () => window.MDGNuage;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v || 0)).replace(/ /g, ' ');
  const F = v => nf(v) + ' F';
  const REG = { abidjan: 'Abidjan', yamoussoukro: 'Yamoussoukro', 'bas-sassandra': 'Bas-Sassandra', comoe: 'Comoé', denguele: 'Denguélé', 'goh-djiboua': 'Gôh-Djiboua',
    lacs: 'Lacs', lagunes: 'Lagunes', montagnes: 'Montagnes', 'sassandra-marahoue': 'Sassandra-Marahoué', savanes: 'Savanes', 'vallee-du-bandama': 'Vallée du Bandama',
    woroba: 'Woroba', zanzan: 'Zanzan' };
  const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const depuis = t => { if (!t) return ''; const j = Math.floor((Date.now() - Date.parse(t)) / 864e5); return j <= 0 ? 'aujourd’hui' : j === 1 ? 'hier' : 'il y a ' + j + ' jours'; };

  const CSS = `
.pz-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:pzIn .2s ease-out}
@keyframes pzIn{from{opacity:0}}@keyframes pzUp{from{transform:translateY(40px);opacity:.4}}
.pz{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:20px 16px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:pzUp .28s cubic-bezier(.2,.8,.2,1)}
.pz-h{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px}
.pz-h h2{flex:1;margin:0;font:600 23px/1.15 Archivo,'Helvetica Neue',Arial,sans-serif;letter-spacing:-.015em}
.pz-h h2 em{font-weight:900;font-style:italic;background:linear-gradient(transparent 58%,#F2C230 58%);padding:0 2px}
.pz-h h2:focus{outline:none}
.pz-x{flex:none;width:44px;height:44px;margin:-8px -6px 0 0;border:0;border-radius:22px;background:transparent;color:#171512;font-size:26px;line-height:1;cursor:pointer}
.pz-x:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.pz-lead{margin:0 0 14px;color:#4A4336;font-size:14px}
.pz-z{background:#FFFDF8;border-radius:20px;padding:15px 16px;margin:0 0 10px;box-shadow:0 1px 0 rgba(16,57,43,.08)}
.pz-zt{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 8px}
.pz-zt b{font:600 17px/1.2 Archivo,'Helvetica Neue',Arial,sans-serif}.pz-zt span{color:#5E5546;font-size:13px}
.pz-m{display:flex;align-items:flex-end;flex-wrap:wrap;gap:4px 12px}
.pz-m strong{font:800 28px/1 Archivo,'Helvetica Neue',Arial,sans-serif;letter-spacing:-.02em;color:#10392B}
.pz-m small{color:#5E5546;font-size:13px}
.pz-t{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:0 11px;border-radius:14px;font-size:13px;font-weight:600;margin:10px 0 0;background:#ECE6D6;color:#4A4336}
.pz-t[data-k=hausse]{background:#FBE3DE;color:#8E2A1C}.pz-t[data-k=baisse]{background:#DCEFE3;color:#10392B}.pz-t[data-k=stable]{background:#E9E4D3;color:#3E382C}
.pz-t svg{width:15px;height:15px}
.pz-l{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:6px}
.pz-l li{display:flex;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid #ECE6D6;font-size:14px}
.pz-l li span{color:#5E5546}.pz-l li b{font-weight:600;text-align:right}
.pz-l li b small{display:block;font-weight:400;color:#675F50;font-size:12px}
.pz-s{background:#FFFDF8;border-radius:20px;padding:15px 16px;margin:14px 0 10px}
.pz-s h3{margin:0 0 2px;font:600 16px/1.2 Archivo,'Helvetica Neue',Arial,sans-serif}.pz-s p{margin:0 0 10px;color:#5E5546;font-size:13px}
.pz-b{display:flex;align-items:flex-end;gap:6px;height:120px;padding:0 0 2px;border-bottom:1px solid #D9D1BE}
.pz-b div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.pz-b i{display:block;width:100%;max-width:34px;background:#10392B;border-radius:4px 4px 0 0}
.pz-b div:last-child i{background:#2E6B53}
.pz-b em{font-style:normal;font-size:11.5px;color:#3E382C;margin:0 0 3px;white-space:nowrap}
.pz-bm{display:flex;gap:6px;margin:4px 0 0}.pz-bm span{flex:1;text-align:center;font-size:11.5px;color:#5E5546;min-width:0}
.pz-vide{text-align:center;padding:24px 10px;color:#4A4336}.pz-vide b{display:block;font:600 18px/1.25 Archivo,'Helvetica Neue',Arial,sans-serif;color:#171512;margin:8px 0 4px}
.pz-pied{margin:14px 2px 0;color:#5E5546;font-size:12.5px}
.pz-err{background:#FBE3DE;color:#8E2A1C;border-radius:14px;padding:12px 14px;margin:8px 0}
.pz-err button{margin-top:8px;min-height:44px;padding:0 16px;border:0;border-radius:22px;background:#10392B;color:#FFFDF8;font:600 14px Jost,system-ui,sans-serif;cursor:pointer}
.pz .vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.pz-bg,.pz{animation:none!important}}`;
  function css() { if (document.getElementById('pzCss')) return; const s = document.createElement('style'); s.id = 'pzCss'; s.textContent = CSS; document.head.appendChild(s); }

  const FL = { hausse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/></svg>',
    baisse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7l6 6 4-4 6 7"/><path d="M15 16h5v-5"/></svg>',
    stable: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 12h16"/></svg>' };

  function tendance(t) {
    if (!t || t.sens === 'insuffisant') return '<span class="pz-t" data-k="insuffisant">Tendance : pas assez de prix sur 60 jours</span>';
    const s = t.ecart_pct > 0 ? '+' : '';
    const txt = t.sens === 'hausse' ? 'En hausse' : t.sens === 'baisse' ? 'En baisse' : 'Stable';
    return '<span class="pz-t" data-k="' + t.sens + '">' + FL[t.sens] + txt + ' · ' + s + t.ecart_pct + ' % en 30 jours<span class="vh"> (médiane ' + F(t.avant) + ' puis ' + F(t.recent) + ')</span></span>';
  }

  function zone(z) {
    const a = z.annonces || {}, b = z.budgets || {}, v = z.ventes || {}, u = esc(z.unite);
    const tete = '<div class="pz-zt"><b>' + esc(REG[z.region] || z.region) + '</b><span>par ' + u + '</span></div>';
    const prix = a.n ? '<div class="pz-m"><strong>' + F(a.mediane) + '</strong><small>prix demandé médian' + (a.n > 1 ? '<br>de ' + F(a.min) + ' à ' + F(a.max) : '') + '</small></div>'
      : '<div class="pz-m"><small>Aucun prix vendeur sur 90 jours dans cette zone.</small></div>';
    const lignes = [];
    if (a.n) lignes.push(['Prix vendeurs', a.n + ' prix · ' + a.vendeurs + ' vendeur' + (a.vendeurs > 1 ? 's' : ''), 'dernier ' + depuis(a.dernier)]);
    lignes.push(['En vente maintenant', z.actives ? nf(z.disponible) + ' ' + u : 'rien', z.actives ? z.actives + ' offre' + (z.actives > 1 ? 's' : '') + ' active' + (z.actives > 1 ? 's' : '') : '']);
    if (b.n) lignes.push(['Budget acheteurs', (b.n > 1 ? 'médiane ' : '') + F(b.mediane), b.n + ' demande' + (b.n > 1 ? 's' : '') + ' · ' + depuis(b.dernier)]);
    if (v.n && !v.insuffisant) lignes.push(['Ventes réalisées', 'médiane ' + F(v.mediane), v.n + ' ventes terminées · ' + depuis(v.dernier)]);
    else if (v.n) lignes.push(['Ventes réalisées', v.n + ' vente' + (v.n > 1 ? 's' : ''), 'pas assez pour montrer un prix']);
    return '<article class="pz-z">' + tete + prix + (a.n ? tendance(z.tendance) : '') +
      '<ul class="pz-l">' + lignes.map(l => '<li><span>' + l[0] + '</span><b>' + esc(l[1]) + (l[2] ? '<small>' + esc(l[2]) + '</small>' : '') + '</b></li>').join('') + '</ul></article>';
  }

  function saison(m) {
    const L = (m && m.liste) || [];
    if (L.length < 2) return '<section class="pz-s"><h3>Au fil des mois</h3><p>Pas encore assez de mois avec au moins 3 prix pour dessiner une évolution. Elle apparaîtra d’elle-même.</p></section>';
    const max = Math.max(...L.map(x => x.mediane)), lab = x => MOIS[+x.mois.slice(5, 7) - 1];
    const resume = L.map(x => lab(x) + ' ' + F(x.mediane)).join(', ');
    return '<section class="pz-s"><h3>Au fil des mois</h3><p>Médiane des prix demandés, par ' + esc(m.unite) + ', toutes zones (mois avec au moins 3 prix).</p>' +
      '<div class="pz-b" role="img" aria-label="' + esc('Médiane mensuelle : ' + resume) + '">' +
      L.map((x, i) => '<div title="' + esc(lab(x) + ' : ' + F(x.mediane) + ' (' + x.n + ' prix)') + '">' + (i === 0 || i === L.length - 1 ? '<em>' + nf(x.mediane) + '</em>' : '') +
        '<i style="height:' + Math.max(4, Math.round(x.mediane / max * 100)) + '%"></i></div>').join('') + '</div>' +
      '<div class="pz-bm" aria-hidden="true">' + L.map(x => '<span>' + lab(x) + '</span>').join('') + '</div></section>';
  }

  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; document.removeEventListener('keydown', clavier); try { retour && retour.focus(); } catch (_) {} }
  function clavier(e) { if (e.key === 'Escape') fermer(); }

  async function ouvrir(slug, nom) {
    css(); if (bg) fermer();
    retour = document.activeElement;
    bg = document.createElement('div'); bg.className = 'pz-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Prix par zone : ' + (nom || ''));
    bg.innerHTML = '<div class="pz"></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-pzx]')) fermer(); });
    document.addEventListener('keydown', clavier);
    const box = bg.querySelector('.pz');
    const tete = '<div class="pz-h"><h2 tabindex="-1">' + esc(nom || 'Produit') + ', <em>par zone</em></h2><button class="pz-x" data-pzx aria-label="Fermer">×</button></div>' +
      '<p class="pz-lead">Ce que demandent les vendeurs, zone par zone, sur 90 jours. Un prix demandé n’est pas un prix garanti : il se discute.</p>';
    box.innerHTML = tete + (window.MDGSac ? MDGSac.charge('Calcul des prix…') : '<p>Calcul des prix…</p>');
    box.querySelector('h2').focus();
    let d;
    try {
      if (!N() || !N().rpc) throw new Error('hors ligne');
      d = await N().rpc('prix_zones', { p_produit: slug });
    } catch (x) {
      if (!bg) return;
      box.innerHTML = tete + '<div class="pz-err" role="alert">Impossible de lire les prix pour l’instant. Vérifiez la connexion.<br><button data-pzr>Réessayer</button></div>';
      box.querySelector('[data-pzr]').onclick = () => ouvrir(slug, nom);
      return;
    }
    if (!bg) return;
    const Z = (d && d.zones) || [];
    const heure = d && d.calcule_le ? new Date(d.calcule_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    box.innerHTML = tete + (Z.length ? Z.map(zone).join('') + saison(d.mois)
      : '<div class="pz-vide">' + (window.MDGSac ? MDGSac.svg('vide') : '') + '<b>Pas encore de prix pour ce produit</b>Aucune offre ni demande avec un prix sur 90 jours. Le premier prix publié apparaîtra ici.</div>') +
      '<p class="pz-pied">Calculé par le serveur' + (heure ? ' à ' + heure : '') + '. Sources : annonces publiées (hors annonces masquées par la modération), demandes, commandes terminées. ' +
      'Tendance : médiane des 30 derniers jours contre les 30 jours d’avant, avec au moins 3 prix de 2 vendeurs dans chaque période.</p>';
    const h = box.querySelector('h2'); if (h) h.focus();
  }

  window.MDGPrixZone = { ouvrir };
})();
