#!/usr/bin/env python3
"""Fabrique le dossier claude-design/ : une copie simple de ce qu'il faut pour modifier le design avec Claude Design.

  claude-design/application/  styles, écrans (un fichier par écran), dessins, captures, consignes
  claude-design/site/         styles, gabarits des pages, scripts (lecture), captures, consignes
  claude-design/*.zip         les mêmes dossiers en un seul fichier à téléverser

Les textes des consignes sont dans tools/claude-design/. Les captures sont faites à part par
tools/claude-design-captures.js (navigateur) et gardées telles quelles ici.
Le résultat ne dépend que des fichiers du dépôt (zip aux dates fixes) : pas de commit inutile.
Usage : python3 tools/claude-design.py
"""
import json, os, re, shutil, zipfile

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T = os.path.join(R, 'tools', 'claude-design')
D = os.path.join(R, 'claude-design')
ORIG = {}   # copie -> {src: vrai fichier, entete: ligne ajoutée en tête de la copie} (pour tools/claude-design-retour.py)


def lire(p):
    with open(os.path.join(R, p), encoding='utf-8') as f:
        return f.read()


def ecrire(p, s, src=None, entete=''):
    if src:
        ORIG[p] = {'src': src, 'entete': entete}
    p = os.path.join(D, p)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def copier(src, dst):
    ORIG[dst] = {'src': src, 'entete': ''}
    p = os.path.join(D, dst)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    shutil.copyfile(os.path.join(R, src), p)


def vider(sous):
    """Vide un dossier fabriqué, en gardant ses captures (faites par le navigateur)."""
    base = os.path.join(D, sous)
    if not os.path.isdir(base):
        return
    for n in os.listdir(base):
        if n == 'captures':
            continue
        p = os.path.join(base, n)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)


def nom_fichier(t):
    t = t.lower()
    for a, b in (('àâä', 'a'), ('éèêë', 'e'), ('îï', 'i'), ('ôö', 'o'), ('ùûü', 'u'), ('ç', 'c')):
        for c in a:
            t = t.replace(c, b)
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:40] or 'ecran'


def application():
    vider('application')
    copier('tools/claude-design/application-CONSIGNES.md', 'application/CONSIGNES.md')
    copier('DESIGN.md', 'application/DESIGN.md')
    copier('PRODUCT.md', 'application/PRODUCT.md')
    src = lire('application.dc.html')
    L = src.split('\n')
    debut = next(i for i, l in enumerate(L) if l.strip() == '<x-dc>')
    fin = next(i for i, l in enumerate(L) if l.startswith('<script type="text/x-dc"'))

    # les styles : fichiers liés par la page, dans l'ordre, puis ce qui est écrit dans la page
    css = re.findall(r'<link rel="stylesheet" href="([^"?]+)', '\n'.join(L[debut:fin]))
    for c in css:
        copier(c, 'application/styles/' + os.path.basename(c))
    dedans = re.findall(r'<style>(.*?)</style>', '\n'.join(L[debut:fin]), re.S)
    assert len(dedans) == 1, 'un seul bloc <style> attendu dans <helmet>'
    e = '/* Styles écrits directement dans application.dc.html (dans <helmet>). */\n'
    ecrire('application/styles/00-dans-la-page.css', e + dedans[0], 'application.dc.html', e)

    # les écrans : découpés aux repères « <!-- ═══ NOM ═══ »
    reperes = [i for i in range(debut, fin) if re.match(r'\s*<!-- ═══ ', L[i])]
    morceaux = [(debut, 'cadre', 'Cadre de l’application (téléphone, en-tête de page, styles chargés)')]
    for i in reperes:
        titre = re.sub(r'\s*<!-- ═══\s*|\s*═══.*$', '', L[i]).strip()
        morceaux.append((i, nom_fichier(titre.split(':')[0].split('(')[0]), titre))
    lignes = ['# Les écrans de l’application', '',
              'Chaque fichier de `ecrans/` est un morceau de `application.dc.html`, dans l’ordre.',
              'Les numéros de ligne renvoient au vrai fichier (utile à Claude Code pour reporter les changements).', '',
              '| Fichier | Écran | Lignes dans application.dc.html |', '|---|---|---|']
    for n, (i, nom, titre) in enumerate(morceaux):
        j = morceaux[n + 1][0] if n + 1 < len(morceaux) else fin
        f = '%02d-%s.html' % (n, nom)
        ecrire('application/ecrans/' + f, '\n'.join(L[i:j]) + '\n', 'application.dc.html')
        lignes.append('| `%s` | %s | %d à %d |' % (f, titre.replace('|', '/'), i + 1, j))
    lignes += ['', 'La logique (ce qui remplit les `{{ … }}`) est après la ligne %d : elle n’est pas copiée ici.' % fin]
    ecrire('application/ecrans/SOMMAIRE.md', '\n'.join(lignes) + '\n')

    for f in ('app/icones.js', 'app/marque.js', 'app/sac.js', 'v3/personnages.js', 'v3/avatar.js', 'app/effets.js'):
        copier(f, 'application/dessins/' + os.path.basename(f))

    # les fenêtres (compte, négociation, commandes, messages…) : leurs styles sont dans des constantes CSS de leur module
    mods = re.findall(r'<script src="\.?/?([^"?]+\.js)', src) + re.findall(r"'((?:app|v3)/[^'?]+\.js)", src.split('window.MDGPlus', 1)[1].split('</script>', 1)[0])
    vus, sommaire = set(), ['# Les styles des fenêtres', '',
        'Ces fenêtres sont dessinées par des modules à part : leurs styles sont **écrits dans le code** du module.',
        'Ces fichiers en sont des copies lisibles. Tu peux les modifier : Claude Code reportera le changement dans le module.',
        '`${…}` est une valeur calculée par le programme : la garder telle quelle.', '',
        '| Fichier | Module | Constante (ligne) |', '|---|---|---|']
    for m in mods:
        if m in vus or not os.path.exists(os.path.join(R, m)):
            continue
        vus.add(m)
        js = lire(m)
        for k in re.finditer(r'(?:const|var|let)\s+([A-Z]*CSS)\s*=\s*`', js):
            i = k.end(); j = i
            while True:
                j = js.index('`', j)
                if js[j - 1] != '\\':
                    break
                j += 1
            ligne = js.count('\n', 0, k.start()) + 1
            nom = os.path.splitext(os.path.basename(m))[0] + ('' if k.group(1) == 'CSS' else '-' + k.group(1).lower()) + '.css'
            e = '/* Copie de la constante %s de %s (ligne %d). */\n' % (k.group(1), m, ligne)
            ecrire('application/styles/fenetres/' + nom, e + js[i:j], m, e)
            sommaire.append('| `%s` | `%s` | %s (%d) |' % (nom, m, k.group(1), ligne))
    ecrire('application/styles/fenetres/SOMMAIRE.md', '\n'.join(sommaire) + '\n')


APERCU_SANS = ('vendor/babel.min.js', 'vendor/tesseract/')   # lourds et sans rapport avec le design


def apercu():
    """application/apercu/ : l'application qui s'ouvre telle quelle dans Claude Design.
    Mêmes fichiers que le dépôt, sauf : application.dc.html sans le renvoi de l'ordinateur vers la maintenance,
    sans service worker ni barre admin ; photos de produits réduites à 400 px."""
    base = 'application/apercu/'
    src = lire('application.dc.html')
    vus, file = set(), ['application.dc.html']
    motif = re.compile(r"""['"`(]\.?/?((?:app|v3|v2|vendor|css|fonts|icons)/[\w./%-]+\.(?:js|css|json|svg|png|woff2|webp|pbf|mp3|ogg|wav))""")
    while file:
        f = file.pop()
        if f in vus:
            continue
        vus.add(f)
        if f.endswith(('.js', '.css', '.html')):
            for r in motif.findall(lire(f)):
                r = r.replace('%20', ' ')
                if r not in vus and os.path.isfile(os.path.join(R, r)) and not r.startswith(APERCU_SANS):
                    file.append(r)
    for d in ('vendor/glyphs', 'app/geo'):
        for dp, _, fn in os.walk(os.path.join(R, d)):
            for n in fn:
                vus.add(os.path.relpath(os.path.join(dp, n), R).replace(os.sep, '/'))
    vus.add('support.js')
    from PIL import Image
    for f in sorted(vus):
        if f == 'application.dc.html':
            continue
        if f.startswith('v2/img/'):
            continue
        copier(f, base + f)
    os.makedirs(os.path.join(D, base, 'v2/img'), exist_ok=True)
    for n in sorted(os.listdir(os.path.join(R, 'v2/img'))):
        if n.endswith('.webp'):
            im = Image.open(os.path.join(R, 'v2/img', n))
            if max(im.size) > 400:
                im.thumbnail((400, 400))
            im.save(os.path.join(D, base, 'v2/img', n), 'WEBP', quality=72, method=6)
    # la page : sans le renvoi de l'ordinateur, sans service worker, sans barre admin
    page = re.sub(r'<script>/\* sur ordinateur \(22/10/2026\).*?</script>\n', '', src, count=1, flags=re.S)
    page = re.sub(r"<script>/\* service worker :.*?</script>\n", '', page, count=1, flags=re.S)
    page = re.sub(r'<script src="app/admin-pc\.js[^"]*"[^>]*></script>\n', '', page, count=1)
    assert page.count('maintenance.html') == 0 and 'serviceWorker' not in page, 'aperçu : renvoi ou service worker encore là'
    e = '<!-- APERÇU pour Claude Design : copie de application.dc.html qui s’ouvre aussi sur ordinateur (sans renvoi vers la maintenance, sans service worker). Modifier ici, Claude Code reporte dans le vrai fichier. -->\n'
    ecrire(base + 'application.dc.html', e + page)
    ORIG[base + 'application.dc.html'] = {'src': 'application.dc.html', 'entete': e, 'morceaux': True}


def site():
    vider('site')
    copier('tools/claude-design/site-CONSIGNES.md', 'site/CONSIGNES.md')
    copier('DESIGN.md', 'site/DESIGN.md')
    copier('site/site.css', 'site/styles/site.css')
    for f in ('site/site.js', 'site/carte.js', 'site/garde.js'):
        copier(f, 'site/scripts/' + os.path.basename(f))
    roles = {
        '_debut.html': 'Haut de chaque page (balises head, voile « en construction »)',
        '_entete.html': 'Bandeau du haut (logo, menu)',
        '_fin.html': 'Bas de chaque page (pied de page, fenêtre du code QR)',
        'index.html': 'Accueil',
        'produit.html': 'Page d’un produit (27 pages)',
        'region.html': 'Page d’un district (14 pages)',
        'regions.html': 'Sommaire des districts',
        'saisons.html': 'Calendrier des récoltes',
        'guide.html': 'Modèle d’un guide (le texte est dans guides/)',
        'guides.html': 'Liste des guides',
        'carte.html': 'Carte du réseau en plein écran',
        'a-propos.html': 'Qui sommes-nous',
    }
    lignes = ['# Les gabarits du site', '',
              'Chaque page du site est fabriquée à partir de ces modèles par `tools/site-public.js`.', '',
              '| Fichier | Page |', '|---|---|']
    g = os.path.join(R, 'tools', 'site')
    for n in sorted(os.listdir(g)):
        if n.endswith('.html'):
            copier('tools/site/' + n, 'site/gabarits/' + n)
            lignes.append('| `%s` | %s |' % (n, roles.get(n, '')))
    for n in sorted(os.listdir(os.path.join(g, 'guides'))):
        copier('tools/site/guides/' + n, 'site/gabarits/guides/' + n)
        lignes.append('| `guides/%s` | Texte d’un guide |' % n)
    ecrire('site/gabarits/SOMMAIRE.md', '\n'.join(lignes) + '\n')


def zipper(sous):
    z = os.path.join(D, sous + '.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        base = os.path.join(D, sous)
        for dp, dn, fn in sorted(os.walk(base)):
            dn.sort()
            for n in sorted(fn):
                p = os.path.join(dp, n)
                zi = zipfile.ZipInfo(os.path.relpath(p, D), date_time=(2026, 1, 1, 0, 0, 0))
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = 0o644 << 16
                with open(p, 'rb') as f:
                    zf.writestr(zi, f.read())


if __name__ == '__main__':
    os.makedirs(D, exist_ok=True)
    shutil.copyfile(os.path.join(T, 'LISEZ-MOI.md'), os.path.join(D, 'LISEZ-MOI.md'))
    application()
    apercu()
    site()
    with open(os.path.join(D, 'origines.json'), 'w', encoding='utf-8') as f:
        json.dump(ORIG, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write('\n')
    zipper('application')
    zipper('site')
    print('claude-design/ prêt')
