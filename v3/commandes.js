/* ═════════ Marché de Gros CI — Mes commandes : du « oui » à la livraison ═════════
   Une commande naît d'un accord conclu. L'une des parties la crée (qui transporte, où livrer), l'autre la confirme.
   Ensuite, chaque étape avance par une action enregistrée par le serveur (supabase/schema-26-commandes.sql) :
     1 Commande confirmée · 2 Préparation · 3 Chargement confirmé · 4 Transport en cours · (5 Transbordement)
     6 Chauffeur arrivé · 7 Réception confirmée · 8 Commande terminée
   Rien n'avance tout seul côté téléphone : l'écran montre ce que le serveur a enregistré, avec l'heure.
   Validation « sans code » pour l'instant (vendeur et acheteur déclarent) ; les codes arrivent avec l'espace chauffeur.
   Aucun paiement : la commission de 3,5 % est seulement calculée et montrée au vendeur (« non prélevée »).
   Pas de faux suivi en direct : sans position réelle, on montre la dernière étape et son heure, rien d'autre.
   API : MDGCommandes.ouvrir(id?) · MDGCommandes.depuisAccord(nego) · MDGCommandes.creer(nego) */
(function () {
  'use strict';
  if (window.MDGCommandes) return;
  const N = () => window.MDGNuage;
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const KC = () => 'mdg-commandes:' + (me() || 'x');
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const IC = (n, t) => window.MDGIco ? MDGIco.svg(n, t || 18, 1.9) : '';
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0);
  const F = v => nf(v) + ' F';
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const quand = t => { const d = new Date(t), a = new Date(); return d.toDateString() === a.toDateString() ? 'aujourd’hui à ' + heure(t) : jour(t) + ' à ' + heure(t); };
  const ilya = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'le ' + jour(t); };
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const qte = (q, u) => nf(q, 2) + ' ' + esc(unites(q, u));
  const sac = (h, t) => window.MDGSac ? MDGSac.svg(h, { t }) : '';
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));
  const MOUV = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ——— les étapes, dans l'ordre (le transbordement n'apparaît que s'il a eu lieu) ———
  const ETAPES = [
    ['confirmee', 'Commande confirmée'], ['preparation', 'Préparation'], ['chargement', 'Chargement confirmé'], ['transport', 'Transport en cours'],
    ['transbordement', 'Transbordement'], ['arrivee', 'Chauffeur arrivé'], ['reception', 'Réception confirmée'], ['terminee', 'Commande terminée']];
  const LIB = Object.fromEntries(ETAPES);
  const EV = Object.assign({}, LIB, { creee: 'Commande proposée', refusee: 'Commande refusée', annulation_demandee: 'Annulation demandée',
    annulation_refusee: 'Annulation refusée', annulee: 'Commande annulée', litige: 'Litige ouvert' });
  const MODES = { reseau: 'Transporteur du réseau Marché de Gros', acheteur: 'Transporteur choisi par l’acheteur', vendeur: 'Transporteur choisi par le vendeur' };
  const ROLE = { vendeur: 'Vendeur', acheteur: 'Acheteur', chauffeur: 'Chauffeur', admin: 'Marché de Gros', systeme: 'Automatique' };
  const PREUVE = { declaration: 'déclaré', gps: 'déclaré avec position', code: 'validé par code', auto: 'automatique', admin: 'équipe' };

  const CSS = `
.cm-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:cmIn .2s ease-out}
@keyframes cmIn{from{opacity:0}}
.cm{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:22px 18px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:cmUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes cmUp{from{transform:translateY(40px)}}
.cm h2{margin:0 52px 4px 0;font:600 24px/1.15 'Archivo','Helvetica Neue',Arial,sans-serif;letter-spacing:-.01em}
.cm h2 em{font:900 italic 1em 'Archivo','Helvetica Neue',Arial,sans-serif;color:#10392B;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%)}
.cm-sous{margin:0 0 14px;color:#5E5546;font-size:14px}
.cm-x{position:absolute;right:12px;top:12px;width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:#171512;display:grid;place-items:center;cursor:pointer}
.cm-seg{display:flex;padding:3px;border-radius:14px;background:rgba(23,21,18,.07);margin:0 0 12px}
.cm-seg button{flex:1;min-height:44px;border:0;border-radius:11px;background:none;color:#4B4436;font:500 14px Jost,sans-serif;cursor:pointer}
.cm-seg button[aria-pressed=true]{background:#FFFDF8;color:#171512;font-weight:600;box-shadow:0 1px 3px rgba(23,21,18,.12)}
.cm-li{display:flex;flex-direction:column;gap:8px}
.cm-r{display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center;width:100%;min-height:72px;padding:10px 12px;border:0;border-radius:18px;background:#FFFDF8;text-align:left;color:inherit;cursor:pointer;font:inherit;box-shadow:0 1px 2px rgba(23,21,18,.05)}
.cm-r .s{width:48px;height:48px;display:grid;place-items:center}.cm-r .s svg{width:46px;height:46px}
.cm-r b{display:block;font-weight:600}.cm-r small{display:block;font-size:13px;color:#5E5546}
.cm-r .bar{display:block;height:4px;border-radius:2px;background:rgba(16,57,43,.12);margin-top:7px;overflow:hidden}.cm-r .bar i{display:block;height:100%;background:#10392B;border-radius:2px;transform-origin:left}
.cm-r.a{box-shadow:inset 0 0 0 2px #F2C230}
.cm-tag{display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:0 9px;border-radius:12px;background:rgba(16,57,43,.1);color:#10392B;font:600 12.5px Jost,sans-serif}
.cm-tag.mais{background:rgba(242,194,48,.32);color:#4A3700}.cm-tag.rouge{background:rgba(196,72,52,.14);color:#8A2414}
/* la scène : le camion, le sac dedans, la route */
.cm-scene{position:relative;height:136px;margin:4px -18px 6px;overflow:hidden;background:linear-gradient(#F3EFE4 0 72%,#E7E0CF 72%)}
.cm-route{position:absolute;left:0;right:0;bottom:22px;height:3px;background:repeating-linear-gradient(90deg,#B9AE95 0 18px,transparent 18px 34px)}
.cm-camion{position:absolute;bottom:18px;left:var(--x,8%);width:150px;height:96px;transition:left .9s cubic-bezier(.3,.8,.3,1)}
.cm-camion .sac{position:absolute;left:14px;bottom:30px;width:62px;height:62px}.cm-camion .sac svg{width:62px;height:62px}
.cm-scene.roule .cm-camion{animation:cmBob 1.4s ease-in-out infinite}.cm-scene.roule .cm-route{animation:cmRoute 1.1s linear infinite}
@keyframes cmBob{50%{transform:translateY(-2px)}}@keyframes cmRoute{to{background-position:-34px 0}}
.cm-scene.arrive .cm-camion{animation:cmArrive 1s cubic-bezier(.2,.9,.3,1.2) both}.cm-scene.arrive .sac{animation:cmSaut .6s .9s ease-out both}
@keyframes cmArrive{from{left:-40%}}@keyframes cmSaut{40%{transform:translateY(-16px) rotate(-6deg)}}
.cm-scene .seul{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);width:104px;height:104px}.cm-scene .seul svg{width:104px;height:104px}
/* progression */
.cm-prog{margin:0 0 4px}
.cm-pb{height:8px;border-radius:4px;background:rgba(16,57,43,.12);overflow:hidden}.cm-pb i{display:block;height:100%;width:100%;border-radius:4px;background:linear-gradient(90deg,#10392B,#2F6B4F);transform-origin:left;transform:scaleX(var(--p,0));transition:transform .8s cubic-bezier(.3,.8,.3,1)}
.cm-et{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column}
.cm-et li{position:relative;display:grid;grid-template-columns:28px 1fr;gap:10px;padding:0 0 14px;color:#8A8170}
.cm-et li::before{content:'';position:absolute;left:13px;top:24px;bottom:0;width:2px;background:rgba(16,57,43,.14)}.cm-et li:last-child::before{display:none}
.cm-et .pt{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#E7E0CF;color:#8A8170;font:700 12px 'Archivo',sans-serif;position:relative;z-index:1}
.cm-et li.fait{color:#171512}.cm-et li.fait .pt{background:#10392B;color:#F3EFE4}.cm-et li.fait::before{background:#10392B}
.cm-et li.ici .pt{background:#F2C230;color:#10392B;box-shadow:0 0 0 5px rgba(242,194,48,.28)}
.cm-et b{display:block;font-weight:600;line-height:28px}.cm-et small{display:block;font-size:12.5px;color:#5E5546;margin-top:-4px}
.cm-st{margin:10px 0 12px;padding:14px;border-radius:18px;background:#10392B;color:#F3EFE4}
.cm-st b{display:block;font:600 18px/1.25 'Archivo','Helvetica Neue',Arial,sans-serif}.cm-st b em{font-style:italic;font-weight:900;color:#F2C230}
.cm-st small{display:block;margin-top:4px;color:rgba(243,239,228,.8);font-size:13px}
.cm-act{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}
.cm-act button{min-height:50px;border-radius:25px;border:1px solid #10392B;background:none;color:#10392B;font:600 15.5px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:0 16px}
.cm-act button.p{background:#10392B;color:#F3EFE4}.cm-act button.m{border-color:transparent;background:none;text-decoration:underline;min-height:44px;font-weight:500}
.cm-act button:disabled{opacity:.55;cursor:default}
.cm-info{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(242,194,48,.2);font-size:13.5px}
.cm-info b{font-weight:600}
.cm-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 12px;padding:14px;border-radius:18px;background:#FFFDF8}
.cm-dl dt{color:#5E5546;font-size:13.5px}.cm-dl dd{margin:0;text-align:right;font-weight:600}
.cm-h3{margin:16px 0 8px;font:600 15px 'Archivo',sans-serif}
.cm-j{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cm-j li{padding:10px 12px;border-radius:14px;background:#FFFDF8;font-size:13.5px}.cm-j li b{font-weight:600}.cm-j li small{display:block;color:#5E5546;font-size:12.5px}
/* formulaires */
.cm-f label.t{display:block;margin:14px 0 6px;font-weight:600}
.cm-opt{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;padding:12px 14px;margin:0 0 8px;border-radius:16px;background:#FFFDF8;border:2px solid transparent;cursor:pointer}
.cm-opt:has(input:checked){border-color:#10392B}.cm-opt input{width:20px;height:20px;margin:2px 0 0;accent-color:#10392B}
.cm-opt b{display:block;font-weight:600}.cm-opt small{display:block;font-size:13px;color:#5E5546}
.cm-opt.off{opacity:.6;cursor:default}
.cm-f input[type=text],.cm-f textarea{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512}
.cm-f textarea{min-height:76px;resize:vertical}
.cm-ck{display:flex;gap:10px;align-items:center;min-height:44px;margin:10px 0 0;font-size:14px}.cm-ck input{width:20px;height:20px;accent-color:#10392B}
.cm-err{color:#8A2414;font-size:13.5px;margin:8px 0 0;min-height:1em}
.cm-note{margin:12px 2px 0;font-size:12.5px;color:#5E5546}
@media (prefers-reduced-motion:reduce){.cm-bg,.cm,.cm-camion,.cm-pb i,.cm-scene *{animation:none!important;transition:none!important}}`;
  function css() { if (document.getElementById('cmCss')) return; const s = document.createElement('style'); s.id = 'cmCss'; s.textContent = CSS; document.head.appendChild(s); }

  // le camion : une cabine et un plateau, le sac posé dessus (dessiné en SVG, sans image à charger)
  const CAMION = `<svg viewBox="0 0 150 96" width="150" height="96" aria-hidden="true">
    <rect x="4" y="52" width="92" height="22" rx="4" fill="#10392B"/><path d="M96 34h26l18 20v20H96z" fill="#10392B"/>
    <path d="M102 40h17l12 14h-29z" fill="#BFD8CB"/><rect x="132" y="62" width="8" height="5" rx="2" fill="#F2C230"/>
    <circle cx="28" cy="78" r="11" fill="#171512"/><circle cx="28" cy="78" r="4.5" fill="#E7E0CF"/>
    <circle cx="116" cy="78" r="11" fill="#171512"/><circle cx="116" cy="78" r="4.5" fill="#E7E0CF"/>
    <rect x="4" y="50" width="92" height="4" rx="2" fill="#F2C230"/></svg>`;

  const humeur = c => c.etat === 'annulee' || c.etat === 'litige' ? 'triste' : c.etat === 'terminee' ? 'plein' : navigator.onLine === false ? 'ferme' : c.etape && c.etape !== 'confirmee' && c.etape !== 'preparation' ? 'plein' : 'charge';
  const ordre = (c, J) => ETAPES.filter(([k]) => k !== 'transbordement' || c.etape === 'transbordement' || (J || []).some(e => e.evenement === 'transbordement'));
  function avance(c, J) {
    const L = ordre(c, J), i = L.findIndex(([k]) => k === c.etape);
    return c.etat === 'a_confirmer' ? 0 : i < 0 ? 0 : i / (L.length - 1);
  }

  // ——— état ———
  let bg = null, vue = 'liste', filtre = 'cours', liste = [], journal = {}, sel = null, charge = false, minuteur = null;
  const trouve = id => liste.find(x => x.id === id);
  function fermer() { if (!bg) return; bg.remove(); bg = null; clearInterval(minuteur); minuteur = null; document.removeEventListener('keydown', clavier); }
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  const erreurTxt = e => { const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : m || 'Réessayez dans un instant.'; };

  async function lireListe() {
    if (!N() || !N().session()) return;
    liste = J(KC(), liste);
    if (navigator.onLine === false) return;
    charge = true;
    try { liste = (await N().rpc('mes_commandes')) || []; W(KC(), liste); } catch (e) { if (bg) toast('Commandes indisponibles pour l’instant', { type: 'erreur', sous: erreurTxt(e) }); }
    charge = false;
  }
  async function lireJournal(id) {
    if (navigator.onLine === false) return;
    try { journal[id] = (await N().rpc('commande_journal', { p_id: id })) || []; } catch (_) {}
  }
  async function rafraichir() {
    if (!bg || document.hidden) return;
    const avant = sel && trouve(sel) && trouve(sel).etape;
    await lireListe(); if (sel) await lireJournal(sel);
    if (!bg) return;
    const apres = sel && trouve(sel) && trouve(sel).etape;
    peindre(avant && apres && avant !== apres ? apres : null);
  }

  // ——— la liste ———
  const enCours = x => x.etat === 'en_cours' || x.etat === 'a_confirmer' || x.etat === 'litige';
  const aAgir = x => (x.etat === 'a_confirmer' && !x.cree_par_moi) || x.annulation === 'autre'
    || (x.etat === 'en_cours' && ((x.role === 'vendeur' && ['confirmee', 'preparation'].includes(x.etape)) || (x.role === 'acheteur' && ['transport', 'transbordement', 'arrivee'].includes(x.etape))));
  function ligneCmd(x) {
    const st = x.etat === 'a_confirmer' ? (x.cree_par_moi ? 'En attente de confirmation' : 'À confirmer') : x.etat === 'annulee' ? 'Annulée' : x.etat === 'litige' ? 'Litige en cours' : LIB[x.etape] || '';
    const cls = x.etat === 'annulee' || x.etat === 'litige' ? 'rouge' : aAgir(x) ? 'mais' : '';
    return `<button type="button" class="cm-r${aAgir(x) ? ' a' : ''}" data-id="${x.id}"><span class="s" aria-hidden="true">${sac(humeur(x), 46)}</span>
      <span><b>${esc(x.produit || 'Commande')}${x.quantite != null ? ' · ' + qte(x.quantite, x.unite) : ''}</b>
      <small>${x.role === 'vendeur' ? 'Pour' : 'De'} ${esc(x.partenaire_nom)} · <span class="cm-tag ${cls}">${esc(st)}</span></small>
      <span class="bar" aria-hidden="true"><i style="transform:scaleX(${avance(x).toFixed(3)})"></i></span></span></button>`;
  }
  function peindreListe() {
    const box = bg.querySelector('.cm');
    const L = liste.filter(x => filtre === 'cours' ? enCours(x) : !enCours(x));
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Mes <em>commandes</em></h2>
      <p class="cm-sous">Du « oui » à la livraison : chaque étape, avec son heure.</p>
      <div class="cm-seg" role="group" aria-label="Afficher">${[['cours', 'En cours'], ['fini', 'Terminées et annulées']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filtre === k}">${l}</button>`).join('')}</div>
      <div class="cm-li">${charge && !liste.length ? (window.MDGSac ? MDGSac.charge('Vos commandes arrivent…') : '<p>Chargement…</p>')
        : L.length ? L.map(ligneCmd).join('')
        : (window.MDGSac ? MDGSac.vide(filtre === 'cours' ? 'Aucune commande en cours' : 'Rien ici pour l’instant', 'Après un accord conclu, touchez « Suivre la commande » dans la négociation.') : '<p>Aucune commande.</p>')}</div>
      <p class="cm-note">Aucun paiement ne passe par l’application pour l’instant : payez à la réception, après avoir vu la marchandise.</p>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; peindre(); });
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detail(b.dataset.id));
  }

  // ——— le détail : la scène, la progression, le statut, les actions, le journal ———
  function prochaine(c) {
    const lui = esc(c.partenaire_nom);
    if (c.etat === 'a_confirmer') return c.cree_par_moi ? [`En attente de <em>${lui}</em>`, 'La commande démarre quand l’autre partie la confirme.'] : [`${lui} vous propose cette <em>commande</em>`, 'Vérifiez le transport et le lieu de livraison, puis confirmez.'];
    if (c.etat === 'annulee') return ['Commande <em>annulée</em>', 'Le stock est revenu sur l’annonce.'];
    if (c.etat === 'litige') return ['Litige <em>ouvert</em>', 'L’équipe du Marché de Gros examine. Gardez vos échanges dans l’application.'];
    if (c.etat === 'terminee') return ['Commande <em>terminée</em>', 'Merci ! Vous avez 48 h pour signaler un problème.'];
    if (c.annulation === 'autre') return [`${lui} demande l’<em>annulation</em>`, 'Acceptez ou refusez.'];
    if (c.annulation === 'moi') return ['Annulation <em>demandée</em>', `En attente de la réponse de ${lui}.`];
    const V = c.role === 'vendeur';
    switch (c.etape) {
      case 'confirmee': return V ? ['Préparez la <em>marchandise</em>', 'Touchez « En préparation », puis « Chargement confirmé » quand le camion est chargé.'] : ['Le vendeur prépare votre <em>marchandise</em>', 'Vous serez prévenu au chargement.'];
      case 'preparation': return V ? ['Marchandise en <em>préparation</em>', 'Confirmez le chargement quand le camion est chargé.'] : ['Marchandise en <em>préparation</em>', 'Prochaine étape : le chargement.'];
      case 'transport': case 'transbordement': return V ? ['Transport <em>en cours</em>', 'L’acheteur confirmera l’arrivée et la réception.'] : ['Votre marchandise est <em>en route</em>', 'Signalez l’arrivée du chauffeur, puis confirmez la réception après avoir vérifié.'];
      case 'arrivee': return V ? ['Le chauffeur est <em>arrivé</em>', 'L’acheteur vérifie la marchandise.'] : ['Le chauffeur est <em>arrivé</em>', 'Vérifiez la marchandise avant de confirmer la réception.'];
      default: return ['Commande <em>en cours</em>', ''];
    }
  }
  function actions(c) {
    const B = [];
    const b = (g, t, cls) => B.push(`<button type="button" class="${cls || ''}" data-g="${g}">${t}</button>`);
    if (c.etat === 'a_confirmer') { if (!c.cree_par_moi) { b('oui', 'Confirmer la commande', 'p'); b('non', 'Refuser'); } else b('annuler', 'Retirer la commande', 'm'); }
    if (c.etat === 'en_cours') {
      if (c.annulation === 'autre') { b('annul-oui', 'Accepter l’annulation', 'p'); b('annul-non', 'Refuser l’annulation'); }
      else {
        if (c.role === 'vendeur' && c.etape === 'confirmee') { b('preparation', 'En préparation', 'p'); b('chargement', 'Chargement confirmé'); }
        if (c.role === 'vendeur' && c.etape === 'preparation') b('chargement', 'Chargement confirmé', 'p');
        if (c.role === 'acheteur' && ['transport', 'transbordement'].includes(c.etape)) { b('arrivee', 'Le chauffeur est arrivé', 'p'); b('reception', 'Réception confirmée'); }
        if (c.role === 'acheteur' && c.etape === 'arrivee') b('reception', 'Réception confirmée', 'p');
        if (['transport', 'transbordement'].includes(c.etape)) b('transbordement', 'Signaler un transbordement', 'm');
        if (['confirmee', 'preparation'].includes(c.etape) && c.annulation !== 'moi') b('annuler', 'Demander l’annulation', 'm');
      }
      if (['chargement', 'transport', 'transbordement', 'arrivee', 'reception'].includes(c.etape)) b('litige', 'Signaler un problème', 'm');
    }
    if (c.etat === 'terminee') b('litige', 'Signaler un problème (48 h)', 'm');
    return B.length ? `<div class="cm-act">${B.join('')}</div>` : '';
  }
  function scene(c, arrive) {
    const roule = c.etat === 'en_cours' && ['transport', 'transbordement'].includes(c.etape) && MOUV();
    const surCamion = c.etat !== 'a_confirmer' && c.etat !== 'annulee' && ['chargement', 'transport', 'transbordement', 'arrivee', 'reception', 'terminee'].includes(c.etape);
    if (!surCamion) return `<div class="cm-scene" aria-hidden="true"><div class="cm-route"></div><div class="seul">${sac(humeur(c), 104)}</div></div>`;
    const x = { chargement: 8, transport: 30, transbordement: 46, arrivee: 62, reception: 62, terminee: 62 }[c.etape] || 8;
    return `<div class="cm-scene${roule ? ' roule' : ''}${arrive && MOUV() ? ' arrive' : ''}" aria-hidden="true"><div class="cm-route"></div>
      <div class="cm-camion" style="--x:${x}%">${CAMION}<div class="sac">${sac(humeur(c), 62)}</div></div></div>`;
  }
  function peindreDetail(change) {
    const c = trouve(sel), box = bg.querySelector('.cm');
    if (!c) { vue = 'liste'; return peindreListe(); }
    const Jr = journal[c.id] || [], L = ordre(c, Jr), p = avance(c, Jr), [titre, sous] = prochaine(c);
    const der = Jr.length ? Jr[Jr.length - 1].at : c.updated_at;
    const fait = k => Jr.find(e => e.evenement === k);
    const iEt = L.findIndex(([k]) => k === c.etape);
    const etapes = L.map(([k, l], i) => { const e = fait(k), f = c.etat !== 'a_confirmer' && i <= iEt;
      return `<li class="${f ? 'fait' : ''}${i === iEt && c.etat === 'en_cours' ? ' ici' : ''}"><span class="pt">${f ? '✓' : i + 1}</span><span><b>${esc(l)}</b>${e ? `<small>${quand(e.at)} · ${esc(PREUVE[e.preuve] || '')}${e.lieu ? ' · ' + esc(e.lieu) : ''}</small>` : ''}</span></li>`; }).join('');
    const arrive = change === 'arrivee';
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${esc(c.produit || 'Commande')}</h2>
      <p class="cm-sous">${c.role === 'vendeur' ? 'Vente à' : 'Achat chez'} ${esc(c.partenaire_nom)} · n° ${esc(c.numero)}</p>
      ${scene(c, arrive)}
      <div class="cm-prog" role="progressbar" aria-label="Avancement de la commande" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><div class="cm-pb"><i style="--p:${p.toFixed(3)}"></i></div></div>
      <div class="cm-st" role="status" aria-live="polite"><b>${titre}</b>${sous ? `<small>${esc(sous)}</small>` : ''}<small>Dernière actualisation : ${ilya(der)}</small></div>
      ${actions(c)}
      ${c.validation === 'declaration' && ['a_confirmer', 'en_cours'].includes(c.etat) ? `<p class="cm-info"><b>Validation sans code.</b> Le vendeur déclare le chargement, l’acheteur l’arrivée et la réception. Je recommande que le chauffeur crée un compte gratuit sur le Marché de Gros : avec les codes (bientôt), personne ne pourra déclarer une livraison à votre place.</p>` : ''}
      <ol class="cm-et">${etapes}</ol>
      <dl class="cm-dl">
        <dt>Quantité</dt><dd>${c.quantite != null ? qte(c.quantite, c.unite) : '—'}</dd>
        <dt>Prix convenu</dt><dd>${c.prix_unitaire != null ? F(c.prix_unitaire) + ' / ' + esc(c.unite || 'unité') : '—'}</dd>
        <dt>Total</dt><dd>${c.montant != null ? F(c.montant) : '—'}</dd>
        ${c.role === 'vendeur' && c.commission_montant != null ? `<dt>Commission prévue (3,5 %)</dt><dd>${F(c.commission_montant)}<br><small style="font-weight:400;color:#5E5546">non prélevée pour l’instant</small></dd>` : ''}
        <dt>Transport</dt><dd>${esc(MODES[c.mode_transport] || '—')}</dd>
        <dt>Départ</dt><dd>${esc(c.ville_depart || '—')}</dd>
        <dt>Livraison</dt><dd>${esc(c.lieu_livraison || 'À convenir')}</dd>
        <dt>Paiement</dt><dd>À la réception, hors application</dd>
      </dl>
      ${Jr.length ? `<h3 class="cm-h3">Historique</h3><ul class="cm-j">${Jr.slice().reverse().map(e => `<li><b>${esc(EV[e.evenement] || e.evenement)}</b> · ${esc(e.par_moi ? 'vous' : ROLE[e.role] || '')}<small>${quand(e.at)} · ${esc(PREUVE[e.preuve] || '')}${e.lieu ? ' · ' + esc(e.lieu) : ''}${e.lat != null ? ' · position jointe' : ''}</small>${e.note ? `<small>« ${esc(e.note)} »</small>` : ''}</li>`).join('')}</ul>` : ''}
      <button type="button" class="cm-act" style="all:unset;display:block;margin:16px auto 0;padding:10px;min-height:44px;box-sizing:border-box;color:#10392B;text-decoration:underline;cursor:pointer" data-retour>Toutes mes commandes</button>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-retour]').onclick = () => { sel = null; vue = 'liste'; peindre(); };
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => geste(c, b.dataset.g));
    if (arrive && navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (_) {}
  }
  let dernierEcran = '';
  function peindre(change) {
    if (!bg) return;
    const ecran = vue + ':' + (sel || ''), box = bg.querySelector('.cm'), y = box.scrollTop;
    if (vue === 'detail' && sel) peindreDetail(change); else peindreListe();
    box.scrollTop = ecran === dernierEcran ? y : 0; dernierEcran = ecran;
  }

  // ——— les gestes : une petite feuille de confirmation, puis l'appel au serveur ———
  async function position(oui) {
    if (!oui || !navigator.geolocation) return null;
    return new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }));
  }
  function confirmer(c, o) {
    const box = bg.querySelector('.cm'); box.scrollTop = 0; dernierEcran = 'geste';
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${o.titre}</h2><p class="cm-sous">${esc(c.produit || '')} · ${esc(c.partenaire_nom)}</p>
      <form class="cm-f" novalidate>
        ${o.lieu ? `<label class="t" for="cmL">${o.lieu}</label><input type="text" id="cmL" maxlength="120" autocomplete="off">` : ''}
        ${o.note ? `<label class="t" for="cmN">${o.note}</label><textarea id="cmN" maxlength="300"></textarea>` : ''}
        ${o.gps ? `<label class="cm-ck"><input type="checkbox" id="cmG"> Joindre ma position actuelle (une seule fois)</label>` : ''}
        ${o.texte ? `<p class="cm-note" style="font-size:13.5px">${o.texte}</p>` : ''}
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">${o.ok}</button><button type="button" data-ann>Retour</button></div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err');
    f.onsubmit = async e => {
      e.preventDefault();
      const L = f.querySelector('#cmL'), Nt = f.querySelector('#cmN'), G = f.querySelector('#cmG');
      const lieu = L ? L.value.trim() : null, note = Nt ? Nt.value.trim() : null;
      if (o.lieuRequis && !lieu) { err.textContent = 'Indiquez le lieu.'; L.focus(); return; }
      if (o.noteRequise && !note) { err.textContent = 'Expliquez en quelques mots.'; Nt.focus(); return; }
      if (N().texteRefus) { const r = N().texteRefus((lieu || '') + ' ' + (note || '')); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        const pos = await position(G && G.checked);
        await o.fn({ lieu, note, pos });
        await lireListe(); await lireJournal(c.id);
        if (o.fait) toast(o.fait, { type: 'ok' });
        if (window.MDGSons && MDGSons.signal) try { MDGSons.signal('accord'); } catch (_) {}
        peindre(o.etape);
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
    const premier = f.querySelector('input[type=text],textarea'); if (premier && matchMedia('(hover:hover)').matches) premier.focus();
  }
  function geste(c, g) {
    const R = (f, a) => N().rpc(f, a);
    const av = (etape, ok, extra) => confirmer(c, Object.assign({ titre: ok, ok, etape, gps: true, note: 'Un mot (facultatif)', fait: LIB[etape] || ok,
      fn: v => R('commande_avancer', { p_id: c.id, p_etape: etape, p_lieu: v.lieu || null, p_lat: v.pos ? v.pos[0] : null, p_lon: v.pos ? v.pos[1] : null, p_note: v.note || null }) }, extra || {}));
    switch (g) {
      case 'oui': return confirmer(c, { titre: 'Confirmer la <em>commande</em>', ok: 'Confirmer', note: 'Un mot (facultatif)', fait: 'Commande confirmée', etape: 'confirmee',
        texte: `Transport : ${esc(MODES[c.mode_transport] || '')}. Livraison : ${esc(c.lieu_livraison || 'à convenir')}.`,
        fn: v => R('commande_repondre', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'non': return confirmer(c, { titre: 'Refuser la commande', ok: 'Refuser', note: 'Pourquoi ? (facultatif)', fait: 'Commande refusée',
        fn: v => R('commande_repondre', { p_id: c.id, p_oui: false, p_note: v.note || null }) });
      case 'preparation': return av('preparation', 'Marchandise en préparation', { gps: false });
      case 'chargement': return av('chargement', 'Chargement confirmé', { texte: 'Confirmez seulement quand la marchandise est dans le camion. Le transport commence alors.' });
      case 'transbordement': return av('transbordement', 'Signaler un transbordement', { lieu: 'Où la marchandise change-t-elle de véhicule ?', lieuRequis: true });
      case 'arrivee': return av('arrivee', 'Le chauffeur est arrivé');
      case 'reception': return av('reception', 'Réception confirmée', { texte: 'Confirmez seulement après avoir vérifié la quantité et la qualité. La commande sera terminée.', fait: 'Réception confirmée : commande terminée' });
      case 'annuler': return confirmer(c, { titre: c.etat === 'a_confirmer' ? 'Retirer la commande' : 'Demander l’annulation', ok: c.etat === 'a_confirmer' ? 'Retirer' : 'Demander', note: 'Pourquoi ? (facultatif)',
        texte: c.etat === 'a_confirmer' ? '' : 'L’annulation se fait d’un commun accord : l’autre partie doit l’accepter. Le stock reviendra sur l’annonce.',
        fait: c.etat === 'a_confirmer' ? 'Commande retirée' : 'Demande d’annulation envoyée', fn: v => R('commande_annuler', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'annul-oui': return confirmer(c, { titre: 'Accepter l’annulation', ok: 'Accepter', note: 'Un mot (facultatif)', fait: 'Commande annulée', texte: 'Le stock reviendra sur l’annonce.',
        fn: v => R('commande_annuler', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'annul-non': return confirmer(c, { titre: 'Refuser l’annulation', ok: 'Refuser', note: 'Un mot (facultatif)', fait: 'Annulation refusée',
        fn: v => R('commande_annuler', { p_id: c.id, p_oui: false, p_note: v.note || null }) });
      case 'litige': return confirmer(c, { titre: 'Signaler un <em>problème</em>', ok: 'Ouvrir un litige', note: 'Que s’est-il passé ?', noteRequise: true, fait: 'Litige ouvert : l’équipe va examiner',
        texte: 'L’équipe du Marché de Gros examinera l’historique de la commande et vos messages dans l’application.',
        fn: v => R('commande_litige', { p_id: c.id, p_motif: v.note }) });
    }
  }

  // ——— créer une commande à partir d'un accord ———
  function creer(n) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter();
    const box = bg.querySelector('.cm'), u = n.unite || 'unité', q = n.quantite_finale; box.scrollTop = 0; dernierEcran = 'creer';
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Suivre la <em>commande</em></h2>
      <p class="cm-sous">${esc(n.produit || '')}${q ? ' · ' + qte(q, u) : ''}${n.prix_final != null ? ' · ' + F(n.prix_final) + ' / ' + esc(u) : ''}</p>
      <form class="cm-f" novalidate>
        <label class="t">Qui transporte la marchandise ?</label>
        ${Object.entries(MODES).map(([k, l], i) => `<label class="cm-opt"><input type="radio" name="mode" value="${k}"${i === 1 ? ' checked' : ''}><span><b>${l}</b><small>${k === 'reseau' ? 'L’équipe vous proposera un transporteur vérifié (bientôt). En attendant, vous suivez les étapes vous-mêmes.' : k === 'acheteur' ? 'L’acheteur envoie son camion ou son transporteur.' : 'Le vendeur organise la livraison.'}</small></span></label>`).join('')}
        <label class="t">Comment valider le chargement et la réception ?</label>
        <label class="cm-opt off"><input type="radio" name="val" value="code" disabled><span><b>Avec codes — le chauffeur a l’application</b><small><span class="cm-tag mais">Recommandé · bientôt</span> Des codes à usage unique prouvent la prise en charge et la réception.</small></span></label>
        <label class="cm-opt"><input type="radio" name="val" value="declaration" checked><span><b>Sans code — nous validons nous-mêmes</b><small>Le vendeur déclare le chargement, l’acheteur l’arrivée et la réception.</small></span></label>
        <p class="cm-info">Je recommande que le chauffeur crée un compte gratuit sur le Marché de Gros : avec les codes, personne ne pourra déclarer une livraison à votre place.</p>
        <label class="t" for="cmLv">Lieu de livraison <small style="font-weight:400;color:#5E5546">(facultatif)</small></label>
        <input type="text" id="cmLv" maxlength="120" placeholder="Ville, quartier, marché…" autocomplete="off">
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Envoyer à l’autre partie</button></div>
        <p class="cm-note">L’autre partie confirme, puis chaque étape s’affiche ici avec son heure. Aucun paiement ne passe par l’application.</p>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    const f = box.querySelector('form'), err = f.querySelector('.cm-err');
    f.onsubmit = async e => {
      e.preventDefault();
      const mode = (f.querySelector('[name=mode]:checked') || {}).value, lieu = f.querySelector('#cmLv').value.trim();
      if (!mode) { err.textContent = 'Choisissez qui transporte.'; return; }
      if (lieu && N().texteRefus) { const r = N().texteRefus(lieu); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        const id = await N().rpc('commande_creer', { p_nego: n.id, p_mode: mode, p_lieu: lieu || null, p_validation: 'declaration' });
        toast('Commande envoyée', { type: 'ok', sous: 'Elle démarre dès que l’autre partie la confirme.' });
        await lireListe(); await lireJournal(id); sel = id; vue = 'detail'; peindre();
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
  }

  // depuis une négociation conclue : ouvrir la commande si elle existe, sinon proposer de la créer
  async function depuisAccord(n) {
    if (!n || !n.id) return;
    monter(); bg.querySelector('.cm').innerHTML = window.MDGSac ? MDGSac.charge('Un instant…') : '';
    await lireListe();
    const c = liste.find(x => x.negociation_id === n.id);
    if (c) { await lireJournal(c.id); sel = c.id; vue = 'detail'; peindre(); } else creer(n);
  }

  async function detail(id) { sel = id; vue = 'detail'; peindre(); await lireJournal(id); peindre(); }

  function monter() {
    css(); if (bg) return;
    bg = document.createElement('div'); bg.className = 'cm-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Mes commandes');
    bg.innerHTML = '<div class="cm"></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    // le serveur fait foi : on relit toutes les 20 s quand l'écran est visible (pas de suivi inventé entre deux lectures)
    minuteur = setInterval(rafraichir, 20000);
  }
  async function ouvrir(id) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter(); sel = id || null; vue = id ? 'detail' : 'liste';
    liste = J(KC(), []); peindre();
    await lireListe(); if (id) await lireJournal(id); peindre();
  }

  // notification touchée : #/?commande=… à l'ouverture, ou message du service worker si l'application est déjà ouverte
  function depuisAdresse() {
    const m = location.hash.match(/[?&]commande=([0-9a-f-]{36})/); if (!m) return;
    try { history.replaceState(history.state, '', location.hash.replace(/[?&]commande=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = k => { if (N() && N().session()) ouvrir(m[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-commande' && e.data.commande) ouvrir(e.data.commande); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) rafraichir(); });
  addEventListener('online', rafraichir);
  depuisAdresse();

  window.MDGCommandes = { ouvrir, depuisAccord, creer, aAgir: () => J(KC(), []).filter(aAgir).length };
})();
