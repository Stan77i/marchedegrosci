"""Fabrique app/marque.js et les icônes SVG à partir de tools/logo/mots.json.

Usage : python3 tools/logo/marque.py   (après build.py)
Puis : node tools/logo/png.js pour les PNG.
"""
import json, os
ici = os.path.dirname(os.path.abspath(__file__))
rac = os.path.dirname(os.path.dirname(ici))
M = json.load(open(os.path.join(ici, 'mots.json')))
VERT, CREME, MAIS, NOIR = '#10392B', '#F3EFE4', '#F2C230', '#141414'

def empile_g(fond, k=1.0):
    """Le nom sur deux lignes, dans une boîte 320 x 132 (unités), à l'échelle k."""
    c1, c2 = (CREME, MAIS) if fond != 'clair' else (VERT, VERT)
    t = ''
    if fond == 'clair':
        t += f'<rect x="0" y="104" width="318" height="27" fill="{MAIS}"/>'
    t += f'<path fill="{c1}" transform="translate(-2.5 51) scale(.7)" d="{M["marche"]["d"]}"/>'
    t += f'<path fill="{c2}" transform="translate(-1 121.5) scale(.82)" d="{M["degros"]["d"]}"/>'
    return t

def carre(fond, k, rx=0, taille=512):
    """Icône carrée : fond plein, nom centré."""
    w, h = 320 * k, 128 * k
    x, y = (taille - w) / 2, (taille - h) / 2 - 2 * k
    bg = VERT if fond == 'vert' else NOIR
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {taille} {taille}">'
            f'<rect width="{taille}" height="{taille}" rx="{rx}" fill="{bg}"/>'
            f'<g transform="translate({x:.1f} {y:.1f}) scale({k})">{empile_g(fond)}</g></svg>')

def dg(fond, rx=112, couleur=MAIS, plein=True):
    s = 2.45
    x = 256 - (2.7 + 143.2) / 2 * s
    y = 256 + 35.65 * s
    bg = '' if not plein else f'<rect width="512" height="512" rx="{rx}" fill="{VERT if fond == "vert" else NOIR}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">{bg}'
            f'<path fill="{couleur}" transform="translate({x:.1f} {y:.1f}) scale({s})" d="{M["dg"]["d"]}"/></svg>')

# icons/v2/ : adresses lues par les pages et le manifeste (changer de dossier force les téléphones à reprendre l'icône) ;
# icons/ : mêmes fichiers pour les anciennes adresses encore en cache
DOSSIERS = [os.path.join(rac, 'icons', 'v2'), os.path.join(rac, 'icons')]
def ecr(n, s):
    for d in DOSSIERS: open(os.path.join(d, n), 'w').write(s)
ecr('favicon.svg', carre('vert', 1.42, rx=112))
ecr('favicon-noir.svg', carre('noir', 1.42, rx=112))
ecr('icon-plein.svg', carre('vert', 1.42))
ecr('icon-plein-noir.svg', carre('noir', 1.42))
ecr('icon-maskable.svg', carre('vert', 1.1))
ecr('badge.svg', dg('vert', couleur='#FFFFFF', plein=False))

js = r"""/* Marque « Étal vert » : le nom « marché de Gros » dessiné en tracés (Archivo, licence OFL).
   Fabriqué par tools/logo/marque.py — ne pas modifier à la main.
   MDGMarque.empile({fond, h, cls})  : le nom sur deux lignes (accueil, ouverture)
   MDGMarque.ligne({fond, h, cls})   : le nom sur une ligne (en-têtes)
   MDGMarque.dg(t, {fond, rond})     : la petite icône, le nom sur deux lignes (messages officiels, cartes, onglet)
   fond : 'vert' (crème + maïs, sur fond foncé) · 'noir' (pareil) · 'clair' (vert, trait maïs) */
(function () {
  var D = __D__;
  var C = { vert: '#10392B', creme: '#F3EFE4', mais: '#F2C230', noir: '#141414' };
  function cols(f) { return f === 'clair' ? [C.vert, C.vert] : [C.creme, C.mais]; }
  function svg(vb, w, h, cls, inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"' + (w ? ' width="' + w + '"' : '') + (h ? ' height="' + h + '"' : '') +
      ' role="img" aria-label="Marché de Gros"' + (cls ? ' class="' + cls + '"' : '') + ' style="display:block;overflow:visible">' + inner + '</svg>';
  }
  function empile(o) { o = o || {}; var c = cols(o.fond), h = o.h || 0, w = h ? Math.round(h * 320 / 132) : 0;
    return svg('0 0 320 132', w, h, o.cls,
      (o.fond === 'clair' && o.trait !== false ? '<rect class="mq-b" x="0" y="104" width="318" height="27" fill="' + C.mais + '"/>' : '') +
      '<g transform="translate(-2.5 51) scale(.7)"><path class="mq-m" fill="' + c[0] + '" d="' + D.m + '"/></g>' +
      '<g transform="translate(-1 121.5) scale(.82)"><path class="mq-g" fill="' + c[1] + '" d="' + D.g + '"/></g>'); }
  function ligne(o) { o = o || {}; var c = cols(o.fond), h = o.h || 0, w = h ? Math.round(h * 776 / 96) : 0;
    return svg('0 -80 776 96', w, h, o.cls,
      (o.fond === 'clair' && o.trait ? '<rect class="mq-b" x="352" y="-23" width="424" height="36" fill="' + C.mais + '"/>' : '') +
      '<g transform="translate(-6.5 0)"><path class="mq-m" fill="' + c[0] + '" d="' + D.m + '"/></g>' +
      '<g transform="translate(356.6 0) scale(1.091)"><path class="mq-g" fill="' + c[1] + '" d="' + D.g + '"/></g>'); }
  // la petite icône (messages officiels, cartes, onglet) : le même dessin que l'icône de l'écran d'accueil,
  // « marché de Gros » sur deux lignes sur un carré vert arrondi (ou un rond : le nom est alors un peu plus petit pour tenir)
  function dg(t, o) { o = o || {}; t = t || 38; var bg = o.fond === 'noir' ? C.noir : C.vert, k = o.rond ? 1.12 : 1.42, w = 320 * k, h = 128 * k;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="' + t + '" height="' + t + '" aria-hidden="true" style="display:block;flex:none">' +
      '<rect width="512" height="512" rx="' + (o.rond ? 256 : 112) + '" fill="' + bg + '"' + (o.fond === 'noir' ? ' stroke="rgba(243,239,228,.3)" stroke-width="10"' : '') + '/>' +
      '<g transform="translate(' + ((512 - w) / 2).toFixed(1) + ' ' + ((512 - h) / 2 - 2 * k).toFixed(1) + ') scale(' + k + ')">' +
      '<g transform="translate(-2.5 51) scale(.7)"><path fill="' + C.creme + '" d="' + D.m + '"/></g>' +
      '<g transform="translate(-1 121.5) scale(.82)"><path fill="' + C.mais + '" d="' + D.g + '"/></g></g></svg>'; }
  window.MDGMarque = { empile: empile, ligne: ligne, dg: dg, C: C };
  // pages statiques : <span data-mq="ligne|empile" data-fond="clair" data-h="24"></span> se remplit tout seul
  function remplir() { var L = document.querySelectorAll('[data-mq]:not([data-mq-ok])');
    for (var i = 0; i < L.length; i++) { var e = L[i], f = e.getAttribute('data-mq') === 'empile' ? empile : ligne;
      e.innerHTML = f({ fond: e.getAttribute('data-fond') || 'vert', h: +e.getAttribute('data-h') || 0, trait: e.hasAttribute('data-trait') }); e.setAttribute('data-mq-ok', ''); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', remplir); else remplir();
  window.MDGMarque.remplir = remplir;
})();
"""
D = json.dumps({'m': M['marche']['d'], 'g': M['degros']['d'], 'dg': M['dg']['d']}, separators=(',', ':'))
open(os.path.join(rac, 'app', 'marque.js'), 'w').write(js.replace('__D__', D))
print('ok', os.path.getsize(os.path.join(rac, 'app', 'marque.js')), 'octets')
