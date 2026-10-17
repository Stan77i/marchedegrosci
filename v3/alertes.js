/* ═════════ Marché de Gros CI — alertes par produit ═════════
   Chacun choisit les produits qui l'intéressent (igname, tomate…) et ce qu'il veut savoir : les nouvelles offres, les nouvelles
   demandes, ou les deux. À chaque nouvelle annonce de ce produit, son téléphone reçoit une notification (fonction Edge « pousser »).
   Serveur : supabase/schema-12-stock-alertes-profil.sql (table alertes_produits, déclencheur push_annonce).
   API : MDGAlertes.suit(slug) · panneau(slug, nom) · gerer() · refresh() ; événement « mdg:alertes » quand la liste change. */
(function () {
  'use strict';
  const KL = 'mdg-alertes:liste';
  const N = () => window.MDGNuage;
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nomDe = slug => { const p = window.MDG && MDG.products && MDG.products.find(x => x.slug === slug); return p ? p.name : slug; };
  let liste = J(KL, []);
  const dire = () => dispatchEvent(new CustomEvent('mdg:alertes'));
  const suit = slug => liste.find(a => a.product_slug === slug) || null;

  async function refresh() {
    if (!N() || !N().session() || !navigator.onLine) return liste;
    try { liste = await N().api('/rest/v1/alertes_produits?select=*&order=created_at.desc', { auth: true }) || []; W(KL, liste); dire(); } catch (_) {}
    return liste;
  }
  async function enregistrer(slug, offres, demandes) {
    if (!offres && !demandes) { await N().api('/rest/v1/alertes_produits?product_slug=eq.' + encodeURIComponent(slug), { method: 'DELETE', auth: true }); liste = liste.filter(a => a.product_slug !== slug); }
    else { const r = await N().api('/rest/v1/alertes_produits?on_conflict=user_id,product_slug', { method: 'POST', auth: true, body: { product_slug: slug, offres, demandes }, prefer: 'return=representation,resolution=merge-duplicates' });
      liste = liste.filter(a => a.product_slug !== slug).concat(r || []); }
    W(KL, liste); dire();
  }

  const CSS = `.al-bg{position:fixed;inset:0;z-index:9300;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}
@media (min-width:720px){.al-bg{align-items:center;padding:24px}}
.al{position:relative;width:100%;max-width:480px;max-height:min(88dvh,780px);overflow:auto;background:#F4EEE3;color:#171512;border-radius:28px 28px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));font:400 15px/1.5 Jost,system-ui,sans-serif;box-shadow:0 -10px 50px rgba(0,0,0,.5)}
@media (min-width:720px){.al{border-radius:28px}}
.al h2{margin:0 48px 4px 0;font:500 28px/1.1 'Cormorant Garamond',Georgia,serif}.al>p{margin:0 0 16px;color:#655C4D;font-size:14px}
.al-x{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:#171512;font-size:20px;cursor:pointer}
.al-sw{display:flex;align-items:center;gap:14px;width:100%;min-height:62px;margin:0 0 8px;padding:10px 14px;border:1px solid transparent;border-radius:18px;background:#FFFDF8;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.04);color:#171512;font:600 15px Jost,sans-serif;text-align:left;cursor:pointer}
.al-sw small{display:block;color:#655C4D;font-weight:400;font-size:12.5px}.al-sw span{flex:1}
.al-sw i{flex:none;position:relative;width:46px;height:28px;border-radius:14px;background:rgba(23,21,18,.16);transition:background .2s}
.al-sw i::after{content:"";position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .2s}
.al-sw[aria-pressed=true]{border-color:rgba(224,122,63,.6)}.al-sw[aria-pressed=true] i{background:#E07A3F}.al-sw[aria-pressed=true] i::after{transform:translateX(18px)}
.al-go{width:100%;min-height:52px;margin-top:10px;border:0;border-radius:999px;background:#E07A3F;color:#171512;font:700 15.5px Jost,sans-serif;cursor:pointer}.al-go:disabled{opacity:.5}
.al-note{margin:12px 0 0;color:#857A67;font-size:12.5px;line-height:1.45}
.al-l{display:flex;flex-direction:column;gap:8px}.al-r{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:rgba(23,21,18,.04);box-shadow:inset 0 0 0 1px rgba(23,21,18,.08)}
.al-r b{display:block;font-size:15px}.al-r small{color:#655C4D;font-size:12.5px}.al-r span{flex:1;min-width:0}
.al-r button{min-height:40px;padding:0 14px;border:0;border-radius:999px;background:#EFE7D9;color:#171512;font:600 13px Jost,sans-serif;cursor:pointer}
.al-vide{padding:22px 16px;border:1px dashed rgba(23,21,18,.16);border-radius:18px;text-align:center;color:#655C4D;font-size:14px}
.al-add{display:flex;gap:8px;margin:0 0 14px}.al-add select{flex:1;min-width:0;height:48px;padding:0 12px;border:1px solid rgba(23,21,18,.16);border-radius:14px;background:#FFFFFF;color:#171512;font:500 15px Jost,sans-serif}
.al-add button{flex:none;min-height:48px;padding:0 16px;border:0;border-radius:14px;background:#171512;color:#F5F0E6;font:700 14px Jost,sans-serif;cursor:pointer}`;
  function feuille(html, label) {
    if (!document.getElementById('alCss')) { const st = document.createElement('style'); st.id = 'alCss'; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement('div'); bg.className = 'al-bg';
    bg.innerHTML = `<div class="al" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="al-x" aria-label="Fermer">×</button>${html}</div>`;
    document.body.appendChild(bg);
    const rendre = N() && N().piege ? N().piege(bg) : null, k = e => { if (e.key === 'Escape') fermer(); };
    const fermer = () => { bg.remove(); removeEventListener('keydown', k); rendre && rendre(); };
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); }); bg.querySelector('.al-x').onclick = fermer; addEventListener('keydown', k);
    bg.fermer = fermer; return bg;
  }
  const pousseNote = () => { const P = window.MDGPousse; if (!P || !P.ok) return 'Ce téléphone ne peut pas recevoir de notifications.' + (P && P.ios && !P.installee ? ' Sur iPhone, ajoutez d’abord l’application à l’écran d’accueil.' : '');
    return P.ios && !P.installee ? 'Sur iPhone, les notifications marchent quand l’application est ajoutée à l’écran d’accueil.' : 'Les notifications arrivent même application fermée.'; };

  // ——— un produit : offres, demandes ———
  function panneau(slug, nom) {
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour recevoir les alertes de ce produit.'); return; }
    nom = nom || nomDe(slug); const a = suit(slug); let o = a ? a.offres : true, d = a ? a.demandes : false;
    const bg = feuille(`<h2>Alertes · ${esc(nom)}</h2><p>Recevez une notification dès qu’une annonce de ${esc(nom.toLowerCase())} est publiée.</p>
      <button type="button" class="al-sw" data-k="o"><span>Nouvelles offres<small>Quelqu’un vend ce produit</small></span><i aria-hidden="true"></i></button>
      <button type="button" class="al-sw" data-k="d"><span>Nouvelles demandes<small>Quelqu’un cherche ce produit</small></span><i aria-hidden="true"></i></button>
      <button type="button" class="al-go">Enregistrer</button><p class="al-note">${esc(pousseNote())}</p>`, 'Alertes ' + nom);
    const maj = () => { bg.querySelector('[data-k=o]').setAttribute('aria-pressed', String(o)); bg.querySelector('[data-k=d]').setAttribute('aria-pressed', String(d)); bg.querySelector('.al-go').textContent = !o && !d ? (a ? 'Ne plus m’alerter' : 'Choisissez au moins une alerte') : 'Enregistrer'; bg.querySelector('.al-go').disabled = !o && !d && !a; };
    bg.querySelector('[data-k=o]').onclick = () => { o = !o; maj(); }; bg.querySelector('[data-k=d]').onclick = () => { d = !d; maj(); }; maj();
    bg.querySelector('.al-go').onclick = async e => { e.target.disabled = true;
      try { await enregistrer(slug, o, d); bg.fermer(); N().toast(o || d ? 'Alerte enregistrée : ' + nom + '.' : 'Plus d’alerte pour ' + nom + '.');
        const P = window.MDGPousse; if ((o || d) && P && P.ok && P.etat && (await P.etat()) !== 'actif' && P.inviter) P.inviter(); }
      catch (x) { e.target.disabled = false; N().toast(/alertes_produits|schema cache|Could not find/i.test(String(x.message)) ? 'Pas encore activé sur le serveur.' : 'Impossible : ' + x.message); } };
  }

  // ——— toutes mes alertes ———
  function gerer() {
    if (!N() || !N().session()) { N() && N().open('Connectez-vous pour choisir vos alertes produits.'); return; }
    const prods = (window.MDG && MDG.products || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const bg = feuille(`<h2>Alertes produits</h2><p>Choisissez les produits pour lesquels votre téléphone vous prévient : igname, tomate…</p>
      <div class="al-add"><select aria-label="Produit à suivre"><option value="">Ajouter un produit…</option>${prods.map(p => `<option value="${esc(p.slug)}">${esc(p.name)}</option>`).join('')}</select><button type="button">Suivre</button></div>
      <div class="al-l" data-l></div><p class="al-note">${esc(pousseNote())}</p>`, 'Alertes produits');
    const dessiner = () => { const box = bg.querySelector('[data-l]'); if (!box) return;
      box.innerHTML = liste.length ? liste.map(a => `<div class="al-r"><span><b>${esc(nomDe(a.product_slug))}</b><small>${a.offres && a.demandes ? 'Offres et demandes' : a.offres ? 'Nouvelles offres' : 'Nouvelles demandes'}</small></span><button type="button" data-m="${esc(a.product_slug)}">Modifier</button></div>`).join('') : '<div class="al-vide">Aucune alerte pour l’instant.</div>';
      box.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { bg.fermer(); panneau(b.dataset.m); }); };
    bg.querySelector('.al-add button').onclick = () => { const v = bg.querySelector('.al-add select').value; if (!v) return; bg.fermer(); panneau(v); };
    dessiner(); refresh().then(() => { if (bg.isConnected) dessiner(); });
  }

  window.MDGAlertes = { suit, panneau, gerer, refresh, liste: () => liste };
  addEventListener('mdg:connecte', () => setTimeout(refresh, 1500));
  addEventListener('mdg:nuage', e => { if (e.detail && e.detail.kind === 'compte' && !(N() && N().session())) { liste = []; W(KL, []); dire(); } });
  setTimeout(refresh, 3000);
})();
