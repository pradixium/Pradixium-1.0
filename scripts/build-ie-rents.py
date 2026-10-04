#!/usr/bin/env python3
"""Ireland: RTB average monthly rent of NEW tenancies registered with the
Residential Tenancies Board, by location (counties, towns, Dublin postal
districts and their localities), number of bedrooms and property type —
CSO table RIQ02 (RTB statistics hosted by the CSO, CC BY 4.0), latest
quarter with values → lib/data/irelandRents.json.
Re-run each quarter:  python3 scripts/build-ie-rents.py
"""
import json, os, time, urllib.request
URL = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/RIQ02/JSON-stat/2.0/en"
d = json.loads(urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read())
ids, size, vals = d["id"], d["size"], d["value"]
cats = [list(d["dimension"][k]["category"]["index"]) if isinstance(d["dimension"][k]["category"]["index"], list) else sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get) for k in ids]
labels = [d["dimension"][k]["category"]["label"] for k in ids]
def at(idx):
    o = 0
    for i, n in zip(idx, size): o = o * n + i
    v = vals[o] if isinstance(vals, list) else vals.get(str(o))
    return v
t_i = ids.index("TLIST(Q1)"); quarters = cats[t_i]
B, T, L = ids.index("C02970V03592"), ids.index("C02969V03591"), ids.index("C03004V03625")
# latest quarter with values for most locations
for qi in range(len(quarters) - 1, -1, -1):
    n = sum(1 for li in range(size[L]) if at([0 if k != t_i and k != L else (qi if k == t_i else li) for k in range(len(ids))]) is not None)
    if n > 50: break
q = quarters[qi]
out = {}
for li, lc in enumerate(cats[L]):
    rec = {}
    for ti, tc in enumerate(cats[T]):
        for bi, bc in enumerate(cats[B]):
            idx = [0] * len(ids); idx[t_i] = qi; idx[L] = li; idx[T] = ti; idx[B] = bi
            v = at(idx)
            if v is not None: rec.setdefault(labels[T][tc], {})[labels[B][bc]] = round(v, 2)
    if rec: out[labels[L][lc]] = rec
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "irelandRents.json")
json.dump({"source": "Residential Tenancies Board (RTB) — average monthly rent of new tenancies, CSO table RIQ02", "url": "https://data.cso.ie/table/RIQ02",
           "quarter": d["dimension"]["TLIST(Q1)"]["category"]["label"][q], "updated": d.get("updated"), "built": time.strftime("%Y-%m-%d"), "locations": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(q, len(out), "locations; Dublin 4:", out.get("Dublin 4", {}).get("Apartment"), "| Cork:", out.get("Cork", {}).get("All property types", {}).get("All bedrooms"))
