#!/usr/bin/env python3
"""Portugal: INE local housing prices → lib/data/portugalPrices.json

INE indicator 0012241 — "Valor mediano das vendas de alojamentos familiares
nos últimos 12 meses (Metodologia 2022 - €/m²) por Localização geográfica
(NUTS - 2024) e Tipologia do fogo; Trimestral" (Estatísticas de Preços da
Habitação ao nível local). Actual sales (tax records), median €/m², last 12
months. INE's own note: parish detail (and the bedroom split) exists only for the
Lisbon and Porto metropolitan areas, the Algarve and other municipalities
with more than 100,000 inhabitants. Indicator 0012236 adds the all-dwellings
median for every other municipality (see below).
Run each quarter:  python3 scripts/build-pt-prices.py
"""
import json, os, urllib.request, datetime
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
def get(u):
    # INE resets connections now and then → retry
    for i in range(5):
        try: return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=180).read())
        except Exception:
            if i == 4: raise
            __import__("time").sleep(5 * (i + 1))
meta = get("https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=0012241&lang=PT"); meta = meta[0] if isinstance(meta, list) else meta
periods = sorted(k.split("_")[-1] for c in meta["Dimensoes"]["Categoria_Dim"] for k in c if k.startswith("Dim_Num1_"))
latest = periods[-1]; year_ago = f"S5A{int(latest[3:7]) - 1}{latest[7]}"
def load(p):
    d = get(f"https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012241&Dim1={p}&lang=PT"); d = d[0] if isinstance(d, list) else d
    rows = list(d["Dados"].values())[0]; label = list(d["Dados"].keys())[0]
    out = {}
    for r in rows:
        if r.get("valor") in (None, "", "x", "-"): continue
        g = out.setdefault(r["geocod"], {"name": r["geodsg"], "code": r["geocod"], "level": {1: "country-part", 2: "region", 3: "NUTS3", 7: "municipality", 9: "parish"}.get(len(r["geocod"]), "other"), "byType": {}})
        g["byType"][r["dim_3_t"]] = int(float(r["valor"]))
    return label, out
lab, now = load(latest); lab0, ago = load(year_ago)
# INE 0012236 — the same median (all family dwellings, last 12 months) for
# EVERY municipality (and the same parishes), split by buyer sector: its
# "Total" equals 0012241's "Total" wherever both exist (checked: Cascais
# 4,687, Braga 2,100, Tavira 3,152, Funchal 3,322, Q1 2026). Areas missing
# from 0012241 are added with the all-dwellings figure only (no bedrooms).
def load_all(p):
    d = get(f"https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012236&Dim1={p}&lang=PT"); d = d[0] if isinstance(d, list) else d
    return {r["geocod"]: (r["geodsg"], int(float(r["valor"]))) for r in list(d["Dados"].values())[0] if r.get("dim_3_t") == "Total" and r.get("valor") not in (None, "", "x", "-")}
all_now, all_ago = load_all(latest), load_all(year_ago)
added = 0
for code, (name, v) in all_now.items():
    if code in now: continue
    now[code] = {"name": name, "code": code, "level": {1: "country-part", 2: "region", 3: "NUTS3", 7: "municipality", 9: "parish"}.get(len(code), "other"), "byType": {"Total": v}, "allTypesOnly": True}
    if code in all_ago: ago.setdefault(code, {"byType": {"Total": all_ago[code][1]}})
    added += 1
print("added from 0012236:", added)
for code, g in now.items():
    t0 = ago.get(code, {}).get("byType", {}).get("Total"); t1 = g["byType"].get("Total")
    g["yoyPercent"] = round((t1 / t0 - 1) * 100, 1) if t0 and t1 else None
    if g["level"] == "parish": g["municipality"] = now.get(code[:7], {}).get("name")
    if g["level"] in ("municipality", "parish"): g["nuts3"] = now.get(code[:3], {}).get("name")
doc = {"source": "INE Portugal — Estatísticas de Preços da Habitação ao nível local (indicators 0012241 / 0012236)",
       "sourceUrl": "https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_indicadores&indOcorrCod=0012241&contexto=bd&selTab=tab2",
       "period": lab, "periodCode": latest, "comparedWith": lab0, "unit": "EUR/m2 (median of sales in the 12 months to the period)",
       "built": datetime.date.today().isoformat(), "areas": list(now.values())}
path = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "portugalPrices.json")
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok", lab, len(now), "areas ->", os.path.getsize(path) // 1024, "KB")
