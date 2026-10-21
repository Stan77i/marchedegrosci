"""Images des poissons, fruits de mer, volailles et œufs (lot du 21/10/2026) : fichier → produit existant.

Usage : python3 tools/images/poissons-volailles.py <dossier des images sources>
Même mise en forme que tools/images/produits.py : carré transparent 800 × 800, image posée en bas, WebP qualité 80,
teinte de vignette calculée (A.SACK dans app/marche-app.js). Aucun produit n'est ajouté au catalogue.
Les correspondances ont été faites en regardant chaque photo (les noms de fichiers sont en anglais et parfois vagues).
Photos non utilisées (pas de produit au catalogue, ou doublons) : carpe, crabes, machoiron de mer, deuxième capitaine,
daurade, sole, langoustes, peau de bœuf, tripes, deux autres caisses de crevettes, silure fumé.
"""
import os, sys, re, math, colorsys
from PIL import Image

ici = os.path.dirname(os.path.abspath(__file__)); rac = os.path.dirname(os.path.dirname(ici))
SRC = sys.argv[1]

IMAGES = {
    'Gray_plastic_crate_with_tilapia_2K_20261021171822.webp': 'tilapia-frais',
    'Gray_crate_filled_with_fish_2K_20261021171935.webp': 'capitaine',          # poissons allongés, dos verdâtre
    'Catfish_in_gray_plastic_crate_2K_20261021172035.webp': 'silure',
    'Market_basket_filled_with_fish_2K_20261021173415.webp': 'poisson-fume',     # panier de poissons fumés dorés
    'Woven_basket_filled_with_fish_2K_20261021173242.webp': 'poisson-seche',     # poissons séchés, plus sombres
    'Gray_crate_filled_with_sardines_2K_20261021172404.webp': 'sardine-fraiche',
    'Mackerel_in_plastic_crate_2K_20261021172532.webp': 'maquereau',
    'Fish_crate_with_mackerel_2K_20261021172618.webp': 'chinchard',              # le plus proche : « maquereau » de même allure
    'Tuna_in_gray_plastic_crate_2K_20261021172303.webp': 'thon-frais',
    'Gray_plastic_crate_filled_with_2K_20261021172706.webp': 'bar-loup-de-mer',  # bars
    'Raw_shrimp_in_gray_crate_2K_20261021172940.webp': 'crevette',
    'Raw_chickens_in_plastic_tray_2K_20261021170929.webp': 'poulet-de-chair',    # poulets blancs d'élevage
    'Raw_chickens_on_tray_2K_20261021170949.webp': 'poulet-fermier',             # poulets jaunes, plus petits
    'Raw_guinea_fowl_on_tray_2K_20261021171038.webp': 'pintade',
    'Raw_ducks_on_tray_2K_20261021171607.webp': 'canard',
    'Raw_turkey_on_tray_2K_20261021171144.webp': 'dinde',
    'Woven_basket_filled_with_eggs_2K_20261021171613.webp': 'oeufs-de-poule-alveole-de-30',
    'Woven_basket_filled_with_eggs_2K_20261021171728.webp': 'oeufs-de-pintade',  # œufs mouchetés
    'Woven_basket_filled_with_quail_2K_20261021171652.webp': 'oeufs-de-caille',
}

def teinte(im):
    t = im.convert('RGBA').resize((96, 96)); n = 0; hx = hy = 0.0
    for r, g, b, a in list(t.get_flattened_data() if hasattr(t, "get_flattened_data") else t.getdata()):
        if a < 200: continue
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if s < .15 or l < .12 or l > .9: continue
        hx += math.cos(h * 2 * math.pi) * s; hy += math.sin(h * 2 * math.pi) * s; n += 1
    if not n: return 45
    return round((math.degrees(math.atan2(hy, hx)) + 360) % 360)

def poser(src, slug):
    im = Image.open(os.path.join(SRC, src)).convert('RGBA')
    bb = im.getchannel('A').getbbox() or (0, 0, im.width, im.height); im = im.crop(bb)
    im.thumbnail((740, 740), Image.LANCZOS)
    c = Image.new('RGBA', (800, 800), (0, 0, 0, 0)); c.alpha_composite(im, ((800 - im.width) // 2, 800 - 30 - im.height))   # posé en bas
    out = os.path.join(rac, 'v2', 'img', 'produit-' + slug + '.webp'); c.save(out, 'WEBP', quality=80, method=6)
    return teinte(im), os.path.getsize(out)

# tous les produits visés existent déjà au catalogue
cat = open(os.path.join(rac, 'v2', 'data.js'), encoding='utf-8').read()
manque = [sl for sl in IMAGES.values() if '"slug":"' + sl + '"' not in cat]
if manque: sys.exit('Produits absents du catalogue : ' + ', '.join(manque))

sack, total = {}, 0
for src, sl in IMAGES.items():
    h, z = poser(src, sl); sack[sl] = h; total += z
    print(f'{sl:32} teinte {h:3}  {z // 1024} Ko')
print(f'{len(IMAGES)} images, {total // 1024} Ko au total')

p = os.path.join(rac, 'app', 'marche-app.js'); s = open(p, encoding='utf-8').read()
m = re.search(r"A\.SACK = \{(.*?)\};", s); cur = dict(re.findall(r"'?([\w-]+)'?: (\d+)", m.group(1)))
cur.update({k: str(v) for k, v in sack.items()})
s = s[:m.start()] + 'A.SACK = { ' + ', '.join(("'" + k + "'" if '-' in k else k) + ': ' + v for k, v in cur.items()) + ' };' + s[m.end():]
open(p, 'w', encoding='utf-8').write(s)
