#!/usr/bin/env python3
"""Builds lib/data/australiaPrices.json — Australian Bureau of Statistics:
median price of residential property TRANSFERS (sales) by dwelling type,
per Greater Capital City (GCCSA) and rest of each state, quarterly
(ABS "Residential Dwellings: Unstratified Medians and Transfer Counts by
Dwelling Type, GCCSA and Rest of State", data API dataflow RES_DWELL),
plus a suburb/locality → GCCSA lookup from ABS's own ASGS Edition 3
allocation files (MB_2021_AUST + SAL_2021_AUST, joined on mesh block; a
suburb counts only when 95%+ of its area lies in one GCCSA).

  python3 scripts/build-au-prices.py          (re-run each quarter)

The medians are UNSTRATIFIED (ABS: not adjusted for the mix of homes
sold) — stated in the report.
"""
import csv, io, json, re, sys, pathlib, collections, urllib.request
import openpyxl

ALLOC = "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/allocation-files/"
DATA = "https://data.api.abs.gov.au/rest/data/ABS,RES_DWELL,1.0.0/all?startPeriod={}&format=csvfilewithlabels"
TMP = pathlib.Path("/tmp/claude-0")

def fetch(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "Pradixium/1.0"})
    b = urllib.request.urlopen(req, timeout=300).read()
    if dest: dest.write_bytes(b)
    return b

def rows(path):
    it = openpyxl.load_workbook(path, read_only=True).worksheets[0].iter_rows(values_only=True)
    hdr = next(it)
    for r in it:
        yield dict(zip(hdr, r))

mb_x, sal_x = TMP / "MB_2021_AUST.xlsx", TMP / "SAL_2021_AUST.xlsx"
if not mb_x.exists(): fetch(ALLOC + "MB_2021_AUST.xlsx", mb_x)
if not sal_x.exists(): fetch(ALLOC + "SAL_2021_AUST.xlsx", sal_x)

mb_g, regions = {}, collections.defaultdict(set)
for r in rows(mb_x):
    mb_g[r["MB_CODE_2021"]] = (r["GCCSA_CODE_2021"], r["STATE_NAME_2021"])
    # SA4 / SA3 regions nest exactly inside one GCCSA ("Gold Coast", "Sunshine Coast")
    for lvl in ("SA4_NAME_2021", "SA3_NAME_2021"):
        if r[lvl]: regions[r[lvl]].add((r["STATE_NAME_2021"], r["GCCSA_CODE_2021"]))
area = collections.defaultdict(lambda: collections.Counter())
state_of = {}
for r in rows(sal_x):
    g = mb_g.get(r["MB_CODE_2021"])
    if not g: continue
    area[r["SAL_NAME_2021"]][g[0]] += float(r["AREA_ALBERS_SQKM"] or 0)
    state_of[r["SAL_NAME_2021"]] = r["STATE_NAME_2021"]

places = collections.defaultdict(list)   # plain name → [{state, gccsa}]
mixed = 0
for name, c in area.items():
    tot = sum(c.values()); g, a = c.most_common(1)[0]
    if not tot or a / tot < 0.95 or not re.match(r"^\d[A-Z]", g): mixed += 1; continue
    plain = re.sub(r"\s*\([^)]*\)$", "", name).strip()   # "Richmond (Vic.)" → "Richmond"
    places[plain].append({"state": state_of[name], "g": g})

# capital-city names → their Greater Capital City area; SA4/SA3 region
# names where a suburb of that name does not exist
CAPITALS = {"Sydney": ("New South Wales", "1GSYD"), "Melbourne": ("Victoria", "2GMEL"), "Brisbane": ("Queensland", "3GBRI"),
            "Adelaide": ("South Australia", "4GADE"), "Perth": ("Western Australia", "5GPER"), "Hobart": ("Tasmania", "6GHOB"),
            "Darwin": ("Northern Territory", "7GDAR"), "Canberra": ("Australian Capital Territory", "8ACTE")}
for n, (st, g) in CAPITALS.items():
    places[n] = [{"state": st, "g": g}] + [x for x in places.get(n, []) if x["state"] != st]
for n, s_ in regions.items():
    plain = re.sub(r"\s*\([^)]*\)$", "", n).replace(" - ", " ").strip()
    if plain not in places and len(s_) == 1 and re.match(r"^\d[A-Z]", next(iter(s_))[1]):
        st, g = next(iter(s_)); places[plain] = [{"state": st, "g": g}]

# the medians: latest quarter + the same quarter a year earlier
start = f"{int(sys.argv[1]) if len(sys.argv) > 1 else 2025}-Q1"
data = list(csv.DictReader(io.StringIO(fetch(DATA.format(start)).decode("utf-8-sig"))))
quarters = sorted({r["TIME_PERIOD"] for r in data})
latest = quarters[-1]
year_ago = f"{int(latest[:4]) - 1}{latest[4:]}"
M = {"1": "houseN", "2": "attachedN", "3": "houseMedian", "4": "attachedMedian"}
areas = {}
for r in data:
    if r["TIME_PERIOD"] not in (latest, year_ago) or not r["OBS_VALUE"]: continue
    a = areas.setdefault(r["REGION"], {"name": r["Region"], "now": {}, "prev": {}})
    v = float(r["OBS_VALUE"]) * (10 ** int(r["UNIT_MULT"] or 0))
    (a["now"] if r["TIME_PERIOD"] == latest else a["prev"])[M[r["MEASURE"]]] = round(v)
    if r["TIME_PERIOD"] == latest: a["status"] = r["OBS_STATUS"] or ""

out = {"source": "Australian Bureau of Statistics — Residential Dwellings: unstratified medians and transfer counts by dwelling type, GCCSA and rest of state (RES_DWELL)",
       "sourceUrl": "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings",
       "period": latest, "yearAgo": year_ago, "areas": areas, "places": places}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/australiaPrices.json"
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(latest, len(areas), "areas;", len(places), "place names;", mixed, "suburbs split across areas dropped")
