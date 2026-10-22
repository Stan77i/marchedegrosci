/* ═════════ Marché de Gros CI — sur ordinateur, l'administrateur passe de la version mobile à la version site ═════════
   Demandé par le propriétaire le 22/10/2026 : sur PC, l'application ne s'ouvre que pour l'administrateur ;
   lui doit pouvoir afficher la version mobile ET la version site, pour ses manipulations.
   Une petite barre en haut à droite : « Admin · 📱 Mobile | 🖥️ Site ». Seulement sur ordinateur, seulement si l'administrateur
   a été reconnu par le serveur sur ce navigateur (index-v3.html pose mdg-site:admin après est_admin). On revérifie au serveur ici :
   un compte qui n'est plus administrateur perd la barre et l'accès PC.
   Utilisation : <script src="app/admin-pc.js" data-ici="mobile|site"></script> */
(function () {
  'use strict';
  var s = document.currentScript, ici = (s && s.getAttribute('data-ici')) || 'site';
  var tel = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 768;
  var adm = false; try { adm = localStorage.getItem('mdg-site:admin') === '1'; } catch (_) {}
  if (tel || !adm) return;
  var h = function () { return location.hash && location.hash !== '#' ? location.hash : ''; };
  function aller(v) {
    if (v === ici) return;
    try { if (v === 'mobile') sessionStorage.setItem('mdg-app', '1'); else sessionStorage.removeItem('mdg-app'); } catch (_) {}
    location.href = (v === 'mobile' ? 'application.dc.html?app=1' : 'index-v3.html') + h();
  }
  function poser() {
    if (document.getElementById('mdgAdmPc')) return;
    var st = document.createElement('style');
    st.textContent = '#mdgAdmPc{position:fixed;top:12px;right:12px;z-index:2147483300;display:flex;align-items:center;gap:4px;padding:4px;border-radius:999px;background:rgba(23,21,18,.88);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(242,194,48,.35);font:600 13px/1 Jost,system-ui,sans-serif;color:#F3EFE4}'
      + '#mdgAdmPc span{padding:0 8px 0 10px;color:#F2C230;letter-spacing:.08em;text-transform:uppercase;font-size:11px}'
      + '#mdgAdmPc button{border:0;min-height:34px;padding:0 14px;border-radius:999px;background:transparent;color:#F3EFE4;font:600 13px Jost,system-ui,sans-serif;cursor:pointer}'
      + '#mdgAdmPc button[aria-pressed=true]{background:#F2C230;color:#171512;cursor:default}#mdgAdmPc button:focus-visible{outline:2px solid #F2C230;outline-offset:2px}';
    document.head.appendChild(st);
    var b = document.createElement('div'); b.id = 'mdgAdmPc'; b.setAttribute('role', 'group'); b.setAttribute('aria-label', 'Administrateur : choisir la version');
    b.innerHTML = '<span>Admin</span><button type="button" data-v="mobile" aria-pressed="' + (ici === 'mobile') + '">📱 Mobile</button><button type="button" data-v="site" aria-pressed="' + (ici === 'site') + '">🖥️ Site</button>';
    b.addEventListener('click', function (e) { var x = e.target.closest && e.target.closest('[data-v]'); if (x) aller(x.getAttribute('data-v')); });
    document.body.appendChild(b);
  }
  // le serveur décide : plus administrateur → plus de barre, et l'application quitte l'ordinateur
  function verifier(k) {
    var N = window.MDGNuage;
    if (!N || !N.isAdmin) { if (k < 20) setTimeout(function () { verifier(k + 1); }, 500); return; }
    N.isAdmin().then(function (a) {
      if (a) return;
      try { localStorage.removeItem('mdg-site:admin'); sessionStorage.removeItem('mdg-app'); } catch (_) {}
      var b = document.getElementById('mdgAdmPc'); if (b) b.remove();
      if (ici === 'mobile') location.replace('maintenance.html');
    });
  }
  if (document.body) poser(); else addEventListener('DOMContentLoaded', poser);
  verifier(0);
})();
