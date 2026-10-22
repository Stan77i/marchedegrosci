"""Images des surgelés et produits de rente (lot du 22/10/2026) : fichier → produit existant.

Usage : python3 tools/images/surgeles-rente.py <dossier des images sources>
Même mise en forme que tools/images/poissons-volailles.py.
Les 8 derniers produits (crevettes séchées … foie de bœuf surgelé) ont été ajoutés au catalogue (v2/data.js) à la demande du propriétaire.
Photos non utilisées : 2e anchois et 2e saucisses (doublons), cajou brut et panier de poissons (noix-de-cajou et poisson-seche ont déjà leur photo).
"""
import os, sys, re, math, colorsys
from PIL import Image

ici = os.path.dirname(os.path.abspath(__file__)); rac = os.path.dirname(os.path.dirname(ici))
SRC = sys.argv[1]

IMAGES = {
    'Woven_sack_filled_cocoa_beans_2K_20261022180601.webp': 'cacao-en-feves',
    'Woven_sack_filled_green_coffee_2K_20261022180942.webp': 'cafe-en-grains',
    'Woven_market_sack_with_shea_2K_20261022181157.webp': 'noix-de-karite',
    'Market_sack_filled_with_palm_2K_20261022181251.webp': 'noix-de-palme',
    'Box_containing_frozen_fish_2K_20261022180036.webp': 'poisson-surgele',
    'Frozen_beef_cuts_in_box_2K_20261022180446.webp': 'viande-de-boeuf-surgelee',
    'Frozen_chicken_box_in_wholesale_2K_20261022175709.webp': 'poulet-surgele',   # hauts de cuisse
    'Basket_filled_with_dried_shrimp_2K_20261022175637.webp': 'crevettes-sechees',
    'Market_basket_filled_with_anchovies_2K_20261022175525.webp': 'anchois-seches',
    'Frozen_mackerel_in_cardboard_box_2K_20261022180222.webp': 'maquereau-surgele',
    'Open_frozen_turkey_cardboard_box_2K_20261022175923.webp': 'cuisses-de-dinde-surgelees',
    'Frozen_chicken_box_isolated_2K_20261022175813.webp': 'dos-de-poulet-surgele',  # carton « dos de poulet surgelés »
    'Frozen_sausages_in_cardboard_box_2K_20261022180359.webp': 'saucisses-surgelees',
    'Frozen_beef_tripe_box_2K_20261022181620.webp': 'tripes-de-boeuf-surgelees',
    'Open_cardboard_box_with_frozen_2K_20261022180316.webp': 'foie-de-boeuf-surgele',  # foie, rouge sombre
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
