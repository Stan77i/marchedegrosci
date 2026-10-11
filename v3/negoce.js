/* ═════════ Marché de Gros CI — Négoce : proposer un prix, répondre, conclure ═════════
   Le site et l'application utilisent ce même module (au-dessus de v3/nuage.js).
   • Sur une annonce partagée : « Proposer un prix » ouvre une négociation avec la personne qui l'a publiée.
   • Chacun à son tour : contre-proposition, accord ou refus. L'accord fixe le prix ; il ne vaut pas paiement.
   • L'écart (la règle des prix) montre où en est chaque partie : cercle vert = vendeur, carré jaune = acheteur
     (le même langage que la carte) ; à l'accord, les deux se rejoignent sur la ligne bleue « compatibles ».
   • Toutes les écritures passent par les fonctions de la base (proposer_prix, negocier) qui vérifient les règles.
   API : MDGNegoce.proposer(annonce) · inbox() · thread(id) · unread() · refresh()
   Un bouton peut aussi porter data-negocier='{"cible":"offre","id":"…","produit":"…","prix":12000,"unite":"kg",…}'.
   Événement : « mdg:negoce » (detail.unread) quand le nombre de négociations non lues change. */
(function () {
  'use strict';
  const N = () => window.MDGNuage;
  const KL = 'mdg-negoce:liste';
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  const me = () => { const s = N() && N().session(); return s && s.user && s.user.id; };
  const ago = t => { const m = Math.max(0, (Date.now() - Date.parse(t)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? 'il y a ' + Math.round(m) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : m < 2880 ? 'hier' : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  const pas = p => p >= 10000 ? 100 : p >= 1000 ? 50 : p >= 100 ? 5 : 1;
  const arrondi = p => { const s = pas(p); return Math.max(s, Math.round(p / s) * s); };

  // rôles : sur une offre, le propriétaire vend ; sur une demande, il achète
  const roles = n => { const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur'; return { [n.proprio_id]: owner, [n.auteur_id]: owner === 'vendeur' ? 'acheteur' : 'vendeur' }; };
  const monRole = n => roles(n)[me()];
  const autre = r => r === 'vendeur' ? 'acheteur' : 'vendeur';
  const nonLu = n => { const u = me(); if (!u) return false; const lu = u === n.auteur_id ? n.lu_auteur : n.lu_proprio; return Date.parse(n.updated_at) > Date.parse(lu) + 500; };
  const aMoi = n => n.statut === 'ouverte' && n.dernier_par && n.dernier_par !== me();

  /* ——— données ——— */
  let liste = J(KL, []), lastUnread = -1;
  const unread = () => liste.filter(nonLu).length;
  function announce() { const u = unread(); if (u !== lastUnread) { if (lastUnread >= 0 && u > lastUnread && !bg && N()) N().toast(u > 1 ? u + ' réponses vous attendent dans « Mes négociations ».' : 'Une réponse vous attend dans « Mes négociations ».'); lastUnread = u; dispatchEvent(new CustomEvent('mdg:negoce', { detail: { unread: u } })); } }
  async function refresh() {
    if (!N() || !N().session() || !navigator.onLine) { announce(); return liste; }
    try {
      const u = me(), r = await N().api('/rest/v1/negociations?select=*&or=(auteur_id.eq.' + u + ',proprio_id.eq.' + u + ')&order=updated_at.desc&limit=100', { auth: true });
      liste = r || []; W(KL, liste);
    } catch (e) { if (e.code === 'auth') { liste = []; W(KL, []); } }
    announce(); return liste;
  }
  const messages = id => N().api('/rest/v1/messages?select=*&negociation_id=eq.' + id + '&order=created_at.asc&limit=300', { auth: true });
  const one = async id => { const r = await N().api('/rest/v1/negociations?select=*&id=eq.' + id, { auth: true }); return r && r[0]; };

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
.nx-rail{position:relative;margin:4px 0 6px;padding:34px 6px 30px}
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
@keyframes nxIn{from{opacity:0}}@keyframes nxUp{from{transform:translateY(28px);opacity:0}}
@keyframes nxPop{from{transform:scale(.92);opacity:0}}.nx-new{animation:nxPop .32s cubic-bezier(.22,1,.36,1) both}
@media (prefers-reduced-motion:reduce){.nx-bg,.nx,.nx-new{animation:none}.nx-rail .gap,.nx-rail .pin{transition:none}}`;
  let css = false, bg = null, poll = 0;
  const mk = r => r === 'vendeur' ? '<svg class="mk" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="#6CC58C"/></svg>' : '<svg class="mk" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="5.5" width="13" height="13" rx="1.5" fill="#F2C94C"/></svg>';
  function sheet(html, label) {
    if (!css) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); css = true; }
    close(true);
    bg = document.createElement('div'); bg.className = 'nx-bg';
    bg.innerHTML = `<div class="nx" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
    document.body.appendChild(bg);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });
    bg.querySelectorAll('[data-x]').forEach(b => b.onclick = () => close());
    return bg;
  }
  function close(keep) { clearInterval(poll); poll = 0; if (bg) { bg.remove(); bg = null; } if (!keep) document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape' && bg) close(); }
  const head = (t, sub, back) => `<div class="nx-h">${back ? '<button type="button" class="nx-ib" data-back aria-label="Retour">‹</button>' : ''}<h2>${esc(t)}${sub ? `<small>${esc(sub)}</small>` : ''}</h2><button type="button" class="nx-ib" data-x aria-label="Fermer">×</button></div>`;

  // la règle : prix affiché (repère), dernier prix de chaque partie, écart entre eux
  function rail(n, msgs) {
    const last = { vendeur: null, acheteur: null }, R = roles(n);
    (msgs || []).forEach(m => { if (m.genre === 'prix') last[R[m.auteur_id]] = { p: +m.prix, live: true }; if (m.genre === 'refus') { const r = autre(R[m.auteur_id]); if (last[r]) last[r].live = false; } });
    if (!msgs && n.dernier_prix) last[R[n.dernier_par] || autre(monRole(n))] = { p: +n.dernier_prix, live: true };
    const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur';
    if (!last[owner] && n.prix_annonce) last[owner] = { p: +n.prix_annonce, live: true, annonce: true };
    const ok = n.statut === 'conclue' && n.prix_final;
    const vals = [n.prix_annonce, last.vendeur && last.vendeur.p, last.acheteur && last.acheteur.p, ok && n.prix_final].filter(v => v > 0).map(Number);
    if (!vals.length) return '';
    let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max((hi - lo) * 0.22, hi * 0.04); lo -= pad; hi += pad;
    const x = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
    let h = '<div class="nx-rail" role="img" aria-label="' + esc(railTxt(n, last)) + '"><div class="tr">';
    if (n.prix_annonce && !(ok && Math.abs(n.prix_final - n.prix_annonce) < 1)) h += `<span class="tick" style="left:${x(n.prix_annonce)}"><b>affiché ${fmt(n.prix_annonce)}</b></span>`;
    if (ok) h += `<span class="gap is-ok" style="left:0;width:100%"></span><span class="pin ok up" style="left:${x(n.prix_final)}"><i></i><b>${fmt(n.prix_final)} F<small>accord</small></b></span>`;
    else {
      const v = last.vendeur, a = last.acheteur;
      if (v && a) { const l = Math.min(v.p, a.p), r = Math.max(v.p, a.p); h += `<span class="gap" style="left:${x(l)};width:calc(${x(r)} - ${x(l)})"></span>`; }
      if (v) h += `<span class="pin v up${v.live ? '' : ' off'}" style="left:${x(v.p)}"><i></i><b>${fmt(v.p)}<small>vendeur</small></b></span>`;
      if (a) h += `<span class="pin a ${v ? 'dn' : 'up'}${a.live ? '' : ' off'}" style="left:${x(a.p)}"><i></i><b>${v ? '<small>acheteur</small>' : ''}${fmt(a.p)}${v ? '' : '<small>acheteur</small>'}</b></span>`;
    }
    return h + '</div></div>';
  }
  function railTxt(n, last) {
    if (n.statut === 'conclue') return 'Accord à ' + fmt(n.prix_final) + ' F par ' + (n.unite || 'unité');
    const v = last.vendeur, a = last.acheteur;
    return (v ? 'Vendeur : ' + fmt(v.p) + ' F. ' : '') + (a ? 'Acheteur : ' + fmt(a.p) + ' F. ' : '') + (v && a ? 'Écart : ' + fmt(Math.abs(v.p - a.p)) + ' F.' : '');
  }
  function gapLine(n, msgs) {
    const R = roles(n), last = {}; (msgs || []).forEach(m => { if (m.genre === 'prix') last[R[m.auteur_id]] = +m.prix; });
    const owner = n.cible === 'offre' ? 'vendeur' : 'acheteur'; if (last[owner] == null && n.prix_annonce) last[owner] = +n.prix_annonce;
    if (n.statut === 'conclue') return `<div class="nx-sum"><span>Prix convenu</span><b>${fmt(n.prix_final)} F / ${esc(n.unite || 'unité')}</b></div>`;
    if (last.vendeur != null && last.acheteur != null) { const d = Math.abs(last.vendeur - last.acheteur), q = +n.quantite; return `<div class="nx-sum"><span>Écart</span><b>${d < 1 ? 'aucun' : fmt(d) + ' F / ' + esc(n.unite || 'unité')}${d >= 1 && q > 0 ? ` <span style="font-weight:400;color:var(--mute)">soit ${fmt(d * q)} F sur ${fmt(q)} ${esc(n.unite || '')}</span>` : ''}</b></div>`; }
    return '';
  }

  /* ——— proposer un prix ——— */
  function proposer(a) {
    if (!N()) return;
    if (!a || !a.id) return N().toast('Cette annonce n’est que sur cet appareil : la négociation n’est pas possible.');
    if (!N().session()) { N().open('negocie'); addEventListener('mdg:connecte', () => setTimeout(() => proposer(a), 400), { once: true }); return; }
    const cible = a.cible === 'demande' ? 'demande' : 'offre', deja = liste.find(n => n.cible === cible && n.cible_id === a.id && n.auteur_id === me());
    if (deja) return thread(deja.id);
    const prix = +a.prix || 0, u = a.unite || 'kg', q = +a.quantite || 0, lui = cible === 'offre' ? 'vendeur' : 'acheteur';
    const sens = cible === 'offre' ? -1 : 1; // l'acheteur propose moins, le vendeur propose plus que le budget
    const chips = prix ? [5, 10, 15].map(p => ({ v: arrondi(prix * (1 + sens * p / 100)), t: (sens < 0 ? '−' : '+') + p + ' %' })) : [];
    sheet(head('Proposer un prix', (a.produit || 'Annonce') + (a.ville ? ' · ' + a.ville : '')) + `
      <div class="nx-b">
        <div class="nx-ann">${mk(lui)}<p><b>${esc(a.produit || 'Annonce')}${q ? ' · ' + fmt(q) + ' ' + esc(u) : ''}</b>${esc(a.nom || (lui === 'vendeur' ? 'Vendeur' : 'Acheteur'))}${a.ville ? ', ' + esc(a.ville) : ''} · ${prix ? (cible === 'offre' ? 'prix affiché ' : 'budget ') + fmt(prix) + ' F / ' + esc(u) : (cible === 'offre' ? 'pas de prix affiché' : 'pas de budget affiché')}</p></div>
        <label class="nx-lbl" for="nxP">Votre prix</label>
        <div class="nx-px"><input id="nxP" inputmode="numeric" autocomplete="off" placeholder="${prix ? fmt(chips[1].v) : '0'}" aria-describedby="nxD"><span>F / ${esc(u)}</span></div>
        ${chips.length ? `<div class="nx-chips" role="group" aria-label="Propositions rapides">${chips.map(c => `<button type="button" class="nx-chip" data-v="${c.v}" aria-pressed="false">${c.t} · ${fmt(c.v)}</button>`).join('')}</div>` : ''}
        <p class="nx-delta" id="nxD" aria-live="polite"></p>
        <div class="nx-prev"></div>
        <div class="nx-sec"><label class="nx-lbl" for="nxT">Un mot pour ${lui === 'vendeur' ? 'le vendeur' : 'l’acheteur'} (facultatif)</label>
        <div class="nx-chips" style="margin-top:4px">${(cible === 'offre' ? ['Je prends tout le lot', 'Je paie à la livraison', 'Je viens chercher'] : ['Je peux livrer', 'Marchandise disponible maintenant', 'Qualité vérifiable sur place']).map(t => `<button type="button" class="nx-chip" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <textarea id="nxT" maxlength="500" placeholder="Quantité, livraison, paiement…"></textarea></div>
        <p class="nx-note">${lui === 'vendeur' ? 'Le vendeur' : 'L’acheteur'} voit votre proposition à sa prochaine visite et peut accepter, refuser ou proposer un autre prix. Un accord fixe le prix, ce n’est pas un paiement : voyez la marchandise avant de payer.</p>
      </div>
      <div class="nx-f"><button type="button" class="nx-go" disabled>Envoyer ma proposition</button><p class="nx-err" role="alert"></p></div>`, 'Proposer un prix');
    document.addEventListener('keydown', onKey);
    const $ = s => bg.querySelector(s), inp = $('#nxP'), go = $('.nx-go'), err = $('.nx-err');
    const val = () => +String(inp.value).replace(/\D/g, '') || 0;
    const fake = { cible, prix_annonce: prix || null, unite: u, quantite: q, statut: 'ouverte', proprio_id: 'lui', auteur_id: me(), dernier_prix: null };
    const upd = () => {
      const v = val(); go.disabled = !v; go.textContent = v ? 'Proposer ' + fmt(v) + ' F / ' + u : 'Envoyer ma proposition';
      bg.querySelectorAll('.nx-chip[data-v]').forEach(c => c.setAttribute('aria-pressed', String(+c.dataset.v === v)));
      let d = '';
      if (v && prix) { const e = v - prix, pc = Math.round(Math.abs(e) / prix * 100); d = Math.abs(e) < 1 ? 'Le prix affiché, sans négociation.' : `${fmt(Math.abs(e))} F ${e < 0 ? 'de moins' : 'de plus'} par ${esc(u)} (${e < 0 ? '−' : '+'}${pc} %)${q ? `<br><small>${fmt(Math.abs(e) * q)} F d’écart sur ${fmt(q)} ${esc(u)}${cible === 'offre' && v ? ' · total proposé ' + fmt(v * q) + ' F' : ''}</small>` : ''}`; if (pc > 40) d += '<br><small>Un écart de plus de 40 % a peu de chances d’être accepté.</small>'; }
      else if (v && q) d = `<small>Total proposé : ${fmt(v * q)} F pour ${fmt(q)} ${esc(u)}</small>`;
      $('#nxD').innerHTML = d;
      $('.nx-prev').innerHTML = v ? rail(fake, [{ genre: 'prix', auteur_id: me(), prix: v }]) : '';
    };
    inp.addEventListener('input', () => { const v = val(); inp.value = v ? fmt(v) : ''; upd(); });
    bg.querySelectorAll('.nx-chip[data-v]').forEach(c => c.onclick = () => { inp.value = fmt(+c.dataset.v); upd(); });
    bg.querySelectorAll('.nx-chip[data-t]').forEach(c => c.onclick = () => { const t = $('#nxT'); t.value = (t.value.trim() ? t.value.trim() + '. ' : '') + c.dataset.t; c.setAttribute('aria-pressed', 'true'); });
    setTimeout(() => inp.focus(), 80);
    go.onclick = async () => {
      if (!navigator.onLine) { err.textContent = 'Pas de connexion internet. Votre proposition partira quand le réseau revient : réessayez.'; return; }
      go.disabled = true; err.textContent = ''; go.textContent = 'Envoi…';
      try { const id = await N().rpc('proposer_prix', { cible, cible_id: a.id, prix: val(), texte: $('#nxT').value.trim() || null }); await refresh(); thread(id, true); N().toast('Proposition envoyée.'); }
      catch (x) { err.textContent = x.message === 'Failed to fetch' ? 'Le serveur ne répond pas. Réessayez dans un instant.' : x.message; go.disabled = false; upd(); }
    };
  }

  /* ——— la boîte ——— */
  async function inbox() {
    if (!N()) return;
    if (!N().session()) { N().open(); return; }
    const draw = () => {
      const g = { moi: [], eux: [], ok: [], fin: [] };
      liste.forEach(n => (n.statut === 'conclue' ? g.ok : n.statut !== 'ouverte' ? g.fin : aMoi(n) ? g.moi : g.eux).push(n));
      const row = n => { const r = monRole(n), lui = autre(r), p = n.statut === 'conclue' ? n.prix_final : n.dernier_prix;
        return `<button type="button" class="nx-row${nonLu(n) ? ' is-new' : ''}" data-id="${n.id}">${mk(lui)}<b>${esc(n.produit || 'Annonce')}${n.quantite ? ' · ' + fmt(n.quantite) + ' ' + esc(n.unite || '') : ''}</b>
          <span class="p">${p ? fmt(p) : '—'}<small>${n.statut === 'conclue' ? 'accord' : n.statut === 'close' ? 'terminée' : 'F / ' + esc(n.unite || 'unité')}</small></span>
          <small>Avec ${lui === 'vendeur' ? 'le vendeur' : 'l’acheteur'}${n.ville ? ' · ' + esc(n.ville) : ''} · ${ago(n.updated_at)}</small></button>`; };
      const grp = (t, L) => L.length ? `<section class="nx-grp"><h3>${t}</h3>${L.map(row).join('')}</section>` : '';
      bg.querySelector('.nx-b').innerHTML = liste.length ? grp('À vous de répondre', g.moi) + grp('En attente de réponse', g.eux) + grp('Accords conclus', g.ok) + grp('Arrêtées', g.fin)
        : `<div class="nx-empty"><b>Aucune négociation pour l’instant</b>Sur une offre ou une demande, touchez « Proposer un prix ». Les réponses arrivent ici.</div>`;
      bg.querySelectorAll('.nx-row').forEach(b => b.onclick = () => thread(b.dataset.id));
    };
    sheet(head('Mes négociations', 'Prix proposés, réponses et accords') + `<div class="nx-b"><div class="nx-empty">Chargement…</div></div>`, 'Mes négociations');
    document.addEventListener('keydown', onKey);
    if (liste.length) draw();
    await refresh(); if (bg && bg.querySelector('.nx-row,.nx-empty')) draw();
  }

  /* ——— le fil d'une négociation ——— */
  async function thread(id, fresh) {
    if (!N() || !N().session()) return N() && N().open();
    let n = liste.find(x => x.id === id), msgs = null, cp = false;
    sheet(head(n ? (n.produit || 'Négociation') : 'Négociation', '', true) + `<div class="nx-b"><div class="nx-top"></div><div class="nx-msgs" aria-live="polite"></div></div><div class="nx-f"></div>`, 'Négociation');
    document.addEventListener('keydown', onKey);
    bg.querySelector('[data-back]').onclick = () => inbox();
    const $ = s => bg && bg.querySelector(s);
    const paint = (anim) => {
      if (!bg || !n) return;
      const r = monRole(n), lui = autre(r), R = roles(n), u = n.unite || 'unité';
      $('.nx-h h2').innerHTML = esc(n.produit || 'Négociation') + `<small>Avec ${lui === 'vendeur' ? 'le vendeur' : 'l’acheteur'}${n.ville ? ' · ' + esc(n.ville) : ''}${n.quantite ? ' · ' + fmt(n.quantite) + ' ' + esc(u) : ''}</small>`;
      $('.nx-top').innerHTML = rail(n, msgs) + gapLine(n, msgs);
      const box = $('.nx-msgs'), seen = box.childElementCount;
      box.innerHTML = (msgs || []).map((m, i) => {
        const mine = m.auteur_id === me(), who = mine ? 'Vous' : (R[m.auteur_id] === 'vendeur' ? 'Le vendeur' : 'L’acheteur'), cls = (mine ? ' me' : '') + (anim && i >= seen ? ' nx-new' : ''), when = `<time datetime="${m.created_at}">${ago(m.created_at)}</time>`;
        if (m.genre === 'texte') return `<div class="nx-m${cls}">${esc(m.texte)}${when}</div>`;
        if (m.genre === 'fin') return `<div class="nx-ev${cls}">${who} a arrêté la négociation · ${ago(m.created_at)}</div>`;
        const lab = m.genre === 'prix' ? (who + ' propose') : m.genre === 'accord' ? (who + (mine ? ' avez accepté' : ' a accepté')) : (who + (mine ? ' avez refusé' : ' a refusé'));
        return `<div class="nx-tk${cls}${m.genre === 'refus' ? ' is-refus' : m.genre === 'accord' ? ' is-accord' : ''}"><div class="who">${m.genre === 'accord' ? '' : mk(R[m.genre === 'prix' ? m.auteur_id : (m.auteur_id === n.auteur_id ? n.proprio_id : n.auteur_id)])}${lab}</div><div class="amt">${fmt(m.prix)} <small>F / ${esc(u)}</small></div>${m.texte ? `<div class="t">${esc(m.texte)}</div>` : ''}${when}</div>`;
      }).join('') + (n.statut === 'conclue' ? deal(n) : '');
      // pied : actions selon le tour
      const f = $('.nx-f'), mon = aMoi(n);
      let h = '';
      if (n.statut === 'ouverte' && mon && !cp) h += `<div class="nx-act"><button type="button" class="nx-go" data-g="accord">Accepter ${fmt(n.dernier_prix)} F / ${esc(u)}</button><button type="button" class="nx-alt" data-g="cp">Autre prix</button><button type="button" class="nx-alt" data-g="refus">Refuser</button></div>`;
      else if (n.statut !== 'conclue' && (cp || !mon)) h += `<div class="nx-cp"><input inputmode="numeric" placeholder="${n.statut === 'close' ? 'Relancer avec un prix' : mon ? 'Votre contre-proposition' : 'Nouveau prix'}" aria-label="Prix en F par ${esc(u)}"><button type="button" class="nx-alt" data-g="prix">Proposer</button>${cp ? '<button type="button" class="nx-ib" data-g="nocp" aria-label="Annuler">×</button>' : ''}</div>`;
      h += `<div class="nx-comp"><textarea maxlength="500" placeholder="Écrire un message" aria-label="Message"></textarea><button type="button" class="nx-ib" data-g="texte" aria-label="Envoyer">↑</button></div>
        ${n.statut === 'ouverte' ? '<p style="margin:8px 0 0;text-align:center"><button type="button" class="nx-alt" data-g="fin" style="min-height:36px;border:0;color:#8f846f;font-weight:500;font-size:13px;text-decoration:underline">Arrêter la négociation</button></p>' : ''}<p class="nx-err" role="alert"></p>`;
      const keepTxt = f.querySelector('textarea') ? f.querySelector('textarea').value : '';
      f.innerHTML = h; f.querySelector('textarea').value = keepTxt;
      const cpi = f.querySelector('.nx-cp input'); if (cpi) cpi.addEventListener('input', () => { const v = +cpi.value.replace(/\D/g, ''); cpi.value = v ? fmt(v) : ''; });
      f.querySelectorAll('[data-g]').forEach(b => b.onclick = () => act(b.dataset.g));
      if (anim) { const b = $('.nx-b'); b.scrollTop = b.scrollHeight; }
    };
    const deal = n => { const ph = phone(n); return `<div class="nx-deal"><b>Accord à ${fmt(n.prix_final)} F / ${esc(n.unite || 'unité')}</b><p>${n.quantite ? 'Pour ' + fmt(n.quantite) + ' ' + esc(n.unite || '') + ', soit ' + fmt(n.prix_final * n.quantite) + ' F. ' : ''}Convenez maintenant de la livraison et du paiement. Voyez la marchandise avant de payer.</p>${ph ? `<a href="tel:+225${ph}">Appeler</a><a href="https://wa.me/225${ph}?text=${encodeURIComponent('Bonjour, nous avons trouvé un accord sur Marché de Gros : ' + (n.produit || '') + ' à ' + fmt(n.prix_final) + ' F / ' + (n.unite || '') + '.')}" target="_blank" rel="noopener" style="background:none;border:1px solid rgba(245,240,230,.3);color:var(--ink)">WhatsApp</a>` : ''}</div>`; };
    // numéro de l'autre partie : celui de l'annonce s'il est public (l'annonce est publiée par le propriétaire)
    const phone = n => { if (me() !== n.auteur_id) return ''; const k = n.cible === 'offre' ? 'offres' : 'demandes', a = N().list(k).find(x => x._rid === n.cible_id); const t = a && ((a.producer && a.producer.phone) || a.phone); return /^\d{10}$/.test(t || '') ? t : ''; };
    async function act(g) {
      const f = $('.nx-f'), err = f.querySelector('.nx-err');
      if (g === 'cp') { cp = true; paint(); setTimeout(() => $('.nx-cp input') && $('.nx-cp input').focus(), 30); return; }
      if (g === 'nocp') { cp = false; paint(); return; }
      if (g === 'fin' && !confirm('Arrêter cette négociation ? Vous pourrez la relancer avec un nouveau prix.')) return;
      const args = { nego: n.id, genre: g, prix: null, texte: null };
      if (g === 'prix') { args.prix = +String(f.querySelector('.nx-cp input').value).replace(/\D/g, '') || 0; if (!args.prix) { err.textContent = 'Indiquez un prix.'; return; } args.texte = f.querySelector('textarea').value.trim() || null; }
      if (g === 'texte') { args.texte = f.querySelector('textarea').value.trim(); if (!args.texte) return; }
      if (!navigator.onLine) { err.textContent = 'Pas de connexion internet. Réessayez quand le réseau revient.'; return; }
      f.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try { await N().rpc('negocier', args); if (g === 'texte' || g === 'prix') f.querySelector('textarea').value = ''; cp = false; await load(true); if (g === 'accord') N().toast('Accord conclu. Convenez de la livraison et du paiement.'); }
      catch (x) { err.textContent = x.message === 'Failed to fetch' ? 'Le serveur ne répond pas. Réessayez.' : x.message; f.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    }
    async function load(anim) {
      try {
        const [nn, mm] = await Promise.all([one(id), messages(id)]);
        if (!bg) return; if (!nn) { $('.nx-b').innerHTML = '<div class="nx-empty"><b>Négociation introuvable</b>Elle a peut-être été retirée avec l’annonce.</div>'; $('.nx-f').innerHTML = ''; return; }
        const changed = !msgs || mm.length !== msgs.length || nn.statut !== n.statut;
        n = nn; msgs = mm; const i = liste.findIndex(x => x.id === id); if (i >= 0) liste[i] = nn; else liste.unshift(nn);
        if (changed) paint(anim !== false);
        if (nonLu(nn)) { N().rpc('marquer_lu', { nego: id }).then(() => { const k = me() === nn.auteur_id ? 'lu_auteur' : 'lu_proprio'; nn[k] = new Date().toISOString(); W(KL, liste); announce(); }).catch(() => {}); }
      } catch (e) { if (bg && !msgs) $('.nx-msgs').innerHTML = '<div class="nx-ev">Pas de réseau : les messages s’afficheront quand la connexion revient.</div>'; }
    }
    if (n) paint(false);
    await load(true);
    clearInterval(poll); poll = setInterval(() => { if (!document.hidden && navigator.onLine && bg) load(true); }, 7000);
  }

  // boutons « Proposer un prix » portant data-negocier (site et application)
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

  window.MDGNegoce = { proposer, inbox, thread, unread, refresh };
})();
