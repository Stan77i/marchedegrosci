/* ═════════ Marché de Gros CI — statuts des comptes : ce que la communauté peut savoir d'un membre en un coup d'œil ═════════
   Philosophie : un statut se GAGNE par des faits vérifiables (pièce d'identité, ventes conclues, avis, réponses, activité),
   jamais en payant ni en le déclarant soi-même. Chaque statut dit ce qu'il prouve, et Mon compte dit comment l'obtenir.
     Identité vérifiée   — l'équipe a comparé la pièce (valide) et le selfie                    (sceau bleu, MDGIdentite.badge)
     Vendeur de confiance — ≥ 3 ventes conclues sur le Marché de Gros, note ≥ 4,2 s'il a ≥ 3 avis  (maïs)
     Acheteur sérieux     — ≥ 3 achats conclus, note ≥ 4 s'il a ≥ 3 avis                         (vert)
     Répond vite          — répond en moins de 24 h à 80 % des personnes qui le contactent (≥ 3)  (bleu)
     Actif aujourd'hui / cette semaine — a publié ou écrit récemment                              (point vert)
     Nouveau membre       — inscrit depuis moins de 30 jours                                     (neutre)
   Serveur : supabase/schema-17-statuts.sql → statuts_publics(ids), lisible sans compte, chiffres seulement.
   API : MDGStatut.charger(uids) · get(uid) · liste(uid) · puces(uid, { max, sans }) · detail(uid) · progres(uid)
   Événement « mdg:rep » quand de nouveaux chiffres arrivent (l'application et les fenêtres se redessinent déjà sur cet événement). */
(function () {
  'use strict';
  const N = () => window.MDGNuage;
  const IC = (n, t) => window.MDGIco ? MDGIco.svg(n, t || 13, 2) : '';
  const data = {}, attente = new Set(); let t = 0;
  const CK = 'mdg-statuts', TTL = 30 * 60e3;
  try { const c = JSON.parse(localStorage.getItem(CK) || '{}'); if (c.t && Date.now() - c.t < TTL) Object.assign(data, c.d || {}); } catch (_) {}
  const garder = () => { try { localStorage.setItem(CK, JSON.stringify({ t: Date.now(), d: data })); } catch (_) {} };

  function charger(uids) {
    (uids || []).forEach(u => { if (u && !(u in data)) attente.add(u); });
    if (!attente.size || !N()) return; clearTimeout(t);
    t = setTimeout(async () => {
      const ids = [...attente]; attente.clear(); ids.forEach(u => { if (!(u in data)) data[u] = null; });
      try {
        const r = await N().rpc('statuts_publics', { ids }, !!N().session());
        (r || []).forEach(x => { data[x.user_id] = { v: !!x.verifie, a: x.actif_le ? Date.parse(x.actif_le) : 0, ve: x.ventes || 0, ac: x.achats || 0,
          no: x.note != null ? +x.note : null, av: x.avis || 0, co: x.contacts || 0, r24: x.reponses_24h || 0, m: x.membre_depuis ? Date.parse(x.membre_depuis) : 0 }; });
        garder(); dispatchEvent(new CustomEvent('mdg:rep'));
      } catch (_) {}
    }, 80);
  }
  const get = uid => { if (!uid) return null; if (!(uid in data)) charger([uid]); return data[uid] || null; };

  // les règles (une seule source : l'affichage, le détail et la progression en dépendent)
  const JOUR = 864e5;
  const REGLES = [
    { k: 'confiance', t: 'Vendeur de confiance', ico: 'confiance', ok: s => s.ve >= 3 && (s.av < 3 || s.no >= 4.2),
      s: s => s.ve + ' vente' + (s.ve > 1 ? 's' : '') + ' conclue' + (s.ve > 1 ? 's' : '') + ' sur le Marché de Gros' + (s.av ? ' · ' + String(s.no).replace('.', ',') + '/5 sur ' + s.av + ' avis' : ''),
      but: s => s.ve < 3 ? { t: 'Vendeur de confiance', fait: s.ve, total: 3, txt: 'ventes conclues' } : null },
    { k: 'serieux', t: 'Acheteur sérieux', ico: 'acheter', ok: s => s.ac >= 3 && (s.av < 3 || s.no >= 4),
      s: s => s.ac + ' achat' + (s.ac > 1 ? 's' : '') + ' conclu' + (s.ac > 1 ? 's' : '') + ' sur le Marché de Gros',
      but: s => s.ac < 3 ? { t: 'Acheteur sérieux', fait: s.ac, total: 3, txt: 'achats conclus' } : null },
    { k: 'rapide', t: 'Répond vite', ico: 'envoyer', ok: s => s.co >= 3 && s.r24 / s.co >= .8,
      s: s => 'Répond en moins de 24 h à ' + Math.round(s.r24 / Math.max(1, s.co) * 100) + ' % des personnes qui le contactent',
      but: s => s.co < 3 ? null : s.r24 / s.co < .8 ? { t: 'Répond vite', fait: s.r24, total: Math.ceil(s.co * .8), txt: 'réponses en moins de 24 h' } : null },
    { k: 'actif', t: s => Date.now() - s.a < JOUR ? 'Actif aujourd’hui' : 'Actif cette semaine', ico: null, ok: s => s.a && Date.now() - s.a < 7 * JOUR,
      s: () => 'A publié ou écrit récemment' },
    { k: 'nouveau', t: 'Nouveau membre', ico: 'nouveau', ok: s => s.m && Date.now() - s.m < 30 * JOUR,
      s: s => 'Inscrit le ' + new Date(s.m).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + '. Restez prudent : voyez la marchandise avant de payer.' }
  ];
  const titre = (r, s) => typeof r.t === 'function' ? r.t(s) : r.t;

  // statuts gagnés, du plus fort au plus léger (le sceau « vérifié » est à part : MDGIdentite.badge)
  function liste(uid) { const s = get(uid); if (!s) return []; return REGLES.filter(r => r.ok(s)).map(r => ({ k: r.k, t: titre(r, s), s: r.s(s), ico: r.ico })); }
  const estVerifie = uid => { const s = get(uid); return s ? s.v : !!(window.MDGIdentite && MDGIdentite.estVerifie(uid)); };

  const puce = x => `<span class="st-p st-${x.k}" title="${x.s.replace(/"/g, '&quot;')}">${x.k === 'actif' ? '<i></i>' : IC(x.ico, 12)}${x.t}</span>`;
  // sur une carte d'annonce : le sceau (si vérifié) + le statut le plus fort ; max = combien de statuts
  function puces(uid, o) { o = o || {}; const L = liste(uid).filter(x => !(o.sans || []).includes(x.k)).slice(0, o.max == null ? 1 : o.max);
    return (o.sceau !== false && estVerifie(uid) && window.MDGIdentite ? MDGIdentite.badge(o.t || 15) : '') + L.map(puce).join(''); }

  // dans la fiche profil : chaque statut avec ce qu'il prouve
  function detail(uid) {
    const s = get(uid), L = liste(uid), v = estVerifie(uid);
    if (!s && !v) return '';
    const ligne = (ico, t, d, k) => `<div class="st-l st-l-${k}"><span class="st-i">${ico}</span><div><b>${t}</b><small>${d}</small></div></div>`;
    return `<div class="st-detail">${v ? ligne(window.MDGIdentite ? MDGIdentite.badge(18) : '', 'Identité vérifiée', 'L’équipe a comparé sa pièce d’identité, encore valide, et son selfie.', 'verifie') : ''}
      ${L.map(x => ligne(x.k === 'actif' ? '<i class="st-pt"></i>' : IC(x.ico, 16), x.t, x.s, x.k)).join('')}
      ${!v && !L.length ? '<p class="st-vide">Pas encore de statut : ce membre commence sur le Marché de Gros.</p>' : ''}</div>`;
  }

  // pour Mon compte : ce qui reste à faire pour chaque statut pas encore gagné
  function progres(uid) { const s = get(uid); if (!s) return []; return REGLES.filter(r => r.but && !r.ok(s)).map(r => r.but(s)).filter(Boolean); }

  const CSS = `.st-p{display:inline-flex;align-items:center;gap:4px;height:20px;padding:0 8px;border-radius:999px;font:600 11.5px/1 Jost,system-ui,sans-serif;white-space:nowrap;vertical-align:middle;letter-spacing:.01em}
.st-p svg{flex:none}
.st-confiance{background:#F2C230;color:#10392B}
.st-serieux{background:#6CC58C;color:#0d2a1c}
.st-rapide{background:#9CC9F2;color:#0c2740}
.st-actif{background:rgba(108,197,140,.16);color:inherit}.st-actif i,.st-pt{width:7px;height:7px;border-radius:50%;background:#3FB872;box-shadow:0 0 0 3px rgba(63,184,114,.22);display:inline-block}
.st-nouveau{background:rgba(140,140,140,.18);color:inherit}
.st-detail{display:flex;flex-direction:column;gap:10px}
.st-l{display:flex;gap:12px;align-items:flex-start}.st-l b{display:block;font-weight:600}.st-l small{display:block;opacity:.75;font-size:13px;line-height:1.35;margin-top:2px}
.st-i{flex:none;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;background:rgba(140,140,140,.14)}
.st-l-confiance .st-i{background:#F2C230;color:#10392B}.st-l-serieux .st-i{background:#6CC58C;color:#0d2a1c}.st-l-rapide .st-i{background:#9CC9F2;color:#0c2740}
.st-l-verifie .st-i{background:rgba(74,144,226,.14)}
.st-vide{margin:0;opacity:.7;font-size:13.5px}
.st-but{display:flex;flex-direction:column;gap:6px}.st-but b{font-weight:600}.st-but small{opacity:.72}
.st-jauge{height:6px;border-radius:3px;background:rgba(140,140,140,.2);overflow:hidden}.st-jauge i{display:block;height:100%;border-radius:3px;background:#F2C230}`;
  if (!document.getElementById('stCss')) { const st = document.createElement('style'); st.id = 'stCss'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st); }

  window.MDGStatut = { charger, get, liste, puces, detail, progres, estVerifie, REGLES };
})();
