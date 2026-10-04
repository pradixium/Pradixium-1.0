#!/usr/bin/env python3
"""Canada: CMHC Rental Market Survey average rents (October) by bedrooms for
centres of 10,000+ people — Statistics Canada table 34-10-0133 (WDS, no
key), "Row and apartment structures of three units and over" = the
PURPOSE-BUILT rental market (not rented condominiums or houses), latest
survey year → lib/data/canadaRents.json. Re-run each January.
  python3 scripts/build-ca-rents.py
"""
import csv, io, json, os, time, urllib.request, zipfile
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
meta = json.loads(urllib.request.urlopen(urllib.request.Request("https://www150.statcan.gc.ca/t1/wds/rest/getFullTableDownloadCSV/34100133/en", headers=UA), timeout=60).read())
z = zipfile.ZipFile(io.BytesIO(urllib.request.urlopen(urllib.request.Request(meta["object"], headers=UA), timeout=300).read()))
rows = list(csv.DictReader(io.TextIOWrapper(z.open("34100133.csv"), encoding="utf-8-sig")))
S = "Row and apartment structures of three units and over"
U = {"Bachelor units": 0, "One bedroom units": 1, "Two bedroom units": 2, "Three bedroom units": 3}
year = max(r["REF_DATE"] for r in rows if r["VALUE"] and r["Type of structure"] == S)
out = {}
for r in rows:
    if r["REF_DATE"] != year or r["Type of structure"] != S or not r["VALUE"]: continue
    out.setdefault(r["GEO"], [None] * 4)[U[r["Type of unit"]]] = round(float(r["VALUE"]))
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "canadaRents.json")
json.dump({"source": "CMHC Rental Market Survey — average rents, purpose-built row and apartment structures of 3+ units (Statistics Canada table 34-10-0133)",
           "url": "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301", "year": year, "built": time.strftime("%Y-%m-%d"),
           "columns": ["bachelor", "1", "2", "3"], "geo": out}, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(out), "centres; Toronto:", out.get("Toronto, Ontario"), "Vancouver:", out.get("Vancouver, British Columbia"))
