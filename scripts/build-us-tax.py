#!/usr/bin/env python3
"""US: median annual real estate taxes paid (B25103) and median home value
(B25077) of owner-occupied homes — ACS 5-year, U.S. Census Bureau
table-based summary file (www2.census.gov, no key) — per ZCTA, place
(same names as usRents.json places), county and state →
lib/data/usTaxPrices.json. Top-coded medians ("$10,000+" taxes,
"$2,000,000+" value; margin code -333333333) are stored negative and never
used as a number. Re-run each December with the next 5-year release:
  python3 scripts/build-us-tax.py 2024
"""
import json, os, sys, time, urllib.request
y = int(sys.argv[1]) if len(sys.argv) > 1 else 2024
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
def table(t):
    u = f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/data/5YRData/acsdt5y{y}-{t}.dat"
    L = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=300).read().decode().splitlines()
    h = L[0].split("|"); e, m = h.index(f"{t.upper()}_E001"), h.index(f"{t.upper()}_M001")
    out = {}
    for ln in L[1:]:
        c = ln.split("|")
        if not c[0][:3] in ("860", "160", "050", "040"): continue
        v = int(c[e])
        if v < 0: continue
        out[c[0]] = -v if int(c[m]) == -333333333 else v
    return out
tax, val = table("b25103"), table("b25077")
rents = json.load(open(os.path.join(os.path.dirname(__file__), "..", "lib", "data", "usRents.json")))
out = {"zcta": {}, "county": {}, "state": {}, "place": {}}
for g, t in tax.items():
    v = val.get(g)
    row = [t, v]
    if g.startswith("860Z200US"): out["zcta"][g[-5:]] = row
    elif g.startswith("0500000US"): out["county"][g[-5:]] = row
    elif g.startswith("0400000US"): out["state"][g[-2:]] = row
# places keyed like usRents.json ("miami|FL") — the full place name identifies the GEO_ID
geos = urllib.request.urlopen(urllib.request.Request(f"https://www2.census.gov/programs-surveys/acs/summary_file/{y}/table-based-SF/documentation/Geos{y}5YR.txt", headers=UA), timeout=300).read().decode("latin-1").splitlines()
gh = geos[0].split("|"); iN, iG, iS = gh.index("NAME"), gh.index("GEO_ID"), gh.index("SUMLEVEL")
byName = {c[iN]: c[iG] for c in (l.split("|") for l in geos[1:]) if len(c) > iS and c[iS] == "160" and c[gh.index("COMPONENT")] == "00"}
for k, r in rents["places"].items():
    g = byName.get(r[0])
    if g and g in tax: out["place"][k] = [tax[g], val.get(g)]
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "usTaxPrices.json")
json.dump({"source": f"U.S. Census Bureau, {y-4}–{y} American Community Survey 5-Year Estimates, tables B25103 (median real estate taxes paid) and B25077 (median value), owner-occupied homes",
           "period": f"{y-4}–{y}", "built": time.strftime("%Y-%m-%d"), **out}, open(p, "w"), separators=(",", ":"))
print({k: len(v) for k, v in out.items()}, "33139:", out["zcta"].get("33139"), "miami|FL:", out["place"].get("miami|FL"), "12086:", out["county"].get("12086"))
