#!/usr/bin/env python3
"""Finland: average rent per m² a month of NON-SUBSIDISED rental dwellings
— new rental contracts and all contracts — by number of rooms, for the
regions/cities Statistics Finland publishes (StatFin asvu 15fa, latest
quarter; CC BY 4.0) → lib/data/finlandRents.json. Sub-city zones
("Helsinki 1"…) are kept but only the city level is matched (the zones are
postcode groups). Re-run each quarter:  python3 scripts/build-fi-rents.py
"""
import json, os, time, urllib.request
URL = "https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin/asvu/15fa.px"
q = {"query": [{"code": "rahoitus_2_20260101", "selection": {"filter": "item", "values": ["1"]}},
               {"code": "timeperiod_q", "selection": {"filter": "top", "values": ["1"]}},
               {"code": "contentscode", "selection": {"filter": "item", "values": ["asvu_keskineliovuokra", "asvu_keskineliovuokra_lkm", "asvu_keskineliovuokra_u", "asvu_keskineliovuokra_u_lkm"]}}],
     "response": {"format": "json-stat2"}}
req = urllib.request.Request(URL, data=json.dumps(q).encode(), headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Pradixium data build)"})
d = json.loads(urllib.request.urlopen(req, timeout=120).read())
ids, size, val = d["id"], d["size"], d["value"]
cat = lambda k: sorted(d["dimension"][k]["category"]["index"], key=d["dimension"][k]["category"]["index"].get)
lab = lambda k, c: d["dimension"][k]["category"]["label"][c]
def at(ix):
    o = 0
    for i, n in zip(ix, size): o = o * n + i
    return val[o]
R, A, C, T = ids.index("huoneluku_5_20260101"), ids.index("alue_44_20260101"), ids.index("contentscode"), ids.index("timeperiod_q")
quarter = lab("timeperiod_q", cat("timeperiod_q")[0])
out = {}
for ai, ac in enumerate(cat(ids[A])):
    rec = {}
    for ri, rc in enumerate(cat(ids[R])):
        ix = [0] * len(ids); ix[A] = ai; ix[R] = ri
        vals = []
        for ci in range(4):
            ix[C] = ci; vals.append(at(ix))
        if vals[0] is not None or vals[2] is not None:
            rec[lab(ids[R], rc)] = {"all": vals[0], "allN": vals[1], "new": vals[2], "newN": vals[3]}
    if rec: out[lab(ids[A], ac)] = rec
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "finlandRents.json")
json.dump({"source": "Statistics Finland — rents of dwellings (StatFin asvu 15fa), non-subsidised", "url": "https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__asvu/statfin_asvu_pxt_15fa.px/",
           "quarter": quarter, "built": time.strftime("%Y-%m-%d"), "areas": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(quarter, len(out), "areas; Helsinki:", out.get("Helsinki"), "Tampere:", out.get("Tampere", {}).get("Total"))
