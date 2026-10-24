/* Marché de Gros CI — thème jour / nuit et page « Réglages » (écrit pour l'app).
   Trois choix : clair, sombre, comme le téléphone (par défaut). Mémorisé sur ce téléphone (mdg-app:theme).
   <html data-theme="clair|sombre"> est posé avant l'affichage, pour éviter un éclair blanc.
   API : MDGTheme.mode() · MDGTheme.choisir('clair'|'sombre'|'auto') · MDGTheme.ouvrir() (la page Réglages) 
   La page Réglages réunit TOUS les réglages (demandé le 22/10) : apparence, notifications du téléphone, annonces du marché,
   sons, messages à l'écran, aide pour débuter (v3/astuces.js), confidentialité. Mon compte et Notifications n'en ont plus. */
(function () {
  'use strict';
  if (window.MDGTheme) return;
  const K = 'mdg-app:theme', mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const lire = () => { try { const v = localStorage.getItem(K); return v === 'clair' || v === 'sombre' ? v : 'auto'; } catch (_) { return 'auto'; } };
  function appliquer() {
    const m = lire(), sombre = m === 'sombre' || (m === 'auto' && mq && mq.matches);
    document.documentElement.setAttribute('data-theme', sombre ? 'sombre' : 'clair');
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', sombre ? '#12110E' : '#F3EFE4');
    dispatchEvent(new CustomEvent('mdg:theme', { detail: { mode: m, sombre } }));
  }
  function choisir(m) { try { if (m === 'auto') localStorage.removeItem(K); else localStorage.setItem(K, m); } catch (_) {} appliquer(); }
  if (mq) (mq.addEventListener ? mq.addEventListener('change', () => { if (lire() === 'auto') appliquer(); }) : mq.addListener(() => { if (lire() === 'auto') appliquer(); }));
  appliquer();

  // ——— la page Réglages (feuille du bas) ———
  const CSS = `.rg-bg{position:fixed;inset:0;z-index:2147483000;background:rgba(10,12,9,.45);display:flex;align-items:flex-end;justify-content:center;animation:rgIn .2s ease both}
.rg{width:100%;max-width:520px;background:#FFFDF8;color:#171512;border-radius:28px 28px 0 0;padding:10px 18px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -12px 40px rgba(16,57,43,.22);font-family:Jost,system-ui,sans-serif;animation:rgUp .38s cubic-bezier(.22,1,.36,1) both}
.rg-p{width:40px;height:4px;border-radius:2px;background:rgba(23,21,18,.16);margin:0 auto 12px}
.rg-h{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px}.rg-h h2{margin:0;font:600 24px/1.15 Jost,sans-serif;letter-spacing:-.015em}
.rg-x{width:44px;height:44px;border:0;border-radius:50%;background:rgba(23,21,18,.06);color:inherit;display:grid;place-items:center;cursor:pointer}
.rg-sec{margin:14px 0 8px;font:600 13px/1 Jost,sans-serif;letter-spacing:0;color:#655C4D}
.rg-l{display:grid;gap:8px}
.rg-o{display:flex;align-items:center;gap:14px;width:100%;min-height:60px;padding:8px 14px 8px 8px;border:1px solid rgba(23,21,18,.08);border-radius:18px;background:#F7F4EC;color:inherit;font:500 16px Jost,sans-serif;text-align:left;cursor:pointer;transition:background .2s,border-color .2s,transform .15s}
.rg-o:active{transform:scale(.985)}
.rg-o i{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:rgba(16,57,43,.08);color:#10392B;font-style:normal}
.rg-o span{flex:1;display:flex;flex-direction:column;gap:2px}.rg-o small{font:400 13px Jost,sans-serif;color:#655C4D}
.rg-o b.ok{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:transparent;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.2)}
.rg-o[aria-checked=true]{background:#EAF3EC;border-color:rgba(16,57,43,.35)}.rg-o[aria-checked=true] b.ok{background:#10392B;color:#FFFDF8;box-shadow:none}
.rg-o:focus-visible,.rg-x:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.rg-n{margin:12px 2px 0;font:400 13px/1.45 Jost,sans-serif;color:#655C4D}
html[data-theme=sombre] .rg{background:#1C1915;color:#F3EFE4}html[data-theme=sombre] .rg-p{background:rgba(243,239,228,.2)}
html[data-theme=sombre] .rg-x{background:rgba(243,239,228,.08)}html[data-theme=sombre] .rg-sec,html[data-theme=sombre] .rg-o small,html[data-theme=sombre] .rg-n{color:#B9AD98}
html[data-theme=sombre] .rg-o{background:#25211B;border-color:rgba(243,239,228,.08)}html[data-theme=sombre] .rg-o i{background:rgba(242,194,48,.14);color:#F2C230}
html[data-theme=sombre] .rg-o b.ok{box-shadow:inset 0 0 0 1.5px rgba(243,239,228,.25)}html[data-theme=sombre] .rg-o[aria-checked=true]{background:rgba(242,194,48,.1);border-color:rgba(242,194,48,.45)}
html[data-theme=sombre] .rg-o[aria-checked=true] b.ok{background:#F2C230;color:#171512}
/* sections ajoutées (22/10) : tous les réglages ici, plus dans Mon compte ni dans Notifications */
.rg{max-height:calc(100dvh - 20px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}
.rg-sw input{flex:none;appearance:none;-webkit-appearance:none;width:52px;height:32px;border-radius:16px;background:rgba(23,21,18,.18);position:relative;cursor:pointer;transition:background .2s;margin:0}
.rg-sw input::after{content:"";position:absolute;left:3px;top:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.25);transition:transform .2s cubic-bezier(.22,1,.36,1)}
.rg-sw input:checked{background:#10392B}.rg-sw input:checked::after{transform:translateX(20px)}.rg-sw input:disabled{opacity:.5}
.rg-sw input:focus-visible{outline:3px solid #10392B;outline-offset:2px}
.rg-bloc{cursor:default}.rg-chev{flex:none;color:#655C4D;display:grid}
.rg-btn{min-height:48px;border:0;border-radius:24px;background:rgba(23,21,18,.07);color:inherit;font:600 15px Jost,sans-serif;cursor:pointer}.rg-btn.plein{background:#10392B;color:#F3EFE4}
html[data-theme=sombre] .rg-sw input{background:rgba(243,239,228,.2)}html[data-theme=sombre] .rg-sw input:checked{background:#F2C230}
html[data-theme=sombre] .rg-btn{background:rgba(243,239,228,.08)}html[data-theme=sombre] .rg-btn.plein{background:#F2C230;color:#171512}html[data-theme=sombre] .rg-chev{color:#B9AD98}
.rg-freq{display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-radius:16px;background:#FFFDF8}.rg-freq>span{font:600 15px/1.3 Jost,sans-serif;color:#171512}.rg-freq small{display:block;margin-top:2px;font:400 13px/1.4 Jost,sans-serif;color:#5E5546}
.rg-freq [role=radiogroup]{display:flex;padding:3px;border-radius:14px;background:rgba(23,21,18,.07)}.rg-freq [role=radio]{flex:1;min-height:42px;padding:0 6px;border:0;border-radius:11px;background:none;color:#4B4436;font:500 13.5px/1.15 Jost,sans-serif;cursor:pointer}
.rg-freq [role=radio][aria-checked=true]{background:#10392B;color:#F3EFE4;font-weight:600}
html[data-theme=sombre] .rg-freq{background:#1E1B16}html[data-theme=sombre] .rg-freq>span{color:#F3EFE4}html[data-theme=sombre] .rg-freq small{color:#CFC4B1}html[data-theme=sombre] .rg-freq [role=radiogroup]{background:#2A261F}html[data-theme=sombre] .rg-freq [role=radio]{color:#E8DFCC}html[data-theme=sombre] .rg-freq [role=radio][aria-checked=true]{background:#F2C230;color:#171512}
.rg-tours{display:flex;flex-wrap:wrap;gap:8px}.rg-tours button{min-height:44px;padding:0 16px;border-radius:22px;border:1px solid rgba(16,57,43,.25);background:#F7F4EC;color:#10392B;font:600 14px Jost,sans-serif;cursor:pointer}
html[data-theme=sombre] .rg-tours button{background:#25211B;color:#F2C230;border-color:rgba(242,194,48,.35)}
@keyframes rgIn{from{opacity:0}}@keyframes rgUp{from{transform:translateY(40px);opacity:.4}}
@media (prefers-reduced-motion:reduce){.rg-bg,.rg{animation:none}.rg-o{transition:none}}`;
  const I = n => (window.MDGIco ? MDGIco.svg(n, 22, 1.9) : '');
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let bg = null, retour = null;
  function fermer() { if (!bg) return; bg.remove(); bg = null; removeEventListener('keydown', cle); try { retour && retour.focus(); } catch (_) {} }
  function cle(e) { if (e.key === 'Escape') fermer(); }
  function ouvrir() {
    if (!document.getElementById('rgCss')) { const st = document.createElement('style'); st.id = 'rgCss'; st.textContent = CSS; document.head.appendChild(st); }
    fermer(); retour = document.activeElement;
    bg = document.createElement('div'); bg.className = 'rg-bg';
    // état lu à l'ouverture (puis redessiné) : notifications du téléphone, annonces du marché (serveur), profil
    const N = () => window.MDGNuage, connecte = () => !!(N() && N().session && N().session());
    const st = { pousse: null, diff: null };
    const lirePrefs = () => { try { return Object.assign({ toasts: true }, JSON.parse(localStorage.getItem('mdg-compte:prefs') || '{}')); } catch (_) { return { toasts: true }; } };
    const dire = t => { try { window.MDGToast ? MDGToast.dire(t, { type: 'ok' }) : (N() && N().toast(t)); } catch (_) {} };
    const POUSSE = {
      actif: ['Activées sur ce téléphone', 'Une réponse à votre prix, un accord, un refus : vous êtes prévenu tout de suite, même application fermée.', 'Désactiver', 'off'],
      inactif: ['Être prévenu même application fermée', 'Dès qu’on vous répond, votre téléphone vous le dit.', 'Activer les notifications', 'on'],
      refuse: ['Bloquées sur ce téléphone', 'Réglages du téléphone → Notifications → Marché de Gros → Autoriser, puis revenez ici.', '', ''],
      installer: ['Sur iPhone : ajoutez d’abord l’application', 'Touchez Partager, puis « Sur l’écran d’accueil ». Ouvrez-la depuis l’icône, puis activez ici.', '', ''],
      impossible: ['Indisponibles dans ce navigateur', 'Ouvrez le Marché de Gros dans l’application installée, ou dans Chrome, Safari ou Edge à jour.', '', '']
    };
    const sw = (k, t, sm, on, dis) => `<label class="rg-o rg-sw"><i>${I(k)}</i><span>${t}<small>${sm}</small></span><input type="checkbox" role="switch" data-sw="${t}"${on ? ' checked' : ''}${dis ? ' disabled' : ''}></label>`;
    const peindre = () => { const m = lire(), pf = lirePrefs(), S = window.MDGSons, sn = S ? S.reglages() : null;
      const C = window.MDGCompte, pr = C && C.profil ? C.profil() : null, P = window.MDGPousse;
      const o = (k, ico, t, s) => `<button type="button" class="rg-o" role="radio" aria-checked="${m === k}" data-m="${k}"><i>${I(ico)}</i><span>${t}<small>${s}</small></span><b class="ok" aria-hidden="true">✓</b></button>`;
      const T = POUSSE[st.pousse || (P ? 'inactif' : 'impossible')] || POUSSE.impossible;
      bg.innerHTML = `<div class="rg" role="dialog" aria-modal="true" aria-labelledby="rgT"><div class="rg-p"></div>
        <div class="rg-h"><h2 id="rgT">Réglages</h2><button type="button" class="rg-x" aria-label="Fermer">${I('fermer')}</button></div>
        <p class="rg-sec">Apparence</p>
        <div class="rg-l" role="radiogroup" aria-label="Apparence">${o('clair', 'jour', 'Clair', 'Fond crème, idéal en plein jour')}${o('sombre', 'nuit', 'Sombre', 'Fond foncé, plus doux le soir')}${o('auto', 'telephone', 'Comme le téléphone', 'Suit le réglage jour / nuit du téléphone')}</div>
        <p class="rg-sec">Notifications</p>
        <div class="rg-l">
          <div class="rg-o rg-bloc"><i>${I('cloche')}</i><span>${T[0]}<small>${T[1]}</small></span></div>
          ${T[2] && connecte() ? `<button type="button" class="rg-btn${T[3] === 'on' ? ' plein' : ''}" data-pousse="${T[3]}">${T[2]}</button>` : ''}
          ${connecte() ? sw('cloche', 'Annonces du marché', 'Nouvelles offres et demandes, achats groupés, besoins des pros, conseils. Vos notifications personnelles restent toujours actives.', st.diff !== false, st.diff === null) : '<p class="rg-n" style="margin:2px 2px 0">Connectez-vous pour régler les notifications.</p>'}
        </div>
        <p class="rg-sec">Sons et écran</p>
        <div class="rg-l">
          ${S ? `<button type="button" class="rg-o" data-sons><i>${I('son')}</i><span>Sons<small>Notes de balafon · ${sn && sn.on ? 'activés' : 'désactivés'}</small></span><b class="rg-chev" aria-hidden="true">${I('suite')}</b></button>` : ''}
          ${window.MDGVibre ? sw('vibre', 'Vibrations au toucher', MDGVibre.possible ? 'Un petit tic quand vous touchez un bouton ou faites tourner les produits de l’accueil' + (/iP(hone|ad)/.test(navigator.userAgent) ? ' (iPhone : iOS 18 ou plus)' : '') : 'Ce navigateur ne permet pas les vibrations', MDGVibre.actif(), !MDGVibre.possible) : ''}
          ${sw('ecran', 'Messages à l’écran', 'Une ligne quand une proposition arrive, est acceptée ou refusée', pf.toasts !== false)}
        </div>
        ${window.MDGAstuces ? `<p class="rg-sec">Aide pour débuter</p>
        <div class="rg-l">${sw('comment', 'Astuces et tutoriels', 'Petits signes animés sur l’accueil, et un court tutoriel la première fois qu’on fait une opération (négocier, commande, codes, chauffeur)', MDGAstuces.actif())}
          ${MDGAstuces.actif() && MDGAstuces.frequence ? (() => { const f = MDGAstuces.frequence(), b = (k, t) => `<button type="button" role="radio" aria-checked="${f === k}" data-freq="${k}">${t}</button>`;
            return `<div class="rg-freq"><span>Fréquence<small>${f === 'une' ? 'Chaque astuce, tutoriel et démo s’affiche une seule fois.' : f === 'semaine' ? 'Tout revient une fois par semaine, comme pour un nouveau.' : 'Tout revient à chaque ouverture de l’application.'}</small></span><div role="radiogroup" aria-label="Fréquence des astuces et des démos">${b('une', 'Une fois')}${b('semaine', 'Chaque semaine')}${b('toujours', 'À chaque ouverture')}</div></div>`; })() : ''}
          ${window.MDGDemo && MDGAstuces.actif() ? sw('apercu', 'Démo de la roue au démarrage', 'L’accueil montre tout seul la roue des produits, le prix et « placer son prix »', MDGDemo.reglages().auto) : ''}
          ${window.MDGDemo ? sw('tableau', 'Bouton « Démo » sur l’accueil', 'Le petit interrupteur au-dessus de la roue, pour rejouer la démo quand vous voulez', MDGDemo.reglages().bouton) : ''}
          ${window.MDGDemo ? '<button type="button" class="rg-demo" data-demo style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:46px;margin:8px 0 4px;border:0;border-radius:14px;background:#F2C230;color:#171512;font:600 15px Jost,sans-serif;cursor:pointer">' + (window.MDGIco ? MDGIco.svg('suite', 16, 2) : '') + 'Voir la démo : la roue et les prix</button>' : ''}
          <p class="rg-n" style="margin:4px 2px 0">Revoir un tutoriel :</p>
          <div class="rg-tours">${Object.keys(MDGAstuces.TOURS).map(k => `<button type="button" data-tour="${k}">${esc(MDGAstuces.TOURS[k].t)}</button>`).join('')}</div></div>` : ''}
        ${pr && connecte() && !(window.MDGStatut && MDGStatut.estOfficiel && N().session().user && MDGStatut.estOfficiel(N().session().user.id)) ? `<p class="rg-sec">Confidentialité</p>
        <p class="rg-n" style="margin:4px 2px 8px">Vos échanges (négociations, messages, litiges) ne sont pas secrets : l’équipe du Marché de Gros peut les lire pour vérifier un accord ou régler un litige. Ils sont gardés 1 an. Votre numéro, lui, n’est jamais montré aux autres membres.</p>
        <div class="rg-l">${sw('oeil', 'Montrer mon nom de famille', 'Sinon, les autres voient « ' + esc(pr.prenom || 'Prénom') + ' ' + esc(pr.nom ? pr.nom[0] + '.' : 'N.') + ' ». Votre numéro n’est jamais affiché.', !!pr.nom_public)}</div>` : ''}
        <p class="rg-n">L’apparence, les sons, les vibrations et les messages à l’écran restent sur ce téléphone.</p></div>`;
      bg.querySelector('.rg-x').onclick = fermer;
      bg.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { choisir(b.dataset.m); peindre(); const f = bg.querySelector(`[data-m="${b.dataset.m}"]`); if (f) f.focus(); });
      const bp = bg.querySelector('[data-pousse]');
      if (bp) bp.onclick = async () => { bp.disabled = true; bp.textContent = bp.dataset.pousse === 'on' ? 'Activation…' : 'Un instant…';
        try { if (bp.dataset.pousse === 'on') { await P.activer(); dire('Notifications *activées*'); } else { await P.desactiver(); dire('Notifications *désactivées* sur ce téléphone'); } }
        catch (x) { dire(String(x && x.message) === 'REFUS' ? 'Autorisez les notifications dans les réglages du téléphone, puis réessayez.' : 'Impossible pour l’instant. Réessayez.'); }
        st.pousse = P ? await P.etat() : 'impossible'; peindre(); };
      const dmo = bg.querySelector('[data-demo]'); if (dmo) dmo.onclick = () => { fermer(); if (location.hash && location.hash !== '#/') location.hash = '#/';
        setTimeout(() => { const b = [...document.querySelectorAll('.acc-ong button')].find(x => x.textContent.trim().startsWith('Marché')); if (b) b.click(); setTimeout(() => MDGDemo.lancer(), 600); }, 350); };
      bg.querySelectorAll('[data-freq]').forEach(b => b.onclick = () => { MDGAstuces.frequence(b.dataset.freq); dire('Fréquence *enregistrée*'); peindre(); const f = bg.querySelector(`[data-freq="${b.dataset.freq}"]`); if (f) f.focus(); });
      bg.querySelectorAll('[data-tour]').forEach(b => b.onclick = () => { const k = b.dataset.tour; fermer(); setTimeout(() => MDGAstuces.tour(k, true), 250); });
      const so = bg.querySelector('[data-sons]'); if (so) so.onclick = () => { fermer(); S.panneau(); };
      bg.querySelectorAll('[data-sw]').forEach(i => i.onchange = async () => {
        const k = i.dataset.sw; i.disabled = true;
        try {
          if (k === 'Annonces du marché') { await N().rpc('notif_reglage_diffusions', { p_oui: i.checked }); st.diff = i.checked; dire(i.checked ? 'Annonces du marché *activées*' : 'Annonces du marché *coupées*'); }
          else if (k === 'Vibrations au toucher') { MDGVibre.regler(i.checked); dire(i.checked ? 'Vibrations *activées*' : 'Vibrations *coupées*'); }
          else if (k === 'Astuces et tutoriels') { if (i.checked) { MDGAstuces.revoir(); try { localStorage.removeItem('mdg-demo:orbite'); } catch (_) {} } else MDGAstuces.regler(false); dire(i.checked ? 'Astuces *activées* : elles reviennent comme pour un nouveau' : 'Astuces, tutoriels et démo automatique *coupés*'); setTimeout(peindre, 0); }
          else if (k === 'Démo de la roue au démarrage') { MDGDemo.regler({ auto: i.checked }); dire(i.checked ? 'Démo au démarrage *activée*' : 'Démo au démarrage *coupée*'); }
          else if (k === 'Bouton « Démo » sur l’accueil') { MDGDemo.regler({ bouton: i.checked }); dire(i.checked ? 'Bouton Démo *affiché*' : 'Bouton Démo *caché* : la démo reste ici, dans les réglages'); }
          else if (k === 'Messages à l’écran') { const o = lirePrefs(); o.toasts = i.checked; localStorage.setItem('mdg-compte:prefs', JSON.stringify(o)); dire('Réglage *enregistré*'); }
          else if (k === 'Montrer mon nom de famille' && C && C.regler) { await C.regler({ nom_public: i.checked }); dire('Réglage *enregistré*'); }
        } catch (x) { i.checked = !i.checked; dire('Impossible : ' + ((x && x.message) || 'réessayez')); }
        i.disabled = false;
      });
    };
    // lectures asynchrones, puis on redessine
    // deux lectures indépendantes : l'une ne bloque jamais l'autre (l'état du téléphone peut tarder, 4 s au plus)
    (async () => { const P = window.MDGPousse;
      try { st.pousse = P ? await Promise.race([P.etat(), new Promise(r => setTimeout(() => r('inactif'), 4000))]) : 'impossible'; } catch (_) { st.pousse = 'impossible'; }
      if (bg) peindre(); })();
    (async () => { if (!connecte()) return;
      try { const r = await N().rpc('notif_reglage_moi'); st.diff = !(r && r.diffusions === false); } catch (_) { st.diff = true; }
      if (bg) peindre(); })();
    peindre();
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    addEventListener('keydown', cle); document.body.appendChild(bg);
    setTimeout(() => { const f = bg && bg.querySelector('[aria-checked=true]'); if (f) f.focus(); }, 60);
  }
  window.MDGTheme = { mode: lire, choisir, ouvrir };
})();
