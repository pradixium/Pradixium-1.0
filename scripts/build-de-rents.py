#!/usr/bin/env python3
"""Germany: Zensus 2022 (Statistische Ämter des Bundes und der Länder,
reference date 15 May 2022) — average net cold rent (Nettokaltmiete) per m²
of let dwellings, per municipality (Gemeinde), from the official
"Regionaltabelle Gebäude und Wohnungen". All existing tenancies — not the
rents of new lettings. One-off census: re-run only if the table is revised.
  pip install openpyxl && python3 scripts/build-de-rents.py
"""
import io, json, os, urllib.request
import openpyxl

URL = "https://www.destatis.de/static/DE/zensus/gitterdaten/Regionaltabelle_Gebaeude_Wohnungen.xlsx"
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read()
ws = openpyxl.load_workbook(io.BytesIO(raw), read_only=True)["CSV-Wohnungen"]
rows = ws.iter_rows(values_only=True)
h = next(rows)
col = {k: i for i, k in enumerate(h)}
num = lambda v: float(v) if isinstance(v, (int, float)) else None
LAND = {}
out = {"source": "Zensus 2022 (Statistische Ämter des Bundes und der Länder) — Regionaltabelle Gebäude und Wohnungen: durchschnittliche Nettokaltmiete je m²",
       "sourceUrl": "https://www.zensus2022.de/DE/Ergebnisse-des-Zensus/_inhalt.html", "file": URL, "date": "15 May 2022", "municipalities": {}, "districts": {}}
for r in rows:
    ars, name, level = str(r[col["_RS"]]), r[col["Name"]], r[col["Regionalebene"]]
    rent, let = num(r[col["QMMIETE"]]), num(r[col["NUTZUNG__02"]])
    if level == "Land": LAND[ars] = name
    if rent is None: continue
    e = {"name": name, "rent": round(rent, 2), "letDwellings": int(let) if let else None}
    if level == "Gemeinde" and len(ars) == 12:
        out["municipalities"][ars[:5] + ars[9:]] = {**e, "land": LAND.get(ars[:2])}   # AGS = ARS without the Verband code
    elif len(ars) == 5:
        out["districts"][ars] = {**e, "land": LAND.get(ars[:2])}
koeln = out["municipalities"].get("05315000")
assert koeln and koeln["rent"] > 0, "format changed"
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "germany", "rents.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out["municipalities"]), "municipalities,", len(out["districts"]), "districts; Köln", koeln, "Berlin", out["municipalities"].get("11000000"), "München", out["municipalities"].get("09162000"))
