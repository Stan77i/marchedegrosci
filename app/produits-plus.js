/* ═════════ Marché de Gros CI : produits ajoutés par l'équipe, demandes de produit (schéma 104, 17/11/2026) ═════════
   • Au chargement : la table produits_ajoutes (lisible par tous) complète le catalogue (v2/data.js) AVANT la recherche ;
     une copie reste sur le téléphone pour le hors ligne. Sans la table (serveur pas encore à jour), rien ne change.
   • « Mon produit n'est pas dans la liste » : un membre connecté demande un produit (nom, famille ; unité et nom local
     facultatifs) ou un nom local d'un produit existant. Avant l'envoi : « Vous voulez dire… ? » et « Moi aussi » quand la
     même demande attend déjà. 3 demandes en attente au plus (le serveur refuse au-delà). Rien n'est publié pendant l'attente.
   • Les mots cherchés sans résultat sont comptés par le serveur, sans rien de personnel (une fois par mot et par session).
   API : MDGProduits.ouvrir({ nom, type, slug, choisir }), mes(), relire(), lire(), vide(mot), charge(), quand(f) */
(function () {
  'use strict';
  const MDG = window.MDG || {}, N = () => window.MDGNuage;
  const K = 'mdg-produits-plus', KA = 'mdg-produits-plus:absent', KM = 'mdg-produits:mes';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const dire = m => { const n = N(); if (n && n.toast) n.toast(m); };
  const ERR = e => window.MDGErreur ? MDGErreur(e) : String((e && e.message) || e || 'Impossible pour l’instant.').replace(/^[A-Z_]{3,} : /, '');
  const absente = e => /schema cache|Could not find|PGRST20[25]|does not exist|404/i.test(String((e && e.message) || '') + ' ' + ((e && e.status) || ''));
  // le serveur n'a pas encore le schéma 104 : on ne redemande pas avant 12 h (pas de requête inutile à chaque ouverture)
  const sansServeur = () => Date.now() - (+J(KA, 0) || 0) < 12 * 36e5;
  const noterAbsent = () => W(KA, Date.now());

  /* ——— 1. le catalogue complété ——— */
  function fusionner(L) {
    const P = MDG.products; if (!Array.isArray(P) || !Array.isArray(L)) return false;
    let change = false;
    L.forEach(x => {
      if (!x || !x.slug) return;
      const al = (x.alias || []).filter(Boolean), p = P.find(y => y.slug === x.slug);
      if (x.type !== 'alias' && x.nom && x.famille && !p) { P.push({ slug: x.slug, name: x.nom, categorySlug: x.famille, aliases: al.slice(), unit: x.unite || '', ajoute: true }); change = true; return; }
      if (!p) return;
      p.aliases = p.aliases || [];
      al.forEach(a => { if (!p.aliases.some(b => norm(b) === norm(a)) && norm(a) !== norm(p.name)) { p.aliases.push(a); change = true; } });
    });
    return change;
  }
  fusionner(J(K, []));   // tout de suite, avant que l'application ne construise son index de recherche

  let fait = false; const attente = [];
  const finir = () => { fait = true; attente.splice(0).forEach(f => { try { f(); } catch (_) {} }); };
  async function lire() {
    const n = N(); if (!n || !n.api || sansServeur()) { finir(); return; }
    try {
      const L = await n.api('/rest/v1/produits_ajoutes?select=slug,type,nom,famille,unite,alias&actif=eq.true&limit=1000');
      if (Array.isArray(L)) {
        W(K, L);
        if (fusionner(L)) {
          if (MDG.search && MDG.search.reconstruire) MDG.search.reconstruire();
          dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'produits' } }));
        }
      }
    } catch (e) { if (absente(e)) noterAbsent(); }
    finir();
  }

  /* ——— 2. mes demandes (Activité) ——— */
  let mesL = J(KM, []);
  async function relire() {
    const n = N(); if (!n || !n.session || !n.session() || sansServeur()) return mesL;
    try { const r = await n.rpc('mes_produits_demandes'); mesL = Array.isArray(r) ? r : []; W(KM, mesL); dispatchEvent(new CustomEvent('mdg:change', { detail: { from: 'produits' } })); }
    catch (e) { if (absente(e)) noterAbsent(); }
    return mesL;
  }
  const mes = () => (N() && N().session && N().session() ? mesL : []);

  /* ——— 3. mots cherchés sans résultat : 2 s après la dernière frappe, une fois par mot et par session ——— */
  let tVide = null, motVide = '';
  function vide(mot) {
    const m = norm(mot).replace(/\d+/g, ' ').replace(/\s+/g, ' ').trim();
    if (m.length < 2 || m.length > 60 || m === motVide) return;
    motVide = m; clearTimeout(tVide);
    tVide = setTimeout(() => {
      let vus = []; try { vus = JSON.parse(sessionStorage.getItem('mdg-vides') || '[]'); } catch (_) {}
      if (vus.includes(m) || sansServeur()) return;
      vus.push(m); try { sessionStorage.setItem('mdg-vides', JSON.stringify(vus.slice(-50))); } catch (_) {}
      const n = N(); if (n && n.rpc) n.rpc('recherche_vide', { p_mot: m }, false).catch(e => { if (absente(e)) noterAbsent(); });
    }, 2000);
  }
  const annulerVide = () => { clearTimeout(tVide); motVide = ''; };

  /* ——— 4. le formulaire ——— */
  const famille = s => ((MDG.categories || []).find(c => c.slug === s) || {}).name || '';
  const familles = () => (MDG.categories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const UNITES = () => (window.MDGApp && MDGApp.UNITS) || ['kg', 'sac', 'carton', 'tonne', 'litre', 'régime', 'cageot', 'unité'];
  const optsProduits = sel => familles().map(c => `<optgroup label="${esc(c.name)}">${(MDG.products || []).filter(p => p.categorySlug === c.slug)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')).map(p => `<option value="${esc(p.slug)}"${p.slug === sel ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  // les produits proches du nom tapé (index de recherche v2/search.js : nom, nom local, faute légère)
  function proches(nom) {
    const S = MDG.search, q = String(nom || '').trim(); if (!S || q.length < 2) return [];
    const ps = S.parse(q), vus = new Set(), out = [];
    const add = x => { const slug = x && (x.slug || (x.product && x.product.slug)); if (!slug || vus.has(slug)) return; vus.add(slug); const p = (MDG.products || []).find(y => y.slug === slug); if (p) out.push(p); };
    if (ps.product) add(ps.product); (ps.candidates || []).forEach(add); S.suggest(q, 4).forEach(add);
    return out.slice(0, 3);
  }

  let bg = null;
  function ouvrir(o) {
    o = o || {};
    const n = N(); if (!n) return;
    if (!n.session || !n.session()) {
      const apres = () => { removeEventListener('mdg:connecte', apres); setTimeout(() => ouvrir(o), 400); };
      addEventListener('mdg:connecte', apres); return n.open ? n.open('Connectez-vous pour demander un produit.') : null;
    }
    fermer();
    const st = { type: o.type === 'alias' ? 'alias' : 'produit', trouve: null, envoi: false, jeton: 0 };
    const retour = document.activeElement;
    bg = document.createElement('div'); bg.className = 'eq-fbg pd-bg'; bg.setAttribute('data-v2', '');
    bg.innerHTML = `<form class="eq-f pd" role="dialog" aria-modal="true" aria-labelledby="pdT" novalidate>
      <div class="pd-tete"><h2 id="pdT" class="pd-h">Demander un produit</h2><button type="button" class="pd-x" data-non aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="pd-seg" role="radiogroup" aria-label="Type de demande">
        <button type="button" role="radio" data-ty="produit">Produit nouveau</button><button type="button" role="radio" data-ty="alias">Nom local</button></div>
      <label class="eq-lab"><span data-l-nom>Nom du produit</span><input name="nom" maxlength="60" autocomplete="off" autocapitalize="sentences" value="${esc(o.nom || '')}" required></label>
      <div class="pd-proches" data-proches aria-live="polite"></div>
      <label class="eq-lab" data-z-fam>Famille<select name="fam" required><option value="">Choisir</option>${familles().map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('')}</select></label>
      <label class="eq-lab" data-z-prod hidden>C’est un autre nom de<select name="slug"><option value="">Choisir le produit</option>${optsProduits(o.slug)}</select></label>
      <div class="pd-duo" data-z-plus>
        <label class="eq-lab">Unité <i>· facultatif</i><select name="unite"><option value="">—</option>${UNITES().map(u => `<option>${esc(u)}</option>`).join('')}</select></label>
        <label class="eq-lab">Nom local <i>· facultatif</i><input name="local" maxlength="60" autocomplete="off"></label>
      </div>
      <p class="pd-deja" data-deja hidden></p>
      <p class="eq-ferr" role="alert"></p>
      <button type="submit" class="eq-go" data-ok>Envoyer la demande</button>
      <p class="pd-note">Pendant l’attente, l’annonce de ce produit ne peut pas être publiée.</p>
    </form>`;
    document.body.appendChild(bg);
    const f = bg.querySelector('form'), E = f.elements, err = f.querySelector('.eq-ferr'), ok = f.querySelector('[data-ok]'), deja = f.querySelector('[data-deja]');
    const fin = () => { document.removeEventListener('keydown', cle, true); fermer(); if (retour && retour.isConnected && retour.focus) retour.focus({ preventScroll: true }); };
    const cle = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fin(); } };
    document.addEventListener('keydown', cle, true);
    bg.addEventListener('click', e => { if (e.target === bg) fin(); });
    f.querySelector('[data-non]').onclick = fin;

    const peindre = () => {
      f.querySelectorAll('[data-ty]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.ty === st.type)));
      const al = st.type === 'alias';
      f.querySelector('[data-l-nom]').textContent = al ? 'Nom local' : 'Nom du produit';
      f.querySelector('[data-z-fam]').hidden = al; f.querySelector('[data-z-prod]').hidden = !al; f.querySelector('[data-z-plus]').hidden = al;
      const t = st.trouve;
      deja.hidden = !t;
      if (t) deja.innerHTML = t.moi ? 'Vous l’avez déjà demandé. Nous vous prévenons dès la réponse.'
        : `Déjà demandé <span class="nbul" aria-label="par ${t.soutiens} membre${t.soutiens > 1 ? 's' : ''}">${esc(String(t.soutiens))}</span>`;
      ok.textContent = t ? (t.moi ? 'Déjà demandé' : 'Moi aussi') : al ? 'Proposer ce nom' : 'Envoyer la demande';
      ok.disabled = st.envoi || !!(t && t.moi);
    };
    const peindreProches = () => {
      const z = f.querySelector('[data-proches]'), L = st.type === 'alias' ? [] : proches(E.nom.value);
      z.innerHTML = L.length ? `<span class="pd-pt">Vous voulez dire… ?</span><div class="pd-pl">${L.map(p => `<button type="button" class="pd-p" data-pick="${esc(p.slug)}"><b>${esc(p.name)}</b><small>${esc(famille(p.categorySlug))}</small></button>`).join('')}</div>` : '';
      z.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const s = b.dataset.pick; fin(); if (o.choisir) o.choisir(s); });
    };
    // la même demande attend-elle déjà ? (le serveur compare le nom normalisé)
    let tT = null;
    const verifier = () => {
      clearTimeout(tT); const j = ++st.jeton, nom = E.nom.value.trim(), slug = E.slug.value;
      if (nom.length < 2 || (st.type === 'alias' && !slug) || sansServeur()) { st.trouve = null; peindre(); return; }
      tT = setTimeout(() => n.rpc('produit_demande_trouver', { p_nom: nom, p_type: st.type, p_slug: st.type === 'alias' ? slug : null })
        .then(r => { if (j !== st.jeton || !bg) return; st.trouve = r && r.id ? r : null; peindre(); }).catch(() => {}), 400);
    };
    f.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { st.type = b.dataset.ty; st.trouve = null; err.textContent = ''; peindre(); peindreProches(); verifier(); });
    E.nom.oninput = () => { err.textContent = ''; st.trouve = null; peindre(); peindreProches(); verifier(); };
    E.slug.onchange = () => { st.trouve = null; peindre(); verifier(); };
    f.onsubmit = async e => {
      e.preventDefault(); if (st.envoi) return;
      const nom = E.nom.value.trim().replace(/\s+/g, ' '), al = st.type === 'alias';
      const m = nom.length < 2 ? (al ? 'Écrivez le nom local.' : 'Écrivez le nom du produit.') : !al && !E.fam.value && !st.trouve ? 'Choisissez la famille.' : al && !E.slug.value ? 'Choisissez le produit.' : '';
      if (m) { err.textContent = m; (nom.length < 2 ? E.nom : al ? E.slug : E.fam).focus(); return; }
      st.envoi = true; peindre(); ok.setAttribute('aria-busy', 'true');
      try {
        const r = st.trouve ? await n.rpc('produit_moi_aussi', { p_id: st.trouve.id })
          : await n.rpc('produit_demander', { p_nom: nom, p_famille: al ? null : E.fam.value, p_unite: al ? null : (E.unite.value || null), p_nom_local: al ? null : (E.local.value.trim() || null), p_type: st.type, p_slug: al ? E.slug.value : null });
        fin();
        dire(r && r.moi_aussi ? 'C’est noté : vous êtes ' + (r.soutiens || 2) + ' à le demander. Nous vous prévenons.' : 'Demande envoyée. Nous vous prévenons dès que le produit est ajouté.');
        relire();
      } catch (x) {
        st.envoi = false; ok.removeAttribute('aria-busy'); peindre();
        err.textContent = absente(x) ? 'Les demandes de produit arrivent bientôt. Réessayez plus tard.' : ERR(x);
      }
    };
    peindre(); peindreProches(); verifier();
    (o.nom ? (st.type === 'alias' ? E.slug : E.fam) : E.nom).focus({ preventScroll: true });
  }
  function fermer() { if (bg) { bg.remove(); bg = null; } }

  window.MDGProduits = { ouvrir, fermer, mes, relire, lire, vide, annulerVide, famille, norm, charge: () => fait, quand: f => { if (fait) f(); else attente.push(f); } };
  const go = () => { lire(); relire(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  addEventListener('mdg:connecte', () => relire());
})();
