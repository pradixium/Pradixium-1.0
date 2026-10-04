#!/usr/bin/env python3
"""Sweden: SCB BO0406 Tab01 — median annual rent per m² of rented dwellings
(hyresrätter, the rent-regulated first-hand rental stock) per county and
municipality, latest year, with SCB's margin of error → lib/data/
swedenRents.json. Re-run each autumn:  python3 scripts/build-se-rents.py
"""
import json, os, time, urllib.request
URL = "https://api.scb.se/OV0104/v1/doris/en/ssd/BO/BO0406/BO0406E/BO0406Tab01"
q = {"query": [{"code": "Region", "selection": {"filter": "all", "values": ["*"]}}, {"code": "Hyresuppg", "selection": {"filter": "item", "values": ["Ah_kvm"]}},
               {"code": "ContentsCode", "selection": {"filter": "item", "values": ["000000J4", "000000J3"]}},
               {"code": "Tid", "selection": {"filter": "top", "values": ["1"]}}], "response": {"format": "json-stat2"}}
d = json.loads(urllib.request.urlopen(urllib.request.Request(URL, data=json.dumps(q).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read())
ids, size, val = d["id"], d["size"], d["value"]
cat = lambda k: sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get)
lab = lambda k, c: d["dimension"][k]["category"]["label"][c]
def at(ix):
    o = 0
    for i, n in zip(ix, size): o = o * n + i
    return val[o]
Rg, C = ids.index("Region"), ids.index("ContentsCode")
year = lab("Tid", cat("Tid")[0])
out = {}
for ri, rc in enumerate(cat("Region")):
    ix = [0] * len(ids); ix[Rg] = ri
    ix[C] = 0; med = at(ix); ix[C] = 1; moe = at(ix)
    if med: out[lab("Region", rc)] = [med, moe]
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "swedenRents.json")
json.dump({"source": "Statistics Sweden (SCB) — Rents for dwellings (BO0406), median annual rent per m²", "url": "https://www.statistikdatabasen.scb.se/pxweb/en/ssd/START__BO__BO0406__BO0406E/BO0406Tab01/",
           "year": year, "built": time.strftime("%Y-%m-%d"), "regions": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(out), "Stockholm:", out.get("Stockholm"), "Göteborg:", out.get("Göteborg"), "Malmö:", out.get("Malmö"))
