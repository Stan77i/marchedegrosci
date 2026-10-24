/* ═════════ Marché de Gros CI : tableau de bord, Notifications (schémas 88a, 88b, 88d) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt ; reprend les styles de v3/admin-mesures.js (à charger avant).
   Chiffres lus dans notif_stats() (par catégorie) et notif_stats_jours() (jour par jour), administrateur seulement, totaux sans nom ni numéro.
   « Envoyée » = acceptée par le service de notification du téléphone ; « ouverte » = la personne a touché la notification ;
   « action » = une proposition, une commande, une offre ou un groupe rejoint dans les 24 h après l'ouverture, sur le même objet ou produit.
   Non mesurable, donc jamais affiché : l'affichage réel à l'écran et la notification balayée sans être ouverte. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { r: null, j: null, jours: 30, absent: false };
  const CSS = `.nt-tb{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums}.nt-tb th{padding:10px 8px;text-align:right;color:var(--mute);font-weight:600;font-size:12px;white-space:nowrap}
.nt-tb th:first-child,.nt-tb td:first-child{text-align:left}.nt-tb td{padding:10px 8px;border-top:1px solid var(--line);text-align:right;white-space:nowrap}
.nt-tb td:first-child{white-space:normal;min-width:150px}.nt-tb td small{display:block;color:var(--mute);font-size:12px}
.nt-tb tr.nt-sep td{padding-top:16px;color:var(--mute);font-size:12px;font-weight:600;border-top:0;text-align:left}
.nt-wrap{overflow-x:auto;border-radius:20px;background:var(--panel);padding:6px 14px}
.nt-z{color:var(--mute)}`;   // var(--faint) ne fait que 4,38:1 sur le panneau ; --mute fait 6,95:1
  if (!document.getElementById('ntCss')) { const s = document.createElement('style'); s.id = 'ntCss'; s.textContent = CSS; document.head.appendChild(s); }
  const ORIG = { desabonnement: 'Désactivées dans l’application', deconnexion: 'Déconnexion', expire: 'Téléphone expiré ou désinstallé', permission: 'Permission retirée dans le téléphone', preference: 'Catégorie coupée' };
  const absent = e => /notif_stats|schema cache|Could not find|does not exist/i.test(String(e && e.message || e));

  EXT.notifications = {
    titre: 'Notifications', ico: 'cloche',
    charger: async H => {
      try { [D.r, D.j] = await Promise.all([H.rpc('notif_stats', { p_jours: D.jours }), H.rpc('notif_stats_jours', { p_jours: Math.min(D.jours, 30) })]); D.absent = false; }
      catch (e) { if (absent(e)) { D.absent = true; D.r = null; D.j = null; return; } throw e; }
    },
    vue(H) {
      const e = H.esc, f = n => (n ? H.fmt(n) : '<span class="nt-z">0</span>');
      const sel = `<div class="vm-sel">${[7, 30, 90].map(n => `<button class="btn sm ghost" data-ntj="${n}" aria-pressed="${D.jours === n}">${n} jours</button>`).join('')}</div>`;
      const intro = 'Ce qui part, ce qui est ouvert et ce qui mène à une action. Totaux seulement, sans aucun nom.';
      if (D.absent) return H.top('Notifications', intro) + '<section class="sec"><div class="vm-t"><div class="at-vide"><b>Pas encore installé sur ce serveur</b>Les statistiques arrivent avec les schémas 88a, 88b et 88d (supabase/). Tant qu’ils ne sont pas appliqués, rien n’est compté.</div></div></section>';
      const r = D.r || {}, C = r.categories || [], J = D.j || [];
      const tot = k => C.reduce((s, c) => s + (+c[k] || 0), 0), env = tot('envoyees'), ouv = tot('ouvertes');
      const des = (r.desactivations || []).reduce((s, d) => s + (+d.n || 0), 0);
      const k = (lab, v, s) => `<div class="vm-k"><small>${lab}</small><b>${H.fmt(v || 0)}</b><small>${s}</small></div>`;
      const pc = (a, b) => b ? Math.round(a / b * 100) + ' %' : '';
      const ligne = c => `<tr><td>${e(c.libelle)}</td><td>${f(+c.envoyees)}</td><td>${f(+c.ouvertes)}${+c.envoyees && +c.ouvertes ? `<small>${pc(+c.ouvertes, +c.envoyees)}</small>` : ''}</td><td>${f(+c.actions)}</td><td>${f(+c.conversions)}</td><td>${f(+c.bloquees)}</td><td>${f((+c.echecs || 0) + (+c.sans_telephone || 0))}</td></tr>`;
      const groupe = (t, nat) => { const L = C.filter(c => c.nature === nat); return L.length ? `<tr class="nt-sep"><td colspan="7">${t}</td></tr>` + L.map(ligne).join('') : ''; };
      const tete = '<tr><th scope="col">Catégorie</th><th scope="col">Envoyées</th><th scope="col">Ouvertes</th><th scope="col">Actions</th><th scope="col">Commandes ou groupes</th><th scope="col">Retenues</th><th scope="col">Non parties</th></tr>';
      const max = Math.max(1, ...J.map(j => +j.envoyees || 0));
      const jours = J.length ? J.map(j => `<div class="vm-l"><span>${new Date(j.jour + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
        <span class="vm-b" title="${+j.envoyees} envoyées, ${+j.ouvertes} ouvertes"><i style="width:${(+j.envoyees || 0) / max * 100}%"></i></span>
        <span>${+j.envoyees} env. · ${+j.ouvertes} ouv. · ${+j.actions} act.${+j.desactivations ? ' · ' + j.desactivations + ' désact.' : ''}</span></div>`).join('') : '<div class="at-vide">Rien pour l’instant.</div>';
      const dl = (r.desactivations || []).length ? `<div class="vm-t">${r.desactivations.map(d => `<div class="vm-r"><span>${e(ORIG[d.origine] || d.origine)}${d.cat ? `<small>${e((C.find(c => c.cat === d.cat) || {}).libelle || d.cat)}</small>` : ''}</span><b>${H.fmt(d.n)}</b></div>`).join('')}</div>` : '<div class="vm-t"><div class="at-vide">Aucune désactivation sur la période.</div></div>';
      return H.top('Notifications', intro, sel) + `
        <section class="sec"><div class="vm-ks">${k('Envoyées', env, 'acceptées par le service du téléphone')}${k('Ouvertes', ouv, env ? pc(ouv, env) + ' des envoyées' : 'touchées par la personne')}${k('Actions', tot('actions'), 'dans les 24 h après l’ouverture')}${k('Désactivations', des, (r.abonnes || 0) + ' compte' + ((r.abonnes || 0) > 1 ? 's' : '') + ' abonné' + ((r.abonnes || 0) > 1 ? 's' : '') + ' aujourd’hui')}</div></section>
        <section class="sec"><h2>Par catégorie</h2><div class="nt-wrap"><table class="nt-tb"><thead>${tete}</thead><tbody>${groupe('Pour ses échanges (toujours utiles)', 'trans')}${groupe('Du marché (réglables, plafonnées)', 'com')}</tbody></table></div>
          <p class="note" style="margin-top:10px">Retenues : coupées par la personne, plafond du jour atteint ou heures calmes. Non parties : aucun téléphone abonné, ou refus du service.</p></section>
        <section class="sec"><h2>Jour par jour</h2><div class="vm-j">${jours}</div></section>
        <section class="sec"><h2>Désactivations</h2>${dl}</section>
        <p class="note">${e(r.limites || 'Non mesurable : l’affichage réel à l’écran et la notification balayée sans être ouverte.')}</p>`;
    },
    lier(root, H) { root.querySelectorAll('[data-ntj]').forEach(b => b.onclick = async () => { D.jours = +b.dataset.ntj; try { await EXT.notifications.charger(H); } catch (x) { H.toast(x.message); } H.repeindre(); }); }
  };
})();
