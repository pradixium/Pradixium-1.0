#!/usr/bin/env python3
"""Builds lib/data/saoPauloSales.json — City of São Paulo, Secretaria
Municipal da Fazenda: "Guias de ITBI pagas" (every paid property-transfer-
tax declaration, open data, monthly sheets; no buyer/seller names).

  python3 scripts/build-br-sp-itbi.py <file-2025.xlsx> <file-2026.xlsx>
  (files: prefeitura.sp.gov.br/fazenda/w/acesso_a_informacao/31501)

Rules (from the file itself, nothing estimated):
 - Natureza "1.Compra e venda" only (not auctions, capital contributions,
   foreclosures, swaps, divorce shares …), 100% of the property transferred,
   SQL "Ativo Predial", declared transaction value > R$10,000
 - flats = IPTU use "APARTAMENTO EM CONDOMÍNIO"; houses = "RESIDÊNCIA"
 - a date + value + registry office shared by several SQLs = one deed for
   several units → dropped
 - 12 months of transaction dates up to the last full month in the file
 - grouped by IPTU fiscal sector (first 3 digits of the SQL); 10+ sales
 - WHOLE-PRICE median = the benchmark; per m² of IPTU built area is
   context only (for a flat it includes a share of the common areas)
 - the value is the one DECLARED by the taxpayer (the tax base is the
   higher of it and the city's reference value) — said in the report
Lookups for the report: street (as written in the file) + number → sector,
CEP (8 and 5 digits) → sector, bairro (when filled) → sector.
"""
import sys, re, json, pickle, datetime, statistics, collections, pathlib, unicodedata
import openpyxl

def rows(path):
    wb = openpyxl.load_workbook(path, read_only=True)
    for ws in wb.worksheets:
        if not re.match(r"^[A-Z]{3}-\d{4}$", ws.title): continue
        it = ws.iter_rows(values_only=True)
        h = [str(x).strip() if x else x for x in next(it)]
        for r in it:
            if r and r[0] is not None: yield dict(zip(h, r))

def norm(s):
    s = unicodedata.normalize("NFD", str(s or "")).encode("ascii", "ignore").decode().upper()
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]", " ", s)).strip()

allr = []
for f in sys.argv[1:]:
    allr.extend(rows(f))
VAL, DATE, AREA = "Valor de Transação (declarado pelo contribuinte)", "Data de Transação", "Área Construída (m2)"
USE = "Descrição do uso (IPTU)"
sales = [r for r in allr if str(r.get("Natureza de Transação", "")).startswith("1.") and r.get("Proporção Transmitida (%)") == 100
         and r.get("Situação do SQL") == "Ativo Predial" and isinstance(r.get(DATE), datetime.datetime) and (r.get(VAL) or 0) > 10000]
# one row per SQL + date + value (a guide may be listed twice)
seen, uniq = set(), []
for r in sales:
    k = (r["N° do Cadastro (SQL)"], r[DATE], r[VAL])
    if k not in seen: seen.add(k); uniq.append(r)
deed = collections.Counter((r[DATE], r[VAL], r.get("Cartório de Registro")) for r in uniq)
multi = sum(1 for r in uniq if deed[(r[DATE], r[VAL], r.get("Cartório de Registro"))] > 1)
uniq = [r for r in uniq if deed[(r[DATE], r[VAL], r.get("Cartório de Registro"))] == 1]

last = max(r[DATE] for r in uniq if r[DATE] <= datetime.datetime.now())
# last FULL month: the file's newest month is still filling up
end = datetime.datetime(last.year, last.month, 1) - datetime.timedelta(days=1)
start = datetime.datetime(end.year - 1, end.month, 1) + datetime.timedelta(days=32)
start = datetime.datetime(start.year, start.month, 1)
win = [r for r in uniq if start <= r[DATE] <= end]

def kind(r):
    u = str(r.get(USE) or "")
    return "flat" if u.startswith("APARTAMENTO EM CONDOM") else "house" if u == "RESIDÊNCIA" else None

sector = lambda r: str(r["N° do Cadastro (SQL)"]).zfill(11)[:3]
groups = collections.defaultdict(lambda: {"v": [], "m2": [], "bairros": collections.Counter()})
for r in win:
    k = kind(r)
    if not k: continue
    g = groups[(sector(r), k)]
    g["v"].append(float(r[VAL]))
    a = float(r.get(AREA) or 0)
    if a > 15: g["m2"].append(float(r[VAL]) / a)
    if r.get("Bairro"): g["bairros"][norm(r["Bairro"])] += 1
out = {}
for (s, k), g in groups.items():
    if len(g["v"]) < 10: continue
    v = sorted(g["v"]); q = statistics.quantiles(v, n=4)
    out.setdefault(s, {})[k] = {"n": len(v), "median": round(statistics.median(v)), "p25": round(q[0]), "p75": round(q[2]),
                                "m2": round(statistics.median(g["m2"])) if len(g["m2"]) >= 10 else None}
    out[s].setdefault("names", [])
    out[s]["names"] = sorted(set(out[s]["names"]) | {b for b, _ in g["bairros"].most_common(3) if not re.match(r"^(TORRE|BL|BLOCO|ED|COND)\b", b)})[:5]

# lookups from every sale row (all uses), 12 months
street = collections.defaultdict(set)
cep8, cep5, bairro = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
for r in uniq:
    s = sector(r)
    if r.get("Nome do Logradouro") and isinstance(r.get("Número"), (int, float)):
        street[norm(r["Nome do Logradouro"])].add((int(r["Número"]), s))
    c = str(r.get("CEP") or "").zfill(8)
    if c.strip("0"): cep8[c][s] += 1; cep5[c[:5]][s] += 1
    if r.get("Bairro") and not re.match(r"^(TORRE|BL|BLOCO|ED|COND)\b", norm(r["Bairro"])): bairro[norm(r["Bairro"])][s] += 1
def majority(c, share=0.7, n=3):
    t = sum(c.values()); s, m = c.most_common(1)[0]
    return s if t >= n and m / t >= share else None
lookup = {
    "street": {k: sorted(v) for k, v in street.items()},
    "cep8": {k: s for k, c in cep8.items() if (s := majority(c, 0.7, 1))},
    "cep5": {k: s for k, c in cep5.items() if (s := majority(c))},
    "bairro": {k: s for k, c in bairro.items() if (s := majority(c, 0.6, 5))},
}
meta = {"from": start.date().isoformat(), "to": end.date().isoformat(), "sales": len(win), "multiUnitDropped": multi,
        "sectors": len(out), "built": datetime.date.today().isoformat()}
p = pathlib.Path(__file__).resolve().parent.parent / "lib/data/saoPauloSales.json"
p.write_text(json.dumps({"meta": meta, "sectors": out, "lookup": lookup}, ensure_ascii=False, separators=(",", ":")))
print(meta, {k: len(v) for k, v in lookup.items()}, p.stat().st_size // 1024, "KB")
