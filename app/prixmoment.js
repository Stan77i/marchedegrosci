/* ═════════ Marché de Gros CI — « Ici, chacun place son prix » ═════════
   Le pop-up qui s'ouvre en touchant le prix du moment, sous l'orbite de l'accueil (23/10/2026, demande du propriétaire).
   Il montre l'échelle des prix publiés pour ce produit (du moins cher au plus cher, dans la même unité), qui a publié le meilleur,
   le meilleur budget côté acheteurs, et invite à placer le sien : « Proposez moins de 12 500 F : vous passez en tête ».
   Rien n'est inventé : uniquement les annonces affichées sur l'accueil. Le Marché de Gros ne fixe aucun prix.
   Couleurs, comme partout dans l'application : vendeurs (offres) en vert ▼, acheteurs (demandes) en maïs ▲ — les boutons « J'ai à vendre » / « Je cherche ».
   La bulle d'activité de l'orbite (« Très vendu », « Demandé il y a… », schéma 53) est reprise en tête, dans le même style.
   Deux onglets (24/10/2026) : « ▼ Vendeurs » (leurs prix, placer mon prix de vente, négocier avec le moins cher) et « ▲ Acheteurs »
   (leurs budgets, placer mon budget d'achat, proposer au plus offrant) ; une ligne rappelle l'autre côté.
   API : MDGPrixMoment.ouvrir({ nom, img, art, cote ('v'|'a'), exemple (démo : bandeau « pas réels »), activite:{ico,t,s,cls}, offres:[{prix,nom,lieu,at,qte,unite,moi,neg}], demandes:[…], placer(kind), negocier(kind, i) }) */
(function () {
  'use strict';
  if (window.MDGPrixMoment) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = v => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v || 0);
  const F = v => nf(v) + ' F';
  const ilya = t => { if (!t) return ''; const m = Math.max(0, Math.round((Date.now() - Date.parse(t)) / 60000)); return isNaN(m) ? '' : m < 60 ? 'il y a ' + (m || 1) + ' min' : m < 1440 ? 'il y a ' + Math.round(m / 60) + ' h' : 'il y a ' + Math.round(m / 1440) + ' j'; };
  const ini = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x.charAt(0).toUpperCase()).join('') || '?';
  const plur = (q, u) => { u = String(u || ''); return q > 1 && u && !/[sx]$|^(kg|t|l|L)$/.test(u) ? u + 's' : u; };
  const MOUV = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  const CSS = `
.pm-bg{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:flex-end;justify-content:center;background:rgba(8,7,5,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:pmFond .25s ease both}
@keyframes pmFond{from{opacity:0}}
.pm{position:relative;width:100%;max-width:520px;max-height:92dvh;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;box-sizing:border-box;padding:10px 20px calc(20px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:#171512;color:#F3EFE4;font:400 15px/1.45 Jost,system-ui,sans-serif;box-shadow:0 -20px 60px rgba(0,0,0,.45);animation:pmMonte .45s cubic-bezier(.22,1,.36,1) both}
@keyframes pmMonte{from{transform:translateY(60px);opacity:.4}}
.pm-poi{display:block;width:40px;height:4px;margin:0 auto 14px;border-radius:2px;background:rgba(243,239,228,.22)}
.pm-x{position:absolute;right:14px;top:14px;width:40px;height:40px;border:0;border-radius:50%;background:rgba(243,239,228,.08);color:#F3EFE4;font:400 20px/1 Jost,sans-serif;cursor:pointer}
.pm-hd{display:flex;align-items:center;gap:14px;margin:0 58px 18px 0}
.pm-hd .im{flex:none;width:64px;height:64px;border-radius:20px;background:radial-gradient(120% 90% at 50% 100%,rgba(242,194,48,.22),rgba(243,239,228,.05) 70%);position:relative}
.pm-hd .im img{position:absolute;left:50%;bottom:2px;width:74px;height:74px;margin-left:-37px;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,.45))}
.pm-hd small{display:block;font:500 13px/1.25 Jost,sans-serif;color:#B9AD98}
.pm-hd h2{margin:4px 0 0;font:600 23px/1.12 Jost,sans-serif;letter-spacing:-.015em}.pm-hd h2 em{font-style:italic;font-weight:900;color:#F2C230}
.pm-ac{display:flex;align-items:center;gap:10px;margin:-6px 0 16px;padding:8px 12px 8px 8px;border-radius:16px;background:rgba(243,239,228,.05);box-shadow:inset 0 0 0 1px rgba(243,239,228,.12)}
.pm-ac i{flex:none;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:16px;background:rgba(243,239,228,.08)}.pm-ac i .ico{width:17px;height:17px;color:#F3EFE4}.pm-ac.vente i .ico{color:#9FDCB2}.pm-ac.demande i .ico{color:#F2C230}
.pm-ac b{display:block;font:700 14px/1.15 Jost,sans-serif;color:#F3EFE4}.pm-ac small{display:block;font-size:12px;line-height:1.3;color:#CFC4B1}
.pm-ac.vente{box-shadow:inset 0 0 0 1px rgba(159,220,178,.4)}.pm-ac.vente i{background:rgba(159,220,178,.16)}.pm-ac.vente b{color:#9FDCB2}
.pm-ac.demande{box-shadow:inset 0 0 0 1px rgba(242,194,48,.4)}.pm-ac.demande i{background:rgba(242,194,48,.16)}.pm-ac.demande b{color:#F2C230}
.pm-ech{position:relative;list-style:none;margin:0;padding:0 0 0 28px}
.pm-ech::before{content:"";position:absolute;left:9px;top:14px;bottom:14px;width:2px;border-radius:1px;background:linear-gradient(#9FDCB2,rgba(243,239,228,.14))}
.pm-ech li{position:relative;margin:0 0 8px}
@keyframes pmLi{from{opacity:0;transform:translateX(-10px)}}
.pm-ech li::before{content:"";position:absolute;left:-23px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#171512;box-shadow:inset 0 0 0 2px rgba(243,239,228,.3)}
.pm-ech li.top::before{background:#9FDCB2;box-shadow:0 0 0 4px rgba(159,220,178,.18)}
.pm-r{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4px 12px;padding:10px 12px;border-radius:16px;background:rgba(243,239,228,.05)}
.pm-r .p{font:700 17px/1.15 Jost,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}
.pm-r .q{min-width:0;color:#B9AD98;font-size:13px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pm-r .e{font:600 12.5px Jost,sans-serif;color:#CFC4B1;white-space:nowrap}
.pm-ech li.top .pm-r{grid-template-columns:auto 1fr;padding:14px;background:rgba(159,220,178,.08);box-shadow:inset 0 0 0 1.5px rgba(159,220,178,.5)}
.pm-ech li.top .p{font:900 italic 26px/1 Jost,sans-serif;letter-spacing:-.02em;color:#F3EFE4}.pm-ech li.top .p i{font-size:.6em;color:#F2C230}
.pm-tag{justify-self:end;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:12px;background:#9FDCB2;color:#0E2A1F;font:700 12px Jost,sans-serif;white-space:nowrap}
.pm-qui{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-top:8px;padding-top:10px;border-top:1px solid rgba(243,239,228,.1)}
.pm-qui .av{flex:none;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#2E5B47;color:#F3EFE4;font:600 14px Jost,sans-serif}
.pm-qui b{display:block;font:600 15px/1.2 Jost,sans-serif}.pm-qui small{display:block;color:#B9AD98;font-size:12.5px}
.pm-moi{display:inline-block;margin-left:6px;padding:0 7px;border-radius:9px;background:rgba(243,239,228,.14);color:#F3EFE4;font:600 11.5px/1.6 Jost,sans-serif}
/* « Votre prix ? » : la place libre, en pointillé, avec le triangle qui indique où se mettre */
.pm-vous{position:relative;margin:4px 0 0 28px;padding:12px 14px;border-radius:16px;border:1.5px dashed rgba(159,220,178,.6);color:#F3EFE4}
.pm-vous::before{content:"";position:absolute;left:-24px;top:50%;margin-top:-6px;border:6px solid transparent;border-left:9px solid #9FDCB2;animation:pmPointe 1.4s ease-in-out 3}
@keyframes pmPointe{50%{transform:translateX(4px)}}
.pm-vous b{display:flex;align-items:center;gap:8px;font:600 15px/1.3 Jost,sans-serif}.pm-vous small{display:block;margin-top:3px;color:#CFC4B1;font-size:13px;line-height:1.4}
.pm-vous b .tri{display:inline-block;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent}
.pm-vous b .tri.bas{border-top:8px solid #9FDCB2}.pm-vous b .tri.haut{border-bottom:8px solid #F2C230}
.pm-vous.a{border-color:rgba(242,194,48,.6)}.pm-vous.a::before{border-left-color:#F2C230}
.pm-sep{display:flex;align-items:center;gap:10px;margin:16px 0 10px;color:#B9AD98;font:600 11px/1 Jost,sans-serif;letter-spacing:.14em;text-transform:uppercase}.pm-sep::after{content:"";flex:1;height:1px;background:rgba(243,239,228,.1)}
.pm-d .pm-r .p{color:#F2C230}
.pm-ech.pm-d li.top .pm-r{grid-template-columns:auto 1fr;padding:12px 14px;background:rgba(242,194,48,.08);box-shadow:inset 0 0 0 1.5px rgba(242,194,48,.5)}
.pm-ech.pm-d li.top .p{color:#F3EFE4}.pm-ech.pm-d li.top .p small{font:600 13px Jost,sans-serif;font-style:normal;letter-spacing:0;color:#F2C230}
.pm-ech.pm-d .pm-tag{background:#F2C230;color:#171512}.pm-ech.pm-d .pm-qui .av{background:#5A4A12;color:#F2C230}
.pm-tabs{display:flex;gap:4px;margin:0 0 16px;padding:4px;border-radius:16px;background:rgba(243,239,228,.06)}
.pm-tabs button{flex:1;min-height:44px;border:0;border-radius:12px;background:none;color:#CFC4B1;font:600 14.5px Jost,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.pm-tabs button span:not(.nbul){min-width:20px;padding:0 6px;border-radius:10px;background:rgba(243,239,228,.1);font-size:12px;line-height:20px}
.pm-tabs .v[aria-selected=true]{background:#9FDCB2;color:#0E2A1F}.pm-tabs .a[aria-selected=true]{background:#F2C230;color:#171512}
.pm-tabs [aria-selected=true] span{background:rgba(0,0,0,.12)}
@keyframes pmPan{from{opacity:0;transform:translateY(6px)}}
.pm-vide{margin:0 0 8px;padding:12px 14px;border-radius:14px;background:rgba(243,239,228,.05);color:#CFC4B1;font-size:14px}
.pm-rep{display:flex;align-items:center;gap:8px;margin:12px 0 0;padding:10px 12px;border-radius:14px;background:rgba(243,239,228,.05);font-size:14px;color:#CFC4B1}
.pm-rep b{color:#F3EFE4}.pm-rep.a{color:#F2C230}.pm-rep.v{color:#9FDCB2}
.pm-rep button{margin-left:auto;min-height:44px;padding:0 10px;border:0;border-radius:18px;background:rgba(243,239,228,.08);color:#F3EFE4;font:600 13px Jost,sans-serif;cursor:pointer}
.pm-ech.pm-d li.top::before{background:#F2C230;box-shadow:0 0 0 4px rgba(242,194,48,.16)}
.pm-ech.pm-d::before{background:linear-gradient(#F2C230,rgba(243,239,228,.14))}
.pm-act{display:flex;flex-direction:column;gap:8px;margin-top:18px}
.pm-act button{min-height:52px;border-radius:16px;font:600 16px Jost,sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 16px}
.pm-act .go{border:0;background:#F2C230;color:#171512;box-shadow:0 12px 28px -14px rgba(242,194,48,.75)}
.pm-act .go.v{background:#9FDCB2;color:#0E2A1F;box-shadow:0 12px 28px -14px rgba(159,220,178,.7)}
.pm-act .neg{border:1px solid rgba(243,239,228,.22);background:none;color:#F3EFE4}
.pm-act .lien{min-height:44px;border:0;background:none;color:#CFC4B1;font-weight:500;font-size:14.5px}
.pm-act button:active{transform:scale(.985)}
.pm-ex{display:flex;align-items:center;gap:8px;margin:-6px 0 14px;padding:8px 12px;border-radius:12px;background:rgba(242,194,48,.14);color:#F2C230;font:600 13px/1.35 Jost,sans-serif}
@media (prefers-reduced-motion:reduce){.pm-bg,.pm,.pm-ech li,.pm-vous,.pm-vous::before,.pm-pan.in{animation:none!important}}`;
  function css() { if (document.getElementById('pmCss')) return; const s = document.createElement('style'); s.id = 'pmCss'; s.textContent = CSS; document.head.appendChild(s); }

  let bg = null, retour = null;
  function fermer() { if (!bg) return; const b = bg; bg = null; document.removeEventListener('keydown', clavier); b.remove(); if (retour && retour.focus) try { retour.focus({ preventScroll: true }); } catch (_) {} }
  const clavier = e => { if (e.key === 'Escape') fermer(); };

  function ouvrir(o) {
    css(); fermer(); retour = document.activeElement;
    // deux côtés, comme sur un vrai marché : les vendeurs placent un prix (le moins cher en tête), les acheteurs placent un budget (le plus haut en tête)
    const O = (o.offres || []).slice(0, 4), D = (o.demandes || []).slice(0, 4), best = O[0], bud = D[0], art = o.art || '';
    let cote = o.cote === 'a' || o.cote === 'v' ? o.cote : (O.length || !D.length ? 'v' : 'a');
    const qteTxt = (x, v) => x.qte ? nf(x.qte) + ' ' + esc(plur(x.qte, x.unite)) + (v ? ' disponible' : ' recherché') + (x.qte > 1 ? 's' : '') : '';
    const moi = x => x.moi ? '<span class="pm-moi">vous</span>' : '';
    const tete = (x, v) => `<li class="top" style="--i:0"><div class="pm-r"><span class="p">${v ? '' : '<small>jusqu’à </small>'}${nf(x.prix)} <i>F</i></span><span class="pm-tag">${v ? '▼ Meilleur prix' : '▲ Meilleur budget'}</span>
      <div class="pm-qui"><span class="av" aria-hidden="true">${esc(ini(x.nom))}</span><div><b>${esc(x.nom)}${moi(x)}</b><small>${[esc(x.lieu || ''), qteTxt(x, v), ilya(x.at)].filter(Boolean).join(' · ')}</small></div></div></div></li>`;
    const ligne = (x, i, v, ref) => { const ec = ref ? Math.round((x.prix - ref.prix) / ref.prix * 100) : 0;
      return `<li style="--i:${i}"><div class="pm-r"><span class="p">${F(x.prix)}</span><span class="q">${esc(x.nom)}${moi(x)} · ${esc(x.lieu || '')}</span>${ec ? `<span class="e">${ec > 0 ? '+' : '−'}${Math.abs(ec)} %</span>` : '<span></span>'}</div></li>`; };
    // le nom sur le bouton : entier s'il est court (« Restaurant Chez Tanti »), sinon les deux premiers mots
    const prenom = x => { const n = String(x.nom || '').trim(); return esc(n.length <= 22 ? n : n.split(/\s+/).slice(0, 2).join(' ')); };
    const panneau = c => {
      const v = c === 'v', L = v ? O : D, top = L[0], autre = v ? bud : best;
      const ech = L.length ? `<ol class="pm-ech${v ? '' : ' pm-d'}" aria-label="${v ? 'Les prix des vendeurs, du moins cher au plus cher' : 'Les budgets des acheteurs, du plus haut au plus bas'}">${tete(top, v)}${L.slice(1).map((x, i) => ligne(x, i + 1, v, top)).join('')}</ol>`
        : `<p class="pm-vide">${v ? 'Aucun vendeur pour l’instant.' : 'Aucun acheteur pour l’instant.'}</p>`;
      const vous = v
        ? `<div class="pm-vous v" style="--i:${L.length}"><b><span class="tri bas" aria-hidden="true"></span>Vous vendez ? Votre prix</b><small>${top ? `Proposez moins de ${F(top.prix)} ${esc(art)} : votre offre passe en tête. Plus cher, elle se range à sa place.` : 'Placez le premier prix de vente : les acheteurs de tout le pays le verront ici.'}</small></div>`
        : `<div class="pm-vous a" style="--i:${L.length}"><b><span class="tri haut" aria-hidden="true"></span>Vous achetez ? Votre budget</b><small>${top ? `Proposez plus de ${F(top.prix)} ${esc(art)} : votre demande passe en tête, les vendeurs vous voient d’abord.` : 'Placez la première demande : les vendeurs seront prévenus.'}</small></div>`;
      // l'autre côté, en une ligne : ce qui intéresse celui qui hésite
      const repere = autre ? `<p class="pm-rep ${v ? 'a' : 'v'}">${v ? `▲ Un acheteur paie jusqu’à <b>${F(autre.prix)}</b>` : `▼ Le moins cher vend à <b>${F(autre.prix)}</b>`}<button type="button" data-voir="${v ? 'a' : 'v'}">Voir ›</button></p>` : '';
      const neg = top && top.neg && !top.moi ? `<button type="button" class="neg" data-neg="${v ? 'offre' : 'demande'}">${v ? 'J’achète : négocier avec ' : 'Je vends : proposer à '}${prenom(top)}</button>` : '';
      return `${ech}${vous}${repere}<div class="pm-act"><button type="button" class="go${v ? ' v' : ''}" data-placer="${v ? 'offre' : 'demande'}">${v ? 'Placer mon prix de vente' : 'Placer mon budget d’achat'}</button>${neg}</div>`;
    };
    bg = document.createElement('div'); bg.className = 'pm-bg';
    bg.innerHTML = `<div class="pm" role="dialog" aria-modal="true" aria-labelledby="pmT"><span class="pm-poi" aria-hidden="true"></span><button type="button" class="pm-x" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      <div class="pm-hd">${o.img ? `<span class="im" aria-hidden="true"><img src="${esc(o.img)}" alt=""></span>` : ''}<div><small>${esc(o.nom)}${art ? ' · ' + esc(art) : ''}</small><h2 id="pmT">Ici, chacun <em>place son prix</em></h2></div></div>
      ${o.exemple ? '<p class="pm-ex">Exemple de démonstration : ces prix et ces noms ne sont pas réels.</p>' : ''}
      ${o.activite ? `<div class="pm-ac ${esc(o.activite.cls || '')}" role="status"><i aria-hidden="true">${(() => { const n = { '🔥': 'chaleur', '📈': 'tendance', '✅': 'verifie', '🤝': 'negoce', '🛒': 'panier' }[o.activite.ico]; return n && window.MDGIco ? MDGIco.svg(n, 17, 1.9) : esc(o.activite.ico); })()}</i><span><b>${esc(o.activite.t)}</b><small>${esc(o.activite.s)}</small></span></div>` : ''}
      <div class="pm-tabs" role="tablist" aria-label="Vendeurs ou acheteurs"><button type="button" role="tab" class="v" data-c="v">▼ Vendeurs <span class="nbul o">${O.length}</span></button><button type="button" role="tab" class="a" data-c="a">▲ Acheteurs <span class="nbul d">${D.length}</span></button></div>
      <div class="pm-pan" role="tabpanel"></div></div>`;
    document.body.appendChild(bg);
    const pan = bg.querySelector('.pm-pan');
    const montrer = c => { cote = c;
      bg.querySelectorAll('.pm-tabs [data-c]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.c === c)));
      pan.innerHTML = panneau(c); pan.classList.remove('in'); void pan.offsetWidth; pan.classList.add('in');
      pan.querySelectorAll('[data-placer]').forEach(b => b.onclick = () => { const k = b.dataset.placer; fermer(); o.placer && o.placer(k); });
      const ng = pan.querySelector('[data-neg]'); if (ng) ng.onclick = () => { const k = ng.dataset.neg; fermer(); o.negocier && o.negocier(k, 0); };
      const vr = pan.querySelector('[data-voir]'); if (vr) vr.onclick = () => montrer(vr.dataset.voir); };
    bg.querySelectorAll('.pm-tabs [data-c]').forEach(t => t.onclick = () => montrer(t.dataset.c));
    montrer(cote);
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); });
    bg.querySelector('.pm-x').onclick = fermer;
    document.addEventListener('keydown', clavier);
    try { bg.querySelector('.pm-x').focus({ preventScroll: true }); } catch (_) {}
    if (navigator.vibrate && MOUV()) try { navigator.vibrate(8); } catch (_) {}
  }
  window.MDGPrixMoment = { ouvrir, fermer };
})();
