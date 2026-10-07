#!/usr/bin/env python3
"""Hong Kong → lib/data/hongKong.json (monthly, after RVD's release)

Rating and Valuation Department, "Property Market Statistics" (rvd.gov.hk):
 - his_data_2: Private Domestic — Average PRICES by Class, HK$ per m² of
   SALEABLE area, by region (Hong Kong Island / Kowloon / New Territories);
   classes by saleable area A < 40 m², B 40–69.9, C 70–99.9, D 100–159.9,
   E ≥ 160. Secondary sales only (primary sales not used by RVD).
   "( )" = fewer than 20 transactions, "*" = provisional.
 - his_data_1: Average RENTS by Class (HK$ per m² saleable per month).
 - his_data_4: Price Indices by Class, territory-wide (1999 = 100).
 - his_data_15: Private domestic market yields by class (%).
  python3 scripts/build-hk.py
"""
import io, json, os, urllib.request
import xlrd
UA = {"User-Agent": "Mozilla/5.0", "Accept": "*/*"}
BASE = "https://www.rvd.gov.hk/doc/en/statistics/"
def book(n): return xlrd.open_workbook(file_contents=urllib.request.urlopen(urllib.request.Request(BASE + f"his_data_{n}.xls", headers=UA), timeout=120).read())
CLASSES = ["A", "B", "C", "D", "E"]
REGIONS = ["Hong Kong Island", "Kowloon", "New Territories"]

def months(sh, cols):
    out, year = [], None
    for r in range(sh.nrows):
        y = sh.cell_value(r, 1)
        if isinstance(y, float) and 1970 < y < 2100: year = int(y)
        m = str(sh.cell_value(r, 5)).strip().replace(".0", "")
        if not year or not m.isdigit() or not 1 <= int(m) <= 12: continue
        row = {"period": f"{year}-{int(m):02d}", "provisional": str(sh.cell_value(r, 6)).strip() == "*", "v": {}}
        for k, c in cols.items():
            v = sh.cell_value(r, c)
            if isinstance(v, float):
                row["v"][k] = {"value": v, "fewerThan20": str(sh.cell_value(r, c - 1)).strip() == "("}
        if row["v"]: out.append(row)
    return out

region_cols = {f"{cl}|{rg}": 8 + 9 * i + 3 * j for i, cl in enumerate(CLASSES) for j, rg in enumerate(REGIONS)}
prices = months(book(2).sheet_by_index(0), region_cols)
rents = months(book(1).sheet_by_index(0), region_cols)
idx = months(book(4).sheet_by_index(0), {**{cl: 8 + 3 * i for i, cl in enumerate(CLASSES)}, "All": 29})
yld = months(book(15).sheet_by_index(0), {cl: 8 + 3 * i for i, cl in enumerate(CLASSES)})

def latest(rows): return rows[-1]
def yoy(rows):
    last = rows[-1]; y, m = last["period"].split("-"); ago = next((r for r in rows if r["period"] == f"{int(y) - 1}-{m}"), None)
    return {"period": last["period"], "provisional": last["provisional"],
            "byClass": {k: round((v["value"] / ago["v"][k]["value"] - 1) * 100, 1) for k, v in last["v"].items() if ago and k in ago["v"]}}
out = {"source": "Rating and Valuation Department (RVD) — Property Market Statistics, private domestic",
       "sourceUrl": "https://www.rvd.gov.hk/en/publications/property_market_statistics.html",
       "prices": latest(prices), "rents": latest(rents), "index": yoy(idx), "yields": latest(yld),
       "classes": {"A": [0, 40], "B": [40, 70], "C": [70, 100], "D": [100, 160], "E": [160, None]}}
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "hongKong.json")
json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
print("prices", out["prices"]["period"], out["prices"]["v"]["B|Kowloon"], "rents", out["rents"]["period"], out["rents"]["v"]["B|Kowloon"])
print("index", out["index"], "yields", out["yields"]["period"], out["yields"]["v"])
