#!/usr/bin/env python3
"""US: median GROSS rent by number of bedrooms per ZIP Code Tabulation Area
(ACS 5-year table B25031, U.S. Census Bureau table-based summary file —
www2.census.gov, no API key) → lib/data/usRents.json.

Gross rent = contract rent + utilities and fuels paid by the renter, all
renter-occupied units paying cash rent (existing tenancies, 5-year
period). The Census top-codes medians ("3,501" with margin code -333333333
= "$3,500 or more") → kept as a flag, never used as a number.
Re-run each December when the next 5-year release appears:
  python3 scripts/build-us-rents.py 2024
"""
import json, os, sys, time, urllib.request
y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
url = f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-b25031.dat"
lines = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read().decode().splitlines()
h = lines[0].split("|")
out = {}
for ln in lines[1:]:
    c = ln.split("|")
    if not c[0].startswith("860Z200US"): continue
    zc = c[0][-5:]; vals = []
    for k in range(1, 8):
        e, m = int(c[h.index(f"B25031_E00{k}")]), int(c[h.index(f"B25031_M00{k}")])
        vals.append(None if e < 0 else (-e if m == -333333333 else e))   # negative = top-coded "e or more"
    if any(v is not None for v in vals): out[zc] = vals
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "usRents.json")
json.dump({"source": f"U.S. Census Bureau, {y-4}–{y} American Community Survey 5-Year Estimates, table B25031 (median gross rent by bedrooms), ZCTA",
           "url": url, "period": f"{y-4}–{y}", "built": time.strftime("%Y-%m-%d"),
           "columns": ["all", "studio", "1", "2", "3", "4", "5+"], "zcta": out}, open(p, "w"), separators=(",", ":"))
print(len(out), "ZCTAs; 10019:", out.get("10019"), "60614:", out.get("60614"))
