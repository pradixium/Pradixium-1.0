#!/usr/bin/env python3
"""Italy: OMI zone perimeters of the big / international-buyer
municipalities, from the Agenzia delle Entrate's own public OMI map service
(zoneomi.php richiesta=6 — the request its map makes; CC BY 4.0, «Agenzia
delle Entrate – OMI») → lib/data/italyOmiZones/<codcom>.json.gz
(coordinates rounded to 1e-5° ≈ 1 m). Used by lib/italy/omi.js to put a
geocoded address into its OMI zone; other municipalities are read live.
Re-run each half-year when the agency publishes a new semester:
  python3 scripts/build-it-omi-zones.py
"""
import gzip, json, os, time, urllib.request
B = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/zoneomi.php"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda q, t=120: json.loads(urllib.request.urlopen(urllib.request.Request(f"{B}?{q}", headers=UA), timeout=t).read())
CITIES = ["ROMA", "MILANO", "NAPOLI", "TORINO", "PALERMO", "GENOVA", "BOLOGNA", "FIRENZE", "BARI", "CATANIA", "VENEZIA",
          "VERONA", "MESSINA", "PADOVA", "TRIESTE", "BRESCIA", "PARMA", "TARANTO", "PRATO", "MODENA", "REGGIO DI CALABRIA",
          "REGGIO NELL'EMILIA", "PERUGIA", "RAVENNA", "LIVORNO", "CAGLIARI", "FOGGIA", "RIMINI", "SALERNO", "FERRARA",
          "SASSARI", "LATINA", "MONZA", "SIRACUSA", "PESCARA", "BERGAMO", "TRENTO", "VICENZA", "BOLZANO", "NOVARA",
          "PIACENZA", "ANCONA", "LUCCA", "PISA", "COMO", "UDINE", "LECCE", "SANREMO", "SIENA", "BERGAMO"]
here = os.path.dirname(__file__)
comuni = json.load(open(os.path.join(here, "..", "lib", "data", "italyComuni.json")))["comuni"]
sem = get("richiesta=5")[0]["SEMESTRE"]
out_dir = os.path.join(here, "..", "lib", "data", "italyOmiZones")
r = lambda c: [round(c[0], 5), round(c[1], 5)]
for name in dict.fromkeys(CITIES):
    m = [c for c in comuni if c[0] == name]
    if len(m) != 1:
        print("not found / ambiguous:", name, len(m)); continue
    codcom = m[0][1]
    d = get(f"richiesta=6&codcom={codcom}&semestre={sem}")
    feats = d.get("dat", {}).get("features", []) if isinstance(d, dict) else []
    zones = []
    for f in feats:
        g = f["geometry"]
        polys = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"] if g["type"] == "MultiPolygon" else []
        zones.append({"zona": f["properties"]["zona"], "polys": [[[r(c) for c in ring] for ring in poly] for poly in polys]})
    if not zones:
        print("no zones:", name); continue
    doc = {"comune": name, "codcom": codcom, "semestre": sem, "built": time.strftime("%Y-%m-%d"), "zones": zones}
    with gzip.open(os.path.join(out_dir, f"{codcom}.json.gz"), "wt", encoding="utf8") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    print(name, codcom, len(zones), "zones")
    time.sleep(0.3)
