#!/usr/bin/env python3
"""City of Zurich: median sale price per m² of living area (and per flat) of
condominium flats (Stockwerkeigentum) sold in free sale (Freihandkauf), by
Stadtkreis and Stadtquartier, latest year → lib/data/zurichCondoPrices.json

Source: Statistik Stadt Zürich, open data BAU515OD5157 ("Verkaufspreise
(Median) pro Wohnung und pro Quadratmeter Wohnungsfläche im
Stockwerkeigentum, nach Quartier"), data.stadt-zuerich.ch, yearly.
Small areas publish the number of sales only as a range ("2-6") → such an
area is kept only as a name that falls back to its Kreis; an area is used
with 10+ counted sales. Run each year:  python3 scripts/build-zh-condo.py
"""
import csv, io, json, os, urllib.request, datetime
URL = "https://data.stadt-zuerich.ch/dataset/bau_hae_preis_stockwerkeigentum_stadtquartier_od5157/download/BAU515OD5157.csv"
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read().decode("utf-8-sig")
rows = list(csv.DictReader(io.StringIO(raw)))
year = max(r["Stichtagdatjahr"] for r in rows if r["HAPreisWohnflaeche"])
areas = []
for r in rows:
    if r["Stichtagdatjahr"] != year: continue
    code = r["RaumCd"]; n = r["AnzHA"].strip()
    count = int(n) if n.isdigit() else None
    areas.append({"code": code, "name": r["RaumLang"], "level": "city" if code == "0" else "kreis" if len(code) <= 2 else "quartier",
                  "kreis": None if code == "0" else (code if len(code) <= 2 else str(int(code[:2]))), "sales": count, "salesText": n,
                  "perM2": int(r["HAPreisWohnflaeche"]) if r["HAPreisWohnflaeche"] else None, "perFlat": int(r["HAMedianPreis"]) if r["HAMedianPreis"] else None})
doc = {"source": "Statistik Stadt Zürich — Verkaufspreise (Median) von Wohnungen im Stockwerkeigentum nach Quartier (open data BAU515OD5157)",
       "sourceUrl": "https://data.stadt-zuerich.ch/dataset/bau_hae_preis_stockwerkeigentum_stadtquartier_od5157",
       "year": year, "built": datetime.date.today().isoformat(), "areas": areas}
path = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "zurichCondoPrices.json")
json.dump(doc, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("ok", year, len(areas))
