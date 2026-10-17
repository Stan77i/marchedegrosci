/* Marché de Gros — application mobile : données de référence, stockage partagé avec le site (mêmes clés mdg-v2:*), géométrie de la carte, pictogrammes animés.
   Aucune donnée de marché inventée : offres et demandes = uniquement ce qui est publié depuis cet appareil (site ou application). */
(function () {
  'use strict';
  const A = window.MDGApp = {};
  A.IMG = 'v2/img/';
  A.SACK = { tomate: 30, oignon: 350, 'piment-frais': 135, 'piment-garba': 120, gombo: 130, aubergine: 320, chou: 135, poivron: 145, concombre: 140, citron: 115, orange: 65, papaye: 60, ananas: 85, avocat: 130, 'banane-douce': 95, pasteque: 145, 'banane-plantain': 110, 'patate-douce': 45, 'pomme-de-terre': 75, ail: 320 };
  A.FAMHUE = { 'cereales-et-riz-local': 85, 'tubercules-et-feculents': 55, 'legumes-et-fruits': 140, 'viande-de-brousse': 25, poissons: 230, volaille: 45, oeufs: 75, 'produits-surgeles': 220, 'assaisonnements-epices-condiments': 35, 'arachide-noix-et-oleagineux': 60, 'autres-produits-vivriers': 100 };
  A.UNITS = ['kg', 'sac', 'tonne', 'régime', 'cageot', 'unité'];
  A.MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  A.LV = { plein: ['En pleine récolte', '#31543C', '#6CC58C'], debut: ['Ça commence', '#9dc2a7', '#9dc2a7'], fin: ['Ça se termine', '#dcb04f', '#D6A83E'] };
  A.RANK = { plein: 3, debut: 2, fin: 1 };
  // calendrier repris de v2/saisons.js (entrées sourcées uniquement)
  A.CAL = [
    ['igname', 'Igname précoce', { 8: 'debut', 9: 'plein', 10: 'plein' }, 'IDESSA', 'wacrou, kponan, assawa'],
    ['igname', 'Igname tardive', { 12: 'debut', 1: 'plein', 2: 'plein', 3: 'fin' }, 'IDESSA', 'krenglè, bêtê-bêtê, florido'],
    ['mais-frais-epis', 'Maïs frais', { 8: 'debut', 9: 'plein' }, 'FEWS NET', 'Centre-Sud'],
    ['mais-grain', 'Maïs grain (Sud)', { 12: 'plein', 1: 'fin' }, 'FAO GIEWS', 'seconde récolte'],
    ['mais-grain', 'Maïs grain (Nord)', { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, 'FAO GIEWS', 'Nord'],
    ['riz-local', 'Riz local', { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, 'FAO GIEWS', 'Nord'],
    ['mil', 'Mil', { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, 'FAO GIEWS', 'Nord'],
    ['sorgho', 'Sorgho', { 9: 'debut', 10: 'plein', 11: 'plein', 12: 'fin' }, 'FAO GIEWS', 'Nord'],
    ['mangue', 'Mangue', { 3: 'debut', 4: 'plein', 5: 'plein', 6: 'fin' }, 'AIP', 'Savanes, Denguélé'],
    ['noix-de-cajou', 'Noix de cajou', { 2: 'debut', 3: 'debut' }, 'Conseil coton-anacarde', 'campagne ouverte le 9 février 2026'],
    ['cacao-en-feves', 'Cacao', { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, 'Conseil café-cacao', 'grande campagne'],
    ['cafe-en-grains', 'Café', { 9: 'plein', 10: 'plein', 11: 'plein', 12: 'plein', 1: 'plein', 2: 'plein' }, 'Conseil café-cacao', 'même campagne que le cacao']
  ];
  A.REG = { abidjan: [5.36, -4.01, 'Abidjan'], yamoussoukro: [6.82, -5.28, 'Yamoussoukro'], 'bas-sassandra': [4.95, -6.64, 'San-Pédro'], comoe: [6.73, -3.49, 'Abengourou'],
    denguele: [9.51, -7.56, 'Odienné'], 'goh-djiboua': [6.13, -5.95, 'Gagnoa'], lacs: [6.65, -4.71, 'Dimbokro'], lagunes: [5.42, -4.38, 'Dabou'], montagnes: [7.41, -7.55, 'Man'],
    'sassandra-marahoue': [6.88, -6.45, 'Daloa'], savanes: [9.46, -5.63, 'Korhogo'], 'vallee-du-bandama': [7.69, -5.03, 'Bouaké'], woroba: [7.96, -6.67, 'Séguéla'], zanzan: [8.04, -2.8, 'Bondoukou'] };
  const OUT = [[-7.53,4.37],[-6.85,4.66],[-6.64,4.73],[-6.08,4.95],[-5.3,5.15],[-5.02,5.12],[-4.6,5.17],[-4.02,5.25],[-3.74,5.18],[-3.3,5.11],[-3.1,5.1],[-2.95,5.5],[-3.1,6.0],[-3.24,6.5],[-3.1,7.0],[-2.95,7.4],[-2.75,8.0],[-2.55,8.25],[-2.65,8.9],[-2.7,9.45],[-3.0,9.85],[-3.6,9.92],[-4.3,9.62],[-4.7,9.72],[-5.1,10.25],[-5.5,10.42],[-6.0,10.2],[-6.25,10.5],[-6.9,10.3],[-7.6,10.45],[-8.0,10.2],[-8.2,9.8],[-8.1,9.3],[-7.85,8.8],[-8.2,8.45],[-8.47,7.6],[-8.3,7.2],[-7.9,6.75],[-7.55,6.2],[-7.4,5.7],[-7.6,5.1]];
  A.OUT = OUT;
  // projection équirectangulaire simple, viewBox 0 0 340 360 (contour simplifié du site, positions au chef-lieu du district)
  A.proj = (lat, lon) => [Math.round(((lon + 8.7) / 6.3) * 320 + 10), Math.round(((10.7 - lat) / 6.5) * 340 + 10)];
  A.OUTLINE = 'M' + OUT.map(p => A.proj(p[1], p[0]).join(' ')).join('L') + 'Z';
  A.km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(h))); };

  /* ——— stockage partagé avec le site ——— */
  A.read = k => { try { return JSON.parse(localStorage.getItem('mdg-v2:' + k) || '[]') || []; } catch (_) { return []; } };
  A.write = (k, v) => { try { localStorage.setItem('mdg-v2:' + k, JSON.stringify(v)); dispatchEvent(new CustomEvent('mdg:change')); return true; } catch (_) { return false; } };
  A.digits = s => String(s || '').replace(/\D/g, '');
  A.tel10 = s => { let d = A.digits(s); if (d.length === 13 && d.startsWith('225')) d = d.slice(3); return d.length === 10 ? d : null; };
  A.fmt = n => Math.round(n).toLocaleString('fr-FR').replace(/\u202f/g, ' ');
  A.norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  A.ago = t => { const ms = typeof t === 'number' ? t : Date.parse(t); if (!ms) return ''; const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'à l\u2019instant'; if (m < 60) return 'il y a ' + m + ' min'; const h = Math.round(m / 60); if (h < 24) return 'il y a ' + h + ' h'; return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
  A.DEAD = { vite: 'dès que possible', semaine: 'cette semaine', mois: 'ce mois-ci' };
  A.photo = file => new Promise((ok, ko) => { const r = new FileReader(); r.onerror = ko; r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 520 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.7)); }; im.onerror = ko; im.src = r.result; }; r.readAsDataURL(file); });

  /* ——— calendrier circulaire : un anneau par culture sourcée, un secteur par mois ——— */
  A.yearSVG = (month, now) => {
    const cx = 170, cy = 170, rows = A.CAL, r0 = 44, step = 7.4, W = 5.6;
    const arc = (r, a0, a1) => { const p = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
    let s = `<svg viewBox="0 0 340 340" width="100%" style="display:block;overflow:visible">`;
    const am = (m) => (m - 1) / 12 * Math.PI * 2 - Math.PI / 2;
    s += `<path d="${arc(r0 + rows.length * step + 14, am(month) + .02, am(month + 1) - .02)}" stroke="#E07A3F" stroke-width="3" stroke-linecap="round" fill="none"></path>`;
    s += `<g style="transform-origin:${cx}px ${cy}px;transform:rotate(${(month - 1) * 30 + 15}deg);transition:transform .7s cubic-bezier(.22,1,.36,1)"><line x1="${cx}" y1="${cy - r0 + 10}" x2="${cx}" y2="${cy - (r0 + rows.length * step + 6)}" stroke="#F5F0E6" stroke-opacity=".5" stroke-width="1"></line></g>`;
    rows.forEach((e, i) => { const r = r0 + i * step; s += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="#F5F0E6" stroke-opacity=".06" stroke-width="${W}" fill="none"></circle>`;
      Object.entries(e[2]).forEach(([m, lv]) => { m = +m; const on = m === month; s += `<path d="${arc(r, am(m) + .03, am(m + 1) - .03)}" stroke="${A.LV[lv][2]}" stroke-opacity="${on ? 1 : .55}" stroke-width="${W}" fill="none" style="stroke-dasharray:60;stroke-dashoffset:60;animation:mkArc .9s ${(i * .05 + m * .02).toFixed(2)}s cubic-bezier(.22,1,.36,1) forwards"></path>`; }); });
    A.MOIS.forEach((n, i) => { const a = am(i + 1) + Math.PI / 12, rr = r0 + rows.length * step + 22; s += `<text x="${(cx + rr * Math.cos(a)).toFixed(1)}" y="${(cy + rr * Math.sin(a) + 4).toFixed(1)}" text-anchor="middle" font-family="Jost,sans-serif" font-size="11" font-weight="${i + 1 === month ? 700 : 500}" fill="${i + 1 === month ? '#E07A3F' : (i + 1 === now ? '#F5F0E6' : '#B9AD98')}" data-m="${i + 1}" style="cursor:pointer">${['JANV', 'FÉVR', 'MARS', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEPT', 'OCT', 'NOV', 'DÉC'][i]}</text>`; });
    for (let m = 1; m <= 12; m++) s += `<path d="${arc(r0 + rows.length * step / 2, am(m), am(m + 1))}" stroke="transparent" stroke-width="${rows.length * step + 30}" fill="none" data-m="${m}" style="cursor:pointer"></path>`;
    s += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="Cormorant Garamond,serif" font-size="30" fill="#F5F0E6">${A.MOIS[month - 1].slice(0, 4)}.</text><text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="Jost,sans-serif" font-size="9" letter-spacing="2" fill="#B9AD98">${String(month).padStart(2, '0')} / 12</text></svg>`;
    return s;
  };
})();
