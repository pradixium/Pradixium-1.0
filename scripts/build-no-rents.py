#!/usr/bin/env python3
"""Norway: SSB Rental market survey (table 09895) — average monthly rent and
average annual rent per m² by price zone and number of rooms, latest year
(actual survey averages; table 09897's PREDICTED rents are a model and not
used) → lib/data/norwayRents.json. Re-run each spring:
  python3 scripts/build-no-rents.py
"""
import json, os, time, urllib.request
URL = "https://data.ssb.no/api/v0/en/table/09895"
q = {"query": [{"code": "Tid", "selection": {"filter": "top", "values": ["1"]}}] + [{"code": k, "selection": {"filter": "all", "values": ["*"]}} for k in ("Soner2", "AntRom", "ContentsCode")], "response": {"format": "json-stat2"}}
d = json.loads(urllib.request.urlopen(urllib.request.Request(URL, data=json.dumps(q).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read())
ids, size, val = d["id"], d["size"], d["value"]
cat = lambda k: sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get)
lab = lambda k, c: d["dimension"][k]["category"]["label"][c]
def at(ix):
    o = 0
    for i, n in zip(ix, size): o = o * n + i
    return val[o]
Z, R, C, T = (ids.index(k) for k in ("Soner2", "AntRom", "ContentsCode", "Tid"))
year = lab("Tid", cat("Tid")[0])
out = {}
for zi, zc in enumerate(cat("Soner2")):
    rec = {}
    for ri, rc in enumerate(cat("AntRom")):
        ix = [0] * len(ids); ix[Z] = zi; ix[R] = ri
        ix[C] = cat("ContentsCode").index("Husleie"); m = at(ix)
        ix[C] = cat("ContentsCode").index("Husleiear"); a = at(ix)
        if m is not None or a is not None: rec[lab("AntRom", rc)] = {"monthly": m, "perSqmYear": a}
    if rec: out[lab("Soner2", zc)] = rec
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "norwayRents.json")
json.dump({"source": "Statistics Norway (SSB) — Rental market survey, table 09895", "url": "https://www.ssb.no/en/statbank/table/09895", "year": year,
           "built": time.strftime("%Y-%m-%d"), "zones": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, list(out)); print(out.get("Oslo and Bærum municipality"))
