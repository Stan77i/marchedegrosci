/* ═════════ Marché de Gros CI — Négoce : proposer, contre-proposer, conclure ═════════
   Le site et l'application utilisent ce même module (au-dessus de v3/nuage.js ; sons : v3/sons.js).
   Une négociation porte sur une annonce partagée (offre ou demande) entre la personne qui l'a publiée et une autre.
   • Une proposition = prix + quantité + transport (inclus, à part avec son prix, ou sans) + conditions, envoyés en un seul appel
     (nego_ouvrir2, nego_agir2, schéma 83). Elle attend une réponse 48 h, puis expire.
   • L'autre partie l'accepte (après un résumé), la refuse ou fait une contre-proposition ; l'auteur peut la retirer.
   • L'accord fige les conditions (prix, quantité, conditions, date). Ce n'est ni un paiement ni une livraison.
   • Toutes les règles sont vérifiées par la base (nego_ouvrir, nego_agir) : rien n'est simulé ici.
   • La règle des prix : cercle vert = vendeur, carré jaune = acheteur (le langage de la carte) ; à l'accord, ligne bleue.
   Notions distinctes, jamais confondues : prix affiché (l'annonce), prix proposé (en attente), prix convenu (l'accord).
   API : MDGNegoce.proposer(annonce) · inbox() · thread(id) · unread() · refresh() · masquer(id) · glisser(ligne, supprimer)
   Un bouton peut porter data-negocier='{"cible":"offre","id":"…","produit":"…","prix":12000,"unite":"kg","quantite":20,"negociable":true}'.
   Événement : « mdg:negoce » (detail.unread). */
(function () {
  'use strict';
  const N = () => window.MDGNuage;
  const TI = n => window.MDGIco ? '<span class="ic-t" aria-hidden="true">' + MDGIco.svg(n, 17, 1.9) + '</span>' : '';   // petite icône dessinée devant un texte (plus d'emoji)
  const KL = 'mdg-negoce:liste', KX = 'mdg-negoce:expire-vues';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null || n === '' || isNaN(n) ? '—' : Math.round(+n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const fq = n => n == null || isNaN(n) ? '' : (+n % 1 ? (+n).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : fmt(n));
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const ago = t => { const m = Math.max(0, (Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + Math.round(m) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : m < 2880 ? 'hier' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const reste = t => { const m = (Date.parse(t) - Date.now()) / 60000; return m <= 0 ? 'expirée' : m < 60 ? 'expire dans ' + Math.max(1, Math.round(m)) + ' min' : 'expire dans ' + Math.round(m / 60) + ' h'; };
  const jour = t => new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const pas = p => p >= 10000 ? 100 : p >= 1000 ? 50 : p >= 100 ? 5 : 1;
  const arrondi = p => { const s = pas(p); return Math.max(s, Math.round(p / s) * s); };
  const num = v => +String(v || '').replace(/\s/g, '').replace(',', '.') || 0;
  // schéma 99d : unités qui se comptent (quantité entière) et plafond d'une commande (reglages.commandes.montant_max, 1 milliard)
  const ENTIERES = ['sac', 'carton', 'régime', 'cageot', 'unité', 'tas', 'pièce', 'alvéole', 'caisse', 'cagette', 'botte'], MONTANT_MAX = 1e9;

  // rôles : sur une offre, celui qui l'a publiée vend ; sur une demande, il achète
  const roles = n => { const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur'; return { [n.proprio_id]: owner, [n.auteur_id]: owner === 'vendeur' ? 'acheteur' : 'vendeur' }; };
  const monRole = n => roles(n)[me()];
  const autre = r => r === 'vendeur' ? 'acheteur' : 'vendeur';
  const uQ = (q, u) => window.MDGApp && MDGApp.unites ? MDGApp.unites(q, u) : u;   // « 20 cartons », mais « F / carton »
  const leLa = r => r === 'vendeur' ? 'le vendeur' : 'l’acheteur';
  const Le = r => r === 'vendeur' ? 'Le vendeur' : 'L’acheteur';
  const nonLu = n => { const u = me(); if (!u) return false; const lu = u === n.auteur_id ? n.lu_auteur : n.lu_proprio; return Date.parse(n.updated_at) > Date.parse(lu) + 500; };
  // proposition en cours : en attente et pas encore expirée (l'expiration est aussi appliquée par la base)
  const enCours = n => n.statut === 'ouverte' && n.dernier_msg && n.dernier_par && n.expire_le && Date.parse(n.expire_le) > Date.now();
  const expiree = n => n.statut === 'ouverte' && n.dernier_msg && n.dernier_par && n.expire_le && Date.parse(n.expire_le) <= Date.now();
  const aMoi = n => enCours(n) && n.dernier_par !== me();
  function etat(n) {
    if (n.statut === 'conclue') return { t: 'Accord conclu', c: 'ok' };
    if (n.statut === 'close') return { t: n.motif_fin === 'annonce_retiree' ? 'Annonce retirée' : 'Négociation arrêtée', c: '' };
    if (enCours(n)) return n.dernier_par === me() ? { t: 'En attente de réponse', c: 'wait' } : { t: n.dernier_par === n.proprio_id ? 'Contre-proposition reçue' : 'Proposition reçue', c: 'acc' };
    if (expiree(n)) return { t: n.dernier_par === me() ? 'Votre proposition a expiré' : 'Proposition expirée', c: '' };
    return { t: 'Pas de proposition en cours', c: '' };
  }

  /* ——— données ——— */
  let liste = J(KL, []), lastUnread = -1;
  const unread = () => liste.filter(nonLu).length;
  function announce() {
    const u = unread();
    if (u !== lastUnread) { lastUnread = u; dispatchEvent(new CustomEvent('mdg:negoce', { detail: { unread: u } })); }
  }
  // ce qui a changé depuis la dernière lecture → message à l'écran + son (regroupés par v3/sons.js)
  function evenements(avant, apres) {
    const A = Object.fromEntries(avant.map(n => [n.id, n])), u = me(), ev = [];
    apres.forEach(n => {
      const o = A[n.id]; if (!nonLu(n)) return;
      if (!o) { if (n.proprio_id === u) ev.push(['proposition', 'Nouvelle proposition sur « ' + (n.produit || 'votre annonce') + ' ».', n.id]); return; }
      if (n.updated_at === o.updated_at) return;
      if (n.statut === 'conclue' && o.statut !== 'conclue') ev.push(['accord', 'Accord conclu : ' + (n.produit || 'annonce') + ' à ' + fmt(n.prix_final) + ' F.', n.id]);
      else if (n.dernier_msg && n.dernier_msg !== o.dernier_msg && n.dernier_par !== u) ev.push(['proposition', (o.dernier_msg ? 'Contre-proposition' : 'Nouvelle proposition') + ' : ' + fmt(n.dernier_prix) + ' F pour « ' + (n.produit || 'annonce') + ' ».', n.id]);
      else if (o.dernier_par === u && !n.dernier_par && n.statut === 'ouverte') ev.push(['refus', 'Votre proposition pour « ' + (n.produit || 'annonce') + ' » a été refusée.', n.id]);
      else if (o.dernier_par && o.dernier_par !== u && !n.dernier_par && n.statut === 'ouverte') ev.push(['refus', 'Une proposition sur « ' + (n.produit || 'annonce') + ' » a été retirée.', n.id]);
      else if (n.statut === 'close' && o.statut === 'ouverte') ev.push(['refus', n.motif_fin === 'annonce_retiree' ? 'L’annonce « ' + (n.produit || '') + ' » a été retirée : la négociation est fermée.' : 'Une négociation a été arrêtée.', n.id]);
    });
    const vues = new Set(J(KX, []));
    apres.forEach(n => { if (expiree(n) && n.dernier_par === u && !vues.has(n.dernier_msg)) { vues.add(n.dernier_msg); ev.push(['refus', 'Votre proposition pour « ' + (n.produit || 'annonce') + ' » a expiré sans réponse.', n.id]); } });
    W(KX, [...vues].slice(-200));
    if (!ev.length) return;
    // journal des notifications (Mon espace → Notifications) : uniquement des événements réels
    const log = J('mdg-notifs', []); ev.forEach(([c, t, id]) => log.unshift({ t: new Date().toISOString(), cat: c, texte: t, nego: id || null, lu: false })); W('mdg-notifs', log.slice(0, 100));
    dispatchEvent(new CustomEvent('mdg:notifs'));
    ev.forEach(([c]) => window.MDGSons && MDGSons.signal(c));
    const pf = window.MDGCompte ? MDGCompte.prefs() : { toasts: true };
    if (!bg && pf.toasts) {
      const ok = ev.some(([c]) => /accord|accept/.test(c)), ko = ev.every(([c]) => c === 'refus');
      N().toast(ev.length > 1 ? ev.length + ' nouveautés dans vos négociations' : ev[0][1], { type: ok ? 'ok' : ko ? 'alerte' : 'info', groupe: 'nego', muet: true,
        pluriel: () => 'nouveautés dans vos négociations', action: ev.length > 1 ? { t: 'Ouvrir', fn: () => inbox() } : { t: 'Voir', fn: () => thread(ev[0][2]) } });
    }
  }
  // masquée pour moi (nego_masquer) : tant que l'autre n'a rien écrit depuis
  const masquee = n => { const c = me() === n.auteur_id ? n.cache_auteur : n.cache_proprio; return !!c && Date.parse(c) >= Date.parse(n.updated_at); };
  async function masquer(id) {
    await N().rpc('nego_masquer', { p_nego: id });
    liste = liste.filter(n => n.id !== id); W(KL, liste); announce();
    N().toast('Négociation retirée de votre liste. Elle reviendra si l’autre personne vous écrit.');
  }
  /* glisser vers la gauche pour supprimer (comme les messages d'un téléphone) : un bouton rouge apparaît ; glisser jusqu'au bout supprime directement */
  const SWCSS = `.sw{position:relative;overflow:hidden;border-radius:18px}.sw.is-act{background:linear-gradient(90deg,#5a2318,#c2452f)}.sw:not(.is-act)>.sw-del{visibility:hidden}.sw+.sw{margin-top:8px}
.sw>.sw-del{position:absolute;top:0;right:0;bottom:0;width:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;border:0;background:none;color:#fff;font:600 14px Jost,system-ui,sans-serif;cursor:pointer}
.sw>.sw-del svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.sw>.sw-row{position:relative;z-index:1;margin:0!important;background-color:#FFFDF8!important;transition:transform .34s cubic-bezier(.22,1,.36,1);touch-action:pan-y;will-change:transform}
.sw.is-drag>.sw-row{transition:none}.sw.is-out{animation:swOut .34s cubic-bezier(.4,0,1,1) forwards}
@keyframes swOut{to{height:0;opacity:0;margin-top:0}}
@media (prefers-reduced-motion:reduce){.sw>.sw-row{transition:none}.sw.is-out{animation-duration:.01s}}`;
  function glisser(row, suppr) {
    if (!row || row.closest('.sw')) return;
    if (!document.getElementById('swCss')) { const st = document.createElement('style'); st.id = 'swCss'; st.textContent = SWCSS; document.head.appendChild(st); }
    const w = document.createElement('div'); w.className = 'sw'; row.parentNode.insertBefore(w, row);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'sw-del'; del.tabIndex = -1;
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>Supprimer';
    w.append(del, row); row.classList.add('sw-row');
    const L = 96; let x0 = null, y0 = 0, dx = 0, ouvert = false, drag = false;
    const pose = v => { row.style.transform = v ? 'translateX(' + v + 'px)' : ''; if (v) w.classList.add('is-act'); else setTimeout(() => { if (!row.style.transform) w.classList.remove('is-act'); }, 360); };  // le rouge n'apparaît que pendant le geste (sinon il déborde aux coins arrondis)
    const go = async () => { pose(-row.offsetWidth); w.style.height = w.offsetHeight + 'px'; requestAnimationFrame(() => w.classList.add('is-out'));
      try { await suppr(); } catch (_) { w.classList.remove('is-out'); w.style.height = ''; pose(0); ouvert = false; N().toast('La suppression n’a pas abouti. Réessayez.'); } };
    row.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; drag = false; });
    row.addEventListener('pointermove', e => { if (x0 == null) return; const m = e.clientX - x0;
      if (!drag && Math.abs(m) > 10 && Math.abs(m) > Math.abs(e.clientY - y0) * 1.2) { drag = true; w.classList.add('is-drag'); try { row.setPointerCapture(e.pointerId); } catch (_) {} }
      if (drag) { dx = Math.min(0, m + (ouvert ? -L : 0)); pose(dx < -L ? -L + (dx + L) * .85 : dx); } });
    const fin = () => { if (x0 == null) return; x0 = null; w.classList.remove('is-drag'); if (!drag) return;
      if (dx < -row.offsetWidth * .55) go(); else if (dx < -L / 2) { ouvert = true; pose(-L); } else { ouvert = false; pose(0); } setTimeout(() => { drag = false; }, 0); };
    row.addEventListener('pointerup', fin); row.addEventListener('pointercancel', fin);
    row.addEventListener('click', e => { if (drag || ouvert) { e.stopImmediatePropagation(); e.preventDefault(); if (ouvert && !drag) { ouvert = false; pose(0); } } }, true);
    del.onclick = go;
  }

  let first = true;
  async function refresh() {
    if (!N() || !N().session() || !navigator.onLine) { announce(); return liste; }
    try {
      const u = me(), r = await N().api('/rest/v1/negociations?select=*&or=(auteur_id.eq.' + u + ',proprio_id.eq.' + u + ')&order=updated_at.desc&limit=100', { auth: true });
      const avant = liste; liste = (r || []).filter(n => !masquee(n)); W(KL, liste);
      if (!first || avant.length) evenements(avant, liste); first = false;
    } catch (e) { if (e.code === 'auth') { liste = []; W(KL, []); } }
    announce(); try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} return liste;
  }
  const messages = id => N().api('/rest/v1/messages?select=*&negociation_id=eq.' + id + '&order=created_at.asc&limit=300', { auth: true });
  const one = async id => { const r = await N().api('/rest/v1/negociations?select=*&id=eq.' + id, { auth: true }); return r && r[0]; };
  const err = x => x.message === 'Failed to fetch' ? 'Le serveur ne répond pas. Réessayez dans un instant.' : /nego_|schema cache|Could not find/i.test(x.message) ? 'La négociation n’est pas encore activée sur le serveur.' : (window.MDGErreur ? MDGErreur(x) : x.message);

  /* ——— apparence ——— */
  const CSS = `.nx-bg{position:fixed;inset:0;z-index:8900;background:rgba(10,9,7,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:nxIn .22s ease both}
@media (min-width:720px){.nx-bg{align-items:center;padding:24px}}
.nx{--v:#6CC58C;--a:#F2C94C;--ok:#1F8A55;--ink:#171512;--mute:#655C4D;--line:rgba(23,21,18,.12);--acc:#10392B;position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:min(92dvh,820px);background:#F4EEE3;color:var(--ink);border-radius:28px 28px 0 0;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:Jost,system-ui,sans-serif;font-variant-numeric:lining-nums;animation:nxUp .38s cubic-bezier(.22,1,.36,1) both;overflow:hidden}
@media (min-width:720px){.nx{border-radius:28px}}
.nx-h{display:flex;align-items:center;gap:10px;padding:18px 18px 12px;border-bottom:1px solid var(--line)}
.nx-h h2{flex:1;min-width:0;margin:0;font:600 21px/1.1 Jost,sans-serif;letter-spacing:-.015em}.nx-h h2 em{font:900 italic 1em Jost,sans-serif;color:#10392B;letter-spacing:-.02em;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.nx-h h2 small{display:block;margin-top:3px;font:400 13.5px/1.35 Jost,sans-serif;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nx-ib{flex:none;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:var(--ink);font-size:20px;line-height:1;cursor:pointer}.nx-back svg{display:block}
.nx-ib:focus-visible,.nx button:focus-visible,.nx input:focus-visible,.nx textarea:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.nx-b{flex:1;overflow-x:hidden;overflow-y:auto;padding:16px 18px 20px;overscroll-behavior:contain}
.nx-f{padding:12px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#EFE7D9}
.nx-go{width:100%;min-height:54px;border:0;border-radius:999px;background:var(--acc);color:#F3EFE4;font:700 16px Jost,sans-serif;cursor:pointer}.nx-go[disabled]{background:#DDE6DE;color:#5C6B61;opacity:1;cursor:default}
.nx-alt{min-height:48px;padding:0 18px;border:0;border-radius:999px;background:#EFE7D9;color:var(--ink);font:600 15px Jost,sans-serif;cursor:pointer}
.nx-err{min-height:18px;margin:8px 0 0;color:#8E2A1C;font-size:14px}
.nx-note{margin:14px 0 0;color:#6F6553;font-size:12.5px;line-height:1.5}
/* la règle des prix */
.nx-rail{position:relative;margin:4px 0 6px;padding:46px 6px 34px}
.nx-rail .tr{position:relative;height:2px;background:repeating-linear-gradient(90deg,rgba(23,21,18,.28) 0 2px,transparent 2px 9px)}
.nx-rail .gap{position:absolute;top:-5px;height:12px;border-radius:6px;background:rgba(23,21,18,.10);transition:left .5s cubic-bezier(.22,1,.36,1),width .5s cubic-bezier(.22,1,.36,1)}
.nx-rail .gap.is-ok{top:-1px;height:4px;border-radius:2px;background:var(--ok)}
.nx-rail .pin{position:absolute;top:0;transform:translate(-50%,-50%);transition:left .5s cubic-bezier(.22,1,.36,1)}
.nx-rail .pin i{display:block;width:16px;height:16px}
.nx-rail .pin.v i{border-radius:50%;background:var(--v)}.nx-rail .pin.a i{border-radius:3px;background:var(--a);width:15px;height:15px}
.nx-rail .pin.off i{background:none;border:2px solid currentColor;opacity:.75}.nx-rail .pin.v.off{color:var(--v)}.nx-rail .pin.a.off{color:var(--a)}
.nx-rail .pin.ok i{width:18px;height:18px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px #fff,0 0 0 7px rgba(31,138,85,.22)}
.nx-rail .pin b{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 13px/1 Jost,sans-serif}
.nx-rail .pin.up b{bottom:22px}.nx-rail .pin.dn b{top:22px}
.nx-rail .pin b small{display:block;margin-top:3px;font-weight:400;font-size:11.5px;color:var(--mute)}
.nx-rail .pin.dn b small{margin:0 0 3px}
.nx-rail .tick{position:absolute;top:-7px;width:2px;height:16px;background:rgba(23,21,18,.55);transform:translateX(-1px)}
.nx-rail .tick b{position:absolute;top:22px;left:50%;transform:translateX(-50%);white-space:nowrap;font:400 11.5px Jost,sans-serif;color:var(--mute)}
.nx-sum{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin:0 0 4px;font-size:14px;color:var(--mute)}
.nx-sum b{color:var(--ink);font-weight:600}
/* proposer */
.nx-ann{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:18px;margin:0 0 18px}
.nx-ann .mk{flex:none}.nx-ann p{margin:0;font-size:14px;line-height:1.4;color:var(--mute)}.nx-ann p b{display:block;color:var(--ink);font-size:16px;font-weight:600}
.nx-px{display:flex;align-items:baseline;gap:10px;padding:6px 0 10px;border-bottom:2px solid var(--acc)}
.nx-px input{flex:1;min-width:0;border:0;background:none;color:var(--ink);font:800 clamp(35px,10.4vw,51px)/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em;letter-spacing:-.01em;padding:0;outline:none}
.nx-px input::placeholder{color:rgba(23,21,18,.25)}.nx-px span{flex:none;color:var(--mute);font-size:16px}
.nx-lbl{display:block;margin:0 0 4px;color:var(--mute);font-size:13.5px}
.nx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.nx-chip{min-height:40px;padding:0 14px;border:1px solid rgba(23,21,18,.18);border-radius:999px;background:none;color:var(--ink);font:500 14px Jost,sans-serif;cursor:pointer}
.nx-chip[aria-pressed=true]{background:var(--ink);color:#F5F0E6;border-color:var(--ink)}
.nx-delta{min-height:22px;margin:8px 0 0;font-size:14.5px;line-height:1.45;color:var(--ink)}.nx-delta small{color:var(--mute);font-size:13px}
.nx textarea{width:100%;box-sizing:border-box;min-height:76px;margin:6px 0 0;padding:12px 14px;border:1px solid rgba(23,21,18,.16);border-radius:16px;background:#FFFFFF;color:var(--ink);font:400 15px/1.45 Jost,sans-serif;resize:vertical}
.nx-sec{margin:22px 0 0}
/* boîte */
.nx-grp{margin:0 0 22px}.nx-grp h3{margin:22px 4px 8px;font:600 13px/1.2 Jost,sans-serif;letter-spacing:0;color:#6F6553}
.nx-row{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:center;width:100%;padding:12px 14px;margin:0 0 8px;border:1px solid var(--line);border-radius:18px;background:rgba(23,21,18,.03);color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.nx-row:hover{background:rgba(23,21,18,.07)}
.nx-plus{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:18px 0 6px}.nx-pl{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid var(--line);border-radius:999px;background:rgba(23,21,18,.03);color:var(--mute);font:600 13.5px Jost,sans-serif;cursor:pointer}.nx-pl:hover{color:var(--ink)}.nx-pl svg{width:15px;height:15px;fill:#F2C94C}
.nx-row .mk{grid-row:span 2}.nx-row b{font-weight:600;font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-row small{grid-column:2;color:var(--mute);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-row .p{grid-row:span 2;text-align:right;font:800 18px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.nx-row .p small{display:block;margin-top:4px;font:400 11.5px Jost,sans-serif}
.nx-row.is-new{border-color:rgba(16,57,43,.6)}.nx-row.is-new b::after{content:'';display:inline-block;width:8px;height:8px;margin-left:8px;border-radius:50%;background:var(--acc);vertical-align:middle}
.nx-empty{padding:40px 8px;text-align:center;color:var(--mute);font-size:15px;line-height:1.55}.nx-empty-ico{display:grid;place-items:center;width:64px;height:64px;margin:0 auto 14px;border-radius:20px;background:rgba(16,57,43,.08);color:#10392B;box-shadow:inset 0 0 0 1px rgba(16,57,43,.2)}.nx-empty b{display:block;margin:0 0 6px;font:600 20px/1.2 Jost,sans-serif;letter-spacing:-.015em;color:var(--ink)}
/* fil */
.nx-msgs{display:flex;flex-direction:column;gap:10px;margin:14px 0 0}
.nx-m{max-width:82%;padding:10px 14px;border-radius:18px;font-size:15px;line-height:1.45;background:rgba(23,21,18,.07);align-self:flex-start;white-space:pre-wrap;overflow-wrap:anywhere}
.nx-m.me{align-self:flex-end;background:#171512;color:#F5F0E6}
.nx-m time{display:block;margin-top:4px;font-size:11.5px;color:var(--mute)}.nx-m.me time{color:rgba(245,240,230,.72)}
.nx-tk time{display:block;margin-top:6px;font-size:11.5px;color:var(--mute)}
.nx-tk{align-self:flex-start;min-width:200px;max-width:86%;padding:12px 16px 12px;border-radius:18px;border:1px solid var(--line);background:#FFFDF8;color:var(--ink)}
.nx-tk.me{background:#171512;color:#F5F0E6;border-color:transparent}.nx-tk.me .who,.nx-tk.me .qty,.nx-tk.me time,.nx-tk.me .amt small{color:rgba(245,240,230,.72)}
.nx-tk.me .nx-tag{background:rgba(245,240,230,.12);color:#F5F0E6}.nx-tk.me .nx-tag.acc{background:rgba(242,194,48,.2);color:#F2C230}.nx-tk.me .nx-tag.ok{background:rgba(108,197,140,.22);color:#9BE0B4}.nx-tk.me .nx-tag.bad{background:rgba(226,115,91,.22);color:#F3A08C}
.nx-tk.me{align-self:flex-end}
.nx-tk .who{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mute)}
.nx-tk .amt{margin:6px 0 2px;font:800 27px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.nx-tk .amt small{font:400 14px Jost,sans-serif;color:var(--mute)}
.nx-tk .t{margin-top:6px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.nx-tk.is-refus .amt{text-decoration:line-through;text-decoration-thickness:2px;opacity:.6}
.nx-tk.is-accord{border-color:var(--ok);background:rgba(31,138,85,.08)}
.nx-ev{align-self:center;padding:6px 12px;border-radius:999px;background:rgba(23,21,18,.06);color:var(--mute);font-size:12.5px;text-align:center}
/* l'accord conclu : un reçu net (23/10/2026) */
.nx-deal{margin:16px 0 0;padding:18px 18px 14px;border-radius:24px;background:#FFFDF8;border:1px solid rgba(23,21,18,.08);box-shadow:0 10px 30px rgba(23,21,18,.08);animation:nxDeal .45s cubic-bezier(.22,1,.36,1) both}
@keyframes nxDeal{from{opacity:0;transform:translateY(8px) scale(.98)}}
.nx-dh{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.nx-dck{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:#10392B;color:#F2C230;box-shadow:0 0 0 5px rgba(16,57,43,.08)}
.nx-dck svg{display:block}.nx-dck path{stroke-dasharray:24;stroke-dashoffset:24;animation:nxCk .5s .25s ease-out forwards}@keyframes nxCk{to{stroke-dashoffset:0}}
.nx-dh b{display:block;font:700 18px/1.2 Jost,sans-serif;color:#10392B}.nx-dh small{display:block;margin-top:2px;color:var(--mute);font-size:13px}
.nx-dl{margin:0;padding:4px 14px;border-radius:16px;background:rgba(23,21,18,.035)}
.nx-dl>div{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 0;font-size:14.5px}
.nx-dl>div+div{border-top:1px solid rgba(23,21,18,.07)}.nx-dl span{color:var(--mute)}.nx-dl b{font-weight:600;font-variant-numeric:tabular-nums lining-nums;text-align:right}
.nx-dl>.tot{border-top:1.5px dashed rgba(23,21,18,.18)!important;padding:12px 0 10px}.nx-dl>.tot span{color:var(--ink);font-weight:600}.nx-dl>.tot b{font:800 22px/1 Jost,sans-serif;letter-spacing:-.01em;color:#10392B}
.nx-dnote{display:flex;gap:8px;align-items:flex-start;margin:12px 2px 0;color:var(--mute);font-size:13.5px;line-height:1.45}.nx-dnote svg{flex:none;margin-top:2px}
.nx-deal .nx-warn{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;padding:10px 12px;border-radius:14px}
.nx-deal .nx-go{margin:14px 0 0;display:flex;align-items:center;justify-content:center;gap:8px}
.nx-dlink{display:flex!important;align-items:center;justify-content:center;gap:6px;width:100%;min-height:46px;margin:6px 0 0!important;padding:0!important;border-radius:999px;background:none!important;color:#10392B!important;font:600 15px Jost,sans-serif;text-decoration:none}
.nx-dsafe{display:flex;align-items:center;justify-content:center;gap:6px;margin:4px 0 0;color:var(--mute);font-size:12px;text-align:center}
.nx-act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}.nx-act .nx-go{grid-column:1 / -1}
.nx-comp{display:flex;gap:8px;align-items:flex-end}
.nx-comp textarea{flex:1;min-height:48px;height:48px;margin:0;resize:none}
.nx-comp .nx-ib{width:48px;height:48px;background:var(--acc);color:#F3EFE4}
.nx-cp{display:flex;gap:8px;align-items:center;margin:0 0 10px}.nx-cp input{flex:1;min-width:0;height:48px;padding:0 14px;border:1px solid rgba(23,21,18,.16);border-radius:14px;background:#FFFFFF;color:var(--ink);font:500 18px Jost,sans-serif}
.nx-tag{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font:600 12px/1.5 Jost,sans-serif;background:rgba(23,21,18,.08);color:var(--mute);white-space:nowrap}
.nx-tag.ok{background:rgba(31,138,85,.13);color:#17633D}.nx-tag.acc{background:rgba(16,57,43,.2);color:#10392B}.nx-tag.wait{background:rgba(242,201,76,.14);color:#8A6400}.nx-tag.bad{background:rgba(226,115,91,.16);color:#C0442B}
.nx-row small .nx-tag{margin:0 4px 0 0}
.nx-state{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-size:13.5px;color:var(--mute)}.nx-state .nx-tag{margin:0}
.nx-dispo{margin:4px 0 0;font-size:13.5px;color:var(--mute)}
.nx-tk .qty{margin-top:2px;font-size:13.5px;color:var(--mute)}
.nx-tk.is-remplacee,.nx-tk.is-retiree,.nx-tk.is-expiree{opacity:.62}.nx-tk.is-refusee .amt{text-decoration:line-through;text-decoration-thickness:2px;opacity:.7}.nx-tk.is-acceptee{border-color:var(--ok)}
.nx-tk .who .nx-tag{margin-left:auto}
.nx-ev-ok{background:rgba(31,138,85,.13);color:#17633D}
.nx-qr{margin:16px 0 0}.nx-q{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.nx-q input{width:140px;height:48px;padding:0 14px;border:1px solid rgba(23,21,18,.16);border-radius:14px;background:#FFFFFF;color:var(--ink);font:500 18px Jost,sans-serif}.nx-q span{color:var(--mute)}
.nx-tot{display:flex;flex-direction:column;gap:6px;margin:14px 0 0}.nx-sum small{font-weight:400;color:var(--mute)}
.nx-warn{margin:8px 0 0;padding:10px 12px;border-radius:14px;background:rgba(242,194,48,.2);color:#5F4500;font-size:13.5px;line-height:1.45}
.nx-send{margin-top:16px}.nx-edf{max-height:min(60dvh,560px);overflow-x:hidden;overflow-y:auto;padding:2px}
.nx-pend{margin:0 0 10px;padding:12px 14px;border-radius:16px;background:rgba(23,21,18,.05);font-size:14.5px;line-height:1.45}.nx-pend b{font-weight:700}
.nx-confirm>b{color:var(--mute);font-size:14px;font-weight:600}.nx-big{margin:6px 0 2px;font:800 27px/1.1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.nx-dtot{font-size:15px;font-weight:600}
.nx-confirm>p{margin:10px 0 12px;color:var(--mute);font-size:13.5px;line-height:1.5}
.nx-cond{margin:10px 0 0!important;padding:10px 12px;border-radius:12px;background:rgba(31,138,85,.06);color:var(--ink)!important;font-size:14px;line-height:1.45}.nx-cond span{display:block;color:var(--mute);font-size:12px}

.nx-stop{margin:8px 0 0;text-align:center}.nx-stop button{min-height:44px;border:0;background:none;color:#6F6553;font:500 13px Jost,sans-serif;text-decoration:underline;cursor:pointer}
.nx-in{color:var(--ink);font-weight:600}
.nx-snd s{opacity:.6}
.nx-av{position:relative;grid-row:span 2;width:36px;height:36px}.nx-av svg{display:block;border-radius:50%}.nx-av i{position:absolute;right:-4px;bottom:-4px;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#F4EEE3}.nx-av i svg{width:14px;height:14px}
.nx-hav{flex:none;width:40px;height:40px}.nx-hav svg{display:block;border-radius:50%}
@keyframes nxIn{from{opacity:0}}@keyframes nxUp{from{transform:translateY(28px);opacity:0}}
@keyframes nxPop{from{transform:scale(.92);opacity:0}}.nx-new{animation:nxPop .32s cubic-bezier(.22,1,.36,1) both}
/* proposer un prix (12/10/2026) : le montant d'abord, en chiffres droits ; un trait qui s'allume au lieu d'un cadre ; prix rapides en deux lignes */
.nx-ann{gap:14px;padding:14px 16px;border-radius:20px;background:rgba(23,21,18,.035)}
.nx-ann p{font-size:13.5px}.nx-ann p b{font-size:15.5px;margin-bottom:2px}
.nx-ed>.nx-lbl:first-of-type{margin-top:4px}
.nx-px{position:relative;align-items:flex-end;gap:12px;padding:4px 0 12px;border-bottom:1px solid rgba(23,21,18,.2)}
.nx-px::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:0 50%;transition:transform .32s cubic-bezier(.22,1,.36,1)}
.nx-px:focus-within::after{transform:scaleX(1)}
.nx .nx-px input,.nx .nx-px input:focus,.nx .nx-px input:focus-visible{outline:none!important;box-shadow:none!important}
.nx-px input{font:300 clamp(46px,12vw,68px)/1 Jost,system-ui,sans-serif;letter-spacing:-.025em;font-variant-numeric:lining-nums tabular-nums}
.nx-px input{font-size:clamp(46px,12vw,68px)!important}
.nx-px input::placeholder{color:rgba(23,21,18,.2)}
.nx-px span{padding-bottom:8px;font-size:15px}
.nx-trc{display:flex;flex-direction:column;gap:6px;margin:14px 0 2px}.nx-trc>div{display:flex;gap:8px}
.nx-trc button{flex:1;min-height:44px;padding:0 10px;border-radius:22px;border:1px solid rgba(23,21,18,.18);background:none;color:var(--ink);font:500 14.5px Jost,sans-serif;cursor:pointer}
.nx-trc button[aria-pressed=true]{border-color:#1F8A55;background:rgba(31,138,85,.12);font-weight:600}.nx-trc small{font-size:12.5px;line-height:1.35;color:var(--mute)}
.nx-trp{display:flex;align-items:baseline;gap:8px;margin:2px 0 0;padding:4px 0 6px;border-bottom:1px solid var(--line)}.nx-trp[hidden]{display:none}.nx-trp label{flex:none;font-size:14px;color:var(--mute)}.nx-trp input{flex:1;min-width:0;border:0;background:none;color:var(--ink);font:700 22px/1.2 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;padding:6px 0;outline:none;text-align:right}.nx-trp input:focus-visible{box-shadow:0 2px 0 var(--acc)}.nx-trp span{flex:none;color:var(--mute);font-size:15px}
.nx-tr{display:inline-flex;align-items:center;gap:4px;margin:4px 0 2px;padding:2px 10px;border-radius:999px;background:rgba(23,21,18,.07);font:600 12.5px/1.6 Jost,sans-serif;color:var(--mute)}
.nx-tr.oui{background:rgba(31,138,85,.13);color:#17633D}.nx-tk.me .nx-tr{background:rgba(245,240,230,.14);color:#F5F0E6}.nx-tk.me .nx-tr.oui{background:rgba(159,220,178,.22);color:#CDEFD8}
.nx-pq{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;margin:14px 0 2px}
@media (max-width:520px){.nx-pq{grid-template-columns:repeat(2,minmax(0,1fr))}}
.nx-pq .nx-chip{display:grid;align-content:center;gap:2px;min-height:58px;padding:8px 12px;border-radius:16px;border-color:rgba(23,21,18,.14);text-align:left;font:600 16px/1.1 Jost,sans-serif;font-variant-numeric:tabular-nums;transition:background .2s,border-color .2s,color .2s}
.nx-pq .nx-chip small{font:500 12px/1.2 Jost,sans-serif;color:var(--mute);transition:color .2s}
.nx-pq .nx-chip:hover{border-color:rgba(23,21,18,.34);background:rgba(23,21,18,.04)}
.nx-pq .nx-chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#F5F0E6}.nx-pq .nx-chip[aria-pressed=true] small{color:rgba(245,240,230,.72)}
.nx-q{gap:8px}.nx-q input{width:120px;height:52px;border-radius:14px;font:500 20px Jost,sans-serif;font-variant-numeric:tabular-nums;transition:border-color .2s}
.nx-q input:focus,.nx-q input:focus-visible,.nx textarea:focus,.nx textarea:focus-visible{outline:none!important;border-color:var(--acc)}
.nx-q .nx-chip{min-height:44px}
.nx-tot{margin:16px 0 0;padding:12px 14px;border-radius:16px;background:rgba(23,21,18,.04)}.nx-tot:empty{display:none}
.nx-cd{gap:6px}.nx-cd .nx-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13.5px;border-color:rgba(23,21,18,.14)}
.nx-cd .nx-chip::before{content:"";width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.4);transition:background .2s,box-shadow .2s}
.nx-cd .nx-chip[aria-pressed=true]{background:rgba(23,21,18,.08);border-color:rgba(23,21,18,.34);color:var(--ink)}
.nx-cd .nx-chip[aria-pressed=true]::before{background:var(--ink) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='m3.5 7.2 2.3 2.3 4.7-4.9' fill='none' stroke='%23171512' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/14px no-repeat;box-shadow:none}
.nx textarea{min-height:64px;border-radius:14px;transition:border-color .2s}
/* pied collant de la feuille « Proposer un prix » : fond plein d'un bord à l'autre, léger fondu au-dessus ; rien ne passe dessous */
.nx-pied{position:sticky;bottom:-20px;z-index:3;margin:18px -18px -20px;padding:12px 18px calc(20px + env(safe-area-inset-bottom,0px));background:#F4EEE3}
.nx-pied::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:22px;background:linear-gradient(rgba(244,238,227,0),#F4EEE3);pointer-events:none}
.nx-pied .nx-send{margin-top:0}.nx-pied .nx-err:empty{display:none}
@media (prefers-reduced-motion:reduce){.nx-px::after{transition:none}}
@media (prefers-reduced-motion:reduce){.nx-bg,.nx,.nx-new{animation:none}.nx-rail .gap,.nx-rail .pin{transition:none}}`;
  let css = false, bg = null, poll = 0;
  const autreId = n => n.auteur_id === me() ? n.proprio_id : n.auteur_id;
  const avDe = (n, size) => window.MDGCompte ? MDGCompte.avatar(autreId(n), { size: size || 34 }) : { svg: '', nom: '' };
  const mk = r => r === 'vendeur' ? '<svg class="mk" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="#6CC58C"/></svg>' : '<svg class="mk" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="#F2C94C"/></svg>';
  function sheet(html, label) {
    if (!css) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); css = true; }
    close(true);
    bg = document.createElement('div'); bg.className = 'nx-bg';
    bg.innerHTML = `<div class="nx" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    document.body.appendChild(bg);
    const rf = N() && N().piege ? N().piege(bg) : null; if (!rendreFocus) rendreFocus = rf;
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close());
    document.addEventListener('keydown', onKey);
    return bg;
  }
  let rendreFocus = null, redessiner = null;
  addEventListener('mdg:profils', () => { if (bg && redessiner) redessiner(); });
  function close(keep) { clearInterval(poll); poll = 0; if (bg) { bg.remove(); bg = null; } if (!keep) { document.removeEventListener('keydown', onKey); if (rendreFocus) { rendreFocus(); rendreFocus = null; } } }
  function onKey(e) { if (e.key === 'Escape' && bg) close(); }
  const CHEV = (window.MDGIco && window.MDGIco.svg('retour', 22, 2)) || '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
  // la voix du logo : le dernier mot du titre en Jost 900 italique (« Mes négociations »), sauf noms et titres composés
  const voix = t => /·|\d/.test(t) || !/\s/.test(t.trim()) ? esc(t) : esc(t).replace(/(\S+)\s*$/, '<em>$1</em>');
  const head = (t, sub, back) => `<div class="nx-h">${back ? '<button type="button" class="nx-ib nx-back" data-back aria-label="Retour à mes négociations">' + CHEV + '</button>' : ''}<h2>${voix(t)}${sub ? `<small>${esc(sub)}</small>` : ''}</h2><button type="button" class="nx-ib" data-x aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`;
  const bindSnd = () => { const b = bg && bg.querySelector('.nx-snd'); if (b) b.onclick = () => { close(); MDGSons.panneau(); }; };

  // la règle des prix : repère du prix affiché, dernier prix de chaque partie (atténué s'il n'est plus valable), écart
  function rail(n, msgs) {
    const R = roles(n), last = { vendeur: null, acheteur: null };
    (msgs || []).forEach(m => { if (m.genre === 'prix') last[R[m.auteur_id]] = { p: +m.prix, live: m.issue === 'en_attente' && Date.parse(m.expire_le) > Date.now() }; });
    if (!msgs && n.dernier_prix && n.dernier_par) last[R[n.dernier_par]] = { p: +n.dernier_prix, live: enCours(n) };
    const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur';
    if (!last[owner] && n.prix_annonce) last[owner] = { p: +n.prix_annonce, live: true };
    const ok = n.statut === 'conclue' && n.prix_final;
    const vals = [n.prix_annonce, last.vendeur && last.vendeur.p, last.acheteur && last.acheteur.p, ok && n.prix_final].filter(v => v > 0).map(Number);
    if (!vals.length) return '';
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max((hi - lo) * 0.22, hi * 0.04); lo -= pad; hi += pad;
    const x = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
    const lab = ok ? 'Accord à ' + fmt(n.prix_final) + ' F' : ['vendeur', 'acheteur'].filter(r => last[r]).map(r => Le(r) + ' : ' + fmt(last[r].p) + ' F').join(', ');
    let h = '<div class="nx-rail" role="img" aria-label="' + esc(lab) + '"><div class="tr">';
    const same = (x, y) => x && y && Math.abs(x - y) < 1;
    if (n.prix_annonce && !(ok && same(n.prix_final, n.prix_annonce)) && !(last.vendeur && same(last.vendeur.p, n.prix_annonce) && last.acheteur && same(last.acheteur.p, n.prix_annonce))) {
      const proche = p => p && Math.abs(parseFloat(x(p.p)) - parseFloat(x(n.prix_annonce))) < 14;   // étiquettes à moins de 14 % : elles se chevaucheraient
      h += `<span class="tick" style="left:${x(n.prix_annonce)}">${proche(last.acheteur) || (proche(last.vendeur) && !last.acheteur) ? '' : `<b>affiché ${fmt(n.prix_annonce)}</b>`}</span>`; }
    if (ok) h += `<span class="gap is-ok" style="left:0;width:100%"></span><span class="pin ok up" style="left:${x(n.prix_final)}"><i></i><b>${fmt(n.prix_final)} F<small>convenu</small></b></span>`;
    else {
      const v = last.vendeur, a = last.acheteur;
      if (v && a && same(v.p, a.p)) return h + `<span class="pin ok up" style="left:${x(v.p)}"><i></i><b>${fmt(v.p)} F<small>même prix des deux côtés</small></b></span></div></div>`;
      if (v && a) { const l = Math.min(v.p, a.p), r = Math.max(v.p, a.p); h += `<span class="gap" style="left:${x(l)};width:calc(${x(r)} - ${x(l)})"></span>`; }
      if (v) h += `<span class="pin v up${v.live ? '' : ' off'}" style="left:${x(v.p)}"><i></i><b>${fmt(v.p)}<small>vendeur</small></b></span>`;
      const aff = q => n.prix_annonce && same(q.p, n.prix_annonce) ? ' · = affiché' : '';
      if (a) h += `<span class="pin a ${v ? 'dn' : 'up'}${a.live ? '' : ' off'}" style="left:${x(a.p)}"><i></i><b>${v ? `<small>acheteur${aff(a)}</small>` : ''}${fmt(a.p)}${v ? '' : `<small>acheteur${aff(a)}</small>`}</b></span>`;
    }
    return h + '</div></div>';
  }

  // transport d'une proposition (schéma 83) : inclus, à part (avec son prix, négocié ici) ou sans ; null = rien de dit
  const trTag = (v, pt) => v === true ? '<span class="nx-tr oui">' + TI('camion') + 'Transport inclus</span>' : v === false && +pt > 0 ? '<span class="nx-tr oui">' + TI('camion') + 'Transport à part · ' + fmt(pt) + ' F</span>' : v === false ? '<span class="nx-tr">Transport à la charge de l’acheteur</span>' : '';
  const trTxt = (v, pt) => v === true ? ', transport inclus' : v === false && +pt > 0 ? ', transport à part ' + fmt(pt) + ' F' : v === false ? ', transport à la charge de l’acheteur' : '';
  const trDe = (v, pt) => v === true ? 'inclus' : v === false ? (+pt > 0 ? 'apart' : 'sans') : null;
  // envoi d'une proposition : prix, quantité et transport en un seul appel (nego_ouvrir2, nego_agir2) ;
  // ancien serveur sans ces fonctions : seulement sans transport (nego_transport n'est plus ouverte aux membres, schéma 93b)
  const sansFn = x => /Could not find|schema cache|PGRST202|does not exist/i.test((x && x.message) || '');
  async function envoyer(fn, args, v) {
    try { return await N().rpc(fn + '2', Object.assign({}, args, { p_transport: v.tr, p_prix_transport: v.tr === 'apart' ? v.pt : null })); }
    catch (x) {
      if (!sansFn(x)) throw x;
      if (v.tr) throw new Error('Le choix du transport n’est pas encore activé sur le serveur. Réessayez sans le préciser.');
      return N().rpc(fn, args);
    }
  }
  // transport annoncé (schéma 48) → choix de départ dans une proposition (schéma 49) : inclus, sans, ou à discuter (rien)
  const trAnnonce = (cible, t) => cible === 'offre' ? (t === 'inclus' ? 'inclus' : t === 'non' ? 'sans' : null) : (t === 'vendeur' ? 'inclus' : t === 'acheteur' ? 'sans' : null);
  /* ——— l'éditeur de proposition (nouvelle proposition, contre-proposition, relance) ——— */
  // ctx : { cible, prixRef (prix affiché), unite, qmax, q0, negociable, pour (le rôle qui reçoit), dernier (dernier prix de l'autre) }
  function editeur(box, ctx, onSend, label) {
    // schéma 97c : le minimum vaut aussi pour une demande (fixé par l'acheteur) ; quand il reste moins, on prend tout le reste
    const aPartir = ctx.cible === 'demande' ? 'L’acheteur achète à partir de' : 'Le vendeur vend à partir de';
    const u = ctx.unite || 'unité', qmin = ctx.qmin ? Math.min(+ctx.qmin, ctx.qmax || +ctx.qmin) : 0, sens = ctx.cible === 'offre' ? -1 : 1, ref = +ctx.prixRef || 0, fixe = ctx.negociable === false && ctx.moi !== 'proprio';
    const chips = ref && !fixe ? [5, 10, 15].map(p => ({ v: arrondi(ref * (1 + sens * p / 100)), t: (sens < 0 ? '−' : '+') + p + ' %' })) : [];
    box.innerHTML = `<div class="nx-ed">
      ${fixe ? `<p class="nx-warn">Prix ferme : ${ctx.pour === 'vendeur' ? 'le vendeur' : 'l’acheteur'} n’accepte pas d’autre prix. Vous pouvez proposer le prix affiché et une quantité.</p>` : ''}
      <label class="nx-lbl" for="nxP">Prix par ${esc(u)}</label>
      <div class="nx-px"><input id="nxP" inputmode="numeric" autocomplete="off" placeholder="${ref ? fmt(chips[1] ? chips[1].v : ref) : '0'}" ${fixe ? `value="${fmt(ref)}" readonly` : ''} aria-describedby="nxD"><span>F / ${esc(u)}</span></div>
      <div class="nx-chips nx-pq" role="group" aria-label="Prix rapides">${ref ? `<button type="button" class="nx-chip" data-v="${ref}" aria-pressed="false"><small>Prix affiché</small>${fmt(ref)}</button>` : ''}${ctx.dernier && ctx.dernier !== ref ? `<button type="button" class="nx-chip" data-v="${ctx.dernier}" aria-pressed="false"><small>Sa proposition</small>${fmt(ctx.dernier)}</button>` : ''}${chips.map(c => `<button type="button" class="nx-chip" data-v="${c.v}" aria-pressed="false"><small>${c.t}</small>${fmt(c.v)}</button>`).join('')}</div>
      <div class="nx-qr"><label class="nx-lbl" for="nxQ">Quantité</label><div class="nx-q"><input id="nxQ" inputmode="decimal" autocomplete="off" value="${ctx.q0 ? fq(ctx.q0) : ''}" placeholder="—"><span>${esc(u)}</span>${qmin && qmin < (ctx.qmax || Infinity) ? `<button type="button" class="nx-chip" data-q="${qmin}">Minimum · ${fq(qmin)}</button>` : ''}${ctx.qmax ? `<button type="button" class="nx-chip" data-q="${ctx.qmax}">Tout le lot · ${fq(ctx.qmax)}</button>` : ''}</div>${qmin ? `<p class="nx-note" style="margin:6px 0 0">${aPartir} ${fq(qmin)} ${esc(uQ(qmin, u))}.</p>` : ''}</div>
      <div class="nx-trc" role="group" aria-label="Transport"><span class="nx-lbl">Transport</span><div><button type="button" data-tr="inclus" aria-pressed="${ctx.tr0 === 'inclus'}">Inclus</button><button type="button" data-tr="apart" aria-pressed="${ctx.tr0 === 'apart'}">À part</button><button type="button" data-tr="sans" aria-pressed="${ctx.tr0 === 'sans'}">${ctx.pour === 'vendeur' ? 'À ma charge' : 'À l’acheteur'}</button></div>
        <div class="nx-trp"${ctx.tr0 === 'apart' ? '' : ' hidden'}><label for="nxTP">Prix du transport</label><input id="nxTP" inputmode="numeric" autocomplete="off" placeholder="0" value="${ctx.pt0 ? fmt(ctx.pt0) : ''}"><span>F</span></div>
        <small>Inclus : le vendeur livre, c’est dans son prix. À part : le vendeur livre, le transport s’ajoute au prix discuté ici. ${ctx.pour === 'vendeur' ? 'À ma charge : je viens chercher ou j’envoie mon camion.' : 'À l’acheteur : le transport est à sa charge.'} Même ville : le livreur se paie directement, hors Marché de Gros.</small></div>
      <div class="nx-tot" id="nxD" aria-live="polite"></div>
      <div class="nx-prev"></div>
      <label class="nx-lbl" for="nxT" style="margin-top:14px">Conditions (facultatif)</label>
      <div class="nx-chips nx-cd" style="margin-top:4px">${(ctx.pour === 'vendeur' ? ['Paiement à la livraison', 'Je viens chercher', 'Livraison sous 3 jours'] : ['Je peux livrer', 'Disponible maintenant', 'Qualité vérifiable sur place']).map(t => `<button type="button" class="nx-chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <textarea id="nxT" maxlength="500" placeholder="Livraison, paiement, délai…"></textarea>
      <div class="nx-pied"><button type="button" class="nx-go nx-send" disabled>${esc(label || 'Envoyer ma proposition')}</button><p class="nx-err" role="alert"></p></div></div>`;
    const $ = s => box.querySelector(s), ip = $('#nxP'), iq = $('#nxQ'), go = $('.nx-send'), out = $('#nxD');
    let tr = ['inclus', 'apart', 'sans'].includes(ctx.tr0) ? ctx.tr0 : null;
    const tp = $('#nxTP'), tpb = $('.nx-trp');
    box.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { const v = b.dataset.tr; tr = tr === v ? null : v; box.querySelectorAll('[data-tr]').forEach(x => x.setAttribute('aria-pressed', String(tr === x.dataset.tr)));
      tpb.hidden = tr !== 'apart'; if (tr === 'apart') setTimeout(() => tp.focus(), 30); upd(); });
    tp.addEventListener('input', () => { const v = num(tp.value); tp.value = v ? fmt(v) : ''; upd(); });
    const vals = () => ({ p: num(ip.value), q: num(iq.value) || null, t: $('#nxT').value.trim(), tr, pt: tr === 'apart' ? num(tp.value) || null : null });
    const upd = () => {
      const { p, q, pt } = vals(), qFrac = q && q % 1 && ENTIERES.includes(String(u).toLowerCase()), trop = p && q && p * q > MONTANT_MAX;   // schéma 99d : le serveur refuse aussi
      go.disabled = !p || p < 1 || qFrac || trop || (ctx.qmax && q > ctx.qmax) || (qmin && !(q >= qmin)) || (tr === 'apart' && !pt);
      go.textContent = p ? (label || 'Proposer') + ' ' + fmt(p) + ' F / ' + u + (q ? ' × ' + fq(q) : '') : (label || 'Envoyer ma proposition');
      box.querySelectorAll('.nx-chip[data-v]').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.v === p)));
      let h = '';
      if (p && q) h += `<div class="nx-sum"><span>Total</span><b>${fq(q)} ${esc(uQ(q, u))} × ${fmt(p)} F = ${fmt(p * q)} F${tr === 'inclus' ? ', transport inclus' : tr === 'sans' ? ', transport à la charge de l’acheteur' : ''}</b></div>`;
      if (p && q && tr === 'apart' && pt) h += `<div class="nx-sum"><span>Avec le transport</span><b>${fmt(p * q)} + ${fmt(pt)} = ${fmt(p * q + pt)} F</b></div>`;
      if (tr === 'apart' && !pt) h += `<p class="nx-warn">Indiquez le prix du transport.</p>`;
      if (p && ref) { const e = p - ref, pc = Math.round(Math.abs(e) / ref * 100); h += `<div class="nx-sum"><span>Par rapport au prix affiché</span><b>${Math.abs(e) < 1 ? 'identique' : (e < 0 ? '−' : '+') + fmt(Math.abs(e)) + ' F (' + (e < 0 ? '−' : '+') + pc + ' %)'}${Math.abs(e) >= 1 && q ? `<small> soit ${fmt(Math.abs(e) * q)} F ${e < 0 ? 'de moins' : 'de plus'} au total</small>` : ''}</b></div>`;
        if (p < ref * 0.25 || p > ref * 4) h += `<p class="nx-warn">Ce prix est très loin du prix affiché (${fmt(ref)} F). Un zéro en trop ou en moins ?</p>`;
        else if (pc > 40) h += `<p class="nx-warn">Un écart de plus de 40 % a peu de chances d’être accepté.</p>`; }
      if (p && p < 1) h += `<p class="nx-warn">Le prix doit être d’au moins 1 F.</p>`;
      if (qFrac) h += `<p class="nx-warn">Quantité en nombre entier pour « ${esc(u)} ».</p>`;
      if (trop) h += `<p class="nx-warn">Montant trop élevé : 1 milliard F CFA au plus.</p>`;
      if (ctx.qmax && q > ctx.qmax) h += `<p class="nx-warn">L’annonce porte sur ${fq(ctx.qmax)} ${esc(uQ(ctx.qmax, u))} au plus.</p>`;
      if (qmin && q && q < qmin) h += `<p class="nx-warn">${aPartir} ${fq(qmin)} ${esc(uQ(qmin, u))}.</p>`;
      out.innerHTML = h;
      $('.nx-prev').innerHTML = p && ctx.preview ? ctx.preview(p) : '';
    };
    ip.addEventListener('input', () => { const v = num(ip.value); ip.value = v ? fmt(v) : ''; upd(); });
    iq.addEventListener('input', upd);
    box.querySelectorAll('.nx-chip[data-v]').forEach(c => c.onclick = () => { if (!fixe) { ip.value = fmt(+c.dataset.v); upd(); } });
    box.querySelectorAll('.nx-chip[data-q]').forEach(c => c.onclick = () => { iq.value = fq(+c.dataset.q); upd(); });
    box.querySelectorAll('.nx-chip[data-t]').forEach(c => { c.setAttribute('aria-pressed', 'false'); c.onclick = () => { const t = $('#nxT'), on = c.getAttribute('aria-pressed') !== 'true', s = c.dataset.t; let v = t.value.split(/\.\s*/).map(x => x.trim()).filter(Boolean).filter(x => x !== s); if (on) v.push(s); t.value = v.join('. '); c.setAttribute('aria-pressed', String(on)); }; });
    go.onclick = async () => {
      if (!navigator.onLine) { $('.nx-err').textContent = 'Pas de connexion internet. Réessayez quand le réseau revient.'; return; }
      const v = vals(), refus = v.t && N().texteRefus ? N().texteRefus(v.t) : '';   // pas de lien ni de code (schéma 22)
      if (refus) { $('.nx-err').textContent = refus; return; }
      go.disabled = true; go.setAttribute('aria-busy', 'true'); $('.nx-err').textContent = ''; go.textContent = 'Envoi';
      try { const envoi = onSend(v); if (window.MDGToast && MDGToast.suivre) MDGToast.suivre(envoi, { attente: 'Envoi de votre proposition…', erreur: x => err(x) }).catch(() => {}); await envoi; } catch (x) { $('.nx-err').textContent = err(x); go.disabled = false; upd(); }
    };
    upd(); setTimeout(() => (fixe ? iq : ip).focus(), 60);
  }

  /* ——— proposer depuis une annonce ——— */
  function proposer(a) {
    if (!N()) return;
    if (!a || !a.id) return N().toast('Cette annonce n’est que sur cet appareil : la négociation n’est pas possible.');
    if (!N().session()) { N().open('negocie'); addEventListener('mdg:connecte', () => setTimeout(() => proposer(a), 400), { once: true }); return; }
    const cible = a.cible === 'demande' ? 'demande' : 'offre', deja = liste.find(n => n.cible === cible && n.cible_id === a.id && n.auteur_id === me() && n.statut === 'ouverte');   // une seule ouverte à la fois ; après un accord, on peut racheter (schéma 36)
    if (deja) return thread(deja.id);
    const prix = +a.prix || 0, u = a.unite || 'kg', q = +a.quantite || 0, lui = cible === 'offre' ? 'vendeur' : 'acheteur';
    redessiner = null;
    sheet(head('Proposer un prix', (a.produit || 'Annonce') + (a.ville ? ' · ' + a.ville : '')) + `
      <div class="nx-b">
        <div class="nx-ann">${mk(lui)}<p><b>${esc(a.produit || 'Annonce')}${q ? ' · ' + fq(q) + ' ' + esc(uQ(q, u)) : ''}</b>${esc(a.nom || Le(lui))}${a.ville ? ', ' + esc(a.ville) : ''}<br>${prix ? (cible === 'offre' ? 'Prix affiché par le vendeur : ' : 'Budget affiché par l’acheteur : ') + '<b class="nx-in">' + fmt(prix) + ' F / ' + esc(u) + '</b>' : (cible === 'offre' ? 'Pas de prix affiché' : 'Pas de budget affiché')}${a.negociable === false ? ' · prix ferme' : ''}</p></div>
        ${a.villeSeule && a.villeAnn && window.MDGVilleSeule ? MDGVilleSeule.avertir(cible, a.villeAnn) : ''}
        <div class="nx-edbox"></div>
        <p class="nx-note">${Le(lui)} reçoit votre proposition et a 48 h pour l’accepter, la refuser ou proposer autre chose. Vous pouvez la retirer tant qu’il n’a pas répondu. Un accord fixe le prix et la quantité ; ce n’est pas un paiement : voyez la marchandise avant de payer.</p>
      </div>`, 'Proposer un prix');
    bindSnd();
    const fake = { cible, prix_annonce: prix || null, unite: u, statut: 'ouverte', proprio_id: 'lui', auteur_id: me() };
    editeur(bg.querySelector('.nx-edbox'), { cible, tr0: trAnnonce(cible, a.transport), prixRef: prix, unite: u, qmax: q || null, q0: q || null, qmin: +a.qmin || 0, negociable: a.negociable, pour: lui, moi: 'auteur', preview: p => rail(fake, [{ genre: 'prix', auteur_id: me(), prix: p, issue: 'en_attente', expire_le: new Date(Date.now() + 864e5).toISOString() }]) },
      async v => { const id = await envoyer('nego_ouvrir', { cible, cible_id: a.id, prix: v.p, quantite: v.q, texte: v.t || null }, v); await refresh(); thread(id, true); N().toast('Proposition envoyée. Réponse attendue sous 48 h.'); });
  }

  /* ——— la boîte ——— */
  async function inbox() {
    if (!N()) return;
    if (!N().session()) { N().open(); return; }
    const draw = () => {
      const g = { moi: [], eux: [], ok: [], sans: [], fin: [] };
      liste.forEach(n => (n.statut === 'conclue' ? g.ok : n.statut !== 'ouverte' ? g.fin : aMoi(n) ? g.moi : enCours(n) ? g.eux : g.sans).push(n));
      const row = n => { const lui = autre(monRole(n)), e = etat(n), p = n.statut === 'conclue' ? n.prix_final : enCours(n) ? n.dernier_prix : null, q = n.statut === 'conclue' ? n.quantite_finale : n.dernier_quantite;
        const av = avDe(n, 36);
        return `<button type="button" class="nx-row${nonLu(n) ? ' is-new' : ''}" data-id="${n.id}"><span class="nx-av">${av.svg || mk(lui)}${av.svg ? `<i>${mk(lui)}</i>` : ''}</span><b>${esc(n.produit || 'Annonce')}</b>
          <span class="p">${p ? fmt(p) : '—'}<small>${p ? 'F / ' + esc(n.unite || 'unité') + (q ? ' × ' + fq(q) : '') : ''}</small></span>
          <small><span class="nx-tag ${e.c}">${esc(e.t)}</span> avec ${leLa(lui)}${av.nom ? ' ' + esc(av.nom) : ''}${window.MDGStatut ? ' ' + MDGStatut.puces(autreId(n), { max: 0, t: 13 }) : ''}${n.ville ? ' · ' + esc(n.ville) : ''} · ${ago(n.updated_at)}</small></button>`; };
      const grp = (t, L) => L.length ? `<section class="nx-grp"><h3>${t}</h3>${L.map(row).join('')}</section>` : '';
      bg.querySelector('.nx-b').innerHTML = liste.length ? grp('À vous de répondre', g.moi) + grp('En attente de réponse', g.eux) + grp('Accords conclus', g.ok) + grp('Sans proposition en cours', g.sans) + grp('Terminées', g.fin)
        : `<div class="nx-empty">${window.MDGSac ? MDGSac.svg('vide', { t: 70 }) : window.MDGIco ? '<span class="nx-empty-ico">' + window.MDGIco.svg('negoce', 30, 1.8) + '</span>' : ''}<b>Aucune négociation pour l’instant</b>Sur une offre ou une demande, touchez « Proposer un prix ». Les réponses arrivent ici.</div>`;
      bg.querySelectorAll('.nx-row').forEach(b => { b.onclick = () => thread(b.dataset.id); glisser(b, () => masquer(b.dataset.id)); });
    };
    sheet(head('Mes négociations', 'Propositions, réponses et accords') + `<div class="nx-b">${window.MDGSac ? MDGSac.charge('Vos négociations arrivent…') : '<div class="nx-empty">Chargement…</div>'}</div>`, 'Mes négociations');
    redessiner = () => draw();
    bindSnd();
    if (liste.length) draw();
    await refresh(); if (bg && bg.querySelector('.nx-row,.nx-empty')) draw();
  }

  /* ——— le fil d'une négociation ——— */
  async function thread(id) {
    if (!N() || !N().session()) return N() && N().open();
    if (window.MDGActivite) MDGActivite.noter('nego', id);   // pour « Reprendre » dans Accueil → Activité
    let n = liste.find(x => x.id === id), msgs = null, mode = '', dispo = null;
    sheet(head(n ? (n.produit || 'Négociation') : 'Négociation', '', true) + `<div class="nx-b"><div class="nx-top"></div><div class="nx-msgs" aria-live="polite"></div><div class="nx-bottom"></div></div><div class="nx-f"></div>`, 'Négociation');
    bindSnd();
    bg.querySelector('[data-back]').onclick = () => inbox();
    const $ = s => bg && bg.querySelector(s);
    const annonce = () => { const k = n.cible === 'offre' ? 'offres' : 'demandes'; return N().list(k).find(x => x._rid === n.cible_id); };
    const ticket = (m, i, seen, anim) => {
      const R = roles(n), mine = m.auteur_id === me(), who = mine ? 'Vous' : Le(R[m.auteur_id]), u = n.unite || 'unité';
      const cls = (mine ? ' me' : '') + (anim && i >= seen ? ' nx-new' : ''), when = `<time datetime="${m.created_at}">${ago(m.created_at)}</time>`;
      if (m.genre === 'texte') return `<div class="nx-m${cls}">${esc(m.texte)}${when}</div>`;
      if (m.genre === 'fin') return `<div class="nx-ev${cls}">${who} ${mine ? 'avez' : 'a'} arrêté la négociation${m.texte ? ' : « ' + esc(m.texte) + ' »' : ''} · ${ago(m.created_at)}</div>`;
      if (m.genre === 'refus' || m.genre === 'retrait') return `<div class="nx-ev${cls}">${who} ${mine ? 'avez' : 'a'} ${m.genre === 'refus' ? 'refusé' : 'retiré'} la proposition à ${fmt(m.prix)} F${m.texte ? ' : « ' + esc(m.texte) + ' »' : ''} · ${ago(m.created_at)}</div>`;
      if (m.genre === 'accord') return `<div class="nx-ev nx-ev-ok${cls}">${who} ${mine ? 'avez' : 'a'} accepté : ${m.quantite ? fq(m.quantite) + ' ' + esc(uQ(m.quantite, u)) + ' × ' : ''}${fmt(m.prix)} F${trTxt(m.transport_inclus, m.prix_transport)} · ${ago(m.created_at)}</div>`;
      const iss = m.issue === 'en_attente' && Date.parse(m.expire_le) <= Date.now() ? 'expiree' : m.issue;
      const IS = { en_attente: ['En attente · ' + reste(m.expire_le), 'acc'], acceptee: ['Acceptée', 'ok'], refusee: ['Refusée', 'bad'], retiree: ['Retirée', ''], remplacee: ['Remplacée par une nouvelle proposition', ''], expiree: ['Expirée sans réponse', ''] }[iss] || ['', ''];
      return `<div class="nx-tk${cls} is-${iss || 'x'}"><div class="who">${mk(R[m.auteur_id])}${who} ${mine ? 'proposez' : 'propose'}<span class="nx-tag ${IS[1]}">${IS[0]}</span></div>
        <div class="amt">${fmt(m.prix)} <small>F / ${esc(u)}</small></div>${trTag(m.transport_inclus, m.prix_transport)}${m.quantite ? `<div class="qty">${fq(m.quantite)} ${esc(uQ(m.quantite, u))} · total ${fmt(m.prix * m.quantite)} F${+m.prix_transport > 0 && m.transport_inclus === false ? ' + transport ' + fmt(m.prix_transport) + ' F' : ''}</div>` : ''}${m.texte ? `<div class="t">${esc(m.texte)}</div>` : ''}${when}</div>`;
    };
    const deal = () => { const u = n.unite || 'unité', q = n.quantite_finale, tr = n.transport_final, pt = tr === false && +n.prix_transport_final > 0 ? +n.prix_transport_final : 0;
      const ic = (d, t) => `<svg width="${t || 16}" height="${t || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
      const lien = window.MDGMessages ? `<a href="#" class="nx-dlink" data-deal-dm>${ic('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', 18)}Écrire ${autre(monRole(n)) === 'vendeur' ? 'au vendeur' : 'à l’acheteur'}</a>` : '';
      return `<div class="nx-deal" role="status">
      <div class="nx-dh"><span class="nx-dck">${ic('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 22).replace('stroke-width="2"', 'stroke-width="2.6"')}</span><div><b>Accord conclu</b><small>le ${jour(n.conclu_le || n.updated_at)}</small></div></div>
      <div class="nx-dl">${q ? `<div><span>Quantité</span><b>${fq(q)} ${esc(uQ(q, u))}</b></div>` : ''}<div><span>Prix convenu</span><b>${fmt(n.prix_final)} F / ${esc(u)}</b></div>${tr === true || tr === false ? `<div><span>Transport</span><b>${tr ? 'Compris dans le prix' : pt ? 'À part · ' + fmt(pt) + ' F' : 'Non compris'}</b></div>` : ''}${q ? `<div class="tot"><span>Total${pt ? ' avec le transport' : ''}</span><b>${fmt(n.prix_final * q + pt)} F</b></div>` : ''}</div>
      ${n.conditions_finales ? `<p class="nx-cond"><span>Conditions</span>${esc(n.conditions_finales)}</p>` : ''}
      <p class="nx-dnote">${ic('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 15)}Prix${pt ? ', transport' : ''} et quantité sont figés. Rien n’est encore payé ni livré.</p>
      ${window.MDGIdentite && MDGIdentite.gardePaiement ? `<p class="nx-warn">${MDGIdentite.gardePaiement(autreId(n), avDe(n, 40).nom || '')}</p>` : '<p class="nx-dnote">Voyez la marchandise avant de payer.</p>'}
      ${window.MDGCommandes ? `<button type="button" class="nx-go" data-deal-cmd>${ic('<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>', 20)}Suivre la commande</button>` : ''}
      ${lien}${lien ? `<p class="nx-dsafe">${ic('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 13)}Restez ici : en cas de litige, l’équipe peut vérifier vos échanges.</p>` : ''}</div>`; };
    const paint = anim => {
      if (!bg || !n) return;
      const lui = autre(monRole(n)), u = n.unite || 'unité', proprio = me() === n.proprio_id;
      const av = avDe(n, 40); $('.nx-h').classList.toggle('has-av', !!av.svg); let ha = $('.nx-h .nx-hav'); if (!ha && av.svg) { ha = document.createElement('span'); ha.className = 'nx-hav'; $('.nx-h h2').before(ha); } if (ha) ha.innerHTML = av.svg;
      $('.nx-h h2').innerHTML = esc(n.produit || 'Négociation') + `<small>Avec ${leLa(lui)}${av.nom ? ' ' + esc(av.nom) : ''}${window.MDGStatut ? ' ' + MDGStatut.puces(autreId(n), { max: 1, t: 14 }) : ''}${n.ville ? ' · ' + esc(n.ville) : ''}${n.quantite ? ' · annonce de ' + fq(n.quantite) + ' ' + esc(uQ(n.quantite, u)) : ''}</small>`;
      const e = etat(n);
      $('.nx-top').innerHTML = `<div class="nx-state"><span class="nx-tag ${e.c}">${esc(e.t)}</span>${n.prix_annonce ? `<span>Prix affiché ${fmt(n.prix_annonce)} F / ${esc(u)}</span>` : ''}</div>` + rail(n, msgs)
        + (proprio && dispo && dispo.quantite ? `<p class="nx-dispo">Sur votre annonce : ${fq(dispo.convenue)} / ${fq(dispo.quantite)} ${esc(uQ(dispo.quantite, u))} déjà convenus${dispo.en_cours > 1 ? ' · ' + (dispo.en_cours - 1) + ' autre' + (dispo.en_cours > 2 ? 's' : '') + ' négociation' + (dispo.en_cours > 2 ? 's' : '') + ' en cours' : ''}</p>` : '');
      const box = $('.nx-msgs'), seen = box.childElementCount;
      box.innerHTML = (msgs || []).map((m, i) => ticket(m, i, seen, anim)).join('');
      $('.nx-bottom').innerHTML = n.statut === 'conclue' ? deal() : '';
      // en bas du fil : noter la personne (étoiles, v3/reputation.js) et retirer la négociation de sa liste
      const idLui = autreId(n), R = window.MDGRep;
      const offL = !!(window.MDGStatut && MDGStatut.estOfficiel && MDGStatut.estOfficiel(idLui));   // le Marché de Gros officiel : ni note ni signalement
      $('.nx-bottom').insertAdjacentHTML('beforeend', `<div class="nx-plus">${R && !offL ? `<button type="button" class="nx-pl" data-profil>Voir son profil</button>` : ''}${window.MDGMessages ? '<button type="button" class="nx-pl" data-ecrire>Écrire en privé</button>' : ''}<button type="button" class="nx-pl" data-cacher>Retirer de ma liste</button>${!offL && window.MDGIdentite && MDGIdentite.signaler ? '<button type="button" class="nx-pl" data-signaler>Signaler cette personne</button>' : ''}</div>`);
      const bS = $('[data-signaler]'); if (bS) bS.onclick = () => MDGIdentite.signaler(idLui, { nom: av.nom || '', source: 'negociation', ref: n.id });
      const bN = $('[data-noter]'), bP = $('[data-profil]'), bC = $('[data-cacher]'), bE = $('[data-ecrire]');
      if (bE) bE.onclick = () => { close(); MDGMessages.ecrire(idLui, { nom: av.nom || 'Membre' }); };
      const bCmd = $('[data-deal-cmd]'); if (bCmd) bCmd.onclick = () => { const nn = n; close(); MDGCommandes.depuisAccord(nn); };
      const bD = $('[data-deal-dm]'); if (bD) bD.onclick = e => { e.preventDefault(); close(); MDGMessages.ecrire(idLui, { nom: av.nom || 'Membre' }); };
      // l'avis se donne après une commande terminée, depuis Mes commandes (schéma 32) : plus de bouton « Noter » ici
      if (bP) bP.onclick = () => R.profil(idLui, { nom: av.nom || 'Membre', uri: avDe(n, 72).uri || '' });
      if (bC) bC.onclick = async () => { try { await masquer(n.id); inbox(); } catch (_) { N().toast('Impossible pour l’instant. Réessayez.'); } };
      pied();
      if (anim) { const b = $('.nx-b'); b.scrollTop = b.scrollHeight; }
    };
    // pied : les actions possibles selon l'état et le rôle
    function pied() {
      const f = $('.nx-f'), u = n.unite || 'unité', lui = autre(monRole(n)), a = annonce(), keep = f.querySelector('.nx-comp textarea') ? f.querySelector('.nx-comp textarea').value : '';
      let h = '';
      const P = n.dernier_prix, Q = n.dernier_quantite, prop = (msgs || []).find(m => m.id === n.dernier_msg);
      if (mode === 'edit') h = `<div class="nx-edbox nx-edf"></div><button type="button" class="nx-alt nx-cancel" style="width:100%;margin-top:8px">Annuler</button>`;
      else if (mode === 'accord') h = `<div class="nx-confirm"><b>Vous acceptez :</b><div class="nx-big">${Q ? fq(Q) + ' ' + esc(uQ(Q, u)) + ' × ' : ''}${fmt(P)} F / ${esc(u)}</div>${(() => { const ti = prop ? prop.transport_inclus : n.dernier_transport, tpx = prop ? prop.prix_transport : n.dernier_prix_transport, x = ti === false && +tpx > 0 ? +tpx : 0;
          return (ti === true || ti === false ? `<div class="nx-dtot">Transport : ${ti ? 'inclus' : x ? 'à part, ' + fmt(x) + ' F' : 'à la charge de l’acheteur'}</div>` : '') + (Q ? `<div class="nx-dtot">Total${x ? ' avec le transport' : ''} : ${fmt(P * Q + x)} F</div>` : ''); })()}${prop && prop.texte ? `<p class="nx-cond"><span>Conditions</span>${esc(prop.texte)}</p>` : ''}<p>Une fois confirmé, l’accord est figé : il ne pourra plus être modifié. Ce n’est pas un paiement.</p>${window.MDGIdentite && MDGIdentite.gardePaiement ? `<p class="nx-warn" style="margin:0 0 12px">${MDGIdentite.gardePaiement(autreId(n), avDe(n, 40).nom || '')}</p>` : ''}
        <div class="nx-act"><button type="button" class="nx-go" data-g="accord-ok">Confirmer l’accord</button><button type="button" class="nx-alt" data-g="annuler" style="grid-column:1 / -1">Retour</button></div><p class="nx-err" role="alert"></p></div>`;
      else {
        if (n.statut === 'ouverte' && aMoi(n)) h += `<div class="nx-pend"><span>${Le(lui)} propose ${Q ? fq(Q) + ' ' + esc(uQ(Q, u)) + ' × ' : ''}<b>${fmt(P)} F</b>${Q ? ' = ' + fmt(P * Q) + ' F' : ''}${trTxt(n.dernier_transport, n.dernier_prix_transport)} · ${reste(n.expire_le)}</span></div>
          <div class="nx-act"><button type="button" class="nx-go" data-g="accord">Accepter ${fmt(P)} F / ${esc(u)}</button><button type="button" class="nx-alt" data-g="edit">Contre-proposer</button><button type="button" class="nx-alt" data-g="refus">Refuser</button></div>`;
        else if (n.statut === 'ouverte' && enCours(n)) h += `<div class="nx-pend"><span>Votre proposition : ${Q ? fq(Q) + ' ' + esc(uQ(Q, u)) + ' × ' : ''}<b>${fmt(P)} F</b> · en attente, ${reste(n.expire_le)}</span></div>
          <div class="nx-act"><button type="button" class="nx-alt" data-g="edit">Modifier ma proposition</button><button type="button" class="nx-alt" data-g="retrait">Retirer ma proposition</button></div>`;
        else if (n.statut === 'ouverte') h += `<div class="nx-act"><button type="button" class="nx-go" data-g="edit">${expiree(n) ? 'Faire une nouvelle proposition' : 'Faire une proposition'}</button></div>`;
        else if (n.statut === 'close' && n.motif_fin !== 'annonce_retiree' && a) h += `<div class="nx-act"><button type="button" class="nx-alt" data-g="edit" style="grid-column:1 / -1">Relancer avec une proposition</button></div>`;
        h += `<div class="nx-comp"><textarea maxlength="500" placeholder="Écrire un message" aria-label="Message à ${leLa(lui)}"></textarea><button type="button" class="nx-ib" data-g="texte" aria-label="Envoyer le message">${window.MDGIco ? MDGIco.svg('envoyer', 20, 2) : '↑'}</button></div>
          ${n.statut === 'ouverte' ? '<p class="nx-stop"><button type="button" data-g="fin">Arrêter la négociation</button></p>' : ''}<p class="nx-err" role="alert"></p>`;
      }
      f.innerHTML = h;
      const ta = f.querySelector('.nx-comp textarea'); if (ta) ta.value = keep;
      f.querySelectorAll('[data-g]').forEach(b => b.onclick = () => act(b.dataset.g));
      const c = f.querySelector('.nx-cancel'); if (c) c.onclick = () => { mode = ''; pied(); };
      if (mode === 'edit') {
        const proprio = me() === n.proprio_id;
        editeur(f.querySelector('.nx-edbox'), { cible: n.cible, tr0: n.dernier_transport != null ? trDe(n.dernier_transport, n.dernier_prix_transport) : trAnnonce(n.cible, a && a.transport), pt0: n.dernier_prix_transport, prixRef: n.prix_annonce, unite: u, qmax: (a && a.quantity) || n.quantite, q0: n.dernier_quantite || n.quantite, negociable: a ? a.negociable : true, qmin: !proprio && a ? +a.qteMin || 0 : 0, pour: lui, moi: proprio ? 'proprio' : 'auteur', dernier: aMoi(n) ? n.dernier_prix : null },
          async v => { await envoyer('nego_agir', { nego: n.id, action: 'prix', prix: v.p, quantite: v.q, texte: v.t || null, ref: null }, v, n.id); mode = ''; await load(true); N().toast('Proposition envoyée.'); },
          aMoi(n) ? 'Contre-proposer' : 'Proposer');
      }
    }
    async function act(g) {
      const f = $('.nx-f'), e = f.querySelector('.nx-err');
      if (g === 'edit' || g === 'accord') { mode = g; pied(); return; }
      if (g === 'annuler') { mode = ''; pied(); return; }
      if (g === 'fin' && !await (window.MDGDemande ? MDGDemande.oui('Arrêter cette négociation ? Une proposition en attente sera retirée. Vous pourrez relancer plus tard.', { ok: 'Arrêter', danger: true }) : Promise.resolve(confirm('Arrêter cette négociation ? Une proposition en attente sera retirée. Vous pourrez relancer plus tard.')))) return;
      if (g === 'refus' && !await (window.MDGDemande ? MDGDemande.oui('Refuser cette proposition ? Vous pourrez ensuite faire la vôtre.', { ok: 'Refuser' }) : Promise.resolve(confirm('Refuser cette proposition ? Vous pourrez ensuite faire la vôtre.')))) return;
      const args = { nego: n.id, action: g === 'accord-ok' ? 'accord' : g, prix: null, quantite: null, texte: null, ref: ['accord-ok', 'refus'].includes(g) ? n.dernier_msg : null };
      if (g === 'texte') { args.texte = f.querySelector('textarea').value.trim(); if (!args.texte) return; }
      if (!navigator.onLine) { if (e) e.textContent = 'Pas de connexion internet. Réessayez quand le réseau revient.'; return; }
      f.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        await N().rpc('nego_agir', args);
        if (g === 'texte') f.querySelector('textarea').value = '';
        mode = ''; await load(true);
        if (g === 'accord-ok') { N().toast('Accord conclu. Convenez de la livraison et du paiement.'); window.MDGSons && MDGSons.signal('accord'); }
        if (g === 'retrait') N().toast('Proposition retirée.');
      } catch (x) { if (e) e.textContent = err(x); f.querySelectorAll('button').forEach(b => { b.disabled = false; }); if (/changé entre-temps|expiré/.test(x.message)) { mode = ''; load(true); } }
    }
    async function load(anim) {
      try {
        const [nn, mm] = await Promise.all([one(id), messages(id)]);
        if (!bg) return; if (!nn) { $('.nx-b').innerHTML = '<div class="nx-empty">' + (window.MDGSac ? MDGSac.svg('triste', { t: 60 }) : '') + '<b>Négociation introuvable</b>Elle a peut-être été retirée.</div>'; $('.nx-f').innerHTML = ''; return; }
        const changed = !msgs || mm.length !== msgs.length || nn.updated_at !== n.updated_at || mm.some((m, i) => msgs[i] && m.issue !== msgs[i].issue);
        const i = liste.findIndex(x => x.id === id), avant = i >= 0 ? [liste[i]] : [];
        n = nn; msgs = mm; if (i >= 0) liste[i] = nn; else liste.unshift(nn);
        if (avant.length && !anim) evenements(avant, [nn]);
        if (me() === nn.proprio_id && (!dispo || changed)) N().rpc('nego_dispo', { cible: nn.cible, cible_id: nn.cible_id }).then(r => { dispo = r && r[0]; if (bg && mode === '') paint(false); }).catch(() => {});
        if (changed && mode === '') paint(anim !== false);
        if (nonLu(nn)) N().rpc('marquer_lu', { nego: id }).then(() => { nn[me() === nn.auteur_id ? 'lu_auteur' : 'lu_proprio'] = new Date().toISOString(); W(KL, liste); announce(); }).catch(() => {});
      } catch (e) { if (bg && !msgs) $('.nx-msgs').innerHTML = '<div class="nx-ev">Pas de réseau : la négociation s’affichera quand la connexion revient.</div>'; }
    }
    redessiner = () => { if (mode === '') paint(false); };
    if (n) paint(false);
    await load(true);
    clearInterval(poll); poll = setInterval(() => { if (!document.hidden && navigator.onLine && bg) load(false); }, 7000);
  }

  // boutons « Proposer un prix » portant data-negocier (site)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-negocier]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { proposer(JSON.parse(b.getAttribute('data-negocier'))); } catch (_) {}
  }, true);

  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte') { if (!me()) { liste = []; W(KL, []); } refresh(); } });
  addEventListener('online', refresh);
  setTimeout(refresh, 1500);
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // en arrière-plan, on continue de relire (plus lentement) pour pouvoir signaler au retour
  setInterval(() => { if (document.hidden) refresh(); }, 180000);

  // ce qui est en cours, pour Accueil → Activité : propositions en attente (à moi ou à l'autre) et accords conclus depuis moins de 3 jours
  function activite() {
    if (!me()) return [];
    return liste.filter(n => enCours(n) || (n.statut === 'conclue' && Date.now() - Date.parse(n.updated_at) < 3 * 864e5)).map(n => {
      const e = etat(n), av = avDe(n, 40), p = n.statut === 'conclue' ? n.prix_final : n.dernier_prix;
      return { k: 'nego', id: n.id, titre: n.produit || 'Négociation', avec: av.nom || leLa(autre(monRole(n))), etat: n.statut === 'conclue' ? 'ok' : aMoi(n) ? 'moi' : 'attente',
        tag: e.t, prix: p ? fmt(p) + ' F / ' + (n.unite || 'unité') : '', ts: Date.parse(n.updated_at) || 0, ouvrir: () => thread(n.id) }; });
  }
  window.MDGNegoce = { proposer, inbox, thread, unread, refresh, masquer, glisser, activite };
})();
