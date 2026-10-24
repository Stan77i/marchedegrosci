/* Marché de Gros CI : « Ville seulement » (schéma 87, 24/10/2026).
   Un vendeur peut dire « je vends uniquement dans ma ville », un acheteur « j'achète uniquement dans ma ville ».
   La ville de référence est celle de l'annonce (city) ; pour une localité « X (près de Ville) », c'est la ville de rattachement. La base refuse une commande hors de cette ville (commande_creer2).
   Règle d'écriture du propriétaire : l'étiquette n'est jamais longue.
   - dans les endroits serrés : une pastille compacte « [épingle] Guiglo uniquement », une seule ligne, largeur fixe, coupée par « … » ;
     la phrase complète (« Vente uniquement à Guiglo ») est lue par les lecteurs d'écran et dans l'info-bulle ;
   - la phrase complète visible seulement là où il y a la place (classe « long » : carte de la carte du réseau, négociation, commande).
   API : MDGVilleSeule.nom(city) · cle(v) · phrase(sens, city) · courte(city) · pastille(sens, city, { long }) · avis(sens, city)
         aide(sens, city) · interrupteur(f, sens, set, h) · maVille() · autreVille(city) · PIN */
(function () {
  'use strict';
  if (window.MDGVilleSeule) return;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // la ville qui compte : celle de l'annonce, ou la ville de rattachement d'une localité
  // (« Napié (près de Ferkessédougou) » → « Ferkessédougou » ; même règle que la base, _ville_ref, schéma 87b)
  // une commune d'Abidjan (Cocody, Yopougon…) compte comme Abidjan (MDGVilles.ref)
  const ABJ = ['abidjan', 'abobo', 'adjame', 'anyama', 'attecoube', 'bingerville', 'brofodoume', 'cocody', 'koumassi', 'marcory', 'plateau', 'leplateau', 'portbouet', 'songon', 'treichville', 'yopougon'];
  const nom = c => { if (window.MDGVilles && MDGVilles.ref) return MDGVilles.ref(c); c = String(c || '').trim(); const m = /\(près de ([^)]+)\)\s*$/.exec(c); c = (m ? m[1] : c).trim(); return ABJ.indexOf(cle(c)) >= 0 ? 'Abidjan' : c; };
  // la même clé que la base (_ville_cle) : sans accent, sans espace ni signe
  const cle = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const offre = s => s === 'offre' || s === 'offres';
  const phrase = (sens, c) => (offre(sens) ? 'Vente' : 'Achat') + ' uniquement à ' + nom(c);
  const courte = c => nom(c) + ' uniquement';
  const PIN = '<svg class="vseule-i" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
  // le contenu de la pastille (les deux textes : la classe « long » choisit lequel se voit)
  const corps = (sens, c) => PIN + '<span class="vseule-t" aria-hidden="true"><span class="vseule-n">' + esc(nom(c)) + '</span><span class="vseule-u">&nbsp;uniquement</span></span><span class="vseule-l" aria-hidden="true">' + esc(phrase(sens, c)) + '</span><span class="vseule-sr">' + esc(phrase(sens, c)) + '</span>';
  const pastille = (sens, c, o) => '<span class="vseule' + (o && o.long ? ' long' : '') + '" title="' + esc(phrase(sens, c)) + '">' + corps(sens, c) + '</span>';
  // ce qu'un membre d'une autre ville doit savoir avant d'écrire, de proposer ou de commander
  const avis = (sens, c) => offre(sens) ? 'Ce vendeur vend uniquement à ' + nom(c) + ' : la livraison se fait à ' + nom(c) + '.'
    : 'Cet acheteur achète uniquement à ' + nom(c) + ' : la marchandise doit se trouver à ' + nom(c) + '.';
  const aide = (sens, c) => !nom(c) ? 'Choisissez d’abord votre ville.'
    : offre(sens) ? 'Visible partout, livraison à ' + nom(c) + ' seulement.'
    : 'Visible partout, marchandise à ' + nom(c) + ' seulement.';
  // la ville du membre connecté (son profil), sinon celle retenue sur ce téléphone
  const maVille = () => { try { const C = window.MDGCompte, p = C && C.profil && C.profil(); if (p && p.ville) return p.ville; const m = JSON.parse(localStorage.getItem('mdg-app:moi') || 'null'); return (m && m.city) || ''; } catch (_) { return ''; } };
  // vrai si on sait que le membre est ailleurs ; null si on ne sait pas
  const autreVille = c => { const m = maVille(); return m ? cle(nom(m)) !== cle(nom(c)) : null; };

  // l'interrupteur du formulaire de publication (React) : f = le formulaire ({ city, vs }), set({ vs })
  function interrupteur(f, sens, set, h) {
    h = h || (window.React && React.createElement); if (!h) return null;
    const c = nom(f.city), on = !!(f.vs && c);
    const lab = (offre(sens) ? 'Je vends uniquement ' : 'J’achète uniquement ') + (c ? 'à ' + c : 'dans ma ville');
    return h('button', { type: 'button', role: 'switch', 'aria-checked': on ? 'true' : 'false', disabled: !c, className: 'vs-sw', onClick: () => set({ vs: !on }) },
      h('span', { className: 'vs-sw-tr', 'aria-hidden': 'true' }),
      h('span', { className: 'vs-sw-tx' }, h('b', null, lab), h('small', null, aide(sens, c))));
  }

  const CSS = `
.vseule{position:relative;display:inline-flex;align-self:flex-start;align-items:center;gap:3px;box-sizing:border-box;max-width:min(168px,100%);min-width:0;height:24px;padding:0 8px 0 6px;border-radius:999px;background:#E2ECE4;color:#10392B;font:600 12.5px/1 Jost,sans-serif;white-space:nowrap;overflow:hidden;vertical-align:middle;flex:0 1 auto}
.vseule .vseule-i{flex:none}
.vseule .vseule-t,.vseule .vseule-l{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vseule .vseule-t{display:flex;gap:0}
.vseule .vseule-t .vseule-n{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vseule .vseule-t .vseule-u{display:block;flex:none;white-space:pre}
html .vseule.vseule .vseule-t span.vseule-n,html .vseule.vseule .vseule-t span.vseule-u{min-height:0;padding:0;margin:0;background:none;border-radius:0;color:inherit}
.vseule .vseule-l{display:none}
.vseule.long{max-width:100%;height:28px;font-size:13.5px}
.vseule.long .vseule-t{display:none}.vseule.long .vseule-l{display:block}
.vseule .vseule-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.an-infos span.vseule.vseule{display:inline-flex;min-height:26px;height:26px;padding:0 10px 0 8px;background:#E2ECE4;color:#10392B;font-size:var(--t-sm,13px);font-weight:600}
.an-infos span.vseule.vseule .vseule-t{display:flex;gap:0;min-height:0;padding:0;background:none;border-radius:0}
.an-infos span.vseule.vseule .vseule-l{display:block;min-height:0;padding:0;background:none;border-radius:0}
.an-infos span.vseule.vseule .vseule-l{display:none}
.an-infos span.vseule.vseule .vseule-sr{display:block;padding:0;min-height:0}
.an-carte .an-infos > span.vseule.vseule{display:inline-flex;max-width:100%}
.an-carte .an-infos span.vseule.vseule .vseule-t{display:none}.an-carte .an-infos span.vseule.vseule .vseule-l{display:block}
html[data-theme=sombre] .vseule.vseule,html[data-theme=sombre] .an-infos span.vseule.vseule{background:#24342A;color:#A9E2BB}
.vs-sw{flex:none;display:flex;align-items:flex-start;gap:12px;width:100%;box-sizing:border-box;min-height:44px;margin:0;padding:12px 14px;border:1px solid var(--trait,rgba(23,21,18,.18));border-radius:14px;background:var(--champ,#FFFAF3);color:var(--encre,#171512);text-align:left;font:inherit;cursor:pointer}
.vs-sw[aria-checked=true]{border-color:#10392B;box-shadow:inset 0 0 0 1px #10392B}
.vs-sw:disabled{cursor:default}
.vs-sw:disabled .vs-sw-tr{opacity:.5}
.vs-sw:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.vs-sw-tr{flex:none;position:relative;width:44px;height:26px;margin-top:1px;border-radius:13px;background:#8A8172;transition:background .2s}
.vs-sw-tr::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#FFFAF3;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.vs-sw[aria-checked=true] .vs-sw-tr{background:#10392B}
.vs-sw[aria-checked=true] .vs-sw-tr::after{transform:translateX(18px)}
.vs-sw-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.vs-sw-tx b{font-weight:600;font-size:var(--t-base,16px);line-height:1.3;overflow-wrap:anywhere}
.vs-sw-tx small{font-size:var(--t-sm,13.5px);color:var(--texte-3,#655C4D);line-height:1.4}
html[data-theme=sombre] .vs-sw[aria-checked=true]{border-color:#9FDCB2;box-shadow:inset 0 0 0 1px #9FDCB2}
html[data-theme=sombre] .vs-sw-tr{background:#8C8373}
html[data-theme=sombre] .vs-sw[aria-checked=true] .vs-sw-tr{background:#9FDCB2}
html[data-theme=sombre] .vs-sw-tr::after{background:#14120F}
html[data-theme=sombre] .vs-sw:focus-visible{outline-color:#9FDCB2}
.vs-avis{display:flex;align-items:flex-start;gap:8px;margin:0;padding:10px 12px;border-radius:12px;background:#E2ECE4;color:#10392B;font:500 14px/1.45 Jost,sans-serif}
.vs-avis .vseule-i{flex:none;width:16px;height:16px;margin-top:2px}
.vs-avis b{font-weight:700}
html[data-theme=sombre] .vs-avis{background:#24342A;color:#A9E2BB}
.nx-b .vs-avis,.cm-f .vs-avis{margin:0 0 14px}
.dm-b .vs-avis{max-width:340px;margin:0 auto 14px}
.vs-sw:disabled .vs-sw-tx b{color:var(--texte-3,#655C4D)}
@media (prefers-reduced-motion:reduce){.vs-sw-tr,.vs-sw-tr::after{transition:none}}`;
  // l'avertissement (négociation, message, commande) : la phrase, puis la ville du membre s'il est ailleurs
  const avertir = (sens, c) => { const m = maVille(), loin = m && cle(nom(m)) !== cle(nom(c));
    return '<p class="vs-avis" role="note">' + PIN + '<span><b>' + esc(phrase(sens, c)) + '.</b> ' + esc(avis(sens, c).replace(/^[^:]*:\s*/, '').replace(/^./, x => x.toUpperCase())) + (loin ? ' Vous êtes à ' + esc(nom(m)) + '.' : '') + '</span></p>'; };
  function poserCSS() { if (document.getElementById('vseule-css')) return; const s = document.createElement('style'); s.id = 'vseule-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  poserCSS();
  window.MDGVilleSeule = { nom, cle, phrase, courte, pastille, corps, avis, aide, avertir, interrupteur, maVille, autreVille, PIN };
})();
