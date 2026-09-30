#!/usr/bin/env python3
"""UK: ONS — Price Index of Private Rents (PIPR), monthly price statistics:
average monthly private rent (new and existing tenancies) for every English
and Welsh local authority, London borough, English region, Scotland's
rental areas and the four nations — all homes, by bedrooms (1, 2, 3, 4+)
and by home type (detached, semi, terraced, flat/maisonette), with the
change on a year earlier. Latest month only.
→ lib/data/ukRents.json. Re-run each month (ONS publishes mid-month; the
dataset page lists the newest file first):
  pip install openpyxl && python3 scripts/build-uk-rents.py
"""
import io, json, os, re, urllib.request
import openpyxl

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
PAGE = "https://www.ons.gov.uk/economy/inflationandpriceindices/datasets/priceindexofprivaterentsukmonthlypricestatistics"
html = urllib.request.urlopen(urllib.request.Request(PAGE, headers=UA), timeout=60).read().decode("utf-8", "replace")
href = re.search(r'href="(/file\?uri=[^"]+\.xlsx)"', html).group(1)
URL = "https://www.ons.gov.uk" + href
ws = openpyxl.load_workbook(io.BytesIO(urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=180).read()), read_only=True, data_only=True)["Table 1"]
rows = list(ws.iter_rows(values_only=True))
head = [str(h) for h in rows[2]]
assert head[:4] == ["Time period", "Area code", "Area name", "Region or country name"], head[:4]
col = {h: i for i, h in enumerate(head)}
last = max(r[0] for r in rows[3:] if r[0])
num = lambda v: round(float(v), 1) if isinstance(v, (int, float)) else None
rent = lambda v: int(v) if isinstance(v, (int, float)) else None
KEYS = {"all": "", "bed1": " one bed", "bed2": " two bed", "bed3": " three bed", "bed4": " four or more bed",
        "detached": " detached", "semi": " semidetached", "terraced": " terraced", "flat": " flat maisonette"}
areas = {}
for r in rows[3:]:
    if r[0] != last: continue
    e = {"code": r[1], "name": r[2], "region": None if r[3] == "[z]" else r[3]}
    for k, suf in KEYS.items():
        e[k] = {"rent": rent(r[col[f"Rental price{suf}"]]), "yoy": num(r[col[f"Annual change{suf}"]])}
    areas[r[1]] = e
out = {"source": "ONS — Price Index of Private Rents (PIPR), UK: monthly price statistics (official statistics in development)",
       "sourceUrl": PAGE, "file": URL, "period": last.strftime("%Y-%m"), "areas": areas}
eng = next(a for a in areas.values() if a["name"] == "England")
assert eng["all"]["rent"] and len(areas) > 300, (eng, len(areas))
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "ukRents.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(out["period"], len(areas), "areas; England", eng["all"], "Manchester", next(a for a in areas.values() if a["name"] == "Manchester")["all"])
