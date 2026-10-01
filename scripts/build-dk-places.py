#!/usr/bin/env python3
"""Builds lib/data/denmarkPlaces.json: place name → Statistics Denmark
"landsdel" (the area EJEN77 publishes prices for), from Statistics
Denmark's own classifications — no geocoder (the government address
service DAWA, api.dataforsyningen.dk, was shut down: HTTP 410 Gone).

 - NUTS classification (dst.dk nomenklaturer/nuts, CSV): municipality
   (kommune, level 3) → landsdel (level 2)
 - StatBank table BY1: every town / urban area ("851-01xxx Aalborg") with
   its municipality code → town → landsdel. A town name found in two
   landsdele is dropped (ambiguous).

  python3 scripts/build-dk-places.py
"""
import csv, io, json, re, urllib.request, pathlib, collections

NUTS = "https://www.dst.dk/klassifikationsbilag/5d18d1e0-400b-4505-92ad-6782915980a3csv_da"
BY1 = "https://api.statbank.dk/v1/tableinfo/BY1?lang=da&format=JSON"

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Pradixium/1.0"}), timeout=60).read().decode("utf-8-sig")

kommune_ld, landsdele, cur = {}, [], None
for r in csv.DictReader(io.StringIO(get(NUTS)), delimiter=";"):
    lvl, code, title = r["NIVEAU"], r["KODE"].strip('"'), r["TITEL"].strip()
    if lvl == "2":
        cur = re.sub(r"^Landsdel\s+", "", title); landsdele.append(cur)
    elif lvl == "3" and cur:
        kommune_ld[code] = (title, cur)
assert len(landsdele) == 11 and len(kommune_ld) == 99, (len(landsdele), len(kommune_ld))

# a municipality name always means the municipality (Frederiksberg is also a
# village elsewhere); towns fill in the rest
kommuner = {name: ld for name, ld in kommune_ld.values()}
names = collections.defaultdict(set)
for v in json.loads(get(BY1))["variables"]:
    if v["id"] != "BYER": continue
    for x in v["values"]:
        m = re.match(r"^(\d{3})-(\d{5}) (.+)$", x["text"])
        if not m or m.group(1) == "000" or m.group(2) == "99999": continue
        k, town = m.group(1), m.group(3)
        town = re.sub(r"\s*\((del af|delvis).*\)$", "", town).replace(" Kommune", "").strip()
        if k in kommune_ld and town:
            names[town].add(kommune_ld[k][1])
places = {n: sorted(s)[0] for n, s in names.items() if len(s) == 1 and n not in kommuner}
places.update(kommuner)
dropped = sorted(n for n, s in names.items() if len(s) > 1 and n not in kommuner)
out = {"source": "Statistics Denmark — NUTS classification + table BY1", "landsdele": landsdele, "places": places, "ambiguous": dropped}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/denmarkPlaces.json"
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(places), "places,", len(dropped), "ambiguous dropped;", landsdele)
