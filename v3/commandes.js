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
  const signal = () => { try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} };
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
    annulation_refusee: 'Annulation refusée', annulee: 'Commande annulée', litige: 'Litige ouvert',
    transporteur_proposee: 'Transporteur proposé', transporteur_acceptee: 'Transporteur confirmé', transporteur_refusee: 'Le transporteur a refusé', transporteur_retiree: 'Transporteur retiré',
    code_prise_en_charge_cree: 'Code de prise en charge affiché', code_reception_cree: 'Code de réception affiché', code_transfert_cree: 'Code de transfert créé',
    code_prise_en_charge_bloque: 'Code bloqué (5 essais faux)', code_reception_bloque: 'Code bloqué (5 essais faux)', code_transfert_bloque: 'Code bloqué (5 essais faux)',
    sq_depot: 'Fonds bloqués chez le partenaire', sq_liberee: 'Marchandise conforme : commande clôturée', sq_liberee_auto: 'Clôture automatique (48 h sans problème)',
    sq_refus: 'Marchandise refusée, avec photos', sq_refus_chauffeur_confirme: 'Le chauffeur confirme le refus', sq_refus_chauffeur_conteste: 'Le chauffeur conteste le refus',
    sq_refus_vendeur_reconnu: 'Le vendeur reconnaît le problème', sq_refus_vendeur_conteste: 'Le vendeur conteste le refus', sq_refus_applique: 'Refus appliqué',
    sq_refus_admin: 'Décision de l’équipe sur le refus', sq_solde: 'Séquestre soldé : chacun reçoit sa part', sq_rembourse: 'Remboursement de l’acheteur' });
  // Service litiges sur WhatsApp : le propriétaire donnera le numéro officiel (format international, sans « + » ni espaces, ex. 2250700000000).
  // Tant qu'il est vide, l'application dit « bientôt » et ne montre aucun numéro.
  const WA_LITIGES = '';
  const COM_V = 0.035, COM_T = 0.069;   // commissions : vendeur 3,5 %, transporteur 6,9 % (calculées par le serveur, rappelées ici pour l'affichage)
  const MODES = { reseau: 'Transporteur du réseau Marché de Gros', acheteur: 'Transporteur choisi par l’acheteur', vendeur: 'Transporteur choisi par le vendeur' };
  const ROLE = { vendeur: 'Vendeur', acheteur: 'Acheteur', chauffeur: 'Chauffeur', admin: 'Marché de Gros', systeme: 'Automatique' };
  const PREUVE = { declaration: 'déclaré', gps: 'déclaré avec position', code: 'validé par code', auto: 'automatique', admin: 'équipe' };

  const CSS = `
.cm-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,24,18,.5);display:flex;align-items:flex-end;justify-content:center;animation:cmIn .2s ease-out}
@keyframes cmIn{from{opacity:0}}
.cm{position:relative;width:100%;max-width:560px;max-height:94dvh;overflow:auto;overscroll-behavior:contain;background:#F3EFE4;color:#171512;border-radius:24px 24px 0 0;padding:22px 18px calc(24px + env(safe-area-inset-bottom));font:400 15px/1.45 Jost,system-ui,sans-serif;color-scheme:light;animation:cmUp .28s cubic-bezier(.2,.8,.2,1)}
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
.cm-st{margin:10px 0 12px;padding:14px;border-radius:18px;background:#10392B;color:#F3EFE4}
.cm-st b{display:block;font:600 18px/1.25 Jost,sans-serif}.cm-st b em{font-style:italic;font-weight:900;color:#F2C230}
.cm-st small{display:block;margin-top:4px;color:rgba(243,239,228,.8);font-size:13px}
.cm-tcode{margin:0 0 10px;padding:8px 12px;border-radius:12px;background:rgba(16,57,43,.08);color:#171512;font:400 13px/1.4 Jost,sans-serif}.cm-tcode b{display:inline;font:800 15px/1 Jost,sans-serif;letter-spacing:.06em;color:#10392B}.cm-garde b{display:inline;font:inherit;font-weight:800;letter-spacing:.04em}
.cm-garde{margin:-2px 0 10px;padding:8px 12px;border-radius:12px;background:#F2C230;color:#171512;font:600 14px/1.35 Jost,sans-serif}
.cm-act{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}
.cm-act button{min-height:50px;border-radius:25px;border:1px solid #10392B;background:none;color:#10392B;font:600 15.5px Jost,sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:0 16px}
.cm-act button.p{background:#10392B;color:#F3EFE4}.cm-act button.m{border-color:transparent;background:none;text-decoration:underline;min-height:44px;font-weight:500}
.cm-act button:disabled{opacity:.55;cursor:default}
.cm-info{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:rgba(242,194,48,.2);font-size:13.5px}
.cm-lien{display:flex;flex-direction:column;gap:8px;margin:10px 0 4px;padding:14px;border-radius:16px;background:rgba(106,174,240,.12);border:1px solid rgba(106,174,240,.35)}
.cm-lien b{font:600 15px Jost,sans-serif}
.cm-lien-h{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.cm-lien-h b{flex:1;min-width:0}
.cm-lien-i{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#FFFDF8;font:normal 20px/1 "Apple Color Emoji","Segoe UI Emoji",sans-serif}
.cm-lien-l{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}.cm-lien-l li{display:flex;gap:8px;font-size:13.5px;line-height:1.4;color:#3B342A}
.cm-lien-l li span{flex:none;font:normal 15px/1.3 "Apple Color Emoji","Segoe UI Emoji",sans-serif}
.cm-lien-e{display:inline-flex;align-self:flex-start;padding:4px 10px;border-radius:999px;background:rgba(23,21,18,.06);font:500 13px Jost,sans-serif;color:#4A4336}.cm-lien-e.on{background:rgba(108,197,140,.2);color:#1F6B40}
.cm-lien-f{font-size:12.5px!important;color:#5E5546!important}.cm-lien small{font-size:13.5px;line-height:1.4;color:#4A4336}
.cm-lien code{display:block;padding:8px 10px;border-radius:10px;background:#FFFDF8;font:500 12.5px/1.35 ui-monospace,Menlo,monospace;word-break:break-all;color:#10392B}
.cm-lien button{min-height:44px;padding:0 16px;border-radius:22px;border:1px solid #10392B;background:none;color:#10392B;font:600 14.5px Jost,sans-serif;cursor:pointer}
.cm-lien button.p{background:#10392B;color:#FFFDF8}.cm-lien-a{display:flex;gap:8px;flex-wrap:wrap}.cm-lien-a button{flex:1}
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
.cm-opt b{display:block;font-weight:600}.cm-opt small{display:block;font-size:13px;color:#5E5546}
.cm-opt.off{opacity:.6;cursor:default}
.cm-f input[type=text],.cm-f textarea{width:100%;box-sizing:border-box;min-height:48px;border:1px solid rgba(23,21,18,.22);border-radius:14px;background:#FFFDF8;padding:10px 12px;font:400 16px Jost,sans-serif;color:#171512}
.cm-f textarea{min-height:76px;resize:vertical}
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
/* paiement sécurisé (séquestre) */
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
.cm-pick{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border-radius:16px;border:2px dashed rgba(16,57,43,.35);background:#FFFDF8;color:#10392B;font:600 15px Jost,sans-serif;cursor:pointer}
.cm-pick input{position:absolute;width:1px;height:1px;opacity:0}
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
  let lu = false, bg = null, vue = 'liste', filtre = 'cours', liste = [], journal = {}, transport = {}, lien = {}, pos = {}, carte = null, sel = null, charge = false, minuteur = null;
  const trouve = id => liste.find(x => x.id === id);
  const enRoute = c => c.etat === 'en_cours' && ['chargement', 'transport', 'transbordement', 'arrivee'].includes(c.etape);
  function oublierCarte() { if (carte && carte.api) carte.api.detruire(); carte = null; }
  let retourFocus = null;
  function fermer() { oublierCarte(); if (!bg) return; bg.remove(); bg = null; if (retourFocus && retourFocus.focus) try { retourFocus.focus({ preventScroll: true }); } catch (_) {} retourFocus = null; clearInterval(minuteur); minuteur = null; document.removeEventListener('keydown', clavier); }
  const clavier = e => { if (e.key === 'Escape') fermer(); };
  const horsLigne = e => navigator.onLine === false || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET/i.test(String((e && e.message) || e || ''));
  const erreurTxt = e => { if (horsLigne(e)) return 'Pas de connexion : rien n’a été enregistré. Réessayez quand le réseau revient.'; const m = String((e && e.message) || e || ''); return /schema cache|Could not find the function/i.test(m) ? 'Le serveur n’est pas encore à jour.' : m || 'Réessayez dans un instant.'; };

  const seq = {};           // commande → séquestre (commande_sequestre, schémas 57-58)
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
    if (c && c.etat === 'terminee') { const a = await N().rpc('avis_commande_moi', { p_cmd: id }).catch(() => null); if (a) avis[id] = a; }
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
  // reçue mais pas encore clôturée (libere_le vaut null seulement avec mes_commandes2 : l'ancienne liste ne le donne pas)
  const aVerifier = x => x.etat === 'terminee' && x.libere_le === null;
  const dansDelai = x => aVerifier(x);   // l'acheteur peut refuser tant que rien n'est libéré (libération automatique 24 h après la réception, schéma 61)
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
      <p class="cm-sous">Du « oui » à la livraison : chaque étape, avec son heure.</p>
      <div class="cm-seg" role="group" aria-label="Afficher">${[['cours', 'En cours'], ['fini', 'Terminées et annulées']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${filtre === k}">${l}</button>`).join('')}</div>
      <div class="cm-li">${charge && !liste.length ? (window.MDGSac ? MDGSac.charge('Vos commandes arrivent…') : '<p>Chargement…</p>')
        : L.length ? L.map(ligneCmd).join('')
        : (window.MDGSac ? MDGSac.vide(filtre === 'cours' ? 'Aucune commande en cours' : 'Rien ici pour l’instant', 'Après un accord conclu, touchez « Suivre la commande » dans la négociation.') : '<p>Aucune commande.</p>')}</div>
      <p class="cm-note">Paiement à la livraison, après avoir vu la marchandise. Le séquestre (argent bloqué jusqu’à ce que l’acheteur valide) est en construction.</p>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtre = b.dataset.f; peindre(); });
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => detail(b.dataset.id));
  }

  // ——— le détail : la scène, la progression, le statut, les actions, le journal ———
  function prochaine(c) {
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
      const fin = S && S.echeance ? quand(S.echeance) : '24 h après la réception';
      return c.role === 'acheteur'
        ? ['Vérifiez la <em>marchandise</em>', `Tout est bon : confirmez. Un problème (gâté, abîmé, manquant) : refusez avec le mot secret du vendeur et des photos. Sans réclamation, le paiement est libéré automatiquement : ${fin}.`]
        : ['Réception <em>confirmée</em>', `${lui} vérifie la marchandise. Sans réclamation de sa part, le paiement est libéré automatiquement : ${fin}.`];
    }
    if (c.etat === 'terminee' && (c.liberation || (S && S.liberation))) {
      const L = c.liberation || S.liberation, mr = Number(c.montant_refuse || (S && S.montant_refuse) || 0);
      const hors = S && S.actif ? '' : ' Aucun paiement ne passe encore par l’application : réglez-le entre vous.';
      if (L === 'refus' || mr > 0) return ['Commande <em>clôturée</em>', (mr >= Number(c.montant || 0) ? 'La marchandise a été refusée : le prix de la marchandise revient à l’acheteur.' : `Refus partiel : ${F(mr)} reviennent à l’acheteur, le reste au vendeur.`) + hors];
      return ['Commande <em>clôturée</em>', L === 'auto' ? 'Clôturée automatiquement : aucun problème signalé en 48 h. Merci !' : L === 'admin' ? 'Clôturée par l’équipe du Marché de Gros.' : 'L’acheteur a confirmé que tout est conforme. Merci !'];
    }
    if (c.etat === 'terminee') return ['Commande <em>terminée</em>', 'Merci !'];
    if (c.annulation === 'autre') return [`${lui} demande l’<em>annulation</em>`, 'Acceptez ou refusez.'];
    if (c.annulation === 'moi') return ['Annulation <em>demandée</em>', `En attente de la réponse de ${lui}.`];
    const V = c.role === 'vendeur';
    if (c.validation === 'code') switch (c.etape) {
      case 'confirmee': case 'preparation': if (V) return ['Préparez la <em>marchandise</em>', 'Quand elle est dans le camion, donnez au chauffeur le code de prise en charge (ci-dessous).']; break;
      case 'transport': case 'transbordement': if (!V) return ['Votre marchandise est <em>en route</em>', 'À l’arrivée, vérifiez la marchandise, puis donnez au chauffeur le code de réception (ci-dessous).']; break;
      case 'arrivee': if (!V) return ['Le chauffeur est <em>arrivé</em>', 'Vérifiez la quantité, la qualité et le papier du vendeur, puis donnez-lui le code de réception. Un problème : refusez avec des photos.']; break;
    }
    switch (c.etape) {
      case 'confirmee': return V ? ['Préparez la <em>marchandise</em>', 'Touchez « En préparation », puis « Chargement confirmé » quand le camion est chargé.'] : ['Le vendeur prépare votre <em>marchandise</em>', 'Vous serez prévenu au chargement.'];
      case 'preparation': return V ? ['Marchandise en <em>préparation</em>', 'Confirmez le chargement quand le camion est chargé.'] : ['Marchandise en <em>préparation</em>', 'Prochaine étape : le chargement.'];
      case 'transport': case 'transbordement': return V ? ['Transport <em>en cours</em>', 'L’acheteur confirmera l’arrivée et la réception.'] : ['Votre marchandise est <em>en route</em>', 'Signalez l’arrivée du chauffeur, puis confirmez la réception après avoir vérifié.'];
      case 'arrivee': return V ? ['Le chauffeur est <em>arrivé</em>', 'L’acheteur vérifie la marchandise.'] : ['Le chauffeur est <em>arrivé</em>', 'Vérifiez la marchandise et le papier du vendeur avant de confirmer la réception. Un problème : refusez avec des photos.'];
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
        if (c.role === 'vendeur' && c.etape === 'confirmee') { b('preparation', 'En préparation', 'p'); if (!K) b('chargement', 'Chargement confirmé'); }
        if (c.role === 'vendeur' && c.etape === 'preparation' && !K) b('chargement', 'Chargement confirmé', 'p');
        if (c.role === 'acheteur' && ['transport', 'transbordement'].includes(c.etape)) { b('arrivee', 'Le chauffeur est arrivé', K ? '' : 'p'); if (!K) b('reception', 'Réception confirmée'); }
        if (c.role === 'acheteur' && c.etape === 'arrivee' && !K) b('reception', 'Réception confirmée', 'p');
        if (['transport', 'transbordement'].includes(c.etape)) b('transbordement', 'Signaler un transbordement', 'm');
        // commande confirmée : seul le vendeur peut demander l'annulation (l'acheteur peut l'accepter), avant le chargement
        if (c.role === 'vendeur' && ['confirmee', 'preparation'].includes(c.etape) && c.annulation !== 'moi') b('annuler', 'Demander l’annulation', 'm');
      }
      if (['chargement', 'transport', 'transbordement', 'arrivee', 'reception'].includes(c.etape)) b('litige', 'Signaler un problème', 'm');
      // une fois la commande confirmée, l'acheteur ne peut plus l'annuler seul : seulement d'un commun accord, avant le chargement
    }
    const S = seq[c.id];
    if (c.role === 'acheteur' && (S ? S.peut_liberer : aVerifier(c))) b('liberer', S && S.actif ? 'Tout est conforme : libérer le paiement' : 'Tout est conforme', 'p');
    if (c.role === 'acheteur' && (S ? S.peut_refuser : dansDelai(c))) b('refuser', 'Refuser la marchandise (mot du vendeur + photos)');
    if (c.role === 'acheteur' && c.etat === 'terminee' && aVerifier(c)) b('litige', 'Pas de papier du vendeur ? Signaler un problème', 'm');
    if (S && S.peut_repondre) { b('rf-oui', 'Je reconnais le problème', 'p'); b('rf-non', 'Je conteste'); }
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
    // commande pas encore en mémoire (notification touchée) : on attend la réponse du serveur avant de revenir à la liste
    if (!c) { if (!lu && navigator.onLine !== false) { box.innerHTML = window.MDGSac ? MDGSac.charge('La commande arrive…') : ''; return; } vue = 'liste'; return peindreListe(); }
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
      ${enRoute(c) && window.MDGSuivi ? `<div data-carte></div>
        <p class="cm-sr" aria-live="polite">${esc(MDGSuivi.texte(pos[c.id]).t)}</p>` : scene(c, arrive)}
      <div class="cm-prog" role="progressbar" aria-label="Avancement de la commande" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"><div class="cm-pb"><i style="--p:${p.toFixed(3)}"></i></div></div>
      <div class="cm-st" role="status" aria-live="polite"><b>${titre}</b>${sous ? `<small>${esc(sous)}</small>` : ''}<small>Dernière actualisation : ${ilya(der)}</small></div>
      ${actions(c)}
      ${c.etat === 'terminee' && c.role === 'acheteur' && window.MDGRacheter ? `<div class="cm-act"><button type="button" class="p" data-racheter>Racheter · prix du jour</button></div>` : ''}
      ${blocMot(c)}${blocRefus(c)}${blocDisc(c)}${blocSequestre(c)}${c.etat === 'litige' || seq[c.id] && seq[c.id].refus ? blocWa(c) : ''}
      ${blocAvis(c)}
      ${c.validation === 'declaration' && ['a_confirmer', 'en_cours'].includes(c.etat) ? `<p class="cm-info"><b>Validation sans code.</b> Le vendeur déclare le chargement, l’acheteur l’arrivée et la réception. Je recommande que le chauffeur crée un compte gratuit sur le Marché de Gros : avec les codes, personne ne peut déclarer une livraison à votre place.</p>` : ''}
      ${blocCode(c)}
      ${blocTransport(c)}${blocLien(c)}
      <ol class="cm-et">${etapes}</ol>
      <dl class="cm-dl">
        <dt>Quantité</dt><dd>${c.quantite != null ? qte(c.quantite, c.unite) : '—'}</dd>
        <dt>Prix convenu</dt><dd>${c.prix_unitaire != null ? F(c.prix_unitaire) + ' / ' + esc(c.unite || 'unité') : '—'}</dd>
        <dt>Total</dt><dd>${c.montant != null ? F(c.montant) : '—'}</dd>
        ${c.role === 'vendeur' && c.commission_montant != null ? (() => { const clos = c.etat === 'terminee' && !aVerifier(c), k = seq[c.id] && seq[c.id].repartition ? seq[c.id].repartition.vendeur_commission : c.commission_montant;
          return `<dt>${c.etat === 'annulee' ? 'Commission (3,5 %) annulée' : c.etat === 'litige' ? 'Commission (3,5 %) suspendue' : clos ? 'Commission due (3,5 %)' : 'Commission prévue (3,5 %)'}</dt><dd>${c.etat === 'annulee' ? '0 F' : F(clos ? k : c.commission_montant)}<br><small style="font-weight:400;color:#5E5546">${c.etat === 'annulee' ? 'commande annulée : rien n’est dû' : clos ? 'rien n’est prélevé : pas encore de paiement dans l’application' : 'due seulement à la libération · rien n’est prélevé'}</small></dd>`; })() : ''}
        <dt>Transport</dt><dd>${esc(MODES[c.mode_transport] || '—')}${transport[c.id] && transport[c.id].prix_transport != null ? '<br>' + F(transport[c.id].prix_transport) + ' <small style="font-weight:400;color:#5E5546">(prix du chauffeur)</small>' : ''}</dd>
        ${transport[c.id] && transport[c.id].total_livraison != null && c.etat !== 'annulee' ? `<dt>À payer à la livraison</dt><dd><b>${F(transport[c.id].total_livraison)}</b><br><small style="font-weight:400;color:#5E5546">marchandise ${F(c.montant)} + transport ${F(transport[c.id].prix_transport)}, payés à la réception, hors application</small></dd>` : ''}
        <dt>Départ</dt><dd>${esc(c.ville_depart || '—')}</dd>
        <dt>Livraison</dt><dd>${esc(c.lieu_livraison || 'À convenir')}</dd>
        <dt>Paiement</dt><dd>${seq[c.id] && seq[c.id].actif ? 'Séquestre ' + esc(OPE[seq[c.id].operateur] || '') : 'À la livraison<br><small style="font-weight:400;color:#5E5546">séquestre en construction</small>'}</dd>
      </dl>
      ${Jr.length ? `<h3 class="cm-h3">Historique</h3><ul class="cm-j">${Jr.slice().reverse().map(e => `<li><b>${esc(EV[e.evenement] || e.evenement)}</b> · ${esc(e.par_moi ? 'vous' : ROLE[e.role] || '')}<small>${quand(e.at)} · ${esc(PREUVE[e.preuve] || '')}${e.lieu ? ' · ' + esc(e.lieu) : ''}${e.lat != null ? ' · position jointe' : ''}</small>${e.note ? `<small>« ${esc(e.note)} »</small>` : ''}</li>`).join('')}</ul>` : ''}
      <button type="button" class="cm-act" style="all:unset;display:block;margin:16px auto 0;padding:10px;min-height:44px;box-sizing:border-box;color:#10392B;text-decoration:underline;cursor:pointer" data-retour>Toutes mes commandes</button>`;
    box.querySelector('[data-x]').onclick = fermer;
    box.querySelector('[data-retour]').onclick = () => { oublierCarte(); sel = null; vue = 'liste'; peindre(); };
    box.querySelectorAll('[data-g]').forEach(b => b.onclick = () => geste(c, b.dataset.g));
    const rb = box.querySelector('[data-racheter]'); if (rb) rb.onclick = () => { fermer(); MDGRacheter.ouvrir(c.id); };
    lierTransport(c, box); lierLien(c, box); lierCode(c, box); lierAvis(c, box); placerCarte(c, box); photos(box); lierDisc(c, box);
    if (arrive) { if (navigator.vibrate) try { navigator.vibrate([40, 60, 40]); } catch (_) {} toast('Le chauffeur est arrivé', { type: 'ok', sous: c.role === 'acheteur' ? 'Vérifiez la marchandise avant de confirmer.' : esc(c.produit || '') }); }
  }
  // ——— paiement sécurisé : où en est l'argent, et qui reçoit quoi à la libération (schéma 57) ———
  const OPE = { wave: 'Wave', orange: 'Orange Money', mtn: 'MTN MoMo', moov: 'Moov Money' };
  function blocSequestre(c) {
    const S = seq[c.id]; if (!S || c.etat === 'annulee' || c.etat === 'a_confirmer') return '';
    const r = S.repartition || {}, A = S.actif, V = c.role === 'vendeur';
    const clos = !!S.libere_le, recu = c.etat === 'terminee' || c.etat === 'litige', parti = recu || ['chargement', 'transport', 'transbordement', 'arrivee', 'reception'].includes(c.etape);
    const pas = [['Commande confirmée', true], ['Livraison', parti], ['Vérification (24 h)', recu], ['Libération', clos]];
    const ici = pas.findIndex(p => !p[1]);
    const etat = !A ? '<span class="cm-sq-e">Séquestre en construction</span>'
      : S.etat === 'bloque' ? `<span class="cm-sq-e on">🔒 ${F(r.total)} bloqués chez ${esc(OPE[S.operateur] || '')}</span>`
      : `<span class="cm-sq-e on">✓ Séquestre soldé${S.solde_le ? ' le ' + quand(S.solde_le) : ''}</span>`;
    const lignes = [];
    lignes.push(`<tr class="tot"><td>L’acheteur paie<small>marchandise${r.transport ? ' + transport' : ''}</small></td><td>${F(r.total)}</td></tr>`);
    if (Number(r.acheteur_rembourse) > 0) lignes.push(`<tr><td>Rendu à l’acheteur<small>marchandise refusée</small></td><td>${F(r.acheteur_rembourse)}</td></tr>`);
    lignes.push(V ? `<tr><td>Vous recevez<small>${F(r.vendeur_brut)} moins 3,5 % (${F(r.vendeur_commission)})</small></td><td>${F(r.vendeur_net)}</td></tr>`
                  : `<tr><td>Le vendeur reçoit<small>prix de la marchandise${Number(r.acheteur_rembourse) > 0 ? ', partie acceptée' : ''}</small></td><td>${F(r.vendeur_brut)}</td></tr>`);
    if (Number(r.transport) > 0) lignes.push(`<tr><td>Le transporteur reçoit<small>son prix de transport</small></td><td>${F(r.transporteur_brut)}</td></tr>`);
    return `<section class="cm-sq" aria-label="Paiement sécurisé"><h3><span aria-hidden="true">🛡️</span> Paiement sécurisé</h3>${etat}
      <ol>${pas.map((p, i) => `<li class="${p[1] ? 'fait' : ''}${i === ici ? ' ici' : ''}">${p[0]}</li>`).join('')}</ol>
      <table><tbody>${lignes.join('')}</tbody></table>
      <p>${A ? 'L’argent reste bloqué jusqu’à ce que l’acheteur valide la marchandise, ou 24 h après la réception sans réclamation. Pour être remboursé, il faut des preuves : le mot secret du vendeur et des photos. Le Marché de Gros n’est payé qu’à la libération.'
        : 'Pour l’instant : <b>paiement à la livraison</b>. Le séquestre est en construction : bientôt, l’acheteur paiera par Wave, Orange Money ou MTN MoMo dès la confirmation, l’argent restera bloqué jusqu’à ce qu’il valide la marchandise (ou 24 h après la réception sans réclamation), puis chacun recevra sa part. Le vendeur ne fera plus le voyage pour rien.'}</p></section>`;
  }
  function blocRefus(c) {
    const S = seq[c.id], R = S && S.refus; if (!R) return '';
    const qte_ = R.quantite != null ? qte(R.quantite, R.unite) : 'toute la marchandise';
    const ch = R.chauffeur === 'confirme' ? '✓ Le chauffeur confirme' : R.chauffeur === 'conteste' ? '✗ Le chauffeur conteste' : R.a_chauffeur ? '… Le chauffeur n’a pas encore répondu' : '— Chauffeur hors de l’application : l’équipe jugera';
    const ve = R.vendeur === 'reconnu' ? '✓ Le vendeur reconnaît le problème' : R.vendeur === 'conteste' ? '✗ Le vendeur conteste' : '… Le vendeur n’a pas encore répondu';
    const regle = R.chauffeur_suffit ? 'Si le chauffeur (inscrit et vérifié par le Marché de Gros) confirme, ou si le vendeur reconnaît le problème, le remboursement se fait tout seul. Sinon, on en discute à trois et l’équipe juge.'
      : 'Si le vendeur reconnaît le problème, le remboursement se fait tout seul. Sinon, on en discute à trois ci-dessous et l’équipe du Marché de Gros juge.';
    const mot = R.mot === 'retrouve' ? '✓ Mot du vendeur retrouvé dans la marchandise' : R.mot === 'absent' ? '✗ Papier du vendeur absent de la marchandise' : '';
    return `<section class="cm-rf" aria-label="Refus de la marchandise"><h3>Marchandise refusée</h3>
      <p><b>${esc(qte_)}</b> · « ${esc(R.motif || '')} »</p>
      <div class="cm-ph">${(R.photos || []).map(x => `<span data-ph="${esc(x)}" role="img" aria-label="Photo du refus"></span>`).join('')}</div>
      <ul>${mot ? `<li>${mot}</li>` : ''}${R.chauffeur || c.etat === 'litige' ? `<li>${ch}</li>` : ''}${R.vendeur || c.etat === 'litige' ? `<li>${ve}</li>` : ''}</ul>
      ${c.etat === 'litige' ? `<p style="color:#5E5546;font-size:12.5px">${regle}</p>` : ''}</section>`;
  }
  // le mot secret : le vendeur l'écrit sur un papier glissé dans la marchandise ; l'acheteur le retrouve à l'arrivée
  function blocMot(c) {
    const S = seq[c.id]; if (!S || !S.mot || c.role !== 'vendeur' || !['en_cours', 'litige'].includes(c.etat)) return '';
    const avant = c.etat === 'en_cours' && ['confirmee', 'preparation'].includes(c.etape);
    return `<section class="cm-mot${avant ? ' fort' : ''}" aria-label="Mot secret à glisser dans la marchandise"><span aria-hidden="true">📝</span><span>
      <small>Mot secret à glisser dans la marchandise</small><b>${esc(S.mot)}</b>
      <small>${avant ? 'Écrivez-le sur un papier et mettez-le dans le colis avant le chargement. À l’arrivée, l’acheteur le retrouve et le photographie : c’est la preuve que c’est bien votre marchandise. Ne le donnez à personne, ni par message.' : 'Il est dans la marchandise. Ne le donnez à personne.'}</small></span></section>`;
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
    return WA_LITIGES ? `<div class="cm-wa"><span aria-hidden="true">💬</span><span><b>Service litiges</b> sur WhatsApp : <a href="https://wa.me/${WA_LITIGES}?text=${encodeURIComponent('Bonjour, litige sur la commande n° ' + c.numero)}" target="_blank" rel="noopener">écrire au service</a>. Donnez votre numéro de commande <b>${esc(c.numero)}</b>. Nous ne demandons jamais d’argent ni de code.</span></div>`
      : `<div class="cm-wa"><span aria-hidden="true">💬</span><span><b>Service litiges WhatsApp : bientôt.</b> Gardez votre numéro de commande <b>${esc(c.numero)}</b> : il suffit pour retrouver l’accord, la négociation et vos messages. Nous ne demandons jamais d’argent ni de code.</span></div>`;
  }
  // photos privées : liens signés de courte durée (le serveur vérifie qui peut les voir)
  function photos(box) {
    box.querySelectorAll('[data-ph]').forEach(async el => {
      const u = await N().lienSigne('preuves', el.dataset.ph, 600).catch(() => null); if (!u || !el.isConnected) return;
      el.outerHTML = `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="Agrandir la photo"><img src="${esc(u)}" alt="Photo de la marchandise refusée" loading="lazy"></a>`;
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
        <label class="cm-pick">📷 Ajouter des photos<input type="file" accept="image/*" multiple data-fic></label>
        <p class="cm-note" style="font-size:13.5px">Pas de remboursement sans preuves réelles : le mot du vendeur et des photos. Le vendeur verra vos photos et répondra. S’il reconnaît le problème, la partie refusée vous est rendue. Sinon, on en discute à trois et l’équipe du Marché de Gros juge. Le transport reste dû : le chauffeur a fait son travail.</p>
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
      if (W && !mot) { err.textContent = 'Tapez le mot écrit sur le papier du vendeur : sans lui, pas de remboursement.'; W.focus(); return; }
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
  // ——— la carte : créée une fois par commande, puis déplacée d'un rendu à l'autre (jamais recréée toutes les 20 s) ———
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

  // ——— l'avis : seulement après une commande terminée (schéma 32), un par commande, corrigeable 24 h puis figé ———
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
        avis[c.id] = await N().rpc('avis_commande_moi', { p_cmd: c.id }).catch(() => avis[c.id]); toast('Merci, votre avis est publié', { type: 'ok', sous: 'Il aide les autres à choisir avec qui échanger.' }); peindre(); }
      catch (x) { ok.disabled = false; err.textContent = x.code === 'texte' ? x.message : erreurTxt(x); }
    };
  }

  // ——— les codes : le vendeur voit le code de prise en charge, l'acheteur le code de réception ; le chauffeur les tape ———
  // Le code n'est gardé qu'en mémoire, le temps de l'écran : jamais dans le téléphone, jamais dans un message.
  const codesVus = {};
  function blocCode(c) {
    if (c.validation !== 'code' || c.etat !== 'en_cours') return '';
    const pec = c.role === 'vendeur' && ['confirmee', 'preparation'].includes(c.etape), rec = c.role === 'acheteur' && ['transport', 'transbordement', 'arrivee'].includes(c.etape);
    if (!pec && !rec) return '';
    const T = transport[c.id], ok = T && T.mission && T.mission.statut === 'acceptee' && T.mission.avec_application;
    const k = codesVus[c.id + (pec ? ':p' : ':r')], titre = pec ? 'Code de prise en charge' : 'Code de réception';
    const regle = pec ? 'Donnez-le au chauffeur seulement quand la marchandise est dans son véhicule.' : 'Donnez-le au chauffeur seulement après avoir vérifié la quantité et la qualité.';
    const garde = pec ? '🔐 Gardez bien ce code : vous aurez à le présenter au chauffeur au chargement.' : '🔐 Gardez bien ce code : vous aurez à le présenter à la réception.';
    return `<div class="cm-st" data-code-bloc style="background:#FFFDF8;color:#171512;box-shadow:inset 0 0 0 2px #10392B"><p class="cm-garde">${garde}</p>${ok && T.mission.code ? `<p class="cm-tcode">🚚 Code du chauffeur : <b>${esc(T.mission.code)}</b><br>Exigez qu’il vous le montre dans son application avant de donner votre code : s’il ne l’a pas, ce n’est pas le bon chauffeur.</p>` : ''}<b style="color:#10392B">${titre}</b>
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
    const n = box.querySelector('[data-code-nv]'); if (n) n.onclick = () => { if (confirm('Créer un nouveau code ? L’ancien ne marchera plus.')) go(n); };
  }

  // ——— le transport : qui conduit, sa réponse ; l'acheteur ou le vendeur qui choisit tape le code du chauffeur ———
  function blocTransport(c) {
    const T = transport[c.id]; if (!T || c.etat === 'annulee') return '';
    const m = T.mission && T.mission.statut !== 'retiree' ? T.mission : null, qui = c.mode_transport === 'acheteur' ? 'l’acheteur' : 'le vendeur';
    const etat = !m ? '' : m.statut === 'proposee' ? 'En attente de la réponse du chauffeur' : m.statut === 'acceptee' ? 'A accepté la mission' + (m.avec_application ? '' : ' (inscrit par l’équipe, sans l’application)') : 'A refusé la mission : choisissez un autre transporteur.';
    const vide = c.mode_transport === 'reseau' ? 'L’équipe du Marché de Gros vous affecte un transporteur vérifié.' : T.peut_choisir ? 'Demandez son code au chauffeur (exemple : T-4K7P) et tapez-le ici. Il reçoit la mission dans son Espace chauffeur.' : 'En attente du choix de ' + qui + '.';
    return `<h3 class="cm-h3">Transport</h3><div class="cm-dl" style="grid-template-columns:1fr;gap:6px">
      ${m ? `<b style="font-weight:600">${esc(m.nom)} · ${esc(m.vehicule)}${m.immatriculation ? ' · ' + esc(m.immatriculation) : ''}</b>
        <span><span class="cm-tag ${m.verifie ? '' : 'mais'}">${m.verifie ? 'Vérifié par l’équipe' : 'Pas encore vérifié par l’équipe'}</span></span>
        <small style="color:${m.statut === 'refusee' ? '#8A2414' : '#5E5546'}">${esc(etat)}</small>
        ${m.statut === 'acceptee' ? (T.prix_transport != null ? `<span><b style="font-weight:600">Prix du transport : ${F(T.prix_transport)}</b> <small style="color:#5E5546">fixé par le chauffeur</small></span>` : '<small style="color:#5E5546">Le chauffeur n’a pas encore indiqué son prix.</small>') : ''}` : `<small style="color:#5E5546">${esc(vide)}</small>`}
      ${T.peut_choisir ? `<form class="cm-f" data-trf style="display:flex;gap:8px;margin-top:6px"><input type="text" data-code maxlength="8" placeholder="T-4K7P" aria-label="Code du transporteur" autocapitalize="characters" autocomplete="off" style="flex:1;min-width:0;text-transform:uppercase"><button type="submit" style="min-height:48px;padding:0 18px;border-radius:24px;border:0;background:#10392B;color:#F3EFE4;font:600 15px Jost,sans-serif;cursor:pointer">${m ? 'Changer' : 'Choisir'}</button></form>
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
      if (!confirm('Retirer ce transporteur de la commande ?')) return;
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
        texte: c.etat === 'a_confirmer' ? '' : 'L’acheteur doit accepter l’annulation. Le stock reviendra sur l’annonce.',
        fait: c.etat === 'a_confirmer' ? 'Commande retirée' : 'Demande d’annulation envoyée', fn: v => R('commande_annuler', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'annul-oui': return confirmer(c, { titre: 'Accepter l’annulation', ok: 'Accepter', note: 'Un mot (facultatif)', fait: 'Commande annulée', texte: 'Le stock reviendra sur l’annonce.',
        fn: v => R('commande_annuler', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'annul-non': return confirmer(c, { titre: 'Refuser l’annulation', ok: 'Refuser', note: 'Un mot (facultatif)', fait: 'Annulation refusée',
        fn: v => R('commande_annuler', { p_id: c.id, p_oui: false, p_note: v.note || null }) });
      case 'liberer': { const S = seq[c.id], A = S && S.actif;
        return confirmer(c, { titre: A ? 'Libérer le <em>paiement</em>' : 'Tout est <em>conforme</em>', ok: A ? 'Libérer le paiement' : 'Confirmer', fait: A ? 'Paiement libéré : chacun reçoit sa part' : 'Merci ! Commande clôturée',
          texte: A ? 'Confirmez seulement si la quantité et la qualité sont bonnes. Le vendeur et le transporteur reçoivent alors leur part. Cette action ne s’annule pas.' : 'Confirmez seulement si la quantité et la qualité sont bonnes. La commande sera clôturée : vous ne pourrez plus la refuser.',
          fn: () => R('commande_liberer', { p_id: c.id }) }); }
      case 'refuser': return refuser(c);
      case 'rf-oui': return confirmer(c, { titre: 'Reconnaître le <em>problème</em>', ok: 'Je reconnais', note: 'Un mot (facultatif)', fait: 'Refus accepté : la commande est clôturée',
        texte: 'La partie refusée revient à l’acheteur. Le reste de la commande vous revient, et le transporteur garde le prix de son transport.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: true, p_note: v.note || null }) });
      case 'rf-non': return confirmer(c, { titre: 'Contester le <em>refus</em>', ok: 'Contester', note: 'Pourquoi ?', noteRequise: true, fait: 'Contestation envoyée : l’équipe va trancher',
        texte: 'L’équipe du Marché de Gros tranchera avec le numéro de commande : l’accord, la négociation, vos messages, les photos et la réponse du chauffeur. Les échanges sur le Marché de Gros ne sont pas secrets.',
        fn: v => R('commande_refus_vendeur', { p_id: c.id, p_oui: false, p_note: v.note }) });
      case 'litige': return confirmer(c, { titre: 'Signaler un <em>problème</em>', ok: 'Ouvrir un litige', note: 'Que s’est-il passé ?', noteRequise: true, fait: 'Litige ouvert : l’équipe va examiner',
        texte: 'L’équipe du Marché de Gros examinera l’historique de la commande et les accords enregistrés (prix, quantité, transport), avec le numéro de commande. Elle lit aussi la négociation et vos messages : les échanges sur le Marché de Gros ne sont pas secrets.',
        fn: v => R('commande_litige', { p_id: c.id, p_motif: v.note }) });
    }
  }

  // ——— le transport annoncé (schéma 48) décide des choix proposés à la commande ———
  // offre « inclus » ou demande « le vendeur livre » : le vendeur transporte, pas de transporteur du réseau (le serveur le refuse aussi).
  // offre « inclus hors de ma ville » : autre ville → le vendeur livre ; même ville → l'acheteur s'en charge.
  function choixTransport(n) {
    let a = null; try { a = (N().list(n.cible === 'offre' ? 'offres' : 'demandes') || []).find(x => x._rid === n.cible_id) || null; } catch (_) {}
    const t = a && a.transport, ville = (a && a.city) || n.ville || '';
    // ce qui a été convenu dans la négociation passe avant l'annonce (schéma 49)
    if (n.transport_final === true) return { modes: ['vendeur'], defaut: 'vendeur', lib: { vendeur: 'Le vendeur livre (transport inclus dans l’accord)' }, info: 'L’accord comprend le transport : c’est le vendeur qui livre.' };
    if (n.transport_final === false) return { modes: ['acheteur', 'reseau', 'vendeur'], defaut: 'acheteur', lib: {}, info: 'L’accord est sans transport : l’acheteur s’en charge.' };
    if ((n.cible === 'offre' && t === 'inclus') || (n.cible === 'demande' && t === 'vendeur'))
      return { modes: ['vendeur'], defaut: 'vendeur', lib: { vendeur: 'Le vendeur livre (transport inclus)' }, info: 'Le transport est inclus dans le prix : c’est le vendeur qui s’en occupe.' };
    if (n.cible === 'offre' && t === 'hors_ville')
      return { modes: ['vendeur', 'acheteur', 'reseau'], defaut: 'vendeur', info: 'Le vendeur livre hors ' + (ville ? (/^[aeiouyàâéèêîôh]/i.test(ville) ? 'd’' : 'de ') + ville : 'de sa ville') + ' ; à ' + (ville || 'sa ville') + ', l’acheteur s’en charge.',
        lib: { vendeur: 'Livraison dans une autre ville : le vendeur livre', acheteur: 'Livraison à ' + (ville || 'la même ville') + ' : l’acheteur s’en charge', reseau: 'Livraison à ' + (ville || 'la même ville') + ' avec un transporteur du réseau' } };
    if ((n.cible === 'offre' && t === 'non') || (n.cible === 'demande' && t === 'acheteur'))
      return { modes: ['acheteur', 'reseau', 'vendeur'], defaut: 'acheteur', lib: {}, info: 'Le transport n’est pas inclus : l’acheteur s’en charge, sauf accord avec le vendeur.' };
    return { modes: ['reseau', 'acheteur', 'vendeur'], defaut: 'acheteur', lib: {}, info: '' };
  }
  // ——— le lien de suivi pour son propre chauffeur (schéma 48) ———
  const ago = t => { const m = Math.round((Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + m + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j'; };
  const lienURL = j => new URL('suivi.html?j=' + j, location.href).href;
  function blocLien(c) {
    if (c.mode_transport === 'reseau' || !['a_confirmer', 'en_cours'].includes(c.etat)) return '';
    const L = lien[c.id], moi = c.role === c.mode_transport, qui = c.mode_transport === 'vendeur' ? 'le vendeur' : 'l’acheteur', autre = c.mode_transport === 'vendeur' ? 'l’acheteur' : 'le vendeur';
    const etat = L && L.vu_le ? `<span class="cm-lien-e on">🟢 Le chauffeur partage sa position · ${esc(ago(L.vu_le))}</span>` : L ? '<span class="cm-lien-e">⏳ Le chauffeur n’a pas encore ouvert le lien</span>' : '';
    if (!moi) return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">🛡️</span><b>Suivi de la livraison</b></div>
      ${L ? etat : `<small>Nous avons conseillé à ${qui} de donner un lien de suivi à son chauffeur. Dès qu’il l’ouvre, vous voyez le camion avancer ici.</small>`}</div>`;
    const pourquoi = `<ul class="cm-lien-l"><li><span aria-hidden="true">📍</span>${autre === 'l’acheteur' ? 'L’acheteur' : 'Le vendeur'} voit le camion avancer : moins d’appels, plus de confiance.</li>
      <li><span aria-hidden="true">🔒</span>Sécurité : en cas de retard ou d’incident, la dernière position est connue.</li>
      <li><span aria-hidden="true">📲</span>Sans compte : le chauffeur ouvre le lien et touche « Partager ma position ».</li></ul>`;
    if (!L || !L.jeton) return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">🛡️</span><b>Donnez un lien de suivi à votre chauffeur</b><span class="cm-tag mais">Recommandé</span></div>
      ${pourquoi}<button type="button" class="p" data-lien>📍 Créer le lien de suivi</button><small class="cm-lien-f">Facultatif, mais vivement conseillé pour votre sécurité et celle de ${autre}.</small><p class="cm-err" data-liene role="alert"></p></div>`;
    return `<div class="cm-lien"><div class="cm-lien-h"><span class="cm-lien-i" aria-hidden="true">📍</span><b>Lien de suivi prêt</b></div>
      <small>Envoyez-le à votre chauffeur avant le départ. Il l’ouvre pendant le trajet.</small><code>${esc(lienURL(L.jeton))}</code>${etat}
      <div class="cm-lien-a"><button type="button" class="p" data-lps>📲 Envoyer au chauffeur</button><button type="button" data-lpc>Copier</button></div></div>`;
  }
  function lierLien(c, box) {
    const cr = box.querySelector('[data-lien]');
    if (cr) cr.onclick = async () => { cr.disabled = true; try { await N().rpc('suivi_lien_creer', { p_cmd: c.id }); lien[c.id] = await N().rpc('suivi_lien_etat', { p_cmd: c.id }).catch(() => null); peindre(); }
      catch (x) { const e = box.querySelector('[data-liene]'); if (e) e.textContent = erreurTxt(x); cr.disabled = false; } };
    const L = lien[c.id]; if (!L || !L.jeton) return;
    const url = lienURL(L.jeton), txt = 'Marché de Gros · livraison ' + (c.produit || '') + ' : ouvrez ce lien pendant le trajet pour partager votre position. ' + url;
    const ps = box.querySelector('[data-lps]'), pc = box.querySelector('[data-lpc]');
    if (ps) ps.onclick = async () => { if (navigator.share) { try { await navigator.share({ title: 'Suivi de livraison', text: txt }); return; } catch (_) { return; } } open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank'); };
    if (pc) pc.onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Lien copié', { type: 'ok', sous: 'Collez-le dans un message à votre chauffeur.' }); } catch (_) { toast('Copie impossible', { type: 'erreur', sous: url }); } };
  }

  // ——— créer une commande à partir d'un accord ———
  function creer(n) {
    if (!N() || !N().session()) { if (N()) N().open(); return; }
    monter();
    const box = bg.querySelector('.cm'), u = n.unite || 'unité', q = n.quantite_finale; box.scrollTop = 0; dernierEcran = 'creer';
    const tr = choixTransport(n);
    box.innerHTML = `<button type="button" class="cm-x" data-x aria-label="Fermer">${IC('fermer', 20)}</button>
      <h2>Suivre la <em>commande</em></h2>
      <p class="cm-sous">${esc(n.produit || '')}${q ? ' · ' + qte(q, u) : ''}${n.prix_final != null ? ' · ' + F(n.prix_final) + ' / ' + esc(u) : ''}</p>
      <form class="cm-f" novalidate>
        <label class="t">Qui transporte la marchandise ?</label>
        ${tr.info ? `<p class="cm-info">🚚 ${esc(tr.info)}</p>` : ''}
        ${tr.modes.map(k => `<label class="cm-opt"><input type="radio" name="mode" value="${k}"${k === tr.defaut ? ' checked' : ''}><span><b>${tr.lib[k] || MODES[k]}</b><small>${k === 'reseau' ? 'L’équipe du Marché de Gros vous affecte un transporteur vérifié.' : k === 'acheteur' ? 'L’acheteur envoie son camion ou son chauffeur. Il peut lui donner un lien de suivi.' : 'Le vendeur livre avec son camion ou son chauffeur. Il peut lui donner un lien de suivi.'}</small></span></label>`).join('')}
        <label class="t">Comment valider le chargement et la réception ?</label>
        <label class="cm-opt"><input type="radio" name="val" value="code" checked><span><b>Avec codes — le chauffeur a l’application</b><small><span class="cm-tag mais">Recommandé</span> Le chauffeur tape le code du vendeur au chargement, puis celui de l’acheteur à la réception. Personne ne peut valider à votre place.</small></span></label>
        <label class="cm-opt"><input type="radio" name="val" value="declaration"><span><b>Sans code — nous validons nous-mêmes</b><small>Pour un chauffeur sans l’application : le vendeur déclare le chargement, l’acheteur l’arrivée et la réception.</small></span></label>
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
      const mode = (f.querySelector('[name=mode]:checked') || {}).value, lieu = f.querySelector('#cmLv').value.trim(), val = (f.querySelector('[name=val]:checked') || {}).value || 'declaration';
      if (!mode) { err.textContent = 'Choisissez qui transporte.'; return; }
      if (lieu && N().texteRefus) { const r = N().texteRefus(lieu); if (r) { err.textContent = r; return; } }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true; err.textContent = '';
      try {
        const id = await N().rpc('commande_creer', { p_nego: n.id, p_mode: mode, p_lieu: lieu || null, p_validation: val });
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
      return { k: 'cmd', id: x.id, titre: (x.produit || 'Commande') + (x.quantite != null ? ' · ' + qte(x.quantite, x.unite) : ''), avec: x.partenaire_nom || '', role: x.role,
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
  window.MDGCommandes = { ouvrir, depuisAccord, creer, css, aAgir: () => J(KC(), []).filter(aAgir).length, activite, codes };
})();
