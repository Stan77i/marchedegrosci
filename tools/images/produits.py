"""Images des produits (fond transparent) : correspondance nom de fichier → produit, mise au format de l'app.

Usage : python3 tools/images/produits.py <dossier des images sources>
- chaque image est posée au centre d'un carré transparent de 800 × 800 px, en WebP (qualité 80) : v2/img/produit-<slug>.webp
- la teinte de fond de la vignette (A.SACK dans app/marche-app.js) est calculée sur l'image
- les produits qui n'existaient pas sont ajoutés au catalogue (v2/data.js), avec leur famille
Les images en double (variantes -2, « ancienne », fautes de frappe) ne sont pas utilisées : la liste IMAGES dit lesquelles le sont.
"""
import os, sys, re, json, colorsys, unicodedata
from PIL import Image

ici = os.path.dirname(os.path.abspath(__file__)); rac = os.path.dirname(os.path.dirname(ici))
SRC = sys.argv[1]
# les noms venant d'un Mac écrivent les accents en deux caractères (NFD) : on compare en forme NFC
FICHIERS = {unicodedata.normalize('NFC', f): f for f in os.listdir(SRC)}

# fichier source → produit(s) existant(s)
EXISTANTS = {
    'Attieke_piled_in_wicker_basket_2K_20261009172131.webp': ['attieke'], 'FONIO.webp': ['fonio'], 'IGNAME.webp': ['igname'],
    'agouti.webp': ['agouti', 'aulacode'], 'akpi.webp': ['akpi'], 'arachide-decortiquee.webp': ['arachide-decortiquee'],
    'arachide-en-coque.webp': ['arachide-en-coque'], 'basilic.webp': ['basilic-tchayo'], 'beurre-de-karite.webp': ['beurre-de-karite'],
    'biche-et-antilope.webp': ['antilope-cobe-biche'], 'clou-de-girofle.webp': ['clou-de-girofle'], 'cubes-bouillon.webp': ['bouillon-cube'],
    'curcuma.webp': ['curcuma'], 'djoumble.webp': ['gombo-seche-djoumble'], 'escargot-geant.webp': ['escargot-geant-achatine'],
    'farine-de-ble-1.webp': ['farine-de-ble'], 'farine-de-manioc-1.webp': ['farine-de-manioc'], 'graine-de-courge.webp': ['graine-de-courge-pistache'],
    'haricot-ou-pois-d-angole-1.webp': ['pois-d-angole'], 'huile-d-arachide.webp': ['huile-d-arachide'], 'huile-de-palme-rouge.webp': ['huile-de-palme-rouge'],
    'lapin.webp': ['lapin'], 'laurier.webp': ['feuille-de-laurier'], 'macabo.webp': ['macabo'], 'maïs.webp': ['mais-grain'], 'mangue.webp': ['mangue'],
    'manioc.webp': ['manioc'], 'miel.webp': ['miel'], 'niebe.webp': ['haricot-niebe'], 'noix-de-cajou.webp': ['noix-de-cajou'],
    'noix-de-coco.webp': ['noix-de-coco'], 'noix-de-cola.webp': ['noix-de-kola'], 'orange-ghana.webp': ['orange-du-ghana'],
    'oseille-de-guinee-1.webp': ['oseille-de-guinee'], 'pate-d-arachide.webp': ['pate-d-arachide'], 'poivre-de-guinee.webp': ['poivre-de-guinee-selim'],
    'poivre-noir.webp': ['poivre-noir'], 'porc-epic.webp': ['porc-epic'], 'riz.webp': ['riz-local'], 'sel.webp': ['sel'], 'sesame.webp': ['sesame'],
    'soja.webp': ['soja'], 'soumbala.webp': ['soumbara-nere-fermente'], 'tapioca.webp': ['tapioca'], 'taro.webp': ['taro'],
}
# nouveaux produits : fichier → (slug, nom, famille, alias)
NOUVEAUX = [
    ('farine-de-mais-1.webp', 'farine-de-mais', 'Farine de maïs', 'cereales-et-riz-local', ['maïs moulu', 'farine de maïs blanc']),
    ('semoule-1.webp', 'semoule-de-mais', 'Semoule de maïs', 'cereales-et-riz-local', ['semoule', 'couscous de maïs']),
    ('gari.webp', 'gari', 'Gari', 'tubercules-et-feculents', ['gari de manioc', 'gaari']),
    ('amidon-de-manioc-1.webp', 'amidon-de-manioc', 'Amidon de manioc', 'tubercules-et-feculents', ['amidon', 'fécule de manioc']),
    ('corossol.webp', 'corossol', 'Corossol', 'legumes-et-fruits', ['corossols']),
    ('goyave.webp', 'goyave', 'Goyave', 'legumes-et-fruits', ['goyaves']),
    ('mandarine.webp', 'mandarine', 'Mandarine', 'legumes-et-fruits', ['mandarines']),
    ('pamplemousse.webp', 'pamplemousse', 'Pamplemousse', 'legumes-et-fruits', ['pamplemousses']),
    ('melon.webp', 'melon', 'Melon', 'legumes-et-fruits', ['melons']),
    ('fruit-de-la-passion.webp', 'fruit-de-la-passion', 'Fruit de la passion', 'legumes-et-fruits', ['maracuja', 'grenadille']),
    ('pomme-de-cajou.webp', 'pomme-de-cajou', 'Pomme de cajou', 'legumes-et-fruits', ['pomme cajou']),
    # kplala : le fichier reçu (kplala.webp) était la photo des corossols ; pas d'image tant qu'une vraie photo de feuilles
    # de corète (kplala) n'est pas fournie. Le produit reste au catalogue (v2/data.js) avec l'illustration dessinée.
    ('gnangnan.webp', 'gnangnan', 'Gnangnan (aubergine amère)', 'legumes-et-fruits', ['gnagnan', 'aubergine amère']),
    ('feuilles-de-baobab-1.webp', 'feuilles-de-baobab', 'Feuilles de baobab', 'legumes-et-fruits', ['lalo', 'baobab']),
    ('cannelle.webp', 'cannelle', 'Cannelle', 'assaisonnements-epices-condiments', ['bâton de cannelle']),
    ('muscade.webp', 'muscade', 'Noix de muscade', 'assaisonnements-epices-condiments', ['muscade']),
    ('thym.webp', 'thym', 'Thym', 'assaisonnements-epices-condiments', ['thym séché']),
    ('tomate-sechee.webp', 'tomate-sechee', 'Tomate séchée', 'assaisonnements-epices-condiments', ['tomate sèche']),
    ('pate-de-tomate.webp', 'pate-de-tomate', 'Pâte de tomate', 'assaisonnements-epices-condiments', ['concentré de tomate', 'tomate en boîte']),
    ('huile-de-coco.webp', 'huile-de-coco', 'Huile de coco', 'arachide-noix-et-oleagineux', ['huile de coprah']),
    ('huile-de-palme-raffinee.webp', 'huile-de-palme-raffinee', 'Huile de palme raffinée', 'arachide-noix-et-oleagineux', ['huile raffinée', 'huile végétale']),
    ('pois-bambara.webp', 'pois-bambara', 'Pois de terre (voandzou)', 'arachide-noix-et-oleagineux', ['voandzou', 'pois bambara']),
    ('rat-de-gambie.webp', 'rat-de-gambie', 'Rat de Gambie', 'viande-de-brousse', ['cricétome']),
    ('boeuf.webp', 'viande-de-boeuf', 'Viande de bœuf', 'viandes-et-abats', ['bœuf', 'viande rouge', 'steak', 'boeuf']),
    ('mouton.webp', 'viande-de-mouton', 'Viande de mouton', 'viandes-et-abats', ['mouton']),
    ('chevre.webp', 'viande-de-chevre', 'Viande de chèvre', 'viandes-et-abats', ['chèvre', 'cabri']),
    ('porc.webp', 'viande-de-porc', 'Viande de porc', 'viandes-et-abats', ['porc', 'cochon']),
    ('abats.webp', 'abats', 'Abats', 'viandes-et-abats', ['tripes', 'foie', 'abats de bœuf']),
]
NOUVELLE_FAMILLE = {'slug': 'viandes-et-abats', 'name': 'Viandes et abats', 'icon': '🥩', 'order': 4.5}

def teinte(im):
    t = im.convert('RGBA').resize((96, 96)); n = 0; hx = hy = 0.0
    import math
    for r, g, b, a in list(t.getdata()):
        if a < 200: continue
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s < .15 or l < .12 or l > .9: continue
        hx += math.cos(h * 2 * math.pi) * s; hy += math.sin(h * 2 * math.pi) * s; n += 1
    if not n: return 45
    return round((math.degrees(math.atan2(hy, hx)) + 360) % 360)

def poser(src, slug):
    im = Image.open(os.path.join(SRC, FICHIERS[unicodedata.normalize('NFC', src)])).convert('RGBA')
    bb = im.getbbox() or (0, 0, im.width, im.height); im = im.crop(bb)
    im.thumbnail((740, 740), Image.LANCZOS)
    c = Image.new('RGBA', (800, 800), (0, 0, 0, 0)); c.alpha_composite(im, ((800 - im.width) // 2, 800 - 30 - im.height))   # posé en bas, comme les sacs existants
    out = os.path.join(rac, 'v2', 'img', 'produit-' + slug + '.webp'); c.save(out, 'WEBP', quality=80, method=6)
    return teinte(im), os.path.getsize(out)

sack, total = {}, 0
for src, slugs in EXISTANTS.items():
    for sl in slugs: h, z = poser(src, sl); sack[sl] = h; total += z
for src, sl, *_ in NOUVEAUX:
    h, z = poser(src, sl); sack[sl] = h; total += z

# catalogue
p = os.path.join(rac, 'v2', 'data.js'); s = open(p, encoding='utf-8').read()
cats = json.loads(re.search(r'MDG\.categories = (\[.*?\]);', s, re.S).group(1))
prods = json.loads(re.search(r'MDG\.products = (\[.*?\]);', s, re.S).group(1))
if not any(c['slug'] == NOUVELLE_FAMILLE['slug'] for c in cats): cats.append(NOUVELLE_FAMILLE)
cats.sort(key=lambda c: c['order'])
have = {x['slug'] for x in prods}
for _, sl, nom, fam, al in NOUVEAUX:
    if sl not in have: prods.append({'slug': sl, 'name': nom, 'categorySlug': fam, 'aliases': al})
s = re.sub(r'MDG\.categories = \[.*?\];', 'MDG.categories = ' + json.dumps(cats, ensure_ascii=False, separators=(',', ':')) + ';', s, count=1, flags=re.S)
s = re.sub(r'MDG\.products = \[.*?\];', 'MDG.products = ' + json.dumps(prods, ensure_ascii=False, separators=(',', ':')) + ';', s, count=1, flags=re.S)
open(p, 'w', encoding='utf-8').write(s)

# teintes des vignettes (A.SACK) et teinte de la nouvelle famille (A.FAMHUE)
p = os.path.join(rac, 'app', 'marche-app.js'); s = open(p, encoding='utf-8').read()
m = re.search(r"A\.SACK = \{(.*?)\};", s); cur = dict(re.findall(r"'?([\w-]+)'?: (\d+)", m.group(1)))
cur.update({k: str(v) for k, v in sack.items()})
s = s[:m.start()] + 'A.SACK = { ' + ', '.join(("'" + k + "'" if '-' in k else k) + ': ' + v for k, v in cur.items()) + ' };' + s[m.end():]
if "'viandes-et-abats'" not in s: s = s.replace("A.FAMHUE = { ", "A.FAMHUE = { 'viandes-et-abats': 15, ", 1)
open(p, 'w', encoding='utf-8').write(s)
print(len(sack), 'images', round(total / 1024), 'Ko au total ;', len(NOUVEAUX), 'nouveaux produits')
