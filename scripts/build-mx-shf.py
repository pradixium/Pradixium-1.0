#!/usr/bin/env python3
"""Builds lib/data/mexicoShf.json — Sociedad Hipotecaria Federal (SHF),
Índice SHF de Precios de la Vivienda, 2nd quarter 2026 (published
13 Aug 2026): per state the AVERAGE and quartile prices (25% / median /
75%) of homes bought with a mortgage credit (SHF: built from the
appraisals of mortgaged homes — new and used, houses and condominiums
together), the state's annual index change, and the annual change of the
56 municipalities in the release. SHF's own page prints the national
figures (average 1,960,032, median 1,299,580 pesos); the state and
municipal tables are images on SHF's page — copied by hand from the same
tables as reproduced by IIEG Jalisco (the state's statistics institute),
whose national row equals SHF's. Re-copy each quarter.

Place → state / municipality: INEGI's Catálogo Único de claves de áreas
geoestadísticas (localities with population, AGEEML CSV) — a locality name
found in several states goes to the largest one only when it has 10× the
population of the next; municipality and state names too.

  python3 scripts/build-mx-shf.py /path/to/AGEEML_*.csv
"""
import csv, json, sys, re, unicodedata, collections, pathlib

PERIOD = "2026 Q2"
# state: average, Q1 (25%), median (50%), Q3 (75%), annual index change %
STATES = {
 "Aguascalientes": (1566417, 769518, 1200000, 1938477, 9.93), "Baja California": (2320797, 1221836, 1587201, 2614000, 8.92),
 "Baja California Sur": (2615393, 1317000, 1845565, 2897733, 8.68), "Campeche": (1595079, 1021730, 1334000, 1872250, 6.95),
 "Chiapas": (1491025, 862915, 1177463, 1770425, 7.01), "Chihuahua": (1752882, 891642, 1301862, 2132894, 7.41),
 "Ciudad de México": (4285135, 2263012, 3301516, 5203073, 3.40), "Coahuila de Zaragoza": (1438369, 763280, 1020703, 1654824, 7.86),
 "Colima": (1476614, 811000, 1136195, 1632574, 7.13), "Durango": (1201986, 696826, 845983, 1309000, 6.10),
 "Guanajuato": (1659672, 833204, 1221641, 1910900, 8.06), "Guerrero": (1819781, 885618, 1293725, 1939403, 5.58),
 "Hidalgo": (1390156, 834743, 1193176, 1633550, 8.30), "Jalisco": (2107232, 721973, 1200979, 2532569, 10.13),
 "México": (2201128, 883395, 1364588, 2514775, 5.50), "Michoacán de Ocampo": (1587258, 799775, 1178900, 1797716, 7.19),
 "Morelos": (2232643, 1009408, 1711685, 2522000, 5.30), "Nayarit": (2256263, 1176055, 1529958, 2456575, 9.54),
 "Nuevo León": (2042664, 803858, 1214074, 2233216, 7.56), "Oaxaca": (2011338, 1002942, 1451000, 2079000, 6.99),
 "Puebla": (1916917, 963858, 1447020, 2303514, 8.30), "Querétaro": (2381522, 1285300, 1907749, 3005982, 4.87),
 "Quintana Roo": (1991230, 1084000, 1310995, 2230366, 9.80), "San Luis Potosí": (1833656, 979440, 1336978, 1898348, 6.75),
 "Sinaloa": (1726750, 845116, 1254600, 1956108, 8.43), "Sonora": (1767242, 865000, 1175452, 1923048, 9.20),
 "Tabasco": (1487379, 783845, 1077788, 1704422, 7.52), "Tamaulipas": (1147405, 727339, 845500, 1215640, 12.47),
 "Tlaxcala": (1168987, 699752, 937000, 1481250, 4.56), "Veracruz de Ignacio de la Llave": (1420765, 755000, 1022000, 1639046, 5.40),
 "Yucatán": (2019785, 975100, 1485687, 2342968, 8.69), "Zacatecas": (1293218, 769270, 1030960, 1539382, 6.12),
}
NATIONAL = (1960032, 843000, 1299580, 2226101, 7.31)
ABBR = {"TAMPS": "Tamaulipas", "PUE": "Puebla", "JAL": "Jalisco", "YUC": "Yucatán", "QROO": "Quintana Roo", "AGS": "Aguascalientes",
        "BC": "Baja California", "NAY": "Nayarit", "SON": "Sonora", "HGO": "Hidalgo", "NL": "Nuevo León", "BCS": "Baja California Sur",
        "SIN": "Sinaloa", "TAB": "Tabasco", "COL": "Colima", "GTO": "Guanajuato", "COAH": "Coahuila de Zaragoza", "CHIH": "Chihuahua",
        "SLP": "San Luis Potosí", "CHIS": "Chiapas", "MICH": "Michoacán de Ocampo", "CAMP": "Campeche", "DGO": "Durango", "MEX": "México",
        "OAX": "Oaxaca", "ZAC": "Zacatecas", "VER": "Veracruz de Ignacio de la Llave", "MOR": "Morelos", "GRO": "Guerrero"}
MUNIS = """Reynosa, TAMPS 13.51; Matamoros, TAMPS 12.72; Huejotzingo, PUE 10.61; Tlajomulco de Zúñiga, JAL 10.46; Kanasín, YUC 10.26;
Solidaridad, QROO 9.96; Aguascalientes, AGS 9.92; San Pedro Tlaquepaque, JAL 9.87; Benito Juárez, QROO 9.69; Guadalajara, JAL 9.64;
Mexicali, BC 9.61; Bahía de Banderas, NAY 9.61; Cajeme, SON 9.47; Tepic, NAY 9.36; Mineral de la Reforma, HGO 9.25; Zapopan, JAL 9.15;
Juárez, NL 9.04; Hermosillo, SON 8.93; Jesús María, AGS 8.89; La Paz, BCS 8.77; Tijuana, BC 8.64; Mazatlán, SIN 8.60; Mérida, YUC 8.49;
Los Cabos, BCS 8.48; García, NL 8.27; Nacajuca, TAB 8.21; Puebla, PUE 8.06; Culiacán, SIN 8.00; Villa de Álvarez, COL 7.81; Celaya, GTO 7.78;
Torreón, COAH 7.73; Tizayuca, HGO 7.72; León, GTO 7.72; Juárez, CHIH 7.63; Soledad de Graciano Sánchez, SLP 7.56; Apodaca, NL 7.44;
Saltillo, COAH 7.25; Tapachula, CHIS 7.19; Uruapan, MICH 7.09; Centro, TAB 7.08; Chihuahua, CHIH 6.99; Carmen, CAMP 6.97;
Gómez Palacio, DGO 6.92; Zumpango, MEX 6.88; Manzanillo, COL 6.85; Campeche, CAMP 6.84; Morelia, MICH 6.80; Tlacolula de Matamoros, OAX 6.63;
Guadalupe, ZAC 6.58; San Luis Potosí, SLP 6.44; Tuxtla Gutiérrez, CHIS 6.42; Monterrey, NL 6.41; Veracruz, VER 5.82; Temixco, MOR 5.78;
Zihuatanejo de Azueta, GRO 5.77; Emiliano Zapata, MOR 5.69"""
munis = {}
for item in MUNIS.replace("\n", " ").split(";"):
    m = re.match(r"\s*(.+), ([A-Z]+) ([\d.]+)\s*$", item)
    munis[f"{ABBR[m.group(2)]}|{m.group(1)}"] = float(m.group(3))
assert len(munis) == 56 and len(STATES) == 32

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()

# INEGI places: locality / municipality → (state, municipality)
cand = collections.defaultdict(list)
with open(sys.argv[1], encoding="latin1") as f:
    for r in csv.DictReader(f):
        pop = int(r["POB_TOTAL"]) if r["POB_TOTAL"].isdigit() else 0
        if r["CVE_LOC"] == "0001" or pop >= 2500:
            cand[norm(r["NOM_LOC"])].append((pop, r["NOM_ENT"], r["NOM_MUN"]))
        if r["CVE_LOC"] == "0001":   # the municipal seat stands for the municipality
            cand[norm(r["NOM_MUN"])].append((pop + 1, r["NOM_ENT"], r["NOM_MUN"]))
places = {}
for k, lst in cand.items():
    lst = sorted(set(lst), reverse=True)
    if len({(e, m) for _, e, m in lst}) == 1 or lst[0][0] >= 10 * max(lst[1][0], 1):
        places[k] = [lst[0][1], lst[0][2]]
for st in STATES:
    places[norm(st)] = [st, None]
for alias, st in {"cdmx": "Ciudad de México", "mexico city": "Ciudad de México", "ciudad de mexico": "Ciudad de México", "df": "Ciudad de México",
                  "distrito federal": "Ciudad de México", "estado de mexico": "México", "edomex": "México", "coahuila": "Coahuila de Zaragoza",
                  "michoacan": "Michoacán de Ocampo", "veracruz": "Veracruz de Ignacio de la Llave", "riviera maya": "Quintana Roo",
                  "nuevo vallarta": "Nayarit", "riviera nayarit": "Nayarit"}.items():
    places[alias] = [st, None]
out = {"period": PERIOD, "national": NATIONAL, "states": STATES, "municipalities": munis, "places": places,
       "source": "Sociedad Hipotecaria Federal (SHF) — Índice SHF de Precios de la Vivienda en México, segundo trimestre de 2026",
       "sourceUrl": "https://www.gob.mx/shf/articulos/indice-shf-de-precios-de-la-vivienda-en-mexico-segundo-trimestre-de-2026",
       "tablesUrl": "https://iieg.gob.mx/ns/wp-content/uploads/2026/08/reporte_indice_precios_vivienda_mexico_2doT_2026.pdf"}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/mexicoShf.json"
p.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print(len(places), "places", p.stat().st_size // 1024, "KB")
for k in ["cancun", "tulum", "playa del carmen", "cabo san lucas", "san miguel de allende", "puerto vallarta", "merida", "guadalajara", "monterrey", "cdmx", "nuevo vallarta", "polanco", "oaxaca"]:
    print(k, places.get(k))
