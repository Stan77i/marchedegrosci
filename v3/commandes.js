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
  const TI = n => `<span class="ic-t" aria-hidden="true">${IC(n, 17)}</span>`;   // petite icône dessinée devant un texte (plus d'emoji)
  const nf = (v, d) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d == null ? 0 : d }).format(v || 0);
  const F = v => nf(v) + ' F';
  const heure = t => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const signal = () => { try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} };
  const jour = t => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const quand = t => { const d = new Date(t), a = new Date(); return d.toDateString() === a.toDateString() ? 'aujourd’hui à ' + heure(t) : jour(t) + ' à ' + heure(t); };
  const ilya = t => { const m = Math.round((Date.now() - new Date(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'le ' + jour(t); };
  const unites = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const qte = (q, u) => nf(q, 2) + ' ' + esc(unites(q, u));
  const sac = (h, t) => window.MDGSac ? MDGSac.svg(h, { t }) : '';
  const toast = (t, o) => window.MDGToast ? MDGToast.dire(t, o) : (N() && N().toast && N().toast(t));
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
/* la scène : le camion, le sac dedans, la route */
.cm-scene{position:relative;height:136px;margin:4px -18px 6px;overflow:hidden;background:linear-gradient(#F3EFE4 0 72%,#E7E0CF 72%)}
.cm-route{position:absolute;left:0;right:0;bottom:22px;height:3px;background:repeating-linear-gradient(90deg,#B9AE95 0 18px,transparent 18px 34px)}
.cm-camion{position:absolute;bottom:18px;left:var(--x,8%);width:150px;height:96px;transition:left .9s cubic-bezier(.3,.8,.3,1)}
.cm-camion .sac{position:absolute;left:14px;bottom:30px;width:62px;height:62px}.cm-camion .sac svg{width:62px;height:62px}
.cm-scene.roule .cm-camion{animation:cmBob 1.4s ease-in-out infinite}.cm-scene.roule .cm-route{animation:cmRoute 1.1s linear infinite}
@keyframes cmBob{50%{transform:translateY(-2px)}}@keyframes cmRoute{to{background-position:-34px 0}}
.cm-scene.arrive .cm-camion{animation:cmArrive 1s cubic-bezier(.2,.9,.3,1.2) both}.cm-scene.arrive .sac{animation:cmSaut .6s .9s ease-out both}
@keyframes cmArrive{from{left:-40%}}@keyframes cmSaut{40%{transform:translateY(-16px) rotate(-6deg)}}
/* arrivée : repère de livraison + étiquette */
.cm-dest{position:absolute;right:10px;bottom:22px;display:flex;flex-direction:column;align-items:center;gap:2px;max-width:86px;color:#5E5546;opacity:.55}
.cm-dest.la{opacity:1;color:#10392B}
.cm-pin{display:grid;place-items:center;width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:#FFFDF8;box-shadow:0 2px 6px rgba(23,21,18,.18)}
.cm-pin svg{transform:rotate(45deg)}.cm-dest.la .cm-pin{background:#F2C230;color:#10392B}
.cm-dest small{max-width:86px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 11.5px Jost,sans-serif}
.cm-arr{position:absolute;right:10px;top:6px;text-align:right;padding:5px 10px 6px;border-radius:14px;background:#10392B;color:#F3EFE4;box-shadow:0 6px 16px rgba(16,57,43,.25)}
.cm-arr b{display:block;font:700 15px/1.1 Jost,sans-serif;color:#F2C230;white-space:nowrap}.cm-arr small{display:block;font-size:11.5px;white-space:nowrap;color:rgba(243,239,228,.82)}
.cm-arr.ok{background:#1F6B40}.cm-arr.ok b{color:#fff}
.cm-arr.pop{animation:cmPop .6s 1s cubic-bezier(.2,1.4,.4,1) both}@keyframes cmPop{from{opacity:0;transform:scale(.6) translateY(8px)}}
.cm-scene.fini .cm-route{right:60px}
.cm-scene .seul{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);width:104px;height:104px}.cm-scene .seul svg{width:104px;height:104px}
/* progression */
.cm-prog{margin:0 0 4px}
.cm-pb{height:8px;border-radius:4px;background:rgba(16,57,43,.12);overflow:hidden}.cm-pb i{display:block;height:100%;width:100%;border-radius:4px;background:linear-gradient(90deg,#10392B,#2F6B4F);transform-origin:left;transform:scaleX(var(--p,0));transition:transform .8s cubic-bezier(.3,.8,.3,1)}
.cm-et{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column}
.cm-et li{position:relative;display:grid;grid-template-columns:28px 1fr;gap:10px;padding:0 0 14px;color:#675F50}
.cm-et li::before{content:'';position:absolute;left:13px;top:24px;bottom:0;width:2px;background:rgba(16,57,43,.14)}.cm-et li:last-child::before{display:none}
.cm-et .pt{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#E7E0CF;color:#675F50;font:700 12px Jost,sans-serif;position:relative;z-index:1}
.cm-et li.fait{color:#171512}.cm-et li.fait .pt{background:#10392B;color:#F3EFE4}.cm-et li.fait::before{background:#10392B}
.cm-et li.ici .pt{background:#F2C230;color:#10392B;box-shadow:0 0 0 5px rgba(242,194,48,.28)}
.cm-et b{display:block;font-weight:600;line-height:28px}.cm-et small{display:block;font-size:12.5px;color:#5E5546;margin-top:-4px}
.cm-st{position:relative;margin:12px 0 12px;padding:14px 16px;border-radius:18px;background:#FFFDF8;color:#171512;box-shadow:0 6px 20px rgba(23,21,18,.07),inset 0 0 0 1px rgba(23,21,18,.06);overflow:hidden}

.cm-st b{display:block;font:600 18px/1.25 Jost,sans-serif}.cm-st b em{font-style:italic;font-weight:900;color:#10392B;background:linear-gradient(transparent 62%,rgba(242,194,48,.55) 62%)}
.cm-st small{display:block;margin-top:4px;color:#6B6252;font-size:13px}
.cm-tcode{margin:0 0 10px;padding:8px 12px;border-radius:12px;background:rgba(16,57,43,.08);color:#171512;font:400 13px/1.4 Jost,sans-serif}.cm-tcode b{display:inline;font:800 15px/1 Jost,sans-serif;letter-spacing:.06em;color:#10392B}.cm-garde b{display:inline;font:inherit;font-weight:800;letter-spacing:.04em}
.cm-garde{margin:-2px 0 10px;padding:8px 12px;border-radius:12px;background:#F2C230;color:#171512;font:600 14px/1.35 Jost,sans-serif}
.cm-act{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}
.cm-act button{min-height:50px;border-radius:25px;border:1px solid #10392B;background:none;color:#10392B;font:600 15.5px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:0 16px}
.cm-act button.p{background:#10392B;color:#F3EFE4}.cm-act button.m{border-color:transparent;background:none;text-decoration:underline;min-height:44px;font-weight:500}
.cm-act button:disabled{opacity:.55;cursor:default}
.cm-info{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(242,194,48,.2);font-size:13.5px}
.cm-lien{display:flex;flex-direction:column;gap:8px;margin:10px 0 4px;padding:14px;border-radius:16px;background:rgba(16,57,43,.06);border:1px solid rgba(16,57,43,.2)}
.cm-lien b{font:600 15px Jost,sans-serif}
.cm-lien-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cm-lien-h b{flex:1;min-width:0}
.cm-lien-i{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#FFFDF8;font:normal 20px/1 "Apple Color Emoji","Segoe UI Emoji",sans-serif}
.cm-lien-l{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.cm-lien-l li{display:flex;gap:8px;font-size:13.5px;line-height:1.4;color:#3B342A}
.cm-lien-l li span{flex:none;font:normal 15px/1.3 "Apple Color Emoji","Segoe UI Emoji",sans-serif}
.cm-lien-e{display:inline-flex;align-self:flex-start;padding:4px 10px;border-radius:999px;background:rgba(23,21,18,.06);font:500 13px Jost,sans-serif;color:#4A4336}.cm-lien-e.on{background:rgba(108,197,140,.2);color:#1F6B40}
.cm-lien-f{font-size:12.5px!important;color:#5E5546!important}.cm-lien small{font-size:13.5px;line-height:1.4;color:#4A4336}
.cm-lien code{display:block;padding:8px 10px;border-radius:10px;background:#FFFDF8;font:500 12.5px/1.35 Jost,sans-serif;word-break:break-all;color:#10392B}
.cm-sch{margin:2px 0 0;padding:12px 10px 10px;border-radius:14px;background:#FFFDF8;list-style:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;position:relative}
.cm-sch li{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;font:400 12.5px/1.3 Jost,sans-serif;color:#3B342A;min-width:0}
.cm-sch li:not(:last-child)::after{content:'';position:absolute;top:24px;left:calc(50% + 30px);right:calc(-50% + 30px);border-top:2px dashed rgba(16,57,43,.28)}
.cm-sch li b{font:600 13px/1.2 Jost,sans-serif;color:#10392B}
.cm-sch .ic{position:relative;width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:#10392B;color:#F2C230}
.cm-sch .ic svg{width:26px;height:26px}
.cm-sch .ic i{position:absolute;top:-6px;left:-6px;width:20px;height:20px;border-radius:50%;background:#F2C230;color:#171512;font:600 11.5px/20px Jost,sans-serif;font-style:normal}
.cm-sch li:last-child .ic{background:#F2C230;color:#10392B}.cm-sch li:last-child .ic i{background:#10392B;color:#F2C230}
.cm-sch-t{font:600 12px/1 Jost,sans-serif;letter-spacing:.04em;color:#5E5546;margin:4px 0 -2px}
.cm-ou{display:flex;align-items:center;gap:10px;font:500 12.5px Jost,sans-serif;color:#5E5546}.cm-ou::before,.cm-ou::after{content:'';flex:1;border-top:1px solid rgba(23,21,18,.14)}
.cm-code{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:#10392B;color:#F3EFE4}
.cm-code span{flex:1;min-width:0;font:400 12.5px/1.35 Jost,sans-serif;color:rgba(243,239,228,.78)}.cm-code span em{font-style:normal;color:#F3EFE4;word-break:break-all}
.cm-code strong{flex:none;font:600 24px/1 Jost,sans-serif;letter-spacing:.12em;color:#F2C230;font-variant-numeric:tabular-nums}
.cm-lien .cm-code button{flex:none;min-height:44px;padding:0 12px;border-color:rgba(243,239,228,.4);color:#F3EFE4}
.cm-lien button{min-height:44px;padding:0 16px;border-radius:22px;border:1px solid #10392B;background:none;color:#10392B;font:600 14.5px Jost,sans-serif;cursor:pointer}
.cm-lien button.p{background:#10392B;color:#FFFDF8}.cm-lien-a{display:flex;gap:8px;flex-wrap:wrap}.cm-lien-a button{flex:1 1 auto}.cm-lien-a button.p{flex-basis:100%}
.cm-info b{font-weight:600}
.cm-dl{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;margin:0 0 12px;padding:14px;border-radius:18px;background:#FFFDF8}
.cm-dl dt{color:#5E5546;font-size:13.5px}.cm-dl dd{margin:0;text-align:right;font-weight:600}
.cm-h3{margin:16px 0 8px;font:600 15px Jost,sans-serif}
.cm-j{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.cm-j li{padding:10px 12px;border-radius:14px;background:#FFFDF8;font-size:13.5px}.cm-j li b{font-weight:600}.cm-j li small{display:block;color:#5E5546;font-size:12.5px}
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
.cm-err{color:#8A2414;font-size:13.5px;margin:8px 0 0;min-height:1em}
.cm-note{margin:12px 2px 0;font-size:12.5px;color:#5E5546}
.cm-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cm-av{background:#FFFDF8;border-radius:18px;padding:14px 16px;margin:12px 0}.cm-av h3{margin:0 0 4px;font:600 17px/1.2 Jost,sans-serif}.cm-av p{margin:0 0 8px;color:#4A4336;font-size:14px}.cm-av small{color:#5E5546;font-size:12.5px}
.cm-av-e{display:flex;gap:4px;margin:6px 0 2px}.cm-av-e button{width:48px;height:48px;border:0;background:transparent;padding:6px;cursor:pointer}.cm-av-e button svg{width:100%;height:100%;fill:transparent;stroke:#7D7462;stroke-width:1.4;stroke-linejoin:round}.cm-av-e button.on svg{fill:#F2C230;stroke:#7A5A00}.cm-av-e button:focus-visible{outline:3px solid #10392B;outline-offset:1px;border-radius:10px}
.cm-av-l{min-height:20px;font-weight:600;color:#10392B!important}.cm-av-t{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#5E5546}.cm-av-t textarea{min-height:70px;padding:10px 12px;border:1px solid #D9D1BE;border-radius:12px;background:#FFF;font:400 15px/1.4 Jost,system-ui,sans-serif;color:#171512;resize:vertical}
.cm-av-f{display:inline-flex;gap:1px;vertical-align:-3px}.cm-av-f i{width:16px;height:16px}.cm-av-f svg{width:100%;height:100%;fill:transparent;stroke:#7D7462;stroke-width:1.4;stroke-linejoin:round}.cm-av-f i.on svg{fill:#F2C230;stroke:#7A5A00}
.cm-av-recu,.cm-av-fid{margin:10px 0 0!important;padding-top:10px;border-top:1px solid #ECE6D6}.cm-av-fid{color:#10392B!important;font-weight:600}
/* mot secret du vendeur */
.cm-mot{display:flex;gap:12px;align-items:flex-start;margin:0 0 12px;padding:12px 14px;border-radius:16px;background:#FFFDF8;box-shadow:inset 0 0 0 1px rgba(16,57,43,.14)}
.cm-mot>span:first-child{font:normal 22px/1 "Apple Color Emoji","Segoe UI Emoji",sans-serif}.cm-mot small{display:block;font-size:12.5px;color:#5E5546}
.cm-mot b{display:block;margin:2px 0 4px;font:800 22px/1.1 Jost,sans-serif;letter-spacing:.08em;color:#10392B}
.cm-mot.fort{background:#F2C230;box-shadow:none}.cm-mot.fort small{color:#3B2E00}
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
.cm-dp{margin:0 0 12px;padding:14px;border-radius:18px;background:rgba(16,57,43,.06);box-shadow:inset 0 0 0 1px rgba(16,57,43,.16)}
.cm-defi{display:flex;gap:8px;margin:6px 0 4px;font:600 30px/1 Jost,sans-serif;letter-spacing:.06em}.cm-defi i{font-style:normal;display:grid;place-items:center;width:46px;height:56px;border-radius:12px;background:#FFFDF8;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.2)}
.cm-dp h3{display:flex;align-items:center;gap:8px;margin:0 0 4px;font:600 16px/1.2 Jost,sans-serif}.cm-dp p{margin:4px 0;font-size:13.5px}
.cm-rf ul{margin:6px 0 0;padding:0;list-style:none;font-size:13px}.cm-rf li{padding:3px 0}
.cm-wa{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:12px 14px;border-radius:16px;background:rgba(37,211,102,.1);font-size:13.5px}.cm-wa b{font-weight:600}.cm-wa a{color:#10392B;font-weight:600}
.cm-f input[type=number]{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512}
.cm-f select{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512;accent-color:#10392B}
.cm-f input.cm-fige{background:#EFE8DA;color:#171512;font-weight:600;cursor:default}
.cm-f select:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.cm-pick{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border-radius:16px;border:2px dashed rgba(16,57,43,.35);background:#FFFDF8;color:#10392B;font:600 15px Jost,sans-serif;cursor:pointer}
.cm-pick input{position:absolute;width:1px;height:1px;opacity:0}
@media (prefers-reduced-motion:reduce){.cm-bg,.cm,.cm-camion,.cm-pb i,.cm-scene *{animation:none!important;transition:none!important}}
/* ——— la livraison : un plan en haut (la vraie carte quand le camion roule), une fiche foncée qui monte dessus (23/10/2026) ——— */
.cm-hero{position:relative;margin:4px -18px 14px}
.cm-hero .sv{margin:0;height:300px}.cm-hero .sv .sv-bas{bottom:38px}.cm-hero .sv .maplibregl-ctrl-bottom-right{bottom:110px}
.cm-plan{position:relative;height:250px;overflow:hidden;background:#ECEEE9}
.cm-plan svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.cm-plan .cm-pchip{position:absolute;left:14px;top:12px;display:inline-flex;align-items:center;gap:7px;min-height:30px;padding:0 12px;border-radius:15px;background:rgba(255,253,248,.94);color:#3F3A30;font:500 12.5px Jost,sans-serif;box-shadow:0 2px 8px rgba(23,21,18,.12)}
.cm-plan .cm-pchip i{width:7px;height:7px;border-radius:50%;background:#9AA59F}
.cm-plan .rt{stroke-dasharray:100;stroke-dashoffset:0}
@keyframes cmTrace{from{stroke-dashoffset:100}}
.cm-plan .pulse{transform-box:fill-box;transform-origin:50% 50%;animation:cmPulse 2.2s ease-out 3}
@keyframes cmPulse{0%{transform:scale(.6);opacity:.55}100%{transform:scale(2.3);opacity:0}}
.cm-plan .nav{transform-box:fill-box;transform-origin:50% 50%}
@keyframes cmNav{from{transform:scale(.3);opacity:0}}
.cm-fiche{position:relative;z-index:2;margin:-28px 0 0;padding:12px 18px 16px;border-radius:26px;background:#10392B;color:#F3EFE4;box-shadow:0 -10px 30px rgba(16,57,43,.18)}
@keyframes cmFiche{from{transform:translateY(26px);opacity:0}}
.cm-poignee{display:block;width:40px;height:4px;margin:0 auto 12px;border-radius:2px;background:rgba(243,239,228,.28)}
.cm-fiche small{display:block;color:rgba(243,239,228,.62);font:400 12.5px/1.3 Jost,sans-serif}
.cm-f1{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.cm-f1 b{display:block;margin-top:2px;font:600 22px/1.1 Jost,sans-serif;letter-spacing:.01em;font-variant-numeric:tabular-nums}
.cm-puce{flex:none;display:inline-flex;align-items:center;min-height:30px;padding:0 13px;border-radius:15px;background:rgba(243,239,228,.1);box-shadow:inset 0 0 0 1px rgba(243,239,228,.16);color:#F3EFE4;font:500 13px Jost,sans-serif;white-space:nowrap}
.cm-puce.mais{background:#F2C230;box-shadow:none;color:#10392B;font-weight:600}.cm-puce.rouge{background:rgba(226,115,91,.2);box-shadow:inset 0 0 0 1px rgba(226,115,91,.45);color:#FFD9CF}
.cm-pts{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:16px 0 4px;padding:0}
.cm-pts li{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(243,239,228,.62);font:500 11.5px/1.2 Jost,sans-serif;text-align:center}
.cm-pts li::before{content:"";position:absolute;top:10px;left:calc(-50% + 14px);right:calc(50% + 14px);border-top:2px dotted rgba(243,239,228,.3)}
.cm-pts li:first-child::before{display:none}
.cm-pts li.fait::before,.cm-pts li.ici::before{border-top-color:#F2C230;border-top-style:solid}
.cm-pts .o{position:relative;z-index:1;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;box-shadow:inset 0 0 0 2px rgba(243,239,228,.35);color:#10392B}
.cm-pts li.fait{color:#F3EFE4}.cm-pts li.fait .o{background:#F2C230;box-shadow:none}
.cm-pts li.ici{color:#F2C230;font-weight:600}.cm-pts li.ici .o{background:#10392B;box-shadow:inset 0 0 0 2px #F2C230}
.cm-pts li.ici .o::after{content:"";width:8px;height:8px;border-radius:50%;background:#F2C230;animation:cmIci 1.8s ease-in-out 3}
@keyframes cmIci{50%{transform:scale(.55);opacity:.6}}
.cm-pts li.off .o{box-shadow:inset 0 0 0 2px rgba(243,239,228,.2)}
.cm-f2{display:flex;justify-content:space-between;gap:14px;margin:14px 0 0;padding:0 0 14px;border-bottom:1px solid rgba(243,239,228,.1)}
.cm-f2 b,.cm-f3 b{display:block;margin-top:3px;font:500 15.5px/1.25 Jost,sans-serif;color:#F3EFE4;overflow-wrap:anywhere}
.cm-f2 .r{text-align:right}
.cm-f3{position:relative;min-height:150px;padding:14px 0 6px}
.cm-f3 dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 14px;width:calc(100% - 118px);margin:0}
.cm-f3 dt{color:rgba(243,239,228,.62);font:400 12.5px/1.3 Jost,sans-serif}.cm-f3 dd{margin:3px 0 0;font:500 15.5px/1.25 Jost,sans-serif;color:#F3EFE4;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.cm-f3 dd.t{color:#F2C230;font-weight:600}
.cm-prod{position:absolute;right:-12px;top:4px;width:150px;height:150px;pointer-events:none}
.cm-prod img,.cm-prod svg{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 16px 18px rgba(0,0,0,.35))}
@keyframes cmProd{from{transform:translateX(30px) rotate(6deg);opacity:0}}
@keyframes cmFlotte{50%{transform:translateY(-5px) rotate(-1.5deg)}}
.cm-pers{display:flex;align-items:center;gap:12px;margin:10px 0 0;padding:10px 10px 10px 12px;border-radius:20px;background:rgba(243,239,228,.07)}
.cm-pers .av{flex:none;width:44px;height:44px;border-radius:50%;overflow:hidden}.cm-pers .av svg{display:block;width:44px;height:44px}
.cm-pers b{display:block;font:500 15.5px/1.2 Jost,sans-serif;color:#F3EFE4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm-pers>div{flex:1;min-width:0}
.cm-pers button{flex:none;display:grid;place-items:center;width:46px;height:46px;border:0;border-radius:50%;background:#F2C230;color:#10392B;cursor:pointer;transition:transform .15s}
.cm-pers button:active{transform:scale(.94)}.cm-pers button:focus-visible{outline:2px solid #F3EFE4;outline-offset:2px}
@media (max-width:360px){.cm-f3 dl{width:calc(100% - 96px)}.cm-prod{width:124px;height:124px;right:-10px}}
@media (prefers-reduced-motion:reduce){.cm-plan *,.cm-fiche,.cm-fiche *{animation:none!important}}`;
  function css() { if (document.getElementById('cmCss')) return; const s = document.createElement('style'); s.id = 'cmCss'; s.textContent = CSS; document.head.appendChild(s); }


  const humeur = c => c.etat === 'annulee' || c.etat === 'litige' ? 'triste' : c.etat === 'terminee' ? 'plein' : navigator.onLine === false ? 'ferme' : c.etape && c.etape !== 'confirmee' && c.etape !== 'preparation' ? 'plein' : 'charge';
  const ordre = (c, J) => ETAPES.filter(([k]) => k !== 'transbordement' || c.etape === 'transbordement' || (J || []).some(e => e.evenement === 'transbordement'));
  function avance(c, J) {
    const L = ordre(c, J), i = L.findIndex(([k]) => k === c.etape);
    return c.etat === 'a_confirmer' ? 0 : i < 0 ? 0 : i / (L.length - 1);
  }

  // la livraison : plan, fiche, image du produit (23/10/2026)
  // l'image détourée du produit (sac d'aubergines, bidon d'huile, panier de poisson…) à la place d'un carton ; sinon le sac de l'application
  const sansAcc = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  function imgProduit(nom) {
    const M = window.MDG, A = window.MDGApp, n = sansAcc(nom);
    if (!n || !M || !M.products || !A || !A.SACK) return null;
    const P = M.products, nm = x => sansAcc(x.name);
    const p = P.find(x => nm(x) === n) || P.find(x => (x.aliases || []).some(a => sansAcc(a) === n))
      || P.find(x => n.startsWith(nm(x) + ' ')) || P.find(x => nm(x).startsWith(n + ' '));
    return p && A.SACK[p.slug] != null ? (A.IMG || 'v2/img/') + 'produit-' + p.slug + '.webp' : null;
  }
  // les quatre temps de la livraison, et où en est la commande (k : le point en cours ; fini : tout est fait)
  const TEMPS = ['Confirmée', 'Chargée', 'En route', 'Livrée'];
  const tempsK = c => c.etat === 'a_confirmer' ? -1 : ({ confirmee: 0, preparation: 0, chargement: 1, transport: 2, transbordement: 2, arrivee: 3, reception: 3, terminee: 3 })[c.etape] ?? 0;
  const tempsFini = c => c.etat === 'terminee' || ['reception', 'terminee'].includes(c.etape);
  function puce(c) {
    if (c.etat === 'a_confirmer') return ['À confirmer', 'mais'];
    if (c.etat === 'annulee') return ['Annulée', 'rouge'];
    if (c.etat === 'litige') return ['Litige', 'rouge'];
    if (tempsFini(c)) return [c.etat === 'terminee' ? 'Livrée' : 'Reçue', ''];
    return [({ confirmee: 'Confirmée', preparation: 'En préparation', chargement: 'Chargée', transport: 'En route', transbordement: 'Transbordement', arrivee: 'Arrivé' })[c.etape] || 'En cours', 'mais'];
  }
  // le plan dessiné (pas une carte) : une ville, une route en lacets du départ à la livraison.
  // Il ne montre aucune position : le camion est au départ tant que rien n'est chargé, à l'arrivée une fois livré.
  function plan(c) {
    const fin = tempsFini(c), mort = c.etat === 'annulee', attente = c.etat === 'a_confirmer';
    const R = 'M70 184V160Q70 148 82 148H168Q180 148 180 136V104Q180 92 192 92H298Q310 92 310 80V62';
    const blocs = [[14, 14, 86, 52], [112, 14, 70, 30], [196, 14, 92, 46], [302, 14, 84, 30], [14, 80, 40, 64], [96, 56, 70, 34], [196, 122, 92, 22], [324, 56, 62, 88], [14, 182, 40, 40], [96, 174, 70, 48], [196, 174, 112, 48], [324, 170, 62, 52], [112, 118, 54, 26]]
      .map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#E0E4DD"/>`).join('');
    const nav = (x, y, a) => `<g class="nav" transform="translate(${x} ${y})"><circle r="15" fill="#10392B" stroke="#FFFDF8" stroke-width="3"/><path d="M0 -7L6 6L0 3L-6 6Z" fill="#F2C230" transform="rotate(${a})"/></g>`;
    const route = mort ? `<path d="${R}" fill="none" stroke="#B5BBB6" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>`
      : `<path d="${R}" fill="none" stroke="#FFFDF8" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path class="rt" pathLength="100" d="${R}" fill="none" stroke="${fin ? '#A9B1AC' : '#10392B'}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"${attente ? ' stroke-dasharray="1.5 2.5" style="animation:none"' : ''}/>`;
    const dep = `<circle cx="70" cy="184" r="6.5" fill="#FFFDF8" stroke="#9AA59F" stroke-width="3"/>`;
    const arr = `<circle class="pulse" cx="310" cy="50" r="12" fill="${fin ? '#2F8A5B' : '#F2C230'}"/>` +
      `<circle cx="310" cy="50" r="12" fill="${fin ? '#2F8A5B' : '#F2C230'}" stroke="#FFFDF8" stroke-width="3"/>` +
      (fin ? `<path d="M304.5 50.5l3.8 3.8 7.4-8" fill="none" stroke="#FFFDF8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` : `<circle cx="310" cy="50" r="4" fill="#10392B"/>`);
    const camion = mort || attente ? '' : fin ? nav(310, 84, 0) : nav(70, 156, 0);
    const lab = (x, y, t, a) => `<g transform="translate(${x} ${y})"><rect x="${a === 'end' ? -8 - t.length * 6.4 : -8}" y="-12" width="${t.length * 6.4 + 16}" height="22" rx="11" fill="#FFFDF8" stroke="rgba(23,21,18,.08)"/><text x="${a === 'end' ? 0 : 0}" y="3.5" text-anchor="${a}" font-family="Jost,system-ui,sans-serif" font-size="11.5" font-weight="500" fill="#3F3A30">${esc(t)}</text></g>`;
    const court = s => { s = String(s || ''); return s.length > 22 ? s.slice(0, 21) + '…' : s; };
    const chip = mort ? 'Commande annulée' : attente ? 'Trajet prévu' : fin ? 'Livraison faite' : 'Plan · suivi par étapes';
    return `<div class="cm-plan" aria-hidden="true"><svg viewBox="0 0 400 236" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="236" fill="#ECEEE9"/>${blocs}
      <path d="M232 60Q262 66 286 60Q296 58 296 70V92Q296 108 280 106Q252 102 232 106Q218 108 218 94V74Q218 58 232 60Z" fill="#D3E2CB"/>
      <path d="M-10 128Q60 112 120 132T260 148T410 136" fill="none" stroke="#D2E2EA" stroke-width="9" stroke-linecap="round"/>
      <path d="M-10 66L410 50M58 -10L66 246M380 -10L372 246" stroke="#F7F8F5" stroke-width="7" fill="none"/>
      ${route}${dep}${arr}${camion}
      ${c.ville_depart ? lab(86, 184, court(c.ville_depart), 'start') : ''}${lab(292, 50, court(c.lieu_livraison || 'Livraison'), 'end')}
    </svg><span class="cm-pchip"><i></i>${chip}</span></div>`;
  }
  // la fiche : numéro, état, les quatre temps, d'où vers où, les chiffres, le produit, la personne en face
  function fiche(c, Jr) {
    const [lab, cl] = puce(c), k = tempsK(c), fini = tempsFini(c), mort = c.etat === 'annulee';
    const k0 = c.etat === 'a_confirmer' ? 0 : k;   // en attente de confirmation : la première étape est « en cours »
    const pts = TEMPS.map((t, i) => { const s = mort ? 'off' : fini || i < k0 ? 'fait' : i === k0 ? 'ici' : ''; if (i === 0 && c.etat === 'a_confirmer' && !mort) t = 'À confirmer';
      return `<li class="${s}"><span class="o">${s === 'fait' ? '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2.5 6.3l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>${t}</li>`; }).join('');
    const ev = n => (Jr || []).find(e => e.evenement === n);
    const fin = ev('reception') || ev('terminee'), la = ev('arrivee');
    const droite = mort ? 'Annulée' : fin ? 'Reçue le ' + jour(fin.at) : la ? 'Arrivé le ' + jour(la.at) : 'Livraison à venir';
    const img = imgProduit(c.produit);
    const autre = c.role === 'vendeur' ? 'Acheteur' : 'Vendeur';
    const avC = c.partenaire_id && window.MDGCompte && MDGCompte.avatar ? MDGCompte.avatar(c.partenaire_id, { size: 44 }) : null;
    const av = avC && avC.svg ? avC.svg : window.MDGAvatar ? MDGAvatar.svg('', { size: 44, nom: c.partenaire_nom || '?' }) : '';
    const TR = { reseau: 'Réseau Marché de Gros', acheteur: 'Par l’acheteur', vendeur: 'Par le vendeur' };
    return `<section class="cm-fiche" aria-label="Fiche de la commande"><span class="cm-poignee" aria-hidden="true"></span>
      <div class="cm-f1"><div><small>Commande</small><b>n° ${esc(c.numero || '—')}</b></div><span class="cm-puce ${cl}">${esc(lab)}</span></div>
      <ol class="cm-pts" aria-label="Avancement : ${esc(lab)}">${pts}</ol>
      <div class="cm-f2"><div><small>Créée le ${jour(c.created_at)}</small><b>${esc(c.ville_depart || 'Départ')}</b></div><div class="r"><small>${esc(droite)}</small><b>${esc(c.lieu_livraison || 'À convenir')}</b></div></div>
      <div class="cm-f3"><dl>
        <div><dt>Produit</dt><dd>${esc(c.produit || '—')}</dd></div>
        <div><dt>Quantité</dt><dd>${c.quantite != null ? qte(c.quantite, c.unite) : '—'}</dd></div>
        <div><dt>Prix convenu</dt><dd>${c.prix_unitaire != null ? F(c.prix_unitaire) + ' / ' + esc(c.unite || 'unité') : '—'}</dd></div>
        <div><dt>Total</dt><dd class="t">${c.montant != null ? F(c.montant) : '—'}</dd></div>
        <div><dt>Transport</dt><dd>${esc(TR[c.mode_transport] || '—')}</dd></div>
        <div><dt>Paiement</dt><dd>${seq[c.id] && seq[c.id].actif ? 'Séquestre' : 'À la livraison'}</dd></div>
      </dl><span class="cm-prod" aria-hidden="true">${img ? `<img src="${img}" alt="" decoding="async">` : sac(humeur(c), 150)}</span></div>
      ${c.partenaire_nom ? `<div class="cm-pers"><span class="av" aria-hidden="true">${av}</span><div><b>${esc(c.partenaire_nom)}</b><small>${autre}</small></div>${c.partenaire_id && window.MDGMessages ? `<button type="button" data-ecrire aria-label="Écrire à ${esc(c.partenaire_nom)}">${IC('messages', 20)}</button>` : ''}</div>` : ''}
    </section>`;
  }

  // état
  let lu = false, bg = null, vue = 'liste', filtre = 'cours', liste = [], journal = {}, transport = {}, lien = {}, pos = {}, carte = null, sel = null, charge = false, minuteur = null;
  const trouve = id => liste.find(x => x.id === id);
  const enRoute = c => c.etat === 'en_cours' && ['chargement', 'transport', 'transbordement', 'arrivee'].includes(c.etape);
  function oublierCarte() { if (carte && carte.api) carte.api.detruire(); carte = null; }
  let retourFocus = null;
  function fermer() { oublierCarte(); if (!bg) return; bg.remove(); bg = null; if (retourFocus && retourFocus.focus) try { retourFocus.focus({ preventScroll: true }); } catch (_) {} retourFocus = null; clearInterval(minuteur); minuteur = null; document.removeEventListener('keydown', clavier); }
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  const horsLigne = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET/i.test(String((e && e.message) || e || ''));
  const erreurTxt = e => { if (horsLigne(e)) return 'Pas de connexion : rien n’a été enregistré. Réessayez quand le réseau revient.'; const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : (window.MDGErreur ? MDGErreur(e) : (m.replace(/^[A-Z_]{4,} : /, '') || 'Réessayez dans un instant.')); };

  const seq = {};           // commande → séquestre (commande_sequestre, schémas 57-58)
  const dl = {};            // commande → délais (commande_delais, schéma 92)
  const disc = {};          // commande → discussion à trois pendant un litige (litige_messages_lire, schéma 58)
  async function lireListe() {
    if (!N() || !N().session()) return;
    liste = J(KC(), liste);
    if (navigator.onLine === false) return;
    charge = true;
    try { liste = (await N().rpc('mes_commandes2').catch(e => /schema cache|Could not find the function/i.test(String(e && e.message)) ? N().rpc('mes_commandes') : Promise.reject(e))) || []; W(KC(), liste); lu = true; try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} } catch (e) { if (bg) toast('Commandes indisponibles pour l’instant', { type: 'erreur', sous: erreurTxt(e) }); }
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
    // délais (schéma 92) : échéance de chargement, livraison déclarée, essais du mot secret ; serveur pas à jour : rien
    if (c && c.etat === 'en_cours') { const d = await N().rpc('commande_delais', { p_id: id }).catch(() => null); if (d) dl[id] = d; }
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
    const apres = sel && trouve(sel) && trouve(sel).etape;
    // rien de neuf depuis la dernière relecture : on ne redessine pas (sinon l'écran clignote et le défilement saute toutes les 20 s)
    let sig = ''; try { sig = JSON.stringify([vue, sel, filtre, liste, sel ? journal[sel] : null]); } catch (_) {}
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
    if (c.etat === 'litige') return ['Litige <em>ouvert</em>', 'L’équipe du Marché de Gros examine l’historique de la commande et les accords enregistrés.'];
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
      case 'arrivee': if (dl[c.id] && dl[c.id].reception_echeance) { const [t0, s0] = V ? ['Marchandise <em>livrée</em>', MOTM ? 'L’acheteur vérifie la marchandise, puis tape votre mot secret.' : 'L’acheteur vérifie la marchandise.']
          : ['Marchandise <em>livrée</em>', MOTM ? 'Vérifiez la quantité et la qualité, retrouvez le papier du vendeur, puis tapez son mot secret. Un problème : refusez avec des photos.' : 'Vérifiez la marchandise, puis confirmez la réception. Un problème : refusez avec des photos.'];
        return [t0, s0 + ` Échéance : ${quand(dl[c.id].reception_echeance)}. Sans réponse, l’équipe du Marché de Gros vérifie avec vous deux.`]; }
        return V ? ['Marchandise <em>arrivée</em>', MOTM ? 'L’acheteur vérifie la marchandise, puis tape votre mot secret.' : 'L’acheteur vérifie la marchandise.'] : ['Marchandise <em>arrivée</em>', MOTM ? 'Vérifiez la quantité et la qualité, retrouvez le papier du vendeur, puis tapez son mot secret pour confirmer la réception. Un problème : refusez avec des photos. Après la réception, vous avez 1 h pour réclamer.' : 'Vérifiez la marchandise et le papier du vendeur avant de confirmer la réception. Un problème : refusez avec des photos. Après la réception, vous avez 1 h pour réclamer.'];
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
        const K = c.validation === 'code';
        // schéma 90 : pas de chargement sans les photos du colis et le poids
        const SD = seq[c.id], DEP = !!(SD && SD.depart && (SD.depart.mot_ok || !SD.mot));
        if (c.role === 'vendeur' && c.etape === 'confirmee') { b('preparation', 'En préparation', 'p'); if (!DEP) b('depart', TI('photo') + 'Photographier le colis'); else if (!K) b('chargement', 'Chargement confirmé'); }
        if (c.role === 'vendeur' && c.etape === 'preparation') { if (!DEP) b('depart', TI('photo') + 'Photographier le colis', 'p'); else if (!K) b('chargement', 'Chargement confirmé', 'p'); }
        // schéma 65 : avec son propre transporteur, « Chargée » attend « Le camion est parti » (vendeur, ou celui qui transporte)
        const PARTI = !K && c.etape === 'chargement' && c.mode_transport !== 'reseau' && (c.role === 'vendeur' || c.role === c.mode_transport);
        if (PARTI) b('transport', TI('camion') + 'Le camion est parti', 'p');
        // schéma 92 : l'acheteur dit «\u00a0La marchandise est arrivée\u00a0» (le transporteur n'est souvent pas dans l'application) ;
        // le vendeur peut aussi déclarer «\u00a0Marchandise livrée\u00a0», une fois, pour lancer le délai si l'acheteur se tait
        const DL = dl[c.id];
        if (c.role === 'acheteur' && (['transport', 'transbordement'].includes(c.etape) || (!K && c.etape === 'chargement'))) b('arrivee', 'La marchandise est arrivée', c.etape === 'chargement' ? '' : 'p');
        if (c.role === 'vendeur' && (DL ? DL.peut_declarer_arrivee : ['transport', 'transbordement'].includes(c.etape)) && ['transport', 'transbordement', 'arrivee'].includes(c.etape)) b('arrivee', TI('camion') + 'Marchandise livrée', c.etape === 'arrivee' ? 'm' : '');
        if (c.role === 'acheteur' && !K && ['chargement', 'transport', 'transbordement'].includes(c.etape)) b('reception', 'Réception confirmée');
        if (c.role === 'acheteur' && DL && DL.peut_annuler_retard && ['confirmee', 'preparation'].includes(c.etape)) b('retard', 'Annuler : le vendeur n’a pas chargé à temps', 'm');
        if (c.role === 'acheteur' && c.etape === 'arrivee' && !K) b('reception', 'Réception confirmée', 'p');
        if (['transport', 'transbordement'].includes(c.etape)) b('transbordement', 'Signaler un transbordement', 'm');
        // commande confirmée : seul le vendeur peut demander l'annulation (l'acheteur peut l'accepter), avant le chargement
        if (c.role === 'vendeur' && ['confirmee', 'preparation'].includes(c.etape) && c.annulation !== 'moi' && !(DL && DL.peut_redemander === false)) b('annuler', 'Demander l’annulation', 'm');
      }
      // schéma 92 : un problème se signale dès la confirmation
      if (['confirmee', 'preparation', 'chargement', 'transport', 'transbordement', 'arrivee', 'reception'].includes(c.etape)) b('litige', 'Signaler un problème', 'm');
      // une fois la commande confirmée, l'acheteur ne peut plus l'annuler seul : seulement d'un commun accord, avant le chargement
    }
    const S = seq[c.id];
    if (c.role === 'acheteur' && (S ? S.peut_liberer : aVerifier(c))) b('liberer', 'Tout est conforme', 'p');
    if (c.role === 'acheteur' && (S ? S.peut_refuser : dansDelai(c))) b('refuser', 'Refuser la marchandise');
    if (c.role === 'acheteur' && c.etat === 'terminee' && aVerifier(c)) b('litige', 'Pas de papier ? Signaler un problème', 'm');
    if (S && S.peut_repondre) { b('rf-oui', 'Je reconnais le problème', 'p'); b('rf-non', 'Je conteste'); }
    return B.length ? `<div class="cm-act">${B.join('')}</div>` : '';
  }
  function peindreDetail(change) {
    const c = trouve(sel), box = bg.querySelector('.cm');
    // commande pas encore en mémoire (notification touchée) : on attend la réponse du serveur avant de revenir à la liste
    if (!c) { if (!lu && navigator.onLine !== false) { box.innerHTML = window.MDGSac ? MDGSac.charge('La commande arrive…') : ''; return; } vue = 'liste'; return peindreListe(); }
    const Jr = journal[c.id] || [], L = ordre(c, Jr), [titre, sous] = prochaine(c);
    const der = Jr.length ? Jr[Jr.length - 1].at : c.updated_at;
    const fait = k => Jr.find(e => e.evenement === k);
    const iEt = L.findIndex(([k]) => k === c.etape);
    const etapes = L.map(([k, l], i) => { const e = fait(k), f = c.etat !== 'a_confirmer' && i <= iEt;
      if (k === 'terminee' && (c.liberation || c.libere_le)) l = 'Commande clôturée';   // reçue, puis close après l'heure de vérification
      return `<li class="${f ? 'fait' : ''}${i === iEt && c.etat === 'en_cours' ? ' ici' : ''}"><span class="pt">${f ? '✓' : i + 1}</span><span><b>${esc(l)}</b>${e ? `<small>${quand(e.at)} · ${esc(PREUVE[e.preuve] || '')}${e.lieu ? ' · ' + esc(e.lieu) : ''}</small>` : ''}</span></li>`; }).join('');
    const arrive = change === 'arrivee';
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${esc(c.produit || 'Commande')}</h2>
      <p class="cm-sous">${c.role === 'vendeur' ? 'Vente à' : 'Achat chez'} ${esc(c.partenaire_nom)} · n° ${esc(c.numero)}</p>
      <div class="cm-hero">${enRoute(c) && window.MDGSuivi ? `<div data-carte></div>
        <p class="cm-sr" aria-live="polite">${esc(MDGSuivi.texte(pos[c.id]).t)}</p>` : plan(c)}${fiche(c, Jr)}</div>
      <div class="cm-st" role="status" aria-live="polite"><b>${titre}</b>${sous ? `<small>${esc(sous)}</small>` : ''}<small>Dernière actualisation : ${ilya(der)}</small></div>
      ${actions(c)}
      ${c.etat === 'terminee' && c.role === 'acheteur' && window.MDGRacheter ? `<div class="cm-act"><button type="button" class="p" data-racheter>Racheter · prix du jour</button></div>` : ''}
      ${blocDepart(c)}${blocMot(c)}${blocRefus(c)}${blocDisc(c)}${blocSequestre(c)}${c.etat === 'litige' || seq[c.id] && seq[c.id].refus ? blocWa(c) : ''}
      ${blocAvis(c)}
      ${c.validation === 'declaration' && c.mode_transport !== 'reseau' && ['a_confirmer', 'en_cours'].includes(c.etat) ? `<p class="cm-info"><b>Réception avec le mot secret du vendeur.</b> Le vendeur glisse un mot secret dans la marchandise ; à l’arrivée, l’acheteur le retrouve et le tape pour confirmer la réception. Le transporteur n’a rien à faire dans l’application.</p>` : ''}
      ${blocCode(c)}
      ${blocTransport(c)}${blocLien(c)}
      <ol class="cm-et">${etapes}</ol>
      <dl class="cm-dl">
        ${c.role === 'vendeur' && c.commission_montant != null ? (() => { const clos = c.etat === 'terminee' && !aVerifier(c), k = seq[c.id] && seq[c.id].repartition ? seq[c.id].repartition.vendeur_commission : c.commission_montant;
          return `<dt>${c.etat === 'annulee' ? 'Commission (3,5 %) annulée' : c.etat === 'litige' ? 'Commission (3,5 %) suspendue' : clos ? 'Commission calculée (3,5 %)' : 'Commission prévue (3,5 %)'}</dt><dd>${c.etat === 'annulee' ? '0 F' : F(clos ? k : c.commission_montant)}<br><small style="font-weight:400;color:#5E5546">${c.etat === 'annulee' ? 'commande annulée : rien n’est dû' : clos ? 'rien n’est prélevé ni réclamé : pas encore de paiement dans l’application' : 'calculée à la clôture · rien n’est prélevé'}</small></dd>`; })() : ''}
        ${ddTransport(c)}
        <dt>Paiement</dt><dd>${seq[c.id] && seq[c.id].actif ? 'Séquestre ' + esc(OPE[seq[c.id].operateur] || '') : 'À la livraison<br><small style="font-weight:400;color:#5E5546">séquestre en construction</small>'}</dd>
      </dl>
      ${Jr.length ? `<h3 class="cm-h3">Historique</h3><ul class="cm-j">${Jr.slice().reverse().map(e => `<li><b>${esc(evLib(e))}</b> · ${esc(e.par_moi ? 'vous' : ROLE[e.role] || '')}<small>${quand(e.at)} · ${esc(PREUVE[e.preuve] || '')}${e.lieu ? ' · ' + esc(e.lieu) : ''}${e.lat != null ? ' · position jointe' : ''}</small>${e.note ? `<small>« ${esc(e.note)} »</small>` : ''}</li>`).join('')}</ul>` : ''}
      <button type="button" class="cm-act" style="all:unset;display:block;margin:16px auto 0;padding:10px;min-height:44px;box-sizing:border-box;color:#10392B;text-decoration:underline;cursor:pointer" data-retour>Toutes mes commandes</button>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-retour]').onclick = () => { oublierCarte(); sel = null; vue = 'liste'; peindre(); };
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => geste(c, b.dataset.g));
    const rb = box.querySelector('[data-racheter]'); if (rb) rb.onclick = () => { fermer(); MDGRacheter.ouvrir(c.id); };
    const ec = box.querySelector('[data-ecrire]'); if (ec) ec.onclick = () => { fermer(); MDGMessages.ecrire(c.partenaire_id, { nom: c.partenaire_nom }); };
    lierTransport(c, box); lierTrois(c, box); lierLien(c, box); lierCode(c, box); lierAvis(c, box); placerCarte(c, box); photos(box); lierDisc(c, box);
    if (arrive) { if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (_) {} toast('Le chauffeur est arrivé', { type: 'ok', sous: c.role === 'acheteur' ? 'Vérifiez la marchandise avant de confirmer.' : esc(c.produit || '') }); }
  }
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
        : 'Pour l’instant : <b>paiement à la livraison</b>, entre vous, après avoir vu la marchandise. Aucun argent ne passe par l’application et rien n’est prélevé. Plus tard, le séquestre : l’acheteur paiera dans l’application dès la confirmation, jamais à une personne, et l’argent restera bloqué jusqu’à ce qu’il valide (ou 1 h après la réception sans réclamation).'}</p></section>`;
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
  // le colis au départ (schéma 90) : photos et poids du vendeur, vus par l'acheteur, le transporteur et l'équipe
  function blocDepart(c) {
    const S = seq[c.id], D = S && S.depart;
    if (!D) return c.role === 'vendeur' && c.etat === 'en_cours' && ['confirmee', 'preparation'].includes(c.etape)
      ? `<section class="cm-dp"><h3>${TI('photo')}Le colis au départ</h3><p>Avant le chargement : 2 à 4 photos du colis emballé et son poids. Sans elles, le chargement ne peut pas être confirmé.</p></section>` : '';
    return `<section class="cm-dp" aria-label="Le colis au départ"><h3>${TI('photo')}Le colis au départ</h3>
      <div class="cm-ph">${(D.photos || []).map(x => `<span data-ph="${esc(x)}" role="img" aria-label="Photo du colis au départ"></span>`).join('')}</div>
      <p><b>${esc(String(D.poids_kg).replace('.', ','))} kg</b> pesés · photographié ${quand(D.le)}</p>
      ${D.mot_photo ? `<p style="margin-top:10px"><b>Papier du mot secret</b> (équipe seulement) · code ${esc(D.defi || '')} · mot ${esc(S.mot || '')}</p><div class="cm-ph"><span data-ph="${esc(D.mot_photo)}" role="img" aria-label="Photo du papier du mot secret"></span></div>`
        : D.mot_ok && c.role === 'vendeur' ? '<p>✓ Papier du mot secret photographié (vu seulement par l’équipe)</p>' : ''}</section>`;
  }
  // le vendeur photographie le colis emballé et indique le poids, avant le chargement
  function depart(c) {
    const box = bg.querySelector('.cm'); box.scrollTop = 0; dernierEcran = 'geste';
    const fichiers = [], S0 = seq[c.id]; let papier = null;
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Le colis au <em>départ</em></h2><p class="cm-sous">${esc(c.produit || '')} · ${esc(c.partenaire_nom)} · n° ${esc(c.numero)}</p>
      <form class="cm-f" novalidate>
        <span class="t" style="display:block;margin:4px 0 6px;font-weight:600">Photos du colis emballé (2 à 4)</span>
        <div class="cm-ph" data-apercu></div>
        <label class="cm-pick">${TI('photo')}Ajouter des photos<input type="file" accept="image/*" multiple data-fic></label>
        ${S0 && S0.mot ? `<span class="t" style="display:block;margin:14px 0 6px;font-weight:600">Le papier du mot secret</span>
        <p class="cm-note" style="font-size:13.5px;margin-top:0">Ayez le papier et un stylo en main. Touchez « Afficher le code » : vous aurez <b>3 minutes</b> pour l’écrire à côté du mot secret et photographier le papier. Seule l’équipe du Marché de Gros verra cette photo.</p>
        <div data-motz><button type="button" class="cm-pick" data-motgo style="width:100%">Afficher le code</button></div>` : ''}
        <label class="t" for="cmDp">Poids pesé (kg)</label>
        <input type="number" id="cmDp" inputmode="decimal" min="0" step="any" placeholder="Ex. : 200">
        <p class="cm-note" style="font-size:13.5px">Montrez la marchandise propre et bien emballée. L’acheteur et le transporteur verront ces photos : en cas de réclamation, elles servent de preuve.</p>
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Enregistrer</button><button type="button" data-ann>Retour</button></div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err'), ap = f.querySelector('[data-apercu]');
    const apercu = () => { ap.innerHTML = fichiers.map((b, i) => `<span><img src="${URL.createObjectURL(b)}" alt="Photo ${i + 1}"></span>`).join(''); };
    f.querySelector('[data-fic]').onchange = async e => {
      err.textContent = ''; f._chemins = null;
      for (const fi of Array.from(e.target.files || [])) {
        if (fichiers.length >= 4) { err.textContent = '4 photos au plus.'; break; }
        try { fichiers.push(await reduirePhoto(fi)); } catch (x) { err.textContent = x.message; }
      }
      e.target.value = ''; apercu();
    };
    // le papier du mot secret (schéma 90b) : code au hasard à la demande, 3 minutes pour envoyer la photo
    const zm = f.querySelector('[data-motz]'); let chrono = null;
    const motCode = async () => {
      clearInterval(chrono); zm.innerHTML = '<p class="cm-note">…</p>';
      let k; try { k = await N().rpc('commande_depart_defi', { p_id: c.id }); } catch (x) { zm.innerHTML = `<p class="cm-err">${esc(erreurTxt(x))}</p><button type="button" class="cm-pick" data-motgo style="width:100%">Afficher le code</button>`; zm.querySelector('[data-motgo]').onclick = motCode; return; }
      const fin = Date.now() + 180000;
      zm.innerHTML = `<div class="cm-defi" aria-label="Code ${esc(k)}">${String(k).split('').map(x => `<i>${esc(x)}</i>`).join('')}</div>
        <p class="cm-note" data-reste aria-live="off" style="margin:4px 0 8px">Reste 3:00</p>
        <label class="cm-pick">${TI('photo')}Photographier le papier<input type="file" accept="image/*" capture="environment" data-ficmot></label>`;
      const rz = zm.querySelector('[data-reste]');
      chrono = setInterval(() => { if (!rz.isConnected) return clearInterval(chrono); const t = Math.max(0, Math.round((fin - Date.now()) / 1000));
        rz.textContent = 'Reste ' + Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
        if (!t) { clearInterval(chrono); zm.innerHTML = '<p class="cm-err">Temps écoulé.</p><button type="button" class="cm-pick" data-motgo style="width:100%">Nouveau code</button>'; zm.querySelector('[data-motgo]').onclick = motCode; } }, 1000);
      zm.querySelector('[data-ficmot]').onchange = async e => { const fi = e.target.files && e.target.files[0]; e.target.value = ''; if (!fi) return;
        err.textContent = 'Envoi de la photo du papier…';
        try { const ph = await reduirePhoto(fi), ch = me() + '/motpapier-' + c.id.slice(0, 8) + '-' + Date.now() + '.jpg';
          await N().deposerPrive('preuves', ch, ph); await N().rpc('commande_depart_mot', { p_id: c.id, p_photo: ch });
          clearInterval(chrono); papier = ch; err.textContent = '';
          zm.innerHTML = `<div class="cm-ph"><span><img src="${URL.createObjectURL(ph)}" alt="Photo du papier"></span></div><p class="cm-note" style="margin:4px 0">✓ Papier envoyé à l’équipe</p>`;
        } catch (x) { err.textContent = erreurTxt(x); } };
    };
    if (zm) zm.querySelector('[data-motgo]').onclick = motCode;
    f.onsubmit = async e => {
      e.preventDefault();
      const pv = f.querySelector('#cmDp').value.trim(), poids = Number(pv.replace(',', '.'));
      if (fichiers.length < 2) { err.textContent = 'Ajoutez au moins 2 photos du colis emballé.'; return; }
      if (zm && !papier) { err.textContent = 'Photographiez le papier du mot secret, avec le code écrit à côté.'; return; }
      if (!(poids > 0)) { err.textContent = 'Indiquez le poids pesé, en kilos.'; f.querySelector('#cmDp').focus(); return; }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = 'Envoi des photos…';
      try {
        const u = me(), chemins = [];
        if (!f._chemins) { for (let i = 0; i < fichiers.length; i++) { const ch = u + '/depart-' + c.id.slice(0, 8) + '-' + Date.now() + '-' + i + '.jpg'; await N().deposerPrive('preuves', ch, fichiers[i]); chemins.push(ch); } f._chemins = chemins; }
        err.textContent = '';
        await N().rpc('commande_depart_preuves', { p_id: c.id, p_photos: f._chemins, p_poids_kg: poids });
        await lireJournal(c.id);
        toast('Colis enregistré', { type: 'ok', sous: 'Vous pouvez confirmer le chargement.' });
        peindre();
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
  }
  // le mot secret : le vendeur l'écrit sur un papier glissé dans la marchandise ; l'acheteur le retrouve à l'arrivée
  function blocMot(c) {
    const S = seq[c.id]; if (!S || !S.mot || c.role !== 'vendeur' || !['en_cours', 'litige'].includes(c.etat)) return '';
    const avant = c.etat === 'en_cours' && ['confirmee', 'preparation'].includes(c.etape);
    return `<section class="cm-mot${avant ? ' fort' : ''}" aria-label="Mot secret à glisser dans la marchandise">${TI('crayon')}<span>
      <small>Mot secret à glisser dans la marchandise</small><b>${esc(S.mot)}</b>
      <small>${avant ? 'Écrivez-le sur un papier et mettez-le dans le colis avant le chargement. À l’arrivée, l’acheteur le retrouve et le tape pour confirmer la réception : c’est la preuve que c’est bien votre marchandise qui est arrivée. Ne le donnez à personne, ni par message.' : 'Il est dans la marchandise. Ne le donnez à personne.'}</small></span></section>`;
  }
  // la discussion à trois (acheteur, vendeur, Marché de Gros) pendant un litige
  const ROLE_D = { acheteur: 'Acheteur', vendeur: 'Vendeur', admin: 'Marché de Gros' };
  function blocDisc(c) {
    const D = disc[c.id]; if (!D || (!D.ouvert && !(D.messages || []).length)) return '';
    const L = (D.messages || []).map(m => `<li class="${m.moi ? 'moi' : ''}${m.role === 'admin' ? ' mdg' : ''}"><b>${m.moi ? 'Vous' : esc(ROLE_D[m.role] || '')}</b> <small>${quand(m.at)}</small><span>${esc(m.texte)}</span></li>`).join('');
    return `<section class="cm-disc" aria-label="Discussion à trois"><h3>Discussion à trois</h3>
      <p>L’acheteur, le vendeur et l’équipe du Marché de Gros. Expliquez-vous ici : l’équipe juge avec les photos, le mot du vendeur, la négociation et tous vos messages (rien n’est secret sur le Marché de Gros).</p>
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
      : `<div class="cm-wa">${TI('messages')}<span><b>Service litiges WhatsApp : bientôt.</b> Gardez votre numéro de commande <b>${esc(c.numero)}</b> : il suffit pour retrouver l’accord, la négociation et vos messages. Nous ne demandons jamais d’argent ni de code.</span></div>`;
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
    const box = bg.querySelector('.cm'); box.scrollTop = 0; dernierEcran = 'geste';
    const fichiers = [];
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Refuser la <em>marchandise</em></h2><p class="cm-sous">${esc(c.produit || '')} · ${esc(c.partenaire_nom)} · n° ${esc(c.numero)}</p>
      <form class="cm-f" novalidate>
        <label class="t" for="cmRq">Quantité refusée</label>
        <input type="number" id="cmRq" inputmode="decimal" min="0" step="any" ${c.quantite != null ? `max="${c.quantite}" value="${c.quantite}"` : ''}>
        <small style="display:block;margin-top:4px;color:#5E5546;font-size:12.5px">Sur ${c.quantite != null ? qte(c.quantite, c.unite) : 'la commande'}. Laissez tout si toute la marchandise est mauvaise.</small>
        <label class="t" for="cmRm">Qu’est-ce qui ne va pas ?</label>
        <textarea id="cmRm" maxlength="300" placeholder="Ex. : 4 régimes pourris, sacs mouillés, quantité manquante…"></textarea>
        ${seq[c.id] && seq[c.id].avec_mot ? `<label class="t" for="cmRw">Le mot écrit sur le papier du vendeur</label>
        <input type="text" id="cmRw" autocomplete="off" autocapitalize="characters" placeholder="Ex. : MANGUE 47">
        <small style="display:block;margin-top:4px;color:#5E5546;font-size:12.5px">Obligatoire : c’est la preuve que vous avez bien reçu le colis du vendeur. Pas de papier ? Revenez en arrière et touchez « Signaler un problème » : l’équipe jugera.</small>` : ''}
        <span class="t" style="display:block;margin:14px 0 6px;font-weight:600">Photos (1 à 4) : la marchandise, et le papier du vendeur</span>
        <div class="cm-ph" data-apercu></div>
        <label class="cm-pick">${TI('photo')}Ajouter des photos<input type="file" accept="image/*" multiple data-fic></label>
        <p class="cm-note" style="font-size:13.5px">Pas de refus sans preuves réelles : le mot du vendeur et des photos. Vos photos sont comparées à celles du colis au départ. Le vendeur verra vos photos et répondra. S’il reconnaît le problème, la partie refusée n’est pas due. Sinon, on en discute à trois et l’équipe du Marché de Gros juge. Le transport reste dû : le chauffeur a fait son travail.</p>
        <p class="cm-err" role="alert"></p>
        <div class="cm-act" style="margin-top:14px"><button type="submit" class="p">Envoyer le refus</button><button type="button" data-ann>Retour</button></div>
      </form>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-ann]').onclick = () => peindre();
    const f = box.querySelector('form'), err = f.querySelector('.cm-err'), ap = f.querySelector('[data-apercu]');
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
        if (r === 'mot_bloque') { err.textContent = 'Trop d’essais faux. Revenez en arrière et touchez « Signaler un problème » : l’équipe du Marché de Gros jugera.'; btn.disabled = false; return; }
        if (String(r).startsWith('mot_incorrect')) { const n = String(r).split(':')[1]; err.textContent = `Ce n’est pas le mot du vendeur. Vérifiez le papier (il reste ${n} essai${n > 1 ? 's' : ''}).`; btn.disabled = false; return; }
        await lireListe(); await lireJournal(c.id);
        toast('Refus envoyé', { type: 'ok', sous: 'Le vendeur est prévenu. La discussion à trois est ouverte.' });
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
  function blocAvis(c) {
    if (c.etat !== 'terminee') return '';
    const a = avis[c.id]; if (!a) return '';
    const qui = c.role === 'vendeur' ? 'l’acheteur' : 'le vendeur', ens = +a.ensemble || 0;
    const fid = ens >= 2 ? `<p class="cm-av-fid">${ens}<sup>e</sup> commande terminée ensemble avec ${esc(String(c.partenaire_nom || '').replace(/\.$/, ''))}.</p>` : '';
    const recu = a.recu ? `<p class="cm-av-recu">${esc(c.partenaire_nom)} vous a donné ${etoilesFixes(a.recu.note)}${a.recu.texte ? ' · « ' + esc(a.recu.texte) + ' »' : ''}</p>` : '';
    if (!a.peut) return a.note ? `<section class="cm-av"><h3>Votre avis sur ${esc(c.partenaire_nom)}</h3><p>${etoilesFixes(a.note)} ${esc(LIBA[a.note])}${a.texte ? '<br>« ' + esc(a.texte) + ' »' : ''}</p><small>Figé : un avis ne se modifie plus après 24 heures.</small>${recu}${fid}</section>`
      : (recu || fid ? `<section class="cm-av">${recu}${fid}</section>` : '');
    const n = avisNote[c.id] || a.note || 0;
    return `<section class="cm-av"><h3>${a.note ? 'Votre avis sur' : 'Notez'} ${esc(c.partenaire_nom)}</h3>
      <p>Votre note compte pour sa réputation de ${c.role === 'vendeur' ? 'acheteur' : 'vendeur'}. ${a.note ? 'Vous pouvez la corriger jusqu’à ' + heure(a.modifiable_jusqua) + ' (' + jour(a.modifiable_jusqua) + ').' : 'Corrigeable pendant 24 heures, puis figée.'}</p>
      <div class="cm-av-e" role="radiogroup" aria-label="Note de ${qui}">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="${i === n}" aria-label="${i} étoile${i > 1 ? 's' : ''}" data-av="${i}" class="${i <= n ? 'on' : ''}">${ETOILE}</button>`).join('')}</div>
      <p class="cm-av-l" aria-live="polite">${esc(LIBA[n] || '')}</p>
      <label class="cm-av-t"><span>Un mot (facultatif)</span><textarea maxlength="300" data-av-t placeholder="Qualité, quantité, ponctualité, respect du prix…">${esc(a.texte || '')}</textarea></label>
      <p class="cm-err" data-av-err role="alert"></p>
      <div class="cm-act"><button type="button" class="p" data-av-ok ${n ? '' : 'disabled'}>${a.note ? 'Corriger mon avis' : 'Publier mon avis'}</button></div>${recu}${fid}</section>`;
  }
  function lierAvis(c, box) {
    box.querySelectorAll('[data-av]').forEach(b => b.onclick = () => {
      const n = +b.dataset.av; avisNote[c.id] = n;
      box.querySelectorAll('[data-av]').forEach(x => { x.classList.toggle('on', +x.dataset.av <= n); x.setAttribute('aria-checked', String(+x.dataset.av === n)); });
      const l = box.querySelector('.cm-av-l'); if (l) l.textContent = LIBA[n]; const ok = box.querySelector('[data-av-ok]'); if (ok) ok.disabled = false;
    });
    const ok = box.querySelector('[data-av-ok]'); if (!ok) return;
    ok.onclick = async () => {
      const n = avisNote[c.id] || (avis[c.id] && avis[c.id].note), t = box.querySelector('[data-av-t]').value.trim(), err = box.querySelector('[data-av-err]');
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
  const REGLE = { inclus: 'Compris dans le prix', a_part: 'Le vendeur livre · transport à part', livreur_vendeur: 'Le vendeur organise son livreur', retrait: 'L’acheteur vient chercher', acheteur: 'Transport à la charge de l’acheteur', mgci: 'Transporteur du réseau Marché de Gros' };
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
    if (vue === 'detail' && sel) peindreDetail(change); else peindreListe();
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
  function confirmer(c, o) {
    const box = bg.querySelector('.cm'); box.scrollTop = 0; dernierEcran = 'geste';
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>${o.titre}</h2><p class="cm-sous">${esc(c.produit || '')} · ${esc(c.partenaire_nom)}</p>
      <form class="cm-f" novalidate>
        ${o.mot ? `<label class="t" for="cmM">Mot secret du vendeur</label>
        <p class="cm-note" style="margin:-2px 0 8px;font-size:13.5px">Il est écrit sur le papier que le vendeur a glissé dans la marchandise (par exemple « MANGUE 47 »).</p>
        <input type="text" id="cmM" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="MANGUE 47" style="font:700 22px Jost,sans-serif;letter-spacing:.08em;text-transform:uppercase"${o.essais === 0 ? ' disabled' : ''}>
        ${o.essais != null ? `<p class="cm-note" style="margin:6px 0 0;font-size:13px">${o.essais === 0 ? 'Mot secret bloqué après trop d’essais faux. L’équipe est prévenue.' : `Essais restants <span class="nbul">${o.essais}</span>`}</p>` : ''}
        <label class="cm-ck"><input type="checkbox" id="cmS"> Je ne trouve pas le papier du vendeur</label>
        <p class="cm-info" data-sans hidden>Sans le mot, la réception est notée « sans le mot secret du vendeur », visible du vendeur et de l’équipe. Si la marchandise ne va pas, ne confirmez pas : <b>refusez-la avec des photos</b>.</p>` : ''}
        ${o.motifs ? `<fieldset class="cm-motif"><legend class="t">Motif</legend>${MOTIFS.map(([k, t]) => `<label class="cm-ck"><input type="radio" name="cmMot" value="${k}"> ${t}</label>`).join('')}</fieldset>` : ''}
        ${o.accord ? `<p class="cm-info" data-motif>Motif donné : …</p><fieldset class="cm-motif"><legend class="t">Êtes-vous d’accord avec ce motif ?</legend>
          <label class="cm-ck"><input type="radio" name="cmAcc" value="1"> Oui, d’un commun accord</label>
          <label class="cm-ck"><input type="radio" name="cmAcc" value="0"> J’accepte, mais je ne suis pas d’accord</label></fieldset>
          <p class="cm-note" style="font-size:13.5px">D’un commun accord, l’annulation ne compte contre personne. Sinon, elle compte dans la fiabilité de l’autre partie, qui peut la contester.</p>` : ''}
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
    const Sm = f.querySelector('#cmS'); if (Sm) Sm.onchange = () => { f.querySelector('[data-sans]').hidden = !Sm.checked; f.querySelector('#cmM').disabled = Sm.checked; };
    f.onsubmit = async e => {
      e.preventDefault();
      const L = f.querySelector('#cmL'), Nt = f.querySelector('#cmN'), G = f.querySelector('#cmG'), M = f.querySelector('#cmM');
      const lieu = L ? L.value.trim() : null, note = Nt ? Nt.value.trim() : null, mot = M ? M.value.trim() : null, sansMot = !!(Sm && Sm.checked);
      const mo = f.querySelector('[name=cmMot]:checked'), motif = mo ? mo.value : null, ac = f.querySelector('[name=cmAcc]:checked'), accord = ac ? ac.value === '1' : null;
      if (o.motifs && !motif) { err.textContent = 'Choisissez un motif.'; f.querySelector('[name=cmMot]').focus(); return; }
      if (o.motifs && motif === 'autre' && !(note && note.length >= 3)) { err.textContent = 'Motif « Autre » : écrivez quelques mots.'; Nt.focus(); return; }
      if (o.accord && accord == null) { err.textContent = 'Dites si vous êtes d’accord avec le motif.'; f.querySelector('[name=cmAcc]').focus(); return; }
      if (o.mot && !sansMot && !mot) { err.textContent = 'Tapez le mot secret écrit sur le papier du vendeur.'; M.focus(); return; }
      if (o.lieuRequis && !lieu) { err.textContent = 'Indiquez le lieu.'; L.focus(); return; }
      if (o.noteRequise && !note) { err.textContent = 'Expliquez en quelques mots.'; Nt.focus(); return; }
      if (N().texteRefus) { const r = N().texteRefus((lieu || '') + ' ' + (note || '')); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        const pos = await position(G && G.checked);
        await o.fn({ lieu, note, pos, mot, sansMot, motif, accord });
        await lireListe(); await lireJournal(c.id);
        if (o.fait) toast(o.fait, { type: 'ok' });
        if (window.MDGSons && MDGSons.signal) try { MDGSons.signal('accord'); } catch (_) {}
        peindre(o.etape);
      } catch (x) { err.textContent = erreurTxt(x); btn.disabled = false; }
    };
    const premier = f.querySelector('input[type=text],textarea'); if (premier && matchMedia('(hover:hover)').matches) premier.focus();
    // le motif donné par celui qui demande l'annulation (schéma 84), lu sur le serveur
    const zm = f.querySelector('[data-motif]');
    if (zm) N().rpc('commande_annulation_motif', { p_id: c.id }).then(m => { if (!zm.isConnected) return; const t = m && m.motif ? (MOTIF_NOM[m.motif] || m.motif) + (m.texte ? ' : « ' + m.texte + ' »' : '') : 'non précisé';
      zm.innerHTML = 'Motif donné : <b>' + esc(t) + '</b>'; }).catch(() => { if (zm.isConnected) zm.textContent = 'Motif donné : non précisé'; });
  }
  // motifs d'annulation (décision 11, schéma 84) ; « Autre » demande quelques mots
  const MOTIFS = [['stock_epuise', 'Stock épuisé'], ['prix_change', 'Prix changé'], ['sans_reponse', 'L’autre partie ne répond pas'], ['erreur_saisie', 'Erreur de saisie'], ['panne_meteo', 'Panne ou météo'], ['autre', 'Autre']];
  const MOTIF_NOM = Object.fromEntries(MOTIFS);
  // appel des portes du schéma 84 ; serveur pas encore à jour : l'ancienne fonction, sans motif
  const ancien = e => /schema cache|Could not find the function|PGRST202/i.test(String(e && e.message));
  const annulerMotif = (c, oui, v) => N().rpc('commande_annuler_motif', { p_id: c.id, p_oui: oui, p_note: v.note || null, p_motif: v.motif || null, p_motif_texte: v.motif ? v.note || null : null, p_accord: v.accord == null ? null : v.accord })
    .catch(e => ancien(e) ? N().rpc('commande_annuler', { p_id: c.id, p_oui: oui, p_note: v.note || null }) : Promise.reject(e));
  const repondreMotif = (c, oui, v) => N().rpc('commande_repondre_motif', { p_id: c.id, p_oui: oui, p_note: v.note || null, p_motif: v.motif || null, p_motif_texte: v.motif ? v.note || null : null })
    .catch(e => ancien(e) ? N().rpc('commande_repondre', { p_id: c.id, p_oui: oui, p_note: v.note || null }) : Promise.reject(e));
  function geste(c, g) {
    const R = (f, a) => N().rpc(f, a);
    const av = (etape, ok, extra) => confirmer(c, Object.assign({ titre: ok, ok, etape, gps: true, note: 'Un mot (facultatif)', fait: LIB[etape] || ok,
      fn: v => R('commande_avancer', { p_id: c.id, p_etape: etape, p_lieu: v.lieu || null, p_lat: v.pos ? v.pos[0] : null, p_lon: v.pos ? v.pos[1] : null, p_note: v.note || null }) }, extra || {}));
    switch (g) {
      case 'oui': return confirmer(c, { titre: 'Confirmer la <em>commande</em>', ok: 'Confirmer', note: 'Un mot (facultatif)', fait: 'Commande confirmée', etape: 'confirmee',
        texte: `Transport : ${esc(MODES[c.mode_transport] || '')}. Livraison : ${esc(c.lieu_livraison || 'à convenir')}.`,
        fn: v => R('commande_repondre', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'non': return confirmer(c, { titre: 'Refuser la commande', ok: 'Refuser', motifs: true, note: 'Un mot (obligatoire pour « Autre »)', fait: 'Commande refusée',
        texte: 'Avant confirmation, un refus ne compte pas dans votre fiabilité.', fn: v => repondreMotif(c, false, v) });
      case 'preparation': return av('preparation', 'Marchandise en préparation', { gps: false });
      case 'depart': return depart(c);
      case 'chargement': return av('chargement', 'Chargement confirmé', { texte: c.mode_transport === 'reseau' ? 'Confirmez seulement quand la marchandise est dans le camion. Le transport commence alors.' : 'Confirmez seulement quand la marchandise est dans le camion. Ensuite, touchez « Le camion est parti » au départ (ou laissez le lien de suivi du chauffeur le détecter).' });
      case 'transport': return av('transport', 'Le camion est parti', { texte: 'Touchez quand le camion démarre avec la marchandise. ' + (c.role === 'vendeur' ? 'L’acheteur' : 'Le vendeur') + ' est prévenu.', fait: 'Départ signalé : le camion est en route' });
      case 'transbordement': return av('transbordement', 'Signaler un transbordement', { lieu: 'Où la marchandise change-t-elle de véhicule ?', lieuRequis: true });
      case 'arrivee': return c.role === 'acheteur'
        ? av('arrivee', 'La marchandise est arrivée', { texte: 'Touchez quand la marchandise est devant vous. Ensuite, vérifiez-la : confirmez la réception, ou refusez avec des photos.', fait: 'Marchandise arrivée : vérifiez-la' })
        : av('arrivee', 'Marchandise livrée', { texte: `Touchez quand la marchandise est déposée chez l’acheteur et qu’il ne l’a pas encore dit. Il vérifie, puis confirme ou refuse. Sans réponse de sa part dans les ${(dl[c.id] && dl[c.id].reception_heures) || 24} h, l’équipe du Marché de Gros regarde avec vous deux.`, fait: 'Livraison déclarée' });
      case 'retard': return confirmer(c, { titre: 'Annuler la <em>commande</em>', ok: 'Annuler la commande', note: 'Un mot (facultatif)', fait: 'Commande annulée',
        texte: `Le vendeur n’a pas chargé dans les ${(dl[c.id] && dl[c.id].chargement_heures) || 72} h après la confirmation. L’annulation compte dans sa fiabilité, pas dans la vôtre. Le stock revient sur son annonce.`,
        fn: v => R('commande_annuler_retard', { p_id: c.id, p_note: v.note || null }) });
      case 'reception': return c.validation === 'declaration' && c.mode_transport !== 'reseau'
        ? confirmer(c, { titre: 'Confirmer la <em>réception</em>', ok: 'Confirmer la réception', etape: 'reception', mot: true, gps: true, note: 'Un mot (facultatif)', fait: 'Réception confirmée : 1 h pour signaler un problème',
            texte: 'Confirmez seulement après avoir vérifié la quantité et la qualité. <b>Vous aurez 1 h pour signaler un problème.</b> Après, sans réclamation, la commande se clôt toute seule. ',
            essais: dl[c.id] ? dl[c.id].mot_essais_restants : null,
            // schéma 92 : un mot faux ne lève plus d'erreur ; la réponse dit combien d'essais restent (5 au plus)
            fn: v => R('commande_reception_mot', { p_id: c.id, p_mot: v.sansMot ? null : v.mot, p_sans_mot: v.sansMot, p_lat: v.pos ? v.pos[0] : null, p_lon: v.pos ? v.pos[1] : null, p_note: v.note || null })
              .then(r => { const s = String(r || '');
                if (s === 'mot_bloque') { if (dl[c.id]) dl[c.id].mot_essais_restants = 0; throw new Error('Trop d’essais faux : le mot secret est bloqué et l’équipe du Marché de Gros est prévenue. Revenez en arrière et touchez « Signaler un problème ».'); }
                if (s.startsWith('mot_incorrect')) { const n = +s.split(':')[1]; if (dl[c.id]) dl[c.id].mot_essais_restants = n; throw new Error(`Ce n’est pas le mot du vendeur. Vérifiez le papier : il reste ${n} essai${n > 1 ? 's' : ''}.`); }
                return r; }) })
        : av('reception', 'Réception confirmée', { texte: 'Confirmez seulement après avoir vérifié la quantité et la qualité. <b>Vous aurez 1 h pour signaler un problème.</b> Après, sans réclamation, la commande se clôt toute seule. ', fait: 'Réception confirmée : 1 h pour signaler un problème' });
      case 'annuler': return confirmer(c, { titre: c.etat === 'a_confirmer' ? 'Retirer la commande' : 'Demander l’annulation', ok: c.etat === 'a_confirmer' ? 'Retirer' : 'Demander', motifs: true, note: 'Un mot (obligatoire pour « Autre »)',
        texte: c.etat === 'a_confirmer' ? 'Avant confirmation, un retrait ne compte pas dans votre fiabilité.' : 'L’acheteur doit accepter l’annulation. Le stock reviendra sur l’annonce. S’il n’est pas d’accord avec votre motif, l’annulation comptera dans votre fiabilité.',
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
        texte: seq[c.id] && seq[c.id].actif ? 'La partie refusée n’est pas due. Le reste de la commande vous revient, et le transporteur garde le prix de son transport.' : 'L’acheteur ne doit que la partie acceptée. Le transporteur garde le prix de son transport.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'rf-non': return confirmer(c, { titre: 'Contester le <em>refus</em>', ok: 'Contester', note: 'Pourquoi ?', noteRequise: true, fait: 'Contestation envoyée : l’équipe va trancher',
        texte: 'L’équipe du Marché de Gros tranchera avec le numéro de commande : l’accord, la négociation, vos messages, les photos et la réponse du chauffeur. Les échanges sur le Marché de Gros ne sont pas secrets.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: false, p_note: v.note }) });
      case 'litige': return confirmer(c, { titre: 'Signaler un <em>problème</em>', ok: 'Ouvrir un litige', note: 'Que s’est-il passé ?', noteRequise: true, fait: 'Litige ouvert : l’équipe va examiner',
        texte: 'L’équipe du Marché de Gros examinera l’historique de la commande et les accords enregistrés (prix, quantité, transport), avec le numéro de commande. Elle lit aussi la négociation et vos messages : les échanges sur le Marché de Gros ne sont pas secrets.',
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
      lib: { vendeur: 'Le vendeur organise son livreur', acheteur: V ? 'L’acheteur vient chercher la marchandise' : 'Je viens chercher la marchandise' },
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
      ${L ? etat : `<small>Nous avons conseillé à ${qui} de donner un lien de suivi à son chauffeur. Dès qu’il l’ouvre, vous voyez le camion avancer ici.</small>`}</div>`;
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
    retourFocus = document.activeElement;
    bg = document.createElement('div'); bg.className = 'cm-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-label', 'Mes commandes');
    bg.innerHTML = '<div class="cm"></div>'; document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    document.addEventListener('keydown', clavier);
    // le serveur fait foi : on relit toutes les 20 s quand l'écran est visible (pas de suivi inventé entre deux lectures)
    minuteur = setInterval(rafraichir, 20000);
  }
  async function ouvrir(id, auCode) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter(); sel = id || null; vue = id ? 'detail' : 'liste';
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
        etat: x.etat === 'litige' ? 'litige' : aAgir(x) ? 'moi' : enRoute(x) ? 'route' : 'attente', route: enRoute(x), tag: st, ts: Date.parse(x.updated_at || x.maj_le || x.created_at) || 0, ouvrir: () => ouvrir(x.id) }; });
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
