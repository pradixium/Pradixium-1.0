#!/usr/bin/env python3
"""Poland: GUS (Statistics Poland) — Bank Danych Lokalnych, subject
"Rynkowa sprzedaż lokali mieszkalnych": the median price per 1 m² of flats
sold in MARKET transactions, per powiat (county / city with county rights),
split by market (resale = rynek wtórny, new = rynek pierwotny) and by flat
size (up to 40 m², 40.1–60, 60.1–80, over 80), with the number of flats sold.
Latest full year with powiat figures (P3787 prices / P3783 counts; the
quarterly series has no powiat values for the newest year yet). A figure is
kept only with 20+ sales.
Gminas are mapped to their powiat so a town finds its county.
Re-run when GUS loads the next year (usually mid-year):  python3 scripts/build-pl-prices.py
"""
import json, os, re, time, urllib.request

API = "https://bdl.stat.gov.pl/api/v1/"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)", "Accept": "application/json"}

def get(path):
    for attempt in range(6):
        try:
            return json.loads(urllib.request.urlopen(urllib.request.Request(API + path, headers=UA), timeout=120).read())
        except urllib.error.HTTPError as e:
            if e.code == 429: time.sleep(20 * (attempt + 1)); continue
            raise
    raise RuntimeError("rate limited: " + path)

def all_pages(path):
    out, page = [], 0
    while True:
        d = get(f"{path}&page={page}&page-size=100")
        out += d.get("results", [])
        if not d.get("links", {}).get("next"): return out
        page += 1; time.sleep(1.2)

BANDS = {"ogółem": "all", "do 40 m2": "le40", "od 40,1 do 60 m2": "40to60", "od 60,1 do 80 m2": "60to80", "od 80,1 m2": "gt80"}
MARKETS = {"rynek wtórny": "resale", "rynek pierwotny": "new"}

def variables(subject):
    vs = all_pages(f"variables?subject-id={subject}&format=json&lang=pl")
    out = {}
    for v in vs:
        names = [v.get(k) for k in ("n1", "n2", "n3") if v.get(k)]
        q = next((int(n[0]) for n in names if re.match(r"\d kwartał", n)), None)
        m = next((MARKETS[n] for n in names if n in MARKETS), None)
        b = next((BANDS[n] for n in names[::-1] if n in BANDS), None)
        if m and b: out[(q, m, b)] = v["id"]
    return out

def values(var_id, year):
    rows = all_pages(f"data/by-variable/{var_id}?format=json&unit-level=5&year={year}&lang=pl")
    return {r["id"]: (r["name"], r["values"][0]["val"]) for r in rows if r.get("values")}

price_y, count_y = variables("P3787"), variables("P3783")
# the latest year that actually has powiat-level values (a year can be listed
# before its powiat figures are loaded)
fy = max(y for y in get(f"variables/{price_y[(None, 'resale', 'all')]}?format=json&lang=pl")["years"][-3:] if values(price_y[(None, 'resale', 'all')], y))
print("latest year with powiat figures:", fy)

powiats = {}
for m in ("resale", "new"):
    for b in BANDS.values():
        if (None, m, b) not in price_y: continue
        p = values(price_y[(None, m, b)], fy); c = values(count_y[(None, m, b)], fy)
        for uid, (name, val) in p.items():
            n = c.get(uid, (None, None))[1]
            if not val or not n or n < 20: continue
            powiats.setdefault(uid, {"name": name})[f"{m}_{b}"] = {"median": round(val), "sales": int(n)}
        time.sleep(1.2)

# gminas (level 6) → powiat id
gminas = {}
for u in all_pages("units?level=6&format=json&lang=pl"):
    name = re.sub(r"\s*\(\d\)\s*$", "", u["name"]).replace(" - miasto", "").replace(" - obszar wiejski", "").strip()
    gminas.setdefault(name, set()).add(u["parentId"][:9] + "000")   # an urban-rural gmina's parts point at the gmina, not the powiat
powiat_units = {u["id"]: u for u in all_pages("units?level=5&format=json&lang=pl")}
# a gmina's parent is the powiat unit id
gmina_map = {n: sorted(p) for n, p in gminas.items()}

out = {"source": "GUS (Statistics Poland) — Bank Danych Lokalnych: median price per 1 m² of flats sold in market transactions",
       "sourceUrl": "https://bdl.stat.gov.pl/bdl/dane/podgrup/temat/K48",
       "year": str(fy), "minSales": 20,
       "powiats": powiats, "gminas": gmina_map}
krk = next(v for v in powiats.values() if v["name"] == "Powiat m. Kraków")
assert krk.get("resale_all"), "format changed"
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "polandPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(powiats), "powiats with figures; Kraków", krk)
