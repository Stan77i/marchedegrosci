#!/usr/bin/env python3
"""Marché de Gros CI : versions légères des photos de produits pour le site public (site/img/).

Les photos d'origine (v2/img/produit-<id>.webp, 800 × 800, fond transparent) pèsent de 50 à 160 Ko.
Le site en a besoin en deux tailles :
  - site/img/<id>-480.webp : l'étal du haut de page et les grandes compositions ;
  - site/img/<id>-160.webp : les vignettes (rayons, tableau, carte, fil).
Ne refait une image que si l'originale est plus récente. Pillow (gratuit) : pip install pillow.
Commande : python3 tools/site-images.py
"""
import os
import sys

from PIL import Image

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(RACINE, 'v2', 'img')
DST = os.path.join(RACINE, 'site', 'img')
TAILLES = {480: 72, 160: 70}  # taille en px : qualité WebP

os.makedirs(DST, exist_ok=True)
faites = 0
for f in sorted(os.listdir(SRC)):
    if not (f.startswith('produit-') and f.endswith('.webp')):
        continue
    ident = f[len('produit-'):-len('.webp')]
    src = os.path.join(SRC, f)
    for t, q in TAILLES.items():
        dst = os.path.join(DST, '%s-%d.webp' % (ident, t))
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = Image.open(src).convert('RGBA')
        im.thumbnail((t, t), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=q, method=6)
        faites += 1
print('site/img : %d image(s) refaite(s)' % faites, file=sys.stderr)
