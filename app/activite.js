/* Marché de Gros CI — Accueil → Activité : ce qui est EN COURS, et où reprendre. Écrit pour l'app.
   Réunit ce que les modules savent déjà (rien d'inventé, rien de plus demandé au serveur) :
     • négociations : proposition à laquelle répondre, proposition en attente de l'autre, accord conclu depuis moins de 3 jours (v3/negoce.js) ;
     • commandes : à confirmer, en préparation, en route, litige (v3/commandes.js) ;
     • messages : conversations avec des messages non lus (v3/messages.js).
   « Reprendre » : la dernière démarche ouverte (négociation, commande, conversation), gardée 2 jours sur ce téléphone,
   tant qu'elle est encore en cours. Une négociation ou une commande terminée n'est plus proposée.
   Ordre : ce qui attend une action de ma part d'abord, puis ce qui roule, puis ce qui attend l'autre, puis les accords.
   API : MDGActivite.noter(genre, id) · tout() → [élément] · dernier() → élément | null · aFaire() → nombre
   Événement : « mdg:activite » quand quelque chose change. */
(function () {
  'use strict';
  if (window.MDGActivite) return;
  const K = 'mdg-activite:dernier', DUREE = 2 * 864e5;
  const J = () => { try { return JSON.parse(localStorage.getItem(K)) || null; } catch (_) { return null; } };
  const RANG = { moi: 0, litige: 0, route: 1, attente: 2, ok: 3 };
  const signal = () => { try { dispatchEvent(new CustomEvent('mdg:activite')); } catch (_) {} };

  function tout() {
    const L = [];
    [[window.MDGNegoce, 'activite'], [window.MDGCommandes, 'activite'], [window.MDGMessages, 'activite']].forEach(([m, f]) => {
      if (m && typeof m[f] === 'function') { try { L.push(...(m[f]() || [])); } catch (_) {} } });
    // un accord conclu qui a déjà sa commande : seule la commande compte (sinon la même vente apparaît deux fois)
    const C = window.MDGCommandes, aCmd = id => C && typeof C.parNego === 'function' && !!C.parNego(id);
    return L.filter(x => !(x.k === 'nego' && x.etat === 'ok' && aCmd(x.id)))
      .sort((a, b) => (RANG[a.etat] ?? 9) - (RANG[b.etat] ?? 9) || b.ts - a.ts);
  }
  function dernier() {
    const d = J(); if (!d || Date.now() - d.t > DUREE) return null;
    const T = tout();
    let x = T.find(y => y.k === d.k && y.id === d.id);
    if (!x && d.k === 'nego') x = T.find(y => y.k === 'cmd' && y.nego === d.id);   // l'accord est devenu une commande : on reprend la commande
    if (!x && d.k === 'dm' && window.MDGMessages && MDGMessages.trouverAct) x = MDGMessages.trouverAct(d.id);   // une conversation reste reprenable, même lue
    return x || null;
  }
  function noter(k, id) { if (!k || !id) return; try { localStorage.setItem(K, JSON.stringify({ k, id, t: Date.now() })); } catch (_) {} signal(); }
  const aFaire = () => tout().filter(x => x.etat === 'moi' || x.etat === 'litige').length;

  window.MDGActivite = { noter, tout, dernier, aFaire };
})();
