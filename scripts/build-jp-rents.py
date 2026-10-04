#!/usr/bin/env python3
"""Japan: average monthly rent per m² of floor area of PRIVATE rented homes
(民営借家, rent-free homes excluded) per prefecture / municipality / ward —
Statistics Bureau of Japan, 2023 Housing and Land Survey (令和5年住宅・土地
統計調査), basic tabulation table 122-4 (e-Stat file, keyless) →
lib/data/japanRents.json. English names + postcodes: Japan Post's official
romaji postcode file (KEN_ALL_ROME). The survey covers cities, wards and
towns/villages of 15,000+ people; rents are those paid on 1 Oct 2023 by
existing tenants (a sample survey; figures rounded by the Bureau).
Re-run when the next survey (2028) is published:
  python3 scripts/build-jp-rents.py
"""
import csv, io, json, os, re, time, urllib.request, zipfile
import openpyxl

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
get = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=300).read()
ESTAT = "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000040210062&fileKind=0"
POST = "https://www.post.japanpost.jp/service/search/zipcode/download/roman/KEN_ALL_ROME.zip"

wb = openpyxl.load_workbook(io.BytesIO(get(ESTAT)), read_only=True)
rows = [r for r in wb.worksheets[0].iter_rows(min_row=10, values_only=True) if r[2] == "3_民営借家"]
z = zipfile.ZipFile(io.BytesIO(get(POST)))
post = list(csv.reader(io.StringIO(z.read(z.namelist()[0]).decode("cp932"))))

def core(s):  # "SAPPORO SHI CHUO KU" → ("sapporo", "chuo"); "ABUTA GUN KUTCHAN CHO" → (None, "kutchan")
    s = re.sub(r"^.+? GUN ", "", s.strip())
    m = re.match(r"^(.+?) SHI (.+?) KU$", s)
    if m: return m.group(1).lower(), m.group(2).lower()
    return None, re.sub(r" (SHI|KU|CHO|MACHI|MURA|SON)$", "", s).lower()

byKanji, zips = {}, {}
for r in post:
    pk, ck, pe, ce = r[1], r[2], r[4], r[5]
    byKanji.setdefault((pk, ck), (pe, ce))
    byKanji.setdefault((pk, re.sub(r"^.+?郡　", "", ck)), (pe, ce))
PREF = {}
for (pk, ck), (pe, ce) in byKanji.items():
    PREF[pk] = re.sub(r" (TO|DO|FU|KEN)$", "", pe).lower()

out, kanjiToCode = {}, {}
prefName = {}
for r in rows:
    code, name = r[1].split("_", 1)
    cnt, perm2 = r[3], r[16]
    if code == "00000" or not isinstance(perm2, (int, float)) or not isinstance(cnt, (int, float)): continue
    if code.endswith("000"):
        prefName[code[:2]] = name
        out[code] = {"n": PREF.get(name, name), "k": "pref", "p": code[:2], "homes": int(cnt), "perM2": int(perm2)}
        continue
    pk = prefName.get(code[:2])
    hit = byKanji.get((pk, name))
    if hit:
        city, n = core(hit[1])
        out[code] = {"n": n, "k": "ward" if city else "muni", "city": city, "p": code[:2], "homes": int(cnt), "perM2": int(perm2)}
        kanjiToCode[(pk, name)] = code
    else:   # designated-city total row (川崎市): romaji from any of its wards
        w = next((v for (p, c), v in byKanji.items() if p == pk and c.startswith(name + "　")), None)
        if w:
            city, _ = core(w[1])
            out[code] = {"n": city, "k": "city", "p": code[:2], "homes": int(cnt), "perM2": int(perm2)}
towns = {}
for r in post:
    code = kanjiToCode.get((r[1], r[2])) or kanjiToCode.get((r[1], re.sub(r"^.+?郡　", "", r[2])))
    if not code: continue
    zips[r[0]] = code
    t = re.sub(r"\(.*", "", r[6]).strip().lower()                      # "ROPPONGI(ROPPONGI HIRUZU…)" → "roppongi"
    t = re.sub(r" (\d+|[a-z]+) chome$", "", t)
    if re.fullmatch(r"[a-z]{4,}", t) and t not in ("ikanikeisaiganaibaai",) and not t.endswith("ichien"):
        towns.setdefault(t, set()).add(code)
towns = {k: sorted(v) for k, v in towns.items() if len(v) <= 3}       # a name used in many places is useless
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "japanRents.json")
json.dump({"source": "Statistics Bureau of Japan, 2023 Housing and Land Survey (table 122-4)", "url": ESTAT, "year": 2023,
           "built": time.strftime("%Y-%m-%d"), "areas": out, "zip": zips, "towns": towns}, open(p, "w"), separators=(",", ":"))
print(len(out), "areas,", len(zips), "postcodes,", len(towns), "towns; roppongi", towns.get("roppongi"), "ginza", towns.get("ginza"), "13104:", out.get("13104"))
