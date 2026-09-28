# Builds lib/data/usHpiCounties.js — every U.S. county → its FHFA House
# Price Index series (all-transactions, quarterly), so every address gets
# the price trend of ITS metro (or of its state's non-metro area), not just
# the top-50 metros in usMetros.js.
#
#   python3 scripts/build-us-hpi.py
#
# Official inputs (downloaded here, never typed by hand):
#  - FHFA HPI all-transactions, metro + metro divisions:
#    https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv
#  - FHFA HPI all-transactions, state areas outside metros:
#    https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_nonmetro.csv (xlsx)
#  - OMB Bulletin 23-01 delineation (county → CBSA / metro division):
#    https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx
# The one-year change is computed from the two official index values
# (latest quarter vs. same quarter a year earlier) and stored with both.
import csv, io, json, urllib.request, datetime, openpyxl

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()

METRO = "https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_metro.csv"
NONMETRO = "https://www.fhfa.gov/hpi/download/quarterly_datasets/hpi_at_nonmetro.csv"
OMB = "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx"
STATES = {"01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY","72":"PR"}

# 1. FHFA metro series: code → name, {(year,qtr): index}
series = {}
for row in csv.reader(io.StringIO(get(METRO).decode("latin-1"))):
    if len(row) < 5 or not row[1].strip().isdigit(): continue
    name, code, y, q, idx = row[0].strip(), row[1].strip(), int(row[2]), int(row[3]), row[4].strip()
    s = series.setdefault(code, {"name": name, "idx": {}})
    try: s["idx"][(y, q)] = float(idx)
    except ValueError: pass
latest = max(k for s in series.values() for k in s["idx"])
prev = (latest[0] - 1, latest[1])

def change(idx):
    a, b = idx.get(latest), idx.get(prev)
    return [a, b, round((a / b - 1) * 100, 2)] if a and b else None

# 2. FHFA non-metro state series
wb = openpyxl.load_workbook(io.BytesIO(get(NONMETRO)), read_only=True)
nm = {}
for r in wb.active.iter_rows(values_only=True):
    if r and isinstance(r[0], str) and len(r[0]) == 2 and isinstance(r[1], int) and isinstance(r[3], (int, float)):
        nm.setdefault(r[0], {})[(r[1], r[2])] = float(r[3])
nonmetro = {st: change(v) for st, v in nm.items() if change(v)}

# 3. OMB counties → FHFA code (metro division when the MSA has divisions)
wb = openpyxl.load_workbook(io.BytesIO(get(OMB)), read_only=True)
rows = list(wb.active.iter_rows(values_only=True))
head_i = next(i for i, r in enumerate(rows) if r and r[0] == "CBSA Code")
H = {h: i for i, h in enumerate(rows[head_i])}
codes, counties, missing = {}, {}, set()
for r in rows[head_i + 1:]:
    if not r or not r[H["CBSA Code"]] or r[H["Metropolitan/Micropolitan Statistical Area"]] != "Metropolitan Statistical Area": continue
    fips = f'{int(r[H["FIPS State Code"]]):02d}{int(r[H["FIPS County Code"]]):03d}'
    div = r[H["Metropolitan Division Code"]]
    code = str(div).strip() if div else str(r[H["CBSA Code"]]).strip()
    if code not in series or not change(series[code]["idx"]):
        missing.add(code); counties[fips] = -1; continue  # metro county without an FHFA series: no index, never the non-metro one
    codes.setdefault(code, len(codes))
    counties[fips] = codes[code]

out_series = [None] * len(codes)
for code, i in codes.items():
    out_series[i] = [series[code]["name"], code] + change(series[code]["idx"])

period = f"{latest[0]}Q{latest[1]}"
with open("lib/data/usHpiCounties.js", "w") as f:
    f.write(f"""/* PRADIXIUM™ — every U.S. metro county → FHFA HPI series (GENERATED)
 * Do not edit by hand — regenerate with: python3 scripts/build-us-hpi.py
 * FHFA House Price Index, all-transactions, quarterly ({period}); counties
 * per OMB Bulletin 23-01 (metro division series where the MSA has them).
 * Counties outside any metro use FHFA's index for the state's non-metro area.
 * oneYear = latest index / same quarter a year earlier − 1 (both stored).
 * SERIES rows: [FHFA name, FHFA code, index {period}, index {prev[0]}Q{prev[1]}, oneYear %].
 * NONMETRO rows: [index {period}, index {prev[0]}Q{prev[1]}, oneYear %].
 */
export const US_HPI_META = {json.dumps({"source": "FHFA House Price Index (all-transactions)", "sourceUrl": "https://www.fhfa.gov/data/hpi", "period": period, "builtOn": datetime.date.today().isoformat(), "counties": sum(1 for v in counties.values() if v >= 0), "series": len(codes)})};
export const US_HPI_SERIES = {json.dumps(out_series, separators=(",", ":"))};
export const US_HPI_COUNTY = {json.dumps(counties, separators=(",", ":"))};
export const US_HPI_NONMETRO = {json.dumps(nonmetro, separators=(",", ":"))};
export const US_STATE_BY_FIPS = {json.dumps(STATES, separators=(",", ":"))};

export function findUsHpiByCounty(countyFips) {{
  const fips = String(countyFips || "").trim();
  const i = US_HPI_COUNTY[fips];
  if (i === -1) return null;
  if (i !== undefined) {{ const [name, code, now, prev, oneYear] = US_HPI_SERIES[i]; return {{ level: "metro", name: name.replace(/\\s+/g, " "), code, now, prev, oneYear, period: US_HPI_META.period }}; }}
  const st = US_STATE_BY_FIPS[fips.slice(0, 2)], n = st && US_HPI_NONMETRO[st];
  return n ? {{ level: "nonmetro", name: `${{st}} areas outside metropolitan areas`, code: null, now: n[0], prev: n[1], oneYear: n[2], period: US_HPI_META.period }} : null;
}}
""")
print(f"{period}: {len(counties)} metro counties in {len(codes)} FHFA series; {len(nonmetro)} state non-metro series; OMB codes without FHFA series: {sorted(missing)}")
