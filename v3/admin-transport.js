/* ═════════ Marché de Gros CI — tableau de bord : Transporteurs et Commandes (schémas 26 et 27) ═════════
   Branché sur v3/admin.js par window.MDGAdminExt (une entrée par vue : titre, icône, compteur, chargement, dessin, gestes).
   • Transporteurs : vérifier, refuser ou suspendre (avec un motif), inscrire un chauffeur qui n'a pas l'application ;
   • Commandes : affecter un transporteur vérifié aux commandes du réseau, trancher les litiges, lire l'historique.
   Le serveur vérifie que le compte est administrateur pour chaque action (est_admin). Rien n'est inventé : tout vient de la base. */
(function () {
  'use strict';
  const EXT = window.MDGAdminExt = window.MDGAdminExt || {};
  const D = { tr: [], cmd: [], aTraiter: [], vueCmd: 'a_traiter', ouverts: {}, rfImg: {}, disc: {}, numero: undefined, numeroQ: '' };
  const VEH = { moto: 'Moto', tricycle: 'Tricycle', camionnette: 'Camionnette', camion: 'Camion', semi: 'Semi-remorque', autre: 'Autre' };
  const ST = { en_attente: 'À vérifier', verifie: 'Vérifié', refuse: 'Refusé', suspendu: 'Suspendu' };
  const ETAPE = { confirmee: 'Confirmée', preparation: 'Préparation', chargement: 'Chargée', transport: 'En route', transbordement: 'Transbordement', arrivee: 'Chauffeur arrivé', reception: 'Reçue', terminee: 'Terminée' };
  const ETAT = { a_confirmer: 'À confirmer', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée', litige: 'Litige' };
  const MODE = { reseau: 'Réseau Marché de Gros', acheteur: 'Choisi par l’acheteur', vendeur: 'Choisi par le vendeur' };
  const EV = { creee: 'Commande proposée', confirmee: 'Confirmée', refusee: 'Refusée', preparation: 'Préparation', chargement: 'Chargement confirmé', transport: 'Transport en cours',
    transbordement: 'Transbordement', arrivee: 'Chauffeur arrivé', reception: 'Réception confirmée', terminee: 'Terminée', annulation_demandee: 'Annulation demandée',
    annulation_refusee: 'Annulation refusée', annulee: 'Annulée', litige: 'Litige ouvert', transporteur_proposee: 'Transporteur proposé', transporteur_acceptee: 'Transporteur confirmé',
    transporteur_refusee: 'Transporteur a refusé', transporteur_retiree: 'Transporteur retiré',
    sq_depot: 'Fonds bloqués', sq_liberee: 'Conforme : clôturée par l’acheteur', sq_liberee_auto: 'Clôture automatique (1 h)', sq_refus: 'Marchandise refusée',
    sq_refus_chauffeur_confirme: 'Chauffeur confirme le refus', sq_refus_chauffeur_conteste: 'Chauffeur conteste le refus', sq_refus_vendeur_reconnu: 'Vendeur reconnaît',
    sq_refus_vendeur_conteste: 'Vendeur conteste', sq_refus_applique: 'Refus appliqué', sq_refus_admin: 'Décision de l’équipe', sq_solde: 'Séquestre soldé', sq_rembourse: 'Remboursement' };
  // schéma 92 : avis du système et livraison déclarée par celui qui transporte
  Object.assign(EV, { arrivee: 'Livraison déclarée', rappel_chargement: 'Rappel : chargement attendu', retard_chargement: 'Délai de chargement dépassé',
    rappel_reception: 'Rappel : réception à vérifier', mot_bloque: 'Mot secret bloqué' });
  const dt92 = t => t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const CSS = `.at-ph{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.at-ph img{width:64px;height:64px;object-fit:cover;border-radius:10px;display:block}
.at-l{border-radius:20px;overflow:hidden;background:var(--panel)}
.at-r{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1.4fr) auto;gap:6px 18px;align-items:center;padding:15px 20px;border-top:1px solid var(--line)}.at-r:first-child{border-top:0}
.at-r b{display:block;font-weight:600}.at-r small{display:block;color:var(--mute);font-size:13px}
.at-a{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.at-t{display:inline-flex;align-items:center;min-height:22px;padding:0 9px;border-radius:11px;font-size:12px;font-weight:600;background:var(--line2);color:var(--ink)}
.at-t.a{background:rgba(242,194,48,.22);color:var(--acc)}.at-t.v{background:rgba(108,197,140,.2);color:#8BDCA6}.at-t.r{background:rgba(229,96,79,.18);color:var(--bad-t)}
.at-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;padding:16px 20px;border-radius:20px;background:var(--panel);margin:0 0 18px}
.at-f label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:var(--mute)}
.at-f input,.at-f select,.at-sel{min-height:42px;padding:0 12px;border:1px solid var(--line2);border-radius:12px;background:var(--champ);color:var(--ink)}
.at-j{grid-column:1 / -1;margin:6px 0 0;padding:10px 14px;border-radius:14px;background:var(--champ);font-size:13px;list-style:none}
.at-ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.at-k{padding:14px 16px;border-radius:18px;background:var(--panel)}.at-k b{display:block;font-size:20px;font-weight:800;margin:2px 0}.at-k small{display:block;color:var(--mute);font-size:12.5px}
.at-j li{padding:4px 0;border-top:1px solid var(--line)}.at-j li:first-child{border-top:0}
.at-vide{padding:26px 20px;color:var(--mute)}.at-vide b{display:block;color:var(--ink);margin-bottom:4px}
@media (max-width:760px){.at-r{grid-template-columns:minmax(0,1fr)}.at-a{justify-content:flex-start}}`;
  if (!document.getElementById('atCss')) { const s = document.createElement('style'); s.id = 'atCss'; s.textContent = CSS; document.head.appendChild(s); }

  const tag = (t, c) => `<span class="at-t ${c || ''}">${t}</span>`;
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const qte = (H, x) => x.quantite != null ? ' · ' + H.fmt(x.quantite) + ' ' + H.esc(unites(x.quantite, x.unite)) : '';
  const MST = { proposee: 'en attente de sa réponse', acceptee: 'a accepté', refusee: 'a refusé', retiree: 'retiré' };

  // Transporteurs
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

  // Commandes
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
            <small>${e(MODE[c.mode_transport] || '')}${c.mission ? ' · ' + e(c.mission.nom) + ' (' + e(MST[c.mission.statut] || c.mission.statut) + ')' : ''}${c.mission && c.mission.prix != null ? ' · transport ' + H.fmt(c.mission.prix) + ' F' + (c.mode_transport === 'reseau' ? ' (commission 6,9 % : ' + H.fmt(Math.round(Math.round(c.mission.prix) * 0.069)) + ' F, non prélevée)' : ' (livreur hors service : aucune commission)') : ''} · ${H.ago(c.maj)}</small>
            ${c.etat === 'litige' && !c.refus ? `<small style="color:var(--bad-t)">Litige : « ${e(c.litige_motif || '')} »</small>` : ''}
            ${c.litige_retard ? `<small style="color:var(--bad-t)">Litige à trancher : échéance dépassée (${e(dt92(c.litige_echeance))})</small>` : c.etat === 'litige' && c.litige_echeance ? `<small>À trancher avant le ${e(dt92(c.litige_echeance))}</small>` : ''}
            ${c.chargement_retard ? `<small style="color:var(--bad-t)">Pas chargée à temps (échéance ${e(dt92(c.chargement_echeance))}) : l’acheteur peut annuler</small>` : ''}
            ${c.mot_bloque ? `<small style="color:var(--bad-t)">Mot secret bloqué après trop d’essais faux</small>` : ''}
            ${c.annulation_bloquee ? `<small style="color:var(--bad-t)">Annulation du vendeur refusée deux fois : à trancher</small>` : ''}
            ${c.refus ? `<small style="color:var(--bad-t)">Marchandise refusée : ${c.refus.quantite != null ? e(String(c.refus.quantite)) + ' ' + e(c.unite || '') : 'tout'} · « ${e(c.refus.motif || '')} »</small>
              <small>Chauffeur : ${c.refus.chauffeur === 'confirme' ? 'confirme' : c.refus.chauffeur === 'conteste' ? 'conteste' : 'pas de réponse'}${c.refus.chauffeur_suffit ? '' : ' (choisi par l’acheteur : ne suffit pas seul)'} · Vendeur : ${c.refus.vendeur === 'reconnu' ? 'reconnaît' : c.refus.vendeur === 'conteste' ? 'conteste' : 'pas de réponse'}</small>
              <span class="at-ph">${(c.refus.photos || []).map((x, i) => D.rfImg[c.id] && D.rfImg[c.id][i] ? `<a href="${e(D.rfImg[c.id][i])}" target="_blank" rel="noopener"><img src="${e(D.rfImg[c.id][i])}" alt="Photo ${i + 1} du refus"></a>` : '').join('')}</span>` : ''}
            ${c.refus && c.refus.mot ? `<small>${c.refus.mot === 'retrouve' ? '✓ mot du vendeur retrouvé' : '✗ papier du vendeur absent'}${c.mot_secret ? ' (mot : ' + e(c.mot_secret) + ')' : ''}</small>` : ''}
            ${c.sans_reponse ? `<small style="color:var(--bad-t)">Reçue, l’acheteur n’a ni validé ni refusé depuis 48 h</small>` : ''}
            ${D.disc[c.id] ? `<ul class="at-j">${(D.disc[c.id].messages || []).map(m => `<li><b>${e({ acheteur: 'Acheteur', vendeur: 'Vendeur', admin: 'Marché de Gros' }[m.role] || m.role)}</b> · ${new Date(m.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${e(m.texte)}</li>`).join('') || '<li>Aucun message.</li>'}</ul>
              ${D.disc[c.id].ouvert ? `<form class="at-f" data-dsf="${c.id}" style="display:flex;gap:8px;align-items:end"><label style="flex:1">Répondre au nom du Marché de Gros<input name="t" maxlength="600" autocomplete="off"></label><button class="btn sm pri">Envoyer</button></form>` : ''}` : ''}
            ${c.libere_le && c.etat === 'terminee' ? `<small>Clôturée (${e({ conforme: 'acheteur satisfait', auto: 'automatique 1 h', refus: 'refus confirmé', admin: 'équipe' }[c.liberation] || '')})${Number(c.montant_refuse) > 0 ? ' · ' + H.fmt(c.montant_refuse) + ' F rendus à l’acheteur' : ''}</small>` : ''}</div>
          <div class="at-a">
            ${sansTr ? (dispo.length ? `<select class="at-sel" data-trsel="${c.id}" aria-label="Transporteur">${dispo.map(t => `<option value="${t.id}">${e(t.nom)} · ${e(VEH[t.vehicule] || '')}${t.disponible ? ' · disponible' : ''}${t.avec_application ? '' : ' · sans appli'}</option>`).join('')}</select><button class="btn sm pri" data-aff="${c.id}">Affecter</button>` : '<small>Aucun transporteur vérifié</small>') : ''}
            ${c.mission && c.mission.id && c.mission.statut === 'acceptee' && !c.mission.avec_application && ['a_confirmer', 'en_cours'].includes(c.etat) && ['confirmee', 'preparation', null, undefined].includes(c.etape) ? `<input class="at-sel" type="number" inputmode="numeric" min="1" step="1" data-mpx="${c.mission.id}" value="${c.mission.prix != null ? Math.round(c.mission.prix) : ''}" placeholder="Prix du transport (F)" aria-label="Prix du transport, donné par le chauffeur au téléphone" style="max-width:170px"><button class="btn sm pri" data-mpxb="${c.mission.id}">${c.mission.prix != null ? 'Changer le prix' : 'Saisir le prix'}</button>` : ''}
            ${c.sans_reponse ? `<button class="btn sm pri" data-lib="${c.id}">Clôturer la commande</button>` : ''}
            ${c.etat === 'litige' ? `<button class="btn sm ghost" data-ds="${c.id}" aria-expanded="${!!D.disc[c.id]}">Discussion</button>` : ''}
            ${c.etat === 'litige' && c.refus ? `<button class="btn sm ghost" data-rfph="${c.id}">Photos (${(c.refus.photos || []).length})</button><button class="btn sm pri" data-rft="${c.id}" data-q="0">Rejeter le refus</button><button class="btn sm bad" data-rft="${c.id}" data-q="">Accepter le refus</button>` : ''}
            ${c.etat === 'litige' && !c.refus ? `<button class="btn sm pri" data-lit="${c.id}" data-iss="terminee" data-fautif="">Clore : livrée, sans faute</button><button class="btn sm" data-lit="${c.id}" data-iss="terminee" data-fautif="acheteur">Clore : livrée, réclamation de l’acheteur sans fondement</button><button class="btn sm bad" data-lit="${c.id}" data-iss="annulee" data-fautif="vendeur">Annulée : faute du vendeur</button><button class="btn sm bad" data-lit="${c.id}" data-iss="annulee" data-fautif="acheteur">Annulée : faute de l’acheteur</button><button class="btn sm" data-lit="${c.id}" data-iss="annulee" data-fautif="">Annulée : torts partagés</button>` : ''}
            ${c.etat === 'litige' && !c.refus && c.quantite != null ? `<button class="btn sm" data-part="${c.id}">Partager</button>` : ''}
            ${['a_confirmer', 'en_cours'].includes(c.etat) ? `<button class="btn sm bad" data-iss2="${c.id}" data-iss="annulee" data-fautif="vendeur">Annuler : faute du vendeur</button><button class="btn sm bad" data-iss2="${c.id}" data-iss="annulee" data-fautif="acheteur">Annuler : faute de l’acheteur</button><button class="btn sm" data-iss2="${c.id}" data-iss="annulee" data-fautif="">Annuler : personne en faute</button>${c.etat === 'en_cours' ? `<button class="btn sm pri" data-iss2="${c.id}" data-iss="terminee" data-fautif="">Clore : livrée</button>` : ''}` : ''}
            <button class="btn sm ghost" data-hist="${c.id}">Historique</button><button class="btn sm ghost" data-tout="${e(c.numero)}">Tout voir</button></div>
          ${D.ouverts[c.id] ? `<ul class="at-j">${D.ouverts[c.id].map(j => `<li><b>${e(EV[j.evenement] || j.evenement)}</b> · ${e(j.role)} · ${new Date(j.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${j.lieu ? ' · ' + e(j.lieu) : ''}${j.lat != null ? ' · position jointe' : ''}${j.note ? ' · « ' + e(j.note) + ' »' : ''}</li>`).join('') || '<li>Aucune étape.</li>'}</ul>` : ''}</div>`;
      };
      const tr = D.numero;
      return H.top('Commandes', 'Affectez un transporteur vérifié aux commandes du réseau et tranchez les litiges. Aucun paiement ne passe par l’application : la commission est seulement calculée.',
        `<form class="at-f" data-num style="display:flex;gap:8px;align-items:end;margin:0 0 10px"><label style="flex:1">Retrouver une commande par son numéro<input name="n" placeholder="MDG-C-…" autocomplete="off" value="${e(D.numeroQ || '')}"></label><button class="btn sm pri">Chercher</button></form>
        ${tr === null ? '<p class="at-vide" style="margin:0 0 10px">Aucune commande avec ce numéro.</p>' : tr ? `<section class="sec" style="margin:0 0 12px"><div class="at-r" style="display:block"><b>${e(tr.produit || 'Commande')} ${tag(e(tr.numero))} ${tag(ETAT[tr.etat] || tr.etat, tr.etat === 'litige' ? 'r' : '')}</b>
          <small>${e(tr.vendeur)} → ${e(tr.acheteur)} · ${tr.quantite != null ? e(String(tr.quantite)) + ' ' + e(tr.unite || '') : ''} à ${tr.prix_unitaire != null ? H.fmt(tr.prix_unitaire) + ' F' : '—'} = ${tr.montant != null ? H.fmt(tr.montant) + ' F' : '—'}</small>
          <small>${e(tr.ville_depart || 'départ ?')} → ${e(tr.lieu_livraison || 'livraison ?')} · ${e(MODE[tr.mode_transport] || '')} · validation ${tr.validation === 'code' ? 'avec codes' : 'sans code'}</small>
          ${tr.negociation ? `<small>Accord : ${tr.negociation.prix_final != null ? H.fmt(tr.negociation.prix_final) + ' F' : '—'} × ${e(String(tr.negociation.quantite_finale ?? '—'))}${tr.negociation.transport_final ? ' · transport compris' : ''}${tr.negociation.conditions_finales ? ' · « ' + e(tr.negociation.conditions_finales) + ' »' : ''}${tr.negociation.conclu_le ? ' · conclu le ' + new Date(tr.negociation.conclu_le).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small>` : ''}
          ${tr.sequestre && tr.sequestre.repartition ? `<small>Répartition : vendeur ${H.fmt(tr.sequestre.repartition.vendeur_net)} F net · transporteur ${H.fmt(tr.sequestre.repartition.transporteur_net)} F net · acheteur ${H.fmt(tr.sequestre.repartition.acheteur_rembourse)} F refusés (non dus) · Marché de Gros ${H.fmt(tr.sequestre.repartition.marche)} F · séquestre : ${tr.sequestre.actif ? e(tr.sequestre.etat) : 'pas encore de partenaire'}</small>` : ''}
          ${[['Négociation', tr.conversation], ['Messages directs entre eux', tr.messages_directs], ['Discussion à trois', tr.discussion_litige]].map(([t, L]) => `<p style="margin:10px 0 4px;font-weight:600">${t} (${(L || []).length})</p><ul class="at-j">${(L || []).map(m => `<li><b>${e({ vendeur: 'Vendeur', acheteur: 'Acheteur', admin: 'Marché de Gros' }[m.role] || 'Autre')}</b> · ${new Date(m.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${m.genre && m.genre !== 'texte' ? ' · ' + e({ prix: 'propose', accord: 'accord', refus: 'refuse', retrait: 'retire', fin: 'fin' }[m.genre] || m.genre) : ''}${m.prix != null ? ' ' + H.fmt(m.prix) + ' F' : ''}${m.quantite != null ? ' × ' + e(String(m.quantite)) : ''}${m.texte ? ' · « ' + e(m.texte) + ' »' : ''}</li>`).join('') || '<li>Rien.</li>'}</ul>`).join('')}
          <p style="margin:10px 0 4px;font-weight:600">Historique</p><ul class="at-j">${(tr.journal || []).map(j => `<li><b>${e(EV[j.evenement] || j.evenement)}</b> · ${e(j.role)} · ${new Date(j.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${j.lieu ? ' · ' + e(j.lieu) : ''}${j.note ? ' · « ' + e(j.note) + ' »' : ''}</li>`).join('') || '<li>Aucune étape.</li>'}</ul></div></section>` : ''}
        <div class="seg" role="group" aria-label="Afficher">${[['a_traiter', 'À traiter'], ['en_cours', 'En cours'], ['tout', 'Toutes']].map(([k, l]) => `<button data-cvue="${k}" aria-pressed="${D.vueCmd === k}">${l}</button>`).join('')}</div>`) + `
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
      // chauffeur sans application : l'équipe saisit le prix qu'il a donné au téléphone (schéma 42)
      root.querySelectorAll('[data-mpxb]').forEach(b => b.onclick = async () => {
        const i = root.querySelector(`[data-mpx="${b.dataset.mpxb}"]`), p = Math.round(+(i && i.value) || 0);
        if (!(p > 0)) return H.toast('Indiquez le prix du transport, en francs.');
        b.disabled = true;
        try { await H.rpc('admin_mission_prix', { p_mission: b.dataset.mpxb, p_prix: p }); H.toast('Prix du transport enregistré : ' + H.fmt(p) + ' F.'); await H.relire(); }
        catch (e) { b.disabled = false; H.toast('Impossible : ' + e.message); }
      });
      root.querySelectorAll('[data-lit]').forEach(b => b.onclick = async () => {
        const iss = b.dataset.iss, note = prompt(iss === 'terminee' ? 'Décision : commande considérée comme livrée. Expliquez (les deux parties le verront) :' : 'Décision : commande annulée. Expliquez (les deux parties le verront) :');
        if (!note || !note.trim()) return; b.disabled = true;
        // schéma 84 : la partie fautive compte dans sa fiabilité (litige perdu) ; torts partagés, ou serveur pas à jour : personne.
        // schéma 94f : une commande déclarée livrée peut aussi porter un litige perdu (réclamation sans fondement)
        const fa = b.dataset.fautif || null;
        try { await H.rpc('admin_litige_clore', { p_cmd: b.dataset.lit, p_issue: iss, p_note: note.trim(), p_fautif: fa })
            .catch(e => /schema cache|Could not find the function|PGRST202/i.test(String(e && e.message)) ? H.rpc('admin_litige_trancher', { p_cmd: b.dataset.lit, p_issue: iss, p_note: note.trim() }) : Promise.reject(e));
          H.toast('Litige clos.'); await H.relire(); }
        catch (e) { b.disabled = false; H.toast('Impossible : ' + e.message); }
      });
      // schéma 92 : décision de l'équipe sur une commande à confirmer ou en cours (journalisée, note visible des deux parties)
      root.querySelectorAll('[data-iss2]').forEach(b => b.onclick = async () => {
        const iss = b.dataset.iss, fa = b.dataset.fautif || null;
        const note = prompt(iss === 'terminee' ? 'Décision : commande considérée comme livrée. Expliquez (les deux parties le verront) :'
          : 'Décision : commande annulée' + (fa ? ', faute ' + (fa === 'vendeur' ? 'du vendeur' : 'de l’acheteur') + ' (compte dans sa fiabilité)' : ', personne en faute') + '. Expliquez (les deux parties le verront) :');
        if (!note || !note.trim()) return; b.disabled = true;
        try { await H.rpc('admin_commande_issue', { p_cmd: b.dataset.iss2, p_issue: iss, p_note: note.trim(), p_fautif: fa }); H.toast('Décision enregistrée.'); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); }
      });
      // schéma 92 : litige tranché en partage (une partie de la marchandise n'est pas due)
      root.querySelectorAll('[data-part]').forEach(b => b.onclick = async () => {
        const id = b.dataset.part, c = D.cmd.find(x => x.id === id) || D.aTraiter.find(x => x.id === id);
        const v = prompt('Partage : quantité qui n’est pas due (sur ' + (c && c.quantite != null ? c.quantite + ' ' + (c.unite || '') : 'la commande') + ') :', ''); if (v === null) return;
        const q = Number(String(v).replace(',', '.')); if (!(q > 0) || (c && c.quantite != null && q >= c.quantite)) return H.toast('Quantité invalide : plus de 0 et moins que la commande.');
        const note = prompt('Partage : ' + q + ' ' + ((c && c.unite) || '') + ' ne sont pas dus. Expliquez (les deux parties le verront) :'); if (!note || !note.trim()) return; b.disabled = true;
        try { await H.rpc('admin_litige_partager', { p_cmd: id, p_quantite: q, p_note: note.trim() }); H.toast('Partage enregistré.'); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); }
      });
      root.querySelectorAll('[data-lib]').forEach(b => b.onclick = async () => {
        const note = prompt('Clôturer la commande (l’acheteur ne répond pas). Expliquez (les parties le verront) :'); if (!note || !note.trim()) return; b.disabled = true;
        try { await H.rpc('admin_liberer', { p_cmd: b.dataset.lib, p_note: note.trim() }); H.toast('Commande clôturée.'); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); }
      });
      root.querySelectorAll('[data-ds]').forEach(b => b.onclick = async () => { const id = b.dataset.ds;
        if (D.disc[id]) { delete D.disc[id]; return H.repeindre(); }
        try { D.disc[id] = (await H.rpc('litige_messages_lire', { p_cmd: id })) || { messages: [] }; H.repeindre(); } catch (x) { H.toast('Lecture impossible : ' + x.message); } });
      root.querySelectorAll('[data-dsf]').forEach(f => f.onsubmit = async ev => { ev.preventDefault(); const id = f.dataset.dsf, t = f.t.value.trim(); if (!t) return;
        try { await H.rpc('litige_ecrire', { p_cmd: id, p_texte: t }); D.disc[id] = await H.rpc('litige_messages_lire', { p_cmd: id }); H.repeindre(); } catch (x) { H.toast('Envoi impossible : ' + x.message); } });
      root.querySelectorAll('[data-tout]').forEach(b => b.onclick = async () => { D.numeroQ = b.dataset.tout;
        try { D.numero = (await H.rpc('admin_commande_numero', { p_numero: b.dataset.tout })) || null; H.repeindre(); window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (x) { H.toast('Lecture impossible : ' + x.message); } });
      const fn = root.querySelector('[data-num]');
      if (fn) fn.onsubmit = async ev => { ev.preventDefault(); const q = fn.n.value.trim(); D.numeroQ = q; if (!q) { D.numero = undefined; return H.repeindre(); }
        try { D.numero = (await H.rpc('admin_commande_numero', { p_numero: q })) || null; } catch (x) { H.toast('Recherche impossible : ' + x.message); } H.repeindre(); };
      root.querySelectorAll('[data-rfph]').forEach(b => b.onclick = async () => { const id = b.dataset.rfph, c = D.cmd.find(x => x.id === id) || D.aTraiter.find(x => x.id === id);
        if (D.rfImg[id]) { delete D.rfImg[id]; return H.repeindre(); }
        D.rfImg[id] = await Promise.all(((c && c.refus && c.refus.photos) || []).map(x => window.MDGNuage.lienSigne('preuves', x, 300).catch(() => null))); H.repeindre(); });
      root.querySelectorAll('[data-rft]').forEach(b => b.onclick = async () => {
        const id = b.dataset.rft, c = D.cmd.find(x => x.id === id) || D.aTraiter.find(x => x.id === id); let q = b.dataset.q === '' ? null : 0;
        if (q === null) { const v = prompt('Quantité refusée retenue (sur ' + (c && c.quantite != null ? c.quantite + ' ' + (c.unite || '') : 'la commande') + ') :', c && c.refus && c.refus.quantite != null ? c.refus.quantite : (c && c.quantite) || ''); if (v === null) return; q = Number(String(v).replace(',', '.')); if (!(q > 0)) return H.toast('Quantité invalide.'); }
        const note = prompt(q === 0 ? 'Refus rejeté : tout est dû au vendeur. Expliquez (les parties le verront) :' : 'Refus accepté : la partie refusée n’est pas due. Expliquez (les parties le verront) :');
        if (!note || !note.trim()) return; b.disabled = true;
        try { await H.rpc('admin_refus_trancher', { p_cmd: id, p_quantite: q, p_note: note.trim() }); H.toast('Décision enregistrée.'); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); }
      });
      root.querySelectorAll('[data-hist]').forEach(b => b.onclick = async () => {
        const id = b.dataset.hist;
        if (D.ouverts[id]) { delete D.ouverts[id]; return H.repeindre(); }
        try { D.ouverts[id] = (await H.rpc('commande_journal', { p_id: id })) || []; H.repeindre(); } catch (e) { H.toast('Lecture impossible : ' + e.message); }
      });
    }
  };

  // Commissions (schéma 30) : registre calculé par le serveur. Rien n'est encaissé.
  const KST = { prevue: ['Prévue', 'a'], calculee: ['Calculée (jamais réclamée)', 'v'], due: ['Due (argent passé par l’application)', 'v'], avant: ['D’avant la règle : non réclamée', ''], suspendue: ['Suspendue (litige)', 'r'], annulee: ['Annulée', ''] };
  // ANO-013 : une ancienne « due » sans séquestre (avant le schéma 95b) n'est jamais « argent passé ». Le serveur la marque dans statut_registre
  // (avant_regle / non_reclamee) ; tant qu'aucun paiement n'existe, une « due » sans séquestre confirmé s'affiche aussi « D'avant la règle ».
  const AVANT = ['avant', 'avant_regle', 'non_reclamee'];
  const stK = k => { const v = k.statut_registre || k.statut; if (AVANT.includes(v)) return 'avant'; if (v === 'due' && !(k.sequestre === true || k.argent_passe === true)) return 'avant'; return KST[v] ? v : 'prevue'; };
  const etiq = k => { const v = stK(k); return `<span class="at-t ${KST[v][1]}">${KST[v][0]}</span>`; };
  // totaux du serveur, regroupés par libellé affiché (les « due » d'aujourd'hui sont toutes d'avant la règle : aucun paiement n'existe)
  const totauxAff = (T, cles) => { const o = {}; Object.keys(T || {}).forEach(s => { const v = AVANT.includes(s) || s === 'due' ? 'avant' : s, x = T[s] || {}, y = o[v] || (o[v] = {});
    Object.keys(x).forEach(c => { y[c] = (y[c] || 0) + (+x[c] || 0); }); }); return o; };
  // commission transport (schéma 42, 95, 95b) : 6,9 % du prix du transporteur du service Marché de Gros. « Calculée » : jamais réclamée. Rien n'est encaissé.
  function commTransport(H) {
    const e = H.esc, c = D.comTr; if (!c) return '';
    const TA = totauxAff(c.totaux), t = k => TA[k] || { n: 0, transports: 0, commission: 0 };
    const tuile = k => { const x = t(k); return `<div class="at-k"><small>${KST[k][0]}</small><b>${H.fmt(x.commission || 0)} F</b><small>${x.n || 0} transport${x.n > 1 ? 's' : ''} · ${H.fmt(x.transports || 0)} F</small></div>`; };
    const ligne = k => `<div class="at-r"><div><b>${e(k.produit || 'Commande')} · ${e(k.numero)}</b><small>${e(k.transporteur || 'Chauffeur')} · ${new Date(k.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
        <div><b>${H.fmt(k.commission)} F</b><small>6,9 % de ${H.fmt(k.prix_transport)} F</small></div>
        <div class="at-a">${etiq(k)}</div></div>`;
    return `<section class="sec"><h2 style="margin:6px 0 4px">Transport · 6,9 %</h2><p style="margin:0 0 10px;color:var(--mute,#655C4D)">Seulement pour le service transport Marché de Gros, sur le prix du transporteur. Avant le paiement dans l’application, elle est calculée et jamais réclamée. Rien n’est encaissé.</p>
      <div class="at-ks">${tuile('calculee')}${tuile('avant')}${tuile('prevue')}${tuile('suspendue')}${tuile('annulee')}<div class="at-k"><small>Encaissé</small><b>0 F</b><small>pas de paiement dans l’application</small></div></div>
      <div class="at-l" style="margin-top:10px">${(c.lignes || []).length ? c.lignes.map(ligne).join('') : '<div class="at-vide"><b>Aucune commission transport</b>Elle s’inscrit quand un chauffeur accepte une mission avec son prix.</div>'}</div></section>`;
  }
  D.com = null; D.comOuv = {};
  EXT.commissions = {
    titre: 'Commissions', ico: 'prix',
    charger: async H => { const [a, t] = await Promise.all([H.rpc('admin_commissions'), H.rpc('admin_commissions_transport').catch(() => null)]); D.com = a; D.comTr = t; },
    vue(H) {
      const e = H.esc, c = D.com || { totaux: {}, lignes: [] }, TA = totauxAff(c.totaux), t = k => TA[k] || { n: 0, ventes: 0, commission: 0 };
      const tuile = (k) => { const x = t(k); return `<div class="at-k"><small>${KST[k][0]}</small><b>${H.fmt(x.commission || 0)} F</b><small>${x.n || 0} commande${x.n > 1 ? 's' : ''} · ventes ${H.fmt(x.ventes || 0)} F</small></div>`; };
      const ligne = k => `<div class="at-r"><div><b>${e(k.produit || 'Commande')} · ${e(k.numero)}</b><small>${e(k.vendeur || 'Membre')} · ${new Date(k.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
          <div><b>${H.fmt(k.commission)} F</b><small>3,5 % de ${H.fmt(k.montant_vente)} F</small></div>
          <div class="at-a">${etiq(k)}<button class="btn sm ghost" data-kj="${k.id}" aria-expanded="${!!D.comOuv[k.id]}">Journal</button></div>
          ${D.comOuv[k.id] ? `<ul class="at-j">${(k.journal || []).map(j => `<li><b>${e(AVANT.includes(j.statut) || (j.statut === 'due' && !(k.sequestre === true || k.argent_passe === true)) ? KST.avant[0] : KST[j.statut] ? KST[j.statut][0] : j.statut)}</b> · ${H.fmt(j.commission)} F · ${e(j.motif)} · ${new Date(j.at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</li>`).join('')}</ul>` : ''}</div>`;
      return H.top('Commissions', 'Registre de la commission de 3,5 % sur les ventes de marchandises, calculée par le serveur. Aucun paiement n’existe : une vente clôturée donne une commission « calculée », jamais réclamée. Rien n’a été encaissé.', '') + `
        <section class="sec"><div class="at-ks">${tuile('calculee')}${tuile('avant')}${tuile('prevue')}${tuile('suspendue')}${tuile('annulee')}<div class="at-k"><small>Encaissé</small><b>0 F</b><small>pas de paiement dans l’application</small></div></div></section>
        <section class="sec"><div class="at-l">${(c.lignes || []).length ? c.lignes.map(ligne).join('') : '<div class="at-vide"><b>Aucune commission</b>Elles s’inscrivent seules à chaque commande.</div>'}</div></section>
        ${commTransport(H)}`;
    },
    lier(root, H) {
      root.querySelectorAll('[data-kj]').forEach(b => b.onclick = () => { const id = b.dataset.kj; if (D.comOuv[id]) delete D.comOuv[id]; else D.comOuv[id] = 1; H.repeindre(); });
    }
  };

  // Structures (schéma 39) : badge « Coopérative / Marché vérifié ». Document officiel + identité vérifiée du responsable.
  const SST = { en_attente: ['À examiner', 'a'], verifiee: ['Vérifiée', 'v'], refusee: ['Refusée', 'r'], retiree: ['Retirée par le membre', ''] };
  const STYPE = { cooperative: 'Coopérative', marche: 'Marché' };
  D.st = []; D.stImg = {};
  EXT.structures = {
    titre: 'Structures', ico: 'verifie',
    n: () => D.st.filter(x => x.statut === 'en_attente').length,
    charger: async H => { D.st = (await H.rpc('admin_structures')) || []; },
    vue(H) {
      const e = H.esc, att = D.st.filter(x => x.statut === 'en_attente'), autres = D.st.filter(x => x.statut !== 'en_attente');
      const ligne = x => `<div class="at-r"><div><b>${e(STYPE[x.type] || x.type)} · ${e(x.nom)}</b><small>Responsable : ${e(x.responsable)} · ${e(x.fonction)}</small>
          <small>Envoyé le ${new Date(x.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}${x.motif ? ' · motif : ' + e(x.motif) : ''}</small></div>
        <div>${x.identite_ok ? tag('Identité vérifiée', 'v') : tag('Identité plus valide', 'r')} ${x.profil_change ? tag('Profil changé depuis', 'r') : ''}</div>
        <div class="at-a">${tag(SST[x.statut][0], SST[x.statut][1])}${x.statut === 'en_attente' ? `<button class="btn sm ghost" data-sdoc="${x.id}" aria-expanded="${!!D.stImg[x.id]}">Document (${(x.documents || []).length})</button><button class="btn sm" data-sdec="${x.id}" data-d="verifiee"${x.identite_ok && !x.profil_change ? '' : ' disabled'}>Valider</button><button class="btn sm ghost" data-sdec="${x.id}" data-d="refusee">Refuser</button>` : ''}</div>
        ${D.stImg[x.id] ? `<div class="at-j" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">${D.stImg[x.id].map((u, i) => u ? `<a href="${e(u)}" target="_blank" rel="noopener"><img src="${e(u)}" alt="Document page ${i + 1}" style="width:100%;border-radius:10px;display:block"></a>` : '<span>Image introuvable</span>').join('')}</div>` : ''}</div>`;
      return H.top('Structures', 'Badge « Coopérative vérifiée » ou « Marché vérifié ». Comparez le document officiel avec le nom de la structure, et la fonction avec le responsable dont l’identité est déjà vérifiée. Vérifiée ne veut pas dire fiable.', '') + `
        <section class="sec"><div class="at-l">${att.length ? att.map(ligne).join('') : '<div class="at-vide"><b>Aucun dossier à examiner</b>Les coopératives et les marchés envoient leur dossier depuis leur profil.</div>'}</div></section>
        ${autres.length ? `<section class="sec"><div class="sec-h"><h2>Décisions des 90 derniers jours</h2></div><div class="at-l">${autres.map(ligne).join('')}</div></section>` : ''}`;
    },
    lier(root, H) {
      root.querySelectorAll('[data-sdoc]').forEach(b => b.onclick = async () => { const id = b.dataset.sdoc;
        if (D.stImg[id]) { delete D.stImg[id]; H.repeindre(); return; }
        const x = D.st.find(y => y.id === id); b.disabled = true;
        D.stImg[id] = await Promise.all((x.documents || []).map(c => window.MDGNuage.lienSigne('preuves', c, 300).catch(() => null))); H.repeindre(); });
      root.querySelectorAll('[data-sdec]').forEach(b => b.onclick = async () => { const d = b.dataset.d; let motif = null;
        if (d === 'refusee') { motif = prompt('Motif du refus (le membre le lira) :'); if (!motif || !motif.trim()) return; }
        else if (!confirm('Valider cette structure ? Le badge apparaîtra sur son profil et ses annonces.')) return;
        b.disabled = true;
        try { await H.rpc('admin_structure_decider', { p_id: b.dataset.sdec, p_decision: d, p_motif: motif }); H.toast(d === 'verifiee' ? 'Structure vérifiée.' : 'Dossier refusé.'); await H.relire(); }
        catch (x) { b.disabled = false; H.toast('Impossible : ' + x.message); } });
    }
  };
})();
