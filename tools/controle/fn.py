#!/usr/bin/env python3
"""Affiche la DERNIÈRE définition d'une fonction SQL dans les fichiers supabase/schema-*.sql (ordre des numéros 1, 2 … 97b).
Sert à l'unité U01 (règle écrite → code réel) : comparer une règle de CLAUDE.md avec le code qui la porte.
Usage : python3 tools/controle/fn.py <nom_de_fonction> [-a]   (-a : toutes les définitions, de la plus ancienne à la dernière)
Attention : c'est le code du dépôt. La production peut être en retard ou en avance (voir CONTROLE_QUALITE/REGISTRE_ANOMALIES.md)."""
import glob, os, re, sys

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'supabase')


def cle(f):
    m = re.match(r'schema-(\d+)([a-z]*)', os.path.basename(f))
    return (int(m.group(1)), m.group(2)) if m else (0, '')


if len(sys.argv) < 2:
    print(__doc__)
    sys.exit(2)
nom = re.escape(sys.argv[1])
toutes = '-a' in sys.argv
trouves = []
for f in sorted(glob.glob(os.path.join(D, 'schema*.sql')), key=cle):
    s = open(f, encoding='utf8').read()
    for m in re.finditer(r'create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?' + nom + r'\s*\(', s, re.I):
        d = m.start()
        tag = re.search(r'as\s+(\$[a-z_]*\$)', s[d:], re.I)
        if not tag:
            trouves.append((f, s[d:d + 3000]))
            continue
        t = tag.group(1)
        debut = d + tag.end()
        fin = s.find(t, debut)
        trouves.append((f, s[d:fin + len(t) + 40]))
if not trouves:
    print('Aucune définition de « %s » dans supabase/schema*.sql' % sys.argv[1])
    sys.exit(1)
for f, b in (trouves if toutes else trouves[-1:]):
    print('=====', os.path.basename(f), '(' + str(len(trouves)) + ' définition(s))')
    print(b)
