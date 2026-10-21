/* ═════════ Marché de Gros CI — tableau de bord : Transporteurs et Commandes (schémas 26 et 27) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt (une entrée par vue : titre, icône, compteur, chargement, dessin, gestes).
   • Transporteurs : vérifier, refuser ou suspendre (avec un motif), inscrire un chauffeur qui n'a pas l'application ;
   • Commandes : affecter un transporteur vérifié aux commandes du réseau, trancher les litiges, lire l'historique.
   Le serveur vérifie que le compte est administrateur pour chaque action (est_admin). Rien n'est inventé : tout vient de la base. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { tr: [], cmd: [], aTraiter: [], vueCmd: 'a_traiter', ouverts: {} };
  const VEH = { moto: 'Moto', tricycle: 'Tricycle', camionnette: 'Camionnette', camion: 'Camion', semi: 'Semi-remorque', autre: 'Autre' };
  const ST = { en_attente: 'À vérifier', verifie: 'Vérifié', refuse: 'Refusé', suspendu: 'Suspendu' };
  const ETAPE = { confirmee: 'Confirmée', preparation: 'Préparation', chargement: 'Chargée', transport: 'En route', transbordement: 'Transbordement', arrivee: 'Chauffeur arrivé', reception: 'Reçue', terminee: 'Terminée' };
  const ETAT = { a_confirmer: 'À confirmer', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée', litige: 'Litige' };
  const MODE = { reseau: 'Réseau Marché de Gros', acheteur: 'Choisi par l’acheteur', vendeur: 'Choisi par le vendeur' };
  const EV = { creee: 'Commande proposée', confirmee: 'Confirmée', refusee: 'Refusée', preparation: 'Préparation', chargement: 'Chargement confirmé', transport: 'Transport en cours',
    transbordement: 'Transbordement', arrivee: 'Chauffeur arrivé', reception: 'Réception confirmée', terminee: 'Terminée', annulation_demandee: 'Annulation demandée',
    annulation_refusee: 'Annulation refusée', annulee: 'Annulée', litige: 'Litige ouvert', transporteur_proposee: 'Transporteur proposé', transporteur_acceptee: 'Transporteur confirmé',
    transporteur_refusee: 'Transporteur a refusé', transporteur_retiree: 'Transporteur retiré' };

  const CSS = `.at-l{border-radius:20px;overflow:hidden;background:var(--panel)}
.at-r{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.4fr) auto;gap:6px 18px;align-items:center;padding:15px 20px;border-top:1px solid var(--line)}.at-r:first-child{border-top:0}
.at-r b{display:block;font-weight:600}.at-r small{display:block;color:var(--mute);font-size:13px}
.at-a{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.at-t{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:11px;font-size:12px;font-weight:600;background:var(--line2);color:var(--ink)}
.at-t.a{background:rgba(242,194,48,.22);color:var(--acc)}.at-t.v{background:rgba(108,197,140,.2);color:var(--v)}.at-t.r{background:rgba(229,96,79,.18);color:var(--bad-t)}
.at-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:16px 20px;border-radius:20px;background:var(--panel);margin:0 0 18px}
.at-f label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--mute)}
.at-f input,.at-f select,.at-sel{min-height:42px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;background:var(--champ);color:var(--ink)}
.at-j{grid-column:1 / -1;margin:6px 0 0;padding:10px 14px;border-radius:14px;background:var(--champ);font-size:13px;list-style:none}
.at-j li{padding:4px 0;border-top:1px solid var(--line)}.at-j li:first-child{border-top:0}
.at-vide{padding:26px 20px;color:var(--mute)}.at-vide b{display:block;color:var(--ink);margin-bottom:4px}
@media (max-width:760px){.at-r{grid-template-columns:minmax(0,1fr)}.at-a{justify-content:flex-start}}`;
  if (!document.getElementById('atCss')) { const s = document.createElement('style'); s.id = 'atCss'; s.textContent = CSS; document.head.appendChild(s); }

  const tag = (t, c) => `<span class="at-t ${c || ''}">${t}</span>`;
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const qte = (H, x) => x.quantite != null ? ' · ' + H.fmt(x.quantite) + ' ' + H.esc(unites(x.quantite, x.unite)) : '';
  const MST = { proposee: 'en attente de sa réponse', acceptee: 'a accepté', refusee: 'a refusé', retiree: 'retiré' };

  // ——— Transporteurs ———
  EXT.transporteurs = {
    titre: 'Transporteurs', ico: 'distance',
    n: () => D.tr.filter(t => t.statut === 'en_attente').length,
    charger: async H => { D.tr = (await H.rpc('admin_transporteurs')) || []; },
    vue(H) {
      const e = H.esc, regs = z => (z || []).map(s => H.REG[s] || s).join(', ');
      const ligne = t => `<div class="at-r"><div><b>${e(t.nom)} ${tag(e(t.code))}</b>
          <small>${e(VEH[t.vehicule] || t.vehicule)}${t.immatriculation ? ' · ' + e(t.immatriculation) : ''}${t.capacite_kg ? ' · ' + H.fmt(t.capacite_kg) + ' kg' : ''}</small>
          <small>${t.zones && t.zones.length ? e(regs(t.zones)) : 'Aucune région indiquée'}</small></div>
        <div>${tag(ST[t.statut] || t.statut, t.statut === 'verifie' ? 'v' : t.statut === 'en_attente' ? 'a' : 'r')} ${t.disponible ? tag('Disponible', 'v') : ''}
          <small>${t.avec_application ? (t.identite ? 'Identité vérifiée' : 'Identité non vérifiée') : 'Sans application · ' + e(t.tel || '')} · ${t.missions} mission(s) · inscrit ${H.ago(t.cree_le)}</small>
          ${t.motif ? `<small>Motif : ${e(t.motif)}</small>` : ''}</div>
        <div class="at-a">${t.statut !== 'verifie' ? `<button class="btn sm pri" data-tdec="${t.id}" data-st="verifie">Vérifier</button>` : ''}
          ${t.statut === 'en_attente' ? `<button class="btn sm bad" data-tdec="${t.id}" data-st="refuse">Refuser</button>` : ''}
          ${t.statut === 'verifie' ? `<button class="btn sm bad" data-tdec="${t.id}" data-st="suspendu">Suspendre</button>` : ''}</div></div>`;
      const grp = (titre, L, vide) => `<section class="sec"><div class="sec-h"><h2>${titre}</h2></div><div class="at-l">${L.length ? L.map(ligne).join('') : `<div class="at-vide">${vide}</div>`}</div></section>`;
      return H.top('Transporteurs', 'Vérifiez les chauffeurs avant qu’ils reçoivent des missions du réseau. Comparez avec leur identité (onglet Identités) et leur véhicule.') + `
        <details class="sec"><summary class="btn sm" style="list-style:none;margin-bottom:12px">+ Inscrire un chauffeur sans application</summary>
          <form class="at-f" data-tnew><label>Nom<input name="nom" maxlength="80" required></label><label>Téléphone (10 chiffres)<input name="tel" inputmode="numeric" maxlength="14" required></label>
            <label>Véhicule<select name="veh">${Object.entries(VEH).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
            <label>Plaque<input name="im" maxlength="20"></label><label>Charge max. (kg)<input name="cap" inputmode="numeric" maxlength="7"></label>
            <label style="justify-content:flex-end"><button class="btn pri" type="submit">Inscrire (vérifié d’office)</button></label></form>
          <p style="color:var(--mute);font-size:13px;margin:-8px 0 0">Son numéro reste visible de l’équipe seulement. Une mission qui lui est confiée est acceptée d’office : appelez-le d’abord.</p></details>
        ${grp('À vérifier', D.tr.filter(t => t.statut === 'en_attente'), '<b>Aucun profil en attente</b>Les nouvelles inscriptions arrivent ici.')}
        ${grp('Vérifiés', D.tr.filter(t => t.statut === 'verifie'), '<b>Aucun transporteur vérifié</b>')}
        ${D.tr.some(t => ['refuse', 'suspendu'].includes(t.statut)) ? grp('Refusés ou suspendus', D.tr.filter(t => ['refuse', 'suspendu'].includes(t.statut)), '') : ''}`;
    },
    lier(root, H) {
      root.querySelectorAll('[data-tdec]').forEach(b => b.onclick = async () => {
        const st = b.dataset.st; let motif = null;
        if (st !== 'verifie') { motif = prompt(st === 'refuse' ? 'Motif du refus (le chauffeur le verra) :' : 'Motif de la suspension (le chauffeur le verra) :'); if (!motif || !motif.trim()) return; }
        b.disabled = true;
        try { await H.rpc('admin_transporteur_decider', { p_id: b.dataset.tdec, p_statut: st, p_motif: motif }); H.toast(st === 'verifie' ? 'Transporteur vérifié.' : st === 'refuse' ? 'Profil refusé.' : 'Profil suspendu.'); await H.relire(); }
        catch (e) { b.disabled = false; H.toast('Impossible : ' + e.message); }
      });
      const f = root.querySelector('[data-tnew]');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const v = n => f.elements[n].value.trim(), b = f.querySelector('[type=submit]'); b.disabled = true;
        try { const code = await H.rpc('admin_transporteur_creer', { p_nom: v('nom'), p_tel: v('tel'), p_vehicule: v('veh'), p_immat: v('im') || null, p_capacite: v('cap') ? +v('cap').replace(/\D/g, '') : null, p_zones: [] });
          H.toast('Chauffeur inscrit : ' + code); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); }
      };
    }
  };

  // ——— Commandes ———
  EXT.commandes = {
    titre: 'Commandes', ico: 'negoce',
    n: () => D.aTraiter.length,
    charger: async H => {
      const [a, l] = await Promise.all([H.rpc('admin_commandes', { p_vue: 'a_traiter' }), D.vueCmd === 'a_traiter' ? null : H.rpc('admin_commandes', { p_vue: D.vueCmd })]);
      D.aTraiter = a || []; D.cmd = D.vueCmd === 'a_traiter' ? D.aTraiter : (l || []);
      if (!D.tr.length) D.tr = (await H.rpc('admin_transporteurs').catch(() => [])) || [];
    },
    vue(H) {
      const e = H.esc, dispo = D.tr.filter(t => t.statut === 'verifie').sort((a, b) => b.disponible - a.disponible);
      const ligne = c => {
        const sansTr = c.mode_transport === 'reseau' && ['a_confirmer', 'en_cours'].includes(c.etat) && ['confirmee', 'preparation', null, undefined].includes(c.etape) && !(c.mission && ['proposee', 'acceptee'].includes(c.mission.statut));
        return `<div class="at-r"><div><b>${e(c.produit || 'Commande')}${qte(H, c)} ${tag(e(c.numero))}</b>
            <small>${e(c.vendeur)} → ${e(c.acheteur)} · ${e(c.ville_depart || 'départ à préciser')} → ${e(c.lieu_livraison || 'livraison à convenir')}</small>
            <small>${c.montant != null ? H.fmt(c.montant) + ' F' : '—'}${c.commission_montant != null ? ' · commission prévue ' + H.fmt(c.commission_montant) + ' F (non prélevée)' : ''}</small></div>
          <div>${tag(ETAT[c.etat] || c.etat, c.etat === 'litige' ? 'r' : c.etat === 'en_cours' ? 'v' : '')} ${c.etape && c.etat === 'en_cours' ? tag(ETAPE[c.etape] || c.etape) : ''}
            <small>${e(MODE[c.mode_transport] || '')}${c.mission ? ' · ' + e(c.mission.nom) + ' (' + e(MST[c.mission.statut] || c.mission.statut) + ')' : ''} · ${H.ago(c.maj)}</small>
            ${c.etat === 'litige' ? `<small style="color:var(--bad-t)">Litige : « ${e(c.litige_motif || '')} »</small>` : ''}</div>
          <div class="at-a">
            ${sansTr ? (dispo.length ? `<select class="at-sel" data-trsel="${c.id}" aria-label="Transporteur">${dispo.map(t => `<option value="${t.id}">${e(t.nom)} · ${e(VEH[t.vehicule] || '')}${t.disponible ? ' · disponible' : ''}${t.avec_application ? '' : ' · sans appli'}</option>`).join('')}</select><button class="btn sm pri" data-aff="${c.id}">Affecter</button>` : '<small>Aucun transporteur vérifié</small>') : ''}
            ${c.etat === 'litige' ? `<button class="btn sm pri" data-lit="${c.id}" data-iss="terminee">Clore : livrée</button><button class="btn sm bad" data-lit="${c.id}" data-iss="annulee">Clore : annulée</button>` : ''}
            <button class="btn sm ghost" data-hist="${c.id}">Historique</button></div>
          ${D.ouverts[c.id] ? `<ul class="at-j">${D.ouverts[c.id].map(j => `<li><b>${e(EV[j.evenement] || j.evenement)}</b> · ${e(j.role)} · ${new Date(j.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${j.lieu ? ' · ' + e(j.lieu) : ''}${j.lat != null ? ' · position jointe' : ''}${j.note ? ' · « ' + e(j.note) + ' »' : ''}</li>`).join('') || '<li>Aucune étape.</li>'}</ul>` : ''}</div>`;
      };
      return H.top('Commandes', 'Affectez un transporteur vérifié aux commandes du réseau et tranchez les litiges. Aucun paiement ne passe par l’application : la commission est seulement calculée.',
        `<div class="seg" role="group" aria-label="Afficher">${[['a_traiter', 'À traiter'], ['en_cours', 'En cours'], ['tout', 'Toutes']].map(([k, l]) => `<button data-cvue="${k}" aria-pressed="${D.vueCmd === k}">${l}</button>`).join('')}</div>`) + `
        <section class="sec"><div class="at-l">${D.cmd.length ? D.cmd.map(ligne).join('') : `<div class="at-vide"><b>${D.vueCmd === 'a_traiter' ? 'Rien à traiter' : 'Aucune commande'}</b>${D.vueCmd === 'a_traiter' ? 'Les litiges et les commandes du réseau sans transporteur arrivent ici.' : ''}</div>`}</div></section>`;
    },
    lier(root, H) {
      root.querySelectorAll('[data-cvue]').forEach(b => b.onclick = async () => { D.vueCmd = b.dataset.cvue; await EXT.commandes.charger(H).catch(e => H.toast(e.message)); H.repeindre(); });
      root.querySelectorAll('[data-aff]').forEach(b => b.onclick = async () => {
        const sel = root.querySelector(`[data-trsel="${b.dataset.aff}"]`); if (!sel) return;
        const t = D.tr.find(x => x.id === sel.value);
        if (t && !t.avec_application && !confirm(t.nom + ' n’a pas l’application : la mission sera acceptée d’office. Vous l’avez appelé ?')) return;
        b.disabled = true;
        try { const r = await H.rpc('admin_affecter', { p_cmd: b.dataset.aff, p_transporteur: sel.value }); H.toast(r === 'acceptee' ? 'Transporteur affecté.' : 'Mission proposée : le chauffeur doit l’accepter.'); await H.relire(); }
        catch (e) { b.disabled = false; H.toast('Impossible : ' + e.message); }
      });
      root.querySelectorAll('[data-lit]').forEach(b => b.onclick = async () => {
        const iss = b.dataset.iss, note = prompt(iss === 'terminee' ? 'Décision : commande considérée comme livrée. Expliquez (les deux parties le verront) :' : 'Décision : commande annulée. Expliquez (les deux parties le verront) :');
        if (!note || !note.trim()) return; b.disabled = true;
        try { await H.rpc('admin_litige_trancher', { p_cmd: b.dataset.lit, p_issue: iss, p_note: note.trim() }); H.toast('Litige clos.'); await H.relire(); }
        catch (e) { b.disabled = false; H.toast('Impossible : ' + e.message); }
      });
      root.querySelectorAll('[data-hist]').forEach(b => b.onclick = async () => {
        const id = b.dataset.hist;
        if (D.ouverts[id]) { delete D.ouverts[id]; return H.repeindre(); }
        try { D.ouverts[id] = (await H.rpc('commande_journal', { p_id: id })) || []; H.repeindre(); } catch (e) { H.toast('Lecture impossible : ' + e.message); }
      });
    }
  };
})();
