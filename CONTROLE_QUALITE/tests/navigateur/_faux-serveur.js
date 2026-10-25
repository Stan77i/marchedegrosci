/* Faux serveur Supabase pour le contrôle navigateur : données factices, aucune donnée réelle.
   Chaque requête est comptée (méthode, chemin, nom de la fonction RPC). */
const MOI = '11111111-1111-4111-8111-111111111111', AUTRE = '22222222-2222-4222-8222-222222222222', AUTRE2 = '33333333-3333-4333-8333-333333333333';
const H = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const OFFRES = [
  { id: 101, user_id: AUTRE, client_id: 'c101', product_slug: 'mais-grain', product_label: 'Maïs', region_slug: 'abidjan', city: 'Abidjan', quantity: 2000, unit: 'kg', price: 250, available_from: 'maintenant', created_at: H(3), seller_name: 'Awa K.', negociable: true, transport: 'inclus', status: 'active', ville_seulement: false },
  { id: 102, user_id: AUTRE2, client_id: 'c102', product_slug: 'tomate', product_label: 'Tomate', region_slug: 'bouake', city: 'Bouaké', quantity: 50, unit: 'carton', price: 9000, available_from: 'maintenant', created_at: H(20), seller_name: 'Koffi', negociable: true, transport: 'non', status: 'active', ville_seulement: true },
  { id: 103, user_id: AUTRE, client_id: 'c103', product_slug: 'riz-local', product_label: 'Riz', region_slug: 'abidjan', city: 'Abidjan', quantity: 500, unit: 'sac', price: 18000, available_from: 'maintenant', created_at: H(30), seller_name: 'Awa K.', negociable: false, status: 'active' },
];
const DEMANDES = [
  { id: 201, user_id: AUTRE2, client_id: 'd201', product_slug: 'igname', product_label: 'Igname', region_slug: 'abidjan', city: 'Abidjan', quantity: 3000, unit: 'kg', budget: 400, deadline: 'semaine', buyer_type: 'Grossiste', buyer_name: 'Mariam', created_at: H(5), negociable: true, criteres: [], detail: {}, status: 'active' },
];
const NEGOS = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', cible: 'offre', cible_id: 101, auteur_id: MOI, proprio_id: AUTRE, produit: 'Maïs', unite: 'kg', quantite: 1000, prix_annonce: 250, dernier_prix: 230, dernier_par: AUTRE, dernier_quantite: 1000, dernier_msg: 'Je peux faire 230', statut: 'ouverte', ville: 'Abidjan', created_at: H(2), updated_at: H(1), expire_le: new Date(Date.now() + 40 * 3600e3).toISOString(), lu_auteur: false, lu_proprio: true },
  { id: 'aaaaaaaa-0000-4000-8000-000000000002', cible: 'offre', cible_id: 103, auteur_id: MOI, proprio_id: AUTRE, produit: 'Riz', unite: 'sac', quantite: 20, prix_annonce: 18000, dernier_prix: 17500, prix_final: 17500, quantite_finale: 20, dernier_par: MOI, statut: 'conclue', conclu_le: H(5), ville: 'Abidjan', created_at: H(9), updated_at: H(5), lu_auteur: true, lu_proprio: true },
];
const MSGS = [
  { id: 1, negociation_id: NEGOS[0].id, auteur_id: MOI, texte: 'Bonjour, 1000 kg à 220 ?', prix: 220, quantite: 1000, created_at: H(2) },
  { id: 2, negociation_id: NEGOS[0].id, auteur_id: AUTRE, texte: 'Je peux faire 230', prix: 230, quantite: 1000, created_at: H(1) },
];
const CMDS = [
  { id: 'cccccccc-0000-4000-8000-000000000001', numero: 'MG-0001', negociation_id: NEGOS[1].id, role: 'acheteur', etat: 'en_cours', etape: 'transport', produit: 'Riz', quantite: 20, unite: 'sac', prix_unitaire: 17500, montant: 350000, commission_montant: 12250, partenaire_id: AUTRE, partenaire_nom: 'Awa K.', mode_transport: 'vendeur', ville_depart: 'Abidjan', lieu_livraison: 'Abidjan', cree_par_moi: true, created_at: H(5), updated_at: H(1), libere_le: null },
  { id: 'cccccccc-0000-4000-8000-000000000002', numero: 'MG-0002', role: 'vendeur', etat: 'a_confirmer', etape: 'confirmee', produit: 'Maïs', quantite: 1000, unite: 'kg', prix_unitaire: 240, montant: 240000, commission_montant: 8400, partenaire_id: AUTRE2, partenaire_nom: 'Mariam', mode_transport: 'vendeur', ville_depart: 'Abidjan', lieu_livraison: 'Abidjan', cree_par_moi: false, created_at: H(1), updated_at: H(1), libere_le: null },
  { id: 'cccccccc-0000-4000-8000-000000000003', numero: 'MG-0003', role: 'acheteur', etat: 'terminee', etape: 'arrivee', produit: 'Tomate', quantite: 10, unite: 'carton', prix_unitaire: 9000, montant: 90000, commission_montant: 3150, partenaire_id: AUTRE2, partenaire_nom: 'Koffi', mode_transport: 'vendeur', ville_depart: 'Bouaké', lieu_livraison: 'Bouaké', cree_par_moi: true, created_at: H(30), updated_at: H(0.3), libere_le: null },
];
const DM = [{ id: 'dddddddd-0000-4000-8000-000000000001', autre_id: AUTRE, autre_nom: 'Awa K.', dernier_texte: 'D’accord pour demain', updated_at: H(1), created_at: H(30), non_lu: true }];

function reponse(method, path, body) {
  const fn = (path.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/) || [])[1];
  if (path.startsWith('/auth/v1/user')) return { id: MOI, user_metadata: { tel: '0701020304' } };
  if (path.startsWith('/auth/v1/token')) return { access_token: 'faux', refresh_token: 'faux', expires_in: 3600, user: { id: MOI, user_metadata: { tel: '0701020304' } } };
  if (fn) {
    switch (fn) {
      case 'annonces_version': return 'v-test-1';
      case 'mes_commandes2': case 'mes_commandes': return CMDS;
      case 'dm_liste2': case 'dm_liste': return DM;
      case 'dm_messages': return [{ id: 1, auteur_id: AUTRE, texte: 'D’accord pour demain', created_at: H(1) }];
      case 'est_admin': return false;
      case 'stats_publiques': return { annonces: 4, membres: 12 };
      case 'nego_dispo': return { quantite: 2000, prix: 250 };
      case 'commande_journal': return [{ evenement: 'creee', role: 'acheteur', par_moi: true, at: H(5) }, { evenement: 'confirmee', role: 'vendeur', par_moi: false, at: H(4) }];
      case 'identite_statut': case 'mon_identite': return { statut: 'non_verifie' };
      default: return null;
    }
  }
  if (method === 'GET') {
    if (path.startsWith('/rest/v1/offres')) return /user_id=eq\./.test(path) ? [] : OFFRES;
    if (path.startsWith('/rest/v1/demandes')) return /user_id=eq\./.test(path) ? [] : DEMANDES;
    if (path.startsWith('/rest/v1/negociations')) return /id=eq\./.test(path) ? NEGOS.filter(n => path.includes(n.id)) : NEGOS;
    if (path.startsWith('/rest/v1/messages')) return MSGS;
    if (path.startsWith('/rest/v1/profils')) return [{ user_id: MOI, prenom: 'Test', nom: 'Contrôle', role: 'les_deux', region_slug: 'abidjan', ville: 'Abidjan' }];
    return [];
  }
  return method === 'POST' && /\/rest\/v1\/(offres|demandes)/.test(path) ? [Object.assign({ id: 999, created_at: new Date().toISOString(), status: 'active' }, body || {})] : [];
}

/* Branche le faux serveur sur un contexte Playwright. etat.mode : 'ok' | 'lent' (réponse retardée) | 'panne' (500) */
async function brancher(ctx, journal, etat = { mode: 'ok', retard: 0 }) {
  await ctx.route(/https:\/\/[a-z]+\.supabase\.co\//, async route => {
    const req = route.request(), u = new URL(req.url()), path = u.pathname + u.search;
    let body = null; try { body = req.postDataJSON(); } catch (_) {}
    const fn = (u.pathname.match(/\/rpc\/([a-z0-9_]+)/) || [])[1] || null;
    journal.push({ t: Date.now(), m: req.method(), p: u.pathname, q: u.search.slice(0, 160), fn });
    if (etat.mode === 'panne') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Service indisponible' }) });
    if (etat.retard) await new Promise(r => setTimeout(r, etat.retard));
    const r = reponse(req.method(), path, body);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(r) });
  });
  // tout autre domaine extérieur (polices Google, tuiles, CDN) : refusé tout de suite et noté (l'environnement n'y a pas accès)
  await ctx.route(url => { const h = new URL(url).hostname; return h !== 'localhost' && h !== '127.0.0.1' && !/supabase\.co$/.test(h); }, route => { journal.push({ t: Date.now(), m: route.request().method(), p: route.request().url().slice(0, 120), externe: true }); return route.abort(); });
}

module.exports = { brancher, MOI, AUTRE, NEGOS, CMDS, OFFRES };
