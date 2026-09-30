#!/usr/bin/env python3
"""Serbia: RGZ (Republic Geodetic Authority) quarterly report on the real
estate market, from its Register of Real Estate Prices (every registered
sale): Table 10 (flats in 28 cities) and Table 11 (the cadastral
municipalities of Belgrade's inner urban area) — median and mean €/m²,
change on the same quarter a year earlier and number of sales, for all
flats, existing flats (starogradnja) and new flats (novogradnja).
→ lib/data/serbiaPrices.json. Re-run each quarter with the new report's
file name (listed at rgz.gov.rs → Извештаји са тржишта → Квартални …):
  pip install pypdf && python3 scripts/build-rs-prices.py "Квартални извештај II 2026.pdf" "II 2026"
"""
import io, json, os, re, sys, urllib.parse, urllib.request
import pypdf

FILE = sys.argv[1] if len(sys.argv) > 1 else "Квартални извештај II 2026.pdf"
QUARTER = sys.argv[2] if len(sys.argv) > 2 else "II 2026"
URL = "https://www.rgz.gov.rs" + urllib.parse.quote(f"/content/docs/000/000/007/{FILE}")
raw = urllib.request.urlopen(urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (Pradixium data build)"}), timeout=180).read()
text = "\n".join(p.extract_text() or "" for p in pypdf.PdfReader(io.BytesIO(raw)).pages)

CYR = dict(zip("абвгдђежзијклљмнњопрстћуфхцчџш", ["a","b","v","g","d","đ","e","ž","z","i","j","k","l","lj","m","n","nj","o","p","r","s","t","ć","u","f","h","c","č","dž","š"]))
latin = lambda s: "".join(CYR.get(ch, ch) for ch in s.lower())
num = lambda s: None if s in ("/", "") else float(s.replace(".", "").replace(",", "."))

def table(start, end):
    seg = text[text.index(start):text.index(end, text.index(start))]
    rows, buf = [], ""
    for line in seg.split("\n"):
        line = line.strip()
        cand = f"{buf} {line}".strip() if buf else line
        m = re.match(r"^([А-ЯЂЈЉЊЋЏ][А-ЯЂЈЉЊЋЏ \-]+?)\*?\s+((?:[-\d.,/]+\s+){11}[-\d.,/]+)$", cand)
        if m:
            v = m.group(2).split()
            blocks = [v[0:4], v[4:8], v[8:12]]
            e = {k: {"median": num(b[0]), "mean": num(b[1]), "yoy": num(b[2]), "sales": int(num(b[3]) or 0)} for k, b in zip(("all", "existing", "new"), blocks)}
            rows.append((m.group(1).strip(), e)); buf = ""
        elif re.match(r"^[А-ЯЂЈЉЊЋЏ][А-ЯЂЈЉЊЋЏ \-]+$", line): buf = cand
        else: buf = ""
    return rows

cities = table("Табела 10: Статистика цена станова у градовима", "Напомена")
belgrade = table("Табела 11: Статистика цена станова у катастарским општинама", "\n22")
assert len(cities) >= 20 and len(belgrade) == 10, (len(cities), len(belgrade))
bg = dict(cities)["БЕОГРАД"]
assert bg["all"]["median"] > 1000, bg
out = {"source": f"Republički geodetski zavod (RGZ) — Kvartalni izveštaj o stanju na tržištu nepokretnosti, {QUARTER} (Register of Real Estate Prices)",
       "sourceUrl": URL, "quarter": QUARTER,
       "belgradeNote": "Belgrade = the cadastral municipalities of the inner urban area (Stari grad, Vračar, Savski venac, Novi Beograd, Zvezdara, Palilula, Voždovac, Zemun, Čukarica, Stara Rakovica)",
       "cities": {latin(n).title(): e for n, e in cities},
       "belgrade": {latin(n).title(): e for n, e in belgrade}}
dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib", "data", "serbiaPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, indent=1)
print(len(cities), "cities,", len(belgrade), "Belgrade municipalities; Beograd", bg, "\n", list(out["cities"])[:30], list(out["belgrade"]))
