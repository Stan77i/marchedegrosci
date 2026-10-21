/* ═════════ Marché de Gros CI — Espace chauffeur ═════════
   Pour les transporteurs : s'inscrire (gratuit), suivre la vérification par l'équipe, se dire disponible,
   donner son code (T-4K7P) à l'acheteur ou au vendeur qui le choisit, accepter ou refuser une mission,
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
  const erreurTxt = e => { const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : m || 'Réessayez dans un instant.'; };
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
  function fermer() { if (!bg) return; bg.remove(); bg = null; clearInterval(minuteur); minuteur = null; document.removeEventListener('keydown', clavier); }
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
    if (m.mission === 'proposee') B.push(`<button type="button" class="p" data-acc="${m.mission_id}">Accepter la mission</button>`, `<button type="button" data-ref="${m.mission_id}">Refuser</button>`);
    const K = m.validation === 'code', go = m.mission === 'acceptee' && m.etat === 'en_cours';
    if (go && K && ['confirmee', 'preparation'].includes(m.etape)) B.push(`<button type="button" class="p" data-tap="${m.commande_id}" data-quoi="prise">Taper le code de prise en charge</button>`);
    if (go && ['transport', 'transbordement'].includes(m.etape))
      B.push(`<button type="button" class="${K ? '' : 'p'}" data-arr="${m.commande_id}">Je suis arrivé</button>`);
    if (go && K && ['transport', 'transbordement', 'arrivee'].includes(m.etape)) B.push(`<button type="button" class="p" data-tap="${m.commande_id}" data-quoi="reception">Taper le code de réception</button>`);
    if (go && ['transport', 'transbordement'].includes(m.etape))
      B.push(K ? `<button type="button" class="m" data-pas="${m.commande_id}">Passer la marchandise à un autre chauffeur</button>` : `<button type="button" class="m" data-trb="${m.commande_id}">Signaler un transbordement</button>`);
    const st = m.mission === 'proposee' ? ['Nouvelle mission', 'mais'] : m.mission === 'refusee' ? ['Refusée', 'rouge'] : m.etat === 'annulee' ? ['Commande annulée', 'rouge'] : m.etat === 'litige' ? ['Litige en cours', 'rouge'] : [ETAPE[m.etape] || 'Acceptée', ''];
    return `<div class="cm-r" style="cursor:default;grid-template-columns:1fr"><span>
      <b>${esc(m.produit || 'Marchandise')}${q}</b>
      <small>${esc(m.ville_depart || 'Départ à préciser')} → ${esc(m.lieu_livraison || 'livraison à préciser')}</small>
      <small>Vendeur : ${esc(m.vendeur)} · Acheteur : ${esc(m.acheteur)}</small>
      <small style="margin-top:6px"><span class="cm-tag ${st[1]}">${esc(st[0])}</span> ${m.propose_role === 'admin' ? '· confiée par l’équipe' : m.propose_role === 'acheteur' ? '· choisi par l’acheteur' : m.propose_role === 'vendeur' ? '· choisi par le vendeur' : ''}</small>
      ${B.length ? `<div class="cm-act" style="margin:10px 0 0">${B.join('')}</div>` : ''}</span></div>`;
  }
  function accueil() {
    const box = bg.querySelector('.cm');
    if (!moi) return formulaire();
    const [st, sous, cls] = STATUT[moi.statut] || ['', '', ''];
    const prop = missions.filter(m => m.mission === 'proposee'), act = missions.filter(m => m.mission === 'acceptee'), autres = missions.filter(m => m.mission === 'refusee');
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Espace <em>chauffeur</em></h2>
      <p class="cm-sous">${esc(moi.nom)} · ${esc(VLIB[moi.vehicule] || '')}${moi.immatriculation ? ' · ' + esc(moi.immatriculation) : ''}</p>
      <div class="cm-st" role="status"><b>Votre code : <em style="letter-spacing:.06em">${esc(moi.code)}</em></b><small>Donnez-le à l’acheteur ou au vendeur qui vous choisit : il le tape dans sa commande, et la mission arrive ici.</small></div>
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
    box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => repondre(b.dataset.acc, true, b));
    box.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => repondre(b.dataset.ref, false, b));
    box.querySelectorAll('[data-arr]').forEach(b => b.onclick = () => etape(b.dataset.arr, 'arrivee'));
    box.querySelectorAll('[data-trb]').forEach(b => b.onclick = () => etape(b.dataset.trb, 'transbordement'));
    box.querySelectorAll('[data-tap]').forEach(b => b.onclick = () => taper(b.dataset.tap, b.dataset.quoi));
    box.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => passer(b.dataset.pas));
  }
  async function repondre(id, oui, b) {
    if (!oui && !confirm('Refuser cette mission ? L’acheteur et le vendeur seront prévenus.')) return;
    b.disabled = true;
    try { await N().rpc('chauffeur_repondre', { p_mission: id, p_oui: oui }); toast(oui ? 'Mission acceptée' : 'Mission refusée', { type: oui ? 'ok' : 'info', sous: oui ? 'L’acheteur et le vendeur sont prévenus.' : '' }); await lire(); peindre(); }
    catch (x) { b.disabled = false; toast(erreurTxt(x), { type: 'erreur' }); }
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
        <input type="text" id="chK" inputmode="numeric" autocomplete="one-time-code" maxlength="7" pattern="[0-9 ]*" style="font:800 30px/1 'Archivo',sans-serif;letter-spacing:.2em;text-align:center;min-height:64px">
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
          <div class="cm-st" style="text-align:center"><b style="font:800 44px/1 'Archivo',sans-serif;letter-spacing:.18em;color:#F2C230">${esc(r.code.slice(0, 3))} ${esc(r.code.slice(3))}</b>
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

  function peindre() { if (!bg) return; const box = bg.querySelector('.cm'); if (vue === 'profil') formulaire(); else { const y = box.scrollTop; accueil(); box.scrollTop = y; } }
  async function ouvrir() {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    if (window.MDGCommandes && MDGCommandes.css) MDGCommandes.css();
    fermer();
    bg = document.createElement('div'); bg.className = 'cm-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Espace chauffeur');
    bg.innerHTML = `<div class="cm">${window.MDGSac ? MDGSac.charge('Un instant…') : ''}</div>`; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    vue = 'accueil';
    await lire(); peindre();
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

  window.MDGChauffeur = { ouvrir, etat: () => { const c = J(K(), {}); return { inscrit: !!c.inscrit, statut: c.statut || null, propositions: c.propositions || 0 }; } };
})();
