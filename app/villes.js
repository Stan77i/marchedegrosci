/* Marché de Gros CI — villes et villages principaux de chaque région (districts de Côte d'Ivoire).
   Sert aux formulaires : choisir une région montre ses villes ; choisir une ville remplit la région.
   La première ville de chaque liste est le chef-lieu (le même que MDGApp.REG). Une ville absente peut toujours être écrite à la main.
   API : MDGVilles.de(region) → [noms] · MDGVilles.region(nom) → slug ou '' · MDGVilles.toutes() → [{ nom, region }] · MDGVilles.ref(nom) → la ville qui compte */
(function () {
  'use strict';
  const V = {
    abidjan: ['Abidjan', 'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville', 'Yopougon'],
    yamoussoukro: ['Yamoussoukro', 'Attiégouakro', 'Kossou'],
    'bas-sassandra': ['San-Pédro', 'Buyo', 'Fresco', 'Grand-Béréby', 'Guéyo', 'Méagui', 'Sassandra', 'Soubré', 'Tabou'],
    comoe: ['Abengourou', 'Aboisso', 'Adiaké', 'Agnibilékrou', 'Ayamé', 'Bettié', 'Bonoua', 'Grand-Bassam', 'Maféré', 'Tiapoum'],
    denguele: ['Odienné', 'Gbéléban', 'Kaniasso', 'Madinani', 'Minignan', 'Samatiguila', 'Séguélon'],
    'goh-djiboua': ['Gagnoa', 'Divo', 'Guitry', 'Hiré', 'Lakota', 'Oumé'],
    lacs: ['Dimbokro', 'Arrah', 'Bocanda', 'Bongouanou', 'Daoukro', 'Didiévi', 'Djékanou', 'Kouassi-Kouassikro', 'M’Bahiakro', 'M’Batto', 'Prikro', 'Tiébissou', 'Toumodi'],
    lagunes: ['Dabou', 'Adzopé', 'Agboville', 'Akoupé', 'Alépé', 'Grand-Lahou', 'Jacqueville', 'N’Douci', 'Sikensi', 'Taabo', 'Tiassalé', 'Yakassé-Attobrou'],
    montagnes: ['Man', 'Bangolo', 'Biankouma', 'Bloléquin', 'Danané', 'Duékoué', 'Facobly', 'Guiglo', 'Kouibly', 'Sipilou', 'Taï', 'Toulépleu', 'Zouan-Hounien'],
    'sassandra-marahoue': ['Daloa', 'Bonon', 'Bouaflé', 'Gohitafla', 'Issia', 'Sinfra', 'Vavoua', 'Zoukougbeu', 'Zuénoula'],
    savanes: ['Korhogo', 'Boundiali', 'Diawala', 'Dikodougou', 'Ferkessédougou', 'Kong', 'Kouto', 'M’Bengué', 'Ouangolodougou', 'Sinématiali', 'Tengréla'],
    'vallee-du-bandama': ['Bouaké', 'Béoumi', 'Botro', 'Brobo', 'Dabakala', 'Djébonoua', 'Fronan', 'Katiola', 'Niakaramandougou', 'Sakassou', 'Tafiré'],
    woroba: ['Séguéla', 'Dianra', 'Kani', 'Koro', 'Kounahiri', 'Mankono', 'Massala', 'Ouaninou', 'Touba'],
    zanzan: ['Bondoukou', 'Bouna', 'Doropo', 'Koun-Fao', 'Kouassi-Datékro', 'Nassian', 'Sandégué', 'Tanda', 'Téhini', 'Transua']
  };
  // comparaison sans accents, sans casse, sans tirets ni apostrophes : « san pedro » = « San-Pédro »
  const cle = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const index = {}; Object.keys(V).forEach(r => V[r].forEach(n => { index[cle(n)] = r; }));
  index[cle('San Pedro')] = 'bas-sassandra';
  const de = r => (V[r] || []).slice();
  const region = n => index[cle(n)] || '';
  const toutes = () => Object.keys(V).flatMap(r => V[r].map(nom => ({ nom, region: r })));
  // le nom tel qu'écrit dans la liste (« bouake » → « Bouaké ») ; sinon le texte tel quel
  const propre = n => { const r = region(n); if (!r) return String(n || '').trim(); return V[r].find(x => cle(x) === cle(n)) || String(n).trim(); };
  // la ville qui compte pour « vendre / acheter uniquement à » et « même ville » (règle du propriétaire, 24/10/2026) :
  // « X (près de Ville) » → Ville ; une commune d'Abidjan (Cocody, Yopougon…) → Abidjan. Même règle que la base (_ville_ref, schéma 87c).
  const ref = n => { let c = String(n || '').trim(); const m = /\(près de ([^)]+)\)\s*$/.exec(c); if (m) c = m[1].trim(); return region(c) === 'abidjan' ? 'Abidjan' : c; };
  window.MDGVilles = { de, region, toutes, propre, cle, ref, V };
})();
