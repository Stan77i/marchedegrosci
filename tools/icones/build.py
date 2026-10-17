#!/usr/bin/env python3
"""Construit app/icones.js à partir des SVG Lucide (ISC) : seulement les icônes utilisées par l'application.
Usage : python3 tools/icones/build.py DOSSIER_lucide-static/icons
Le nom de gauche est le nom utilisé dans l'application (il dit le sens), à droite l'icône Lucide."""
import re, sys, json, os
NOMS = {
  # parcours
  'acheter': 'shopping-basket', 'vendre': 'store', 'demander': 'megaphone', 'chercher': 'search',
  # compte et échanges
  'compte': 'circle-user-round', 'negoce': 'handshake', 'messages': 'message-circle-more', 'publications': 'package-open',
  'profil': 'id-card', 'alertes': 'bell-ring', 'sortir': 'log-out', 'agent': 'user-round-check',
  # le marché
  'reseau': 'map', 'categories': 'layout-grid', 'prix': 'chart-column-increasing', 'annee': 'calendar-range', 'notes': 'award',
  # aide
  'comment': 'route', 'producteur': 'sprout', 'confiance': 'shield-check', 'avis': 'star-off', 'verifie': 'badge-check', 'signaler': 'flag',
  'echanger': 'messages-square', 'trouver': 'map-pinned',
  # carte
  'plus': 'plus', 'moins': 'minus', 'pays': 'scan', 'localiser': 'locate-fixed', 'jour': 'sun', 'nuit': 'moon', 'chaleur': 'flame',
  # divers
  'retour': 'chevron-left', 'fermer': 'x', 'menu': 'menu', 'nouveau': 'sparkles', 'offre': 'circle', 'ordi': 'monitor',
  'suite': 'chevron-right', 'bas': 'chevron-down', 'haut': 'chevron-up', 'fleche': 'arrow-right', 'cadenas': 'lock', 'cloche': 'bell',
  'partager': 'share', 'filtre': 'list-filter', 'photo': 'camera', 'distance': 'route', 'info': 'info', 'lieu': 'map-pin', 'etiquette': 'tag',
  'barres': 'chart-no-axes-column', 'supprimer': 'trash-2',
  # fenêtres partagées avec le site (compte, messages, administration)
  'reglages': 'sliders-horizontal', 'activite': 'clipboard-list', 'tableau': 'layout-dashboard', 'horloge': 'clock', 'envoyer': 'send-horizontal',
  'options': 'ellipsis', 'apercu': 'chart-column', 'traiter': 'triangle-alert', 'comptes': 'users', 'site': 'globe',
}
src = sys.argv[1]; out = {}
for k, n in NOMS.items():
    s = open(os.path.join(src, n + '.svg')).read()
    corps = re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1)
    corps = re.sub(r'<!--.*?-->', '', corps, flags=re.S)
    corps = re.sub(r'\s*/>', '/>', re.sub(r'\s+', ' ', corps)).strip()
    out[k] = corps.replace('> <', '><')
js = '''/* Marché de Gros CI — icônes (générées par tools/icones/build.py ; ne pas modifier à la main)
   Icônes Lucide v0.460.0, licence ISC (vendor/lucide/LICENSE). Trait 24 px, sans animation.
   MDGIco.svg(nom, taille?, trait?) → chaîne SVG qui prend la couleur du texte (currentColor). */
(function () {
  const P = %s;
  const svg = (n, t, w) => '<svg class="ico" width="' + (t || 24) + '" height="' + (t || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (w || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (P[n] || '') + '</svg>';
  window.MDGIco = { svg, corps: n => P[n] || '', a: n => !!P[n], noms: Object.keys(P) };
})();
''' % json.dumps(out, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'icones.js'), 'w').write(js)
print(len(js), 'octets,', len(out), 'icônes')
