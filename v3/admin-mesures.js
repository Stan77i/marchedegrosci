/* ═════════ Marché de Gros CI — tableau de bord : les visites du site et les arrivées dans l'application (schéma 81) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt. Les chiffres viennent de mesures_resume() (administrateur seulement).
   Ce qui est compté, sans donnée personnelle : une vue par page et par visite (site public, page de maintenance), un clic par bouton
   d'action du site, une ouverture de l'application venue du site ou d'un QR code (utm_*), puis la connexion qui suit (une fois).
   Les visites de l'administrateur ne sont jamais comptées. Rien n'est estimé : ce n'est pas un compte de personnes. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { r: null, jours: 30 };
  const CSS = `.vm-ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}.vm-k{padding:14px 16px;border-radius:18px;background:var(--panel)}
.vm-k b{display:block;font-size:26px;font-weight:800;margin:2px 0;font-variant-numeric:tabular-nums}.vm-k small{color:var(--mute);font-size:13px}
.vm-j{display:grid;gap:4px;padding:16px 20px;border-radius:20px;background:var(--panel)}.vm-l{display:grid;grid-template-columns:90px 1fr 190px;gap:12px;align-items:center;font-size:13.5px}
.vm-b{height:12px;border-radius:6px;background:var(--line2);overflow:hidden;display:flex}.vm-b i{display:block;height:100%;background:#6CC58C}.vm-b i.c{background:#F2C230}
.vm-l span:last-child{color:var(--mute);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.vm-t{border-radius:20px;overflow:hidden;background:var(--panel)}.vm-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px 20px;border-top:1px solid var(--line)}.vm-r:first-child{border-top:0}
.vm-r small{display:block;color:var(--mute);font-size:12.5px}.vm-r b{font-variant-numeric:tabular-nums}
.vm-2{display:grid;grid-template-columns:1fr 1fr;gap:18px}@media (max-width:860px){.vm-2{grid-template-columns:1fr}.vm-l{grid-template-columns:70px 1fr 90px}}
.vm-sel{display:flex;gap:6px}.vm-sel button[aria-pressed=true]{background:var(--acc);color:#171512}`;
  if (!document.getElementById('vmCss')) { const s = document.createElement('style'); s.id = 'vmCss'; s.textContent = CSS; document.head.appendChild(s); }
  const EV = { vue: 'Visite du site', ouverture_app: 'Ouverture de l’application', connexion_app: 'Connexion après le site' };
  const PAGE = p => !p ? '—' : p === 'site/' ? 'Accueil du site' : p === 'maintenance' ? 'Page de maintenance' : p.replace(/^site\//, '').replace(/\/$/, '').replace(/\//g, ' › ');

  EXT.visites = {
    titre: 'Visites', ico: 'tendance',
    charger: async H => { D.r = await H.rpc('mesures_resume', { p_jours: D.jours }); },
    vue(H) {
      const e = H.esc, r = D.r || {}, t = r.total || {}, J = r.jours || [];
      const k = (lab, v, s) => `<div class="vm-k"><small>${lab}</small><b>${H.fmt(v || 0)}</b><small>${s}</small></div>`;
      const max = Math.max(1, ...J.map(j => (j.vues || 0) + (j.clics || 0)));
      const jours = J.length ? J.slice().reverse().map(j => `<div class="vm-l"><span>${new Date(j.jour + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        <span class="vm-b" title="${j.vues} visites, ${j.clics} clics"><i style="width:${(j.vues || 0) / max * 100}%"></i><i class="c" style="width:${(j.clics || 0) / max * 100}%"></i></span>
        <span>${j.vues} vis. · ${j.clics} clics${j.ouvertures ? ' · ' + j.ouvertures + ' app' : ''}</span></div>`).join('') : '<div class="at-vide"><b>Aucune visite comptée pour l’instant</b>Le site est encore caché au public ; vos propres visites ne sont jamais comptées. La page de maintenance, elle, est comptée.</div>';
      const liste = (L, f) => (L || []).length ? `<div class="vm-t">${L.map(f).join('')}</div>` : '<div class="vm-t"><div class="at-vide">Rien pour l’instant.</div></div>';
      const sel = `<div class="vm-sel">${[7, 30, 90].map(n => `<button class="btn sm ghost" data-vmj="${n}" aria-pressed="${D.jours === n}">${n} jours</button>`).join('')}</div>`;
      return H.top('Visites', 'Ce que le site et les QR codes apportent à l’application, sans aucune donnée personnelle. Ce sont des visites et des clics, pas des personnes. Vos propres visites ne sont jamais comptées.', sel) + `
        <section class="sec"><div class="vm-ks">${k('Visites', t.vues, (t.ordi || 0) + ' sur ordinateur · ' + (t.tel || 0) + ' sur téléphone')}${k('Clics sur « Je vends / Je cherche… »', t.clics, 'boutons d’action du site')}${k('Ouvertures de l’application', t.ouvertures, 'venues du site ou d’un QR code')}${k('Connexions ensuite', t.connexions, 'personnes venues du site qui se connectent')}</div></section>
        <section class="sec"><h2>Jour par jour</h2><div class="vm-j">${jours}</div></section>
        <section class="sec vm-2"><div><h2>Pages vues</h2>${liste(r.pages, x => `<div class="vm-r"><span>${e(PAGE(x.page))}</span><b>${H.fmt(x.n)}</b></div>`)}</div>
          <div><h2>Boutons touchés</h2>${liste(r.clics, x => `<div class="vm-r"><span>${e(x.cible || '—')}<small>${e(PAGE(x.page))}</small></span><b>${H.fmt(x.n)}</b></div>`)}</div></section>
        <section class="sec"><h2>D’où ils viennent</h2>${liste(r.provenances, x => `<div class="vm-r"><span>${e(x.source)}${x.support ? ' · ' + e(x.support) : ''}${x.campagne ? ' · ' + e(x.campagne) : ''}<small>${e(EV[x.evenement] || x.evenement)}</small></span><b>${H.fmt(x.n)}</b></div>`)}
          <p class="acc-sub" style="margin-top:10px">Pour reconnaître un QR code, imprimez un lien avec sa provenance, par exemple <code>…/marchedegrosci/?utm_source=affiche&amp;utm_medium=qr&amp;utm_campaign=adjame</code>.</p></section>`;
    },
    lier(root, H) { root.querySelectorAll('[data-vmj]').forEach(b => b.onclick = async () => { D.jours = +b.dataset.vmj; await EXT.visites.charger(H); H.repeindre(); }); }
  };
})();
