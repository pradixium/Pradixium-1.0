#!/usr/bin/env python3
"""Portugal: INE local housing rents → lib/data/portugalRents.json

INE indicator 0014696 — "Valor mediano das rendas de novos contratos de
arrendamento de alojamentos familiares nos últimos 12 meses (Metodologia
2026 - €/m²) por Localização geográfica (NUTS - 2024); Trimestral" (INE,
Estatísticas de Rendas da Habitação ao nível local; from the rental
contracts declared to the Tax Authority). Every municipality (308) and the
parishes INE publishes; the same quarter a year earlier for the change.
INE leaves a cell empty where too few contracts were signed.
Run each quarter:  python3 scripts/build-pt-rents.py
"""
import json, os, time, urllib.request, datetime
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
def get(u):
    # INE resets connections now and then → retry
    for i in range(6):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=240).read())
        except Exception:
            if i == 5: raise
            time.sleep(8 * (i + 1))
VAR = "0014696"
meta = get(f"https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd={VAR}&lang=PT"); meta = meta[0] if isinstance(meta, list) else meta
periods = sorted(k.split("_")[-1] for c in meta["Dimensoes"]["Categoria_Dim"] for k in c if k.startswith("Dim_Num1_"))
latest = periods[-1]; year_ago = f"S5A{int(latest[3:7]) - 1}{latest[7]}"
def load(p):
    d = get(f"https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd={VAR}&Dim1={p}&lang=PT"); d = d[0] if isinstance(d, list) else d
    return {r["geocod"]: (r["geodsg"], float(r["valor"])) for r in list(d["Dados"].values())[0] if r.get("valor") not in (None, "", "x", "-")}
now, ago = load(latest), load(year_ago)
areas = {}
for code, (name, v) in now.items():
    prev = ago.get(code, (None, None))[1]
    areas[code] = {"name": name, "rentEurPerM2": v, "yoyPercent": round((v / prev - 1) * 100, 1) if prev else None}
q = lambda p: f"Q{p[7]} {p[3:7]}"
out = {"source": "INE Portugal — " + meta["IndicadorNome"], "sourceUrl": f"https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores&indOcorrCod={VAR}&contexto=bd&selTab=tab2",
       "period": q(latest), "comparedWith": q(year_ago), "built": datetime.date.today().isoformat(), "areas": areas}
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "portugalRents.json")
json.dump(out, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(q(latest), len(areas), "areas;", "Lisboa", areas.get("1A01106"), "Porto", areas.get("11A1312"))
