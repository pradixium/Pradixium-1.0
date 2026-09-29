#!/usr/bin/env python3
"""Austria: Statistik Austria "Immobilien-Durchschnittspreise" — median
price per m² of living area for houses and for flats bought by private
households, per political district (Vienna: per Bezirk), from the
Grundbuch deed collection. Read from Statistik Austria's own STATatlas
GeoServer (the map "them_v_immopreise"), plus the official municipality
list (Gemeindeverzeichnis) to map a town / postcode to its district.
Re-run each spring when the new year is published (update YEAR/DDT from
GET_ATLAS_MAP_PG if the view name changes):
  python3 scripts/build-at-prices.py
"""
import csv, io, json, os, time, urllib.parse, urllib.request
GS = "https://www.statistik.at/gs-atlas/ATLAS_IMAP_WFS/ows?service=WFS&version=1.0.0&request=GetFeature&outputFormat=application%2Fjson"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
cfg = json.loads(get(GS + "&typeName=ATLAS_IMAP_WFS:GET_ATLAS_MAP_PG&viewparams=map_id:them_v_immopreise"))
layers = {}
for f in cfg["features"]:
    p = f["properties"]; w = json.loads(p["wms_params"])
    if w.get("V1") in ("haeuserpreise_d", "wohnungspreise_d") and "POLBEZ" in p["wfs_layername"]:
        layers[w["V1"]] = (p["wfs_layername"], w)
districts = {}
year = None
for key, (layer, w) in layers.items():
    year = w["YEAR"][:4]
    vp = ";".join(f"{k}:{v}" for k, v in w.items())
    d = json.loads(get(GS + f"&typeName={layer}&viewparams=" + urllib.parse.quote(vp)))
    for f in d["features"]:
        p = f["properties"]
        e = districts.setdefault(p["ID"], {"name": " ".join(p["NAME"].split())})
        e["flats" if key == "wohnungspreise_d" else "houses"] = p["V1"] if (p["V1"] or 0) > 0 else None
raw = get("https://www.statistik.at/verzeichnis/reglisten/gemliste_knz.csv").decode("utf-8", "replace")
gem = []
for r in csv.reader(io.StringIO(raw), delimiter=";"):
    if len(r) >= 5 and r[0].isdigit():
        plz = [x for x in ([r[4]] + r[5].split()) if x.strip().isdigit()] if len(r) > 5 else [r[4]]
        gem.append([r[1], r[0], sorted(set(plz))])
doc = {"source": "Statistik Austria — Immobilien-Durchschnittspreise (Grundbuch deeds, private buyers)", "sourceUrl": "https://www.statistik.at/statistiken/volkswirtschaft-und-oeffentliche-finanzen/preise-und-preisindizes/immobilien-durchschnittspreise",
       "year": year, "unit": "EUR per m² of living area (median)", "built": time.strftime("%Y-%m-%d"), "districts": districts, "gemeinden": gem}
path = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "austriaPrices.json")
json.dump(doc, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(districts), "districts,", len(gem), "municipalities, year", year, "->", path)
