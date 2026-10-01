#!/usr/bin/env python3
"""Portugal: IMI rate of every municipality → lib/data/portugalImi.json

Autoridade Tributária e Aduaneira, Portal das Finanças "Consultar Taxas
IMI/CA por Município e Ano" (public form, one page per district): the
rate for urban properties valued under the CIMI and for rural
properties, for the latest tax year that has rates (the year's IMI is
paid the following year). A municipality that sets rates per parish
shows "-" there → not listed (its parish rates are a separate query).
Run each January (after the municipalities' rates are published):
  python3 scripts/build-pt-imi.py [year]
"""
import html, json, os, re, sys, time, unicodedata, urllib.parse, urllib.request
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
BASE = "https://www.portaldasfinancas.gov.pt/main.jsp"
def get(params=None):
    u = BASE + ("?" + urllib.parse.urlencode(params) if params else "")
    for i in range(5):
        try: return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read().decode("latin-1", "ignore")
        except Exception:
            if i == 4: raise
            time.sleep(5 * (i + 1))
form = get({"body": "/imi/consultarTaxasIMIForm.jsp"})
districts = re.findall(r'<option value="(\d\d[^"]+)">', form)
def rows(year, dist):
    t = get({"body": "/imi/consultarTaxasIMI.jsp", "ano": year, "distrito": dist})
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
    out = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", t, flags=re.S | re.I):
        cells = [html.unescape(re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S | re.I)]
        cells = [re.sub(r"\s+", " ", c) for c in cells]
        if len(cells) >= 4 and re.fullmatch(r"\d{4}", cells[0]):
            out.append(cells)
    return out
year = sys.argv[1] if len(sys.argv) > 1 else None
if not year:   # the latest year with published rates
    for y in range(int(time.strftime("%Y")), 2020, -1):
        if rows(str(y), "11LISBOA"): year = str(y); break
pct = lambda s: float(s.replace("%", "").replace(",", ".").strip()) if re.match(r"^\d", s or "") else None
mun = {}
for dist in districts:
    for c in rows(year, dist):
        urb, rus = pct(c[2]), pct(c[3])
        mun[c[0]] = {"name": c[1], "district": dist[2:].title(), "urban": urb, "rural": rus}
norm = lambda s: re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()).strip()
out = {"source": f"Autoridade Tributária e Aduaneira — Portal das Finanças, Taxas IMI por Município, ano {year}",
       "sourceUrl": "https://www.portaldasfinancas.gov.pt/main.jsp?body=/imi/consultarTaxasIMIForm.jsp",
       "year": int(year), "municipalities": mun,
       "byName": {}}
names = {}
for code, m in mun.items():
    names.setdefault(norm(re.sub(r"\(.*\)", "", m["name"])), []).append(code)
    names.setdefault(norm(m["name"]), []).append(code)
out["byName"] = {k: v[0] for k, v in names.items() if len(set(v)) == 1}
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "portugalImi.json")
json.dump(out, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(mun), "municipalities;", sum(1 for m in mun.values() if m["urban"] is None), "with parish rates only;",
      sum(1 for m in mun.values() if m["urban"] == 0.3), "at 0.3%")
