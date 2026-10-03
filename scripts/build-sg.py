#!/usr/bin/env python3
"""Singapore → lib/data/singapore.json (quarterly, after URA's release)

 - URA private residential property price index by type (SingStat table
   M212261: all, landed, non-landed) and non-landed by locality (M212271:
   Core Central / Rest of Central / Outside Central Region), 1Q2009 = 100
   → change on the same quarter a year earlier.
 - URA "Rentals of Non-Landed Residential Buildings" (data.gov.sg
   d_149ac00a2734bb0a03867bbe2ec0e7b0): median / 25th / 75th percentile
   rent per square FOOT per month of major projects (100+ units) with 10+
   rental contracts in the quarter (unit per URA's API documentation:
   "median per square feet per month").
  python3 scripts/build-sg.py
"""
import json, os, re, urllib.request
UA = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}   # SingStat answers 403 without an Accept header
get = lambda u: json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=90).read())

def singstat(tid):
    d = get(f"https://tablebuilder.singstat.gov.sg/api/table/tabledata/{tid}?limit=2000")["Data"]
    rows = {}
    for r in d["row"]:
        vals = {c["key"]: float(c["value"]) for c in r["columns"] if c["value"] not in ("na", "-", "")}
        rows[r["rowText"].strip()] = vals
    return d["title"], d.get("dataLastUpdated"), rows

def yoy(vals):
    q = sorted(vals, key=lambda k: (int(k[:4]), int(k[5])))
    last = q[-1]; ago = f"{int(last[:4]) - 1} {last[5:]}"
    return {"period": f"{last[:4]}-Q{last[5]}", "index": vals[last],
            "yearAgo": vals.get(ago), "yoyPercent": round((vals[last] / vals[ago] - 1) * 100, 1) if ago in vals else None}

t1, u1, ppi = singstat("M212261")
t2, u2, loc = singstat("M212271")
out = {"ppi": {"source": f"URA via SingStat — {t1}", "updated": u1, "sourceUrl": "https://tablebuilder.singstat.gov.sg/table/TS/M212261",
               "all": yoy(ppi["Residential Properties"]), "landed": yoy(ppi["Landed"]), "nonLanded": yoy(ppi["Non-Landed"])},
       "locality": {"source": f"URA via SingStat — {t2}", "sourceUrl": "https://tablebuilder.singstat.gov.sg/table/TS/M212271",
                    **{k: yoy(v) for k, v in loc.items()}}}

recs, off = [], 0
while True:
    r = get(f"https://data.gov.sg/api/action/datastore_search?resource_id=d_149ac00a2734bb0a03867bbe2ec0e7b0&limit=1000&offset={off}")["result"]
    recs += r["records"]; off += 1000
    if off >= r["total"]: break
q = max(x["qtr"] for x in recs)
out["rents"] = {"source": "URA — Rentals of Non-Landed Residential Buildings (major projects, 10+ rental contracts in the quarter), data.gov.sg",
                "sourceUrl": "https://data.gov.sg/datasets/d_149ac00a2734bb0a03867bbe2ec0e7b0/view", "period": q, "unit": "S$ per sq ft per month",
                "projects": {x["project_name"].strip().upper(): {"district": x["postal_district"], "median": float(x["median"]), "p25": float(x["25th_percentile"]),
                                                                  "p75": float(x["75th_percentile"]), "contracts": int(float(x["rental_contracts"]))}
                             for x in recs if x["qtr"] == q}}
# URA Data Service PMI_Resi_Transaction (caveats lodged, 5 years, no
# names): needs URA_KEY in the environment (free access key) — the key is
# never written to the repo; without it the previous sales block is kept.
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "singapore.json")
KEY = os.environ.get("URA_KEY")
if KEY:
    import statistics
    H = {"AccessKey": KEY, "User-Agent": "Mozilla/5.0"}
    tok = json.loads(urllib.request.urlopen(urllib.request.Request("https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1", headers=H), timeout=60).read())["Result"]
    projects = []
    for b in range(1, 5):
        raw = urllib.request.urlopen(urllib.request.Request(f"https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1?service=PMI_Resi_Transaction&batch={b}", headers={**H, "Token": tok}), timeout=300).read()
        projects += json.loads(raw.decode("latin-1"))["Result"]
    ym = lambda d: (2000 + int(d[2:]), int(d[:2]))          # contractDate mmyy
    last = max(ym(t["contractDate"]) for pr in projects for t in pr["transaction"])
    first = (last[0] - 1, last[1] + 1) if last[1] < 12 else (last[0], 1)   # 12 months up to the latest month
    NONLANDED = {"Apartment", "Condominium", "Executive Condominium"}
    sales = {}
    for pr in projects:
        groups = {}
        for t in pr["transaction"]:
            d = ym(t["contractDate"])
            if not (first <= d <= last) or t.get("noOfUnits") != "1" or t["propertyType"] not in NONLANDED or t.get("typeOfArea") != "Strata": continue
            price = float(t.get("nettPrice") or t["price"]); area = float(t["area"])
            if area <= 0 or price <= 0: continue
            kind = "new" if t["typeOfSale"] == "1" else "resale"
            groups.setdefault(kind, []).append(price / area)
        g = {k: {"psm": round(statistics.median(v)), "n": len(v)} for k, v in groups.items() if len(v) >= 10}
        if g:
            sales[pr["project"].strip().upper()] = {"segment": pr.get("marketSegment"), "street": pr.get("street"), **g}
    out["sales"] = {"source": "URA — private residential transactions (caveats lodged), URA Data Service", "sourceUrl": "https://eservice.ura.gov.sg/maps/api/",
                    "from": f"{first[0]}-{first[1]:02d}", "to": f"{last[0]}-{last[1]:02d}", "unit": "S$ per m² of strata area", "projects": sales}
    print("URA sales", out["sales"]["from"], out["sales"]["to"], len(sales), "projects with 10+ sales")
elif os.path.exists(p):
    old_doc = json.load(open(p))
    if "sales" in old_doc: out["sales"] = old_doc["sales"]

json.dump(out, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(out["ppi"]["all"], out["ppi"]["landed"], out["ppi"]["nonLanded"])
print({k: v for k, v in out["locality"].items() if isinstance(v, dict)})
print(q, len(out["rents"]["projects"]), "projects")
