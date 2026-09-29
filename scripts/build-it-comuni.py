#!/usr/bin/env python3
"""Italy: municipality list with cadastral codes (codcom) as the Agenzia
delle Entrate's OMI service knows them (zoneomi.php richiesta=1/2), for
lib/italy/omi.js. Re-run when municipalities merge (rare).
  python3 scripts/build-it-comuni.py
"""
import json, os, time, urllib.request
B = "https://www1.agenziaentrate.gov.it/servizi/geopoi_omi/zoneomi.php"
get = lambda q: json.loads(urllib.request.urlopen(urllib.request.Request(f"{B}?{q}", headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=60).read())
out = []
for p in get("richiesta=1"):
    for c in get(f"richiesta=2&prov={p['PROVINCIA']}"):
        out.append([c["DIZIONE"], c["CODCOM"], p["PROVINCIA"]])
    time.sleep(0.1)
path = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "italyComuni.json")
json.dump({"source": "Agenzia delle Entrate — OMI (zoneomi.php)", "built": time.strftime("%Y-%m-%d"), "comuni": out}, open(path, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "comuni ->", path)
