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
import json, os, re, sys, time, urllib.request
y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
url = f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-b25031.dat"
lines = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read().decode().splitlines()
h = lines[0].split("|")
out, byGeo = {}, {}
for ln in lines[1:]:
    c = ln.split("|")
    if not (c[0].startswith("860Z200US") or c[0].startswith("1600000US")): continue
    vals = []
    for k in range(1, 8):
        e, m = int(c[h.index(f"B25031_E00{k}")]), int(c[h.index(f"B25031_M00{k}")])
        vals.append(None if e < 0 else (-e if m == -333333333 else e))   # negative = top-coded "e or more"
    if not any(v is not None for v in vals): continue
    if c[0].startswith("860Z200US"): out[c[0][-5:]] = vals
    else: byGeo[c[0]] = vals

# Census places (incorporated cities + CDPs) by name, for a city typed
# without a ZIP. Names from the summary file's own geography list. Same
# name twice in a state: an incorporated place beats a CDP; otherwise dropped.
geos = urllib.request.urlopen(urllib.request.Request(f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/documentation/Geos{y}5YR.txt", headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read().decode("latin-1").splitlines()
gh = geos[0].split("|")
ALIAS = {"athens-clarke": "athens", "augusta-richmond": "augusta", "nashville-davidson": "nashville", "louisville/jefferson": "louisville",
         "urban honolulu": "honolulu", "boise city": "boise", "butte-silver bow": "butte"}
cand = {}
for ln in geos[1:]:
    c = ln.split("|")
    if len(c) < len(gh) or c[gh.index("SUMLEVEL")] != "160" or c[gh.index("COMPONENT")] != "00": continue
    gid, name, st = c[gh.index("GEO_ID")], c[gh.index("NAME")], c[gh.index("STUSAB")]
    if gid not in byGeo: continue
    n = re.sub(r",[^,]*$", "", name)                       # ", Florida"
    n = re.sub(r"\s*\([^)]*\)", "", n).strip()            # "(balance)", "(Honolulu County)"
    n = re.sub(r"\s+(county\s+)?(unified|consolidated|metropolitan|metro)\s+government$", "", n, flags=re.I)
    cdp = bool(re.search(r"\bCDP$", n))
    n = re.sub(r"\s+(CDP|city|town|village|borough|municipality|zona urbana|comunidad|township|corporation)$", "", n, flags=re.I).strip()
    n = re.sub(r"\s+county$", "", n, flags=re.I).lower() if re.search(r"-.*county$", n, re.I) else n.lower()
    n = ALIAS.get(n, n)
    cand.setdefault(f"{n}|{st}", []).append((cdp, name, byGeo[gid]))
places = {}
for k, v in cand.items():
    inc = [x for x in v if not x[0]]
    pick = inc if inc else v
    if len(pick) == 1: places[k] = [pick[0][1]] + pick[0][2]
# each place's county (5-digit FIPS) from the place-within-county parts
# (summary level 155) weighted by occupied homes (B25003); only when one
# county holds 80%+ of the place's homes
iN155 = gh.index("NAME")
hh = {}
for ln in urllib.request.urlopen(urllib.request.Request(f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-b25003.dat", headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read().decode().splitlines()[1:]:
    c = ln.split("|")
    if c[0].startswith("1550000US"): hh[c[0]] = max(0, int(c[1]))
parts = {}
for ln in geos[1:]:
    c = ln.split("|")
    if len(c) < len(gh) or c[gh.index("SUMLEVEL")] != "155" or c[gh.index("COMPONENT")] != "00": continue
    st, pl, co = c[gh.index("STATE")], c[gh.index("PLACE")], c[gh.index("COUNTY")]
    parts.setdefault(f"1600000US{st}{pl}", []).append((hh.get(c[gh.index("GEO_ID")], 0), st + co))
nameToGeo = {}
for ln in geos[1:]:
    c = ln.split("|")
    if len(c) >= len(gh) and c[gh.index("SUMLEVEL")] == "160" and c[gh.index("COMPONENT")] == "00": nameToGeo[c[iN155]] = c[gh.index("GEO_ID")]
placeCounty = {}
for k, v in places.items():
    ps = parts.get(nameToGeo.get(v[0]), [])
    tot = sum(x for x, _ in ps)
    if ps:
        top = max(ps)
        if len(ps) == 1 or (tot and top[0] / tot >= 0.8): placeCounty[k] = top[1]
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "usRents.json")
json.dump({"source": f"U.S. Census Bureau, {y-4}–{y} American Community Survey 5-Year Estimates, table B25031 (median gross rent by bedrooms)",
           "url": url, "period": f"{y-4}–{y}", "built": time.strftime("%Y-%m-%d"),
           "columns": ["all", "studio", "1", "2", "3", "4", "5+"], "zcta": out, "places": places, "placeCounty": placeCounty}, open(p, "w"), separators=(",", ":"))
print(len(placeCounty), "place counties; philadelphia", placeCounty.get("philadelphia|PA"), "las vegas", placeCounty.get("las vegas|NV"), "miami", placeCounty.get("miami|FL"), "atlanta", placeCounty.get("atlanta|GA"));print(len(out), "ZCTAs;", len(places), "places; miami|FL:", places.get("miami|FL"), "nashville|TN:", places.get("nashville|TN"))
