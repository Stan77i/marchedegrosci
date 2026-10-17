#!/usr/bin/env python3
"""Marché de Gros CI — construit la carte embarquée de Côte d'Ivoire (app/geo/ci.json), lisible sans connexion.

Sources libres (ne_10m_coastline.geojson en plus des fichiers ci-dessous) :
  - Natural Earth 1:10m (domaine public) : pays, zones urbaines, lacs, fleuves, routes, voies ferrées, villes principales
    https://github.com/nvkelso/natural-earth-vector (dossier geojson/)
  - GeoNames via lutangar/cities.json (CC BY 4.0) : 3 775 localités de Côte d'Ivoire avec leurs coordonnées
    https://github.com/lutangar/cities.json
Usage : python3 tools/carte/build.py DOSSIER_DES_SOURCES  (les fichiers .geojson et cities.json téléchargés)
Sortie : app/geo/ci.json, une collection GeoJSON compacte ; chaque objet porte k (sorte) et quelques propriétés courtes.
"""
import json, math, os, re, sys, unicodedata

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BBOX = (-9.2, 3.6, -1.9, 11.3)          # Côte d'Ivoire et ses abords (lon min, lat min, lon max, lat max)
VOISINS = {'LBR', 'GIN', 'MLI', 'BFA', 'GHA'}

def charge(n): return json.load(open(os.path.join(SRC, n), encoding='utf-8'))
def dans(p): return BBOX[0] <= p[0] <= BBOX[2] and BBOX[1] <= p[1] <= BBOX[3]
def arr(p, d): return [round(p[0], d), round(p[1], d)]

def dp(pts, tol):
    """Douglas-Peucker : garde la forme, retire les points inutiles."""
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-12
    i, dm = 0, -1
    for j in range(1, len(pts) - 1):
        d = abs(dy * pts[j][0] - dx * pts[j][1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > dm: i, dm = j, d
    if dm > tol: return dp(pts[:i + 1], tol)[:-1] + dp(pts[i:], tol)
    return [a, b]

def dp_anneau(r, tol):
    """Anneau fermé : on le coupe en deux moitiés (le premier et le dernier point sont identiques)."""
    if len(r) < 8: return r
    m = len(r) // 2
    return dp(r[:m + 1], tol)[:-1] + dp(r[m:], tol)

def lignes(g):
    if g['type'] == 'LineString': return [g['coordinates']]
    if g['type'] == 'MultiLineString': return g['coordinates']
    return []
def polys(g):
    if g['type'] == 'Polygon': return [g['coordinates']]
    if g['type'] == 'MultiPolygon': return g['coordinates']
    return []

def ligne_feat(k, coords_list, tol, d, props):
    out = []
    for c in coords_list:
        if not any(dans(p) for p in c): continue
        s = [arr(p, d) for p in dp(c, tol)]
        if len(s) >= 2: out.append(s)
    if not out: return None
    return {'type': 'Feature', 'properties': dict(k=k, **props), 'geometry': {'type': 'MultiLineString', 'coordinates': out}}

def poly_feat(k, poly_list, tol, d, props, garde_tout=False):
    out = []
    for poly in poly_list:
        if not garde_tout and not any(dans(p) for p in poly[0]): continue
        rings = []
        for r in poly:
            s = [arr(p, d) for p in dp_anneau(r, tol)]
            if len(s) >= 4: rings.append(s)
        if rings: out.append(rings)
    if not out: return None
    return {'type': 'Feature', 'properties': dict(k=k, **props), 'geometry': {'type': 'MultiPolygon', 'coordinates': out}}

F = []
# 1) la mer (k=mer) : le trait de côte, fermé vers le sud ; les terres voisines sont le fond de carte (aucune frontière tracée)
cote = []
for f in charge('ne_10m_coastline.geojson')['features']:
    g = f['geometry']
    for l in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates']):
        cur = []
        for p in l:
            if BBOX[0] - .5 <= p[0] <= BBOX[2] + .5 and BBOX[1] - .5 <= p[1] <= BBOX[3] + .5: cur.append(p)
            elif cur: cote.append(cur); cur = []
        if cur: cote.append(cur)
cote = max(cote, key=len)
if cote[0][0] > cote[-1][0]: cote = cote[::-1]
anneau = [arr(p, 3) for p in dp(cote, .002)] + [[round(cote[-1][0], 3), -2.0], [round(cote[0][0], 3), -2.0]]
anneau.append(anneau[0])
F.append({'type': 'Feature', 'properties': {'k': 'mer'}, 'geometry': {'type': 'Polygon', 'coordinates': [anneau]}})
# 2) la Côte d'Ivoire (k=civ)
for f in charge('ne_10m_admin_0_countries.geojson')['features']:
    if f['properties'].get('ADM0_A3') == 'CIV':
        x = poly_feat('civ', polys(f['geometry']), .004, 3, {}, True)
        if x: F.append(x)
# 2) zones urbaines (empreinte des villes)
for f in charge('ne_10m_urban_areas.geojson')['features']:
    x = poly_feat('ville', polys(f['geometry']), .002, 3, {})
    if x: F.append(x)
# 3) lacs et lagunes, fleuves
for f in charge('ne_10m_lakes.geojson')['features']:
    x = poly_feat('lac', polys(f['geometry']), .002, 3, {'n': f['properties'].get('name') or ''})
    if x: F.append(x)
for f in charge('ne_10m_rivers_lake_centerlines.geojson')['features']:
    x = ligne_feat('fleuve', lignes(f['geometry']), .003, 3, {'n': f['properties'].get('name') or '', 'r': f['properties'].get('scalerank', 9)})
    if x: F.append(x)
# 4) routes (r = importance : 1 grandes routes … 3 petites) et voies ferrées
for f in charge('ne_10m_roads.geojson')['features']:
    p = f['properties']; t = p.get('type') or ''
    if t not in ('Major Highway', 'Secondary Highway', 'Road'): continue
    r = 1 if t == 'Major Highway' else 2 if t == 'Secondary Highway' else 3
    x = ligne_feat('route', lignes(f['geometry']), .002, 3, {'r': r, 'n': (p.get('label') or '').strip()})
    if x: F.append(x)
for f in charge('ne_10m_railroads.geojson')['features']:
    x = ligne_feat('rail', lignes(f['geometry']), .002, 3, {})
    if x: F.append(x)
# 5) localités : r=1 grandes villes, 2 villes, 3 villes de l'application, 4 villages
cle = lambda s: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', s.replace('’', "'")).encode('ascii', 'ignore').decode().lower())
ne = {}
for f in charge('ne_10m_populated_places_simple.geojson')['features']:
    p = f['properties']
    if p.get('adm0_a3') == 'CIV': ne[cle(p['name'])] = (p['name'], f['geometry']['coordinates'], 1 if p.get('scalerank', 9) <= 4 else 2)
src = open(os.path.join(ROOT, 'app', 'villes.js'), encoding='utf-8').read()
bloc = src.split('const V = {')[1].split('};')[0]
app = set()
for m in re.finditer(r"\[([^\]]*)\]", bloc):
    for n in re.findall(r"'([^']+)'", m.group(1)): app.add(cle(n))
# communes d'Abidjan et lieux absents de GeoNames : coordonnées approchées (centre de la commune)
AJOUTS = {'Attécoubé': (-4.040, 5.335), 'Cocody': (-3.975, 5.360), 'Plateau': (-4.020, 5.320), 'Port-Bouët': (-3.930, 5.255),
          'Treichville': (-4.005, 5.293), 'Yopougon': (-4.080, 5.345), 'Grand-Béréby': (-6.920, 4.650)}
vus = {}
for c in charge('cities.json'):
    if c.get('country') != 'CI': continue
    k = cle(c['name'])
    if k in vus: continue
    vus[k] = (c['name'], [float(c['lng']), float(c['lat'])])
for n, (lo, la) in AJOUTS.items(): vus.setdefault(cle(n), (n, [lo, la]))
for k, (n, xy, _r) in ne.items(): vus[k] = (n, xy)
for k, (n, xy) in vus.items():
    r = ne[k][2] if k in ne else 3 if k in app else 4
    F.append({'type': 'Feature', 'properties': {'k': 'lieu', 'n': n, 'r': r}, 'geometry': {'type': 'Point', 'coordinates': arr(xy, 4)}})

out = {'type': 'FeatureCollection', 'attribution': 'Natural Earth (domaine public) · GeoNames (CC BY 4.0)', 'features': F}
dst = os.path.join(ROOT, 'app', 'geo', 'ci.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(dst, round(os.path.getsize(dst) / 1024), 'Ko', dict(Counter(f['properties']['k'] for f in F)))
