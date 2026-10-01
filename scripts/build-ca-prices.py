#!/usr/bin/env python3
"""Builds lib/data/canadaPrices.json — Statistics Canada (WDS API, keyless):
 - New Housing Price Index (table 18-10-0205, monthly): change of the
   "Total (house and land)" index on the same month a year earlier, per
   metro area (27 CMAs) and province — NEW homes only (builders' contractor
   selling prices of the same model homes), the official local trend
 (CHSP table 46-10-0030 lists a "median sale price of properties purchased
 in a market sale" but every province cell is empty ("..") → not used.)

  python3 scripts/build-ca-prices.py      (monthly)
"""
import json, urllib.request, pathlib

WDS = "https://www150.statcan.gc.ca/t1/wds/rest/"
def post(fn, body):
    req = urllib.request.Request(WDS + fn, data=json.dumps(body).encode(), headers={"content-type": "application/json", "User-Agent": "Pradixium/1.0"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())

meta = post("getCubeMetadata", [{"productId": 18100205}])[0]["object"]
geos = {m["memberId"]: m["memberNameEn"] for m in meta["dimension"][0]["member"]}
req = [{"productId": 18100205, "coordinate": f"{g}.1.0.0.0.0.0.0.0.0", "latestN": 13} for g in geos]
nhpi = {}
for r in post("getDataFromCubePidCoordAndLatestNPeriods", req):
    o = r.get("object") or {}
    pts = sorted(o.get("vectorDataPoint") or [], key=lambda p: p["refPer"])
    if len(pts) < 13 or not pts[-1]["value"] or not pts[0]["value"]: continue
    g = int(o["coordinate"].split(".")[0])
    nhpi[geos[g]] = {"period": pts[-1]["refPer"][:7], "yoy": round((pts[-1]["value"] / pts[0]["value"] - 1) * 100, 1), "index": pts[-1]["value"]}

out = {"nhpi": nhpi,
       "nhpiSource": "Statistics Canada — New Housing Price Index, table 18-10-0205-01", "nhpiUrl": "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1810020501"}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/canadaPrices.json"
p.write_text(json.dumps(out, ensure_ascii=False, indent=0))
print(len(nhpi), "NHPI areas")
