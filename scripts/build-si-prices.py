#!/usr/bin/env python3
"""Slovenia: GURS (Surveying and Mapping Authority of the Republic of Slovenia)
— Annual Report on the Slovenian Real Estate Market, from the Real Estate
Market Register (ETN, every recorded sale). For each market analysis area
(MAA) and its local analysis areas (LAAs), SECONDARY market (existing homes):
  - flats: sample size, 25th percentile / median / 75th percentile price per
    m² of USEFUL floor area (living rooms, no balconies/terraces/basements),
    median year built, median useful area;
  - houses (with their land): same, as a whole price in €;
  - the MAA's price change on the year before (flats, houses).
GURS shows a figure only when the sample is big enough.
→ lib/data/sloveniaPrices.json. Re-run each spring when the next annual
report is published (update the year):
  pip install pypdf && python3 scripts/build-si-prices.py 2025
"""
import io, json, os, re, sys, urllib.request
import pypdf

YEAR = sys.argv[1] if len(sys.argv) > 1 else "2025"
URL = f"https://www.e-prostor.gov.si/fileadmin/Podrocja/Trg_vrednosti_nep/Trg_nepremicnin/Porocila_o_trgu_nepremicnin/{YEAR}/Annual_Report_{YEAR}.pdf"
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=300).read()
L0 = [l.rstrip() for p in pypdf.PdfReader(io.BytesIO(raw)).pages for l in (p.extract_text() or "").split("\n")]

# a table title can wrap onto the next line(s)
L, k = [], 0
while k < len(L0):
    l = L0[k]
    if l.startswith("Table "):
        while k + 1 < len(L0) and not re.match(r"^(ANAL|Obdobje|Sample|MAA |LAA |Table |Note)", L0[k + 1].strip()) and len(l) < 260:
            k += 1; l = l + " " + L0[k].strip()
    L.append(l); k += 1

NUM = r"(\d{1,3}(?:,\d{3})*|\d+)"
n = lambda s: int(s.replace(",", ""))
clean_area = lambda s: re.sub(r",\s*\d{4}$", "", s.strip()).rstrip(",").upper()
FLAT_KEYS = ["sales", "p25", "median", "p75", "yearBuilt", "usefulArea"]
HOUSE_KEYS = ["sales", "p25", "median", "p75", "yearBuilt", "houseArea", "landArea"]

maas = {}
i = 0
while i < len(L):
    m = re.match(r"Table \d+:\s*Prices and characteristics of (flats|houses) sold on the secondary market, MAA (.+?)(?:, by local analysis areas)?, " + YEAR + r"\s*$", L[i])
    if m:
        kind, maa = m.group(1), clean_area(m.group(2))
        keys = FLAT_KEYS if kind == "flats" else HOUSE_KEYS
        pat = re.compile(r"^((?:MAA|LAA) .*?)\s+" + r"\s+".join([NUM] * len(keys)) + r"\s*$")
        j, buf = i + 1, ""
        while j < len(L) and not L[j].startswith(("Table ", "Note")):
            line = L[j].strip()
            if re.fullmatch(r"\d+", line): j += 1; continue
            cand = (buf + " " + line).strip() if buf else line
            mm = pat.match(cand)
            if mm:
                name, vals = mm.group(1), dict(zip(keys, [n(x) for x in mm.groups()[1:]]))
                e = maas.setdefault(maa, {"laas": {}})
                # the area's own row; any other "MAA …" row inside the table is a
                # sub-area (Alpine tourist area → "MAA Kranjska Gora and surroundings")
                if name.startswith("MAA ") and re.sub(r"\s+", " ", name[4:]).upper() == maa: e[kind] = vals
                else: e["laas"].setdefault(re.sub(r"\s+", " ", name[4:]).strip().upper(), {})[kind] = vals
                buf = ""
            elif line.startswith(("MAA ", "LAA ")): buf = line
            elif buf: buf = cand
            j += 1
        i = j; continue
    m = re.match(r"Table \d+:\s*T\s?rend in prices of flats and houses, MAA (.+?), from \d{4} to " + YEAR + r" \(sequentially", L[i])
    if m:
        maa = clean_area(m.group(1))
        for j in range(i, min(i + 16, len(L))):
            mm = re.match(r"(\d{4})–" + YEAR + r"\s+(-?\d+)%\s*(-?\d+%|--)?\s*$", L[j].strip())
            if mm and int(mm.group(1)) == int(YEAR) - 1:
                h = mm.group(3)
                maas.setdefault(maa, {"laas": {}})["trend"] = {"flats": int(mm.group(2)), "houses": int(h[:-1]) if h and h != "--" else None}
                break
    i += 1

# Table 9 — national row + every MAA's median (a cross-check of the chapters)
nat = None
for idx, l in enumerate(L):
    if l.startswith("Table") and "Sample size and median prices for flats and houses on the secondary market" in l:
        for r in L[idx:idx + 60]:
            mm = re.match(r"^(SLOVENIA|[A-ZČŠŽ].*?)\s+" + NUM + r"\s+" + NUM + r"\s+" + NUM + r"\s+" + NUM + r"\s*$", r.strip())
            if not mm: continue
            name, vals = mm.group(1).strip(), [n(x) for x in mm.groups()[1:]]
            if name == "SLOVENIA": nat = {"flats": {"sales": vals[0], "median": vals[1]}, "houses": {"sales": vals[2], "median": vals[3]}}
            elif name in maas and maas[name].get("flats"):
                assert maas[name]["flats"]["median"] == vals[1], (name, maas[name]["flats"], vals)
        break
assert nat and nat["flats"]["median"] > 1000, nat
assert maas["LJUBLJANA"]["flats"]["median"] and len(maas) >= 28, list(maas)

# town → area. Only places GURS itself names: an LAA's own name parts, plus
# the towns the report lists as part of an MAA. A name found in two areas is
# dropped (Šempeter, Šmartno, Bežigrad …). Ljubljana / Maribor neighbourhoods
# count only together with the city's name (see lib/europe/localPrices.js).
# areas named after a region / "rest of" (Karst excluding large towns, Tuhinj
# Valley …) or a city centre give no town; generic words are never a town
SKIP_AREA = re.compile(r"EXCLUDING|SURROUNDINGS OF|CENTRE|VALLEY|HILLS|ALPS|AREA|PLAIN|CENTRAL|SOUTH$")
SKIP_TOKEN = {"DOL", "POLJE", "BRDO", "GORJANCI"}
towns = {}
def add(tok, maa, laa):
    tok = re.sub(r"\s+AND SURROUNDINGS$", "", tok.strip())
    if tok and tok not in SKIP_TOKEN: towns.setdefault(tok, set()).add((maa, laa))
for maa, e in maas.items():
    for laa in e["laas"]:
        if SKIP_AREA.search(laa): continue
        for tok in re.split(r",\s*|\s+AND\s+(?!SURROUNDINGS)", laa): add(tok, maa, laa)
text = re.sub(r"\s+", " ", " ".join(L))
for m in re.finditer(r"(the Coast area|Alpine tourist area|Northern surroundings of Ljubljana|Southern surroundings of Ljubljana|Novo Mesto and surroundings|Nova Gorica with the Vipava Valley and Goriška Brda|Šalek Valley|Zasavje) \(including ([^)]+)\)", text):
    maa = {"the Coast area": "COAST", "Nova Gorica with the Vipava Valley and Goriška Brda": "NOVA GORICA, VIPAVA VALLEY, BRDA"}.get(m.group(1), m.group(1).upper())
    for tok in re.split(r",\s*|\s+and\s+", m.group(2)):
        tok = re.sub(r"^the |Lake | area$", "", tok.strip()).upper()
        if not any(tok in t for t in towns) and maa in maas: add(tok, maa, None)
for city in ("LJUBLJANA", "MARIBOR", "CELJE"): towns[city] = {(city, None)}
towns["KRANJ"] = {("KRANJ AND SURROUNDINGS", None)}
ambiguous = sorted(t for t, v in towns.items() if len(v) > 1)
towns = {t: {"maa": list(v)[0][0], "laa": list(v)[0][1]} for t, v in towns.items() if len(v) == 1}

out = {"source": f"GURS (Surveying and Mapping Authority of the Republic of Slovenia) — Annual Report on the Slovenian Real Estate Market {YEAR}, from the Real Estate Market Register (ETN)",
       "sourceUrl": URL, "year": YEAR, "national": nat, "maas": maas, "towns": towns, "ambiguous": ambiguous}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "sloveniaPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(len(maas), "MAAs,", sum(len(e["laas"]) for e in maas.values()), "LAAs,", len(towns), "towns; ambiguous:", ambiguous)
print("Ljubljana", maas["LJUBLJANA"]["flats"], maas["LJUBLJANA"].get("trend"), "national", nat)
