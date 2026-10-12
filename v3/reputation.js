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
    return `<span class="rp-et" role="img" aria-label="${n ? v.toFixed(1).replace('.', ',') + ' sur 5, ' + n + ' avis' : 'Pas encore noté'}" style="display:inline-flex;vertical-align:middle;flex:none"><span class="rp-et-f" style="position:relative;display:inline-block;line-height:0">${rang(clair ? 'rgba(23,21,18,.16)' : 'rgba(245,240,230,.18)')}<span style="position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;width:${w}%">${rang('#F2C94C')}</span></span></span>`;
  }
  const texteNote = r => r && r.n ? r.m.toFixed(1).replace('.', ',') + ' · ' + r.n + ' avis' : 'Nouveau';

  // ——— feuille commune (sombre, depuis le bas) ———
  const CSS = `.rp-bg{position:fixed;inset:0;z-index:9300;background:rgba(10,9,7,.6);display:flex;align-items:flex-end;justify-content:center;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:rpIn .2s ease both}
@media (min-width:720px){.rp-bg{align-items:center;padding:24px}}
.rp{position:relative;width:100%;max-width:520px;max-height:min(90dvh,820px);overflow:auto;background:#1d1a15;color:#F5F0E6;border-radius:28px 28px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));font:400 15px/1.5 Jost,system-ui,sans-serif;box-shadow:0 -10px 50px rgba(0,0,0,.5);animation:rpUp .36s cubic-bezier(.22,1,.36,1) both;overscroll-behavior:contain}
@media (min-width:720px){.rp{border-radius:28px}}
.rp h2{margin:0 44px 4px 0;font:500 28px/1.1 'Cormorant Garamond',Georgia,serif}.rp>p{margin:0 0 16px;color:#B9AD98;font-size:14px}
.rp-x{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:50%;background:rgba(245,240,230,.08);color:#F5F0E6;font-size:0;cursor:pointer}
.rp-x::before,.rp-x::after{content:"";position:absolute;left:50%;top:50%;width:15px;height:2px;border-radius:2px;background:currentColor;transform:translate(-50%,-50%) rotate(45deg)}.rp-x::after{transform:translate(-50%,-50%) rotate(-45deg)}
.rp-go{width:100%;min-height:54px;margin-top:16px;border:0;border-radius:999px;background:#E07A3F;color:#171512;font:700 16px Jost,sans-serif;cursor:pointer}.rp-go:disabled{opacity:.45;cursor:default}
.rp-duo{display:flex;gap:8px}.rp-duo .rp-go{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 14px}.rp-duo .rp-ecr{flex:0 0 38%;background:none;box-shadow:inset 0 0 0 1.5px rgba(245,240,230,.28);color:#F5F0E6}
.rp-alt{min-height:44px;padding:0 16px;border:1px solid rgba(245,240,230,.2);border-radius:999px;background:none;color:#F5F0E6;font:600 14px Jost,sans-serif;cursor:pointer}
.rp-et{display:inline-flex;vertical-align:middle}.rp-et-f{position:relative;display:inline-block;line-height:0}.rp-et-f>span{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap}
.rp-ch{display:flex;flex-wrap:wrap;gap:8px}.rp-ch button{min-height:44px;padding:0 15px;border:1px solid rgba(245,240,230,.18);border-radius:999px;background:none;color:#E9E1D2;font:500 14px Jost,sans-serif;cursor:pointer;transition:background .2s,border-color .2s,color .2s}
.rp-ch button[aria-pressed=true]{background:#F5F0E6;border-color:#F5F0E6;color:#171512}
.rp textarea{width:100%;min-height:84px;margin-top:14px;padding:12px 14px;border:1px solid rgba(245,240,230,.16);border-radius:16px;background:#14120f;color:#F5F0E6;font:400 15px/1.45 Jost,sans-serif;resize:vertical;box-sizing:border-box}
.rp textarea:focus{outline:none;border-color:#E07A3F;box-shadow:0 0 0 3px rgba(224,122,63,.2)}
.rp-msg{min-height:20px;margin:8px 2px 0;color:#F3A08C;font-size:13.5px}
.rp-tete{display:flex;align-items:center;gap:16px;margin:0 0 18px}.rp-tete img{border-radius:50%;box-shadow:0 0 0 3px rgba(245,240,230,.08)}
.rp-tete b{display:block;font:500 28px/1.05 'Cormorant Garamond',Georgia,serif}.rp-tete small{display:flex;align-items:center;gap:8px;margin-top:6px;color:#B9AD98;font-size:13.5px}
.rp-score{display:flex;align-items:center;gap:16px;padding:16px;border-radius:20px;background:rgba(245,240,230,.04);box-shadow:inset 0 0 0 1px rgba(245,240,230,.08)}
.rp-score strong{font:500 46px/1 'Cormorant Garamond',Georgia,serif}.rp-score span{display:flex;flex-direction:column;gap:6px;color:#B9AD98;font-size:13px}
.rp-barres{flex:1;display:grid;gap:3px}.rp-barres div{display:grid;grid-template-columns:12px 1fr;gap:6px;align-items:center;font-size:11px;color:#8f846f}.rp-barres i{height:5px;border-radius:3px;background:rgba(245,240,230,.08);overflow:hidden}.rp-barres i b{display:block;height:100%;background:#F2C94C;border-radius:3px}
.rp-av{display:grid;gap:10px;margin-top:16px}.rp-av article{padding:14px;border-radius:18px;background:rgba(245,240,230,.03);box-shadow:inset 0 0 0 1px rgba(245,240,230,.07)}
.rp-av header{display:flex;align-items:center;gap:10px;margin-bottom:6px}.rp-av header img{border-radius:50%}.rp-av header b{font-size:14px}.rp-av header small{margin-left:auto;color:#8f846f;font-size:12px}
.rp-av p{margin:0;color:#E9E1D2;font-size:14px}
.rp-vide{padding:22px 16px;border:1px dashed rgba(245,240,230,.16);border-radius:18px;text-align:center;color:#B9AD98;font-size:14px}
.rp-big{display:flex;justify-content:center;gap:6px;margin:6px 0 4px}.rp-big button{width:52px;height:52px;border:0;background:none;padding:4px;cursor:pointer;transition:transform .18s cubic-bezier(.22,1,.36,1)}
.rp-big button:active{transform:scale(.9)}.rp-big svg{width:100%;height:100%}.rp-big path{fill:rgba(245,240,230,.14);transition:fill .2s}.rp-big button.on path{fill:#F2C94C}.rp-big button.pop{animation:rpPop .35s cubic-bezier(.22,1,.36,1)}
.rp-lib{text-align:center;color:#F2C94C;font-weight:600;min-height:22px}
.rp-cl{display:grid;gap:8px}.rp-cl button{display:grid;grid-template-columns:26px 44px 1fr auto;align-items:center;gap:12px;width:100%;padding:10px 12px;border:0;border-radius:18px;background:rgba(245,240,230,.03);box-shadow:inset 0 0 0 1px rgba(245,240,230,.07);color:#F5F0E6;text-align:left;cursor:pointer;font:inherit}
.rp-cl em{font-style:normal;font:500 20px/1 'Cormorant Garamond',serif;color:#8f846f;text-align:center}.rp-cl button:nth-child(-n+3) em{color:#F2C94C}
.rp-cl img{border-radius:50%}.rp-cl b{display:block;font-size:15px}.rp-cl small{display:flex;align-items:center;gap:6px;color:#B9AD98;font-size:12.5px;margin-top:2px}.rp-cl i{font-style:normal;color:#8f846f;font-size:12px;text-align:right}
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
      try { await N().report(kind, rid, choix + (prec ? ' — ' + prec : '')); delete sig[rid]; chargerSignal([rid]); bg.fermer(); N().toast('Merci. Signalement envoyé : « ' + choix + ' ».'); }
      catch (_) { go.disabled = false; go.textContent = 'Envoyer le signalement'; bg.querySelector('.rp-msg').textContent = 'L’envoi n’a pas abouti. Vérifiez la connexion, puis réessayez.'; }
    };
  }

  // ——— noter : cinq grandes étoiles, un mot possible ———
  const LIB = ['', 'Mauvaise expérience', 'Décevant', 'Correct', 'Bon partenaire', 'Excellent partenaire'];
  async function noter(uid, nom, apres) {
    if (!N() || !N().session()) return N() && N().open();
    let deja = null; try { deja = await N().rpc('peut_noter', { p_cible: uid }); } catch (_) {}
    if (deja && !deja.peut) return N().toast('Vous pourrez noter ' + (nom || 'ce membre') + ' après avoir négocié ensemble.');
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
      go.disabled = true; go.textContent = 'Publication…';
      try { await N().rpc('noter', { p_cible: uid, p_note: n, p_texte: bg.querySelector('textarea').value.trim() || null }); delete notes[uid]; charger([uid]); bg.fermer(); N().toast('Merci, votre note est publiée.'); apres && apres(); }
      catch (x) { go.disabled = false; go.textContent = 'Publier ma note'; bg.querySelector('.rp-msg').textContent = /PAS_DE_NEGOCIATION/.test(x.message) ? 'Vous pourrez noter ce membre après avoir négocié ensemble.' : 'La publication n’a pas abouti. Réessayez.'; }
    };
  }

  // ——— fiche profil : note, répartition, avis, et noter ———
  async function profil(uid, o = {}) {
    if (!uid) return;
    const moi = N() && N().session() && N().session().user.id === uid;
    const bg = feuille(`<div class="rp-tete">${avatar(uid, o.avatar, o.nom, 72, o.uri)}<span><b>${esc(o.nom || 'Membre')}</b><small data-sc>…</small></span></div><div data-corps><div class="rp-vide">Chargement des avis…</div></div>`, 'Profil de ' + (o.nom || 'membre'));
    let liste = []; try { liste = await N().rpc('avis_de', { p_cible: uid }, !!N().session()) || []; } catch (_) {}
    if (!bg.isConnected) return;
    const nb = liste.length, moy = nb ? liste.reduce((s, a) => s + a.note, 0) / nb : 0, rep = [5, 4, 3, 2, 1].map(k => liste.filter(a => a.note === k).length);
    bg.querySelector('[data-sc]').innerHTML = nb ? etoiles(moy, nb, 14) + ' ' + moy.toFixed(1).replace('.', ',') + ' · ' + nb + ' avis' : 'Pas encore noté';
    bg.querySelector('[data-corps]').innerHTML = (nb ? `<div class="rp-score"><strong>${moy.toFixed(1).replace('.', ',')}</strong><span>${etoiles(moy, nb, 15)}${nb} avis</span><div class="rp-barres">${rep.map((c, i) => `<div><em style="font-style:normal">${5 - i}</em><i><b style="width:${nb ? c / nb * 100 : 0}%"></b></i></div>`).join('')}</div></div>
      <div class="rp-av">${liste.map(a => `<article><header>${avatar(a.auteur, a.avatar, a.auteur, 26)}<b>${esc(a.auteur)}</b>${etoiles(a.note, 1, 11)}<small>${quand(a.quand)}</small></header>${a.texte ? `<p>${esc(a.texte)}</p>` : ''}</article>`).join('')}</div>`
      : `<div class="rp-vide">${moi ? 'Vous n’avez pas encore d’avis. Ils arrivent quand vos partenaires vous notent après une négociation.' : 'Pas encore d’avis. Négociez avec ce membre pour pouvoir le noter.'}</div>`)
      + (moi ? '' : `<div class="rp-duo">${window.MDGMessages ? `<button type="button" class="rp-go rp-ecr" data-ecrire>Écrire</button>` : ''}<button type="button" class="rp-go" data-noter>Noter ${esc(o.nom || 'ce membre')}</button></div>`);
    const b = bg.querySelector('[data-noter]'); if (b) b.onclick = () => { bg.fermer(); noter(uid, o.nom, () => profil(uid, o)); };
    const e = bg.querySelector('[data-ecrire]'); if (e) e.onclick = () => { bg.fermer(); MDGMessages.ecrire(uid, { nom: o.nom, avatar: o.avatar }); };
  }

  // ——— les mieux notés ———
  async function classement() {
    const bg = feuille(`<h2>Les mieux notés</h2><p>Les vendeurs et acheteurs que leurs partenaires recommandent, d’après leurs notes après négociation.</p><div class="rp-cl" data-l><div class="rp-vide">Chargement…</div></div>`, 'Les mieux notés');
    let l = []; try { l = await N().rpc('mieux_notes', { n: 50 }, !!N().session()) || []; } catch (_) {}
    if (!bg.isConnected) return;
    const box = bg.querySelector('[data-l]');
    if (!l.length) { box.innerHTML = '<div class="rp-vide">Personne n’est encore noté. Après une négociation, notez votre partenaire : il apparaîtra ici.</div>'; return; }
    box.innerHTML = l.map((x, i) => `<button type="button" data-i="${i}"><em>${i + 1}</em>${avatar(x.user_id, x.avatar, x.affichage, 44)}<span><b>${esc(x.affichage)}</b><small>${etoiles(x.moyenne, x.nombre, 12)} ${String(x.moyenne).replace('.', ',')} · ${x.nombre} avis</small></span><i>${x.annonces ? x.annonces + ' annonce' + (x.annonces > 1 ? 's' : '') : ''}</i></button>`).join('');
    box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const x = l[+b.dataset.i]; bg.fermer(); profil(x.user_id, { nom: x.affichage, avatar: x.avatar }); });
  }

  window.MDGRep = { etoiles, texteNote, resume, charger, signal, chargerSignal, profil, noter, classement, signaler, RAISONS };
})();
