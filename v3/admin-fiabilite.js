/* ═════════ Marché de Gros CI : tableau de bord, Fiabilité (schéma 84, décisions 11 à 21) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt. Tout vient de admin_fiabilite() (administrateur seulement) :
   • contestations à traiter (réponse en 7 jours au plus) ; • comptes à examiner (5 annulations abusives sur 90 jours) ;
   • suspensions en cours (décidées par l'administrateur seulement : 7 jours, puis 30 en récidive ; annonces cachées,
     commandes en cours qui continuent) ; • dernières annulations, à requalifier si besoin ; • réglages (seuils et durées).
   Le serveur vérifie est_admin pour chaque action. Aucune sanction n'est une retenue d'argent. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { r: null };
  const CSS = `.fb-l{border-radius:20px;overflow:hidden;background:var(--panel)}
.fb-r{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 18px;align-items:start;padding:15px 20px;border-top:1px solid var(--line)}.fb-r:first-child{border-top:0}
.fb-r b{display:block;font-weight:600}.fb-r small{display:block;color:var(--mute);font-size:13px;margin-top:2px}.fb-r q{display:block;margin-top:6px;font-size:14px;quotes:"« " " »"}
.fb-a{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center}
.fb-f{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fb-f textarea,.fb-f input,.fb-f select{min-height:38px;padding:6px 12px;border:1px solid var(--line2);border-radius:12px;background:var(--champ);color:var(--ink);font:inherit;font-size:14px}
.fb-f textarea{flex:1 1 320px;min-height:60px;resize:vertical}.fb-f input[type=text]{flex:1 1 220px}
.fb-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:16px 20px;border-radius:20px;background:var(--panel)}
.fb-g label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--mute)}.fb-g input{min-height:40px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;background:var(--champ);color:var(--ink);font:inherit}
.fb-t{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:11px;font-size:12px;font-weight:600;background:var(--line2);color:var(--ink)}
.fb-t.a{background:rgba(229,96,79,.18);color:var(--bad-t)}.fb-t.v{background:rgba(108,197,140,.2);color:#8BDCA6}.fb-t.j{background:rgba(242,194,48,.22);color:var(--acc)}
.fb-h .nbul{display:inline-grid;place-items:center;min-width:24px;height:22px;margin-left:8px;padding:0 7px;border-radius:11px;background:var(--acc);color:var(--acc-t);font:600 12px/1 Jost,sans-serif;vertical-align:2px}
.fb-vide{padding:22px 20px;color:var(--mute)}
@media (max-width:760px){.fb-r{grid-template-columns:minmax(0,1fr)}.fb-a{justify-content:flex-start}}`;
  if (!document.getElementById('fbCss')) { const s = document.createElement('style'); s.id = 'fbCss'; s.textContent = CSS; document.head.appendChild(s); }
  const CAT = { abusive: ['Abusive', 'a'], legitime: ['Légitime', 'v'], litige: ['Litige', 'j'], technique: ['Panne ou cas de force majeure', 'v'] };
  const CHEMIN = { retrait: 'retrait avant confirmation', refus: 'refus avant confirmation', accord: 'annulation après confirmation', litige: 'litige tranché', expiration: 'sans réponse (48 h)', autre: 'autre' };
  const MOTIF = { stock_epuise: 'Stock épuisé', prix_change: 'Prix changé', sans_reponse: 'L’autre partie ne répond pas', erreur_saisie: 'Erreur de saisie', panne_meteo: 'Panne ou météo', autre: 'Autre' };
  const REG = [['fenetre_jours', 'Fenêtre glissante (jours)'], ['seuil_avertissement', 'Avertissement à partir de'], ['seuil_baisse', 'Baisse du score à partir de'], ['seuil_examen', 'Examen à partir de'],
    ['suspension_jours', 'Suspension (jours)'], ['recidive_jours', 'Suspension en récidive (jours)'], ['contestation_jours', 'Délai pour contester (jours)'], ['reponse_jours', 'Délai de réponse de l’équipe (jours)'], ['expiration_heures', 'Commande sans réponse expirée après (heures)']];
  const titre = (t, n) => `<h2 class="fb-h">${t}${n ? `<span class="nbul">${n}</span>` : ''}</h2>`;
  const qui = (H, q) => q ? H.esc(q.nom || 'Membre') + (q.tel ? ' · ' + H.esc(String(q.tel).replace(/^225/, '')) : '') : 'compte supprimé';

  EXT.fiabilite = {
    titre: 'Fiabilité', ico: 'tendance',
    n: () => D.r ? (D.r.contestations || []).filter(t => t.ouverte).length + (D.r.examen || []).filter(x => !x.suspendu).length : 0,
    charger: async H => { D.r = await H.rpc('admin_fiabilite'); },
    vue(H) {
      const e = H.esc, r = D.r || {}, CT = (r.contestations || []), ouv = CT.filter(t => t.ouverte), EX = r.examen || [], SU = r.suspensions || [], AN = (r.annulations || []).slice().sort((x, y) => (y.a_examiner ? 1 : 0) - (x.a_examiner ? 1 : 0)), RG = r.reglages || {}, NX = AN.filter(a => a.a_examiner).length;
      const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const cont = ouv.length ? `<div class="fb-l">${ouv.map(t => `<div class="fb-r"><div><b>${e(t.produit || 'Commande')}${t.numero ? ' · ' + e(t.numero) : ''}</b>
          <small>${qui(H, t.qui)} · ${CHEMIN[t.chemin] || ''}${t.motif_code ? ' · ' + (MOTIF[t.motif_code] || '') : ''}${t.motif_texte ? ' « ' + e(t.motif_texte) + ' »' : ''} · répondre avant le ${jour(t.repondre_avant)}</small><q>${e(t.texte)}</q></div>
          <div class="fb-a"><span class="fb-t ${(CAT[t.categorie] || [])[1] || ''}">${(CAT[t.categorie] || [t.categorie])[0]}</span></div>
          <div class="fb-f"><textarea maxlength="600" data-ctr="${t.id}" aria-label="Réponse au membre" placeholder="Réponse au membre (il la verra)"></textarea>
          <button class="btn sm pri" data-ctd="${t.id}" data-ok="legitime">Accepter : légitime</button><button class="btn sm" data-ctd="${t.id}" data-ok="technique">Accepter : panne ou météo</button><button class="btn sm bad" data-ctd="${t.id}" data-ok="">Refuser</button></div></div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucune contestation à traiter.</div></div>';
      const exam = EX.length ? `<div class="fb-l">${EX.map(x => `<div class="fb-r"><div><b>${qui(H, x.qui)}</b>
          <small>${x.n90} annulations abusives sur ${RG.fenetre_jours || 90} jours · fiabilité ${x.score && x.score.pourcent != null ? x.score.pourcent + ' % sur ' + x.score.sur : 'pas encore calculée'} · ${x.suspensions ? x.suspensions + ' suspension' + (x.suspensions > 1 ? 's' : '') + ' avant' : 'jamais suspendu'}</small></div>
          <div class="fb-a">${x.suspendu ? '<span class="fb-t a">Suspendu</span>' : ''}</div>
          ${x.suspendu ? '' : `<div class="fb-f"><input type="text" maxlength="300" data-smo="${x.uid}" aria-label="Motif de la suspension" placeholder="Motif (le membre le verra)"><button class="btn sm bad" data-sus="${x.uid}">Suspendre ${x.suspensions ? RG.recidive_jours || 30 : RG.suspension_jours || 7} jours</button></div>`}</div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucun compte à examiner.</div></div>';
      const susp = SU.length ? `<div class="fb-l">${SU.map(x => `<div class="fb-r"><div><b>${qui(H, x.qui)}</b><small>Jusqu’au ${jour(x.fin)} · ${e(x.motif || '')}</small></div>
          <div class="fb-a"><button class="btn sm" data-lev="${x.id}">Lever la suspension</button></div></div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucune suspension en cours.</div></div>';
      const opt = (v, t, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${t}</option>`;
      const ann = AN.length ? `<div class="fb-l">${AN.slice(0, 60).map(a => `<div class="fb-r"><div><b>${e(a.produit || 'Commande')}${a.numero ? ' · ' + e(a.numero) : ''}</b>
          <small>${jour(a.cree_le)} · ${CHEMIN[a.chemin] || ''} · vendeur ${qui(H, a.vendeur)} · acheteur ${qui(H, a.acheteur)}</small>
          <small>${a.motif_code ? MOTIF[a.motif_code] : 'Sans motif'}${a.motif_texte ? ' « ' + e(a.motif_texte) + ' »' : ''}${a.accord != null ? ' · l’autre partie ' + (a.accord ? 'était d’accord' : 'n’était pas d’accord') : ''}${a.groupe_id ? ' · achat groupé' : ''}${a.note_admin ? ' · note : ' + e(a.note_admin) : ''}</small></div>
          <div class="fb-a">${a.a_examiner ? '<span class="fb-t">À examiner : aucune sanction avant votre choix</span> ' : ''}<span class="fb-t ${(CAT[a.categorie] || [])[1] || ''}">${(CAT[a.categorie] || [a.categorie])[0]}${a.role_imputable ? ' · ' + a.role_imputable : ''}</span></div>
          <div class="fb-f"><select data-acat="${a.id}" aria-label="Catégorie">${opt('abusive', 'Abusive', a.categorie)}${opt('legitime', 'Légitime', a.categorie)}${opt('litige', 'Litige', a.categorie)}${opt('technique', 'Panne ou météo', a.categorie)}</select>
          <select data-aimp="${a.id}" aria-label="Compte contre">${opt('', 'Personne', a.role_imputable || '')}${opt('vendeur', 'Le vendeur', a.role_imputable || '')}${opt('acheteur', 'L’acheteur', a.role_imputable || '')}</select>
          <input type="text" maxlength="300" data-anote="${a.id}" aria-label="Note" placeholder="Note (facultatif)"><button class="btn sm" data-acl="${a.id}">Enregistrer</button></div></div>`).join('')}</div>`
        : '<div class="fb-l"><div class="fb-vide">Aucune annulation depuis la mise en service.</div></div>';
      const regl = `<form class="fb-g" data-regl>${REG.map(([k, t]) => `<label>${t}<input type="number" min="1" max="1000" step="1" name="${k}" value="${e(RG[k] != null ? RG[k] : '')}"></label>`).join('')}
        <div style="display:flex;align-items:flex-end"><button class="btn sm pri" type="submit">Enregistrer les réglages</button></div></form>`;
      return H.top('Fiabilité', 'Annulations, contestations et comptes à examiner. Une annulation après confirmation compte contre celui qui l’a demandée si l’autre partie n’était pas d’accord avec le motif. La suspension est toujours votre décision.')
        + `<section class="sec">${titre('Contestations à traiter', ouv.length)}${cont}</section>
        <section class="sec">${titre('Comptes à examiner', EX.filter(x => !x.suspendu).length)}${exam}</section>
        <section class="sec">${titre('Suspensions en cours', SU.length)}${susp}</section>
        <section class="sec">${titre('Dernières annulations', NX)}${NX ? '<p class="acc-sub" style="margin:0 0 10px">Panne, météo ou stock épuisé refusés par l’autre partie : rien ne compte avant que vous les classiez.</p>' : ''}${ann}</section>
        <section class="sec">${titre('Réglages')}<p class="acc-sub" style="margin:0 0 10px">Valeurs de départ, à ajuster quand il y aura de l’activité. ${RG.debut ? 'Le comptage a commencé le ' + jour(RG.debut) : ''}</p>${regl}</section>`;
    },
    lier(root, H) {
      const agir = async (b, f, ok) => { b.disabled = true; try { await f(); H.toast(ok); await H.relire(); } catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); } };
      root.querySelectorAll('[data-ctd]').forEach(b => b.onclick = () => {
        const t = root.querySelector(`[data-ctr="${b.dataset.ctd}"]`), rep = t ? t.value.trim() : '';
        if (!rep) { H.toast('Écrivez la réponse au membre.'); if (t) t.focus(); return; }
        agir(b, () => H.rpc('admin_contestation_decider', { p_id: b.dataset.ctd, p_accepter: !!b.dataset.ok, p_reponse: rep, p_categorie: b.dataset.ok || 'legitime' }), b.dataset.ok ? 'Contestation acceptée.' : 'Contestation refusée.');
      });
      root.querySelectorAll('[data-sus]').forEach(b => b.onclick = () => {
        const i = root.querySelector(`[data-smo="${b.dataset.sus}"]`), m = i ? i.value.trim() : '';
        if (!m) { H.toast('Écrivez le motif de la suspension.'); if (i) i.focus(); return; }
        agir(b, () => H.rpc('admin_suspendre', { p_user: b.dataset.sus, p_motif: m }), 'Compte suspendu. Ses annonces sont cachées.');
      });
      root.querySelectorAll('[data-lev]').forEach(b => b.onclick = () => agir(b, () => H.rpc('admin_suspension_lever', { p_sanction: b.dataset.lev, p_motif: 'Levée par l’équipe' }), 'Suspension levée. Ses annonces sont revenues.'));
      root.querySelectorAll('[data-acl]').forEach(b => b.onclick = () => {
        const id = b.dataset.acl, cat = root.querySelector(`[data-acat="${id}"]`).value, imp = root.querySelector(`[data-aimp="${id}"]`).value, note = root.querySelector(`[data-anote="${id}"]`).value.trim();
        const a = (D.r.annulations || []).find(x => x.id === id); if (!a) return;
        if ((cat === 'abusive') && !imp) { H.toast('Une annulation abusive compte contre le vendeur ou l’acheteur.'); return; }
        const uid = imp === 'vendeur' ? a.vendeur_id : imp === 'acheteur' ? a.acheteur_id : null;
        agir(b, () => H.rpc('admin_annulation_classer', { p_id: id, p_categorie: cat, p_imputable: uid, p_note: note || null }), 'Annulation requalifiée.');
      });
      const f = root.querySelector('[data-regl]'); if (f) f.onsubmit = ev => { ev.preventDefault();
        const v = {}; REG.forEach(([k]) => { const x = f.elements[k]; if (x && x.value !== '') v[k] = Math.round(+x.value); });
        agir(f.querySelector('[type=submit]'), () => H.rpc('admin_fiabilite_regler', { p_valeurs: v }), 'Réglages enregistrés.'); };
    }
  };
})();
