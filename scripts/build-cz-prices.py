#!/usr/bin/env python3
"""Czech Republic: ČSÚ — Ceny nemovitostí 2023–2025, Tab. 1 "Průměrné kupní
ceny nemovitostí v krajích a okresech" (Kč/m²), from the ČÚZK cadastre's
registered sale prices. Flats: total price ÷ total floor area. Family houses:
the house's share of the sale ÷ HABITABLE area (obytná plocha) — a
different basis from what a buyer enters, so the site uses it as context.
Re-run each July when ČSÚ publishes the next three-year edition (update URL):
  pip install openpyxl && python3 scripts/build-cz-prices.py
"""
import io, json, os, urllib.request
import openpyxl

URL = "https://csu.gov.cz/docs/107823/0dc51dfa-22cd-d7b7-1dbb-29198fc9cf6a/Tab1_ceny_nemovitosti_kraje_okresy_2023_2025.xlsx?version=1.0"
KRAJE = {"Hlavní město Praha", "Středočeský", "Jihočeský", "Plzeňský", "Karlovarský", "Ústecký", "Liberecký", "Královéhradecký",
         "Pardubický", "Vysočina", "Jihomoravský", "Olomoucký", "Zlínský", "Moravskoslezský"}
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read()
rows = list(openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))
years = [str(c).strip() for c in rows[3][1:5]]
assert years[:3] == ["2023", "2024", "2025"], years
num = lambda v: int(str(v).replace(" ", "")) if str(v).strip().replace(" ", "").isdigit() else None
out = {"source": "Český statistický úřad (ČSÚ) — Ceny nemovitostí 2023–2025, average purchase prices by region and district (from ČÚZK cadastre sale prices)",
       "sourceUrl": "https://csu.gov.cz/produkty/ceny-nemovitosti", "file": URL, "year": years[2], "previous": years[1],
       "districts": {}, "regions": {}, "national": None}
for r in rows[4:]:
    name = str(r[0] or "").strip()
    if not name: continue
    e = {"houses": {y: num(v) for y, v in zip(years[:3], r[1:4])}, "flats": {y: num(v) for y, v in zip(years[:3], r[5:8])}}
    if name == "Česko": out["national"] = e
    elif name in KRAJE: out["regions"][name] = e
    elif e["flats"][years[2]] or e["houses"][years[2]]: out["districts"][name] = e
prg = out["regions"]["Hlavní město Praha"]
out["districts"]["Praha"] = prg          # Prague is a region and a district
assert prg["flats"]["2025"] == 131520 or prg["flats"]["2025"], "format changed"
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "czechPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out["districts"]), "districts,", len(out["regions"]), "regions; Praha", prg, "Brno-město", out["districts"].get("Brno-město"))
