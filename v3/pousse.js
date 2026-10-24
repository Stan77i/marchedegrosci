/* ═════════ Marché de Gros CI — notifications sur le téléphone (Web Push) et pastille sur l'icône ═════════
   Comme Gmail : quand quelqu'un répond à une négociation, le téléphone affiche la notification même si l'application est fermée,
   et le nombre de réponses à lire s'affiche sur l'icône. Hors réseau, la notification arrive dès que le réseau revient.
   - activer() : demande l'accord (toujours après un geste de la personne), abonne le téléphone, l'enregistre (push_abonner),
     puis demande un essai au serveur et rend sa VRAIE réponse ({ telephones, envoyees, raison }) : on ne dit « essai envoyé » que si envoyees > 0 ;
   - à chaque connexion, un téléphone déjà abonné suit le compte connecté ; à la déconnexion, il est retiré (oublier) ;
   - désactiver ou se déconnecter passe par push_quitter (schéma 88a : laisse une trace pour les statistiques), sinon push_desabonner ;
   - une permission retirée dans les réglages du téléphone alors que ce téléphone était abonné est signalée une fois (notif_permission_retiree) ;
   - toucher une notification ouvre l'écran de son adresse (#/?nego=…, #/?commande=…, #/produits/…) ; si personne n'est connecté,
     l'adresse est gardée le temps de la session (sessionStorage) et rouverte juste après la connexion.
   iPhone : les notifications ne marchent que dans l'application ajoutée à l'écran d'accueil (iOS 16.4 et plus).
   Serveur : supabase/schema-6.sql (table, déclencheur) et supabase/functions/pousser (l'envoi). */
(function () {
  'use strict';
  const VAPID = 'BPq_Gi9IHGrRj3yn0AniORH6FVyhJSu0EAt1saBp51K-4txMfWGzUfPCrwL3wtrXP2DC0-65OfyTh9qPXAvX5ME';  // clé publique (la privée reste dans le coffre Supabase)
  const FN = 'https://catmsypctymgkjkfzdkt.supabase.co/functions/v1/pousser';
  const N = () => window.MDGNuage;
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installee = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const cle = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
  const appareil = () => { const u = navigator.userAgent; return (/iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Navigateur') + (installee ? ' · application' : ''); };
  const abonnement = async () => { const r = await navigator.serviceWorker.ready; return r.pushManager.getSubscription(); };

  // 'actif' | 'inactif' | 'refuse' (refusé dans les réglages du téléphone) | 'installer' (iPhone : ajouter à l'écran d'accueil) | 'impossible'
  const KA = 'mdg-pousse:abonne';   // « ce téléphone était abonné » : pour remarquer une permission retirée dans les réglages du téléphone
  async function etat() {
    if (!ok) return ios && !installee ? 'installer' : 'impossible';
    if (Notification.permission === 'denied') { permissionRetiree(); return 'refuse'; }
    const s = await abonnement().catch(() => null);
    const e = s && Notification.permission === 'granted' ? 'actif' : 'inactif';
    try { if (e === 'actif') localStorage.setItem(KA, '1'); } catch (_) {}
    return e;
  }
  function permissionRetiree() {
    try { if (localStorage.getItem(KA) !== '1' || !N() || !N().session()) return; localStorage.removeItem(KA); } catch (_) { return; }
    N().rpc('notif_permission_retiree').catch(() => {});
  }
  // se retirer en laissant une trace (schéma 88a) ; tant que 88a n'est pas en place, l'ancienne fonction
  const quitter = (endpoint, origine) => N().rpc('push_quitter', { p_endpoint: endpoint, p_origine: origine }).catch(() => N().rpc('push_desabonner', { p_endpoint: endpoint }));
  async function enregistrer(s) { const j = s.toJSON(); await N().rpc('push_abonner', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_appareil: appareil() }); }
  async function essai() {
    const ss = N() && N().session(); if (!ss) return null;
    try { const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ss.access_token }, body: JSON.stringify({ test: true }) }); return await r.json(); } catch (_) { return null; }
  }
  async function activer() {
    if (!ok) throw new Error(ios && !installee ? 'INSTALLER' : 'IMPOSSIBLE');
    if (!N() || !N().session()) throw new Error('Connectez-vous d’abord.');
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error(p === 'denied' ? 'REFUS' : 'SANS_REPONSE');
    const r = await navigator.serviceWorker.ready;
    let s = await r.pushManager.getSubscription();
    if (!s) s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cle(VAPID) });
    await enregistrer(s);
    try { localStorage.setItem(KA, '1'); } catch (_) {}
    return (await essai()) || { telephones: 0, envoyees: 0, raison: 'sans_reponse' };
  }
  async function desactiver() { const s = await abonnement().catch(() => null); try { localStorage.removeItem(KA); } catch (_) {} if (!s) return; try { await quitter(s.endpoint, 'desabonnement'); } catch (_) {} try { await s.unsubscribe(); } catch (_) {} }
  // à la déconnexion (la session est encore valable) : ce téléphone ne reçoit plus les notifications de ce compte
  async function oublier() { try { const s = await abonnement(); if (s) await quitter(s.endpoint, 'deconnexion'); } catch (_) {} badge(0); }
  async function suivre() { try { if (!ok || Notification.permission !== 'granted' || !N() || !N().session()) return; const s = await abonnement(); if (s) await enregistrer(s); } catch (_) {} }

  // la pastille sur l'icône : le nombre de réponses à lire (comme le serveur l'envoie avec chaque notification)
  function badge(n) { try { if (!('setAppBadge' in navigator)) return; n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (_) {} }
  const majBadge = () => { const G = window.MDGNegoce, M = window.MDGMessages; badge(N() && N().session() ? (G ? G.unread() : 0) + (M ? M.unread() : 0) : 0); };

  // toucher une notification : ouvrir la négociation
  function depuisAdresse() {
    const m = location.hash.match(/[?&]nego=([0-9a-f-]{36})/); if (!m) return;
    try { history.replaceState(history.state, '', location.hash.replace(/[?&]nego=[0-9a-f-]{36}/, '').replace(/\?$/, '') || '#/'); } catch (_) {}
    const go = (k) => { if (window.MDGNegoce && N() && N().session()) MDGNegoce.thread(m[1]); else if (k < 20) setTimeout(() => go(k + 1), 300); };
    setTimeout(() => go(0), 700);
  }
  if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'mdg-nego' && e.data.nego && window.MDGNegoce) MDGNegoce.thread(e.data.nego);
    if (e.data && e.data.type === 'mdg-pousse-suivre') suivre(); });

  // rejouer l'adresse d'une notification comme le fait sw.js quand l'application est ouverte : les mêmes messages, aux mêmes modules
  function ouvrirLien(url) {
    const u = String(url || ''), sw = navigator.serviceWorker; if (!sw || !u) return;
    const id = k => (new RegExp('[?&]' + k + '=([0-9a-f-]{36})').exec(u) || [])[1], nego = id('nego'), dm = id('dm'), commande = id('commande'), chauffeur = /[?&]chauffeur=1/.test(u);
    const msg = d => { try { sw.dispatchEvent(new MessageEvent('message', { data: d })); } catch (_) {} };
    if (nego) msg({ type: 'mdg-nego', nego }); else if (dm) msg({ type: 'mdg-dm', dm }); else if (commande) msg({ type: 'mdg-commande', commande }); else if (chauffeur) msg({ type: 'mdg-chauffeur' });
    msg({ type: 'mdg-lien', url: u, deja: !!(nego || dm || commande || chauffeur) });
  }
  // ouverte depuis une notification sans être connecté : l'écran demandé attend la connexion (30 min au plus, cet onglet seulement)
  const KL = 'mdg-notif:apres', PRIVE = /[?&](nego|dm|commande|groupe|racheter|besoin|chauffeur|fiabilite|niveaux)=/;
  function garderSiDeconnecte() {
    const h = PRIVE.test(location.hash) ? location.hash : String(window.MDGAdresse0 || ''); if (!PRIVE.test(h)) return;
    setTimeout(() => { try { if (N() && !N().session()) sessionStorage.setItem(KL, JSON.stringify({ h, t: Date.now() })); } catch (_) {} }, 400);
  }
  function rejouerApresConnexion() {
    let x = null; try { x = JSON.parse(sessionStorage.getItem(KL) || 'null'); sessionStorage.removeItem(KL); } catch (_) {}
    if (x && x.h && Date.now() - x.t < 30 * 60e3) setTimeout(() => ouvrirLien('application.dc.html' + x.h), 1200);
  }

  // une seule fois, peu après la connexion dans l'application : la proposition d'activer (un toucher est nécessaire pour demander l'accord)
  async function inviter() {
    try { if (localStorage.getItem('mdg-pousse:invite')) return; } catch (_) { return; }
    if (!document.documentElement.hasAttribute('data-app') || (await etat()) !== 'inactif') return;
    try { localStorage.setItem('mdg-pousse:invite', String(Date.now())); } catch (_) {}
    if (!document.getElementById('ppCss')) { const st = document.createElement('style'); st.id = 'ppCss'; st.textContent = `.pp-inv{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:9500;display:flex;gap:12px;align-items:center;padding:14px 14px 14px 16px;border-radius:22px;background:#24201A;color:#F5F0E6;box-shadow:0 18px 50px rgba(0,0,0,.55),inset 0 0 0 1px rgba(245,240,230,.08);font-family:Jost,system-ui,sans-serif;animation:ppIn .5s cubic-bezier(.22,1,.36,1) both}
.pp-inv.is-out{animation:ppOut .3s ease-in forwards}.pp-inv i{flex:none;width:40px;height:40px;border-radius:13px;display:grid;place-items:center;background:rgba(242,194,48,.16);color:#F2C230}
.pp-inv i svg{animation:ppSonne 2.4s ease-in-out .5s 1}.pp-inv b{display:block;font-size:15px;font-weight:600;line-height:1.25}.pp-inv small{display:block;color:#B9AD98;font-size:12.5px;line-height:1.35;margin-top:2px}
.pp-inv span{flex:1;min-width:0}.pp-inv button{flex:none;min-height:44px;border:0;border-radius:999px;font:600 14px Jost,sans-serif;cursor:pointer}.pp-oui{padding:0 16px;background:#F3EFE4;color:#10392B}.pp-non{padding:0 10px;background:none;color:#B9AD98}
@keyframes ppIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}@keyframes ppOut{to{opacity:0;transform:translateY(20px)}}
@keyframes ppSonne{0%,60%,100%{transform:none}8%{transform:rotate(14deg)}16%{transform:rotate(-12deg)}24%{transform:rotate(8deg)}32%{transform:rotate(-5deg)}}
@media (prefers-reduced-motion:reduce){.pp-inv,.pp-inv i svg{animation:none}}`; document.head.appendChild(st); }
    const el = document.createElement('div'); el.className = 'pp-inv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Notifications');
    el.innerHTML = '<i aria-hidden="true"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" stroke-linejoin="round"/><path d="M10 20a2 2 0 0 0 4 0" stroke-linecap="round"/></svg></i><span><b>Être prévenu dès qu’on vous répond ?</b><small>Même application fermée, comme vos messages.</small></span><button type="button" class="pp-non">Plus tard</button><button type="button" class="pp-oui">Activer</button>';
    document.body.appendChild(el);
    const fermer = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 320); };
    el.querySelector('.pp-non').onclick = fermer;
    el.querySelector('.pp-oui').onclick = async () => { fermer(); try { const r = await activer(); N() && N().toast(r && r.envoyees > 0 ? 'Notifications activées. Un essai vient de partir vers ce téléphone.' : 'Notifications activées, mais l’essai n’est pas parti. Réessayez dans Réglages → Notifications.', { type: r && r.envoyees > 0 ? 'ok' : 'info' }); } catch (x) { const c = String((x && x.message) || ''); const T = { REFUS: 'Vous pourrez les activer plus tard dans Réglages → Notifications.', SANS_REPONSE: 'Pas de réponse du téléphone : réessayez dans Réglages → Notifications.', INSTALLER: 'Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis réessayez.', IMPOSSIBLE: 'Ce téléphone ne reçoit pas les notifications de l’application.' };
      N() && N().toast(T[c] || (window.MDGErreur ? MDGErreur(x) : c || 'Impossible pour l’instant.'), { type: c === 'REFUS' ? 'info' : 'erreur' }); } };
    setTimeout(() => { if (el.isConnected) fermer(); }, 20000);
  }

  window.MDGPousse = { ok, ios, installee, etat, activer, desactiver, oublier, suivre, badge, essai, inviter, ouvrirLien };
  addEventListener('mdg:connecte', () => { setTimeout(suivre, 1500); setTimeout(inviter, 4200); rejouerApresConnexion(); });
  garderSiDeconnecte();
  addEventListener('mdg:negoce', majBadge); addEventListener('mdg:dm', majBadge);
  addEventListener('hashchange', depuisAdresse);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) majBadge(); });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', depuisAdresse); else depuisAdresse();
  setTimeout(() => { suivre(); majBadge(); }, 4000);
})();
