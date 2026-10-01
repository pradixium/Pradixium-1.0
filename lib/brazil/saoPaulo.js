/* PRADIXIUM™ — City of São Paulo: registered sale prices from the city's
 * own property-transfer-tax records (Secretaria Municipal da Fazenda,
 * "Guias de ITBI pagas", open data; lib/data/saoPauloSales.json ←
 * scripts/build-br-sp-itbi.py). Purchase-and-sale ("compra e venda") deeds
 * of one whole property, multi-unit deeds dropped, 12 months, per IPTU
 * fiscal sector (first 3 digits of the property's SQL number).
 * Place → sector: the CEP (postcode) when typed, else the street as the
 * city writes it ("R", "AV", "AL" …) + the nearest recorded house number on
 * the same side, else a bairro the file attributes to one sector. Nothing
 * matched → no figure (the report asks for the street and number or CEP).
 * Benchmark = the sector's median WHOLE price for flats or houses; the
 * per-m² figure is context (IPTU built area of a flat includes a share of
 * the common areas). Values are those DECLARED by the taxpayer.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function data() {
  if (doc === undefined) { try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "saoPauloSales.json"), "utf8")); } catch { doc = null; } }
  return doc;
}
export const SP_SOURCE = "Prefeitura de São Paulo — Secretaria Municipal da Fazenda, Guias de ITBI pagas (open data)";
export const SP_URL = "https://prefeitura.sp.gov.br/fazenda/w/acesso_a_informacao/31501";
const up = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
// the file's own abbreviations (checked against its street list)
const ABBR = [
  [/^RUA /, "R "], [/^AVENIDA /, "AV "], [/^ALAMEDA /, "AL "], [/^TRAVESSA /, "TV "], [/^PRACA /, "PC "], [/^LARGO /, "LG "], [/^ESTRADA /, "ES "], [/^VIELA /, "VL "],
  [/ DOUTOR /g, " DR "], [/ DOUTORA /g, " DRA "], [/ PROFESSOR /g, " PROF "], [/ PROFESSORA /g, " PROFA "], [/ PADRE /g, " PDE "], [/ CORONEL /g, " CEL "],
  [/ ENGENHEIRO /g, " ENG "], [/ GENERAL /g, " GAL "], [/ CAPITAO /g, " CAP "], [/ BRIGADEIRO /g, " BRIG "], [/ SANTA /g, " STA "], [/ SANTO /g, " STO "],
  [/ SAO /g, " S "], [/ MARECHAL /g, " MAL "], [/ SENADOR /g, " SEN "], [/ VISCONDE /g, " VISC "], [/ MINISTRO /g, " MIN "], [/ MAJOR /g, " MAJ "],
  [/ DESEMBARGADOR /g, " DESEM "], [/ COMENDADOR /g, " COMEN "], [/ BARAO /g, " BR "], [/ NOSSA SENHORA /g, " NSRA "], [/ PRESIDENTE /g, " PRES "]
];
const toFileStreet = (s) => { let x = ` ${up(s)} `; for (const [re, r] of ABBR) x = re.source.startsWith("^") ? ` ${x.trim().replace(re, r)} ` : x.replace(re, r); return x.trim(); };
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const titleCase = (s) => String(s).toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

export function saoPauloBenchmark({ text, propertyType }) {
  const d = data();
  if (!d) return null;
  const raw = String(text || "");
  if (!/s[aã]o paulo|\bsp\b/i.test(raw)) return null;
  const L = d.lookup;
  let sector = null, how = null;
  const cep = raw.match(/\b(\d{5})-?(\d{3})\b/);
  if (cep) { sector = L.cep8[cep[1] + cep[2]] || L.cep5[cep[1]] || null; if (sector) how = `postcode ${cep[1]}-${cep[2]}`; }
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (!sector) {
    // "Rua Montesquieu 105" / "Rua Montesquieu, 105"
    const first = parts[0] || "";
    const numM = first.match(/\b(\d{1,5})\b/) || (parts[1] || "").match(/^(\d{1,5})\b/);
    const name = toFileStreet(first.replace(/\b\d{1,5}\b.*$/, ""));
    const list = L.street[name];
    if (list && list.length) {
      const sectors = [...new Set(list.map((x) => x[1]))];
      if (sectors.length === 1) { sector = sectors[0]; how = `${titleCase(name)}`; }
      else if (numM) {
        const n = Number(numM[1]);
        const same = list.filter((x) => x[0] % 2 === n % 2 && Math.abs(x[0] - n) <= 300).sort((a, b) => Math.abs(a[0] - n) - Math.abs(b[0] - n));
        if (same.length) { sector = same[0][1]; how = `${titleCase(name)} ${n}`; }
      }
    }
  }
  if (!sector) {
    for (const p of parts) { const b = L.bairro[up(p)] || L.bairro[up(p).replace(/^VILA /, "VL ").replace(/^JARDIM /, "JD ")]; if (b) { sector = b; how = titleCase(p); break; } }
  }
  if (!sector) return { found: false, text: "No São Paulo fiscal sector could be matched — enter the street and number (for example \"Rua Montesquieu 105, São Paulo\") or the CEP to get the city's registered sale prices for the area." };
  const isHouse = /house|villa|detached|town/i.test(String(propertyType || "")) && !/apart|flat|studio|condo/i.test(String(propertyType || ""));
  const s = d.sectors[sector];
  const g = s?.[isHouse ? "house" : "flat"];
  const m = d.meta;
  const area = `São Paulo — IPTU fiscal sector ${sector}${s?.names?.length ? ` (${s.names.filter((x) => !/SUBCOND|TORRE|BLOCO|\bED\b|\bCOND\b|SETOR|PISO/.test(x)).slice(0, 3).map(titleCase).join(", ")})` : ""}`;
  if (!g) return { found: false, area, text: `The city's ITBI records hold fewer than 10 ${isHouse ? "house" : "apartment"} sales in fiscal sector ${sector} (${how}) between ${m.from} and ${m.to} — no area figure.` };
  const typeWord = isHouse ? "houses (IPTU use \"residência\")" : "apartments in condominium";
  return {
    found: true, value: g.median, unit: "total", currency: "BRL", area, period: `${m.from} to ${m.to}`, sales: g.n,
    label: `São Paulo ITBI registered sales — sector ${sector}`,
    text: `City of São Paulo ITBI records (Secretaria Municipal da Fazenda), ${m.from} to ${m.to}: ${g.n} purchase-and-sale deeds of ${typeWord} in fiscal sector ${sector} (matched by ${how}), median declared price R$ ${fmt(g.median)} (middle half R$ ${fmt(g.p25)}–${fmt(g.p75)}). Whole property, one property per deed; auctions, foreclosures, capital contributions and multi-unit deeds excluded. Values are as declared by the taxpayer.${g.m2 ? ` Per m² of IPTU built area: median R$ ${fmt(g.m2)}${isHouse ? "" : " — for a flat that area includes a share of the common areas, so it is lower than a price per m² of private area"} (context only).` : ""}`,
    source: SP_SOURCE, sourceUrl: SP_URL
  };
}
