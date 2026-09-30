#!/usr/bin/env python3
"""Germany / North Rhine-Westphalia: official Immobilienrichtwerte (IRW).

The Gutachterausschüsse (statutory valuation boards, § 192 BauGB) publish
each 1 January a zonal reference value in € per m² of living area for a
defined reference home (year built, living area, standard, plot size…),
derived from their register of ALL purchase contracts (Kaufpreissammlung).
Separate zones per submarket: flats (resale / new build), detached houses,
semi-detached and terraced houses, multi-family houses.
  BORIS-NRW open data (dl-de/zero-2-0):
    opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris/IRW/
Addresses: Geobasis NRW "Gebäudereferenzen" — every official house
coordinate in NRW (dl-de/zero-2-0):
    opengeodata.nrw.de/produkte/geobasis/lk/akt/gebref_txt/
Each address is assigned the zone it lies in, per submarket; the output
is one gzip file per municipality (lib/data/germany/nrw/<AGS>.json.gz).
Re-run each spring (new IRW year) and when the address file is refreshed:
  pip install pyshp shapely && python3 scripts/build-de-nrw-irw.py
"""
import collections, gzip, io, json, os, re, sys, urllib.request, zipfile
import numpy as np, shapefile, shapely
from shapely.geometry import shape

IRW_URL = "https://www.opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris/IRW/IRW_EPSG25832_Shape.zip"
GEBREF_URL = "https://www.opengeodata.nrw.de/produkte/geobasis/lk/akt/gebref_txt/gebref_EPSG25832_ASCII.zip"
WORK = sys.argv[1] if len(sys.argv) > 1 else "/tmp/nrw-build"
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "germany", "nrw")
os.makedirs(WORK, exist_ok=True); os.makedirs(DST, exist_ok=True)

def fetch(url, name):
    p = os.path.join(WORK, name)
    if not os.path.exists(p):
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=900) as r, open(p, "wb") as f:
            f.write(r.read())
    return zipfile.ZipFile(p)

# ---- zones ---------------------------------------------------------------
z = fetch(IRW_URL, "irw.zip")
base = next(n for n in z.namelist() if n.endswith(".shp"))[:-4]
sf = shapefile.Reader(shp=io.BytesIO(z.read(base + ".shp")), dbf=io.BytesIO(z.read(base + ".dbf")), shx=io.BytesIO(z.read(base + ".shx")), encoding="utf-8")
KEEP = ["TEILMA", "OBJGR", "IMRW", "STAG", "BJ", "WHNFL", "FLAE", "GSTAND", "AKL", "MTYP", "MGRAD", "MIETS", "GART", "EGART",
        "WHNLA", "WOLAKL", "KELLER", "GESLA", "BK", "RANZ", "ANZEGEB", "WHNA", "GARSTP", "ORTST", "NAME_IRW", "GEBIET", "WNUM", "GABE", "UDOK_URL"]
# slot = submarket: 0 flats (resale), 1 detached, 2 semi/terraced, 3 multi-family, 4 flats (first sale, new build)
def slot(r):
    t, o = r["TEILMA"], r["OBJGR"]
    if t == "1": return 4 if o == "1" else 0     # flats: resale (3) / conversion (2,4) → 0; first sale of a new build → 4
    return {"2": 1, "3": 2, "4": 3}.get(t)       # detached, semi/terraced, multi-family (5 mixed-use: not used)
zones, geoms, slots, gmd_of = [], [], [], []
for sr in sf.iterShapeRecords():
    r = sr.record.as_dict(); s = slot(r)
    if s is None or not r["IMRW"] or int(r["IMRW"]) <= 0: continue
    g = shape(sr.shape.__geo_interface__)
    if not g.is_valid: g = g.buffer(0)
    zones.append({k: r[k].strip() for k in KEEP if str(r.get(k, "")).strip()}); geoms.append(g); slots.append(s); gmd_of.append(r["GESL"])
stag = zones[0]["STAG"]
print(len(zones), "zones, reference date", stag)

# ---- addresses -----------------------------------------------------------
g = fetch(GEBREF_URL, "gebref.zip")
txt = next(n for n in g.namelist() if n.endswith("gebref.txt"))
rows = []
with g.open(txt) as f:
    for line in io.TextIOWrapper(f, encoding="utf-8"):
        c = line.rstrip("\n").split(";")
        if len(c) < 20 or not c[15]: continue
        rows.append((c[3] + c[5] + c[7] + c[9], c[10], c[14].strip(), c[15].strip(), c[16].strip().lower(), float(c[18]), float(c[19])))
print(len(rows), "addresses")
pts = shapely.points(np.array([[r[5], r[6]] for r in rows]))
# an address can lie in several zones of one submarket: some boards publish
# one zone per house form (semi-detached / mid-terrace / end-terrace) or per
# building age over the same area → all are kept, the API decides
assign = [[[] for _ in range(5)] for _ in rows]
multi = collections.Counter()
for s in range(5):
    idx = [i for i, x in enumerate(slots) if x == s]
    tree = shapely.STRtree([geoms[i] for i in idx])
    a, b = tree.query(pts, predicate="within")
    for pi, zi in zip(a, b):
        if assign[pi][s]: multi[s] += 1
        assign[pi][s].append(idx[zi])
print("addresses with several zones per submarket:", dict(multi))

# ---- per municipality ------------------------------------------------------
def key(street):  # "Ückendorfer Str." / "Ueckendorfer Straße" → "ueckendorferstr"
    s = street.lower().replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    s = re.sub(r"stra?sse\b|str\b\.?", "str", s)
    return re.sub(r"[^a-z0-9]", "", s)

by = collections.defaultdict(list)
for i, r in enumerate(rows): by[r[0]].append(i)
index, total = {}, 0
for gmd, ids in by.items():
    local, combos, cidx, streets = {}, [], {}, {}
    for i in ids:
        zs = tuple(tuple(sorted(local.setdefault(v, len(local)) for v in vs)) for vs in assign[i])
        if not any(zs): ci = -1          # in the register, but in no zone
        else:
            ci = cidx.setdefault(zs, len(combos))
            if ci == len(combos): combos.append([list(v) for v in zs])
        r = rows[i]; st = streets.setdefault(key(r[2]), {"name": r[2], "n": {}})
        st["n"].setdefault(r[3] + r[4], ci)
    if not combos: continue
    zl = [None] * len(local)
    for gi, li in local.items(): zl[li] = zones[gi]
    out = {"ags": gmd, "name": rows[ids[0]][1], "stag": stag, "zones": zl, "combos": combos, "streets": streets}
    data = gzip.compress(json.dumps(out, ensure_ascii=False, separators=(",", ":")).encode(), 9)
    open(os.path.join(DST, gmd + ".json.gz"), "wb").write(data); total += len(data)
    index[rows[ids[0]][1]] = gmd
json.dump({"stag": stag, "municipalities": index}, open(os.path.join(DST, "index.json"), "w"), ensure_ascii=False, separators=(",", ":"))
assert "Köln" in index and "Düsseldorf" in index, "format changed"
print(len(index), "municipalities,", round(total / 1e6, 1), "MB")
