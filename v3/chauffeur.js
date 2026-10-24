/* ═════════ Marché de Gros CI — Espace chauffeur ═════════
   Pour les transporteurs : s'inscrire (gratuit), suivre la vérification par l'équipe, se dire disponible,
   recevoir les missions du réseau Marché de Gros (son code T-4K7P prouve qui il est), accepter ou refuser une mission,
   puis signaler l'arrivée ou un transbordement. Serveur : supabase/schema-27-transporteurs.sql.
   Le chargement reste confirmé par le vendeur et la réception par l'acheteur (codes à venir).
   Le numéro du chauffeur n'est jamais montré aux membres ; le chauffeur ne voit pas leurs numéros.
   Réutilise l'habillage de Mes commandes (v3/commandes.js : MDGCommandes.css()).
   API : MDGChauffeur.ouvrir() · MDGChauffeur.etat() → { inscrit, statut, propositions } (dernier état connu) */
(function () {
  'use strict';
  if (window.MDGChauffeur) return;
  const N = () => window.MDGNuage;
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const K = () => 'mdg-chauffeur:' + (me() || 'x');
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = (n, t) => window.MDGIco ? MDGIco.svg(n, t || 18, 1.9) : '';
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0);
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : null;
  const sac = (h, t) => window.MDGSac ? MDGSac.svg(h, { t }) : '';
  const horsLigne = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET/i.test(String((e && e.message) || e || ''));
  const erreurTxt = e => { if (horsLigne(e)) return 'Pas de connexion : rien n’a été enregistré. Réessayez quand le réseau revient.'; const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : m || 'Réessayez dans un instant.'; };
  const REGIONS = () => (window.MDG && MDG.regions) || [];
  const VEH = [['moto', 'Moto'], ['tricycle', 'Tricycle'], ['camionnette', 'Camionnette'], ['camion', 'Camion'], ['semi', 'Semi-remorque'], ['autre', 'Autre']];
  const VLIB = Object.fromEntries(VEH);
  const STATUT = { en_attente: ['En attente de vérification', 'L’équipe vérifie votre profil. Vous pouvez déjà recevoir une mission d’un acheteur ou d’un vendeur qui vous choisit.', 'mais'],
    verifie: ['Profil vérifié', 'Vous pouvez vous dire disponible : l’équipe peut alors vous confier des missions du réseau.', ''],
    refuse: ['Profil refusé', '', 'rouge'], suspendu: ['Profil suspendu', '', 'rouge'] };
  const ETAPE = { confirmee: 'En attente du chargement', preparation: 'Marchandise en préparation', chargement: 'Chargé', transport: 'En route',
    transbordement: 'Transbordement', arrivee: 'Arrivé', reception: 'Reçue', terminee: 'Livraison terminée' };
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };

  let bg = null, moi = null, missions = [], transferts = [], vue = 'accueil', minuteur = null;
  // prix du transport (schéma 42) : le chauffeur le fixe en acceptant, et peut le corriger jusqu'au chargement.
  // La commission du Marché de Gros (6,9 %) est due par le chauffeur : il l'inclut dans son prix. Rien n'est prélevé dans l'application.
  const TAUX_TR = 0.069, comTr = p => Math.round(Math.round(p) * TAUX_TR);
  let prixOuvert = null;   // mission dont le formulaire de prix est ouvert
  function fermer() { if (!bg) return; bg.remove(); bg = null; clearInterval(minuteur); minuteur = null; document.removeEventListener('keydown', clavier); if (retourFocus && retourFocus.focus) try { retourFocus.focus({ preventScroll: true }); } catch (_) {} retourFocus = null; }
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  function memoriser() { W(K(), { inscrit: !!moi, statut: moi && moi.statut, propositions: missions.filter(m => m.mission === 'proposee').length, moi, missions }); }

  async function lire() {
    const c = J(K(), null); if (c && !moi) { moi = c.moi || null; missions = c.missions || []; }
    if (navigator.onLine === false) return;
    try { moi = await N().rpc('transporteur_moi'); missions = moi ? ((await N().rpc('chauffeur_missions')) || []) : [];
      transferts = moi ? ((await N().rpc('chauffeur_transferts').catch(() => [])) || []) : []; memoriser(); }
    catch (e) { if (bg) toast('Espace chauffeur indisponible', { type: 'erreur', sous: erreurTxt(e) }); }
  }

  // ——— inscription ou modification du profil ———
  function formulaire() {
    const box = bg.querySelector('.cm'), t = moi || {}, Z = new Set(t.zones || []);
    box.scrollTop = 0;
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${moi ? 'Mon profil de <em>transporteur</em>' : 'Devenir <em>transporteur</em>'}</h2>
      <p class="cm-sous">Gratuit. L’équipe du Marché de Gros vérifie chaque profil. Votre numéro n’est jamais montré aux membres.</p>
      <form class="cm-f" novalidate>
        <label class="t" for="chN">Nom affiché (vous ou votre entreprise)</label>
        <input type="text" id="chN" maxlength="80" value="${esc(t.nom || '')}" autocomplete="organization">
        <label class="t">Véhicule</label>
        ${VEH.map(([k, l]) => `<label class="cm-opt" style="grid-template-columns:24px 1fr;padding:10px 14px"><input type="radio" name="veh" value="${k}"${t.vehicule === k ? ' checked' : ''}><span><b>${l}</b></span></label>`).join('')}
        <label class="t" for="chI">Plaque d’immatriculation <small style="font-weight:400;color:#5E5546">(facultatif)</small></label>
        <input type="text" id="chI" maxlength="20" value="${esc(t.immatriculation || '')}" autocapitalize="characters" autocomplete="off">
        <label class="t" for="chC">Charge maximale en kg <small style="font-weight:400;color:#5E5546">(facultatif)</small></label>
        <input type="text" id="chC" inputmode="numeric" maxlength="7" value="${t.capacite_kg ? esc(t.capacite_kg) : ''}" autocomplete="off">
        <fieldset style="border:0;margin:0;padding:0"><legend class="t" style="display:block;margin:14px 0 6px;font-weight:600">Régions où vous travaillez</legend>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:4px 10px">${REGIONS().map(r => `<label class="cm-ck" style="margin:0"><input type="checkbox" name="z" value="${esc(r.slug)}"${Z.has(r.slug) ? ' checked' : ''}> ${esc(r.name)}</label>`).join('')}</div></fieldset>
        ${moi && moi.statut === 'verifie' ? '<p class="cm-info">Un changement de véhicule ou de plaque sera vérifié de nouveau par l’équipe.</p>' : ''}
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">${moi ? 'Enregistrer' : 'Envoyer mon inscription'}</button>${moi ? '<button type="button" data-ann>Retour</button>' : ''}</div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    const ann = box.querySelector('[data-ann]'); if (ann) ann.onclick = () => { vue = 'accueil'; peindre(); };
    const f = box.querySelector('form'), err = f.querySelector('.cm-err');
    f.onsubmit = async e => {
      e.preventDefault();
      const nom = f.querySelector('#chN').value.trim(), veh = (f.querySelector('[name=veh]:checked') || {}).value;
      const im = f.querySelector('#chI').value.trim(), cap = f.querySelector('#chC').value.replace(/\D/g, '');
      const zones = [...f.querySelectorAll('[name=z]:checked')].map(x => x.value);
      if (nom.length < 2) { err.textContent = 'Indiquez votre nom.'; f.querySelector('#chN').focus(); return; }
      if (!veh) { err.textContent = 'Choisissez votre véhicule.'; return; }
      if (N().texteRefus) { const r = N().texteRefus(nom); if (r) { err.textContent = r; return; } }
      const b = f.querySelector('[type=submit]'); b.disabled = true; err.textContent = '';
      try {
        const r = await N().rpc('transporteur_inscrire', { p_nom: nom, p_vehicule: veh, p_immat: im || null, p_capacite: cap ? +cap : null, p_zones: zones });
        toast(moi ? 'Profil enregistré' : 'Inscription envoyée', { type: 'ok', sous: 'Votre code transporteur : ' + r.code });
        await lire(); vue = 'accueil'; peindre();
      } catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
  }

  // ——— accueil : statut, code, disponibilité, missions ———
  function carteMission(m) {
    const q = m.quantite != null ? ' · ' + nf(m.quantite, 2) + ' ' + esc(unites(m.quantite, m.unite)) : '';
    const B = [];
    const avantChargement = ['confirmee', 'preparation', null, undefined].includes(m.etape) && ['a_confirmer', 'en_cours'].includes(m.etat);
    if (m.mission === 'proposee' && prixOuvert !== m.mission_id) B.push(`<button type="button" class="p" data-acc="${m.mission_id}">Accepter et fixer mon prix</button>`, `<button type="button" data-ref="${m.mission_id}">Refuser</button>`);
    if (m.mission === 'acceptee' && avantChargement && prixOuvert !== m.mission_id) B.push(`<button type="button" data-chpx="${m.mission_id}">${m.prix != null ? 'Changer mon prix' : 'Indiquer mon prix'}</button>`);
    const K = m.validation === 'code', go = m.mission === 'acceptee' && m.etat === 'en_cours';
    if (go && K && ['confirmee', 'preparation'].includes(m.etape)) B.push(`<button type="button" class="p" data-tap="${m.commande_id}" data-quoi="prise">Taper le code de prise en charge</button>`,
      `<button type="button" data-dem="${m.commande_id}">🔐 Demander le code au vendeur</button>`);
    if (go && ['transport', 'transbordement', 'arrivee'].includes(m.etape))
      B.push(partage && partage.cmd === m.commande_id ? `<button type="button" data-gps-stop>${IC('localiser', 18)} Arrêter le partage de position</button>`
        : `<button type="button" class="p" data-gps="${m.commande_id}">${IC('localiser', 18)} Partager ma position</button>`);
    if (go && ['transport', 'transbordement'].includes(m.etape))
      B.push(`<button type="button" class="${K ? '' : 'p'}" data-arr="${m.commande_id}">Je suis arrivé</button>`);
    if (go && K && ['transport', 'transbordement', 'arrivee'].includes(m.etape)) B.push(`<button type="button" class="p" data-tap="${m.commande_id}" data-quoi="reception">Taper le code de réception</button>`,
      `<button type="button" data-dem="${m.commande_id}">🔐 Demander le code à l’acheteur</button>`);
    // schéma 51 : chacun exige le code de l'autre, sur place ; la demande passe par l'application, jamais par WhatsApp
    const moiCode = moi && moi.code ? ` Montrez-lui aussi votre code transporteur <b>${esc(moi.code)}</b> : il doit le vérifier.` : '';
    const exige = go && K ? (['confirmee', 'preparation'].includes(m.etape) ? `🔐 Quand la marchandise est chargée, exigez que le vendeur vous montre son code de prise en charge.${moiCode}`
      : ['transport', 'transbordement', 'arrivee'].includes(m.etape) ? `🔐 À la livraison, exigez que l’acheteur vous montre son code de réception, après sa vérification.${moiCode}` : '') : '';
    if (go && ['transport', 'transbordement'].includes(m.etape))
      B.push(K ? `<button type="button" class="m" data-pas="${m.commande_id}">Passer la marchandise à un autre chauffeur</button>` : `<button type="button" class="m" data-trb="${m.commande_id}">Signaler un transbordement</button>`);
    // schéma 57 : l'acheteur refuse la marchandise après réception ; le chauffeur dit ce qu'il a vu à la livraison
    const Rf = m.refus;
    if (Rf && Rf.a_repondre) B.unshift(`<button type="button" class="p" data-rfo="${m.commande_id}">Oui, c’est ce que j’ai vu</button>`, `<button type="button" data-rfn="${m.commande_id}">Non, ce n’est pas vrai</button>`);
    const refus = Rf ? `<div style="margin:10px 0 0;padding:12px;border-radius:14px;background:rgba(196,72,52,.08);box-shadow:inset 0 0 0 1px rgba(196,72,52,.25)">
        <b style="display:block;color:#8A2414">L’acheteur refuse ${Rf.quantite != null ? nf(Rf.quantite, 2) + ' ' + esc(unites(Rf.quantite, m.unite)) : 'toute la marchandise'}</b>
        <small style="display:block;margin-top:2px;color:inherit">« ${esc(Rf.motif || '')} »</small>
        <span style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0">${(Rf.photos || []).map(x => `<span data-ph="${esc(x)}" role="img" aria-label="Photo du refus" style="display:block;width:64px;height:64px;border-radius:10px;overflow:hidden;background:#E7E0CF"></span>`).join('')}</span>
        <small style="display:block;color:#5E5546">${Rf.a_repondre ? 'À la livraison, la marchandise était-elle dans cet état ? Répondez honnêtement : votre réponse est enregistrée avec la commande n° ' + esc(m.numero) + '.' + (Rf.suffit ? ' Vous êtes un chauffeur vérifié du Marché de Gros : si vous confirmez, la partie refusée est rendue à l’acheteur.' : ' L’équipe du Marché de Gros tiendra compte de votre réponse.') + ' Votre prix de transport reste dû dans tous les cas.'
          : Rf.reponse === 'confirme' ? 'Vous avez confirmé le refus.' : Rf.reponse === 'conteste' ? 'Vous avez contesté le refus : l’équipe va trancher.' : 'Refus traité.'}</small></div>` : '';
    const st = m.mission === 'proposee' ? ['Nouvelle mission', 'mais'] : m.mission === 'refusee' ? ['Refusée', 'rouge'] : m.etat === 'annulee' ? ['Commande annulée', 'rouge'] : m.etat === 'litige' ? [Rf ? 'Marchandise refusée' : 'Litige en cours', 'rouge'] : [ETAPE[m.etape] || 'Acceptée', ''];
    return `<div class="cm-r" style="cursor:default;grid-template-columns:1fr"><span>
      <b>${esc(m.produit || 'Marchandise')}${q}</b>
      <small>${esc(m.ville_depart || 'Départ à préciser')} → ${esc(m.lieu_livraison || 'livraison à préciser')}</small>
      <small>Vendeur : ${esc(m.vendeur)} · Acheteur : ${esc(m.acheteur)}</small>
      <small style="margin-top:6px"><span class="cm-tag ${st[1]}">${esc(st[0])}</span> ${m.propose_role === 'admin' ? '· confiée par l’équipe' : m.propose_role === 'acheteur' ? '· choisi par l’acheteur' : m.propose_role === 'vendeur' ? '· choisi par le vendeur' : ''}</small>
      ${m.mission === 'acceptee' && m.prix != null ? `<small style="margin-top:6px;color:inherit"><b>Votre prix : ${nf(m.prix)} F</b> · commission Marché de Gros (6,9 %) : ${nf(m.commission)} F · vous gardez ${nf(m.net)} F</small>` : ''}
      ${m.mission === 'acceptee' && m.prix == null && avantChargement ? '<small style="margin-top:6px;color:#8A6400"><b>Prix du transport à indiquer</b> : l’acheteur le verra dans sa commande.</small>' : ''}
      ${prixOuvert === m.mission_id ? formPrix(m) : ''}
      ${exige ? `<p class="cm-garde" style="margin:10px 0 0">${exige}</p>` : ''}${refus}
      ${B.length ? `<div class="cm-act" style="margin:10px 0 0">${B.join('')}</div>` : ''}</span></div>`;
  }
  function formPrix(m) {
    const acc = m.mission === 'proposee';
    return `<form class="cm-f" data-pxf="${m.mission_id}" data-acc2="${acc ? 1 : ''}" style="margin:10px 0 0">
      <label>Votre prix pour ce transport (F CFA)<input type="number" inputmode="numeric" min="1" step="1" data-pxv value="${m.prix != null ? Math.round(m.prix) : ''}" placeholder="ex. 10000" required></label>
      <small data-pxi style="display:block;margin:6px 0 0;color:#5E5546;line-height:1.4">La commission du Marché de Gros est de 6,9 % de votre prix : comptez-la dedans. L’acheteur paie votre prix à la livraison, avec la marchandise. Rien n’est prélevé dans l’application pour l’instant.</small>
      <p class="cm-err" data-pxe role="alert" style="margin:4px 0 0"></p>
      <div class="cm-act" style="margin:8px 0 0"><button type="submit" class="p">${acc ? 'Accepter la mission' : 'Enregistrer le prix'}</button><button type="button" data-pxx>Annuler</button></div></form>`;
  }
  function lierPrix(box) {
    const f = box.querySelector('[data-pxf]'); if (!f) return;
    const v = f.querySelector('[data-pxv]'), info = f.querySelector('[data-pxi]'), err = f.querySelector('[data-pxe]'), go = f.querySelector('[type=submit]'), acc = !!f.dataset.acc2;
    const maj = () => { const p = Math.round(+v.value || 0);
      info.textContent = p > 0 ? `Commission Marché de Gros (6,9 %) : ${nf(comTr(p))} F · vous gardez ${nf(p - comTr(p))} F. L’acheteur paie ${nf(p)} F de transport à la livraison, avec la marchandise. Rien n’est prélevé dans l’application pour l’instant.`
        : 'La commission du Marché de Gros est de 6,9 % de votre prix : comptez-la dedans. L’acheteur paie votre prix à la livraison, avec la marchandise.';
      go.textContent = p > 0 ? (acc ? `Accepter à ${nf(p)} F` : `Enregistrer ${nf(p)} F`) : (acc ? 'Accepter la mission' : 'Enregistrer le prix'); };
    v.oninput = maj; maj(); setTimeout(() => { try { v.focus(); } catch (_) {} }, 50);
    f.querySelector('[data-pxx]').onclick = () => { prixOuvert = null; peindre(); };
    f.onsubmit = async e => {
      e.preventDefault(); const p = Math.round(+v.value || 0);
      if (!(p > 0)) { err.textContent = 'Indiquez votre prix, en francs.'; return; }
      go.disabled = true; err.textContent = '';
      try {
        if (acc) await N().rpc('chauffeur_repondre2', { p_mission: f.dataset.pxf, p_oui: true, p_prix: p });
        else await N().rpc('chauffeur_prix', { p_mission: f.dataset.pxf, p_prix: p });
        toast(acc ? 'Mission *acceptée*' : 'Prix *enregistré*', { type: 'ok', sous: acc ? 'L’acheteur et le vendeur sont prévenus. Transport : ' + nf(p) + ' F.' : 'L’acheteur voit le nouveau prix : ' + nf(p) + ' F.' });
        prixOuvert = null; await lire(); peindre();
      } catch (x) { go.disabled = false; err.textContent = erreurTxt(x); }
    };
  }
  function accueil() {
    const box = bg.querySelector('.cm');
    if (!moi) return formulaire();
    const [st, sous, cls] = STATUT[moi.statut] || ['', '', ''];
    const prop = missions.filter(m => m.mission === 'proposee'), act = missions.filter(m => m.mission === 'acceptee'), autres = missions.filter(m => m.mission === 'refusee');
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Espace <em>chauffeur</em></h2>
      <p class="cm-sous">${esc(moi.nom)} · ${esc(VLIB[moi.vehicule] || '')}${moi.immatriculation ? ' · ' + esc(moi.immatriculation) : ''}</p>
      <div class="cm-st" role="status"><b>Votre code : <em style="letter-spacing:.06em">${esc(moi.code)}</em></b><small>Votre code de transporteur du réseau Marché de Gros. Montrez-le au vendeur et à l’acheteur au chargement et à la livraison : il prouve que c’est bien vous. Les missions du réseau arrivent ici.</small></div>
      <p class="cm-info" style="${cls === 'rouge' ? 'background:rgba(196,72,52,.14)' : ''}"><b>${esc(st)}.</b> ${esc(moi.motif && cls === 'rouge' ? 'Motif : ' + moi.motif : sous)}</p>
      ${moi.statut === 'verifie' ? `<label class="cm-ck" style="padding:10px 14px;border-radius:16px;background:#FFFDF8;margin:0 0 12px"><input type="checkbox" data-dispo${moi.disponible ? ' checked' : ''}> <span><b>Disponible pour des missions du réseau</b><small style="display:block;color:#5E5546;font-size:12.5px">L’équipe vous propose des missions dans vos régions.</small></span></label>` : ''}
      ${transferts.length ? `<h3 class="cm-h3">Marchandise à recevoir</h3><div class="cm-li">${transferts.map(t => `<div class="cm-r" style="cursor:default;grid-template-columns:1fr"><span>
        <b>${esc(t.produit || 'Marchandise')}${t.quantite != null ? ' · ' + nf(t.quantite, 2) + ' ' + esc(unites(t.quantite, t.unite)) : ''}</b>
        <small>${esc(t.de || 'Un chauffeur')} vous la transmet à ${esc(t.lieu || '?')} · livraison : ${esc(t.lieu_livraison || 'à préciser')}</small>
        <div class="cm-act" style="margin:10px 0 0"><button type="button" class="p" data-tap="${t.commande_id}" data-quoi="transfert">Taper le code de transfert</button></div></span></div>`).join('')}</div>` : ''}
      ${prop.length ? `<h3 class="cm-h3">À accepter</h3><div class="cm-li">${prop.map(carteMission).join('')}</div>` : ''}
      <h3 class="cm-h3">Mes missions</h3>
      <div class="cm-li">${act.length ? act.map(carteMission).join('') : (window.MDGSac ? MDGSac.vide('Aucune mission en cours', 'Les missions acceptées s’affichent ici, avec les étapes à signaler.') : '<p>Aucune mission.</p>')}</div>
      ${autres.length ? `<h3 class="cm-h3">Refusées (7 derniers jours)</h3><div class="cm-li">${autres.map(carteMission).join('')}</div>` : ''}
      <div class="cm-act" style="margin-top:16px"><button type="button" data-prof>${IC('crayon', 18)} Modifier mon profil</button></div>
      <p class="cm-note">Commande avec codes : vous tapez le code du vendeur au chargement, puis celui de l’acheteur à la réception. Sans code : le vendeur et l’acheteur déclarent eux-mêmes. Votre numéro n’est jamais montré aux membres.</p>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-prof]').onclick = () => { vue = 'profil'; peindre(); };
    const d = box.querySelector('[data-dispo]');
    if (d) d.onchange = async () => { d.disabled = true; try { await N().rpc('transporteur_disponible', { p_oui: d.checked }); moi.disponible = d.checked; memoriser(); toast(d.checked ? 'Vous êtes disponible' : 'Vous n’êtes plus disponible', { type: 'ok' }); } catch (x) { d.checked = !d.checked; toast(erreurTxt(x), { type: 'erreur' }); } d.disabled = false; };
    box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { prixOuvert = b.dataset.acc; peindre(); });
    box.querySelectorAll('[data-chpx]').forEach(b => b.onclick = () => { prixOuvert = b.dataset.chpx; peindre(); });
    lierPrix(box);
    box.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => repondre(b.dataset.ref, false, b));
    box.querySelectorAll('[data-arr]').forEach(b => b.onclick = () => etape(b.dataset.arr, 'arrivee'));
    box.querySelectorAll('[data-trb]').forEach(b => b.onclick = () => etape(b.dataset.trb, 'transbordement'));
    box.querySelectorAll('[data-tap]').forEach(b => b.onclick = () => taper(b.dataset.tap, b.dataset.quoi));
    box.querySelectorAll('[data-dem]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { const r = await N().rpc('commande_code_demander', { p_cmd: b.dataset.dem });
        if (r && r.ok) toast('Demande envoyée', { type: 'ok', sous: (r.a === 'vendeur' ? 'Le vendeur' : 'L’acheteur') + ' est prévenu sur son téléphone. Il vous montrera son code sur place.' });
        else toast('Déjà demandé', { sous: (r && r.message) || 'Attendez un peu avant de redemander.' }); }
      catch (e) { toast('Demande impossible', { type: 'erreur', sous: erreurTxt(e) }); }
      setTimeout(() => { b.disabled = false; }, 4000);
    });
    box.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => passer(b.dataset.pas));
    const constat = async (id, oui, b) => {
      let note = null;
      if (!oui) { note = prompt('Qu’avez-vous vu à la livraison ? (facultatif)') ; if (note === null) return; }
      else if (!confirm('Vous confirmez que la marchandise était dans cet état à la livraison ?')) return;
      b.disabled = true;
      try { const r = await N().rpc('commande_refus_chauffeur', { p_id: id, p_oui: oui, p_note: (note || '').trim() || null });
        toast(oui ? 'Merci, refus confirmé' : 'Merci, votre réponse est enregistrée', { type: 'ok', sous: r === 'applique' ? 'La partie refusée est rendue à l’acheteur. Votre transport reste dû.' : 'L’équipe du Marché de Gros va juger.' });
        await lire(); peindre(); }
      catch (e) { toast('Réponse impossible', { type: 'erreur', sous: erreurTxt(e) }); b.disabled = false; }
    };
    box.querySelectorAll('[data-rfo]').forEach(b => b.onclick = () => constat(b.dataset.rfo, true, b));
    box.querySelectorAll('[data-rfn]').forEach(b => b.onclick = () => constat(b.dataset.rfn, false, b));
    box.querySelectorAll('[data-ph]').forEach(async el => {
      const u = await N().lienSigne('preuves', el.dataset.ph, 600).catch(() => null); if (!u || !el.isConnected) return;
      el.innerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Agrandir la photo"><img src="${esc(u)}" alt="Photo de la marchandise refusée" style="width:100%;height:100%;object-fit:cover;display:block"></a>`;
    });
    box.querySelectorAll('[data-gps]').forEach(b => b.onclick = () => partager(b.dataset.gps));
    box.querySelectorAll('[data-gps-stop]').forEach(b => b.onclick = () => { arreterPartage('Partage arrêté.'); peindre(); });
  }
  async function repondre(id, oui, b) {
    if (!oui && !confirm('Refuser cette mission ? L’acheteur et le vendeur seront prévenus.')) return;
    b.disabled = true;
    try { await N().rpc('chauffeur_repondre', { p_mission: id, p_oui: oui }); toast(oui ? 'Mission acceptée' : 'Mission refusée', { type: oui ? 'ok' : 'info', sous: oui ? 'L’acheteur et le vendeur sont prévenus.' : '' }); await lire(); peindre(); }
    catch (x) { b.disabled = false; toast(erreurTxt(x), { type: 'erreur' }); }
  }
  // ——— partager sa position pendant le transport ———
  // Seulement application ouverte (une page web ne peut pas envoyer sa position écran éteint) : l'écran reste allumé
  // si le téléphone le permet (Wake Lock). Une position toutes les 30 s, ou plus tôt après 150 m (jamais moins de 15 s).
  // Le serveur arrête de lui-même quand la marchandise n'est plus en route. Une pastille rappelle que le partage est actif.
  let partage = null;
  const dist = (a, b) => { const r = Math.PI / 180, x = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(x)); };
  async function eveil() { if (!partage || !('wakeLock' in navigator) || document.hidden) return; try { partage.wake = await navigator.wakeLock.request('screen'); } catch (_) { partage.wake = null; } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { eveil(); pastille(); } });
  function pastille() {
    let el = document.getElementById('chPast');
    if (!partage) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'chPast'; el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:2147482000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 32px);padding:8px 8px 8px 14px;border-radius:24px;background:#10392B;color:#F3EFE4;font:500 13.5px Jost,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3)';
      document.body.appendChild(el);
    }
    const age = partage.envoye ? Math.round((Date.now() - partage.envoye) / 1000) : null;
    el.innerHTML = `<span aria-hidden="true" style="width:10px;height:10px;border-radius:50%;background:${partage.erreur ? '#E5604F' : '#6CC58C'};flex:none"></span>
      <span>${partage.erreur ? esc(partage.erreur) : age == null ? 'Partage de position : recherche du GPS…' : 'Position partagée · envoyée il y a ' + (age < 60 ? age + ' s' : Math.round(age / 60) + ' min')}</span>
      <button type="button" style="min-height:36px;padding:0 12px;border:0;border-radius:18px;background:#F3EFE4;color:#10392B;font:600 13px Jost,sans-serif;cursor:pointer">Arrêter</button>`;
    el.querySelector('button').onclick = () => { arreterPartage('Partage arrêté.'); if (bg) peindre(); };
  }
  function arreterPartage(msg) {
    if (!partage) return;
    try { navigator.geolocation.clearWatch(partage.watch); } catch (_) {}
    try { partage.wake && partage.wake.release(); } catch (_) {}
    clearInterval(partage.tic); partage = null; pastille();
    if (msg) toast(msg, { type: 'info' });
  }
  function partager(cmd) {
    if (!navigator.geolocation) return toast('Ce téléphone ne donne pas sa position : le suivi se fera par étapes.', { type: 'alerte' });
    arreterPartage();
    partage = { cmd, watch: null, wake: null, envoye: 0, der: null, enCours: false, erreur: '', tic: setInterval(pastille, 5000) };
    partage.watch = navigator.geolocation.watchPosition(async p => {
      const k = partage; if (!k || k.enCours) return;
      const ici = [p.coords.latitude, p.coords.longitude], t = Date.now();
      if (k.envoye && t - k.envoye < 15000) return;
      if (k.envoye && t - k.envoye < 30000 && k.der && dist(k.der, ici) < 150) return;
      k.enCours = true;
      try {
        const r = await N().rpc('chauffeur_position', { p_cmd: cmd, p_lat: ici[0], p_lon: ici[1], p_precision: p.coords.accuracy ? Math.round(p.coords.accuracy) : null });
        if (r && r.arreter) { arreterPartage(r.message || 'Partage arrêté.'); if (bg) { await lire(); peindre(); } return; }
        if (r && r.ok) { k.envoye = t; k.der = ici; k.erreur = ''; }
      } catch (e) { k.erreur = navigator.onLine === false ? 'Pas de réseau : la position partira au retour du réseau' : 'Envoi impossible, nouvel essai bientôt'; }
      k.enCours = false; pastille();
    }, e => {
      if (e.code === 1) { arreterPartage(); toast('Position refusée', { type: 'alerte', sous: 'Le suivi se fera par étapes. Vous pouvez l’autoriser dans les réglages du téléphone.' }); if (bg) peindre(); }
      else if (partage) { partage.erreur = 'GPS indisponible pour l’instant'; pastille(); }
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    eveil(); pastille();
    toast('Partage de position activé', { type: 'ok', sous: 'Gardez l’application ouverte et l’écran allumé : téléphone verrouillé, la position ne part plus. La batterie se vide plus vite.' });
    if (bg) peindre();
  }

  // ——— taper un code (prise en charge, réception, transfert) : le serveur dit s'il est bon et combien d'essais restent ———
  function taper(cmd, quoi) {
    const box = bg.querySelector('.cm');
    const T = { prise: ['Code de <em>prise en charge</em>', 'Le vendeur vous le donne quand la marchandise est dans votre véhicule.'],
      reception: ['Code de <em>réception</em>', 'L’acheteur vous le donne après avoir vérifié la marchandise.'],
      transfert: ['Code de <em>transfert</em>', 'Le chauffeur qui vous passe la marchandise vous le donne.'] }[quoi];
    box.scrollTop = 0;
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${T[0]}</h2><p class="cm-sous">${T[1]}</p>
      <form class="cm-f" novalidate>
        <label class="t" for="chK">Les 6 chiffres</label>
        <input type="text" id="chK" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" style="font:800 30px/1 Jost,sans-serif;letter-spacing:.2em;text-align:center;min-height:64px">
        <label class="cm-ck"><input type="checkbox" id="chG" checked> Joindre ma position actuelle (une seule fois)</label>
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Valider</button><button type="button" data-ann>Retour</button></div>
        <p class="cm-note">5 essais au plus : ensuite le code est bloqué et il faut en demander un nouveau.</p>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err'), inp = f.querySelector('#chK');
    if (matchMedia('(hover:hover)').matches) inp.focus();
    f.onsubmit = async e => {
      e.preventDefault();
      const code = inp.value.replace(/\D/g, '');
      if (code.length !== 6) { err.textContent = 'Le code fait 6 chiffres.'; inp.focus(); return; }
      const b = f.querySelector('[type=submit]'); b.disabled = true; err.textContent = '';
      const pos = f.querySelector('#chG').checked && navigator.geolocation ? await new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { timeout: 8000, maximumAge: 60000 })) : null;
      try {
        const r = await N().rpc('commande_valider_code', { p_cmd: cmd, p_code: code, p_lat: pos ? pos[0] : null, p_lon: pos ? pos[1] : null });
        if (!r || !r.ok) { err.textContent = (r && r.message) || 'Code refusé.'; b.disabled = false; inp.select(); if (navigator.vibrate) try { navigator.vibrate([30, 60, 30]); } catch (_) {} return; }
        toast(r.etape === 'terminee' ? 'Livraison terminée' : r.etape === 'transbordement' ? 'Vous avez pris la marchandise' : 'Chargement confirmé', { type: 'ok', sous: r.etape === 'terminee' ? 'Merci ! L’acheteur et le vendeur sont prévenus.' : 'L’acheteur et le vendeur sont prévenus.' });
        if (window.MDGSons && MDGSons.signal) try { MDGSons.signal('accord'); } catch (_) {}
        await lire(); peindre();
      } catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
  }

  // ——— passer la marchandise à un autre chauffeur : son code transporteur, le lieu, puis le code à lui donner ———
  function passer(cmd) {
    const box = bg.querySelector('.cm');
    box.scrollTop = 0;
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Passer la <em>marchandise</em></h2><p class="cm-sous">Le nouveau chauffeur doit avoir l’application. Il prendra la mission quand il aura tapé le code que vous allez lui donner.</p>
      <form class="cm-f" novalidate>
        <label class="t" for="chT">Code transporteur du nouveau chauffeur</label>
        <input type="text" id="chT" maxlength="8" placeholder="T-4K7P" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase">
        <label class="t" for="chL">Lieu du transfert</label>
        <input type="text" id="chL" maxlength="120" autocomplete="off">
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Obtenir le code de transfert</button><button type="button" data-ann>Retour</button></div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err');
    f.onsubmit = async e => {
      e.preventDefault();
      const t = f.querySelector('#chT').value.trim(), lieu = f.querySelector('#chL').value.trim();
      if (!/^t-?[a-z0-9]{4}$/i.test(t.replace(/\s/g, ''))) { err.textContent = 'Le code transporteur ressemble à T-4K7P.'; return; }
      if (!lieu) { err.textContent = 'Indiquez le lieu.'; return; }
      if (N().texteRefus) { const rr = N().texteRefus(lieu); if (rr) { err.textContent = rr; return; } }
      const b = f.querySelector('[type=submit]'); b.disabled = true; err.textContent = '';
      try {
        const r = await N().rpc('commande_transfert_preparer', { p_cmd: cmd, p_code_transporteur: t, p_lieu: lieu });
        box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
          <h2>Code de <em>transfert</em></h2><p class="cm-sous">À donner à ${esc(r.nom)}, de vive voix, quand la marchandise est dans son véhicule.</p>
          <div class="cm-st" style="text-align:center"><b style="font:800 44px/1 Jost,sans-serif;letter-spacing:.18em;color:#10392B">${esc(r.code.slice(0, 3))} ${esc(r.code.slice(3))}</b>
            <small>Valable jusqu’à ${new Date(r.expire_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Un seul usage. Ne l’envoyez pas par message.</small></div>
          <div class="cm-act"><button type="button" class="p" data-ann>J’ai donné le code</button></div>
          <p class="cm-note">Tant qu’il ne l’a pas tapé, la mission reste la vôtre.</p>`;
        box.querySelector('[data-x]').onclick = fermer;
        box.querySelector('[data-ann]').onclick = async () => { await lire(); peindre(); };
      } catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
  }

  function etape(cmd, quoi) {
    const box = bg.querySelector('.cm'), trb = quoi === 'transbordement';
    box.scrollTop = 0;
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${trb ? 'Signaler un <em>transbordement</em>' : 'Je suis <em>arrivé</em>'}</h2>
      <form class="cm-f" novalidate>
        ${trb ? '<label class="t" for="chL">Où la marchandise change-t-elle de véhicule ?</label><input type="text" id="chL" maxlength="120" autocomplete="off">' : ''}
        <label class="cm-ck"><input type="checkbox" id="chG"${trb ? '' : ' checked'}> Joindre ma position actuelle (une seule fois)</label>
        <p class="cm-note" style="font-size:13.5px">${trb ? 'L’acheteur et le vendeur verront le lieu et l’heure.' : 'L’acheteur est prévenu. Il vérifie la marchandise, puis confirme la réception.'}</p>
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">${trb ? 'Signaler' : 'Confirmer mon arrivée'}</button><button type="button" data-ann>Retour</button></div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err');
    f.onsubmit = async e => {
      e.preventDefault();
      const L = f.querySelector('#chL'), lieu = L ? L.value.trim() : null;
      if (trb && !lieu) { err.textContent = 'Indiquez le lieu.'; L.focus(); return; }
      if (lieu && N().texteRefus) { const r = N().texteRefus(lieu); if (r) { err.textContent = r; return; } }
      const b = f.querySelector('[type=submit]'); b.disabled = true; err.textContent = '';
      const pos = f.querySelector('#chG').checked && navigator.geolocation ? await new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { timeout: 8000, maximumAge: 60000 })) : null;
      try {
        await N().rpc('commande_avancer', { p_id: cmd, p_etape: quoi, p_lieu: lieu, p_lat: pos ? pos[0] : null, p_lon: pos ? pos[1] : null, p_note: null });
        toast(trb ? 'Transbordement signalé' : 'Arrivée signalée', { type: 'ok', sous: pos ? 'Position jointe.' : 'Sans position.' });
        await lire(); peindre();
      } catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
  }

  let retourFocus = null;
  function peindre() { if (!bg) return; const box = bg.querySelector('.cm'); if (vue === 'profil') formulaire(); else { const y = box.scrollTop; accueil(); box.scrollTop = y; } }
  function focusTitre() { const h = bg && bg.querySelector('.cm h2'); if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} } }
  async function ouvrir(tap, quoi) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    if (window.MDGCommandes && MDGCommandes.css) MDGCommandes.css();
    fermer(); retourFocus = document.activeElement;
    bg = document.createElement('div'); bg.className = 'cm-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Espace chauffeur');
    bg.innerHTML = `<div class="cm">${window.MDGSac ? MDGSac.charge('Un instant…') : ''}</div>`; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    vue = 'accueil';
    await lire(); peindre(); focusTitre();
    if (tap && quoi && missions.some(m => m.commande_id === tap)) taper(tap, quoi);   // depuis Accueil → Alertes → Mes codes
    minuteur = setInterval(async () => { if (!bg || document.hidden || vue !== 'accueil') return; await lire(); peindre(); }, 30000);
  }

  // notification touchée : #/?chauffeur=1, ou message du service worker si l'application est déjà ouverte
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-chauffeur') ouvrir(); });
  (function depuisAdresse() {
    if (!/[?&]chauffeur=1/.test(location.hash)) return;
    try { history.replaceState(history.state, '', location.hash.replace(/[?&]chauffeur=1/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) ouvrir(); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  })();

  // Accueil → Alertes → « Mes codes » (transporteur inscrit) : les codes à demander et à taper MAINTENANT.
  // Le chauffeur ne détient pas de code : il tape celui du vendeur au chargement, puis celui de l'acheteur à la réception.
  function codes() {
    const c = J(K(), {}); if (!c.inscrit) return [];
    return (c.missions || []).filter(m => m.mission === 'acceptee' && m.etat === 'en_cours' && m.validation === 'code').map(m => {
      const pec = ['confirmee', 'preparation'].includes(m.etape), rec = ['transport', 'transbordement', 'arrivee'].includes(m.etape);
      if (!pec && !rec) return null;
      return { id: m.commande_id, quoi: pec ? 'prise' : 'reception', titre: (m.produit || 'Marchandise') + (m.quantite != null ? ' · ' + nf(m.quantite, 2) + ' ' + unites(m.quantite, m.unite) : ''),
        genre: pec ? 'Code de prise en charge à taper' : 'Code de réception à taper',
        quand: pec ? 'Demandez-le au vendeur quand la marchandise est chargée, puis tapez-le' : 'Demandez-le à l’acheteur après sa vérification, puis tapez-le',
        urgent: m.etape === 'arrivee', ouvrir: () => ouvrir(m.commande_id, pec ? 'prise' : 'reception') };
    }).filter(Boolean);
  }
  // relu au démarrage et au retour sur l'application (une fois par minute au plus), seulement pour un transporteur inscrit
  let fondT = 0;
  async function fond() {
    if (bg || document.hidden || !N() || !N().session() || !J(K(), {}).inscrit || navigator.onLine === false || Date.now() - fondT < 60000) return;
    fondT = Date.now();
    try { moi = await N().rpc('transporteur_moi'); missions = moi ? ((await N().rpc('chauffeur_missions')) || []) : []; memoriser(); dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {}
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fond(); });
  setTimeout(fond, 2000);

  window.MDGChauffeur = { ouvrir, codes, etat: () => { const c = J(K(), {}); return { inscrit: !!c.inscrit, statut: c.statut || null, propositions: c.propositions || 0 }; } };
})();
