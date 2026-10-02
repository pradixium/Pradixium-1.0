#!/usr/bin/env python3
"""Turkey: TCMB monthly release "Konut Fiyat Endeksi ve Yeni Kiracı Kira
Endeksi" (KFE.pdf on tcmb.gov.tr, reachable from servers) →
lib/data/turkeyKfe.json

 - Table 1 / Table 2: Türkiye, İstanbul, Ankara, İzmir — index (2023=100),
   change on a year earlier, change on the previous month, for the house
   price index (KFE, hedonic, all dwellings) and the new-tenant rent index
   (YKKE).
 - Grafik 4 / Grafik 8: change on a year earlier for every İBBS region
   group (provinces listed by TCMB itself), prices and new-tenant rents.
   The chart prints the values in bar order, then the labels in the same
   order — the pairing is checked against Table 1/2 (İstanbul, Ankara,
   İzmir, Türkiye) and the script stops if they disagree.
Run each month after TCMB's release:  python3 scripts/build-tr-kfe.py
"""
import json, os, re, sys, urllib.request
import pymupdf

URL = "https://www.tcmb.gov.tr/wps/wcm/connect/8bbac42a-c854-4c58-8b0c-e7e55c35ec2d/KFE.pdf?MOD=AJPERES"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)"}
pdf = urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=120).read()
doc = pymupdf.open(stream=pdf, filetype="pdf")
pages = [p.get_text() for p in doc]
num = lambda s: float(s.replace("%", "").replace(",", "."))
MONTHS = {"OCAK": 1, "ŞUBAT": 2, "MART": 3, "NİSAN": 4, "MAYIS": 5, "HAZİRAN": 6, "TEMMUZ": 7,
          "AĞUSTOS": 8, "EYLÜL": 9, "EKİM": 10, "KASIM": 11, "ARALIK": 12}
m = re.search(r"(" + "|".join(MONTHS) + r")\s+(\d{4})", pages[0])
period = f"{m.group(2)}-{MONTHS[m.group(1)]:02d}"

def table(text, head):
    # "<head>\n v1 v2 v3 v4 \nYıllık\nDeğişim\n%a %b %c %d \nAylık\nDeğişim\n%e … \nTÜRKİYE …"
    t = text[text.index(head):]
    vals = re.findall(r"-?\d+,\d", t[:400])
    idx, yoy, mom = vals[0:4], vals[4:8], vals[8:12]
    return {k: {"index": num(a), "yoyPercent": num(b), "momPercent": num(c)}
            for k, a, b, c in zip(["Türkiye", "İstanbul", "Ankara", "İzmir"], idx, yoy, mom)}

def chart(text, head):
    t = text[text.index(head):].split("\n")[1:]
    vals, i = [], 0
    # bars come largest first; the axis ticks that follow restart at 0 and rise
    while re.fullmatch(r"-?\d+,\d", t[i].strip()) and (not vals or num(t[i].strip()) <= vals[-1]):
        vals.append(num(t[i].strip())); i += 1
    # the first axis tick (0,0) still fits "not larger" — it is the one
    # followed by a larger tick
    if re.fullmatch(r"-?\d+,\d", t[i].strip()) and num(t[i].strip()) > vals[-1]:
        vals.pop(); i -= 1
    while re.fullmatch(r"-?\d+,\d", t[i].strip()) or not t[i].strip():
        i += 1   # axis ticks
    labels, cur = [], ""
    for line in t[i:]:
        line = line.strip()
        if not line: continue
        cur = (cur + " " + line).strip()
        if not cur.endswith(","):
            labels.append(cur); cur = ""
        if len(labels) == len(vals): break
    assert len(labels) == len(vals), (len(labels), len(vals))
    return list(zip(labels, vals))

full = "\n".join(pages)
price_t = table(full, "Konut Fiyat \nEndeksi")
rent_t = table(full, "Yeni Kiracı\nEndeksi")
price_c = chart(full, "Grafik 4:")
rent_c = chart(full, "Grafik 8:")
for t, c, name in ((price_t, price_c, "prices"), (rent_t, rent_c, "rents")):
    d = dict(c)
    for k in ("İstanbul", "Ankara", "İzmir", "Türkiye"):
        if d.get(k) != t[k]["yoyPercent"]:
            sys.exit(f"{name}: chart {k} {d.get(k)} != table {t[k]['yoyPercent']} — pairing broken, not written")

def real(head):
    # "… nominal olarak yüzde 23,0 oranında artmış, reel olarak ise yüzde 6,5 oranında azalmıştır"
    t = full[full.index(head):]
    m = re.search(r"reel olarak ise yüzde (\d+,\d) oranında (azal|art)", t)
    return None if not m else (-1 if m.group(2) == "azal" else 1) * num(m.group(1))
price_t["Türkiye"]["realYoyPercent"] = real("Konut Fiyat Endeksi (KFE)\n")
rent_t["Türkiye"]["realYoyPercent"] = real("Yeni Kiracı Kira Endeksi (YKKE)\n")
rent_by = dict(rent_c)
regions = []
for label, v in price_c:
    if label == "Türkiye": continue
    provs = [p.strip() for p in label.split(",") if p.strip()]
    regions.append({"label": label, "provinces": provs, "priceYoyPercent": v, "rentYoyPercent": rent_by.get(label)})
out = {"period": period, "source": "TCMB — Konut Fiyat Endeksi ve Yeni Kiracı Kira Endeksi (2023=100)",
       "sourceUrl": URL, "national": {"price": price_t["Türkiye"], "rent": rent_t["Türkiye"]},
       "cities": {k: {"price": price_t[k], "rent": rent_t[k]} for k in ("İstanbul", "Ankara", "İzmir")},
       "regions": regions}
p = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "turkeyKfe.json")
json.dump(out, open(p, "w"), ensure_ascii=False, indent=1)
print(period, len(regions), "regions; İstanbul", price_t["İstanbul"], rent_t["İstanbul"])
