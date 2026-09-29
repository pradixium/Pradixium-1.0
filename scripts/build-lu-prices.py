#!/usr/bin/env python3
"""Luxembourg: Ministère du Logement — Observatoire de l'Habitat, "Prix de
vente des appartements — Par commune" (data.public.lu, CC0): number of
sales and the registered average price per m² of existing apartments and
of off-plan (VEFA) apartments, per commune, over the last 12 months.
Built from the deeds (full ownership, grouped sales of several apartments
excluded); the Observatoire hides the price below 10 sales ("*").
Houses are not published per commune. Re-run each quarter:
  pip install xlrd && python3 scripts/build-lu-prices.py
"""
import json, os, re, urllib.request
import xlrd

API = "https://data.public.lu/api/1/datasets/prix-de-vente-des-appartements-par-commune/"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()

ds = json.loads(get(API))
res = next(r for r in ds["resources"] if "12 derniers mois" in r["title"])
book = xlrd.open_workbook(file_contents=get(res["url"]))
sh = book.sheet_by_index(0)

title = " ".join(str(c.value) for c in sh.row(2) if str(c.value).strip())
m = re.search(r"du (.+?) au (.+?\d{4})", title)
period = f"{m.group(1)} – {m.group(2)}" if m else None
num = lambda v: float(v) if isinstance(v, (int, float)) and v != "" else None

communes = {}
for i in range(sh.nrows):
    cells = [c.value for c in sh.row(i)]
    j = next((k for k, v in enumerate(cells) if isinstance(v, str) and v.strip()), None)
    if j is None or len(cells) < j + 6:
        continue
    name = cells[j].strip()
    sales = num(cells[j + 1])
    if sales is None or name.lower().startswith(("total", "commune")):
        continue
    communes[name] = {
        "sales": int(sales), "avg": round(num(cells[j + 2])) if num(cells[j + 2]) else None,
        "range": cells[j + 3] if isinstance(cells[j + 3], str) and "€" in cells[j + 3] else None,
        "vefaSales": int(num(cells[j + 4]) or 0), "vefaAvg": round(num(cells[j + 5])) if num(cells[j + 5]) else None,
    }

assert "Luxembourg-Ville" in communes and communes["Luxembourg-Ville"]["avg"], "format changed"
out = {"period": period, "source": "Ministère du Logement — Observatoire de l'Habitat, Prix de vente des appartements par commune",
       "sourceUrl": ds["page"], "file": res["url"], "communes": communes}
dst = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "luxembourgPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, indent=0)
print(len(communes), "communes,", sum(1 for c in communes.values() if c["avg"]), "with a price;", period)
