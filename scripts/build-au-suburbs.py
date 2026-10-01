#!/usr/bin/env python3
"""Builds lib/data/australiaSuburbs.json — the state valuers-general's own
suburb median sale prices (the benchmark where they exist; the ABS
capital-city medians stay context):
 - South Australia: Valuer-General "Metropolitan Median House Sales"
   quarterly (data.sa.gov.au dataset metro-median-house-sales, XLSX):
   houses only, per suburb, sales count + median, same quarter a year ago
 - Victoria (when the files are supplied — land.vic.gov.au answers 403 to
   servers): "Victorian Property Sales Report" median house / unit by
   suburb, quarterly XLS (pass with --vic-house / --vic-unit)
A suburb median is used only with 10+ sales.

  python3 scripts/build-au-suburbs.py            (quarterly)
"""
import json, re, sys, urllib.request, pathlib, io
import openpyxl

SA_PKG = "https://data.sa.gov.au/data/api/3/action/package_show?id=metro-median-house-sales"
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Pradixium/1.0"}), timeout=120).read()

pkg = json.loads(get(SA_PKG))["result"]
res = sorted([r for r in pkg["resources"] if r["format"].upper() == "XLSX"], key=lambda r: r.get("created") or "")[-1]
ws = openpyxl.load_workbook(io.BytesIO(get(res["url"])), read_only=True).worksheets[0]
rows = list(ws.iter_rows(values_only=True))
hdr = [str(h or "") for h in rows[0]]
iq = [i for i, h in enumerate(hdr) if h.startswith("Sales ")]
q_now = re.sub(r"^Sales\s+", "", hdr[iq[-1]]).strip()          # "2Q 2026"
m = re.match(r"(\d)Q (\d{4})", q_now)
period = f"{m.group(2)} Q{m.group(1)}"
sa = {}
for r in rows[1:]:
    if not r or not r[1]: continue
    n, med = r[iq[-1]], r[iq[-1] + 1]
    prev = r[iq[0] + 1] if len(iq) > 1 else None
    if isinstance(n, (int, float)) and n >= 10 and isinstance(med, (int, float)):
        sa[str(r[1]).strip().upper()] = {"n": int(n), "median": round(med), "council": str(r[0]).strip().title(),
                                          "prev": round(prev) if isinstance(prev, (int, float)) else None}
out = {"sa": {"period": period, "houses": sa, "source": "Valuer-General of South Australia — Metropolitan Median House Sales (" + res["name"] + ")",
              "sourceUrl": "https://data.sa.gov.au/data/dataset/metro-median-house-sales"}}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/australiaSuburbs.json"
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(period, len(sa), "SA suburbs with 10+ house sales")
