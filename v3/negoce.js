/* ═════════ Marché de Gros CI — Négoce : proposer, contre-proposer, conclure ═════════
   Le site et l'application utilisent ce même module (au-dessus de v3/nuage.js ; sons : v3/sons.js).
   Une négociation porte sur une annonce partagée (offre ou demande) entre la personne qui l'a publiée et une autre.
   • Une proposition = prix + quantité + conditions. Elle attend une réponse 48 h, puis expire.
   • L'autre partie l'accepte (après un résumé), la refuse ou fait une contre-proposition ; l'auteur peut la retirer.
   • L'accord fige les conditions (prix, quantité, conditions, date). Ce n'est ni un paiement ni une livraison.
   • Toutes les règles sont vérifiées par la base (nego_ouvrir, nego_agir) : rien n'est simulé ici.
   • La règle des prix : cercle vert = vendeur, carré jaune = acheteur (le langage de la carte) ; à l'accord, ligne bleue.
   Notions distinctes, jamais confondues : prix affiché (l'annonce), prix proposé (en attente), prix convenu (l'accord).
   API : MDGNegoce.proposer(annonce) · inbox() · thread(id) · unread() · refresh()
   Un bouton peut porter data-negocier='{"cible":"offre","id":"…","produit":"…","prix":12000,"unite":"kg","quantite":20,"negociable":true}'.
   Événement : « mdg:negoce » (detail.unread). */
(function () {
  'use strict';
  const N = () => window.MDGNuage;
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

  // rôles : sur une offre, celui qui l'a publiée vend ; sur une demande, il achète
  const roles = n => { const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur'; return { [n.proprio_id]: owner, [n.auteur_id]: owner === 'vendeur' ? 'acheteur' : 'vendeur' }; };
  const monRole = n => roles(n)[me()];
  const autre = r => r === 'vendeur' ? 'acheteur' : 'vendeur';
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
    if (!bg && pf.toasts) N().toast(ev.length > 1 ? ev.length + ' nouveautés dans « Mes négociations ».' : ev[0][1]);
  }
  let first = true;
  async function refresh() {
    if (!N() || !N().session() || !navigator.onLine) { announce(); return liste; }
    try {
      const u = me(), r = await N().api('/rest/v1/negociations?select=*&or=(auteur_id.eq.' + u + ',proprio_id.eq.' + u + ')&order=updated_at.desc&limit=100', { auth: true });
      const avant = liste; liste = r || []; W(KL, liste);
      if (!first || avant.length) evenements(avant, liste); first = false;
    } catch (e) { if (e.code === 'auth') { liste = []; W(KL, []); } }
    announce(); return liste;
  }
  const messages = id => N().api('/rest/v1/messages?select=*&negociation_id=eq.' + id + '&order=created_at.asc&limit=300', { auth: true });
  const one = async id => { const r = await N().api('/rest/v1/negociations?select=*&id=eq.' + id, { auth: true }); return r && r[0]; };
  const err = x => x.message === 'Failed to fetch' ? 'Le serveur ne répond pas. Réessayez dans un instant.' : /nego_|schema cache|Could not find/i.test(x.message) ? 'La négociation n’est pas encore activée sur le serveur.' : x.message;

  /* ——— apparence ——— */
  const CSS = `.nx-bg{position:fixed;inset:0;z-index:8900;background:rgba(10,9,7,.62);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:nxIn .22s ease both}
@media (min-width:720px){.nx-bg{align-items:center;padding:24px}}
.nx{--v:#6CC58C;--a:#F2C94C;--ok:#6AAEF0;--ink:#F5F0E6;--mute:#B9AD98;--line:rgba(245,240,230,.12);--acc:#E07A3F;position:relative;display:flex;flex-direction:column;width:100%;max-width:560px;height:min(92dvh,820px);background:#1d1a15;color:var(--ink);border-radius:28px 28px 0 0;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:Jost,system-ui,sans-serif;font-variant-numeric:lining-nums;animation:nxUp .38s cubic-bezier(.22,1,.36,1) both;overflow:hidden}
@media (min-width:720px){.nx{border-radius:28px}}
.nx-h{display:flex;align-items:center;gap:10px;padding:18px 18px 12px;border-bottom:1px solid var(--line)}
.nx-h h2{flex:1;min-width:0;margin:0;font:500 26px/1.1 'Cormorant Garamond',Georgia,serif}
.nx-h h2 small{display:block;margin-top:3px;font:400 13.5px/1.35 Jost,sans-serif;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nx-ib{flex:none;width:42px;height:42px;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:var(--ink);font-size:20px;line-height:1;cursor:pointer}
.nx-ib:focus-visible,.nx button:focus-visible,.nx input:focus-visible,.nx textarea:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.nx-b{flex:1;overflow:auto;padding:16px 18px 20px;overscroll-behavior:contain}
.nx-f{padding:12px 18px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:#1a1712}
.nx-go{width:100%;min-height:54px;border:0;border-radius:999px;background:var(--acc);color:#171512;font:700 16px Jost,sans-serif;cursor:pointer}.nx-go[disabled]{opacity:.55;cursor:default}
.nx-alt{min-height:48px;padding:0 18px;border:1px solid rgba(245,240,230,.22);border-radius:999px;background:none;color:var(--ink);font:600 15px Jost,sans-serif;cursor:pointer}
.nx-err{min-height:18px;margin:8px 0 0;color:#F3B48A;font-size:14px}
.nx-note{margin:14px 0 0;color:#8f846f;font-size:12.5px;line-height:1.5}
/* la règle des prix */
.nx-rail{position:relative;margin:4px 0 6px;padding:46px 6px 34px}
.nx-rail .tr{position:relative;height:2px;background:repeating-linear-gradient(90deg,rgba(245,240,230,.28) 0 2px,transparent 2px 9px)}
.nx-rail .gap{position:absolute;top:-5px;height:12px;border-radius:6px;background:rgba(245,240,230,.10);transition:left .5s cubic-bezier(.22,1,.36,1),width .5s cubic-bezier(.22,1,.36,1)}
.nx-rail .gap.is-ok{top:-1px;height:4px;border-radius:2px;background:var(--ok)}
.nx-rail .pin{position:absolute;top:0;transform:translate(-50%,-50%);transition:left .5s cubic-bezier(.22,1,.36,1)}
.nx-rail .pin i{display:block;width:16px;height:16px}
.nx-rail .pin.v i{border-radius:50%;background:var(--v)}.nx-rail .pin.a i{border-radius:3px;background:var(--a);width:15px;height:15px}
.nx-rail .pin.off i{background:none;border:2px solid currentColor;opacity:.75}.nx-rail .pin.v.off{color:var(--v)}.nx-rail .pin.a.off{color:var(--a)}
.nx-rail .pin.ok i{width:18px;height:18px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 6px rgba(106,174,240,.2)}
.nx-rail .pin b{position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;font:600 13px/1 Jost,sans-serif}
.nx-rail .pin.up b{bottom:22px}.nx-rail .pin.dn b{top:22px}
.nx-rail .pin b small{display:block;margin-top:3px;font-weight:400;font-size:11.5px;color:var(--mute)}
.nx-rail .pin.dn b small{margin:0 0 3px}
.nx-rail .tick{position:absolute;top:-7px;width:2px;height:16px;background:rgba(245,240,230,.55);transform:translateX(-1px)}
.nx-rail .tick b{position:absolute;top:22px;left:50%;transform:translateX(-50%);white-space:nowrap;font:400 11.5px Jost,sans-serif;color:var(--mute)}
.nx-sum{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin:0 0 4px;font-size:14px;color:var(--mute)}
.nx-sum b{color:var(--ink);font-weight:600}
/* proposer */
.nx-ann{display:flex;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:18px;margin:0 0 18px}
.nx-ann .mk{flex:none}.nx-ann p{margin:0;font-size:14px;line-height:1.4;color:var(--mute)}.nx-ann p b{display:block;color:var(--ink);font-size:16px;font-weight:600}
.nx-px{display:flex;align-items:baseline;gap:10px;padding:6px 0 10px;border-bottom:2px solid var(--acc)}
.nx-px input{flex:1;min-width:0;border:0;background:none;color:var(--ink);font:500 clamp(44px,13vw,64px)/1 'Cormorant Garamond',Georgia,serif;letter-spacing:-.01em;padding:0;outline:none}
.nx-px input::placeholder{color:rgba(245,240,230,.25)}.nx-px span{flex:none;color:var(--mute);font-size:16px}
.nx-lbl{display:block;margin:0 0 4px;color:var(--mute);font-size:13.5px}
.nx-chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
.nx-chip{min-height:40px;padding:0 14px;border:1px solid rgba(245,240,230,.18);border-radius:999px;background:none;color:var(--ink);font:500 14px Jost,sans-serif;cursor:pointer}
.nx-chip[aria-pressed=true]{background:var(--ink);color:#171512;border-color:var(--ink)}
.nx-delta{min-height:22px;margin:8px 0 0;font-size:14.5px;line-height:1.45;color:var(--ink)}.nx-delta small{color:var(--mute);font-size:13px}
.nx textarea{width:100%;box-sizing:border-box;min-height:76px;margin:6px 0 0;padding:12px 14px;border:1px solid rgba(245,240,230,.16);border-radius:16px;background:#14120f;color:var(--ink);font:400 15px/1.45 Jost,sans-serif;resize:vertical}
.nx-sec{margin:22px 0 0}
/* boîte */
.nx-grp{margin:0 0 22px}.nx-grp h3{margin:0 0 10px;font:500 20px/1.2 'Cormorant Garamond',serif;color:var(--ink)}
.nx-row{display:grid;grid-template-columns:auto 1fr auto;gap:4px 12px;align-items:center;width:100%;padding:12px 14px;margin:0 0 8px;border:1px solid var(--line);border-radius:18px;background:rgba(245,240,230,.03);color:var(--ink);text-align:left;font:inherit;cursor:pointer}
.nx-row:hover{background:rgba(245,240,230,.07)}
.nx-row .mk{grid-row:span 2}.nx-row b{font-weight:600;font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-row small{grid-column:2;color:var(--mute);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-row .p{grid-row:span 2;text-align:right;font:500 22px/1 'Cormorant Garamond',serif}.nx-row .p small{display:block;margin-top:4px;font:400 11.5px Jost,sans-serif}
.nx-row.is-new{border-color:rgba(224,122,63,.6)}.nx-row.is-new b::after{content:'';display:inline-block;width:8px;height:8px;margin-left:8px;border-radius:50%;background:var(--acc);vertical-align:middle}
.nx-empty{padding:40px 8px;text-align:center;color:var(--mute);font-size:15px;line-height:1.55}.nx-empty b{display:block;margin:0 0 6px;font:500 24px/1.2 'Cormorant Garamond',serif;color:var(--ink)}
/* fil */
.nx-msgs{display:flex;flex-direction:column;gap:10px;margin:14px 0 0}
.nx-m{max-width:82%;padding:10px 14px;border-radius:18px;font-size:15px;line-height:1.45;background:rgba(245,240,230,.07);align-self:flex-start;white-space:pre-wrap;overflow-wrap:anywhere}
.nx-m.me{align-self:flex-end;background:#F5F0E6;color:#171512}
.nx-m time{display:block;margin-top:4px;font-size:11.5px;opacity:.6}
.nx-tk time{display:block;margin-top:6px;font-size:11.5px;color:var(--mute)}
.nx-tk{align-self:flex-start;min-width:200px;max-width:86%;padding:12px 16px 12px;border-radius:18px;border:1px solid var(--line);background:#16130f}
.nx-tk.me{align-self:flex-end}
.nx-tk .who{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mute)}
.nx-tk .amt{margin:6px 0 2px;font:500 34px/1 'Cormorant Garamond',serif}.nx-tk .amt small{font:400 14px Jost,sans-serif;color:var(--mute)}
.nx-tk .t{margin-top:6px;font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.nx-tk.is-refus .amt{text-decoration:line-through;text-decoration-thickness:2px;opacity:.6}
.nx-tk.is-accord{border-color:var(--ok);background:rgba(106,174,240,.08)}
.nx-ev{align-self:center;padding:6px 12px;border-radius:999px;background:rgba(245,240,230,.06);color:var(--mute);font-size:12.5px;text-align:center}
.nx-deal{margin:16px 0 0;padding:16px;border-radius:20px;background:rgba(106,174,240,.1);border:1px solid rgba(106,174,240,.45)}
.nx-deal b{display:block;font:500 26px/1.15 'Cormorant Garamond',serif}.nx-deal p{margin:6px 0 12px;color:var(--mute);font-size:14px;line-height:1.5}
.nx-deal a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;margin:0 8px 0 0;border-radius:999px;background:var(--ink);color:#171512;font-weight:600;text-decoration:none}
.nx-act{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}.nx-act .nx-go{grid-column:1 / -1}
.nx-comp{display:flex;gap:8px;align-items:flex-end}
.nx-comp textarea{flex:1;min-height:48px;height:48px;margin:0;resize:none}
.nx-comp .nx-ib{width:48px;height:48px;background:var(--acc);color:#171512}
.nx-cp{display:flex;gap:8px;align-items:center;margin:0 0 10px}.nx-cp input{flex:1;min-width:0;height:48px;padding:0 14px;border:1px solid rgba(245,240,230,.16);border-radius:14px;background:#14120f;color:var(--ink);font:500 18px Jost,sans-serif}
.nx-tag{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;font:600 12px/1.5 Jost,sans-serif;background:rgba(245,240,230,.08);color:var(--mute);white-space:nowrap}
.nx-tag.ok{background:rgba(106,174,240,.16);color:#A9CDF5}.nx-tag.acc{background:rgba(224,122,63,.2);color:#F3B48A}.nx-tag.wait{background:rgba(242,201,76,.14);color:#F2DC9A}.nx-tag.bad{background:rgba(226,115,91,.16);color:#F3A08C}
.nx-row small .nx-tag{margin:0 4px 0 0}
.nx-state{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-size:13.5px;color:var(--mute)}.nx-state .nx-tag{margin:0}
.nx-dispo{margin:4px 0 0;font-size:13.5px;color:var(--mute)}
.nx-tk .qty{margin-top:2px;font-size:13.5px;color:var(--mute)}
.nx-tk.is-remplacee,.nx-tk.is-retiree,.nx-tk.is-expiree{opacity:.62}.nx-tk.is-refusee .amt{text-decoration:line-through;text-decoration-thickness:2px;opacity:.7}.nx-tk.is-acceptee{border-color:var(--ok)}
.nx-tk .who .nx-tag{margin-left:auto}
.nx-ev-ok{background:rgba(106,174,240,.13);color:#CFE3FA}
.nx-qr{margin:16px 0 0}.nx-q{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.nx-q input{width:140px;height:48px;padding:0 14px;border:1px solid rgba(245,240,230,.16);border-radius:14px;background:#14120f;color:var(--ink);font:500 18px Jost,sans-serif}.nx-q span{color:var(--mute)}
.nx-tot{display:flex;flex-direction:column;gap:6px;margin:14px 0 0}.nx-sum small{font-weight:400;color:var(--mute)}
.nx-warn{margin:8px 0 0;padding:10px 12px;border-radius:14px;background:rgba(224,122,63,.12);color:#F3D2BC;font-size:13.5px;line-height:1.45}
.nx-send{margin-top:16px}.nx-edf{max-height:min(60dvh,560px);overflow:auto;padding:2px}
.nx-pend{margin:0 0 10px;padding:12px 14px;border-radius:16px;background:rgba(245,240,230,.05);font-size:14.5px;line-height:1.45}.nx-pend b{font-weight:700}
.nx-confirm>b{color:var(--mute);font-size:14px;font-weight:600}.nx-big{margin:6px 0 2px;font:500 34px/1.1 'Cormorant Garamond',serif}.nx-dtot{font-size:15px;font-weight:600}
.nx-confirm>p{margin:10px 0 12px;color:var(--mute);font-size:13.5px;line-height:1.5}
.nx-cond{margin:10px 0 0!important;padding:10px 12px;border-left:2px solid var(--ok);border-radius:0 12px 12px 0;background:rgba(106,174,240,.06);color:var(--ink)!important;font-size:14px;line-height:1.45}.nx-cond span{display:block;color:var(--mute);font-size:12px}
.nx-deal .nx-tag{margin:0 0 8px}.nx-deal a.ghost{background:none;border:1px solid rgba(245,240,230,.3);color:var(--ink)}
.nx-stop{margin:8px 0 0;text-align:center}.nx-stop button{min-height:36px;border:0;background:none;color:#8f846f;font:500 13px Jost,sans-serif;text-decoration:underline;cursor:pointer}
.nx-in{color:var(--ink);font-weight:600}
.nx-snd s{opacity:.6}
.nx-av{position:relative;grid-row:span 2;width:36px;height:36px}.nx-av svg{display:block;border-radius:50%}.nx-av i{position:absolute;right:-4px;bottom:-4px;display:grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#1d1a15}.nx-av i svg{width:14px;height:14px}
.nx-hav{flex:none;width:40px;height:40px}.nx-hav svg{display:block;border-radius:50%}
@keyframes nxIn{from{opacity:0}}@keyframes nxUp{from{transform:translateY(28px);opacity:0}}
@keyframes nxPop{from{transform:scale(.92);opacity:0}}.nx-new{animation:nxPop .32s cubic-bezier(.22,1,.36,1) both}
/* proposer un prix (12/10/2026) : le montant d'abord, en chiffres droits ; un trait qui s'allume au lieu d'un cadre ; prix rapides en deux lignes */
.nx-ann{gap:14px;padding:14px 16px;border-radius:20px;background:rgba(245,240,230,.035)}
.nx-ann p{font-size:13.5px}.nx-ann p b{font-size:15.5px;margin-bottom:2px}
.nx-ed>.nx-lbl:first-of-type{margin-top:4px}
.nx-px{position:relative;align-items:flex-end;gap:12px;padding:4px 0 12px;border-bottom:1px solid rgba(245,240,230,.2)}
.nx-px::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:0 50%;transition:transform .32s cubic-bezier(.22,1,.36,1)}
.nx-px:focus-within::after{transform:scaleX(1)}
.nx .nx-px input,.nx .nx-px input:focus,.nx .nx-px input:focus-visible{outline:none!important;box-shadow:none!important}
.nx-px input{font:300 clamp(46px,12vw,68px)/1 Jost,system-ui,sans-serif;letter-spacing:-.025em;font-variant-numeric:lining-nums tabular-nums}
.nx-px input{font-size:clamp(46px,12vw,68px)!important}
.nx-px input::placeholder{color:rgba(245,240,230,.2)}
.nx-px span{padding-bottom:8px;font-size:15px}
.nx-pq{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:6px;margin:14px 0 2px}
@media (max-width:520px){.nx-pq{grid-template-columns:repeat(2,minmax(0,1fr))}}
.nx-pq .nx-chip{display:grid;align-content:center;gap:2px;min-height:58px;padding:8px 12px;border-radius:16px;border-color:rgba(245,240,230,.14);text-align:left;font:600 16px/1.1 Jost,sans-serif;font-variant-numeric:tabular-nums;transition:background .2s,border-color .2s,color .2s}
.nx-pq .nx-chip small{font:500 12px/1.2 Jost,sans-serif;color:var(--mute);transition:color .2s}
.nx-pq .nx-chip:hover{border-color:rgba(245,240,230,.34);background:rgba(245,240,230,.04)}
.nx-pq .nx-chip[aria-pressed=true]{background:var(--ink);border-color:var(--ink);color:#171512}.nx-pq .nx-chip[aria-pressed=true] small{color:#5d5446}
.nx-q{gap:8px}.nx-q input{width:120px;height:52px;border-radius:14px;font:500 20px Jost,sans-serif;font-variant-numeric:tabular-nums;transition:border-color .2s}
.nx-q input:focus,.nx-q input:focus-visible,.nx textarea:focus,.nx textarea:focus-visible{outline:none!important;border-color:var(--acc)}
.nx-q .nx-chip{min-height:44px}
.nx-tot{margin:16px 0 0;padding:12px 14px;border-radius:16px;background:rgba(245,240,230,.04)}.nx-tot:empty{display:none}
.nx-cd{gap:6px}.nx-cd .nx-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:13.5px;border-color:rgba(245,240,230,.14)}
.nx-cd .nx-chip::before{content:"";width:14px;height:14px;border-radius:4px;box-shadow:inset 0 0 0 1.5px rgba(245,240,230,.4);transition:background .2s,box-shadow .2s}
.nx-cd .nx-chip[aria-pressed=true]{background:rgba(245,240,230,.08);border-color:rgba(245,240,230,.34);color:var(--ink)}
.nx-cd .nx-chip[aria-pressed=true]::before{background:var(--ink) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='m3.5 7.2 2.3 2.3 4.7-4.9' fill='none' stroke='%23171512' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/14px no-repeat;box-shadow:none}
.nx textarea{min-height:64px;border-radius:14px;transition:border-color .2s}
.nx-send{position:sticky;bottom:0;margin-top:18px;box-shadow:0 -14px 24px 6px #1d1a15}
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
  const head = (t, sub, back) => `<div class="nx-h">${back ? '<button type="button" class="nx-ib" data-back aria-label="Retour à mes négociations">‹</button>' : ''}<h2>${esc(t)}${sub ? `<small>${esc(sub)}</small>` : ''}</h2><button type="button" class="nx-ib" data-x aria-label="Fermer">×</button></div>`;
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
    if (n.prix_annonce && !(ok && same(n.prix_final, n.prix_annonce)) && !(last.vendeur && same(last.vendeur.p, n.prix_annonce) && last.acheteur && same(last.acheteur.p, n.prix_annonce))) h += `<span class="tick" style="left:${x(n.prix_annonce)}"><b>affiché ${fmt(n.prix_annonce)}</b></span>`;
    if (ok) h += `<span class="gap is-ok" style="left:0;width:100%"></span><span class="pin ok up" style="left:${x(n.prix_final)}"><i></i><b>${fmt(n.prix_final)} F<small>convenu</small></b></span>`;
    else {
      const v = last.vendeur, a = last.acheteur;
      if (v && a && same(v.p, a.p)) return h + `<span class="pin ok up" style="left:${x(v.p)}"><i></i><b>${fmt(v.p)} F<small>même prix des deux côtés</small></b></span></div></div>`;
      if (v && a) { const l = Math.min(v.p, a.p), r = Math.max(v.p, a.p); h += `<span class="gap" style="left:${x(l)};width:calc(${x(r)} - ${x(l)})"></span>`; }
      if (v) h += `<span class="pin v up${v.live ? '' : ' off'}" style="left:${x(v.p)}"><i></i><b>${fmt(v.p)}<small>vendeur</small></b></span>`;
      if (a) h += `<span class="pin a ${v ? 'dn' : 'up'}${a.live ? '' : ' off'}" style="left:${x(a.p)}"><i></i><b>${v ? '<small>acheteur</small>' : ''}${fmt(a.p)}${v ? '' : '<small>acheteur</small>'}</b></span>`;
    }
    return h + '</div></div>';
  }

  /* ——— l'éditeur de proposition (nouvelle proposition, contre-proposition, relance) ——— */
  // ctx : { cible, prixRef (prix affiché), unite, qmax, q0, negociable, pour (le rôle qui reçoit), dernier (dernier prix de l'autre) }
  function editeur(box, ctx, onSend, label) {
    const u = ctx.unite || 'unité', sens = ctx.cible === 'offre' ? -1 : 1, ref = +ctx.prixRef || 0, fixe = ctx.negociable === false && ctx.moi !== 'proprio';
    const chips = ref && !fixe ? [5, 10, 15].map(p => ({ v: arrondi(ref * (1 + sens * p / 100)), t: (sens < 0 ? '−' : '+') + p + ' %' })) : [];
    box.innerHTML = `<div class="nx-ed">
      ${fixe ? `<p class="nx-warn">Prix ferme : ${ctx.pour === 'vendeur' ? 'le vendeur' : 'l’acheteur'} n’accepte pas d’autre prix. Vous pouvez proposer le prix affiché et une quantité.</p>` : ''}
      <label class="nx-lbl" for="nxP">Prix par ${esc(u)}</label>
      <div class="nx-px"><input id="nxP" inputmode="numeric" autocomplete="off" placeholder="${ref ? fmt(chips[1] ? chips[1].v : ref) : '0'}" ${fixe ? `value="${fmt(ref)}" readonly` : ''} aria-describedby="nxD"><span>F / ${esc(u)}</span></div>
      <div class="nx-chips nx-pq" role="group" aria-label="Prix rapides">${ref ? `<button type="button" class="nx-chip" data-v="${ref}" aria-pressed="false"><small>Prix affiché</small>${fmt(ref)}</button>` : ''}${ctx.dernier && ctx.dernier !== ref ? `<button type="button" class="nx-chip" data-v="${ctx.dernier}" aria-pressed="false"><small>Sa proposition</small>${fmt(ctx.dernier)}</button>` : ''}${chips.map(c => `<button type="button" class="nx-chip" data-v="${c.v}" aria-pressed="false"><small>${c.t}</small>${fmt(c.v)}</button>`).join('')}</div>
      <div class="nx-qr"><label class="nx-lbl" for="nxQ">Quantité</label><div class="nx-q"><input id="nxQ" inputmode="decimal" autocomplete="off" value="${ctx.q0 ? fq(ctx.q0) : ''}" placeholder="—"><span>${esc(u)}</span>${ctx.qmax ? `<button type="button" class="nx-chip" data-q="${ctx.qmax}">Tout le lot · ${fq(ctx.qmax)}</button>` : ''}</div></div>
      <div class="nx-tot" id="nxD" aria-live="polite"></div>
      <div class="nx-prev"></div>
      <label class="nx-lbl" for="nxT" style="margin-top:14px">Conditions (facultatif)</label>
      <div class="nx-chips nx-cd" style="margin-top:4px">${(ctx.pour === 'vendeur' ? ['Paiement à la livraison', 'Je viens chercher', 'Livraison sous 3 jours'] : ['Je peux livrer', 'Disponible maintenant', 'Qualité vérifiable sur place']).map(t => `<button type="button" class="nx-chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <textarea id="nxT" maxlength="500" placeholder="Livraison, paiement, délai…"></textarea>
      <button type="button" class="nx-go nx-send" disabled>${esc(label || 'Envoyer ma proposition')}</button><p class="nx-err" role="alert"></p></div>`;
    const $ = s => box.querySelector(s), ip = $('#nxP'), iq = $('#nxQ'), go = $('.nx-send'), out = $('#nxD');
    const vals = () => ({ p: num(ip.value), q: num(iq.value) || null, t: $('#nxT').value.trim() });
    const upd = () => {
      const { p, q } = vals(); go.disabled = !p || (ctx.qmax && q > ctx.qmax);
      go.textContent = p ? (label || 'Proposer') + ' ' + fmt(p) + ' F / ' + u + (q ? ' × ' + fq(q) : '') : (label || 'Envoyer ma proposition');
      box.querySelectorAll('.nx-chip[data-v]').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.v === p)));
      let h = '';
      if (p && q) h += `<div class="nx-sum"><span>Total</span><b>${fq(q)} ${esc(u)} × ${fmt(p)} F = ${fmt(p * q)} F</b></div>`;
      if (p && ref) { const e = p - ref, pc = Math.round(Math.abs(e) / ref * 100); h += `<div class="nx-sum"><span>Par rapport au prix affiché</span><b>${Math.abs(e) < 1 ? 'identique' : (e < 0 ? '−' : '+') + fmt(Math.abs(e)) + ' F (' + (e < 0 ? '−' : '+') + pc + ' %)'}${Math.abs(e) >= 1 && q ? `<small> soit ${fmt(Math.abs(e) * q)} F ${e < 0 ? 'de moins' : 'de plus'} au total</small>` : ''}</b></div>`;
        if (p < ref * 0.25 || p > ref * 4) h += `<p class="nx-warn">Ce prix est très loin du prix affiché (${fmt(ref)} F). Un zéro en trop ou en moins ?</p>`;
        else if (pc > 40) h += `<p class="nx-warn">Un écart de plus de 40 % a peu de chances d’être accepté.</p>`; }
      if (ctx.qmax && q > ctx.qmax) h += `<p class="nx-warn">L’annonce porte sur ${fq(ctx.qmax)} ${esc(u)} au plus.</p>`;
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
      const v = vals(); go.disabled = true; go.setAttribute('aria-busy', 'true'); $('.nx-err').textContent = ''; go.textContent = 'Envoi';
      try { await onSend(v); } catch (x) { $('.nx-err').textContent = err(x); go.disabled = false; upd(); }
    };
    upd(); setTimeout(() => (fixe ? iq : ip).focus(), 60);
  }

  /* ——— proposer depuis une annonce ——— */
  function proposer(a) {
    if (!N()) return;
    if (!a || !a.id) return N().toast('Cette annonce n’est que sur cet appareil : la négociation n’est pas possible.');
    if (!N().session()) { N().open('negocie'); addEventListener('mdg:connecte', () => setTimeout(() => proposer(a), 400), { once: true }); return; }
    const cible = a.cible === 'demande' ? 'demande' : 'offre', deja = liste.find(n => n.cible === cible && n.cible_id === a.id && n.auteur_id === me());
    if (deja) return thread(deja.id);
    const prix = +a.prix || 0, u = a.unite || 'kg', q = +a.quantite || 0, lui = cible === 'offre' ? 'vendeur' : 'acheteur';
    redessiner = null;
    sheet(head('Proposer un prix', (a.produit || 'Annonce') + (a.ville ? ' · ' + a.ville : '')) + `
      <div class="nx-b">
        <div class="nx-ann">${mk(lui)}<p><b>${esc(a.produit || 'Annonce')}${q ? ' · ' + fq(q) + ' ' + esc(u) : ''}</b>${esc(a.nom || Le(lui))}${a.ville ? ', ' + esc(a.ville) : ''}<br>${prix ? (cible === 'offre' ? 'Prix affiché par le vendeur : ' : 'Budget affiché par l’acheteur : ') + '<b class="nx-in">' + fmt(prix) + ' F / ' + esc(u) + '</b>' : (cible === 'offre' ? 'Pas de prix affiché' : 'Pas de budget affiché')}${a.negociable === false ? ' · prix ferme' : ''}</p></div>
        <div class="nx-edbox"></div>
        <p class="nx-note">${Le(lui)} reçoit votre proposition et a 48 h pour l’accepter, la refuser ou proposer autre chose. Vous pouvez la retirer tant qu’il n’a pas répondu. Un accord fixe le prix et la quantité ; ce n’est pas un paiement : voyez la marchandise avant de payer.</p>
      </div>`, 'Proposer un prix');
    bindSnd();
    const fake = { cible, prix_annonce: prix || null, unite: u, statut: 'ouverte', proprio_id: 'lui', auteur_id: me() };
    editeur(bg.querySelector('.nx-edbox'), { cible, prixRef: prix, unite: u, qmax: q || null, q0: q || null, negociable: a.negociable, pour: lui, moi: 'auteur', preview: p => rail(fake, [{ genre: 'prix', auteur_id: me(), prix: p, issue: 'en_attente', expire_le: new Date(Date.now() + 864e5).toISOString() }]) },
      async v => { const id = await N().rpc('nego_ouvrir', { cible, cible_id: a.id, prix: v.p, quantite: v.q, texte: v.t || null }); await refresh(); thread(id, true); N().toast('Proposition envoyée. Réponse attendue sous 48 h.'); });
  }

  /* ——— la boîte ——— */
  async function inbox() {
    if (!N()) return;
    if (!N().session()) { N().open(); return; }
    const draw = () => {
      const g = { moi: [], eux: [], ok: [], fin: [] };
      liste.forEach(n => (n.statut === 'conclue' ? g.ok : n.statut !== 'ouverte' ? g.fin : aMoi(n) ? g.moi : g.eux).push(n));
      const row = n => { const lui = autre(monRole(n)), e = etat(n), p = n.statut === 'conclue' ? n.prix_final : n.dernier_prix, q = n.statut === 'conclue' ? n.quantite_finale : n.dernier_quantite;
        const av = avDe(n, 36);
        return `<button type="button" class="nx-row${nonLu(n) ? ' is-new' : ''}" data-id="${n.id}"><span class="nx-av">${av.svg || mk(lui)}${av.svg ? `<i>${mk(lui)}</i>` : ''}</span><b>${esc(n.produit || 'Annonce')}</b>
          <span class="p">${p ? fmt(p) : '—'}<small>${p ? 'F / ' + esc(n.unite || 'unité') + (q ? ' × ' + fq(q) : '') : ''}</small></span>
          <small><span class="nx-tag ${e.c}">${esc(e.t)}</span> avec ${leLa(lui)}${av.nom ? ' ' + esc(av.nom) : ''}${n.ville ? ' · ' + esc(n.ville) : ''} · ${ago(n.updated_at)}</small></button>`; };
      const grp = (t, L) => L.length ? `<section class="nx-grp"><h3>${t}</h3>${L.map(row).join('')}</section>` : '';
      bg.querySelector('.nx-b').innerHTML = liste.length ? grp('À vous de répondre', g.moi) + grp('En cours', g.eux) + grp('Accords conclus', g.ok) + grp('Terminées', g.fin)
        : `<div class="nx-empty"><b>Aucune négociation pour l’instant</b>Sur une offre ou une demande, touchez « Proposer un prix ». Les réponses arrivent ici.</div>`;
      bg.querySelectorAll('.nx-row').forEach(b => b.onclick = () => thread(b.dataset.id));
    };
    sheet(head('Mes négociations', 'Propositions, réponses et accords') + `<div class="nx-b"><div class="nx-empty">Chargement…</div></div>`, 'Mes négociations');
    redessiner = () => draw();
    bindSnd();
    if (liste.length) draw();
    await refresh(); if (bg && bg.querySelector('.nx-row,.nx-empty')) draw();
  }

  /* ——— le fil d'une négociation ——— */
  async function thread(id) {
    if (!N() || !N().session()) return N() && N().open();
    let n = liste.find(x => x.id === id), msgs = null, mode = '', dispo = null;
    sheet(head(n ? (n.produit || 'Négociation') : 'Négociation', '', true) + `<div class="nx-b"><div class="nx-top"></div><div class="nx-msgs" aria-live="polite"></div><div class="nx-bottom"></div></div><div class="nx-f"></div>`, 'Négociation');
    bindSnd();
    bg.querySelector('[data-back]').onclick = () => inbox();
    const $ = s => bg && bg.querySelector(s);
    const annonce = () => { const k = n.cible === 'offre' ? 'offres' : 'demandes'; return N().list(k).find(x => x._rid === n.cible_id); };
    const phone = () => { if (me() !== n.auteur_id) return ''; const a = annonce(); const t = a && ((a.producer && a.producer.phone) || a.phone); return /^\d{10}$/.test(t || '') ? t : ''; };
    const ticket = (m, i, seen, anim) => {
      const R = roles(n), mine = m.auteur_id === me(), who = mine ? 'Vous' : Le(R[m.auteur_id]), u = n.unite || 'unité';
      const cls = (mine ? ' me' : '') + (anim && i >= seen ? ' nx-new' : ''), when = `<time datetime="${m.created_at}">${ago(m.created_at)}</time>`;
      if (m.genre === 'texte') return `<div class="nx-m${cls}">${esc(m.texte)}${when}</div>`;
      if (m.genre === 'fin') return `<div class="nx-ev${cls}">${who} ${mine ? 'avez' : 'a'} arrêté la négociation${m.texte ? ' : « ' + esc(m.texte) + ' »' : ''} · ${ago(m.created_at)}</div>`;
      if (m.genre === 'refus' || m.genre === 'retrait') return `<div class="nx-ev${cls}">${who} ${mine ? 'avez' : 'a'} ${m.genre === 'refus' ? 'refusé' : 'retiré'} la proposition à ${fmt(m.prix)} F${m.texte ? ' : « ' + esc(m.texte) + ' »' : ''} · ${ago(m.created_at)}</div>`;
      if (m.genre === 'accord') return `<div class="nx-ev nx-ev-ok${cls}">${who} ${mine ? 'avez' : 'a'} accepté : ${m.quantite ? fq(m.quantite) + ' ' + esc(u) + ' × ' : ''}${fmt(m.prix)} F · ${ago(m.created_at)}</div>`;
      const iss = m.issue === 'en_attente' && Date.parse(m.expire_le) <= Date.now() ? 'expiree' : m.issue;
      const IS = { en_attente: ['En attente · ' + reste(m.expire_le), 'acc'], acceptee: ['Acceptée', 'ok'], refusee: ['Refusée', 'bad'], retiree: ['Retirée', ''], remplacee: ['Remplacée par une nouvelle proposition', ''], expiree: ['Expirée sans réponse', ''] }[iss] || ['', ''];
      return `<div class="nx-tk${cls} is-${iss || 'x'}"><div class="who">${mk(R[m.auteur_id])}${who} ${mine ? 'proposez' : 'propose'}<span class="nx-tag ${IS[1]}">${IS[0]}</span></div>
        <div class="amt">${fmt(m.prix)} <small>F / ${esc(u)}</small></div>${m.quantite ? `<div class="qty">${fq(m.quantite)} ${esc(u)} · total ${fmt(m.prix * m.quantite)} F</div>` : ''}${m.texte ? `<div class="t">${esc(m.texte)}</div>` : ''}${when}</div>`;
    };
    const deal = () => { const ph = phone(), u = n.unite || 'unité', q = n.quantite_finale; return `<div class="nx-deal" role="status"><span class="nx-tag ok">Accord conclu le ${jour(n.conclu_le || n.updated_at)}</span>
      <b>${q ? fq(q) + ' ' + esc(u) + ' × ' : ''}${fmt(n.prix_final)} F / ${esc(u)}</b>${q ? `<div class="nx-dtot">Total convenu : ${fmt(n.prix_final * q)} F</div>` : ''}
      ${n.conditions_finales ? `<p class="nx-cond"><span>Conditions</span>${esc(n.conditions_finales)}</p>` : ''}
      <p>Ces conditions sont figées. Convenez maintenant de la livraison et du paiement : rien n’est encore payé ni livré. Voyez la marchandise avant de payer.</p>
      ${ph ? `<a href="tel:+225${ph}">Appeler</a><a class="ghost" href="https://wa.me/225${ph}?text=${encodeURIComponent('Bonjour, nous avons trouvé un accord sur Marché de Gros : ' + (n.produit || '') + (q ? ', ' + fq(q) + ' ' + u : '') + ' à ' + fmt(n.prix_final) + ' F / ' + u + '.')}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>`; };
    const paint = anim => {
      if (!bg || !n) return;
      const lui = autre(monRole(n)), u = n.unite || 'unité', proprio = me() === n.proprio_id;
      const av = avDe(n, 40); $('.nx-h').classList.toggle('has-av', !!av.svg); let ha = $('.nx-h .nx-hav'); if (!ha && av.svg) { ha = document.createElement('span'); ha.className = 'nx-hav'; $('.nx-h h2').before(ha); } if (ha) ha.innerHTML = av.svg;
      $('.nx-h h2').innerHTML = esc(n.produit || 'Négociation') + `<small>Avec ${leLa(lui)}${av.nom ? ' ' + esc(av.nom) : ''}${n.ville ? ' · ' + esc(n.ville) : ''}${n.quantite ? ' · annonce de ' + fq(n.quantite) + ' ' + esc(u) : ''}</small>`;
      const e = etat(n);
      $('.nx-top').innerHTML = `<div class="nx-state"><span class="nx-tag ${e.c}">${esc(e.t)}</span>${n.prix_annonce ? `<span>Prix affiché ${fmt(n.prix_annonce)} F / ${esc(u)}</span>` : ''}</div>` + rail(n, msgs)
        + (proprio && dispo && dispo.quantite ? `<p class="nx-dispo">Sur votre annonce : ${fq(dispo.convenue)} / ${fq(dispo.quantite)} ${esc(u)} déjà convenus${dispo.en_cours > 1 ? ' · ' + (dispo.en_cours - 1) + ' autre' + (dispo.en_cours > 2 ? 's' : '') + ' négociation' + (dispo.en_cours > 2 ? 's' : '') + ' en cours' : ''}</p>` : '');
      const box = $('.nx-msgs'), seen = box.childElementCount;
      box.innerHTML = (msgs || []).map((m, i) => ticket(m, i, seen, anim)).join('');
      $('.nx-bottom').innerHTML = n.statut === 'conclue' ? deal() : '';
      pied();
      if (anim) { const b = $('.nx-b'); b.scrollTop = b.scrollHeight; }
    };
    // pied : les actions possibles selon l'état et le rôle
    function pied() {
      const f = $('.nx-f'), u = n.unite || 'unité', lui = autre(monRole(n)), a = annonce(), keep = f.querySelector('.nx-comp textarea') ? f.querySelector('.nx-comp textarea').value : '';
      let h = '';
      const P = n.dernier_prix, Q = n.dernier_quantite, prop = (msgs || []).find(m => m.id === n.dernier_msg);
      if (mode === 'edit') h = `<div class="nx-edbox nx-edf"></div><button type="button" class="nx-alt nx-cancel" style="width:100%;margin-top:8px">Annuler</button>`;
      else if (mode === 'accord') h = `<div class="nx-confirm"><b>Vous acceptez :</b><div class="nx-big">${Q ? fq(Q) + ' ' + esc(u) + ' × ' : ''}${fmt(P)} F / ${esc(u)}</div>${Q ? `<div class="nx-dtot">Total : ${fmt(P * Q)} F</div>` : ''}${prop && prop.texte ? `<p class="nx-cond"><span>Conditions</span>${esc(prop.texte)}</p>` : ''}<p>Une fois confirmé, l’accord est figé : il ne pourra plus être modifié. Ce n’est pas un paiement.</p>
        <div class="nx-act"><button type="button" class="nx-go" data-g="accord-ok">Confirmer l’accord</button><button type="button" class="nx-alt" data-g="annuler" style="grid-column:1 / -1">Retour</button></div><p class="nx-err" role="alert"></p></div>`;
      else {
        if (n.statut === 'ouverte' && aMoi(n)) h += `<div class="nx-pend"><span>${Le(lui)} propose ${Q ? fq(Q) + ' ' + esc(u) + ' × ' : ''}<b>${fmt(P)} F</b>${Q ? ' = ' + fmt(P * Q) + ' F' : ''} · ${reste(n.expire_le)}</span></div>
          <div class="nx-act"><button type="button" class="nx-go" data-g="accord">Accepter ${fmt(P)} F / ${esc(u)}</button><button type="button" class="nx-alt" data-g="edit">Contre-proposer</button><button type="button" class="nx-alt" data-g="refus">Refuser</button></div>`;
        else if (n.statut === 'ouverte' && enCours(n)) h += `<div class="nx-pend"><span>Votre proposition : ${Q ? fq(Q) + ' ' + esc(u) + ' × ' : ''}<b>${fmt(P)} F</b> · en attente, ${reste(n.expire_le)}</span></div>
          <div class="nx-act"><button type="button" class="nx-alt" data-g="edit">Modifier ma proposition</button><button type="button" class="nx-alt" data-g="retrait">Retirer ma proposition</button></div>`;
        else if (n.statut === 'ouverte') h += `<div class="nx-act"><button type="button" class="nx-go" data-g="edit">${expiree(n) ? 'Faire une nouvelle proposition' : 'Faire une proposition'}</button></div>`;
        else if (n.statut === 'close' && n.motif_fin !== 'annonce_retiree' && a) h += `<div class="nx-act"><button type="button" class="nx-alt" data-g="edit" style="grid-column:1 / -1">Relancer avec une proposition</button></div>`;
        h += `<div class="nx-comp"><textarea maxlength="500" placeholder="Écrire un message" aria-label="Message à ${leLa(lui)}"></textarea><button type="button" class="nx-ib" data-g="texte" aria-label="Envoyer le message">↑</button></div>
          ${n.statut === 'ouverte' ? '<p class="nx-stop"><button type="button" data-g="fin">Arrêter la négociation</button></p>' : ''}<p class="nx-err" role="alert"></p>`;
      }
      f.innerHTML = h;
      const ta = f.querySelector('.nx-comp textarea'); if (ta) ta.value = keep;
      f.querySelectorAll('[data-g]').forEach(b => b.onclick = () => act(b.dataset.g));
      const c = f.querySelector('.nx-cancel'); if (c) c.onclick = () => { mode = ''; pied(); };
      if (mode === 'edit') {
        const proprio = me() === n.proprio_id;
        editeur(f.querySelector('.nx-edbox'), { cible: n.cible, prixRef: n.prix_annonce, unite: u, qmax: (a && a.quantity) || n.quantite, q0: n.dernier_quantite || n.quantite, negociable: a ? a.negociable : true, pour: lui, moi: proprio ? 'proprio' : 'auteur', dernier: aMoi(n) ? n.dernier_prix : null },
          async v => { await N().rpc('nego_agir', { nego: n.id, action: 'prix', prix: v.p, quantite: v.q, texte: v.t || null, ref: null }); mode = ''; await load(true); N().toast('Proposition envoyée.'); },
          aMoi(n) ? 'Contre-proposer' : 'Proposer');
      }
    }
    async function act(g) {
      const f = $('.nx-f'), e = f.querySelector('.nx-err');
      if (g === 'edit' || g === 'accord') { mode = g; pied(); return; }
      if (g === 'annuler') { mode = ''; pied(); return; }
      if (g === 'fin' && !confirm('Arrêter cette négociation ? Une proposition en attente sera retirée. Vous pourrez relancer plus tard.')) return;
      if (g === 'refus' && !confirm('Refuser cette proposition ? Vous pourrez ensuite faire la vôtre.')) return;
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
        if (!bg) return; if (!nn) { $('.nx-b').innerHTML = '<div class="nx-empty"><b>Négociation introuvable</b>Elle a peut-être été retirée.</div>'; $('.nx-f').innerHTML = ''; return; }
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

  window.MDGNegoce = { proposer, inbox, thread, unread, refresh };
})();
