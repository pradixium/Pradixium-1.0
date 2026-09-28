# Builds lib/data/indiana/<county FIPS>.json.gz — every Indiana county's
# real property roll as submitted to the Department of Local Government
# Finance (DLGF), from the Indiana Gateway "Real Property" (PARCEL) file:
#   https://gateway.ifionline.org/public/download.aspx  (Property Files)
#
#   python3 scripts/build-in-parcels.py 2025 [--force]   # assessment year;
#   without --force, counties already built are skipped (re-run to fill gaps)
#
# Field positions per 50 IAC 26-20-4 (PARCEL file): parcel number 1-25,
# property address 94-153, city 154-183, ZIP 184-193, property class
# 194-196, current AV total land 1251-1262, total improvements 1263-1274,
# total land and improvements 1275-1286. Every record is checked
# land + improvements = total; a county whose file fails the check is
# skipped, never written.
# Output per county: {"meta": {...}, "zips": {ZIP: {house#: [[street,
# parcel, totalAV, class, city index], ...]}}, "cities": [...]}. Marion County (18097) is skipped — it
# has its own live module (lib/usLocal/marionIN.js).
import sys, io, os, re, json, gzip, zipfile, urllib.request, urllib.parse, http.cookiejar, datetime

YEAR = sys.argv[1] if len(sys.argv) > 1 else "2025"
URL = "https://gateway.ifionline.org/public/download.aspx"
OUT = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "indiana")
os.makedirs(OUT, exist_ok=True)

def opener():
    cj = http.cookiejar.CookieJar()
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    op.addheaders = [("User-Agent", "Mozilla/5.0 (Pradixium data build)")]
    return op

def download(county_no):
    op = opener()
    page = op.open(URL, timeout=120).read().decode("utf-8", "ignore")
    form = {m.group(1): m.group(2) for m in re.finditer(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', page)}
    form.update({"ctl00$ContentPlaceHolder1$DropDownList1": "5", "ctl00$ContentPlaceHolder1$DropDownList2": YEAR,
                 "ctl00$ContentPlaceHolder1$DropDownList3": county_no, "ctl00$ContentPlaceHolder1$button2": "Download"})
    r = op.open(URL, data=urllib.parse.urlencode(form).encode(), timeout=900)
    return r.headers.get("Content-Disposition") or "", r.read()

summary = []
for n in range(1, 93):
    no = f"{n:02d}"
    fips = f"18{2 * n - 1:03d}"
    if fips == "18097":
        continue
    if os.path.exists(os.path.join(OUT, f"{fips}.json.gz")) and "--force" not in sys.argv:
        continue  # already built (re-run fills gaps left by failed downloads)
    txt = None
    for attempt in range(3):
        try:
            name, data = download(no)
            zf = zipfile.ZipFile(io.BytesIO(data))
            txt = zf.read(zf.namelist()[0]).decode("latin-1").splitlines()
            break
        except Exception as e:
            print(fips, "download failed:", e, flush=True)
    if txt is None:
        continue
    header, recs = txt[0], txt[1:]
    zips, total, bad, cities = {}, 0, 0, []
    for l in recs:
        if len(l) < 1286:
            continue
        try:
            land, imp, tot = int(l[1250:1262]), int(l[1262:1274]), int(l[1274:1286])
        except ValueError:
            bad += 1
            continue
        total += 1
        if land + imp != tot:
            bad += 1
            continue
        addr = re.sub(r"\s+", " ", l[93:153].strip().upper())
        z = l[183:188].strip()
        m = re.match(r"^(\d+[A-Z]?)\s+(.+)$", addr)
        if not m or not re.match(r"^\d{5}$", z):
            continue
        city = re.sub(r"\s+", " ", l[153:183].strip().upper())
        if city not in cities:
            cities.append(city)
        zips.setdefault(z, {}).setdefault(m.group(1), []).append([m.group(2), l[0:25].strip(), tot, l[193:196], cities.index(city)])
    if not total or bad > total * 0.001:
        print(fips, f"skipped: {bad} of {total} records fail land + improvements = total", flush=True)
        continue
    meta = {"source": "Indiana DLGF — county real property (PARCEL) file via Indiana Gateway", "sourceUrl": URL,
            "assessmentYear": YEAR, "file": re.sub(r'^.*filename=', "", name), "builtOn": datetime.date.today().isoformat(),
            "parcels": total}
    with gzip.open(os.path.join(OUT, f"{fips}.json.gz"), "wt", encoding="utf-8") as f:
        json.dump({"meta": meta, "cities": cities, "zips": zips}, f, separators=(",", ":"))
    summary.append((fips, total))
    print(fips, total, "parcels", meta["file"], flush=True)
print("counties written:", len(summary), "parcels:", sum(t for _, t in summary))
