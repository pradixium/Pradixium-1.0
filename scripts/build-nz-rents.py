#!/usr/bin/env python3
"""New Zealand: median weekly rent of NEW private tenancies (bonds lodged
with Tenancy Services, MBIE) → lib/data/newZealandRents.json.

- SA2 level: "Detailed Quarterly Tenancy" file, latest quarter, by dwelling
  type (House / Flat / Apartment / ALL) × bedrooms; SA2-2019 areas
  (= SA2 2018 codes). Cells with fewer than 10 bonds are dropped.
- Territorial-authority level: "Detailed Monthly TLA Tenancy" file, latest
  month, all dwellings (the file has no type / bedroom split).
- SA2 names + their territorial authority: Statistics New Zealand's own
  ArcGIS org (Statistical_Area_2_2018 centroids inside
  Territorial_Authority_2018 polygons).
Licence: MBIE data CC BY 3.0 NZ — credit "Ministry of Business, Innovation
and Employment"; Stats NZ boundaries CC BY 4.0.
Re-run monthly:  python3 scripts/build-nz-rents.py
"""
import csv, io, json, os, re, time, urllib.request
from shapely.geometry import Polygon, Point
from shapely.ops import unary_union

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
PAGE = "https://www.tenancy.govt.nz/about-tenancy-services/data-and-statistics/rental-bond-data/"
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=300).read()
html = get(PAGE).decode("utf-8", "ignore")
qurl = re.search(r'href="([^"]*Detailed-Quarterly-Tenancy-Q1-2020[^"]*\.csv)', html, re.I).group(1)
murl = re.search(r'href="([^"]*detailed-monthly-tla-tenancy[^"]*\.csv)', html, re.I).group(1)

B = "https://services2.arcgis.com/vKb0s8tBIA3bdocZ/ArcGIS/rest/services/"
def arc(svc, params): return json.loads(get(B + svc + "/FeatureServer/0/query?" + params))
sa, off = [], 0
while True:
    d = arc("Statistical_Area_2_2018", f"where=1=1&outFields=SA22018_V1_00,SA22018_V1_NAME&returnGeometry=false&returnCentroid=true&outSR=4326&resultOffset={off}&resultRecordCount=2000&f=json")
    sa += d["features"]; off += len(d["features"])
    if not d.get("exceededTransferLimit") and len(d["features"]) < 2000: break
ta = arc("Territorial_Authority_2018", "where=1=1&outFields=TA2018_V1_00_NAME&returnGeometry=true&outSR=4326&maxAllowableOffset=0.002&f=json")["features"]
polys = []
for f in ta:
    g = f["geometry"]
    polys.append((f["attributes"]["TA2018_V1_00_NAME"], unary_union([Polygon(r).buffer(0) for r in g["rings"] if len(r) > 3])))   # NZ TAs do not nest
sa2 = {}
for f in sa:
    c = f.get("centroid"); a = f["attributes"]
    if not c or a["SA22018_V1_NAME"].startswith(("Inlet", "Oceanic", "Inland water")): continue
    p = Point(c["x"], c["y"])
    inside = [n for n, g in polys if g.contains(p)]
    n = inside[0] if inside else min(polys, key=lambda x: x[1].distance(p))[0]   # coastal centroid in water
    if n == "Area Outside Territorial Authority": continue
    sa2[a["SA22018_V1_00"]] = {"n": a["SA22018_V1_NAME"], "ta": n, "v": {}}

rows = list(csv.DictReader(io.StringIO(get(qurl).decode("utf-8-sig"))))
qlast = max(r["TimeFrame"] for r in rows)
for r in rows:
    if r["TimeFrame"] != qlast or r["Location Id"] not in sa2 or r["Median Rent"] in ("", "NULL"): continue
    if r["Dwelling Type"] not in ("ALL", "House", "Flat", "Apartment"): continue
    if r["Number Of Beds"] not in ("ALL", "1", "2", "3", "4", "5+"): continue
    b = int(r["Total Bonds"] or 0)
    if b < 10: continue
    sa2[r["Location Id"]]["v"][f'{r["Dwelling Type"]}|{r["Number Of Beds"]}'] = [int(float(r["Median Rent"])), b, int(float(r["Lower Quartile Rent"])), int(float(r["Upper Quartile Rent"]))]
sa2 = {k: v for k, v in sa2.items() if v["v"]}

m = list(csv.DictReader(io.StringIO(get(murl).decode("utf-8-sig"))))
mkey = lambda r: tuple(map(int, r["TimeFrame"].split("/")[::-1]))
mlast = max(mkey(r) for r in m)
tas = {}
for r in m:
    if mkey(r) != mlast or r["location"] in ("ALL", "NA") or r["MedianRent"] in ("", "NULL"): continue
    if int(r["LodgedBonds"] or 0) < 10: continue
    tas[r["location"]] = [int(float(r["MedianRent"])), int(r["LodgedBonds"]), int(float(r["LowerQuartileRent"])), int(float(r["UpperQuartileRent"]))]

y, mo, _ = map(int, qlast.split("-"))
quarter = f"{y} Q{(mo - 1) // 3 + 1}"
month = time.strftime("%B %Y", time.strptime(f"{mlast[0]}-{mlast[1]}", "%Y-%m"))
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "newZealandRents.json")
json.dump({"source": "Ministry of Business, Innovation and Employment (Tenancy Services) rental bond data", "url": PAGE,
           "quarter": quarter, "month": month, "built": time.strftime("%Y-%m-%d"), "sa2": sa2, "ta": tas},
          open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(quarter, len(sa2), "SA2s;", month, len(tas), "TAs; Auckland:", tas.get("Auckland"),
      "Ponsonby West:", next((v for v in sa2.values() if v["n"] == "Ponsonby West"), None))
