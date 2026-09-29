#!/usr/bin/env python3
"""Finland: Statistics Finland (Tilastokeskus) — prices per m² of OLD
dwellings in housing companies (asunto-osakeyhtiö), from the asset
transfer tax data, latest full year:
  13mx — by municipality: blocks of flats, terraced houses
  13mu — by postal code: flats by size (1 room / 2 rooms / 3+ rooms),
         terraced houses
Statistics Finland suppresses a figure with too few sales ("." / "..").
Detached houses (omakotitalot) are not in these statistics.
Re-run each spring when the new year is published:
  python3 scripts/build-fi-prices.py
"""
import json, os, urllib.request

API = "https://pxdata.stat.fi/PxWeb/api/v1/en/StatFin/ashi/"
UA = {"User-Agent": "Mozilla/5.0 (Pradixium data build)", "Content-Type": "application/json"}

def meta(t):
    return json.loads(urllib.request.urlopen(urllib.request.Request(API + t, headers=UA), timeout=120).read())

def query(t, sel):
    body = json.dumps({"query": [{"code": k, "selection": {"filter": "item", "values": v}} for k, v in sel.items()], "response": {"format": "json-stat2"}}).encode()
    return json.loads(urllib.request.urlopen(urllib.request.Request(API + t, data=body, headers=UA), timeout=300).read())

def cube(d):
    ids = d["id"]; size = d["size"]
    cats = [list(d["dimension"][i]["category"]["index"].keys()) for i in ids]
    labels = {i: d["dimension"][i]["category"].get("label", {}) for i in ids}
    def at(**k):
        pos = 0
        for n, i in enumerate(ids):
            pos = pos * size[n] + cats[n].index(k[i])
        v = d["value"][pos]
        return v if isinstance(v, (int, float)) else None
    return cats, labels, at

out = {"source": "Statistics Finland — Prices of dwellings in housing companies (old dwellings)",
       "sourceUrl": "https://stat.fi/en/statistics/ashi"}

m = meta("13mx.px")
year = m["variables"][0]["values"][-1]
codes = {v["code"]: v for v in m["variables"]}
mun_var, type_var = "kunta_1_20150101", "talotyyppi_5_20111209"
d = query("13mx.px", {"timeperiod_y": [year], mun_var: codes[mun_var]["values"], type_var: ["1", "3"], "contentscode": ["keskihinta_aritm_nw", "lkm_julk20"]})
cats, labels, at = cube(d)
munis = {}
for c in cats[d["id"].index(mun_var)]:
    name = labels[mun_var][c]
    e = {"name": name}
    for t, key in (("3", "flats"), ("1", "terraced")):
        eur = at(timeperiod_y=year, **{mun_var: c, type_var: t, "contentscode": "keskihinta_aritm_nw"})
        n = at(timeperiod_y=year, **{mun_var: c, type_var: t, "contentscode": "lkm_julk20"})
        if eur: e[key] = {"eur": round(eur), "sales": int(n) if n else None}
    munis[c] = e
out["year"] = year
out["municipalities"] = munis

m2 = meta("13mu.px")
year2 = m2["variables"][0]["values"][-1]
pc_var, t2 = "postinumeroalue_4_20220101", "talotyyppi_6_20131021"
pcs_all = next(v for v in m2["variables"] if v["code"] == pc_var)
d2 = query("13mu.px", {"timeperiod_y": [year2], pc_var: pcs_all["values"], t2: ["1", "2", "3", "5"], "contentscode": ["keskihinta_aritm_nw", "lkm_julk20"]})
cats2, labels2, at2 = cube(d2)
pcs = {}
for c in cats2[d2["id"].index(pc_var)]:
    label = labels2[pc_var][c]  # "00100  Helsinki keskusta - Etu-Töölö (Helsinki)"
    area, _, muni = label[len(c):].strip().rpartition(" (")
    e = {"area": area.strip(), "municipality": muni.rstrip(")")}
    for t, key in (("1", "flats1"), ("2", "flats2"), ("3", "flats3"), ("5", "terraced")):
        eur = at2(timeperiod_y=year2, **{pc_var: c, t2: t, "contentscode": "keskihinta_aritm_nw"})
        n = at2(timeperiod_y=year2, **{pc_var: c, t2: t, "contentscode": "lkm_julk20"})
        if eur: e[key] = {"eur": round(eur), "sales": int(n) if n else None}
    if len(e) > 2: pcs[c] = e
out["postcodeYear"] = year2
out["postcodes"] = pcs

hel = next(v for v in munis.values() if v["name"] == "Helsinki")
assert hel.get("flats", {}).get("eur"), "format changed"
dst = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "finlandPrices.json")
json.dump(out, open(dst, "w"), ensure_ascii=False, separators=(",", ":"))
print(year, len(munis), "municipalities,", sum(1 for v in munis.values() if "flats" in v), "with flats;", year2, len(pcs), "postcodes; Helsinki", hel)
