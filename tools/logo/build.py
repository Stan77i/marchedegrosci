"""Logo « Étal vert » : transforme les mots en tracés SVG (aucune police à charger).

Usage : python3 tools/logo/build.py <dossier des polices Archivo .woff>
Les polices viennent du paquet npm @fontsource/archivo (licence OFL) :
archivo-latin-600-normal.woff et archivo-latin-900-italic.woff.
Sortie : tools/logo/mots.json (tracés à la taille 100, ligne de base y=0).
"""
import json, sys, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

def mot(fichier, texte, espace_em):
    f = TTFont(fichier)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap(); gs = f.getGlyphSet(); hmtx = f['hmtx']
    k = 100 / upm
    pen = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    x = 0.0
    for i, ch in enumerate(texte):
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        x += hmtx[g][0] * k + (espace_em * 100 if i < len(texte) - 1 else 0)
    return {'d': pen.getCommands(), 'w': round(x, 1)}

d = sys.argv[1]
r = os.path.join(d, 'archivo-latin-600-normal.woff')
it = os.path.join(d, 'archivo-latin-900-italic.woff')
out = {
    'marche': mot(r, 'marché', -0.035),
    'degros': mot(it, 'de Gros', -0.04),
    'dg': mot(it, 'dG', -0.04),
}
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'mots.json'), 'w'))
print({k: v['w'] for k, v in out.items()}, sum(len(v['d']) for v in out.values()), 'octets')
