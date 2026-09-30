#!/usr/bin/env python3
"""Hungary: KSH (Hungarian Central Statistical Office), used-home market
(from NAV duty data on all registered sales):
  - STADAT lak0028: average price per m² (thousand HUF) by region and
    building type, latest year — Budapest flats in multi-unit buildings
    ("többlakásos") and houses/terraced houses ("családi ház, sorház");
  - the quarterly release "Lakáspiaci árak, lakásárindex": average price per
    m² of used homes in each county seat (houses and flats TOGETHER) with its
    change on a year earlier, and Budapest's change.
→ lib/data/hungaryPrices.json. Re-run with the next release's slug:
  python3 scripts/build-hu-prices.py 2026-i-negyedev
"""
import html, json, os, re, sys, urllib.request

REL = sys.argv[1] if len(sys.argv) > 1 else "2026-i-negyedev"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()

def stadat(table):
    raw = get(f"https://www.ksh.hu/stadat_files/lak/hu/{table}.html")
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000])
    t = raw.decode(m.group(1).decode() if m else "iso-8859-2", "replace")
    rows = []
    for r in re.findall(r"<tr.*?</tr>", t, flags=re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, flags=re.S)]
        if cells: rows.append(cells)
    return rows

num = lambda s: int(s.replace("\xa0", "").replace(" ", "")) if re.fullmatch(r"[\d\s\xa0]+", s or "") else None
t28 = stadat("lak0028")
year = t28[0][-1]
assert re.fullmatch(r"20\d\d", year), t28[0]
# the table holds "Használt lakások" (used homes) first, then "Új lakások"
# (new homes) — only the used-home section
used = []
for r in t28:
    if len(r) == 1 and "Új lakások" in r[0]: break
    used.append(r)
bud = {r[1]: num(r[-1]) for r in used if r[0] == "Budapest" and len(r) > 2}
assert bud.get("többlakásos") and bud.get("családi ház, sorház"), bud

pub = get(f"https://www.ksh.hu/s/kiadvanyok/lakaspiaci-arak-lakasarindex-{REL}/index.html").decode("utf-8", "replace")
txt = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", pub, flags=re.S))))
title = re.search(r"Lakáspiaci árak, lakásárindex, (\d{4}\. [IV]+\. negyedév)", txt).group(1)
tab = re.search(r"Vármegyeszékhely Átlagos négyzetméterár ezer forint a (\d{4} [IV]+\. negyedévi) ár %-ában (.*?) A balatoni", txt)
seats = {}
for name, v, idx in re.findall(r"([A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:[- ][A-ZÁÉÍÓÖŐÚÜŰ]?[a-záéíóöőúüű]+)?) (\d[\d ]*) (\d+,\d)", tab.group(2)):
    seats[name] = {"value": int(v.replace(" ", "")) * 1000, "yoy": round(float(idx.replace(",", ".")) - 100, 1)}
bp = re.search(r"Budapesten (\d+,\d), a vármegyeszékhelyeken", txt)
assert len(seats) >= 18, seats
out = {"source": "KSH (Hungarian Central Statistical Office) — used-home prices from NAV duty data on registered sales",
       "sourceUrl": f"https://www.ksh.hu/s/kiadvanyok/lakaspiaci-arak-lakasarindex-{REL}/index.html",
       "stadatUrl": "https://www.ksh.hu/stadat_files/lak/hu/lak0028.html",
       "year": year, "quarter": title, "comparedWith": tab.group(1),
       "budapest": {"flats": bud["többlakásos"] * 1000, "houses": bud["családi ház, sorház"] * 1000,
                    "panel": bud["lakótelep"] * 1000 if bud.get("lakótelep") else None,
                    "yoy": float(bp.group(1).replace(",", ".")) if bp else None},
       "countySeats": seats}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "hungaryPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, indent=1)
print(json.dumps(out, ensure_ascii=False)[:1500])
