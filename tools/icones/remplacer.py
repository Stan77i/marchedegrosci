#!/usr/bin/env python3
"""Remplace, dans application.dc.html, les icônes dessinées à la main par l'icône Lucide de même sens (app/icones.js).
On garde la taille, la couleur et le style de chaque <svg> ; seuls le dessin et le trait (arrondi, épaisseur) changent.
Usage : python3 tools/icones/remplacer.py application.dc.html"""
import re, sys, json, os
ici = os.path.dirname(os.path.abspath(__file__))
js = open(os.path.join(ici, '..', '..', 'app', 'icones.js')).read()
P = json.loads(re.search(r'const P = (\{.*?\});\n', js, re.S).group(1))
# forme dessinée à la main (début du dessin) → icône de même sens
FORMES = [
  ('<path d="M15 5l-7 7 7 7"></path>', 'retour'),
  ('<path d="M5 21V4h11l-1.5 4L16 12H5"></path>', 'signaler'),
  ('<path d="M4 5.5h16v10H9l-5 4z"></path><path d="M8 9.5h8M8 12.5h5"></path>', 'messages'),
  ('<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 20 20"></path>', 'chercher'),
  ('<path d="M6 9l6 6 6-6"></path>', 'bas'),
  ('<path d="M9 5l7 7-7 7"></path>', 'suite'),
  ('<path d="M6 15l6-6 6 6"></path>', 'haut'),
  ('<path d="M4 7h11M4 7l3-3M4 7l3 3M20 17H9m11 0-3-3m3 3-3 3"', 'negoce'),
  ('<rect x="5" y="10.5" width="14" height="10" rx="2"></rect><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"></path>', 'cadenas'),
  ('<path d="M6 6l12 12M18 6 6 18"></path>', 'fermer'),
  ('<path d="M4 7h16M4 12h16M4 17h16"></path>', 'menu'),
  ('<path d="M5 12h13M13 6l6 6-6 6"></path>', 'fleche'),
  ('<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"></path><path d="M10 20.5a2 2 0 0 0 4 0"></path>', 'cloche'),
  ('<path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"></path>', 'partager'),
  ('<path d="M4 6h16M7 12h10M10 18h4"></path>', 'filtre'),
  ('<path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle>', 'photo'),
  ('<path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path><circle cx="12" cy="12" r="6"></circle>', 'localiser'),
  ('<circle cx="5" cy="18" r="2.2"></circle><circle cx="19" cy="6" r="2.2"></circle>', 'distance'),
  ('<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8v.5"></path>', 'info'),
  ('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"></path>', 'lieu'),
  ('<path d="M3 12V4h8l10 10-8 8z"></path><circle cx="8" cy="8" r="1.5"></circle>', 'etiquette'),
  ('<path d="M5 20V12M12 20V5M19 20v-9"></path>', 'barres'),
  ('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"></path>', 'supprimer'),
]
f = sys.argv[1]; s = open(f).read(); n = 0
def refaire(m):
    global n
    attrs, corps = m.group(1), m.group(2)
    nom = next((k for forme, k in FORMES if corps.lstrip().startswith(forme)), None)
    if not nom: return m.group(0)
    a = re.sub(r'\s(viewBox|fill|stroke-linecap|stroke-linejoin)="[^"]*"', '', attrs)
    if 'stroke=' not in a: a += ' stroke="currentColor"'
    if 'stroke-width=' not in a: a += ' stroke-width="2"'
    if 'aria-hidden' not in a and 'aria-label' not in a: a += ' aria-hidden="true"'
    n += 1
    return '<svg' + a + ' viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round" data-ico="' + nom + '">' + re.sub(r'<(\w+)([^<>]*?)\s*/>', r'<\1\2></\1>', P[nom])   # balises fermées en entier, comme le reste du modèle + '</svg>'
s = re.sub(r'<svg((?:\s[^>]*)?)>(.*?)</svg>', refaire, s, flags=re.S)
open(f, 'w').write(s); print(n, 'icônes remplacées')
