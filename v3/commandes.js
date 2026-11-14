/* ═════════ Marché de Gros CI — Mes commandes : du « oui » à la livraison ═════════
   Une commande naît d'un accord conclu. L'une des parties la crée (qui transporte, où livrer), l'autre la confirme.
   Ensuite, chaque étape avance par une action enregistrée par le serveur (supabase/schema-26-commandes.sql) :
     1 Commande confirmée · 2 Préparation · 3 Chargement confirmé · 4 Transport en cours · (5 Transbordement)
     6 Chauffeur arrivé · 7 Réception confirmée · 8 Commande terminée
   Rien n'avance tout seul côté téléphone : l'écran montre ce que le serveur a enregistré, avec l'heure.
   Transport choisi par l'acheteur ou le vendeur (schéma 63) : le transporteur n'a rien à faire dans l'application — ni inscription,
   ni code. Le vendeur glisse son mot secret dans la marchandise ; l'acheteur le tape pour confirmer la réception (commande_reception_mot).
   Les codes (prise en charge, réception, code transporteur) sont réservés au transporteur du réseau Marché de Gros.
   Transport (schéma 83) : la ville de livraison décide « même ville » ; le vendeur organise alors son livreur (frais réglés au livreur,
   hors Marché de Gros), ou l'acheteur vient chercher si le vendeur l'accepte. Un transport à part convenu dans l'accord est figé dans la commande.
   Le transporteur du réseau (fermé pour l'instant) convient son prix à trois : lui, l'acheteur et le vendeur (transport_agir).
   Aucun paiement : la commission de 3,5 % est seulement calculée et montrée au vendeur (« non prélevée »).
   Pas de faux suivi en direct : sans position réelle, on montre la dernière étape et son heure, rien d'autre.
   API : MDGCommandes.ouvrir(id?) · MDGCommandes.depuisAccord(nego) · MDGCommandes.creer(nego)
   Écran d’une commande (lots 11-12, 13/11/2026) : plein écran, jetons data-v2 (clair et sombre), fidèle à la maquette de Claude Design. */
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
  const TI = n => `<span class="ic-t" aria-hidden="true">${IC(n, 17)}</span>`;   // petite icône dessinée devant un texte (plus d'emoji)
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0).replace(/[\u202F\u00A0]/g, '\u00A0');
  const F = v => nf(v) + ' F';
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const signal = () => { try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} };
  const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const quand = t => { const d = new Date(t), a = new Date(); return d.toDateString() === a.toDateString() ? 'aujourd’hui à ' + heure(t) : jour(t) + ' à ' + heure(t); };
  // une échéance : l'heure seule aujourd'hui, sinon le jour et l'heure
  const echeance = t => new Date(t).toDateString() === new Date().toDateString() ? heure(t) : jour(t) + ' à ' + heure(t);
  // une durée en minutes, dite simplement : 60 → « 1 h », 90 → « 90 min »
  const duree = m => m % 60 === 0 ? (m / 60) + ' h' : m + ' min';
  const ilya = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'le ' + jour(t); };
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const qte = (q, u) => nf(q, 2) + ' ' + esc(unites(q, u));
  const sac = (h, t) => window.MDGSac ? MDGSac.svg(h, { t }) : '';
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));
  // schéma 99d : unités qui se comptent, toujours en nombre entier
  const ENTIERES = ['sac', 'carton', 'régime', 'cageot', 'unité', 'tas', 'pièce', 'alvéole', 'caisse', 'cagette', 'botte'];
  const MOUV = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // les étapes, dans l'ordre (le transbordement n'apparaît que s'il a eu lieu)
  const ETAPES = [
    ['confirmee', 'Commande confirmée'], ['preparation', 'Préparation'], ['chargement', 'Chargement confirmé'], ['transport', 'Le camion est parti'],
    ['transbordement', 'Transbordement'], ['arrivee', 'Marchandise arrivée'], ['reception', 'Réception confirmée'], ['terminee', 'Marchandise reçue']];
  const LIB = Object.fromEntries(ETAPES);
  // schéma 92 : avis du système (rappels, retard, mot bloqué) ; « terminee » posé par l'équipe ou par un refus = clôture
  const EV92 = { rappel_chargement: 'Rappel : chargement attendu', retard_chargement: 'Délai de chargement dépassé', rappel_reception: 'Rappel : réception à vérifier',
    mot_bloque: 'Mot secret bloqué (trop d’essais faux)' };
  const evLib = e => e.evenement === 'terminee' && e.role !== 'systeme' ? 'Commande clôturée' : EV92[e.evenement] || EV[e.evenement] || e.evenement;
  const EV = Object.assign({}, LIB, { creee: 'Commande proposée', refusee: 'Commande refusée', annulation_demandee: 'Annulation demandée',
    annulation_refusee: 'Annulation refusée', annulee: 'Commande annulée', litige: 'Litige ouvert',
    transporteur_proposee: 'Transporteur proposé', transporteur_acceptee: 'Transporteur confirmé', transporteur_refusee: 'Le transporteur a refusé', transporteur_retiree: 'Transporteur retiré',
    code_prise_en_charge_cree: 'Code de prise en charge affiché', code_reception_cree: 'Code de réception affiché', code_transfert_cree: 'Code de transfert créé',
    code_prise_en_charge_bloque: 'Code bloqué (5 essais faux)', code_reception_bloque: 'Code bloqué (5 essais faux)', code_transfert_bloque: 'Code bloqué (5 essais faux)',
    sq_depot: 'Fonds bloqués chez le partenaire', sq_liberee: 'Marchandise conforme : commande clôturée', sq_liberee_auto: 'Clôture automatique (1 h sans problème)',
    sq_refus: 'Marchandise refusée, avec photos', sq_refus_chauffeur_confirme: 'Le chauffeur confirme le refus', sq_refus_chauffeur_conteste: 'Le chauffeur conteste le refus',
    sq_refus_vendeur_reconnu: 'Le vendeur reconnaît le problème', sq_refus_vendeur_conteste: 'Le vendeur conteste le refus', sq_refus_applique: 'Refus appliqué',
    sq_refus_admin: 'Décision de l’équipe sur le refus', sq_solde: 'Séquestre soldé : chacun reçoit sa part', sq_rembourse: 'Remboursement de l’acheteur' });
  // Service litiges sur WhatsApp : le propriétaire donnera le numéro officiel (format international, sans « + » ni espaces, ex. 2250700000000).
  // Tant qu'il est vide, l'application dit « bientôt » et ne montre aucun numéro.
  const WA_LITIGES = '';
  const COM_V = 0.035, COM_T = 0.069;   // commissions : vendeur 3,5 %, transporteur 6,9 % (calculées par le serveur, rappelées ici pour l'affichage)
  // « Transporteur du réseau Marché de Gros » en pause (schéma 62, demande du propriétaire le 22/10/2026) : pas encore de transporteurs.
  // L'option reste visible, grisée « Bientôt », et ne se choisit pas. Pour rouvrir : true ici ET public._transport_reseau_ouvert() côté serveur.
  const RESEAU_OUVERT = false;
  const MODES = { reseau: 'Transporteur du réseau Marché de Gros', acheteur: 'Transporteur choisi par l’acheteur', vendeur: 'Transporteur choisi par le vendeur' };
  const ROLE = { vendeur: 'Vendeur', acheteur: 'Acheteur', chauffeur: 'Chauffeur', admin: 'Marché de Gros', systeme: 'Automatique' };
  const PREUVE = { declaration: 'déclaré', gps: 'déclaré avec position', code: 'validé par code', auto: 'automatique', admin: 'équipe' };

  const CSS = `
.cm-bg button[style*="all:unset"]:focus-visible{outline:2px solid currentColor!important;outline-offset:2px!important;border-radius:6px!important}
.cm-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:cmIn .2s ease-out}
@keyframes cmIn{from{opacity:0}}
.cm{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:22px 18px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:cmUp .28s cubic-bezier(.2,.8,.2,1)}
@keyframes cmUp{from{transform:translateY(40px)}}
.cm h2{margin:0 52px 4px 0;font:600 24px/1.15 Jost,sans-serif;letter-spacing:-.01em}
.cm h2 em{font:900 italic 1em Jost,sans-serif;color:#10392B;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,rgba(242,194,48,.62) 60%,rgba(242,194,48,.62) 94%,transparent 94%)}
.cm-sous{margin:0 0 14px;color:#5E5546;font-size:14px}
.cm h2[tabindex="-1"]:focus{outline:none}
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
.cm-st{position:relative;margin:12px 0;padding:14px 16px;border-radius:18px;background:#FFFDF8;color:#171512;overflow:hidden}.cm-st b{display:block;font:600 18px/1.25 Jost,sans-serif}.cm-st small{display:block;margin-top:4px;color:#6B6252;font-size:13px}
/* formulaires */
.cm-f label.t{display:block;margin:14px 0 6px;font-weight:600}
.cm-opt{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;padding:12px 14px;margin:0 0 8px;border-radius:16px;background:#FFFDF8;border:2px solid transparent;cursor:pointer}
.cm-opt:has(input:checked){border-color:#10392B}.cm-opt input{width:20px;height:20px;margin:2px 0 0;accent-color:#10392B}
.cm-opt.cm-off{opacity:.55;cursor:not-allowed}.cm-opt.cm-off .cm-tag{margin-left:4px;vertical-align:2px}
.cm-opt b{display:block;font-weight:600}.cm-opt small{display:block;font-size:13px;color:#5E5546}
.cm-opt.off{opacity:.6;cursor:default}
.cm-f input[type=text],.cm-f textarea{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512}
.cm-f textarea{min-height:76px;resize:vertical}
.cm-motif{display:block;border:0;margin:0;padding:0;min-width:0}.cm-motif legend.t{display:block;margin:14px 0 2px;padding:0;font-weight:600}.cm-motif .cm-ck{margin:2px 0 0}
.cm-ck{display:flex;gap:10px;align-items:center;min-height:44px;margin:10px 0 0;font-size:14px}.cm-ck input{width:20px;height:20px;accent-color:#10392B}
.cm-pil{display:flex;gap:8px;margin:6px 0 10px}.cm-pil label{position:relative;flex:1;display:grid;place-items:center;min-height:48px;border-radius:14px;background:#FFFDF8;box-shadow:inset 0 0 0 1.5px rgba(16,57,43,.3);font:600 16px Jost,sans-serif;color:#10392B;cursor:pointer;font-variant-numeric:tabular-nums}
.cm-pil input{position:absolute;opacity:0;width:1px;height:1px}.cm-pil label:has(input:checked){background:#10392B;color:#F3EFE4;box-shadow:none}.cm-pil label:has(input:focus-visible){outline:2px solid #10392B;outline-offset:2px}
.cm-f input[type=datetime-local]{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512;accent-color:#10392B}
.cm-err{color:#8A2414;font-size:13.5px;margin:8px 0 0;min-height:1em}
.cm-note{margin:12px 2px 0;font-size:12.5px;color:#5E5546}
.cm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* discussion à trois */
.cm-disc{margin:0 0 12px;padding:14px;border-radius:18px;background:#FFFDF8;box-shadow:inset 0 0 0 1px rgba(16,57,43,.14)}
.cm-disc h3{margin:0 0 4px;font:600 16px/1.2 Jost,sans-serif}.cm-disc>p{margin:0 0 8px;font-size:12.5px;color:#5E5546}
.cm-disc ul{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:6px}
.cm-disc li{max-width:86%;padding:8px 10px;border-radius:14px 14px 14px 4px;background:#EFE9DA;font-size:14px}.cm-disc li span{display:block;white-space:pre-wrap}
.cm-disc li b{font-weight:600;font-size:12.5px}.cm-disc li small{font-size:11.5px;color:#5E5546}
.cm-disc li.moi{align-self:flex-end;border-radius:14px 14px 4px 14px;background:rgba(16,57,43,.12)}.cm-disc li.mdg{background:rgba(242,194,48,.3)}
.cm-disc li.vide{max-width:none;background:none;color:#5E5546;font-size:13px;padding:0}
.cm-disc textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#fff;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512;resize:vertical}
.cm-disc button{margin-top:6px;min-height:46px;width:100%;border:0;border-radius:23px;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer}.cm-disc button:disabled{opacity:.55}
/* qui paie quoi (séquestre, pas encore ouvert) */
.cm-sq{margin:0 0 12px;padding:14px;border-radius:18px;background:#FFFDF8;box-shadow:inset 0 0 0 1px rgba(16,57,43,.14)}
.cm-sq h3{display:flex;align-items:center;gap:8px;margin:0 0 6px;font:600 16px/1.2 Jost,sans-serif}.cm-sq h3 span{font:normal 18px/1 "Apple Color Emoji","Segoe UI Emoji",sans-serif}
.cm-sq-e{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:4px 10px;border-radius:999px;background:rgba(242,194,48,.28);color:#4A3700;font:600 13px Jost,sans-serif}.cm-sq-e.on{background:rgba(16,57,43,.12);color:#10392B}
.cm-sq ol{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;counter-reset:sq}
.cm-sq ol li{position:relative;padding:30px 2px 0;text-align:center;font-size:11.5px;line-height:1.25;color:#675F50;counter-increment:sq}
.cm-sq ol li::before{content:counter(sq);position:absolute;top:0;left:50%;transform:translateX(-50%);width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#E7E0CF;color:#675F50;font:700 12px/24px Jost,sans-serif}
.cm-sq ol li.fait{color:#171512}.cm-sq ol li.fait::before{content:'✓';background:#10392B;color:#F3EFE4}.cm-sq ol li.ici::before{background:#F2C230;color:#10392B;box-shadow:0 0 0 4px rgba(242,194,48,.28)}
.cm-sq table{width:100%;border-collapse:collapse;font-size:13.5px}.cm-sq td{padding:5px 0;border-top:1px solid #ECE6D6;vertical-align:top}.cm-sq td:last-child{text-align:right;font-weight:600;white-space:nowrap;padding-left:10px}
.cm-sq td small{display:block;color:#5E5546;font-size:12px;font-weight:400}.cm-sq tr.tot td{font-weight:700;border-top:2px solid #10392B}
.cm-sq p{margin:8px 0 0;font-size:12.5px;color:#5E5546}
.cm-rf{margin:0 0 12px;padding:14px;border-radius:18px;background:rgba(196,72,52,.08);box-shadow:inset 0 0 0 1px rgba(196,72,52,.25)}
.cm-rf h3{margin:0 0 4px;font:600 16px/1.2 Jost,sans-serif;color:#8A2414}.cm-rf p{margin:4px 0;font-size:13.5px}
.cm-ph{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.cm-ph a,.cm-ph span{display:block;width:72px;height:72px;border-radius:12px;overflow:hidden;background:#E7E0CF}.cm-ph img{width:100%;height:100%;object-fit:cover;display:block}

.cm-rf ul{margin:6px 0 0;padding:0;list-style:none;font-size:13px}.cm-rf li{padding:3px 0}
.cm-wa{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:12px 14px;border-radius:16px;background:rgba(37,211,102,.1);font-size:13.5px}.cm-wa b{font-weight:600}.cm-wa a{color:#10392B;font-weight:600}
.cm-f input[type=number]{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512}
.cm-f select{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512;accent-color:#10392B}
.cm-f input.cm-fige{background:#EFE8DA;color:#171512;font-weight:600;cursor:default}
.cm-f select:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.cm-pick{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border-radius:16px;border:2px dashed rgba(16,57,43,.35);background:#FFFDF8;color:#10392B;font:600 15px Jost,sans-serif;cursor:pointer}
.cm-pick input{position:absolute;width:1px;height:1px;opacity:0}
@media (prefers-reduced-motion:reduce){.cm-bg,.cm{animation:none!important;transition:none!important}}
/* ——— refonte 2026-11 (lots 11 et 12) : jetons data-v2, clair et sombre ; l'écran d'une commande est en plein écran ——— */
.cm[data-v2]{background:var(--papier);color:var(--encre)}
html[data-theme=sombre] .cm[data-v2]{color-scheme:dark}
.cm-bg.plein{animation:none;background:var(--papier, #F2EBDD)}
/* la barre d'onglets reste visible (maquette) : l'écran finit à --barre-h du bas (hauteur réelle de la barre, posée par l'application) */
.cm-bg.plein{bottom:var(--barre-h, 0px)}
.cm[data-v2].plein{max-width:560px;height:100%;max-height:100%;border-radius:0;padding:calc(6px + env(safe-area-inset-top)) 16px calc(40px + env(safe-area-inset-bottom));animation:none}
/* le mot secret à taper, dans le panneau sombre de la maquette (feuille du bas) */
.cv-motp{background:var(--panneau);color:#F5F0E6;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.cv-motp-t{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}.cv-motp-t label{flex:1}
.cv-motp-t .nbul{flex:none;min-width:0;height:24px;padding:0 10px;border-radius:999px;background:rgba(242,194,48,.18);color:#F2C230;font:700 12.5px/24px Jost,sans-serif}
.fl-c .cv-motp input[type=text]{min-height:58px;background:rgba(245,240,230,.07);border:1px solid rgba(245,240,230,.22);color:#F2C230;font:italic 900 32px/1.1 Jost,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:8px 14px}
.fl-c .cv-motp input::placeholder{color:rgba(242,194,48,.35);opacity:1}.fl-c .cv-motp input:focus-visible{border-color:#F2C230;box-shadow:0 0 0 1px #F2C230}.fl-c .cv-motp input:disabled{opacity:.5}
.cv-motp p{margin:0;font-size:13.5px;line-height:1.45;color:#C9BEA9}
.cv-motp-b{min-height:52px;border:0;border-radius:999px;background:#F2C230;color:#171512;font:700 16px Jost,sans-serif;cursor:pointer}.cv-motp-b:disabled{opacity:.6}.cv-motp-b:focus-visible{outline:2px solid #F5F0E6;outline-offset:2px}
.cv-pickf{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;border-radius:16px;border:1.5px dashed var(--t30);color:var(--encre);font-size:15px;font-weight:600;cursor:pointer}
.cv-pickf:has(input:focus-visible){outline:2px solid var(--vert);outline-offset:2px}.cv-pickf[hidden]{display:none}
.fl-c .cm-ph{display:flex;gap:8px;flex-wrap:wrap;margin:0}.fl-c .cm-ph:empty{display:none}.fl-c .cm-ph span{display:block;width:72px;height:72px;border-radius:12px;overflow:hidden;background:var(--lin)}.fl-c .cm-ph img{width:100%;height:100%;object-fit:cover;display:block}
.cm[data-v2] h2 em{color:var(--vert);background:linear-gradient(transparent 60%,var(--hl) 60%,var(--hl) 94%,transparent 94%)}
.cm[data-v2] .cm-sous,.cm[data-v2] .cm-note,.cm[data-v2] .cm-r small,.cm[data-v2] .cm-opt small,.cm[data-v2] .cm-disc>p,.cm[data-v2] .cm-sq p{color:var(--texte-3)}
.cm[data-v2] .cm-x{background:var(--t08);color:var(--encre)}
.cm[data-v2] .cm-seg{background:var(--t08)}.cm[data-v2] .cm-seg button{color:var(--texte-2)}.cm[data-v2] .cm-seg button[aria-pressed=true]{background:var(--carte);color:var(--encre)}
.cm[data-v2] .cm-r,.cm[data-v2] .cm-opt,.cm[data-v2] .cm-dl,.cm[data-v2] .cm-j li,.cm[data-v2] .cm-av,.cm[data-v2] .cm-disc,.cm[data-v2] .cm-sq,.cm[data-v2] .cm-lien code,.cm[data-v2] .cm-sch{background:var(--carte);color:var(--encre)}
.cm[data-v2] .cm-r .bar{background:var(--t12)}.cm[data-v2] .cm-r .bar i{background:var(--vert)}
.cm[data-v2] .cm-tag{background:var(--t08);color:var(--encre)}.cm[data-v2] .cm-tag.mais{background:rgba(242,194,48,.32);color:var(--encre)}.cm[data-v2] .cm-tag.rouge{background:rgba(196,72,52,.14);color:var(--hausse)}
.cm[data-v2] .cm-act button{border-color:var(--vert);color:var(--vert)}.cm[data-v2] .cm-act button.p{background:var(--vert);color:var(--action-t)}.cm[data-v2] .cm-act button.m{border-color:transparent}
.cm[data-v2] .cm-info{background:rgba(242,194,48,.2);color:var(--encre)}
.cm[data-v2] .cm-f input[type=text],.cm[data-v2] .cm-f input[type=number],.cm[data-v2] .cm-f input[type=datetime-local],.cm[data-v2] .cm-f textarea,.cm[data-v2] .cm-f select,.cm[data-v2] .cm-disc textarea{background:var(--champ);border-color:var(--t22);color:var(--encre)}
.cm[data-v2] .cm-f input::placeholder,.cm[data-v2] textarea::placeholder{color:var(--mute);opacity:1}
.cm[data-v2] .cm-opt:has(input:checked){border-color:var(--vert)}.cm[data-v2] .cm-opt input,.cm[data-v2] .cm-ck input{accent-color:var(--vert)}
.cm[data-v2] .cm-pil label{background:var(--carte);box-shadow:inset 0 0 0 1.5px var(--t22);color:var(--vert)}.cm[data-v2] .cm-pil label:has(input:checked){background:var(--vert);color:var(--action-t)}
.cm[data-v2] .cm-err{color:var(--hausse)}
.cm[data-v2] .cm-pick{background:var(--carte);border-color:var(--t30);color:var(--vert)}
.cm[data-v2] .cm-defi i{background:var(--champ);box-shadow:inset 0 0 0 1.5px var(--t22);color:var(--encre)}
.cm[data-v2] .cm-ph a,.cm[data-v2] .cm-ph span{background:var(--lin)}
.cm[data-v2] .cm-disc li{background:var(--lin);color:var(--encre)}.cm[data-v2] .cm-disc li.moi{background:var(--t12)}.cm[data-v2] .cm-disc li.mdg{background:rgba(242,194,48,.3)}.cm[data-v2] .cm-disc li small,.cm[data-v2] .cm-disc li.vide{color:var(--texte-3)}.cm[data-v2] .cm-disc li.vide{background:none}
.cm[data-v2] .cm-disc button{background:var(--vert);color:var(--action-t)}
.cm[data-v2] .cm-disc,.cm[data-v2] .cm-sq,.cm[data-v2] .cm-lien{border-radius:18px;box-shadow:none;border:0;margin:0}
.cm[data-v2] .cm-lien{background:var(--carte)}.cm[data-v2] .cm-lien-l li,.cm[data-v2] .cm-lien small{color:var(--texte-2)}.cm[data-v2] .cm-lien-e{background:var(--t08);color:var(--texte-2)}
.cm[data-v2] .cm-lien button{border-color:var(--vert);color:var(--vert)}.cm[data-v2] .cm-lien button.p{background:var(--vert);color:var(--action-t)}.cm[data-v2] .cm-lien-i{background:var(--champ)}
.cm[data-v2] .cm-sch li,.cm[data-v2] .cm-sch-t,.cm[data-v2] .cm-ou{color:var(--texte-3)}.cm[data-v2] .cm-sch li b{color:var(--encre)}
.cm[data-v2] .cm-rf{border-radius:18px;margin:0;background:rgba(196,72,52,.08);box-shadow:inset 0 0 0 1.5px var(--hausse)}.cm[data-v2] .cm-rf h3{color:var(--hausse)}
.cm[data-v2] .cm-sq td{border-top-color:var(--t10)}.cm[data-v2] .cm-sq tr.tot td{border-top-color:var(--vert)}.cm[data-v2] .cm-sq td small{color:var(--texte-3)}
.cm[data-v2] .cm-av-recu,.cm[data-v2] .cm-av-fid{border-top-color:var(--t10)}
.cm[data-v2] [style*="#5E5546"]{color:var(--texte-3)!important}
.cm[data-v2] [style*="background:#FFFDF8"]{background:var(--recu)!important;color:var(--encre)!important;box-shadow:inset 0 0 0 1.5px var(--t14)!important}
.cm[data-v2] [style*="color:#10392B"]{color:var(--vert)!important}
.cm[data-v2] .cm-tcode{background:var(--t08);color:var(--encre)}.cm[data-v2] .cm-tcode b{color:var(--vert)}
.cm[data-v2] .cm-st{background:var(--recu);color:var(--encre);margin:0}
.cm[data-v2] .cm-f label.t,.cm[data-v2] .cm-motif legend.t{color:var(--encre)}
/* l'écran */
.cv{display:flex;flex-direction:column;gap:18px}
.cv-haut{display:flex;align-items:center;margin:0 0 -6px -11px;min-height:44px}
.cv-ret{display:flex;align-items:center;gap:0;min-height:44px;padding:0 8px 0 0;border:0;background:none;color:inherit;font:400 14px Jost,sans-serif;cursor:pointer}
.cv-ret svg{width:44px;height:22px}.cv-ret span{color:var(--texte-3)}
.cv-ret:focus-visible,.cv-lien:focus-visible,.cv-b:focus-visible,.cv-dep:focus-visible,.cv-opt:focus-visible,.cv-case:focus-visible,.cv-papier:focus-visible,.cv-etoiles button:focus-visible{outline:2px solid var(--vert);outline-offset:2px}
.cv-tete{display:flex;flex-direction:column;gap:6px}
.cv-h1{margin:0;font:600 28px/1.08 Jost,sans-serif;letter-spacing:-.015em;text-wrap:balance;overflow-wrap:anywhere}
.cv-h1 em{font-weight:900;font-style:italic;color:var(--vert);letter-spacing:-.02em;padding:0 .06em 0 .02em;background:linear-gradient(transparent 60%,var(--hl) 60%,var(--hl) 94%,transparent 94%);-webkit-box-decoration-break:clone;box-decoration-break:clone}
.cv-h1[tabindex="-1"]:focus{outline:none}
.cv-sous{margin:0;font-size:14px;line-height:1.4;color:var(--texte-2)}
.cv-h2{margin:0;font:700 19px/1.2 Jost,sans-serif;color:var(--encre)}
.cv-p{margin:0;font-size:14px;line-height:1.45;color:var(--texte-2)}.cv-p.petit{font-size:12.5px;color:var(--texte-3)}
.cv-num{margin:0;font-size:12.5px;color:var(--texte-3)}
.cv-tt{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.cv-tt>span{font-size:12.5px;font-weight:600;color:var(--texte-3);white-space:nowrap}.cv-tt>span.ok{color:var(--vert-texte)}
/* reçu */
.cv-recu{background:var(--recu);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:var(--ombre)}
.cv-l{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:14px;line-height:1.35}
.cv-l>span:first-child{color:var(--texte-3);flex:none}.cv-l>:last-child{text-align:right;font-variant-numeric:tabular-nums;min-width:0;overflow-wrap:anywhere}
.cv-dep::after{content:"";position:absolute;inset:-10px -4px}
.cv-dep{position:relative;border:0;background:none;padding:0;min-height:24px;font:inherit;color:var(--encre);text-decoration:underline;text-decoration-color:var(--t30);text-underline-offset:3px;cursor:pointer;text-align:right}
.cv-ph{margin:0}
.cv-trait{height:1px;background:var(--t10)}
.cv-tot{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.cv-tot span{font-size:14px;font-weight:600}
.cv-tot b{font-size:28px;font-weight:800;color:var(--vert);letter-spacing:-.02em;font-variant-numeric:tabular-nums;white-space:nowrap}
/* mot secret */
.cv-mot{background:var(--panneau);color:#F5F0E6;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px}
.cv-mot-t{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700}
.cv-mot-v{font:italic 900 32px/1.1 Jost,sans-serif;letter-spacing:.04em;color:#F2C230;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.cv-mot p{margin:0;font-size:13.5px;line-height:1.45;color:#C9BEA9}
.cv-mot button{align-self:flex-start;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(245,240,230,.3);background:none;color:#F5F0E6;font:600 14px Jost,sans-serif;display:flex;align-items:center;gap:8px;cursor:pointer}
.cv-mot button:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
/* suivi */
.cv-suivi{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column}
.cv-et{display:flex;gap:14px;min-height:46px}
.cv-et .g{width:22px;flex:none;display:flex;flex-direction:column;align-items:center}
.cv-et .d{box-sizing:border-box;width:18px;height:18px;margin-top:2px;border-radius:999px;border:2px solid var(--t22);flex:none;display:grid;place-items:center}
.cv-et.fait .d{background:var(--vert);border:0;color:var(--action-t)}
.cv-et.ici .d{width:22px;height:22px;margin-top:0;background:#F2C230;border:0}
.cv-et .ln{flex:1;width:2px;background:var(--t14);margin:3px 0}.cv-et.fait .ln{background:var(--vert)}.cv-et:last-child .ln{background:transparent}
.cv-et .x{flex:1;min-width:0;display:flex;justify-content:space-between;gap:8px;padding-bottom:12px}
.cv-et .x b{font-size:15px;font-weight:500;color:var(--mute)}.cv-et.fait .x b,.cv-et.ici .x b{color:var(--encre)}.cv-et.ici .x b{font-weight:700}.cv-et.pb .x b{color:var(--hausse)}
.cv-et .x small{font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums;padding-top:2px;white-space:nowrap}
.cv-fil{display:flex;flex-direction:column;gap:2px}.cv-fil h3{margin-bottom:6px}
.cv-fil div{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--t08)}
.cv-fil small{flex:none;font-size:12.5px;color:var(--mute);font-variant-numeric:tabular-nums;padding-top:2px}.cv-fil span{font-size:14px;line-height:1.4;min-width:0;overflow-wrap:anywhere}
/* boutons */
.cv-acts{display:flex;flex-direction:column;gap:10px}
.cv-b{box-sizing:border-box;min-height:54px;border:0;border-radius:999px;background:var(--vert);color:var(--action-t);font:700 16px Jost,sans-serif;padding:8px 20px;display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;cursor:pointer;width:100%}
.cv-b.o{min-height:48px;border:1.5px solid var(--vert);background:none;color:var(--vert);font-size:15px}
.cv-b.r{min-height:50px;border:1.5px solid var(--hausse);background:none;color:var(--hausse);font-size:15px}
.cv-b.gris,.cv-b:disabled{background:var(--lin-2);color:var(--texte-2);cursor:default}
.cv-lien{align-self:center;min-height:44px;padding:0 8px;border:0;background:none;color:var(--texte-3);font:600 14px Jost,sans-serif;text-decoration:underline;text-underline-offset:3px;cursor:pointer;text-align:center}
.cv-lien.v{color:var(--vert)}.cv-lien.g{align-self:flex-start;padding:0;margin-top:-8px}
.cv-lien.nu{text-decoration:none;color:var(--texte-2)}
.cv-acts>.cv-p{margin-bottom:-2px}
/* cartes */
.cv-jaune{background:#F6E2B0;color:#3D2E05;border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:6px}
.cv-jaune b{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}.cv-jaune span{font-size:14px;line-height:1.45}
.cv-vertc{background:#DCEFE3;color:#10392B;border-radius:16px;padding:14px 16px;font-size:14px;font-weight:600;line-height:1.45;display:flex;gap:10px;align-items:flex-start}
.cv-carte{background:var(--carte);border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:4px}
.cv-carte b{font-size:15px;font-weight:700}.cv-carte span{font-size:13.5px;line-height:1.4;color:var(--texte-3)}
.cv-retard{flex-direction:row;gap:12px;border:1.5px solid #F2C94C;color:var(--encre)}.cv-retard>svg{color:#765802;margin-top:1px}
html[data-theme=sombre] .cv-retard>svg{color:#F2C94C}
.cv-retard>span{display:flex;flex-direction:column;gap:2px}.cv-retard>span>span{color:var(--texte-3)}
.cv-pb{background:var(--carte);border:1.5px solid var(--hausse);border-radius:18px;padding:16px;display:flex;flex-direction:column;gap:8px}
.cv-pb b{font-size:16px;font-weight:700}.cv-pb>span{font-size:14px;line-height:1.45;color:var(--texte-2)}.cv-pb .cv-num{font-size:12.5px;color:var(--texte-3)}
/* terminée, avis */
.cv-fin{background:var(--carte);border-radius:20px;padding:18px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.cv-tampon{transform:rotate(-5deg);border:2px solid var(--vert);color:var(--vert);border-radius:6px;padding:3px 10px;font-size:13.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.cv-fin-t{font-size:15px;font-weight:600}
.cv-etoiles{display:flex;gap:2px}
.cv-etoiles button{width:44px;height:44px;border:0;background:none;display:grid;place-items:center;padding:0;cursor:pointer;border-radius:10px}
.cv-etoiles svg{fill:none;stroke:var(--mute)}.cv-etoiles button.on svg{fill:#F2C230;stroke:#F2C230}
.cv-fin textarea{box-sizing:border-box;width:100%;min-height:80px;border-radius:14px;border:1px solid var(--t22);background:var(--champ);padding:10px 12px;font:400 16px/1.4 Jost,sans-serif;color:var(--encre);resize:none}
.cv-fin textarea::placeholder{color:var(--mute);opacity:1}
.cv-fin .cv-b.o{min-height:44px;font-size:14px}.cv-fin .cm-err{margin:0;min-height:0}
.cv-ok{font-size:13.5px;font-weight:600;color:var(--vert-texte)}
.cv-fin .cm-av-f svg{stroke:var(--mute)}
/* préparation du chargement */
.cv-prepa{display:flex;flex-direction:column;gap:12px}
.cv-grille{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.cv-case{position:relative;aspect-ratio:1;border-radius:14px;border:1.5px dashed var(--t30);background:var(--carte);display:grid;place-items:center;color:var(--texte-3);padding:0;overflow:hidden;cursor:pointer;min-height:44px}
.cv-case.on{border:0;background:var(--sable-clair)}.cv-case img{width:100%;height:100%;object-fit:cover;display:block}
.cv-case input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.cv-case:focus-within{outline:2px solid var(--vert);outline-offset:2px}
.cv-champ{display:flex;align-items:center;gap:8px;height:56px;border-radius:16px;border:1.5px solid var(--t22);background:var(--champ);padding:0 16px}
.cv-champ:focus-within{border-color:var(--vert)}
.cv-champ input{flex:1;min-width:0;align-self:stretch;border:0;background:none;outline:none;font:600 18px Jost,sans-serif;color:var(--encre);font-variant-numeric:tabular-nums}
.cv-champ input::placeholder{color:var(--mute);font-weight:400;opacity:1}.cv-champ span{font-size:16px;font-weight:600;color:var(--texte-3)}
.cv-papier{min-height:60px;border-radius:16px;border:1.5px dashed var(--t30);background:var(--carte);color:var(--encre);font:600 15px Jost,sans-serif;display:flex;align-items:center;gap:12px;padding:10px 16px;text-align:left;cursor:pointer}
.cv-papier>span{display:flex;flex-direction:column;gap:2px}.cv-papier small{font-size:12.5px;font-weight:500;color:var(--texte-3)}
div.cv-papier{flex-direction:column;align-items:stretch;cursor:default}div.cv-papier.ok{flex-direction:row;align-items:center;border-style:solid;border-color:var(--vert-texte);color:var(--vert-texte)}
.cv-papier .cm-defi{margin:0}.cv-papier .cv-b{position:relative}
.cv-chk{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cv-chk li{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--texte-3)}.cv-chk li.ok{color:var(--encre)}.cv-chk li.ok svg{color:var(--vert-texte)}
.cv-prepa .cm-err{margin:0;min-height:0}.cv-prepa .cm-err:empty{display:none}
/* arrangement à trois */
.cv-part{display:flex;flex-direction:column;gap:12px}
.cv-avs{display:flex}.cv-avs i{width:28px;height:28px;border-radius:999px;font:700 11.5px/1 Jost,sans-serif;font-style:normal;display:grid;place-items:center;border:2px solid var(--papier)}
.cv-avs .v{background:var(--vert);color:var(--action-t)}.cv-avs .a{background:var(--lin);color:var(--texte-2)}.cv-avs i+i{margin-left:-8px}.cv-avs .m{background:#F6E2B0;color:#3D2E05;margin-left:-8px}
.cv-opt{display:flex;align-items:center;gap:12px;min-height:54px;padding:8px 16px;border-radius:16px;border:1.5px solid var(--t10);background:var(--carte);color:var(--encre);text-align:left;font:inherit;cursor:pointer;width:100%;box-sizing:border-box}
.cv-opt .rb{width:22px;height:22px;flex:none;border-radius:999px;border:2px solid var(--t30);display:grid;place-items:center;box-sizing:border-box}.cv-opt .rb span{width:10px;height:10px;border-radius:999px}
.cv-opt.on{border-color:var(--vert)}.cv-opt.on .rb{border-color:var(--vert)}.cv-opt.on .rb span{background:var(--vert)}
.cv-opt .l{flex:1;font-size:15px;font-weight:600}.cv-opt .s{font-size:12.5px;color:var(--texte-3);text-align:right}
.cv-opt:focus-within{outline:2px solid var(--vert);outline-offset:2px}
.cv-pas{display:flex;align-items:center;justify-content:space-between;background:var(--champ);border:1px solid var(--t14);border-radius:18px;padding:6px}
.cv-pas button{width:44px;height:44px;border-radius:999px;border:0;background:var(--lin);display:grid;place-items:center;color:var(--encre);cursor:pointer}.cv-pas span{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums}
.cv-total{display:flex;justify-content:space-between;align-items:baseline;gap:10px;background:var(--recu);border-radius:16px;padding:14px 16px}
.cv-total span{font-size:14px;color:var(--texte-3)}.cv-total b{font-size:22px;font-weight:800;color:var(--vert);font-variant-numeric:tabular-nums}
.cv-fil3{display:flex;flex-direction:column;gap:8px}
.cv-bul{align-self:flex-start;max-width:88%;background:var(--carte);color:var(--encre);border-radius:16px;padding:10px 14px;display:flex;flex-direction:column;gap:4px}
.cv-bul.moi{align-self:flex-end;background:var(--vert);color:var(--action-t)}.cv-bul.mdg{background:#F6E2B0;color:#3D2E05}
.cv-bul b{font-size:12.5px;font-weight:700;opacity:.85}.cv-bul>span{font-size:14px;line-height:1.4}.cv-bul strong{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}.cv-bul small{font-size:12.5px;opacity:.85}
.cv-bul .cv-b{min-height:44px;font-size:14px;margin-top:4px}.cv-bul .cv-lien{color:inherit;align-self:flex-start;padding:0}
.cv-part .cm-err{margin:0;min-height:0}
/* signaler un problème */
.cv-form{display:flex;flex-direction:column;gap:10px;margin-top:6px}.cv-form .cm-motif{display:flex;flex-direction:column;gap:10px}
.cv-form label.t{margin:6px 0 -4px}.cv-form .cv-pick{position:relative;cursor:pointer}.cv-form .cm-ph{margin:0}.cv-form .cm-ph:empty{display:none}
.cv-carteVive{margin:0 -16px;position:relative}.cv-carteVive .sv{margin:0;height:240px}
@media (max-width:340px){.cv-h1{font-size:25px}.cv-tot b{font-size:24px}.cv-mot-v{font-size:28px}}`;
  function css() { if (document.getElementById('cmCss')) return; const s = document.createElement('style'); s.id = 'cmCss'; s.textContent = CSS; document.head.appendChild(s); }


  const humeur = c => c.etat === 'annulee' || c.etat === 'litige' ? 'triste' : c.etat === 'terminee' ? 'plein' : navigator.onLine === false ? 'ferme' : c.etape && c.etape !== 'confirmee' && c.etape !== 'preparation' ? 'plein' : 'charge';
  const ordre = (c, J) => ETAPES.filter(([k]) => k !== 'transbordement' || c.etape === 'transbordement' || (J || []).some(e => e.evenement === 'transbordement'));
  function avance(c, J) {
    const L = ordre(c, J), i = L.findIndex(([k]) => k === c.etape);
    return c.etat === 'a_confirmer' ? 0 : i < 0 ? 0 : i / (L.length - 1);
  }

  // état
  let lu = false, bg = null, vue = 'liste', filtre = 'cours', liste = [], journal = {}, transport = {}, lien = {}, pos = {}, carte = null, sel = null, charge = false, minuteur = null, echec = false;
  const trouve = id => liste.find(x => x.id === id);
  const enRoute = c => c.etat === 'en_cours' && ['chargement', 'transport', 'transbordement', 'arrivee'].includes(c.etape);
  function oublierCarte() { if (carte && carte.api) carte.api.detruire(); carte = null; }
  let retourFocus = null;
  function fermer(parOnglet) { finGeste(); oublierCarte(); if (!bg) return;
    if (parOnglet !== true && window.MDGOnglets && MDGOnglets.cacher) try { MDGOnglets.cacher(); } catch (_) {} bg.remove(); bg = null; if (retourFocus && retourFocus.focus) try { retourFocus.focus({ preventScroll: true }); } catch (_) {} retourFocus = null; clearInterval(minuteur); minuteur = null; clearInterval(prepaChrono); document.removeEventListener('keydown', clavier); }
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  const horsLigne = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET/i.test(String((e && e.message) || e || ''));
  const erreurTxt = e => { if (horsLigne(e)) return 'Pas de connexion : rien n’a été enregistré. Réessayez quand le réseau revient.'; const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : (window.MDGErreur ? MDGErreur(e) : (m.replace(/^[A-Z_]{4,} : /, '') || 'Réessayez dans un instant.')); };

  const seq = {};           // commande → séquestre (commande_sequestre, schémas 57-58)
  const dl = {};            // commande → délais (commande_delais, schéma 92)
  const suivi = {};         // commande → retards, demandes de nouvelles et délai (commande_suivi_lire, schéma 99a)
  const disc = {};          // commande → discussion à trois pendant un litige (litige_messages_lire, schéma 58)
  async function lireListe() {
    if (!N() || !N().session()) return;
    liste = J(KC(), liste);
    if (navigator.onLine === false) return;
    charge = true;
    try { liste = (await N().rpc('mes_commandes2').catch(e => /schema cache|Could not find the function/i.test(String(e && e.message)) ? N().rpc('mes_commandes') : Promise.reject(e))) || []; W(KC(), liste); lu = true; echec = false; try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} } catch (e) { echec = true; if (bg) toast('Commandes indisponibles pour l’instant', { type: 'erreur', sous: erreurTxt(e) }); }
    charge = false;
  }
  async function lireJournal(id) {
    if (navigator.onLine === false) return;
    const c = trouve(id), suivre = c && enRoute(c);
    const [j, t, p, l] = await Promise.all([N().rpc('commande_journal', { p_id: id }).catch(() => null), N().rpc('commande_transport', { p_id: id }).catch(() => null),
      suivre ? N().rpc('commande_position', { p_cmd: id }).catch(() => null) : null,
      c && c.mode_transport !== 'reseau' ? N().rpc('suivi_lien_etat', { p_cmd: id }).catch(() => null) : null]);
    if (j) journal[id] = j; if (t) transport[id] = t; if (p) pos[id] = p; lien[id] = l || null;
    if (c && ['terminee', 'litige', 'en_cours', 'a_confirmer'].includes(c.etat)) { const s = await N().rpc('commande_sequestre', { p_id: id }).catch(() => null); if (s) seq[id] = s; }
    if (c && (c.etat === 'litige' || c.refus_le)) { const d = await N().rpc('litige_messages_lire', { p_cmd: id }).catch(() => null); if (d) disc[id] = d; }
    if (c && c.etat === 'litige') part[id] = await N().rpc('commande_participation_lire', { p_id: id }).catch(() => null);
    // délais (schéma 92) : échéance de chargement, livraison déclarée, essais du mot secret ; serveur pas à jour : rien
    // schéma 97b : aussi pendant un litige, pour savoir s'il s'est ouvert tout seul (acheteur muet 1 h après « livré »)
    // schéma 99a : le fil du suivi (retards, demandes de nouvelles, délai), lu à côté du journal des étapes ; serveur pas à jour : rien
    const [d, s] = await Promise.all([c && ['en_cours', 'litige'].includes(c.etat) ? N().rpc('commande_delais', { p_id: id }).catch(() => null) : null,
      c && c.etat !== 'a_confirmer' ? N().rpc('commande_suivi_lire', { p_id: id }).catch(() => null) : null]);
    if (d) dl[id] = d; if (Array.isArray(s)) suivi[id] = s;
    if (c && c.etat === 'terminee') { const a = await N().rpc('avis_commande_moi', { p_cmd: id }).catch(() => null); if (a) avis[id] = a; }
  }
  let sigAvant = '';
  async function rafraichir() {
    if (!bg || document.hidden) return;
    const avant = sel && trouve(sel) && trouve(sel).etape;
    await lireListe(); if (sel) await lireJournal(sel);
    if (!bg) return;
    // un formulaire est ouvert (créer la commande, refuser, confirmer une étape) : on ne le redessine pas, sinon ce qu'on a choisi ou écrit disparaît
    if (dernierEcran === 'creer' || dernierEcran === 'geste') return;
    const fo = document.activeElement; if (fo && bg.contains(fo) && /^(INPUT|TEXTAREA|SELECT)$/.test(fo.tagName)) return;
    const apres = sel && trouve(sel) && trouve(sel).etape;
    // rien de neuf depuis la dernière relecture : on ne redessine pas (sinon l'écran clignote et le défilement saute toutes les 20 s)
    let sig = ''; try { sig = JSON.stringify([vue, sel, filtre, liste, sel ? journal[sel] : null, sel ? suivi[sel] : null, sel ? dl[sel] : null, sel ? seq[sel] : null, sel ? part[sel] : null, sel ? avis[sel] : null, sel ? lien[sel] : null]); } catch (_) {}
    if (sig && sig === sigAvant) return; sigAvant = sig;
    peindre(avant && apres && avant !== apres ? apres : null);
  }

  // la liste
  // reçue mais pas encore clôturée (libere_le vaut null seulement avec mes_commandes2 : l'ancienne liste ne le donne pas)
  const aVerifier = x => x.etat === 'terminee' && x.libere_le === null;
  const dansDelai = x => aVerifier(x);   // l'acheteur peut refuser tant que rien n'est libéré (clôture automatique 1 h après la réception, schéma 89)
  const enCours = x => x.etat === 'en_cours' || x.etat === 'a_confirmer' || x.etat === 'litige' || aVerifier(x);
  const aAgir = x => (x.etat === 'a_confirmer' && !x.cree_par_moi) || x.annulation === 'autre' || (x.role === 'acheteur' && dansDelai(x))
    || (x.etat === 'en_cours' && ((x.role === 'vendeur' && ['confirmee', 'preparation'].includes(x.etape)) || (x.role === 'acheteur' && ['transport', 'transbordement', 'arrivee'].includes(x.etape))));
  function ligneCmd(x) {
    const st = x.etat === 'a_confirmer' ? (x.cree_par_moi ? 'En attente de confirmation' : 'À confirmer') : x.etat === 'annulee' ? 'Annulée' : x.etat === 'litige' ? (x.refus_le ? 'Marchandise refusée' : 'Litige en cours') : aVerifier(x) ? (x.role === 'acheteur' ? 'À vérifier' : 'Vérification par l’acheteur') : x.etat === 'terminee' && x.liberation ? 'Clôturée' : LIB[x.etape] || '';
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
      <div class="cm-seg" role="group" aria-label="Afficher">${[['cours', 'En cours'], ['fini', 'Clôturées et annulées']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filtre === k}">${l}</button>`).join('')}</div>
      <div class="cm-li">${charge && !liste.length ? (window.MDGSac ? MDGSac.charge('Vos commandes arrivent…') : '<p>Chargement…</p>')
        : L.length ? L.map(ligneCmd).join('')
        // FIA-63 : lecture ratée et rien en mémoire : on ne dit pas « Aucune commande », on dit que la liste n'a pas pu être lue
        : !liste.length && (echec || (!lu && navigator.onLine === false)) ? (window.MDGSac ? MDGSac.vide(navigator.onLine === false ? 'Pas de connexion' : 'Commandes indisponibles', 'Vos commandes s’afficheront dès que le serveur répond.') : '<p>Commandes indisponibles.</p>')
        : (window.MDGSac ? MDGSac.vide(filtre === 'cours' ? 'Aucune commande en cours' : 'Rien ici pour l’instant', 'Après un accord conclu, touchez « Suivre la commande » dans la négociation.') : '<p>Aucune commande.</p>')}</div>
      <p class="cm-note">Paiement à la livraison, après avoir vu la marchandise. Le séquestre (argent bloqué jusqu’à ce que l’acheteur valide) est en construction.</p>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; peindre(); });
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detail(b.dataset.id));
  }

  // le détail : la scène, la progression, le statut, les actions, le journal
  // schéma 92 : l'échéance de chargement, dite aux deux (après, l'acheteur peut annuler seul)
  function prochaine(c) {
    const r = prochaine0(c), D = dl[c.id];
    if (c.etat !== 'en_cours' || !['confirmee', 'preparation'].includes(c.etape) || !D || !D.chargement_echeance || c.annulation) return r;
    const fin = quand(D.chargement_echeance);
    // schéma 99a : vendeur banni, l'acheteur annule sans attendre l'échéance
    if (D.vendeur_banni && D.peut_annuler_retard) return ['Vendeur <em>banni</em>', 'Ce vendeur a été banni du Marché de Gros. Vous pouvez annuler la commande.'];
    if (D.peut_annuler_retard) return ['Chargement <em>en retard</em>', 'Le vendeur n’a pas chargé à temps. Vous pouvez annuler, ou signaler un problème.'];
    return [r[0], (r[1] ? r[1] + ' ' : '') + (c.role === 'vendeur' ? `Échéance du chargement : ${fin}. Après, l’acheteur pourra annuler.` : `Échéance du chargement : ${fin}.`)];
  }
  function prochaine0(c) {
    const lui = esc(c.partenaire_nom);
    if (c.etat === 'a_confirmer') return c.cree_par_moi ? [`En attente de <em>${lui}</em>`, 'La commande démarre quand l’autre partie la confirme.'] : [`${lui} vous propose cette <em>commande</em>`, 'Vérifiez le transport et le lieu de livraison, puis confirmez.'];
    if (c.etat === 'annulee') return ['Commande <em>annulée</em>', 'Le stock est revenu sur l’annonce.'];
    const S = seq[c.id], R = S && S.refus;
    if (c.etat === 'litige' && R) {
      if (c.role === 'acheteur') return ['Refus <em>envoyé</em>', 'Le vendeur va répondre. S’il n’est pas d’accord, expliquez-vous dans la discussion à trois : l’équipe du Marché de Gros juge.'];
      if (c.role === 'vendeur') return R.vendeur ? ['Refus <em>contesté</em>', 'Expliquez-vous dans la discussion à trois : l’équipe du Marché de Gros juge avec les photos, le mot secret et le numéro de commande.'] : [`${lui} refuse la <em>marchandise</em>`, 'Regardez les photos ci-dessous, puis répondez. Vous pouvez aussi écrire dans la discussion à trois.'];
    }
    // schéma 97b : litige ouvert tout seul, l'acheteur n'ayant rien dit 1 h après « livré » ; encore 1 h sans réponse : close pour le vendeur
    const DA = dl[c.id];
    if (c.etat === 'litige' && DA && DA.litige_auto && DA.cloture_echeance) {
      const h = heure(DA.cloture_echeance);
      return c.role === 'acheteur'
        ? ['Litige <em>ouvert</em>', `Réception non confirmée. Confirmez-la ou expliquez le problème avant ${h}. Sinon, la commande sera close pour le vendeur.`]
        : ['Litige <em>ouvert</em>', `L’acheteur n’a pas confirmé la réception. Sans réponse de sa part avant ${h}, la commande sera close en votre faveur.`];
    }
    // CMP-10 : le délai de l'équipe (litige_echeance, 72 h réglables, commande_delais) et ce qu'on peut faire, en peu de mots
    if (c.etat === 'litige') { const D3 = disc[c.id], ecrire = D3 && D3.ouvert ? ' Expliquez-vous dans la discussion à trois.' : '';
      return ['Litige <em>ouvert</em>', (DA && DA.litige_echeance ? `Réponse de l’équipe prévue avant ${quand(DA.litige_echeance)}.` : 'L’équipe du Marché de Gros examine la commande.') + ecrire]; }
    if (aVerifier(c) || (S && c.etat === 'terminee' && !S.libere_le)) {
      const fin = S && S.echeance ? quand(S.echeance) : '1 h après la réception';
      // sans séquestre actif, aucun argent ne passe par l'application : seule la commande se clôture
      const auto = 'la commande est clôturée automatiquement';
      return c.role === 'acheteur'
        ? ['Vérifiez la <em>marchandise</em>', `Tout est bon : confirmez. Un problème (gâté, abîmé, manquant) : refusez avec le mot secret du vendeur et des photos. Sans réclamation, ${auto} : ${fin}.`]
        : ['Réception <em>confirmée</em>', `${lui} vérifie la marchandise. Sans réclamation de sa part, ${auto} : ${fin}.`];
    }
    if (c.etat === 'terminee' && (c.liberation || (S && S.liberation))) {
      const L = c.liberation || S.liberation, mr = Number(c.montant_refuse || (S && S.montant_refuse) || 0);
      const hors = S && S.actif ? '' : ' Aucun paiement ne passe encore par l’application : réglez-le entre vous.';
      if (L === 'refus' || mr > 0) return ['Commande <em>clôturée</em>', (mr >= Number(c.montant || 0) ? 'La marchandise a été refusée : elle n’est pas due.' : `Refus partiel : ${F(mr)} de marchandise refusée ne sont pas dus ; le reste est dû au vendeur.`) + hors];
      // schéma 97b : close après le litige ouvert tout seul, l'acheteur n'ayant pas répondu
      const SR = (journal[c.id] || []).some(e => e.evenement === 'terminee' && /^En faveur du vendeur/.test(e.note || ''));
      if (L === 'auto' && SR) return ['Commande <em>clôturée</em>', c.role === 'acheteur' ? 'Close pour le vendeur : pas de réponse de votre part dans l’heure.' : 'Close en votre faveur : l’acheteur n’a pas répondu.'];
      return ['Commande <em>clôturée</em>', L === 'auto' ? 'Clôturée automatiquement : aucun problème signalé dans l’heure. Merci !' : L === 'admin' ? 'Clôturée par l’équipe du Marché de Gros.' : 'L’acheteur a confirmé que tout est conforme. Merci !'];
    }
    if (c.etat === 'terminee') return ['Marchandise <em>reçue</em>', 'Réclamation possible pendant 1 h après la réception, puis la commande est clôturée.'];
    if (c.annulation === 'autre') return [`${lui} demande l’<em>annulation</em>`, 'Acceptez ou refusez.'];
    if (c.annulation === 'moi') return ['Annulation <em>demandée</em>', `En attente de la réponse de ${lui}.`];
    const V = c.role === 'vendeur', MOTM = c.validation === 'declaration' && c.mode_transport !== 'reseau';   // son propre transporteur : le mot secret
    if (c.validation === 'code') switch (c.etape) {
      case 'confirmee': case 'preparation': if (V) return ['Préparez la <em>marchandise</em>', 'Quand elle est dans le camion, donnez au chauffeur le code de prise en charge (ci-dessous).']; break;
      case 'transport': case 'transbordement': if (!V) return ['Votre marchandise est <em>en route</em>', 'À l’arrivée, vérifiez la marchandise, puis donnez au chauffeur le code de réception (ci-dessous).']; break;
      case 'arrivee': if (!V) return ['Le chauffeur est <em>arrivé</em>', 'Vérifiez la quantité, la qualité et le papier du vendeur, puis donnez-lui le code de réception. Un problème : refusez avec des photos.']; break;
    }
    switch (c.etape) {
      case 'confirmee': return V ? ['Préparez la <em>marchandise</em>', (MOTM ? 'Glissez le mot secret (ci-dessous) dans la marchandise. ' : '') + 'Touchez « En préparation », puis « Chargement confirmé » quand le camion est chargé' + (c.mode_transport !== 'reseau' ? ', et « Le camion est parti » au départ.' : '.')] : ['Le vendeur prépare votre <em>marchandise</em>', 'Vous serez prévenu au chargement.'];
      case 'preparation': return V ? ['Marchandise en <em>préparation</em>', (S && S.depart && (S.depart.mot_ok || !S.mot) ? 'Confirmez le chargement quand le camion est chargé.' : 'Photographiez le colis emballé et pesez-le, puis confirmez le chargement.')] : ['Marchandise en <em>préparation</em>', 'Prochaine étape : le chargement.'];
      case 'chargement': if (c.mode_transport !== 'reseau') return (V || c.role === c.mode_transport)
        ? ['Marchandise <em>chargée</em>', 'Touchez « Le camion est parti » quand il démarre. Si le chauffeur a ouvert le lien de suivi, le départ se détecte tout seul.']
        : ['Marchandise <em>chargée</em>', 'Le départ du camion sera signalé ici. ' + (MOTM && !V ? 'À l’arrivée, tapez le mot secret du vendeur pour confirmer la réception.' : '')];
        return ['Commande <em>en cours</em>', ''];
      case 'transport': case 'transbordement': return V ? ['Transport <em>en cours</em>', 'À l’arrivée, l’acheteur touche «\u00a0La marchandise est arrivée\u00a0»' + (MOTM ? ', puis tape votre mot secret. ' : ', puis confirme la réception. ') + 'S’il ne dit rien, touchez «\u00a0Marchandise livrée\u00a0».'] : ['Votre marchandise est <em>en route</em>', MOTM ? 'À l’arrivée, touchez «\u00a0La marchandise est arrivée\u00a0», vérifiez-la, puis tapez le mot secret du vendeur (sur le papier glissé dedans).' : 'À l’arrivée, touchez «\u00a0La marchandise est arrivée\u00a0», vérifiez-la, puis confirmez la réception.'];
      case 'arrivee': if (dl[c.id] && dl[c.id].reception_echeance) { const TL = dl[c.id].livre_le ? 'Marchandise <em>livrée</em>' : 'Marchandise <em>arrivée</em>';   // schéma 99a : arrivée dite par l'acheteur
        const [t0, s0] = V ? [TL, MOTM ? 'L’acheteur vérifie la marchandise, puis tape votre mot secret.' : 'L’acheteur vérifie la marchandise.']
          : [TL, MOTM ? 'Vérifiez la quantité et la qualité, retrouvez le papier du vendeur, puis tapez son mot secret. Un problème : refusez avec des photos.' : 'Vérifiez la marchandise, puis confirmez la réception. Un problème : refusez avec des photos.'];
        // schéma 99a : l'échéance réelle, délai demandé par l'acheteur compris
        const h = echeance(dl[c.id].reception_echeance), dh = dl[c.id].delai_heures, avec = dh ? ` (délai de ${dh} h compris)` : '';
        return [t0, s0 + (V ? ` Il a jusqu’à ${h}${avec} pour répondre. Sinon, un litige s’ouvre.` : ` Répondez avant ${h}${avec}. Sinon, un litige s’ouvre.`)]; }
        return V ? ['Marchandise <em>arrivée</em>', MOTM ? 'L’acheteur vérifie la marchandise, puis tape votre mot secret.' : 'L’acheteur vérifie la marchandise.'] : ['Marchandise <em>arrivée</em>', MOTM ? 'Vérifiez la quantité et la qualité, retrouvez le papier du vendeur, puis tapez son mot secret pour confirmer la réception. Un problème : refusez avec des photos. Après la réception, vous avez 1 h pour réclamer.' : 'Vérifiez la marchandise et le papier du vendeur avant de confirmer la réception. Un problème : refusez avec des photos. Après la réception, vous avez 1 h pour réclamer.'];
      default: return ['Commande <em>en cours</em>', ''];
    }
  }
  const MOT = c => c.validation === 'declaration' && c.mode_transport !== 'reseau';   // réception avec le mot secret du vendeur
  // ——— l'écran d'une commande (lots 11 et 12, maquette « MGCI App v2 » de Claude Design, 13/11/2026) ———
  // Plein écran, jetons data-v2 (clair et sombre). Tout vient de la commande, de son journal, de son suivi et de ses délais (serveur).
  const SVGR = {
    doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h7l4 4v13h-11z"/><path d="M13.5 3.5v4h4M9 12h6M9 15.5h6"/></svg>',
    retour: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    horloge: s => `<svg width="${s || 20}" height="${s || 20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
    cadenas: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F2C230" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/></svg>',
    oeil: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
    coche: (s, w) => `<svg width="${s || 12}" height="${s || 12}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 3.4}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    rond: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="flex:none"><circle cx="12" cy="12" r="7"/></svg>',
    photo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z"/><circle cx="12" cy="13.2" r="3.2"/></svg>',
    moins: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
    etoile: '<svg width="30" height="30" viewBox="0 0 24 24" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>'
  };
  // « 10 nov · 14:20 »
  const jh = t => jour(t).replace('.', '') + ' · ' + heure(t);
  // une durée restante, dite simplement : « 59 min », « 6 h 59 min », « 71 h 40 min »
  const reste = t => { const m = Math.max(0, Math.round((Date.parse(t) - Date.now()) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); };
  // le genre du produit pour « arrivé / arrivée » : un nom qui finit par « e » est féminin, sauf quelques-uns
  const feminin = s => { const m = String(s || '').trim().toLowerCase().split(/\s+/)[0] || ''; return /[^é]e$/.test(m) && !['poivre', 'sucre', 'beurre', 'gingembre', 'concombre', 'fromage', 'légume', 'légumes'].includes(m); };
  const minus = s => { s = String(s || ''); return /^[A-ZÉÈ][a-zéèêàâîïôûç]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s; };
  const ini = s => String(s || '?').split(/[\s.]+/).filter(Boolean).slice(0, 2).map(x => x.charAt(0).toUpperCase()).join('') || '?';
  // mes initiales (pile « Vous · lui · équipe » du litige)
  const moiNom = () => { const P = window.MDGCompte && MDGCompte.profil && MDGCompte.profil(); return (P && (P.prenom ? P.prenom + ' ' + (P.nom || '') : P.pseudo)) || 'Vous'; };
  const prix = c => c.prix_unitaire != null ? F(c.prix_unitaire) : null;

  // la phase de la commande, vue par l'écran
  function phase(c) {
    if (c.etat === 'a_confirmer') return 'attente';
    if (c.etat === 'annulee') return 'annulee';
    if (c.etat === 'litige') return 'litige';
    const S = seq[c.id];
    if (c.etat === 'terminee') return aVerifier(c) || (S && !S.libere_le && !c.liberation) ? 'verif' : 'fini';
    return ({ confirmee: 'prep', preparation: 'prep', chargement: 'charge', transport: 'route', transbordement: 'route', arrivee: 'arrive', reception: 'verif' })[c.etape] || 'prep';
  }
  const dernierRetard = c => (suivi[c.id] || []).filter(x => x.genre === 'retard').sort((a, b) => new Date(b.at) - new Date(a.at))[0] || null;
  // qui transporte, dit du point de vue de chacun
  function quiTransporte(c) {
    const V = c.role === 'vendeur', lui = c.partenaire_nom || '';
    if (c.mode_transport === 'vendeur') return V ? 'Votre livreur' : 'Livreur de ' + lui;
    if (c.mode_transport === 'acheteur') return V ? 'Transporteur de ' + lui : 'Votre transporteur';
    return 'Transporteur du réseau';
  }
  // le titre (un mot en voix) et la ligne dessous
  function entete(c) {
    const V = c.role === 'vendeur', lui = esc(c.partenaire_nom || ''), p = esc(minus(c.produit || 'commande')), D = dl[c.id] || {}, S = seq[c.id], ph = phase(c), Jr = journal[c.id] || [];
    const ev = k => Jr.slice().reverse().find(e => e.evenement === k);
    if (c.annulation === 'autre' && c.etat === 'en_cours') return [`${lui} demande l’<em>annulation</em>`, 'Acceptez ou refusez.'];
    if (c.annulation === 'moi' && c.etat === 'en_cours') return ['Annulation <em>demandée</em>', `${c.partenaire_nom || 'L’autre partie'} doit répondre.`];
    switch (ph) {
      case 'attente': return c.cree_par_moi ? ['En attente de <em>confirmation</em>', `${c.partenaire_nom || 'L’autre partie'} doit confirmer la commande.`]
        : V ? ['Nouvelle <em>commande</em>', [c.partenaire_nom, c.lieu_livraison, 'reçue ' + quand(c.created_at)].filter(Boolean).join(' · ')]
        : ['Commande à <em>confirmer</em>', `${c.partenaire_nom || 'Le vendeur'} vous la propose.`];
      case 'annulee': return ['Commande <em>annulée</em>', 'Le stock est revenu sur l’annonce.'];
      case 'prep': {
        if (D.vendeur_banni && D.peut_annuler_retard && !V) return ['Vendeur <em>banni</em>', 'Vous pouvez annuler la commande.'];
        if (D.peut_annuler_retard && !V) return ['Chargement <em>en retard</em>', 'Le vendeur n’a pas chargé à temps.'];
        const ech = D.chargement_echeance ? (Date.parse(D.chargement_echeance) > Date.now() ? reste(D.chargement_echeance) + ' pour charger' : 'Délai de chargement dépassé') : '';
        return V ? ['Préparez le <em>chargement</em>', ech || 'Photos du colis, poids, puis chargement']
          : [`Votre ${p} est en <em>préparation</em>`, D.chargement_echeance ? 'Chargement prévu avant ' + quand(D.chargement_echeance) : `${c.partenaire_nom || 'Le vendeur'} prépare la marchandise.`];
      }
      case 'charge': return ['Marchandise <em>chargée</em>', V || c.role === c.mode_transport ? 'Touchez « Le camion est parti » au départ.' : quiTransporte(c) + ' · départ signalé ici'];
      case 'route': {
        const R = dernierRetard(c), qui = quiTransporte(c);
        const sous = R ? 'Retard signalé' + (R.date_estimee ? ' · nouvelle arrivée vers ' + echeance(R.date_estimee) : '')
          : qui + (D.arrivee_estimee ? ' · arrivée prévue vers ' + echeance(D.arrivee_estimee) : ev('transport') ? ' · parti ' + quand(ev('transport').at) : '');
        return V ? [`Votre ${p} <em>roule</em>`, sous] : [`Votre ${p} est <em>en route</em>`, sous];
      }
      case 'arrive': {
        const a = ev('arrivee'), q = a ? (D.livre_le ? 'Livrée ' : 'Arrivée ') + quand(a.at) : '';
        return V ? [D.livre_le ? 'Marchandise <em>livrée</em>' : 'Marchandise <em>arrivée</em>', (q ? q + ' · ' : '') + (MOT(c) ? 'l’acheteur vérifie, puis tape votre mot' : 'l’acheteur vérifie')]
          : [`Votre ${p} est <em>${feminin(c.produit) ? 'arrivée' : 'arrivé'}</em>`, (q ? q + ' · ' : '') + 'vérifiez avant de confirmer'];
      }
      case 'verif': { const r = ev('reception');
        return V ? ['Réception <em>confirmée</em>', `${c.partenaire_nom || 'L’acheteur'} vérifie la marchandise.`]
          : ['Réception <em>confirmée</em>', r ? 'Confirmée ' + quand(r.at) : 'Vous avez 1 h pour signaler un problème.']; }
      case 'fini': {
        const L = c.liberation || (S && S.liberation), mr = Number(c.montant_refuse || (S && S.montant_refuse) || 0), f = ev('terminee');
        if (L === 'refus' || mr > 0) return ['Commande <em>clôturée</em>', mr >= Number(c.montant || 0) ? 'Marchandise refusée : elle n’est pas due.' : `Refus partiel : ${F(mr)} de marchandise ne sont pas dus.`];
        const SR = Jr.some(e => e.evenement === 'terminee' && /^En faveur du vendeur/.test(e.note || ''));
        if (L === 'auto' && SR) return ['Commande <em>clôturée</em>', V ? 'Close en votre faveur : l’acheteur n’a pas répondu.' : 'Close pour le vendeur : pas de réponse de votre part.'];
        const quandF = f ? 'le ' + jour(f.at).replace('.', '') + ' à ' + heure(f.at) : '';
        return V ? ['Vente <em>terminée</em>', L === 'admin' ? 'Clôturée par l’équipe du Marché de Gros.' : `Réception confirmée par ${c.partenaire_nom || 'l’acheteur'}`]
          : ['Commande <em>terminée</em>', L === 'admin' ? 'Clôturée par l’équipe du Marché de Gros.' : quandF ? 'Terminée ' + quandF : 'Commande terminée'];
      }
      case 'litige': {
        const R = S && S.refus;
        if (R) return V ? (R.vendeur ? ['Refus <em>contesté</em>', 'L’équipe du Marché de Gros juge.'] : [`${lui} refuse la <em>marchandise</em>`, 'Regardez les photos, puis répondez.']) : ['Refus <em>envoyé</em>', 'Le vendeur va répondre.'];
        if (D.litige_auto && D.cloture_echeance) return ['Litige <em>ouvert</em>', V ? `Sans réponse de l’acheteur avant ${heure(D.cloture_echeance)}, la commande est close en votre faveur.` : `Réception non confirmée. Répondez avant ${heure(D.cloture_echeance)}.`];
        return ['Problème <em>signalé</em>', D.litige_echeance ? 'L’équipe tranche avant ' + quand(D.litige_echeance) : 'L’équipe du Marché de Gros examine la commande.'];
      }
    }
    return prochaine(c);
  }

  // le reçu : marchandise, transport, départ, paiement, total figé ; commission (vendeur) seulement calculée
  const TRC = { inclus: 'Compris', a_part: 'À part', livreur_vendeur: 'Livreur du vendeur, payé par l’acheteur', retrait: 'Retrait par l’acheteur', acheteur: 'À la charge de l’acheteur', mgci: 'Transporteur du réseau' };
  const depOuvert = {};
  function recu(c) {
    const T = transport[c.id] || {}, R = T.regle || c.transport_regle, px = T.prix_transport, S = seq[c.id], D = S && S.depart, V = c.role === 'vendeur';
    const L = (a, b) => `<div class="cv-l"><span>${a}</span><span>${b}</span></div>`;
    const lignes = [];
    lignes.push(L('Marchandise', c.quantite != null ? qte(c.quantite, c.unite) + (prix(c) ? ' × ' + prix(c) : '') : '—'));
    let tr = TRC[R] || (c.mode_transport === 'acheteur' ? 'À la charge de l’acheteur' : c.mode_transport === 'vendeur' ? 'Par le vendeur' : MODES[c.mode_transport] || '—');
    if (R === 'a_part' && px != null) tr += ' · ' + F(px);
    lignes.push(L('Transport', esc(tr)));
    if (D) lignes.push(`<div class="cv-l"><span>Au départ</span><button type="button" class="cv-dep" data-dep aria-expanded="${!!depOuvert[c.id]}">${(D.photos || []).length} photo${(D.photos || []).length > 1 ? 's' : ''} · ${nf(D.poids_kg, 1)} kg pesés</button></div>`
      + (depOuvert[c.id] ? `<div class="cm-ph cv-ph">${(D.photos || []).map(x => `<span data-ph="${esc(x)}" role="img" aria-label="Photo du colis au départ"></span>`).join('')}${D.mot_photo ? `<span data-ph="${esc(D.mot_photo)}" role="img" aria-label="Photo du papier du mot secret (équipe)"></span>` : ''}</div>` : ''));
    // le reçu du vendeur de la maquette n'a pas de ligne « Paiement » (seulement celui de l'acheteur)
    if (!V || (S && S.actif)) lignes.push(L('Paiement', S && S.actif ? 'Séquestre ' + esc(OPE[S.operateur] || '') : 'À la livraison, hors application'));
    if (V && c.commission_montant != null) {
      const clos = c.etat === 'terminee' && !aVerifier(c), k = S && S.repartition ? S.repartition.vendeur_commission : c.commission_montant;
      lignes.push(c.etat === 'annulee' ? L('Commission', '0 F · commande annulée') : c.etat === 'litige' ? L('Commission prévue', '3,5 % · suspendue')
        : clos ? L('Commission calculée', F(k) + ' · rien n’est prélevé') : L('Commission prévue', '3,5 % · rien n’est prélevé'));
    }
    const tot = T.total_livraison != null && c.etat !== 'annulee' ? T.total_livraison : c.montant;
    return `<section class="cv-recu" aria-label="Reçu de la commande">${lignes.join('')}<div class="cv-trait"></div>
      <div class="cv-tot"><span>Total figé</span><b>${tot != null ? F(tot) : '—'}</b></div></section>`;
  }

  // le mot secret, sur le panneau sombre : le vendeur le voit (il l'écrit sur le papier) ; l'acheteur sait seulement qu'il le tapera
  const motVu = {};
  function panneauMot(c) {
    const S = seq[c.id], V = c.role === 'vendeur', D = dl[c.id] || {}, ph = phase(c);
    if (!MOT(c) || !['prep', 'charge', 'route', 'arrive', 'litige'].includes(ph)) return '';
    if (V) {
      if (!S || !S.mot) return '';
      const ouvert = ph === 'prep' || motVu[c.id];
      return `<section class="cv-mot" aria-label="Votre mot secret"><div class="cv-mot-t">${SVGR.cadenas}<span>Votre mot secret</span></div>
        <span class="cv-mot-v"${ouvert ? '' : ' aria-label="Mot caché"'}>${ouvert ? esc(S.mot) : '•••••  ••'}</span>
        <p>${ph === 'prep' ? 'Écrivez-le sur un papier glissé dans le colis. L’acheteur le tape à l’arrivée. Ne le donnez à personne, ni par message.' : 'Il est dans la marchandise. Ne le donnez à personne. L’acheteur a 5 essais pour le taper.'}</p>
        ${ph === 'prep' ? '' : `<button type="button" data-motvu>${SVGR.oeil}${motVu[c.id] ? 'Cacher' : 'Montrer le mot'}</button>`}</section>`;
    }
    // à l'arrivée, la maquette ne montre pas le panneau : le mot se tape dans la feuille « Tout est bon »
    if (ph === 'prep' || ph === 'arrive' || ph === 'litige' && !(D.litige_auto)) return '';
    const n = D.mot_essais_restants;
    return `<section class="cv-mot" aria-label="Le mot secret du vendeur"><div class="cv-mot-t">${SVGR.cadenas}<span>Le mot secret du vendeur</span></div>
      <span class="cv-mot-v">${n === 0 ? 'Bloqué' : (n != null ? n : 5) + ' essai' + ((n != null ? n : 5) > 1 ? 's' : '')}</span>
      <p>${n === 0 ? 'Trop d’essais faux : l’équipe est prévenue.' : 'Il est écrit sur un papier glissé dans la marchandise. Tapez-le seulement quand vous avez vérifié la marchandise.'}</p></section>`;
  }

  // le suivi vertical : chaque étape réelle avec son heure (journal du serveur)
  function suiviEtapes(c, Jr) {
    const L = [['creee', 'Commande passée']].concat(ordre(c, Jr).map(([k, l]) => [k, ({ confirmee: 'Commande confirmée', preparation: 'Préparation', chargement: 'Chargement', transport: 'En route', transbordement: 'Transbordement', arrivee: 'Arrivée', reception: MOT(c) ? 'Réception avec le mot secret' : 'Réception confirmée', terminee: 'Terminée' })[k] || l]));
    const ev = k => Jr.slice().reverse().find(e => e.evenement === k);
    const ph = phase(c), mort = c.etat === 'annulee';
    let i0 = c.etat === 'a_confirmer' ? 0 : L.findIndex(([k]) => k === c.etape);
    if (c.etat === 'terminee' && (c.liberation || c.libere_le || ph === 'fini')) i0 = L.length;   // tout est fait
    else if (c.etat === 'terminee') i0 = Math.max(i0, L.findIndex(([k]) => k === 'terminee'));
    const pb = c.etat === 'litige';
    return `<section aria-label="Suivi"><h3 class="cv-h2">Suivi</h3><ol class="cv-suivi">${L.map(([k, l], i) => {
      const e = k === 'creee' ? (ev('creee') || { at: c.created_at }) : ev(k), fait = !mort && i < i0, ici = !mort && i === i0 && c.etat !== 'terminee';
      const lab = pb && i === i0 ? (k === 'arrivee' ? 'Arrivée · problème signalé' : l + ' · problème signalé') : k === 'terminee' && (c.liberation || c.libere_le) ? 'Terminée' : l;
      const h = (fait || ici) && e && e.at ? jh(e.at) : '';
      return `<li class="cv-et${fait ? ' fait' : ''}${ici ? ' ici' : ''}${pb && i === i0 ? ' pb' : ''}"><span class="g" aria-hidden="true"><span class="d">${fait ? SVGR.coche() : ''}</span><span class="ln"></span></span>
        <span class="x"><b>${esc(lab)}<span class="cm-sr">${fait ? ' : fait' : ici ? ' : en cours' : ' : à venir'}</span></b>${h ? `<small>${h}</small>` : ''}</span></li>`; }).join('')}</ol></section>`;
  }
  // le fil du suivi : retards, nouvelles, délai, et les avis du journal qui ne sont pas des étapes (rappels, annulation, litige…)
  function fil(c, Jr) {
    const ET = new Set(ETAPES.map(([k]) => k).concat(['creee']));
    const qui = r => r === c.role ? 'Vous' : r === 'vendeur' ? (c.partenaire_nom || 'Le vendeur') : r === 'acheteur' ? (c.partenaire_nom || 'L’acheteur') : r === 'admin' ? 'L’équipe' : '';
    const L = Jr.filter(e => !ET.has(e.evenement) || (e.evenement === 'terminee' && e.role !== 'systeme' && e.note))
      .map(e => ({ at: e.at, t: [e.par_moi ? 'Vous' : '', evLib(e)].filter(Boolean).join(' : ') + (e.note ? ' · « ' + e.note + ' »' : '') }));
    const S = (suivi[c.id] || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at)), G = [];
    S.forEach(x => { const p = G[G.length - 1]; if (x.genre === 'nouvelles' && p && p.genre === 'nouvelles') { p.n++; p.at = x.at; } else G.push(Object.assign({ n: 1 }, x)); });
    G.forEach(x => {
      const w = qui(x.role);
      const t = x.genre === 'retard' ? `${w ? w + ' a signalé un retard' : 'Retard signalé'} : ${(CAUSE_R[x.motif] || 'autre').toLowerCase()}${x.date_estimee ? '. Nouvelle arrivée vers ' + quand(x.date_estimee) : ''}${x.texte ? ' · « ' + x.texte + ' »' : ''}`
        : x.genre === 'nouvelles' ? `${w === 'Vous' ? 'Vous avez demandé des nouvelles' : (w || 'L’acheteur') + ' a demandé des nouvelles'}${x.n > 1 ? ' (' + x.n + ' fois)' : ''}`
        : x.genre === 'delai' ? `Délai demandé : ${x.heures} h · ${(CAUSE_D[x.motif] || '').toLowerCase()}${x.texte ? ' · « ' + x.texte + ' »' : ''}` : '';
      if (t) L.push({ at: x.at, t });
    });
    if (!L.length) return '';
    return `<section class="cv-fil" aria-label="Fil du suivi"><h3 class="cv-h2">Fil du suivi</h3>${L.sort((a, b) => new Date(a.at) - new Date(b.at)).map(x => `<div><small>${new Date(x.at).toDateString() === new Date().toDateString() ? heure(x.at) : jh(x.at)}</small><span>${esc(x.t)}</span></div>`).join('')}</section>`;
  }

  // les gestes de chaque phase, branchés sur les vraies fonctions (data-g → geste)
  function boutons(c) {
    const V = c.role === 'vendeur', A = !V, D = dl[c.id], S = seq[c.id], K = c.validation === 'code', ph = phase(c), B = [];
    const b = (g, t, cls) => B.push(`<button type="button" class="${cls}" data-g="${g}">${t}</button>`);
    const pbAvant = D && (D.mettre_en_avant_probleme || D.date_depassee || D.nouvelles_sans_reponse);
    const signaler = () => b(A ? 'probleme' : 'litige', 'Signaler un problème', pbAvant ? 'cv-b r' : 'cv-lien');
    if (ph === 'attente') {
      if (!c.cree_par_moi) { if (V) B.push(`<p class="cv-p">En confirmant, vous avez ${(D && D.chargement_heures) || 72} h pour charger. Rappel 12 h avant.</p>`); b('oui', 'Confirmer la commande', 'cv-b'); b('non', 'Refuser', 'cv-lien nu'); }
      else b('annuler', 'Retirer la commande', 'cv-lien');
      return B.join('');
    }
    if (c.etat === 'en_cours' && c.annulation === 'autre') { b('annul-oui', 'Accepter l’annulation', 'cv-b'); b('annul-non', 'Refuser l’annulation', 'cv-b o'); return B.join(''); }
    if (ph === 'prep') {
      if (V) { if (c.etape === 'confirmee') b('preparation', 'Marquer « en préparation »', 'cv-lien v'); if (S && S.depart && (S.depart.mot_ok || !S.mot) && !K) b('chargement', 'Déclarer le chargement', 'cv-b'); }
      if (A && D && D.peut_annuler_retard) b('retard', D.vendeur_banni ? 'Annuler la commande' : 'Annuler : le vendeur n’a pas chargé à temps', 'cv-b o');
      if (D && D.peut_demander_nouvelles && A) b('nouvelles', 'Demander des nouvelles', 'cv-b o');
      if (V && c.annulation !== 'moi' && !(D && D.peut_redemander === false)) b('annuler', 'Demander l’annulation', 'cv-lien');
      if (A) signaler();
      return B.join('');
    }
    if (ph === 'charge' || ph === 'route') {
      if (ph === 'charge' && !K && c.mode_transport !== 'reseau' && (V || c.role === c.mode_transport)) b('transport', 'Le camion est parti', 'cv-b');
      if (A && (ph === 'route' || !K)) b('arrivee', 'La marchandise est arrivée', ph === 'route' ? 'cv-b' : 'cv-b o');
      if (V && ph === 'route' && (D ? D.peut_declarer_arrivee : true)) b('arrivee', 'Le camion est arrivé', 'cv-b');
      if (V && c.mode_transport !== 'reseau' && ['a_confirmer', 'en_cours'].includes(c.etat)) B.push(`<button type="button" class="cv-b o" data-lienvu aria-expanded="${!!lienOuvert[c.id]}">Lien de suivi pour le chauffeur</button>`);
      if (D && D.peut_signaler_retard) b('retard-sig', 'Signaler un retard', 'cv-b o');
      if (A && D && D.peut_demander_nouvelles) b('nouvelles', 'Demander des nouvelles', 'cv-b o');
      if (ph === 'route') b('transbordement', 'Signaler un transbordement', 'cv-lien');
      if (A && !K) b('reception', 'Déjà vérifiée ? Confirmer la réception', 'cv-lien');
      signaler();
      return B.join('');
    }
    if (ph === 'arrive') {
      if (A) {
        const fin = D && D.reception_echeance;
        B.push(`<div class="cv-jaune" role="status">${fin ? `<b>${SVGR.horloge()}${esc(Date.parse(fin) > Date.now() ? reste(fin) + ' pour vérifier' : 'Délai de vérification dépassé')}</b>` : ''}<span>Comptez et regardez la marchandise. ${MOT(c) ? 'Tapez le mot du vendeur seulement si tout est bon.' : 'Confirmez seulement si tout est bon.'}</span></div>`);
        if (D && D.peut_demander_delai && c.annulation !== 'autre') b('delai', 'Demander plus de temps', 'cv-lien v g');
        else if (D && D.delai_heures) B.push(`<p class="cv-p">Délai accordé : ${esc(D.delai_heures)} h de plus. C’est possible une seule fois.</p>`);
        if (!K) b('reception', MOT(c) ? 'Tout est bon : taper le mot secret' : 'Tout est bon : confirmer la réception', 'cv-b');
        b('probleme', 'Signaler un problème', 'cv-b r');
      } else {
        if (D && D.reception_echeance) B.push(`<div class="cv-carte" role="status"><b>${MOT(c) ? 'L’acheteur vérifie, puis tape votre mot' : 'L’acheteur vérifie la marchandise'}</b><span>Il a jusqu’à ${esc(echeance(D.reception_echeance))}${D.delai_heures ? ' (délai de ' + esc(D.delai_heures) + ' h compris)' : ''} pour répondre. Sinon, un litige s’ouvre.</span></div>`);
        if (D && D.peut_declarer_arrivee) b('arrivee', 'Marchandise livrée', 'cv-b o');
        if (D && D.peut_signaler_retard) b('retard-sig', 'Signaler un retard', 'cv-b o');
        signaler();
      }
      return B.join('');
    }
    if (ph === 'verif') {
      if (A) {
        if (S ? S.peut_liberer : aVerifier(c)) b('liberer', 'Tout est conforme', 'cv-b');
        if (S ? S.peut_refuser : dansDelai(c)) b('refuser', 'Un problème ? Vous avez 1 h pour le signaler', 'cv-lien v');
        if (aVerifier(c)) b('probleme', 'Pas de papier ? Signaler un problème', 'cv-lien');
      } else B.push(`<div class="cv-vertc" role="status">${SVGR.coche(20, 2.4)}<span>L’acheteur a ${S && S.echeance ? 'jusqu’à ' + esc(echeance(S.echeance)) : 'encore 1 h'} pour signaler un problème. Ensuite la commande se clôt toute seule.</span></div>`);
      return B.join('');
    }
    if (ph === 'litige') {
      const LA = A && !K && D && D.litige_auto;
      if (LA) b('reception', MOT(c) ? 'Confirmer avec le mot secret' : 'Réception confirmée', 'cv-b');
      if (A && (LA || (S && S.peut_refuser))) b('refuser', 'Refuser la marchandise', 'cv-b o');
      if (S && S.peut_repondre) { b('rf-oui', 'Je reconnais le problème', 'cv-b'); b('rf-non', 'Je conteste', 'cv-b o'); }
      return B.join('');
    }
    return B.join('');
  }

  // l'avis : la carte « Terminée » de la maquette (étoiles 44 px, avis écrit 300 caractères), branchée sur avis_commande_*
  function carteFin(c) {
    const ph = phase(c); if (!['verif', 'fini'].includes(ph)) return '';
    const a = avis[c.id], n = avisNote[c.id] || (a && a.note) || 0, lui = esc(c.partenaire_nom || '');
    let corps = '';
    if (a && a.peut) corps = `<span class="cv-fin-t" aria-live="polite">${n ? esc(LIBA[n]) : 'Notez ' + lui}</span>
      <div class="cv-etoiles" role="radiogroup" aria-label="Note de ${lui}">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${i === n}" aria-label="${i} étoile${i > 1 ? 's' : ''}" data-av="${i}" class="${i <= n ? 'on' : ''}">${SVGR.etoile}</button>`).join('')}</div>
      ${n || a.note ? `<label class="cm-sr" for="cvAv">Votre avis</label><textarea id="cvAv" maxlength="300" data-av-t placeholder="Un mot sur cette commande (facultatif)">${esc(a.texte || '')}</textarea>
      <p class="cm-err" data-av-err role="alert"></p><button type="button" class="cv-b o" data-av-ok>${a.note ? 'Corriger mon avis' : 'Publier l’avis'}</button>` : '<p class="cm-err" data-av-err role="alert"></p>'}
      ${a.note && a.modifiable_jusqua ? `<span class="cv-ok">Avis publié. Modifiable jusqu’à ${esc(echeance(a.modifiable_jusqua))}.</span>` : ''}`;
    else if (a && a.note) corps = `<span class="cv-fin-t">Votre avis sur ${lui}</span>${etoilesFixes(a.note)}${a.texte ? `<span class="cv-p">« ${esc(a.texte)} »</span>` : ''}`;
    const recu_ = a && a.recu ? `<span class="cv-p">${lui} vous a donné ${etoilesFixes(a.recu.note)}${a.recu.texte ? ' · « ' + esc(a.recu.texte) + ' »' : ''}</span>` : '';
    const fid = a && +a.ensemble >= 2 ? `<span class="cv-ok">${+a.ensemble}<sup>e</sup> commande terminée ensemble.</span>` : '';
    return `<section class="cv-fin" aria-label="Commande ${ph === 'fini' ? 'terminée' : 'reçue'}"><span class="cv-tampon">${ph === 'fini' ? 'Terminée' : 'Reçue'}</span>${corps}${recu_}${fid}</section>`;
  }

  // la carte du litige : le problème signalé, et la règle (l'acheteur ne paie rien tant que ce n'est pas réglé)
  function carteLitige(c, Jr) {
    if (phase(c) !== 'litige') return '';
    const e = Jr.slice().reverse().find(x => x.evenement === 'litige'), lib = e && e.note ? String(e.note).split(' · ')[0] : 'Problème signalé';
    return `<section class="cv-pb" aria-label="Le problème"><b>${esc(lib)}</b><span>${c.role === 'acheteur' ? 'Vous ne payez rien tant que ce n’est pas réglé : ni la marchandise, ni le transport. L’équipe regarde vos photos et celles du départ.' : 'L’équipe regarde les photos du départ et celles de l’acheteur.'}</span>
      <span class="cv-num">Commande n° ${esc(c.numero)} · nous ne demandons jamais d’argent ni de code.</span></section>`;
  }
  // la carte « Retard signalé » (bord jaune)
  function carteRetard(c) {
    const ph = phase(c), R = dernierRetard(c); if (!R || !['charge', 'route'].includes(ph)) return '';
    const qui = R.role === c.role ? 'vous' : c.partenaire_nom || (R.role === 'vendeur' ? 'le vendeur' : 'l’acheteur');
    return `<section class="cv-carte cv-retard" role="status">${SVGR.horloge(22)}<span><b>Retard signalé par ${esc(qui)}</b><span>${R.texte ? esc(String(R.texte).replace(/[.\s]+$/, '')) : esc(CAUSE_R[R.motif] || 'Autre')}. ${R.date_estimee ? 'Nouvelle arrivée vers ' + esc(quand(R.date_estimee)) + '. ' : ''}Rien ne change : prix et quantité restent les mêmes.</span></span></section>`;
  }

  // ——— préparation du chargement (vendeur) : photos, poids, papier du mot secret, sur l'écran même ———
  const prepa = {};   // commande → { fichiers, poids, papier, defi, fin, err }
  function blocPrepa(c) {
    const S = seq[c.id], V = c.role === 'vendeur';
    if (!V || phase(c) !== 'prep' || c.annulation || (S && S.depart && (S.depart.mot_ok || !S.mot))) return '';
    const P = prepa[c.id] || (prepa[c.id] = { fichiers: [], poids: '', papier: null, defi: null, fin: 0, err: '' });
    const besoinMot = !!(S && S.mot), nb = P.fichiers.length, okPh = nb >= 2, okPd = Number(String(P.poids).replace(',', '.')) > 0, okMot = !besoinMot || !!P.papier || !!(S && S.depart && S.depart.mot_ok);
    const fait = S && S.depart;   // photos déjà enregistrées, il manque seulement le papier
    const cases = [0, 1, 2, 3].map(i => P.fichiers[i]
      ? `<button type="button" class="cv-case on" data-prx="${i}" aria-label="Retirer la photo ${i + 1}"><img src="${P.urls && P.urls[i] || ''}" alt=""></button>`
      : `<label class="cv-case" aria-label="Ajouter une photo">${SVGR.photo}<input type="file" accept="image/*" ${i === nb ? 'multiple' : 'tabindex="-1"'} data-prf></label>`).join('');
    const papier = !besoinMot ? '' : P.papier || (S.depart && S.depart.mot_ok) ? `<div class="cv-papier ok">${SVGR.coche(20, 2.4)}<span>Papier du mot secret envoyé à l’équipe</span></div>`
      : P.defi && P.fin > Date.now() ? `<div class="cv-papier"><div class="cm-defi" aria-label="Code ${esc(P.defi)}">${String(P.defi).split('').map(x => `<i>${esc(x)}</i>`).join('')}</div>
          <small data-reste aria-live="off">Écrivez-le sur un papier posé sur le colis · ${resteSec(P.fin)} restantes</small>
          <label class="cv-b o">${SVGR.photo}Photographier le papier<input type="file" accept="image/*" capture="environment" data-prm class="cm-sr"></label></div>`
      : `<button type="button" class="cv-papier" data-prd>${SVGR.doc}<span><span>${P.defi ? 'Nouveau code (temps écoulé)' : 'Photo du papier avec le code'}</span><small>Écrivez-le sur un papier posé sur le colis · 3 min</small></span></button>`;
    const chk = [[fait || okPh, 'Photos du colis emballé'], [fait || okPd, 'Poids pesé']].concat(besoinMot ? [[okMot, 'Photo du code (seule l’équipe la voit)']] : []);
    const pret = (fait || (okPh && okPd)) && okMot;
    return `<section class="cv-prepa" aria-label="Préparer le chargement">
      ${fait ? '' : `<div class="cv-tt"><h3 class="cv-h2">Photos du colis emballé</h3><span class="${okPh ? 'ok' : ''}">${nb} sur 4 · au moins 2</span></div>
      <div class="cv-grille">${cases}</div>
      <div class="cv-tt"><h3 class="cv-h2"><label for="cvPoids">Poids pesé</label></h3></div>
      <div class="cv-champ"><input id="cvPoids" type="text" inputmode="decimal" autocomplete="off" placeholder="Par exemple 4 200" value="${esc(P.poids)}" data-prp><span>kg</span></div>`}
      ${papier}
      <ul class="cv-chk">${chk.map(([ok, l]) => `<li class="${ok ? 'ok' : ''}">${ok ? SVGR.coche(16, 2.6) : SVGR.rond}${l}<span class="cm-sr">${ok ? ' : fait' : ' : à faire'}</span></li>`).join('')}</ul>
      <p class="cm-err" role="alert" data-pre>${esc(P.err || '')}</p>
      <button type="button" class="cv-b${pret ? '' : ' gris'}" data-prgo aria-disabled="${!pret}">Déclarer le chargement</button></section>`;
  }
  const resteSec = fin => { const t = Math.max(0, Math.round((fin - Date.now()) / 1000)); return Math.floor(t / 60) + ' min ' + String(t % 60).padStart(2, '0'); };
  let prepaChrono = null;
  function lierPrepa(c, box) {
    const P = prepa[c.id], z = box.querySelector('.cv-prepa'); if (!P || !z) return;
    const err = z.querySelector('[data-pre]'), dire = t => { P.err = t; if (err) err.textContent = t; };
    z.querySelectorAll('[data-prf]').forEach(inp => inp.onchange = async e => {
      dire('');
      for (const fi of Array.from(e.target.files || [])) {
        if (P.fichiers.length >= 4) { dire('4 photos au plus.'); break; }
        try { const b = await reduirePhoto(fi); P.fichiers.push(b); (P.urls = P.urls || []).push(URL.createObjectURL(b)); } catch (x) { dire(x.message); }
      }
      P.chemins = null; peindre();
    });
    z.querySelectorAll('[data-prx]').forEach(x => x.onclick = () => { const i = +x.dataset.prx; P.fichiers.splice(i, 1); if (P.urls) { try { URL.revokeObjectURL(P.urls[i]); } catch (_) {} P.urls.splice(i, 1); } P.chemins = null; peindre(); });
    const pd = z.querySelector('[data-prp]'); if (pd) pd.oninput = () => { P.poids = pd.value; };
    if (pd) pd.onblur = () => peindre();
    const dfi = z.querySelector('[data-prd]');
    if (dfi) dfi.onclick = async () => {
      dfi.disabled = true; dire('');
      try { P.defi = await N().rpc('commande_depart_defi', { p_id: c.id }); P.fin = Date.now() + 180000; } catch (x) { dire(erreurTxt(x)); }
      peindre();
    };
    clearInterval(prepaChrono);
    if (P.defi && P.fin > Date.now()) prepaChrono = setInterval(() => {
      const r = bg && bg.querySelector('.cv-prepa [data-reste]'); if (!r) { clearInterval(prepaChrono); return; }
      if (P.fin <= Date.now()) { clearInterval(prepaChrono); peindre(); return; }
      r.textContent = 'Écrivez-le sur un papier posé sur le colis · ' + resteSec(P.fin) + ' restantes';
    }, 1000);
    const pm = z.querySelector('[data-prm]');
    if (pm) pm.onchange = async e => {
      const fi = e.target.files && e.target.files[0]; e.target.value = ''; if (!fi) return;
      dire('Envoi de la photo du papier…');
      try { const ph = await reduirePhoto(fi), ch = me() + '/motpapier-' + c.id.slice(0, 8) + '-' + Date.now() + '.jpg';
        await N().deposerPrive('preuves', ch, ph); await N().rpc('commande_depart_mot', { p_id: c.id, p_photo: ch });
        P.papier = ch; dire(''); peindre();
      } catch (x) { dire(erreurTxt(x)); }
    };
    const go = z.querySelector('[data-prgo]');
    go.onclick = async () => {
      const S = seq[c.id], fait = S && S.depart, poids = Number(String(P.poids).replace(',', '.'));
      if (!fait && P.fichiers.length < 2) return dire('Ajoutez au moins 2 photos du colis emballé.');
      if (!fait && !(poids > 0)) { dire('Indiquez le poids pesé, en kilos.'); const i = z.querySelector('[data-prp]'); if (i) i.focus(); return; }
      if (S && S.mot && !P.papier && !(fait && fait.mot_ok)) return dire('Photographiez le papier du mot secret, avec le code écrit à côté.');
      go.disabled = true; dire(fait ? '' : 'Envoi des photos…');
      try {
        if (!fait) {
          if (!P.chemins) { const u = me(), ch = []; for (let i = 0; i < P.fichiers.length; i++) { const k = u + '/depart-' + c.id.slice(0, 8) + '-' + Date.now() + '-' + i + '.jpg'; await N().deposerPrive('preuves', k, P.fichiers[i]); ch.push(k); } P.chemins = ch; }
          await N().rpc('commande_depart_preuves', { p_id: c.id, p_photos: P.chemins, p_poids_kg: poids });
        }
        // le chargement suit les preuves (validation par mot secret) ; avec les codes du réseau, c'est le chauffeur qui le valide
        if (c.validation !== 'code') await N().rpc('commande_avancer', { p_id: c.id, p_etape: 'chargement', p_lieu: null, p_lat: null, p_lon: null, p_note: null });
        (P.urls || []).forEach(u => { try { URL.revokeObjectURL(u); } catch (_) {} }); delete prepa[c.id];
        await lireListe(); await lireJournal(c.id);
        toast(c.validation !== 'code' ? 'Chargement déclaré' : 'Colis enregistré', { type: 'ok', sous: c.validation !== 'code' ? 'L’acheteur est prévenu.' : 'Donnez le code de prise en charge au chauffeur.' });
        peindre('chargement');
      } catch (x) { go.disabled = false; dire(erreurTxt(x)); }
    };
  }

  // ——— « Trouver un arrangement » (schémas 102a/102d) : seulement si le serveur répond ; aucun argent ne bouge ———
  const part = {}, partF = {};
  const PART_MODES = [['transport', 'Le transport seulement'], ['partie', 'Garder une partie'], ['montant', 'Un montant']];
  function partTexte(c, x) {
    return x.mode === 'transport' ? 'Payer le transport seulement' : x.mode === 'partie' ? `Garder ${qte(x.quantite_gardee, c.unite)} au prix à l’unité` : 'Participer avec un montant';
  }
  function blocPart(c) {
    const P = part[c.id]; if (!P || phase(c) !== 'litige') return '';
    const L = P.propositions || []; if (!P.peut_proposer && !L.length) return '';
    const moi = P.role, nomR = r => r === moi ? 'Vous' : r === 'equipe' ? 'L’équipe' : esc(c.partenaire_nom || (r === 'vendeur' ? 'Le vendeur' : 'L’acheteur'));
    const f = partF[c.id] || (partF[c.id] = { mode: null, q: 1, m: '' });
    const modes = PART_MODES.filter(([k]) => k !== 'transport' || P.transport_possible);
    const pu = Number(P.prix_unitaire || c.prix_unitaire || 0), qmax = Number(P.quantite || c.quantite || 0);
    const val = f.mode === 'transport' ? Number(P.prix_transport || 0) : f.mode === 'partie' ? f.q * pu : Number(f.m || 0);
    const conclu = L.find(x => x.statut === 'acceptee');
    const form = P.peut_proposer && !conclu ? `<p class="cv-p">${moi === 'acheteur' && !P.contre ? 'Facultatif. Si vous gardez une partie, vous pouvez proposer de participer. Vous, le vendeur et l’équipe en discutez.' : 'Acceptez la proposition, ou faites la vôtre.'}</p>
      ${modes.map(([k, l]) => `<button type="button" class="cv-opt${f.mode === k ? ' on' : ''}" role="radio" aria-checked="${f.mode === k}" data-pm="${k}"><span class="rb" aria-hidden="true"><span></span></span><span class="l">${l}</span><span class="s">${k === 'transport' ? F(P.prix_transport) : k === 'partie' ? 'au prix à l’unité' : 'à proposer'}</span></button>`).join('')}
      ${f.mode === 'partie' ? `<div class="cv-pas"><button type="button" data-pq="-1" aria-label="Moins">${SVGR.moins}</button><span aria-live="polite">${qte(f.q, c.unite)}</span><button type="button" data-pq="1" aria-label="Plus">${SVGR.plus}</button></div>` : ''}
      ${f.mode === 'montant' ? `<div class="cv-champ"><label class="cm-sr" for="cvPm">Montant proposé, en francs</label><input id="cvPm" type="text" inputmode="numeric" autocomplete="off" placeholder="Par exemple 40 000" value="${esc(f.m)}" data-pmv><span>F</span></div>` : ''}
      ${f.mode ? `<div class="cv-total"><span>Vous proposez de payer</span><b data-pval>${F(val)}</b></div><p class="cm-err" role="alert" data-perr></p><button type="button" class="cv-b" data-psend>Envoyer ma proposition</button>` : ''}` : '';
    const ST = { ouverte: '', acceptee: 'Acceptée', refusee: 'Refusée', retiree: 'Retirée', caduque: 'Caduque' };
    const fil_ = L.map(x => {
      const ouv = P.ouverte && P.ouverte.id === x.id, cls = x.role === moi ? 'moi' : x.role === 'equipe' ? 'mdg' : 'lui';
      return `<div class="cv-bul ${cls}"><b>${nomR(x.role)}</b><span>${esc(partTexte(c, x))}${x.message ? ' · « ' + esc(x.message) + ' »' : ''}</span><strong>${F(x.montant)}</strong>
        ${ST[x.statut] ? `<small>${ST[x.statut]}</small>` : ouv ? `<small>Réponse avant ${esc(quand(x.echeance))}</small>` : ''}
        ${ouv && P.peut_repondre ? `<button type="button" class="cv-b" data-prep="1">J’accepte</button><button type="button" class="cv-lien" data-prep="0">Refuser</button>` : ''}
        ${ouv && P.peut_retirer ? `<button type="button" class="cv-lien" data-pret>Retirer ma proposition</button>` : ''}</div>`; }).join('');
    return `<section class="cv-part" aria-label="Trouver un arrangement"><div class="cv-tt"><h3 class="cv-h2">Trouver un arrangement</h3><span class="cv-avs" aria-hidden="true"><i class="v">${esc(ini(moiNom()))}</i><i class="a">${esc(ini(c.partenaire_nom))}</i><i class="m">MG</i></span></div>
      ${form}${fil_ ? `<div class="cv-fil3">${fil_}</div>` : ''}
      ${conclu ? `<div class="cv-vertc">${SVGR.coche(20, 2.4)}<span>Accord trouvé : ${F(conclu.montant)}. Aucun argent ne bouge : le montant est seulement noté.</span></div>` : '<p class="cv-p petit">Aucun argent ne bouge : le montant est seulement noté. Sans accord, l’équipe tranche.</p>'}</section>`;
  }
  function lierPart(c, box) {
    const P = part[c.id], f = partF[c.id], z = box.querySelector('.cv-part'); if (!P || !z) return;
    const err = z.querySelector('[data-perr]');
    z.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { f.mode = b.dataset.pm; peindre(); });
    const qmax = Number(P.quantite || c.quantite || 0), pas = ENTIERES.includes(String(c.unite || '').toLowerCase()) || qmax >= 2 ? 1 : 0.5;
    z.querySelectorAll('[data-pq]').forEach(b => b.onclick = () => { f.q = Math.min(Math.max(pas, f.q + Number(b.dataset.pq) * pas), qmax || f.q + 1); peindre(); });
    const mv = z.querySelector('[data-pmv]');
    if (mv) mv.oninput = () => { f.m = mv.value.replace(/[^\d]/g, ''); const v = z.querySelector('[data-pval]'); if (v) v.textContent = F(Number(f.m || 0)); };
    const go = async (fn, a, ok) => { try { await N().rpc(fn, a); part[c.id] = await N().rpc('commande_participation_lire', { p_id: c.id }).catch(() => part[c.id]); if (ok) toast(ok, { type: 'ok' }); await lireListe(); await lireJournal(c.id); peindre(); } catch (x) { if (err) err.textContent = erreurTxt(x); else toast(erreurTxt(x), { type: 'erreur' }); } };
    const s = z.querySelector('[data-psend]');
    if (s) s.onclick = () => {
      if (f.mode === 'montant' && !(Number(f.m) > 0)) { if (err) err.textContent = 'Indiquez un montant, en francs.'; return; }
      s.disabled = true;
      go('commande_participation_proposer', { p_id: c.id, p_mode: f.mode, p_quantite_gardee: f.mode === 'partie' ? f.q : null, p_montant: f.mode === 'montant' ? Number(f.m) : null, p_motif: null }, 'Proposition envoyée').then(() => { partF[c.id] = { mode: null, q: 1, m: '' }; });
    };
    z.querySelectorAll('[data-prep]').forEach(b => b.onclick = async () => {
      const oui = b.dataset.prep === '1';
      if (oui && window.MDGDemande && !await MDGDemande.oui('Accepter cette proposition ? La commande se termine avec ce montant. Aucun argent ne bouge.', { ok: 'J’accepte' })) return;
      b.disabled = true; go('commande_participation_repondre', { p_id: c.id, p_accepte: oui, p_note: null }, oui ? 'Proposition acceptée' : 'Proposition refusée');
    });
    const r = z.querySelector('[data-pret]'); if (r) r.onclick = () => { r.disabled = true; go('commande_participation_retirer', { p_id: c.id }, 'Proposition retirée'); };
  }

  // ——— « Signaler un problème » (acheteur) : 5 choix, photo obligatoire pour cassé et mauvaise qualité (schéma 103b) ———
  const PROBLEMES = [['casse', 'Cassé ou abîmé', true], ['qualite', 'Mauvaise qualité', true], ['manquant', 'Quantité manquante', false], ['quantite', 'Pas la bonne quantité', false], ['autre', 'Autre problème', false]];
  function probleme(c) {
    const Fe = feuilleGeste('Signaler un problème'); if (!Fe) return;
    const box = Fe.corps, fichiers = [];
    box.innerHTML = `<h2 class="fl-h">Signaler un problème</h2><p class="fl-s">L’équipe répond en 72 h au plus.</p>
      <form novalidate>
        <fieldset class="fl-g"><legend class="fl-sr">Le problème</legend>${PROBLEMES.map(([k, l, ph]) => ligneChoix('cvPb', k, l, ph ? 'Photo obligatoire' : '')).join('')}</fieldset>
        <div class="cm-ph" data-apercu></div>
        <label class="cv-pickf" data-phz hidden>${SVGR.photo}<span data-phl>Ajouter des photos</span><input type="file" accept="image/*" multiple data-fic class="fl-sr"></label>
        <div data-tz hidden><label class="fl-t" for="cvPbT">Quelques mots</label><textarea id="cvPbT" maxlength="240" placeholder="Ex. : 4 régimes pourris, sacs mouillés…" style="margin-top:8px"></textarea></div>
        <p class="fl-err" role="alert"></p>
        <button type="submit" class="fl-b" aria-disabled="true">Envoyer à l’équipe</button>
      </form>`;
    const f = box.querySelector('form'), err = f.querySelector('.fl-err'), ap = f.querySelector('[data-apercu]');
    f.querySelectorAll('[name=cvPb]').forEach(r => r.onchange = () => {
      const d = PROBLEMES.find(x => x[0] === r.value) || [];
      f.querySelector('[data-phz]').hidden = !d[2] && !fichiers.length; f.querySelector('[data-tz]').hidden = r.value !== 'autre';
      f.querySelector('[type=submit]').setAttribute('aria-disabled', 'false'); });
    const apercu = () => { ap.innerHTML = fichiers.map((b, i) => `<span><img src="${URL.createObjectURL(b)}" alt="Photo ${i + 1}"></span>`).join(''); f.querySelector('[data-phl]').textContent = fichiers.length ? fichiers.length + ' photo' + (fichiers.length > 1 ? 's' : '') + ' · en ajouter' : 'Ajouter des photos'; };
    f.querySelector('[data-fic]').onchange = async e => {
      err.textContent = ''; f._chemins = null;
      for (const fi of Array.from(e.target.files || [])) { if (fichiers.length >= 4) { err.textContent = '4 photos au plus.'; break; } try { fichiers.push(await reduirePhoto(fi)); } catch (x) { err.textContent = x.message; } }
      e.target.value = ''; apercu();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const r = f.querySelector('[name=cvPb]:checked'), t = f.querySelector('#cvPbT').value.trim();
      if (!r) { err.textContent = 'Choisissez le problème.'; f.querySelector('[name=cvPb]').focus(); return; }
      const [k, lib, photoOblig] = PROBLEMES.find(x => x[0] === r.value);
      if (photoOblig && !fichiers.length) { err.textContent = 'Ajoutez au moins une photo de la marchandise.'; return; }
      if (k === 'autre' && t.length < 3) { err.textContent = 'Dites le problème en quelques mots.'; f.querySelector('#cvPbT').focus(); return; }
      if (t && N().texteRefus) { const x = N().texteRefus(t); if (x) { err.textContent = x; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = fichiers.length ? 'Envoi des photos…' : '';
      try {
        if (fichiers.length && !f._chemins) { const u = me(), ch = []; for (let i = 0; i < fichiers.length; i++) { const p = u + '/probleme-' + c.id.slice(0, 8) + '-' + Date.now() + '-' + i + '.jpg'; await N().deposerPrive('preuves', p, fichiers[i]); ch.push(p); } f._chemins = ch; }
        err.textContent = '';
        await N().rpc('commande_probleme', { p_id: c.id, p_type: k, p_texte: t || null, p_photos: f._chemins || null })
          .catch(x => ancien(x) ? N().rpc('commande_litige', { p_id: c.id, p_motif: lib + (t ? ' · ' + t : '') }) : Promise.reject(x));
        await lireListe(); await lireJournal(c.id);
        finGeste(); toast('Problème envoyé à l’équipe', { type: 'ok' });
        peindre();
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
  }

  // le haut de l'écran : « < Activité » (ou « < Mes commandes » depuis la liste)
  let retourTxt = 'Activité';
  const haut = () => `<div class="cv-haut"><button type="button" class="cv-ret" data-retour>${SVGR.retour}<span>${esc(retourTxt)}</span></button></div>`;
  function lierHaut(c, box, fn) { const r = box.querySelector('[data-retour]'); if (r) r.onclick = fn; }
  function retour() { oublierCarte(); if (retourTxt === 'Mes commandes') { sel = null; vue = 'liste'; peindre(); } else fermer(); }

  const lienOuvert = {};
  function peindreDetail(change) {
    const c = trouve(sel), box = bg.querySelector('.cm');
    // commande pas encore en mémoire (notification touchée) : on attend la réponse du serveur avant de revenir à la liste
    if (!c) { if (!lu && navigator.onLine !== false) { box.innerHTML = haut() + (window.MDGSac ? MDGSac.charge('La commande arrive…') : ''); lierHaut(null, box, retour); return; } vue = 'liste'; return peindreListe(); }
    const Jr = journal[c.id] || [], [titre, sous] = entete(c), ph = phase(c), V = c.role === 'vendeur';
    const carteVive = enRoute(c) && window.MDGSuivi && pos[c.id] && pos[c.id].derniere;
    const S = seq[c.id];
    // où vont les gestes : en haut pour le vendeur (après le reçu), en bas pour l'acheteur en route (après le suivi), comme la maquette
    const dejaHaut = ph === 'verif' || ph === 'fini' || (ph === 'arrive' && !V);
    const enBas = !dejaHaut && !V && ['prep', 'charge', 'route'].includes(ph), enHaut = !dejaHaut && !enBas;
    box.innerHTML = `<div class="cv">${haut()}
      <div class="cv-tete"><h2 class="cv-h1">${titre}</h2>${sous ? `<p class="cv-sous">${esc(sous)}</p>` : ''}</div>
      ${carteVive ? `<div class="cv-carteVive"><div data-carte></div><p class="cm-sr" aria-live="polite">${esc(MDGSuivi.texte(pos[c.id]).t)}</p></div>` : ''}
      ${carteRetard(c)}${carteLitige(c, Jr)}${carteFin(c)}
      ${ph === 'arrive' && !V ? `<div class="cv-acts">${boutons(c)}</div>` : ''}
      ${ph === 'verif' || ph === 'fini' ? `<div class="cv-acts">${boutons(c)}${c.role === 'acheteur' && window.MDGRacheter && c.etat === 'terminee' ? '<button type="button" class="cv-b" data-racheter>Racheter le même</button>' : ''}</div>` : ''}
      ${blocPart(c)}
      ${recu(c)}
      ${panneauMot(c)}
      ${blocPrepa(c)}
      ${S && S.refus ? blocRefus(c) : ''}${blocDisc(c)}${S && S.actif ? blocSequestre(c) : ''}
      ${blocCode(c)}${blocTransport(c)}
      ${enHaut ? `<div class="cv-acts">${boutons(c)}</div>` : ''}
      ${(V && lienOuvert[c.id]) || (!V && lien[c.id] && (lien[c.id].vu_le || lien[c.id].ouvert_le)) ? blocLien(c) : ''}
      ${c.etat !== 'a_confirmer' && !(V && ph === 'prep') ? suiviEtapes(c, Jr) : ''}
      ${fil(c, Jr)}
      ${enBas ? `<div class="cv-acts">${boutons(c)}</div>` : ''}
      <p class="cv-num">Commande n° ${esc(c.numero || '—')} · ${V ? 'vente à' : 'achat chez'} ${esc(c.partenaire_nom || '')}</p>
      ${c.partenaire_id && window.MDGMessages ? `<button type="button" class="cv-lien v" data-ecrire>Écrire à ${esc(c.partenaire_nom || 'l’autre partie')}</button>` : ''}
    </div>`;
    lierHaut(c, box, retour);
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => geste(c, b.dataset.g));
    const rb = box.querySelector('[data-racheter]'); if (rb) rb.onclick = () => { fermer(); MDGRacheter.ouvrir(c.id); };
    const ec = box.querySelector('[data-ecrire]'); if (ec) ec.onclick = () => { fermer(); MDGMessages.ecrire(c.partenaire_id, { nom: c.partenaire_nom }); };
    const dp = box.querySelector('[data-dep]'); if (dp) dp.onclick = () => { depOuvert[c.id] = !depOuvert[c.id]; peindre(); };
    const mv = box.querySelector('[data-motvu]'); if (mv) mv.onclick = () => { motVu[c.id] = !motVu[c.id]; peindre(); };
    const lv = box.querySelector('[data-lienvu]'); if (lv) lv.onclick = () => { lienOuvert[c.id] = !lienOuvert[c.id]; peindre(); };
    lierTransport(c, box); lierTrois(c, box); lierLien(c, box); lierCode(c, box); lierAvis(c, box); placerCarte(c, box); photos(box); lierDisc(c, box); lierPrepa(c, box); lierPart(c, box);
    if (change === 'arrivee') { if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (_) {} toast('Marchandise arrivée', { type: 'ok', sous: c.role === 'acheteur' ? 'Vérifiez-la avant de confirmer.' : esc(c.produit || '') }); }
  }
  // schéma 99a : causes des retards et des délais
  const CAUSE_R = { panne: 'Panne', route: 'Route difficile', pluie: 'Pluie', controle: 'Contrôle routier', autre: 'Autre' };
  const CAUSE_D = { pas_sur_place: 'Pas sur place', dechargement: 'Déchargement en cours', controle: 'Contrôle de la marchandise', autre: 'Autre' };
  // qui paie quoi : où en est l'argent, et qui reçoit quoi à la clôture (schéma 57, transport « à part » : schéma 95)
  const OPE = { wave: 'Wave', orange: 'Orange Money', mtn: 'MTN MoMo', moov: 'Moov Money' };
  function blocSequestre(c) {
    const S = seq[c.id]; if (!S || c.etat === 'annulee' || c.etat === 'a_confirmer') return '';
    const r = S.repartition || {}, A = S.actif, V = c.role === 'vendeur';
    const clos = !!S.libere_le, recu = c.etat === 'terminee' || c.etat === 'litige', parti = recu || ['chargement', 'transport', 'transbordement', 'arrivee', 'reception'].includes(c.etape);
    const pas = [['Commande confirmée', true], ['Livraison', parti], ['Vérification (1\u00a0h)', recu], ['Clôture', clos]];
    const ici = pas.findIndex(p => !p[1]);
    const etat = !A ? '<span class="cm-sq-e">Séquestre en construction</span>'
      : S.etat === 'bloque' ? `<span class="cm-sq-e on">${TI('cadenas')}${F(r.total)} bloqués chez ${esc(OPE[S.operateur] || '')}</span>`
      : `<span class="cm-sq-e on">✓ Séquestre soldé${S.solde_le ? ' le ' + quand(S.solde_le) : ''}</span>`;
    const lignes = [];
    lignes.push(`<tr class="tot"><td>L’acheteur paie<small>marchandise${r.transport ? ' + transport' : ''}</small></td><td>${F(r.total)}</td></tr>`);
    if (Number(r.acheteur_rembourse) > 0) lignes.push(`<tr><td>Pas dû par l’acheteur<small>marchandise refusée</small></td><td>${F(r.acheteur_rembourse)}</td></tr>`);
    const ta = Number(r.vendeur_transport) || 0;   // transport « à part » : livré par le vendeur, payé avec la marchandise (schéma 95)
    lignes.push(V ? `<tr><td>Vous recevez<small>${F(r.vendeur_brut)} moins 3,5 % (${F(r.vendeur_commission)})${ta ? ' + transport ' + F(ta) : ''}</small></td><td>${F(r.vendeur_net)}</td></tr>`
                  : `<tr><td>Le vendeur reçoit<small>prix de la marchandise${Number(r.acheteur_rembourse) > 0 ? ', partie acceptée' : ''}${ta ? ' + transport à part' : ''}</small></td><td>${F(Number(r.vendeur_brut) + ta)}</td></tr>`);
    if (Number(r.transporteur_brut) > 0) lignes.push(`<tr><td>Le transporteur reçoit<small>son prix de transport${Number(r.transporteur_commission) > 0 ? ', moins 6,9 % (service Marché de Gros)' : ''}</small></td><td>${F(r.transporteur_brut)}</td></tr>`);
    return `<section class="cm-sq" aria-label="Qui paie quoi"><h3>${TI('confiance')}Qui paie quoi</h3>${etat}
      <ol>${pas.map((p, i) => `<li class="${p[1] ? 'fait' : ''}${i === ici ? ' ici' : ''}">${p[0]}</li>`).join('')}</ol>
      <table><tbody>${lignes.join('')}</tbody></table>
      <p>${A ? 'L’argent reste bloqué jusqu’à ce que l’acheteur valide la marchandise, ou 1 h après la réception sans réclamation. Pour refuser, il faut des preuves : le mot secret du vendeur et des photos. La commission n’est retenue qu’à la clôture.'
        : 'Pour l’instant : <b>paiement à la livraison</b>, entre vous, après avoir vu la marchandise. Rien ne passe par l’application, rien n’est prélevé. Le séquestre est en construction.'}</p></section>`;
  }
  function blocRefus(c) {
    const S = seq[c.id], R = S && S.refus; if (!R) return '';
    const qte_ = R.quantite != null ? qte(R.quantite, R.unite) : 'toute la marchandise';
    const ch = R.chauffeur === 'confirme' ? '✓ Le chauffeur confirme' : R.chauffeur === 'conteste' ? '✗ Le chauffeur conteste' : R.a_chauffeur ? '… Le chauffeur n’a pas encore répondu' : 'Chauffeur hors de l’application : l’équipe jugera';
    const ve = R.vendeur === 'reconnu' ? '✓ Le vendeur reconnaît le problème' : R.vendeur === 'conteste' ? '✗ Le vendeur conteste' : '… Le vendeur n’a pas encore répondu';
    const regle = R.chauffeur_suffit ? 'Si le chauffeur (inscrit et vérifié par le Marché de Gros) confirme, ou si le vendeur reconnaît le problème, la partie refusée n’est pas due. Sinon, on en discute à trois et l’équipe juge.'
      : 'Si le vendeur reconnaît le problème, la partie refusée n’est pas due. Sinon, on en discute à trois ci-dessous et l’équipe du Marché de Gros juge.';
    const mot = R.mot === 'retrouve' ? '✓ Mot du vendeur retrouvé dans la marchandise' : R.mot === 'absent' ? '✗ Papier du vendeur absent de la marchandise' : '';
    return `<section class="cm-rf" aria-label="Refus de la marchandise"><h3>Marchandise refusée</h3>
      <p><b>${esc(qte_)}</b> · « ${esc(R.motif || '')} »</p>
      <div class="cm-ph">${(R.photos || []).map(x => `<span data-ph="${esc(x)}" role="img" aria-label="Photo du refus"></span>`).join('')}</div>
      <ul>${mot ? `<li>${mot}</li>` : ''}${R.chauffeur || c.etat === 'litige' ? `<li>${ch}</li>` : ''}${R.vendeur || c.etat === 'litige' ? `<li>${ve}</li>` : ''}</ul>
      ${c.etat === 'litige' ? `<p style="color:#5E5546;font-size:12.5px">${regle}</p>` : ''}</section>`;
  }
  // la discussion à trois (acheteur, vendeur, Marché de Gros) pendant un litige
  const ROLE_D = { acheteur: 'Acheteur', vendeur: 'Vendeur', admin: 'Marché de Gros' };
  function blocDisc(c) {
    const D = disc[c.id]; if (!D || (!D.ouvert && !(D.messages || []).length)) return '';
    const L = (D.messages || []).map(m => `<li class="${m.moi ? 'moi' : ''}${m.role === 'admin' ? ' mdg' : ''}"><b>${m.moi ? 'Vous' : esc(ROLE_D[m.role] || '')}</b> <small>${quand(m.at)}</small><span>${esc(m.texte)}</span></li>`).join('');
    return `<section class="cm-disc" aria-label="Discussion à trois"><h3>Discussion à trois</h3>
      <p>Acheteur, vendeur et équipe du Marché de Gros. L’équipe juge avec les photos, le mot secret et vos messages.</p>
      <ul>${L || '<li class="vide">Aucun message pour l’instant.</li>'}</ul>
      ${D.ouvert ? `<form data-disc><label class="cm-sr" for="cmDm">Votre message</label><textarea id="cmDm" maxlength="600" placeholder="Votre message aux deux autres…"></textarea><p class="cm-err" role="alert"></p><button type="submit">Envoyer</button></form>` : '<p><b>Discussion close :</b> le litige est réglé.</p>'}</section>`;
  }
  function lierDisc(c, box) {
    const f = box.querySelector('[data-disc]'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault(); const t = f.querySelector('textarea').value.trim(), err = f.querySelector('.cm-err'); if (!t) return;
      if (N().texteRefus) { const r = N().texteRefus(t); if (r) { err.textContent = r; return; } }
      const b = f.querySelector('button'); b.disabled = true; err.textContent = '';
      try { await N().rpc('litige_ecrire', { p_cmd: c.id, p_texte: t }); disc[c.id] = await N().rpc('litige_messages_lire', { p_cmd: c.id }).catch(() => disc[c.id]); peindre(); }
      catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
  }
  function blocWa(c) {
    return WA_LITIGES ? `<div class="cm-wa">${TI('messages')}<span><b>Service litiges</b> sur WhatsApp : <a href="https://wa.me/${WA_LITIGES}?text=${encodeURIComponent('Bonjour, litige sur la commande n° ' + c.numero)}" target="_blank" rel="noopener">écrire au service</a>. Donnez votre numéro de commande <b>${esc(c.numero)}</b>. Nous ne demandons jamais d’argent ni de code.</span></div>`
      : `<div class="cm-wa">${TI('messages')}<span>Gardez le numéro de commande <b>${esc(c.numero)}</b>. Nous ne demandons jamais d’argent ni de code.</span></div>`;
  }
  // photos privées : liens signés de courte durée (le serveur vérifie qui peut les voir)
  function photos(box) {
    box.querySelectorAll('[data-ph]').forEach(async el => {
      const u = await N().lienSigne('preuves', el.dataset.ph, 600).catch(() => null); if (!u || !el.isConnected) return;
      el.outerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Agrandir la photo"><img src="${esc(u)}" alt="${esc(el.getAttribute('aria-label') || 'Photo de la marchandise')}" loading="lazy"></a>`;
    });
  }
  // photo de preuve réduite dans le téléphone (≈ 400 Ko au plus, l'espace « preuves » refuse au-delà de 450 Ko)
  async function reduirePhoto(f) {
    const url = URL.createObjectURL(f);
    try {
      const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Photo illisible. Choisissez-en une autre.')); i.src = url; });
      for (const cote of [1400, 1100, 850]) {
        const k = Math.min(1, cote / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
        cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
        const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.drawImage(im, 0, 0, cv.width, cv.height);
        for (const q of [0.78, 0.64, 0.5]) { const b = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', q)); if (b && b.size < 420000) return b; }
      }
      throw new Error('Photo trop lourde. Choisissez-en une autre.');
    } finally { URL.revokeObjectURL(url); }
  }
  // l'acheteur refuse la marchandise : quantité, explication, 1 à 4 photos
  function refuser(c) {
    const Fe = feuilleGeste('Refuser la marchandise'); if (!Fe) return;
    const box = Fe.corps, fichiers = [];
    box.innerHTML = `<h2 class="fl-h">Refuser la marchandise</h2><p class="fl-s">${esc(c.produit || '')} · ${esc(c.partenaire_nom)} · n° ${esc(c.numero)}</p>
      <form novalidate>
        <label class="fl-t" for="cmRq">Quantité refusée</label>
        <input type="number" id="cmRq" inputmode="decimal" min="0" step="any" ${c.quantite != null ? `max="${c.quantite}" value="${c.quantite}"` : ''}>
        <p class="fl-s" style="margin:-4px 0 0">Sur ${c.quantite != null ? qte(c.quantite, c.unite) : 'la commande'}. Laissez tout si toute la marchandise est mauvaise.</p>
        <label class="fl-t" for="cmRm">Qu’est-ce qui ne va pas ?</label>
        <textarea id="cmRm" maxlength="300" placeholder="Ex. : 4 régimes pourris, sacs mouillés, quantité manquante…"></textarea>
        ${seq[c.id] && seq[c.id].avec_mot ? `<label class="fl-t" for="cmRw">Le mot écrit sur le papier du vendeur</label>
        <input type="text" id="cmRw" autocomplete="off" autocapitalize="characters" placeholder="Ex. : MANGUE 47">
        <p class="fl-s" style="margin:-4px 0 0">Obligatoire : c’est la preuve que vous avez bien reçu le colis du vendeur. Pas de papier ? Fermez et touchez « Signaler un problème » : l’équipe jugera.</p>` : ''}
        <span class="fl-t">Photos (1 à 4) : la marchandise, et le papier du vendeur</span>
        <div class="cm-ph" data-apercu></div>
        <label class="cv-pickf">${SVGR.photo}<span>Ajouter des photos</span><input type="file" accept="image/*" multiple data-fic class="fl-sr"></label>
        <p class="fl-s">Refus accepté : vous ne payez ni la partie refusée, ni le transport. Refus rejeté : vous payez tout.</p>
        <p class="fl-err" role="alert"></p>
        <button type="submit" class="fl-b">Envoyer le refus</button>
      </form>`;
    const f = box.querySelector('form'), err = f.querySelector('.fl-err'), ap = f.querySelector('[data-apercu]');
    const apercu = () => { ap.innerHTML = fichiers.map((b, i) => `<span><img src="${URL.createObjectURL(b)}" alt="Photo ${i + 1}"></span>`).join(''); };
    f.querySelector('[data-fic]').onchange = async e => {
      err.textContent = ''; f._chemins = null;
      for (const fi of Array.from(e.target.files || [])) {
        if (fichiers.length >= 4) { err.textContent = '4 photos au plus.'; break; }
        try { fichiers.push(await reduirePhoto(fi)); } catch (x) { err.textContent = x.message; }
      }
      e.target.value = ''; apercu();
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const qv = f.querySelector('#cmRq').value.trim(), q = qv === '' ? null : Number(qv.replace(',', '.')), m = f.querySelector('#cmRm').value.trim();
      if (q != null && !(q > 0)) { err.textContent = 'Indiquez la quantité refusée.'; return; }
      if (q != null && q % 1 && ENTIERES.includes(String(c.unite || '').toLowerCase())) { err.textContent = `Quantité en nombre entier pour « ${c.unite} ».`; f.querySelector('#cmRq').focus(); return; }
      if (!m) { err.textContent = 'Expliquez le problème en quelques mots.'; f.querySelector('#cmRm').focus(); return; }
      if (!fichiers.length) { err.textContent = 'Ajoutez au moins une photo de la marchandise.'; return; }
      const W = f.querySelector('#cmRw'), mot = W ? W.value.trim() : '', sansMot = false;
      if (W && !mot) { err.textContent = 'Tapez le mot écrit sur le papier du vendeur : sans lui, pas de refus.'; W.focus(); return; }
      if (N().texteRefus) { const r = N().texteRefus(m); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = 'Envoi des photos…';
      try {
        const u = me(), chemins = [];
        if (!f._chemins) { for (let i = 0; i < fichiers.length; i++) { const ch = u + '/refus-' + c.id.slice(0, 8) + '-' + Date.now() + '-' + i + '.jpg'; await N().deposerPrive('preuves', ch, fichiers[i]); chemins.push(ch); } f._chemins = chemins; }
        err.textContent = '';
        const r = await N().rpc('commande_refuser2', { p_id: c.id, p_quantite: q, p_motif: m, p_photos: f._chemins, p_mot: mot || null, p_sans_mot: sansMot });
        if (r === 'mot_bloque') { err.textContent = 'Trop d’essais faux. Fermez et touchez « Signaler un problème » : l’équipe du Marché de Gros jugera.'; btn.disabled = false; return; }
        if (String(r).startsWith('mot_incorrect')) { const n = String(r).split(':')[1]; err.textContent = `Ce n’est pas le mot du vendeur. Vérifiez le papier (il reste ${n} essai${n > 1 ? 's' : ''}).`; btn.disabled = false; return; }
        await lireListe(); await lireJournal(c.id);
        finGeste(); toast('Refus envoyé', { type: 'ok', sous: 'Le vendeur est prévenu. La discussion à trois est ouverte.' });
        peindre();
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
  }
  let dernierEcran = '';
  // la carte : créée une fois par commande, puis déplacée d'un rendu à l'autre (jamais recréée toutes les 20 s)
  function placerCarte(c, box) {
    const ph = box.querySelector('[data-carte]');
    if (!ph) { if (carte && carte.cmd === c.id) oublierCarte(); return; }
    if (carte && carte.cmd === c.id) { ph.replaceWith(carte.el); if (carte.api) { carte.api.redim(); carte.api.etape(c.etape); carte.api.maj(pos[c.id]); } return; }
    oublierCarte();
    const el = document.createElement('div'); ph.replaceWith(el);
    const k = carte = { cmd: c.id, el, api: null };
    MDGSuivi.monter(el, c).then(api => {
      if (carte !== k) { api.detruire(); return; }
      k.api = api; api.etape(c.etape); api.maj(pos[c.id]);
    });
  }

  // l'avis : seulement après une commande terminée (schéma 32), un par commande, corrigeable 24 h puis figé
  const avis = {}, avisNote = {};
  const ETOILE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.6 7.7l5.8-.8z"/></svg>';
  const LIBA = ['', 'Mauvaise expérience', 'Décevant', 'Correct', 'Bon partenaire', 'Excellent partenaire'];
  const etoilesFixes = n => `<span class="cm-av-f" aria-label="${n} sur 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}">${ETOILE}</i>`).join('')}</span>`;
  function lierAvis(c, box) {
    // une étoile touchée : la note s'affiche, puis le champ de l'avis
    box.querySelectorAll('[data-av]').forEach(b => b.onclick = () => { avisNote[c.id] = +b.dataset.av; peindre(); const t = bg && bg.querySelector('[data-av-t]'); if (t && matchMedia('(hover:hover)').matches) t.focus(); });
    const ok = box.querySelector('[data-av-ok]'); if (!ok) return;
    ok.onclick = async () => {
      const n = avisNote[c.id] || (avis[c.id] && avis[c.id].note), t = box.querySelector('[data-av-t]').value.trim(), err = box.querySelector('[data-av-err]');
      if (!n) { err.textContent = 'Choisissez une note.'; return; }
      const rf = t && N().texteRefus ? N().texteRefus(t) : ''; if (rf) { err.textContent = rf; return; }
      ok.disabled = true; err.textContent = '';
      try { await N().rpc('avis_commande_donner', { p_cmd: c.id, p_note: n, p_texte: t || null }); delete avisNote[c.id];
        avis[c.id] = await N().rpc('avis_commande_moi', { p_cmd: c.id }).catch(() => avis[c.id]); toast('Merci, votre avis est publié', { type: 'ok' }); peindre(); }
      catch (x) { ok.disabled = false; err.textContent = x.code === 'texte' ? x.message : erreurTxt(x); }
    };
  }


  // les codes : le vendeur voit le code de prise en charge, l'acheteur le code de réception ; le chauffeur les tape
  // Le code n'est gardé qu'en mémoire, le temps de l'écran : jamais dans le téléphone, jamais dans un message.
  const codesVus = {};
  function blocCode(c) {
    if (c.validation !== 'code' || c.etat !== 'en_cours') return '';
    const pec = c.role === 'vendeur' && ['confirmee', 'preparation'].includes(c.etape), rec = c.role === 'acheteur' && ['transport', 'transbordement', 'arrivee'].includes(c.etape);
    if (!pec && !rec) return '';
    const T = transport[c.id], ok = T && T.mission && T.mission.statut === 'acceptee' && T.mission.avec_application;
    const k = codesVus[c.id + (pec ? ':p' : ':r')], titre = pec ? 'Code de prise en charge' : 'Code de réception';
    const regle = pec ? 'Donnez-le au chauffeur seulement quand la marchandise est dans son véhicule.' : 'Donnez-le au chauffeur seulement après avoir vérifié la quantité et la qualité.';
    const garde = pec ? TI('cle') + 'Gardez bien ce code : vous aurez à le présenter au chauffeur au chargement.' : TI('cle') + 'Gardez bien ce code : vous aurez à le présenter à la réception.';
    return `<div class="cm-st" data-code-bloc style="background:#FFFDF8;color:#171512;box-shadow:inset 0 0 0 2px #10392B"><p class="cm-garde">${garde}</p>${ok && T.mission.code ? `<p class="cm-tcode">${TI('camion')}Code du chauffeur : <b>${esc(T.mission.code)}</b><br>Exigez qu’il vous le montre dans son application avant de donner votre code : s’il ne l’a pas, ce n’est pas le bon chauffeur.</p>` : ''}<b style="color:#10392B">${titre}</b>
      ${!ok ? '<small style="color:#5E5546">Le code s’affichera quand le chauffeur (avec l’application) aura accepté la mission.</small>'
        : k ? `<div aria-live="polite" style="margin:10px 0 4px;font:800 40px/1 Jost,sans-serif;letter-spacing:.18em;color:#10392B;font-variant-numeric:tabular-nums">${esc(k.code.slice(0, 3))} ${esc(k.code.slice(3))}</div>
            <small style="color:#5E5546">Valable jusqu’à ${heure(k.expire_le)}. Un seul usage. ${regle} Dites-le de vive voix : ne l’envoyez pas par message.</small>
            <div class="cm-act" style="margin:10px 0 0"><button type="button" class="m" data-code-nv>Nouveau code (l’ancien ne marchera plus)</button></div>`
        : `<small style="color:#5E5546">${regle}</small><div class="cm-act" style="margin:10px 0 0"><button type="button" class="p" data-code-voir>Afficher le code</button></div>`}
      <p class="cm-err" data-code-err role="alert" style="margin:4px 0 0"></p></div>`;
  }
  function lierCode(c, box) {
    const go = async b => {
      const et = c.role === 'vendeur' ? 'prise_en_charge' : 'reception', err = box.querySelector('[data-code-err]');
      b.disabled = true;
      try { codesVus[c.id + (et === 'prise_en_charge' ? ':p' : ':r')] = await N().rpc('commande_code_obtenir', { p_cmd: c.id, p_etape: et }); signal(); await lireJournal(c.id); peindre(); }
      catch (x) { b.disabled = false; if (err) err.textContent = erreurTxt(x); }
    };
    const v = box.querySelector('[data-code-voir]'); if (v) v.onclick = () => go(v);
    const n = box.querySelector('[data-code-nv]'); if (n) n.onclick = async () => { if (await (window.MDGDemande ? MDGDemande.oui('Créer un nouveau code ? L’ancien ne marchera plus.', { ok: 'Nouveau code' }) : Promise.resolve(confirm('Créer un nouveau code ? L’ancien ne marchera plus.')))) go(n); };
  }

  // la ligne « Transport » du détail (schéma 83) : la règle, les villes, le prix accepté ; pas de total quand le livreur est hors Marché de Gros
  const REGLE = { inclus: 'Compris dans le prix', a_part: 'Le vendeur livre · transport à part', livreur_vendeur: 'Le vendeur organise son livreur', retrait: 'Retrait par l’acheteur', acheteur: 'Transport à la charge de l’acheteur', mgci: 'Transporteur du réseau Marché de Gros' };
  // qui paie le transport, en une phrase, selon le mode (règle « Transport à la charge de l’acheteur », 24/10/2026)
  const QUIPAIE = { inclus: 'Qui paie : rien en plus, le transport est dans le prix.', a_part: 'Qui paie : l’acheteur paie au vendeur le transport convenu, avec la marchandise.',
    livreur_vendeur: 'Qui paie : l’acheteur paie directement le livreur du vendeur, hors Marché de Gros.', acheteur: 'Qui paie : l’acheteur organise et paie son transport.' };
  function ddTransport(c) {
    const T = transport[c.id] || {}, R = T.regle || c.transport_regle, px = T.prix_transport, hors = c.mode_transport !== 'reseau', gris = 'style="font-weight:400;color:#5E5546"';
    let h = `<dt>Transport</dt><dd>${esc(REGLE[R] || MODES[c.mode_transport] || '—')}`;
    if (T.ville_arrivee) h += `<br><small ${gris}>${esc(T.ville_depart || '')} → ${esc(T.ville_arrivee)}${T.meme_ville ? ' · même ville' : ''}</small>`;
    if (px != null) h += `<br>${F(px)} <small ${gris}>(${hors ? 'convenu dans l’accord' : 'convenu à trois'})</small>`;
    if (QUIPAIE[R]) h += `<br><small ${gris}>${QUIPAIE[R]}</small>`;
    h += '</dd>';
    if (T.total_livraison != null && c.etat !== 'annulee') h += `<dt>Total convenu</dt><dd><b>${F(T.total_livraison)}</b><br><small ${gris}>marchandise ${F(c.montant)} + transport ${F(px)}, à régler à la livraison, hors application</small></dd>`;
    return h;
  }
  // le prix du transporteur du réseau, convenu à trois (schéma 83) : il propose, l'acheteur et le vendeur acceptent, refusent ou contre-proposent
  const QUI3 = { transporteur: 'Le transporteur', acheteur: 'L’acheteur', vendeur: 'Le vendeur' };
  let trois = null;   // commande dont le formulaire de contre-proposition est ouvert
  function blocTrois(c, T) {
    const P = T && T.prix_trois; if (!P || !['acheteur', 'vendeur'].includes(T.mon_role)) return '';
    if (P.convenu != null) return `<small style="color:#5E5546">Prix convenu par les trois : <b style="color:#171512">${F(P.convenu)}</b>. Il ne change plus, même en cas de transbordement.</small>`;
    const A = P.en_attente, moi = T.mon_role;
    if (!A) return `<small style="color:#5E5546">En attente du prix du transporteur. Vous pourrez l’accepter, le refuser ou proposer le vôtre (48 h pour répondre).</small>`;
    const ok = r => A['ok_' + r] ? 'a accepté' : 'pas encore', fini = A['ok_' + moi];
    return `<div class="cm-st" style="margin:6px 0 0;background:#FFFDF8;color:#171512"><b>${esc(QUI3[A.role] || '')} propose ${F(A.prix)}</b>
      <small style="color:#5E5546">Transporteur : ${ok('transporteur')} · acheteur : ${ok('acheteur')} · vendeur : ${ok('vendeur')}. Réponse avant ${esc(quand(A.expire_le))}.</small>
      ${fini ? '<small style="color:#5E5546">Vous avez accepté ce prix. En attente des autres.</small>' : `<div class="cm-act" style="margin:10px 0 0"><button type="button" class="p" data-t3="accord">Accepter ${F(A.prix)}</button><button type="button" data-t3="contre">Proposer un autre prix</button><button type="button" class="m" data-t3="refus">Refuser</button></div>`}
      ${trois === c.id ? `<form class="cm-f" data-t3f style="display:flex;gap:8px;margin-top:8px"><input type="number" inputmode="numeric" min="1" step="1" data-t3v aria-label="Votre prix pour le transport, en francs" placeholder="ex. 15000" style="flex:1;min-width:0"><button type="submit" style="min-height:48px;padding:0 18px;border-radius:24px;border:0;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer">Proposer</button></form>` : ''}
      <p class="cm-err" data-t3e role="alert" style="margin:4px 0 0"></p></div>`;
  }
  function lierTrois(c, box) {
    const T = transport[c.id], P = T && T.prix_trois; if (!P || !P.en_attente) return;
    const err = box.querySelector('[data-t3e]');
    const go = async (action, prix) => {
      try { transport[c.id].prix_trois = await N().rpc('transport_agir', { p_mission: P.mission_id, p_action: action, p_prix: prix || null, p_ref: action === 'prix' ? null : P.en_attente.id });
        trois = null; toast(action === 'accord' ? 'Prix accepté' : action === 'refus' ? 'Prix refusé : le livreur du vendeur prend le relais' : 'Prix proposé', { type: 'ok' }); await lireJournal(c.id); peindre(); }
      catch (x) { if (err) err.textContent = erreurTxt(x); }
    };
    box.querySelectorAll('[data-t3]').forEach(b => b.onclick = async () => {
      const g = b.dataset.t3;
      if (g === 'contre') { trois = trois === c.id ? null : c.id; peindre(); const v = bg && bg.querySelector('[data-t3v]'); if (v) v.focus(); return; }
      if (g === 'refus' && !await (window.MDGDemande ? MDGDemande.oui('Refuser ce prix ? Le transporteur du réseau est retiré et la commande continue avec le livreur du vendeur.', { ok: 'Refuser', danger: true }) : Promise.resolve(false))) return;
      b.disabled = true; await go(g); b.disabled = false;
    });
    const f = box.querySelector('[data-t3f]');
    if (f) f.onsubmit = e => { e.preventDefault(); const p = Math.round(+f.querySelector('[data-t3v]').value || 0); if (!(p > 0)) { if (err) err.textContent = 'Indiquez votre prix, en francs.'; return; } go('prix', p); };
  }
  // le transport du réseau : qui conduit, sa réponse (son propre transporteur n'apparaît pas ici : pas de code, schéma 63)
  function blocTransport(c) {
    const T = transport[c.id]; if (!T || c.etat === 'annulee') return '';
    const m = T.mission && T.mission.statut !== 'retiree' ? T.mission : null;
    // son propre transporteur (schéma 63) : rien à choisir ni à taper ici ; on n'affiche une mission que si elle existait déjà
    if (c.mode_transport !== 'reseau' && !m) return '';
    const choisir = T.peut_choisir && c.mode_transport === 'reseau', qui = c.mode_transport === 'acheteur' ? 'l’acheteur' : 'le vendeur';
    const etat = !m ? '' : m.statut === 'proposee' ? 'Mission proposée : le prix du transport se convient à trois' : m.statut === 'acceptee' ? 'A accepté la mission' + (m.avec_application ? '' : ' (inscrit par l’équipe, sans l’application)') : 'A refusé la mission.';
    const vide = c.mode_transport === 'reseau' ? 'L’équipe du Marché de Gros vous affecte un transporteur vérifié.' : 'En attente du choix de ' + qui + '.';
    return `<h3 class="cm-h3">Transport</h3><div class="cm-dl" style="grid-template-columns:1fr;gap:6px">
      ${m ? `<b style="font-weight:600">${esc(m.nom)} · ${esc(m.vehicule)}${m.immatriculation ? ' · ' + esc(m.immatriculation) : ''}</b>
        <span><span class="cm-tag ${m.verifie ? '' : 'mais'}">${m.verifie ? 'Vérifié par l’équipe' : 'Pas encore vérifié par l’équipe'}</span></span>
        <small style="color:${m.statut === 'refusee' ? '#8A2414' : '#5E5546'}">${esc(etat)}</small>
        ${c.mode_transport === 'reseau' ? blocTrois(c, T) : ''}` : `<small style="color:#5E5546">${esc(vide)}</small>`}
      ${choisir ? `<form class="cm-f" data-trf style="display:flex;gap:8px;margin-top:6px"><input type="text" data-code maxlength="8" placeholder="T-4K7P" aria-label="Code du transporteur" autocapitalize="characters" autocomplete="off" style="flex:1;min-width:0;text-transform:uppercase"><button type="submit" style="min-height:48px;padding:0 18px;border-radius:24px;border:0;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer">${m ? 'Changer' : 'Choisir'}</button></form>
        ${m && m.statut !== 'refusee' ? '<button type="button" data-trx style="all:unset;cursor:pointer;color:#10392B;text-decoration:underline;min-height:44px;display:inline-flex;align-items:center">Retirer ce transporteur</button>' : ''}<p class="cm-err" data-tre role="alert" style="margin:0"></p>` : ''}
    </div>`;
  }
  function lierTransport(c, box) {
    const f = box.querySelector('[data-trf]');
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const v = f.querySelector('[data-code]').value.trim(), err = box.querySelector('[data-tre]'), b = f.querySelector('[type=submit]');
      if (!/^t-?[a-z0-9]{4}$/i.test(v.replace(/\s/g, ''))) { err.textContent = 'Le code ressemble à T-4K7P.'; return; }
      b.disabled = true; err.textContent = '';
      try { const r = await N().rpc('commande_choisir_transporteur', { p_cmd: c.id, p_code: v }); toast('Mission envoyée à ' + r.nom, { type: 'ok', sous: 'Il l’accepte dans son Espace chauffeur.' }); await lireJournal(c.id); peindre(); }
      catch (x) { err.textContent = erreurTxt(x); b.disabled = false; }
    };
    const x = box.querySelector('[data-trx]');
    if (x) x.onclick = async () => {
      if (!await (window.MDGDemande ? MDGDemande.oui('Retirer ce transporteur de la commande ?', { ok: 'Retirer', danger: true }) : Promise.resolve(confirm('Retirer ce transporteur de la commande ?')))) return;
      try { await N().rpc('commande_retirer_transporteur', { p_cmd: c.id }); toast('Transporteur retiré', { type: 'ok' }); await lireJournal(c.id); peindre(); }
      catch (e) { toast(erreurTxt(e), { type: 'erreur' }); }
    };
  }

  function peindre(change) {
    if (!bg) return;
    const ecran = vue + ':' + (sel || ''), box = bg.querySelector('.cm'), y = box.scrollTop;
    const plein = vue === 'detail' && !!sel; box.classList.toggle('plein', plein); bg.classList.toggle('plein', plein);
    if (plein) peindreDetail(change); else peindreListe();
    const nouveau = ecran !== dernierEcran;
    box.scrollTop = nouveau ? 0 : y; dernierEcran = ecran;
    // le titre reçoit le focus une fois par écran, dès qu'il existe (le premier rendu peut être un « chargement… »)
    if (nouveau) titreFait = false;
    if (!titreFait && box.querySelector('h2')) { focusTitre(box); titreFait = true; }
  }
  let titreFait = false;
  function focusTitre(box) { const h = box.querySelector('h2'); if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (_) {} } }

  // les gestes : une petite feuille de confirmation, puis l'appel au serveur
  async function position(oui) {
    if (!oui || !navigator.geolocation) return null;
    return new Promise(ok => navigator.geolocation.getCurrentPosition(p => ok([p.coords.latitude, p.coords.longitude]), () => ok(null), { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }));
  }
  // les gestes s'ouvrent dans la feuille du bas de la maquette (MDGFeuille), au-dessus de l'écran de la commande
  let feuilleG = null;
  function feuilleGeste(label) {
    if (feuilleG) feuilleG.fermer();
    if (!window.MDGFeuille) return null;
    feuilleG = MDGFeuille.ouvrir({ label, onFerme: () => { feuilleG = null; } });
    return feuilleG;
  }
  const finGeste = () => { if (feuilleG) feuilleG.fermer(); };
  // une ligne à choisir, comme la maquette (rond de 22 px, bord de 1,5 px)
  const ligneChoix = (name, v, l, s, cls) => `<label class="fl-ch${cls ? ' ' + cls : ''}"><input type="radio" name="${name}" value="${v}" class="fl-sr"><span class="rb" aria-hidden="true"><i></i></span><span class="l">${l}</span>${s ? `<span class="s">${s}</span>` : ''}</label>`;
  const ligneCase = (id, l) => `<label class="fl-ch carre"><input type="checkbox" id="${id}" class="fl-sr"><span class="rb" aria-hidden="true"><i></i></span><span class="l">${l}</span></label>`;
  // « Jusqu'à 17 h 52 » : l'échéance actuelle repoussée de n heures
  function jusqua(c, n) {
    const d = dl[c.id] || {}, base = d.reception_echeance ? new Date(d.reception_echeance).getTime() : Date.now() + 36e5;
    if (n === 24) return 'Jusqu’à demain même heure';
    const t = new Date(base + n * 36e5), j = new Date(), demain = t.toDateString() !== j.toDateString();
    return 'Jusqu’à ' + (demain ? 'demain ' : '') + t.getHours() + ' h ' + String(t.getMinutes()).padStart(2, '0');
  }
  function confirmer(c, o) {
    const F = feuilleGeste(o.label || String(o.titre).replace(/<[^>]+>/g, ''));
    if (!F) return;
    const box = F.corps, essais = o.essais;
    const motifs = o.motifs === true ? (o.motifsCourts ? MOTIFS_V : MOTIFS) : o.motifs;
    box.innerHTML = `<h2 class="fl-h">${o.titre}</h2><p class="fl-s">${o.sous || esc(c.produit || '') + ' · ' + esc(c.partenaire_nom)}</p>
      <form novalidate>
        ${o.mot ? `<div class="cv-motp">
          <div class="cv-motp-t">${SVGR.cadenas || ''}<label for="cmM">Le mot secret du vendeur</label>${essais != null && essais > 0 ? `<span class="nbul">${essais} essai${essais > 1 ? 's' : ''}</span>` : ''}</div>
          <input type="text" id="cmM" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="MANGUE 47"${essais === 0 ? ' disabled' : ''}>
          <p>${essais === 0 ? 'Mot secret bloqué après trop d’essais faux. L’équipe est prévenue.' : 'Il est écrit sur le papier que le vendeur a glissé dans la marchandise.'}</p>
          <button type="submit" class="cv-motp-b">${o.ok}</button>
        </div>
        ${ligneCase('cmS', 'Je ne trouve pas le papier du vendeur')}
        <p class="fl-p" data-sans hidden>Sans le mot, la réception est notée « sans le mot secret du vendeur », visible du vendeur et de l’équipe. Si la marchandise ne va pas, ne confirmez pas : <b>refusez-la avec des photos</b>.</p>` : ''}
        ${o.heures ? `<fieldset class="fl-g"><legend class="fl-sr">Combien de temps ?</legend>${o.heures.map(h => ligneChoix('cmH', h, h + ' h de plus', jusqua(c, h), 'h')).join('')}</fieldset>` : ''}
        ${motifs ? `<fieldset class="fl-g"><legend class="${o.motifsTitre ? 'fl-t' : 'fl-sr'}">${o.motifsTitre || 'Motif'}</legend>${motifs.map(([k, t]) => ligneChoix('cmMot', k, t)).join('')}</fieldset>` : ''}
        ${o.motifs === true ? `<div data-preuve hidden><label class="fl-t" for="cmP">Source publique (facultatif)</label>
        <input type="text" id="cmP" maxlength="120" autocomplete="off" placeholder="Ex. : radio, presse, autorités, avec la date"></div>` : ''}
        ${o.accord ? `<p class="fl-p" data-motif>Motif donné : …</p><fieldset class="fl-g"><legend class="fl-t">Êtes-vous d’accord avec ce motif ?</legend>
          ${ligneChoix('cmAcc', '1', 'Oui, d’un commun accord', '')}${ligneChoix('cmAcc', '0', 'J’accepte, mais je ne suis pas d’accord', '')}</fieldset>
          <p class="fl-s">D’un commun accord, l’annulation ne compte contre personne. Sinon, elle compte dans la fiabilité de l’autre partie, qui peut la contester.</p>` : ''}
        ${o.lieu ? `<label class="fl-t" for="cmL">${o.lieu}</label><input type="text" id="cmL" maxlength="120" autocomplete="off">` : ''}
        ${o.note ? `<div data-note${o.noteSiAutre ? ' hidden' : ''}><label class="fl-t" for="cmN">${o.note}</label><textarea id="cmN" maxlength="${o.noteMax || 300}" style="margin-top:8px"></textarea></div>` : ''}
        ${o.date ? `<label class="fl-t" for="cmD">${o.date}</label><input type="datetime-local" id="cmD" min="${dtLocal(Date.now())}" max="${dtLocal(Date.now() + 60 * 864e5)}">` : ''}
        ${o.gps ? ligneCase('cmG', 'Joindre ma position actuelle (une seule fois)') : ''}
        ${o.texte ? `<p class="fl-s">${o.texte}</p>` : ''}
        <p class="fl-err" role="alert"></p>
        ${o.mot ? '' : `<button type="submit" class="fl-b${o.danger ? ' danger' : ''}">${o.ok}</button>`}
      </form>`;
    const f = box.querySelector('form'), err = f.querySelector('.fl-err');
    // le bouton reste gris tant que le choix obligatoire n'est pas fait (comme la maquette)
    const btnP = f.querySelector('.fl-b');
    const pret = () => { if (!btnP) return; const manque = (o.heures && !f.querySelector('[name=cmH]:checked')) || (motifs && !f.querySelector('[name=cmMot]:checked')) || (o.accord && !f.querySelector('[name=cmAcc]:checked'));
      btnP.setAttribute('aria-disabled', manque ? 'true' : 'false'); };
    f.addEventListener('change', pret); pret();
    // « Autre » : quelques mots ; « Panne ou météo » propose d'écrire la source publique
    const Zn = f.querySelector('[data-note]'), Zp = f.querySelector('[data-preuve]');
    if (motifs) f.querySelectorAll('[name=cmMot]').forEach(r => r.addEventListener('change', () => {
      if (Zn && o.noteSiAutre) Zn.hidden = r.value !== 'autre' || !r.checked;
      if (Zp) Zp.hidden = r.value !== 'panne_meteo' || !r.checked; }));
    const Sm = f.querySelector('#cmS'); if (Sm) Sm.onchange = () => { f.querySelector('[data-sans]').hidden = !Sm.checked; f.querySelector('#cmM').disabled = Sm.checked || essais === 0; };
    f.onsubmit = async e => {
      e.preventDefault();
      const L = f.querySelector('#cmL'), Nt = f.querySelector('#cmN'), G = f.querySelector('#cmG'), M = f.querySelector('#cmM');
      const P = f.querySelector('#cmP'), src = P && !P.closest('[hidden]') ? P.value.trim() : '';
      let note = Nt && !Nt.closest('[hidden]') ? Nt.value.trim() : null;
      const lieu = L ? L.value.trim() : null, mot = M ? M.value.trim() : null, sansMot = !!(Sm && Sm.checked);
      const mo = f.querySelector('[name=cmMot]:checked'), motif = mo ? mo.value : null, ac = f.querySelector('[name=cmAcc]:checked'), accord = ac ? ac.value === '1' : null;
      const hh = f.querySelector('[name=cmH]:checked'), heures = hh ? +hh.value : null, Dd = f.querySelector('#cmD'), date = Dd && Dd.value ? new Date(Dd.value) : null;
      if (o.heures && !heures) { err.textContent = 'Choisissez 2 h, 6 h ou 24 h.'; f.querySelector('[name=cmH]').focus(); return; }
      if (motifs && !motif && o.motifsErr) { err.textContent = o.motifsErr; f.querySelector('[name=cmMot]').focus(); return; }
      if (date && (isNaN(date) || date < Date.now() - 6e4 || date > Date.now() + 60 * 864e5)) { err.textContent = 'Choisissez une date à venir, dans les 60 jours.'; Dd.focus(); return; }
      if (motifs && !motif) { err.textContent = 'Choisissez un motif.'; f.querySelector('[name=cmMot]').focus(); return; }
      if (motifs && motif === 'autre' && !(note && note.length >= 3)) { err.textContent = 'Motif « Autre » : écrivez quelques mots.'; if (Nt) Nt.focus(); return; }
      if (motif === 'panne_meteo' && src) note = ((note ? note + ' · ' : '') + 'Source : ' + src).slice(0, 300);
      if (o.accord && accord == null) { err.textContent = 'Dites si vous êtes d’accord avec le motif.'; f.querySelector('[name=cmAcc]').focus(); return; }
      if (o.mot && !sansMot && !mot) { err.textContent = 'Tapez le mot secret écrit sur le papier du vendeur.'; M.focus(); return; }
      if (o.lieuRequis && !lieu) { err.textContent = 'Indiquez le lieu.'; L.focus(); return; }
      if (o.noteRequise && !note) { err.textContent = 'Expliquez en quelques mots.'; Nt.focus(); return; }
      if (N().texteRefus) { const r = N().texteRefus((lieu || '') + ' ' + (note || '')); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        const pos = await position(G && G.checked);
        await o.fn({ lieu, note, pos, mot, sansMot, motif, accord, heures, date });
        await lireListe(); await lireJournal(c.id);
        finGeste();
        if (o.fait) toast(o.fait, { type: 'ok' });
        if (window.MDGSons && MDGSons.signal) try { MDGSons.signal('accord'); } catch (_) {}
        peindre(o.etape);
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
    const premier = f.querySelector('input[type=text]:not([disabled]),textarea'); if (premier && !premier.closest('[hidden]') && matchMedia('(hover:hover)').matches) premier.focus();
    // le motif donné par celui qui demande l'annulation (schéma 84), lu sur le serveur
    const zm = f.querySelector('[data-motif]');
    if (zm) N().rpc('commande_annulation_motif', { p_id: c.id }).then(m => { if (!zm.isConnected) return; const t = m && m.motif ? (MOTIF_NOM[m.motif] || m.motif) + (m.texte ? ' : « ' + m.texte + ' »' : '') : 'non précisé';
      zm.innerHTML = 'Motif donné : <b>' + esc(t) + '</b>'; }).catch(() => { if (zm.isConnected) zm.textContent = 'Motif donné : non précisé'; });
  }
  // une date pour <input type="datetime-local"> (heure du téléphone)
  const dtLocal = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  // motifs d'annulation (décision 11, schéma 84) ; « Autre » demande quelques mots
  const MOTIFS = [['stock_epuise', 'Marchandise plus disponible'], ['prix_change', 'Prix changé'], ['sans_reponse', 'L’autre partie ne répond pas'], ['erreur_saisie', 'Erreur de quantité'], ['panne_meteo', 'Panne ou météo'], ['autre', 'Autre raison']];
  // le vendeur qui demande l'annulation : les 4 motifs de la maquette (mêmes catégories du serveur)
  const MOTIFS_V = MOTIFS.filter(m => ['stock_epuise', 'panne_meteo', 'erreur_saisie', 'autre'].includes(m[0]));
  const MOTIF_NOM = Object.fromEntries(MOTIFS);
  // appel des portes du schéma 84 ; serveur pas encore à jour : l'ancienne fonction, sans motif
  const ancien = e => /schema cache|Could not find the function|PGRST202/i.test(String(e && e.message));
  const annulerMotif = (c, oui, v) => N().rpc('commande_annuler_motif', { p_id: c.id, p_oui: oui, p_note: v.note || null, p_motif: v.motif || null, p_motif_texte: v.motif ? v.note || null : null, p_accord: v.accord == null ? null : v.accord })
    .catch(e => ancien(e) ? N().rpc('commande_annuler', { p_id: c.id, p_oui: oui, p_note: v.note || null }) : Promise.reject(e));
  const repondreMotif = (c, oui, v) => N().rpc('commande_repondre_motif', { p_id: c.id, p_oui: oui, p_note: v.note || null, p_motif: v.motif || null, p_motif_texte: v.motif ? v.note || null : null })
    .catch(e => ancien(e) ? N().rpc('commande_repondre', { p_id: c.id, p_oui: oui, p_note: v.note || null }) : Promise.reject(e));
  let nouvEnvoi = false;
  async function nouvelles(c) {
    if (nouvEnvoi) return; nouvEnvoi = true;
    const bt = bg && bg.querySelector('[data-g="nouvelles"]'); if (bt) bt.disabled = true;
    try {
      const r = await N().rpc('commande_nouvelles_demander', { p_id: c.id });
      if (r === 'nouvelles_deja') toast('Déjà envoyé', { type: 'info', sous: 'Réessayez dans une minute.' });
      else { toast('Nouvelles demandées', { type: 'ok', sous: 'Le vendeur le voit dans la commande.' }); await lireJournal(c.id); peindre(); }
    } catch (x) { toast('Demande non envoyée', { type: 'erreur', sous: erreurTxt(x) }); }
    finally { nouvEnvoi = false; const b2 = bg && bg.querySelector('[data-g="nouvelles"]'); if (b2) b2.disabled = false; }
  }
  function geste(c, g) {
    const R = (f, a) => N().rpc(f, a);
    const av = (etape, ok, extra) => confirmer(c, Object.assign({ titre: ok, ok, etape, gps: true, note: 'Un mot (facultatif)', fait: LIB[etape] || ok,
      fn: v => R('commande_avancer', { p_id: c.id, p_etape: etape, p_lieu: v.lieu || null, p_lat: v.pos ? v.pos[0] : null, p_lon: v.pos ? v.pos[1] : null, p_note: v.note || null }) }, extra || {}));
    switch (g) {
      case 'oui': return confirmer(c, { titre: 'Confirmer la <em>commande</em>', ok: 'Confirmer', note: 'Un mot (facultatif)', fait: 'Commande confirmée', etape: 'confirmee',
        texte: `Transport : ${esc(MODES[c.mode_transport] || '')}. Livraison : ${esc(c.lieu_livraison || 'à convenir')}.`,
        fn: v => R('commande_repondre', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'non': return confirmer(c, { titre: 'Refuser la commande', ok: 'Refuser', motifs: true, note: 'Quelques mots', noteSiAutre: true, fait: 'Commande refusée',
        texte: 'Avant confirmation, un refus ne compte pas dans votre fiabilité.', fn: v => repondreMotif(c, false, v) });
      case 'preparation': return av('preparation', 'Marchandise en préparation', { gps: false });
      case 'probleme': return probleme(c);
      case 'chargement': return av('chargement', 'Chargement confirmé', { texte: c.mode_transport === 'reseau' ? 'Confirmez seulement quand la marchandise est dans le camion. Le transport commence alors.' : 'Confirmez seulement quand la marchandise est dans le camion. Ensuite, touchez « Le camion est parti » au départ (ou laissez le lien de suivi du chauffeur le détecter).' });
      case 'transport': return av('transport', 'Le camion est parti', { texte: 'Touchez quand le camion démarre avec la marchandise. ' + (c.role === 'vendeur' ? 'L’acheteur' : 'Le vendeur') + ' est prévenu.', fait: 'Départ signalé : le camion est en route' });
      case 'transbordement': return av('transbordement', 'Signaler un transbordement', { lieu: 'Où la marchandise change-t-elle de véhicule ?', lieuRequis: true });
      case 'arrivee': return c.role === 'acheteur'
        ? av('arrivee', 'La marchandise est arrivée', { texte: 'Touchez quand la marchandise est devant vous. Ensuite, vérifiez-la : confirmez la réception, ou refusez avec des photos.', fait: 'Marchandise arrivée : vérifiez-la' })
        : av('arrivee', 'Marchandise livrée', { texte: `Touchez quand la marchandise est déposée chez l’acheteur et qu’il ne l’a pas encore dit. Il a ${duree((dl[c.id] && dl[c.id].reception_minutes) || 60)} pour confirmer ou signaler un problème. Sans réponse, un litige s’ouvre ; encore ${duree((dl[c.id] && dl[c.id].litige_sans_reponse_minutes) || 60)} sans réponse, la commande est close en votre faveur.`, fait: 'Livraison déclarée' });
      case 'retard': return confirmer(c, { titre: 'Annuler la <em>commande</em>', ok: 'Annuler la commande', note: 'Un mot (facultatif)', fait: 'Commande annulée',
        texte: dl[c.id] && dl[c.id].vendeur_banni ? 'Le vendeur a été banni du Marché de Gros. L’annulation compte contre lui, pas contre vous.'
          : `Le vendeur n’a pas chargé dans les ${(dl[c.id] && dl[c.id].chargement_heures) || 72} h après la confirmation. L’annulation compte dans sa fiabilité, pas dans la vôtre. Le stock revient sur son annonce.`,
        fn: v => R('commande_annuler_retard', { p_id: c.id, p_note: v.note || null }) });
      case 'reception': return c.validation === 'declaration' && c.mode_transport !== 'reseau'
        ? confirmer(c, { titre: 'Confirmer la <em>réception</em>', ok: 'Valider', etape: 'reception', mot: true, gps: true, fait: 'Réception confirmée : 1 h pour signaler un problème',
            sous: 'Vérifiez d’abord la quantité et la qualité. Ensuite, vous avez 1 h pour signaler un problème.',
            essais: dl[c.id] ? dl[c.id].mot_essais_restants : null,
            // schéma 92 : un mot faux ne lève plus d'erreur ; la réponse dit combien d'essais restent (5 au plus)
            fn: v => R('commande_reception_mot', { p_id: c.id, p_mot: v.sansMot ? null : v.mot, p_sans_mot: v.sansMot, p_lat: v.pos ? v.pos[0] : null, p_lon: v.pos ? v.pos[1] : null, p_note: v.note || null })
              .then(r => { const s = String(r || '');
                if (s === 'mot_bloque') { if (dl[c.id]) dl[c.id].mot_essais_restants = 0; throw new Error('Trop d’essais faux : le mot secret est bloqué et l’équipe du Marché de Gros est prévenue. Fermez et touchez « Signaler un problème ».'); }
                if (s.startsWith('mot_incorrect')) { const n = +s.split(':')[1]; if (dl[c.id]) dl[c.id].mot_essais_restants = n; throw new Error(`Ce n’est pas le mot du vendeur. Vérifiez le papier : il reste ${n} essai${n > 1 ? 's' : ''}.`); }
                return r; }) })
        : av('reception', 'Réception confirmée', { texte: 'Confirmez seulement après avoir vérifié la quantité et la qualité. <b>Vous aurez 1 h pour signaler un problème.</b> Après, sans réclamation, la commande se clôt toute seule. ', fait: 'Réception confirmée : 1 h pour signaler un problème' });
      case 'annuler': return confirmer(c, { titre: c.etat === 'a_confirmer' ? 'Retirer la commande' : 'Demander l’annulation', ok: c.etat === 'a_confirmer' ? 'Retirer' : 'Envoyer la demande', motifs: true, motifsCourts: c.role === 'vendeur', note: 'Quelques mots', noteSiAutre: true,
        sous: c.etat === 'a_confirmer' ? 'Avant confirmation, un retrait ne compte pas dans votre fiabilité.' : 'Le motif est obligatoire. Il compte sur 90 jours.',
        fait: c.etat === 'a_confirmer' ? 'Commande retirée' : 'Demande d’annulation envoyée', fn: v => annulerMotif(c, true, v) });
      case 'annul-oui': return confirmer(c, { titre: 'Accepter l’annulation', ok: 'Accepter', accord: true, note: 'Un mot (facultatif)', fait: 'Commande annulée', texte: 'Le stock reviendra sur l’annonce.',
        fn: v => annulerMotif(c, true, v) });
      case 'annul-non': return confirmer(c, { titre: 'Refuser l’annulation', ok: 'Refuser', note: 'Un mot (facultatif)', fait: 'Annulation refusée',
        fn: v => annulerMotif(c, false, v) });
      case 'liberer': {
        return confirmer(c, { titre: 'Tout est <em>conforme</em>', ok: 'Confirmer', fait: 'Merci ! Commande clôturée',
          texte: 'Confirmez seulement si la quantité et la qualité sont bonnes. La commande sera clôturée : vous ne pourrez plus la refuser.',
          fn: () => R('commande_liberer', { p_id: c.id }) }); }
      case 'refuser': return refuser(c);
      case 'rf-oui': return confirmer(c, { titre: 'Reconnaître le <em>problème</em>', ok: 'Je reconnais', note: 'Un mot (facultatif)', fait: 'Refus accepté : la commande est clôturée',
        texte: seq[c.id] && seq[c.id].actif ? 'La partie refusée n’est pas due. Le reste de la commande vous revient. Vous payez le transport.' : 'L’acheteur ne paie que la partie acceptée. Vous payez le transport.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'rf-non': return confirmer(c, { titre: 'Contester le <em>refus</em>', ok: 'Contester', note: 'Pourquoi ?', noteRequise: true, fait: 'Contestation envoyée : l’équipe va trancher',
        texte: 'L’équipe du Marché de Gros tranche avec l’accord, la négociation, vos messages, les photos et la réponse du chauffeur.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: false, p_note: v.note }) });
      // schéma 99a : l'acheteur demande des nouvelles, sans limite (deux appuis dans la même minute comptent pour un)
      case 'nouvelles': return nouvelles(c);
      // schéma 99a : le vendeur (ou le chauffeur) signale un retard en route ; l'acheteur le lit dans la commande
      case 'retard-sig': return confirmer(c, { titre: 'Signaler un <em>retard</em>', ok: 'Signaler le retard', motifs: Object.entries(CAUSE_R), motifsTitre: 'Cause du retard', motifsErr: 'Choisissez la cause du retard.',
        note: 'Un mot (obligatoire pour « Autre »)', noteMax: 200, date: 'Nouvelle arrivée estimée (facultatif)', fait: 'Retard signalé',
        fn: v => R('commande_retard_signaler', { p_id: c.id, p_motif: v.motif, p_date: v.date ? v.date.toISOString() : null, p_texte: v.note || null }) });
      // après « arrivé » : un seul délai de 2, 6 ou 24 h, avec sa cause ; l'échéance d'1 h est repoussée d'autant
      case 'delai': return confirmer(c, { titre: 'Plus de temps pour vérifier', ok: 'Demander le délai', heures: [2, 6, 24], motifs: Object.entries(CAUSE_D), motifsTitre: 'Pourquoi ?', motifsErr: 'Dites pourquoi vous demandez un délai.',
        sous: 'Possible une seule fois. ' + esc(c.partenaire_nom || 'Le vendeur') + ' est prévenu.', note: 'Quelques mots', noteSiAutre: true, noteMax: 200, fait: 'Délai accordé',
        fn: v => R('commande_delai_demander', { p_id: c.id, p_heures: v.heures, p_motif: v.motif, p_texte: v.note || null }).then(r => { if (dl[c.id] && r && r.reception_echeance) Object.assign(dl[c.id], { reception_echeance: r.reception_echeance, delai_heures: r.delai_heures, peut_demander_delai: false }); return r; })
          .catch(e => { if (/DELAI_DEJA/.test(String(e && e.message))) { if (dl[c.id]) dl[c.id].peut_demander_delai = false; } throw e; }) });
      case 'litige': return confirmer(c, { titre: 'Signaler un <em>problème</em>', ok: 'Ouvrir un litige', note: 'Que s’est-il passé ?', noteRequise: true, fait: 'Litige ouvert : l’équipe va examiner',
        texte: 'L’équipe du Marché de Gros examine la commande, l’accord, la négociation et vos messages.',
        fn: v => R('commande_litige', { p_id: c.id, p_motif: v.note }) });
    }
  }

  // qui transporte (schéma 83) : l'accord passe avant l'annonce, puis la ville (même ville ou non)
  // · transport inclus dans l'accord : le vendeur livre ;
  // · transport à part, prix convenu dans l'accord : le vendeur livre à ce prix (ou un transporteur du réseau) ;
  // · même ville : le vendeur organise son livreur, l'acheteur paie les frais au livreur, hors Marché de Gros ; retrait si le vendeur l'accepte ;
  // · villes différentes sans transport convenu : l'acheteur s'en charge, sauf accord avec le vendeur.
  function choixTransport(n, meme) {
    const t = choixTransport0(n, meme); if (RESEAU_OUVERT) return t;
    const modes = t.modes.filter(k => k !== 'reseau');
    return Object.assign({}, t, { modes, defaut: modes.includes(t.defaut) ? t.defaut : modes[0], bientot: t.modes.includes('reseau') });
  }
  const annonceDe = n => { try { return (N().list(n.cible === 'offre' ? 'offres' : 'demandes') || []).find(x => x._rid === n.cible_id) || null; } catch (_) { return null; } };
  // sa propre annonce (publiée depuis ce téléphone) : retrouvée par son numéro sur le serveur (mdg-nuage:pousse)
  const mienne = n => { try { const k = n.cible === 'offre' ? 'offres' : 'demandes', p = JSON.parse(localStorage.getItem('mdg-nuage:pousse') || '{}'), cle = Object.keys(p).find(x => x.startsWith(k + ':') && p[x] === n.cible_id);
    return cle ? (JSON.parse(localStorage.getItem('mdg-v2:' + k) || '[]').find(x => x.id === cle.slice(k.length + 1)) || null) : null; } catch (_) { return null; } };
  const moiVendeur = n => (n.cible === 'offre') === (me() === n.proprio_id);
  function choixTransport0(n, meme) {
    const a = annonceDe(n), t = a && a.transport, pt = n.transport_final === false && +n.prix_transport_final > 0 ? +n.prix_transport_final : 0;
    const inclus = n.transport_final === true || (n.transport_final == null && ((n.cible === 'offre' && t === 'inclus') || (n.cible === 'demande' && t === 'vendeur')));
    const V = moiVendeur(n), frais = 'L’acheteur paie les frais de livraison directement au livreur, hors Marché de Gros.';
    if (inclus) return { modes: ['vendeur'], defaut: 'vendeur', lib: { vendeur: 'Le vendeur livre' }, sous: { vendeur: 'Le transport est compris dans le prix convenu.' }, info: 'L’accord comprend le transport : c’est le vendeur qui livre.' };
    if (pt) return { modes: ['vendeur', 'reseau'], defaut: 'vendeur', lib: { vendeur: 'Le vendeur livre · transport ' + F(pt) }, sous: { vendeur: 'Prix du transport convenu dans l’accord, à régler à la livraison, hors application.' },
      info: 'Transport à part, convenu dans l’accord : ' + F(pt) + '.' };
    if (meme === true) return { modes: ['vendeur', 'acheteur', 'reseau'], defaut: 'vendeur',
      lib: { vendeur: 'Le vendeur organise son livreur', acheteur: 'Transport à la charge de l’acheteur' },
      sous: { vendeur: 'Le vendeur choisit le livreur. ' + frais, acheteur: V ? 'Retrait chez vous : vous l’acceptez en envoyant la commande.' : 'Retrait seulement si le vendeur l’accepte : il le dit en confirmant la commande.' },
      info: 'Même ville : le vendeur organise la livraison. ' + frais };
    const hv = n.cible === 'offre' && t === 'hors_ville';
    return { modes: hv ? ['vendeur', 'acheteur', 'reseau'] : ['acheteur', 'vendeur', 'reseau'], defaut: hv ? 'vendeur' : 'acheteur', lib: {}, sous: {},
      info: meme === false ? (hv ? 'Le vendeur livre hors de sa ville.' : 'Villes différentes : le transport est à la charge de l’acheteur, sauf accord avec le vendeur.') : '' };
  }
  // le lien de suivi pour son propre chauffeur (schéma 48)
  const ago = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j'; };
  const lienURL = j => new URL('suivi.html?j=' + j, location.href).href;
  const SV = {
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M9.5 9.5l2 2 3.5-4"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    camion: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17" r="1.8"/><circle cx="17" cy="17" r="1.8"/></svg>'
  };
  // le schéma, pour celui qui envoie le lien ou dicte le code
  const schema = code => `<p class="cm-sch-t">Pour le chauffeur, c’est tout simple</p><ol class="cm-sch" aria-label="Comment marche le suivi">
      <li><span class="ic">${SV.tel}<i>1</i></span><b>Il ouvre le lien</b>${code ? 'ou tape le code' : 'dans son message'}</li>
      <li><span class="ic">${SV.pin}<i>2</i></span><b>Il accepte</b>la position, une seule fois</li>
      <li><span class="ic">${SV.camion}<i>3</i></span><b>Vous suivez</b>le camion ici, en direct</li></ol>`;
  const pageSuivi = () => new URL('suivi.html', location.href).href.replace(/^https?:\/\//, '');
  function blocLien(c) {
    if (c.mode_transport === 'reseau' || !['a_confirmer', 'en_cours'].includes(c.etat)) return '';
    const L = lien[c.id], moi = c.role === c.mode_transport, qui = c.mode_transport === 'vendeur' ? 'le vendeur' : 'l’acheteur', autre = c.mode_transport === 'vendeur' ? 'l’acheteur' : 'le vendeur';
    const etat = L && L.vu_le ? `<span class="cm-lien-e on">${TI('lieu')}Le chauffeur partage sa position · ${esc(ago(L.vu_le))}</span>`
      : L && L.ouvert_le ? `<span class="cm-lien-e">${TI('oeil')}Le chauffeur a ouvert le lien · ${esc(ago(L.ouvert_le))} · en attente de sa position</span>`
      : L ? '<span class="cm-lien-e">⏳ Le chauffeur n’a pas encore ouvert le lien</span>' : '';
    if (!moi) return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">${IC('confiance', 18)}</span><b>Suivi de la livraison</b></div>
      ${L ? etat : `<small>Nous avons conseillé ${qui === 'le vendeur' ? 'au vendeur' : 'à l’acheteur'} de donner un lien de suivi à son chauffeur. Dès qu’il l’ouvre, vous voyez le camion avancer ici.</small>`}</div>`;
    const pourquoi = `<ul class="cm-lien-l"><li>${TI('lieu')}${autre === 'l’acheteur' ? 'L’acheteur' : 'Le vendeur'} voit le camion avancer : moins d’appels, plus de confiance.</li>
      <li>${TI('cadenas')}Sécurité : en cas de retard ou d’incident, la dernière position est connue.</li>
      <li>${TI('telephone')}Sans compte, sans application, sans code à retenir pour le chauffeur.</li></ul>`;
    if (!L || !L.jeton) return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">${IC('confiance', 18)}</span><b>Donnez un lien de suivi à votre chauffeur</b><span class="cm-tag mais">Recommandé</span></div>
      ${pourquoi}${schema(false)}<button type="button" class="p" data-lien>${TI('lieu')}Créer le lien de suivi</button><small class="cm-lien-f">Facultatif, mais vivement conseillé pour votre sécurité et celle ${autre === 'le vendeur' ? 'du vendeur' : 'de l’acheteur'}.</small><p class="cm-err" data-liene role="alert"></p></div>`;
    return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">${IC('lieu', 18)}</span><b>Suivi prêt pour votre chauffeur</b></div>
      ${etat}${schema(!!L.code)}
      <small>Envoyez-lui le lien avant le départ, par WhatsApp ou SMS.</small>
      <div class="cm-lien-a"><button type="button" class="p" data-lps>${TI('telephone')}Envoyer au chauffeur</button><button type="button" data-lpc>Copier le lien</button></div>
      ${L.code ? `<div class="cm-ou">ou, au téléphone</div>
      <div class="cm-code"><span>Il ouvre <em>${esc(pageSuivi())}</em> et tape ce code :</span><strong aria-label="Code ${esc(L.code.split('').join(' '))}">${esc(L.code)}</strong><button type="button" data-lcc aria-label="Copier le code">Copier</button></div>` : ''}</div>`;
  }
  function lierLien(c, box) {
    const cr = box.querySelector('[data-lien]');
    if (cr) cr.onclick = async () => { cr.disabled = true; try { await N().rpc('suivi_lien_creer', { p_cmd: c.id }); lien[c.id] = await N().rpc('suivi_lien_etat', { p_cmd: c.id }).catch(() => null); peindre(); }
      catch (x) { const e = box.querySelector('[data-liene]'); if (e) e.textContent = erreurTxt(x); cr.disabled = false; } };
    const L = lien[c.id]; if (!L || !L.jeton) return;
    const url = lienURL(L.jeton), txt = 'Marché de Gros · livraison ' + (c.produit || '') + ' : ouvrez ce lien au départ et acceptez la position, le suivi démarre tout seul. ' + url + (L.code ? '\nSi le lien ne s’ouvre pas : allez sur ' + pageSuivi() + ' et tapez le code ' + L.code + '.' : '');
    const ps = box.querySelector('[data-lps]'), pc = box.querySelector('[data-lpc]');
    if (ps) ps.onclick = async () => { if (navigator.share) { try { await navigator.share({ title: 'Suivi de livraison', text: txt }); return; } catch (_) { return; } } open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); };
    const cc = box.querySelector('[data-lcc]');
    if (cc) cc.onclick = async () => { try { await navigator.clipboard.writeText(L.code); toast('Code copié', { type: 'ok', sous: 'Donnez-le à votre chauffeur : ' + L.code }); } catch (_) { toast('Code : ' + L.code, { type: 'info' }); } };
    if (pc) pc.onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié', { type: 'ok', sous: 'Collez-le dans un message à votre chauffeur.' }); } catch (_) { toast('Copie impossible', { type: 'erreur', sous: url }); } };
  }

  // créer une commande à partir d'un accord : la ville d'abord (même ville ou non), puis qui transporte
  function creer(n) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter();
    const box = bg.querySelector('.cm'), u = n.unite || 'unité', q = n.quantite_finale; box.scrollTop = 0; dernierEcran = 'creer';
    const offre = n.cible === 'offre', a = annonceDe(n), villeAnn = (a && a.city) || n.ville || '';
    const VL = window.MDGVilles ? MDGVilles.toutes().map(x => x.nom).sort((x, y) => x.localeCompare(y, 'fr')) : [];
    const cle = v => window.MDGVilles ? MDGVilles.cle(v) : String(v || '').toLowerCase();
    // schéma 87 : annonce « ville seulement » → la ville est imposée (pré-remplie et verrouillée), avec la phrase d'explication
    const aVs = a || mienne(n), VS = window.MDGVilleSeule, villeSeule = !!(aVs && aVs.villeSeule && aVs.city && VS) ? aVs.city : '';
    const optV = villeSeule ? `<input type="text" id="cmVille" value="${esc(VS.nom(villeSeule))}" readonly aria-readonly="true" aria-describedby="cmVs" class="cm-fige">`
      : VL.length ? `<select id="cmVille" required><option value="">Choisir la ville</option>${VL.map(v => `<option${!offre && cle(v) === cle(villeAnn) ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`
      : `<input type="text" id="cmVille" maxlength="80" autocomplete="off" placeholder="Ville" value="${offre ? '' : esc(villeAnn)}">`;
    const DESC = { reseau: 'L’équipe du Marché de Gros vous propose un transporteur vérifié. Son prix se convient à trois : lui, l’acheteur et le vendeur.',
      acheteur: 'L’acheteur envoie son camion ou son chauffeur. Rien à installer pour le chauffeur ; un lien de suivi est possible.',
      vendeur: 'Le vendeur livre avec son camion ou son livreur. Rien à installer pour le livreur ; un lien de suivi est possible.' };
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Suivre la <em>commande</em></h2>
      <p class="cm-sous">${esc(n.produit || '')}${q ? ' · ' + qte(q, u) : ''}${n.prix_final != null ? ' · ' + F(n.prix_final) + ' / ' + esc(u) : ''}</p>
      <form class="cm-f" novalidate>
        <label class="t" for="cmVille">${offre ? 'Ville de livraison' : 'Ville où se trouve la marchandise'}</label>
        ${optV}
        ${villeSeule ? `<div id="cmVs" style="margin-top:8px">${VS.avertir(offre ? 'offre' : 'demande', villeSeule)}</div>` : ''}
        <p class="cm-note" style="margin:6px 0 0">${offre ? 'La marchandise part de ' + esc(villeAnn || 'la ville de l’annonce') + '.' : 'Livraison à ' + esc(villeAnn || 'la ville de la demande') + '.'}</p>
        <label class="t">Qui transporte la marchandise ?</label>
        <div data-modes></div>
        <p class="cm-info" data-regle>${TI('cle')}<b>Votre livreur n’a rien à faire dans l’application</b> : ni inscription, ni code. Le vendeur glisse un <b>mot secret</b> dans la marchandise ; à la réception, l’acheteur le tape pour confirmer.</p>
        <label class="t" for="cmLv">Lieu de livraison <small style="font-weight:400;color:#5E5546">(facultatif)</small></label>
        <input type="text" id="cmLv" maxlength="120" placeholder="Quartier, marché, entrepôt…" autocomplete="off">
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Envoyer à l’autre partie</button></div>
        <p class="cm-note">L’autre partie confirme, puis chaque étape s’affiche ici avec son heure. Aucun paiement ne passe par l’application.</p>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    const f = box.querySelector('form'), err = f.querySelector('.cm-err'), vi = f.querySelector('#cmVille'), zone = f.querySelector('[data-modes]');
    const ref = v => window.MDGVilles && MDGVilles.ref ? MDGVilles.ref(v) : v;   // Cocody et Yopougon : même ville (Abidjan)
    const meme = () => { const v = vi.value.trim(); return v ? cle(ref(v)) === cle(ref(villeAnn)) : null; };
    const modes = () => {
      const tr = choixTransport(n, meme()), coche = tr.defaut;   // la ville change la règle : on repart du choix conseillé
      zone.innerHTML = (tr.info ? `<p class="cm-info">${TI('camion')}${esc(tr.info)}</p>` : '')
        + tr.modes.map(k => `<label class="cm-opt"><input type="radio" name="mode" value="${k}"${k === coche ? ' checked' : ''}><span><b>${esc(tr.lib[k] || MODES[k])}</b><small>${esc((tr.sous && tr.sous[k]) || DESC[k])}</small></span></label>`).join('')
        + (tr.bientot ? `<label class="cm-opt cm-off" aria-disabled="true"><input type="radio" name="mode" value="reseau" disabled><span><b>${MODES.reseau} <span class="cm-tag">Bientôt</span></b><small>Pas encore disponible : le réseau de transporteurs se construit. Pour l’instant, l’acheteur ou le vendeur s’occupe du transport.</small></span></label>` : '');
    };
    modes();
    vi.addEventListener(vi.tagName === 'SELECT' ? 'change' : 'input', () => { err.textContent = ''; modes(); });
    f.onsubmit = async e => {
      e.preventDefault();
      const mode = (f.querySelector('[name=mode]:checked') || {}).value, lieu = f.querySelector('#cmLv').value.trim(), ville = vi.value.trim();   // le serveur décide du mode de validation (schémas 63 et 83)
      if (!ville) { err.textContent = offre ? 'Choisissez la ville de livraison.' : 'Choisissez la ville où se trouve la marchandise.'; vi.focus(); return; }
      if (!mode) { err.textContent = 'Choisissez qui transporte.'; return; }
      if (lieu && N().texteRefus) { const r = N().texteRefus(lieu); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        // schéma 93b : l'ancienne commande_creer n'est plus ouverte aux membres (elle contournait « ville seulement »)
        const id = await N().rpc('commande_creer2', { p_nego: n.id, p_mode: mode, p_lieu: lieu || null, p_ville_arrivee: offre ? ville : null, p_ville_depart: offre ? null : ville });
        toast('Commande envoyée', { type: 'ok', sous: 'Elle démarre dès que l’autre partie la confirme.' });
        await lireListe(); await lireJournal(id); retourTxt = 'Négociation'; sel = id; vue = 'detail'; peindre();
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
  }

  // depuis une négociation conclue : ouvrir la commande si elle existe, sinon proposer de la créer
  async function depuisAccord(n) {
    if (!n || !n.id) return;
    monter(); bg.querySelector('.cm').innerHTML = window.MDGSac ? MDGSac.charge('Un instant…') : '';
    await lireListe();
    const c = liste.find(x => x.negociation_id === n.id);
    if (c) { await lireJournal(c.id); retourTxt = 'Négociation'; sel = c.id; vue = 'detail'; peindre(); } else creer(n);
  }

  async function detail(id) { retourTxt = 'Mes commandes'; sel = id; vue = 'detail'; peindre(); await lireJournal(id); peindre(); }

  function monter() {
    css(); if (bg) return;
    retourFocus = document.activeElement;
    bg = document.createElement('div'); bg.className = 'cm-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Commande');
    bg.setAttribute('data-v2', ''); bg.innerHTML = '<div class="cm" data-v2></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    // la barre d'onglets reste visible au-dessus de l'écran, « Activité » allumé (API de la coquille, sans effet si elle manque)
    if (window.MDGOnglets && MDGOnglets.montrer) try { MDGOnglets.montrer('activite', () => fermer(true)); } catch (_) {}
    // le serveur fait foi : on relit toutes les 20 s quand l'écran est visible (pas de suivi inventé entre deux lectures)
    minuteur = setInterval(rafraichir, 20000);
  }
  async function ouvrir(id, auCode) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter(); sel = id || null; vue = id ? 'detail' : 'liste'; retourTxt = 'Activité';
    if (id && window.MDGActivite) MDGActivite.noter('cmd', id);
    liste = J(KC(), []); peindre();
    await lireListe(); if (id) await lireJournal(id); peindre();
    // depuis Accueil → Alertes → Mes codes : on descend jusqu'au code
    if (auCode && bg) { const b = bg.querySelector('[data-code-bloc]'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
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

  // Accueil → Activité : la liste est relue au démarrage et à chaque retour sur l'application, même fenêtre fermée
  let fondT = 0;
  async function fond() { if (bg || document.hidden || !N() || !N().session() || Date.now() - fondT < 60000) return; fondT = Date.now(); await lireListe(); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fond(); });
  setTimeout(fond, 1500);
  function activite() {
    return J(KC(), []).filter(enCours).map(x => {
      const st = x.etat === 'a_confirmer' ? (x.cree_par_moi ? 'En attente de confirmation' : 'À confirmer') : x.etat === 'litige' ? (x.refus_le ? 'Marchandise refusée' : 'Litige en cours') : aVerifier(x) ? (x.role === 'acheteur' ? 'À vérifier' : 'Vérification par l’acheteur') : LIB[x.etape] || 'En cours';
      return { k: 'cmd', id: x.id, titre: (x.produit || 'Commande') + (x.quantite != null ? ' · ' + qte(x.quantite, x.unite) : ''), avec: x.partenaire_nom || '', role: x.role, nego: x.negociation_id || null,
        etat: x.etat === 'litige' ? 'litige' : aAgir(x) ? 'moi' : enRoute(x) ? 'route' : 'attente', route: enRoute(x), tag: st, montant: x.montant, ts: Date.parse(x.updated_at || x.maj_le || x.created_at) || 0, ouvrir: () => ouvrir(x.id) }; });
  }
  // Accueil → Alertes → « Mes codes » : les commandes où je détiens un code MAINTENANT (vendeur avant le chargement,
  // acheteur pendant le transport). Les chiffres ne sont donnés que s'ils ont été affichés pendant cette visite (gardés en mémoire seulement).
  function codes() {
    return J(KC(), []).filter(x => x.validation === 'code' && x.etat === 'en_cours').map(x => {
      const pec = x.role === 'vendeur' && ['confirmee', 'preparation'].includes(x.etape), rec = x.role === 'acheteur' && ['transport', 'transbordement', 'arrivee'].includes(x.etape);
      if (!pec && !rec) return null;
      const k = codesVus[x.id + (pec ? ':p' : ':r')], vivant = k && k.code && (!k.expire_le || Date.parse(k.expire_le) > Date.now());
      return { id: x.id, quoi: pec ? 'prise_en_charge' : 'reception', titre: (x.produit || 'Commande') + (x.quantite != null ? ' · ' + qte(x.quantite, x.unite) : ''),
        genre: pec ? 'Code de prise en charge' : 'Code de réception',
        quand: pec ? 'À donner au chauffeur au chargement' : x.etape === 'arrivee' ? 'Le chauffeur est arrivé : vérifiez, puis donnez-le' : 'À donner au chauffeur à la réception, après vérification',
        code: vivant ? k.code.slice(0, 3) + ' ' + k.code.slice(3) : '', expire: vivant && k.expire_le ? heure(k.expire_le) : '', urgent: x.etape === 'arrivee',
        ts: Date.parse(x.updated_at || x.maj_le || x.created_at) || 0, ouvrir: () => ouvrir(x.id, true) };
    }).filter(Boolean);
  }
  window.MDGCommandes = { ouvrir, depuisAccord, creer, css, aAgir: () => J(KC(), []).filter(aAgir).length, activite, codes,
    // la commande née d'une négociation (Accueil → Activité : l'accord conclu et sa commande ne font qu'une ligne)
    parNego: id => (id && J(KC(), []).find(x => x.negociation_id === id)) || null };
})();
