#!/usr/bin/env python3
"""Iceland: HMS (Húsnæðis- og mannvirkjastofnun) — Kaupskrá fasteigna, the
register of every recorded purchase agreement (price in thousand ISK, unit
floor area, postcode, municipality, type), published daily as open data.
Kept: agreements HMS itself marks usable (ONOTHAEFUR_SAMNINGUR = 0 — HMS
excludes sales between relatives, several properties in one agreement,
financial-institution sales, payment in kind, partial sales, missing
information) of finished homes (FULLBUID = 1), 12 months to the latest
agreement date. Median ISK per m² per postcode and per municipality for
flats (Fjölbýli), detached houses (Einbýli) and other single-family houses
(Sérbýli: semi-detached / terraced); a figure needs 10+ sales.
Re-run monthly:  python3 scripts/build-is-prices.py
"""
import csv, io, json, os, statistics, urllib.request
from datetime import date, timedelta

URL = "https://frs3o1zldvgn.objectstorage.eu-frankfurt-1.oci.customer-oci.com/n/frs3o1zldvgn/b/public_data_for_download/o/kaupskra.csv"
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read()
rows = list(csv.DictReader(io.StringIO(raw.decode("latin1")), delimiter=";"))
last = max(r["UTGDAG"][:10] for r in rows)
start = (date.fromisoformat(last) - timedelta(days=365)).isoformat()
TYPES = {"Fjölbýli": "flats", "Einbýli": "detached", "Sérbýli": "semi"}

def q(a, p):
    a = sorted(a); i = (len(a) - 1) * p; lo = int(i); hi = min(lo + 1, len(a) - 1)
    return a[lo] + (a[hi] - a[lo]) * (i - lo)

groups = {}
for r in rows:
    if r["UTGDAG"][:10] <= start or r["ONOTHAEFUR_SAMNINGUR"] != "0" or r["FULLBUID"] != "1": continue
    t = TYPES.get(r["TEGUND"])
    if not t: continue
    try: area = float(r["EINFLM"]); price = int(r["KAUPVERD"]) * 1000
    except ValueError: continue
    if area < 20 or price <= 0: continue
    ppm = price / area
    if not 50_000 <= ppm <= 3_000_000: continue
    muni = r["SVEITARFELAG"].strip()
    for key in (("pc", r["POSTNR"].strip()), ("muni", muni)):
        g = groups.setdefault(key, {"names": set()})
        g["names"].add(muni)
        g.setdefault(t, []).append(ppm)

def summary(v):
    return {"median": round(statistics.median(v)), "p25": round(q(v, .25)), "p75": round(q(v, .75)), "sales": len(v)} if len(v) >= 10 else {"sales": len(v)}

out = {"source": "HMS (Húsnæðis- og mannvirkjastofnun) — Kaupskrá fasteigna (purchase agreement register)",
       "sourceUrl": "https://hms.is/gogn-og-maelabord/grunngogntilnidurhals/kaupskra-fasteigna",
       "from": start, "to": last, "postcodes": {}, "municipalities": {}}
for (kind, key), g in groups.items():
    e = {t: summary(g[t]) for t in ("flats", "detached", "semi") if t in g}
    if kind == "pc": e["municipalities"] = sorted(g["names"]); out["postcodes"][key] = e
    else: out["municipalities"][key] = e
assert out["municipalities"].get("Reykjavíkurborg", {}).get("flats", {}).get("median"), "format changed"
dst = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "icelandPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(start, "→", last, len(out["postcodes"]), "postcodes,", len(out["municipalities"]), "municipalities; Reykjavík", out["municipalities"]["Reykjavíkurborg"])
