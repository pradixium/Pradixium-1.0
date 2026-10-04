#!/usr/bin/env python3
"""Spain: official rents from MIVAU's SERPAVI database ("Sistema Estatal
Índices Alquiler de Vivienda", tax-source exploitation of Modelo 100
rental income for HABITUAL-residence lets, rentals to relatives excluded)
→ lib/data/spainRents.json.

Per municipality and census section, latest year: median + p25/p75 rent in
€ per m² a month and the number of let homes, separately for flats
(VC: vivienda colectiva) and houses (VU: unifamiliar o rural). Area = the
Catastro's built area (same basis as the Catastro value zones).
Download (browser User-Agent; the page lists it under "Descarga de datos"):
  https://cdn.mivau.gob.es/portal-web-mivau/vivienda/serpavi/<file>.xlsx
  python3 scripts/build-es-rents.py <bd_SERPAVI_2011-YYYY.xlsx>
Re-run each spring when MIVAU adds a year. Reuse: MIVAU aviso legal —
commercial reuse allowed, cite the source and the date of last update.
"""
import json, os, re, sys, time
import openpyxl
src = sys.argv[1]
wb = openpyxl.load_workbook(src, read_only=True)
def sheet(name, key):
    ws = wb[name]; rows = ws.iter_rows(values_only=True); h = list(next(rows))
    years = sorted({int(m.group(1)) for c in h if c and (m := re.match(r"ALQM2_LV_M_VC_(\d\d)$", str(c)))})
    y = years[-1]; ix = {c: i for i, c in enumerate(h)}
    out = {}
    for r in rows:
        code = r[ix[key]]
        if code is None: continue
        rec = {}
        num = lambda v: v if isinstance(v, (int, float)) else None
        for t in ("VC", "VU"):
            med = num(r[ix[f"ALQM2_LV_M_{t}_{y}"]]); n = num(r[ix[f"BI_ALVHEPCO_TV{t[1]}_{y}"]])
            lo, hi = num(r[ix[f"ALQM2_LV_25_{t}_{y}"]]), num(r[ix[f"ALQM2_LV_75_{t}_{y}"]])
            if med is None or not n or lo is None or hi is None: continue
            rec["flat" if t == "VC" else "house"] = [round(med, 2), round(lo, 2), round(hi, 2), int(n)]
        if rec: out[str(code).zfill(5 if key == "CUMUN" else 10)] = rec
    return 2000 + y, out
year, muni = sheet("Municipios", "CUMUN")
y2, secc = sheet("Secciones censales", "CUSEC")
assert year == y2
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "spainRents.json")
json.dump({"source": "MIVAU — Sistema Estatal de Referencia del Precio del Alquiler de Vivienda (SERPAVI), base de datos 2011–%d" % year,
           "sourceUrl": "https://www.mivau.gob.es/vivienda/alquila-bien-es-tu-derecho/serpavi", "file": os.path.basename(src),
           "lastUpdate": "2026-07-08", "year": year, "built": time.strftime("%Y-%m-%d"), "municipalities": muni, "sections": secc},
          open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(muni), "municipalities", len(secc), "sections")
