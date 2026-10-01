#!/usr/bin/env python3
"""Builds lib/data/dubaiSales.json from the Dubai Land Department's
"Transactions" export (dubailand.gov.ae/en/open-data/real-estate-data/,
downloaded in a normal browser — the portal does not answer servers).

  python3 scripts/build-dubai-sales.py transactions-*.csv|.xlsx [more files…]

Accepts the CSV as downloaded, or the same CSV opened and saved in Excel
(.xlsx with each CSV line in column A — a cell split at a comma is joined
back). Each line is parsed on its own; a line that does not give exactly
the 22 DLD columns (Excel breaks the few fields that contain line breaks)
is skipped and counted. Window: the 6 months up to the latest sale.

Rules (all from the file itself, nothing estimated):
 - GROUP_EN "Sales" and PROCEDURE_EN exactly "Sale" (a registered sale of a
   ready property) or "Sell - Pre registration" (an off-plan sale). Left
   out: Delayed Sell (completion of an older contract), Development
   Registration / Sell Development (developer bulk registrations), Lease to
   Own, gifts, mortgages.
 - Residential usage; flats = Unit/Flat, villas = Building/Villa.
 - A TRANSACTION_NUMBER carried by several rows = one deed for several
   properties → dropped.
 - Ready and off-plan are kept SEPARATE (off-plan prices are for a future
   delivery).
 - Flats: median AED per m² of the unit's registered area (PROCEDURE_AREA).
   Villas: median WHOLE price (the registered area of a villa may be the
   plot, not the house) — the per-m² figure is not computed for villas.
 - Groups: DLD area (AREA_EN) and building/project (PROJECT_EN), each by
   type × ready/off-plan; 10+ sales per group. Rooms (Studio, 1 B/R …) for
   flats within an area when 10+.
 - The file carries no names (TOTAL_BUYER / TOTAL_SELLER are counts).
"""
import csv, json, re, sys, statistics, collections, datetime, pathlib

MIN = 10
SALE_PROCS = {"Sale": "ready", "Sell - Pre registration": "offplan"}

HEADER = None
rows, skipped = [], 0
def lines_of(f):
    if f.endswith(".xlsx"):
        import openpyxl
        for r in openpyxl.load_workbook(f, read_only=True).worksheets[0].iter_rows(values_only=True):
            cells = [str(x) for x in r if x is not None]
            if cells: yield ",".join(cells)
    else:
        with open(f, encoding="utf-8-sig") as fh:
            yield from (l.rstrip("\r\n") for l in fh)
for f in sys.argv[1:]:
    for line in lines_of(f):
        if "\n" in line or "\r" in line: skipped += 1; continue
        try: vals = next(csv.reader([line.lstrip("\ufeff")]), [])
        except csv.Error: skipped += 1; continue
        if vals and vals[0] == "TRANSACTION_NUMBER": HEADER = vals; continue
        if len(vals) != 22 or not re.fullmatch(r"\d+-\d+-\d{4}", vals[0]) or not re.fullmatch(r"\d{4}-\d\d-\d\d.*", vals[1]):
            skipped += 1; continue
        rows.append(dict(zip(HEADER, vals)))
latest_all = max(r["INSTANCE_DATE"][:10] for r in rows)
window_from = (datetime.date.fromisoformat(latest_all) - datetime.timedelta(days=183)).isoformat()
rows = [r for r in rows if r["INSTANCE_DATE"][:10] > window_from]
# the same export downloaded twice / overlapping files → one row per (number, area, value, size)
uniq = {}
for r in rows:
    uniq[(r["TRANSACTION_NUMBER"], r["AREA_EN"], r["TRANS_VALUE"], r["PROCEDURE_AREA"], r["PROJECT_EN"])] = r
rows = list(uniq.values())
per_deed = collections.Counter(r["TRANSACTION_NUMBER"] for r in rows)

def kind(r):
    if r["USAGE_EN"] != "Residential": return None
    if r["PROP_TYPE_EN"] == "Unit" and r["PROP_SB_TYPE_EN"] == "Flat": return "flat"
    if r["PROP_TYPE_EN"] == "Building" and r["PROP_SB_TYPE_EN"] == "Villa": return "villa"
    return None

groups = collections.defaultdict(lambda: {"v": [], "d": []})
kept = multi = 0
dates = []
for r in rows:
    stage = SALE_PROCS.get(r["PROCEDURE_EN"]) if r["GROUP_EN"] == "Sales" else None
    k = kind(r)
    if not stage or not k: continue
    if per_deed[r["TRANSACTION_NUMBER"]] > 1: multi += 1; continue
    try:
        price = float(r["TRANS_VALUE"]); size = float(r["PROCEDURE_AREA"] or 0)
    except ValueError: continue
    if price <= 1000: continue
    d = r["INSTANCE_DATE"][:10]
    if k == "flat":
        if size < 10: continue
        val = price / size
    else:
        val = price
    kept += 1; dates.append(d)
    area = r["AREA_EN"].strip().upper()
    proj = r["PROJECT_EN"].strip().upper()
    for key in [f"A|{area}|{k}|{stage}"] + ([f"P|{proj}|{k}|{stage}"] if proj else []) + \
               ([f"R|{area}|{r['ROOMS_EN'].strip()}|{stage}"] if k == "flat" and r["ROOMS_EN"].strip() else []):
        groups[key]["v"].append(val); groups[key]["d"].append(d)

out = {}
for key, g in groups.items():
    if len(g["v"]) < MIN: continue
    v = sorted(g["v"]); q = statistics.quantiles(v, n=4)
    out[key] = {"n": len(v), "median": round(statistics.median(v)), "p25": round(q[0]), "p75": round(q[2]),
                "from": min(g["d"]), "to": max(g["d"])}
dates.sort()
meta = {"built": datetime.date.today().isoformat(), "from": dates[0] if dates else None, "to": dates[-1] if dates else None,
        "sales": kept, "multiPropertyDropped": multi, "malformedLinesSkipped": skipped, "groups": len(out),
        "areas": sorted({k.split("|")[1] for k in out if k.startswith("A|")})}
path = pathlib.Path(__file__).resolve().parent.parent / "lib/data/dubaiSales.json"
path.write_text(json.dumps({"meta": meta, "groups": out}, separators=(",", ":")))
print({k: v for k, v in meta.items() if k != "areas"}, len(meta["areas"]), "areas")
