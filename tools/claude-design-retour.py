#!/usr/bin/env python3
"""Reporte dans le vrai code les fichiers rendus par Claude Design.

  python3 tools/claude-design-retour.py <dossier ou fichier .zip>              montre ce qui a changé
  python3 tools/claude-design-retour.py <dossier ou fichier .zip> --appliquer  reporte les changements

Chaque copie de claude-design/ connaît son vrai fichier (claude-design/origines.json, fait par tools/claude-design.py).
Le texte d'origine de la copie est cherché dans le vrai fichier et remplacé par le texte rendu : il doit s'y trouver
une seule fois, sinon le fichier est signalé (« à reporter à la main »), rien n'est écrit.
Les fichiers inconnus (CHANGEMENTS.md, maquettes, nouveaux fichiers) sont listés : à lire et à traiter à la main.
Ensuite, comme pour tout changement du front : ?v= des fichiers modifiés, CACHE de sw.js, vérification dans le navigateur.
"""
import json, os, sys, zipfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(R, 'claude-design')
NE_PAS_REPORTER = ('CONSIGNES.md', 'SOMMAIRE.md', 'LISEZ-MOI.md', 'origines.json')


def rendus(chemin):
    """{chemin relatif: texte} pour tout ce que Claude Design a rendu."""
    out = {}
    if zipfile.is_zipfile(chemin):
        with zipfile.ZipFile(chemin) as z:
            for n in z.namelist():
                if not n.endswith('/'):
                    out[n] = z.read(n)
    else:
        for dp, _, fn in os.walk(chemin):
            for n in fn:
                p = os.path.join(dp, n)
                with open(p, 'rb') as f:
                    out[os.path.relpath(p, chemin).replace(os.sep, '/')] = f.read()
    return out


def trouver(rel, O):
    """La copie de claude-design/ qui correspond à un fichier rendu (le dossier de tête peut manquer ou différer)."""
    rel = rel.lstrip('./')
    if 'claude-design/' in rel:
        rel = rel.split('claude-design/', 1)[1]
    if rel in O:
        return [rel]
    parts = rel.split('/')
    for k in range(1, len(parts)):
        bout = '/'.join(parts[k:])
        c = [x for x in O if x.endswith('/' + bout)]
        if c:
            return c
    return [x for x in O if x.endswith('/' + rel)]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    appliquer = '--appliquer' in sys.argv
    O = json.load(open(os.path.join(D, 'origines.json'), encoding='utf-8'))
    R0 = rendus(sys.argv[1])
    faits, pareils, main_, inconnus = [], [], [], []
    tous = {}
    for dp, _, fn in os.walk(D):
        for n in fn:
            p = os.path.join(dp, n)
            tous[os.path.relpath(p, D).replace(os.sep, '/')] = p
    for rel, octets in sorted(R0.items()):
        if os.path.basename(rel) in NE_PAS_REPORTER or rel.endswith('.zip'):
            continue
        meme = trouver(rel, tous)
        if len(meme) == 1:
            with open(tous[meme[0]], 'rb') as f:
                if f.read() == octets:
                    pareils.append(meme[0])
                    continue
        c = trouver(rel, O)
        if len(c) != 1:
            (inconnus if not c else main_).append(rel + ('' if not c else '  (plusieurs copies possibles : ' + ', '.join(c) + ')'))
            continue
        cle = c[0]
        if cle.endswith(('.jpg', '.png', '.webp')):
            inconnus.append(rel + '  (image : à regarder)')
            continue
        try:
            neuf = octets.decode('utf-8')
        except UnicodeDecodeError:
            inconnus.append(rel + '  (pas du texte)')
            continue
        with open(os.path.join(D, cle), encoding='utf-8') as f:
            ancien = f.read()
        if neuf.replace('\r\n', '\n') == ancien:
            pareils.append(cle)
            continue
        neuf = neuf.replace('\r\n', '\n')
        e, src = O[cle]['entete'], O[cle]['src']
        if e:
            ancien = ancien[len(e):] if ancien.startswith(e) else ancien
            neuf = neuf[len(e):] if neuf.startswith(e) else neuf
        with open(os.path.join(R, src), encoding='utf-8') as f:
            vrai = f.read()
        n = vrai.count(ancien)
        if n != 1:
            main_.append('%s → %s  (le texte d’origine y est %d fois : le vrai fichier a changé depuis ?)' % (rel, src, n))
            continue
        if appliquer:
            with open(os.path.join(R, src), 'w', encoding='utf-8') as f:
                f.write(vrai.replace(ancien, neuf, 1))
        faits.append('%s → %s' % (cle, src))

    print(('Reporté' if appliquer else 'À reporter (relancer avec --appliquer)') + ' : %d' % len(faits))
    for x in faits:
        print('  ' + x)
    if main_:
        print('À reporter à la main : %d' % len(main_))
        for x in main_:
            print('  ' + x)
    if inconnus:
        print('À lire (maquettes, CHANGEMENTS.md, nouveaux fichiers) : %d' % len(inconnus))
        for x in inconnus:
            print('  ' + x)
    print('Inchangés : %d' % len(pareils))
    if appliquer and faits:
        print('Ensuite : ?v= des fichiers modifiés, CACHE de sw.js, python3 tools/claude-design.py, '
              'node tools/claude-design-captures.js, vérification dans le navigateur.')


if __name__ == '__main__':
    main()
