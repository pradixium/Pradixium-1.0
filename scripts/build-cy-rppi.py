#!/usr/bin/env python3
"""Cyprus: Central Bank of Cyprus — Residential Property Price Index
(quarterly, 2010Q1=100, from market valuations; by type and by district,
flats and houses separately). Writes the change on the same quarter a year
earlier for the latest quarter → lib/data/cyprusIndexPrices.json.
Re-run each quarter (the file name carries the quarter):
  pip install xlrd && python3 scripts/build-cy-rppi.py 2026Q2
"""
import json, os, sys, urllib.request
import xlrd

q = sys.argv[1] if len(sys.argv) > 1 else "2026Q2"
URL = f"https://www.centralbank.cy/images/media/redirectfile/RPPI/{q}/Data_RPPI_{q}_EN.xls"
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=120).read()
sh = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)

head = [str(c.value).strip() for c in sh.row(4)]
assert head[:5] == ["Year", "Quarter", "", "Flats", "Houses"], head[:5]
DISTRICTS = ["Nicosia", "Limassol", "Larnaca", "Paphos", "Famagusta"]
assert head[5:10] == DISTRICTS and head[10:15] == DISTRICTS and head[15:20] == DISTRICTS, head
rows, year = [], None
for i in range(5, sh.nrows):
    r = [c.value for c in sh.row(i)]
    if isinstance(r[0], float): year = int(r[0])
    if str(r[1]).startswith("Q") and isinstance(r[2], float): rows.append((year, r[1], r))
last, prev = rows[-1], rows[-5]
assert last[1] == prev[1] and last[0] == prev[0] + 1, (last[:2], prev[:2])
yoy = lambda c: round((last[2][c] / prev[2][c] - 1) * 100, 1) if isinstance(prev[2][c], float) and isinstance(last[2][c], float) else None
out = {
    "source": "Central Bank of Cyprus — Residential Property Price Index (RPPI)",
    "sourceUrl": "https://www.centralbank.cy/en/publications/residential-property-price-indices",
    "file": URL, "period": f"{last[0]} {last[1]}", "comparedWith": f"{prev[0]} {prev[1]}",
    "national": {"all": yoy(2), "flats": yoy(3), "houses": yoy(4)},
    "districts": {d: {"all": yoy(5 + k), "flats": yoy(10 + k), "houses": yoy(15 + k)} for k, d in enumerate(DISTRICTS)},
}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "cyprusIndexPrices.json")
json.dump(out, open(dst, "w"), indent=1)
print(json.dumps(out, indent=1))
