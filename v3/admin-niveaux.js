/* ═════════ Marché de Gros CI : tableau de bord, Niveaux (schéma 85, décisions 22 à 33) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt ; reprend les styles de v3/admin-fiabilite.js (à charger avant).
   Tout vient de admin_niveaux() (administrateur seulement) :
   • contestations à traiter (réponse en 7 jours au plus) : accepter rend un niveau pour une durée, refuser ne change rien ;
   • membres en sursis (grâce de 30 jours avant une baisse) ; • répartition des niveaux ; • derniers changements ;
   • paliers (Vendeur fiable, Bon, Excellent, Grand ; mêmes paliers acheteurs) et réglages généraux, modifiables sans toucher au code :
     chaque enregistrement relance le calcul de tous les membres (une baisse passe toujours par la grâce).
   Le serveur vérifie est_admin pour chaque action. Les volumes sont des montants de commandes terminées, jamais de l'argent encaissé. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { r: null };
  const CSS = `.nv-tb{width:100%;border-collapse:collapse;font-size:13.5px}.nv-tb th{padding:8px 6px;text-align:left;color:var(--mute);font-weight:600;font-size:12px}
.nv-tb td{padding:6px;border-top:1px solid var(--line);vertical-align:middle}.nv-tb input[type=number],.nv-tb input[type=text]{width:100%;min-width:64px;min-height:36px;padding:0 8px;border:1px solid var(--line2);border-radius:10px;background:var(--champ);color:var(--ink);font:inherit;font-size:13.5px}
.nv-tb input[type=text]{min-width:140px}.nv-tb input[type=checkbox]{width:20px;height:20px;accent-color:var(--acc)}.nv-wrap{overflow-x:auto;border-radius:20px;background:var(--panel);padding:8px 12px}
.nv-rep{display:flex;flex-wrap:wrap;gap:8px}.nv-rep>span{display:inline-flex;align-items:center;gap:8px;min-height:32px;padding:0 6px 0 12px;border-radius:16px;background:var(--panel);font-size:13.5px}
.nv-rep .nbul{display:inline-grid;place-items:center;min-width:24px;height:22px;padding:0 7px;border-radius:11px;background:var(--acc);color:var(--acc-t);font:600 12px/1 Jost,sans-serif}`;
  if (!document.getElementById('nvCss')) { const s = document.createElement('style'); s.id = 'nvCss'; s.textContent = CSS; document.head.appendChild(s); }
  const EVT = { monte: 'Monte', grace: 'En sursis', grace_levee: 'Sursis levé', descend: 'Baisse', retire: 'Retiré', force: 'Décision de l’équipe', force_fin: 'Fin de la décision',
    gros: 'Acheteur en gros', gros_grace: 'Gros en sursis', gros_grace_levee: 'Gros : sursis levé', gros_retire: 'Gros retiré' };
  const REG = [['fenetre_jours', 'Période glissante (jours)', 30, 1095], ['grace_jours', 'Grâce avant une baisse (jours)', 0, 365], ['contestation_jours', 'Délai pour contester (jours)', 1, 60],
    ['reponse_jours', 'Délai de réponse de l’équipe (jours)', 1, 60], ['force_jours', 'Niveau rendu après contestation (jours)', 1, 365],
    ['gros_commandes', 'Acheteur en gros : commandes', 1, 1000], ['gros_montant', 'Acheteur en gros : montant d’une commande (F CFA)', 1, 10000000000],
    // schéma 94d : contre les badges fabriqués à deux
    ['plafond_partenaire', 'Commandes comptées par partenaire (si le palier n’a pas son plafond)', 1, 1000], ['partenaires_min', 'Partenaires différents au minimum', 1, 100],
    ['delai_min_minutes', 'Délai minimum entre commande et réception (minutes)', 0, 10080],
    ['paire_alerte_commandes', 'Alerte paire fermée : commandes', 2, 1000], ['paire_alerte_part', 'Alerte paire fermée : part des commandes (%)', 10, 100]];
  const titre = (t, n) => `<h2 class="fb-h">${t}${n ? `<span class="nbul">${n}</span>` : ''}</h2>`;
  const qui = (H, q) => q ? H.esc(q.nom || 'Membre') + (q.tel ? ' · ' + H.esc(String(q.tel).replace(/^225/, '')) : '') : 'compte supprimé';

  EXT.niveaux = {
    titre: 'Niveaux', ico: 'confiance',
    n: () => D.r ? (D.r.contestations || []).filter(t => t.ouverte).length : 0,
    charger: async H => { D.r = await H.rpc('admin_niveaux'); },
    vue(H) {
      const e = H.esc, r = D.r || {}, RG = r.reglages || {}, RL = r.regles || [], CT = (r.contestations || []), ouv = CT.filter(t => t.ouverte), GR = r.en_grace || [], J = r.journal || [], PF = r.paires || [];
      const lib = (role, k) => k === 'gros' ? 'Acheteur en gros' : ((RL.find(x => x.role === role && x.cle === k) || {}).libelle || (k ? k : 'aucun niveau'));
      const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const opts = (role, cur) => RL.filter(x => x.role === role).map(x => `<option value="${x.cle}"${x.cle === cur ? ' selected' : ''}>${e(x.libelle)}</option>`).join('') + (role === 'acheteur' ? `<option value="gros"${cur === 'gros' ? ' selected' : ''}>Acheteur en gros</option>` : '');
      const cont = ouv.length ? `<div class="fb-l">${ouv.map(t => { const c = t.chiffres || {}; return `<div class="fb-r"><div><b>${qui(H, t.qui)}</b>
          <small>${t.role === 'vendeur' ? 'Comme vendeur' : 'Comme acheteur'} · avant : ${e(lib(t.role, t.niveau_avant))} · maintenant : ${e(lib(t.role, t.niveau_actuel))} · répondre avant le ${jour(t.repondre_avant)}</small>
          <small>${c.commandes || 0} commandes terminées sur ${c.mois || 0} mois · ${String(c.abus_pct || 0).replace('.', ',')} % d’annulations abusives${c.avis ? ' · note ' + String(c.note).replace('.', ',') : ''}${c.identite ? ' · identité vérifiée' : ''}</small><q>${e(t.texte)}</q></div>
          <div class="fb-f"><textarea maxlength="300" data-nvr="${t.id}" aria-label="Réponse au membre" placeholder="Réponse au membre (il la verra)"></textarea>
          <select data-nvn="${t.id}" aria-label="Niveau à rendre">${opts(t.role, t.niveau_avant)}</select><input type="number" min="1" max="365" step="1" data-nvj="${t.id}" aria-label="Pendant combien de jours" value="${e(RG.force_jours || 90)}" style="max-width:110px">
          <button class="btn sm pri" data-nvd="${t.id}" data-ok="1">Accepter</button><button class="btn sm bad" data-nvd="${t.id}" data-ok="">Refuser</button></div></div>`; }).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucune contestation à traiter.</div></div>';
      const grace = GR.length ? `<div class="fb-l">${GR.map(x => `<div class="fb-r"><div><b>${qui(H, x.qui)}</b><small>${x.role === 'vendeur' ? 'Comme vendeur' : 'Comme acheteur'} · ${e(lib(x.role, x.niveau))} jusqu’au ${jour(x.jusqua)}, puis ${e(lib(x.role, x.vers))}</small></div></div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Personne n’est en sursis.</div></div>';
      const rep = (r.repartition || []).length || r.gros ? `<div class="nv-rep">${(r.repartition || []).sort((a, b) => a.role < b.role ? 1 : -1).map(x => `<span>${e(lib(x.role, x.niveau))}<span class="nbul">${x.n}</span></span>`).join('')}${r.gros ? `<span>Acheteur en gros<span class="nbul">${r.gros}</span></span>` : ''}</div>`
        : '<div class="fb-l"><div class="fb-vide">Personne n’a encore de niveau.</div></div>';
      const jr = J.length ? `<div class="fb-l">${J.slice(0, 40).map(j => `<div class="fb-r"><div><b>${qui(H, j.qui)}</b><small>${jour(j.at)} · ${j.role === 'vendeur' ? 'vendeur' : 'acheteur'} · ${EVT[j.evenement] || j.evenement}${j.ancien ? ' · avant : ' + e(lib(j.role, j.ancien)) : ''}${j.nouveau ? ' · après : ' + e(lib(j.role, j.nouveau)) : ''}${j.raison ? ' · ' + e(j.raison) : ''}</small></div></div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucun changement pour l’instant.</div></div>';
      const num = (k, v, min, max, st) => `<input type="number" name="${k}" min="${min}" max="${max}" step="${st || 1}" value="${v == null ? '' : e(v)}" aria-label="${k}">`;
      const ligne = x => `<tr data-nvl="${x.role}:${x.cle}"><td><input type="text" name="libelle" maxlength="40" value="${e(x.libelle)}" aria-label="Libellé"></td>
        <td>${num('commandes', x.commandes, 1, 100000)}</td><td>${num('mois', x.mois, 1, 12)}</td><td>${num('abus_max', x.abus_max, 0, 100, 0.1)}</td><td>${num('note_min', x.note_min, 1, 5, 0.1)}</td>
        <td>${num('volume_min', x.volume_min, 0, 100000000000)}</td><td><input type="checkbox" name="code_requis"${x.code_requis ? ' checked' : ''} aria-label="Validées par code"></td>
        <td><input type="checkbox" name="identite_requise"${x.identite_requise ? ' checked' : ''} aria-label="Identité vérifiée"></td><td>${num('plafond_partenaire', x.plafond_partenaire, 1, 1000)}</td>
        <td><button class="btn sm" data-nvs="${x.role}:${x.cle}">Enregistrer</button></td></tr>`;
      const tab = role => `<div class="nv-wrap"><table class="nv-tb"><thead><tr><th>${role === 'vendeur' ? 'Vendeur' : 'Acheteur'}</th><th>Commandes</th><th>Mois différents</th><th>Abusives max (%)</th><th>Note min</th><th>Volume min (F CFA)</th><th>Code</th><th>Identité</th><th>Max par partenaire</th><th></th></tr></thead>
        <tbody>${RL.filter(x => x.role === role).sort((a, b) => a.ordre - b.ordre).map(ligne).join('')}</tbody></table></div>`;
      const regl = `<form class="fb-g" data-nvg>${REG.map(([k, t, mi, ma]) => `<label>${t}<input type="number" min="${mi}" max="${ma}" step="1" name="${k}" value="${e(RG[k] != null ? RG[k] : '')}"></label>`).join('')}
        <div style="display:flex;align-items:flex-end"><button class="btn sm pri" type="submit">Enregistrer les réglages</button></div></form>`;
      return H.top('Niveaux', 'Vendeur fiable, Bon, Excellent, Grand vendeur, et les mêmes paliers pour les acheteurs. Calculés par le serveur sur les commandes terminées. Une baisse attend toujours la fin de la grâce, et le membre est prévenu.')
        + `<section class="sec">${titre('Contestations à traiter', ouv.length)}${cont}</section>
        <section class="sec">${titre('En sursis', GR.length)}${grace}</section>
        <section class="sec">${titre('Paires fermées', PF.length)}${PF.length ? `<div class="fb-l">${PF.map(p => `<div class="fb-r"><div><b>${qui(H, p.a)} et ${qui(H, p.b)}</b><small>${p.n} commandes terminées entre eux · ${p.part_a} % et ${p.part_b} % de leurs commandes · la plus rapide reçue en ${p.delai_min_minutes} min</small></div></div>`).join('')}</div>` : '<div class="fb-l"><div class="fb-vide">Aucune paire qui commerce presque seulement entre elle.</div></div>'}</section>
        <section class="sec">${titre('Répartition')}${rep}</section>
        <section class="sec">${titre('Paliers')}<p class="acc-sub" style="margin:0 0 10px">Valeurs de départ, à ajuster quand il y aura de l’activité. Un niveau demande aussi tous ceux d’en dessous. Laisser vide : pas de condition.</p>${tab('vendeur')}<div style="height:10px"></div>${tab('acheteur')}</section>
        <section class="sec">${titre('Réglages')}${regl}</section>
        <section class="sec">${titre('Derniers changements')}${jr}</section>`;
    },
    lier(root, H) {
      const agir = async (b, f, ok) => { b.disabled = true; try { await f(); H.toast(ok); await H.relire(); } catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); } };
      root.querySelectorAll('[data-nvd]').forEach(b => b.onclick = () => {
        const id = b.dataset.nvd, t = root.querySelector(`[data-nvr="${id}"]`), rep = t ? t.value.trim() : '';
        if (!rep) { H.toast('Écrivez la réponse au membre.'); if (t) t.focus(); return; }
        const niv = root.querySelector(`[data-nvn="${id}"]`).value, j = Math.round(+root.querySelector(`[data-nvj="${id}"]`).value || 0);
        agir(b, () => H.rpc('admin_niveaux_decider', b.dataset.ok ? { p_id: id, p_accepter: true, p_reponse: rep, p_niveau: niv, p_jours: j || null } : { p_id: id, p_accepter: false, p_reponse: rep }),
          b.dataset.ok ? 'Contestation acceptée. Le niveau est rendu.' : 'Contestation refusée.');
      });
      root.querySelectorAll('[data-nvs]').forEach(b => b.onclick = () => {
        const [role, cle] = b.dataset.nvs.split(':'), tr = root.querySelector(`[data-nvl="${b.dataset.nvs}"]`), v = {};
        tr.querySelectorAll('input').forEach(i => {
          if (i.type === 'checkbox') v[i.name] = i.checked;
          else if (i.name === 'libelle') v.libelle = i.value.trim();
          else if (i.value === '') { if (['note_min', 'volume_min', 'plafond_partenaire'].includes(i.name)) v[i.name] = null; }
          else v[i.name] = +i.value;
        });
        agir(b, () => H.rpc('admin_niveaux_regle_modifier', { p_role: role, p_cle: cle, p_valeurs: v }), 'Palier enregistré. Tous les niveaux sont recalculés.');
      });
      const f = root.querySelector('[data-nvg]'); if (f) f.onsubmit = ev => { ev.preventDefault();
        const v = {}; REG.forEach(([k]) => { const x = f.elements[k]; if (x && x.value !== '') v[k] = Math.round(+x.value); });
        agir(f.querySelector('[type=submit]'), () => H.rpc('admin_niveaux_regler', { p_valeurs: v }), 'Réglages enregistrés. Tous les niveaux sont recalculés.'); };
    }
  };
})();
