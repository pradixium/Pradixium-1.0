#!/usr/bin/env python3
"""Spain: INE census-section perimeters (Censo 2021, as distributed by MIVAU
with the SERPAVI database: SECC_CE_20210101_INE_WM.zip on cdn.mivau.gob.es)
→ lib/data/spainSections/<CUMUN>.json.gz, only for municipalities with 2+
sections that carry a SERPAVI rent (lib/data/spainRents.json). Web Mercator
→ lon/lat, simplified to ~5 m. Used to put a geocoded address into its
section for the section's official rent.
  python3 scripts/build-es-sections.py <SECC_CE_…_WM.shp>
"""
import gzip, json, math, os, sys, collections
import shapefile
from shapely.geometry import shape, mapping
here = os.path.dirname(__file__)
rents = json.load(open(os.path.join(here, "..", "lib", "data", "spainRents.json")))["sections"]
per = collections.Counter(k[:5] for k in rents)
keep = {m for m, n in per.items() if n >= 2}
out_dir = os.path.join(here, "..", "lib", "data", "spainSections"); os.makedirs(out_dir, exist_ok=True)
R = 6378137.0
def ll(x, y): return [round(math.degrees(x / R), 6), round(math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2), 6)]
r = shapefile.Reader(sys.argv[1])
by = collections.defaultdict(list)
for sr in r.iterShapeRecords():
    rec = sr.record.as_dict(); cu = rec["CUMUN"]
    if cu not in keep or rec["CUSEC"] not in rents: continue
    g = shape(sr.shape.__geo_interface__).simplify(5, preserve_topology=True)
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    by[cu].append({"s": rec["CUSEC"], "p": [[[ll(x, y) for x, y in ring.coords] for ring in [p.exterior, *p.interiors]] for p in polys]})
for cu, secs in by.items():
    with gzip.open(os.path.join(out_dir, f"{cu}.json.gz"), "wt", encoding="utf8") as fh:
        json.dump({"cumun": cu, "sections": secs}, fh, separators=(",", ":"))
print(len(by), "municipalities,", sum(len(v) for v in by.values()), "sections")
