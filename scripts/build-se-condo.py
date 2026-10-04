#!/usr/bin/env python3
"""Sweden: SCB BO0501C FastprisBRFRegionAr — sold tenant-owned flats
(bostadsrätter): number, average and median price (SEK thousands) per
metropolitan area and county, latest year → lib/data/swedenCondo.json.
A whole-flat price over a county / metro → CONTEXT only (like Australia's
ABS medians). Re-run each spring:  python3 scripts/build-se-condo.py
"""
import json, os, time, urllib.request
URL = "https://api.scb.se/OV0104/v1/doris/en/ssd/BO/BO0501/BO0501C/FastprisBRFRegionAr"
q = {"query": [{"code": "Region", "selection": {"filter": "all", "values": ["*"]}}, {"code": "ContentsCode", "selection": {"filter": "all", "values": ["*"]}},
               {"code": "Tid", "selection": {"filter": "top", "values": ["2"]}}], "response": {"format": "json-stat2"}}
d = json.loads(urllib.request.urlopen(urllib.request.Request(URL, data=json.dumps(q).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read())
ids, size, val = d["id"], d["size"], d["value"]
cat = lambda k: sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get)
lab = lambda k, c: d["dimension"][k]["category"]["label"][c]
def at(ix):
    o = 0
    for i, n in zip(ix, size): o = o * n + i
    return val[o]
Rg, C, T = ids.index("Region"), ids.index("ContentsCode"), ids.index("Tid")
years = cat("Tid"); cc = cat("ContentsCode")
out = {}
for ri, rc in enumerate(cat("Region")):
    rec = {}
    for ti, tc in enumerate(years):
        ix = [0] * len(ids); ix[Rg] = ri; ix[T] = ti
        v = {}
        for ci, c in enumerate(cc): ix[C] = ci; v[c] = at(ix)
        rec[lab("Tid", tc)] = {"n": v["BO0501R6"], "avg": v["BO0501R7"], "median": v["BO0501R8"]}
    out[lab("Region", rc)] = rec
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "swedenCondo.json")
json.dump({"source": "Statistics Sweden (SCB) — Sold tenant-owned flats (BO0501C)", "url": "https://www.statistikdatabasen.scb.se/pxweb/en/ssd/START__BO__BO0501__BO0501C/FastprisBRFRegionAr/",
           "years": [lab("Tid", t) for t in years], "built": time.strftime("%Y-%m-%d"), "regions": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print([lab("Tid", t) for t in years], out.get("Greater Stockholm"))
