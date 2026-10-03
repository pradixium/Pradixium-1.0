#!/usr/bin/env python3
"""Turkey: series codes of TCMB's public EVDS tables → lib/data/turkeyKfe.json

The VALUES are fetched live from EVDS by api/turkey-intelligence.js (with
the key). EVDS terms (evds3 …/documents/showDocument?docId=18): data may be
used and published with the source named, also in a commercial product as
long as no extra fee is charged for it; a translation must say it is not
an official TCMB translation. Figures from TCMB's WEBSITE (the KFE.pdf
release) need TCMB's written permission for commercial use (tcmb.gov.tr
Kullanım Şartları) → this script no longer reads the PDF.

Public tables (linked from KFE-Tablo.pdf, no key):
 - "Konut Fiyat Endeksi (KFE) ve Düzey Endeks Değerleri": Türkiye + 19
   İBBS region groups (provinces as TCMB lists them)
 - "Yeni Kiracı Kira Endeksi (YKKE) ve Düzey Endeks Değerleri": same groups
 - "Konut Birim Fiyatları" / "Değerlemesi Yapılan Konutların Birim
   Kiraları": 81 provinces + Türkiye
Run when TCMB changes its tables:  python3 scripts/build-tr-kfe.py
"""
import json, os, re, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}

def portlet(pid):
    u = f"https://evds3.tcmb.gov.tr/igmevdsms-dis/public/charts/portlet/{pid}"
    d = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read())
    st = json.loads(d["chartSettings"])[0]
    return list(zip(st["serieNames"].split("#"), [c.replace("_", ".") for c in st["codes"].split("#")]))

kfe = portlet("Njk3OWZjMzk5NjgyN2M2YzU2OGIyNWEy")
ykke = dict((n, c) for n, c in portlet("Njk5NDEzMGQwMzlkNTIxY2U4ODAyM2Jj"))
regions = []
for name, code in kfe:
    m = re.fullmatch(r"(TR\w+) \((.+)\)", name)
    if not m: continue
    provs = [p.strip() for p in m.group(2).split(",") if p.strip()]
    yc = ykke.get(name)
    assert yc == code.replace("KFE", "YKKE"), (name, code, yc)
    regions.append({"code": m.group(1), "label": ", ".join(provs), "provinces": provs, "kfe": code, "ykke": yc})
assert len(regions) == 19 and kfe[0][1] == "TP.KFE.TR", "TCMB table layout changed"
strip = lambda n: n.replace(" Konut Birim Fiyatları", "").replace(" Konut Birim Kiraları", "")
out = {"source": "TCMB — Konut Fiyat Endeksi (KFE, 2023=100) and Yeni Kiracı Kira Endeksi (YKKE), EVDS",
       "termsUrl": "https://evds3.tcmb.gov.tr/igmevdsms-dis/documents/showDocument?docId=18",
       "national": {"kfe": "TP.KFE.TR", "ykke": "TP.YKKE.TR"}, "regions": regions,
       "unitPriceCodes": {strip(n): c for n, c in portlet("Njk3OWZjOTJjYmJhMzQwMGNjZmMzNGRh")},
       "unitRentCodes": {strip(n): c for n, c in portlet("Njk5NDEzNTFjNjAxMWY0MDU2MDdmZjJm")}}
assert len(out["unitPriceCodes"]) == 82 and len(out["unitRentCodes"]) == 82, "TCMB table layout changed"
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "turkeyKfe.json")
json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
print(len(regions), "regions", regions[5])
