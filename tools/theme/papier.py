#!/usr/bin/env python3
"""Passe une fenêtre (module v3/*.js) du thème nuit au thème papier clair, comme « Mon compte » (v3/compte.js).
Table de correspondance des couleurs écrites en dur ; l'encre et l'ivoire sont échangés (un bouton ivoire sur nuit devient encre sur papier).
Usage : python3 tools/theme/papier.py v3/messages.js v3/negoce.js ..."""
import re, sys
TABLE = [
  (r'#F5F0E6\b', '\0IV'), (r'#171512\b', '\0EN'),          # échange encre ↔ ivoire
  (r'#E9E1D2\b', '#2A251E'), (r'#B9AD98\b', '#655C4D'), (r'#8f846f\b', '#857A67'),
  (r'#1d1a15\b', '#F4EEE3'), (r'#1a1712\b', '#EFE7D9'), (r'#211d17\b', '#FFFDF8'), (r'#24201A\b', '#FFFDF8'),
  (r'#14120f\b', '#FFFFFF'), (r'#F3B48A\b', '#A0492A'), (r'#F3A08C\b', '#C0442B'), (r'#F3D2BC\b', '#7A3418'),
  (r'#9fd6ae\b', '#2E7D4F'), (r'#A9CDF5\b', '#2C6CB0'), (r'#F2DC9A\b', '#8A6400'), (r'#E9C2B6\b', '#8A3A28'),
  (r'rgba\(245,\s*240,\s*230,', 'rgba(23,21,18,'),
]
for f in sys.argv[1:]:
    s = open(f).read(); n0 = s
    for a, b in TABLE: s = re.sub(a, b, s, flags=re.I)
    s = s.replace('\0IV', '#171512').replace('\0EN', '#F5F0E6')
    # sur le terracotta, le texte reste encre (6,1:1) ; l'ivoire n'y serait pas lisible
    s = re.sub(r'(background:\s*(?:var\(--acc\)|#E07A3F)\s*;\s*color:\s*)#F5F0E6', r'\1#171512', s, flags=re.I)
    print(f, sum(1 for a, b in zip(n0.splitlines(), s.splitlines()) if a != b), 'lignes changées')
    open(f, 'w').write(s)
