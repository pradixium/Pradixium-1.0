#!/usr/bin/env python3
"""Latvia: VZD (State Land Service) — "Latvijas Nekustamā īpašuma tirgus
statistiskie rādītāji" (data.gov.lv dataset tirgus-statistika, CC BY 4.0),
from the sales registered in the Land Register: per city / town / parish,
the number of sales used and the MEDIAN WHOLE PRICE (EUR) of
  - apartments by number of rooms (1, 2, 3, 4 — "istabu dzīvokļi"),
  - individual houses by floor-area band (to 40, 40–60, 60–110, 110–180,
    180–250, over 250 m²),
for the last two full years. VZD prepares them automatically, without
reviewing each sale (its own words) and shows a territory only with 3+
sales → the site uses them as context, never as the benchmark.
→ lib/data/latviaPrices.json. Re-run each February (VZD rolls the years on
1 February):  python3 scripts/build-lv-prices.py
"""
import csv, io, json, os, re, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
pkg = json.loads(get("https://data.gov.lv/dati/api/3/action/package_show?id=tirgus-statistika"))["result"]

SERIES = {}
for r in pkg["resources"]:
    n = re.sub(r"\s+", " ", r["name"]).strip()
    if not n.endswith("(gads)"): continue
    m = re.match(r"(\d)-istabu dzīvokļi", n)
    if m: SERIES[f"flats_{m.group(1)}"] = r["url"]; continue
    m = re.match(r"Dzīvojamās mājas (līdz 40m²|no (\d+)m² līdz (\d+)m²|virs 250m²)", n)
    if m: SERIES["houses_" + ("0_40" if m.group(1).startswith("līdz") else "250_" if m.group(1).startswith("virs") else f"{m.group(2)}_{m.group(3)}")] = r["url"]
assert len(SERIES) == 10, sorted(SERIES)

places, years = {}, None
for key, url in SERIES.items():
    rows = list(csv.reader(io.StringIO(get(url).decode("utf-8-sig"))))
    head = rows[0]
    ys = sorted({m.group(1) for h in head for m in [re.search(r"_Mediana_(\d{4})$", h)] if m})
    assert len(ys) == 2, (key, ys)
    years = years or ys
    assert ys == years, (key, ys, years)
    col = lambda stat, y: next(i for i, h in enumerate(head) if re.search(rf"_{stat}_{y}$", h, re.I))
    for r in rows[1:]:
        novads, terr = r[0].strip(), r[1].strip()
        if "kopā" in terr and terr != "Rīga kopā": continue          # municipality totals
        name = "Rīga" if terr == "Rīga kopā" else terr
        e = places.setdefault(f"{novads}|{name}", {"novads": novads, "name": name})
        for y in ys:
            med, cnt = r[col("Mediana", y)], r[col("Izmantotais_dar_sk", y)]
            if med and cnt: e.setdefault(key, {})[y] = {"median": round(float(med)), "sales": int(cnt)}

riga = places["Rīga|Rīga"]
assert riga["flats_2"][years[1]]["sales"] > 1000, riga
out = {"source": "VZD (State Land Service of Latvia) — Latvian real estate market statistical indicators, from sales registered in the Land Register",
       "sourceUrl": "https://data.gov.lv/dati/lv/dataset/tirgus-statistika", "year": years[1], "previous": years[0],
       "places": list(places.values())}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "latviaPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(places), "places; Rīga", {k: v.get(years[1]) for k, v in riga.items() if isinstance(v, dict)})
