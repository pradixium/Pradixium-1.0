#!/usr/bin/env python3
"""Spain: pre-built Catastro value-zone files for large municipalities.

The Catastro's value-map service (Sede Electrónica, SECDameGeoJSON.aspx —
the same one its own map viewer loads) returns a WHOLE municipality per
request: Madrid is 8 MB / ~10 s, too slow for a live report. This script
stores, per municipality, the residential zones (polygon, rounded to 5
decimals ≈ 1 m) and each zone's representative products with their average
value modules, in lib/data/spainZones/<INE muniCode>.json.gz. Small towns
are still queried live (lib/spain/catastroZone.js).

Municipality list: MIVAU "Valor tasado de vivienda libre de los municipios
mayores de 25.000 habitantes" (apps.fomento.gob.es, table 35103500) + any
names given on the command line. Coordinates: CartoCiudad (IGN).
Re-run each autumn when the Catastro publishes the next year's map:
  python3 scripts/build-es-zones.py            # missing municipalities only
  python3 scripts/build-es-zones.py --force
"""
import gzip, io, json, math, os, sys, time, urllib.parse, urllib.request, datetime
OUT = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "spainZones")
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
def get(url, t=120):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=t).read()
def cands(q, limit=20):
    t = get("https://www.cartociudad.es/geocoder/api/geocoder/candidatesJsonp?q=" + urllib.parse.quote(q) + f"&limit={limit}", 30).decode("utf-8", "replace")
    return json.loads(t[t.index("(") + 1:t.rindex(")")])
def muni_list():
    import xlrd
    b = xlrd.open_workbook(file_contents=get("https://apps.fomento.gob.es/boletinonline2/sedal/35103500.XLS"))
    sh = b.sheets()[-1]; out = []; prov = None
    for i in range(17, sh.nrows):
        r = sh.row_values(i)
        if str(r[1]).strip(): prov = str(r[1]).strip()
        m = str(r[2]).strip()
        if m and prov: out.append((m, prov))
    return out
def compact(features):
    zones = []
    for f in features:
        p = f["properties"]; g = f["geometry"]
        rnd = lambda ring: [[round(x, 5), round(y, 5)] for x, y in ring]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        prods = []
        for k in sorted(k for k in p if k.startswith("Ptipo")):
            t = p[k]
            if t and (t.get("val_tipo") or 0) > 0:
                prods.append({k2: t.get(k2) for k2 in ("tipologia", "categoria", "antiguedad", "conservacion", "superficie", "superficie_suelo", "val_tipo", "val_tipo_m2", "val_tipo_mostrar")})
        zones.append({"zona_valor": p.get("zona_valor"), "cod_zona": p.get("cod_zona"), "ejercicio": p.get("ejercicio"), "num_inmuebles_uso_v": p.get("num_inmuebles_uso_v"),
                      "polys": [[rnd(r) for r in poly] for poly in polys], "products": prods})
    return zones
ALIASES = {"palma de mallorca": "Palma", "santa eulalia del rio": "Santa Eulària des Riu", "velez malaga": "Vélez-Málaga",
           "san antonio abad": "Sant Antoni de Portmany", "san jose": "Sant Josep de sa Talaia", "mahon": "Maó",
           "ciudadela": "Ciutadella de Menorca", "alicante": "Alacant", "elche": "Elx", "castellon de la plana": "Castelló de la Plana",
           "villajoyosa": "la Vila Joiosa", "javea": "Xàbia", "calpe": "Calp", "denia": "Dénia", "gerona": "Girona", "lerida": "Lleida", "santa cruz detenerife": "Santa Cruz de Tenerife"}
import unicodedata, re
def nrm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"\(([^)]*)\)", r" \1 ", s)        # "Ejido (El)" -> "ejido el"
    return " ".join(w for w in re.split(r"[^a-z0-9]+", s) if w and w not in ("de", "del", "la", "el", "las", "los", "les", "l", "d", "sa", "es", "ses"))
def same(a, b):
    a, b = set(nrm(a).split()), set(nrm(b).split())
    return bool(a) and (a == b or a <= b or b <= a)
def resolve(name, prov):
    want = {nrm(k): v for k, v in ALIASES.items()}.get(nrm(name))
    names = [want] if want else []
    names += [name, re.sub(r"^(.*) \((.*)\)$", r"\2 \1", name)]
    for q in names:
        for c in cands(q, 30):
            if c.get("type") != "Municipio": continue
            if not any(same(p, prov) for p in re.split(r"[/]", c.get("province") or "")) and prov: continue
            if any(same(m, q) for m in re.split(r"[/]", c["muni"])): return c
    return None
def inside_or_near(lon, lat, zones, m=300):
    def inring(x, y, r):
        c = False
        for i in range(len(r)):
            x1, y1 = r[i - 1]; x2, y2 = r[i]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
        return c
    for z in zones:
        for poly in z["polys"]:
            if inring(lon, lat, poly[0]): return True
            for x, y in poly[0][::3]:
                if ((x - lon) * 111000 * math.cos(math.radians(lat))) ** 2 + ((y - lat) * 111000) ** 2 < m * m: return True
    return False
def located_points(c):
    pts = []
    for q in (c["muni"], c["muni"] + " calle", c["muni"] + " avenida", c["muni"] + " plaza"):
        for k in cands(q, 30):
            if k.get("muniCode") == c["muniCode"] and abs(k.get("lat") or 0) > 1 and (k["lat"], k["lng"]) not in [(p["lat"], p["lng"]) for p in pts]:
                pts.append(k)
    pts.sort(key=lambda k: {"poblacion": 0, "callejero": 1, "portal": 2}.get(k.get("type"), 3))
    return pts
def validate(zones, pts, used):
    others = [p for p in pts if p is not used][:6]
    ok = sum(1 for p in others if inside_or_near(p["lng"], p["lat"], zones))
    return others and ok >= max(1, (len(others) + 1) // 2), ok, len(others)

def main():
    force = "--force" in sys.argv
    extra = [a for a in sys.argv[1:] if not a.startswith("--")]
    os.makedirs(OUT, exist_ok=True)
    # extra names: "Name" or "Name|Province" (the MIVAU sheet has a few
    # misspelt names/provinces: "Santa Cruz deTenerife", "Valladodid")
    todo = [tuple((e.split("|") + [""])[:2]) for e in extra] if os.environ.get("ONLY_EXTRA") else muni_list() + [tuple((e.split("|") + [""])[:2]) for e in extra]
    if os.environ.get("REVERSE"): todo = todo[::-1]
    y0 = datetime.date.today().year
    for name, prov in todo:
        try:
            c = resolve(name, prov)
            if not c: print("?? no municipality", name, prov, flush=True); continue
            path = os.path.join(OUT, f"{c['muniCode']}.json.gz")
            if os.path.exists(path) and not force: continue
            # a "Municipio" candidate carries lat/lng 0,0 — use located
            # candidates of the same municipality; the stored map must
            # contain most of the OTHER located points (else it is another
            # municipality's map)
            pts = located_points(c)
            if len(pts) < 2: print("?? too few located points", name, flush=True); continue
            done = None
            for used in pts[:4]:  # a point can return a neighbour's map: try another one
                lat, lon = used["lat"], used["lng"]
                x = lon * 20037508.34 / 180; y = math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180) * 20037508.34 / 180
                fs = []
                for year in (y0 + 1, y0):
                    t0 = time.time()
                    raw = get(f"https://www1.sedecatastro.gob.es/Cartografia/SECDameGeoJSON.aspx?del=0&mun=0&huso=3857&x={x:.1f}&y={y:.1f}&suelo=N&tipo_mapa=vivienda&anyoZV={year}", 180)
                    fs = json.loads(raw).get("features") or []
                    if fs: break
                if not fs: continue
                zones = compact(fs)
                good, hits, n = validate(zones, pts, used)
                if good: done = (zones, year, raw, t0, fs); break
                print(f"   retry {name}: {hits}/{n} other points inside", flush=True)
            if not done: print(f"XX no validated map {name} {c['muniCode']}", flush=True); continue
            zones, year, raw, t0, fs = done
            doc = {"muni": c["muni"], "muniCode": c["muniCode"], "province": c.get("province"), "mapYear": year, "built": datetime.date.today().isoformat(), "zones": zones}
            with gzip.open(path, "wt", encoding="utf-8") as fh: json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)
            print(f"ok {name:30} {c['muniCode']} map {year} {len(fs):4} zones raw {len(raw)//1024:6} KB {time.time()-t0:5.1f}s -> {os.path.getsize(path)//1024} KB", flush=True)
        except Exception as e:
            print("!! ", name, e, flush=True)
main()
