/* ═════════ Marché de Gros CI — réputation : étoiles, avis, profils, mieux notés, signalements avec raison ═════════
   Comme sur les plateformes d'échange entre particuliers : on note quelqu'un avec qui on a vraiment négocié (la base le vérifie),
   tout le monde voit sa moyenne, son nombre d'avis et les derniers commentaires ; un classement montre les mieux notés.
   Signaler demande une raison ; les autres voient les raisons (catégories) et le nombre de signalements d'une annonce.
   Serveur : supabase/schema-7.sql. API : MDGRep.etoiles(m, n, taille) · resume(uid) · charger(uids) · signal(rid) · chargerSignal(rids)
   · profil(uid, { nom, avatar }) · noter(uid, nom) · classement() · signaler({ kind, rid, titre }) ; événement « mdg:rep » quand une donnée arrive. */
(function () {
  'use strict';
  const N = () => window.MDGNuage, A = () => window.MDGAvatar;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const notes = {}, sig = {}, attenteN = new Set(), attenteS = new Set();
  let tN = 0, tS = 0;
  const dire = () => dispatchEvent(new CustomEvent('mdg:rep'));
  const RAISONS = ['Prix trompeur', 'Produit indisponible', 'Arnaque suspectée', 'Coordonnées fausses', 'Annonce en double', 'Contenu déplacé'];

  // ——— données (par lots, une seule requête pour tout ce qui est affiché) ———
  function charger(uids) {
    (uids || []).forEach(u => { if (u && !(u in notes)) attenteN.add(u); });
    if (!attenteN.size || !N()) return; clearTimeout(tN);
    tN = setTimeout(async () => { const ids = [...attenteN]; attenteN.clear(); ids.forEach(u => { notes[u] = notes[u] || null; });
      try { const r = await N().rpc('notes_publiques', { ids }, !!N().session()); (r || []).forEach(x => { notes[x.user_id] = { m: +x.moyenne, n: x.nombre }; }); dire(); } catch (_) {} }, 60);
  }
  function chargerSignal(rids) {
    (rids || []).forEach(r => { if (r && !(r in sig)) attenteS.add(r); });
    if (!attenteS.size || !N()) return; clearTimeout(tS);
    tS = setTimeout(async () => { const ids = [...attenteS]; attenteS.clear(); ids.forEach(r => { sig[r] = sig[r] || null; });
      try { const r = await N().rpc('signalements_publics', { ids }, !!N().session()); (r || []).forEach(x => { sig[x.cible_id] = { n: x.nombre, raisons: (x.raisons || []).filter(Boolean) }; }); dire(); } catch (_) {} }, 60);
  }
  const resume = uid => { if (!uid) return null; if (!(uid in notes)) charger([uid]); return notes[uid] || null; };
  const signal = rid => { if (!rid) return null; if (!(rid in sig)) chargerSignal([rid]); return sig[rid] || null; };

  // ——— étoiles : cinq étoiles dessinées, remplies au dixième près ———
  function etoiles(m, n, t = 14, clair) {
    const v = Math.max(0, Math.min(5, +m || 0)), w = (v / 5 * 100).toFixed(1);
    const une = '<path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.6 7.7l5.8-.8z"/>';
    const rang = c => `<svg viewBox="0 0 100 20" width="${t * 5}" height="${t}" aria-hidden="true" style="display:block;max-width:none">${[0, 1, 2, 3, 4].map(i => `<g transform="translate(${i * 20} 0)" fill="${c}">${une}</g>`).join('')}</svg>`;
    return `<span class="rp-et" role="img" aria-label="${n ? v.toFixed(1).replace('.', ',') + ' sur 5, ' + n + ' avis' : 'Pas encore noté'}" style="display:inline-flex;vertical-align:middle;flex:none"><span class="rp-et-f" style="position:relative;display:inline-block;line-height:0">${rang(clair ? 'rgba(23,21,18,.16)' : 'rgba(23,21,18,.18)')}<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;width:${w}%">${rang('#F2C94C')}</span></span></span>`;
  }
  const texteNote = r => r && r.n ? r.m.toFixed(1).replace('.', ',') + ' · ' + r.n + ' avis' : 'Nouveau';

  // ——— feuille commune (sombre, depuis le bas) ———
  const CSS = `.rp-bg{position:fixed;inset:0;z-index:9300;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:rpIn .2s ease both}
@media (min-width:720px){.rp-bg{align-items:center;padding:24px}}
.rp{position:relative;width:100%;max-width:520px;max-height:min(90dvh,820px);overflow-x:hidden;overflow-y:auto;background:#F4EEE3;color:#171512;border-radius:28px 28px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));font:400 15px/1.5 Jost,system-ui,sans-serif;box-shadow:0 -10px 50px rgba(0,0,0,.5);animation:rpUp .36s cubic-bezier(.22,1,.36,1) both;overscroll-behavior:contain}
@media (min-width:720px){.rp{border-radius:28px}}
.rp h2{margin:0 44px 4px 0;font:600 23px/1.1 Jost,sans-serif;letter-spacing:-.015em}.rp>p{margin:0 0 16px;color:#655C4D;font-size:14px}
.rp-x{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(23,21,18,.08);color:#171512;font-size:0;cursor:pointer}
.rp-x::before,.rp-x::after{content:"";position:absolute;left:50%;top:50%;width:15px;height:2px;border-radius:2px;background:currentColor;transform:translate(-50%,-50%) rotate(45deg)}.rp-x::after{transform:translate(-50%,-50%) rotate(-45deg)}
.rp-go{width:100%;min-height:54px;margin-top:16px;border:0;border-radius:999px;background:#10392B;color:#F3EFE4;font:700 16px Jost,sans-serif;cursor:pointer}.rp-go:disabled{opacity:.45;cursor:default}
.rp-duo{display:flex;gap:8px}.rp-duo .rp-go{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 14px}.rp-duo .rp-ecr{flex:0 0 38%;background:none;box-shadow:inset 0 0 0 1.5px rgba(23,21,18,.28);color:#171512}
.rp-alt{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:#EFE7D9;color:#171512;font:600 14px Jost,sans-serif;cursor:pointer}
.rp-et{display:inline-flex;vertical-align:middle}.rp-et-f{position:relative;display:inline-block;line-height:0}.rp-et-f>span{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap}
.rp-ch{display:flex;flex-wrap:wrap;gap:8px}.rp-ch button{min-height:44px;padding:0 15px;border:1px solid rgba(23,21,18,.18);border-radius:999px;background:none;color:#2A251E;font:500 14px Jost,sans-serif;cursor:pointer;transition:background .2s,border-color .2s,color .2s}
.rp-ch button[aria-pressed=true]{background:#171512;border-color:#171512;color:#F5F0E6}
.rp textarea{width:100%;min-height:84px;margin-top:14px;padding:12px 14px;border:1px solid rgba(23,21,18,.16);border-radius:16px;background:#FFFFFF;color:#171512;font:400 15px/1.45 Jost,sans-serif;resize:vertical;box-sizing:border-box}
.rp textarea:focus{outline:none;border-color:#10392B;box-shadow:0 0 0 3px rgba(16,57,43,.2)}
.rp-msg{min-height:20px;margin:8px 2px 0;color:#C0442B;font-size:13.5px}
.rp-org{margin:0 0 18px;padding:14px;border-radius:20px;background:#fff;box-shadow:0 1px 2px rgba(23,21,18,.05),0 6px 18px rgba(23,21,18,.05)}
.rp-org-t{display:flex;align-items:center;gap:14px}.rp-org-t>div{min-width:0}
.rp-org-logo{flex:none;width:56px;height:56px;border-radius:16px;object-fit:contain;background:#fff;box-shadow:0 0 0 1px rgba(23,21,18,.1)}
.rp-org-logo.vide{display:grid;place-items:center;background:#10392B;color:#F2C230;font:900 italic 26px/1 Jost,sans-serif;box-shadow:none}
.rp-org-t small{display:block;font:600 13px/1.2 Jost,sans-serif;letter-spacing:0;color:#4A6A53}
.rp-org-t b{display:block;margin-top:3px;font:600 19px/1.15 Jost,sans-serif;letter-spacing:-.015em;color:#171512;overflow-wrap:anywhere}
.rp-org-st{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.rp-org-pv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.rp-org-pv button{padding:0;border:0;border-radius:12px;overflow:hidden;aspect-ratio:1;background:#EFE9DC;cursor:zoom-in}.rp-org-pv img{width:100%;height:100%;object-fit:cover;display:block}
.rp-org-pv button:focus-visible{outline:2px solid #10392B;outline-offset:2px}
.rp-org-n{margin:10px 0 0;font-size:12.5px;line-height:1.45;color:#5E574B}
.rp-org-ok{display:inline-flex;align-items:center;padding:1px 8px;border-radius:10px;background:#DCEFE3;color:#10392B;font-weight:600}.rp-org-v{padding:10px 12px;border-radius:14px;background:#DCEFE3;color:#10392B}
.rp-loupe{position:fixed;inset:0;z-index:9700;display:grid;place-items:center;padding:56px 12px 90px;background:rgba(10,9,7,.9)}.rp-loupe img{max-width:100%;max-height:100%;border-radius:12px;object-fit:contain}
.rp-loupe-b{position:absolute;left:0;right:0;bottom:calc(20px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;justify-content:center;gap:14px;color:#F3EFE4;font:600 14px Jost,sans-serif}
.rp-loupe-b button{width:48px;height:48px;border:0;border-radius:50%;background:rgba(243,239,228,.14);color:#F3EFE4;font:500 26px/1 Jost,sans-serif;cursor:pointer}.rp-loupe-b button:focus-visible{outline:2px solid #F2C230;outline-offset:2px}
.rp-tete{display:flex;align-items:center;gap:16px;margin:0 0 18px;padding-right:44px}.rp-tete img{border-radius:50%;box-shadow:0 0 0 3px rgba(23,21,18,.08)}
.rp-tete b{display:block;font:600 23px/1.05 Jost,sans-serif;letter-spacing:-.015em}.rp-tete small{display:flex;align-items:center;gap:8px;margin-top:6px;color:#655C4D;font-size:13.5px}
.rp-score{display:flex;align-items:center;gap:16px;padding:16px;border-radius:20px;background:rgba(23,21,18,.04);box-shadow:inset 0 0 0 1px rgba(23,21,18,.08)}
.rp-score strong{font:800 37px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.rp-score span{display:flex;flex-direction:column;gap:6px;color:#655C4D;font-size:13px}
.rp-barres{flex:1;display:grid;gap:3px}.rp-barres div{display:grid;grid-template-columns:12px 1fr;gap:6px;align-items:center;font-size:11.5px;color:#6F6553}.rp-barres i{height:5px;border-radius:3px;background:rgba(23,21,18,.08);overflow:hidden}.rp-barres i b{display:block;height:100%;background:#F2C94C;border-radius:3px}
.rp-av{display:grid;gap:10px;margin-top:16px}.rp-av article{padding:14px;border-radius:18px;background:rgba(23,21,18,.03);box-shadow:inset 0 0 0 1px rgba(23,21,18,.07)}
.rp-av header{display:flex;align-items:center;gap:10px;margin-bottom:6px}.rp-av header img{border-radius:50%}.rp-av header b{font-size:14px}.rp-av header small{margin-left:auto;color:#6F6553;font-size:12px}
.rp-av p{margin:0;color:#2A251E;font-size:14px}
.rp-vide{padding:22px 16px;border:1px dashed rgba(23,21,18,.16);border-radius:18px;text-align:center;color:#655C4D;font-size:14px}
.rp-big{display:flex;justify-content:center;gap:6px;margin:6px 0 4px}.rp-big button{width:52px;height:52px;border:0;background:none;padding:4px;cursor:pointer;transition:transform .18s cubic-bezier(.22,1,.36,1)}
.rp-big button:active{transform:scale(.9)}.rp-big svg{width:100%;height:100%}.rp-big path{fill:rgba(23,21,18,.14);transition:fill .2s}.rp-big button.on path{fill:#F2C94C}.rp-big button.pop{animation:rpPop .35s cubic-bezier(.22,1,.36,1)}
.rp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 16px}.rp-stats div{padding:12px 10px;border-radius:16px;background:rgba(23,21,18,.04);box-shadow:inset 0 0 0 1px rgba(23,21,18,.08);text-align:center}
.rp-stats b{display:block;font:800 22px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em}.rp-stats small{display:block;margin-top:4px;color:#655C4D;font-size:12px;line-height:1.25}
.rp-rep{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rp-rep-c{background:#FFFDF8;border-radius:14px;padding:11px 12px;min-width:0}.rp-rep-c h4{margin:0 0 4px;font:600 14px/1.2 Jost,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.rp-rep-c p{margin:0 0 6px;font-size:13px;color:#4A4336}.rp-rep-c ul{list-style:none;margin:0;padding:0;font-size:13px;color:#4A4336}.rp-rep-c li{padding:3px 0;border-top:1px solid #ECE6D6}.rp-rep-c li b{color:#171512}
.rp-fiable{display:inline-flex;align-items:center;min-height:20px;padding:0 8px;border-radius:10px;background:#10392B;color:#F2C230;font:700 11px/1 Jost,sans-serif;letter-spacing:.04em}
.rp-rep-n{margin:8px 0 0;font-size:12.5px;color:#5E5546}.rp-rep-ens{color:#10392B;font-weight:600;font-size:13.5px}
.rp-av-r{display:block;margin:2px 0 0 34px;font-size:12px;color:#5E5546}.rp-av-v{flex:none;padding:2px 7px;border-radius:999px;background:rgba(16,57,43,.1);color:#10392B;font-size:11px;font-weight:700}
@media (max-width:330px){.rp-rep{grid-template-columns:1fr}}
.rp-sec{margin:18px 0 0}.rp-sec h3{margin:0 0 8px;font:600 13px Jost,sans-serif;letter-spacing:0;color:#655C4D;}
.rp-bio{margin:0;color:#2A251E;font-size:15px;line-height:1.55;white-space:pre-wrap}
.rp-tags{display:flex;flex-wrap:wrap;gap:6px}.rp-tags span{padding:5px 11px;border-radius:999px;background:rgba(23,21,18,.07);color:#2A251E;font-size:13px}
.rp-ph{display:flex;gap:8px;overflow-x:auto;margin:0 -20px;padding:0 20px 4px;scroll-snap-type:x mandatory}.rp-ph img{flex:none;width:150px;height:150px;object-fit:cover;border-radius:16px;scroll-snap-align:start;background:#FFFFFF}
.rp-li{display:grid;gap:6px}.rp-li div{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:rgba(23,21,18,.03);box-shadow:inset 0 0 0 1px rgba(23,21,18,.07);font-size:14px}
.rp-li i{flex:none;width:10px;height:10px}.rp-li i.o, .rp-li i.d{display:inline-grid;place-items:center;flex:none;width:18px;height:18px;border-radius:50%;background:rgba(108,197,140,.22);box-shadow:inset 0 0 0 1px rgba(108,197,140,.55);font:normal 11px/1 "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-style:normal}.rp-li i.o::before,.rp-li i.d::before{content:"";display:block;width:74%;height:74%;background:var(--sym-o) center/contain no-repeat}.rp-li i.d{border-radius:30%;background:rgba(242,194,48,.24);box-shadow:inset 0 0 0 1px rgba(242,194,48,.6)}.rp-li i.d::before{content:"";display:block;width:74%;height:74%;background:var(--sym-d) center/contain no-repeat}.rp-li .v{border-radius:50%;background:#6AAEF0}
.rp-li span{flex:1;min-width:0}.rp-li small{color:#6F6553;font-size:12px;white-space:nowrap}
.rp-off{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:rgba(16,57,43,.2);color:#A0492A;font:700 10.5px/1.7 Jost,sans-serif;letter-spacing:.06em;text-transform:uppercase;vertical-align:4px}
.rp-ed label{display:block;margin:14px 0 6px;font:500 14px Jost,sans-serif;color:#2A251E}.rp-ed label i{font-style:normal;color:#6F6553;font-size:12.5px;margin-left:6px}
.rp-ed input{width:100%;box-sizing:border-box;height:50px;padding:0 14px;border:1px solid rgba(23,21,18,.16);border-radius:14px;background:#FFFFFF;color:#171512;font:500 16px Jost,sans-serif}
.rp-ed textarea{margin-top:0;min-height:120px}
.rp-ed .grille{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.rp-ed .grille div{position:relative;aspect-ratio:1;border-radius:14px;overflow:hidden;background:#FFFFFF}
.rp-ed .grille img{width:100%;height:100%;object-fit:cover}.rp-ed .grille button{position:absolute;right:0;top:0;width:44px;height:44px;border:0;border-radius:50%;background:rgba(10,9,7,.75);color:#F3EFE4;cursor:pointer}
.rp-ed .ajout{display:flex;align-items:center;justify-content:center;aspect-ratio:1;border:1.5px dashed rgba(23,21,18,.25);border-radius:14px;color:#655C4D;font-size:13px;text-align:center;cursor:pointer;position:relative}
.rp-ed .ajout input{position:absolute;inset:0;opacity:0;height:auto}
.rp-lib{text-align:center;color:#765802;font-weight:600;min-height:22px}
.rp-cl{display:grid;gap:8px}.rp-cl button{display:grid;grid-template-columns:26px 44px 1fr auto;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;border-radius:18px;background:rgba(23,21,18,.03);box-shadow:inset 0 0 0 1px rgba(23,21,18,.07);color:#171512;text-align:left;cursor:pointer;font:inherit}
.rp-cl em{font-style:normal;font:800 16px/1 Jost,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:-.01em;color:#6F6553;text-align:center}.rp-cl button:nth-child(-n+3) em{color:#765802}
.rp-cl img{border-radius:50%}.rp-cl b{display:block;font-size:15px}.rp-cl small{display:flex;align-items:center;gap:6px;color:#655C4D;font-size:12.5px;margin-top:2px}.rp-cl i{font-style:normal;color:#6F6553;font-size:12px;text-align:right}
@keyframes rpIn{from{opacity:0}}@keyframes rpUp{from{transform:translateY(40px);opacity:0}}@keyframes rpPop{50%{transform:scale(1.25)}}
@media (prefers-reduced-motion:reduce){.rp-bg,.rp,.rp-big button.pop{animation:none}}`;
  function feuille(html, label) {
    if (!document.getElementById('rpCss')) { const st = document.createElement('style'); st.id = 'rpCss'; st.textContent = CSS; document.head.appendChild(st); }
    const bg = document.createElement('div'); bg.className = 'rp-bg';
    bg.innerHTML = `<div class="rp" role="dialog" aria-modal="true" aria-label="${esc(label)}"><button type="button" class="rp-x" aria-label="Fermer"></button>${html}</div>`;
    document.body.appendChild(bg);
    const rendre = N() && N().piege ? N().piege(bg) : null;
    const fermer = () => { bg.remove(); removeEventListener('keydown', k); rendre && rendre(); };
    const k = e => { if (e.key === 'Escape') fermer(); };
    bg.addEventListener('click', e => { if (e.target === bg) fermer(); }); bg.querySelector('.rp-x').onclick = fermer; addEventListener('keydown', k);
    bg.fermer = fermer; return bg;
  }
  const avatar = (uid, av, nom, t, uri) => uri || A() ? `<img src="${uri || A().uri(av, { size: t, nom: nom || '?', seed: uid })}" width="${t}" height="${t}" alt="">` : '';
  const quand = t => { const d = (Date.now() - Date.parse(t)) / 864e5; return d < 1 ? 'aujourd’hui' : d < 2 ? 'hier' : d < 30 ? 'il y a ' + Math.round(d) + ' j' : new Date(t).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }); };

  // ——— signaler : une raison obligatoire, une précision possible ———
  function signaler({ kind, rid, titre }) {
    if (!rid) return;
    const bg = feuille(`<h2>Signaler cette annonce</h2><p>${esc(titre || 'Dites-nous ce qui ne va pas.')} La raison choisie sera visible des autres utilisateurs ; votre précision, seulement de l’équipe.</p>
      <div class="rp-ch" role="group" aria-label="Raison">${RAISONS.map(r => `<button type="button" aria-pressed="false">${r}</button>`).join('')}</div>
      <textarea maxlength="240" placeholder="Précisez si vous voulez (facultatif)"></textarea><p class="rp-msg" role="alert"></p>
      <button type="button" class="rp-go" disabled>Envoyer le signalement</button>`, 'Signaler cette annonce');
    let choix = ''; const go = bg.querySelector('.rp-go');
    bg.querySelectorAll('.rp-ch button').forEach(b => b.onclick = () => { choix = b.textContent; bg.querySelectorAll('.rp-ch button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); go.disabled = false; });
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Envoi…';
      const prec = bg.querySelector('textarea').value.trim();
      try { await N().report(kind, rid, choix + (prec ? ' : ' + prec : '')); delete sig[rid]; chargerSignal([rid]); bg.fermer(); N().toast('Merci. Signalement envoyé : « ' + choix + ' ».'); }
      catch (_) { go.disabled = false; go.textContent = 'Envoyer le signalement'; bg.querySelector('.rp-msg').textContent = 'L’envoi n’a pas abouti. Vérifiez la connexion, puis réessayez.'; }
    };
  }

  // ——— noter : cinq grandes étoiles, un mot possible ———
  const LIB = ['', 'Mauvaise expérience', 'Décevant', 'Correct', 'Bon partenaire', 'Excellent partenaire'];
  async function noter(uid, nom, apres) {
    if (!N() || !N().session()) return N() && N().open();
    let deja = null; try { deja = await N().rpc('peut_noter', { p_cible: uid }); } catch (_) {}
    if (deja && !deja.peut) return N().toast(deja.raison === 'apres_commande' ? 'Les avis se donnent après une commande terminée, depuis Mes commandes.' : 'Vous pourrez noter ' + (nom || 'ce membre') + ' après une commande terminée ensemble.');
    const star = '<svg viewBox="0 0 20 20"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.6 7.7l5.8-.8z"/></svg>';
    const bg = feuille(`<h2>Noter ${esc(nom || 'ce membre')}</h2><p>Votre note aide les autres à choisir avec qui échanger. Vous pourrez la changer plus tard.</p>
      <div class="rp-big" role="radiogroup" aria-label="Note">${[1, 2, 3, 4, 5].map(i => `<button type="button" role="radio" aria-checked="false" aria-label="${i} étoile${i > 1 ? 's' : ''}" data-n="${i}">${star}</button>`).join('')}</div>
      <p class="rp-lib" aria-live="polite"></p><textarea maxlength="300" placeholder="Un mot sur l’échange (facultatif) : ponctualité, qualité, respect du prix…">${esc(deja && deja.texte || '')}</textarea><p class="rp-msg" role="alert"></p>
      <button type="button" class="rp-go" disabled>Publier ma note</button>`, 'Noter');
    let n = 0; const go = bg.querySelector('.rp-go'), lib = bg.querySelector('.rp-lib');
    const montrer = v => { bg.querySelectorAll('.rp-big button').forEach(b => { const on = +b.dataset.n <= v; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(+b.dataset.n === v)); }); lib.textContent = LIB[v] || ''; };
    bg.querySelectorAll('.rp-big button').forEach(b => b.onclick = () => { n = +b.dataset.n; montrer(n); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); go.disabled = false; });
    if (deja && deja.note) { n = deja.note; montrer(n); go.disabled = false; go.textContent = 'Mettre à jour ma note'; }
    go.onclick = async () => {
      const rf = N().texteRefus ? N().texteRefus(bg.querySelector('textarea').value) : ''; if (rf) { bg.querySelector('.rp-msg').textContent = rf; return; }
      go.disabled = true; go.textContent = 'Publication…';
      try { await N().rpc('noter', { p_cible: uid, p_note: n, p_texte: bg.querySelector('textarea').value.trim() || null }); delete notes[uid]; charger([uid]); bg.fermer(); N().toast('Merci, votre note est publiée.'); apres && apres(); }
      catch (x) { go.disabled = false; go.textContent = 'Publier ma note'; bg.querySelector('.rp-msg').textContent = /PAS_DE_NEGOCIATION|AVIS_APRES_COMMANDE/.test(x.message) ? 'Les avis se donnent après une commande terminée, depuis Mes commandes.' : x.code === 'texte' ? x.message : 'La publication n’a pas abouti. Réessayez.'; }
    };
  }

  // ——— fiche profil : qui il est, ce qu'il fait, ce qu'il a vendu, où ; note, avis, et noter ———
  const REGN = slug => { const r = window.MDG && MDG.regions && MDG.regions.find(x => x.slug === slug); return r ? r.name : slug; };
  const mois = t => t ? new Date(t).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '';
  const actif = t => { if (!t) return ''; const m = (Date.now() - Date.parse(t)) / 6e4; return m < 10 ? 'actif à l’instant' : m < 60 ? 'actif il y a ' + Math.round(m) + ' min' : m < 1440 ? 'actif il y a ' + Math.round(m / 60) + ' h' : m < 2880 ? 'actif hier' : 'actif il y a ' + Math.round(m / 1440) + ' j'; };
  const fq = n => n == null ? '' : Number(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
  // seulement le stockage de l'application (schéma 74) : jamais une image venue d'un autre site
  const photoUrl = p => !p || /^[a-z]+:|^\/\//i.test(p) ? '' : (N() && N().URL ? N().URL + '/storage/v1/object/public/activites/' + p : '');
  // ——— la structure en tête du profil : logo, type, nom, réputation, preuves (agrandissables) ———
  const TYPE_ORG = { cooperative: 'Coopérative', groupement: 'Groupement', entreprise: 'Entreprise', marche: 'Marché' };
  function carteStructure(st, uid) {
    const pv = (st.preuves || []).slice(0, 4), puces = window.MDGStatut ? MDGStatut.puces(uid, { max: 2 }) : '';
    return `<section class="rp-org" aria-label="Structure représentée">
      <div class="rp-org-t">${st.logo ? `<img class="rp-org-logo" src="${esc(photoUrl(st.logo))}" alt="Logo de ${esc(st.nom)}">` : `<span class="rp-org-logo vide" aria-hidden="true">${esc((st.nom || '?').trim().charAt(0).toUpperCase())}</span>`}
        <div><small>${esc(TYPE_ORG[st.type] || 'Structure')}${st.verifiee ? ' · <span class="rp-org-ok">vérifiée par l’équipe</span>' : ''}</small><b>${esc(st.nom)}</b>${puces ? `<span class="rp-org-st">${puces}</span>` : ''}</div></div>
      ${pv.length ? `<div class="rp-org-pv">${pv.map((c, i) => `<button type="button" data-pv="${i}" aria-label="Agrandir la preuve ${i + 1}"><img src="${esc(photoUrl(c))}" alt="" loading="lazy"></button>`).join('')}</div>
        <p class="rp-org-n">Photos publiées par le membre (enseigne, entrepôt, agrément…)${st.verifiee ? '.' : ' : le Marché de Gros ne les a pas vérifiées. Voyez la marchandise avant de payer.'}</p>` : ''}
      ${st.verifiee ? `<p class="rp-org-n rp-org-v">L’équipe du Marché de Gros a vu un document officiel de la structure et vérifié l’identité de son responsable${st.fonction ? ' (' + esc(st.fonction.toLowerCase()) + ')' : ''}. Vérifiée ne veut pas dire fiable : regardez aussi la réputation.</p>` : ''}
    </section>`;
  }
  // une preuve en grand, avec précédente / suivante ; Échap ou toucher le fond pour fermer
  function lierPreuves(z, pv) {
    z.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => {
      let i = +b.dataset.pv; const v = document.createElement('div'); v.className = 'rp-loupe'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Preuve en grand');
      const peindre = () => { v.innerHTML = `<img src="${esc(photoUrl(pv[i]))}" alt="Preuve ${i + 1} sur ${pv.length}"><div class="rp-loupe-b">${pv.length > 1 ? '<button type="button" data-p aria-label="Preuve précédente">‹</button>' : ''}<span>${i + 1} / ${pv.length}</span>${pv.length > 1 ? '<button type="button" data-n aria-label="Preuve suivante">›</button>' : ''}<button type="button" data-x aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="display:block;margin:auto"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`;
        const g = (sel, f) => { const e = v.querySelector(sel); if (e) e.onclick = ev => { ev.stopPropagation(); f(); }; };
        g('[data-p]', () => { i = (i + pv.length - 1) % pv.length; peindre(); }); g('[data-n]', () => { i = (i + 1) % pv.length; peindre(); }); g('[data-x]', fin); const x = v.querySelector('[data-x]'); if (x) x.focus(); };
      const cle = e => { if (e.key === 'Escape') fin(); else if (e.key === 'ArrowRight' && pv.length > 1) { i = (i + 1) % pv.length; peindre(); } else if (e.key === 'ArrowLeft' && pv.length > 1) { i = (i + pv.length - 1) % pv.length; peindre(); } };
      function fin() { removeEventListener('keydown', cle); v.remove(); b.focus(); }
      v.onclick = e => { if (e.target === v) fin(); }; addEventListener('keydown', cle); document.body.appendChild(v); peindre();
    });
  }
  // ——— réputation par rôle (schéma 32) : calculée par le serveur, sur les commandes ; « vérifié » n'est pas « fiable » ———
  function blocReputation(r, moi) {
    if (!r) return '<div class="rp-vide">Réputation indisponible pour l’instant.</div>';
    const col = (t, x) => { x = x || {}; const n = x.terminees || 0;
      return `<div class="rp-rep-c"><h4>${t}${x.fiable ? ' <span class="rp-fiable">Fiable</span>' : ''}</h4>
        <p>${x.avis ? etoiles(+x.note, x.avis, 13) + ' ' + String(x.note).replace('.', ',') + ' · ' + x.avis + ' avis' : 'Pas encore noté'}</p>
        <ul><li><b>${n}</b> commande${n > 1 ? 's' : ''} honorée${n > 1 ? 's' : ''}</li><li><b>${x.annulations_demandees || 0}</b> annulation${x.annulations_demandees > 1 ? 's' : ''} demandée${x.annulations_demandees > 1 ? 's' : ''}</li><li><b>${x.litiges_contre || 0}</b> litige${x.litiges_contre > 1 ? 's' : ''} ouvert${x.litiges_contre > 1 ? 's' : ''} par l’autre partie</li></ul></div>`; };
    const vide = !(r.vendeur && r.vendeur.total) && !(r.acheteur && r.acheteur.total);
    return `<div class="rp-rep">${col('Comme vendeur', r.vendeur)}${col('Comme acheteur', r.acheteur)}</div>
      ${r.delai_median_h != null ? `<p class="rp-rep-n">Délai médian entre la confirmation et la réception : <b>${r.delai_median_h < 48 ? r.delai_median_h + ' h' : Math.round(r.delai_median_h / 24) + ' jours'}</b> (${r.delai_n} commandes).</p>` : ''}
      ${!moi && r.ensemble ? `<p class="rp-rep-n rp-rep-ens">Vous avez terminé ${r.ensemble} commande${r.ensemble > 1 ? 's' : ''} ensemble.</p>` : ''}
      <p class="rp-rep-n">${vide ? 'Aucune commande suivie dans l’application pour l’instant. ' : ''}« Fiable » : ${esc(r.criteres_fiable || '')}. Une identité vérifiée ne veut pas dire fiable : ce sont deux choses différentes.</p>`;
  }
  async function profil(uid, o = {}) {
    if (!uid) return;
    const moi = N() && N().session() && N().session().user.id === uid;
    const bg = feuille(`<div class="rp-tete">${avatar(uid, o.avatar, o.nom, 72, o.uri)}<span><b data-nom>${esc(o.nom || 'Membre')}</b><small data-sc>…</small><small data-dep></small></span></div><div data-org></div><div data-pp></div><div data-corps>${window.MDGSac ? MDGSac.charge('Le profil arrive…') : '<div class="rp-vide">Chargement du profil…</div>'}</div>`, 'Profil de ' + (o.nom || 'membre'));
    const auth = !!N().session();
    // la structure qu'il représente (supabase/schema-23) : en tête du profil, avec ses preuves ; jamais pour le compte officiel
    if (!(window.MDGStatut && MDGStatut.estOfficiel && MDGStatut.estOfficiel(uid))) N().rpc('structure_publique', { p_uid: uid }, false).then(st => {
      const z = bg.querySelector('[data-org]'); if (!z || !st || !st.nom) return;
      z.innerHTML = carteStructure(st, uid); lierPreuves(z, st.preuves || []);
    }).catch(() => {});
    const repP = N().rpc('reputation_publique', { p_uid: uid }, auth).catch(() => null);
    const [liste, pp] = await Promise.all([N().rpc('avis_de2', { p_cible: uid }, auth).catch(() => N().rpc('avis_de', { p_cible: uid }, auth)).catch(() => []), N().rpc('profil_public', { p_uid: uid }, auth).catch(() => null)]);
    if (!bg.isConnected) return;
    // schéma 77 : un avis par personne — seul le plus récent de chaque auteur compte dans la note (« compte » absent = ancien serveur : tout compte)
    const comptes = (liste || []).filter(a => a.compte !== false);
    const nb = comptes.length, moy = nb ? comptes.reduce((s, a) => s + a.note, 0) / nb : 0, rep = [5, 4, 3, 2, 1].map(k => comptes.filter(a => a.note === k).length);
    // compte officiel (l'administrateur) : « Marché de Gros », sans étoiles ni avis (supabase/schema-20)
    const off = !!((pp && pp.officiel) || (window.MDGStatut && MDGStatut.estOfficiel && MDGStatut.estOfficiel(uid)));
    bg.querySelector('[data-sc]').innerHTML = off ? 'Compte officiel du Marché de Gros' : nb ? etoiles(moy, nb, 14) + ' ' + moy.toFixed(1).replace('.', ',') + ' · ' + nb + ' avis' : 'Pas encore noté';
    let haut = '';
    if (pp) {
      const nomH = () => esc(pp.affichage || o.nom || 'Membre') + (off ? ' ' + (window.MDGStatut ? MDGStatut.puces(uid, { max: 1 }) : '<span class="rp-off">Officiel</span>') : '') + (!off && window.MDGIdentite && MDGIdentite.estVerifie(uid) ? ' ' + MDGIdentite.badge(18, true) : '');
      bg.querySelector('[data-nom]').innerHTML = nomH();
      if (window.MDGIdentite) { const maj = () => { if (!bg.isConnected) return removeEventListener('mdg:identite', maj); bg.querySelector('[data-nom]').innerHTML = nomH(); }; addEventListener('mdg:identite', maj); }
      bg.querySelector('[data-dep]').textContent = [pp.membre_depuis ? 'Membre depuis ' + mois(pp.membre_depuis) : '', actif(pp.vu_le)].filter(Boolean).join(' · ');
      const enLigne = (pp.offres_actives || 0) + (pp.demandes_actives || 0);
      haut += `<div class="rp-stats"><div><b>${fq(pp.ventes || 0)}</b><small>vente${pp.ventes > 1 ? 's' : ''} conclue${pp.ventes > 1 ? 's' : ''}</small></div><div><b>${fq(pp.achats || 0)}</b><small>achat${pp.achats > 1 ? 's' : ''}</small></div><div><b>${fq(enLigne)}</b><small>annonce${enLigne > 1 ? 's' : ''} en ligne · ${fq(pp.annonces_total || 0)} en tout</small></div></div>`;
      // statuts gagnés (v3/statuts.js) : ce que chacun prouve
      if (window.MDGStatut) haut += `<div class="rp-sec"><h3>Ses statuts</h3><div data-st>${MDGStatut.detail(uid) || (window.MDGSac ? MDGSac.charge('', { t: 44 }) : '<div class="rp-vide">Chargement…</div>')}</div></div>`;
      if (!off) haut += `<div class="rp-sec"><h3>Réputation sur les commandes</h3><div data-rep>${window.MDGSac ? MDGSac.charge('', { t: 44 }) : ''}</div></div>`;
      if (pp.bio) haut += `<div class="rp-sec"><h3>${pp.role === 'acheteur' ? 'Acheteur' : pp.role === 'vendeur' ? 'Vendeur' : pp.role === 'les_deux' ? 'Vendeur et acheteur' : 'Présentation'}${pp.ville || pp.region_slug ? ' · ' + esc(pp.ville || REGN(pp.region_slug)) : ''}</h3><p class="rp-bio">${esc(pp.bio)}</p></div>`;
      if (pp.activites) haut += `<div class="rp-sec"><h3>Ses activités</h3><div class="rp-tags">${pp.activites.split(/[,;·\n]/).map(x => x.trim()).filter(Boolean).slice(0, 12).map(x => `<span>${esc(x)}</span>`).join('')}</div></div>`;
      if (pp.photos && pp.photos.filter(photoUrl).length) haut += `<div class="rp-sec"><h3>En images</h3><div class="rp-ph">${pp.photos.filter(photoUrl).map(p => `<img src="${esc(photoUrl(p))}" alt="" loading="lazy">`).join('')}</div></div>`;
      // ses annonces en ce moment (celles que ce téléphone connaît déjà)
      const L = N().list ? N().list('offres').filter(x => x._uid === uid).map(x => ['o', x]).concat(N().list('demandes').filter(x => x._uid === uid).map(x => ['d', x])) : [];
      if (L.length) haut += `<div class="rp-sec"><h3>En ce moment</h3><div class="rp-li">${L.slice(0, 8).map(([k, x]) => `<div><i class="${k}"></i><span>${esc(x.productLabel || x.productSlug)} · ${fq(x.quantity)} ${esc(x.unit || '')}</span><small>${esc(x.city || REGN(x.regionSlug))}</small></div>`).join('')}</div></div>`;
      if (pp.lieux && pp.lieux.length) haut += `<div class="rp-sec"><h3>Où il a publié</h3><div class="rp-tags">${pp.lieux.slice(0, 14).map(l => `<span>${esc(REGN(l))}</span>`).join('')}</div></div>`;
      // volumes échangés (schéma 24) : jamais de montants en public, seulement des quantités et le nombre de transactions
      const vol = (pp.volumes || []).map(v => { let q = +v.quantite, u = String(v.unite || 'unité'); if (/^(kg|kilo)/i.test(u) && q >= 1000) { q /= 1000; u = 't'; } else if (/^(t|tonne)/i.test(u)) u = 't'; else if (/^kg/i.test(u)) u = 'kg';
        const pl = q > 1 && !/[sx]$|^(kg|t)$/i.test(u) ? u + 's' : u; return fq(Math.round(q * 100) / 100) + ' ' + pl + (v.sens === 'vente' ? ' vendu' : ' acheté') + (/^(t|tonne|unité|caisse|cagette|botte|boîte|bassine)/i.test(u) ? 'e' : '') + (q > 1 ? 's' : ''); });
      if (pp.transactions) haut += `<div class="rp-sec"><h3>Volumes échangés</h3><div class="rp-tags"><span>${fq(pp.transactions)} transaction${pp.transactions > 1 ? 's' : ''} conclue${pp.transactions > 1 ? 's' : ''}</span>${vol.map(t => `<span>${esc(t)}</span>`).join('')}</div></div>`;
      if (pp.historique && pp.historique.length) haut += `<div class="rp-sec"><h3>Ventes et achats conclus</h3><div class="rp-li">${pp.historique.map(h => `<div><i class="${h.sens === 'vente' ? 'o' : 'v'}"></i><span>${h.sens === 'vente' ? 'Vendu' : 'Acheté'} : ${esc(h.produit || 'produit')}${h.quantite ? ' · ' + fq(h.quantite) + ' ' + esc(h.unite || '') : ''}${h.ville ? ' · ' + esc(h.ville) : ''}</span><small>${quand(h.quand)}</small></div>`).join('')}</div></div>`;
      else if (!moi) haut += `<div class="rp-sec"><h3>Ventes et achats conclus</h3><div class="rp-vide">Aucune vente conclue dans l’application pour l’instant.</div></div>`;
      if (!off) haut += `<div class="rp-sec"><h3>Avis</h3></div>`;
    }
    bg.querySelector('[data-pp]').innerHTML = haut;
    repP.then(r => { const z = bg.querySelector('[data-rep]'); if (z) z.innerHTML = blocReputation(r, moi); });
    if (window.MDGStatut && bg.querySelector('[data-st]')) { const majSt = () => { const z = bg.querySelector('[data-st]'); if (!bg.isConnected || !z) return removeEventListener('mdg:rep', majSt); z.innerHTML = MDGStatut.detail(uid) || '<div class="rp-vide">Pas encore de statut : ce membre commence sur le Marché de Gros.</div>'; }; addEventListener('mdg:rep', majSt); }
    bg.querySelector('[data-corps]').innerHTML = off ? (moi ? '' : `<div class="rp-duo">${window.MDGMessages ? `<button type="button" class="rp-go rp-ecr" data-ecrire>Écrire au Marché de Gros</button>` : ''}</div>`) : ((nb ? `<div class="rp-score"><strong>${moy.toFixed(1).replace('.', ',')}</strong><span>${etoiles(moy, nb, 15)}${nb} avis</span><div class="rp-barres">${rep.map((c, i) => `<div><em style="font-style:normal">${5 - i}</em><i><b style="width:${nb ? c / nb * 100 : 0}%"></b></i></div>`).join('')}</div></div>
      <div class="rp-av">${liste.map(a => `<article><header>${avatar(a.auteur, a.avatar, a.auteur, 26)}<b>${esc(a.auteur)}</b>${a.verifie ? '<span class="rp-av-v" title="Identité vérifiée par l’équipe">✓ vérifié</span>' : ''}${etoiles(a.note, 1, 11)}<small>${quand(a.quand)}</small></header>${a.role ? `<span class="rp-av-r">comme ${a.role === 'vendeur' ? 'vendeur' : 'acheteur'}${a.produit ? ' · ' + esc(a.produit) : ''}</span>` : ''}${a.texte ? `<p>${esc(a.texte)}</p>` : ''}</article>`).join('')}</div>`
      : `<div class="rp-vide">${moi ? 'Vous n’avez pas encore d’avis. Ils arrivent quand vos partenaires vous notent après une commande terminée.' : 'Pas encore d’avis. Les avis se donnent après une commande terminée, depuis Mes commandes.'}</div>`)
      + (moi ? `<button type="button" class="rp-go" data-modif>Modifier mon profil public</button>` : `<div class="rp-duo">${window.MDGMessages ? `<button type="button" class="rp-go rp-ecr" data-ecrire>Écrire</button>` : ''}</div>`));
    const b = bg.querySelector('[data-noter]'); if (b) b.onclick = () => { bg.fermer(); noter(uid, o.nom, () => profil(uid, o)); };
    const e = bg.querySelector('[data-ecrire]'); if (e) e.onclick = () => { bg.fermer(); MDGMessages.ecrire(uid, { nom: o.nom, avatar: o.avatar }); };
    const m = bg.querySelector('[data-modif]'); if (m) m.onclick = () => { bg.fermer(); modifier(pp || {}, () => profil(uid, o)); };
  }

  // ——— modifier son profil public : présentation, activités, photos (6 au plus) ———
  const reduire = file => new Promise((ok, ko) => { const r = new FileReader(); r.onerror = ko; r.onload = () => { const im = new Image(); im.onerror = ko; im.onload = () => {
    const s = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? ok(b) : ko(new Error('Photo illisible')), 'image/jpeg', .74); }; im.src = r.result; }; r.readAsDataURL(file); });
  function modifier(pp, apres) {
    const s = N() && N().session(); if (!s) return;
    let photos = (pp.photos || []).filter(photoUrl).slice(0, 6);
    const bg = feuille(`<h2>Mon profil public</h2><p>Ce que les autres membres voient en touchant votre nom : qui vous êtes, ce que vous faites, ce que vous avez.</p>
      <div class="rp-ed"><label for="rpBio">Présentation <i>600 caractères</i></label><textarea id="rpBio" maxlength="600" placeholder="ex. Coopérative de 40 producteurs d’igname à Bouaké. Livraison possible à Abidjan.">${esc(pp.bio || '')}</textarea>
      <label for="rpAct">Activités <i>séparées par des virgules</i></label><input id="rpAct" maxlength="200" placeholder="ex. Igname, manioc, transport, stockage" value="${esc(pp.activites || '')}">
      <label>Photos <i>6 au plus : champ, stock, magasin…</i></label><div class="grille" data-g></div>
      <p class="rp-msg" data-msg></p><button type="button" class="rp-go" data-ok>Enregistrer</button></div>`, 'Mon profil public');
    const msg = t => { bg.querySelector('[data-msg]').textContent = t || ''; };
    const grille = () => { const g = bg.querySelector('[data-g]');
      g.innerHTML = photos.map((p, i) => `<div><img src="${esc(photoUrl(p))}" alt=""><button type="button" class="ui-x" data-rm="${i}" aria-label="Retirer la photo"></button></div>`).join('') + (photos.length < 6 ? `<label class="ajout">+ Ajouter<input type="file" accept="image/*"></label>` : '');
      g.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { photos.splice(+b.dataset.rm, 1); grille(); });
      const inp = g.querySelector('input[type=file]'); if (inp) inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; msg('Envoi de la photo…');
        try { const blob = await reduire(f), chemin = s.user.id + '/' + Date.now() + '.jpg'; await N().televerser('activites/' + chemin, blob); photos.push(chemin); msg(''); grille(); }
        catch (x) { msg(/Bucket not found|not found|403|row-level/i.test(String(x.message)) ? 'Les photos ne sont pas encore activées sur le serveur.' : 'Envoi impossible : ' + x.message); } }; };
    grille();
    bg.querySelector('[data-ok]').onclick = async ev => { ev.target.disabled = true; msg('');
      const corps = { bio: bg.querySelector('#rpBio').value.trim() || null, activites: bg.querySelector('#rpAct').value.trim() || null, photos };
      const refus = N().texteRefus ? N().texteRefus([corps.bio, corps.activites].join(' · ')) : '';   // pas de lien ni de code (schéma 22)
      if (refus) { ev.target.disabled = false; return msg(refus); }
      try { const r = await N().api('/rest/v1/profils?user_id=eq.' + s.user.id, { method: 'PATCH', auth: true, body: corps, prefer: 'return=representation' });
        if (!r || !r.length) await N().api('/rest/v1/profils', { method: 'POST', auth: true, body: Object.assign({ user_id: s.user.id }, corps), prefer: 'return=minimal' });
        bg.fermer(); N().toast('Profil enregistré.'); dispatchEvent(new CustomEvent('mdg:profil')); apres && apres(); }
      catch (x) { ev.target.disabled = false; msg('Enregistrement impossible : ' + x.message); } };
  }

  // ——— les mieux notés ———
  async function classement() {
    const bg = feuille(`<h2>Les mieux notés</h2><p>Les vendeurs et acheteurs que leurs partenaires recommandent, d’après leurs notes après négociation.</p><div class="rp-cl" data-l><div class="rp-vide">Chargement…</div></div>`, 'Les mieux notés');
    let l = []; try { l = await N().rpc('mieux_notes', { n: 50 }, !!N().session()) || []; } catch (_) {}
    if (!bg.isConnected) return;
    const box = bg.querySelector('[data-l]');
    if (!l.length) { box.innerHTML = '<div class="rp-vide">Personne n’est encore noté. Après une négociation, notez votre partenaire : il apparaîtra ici.</div>'; return; }
    box.innerHTML = l.map((x, i) => `<button type="button" data-i="${i}"><em>${i + 1}</em>${avatar(x.user_id, x.avatar, x.affichage, 44)}<span><b>${esc(x.affichage)}${window.MDGStatut ? ' ' + MDGStatut.puces(x.user_id, { max: 1, t: 14 }) : ''}</b><small>${etoiles(x.moyenne, x.nombre, 12)} ${String(x.moyenne).replace('.', ',')} · ${x.nombre} avis</small></span><i>${x.annonces ? x.annonces + ' annonce' + (x.annonces > 1 ? 's' : '') : ''}</i></button>`).join('');
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const x = l[+b.dataset.i]; bg.fermer(); profil(x.user_id, { nom: x.affichage, avatar: x.avatar }); });
  }

  window.MDGRep = { etoiles, texteNote, resume, charger, signal, chargerSignal, profil, modifier, noter, classement, signaler, RAISONS };
})();
