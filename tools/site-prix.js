/* ═════════ Les prix officiels de la semaine (OCPV) : un bloc sur les pages produits et la page site/prix-de-la-semaine/ ═════════
   Données : tools/site/prix-ocpv.json, copiées à la main depuis la dernière note de conjoncture de l'OCPV (lien et semaine dans le fichier).
   Rien n'est inventé : les prix sont ceux de la note ; seules les variations sont calculées ici (les pourcentages de la note
   contiennent des erreurs, ils ne sont pas repris). Ce sont des prix AU DÉTAIL, en FCFA le kg : toujours le dire. */
const fs = require('fs'), path = require('path');

function prix(esc) {
  const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'site', 'prix-ocpv.json'), 'utf8'));
  const S = D.source, P = D.produits;
  const nf = n => Math.round(n).toLocaleString('fr-FR').replace(/[   ]/g, ' ');
  const vari = ([a, b]) => { const v = Math.round((b - a) / a * 100); return v === 0 ? 'stable' : (v > 0 ? '+' : '−') + Math.abs(v) + ' %'; };
  const sens = ([a, b]) => b > a ? 'hausse' : b < a ? 'baisse' : 'stable';
  const cellMoy = m => !m ? '<td class="px-rien"><small>pas relevé</small></td>'
    : `<td><b>${nf(m[1])} F</b><small class="px-${sens(m)}">${vari(m)}<span class="vh"> par rapport à la semaine précédente</span></small><small class="px-avant">${nf(m[0])} F la semaine d’avant</small></td>`;
  const cellFou = f => !f ? '<td class="px-rien"><small>pas relevé</small></td>'
    : `<td><b>${f[0] === f[1] ? nf(f[0]) + ' F partout' : nf(f[0]) + ' à ' + nf(f[1]) + ' F'}</b>${f[2] ? `<small>Le moins cher : ${esc(f[2])}</small>` : ''}${f[3] ? `<small>Le plus cher : ${esc(f[3])}</small>` : ''}</td>`;
  const lienProduit = (x, vers) => x.produit ? `<a href="${vers}${x.produit}/">${esc(x.nom)}</a>` : esc(x.nom);
  const SRC = `<a href="${esc(S.url)}" rel="noopener" target="_blank">${esc(S.titre)}</a>`;

  // ——— le bloc d'une page produit ———
  const parProduit = {};
  Object.entries(P).forEach(([k, x]) => { if (x.produit) (parProduit[x.produit] = parProduit[x.produit] || []).push(k); });
  const blocProduit = (sl, nom) => {
    const ks = parProduit[sl]; if (!ks) return '';
    const lignes = ks.map(k => { const x = P[k];
      return `<tr><th scope="row">${esc(x.nom)}</th>${cellMoy(x.abidjan)}${cellMoy(x.interieur)}${cellFou(x.fa)}</tr>`; }).join('');
    return `<section class="bloc ocpv" aria-labelledby="t-ocpv"><div class="bloc-tete"><h2 id="t-ocpv">Le prix moyen au détail, relevé par l’OCPV : ${esc(nom.toLowerCase())}</h2>
      <p>Prix moyens au détail relevés par l’OCPV sur les marchés, semaine ${esc(S.semaine)}, en ${esc(S.unite)}. Ce sont des prix de détail, pas des prix de gros : un repère pour négocier.</p></div>
      <div class="px-boite"><table class="px-tab"><thead><tr><th scope="col">Produit</th><th scope="col">Abidjan</th><th scope="col">Intérieur du pays</th><th scope="col">Les marchés d’Abidjan</th></tr></thead><tbody>${lignes}</tbody></table></div>
      <p class="px-src">Source : ${SRC}. Variations calculées par Marché de Gros CI à partir des prix de la note.</p>
      <p><a class="lien" href="../../prix-de-la-semaine/">Tous les prix de la semaine</a></p></section>`;
  };

  // ——— la page « Les prix de la semaine » ———
  const familles = D.familles.map(([fam, ks]) => `<tr class="px-fam"><th colspan="3" scope="colgroup">${esc(fam)}</th></tr>` +
    ks.filter(k => P[k].abidjan || P[k].interieur).map(k => `<tr><th scope="row">${lienProduit(P[k], '../produits/')}</th>${cellMoy(P[k].abidjan)}${cellMoy(P[k].interieur)}</tr>`).join('')).join('');
  const fourchettes = D.familles.map(([fam, ks]) => `<tr class="px-fam"><th colspan="3" scope="colgroup">${esc(fam)}</th></tr>` +
    ks.filter(k => P[k].fa || P[k].fi).map(k => `<tr><th scope="row">${lienProduit(P[k], '../produits/')}</th>${cellFou(P[k].fa)}${cellFou(P[k].fi)}</tr>`).join('')).join('');
  // le résumé : les plus fortes baisses et hausses à Abidjan, calculées sur les prix de la note
  const ab = Object.values(P).filter(x => x.abidjan).map(x => ({ x, v: (x.abidjan[1] - x.abidjan[0]) / x.abidjan[0] }));
  const fmt = l => l.map(({ x, v }) => `${x.produit ? `<a href="../produits/${x.produit}/">${esc(x.nom.toLowerCase())}</a>` : esc(x.nom.toLowerCase())} (${vari(x.abidjan)})`).join(', ');
  const baisses = ab.filter(a => a.v <= -0.05).sort((a, b) => a.v - b.v).slice(0, 4), hausses = ab.filter(a => a.v >= 0.05).sort((a, b) => b.v - a.v).slice(0, 4);
  const resume = [baisses.length ? `<li><b>En baisse à Abidjan</b> : ${fmt(baisses)}.</li>` : '', hausses.length ? `<li><b>En hausse à Abidjan</b> : ${fmt(hausses)}.</li>` : '',
    `<li><b>Stables</b> (moins de 5 % d’écart) : ${ab.filter(a => Math.abs(a.v) < 0.05).length} produits sur ${ab.length}.</li>`].join('');
  const titre = 'Prix du vivrier au détail cette semaine en Côte d’Ivoire';
  return {
    blocProduit,
    page: {
      TITRE_PX: esc(titre), H1_PX: esc(titre),
      DESC_PX: esc(`Prix moyens au détail du vivrier relevés par l’OCPV, semaine ${S.semaine} : Abidjan et intérieur, variations, marchés les moins chers.`),
      SEMAINE: esc(S.semaine), PRECEDENTE: esc(S.precedente), UNITE: esc(S.unite), NATURE: esc(S.nature),
      RESUME_PX: resume, TABLE_MOY: familles, TABLE_FOU: fourchettes,
      APPRO_ABJ: esc(S.appro_abidjan), APPRO_INT: esc(S.appro_interieur), SOURCE_PX: SRC, NOTE_PX: esc(S.note),
      LU_LE: S.lu_le, FIN_SEMAINE: S.fin
    }
  };
}
module.exports = prix;
