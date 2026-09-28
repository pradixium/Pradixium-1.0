// Builds lib/data/njResidentialSales.js from the New Jersey Treasury's
// SR1A sales files — every recorded deed in the state, with the assessor's
// usable / non-usable flag and the living area. Run monthly (the Treasury
// refreshes the year-to-date file roughly monthly):
//
//   node scripts/build-nj-sales.mjs            # current year
//   node scripts/build-nj-sales.mjs 2027       # a given year
//
// Needs network access to nj.gov and maps.nj.gov, and the `unzip` CLI.
// Rules (all from the file itself, nothing estimated):
//  - only sales the assessor marked usable (U-N-TYPE = "U", no non-usable
//    code) — non-usable = family transfers, foreclosures, estate sales etc.
//  - property class 2 (residential, up to 4 families)
//  - condo vs house split by the SR1A condominium qualifier ("C…")
//  - deed dates in the 12 months up to the latest deed in the file; any
//    deed dated after the build date is dropped as a data-entry error
//  - price = verified sales price (reported price if no verified one)
//  - per-sq-ft only from sales with a living-space figure
//  - a municipality/type is published only with 10+ sales
// Layout: https://www.nj.gov/treasury/taxation/pdf/lpt/SR1Afilelayout.pdf
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const YEAR = Number(process.argv[2]) || new Date().getFullYear();
const BASE = "https://www.nj.gov/treasury/taxation/lpt/statdata/";
const FILES = [`Sales${YEAR - 1}.zip`, `YTDSR1A${YEAR}.zip`];
const MUNI_URL = "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0/query";
const MIN_SALES = 10;
const OUT = new URL("../lib/data/njResidentialSales.js", import.meta.url);

const dir = mkdtempSync(join(tmpdir(), "nj-sr1a-"));
const field = (l, a, b) => l.slice(a - 1, b);
const deedDate = (s) => {
  if (!/^\d{6}$/.test(s)) return null;
  const d = new Date(Date.UTC(2000 + Number(s.slice(0, 2)), Number(s.slice(2, 4)) - 1, Number(s.slice(4, 6))));
  return Number.isNaN(d.getTime()) ? null : d;
};
const median = (xs) => {
  const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

const sales = new Map();
for (const f of FILES) {
  const zip = join(dir, f);
  const res = await fetch(BASE + f);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const text = execFileSync("unzip", ["-p", zip], { maxBuffer: 1 << 30 }).toString("latin1");
  for (const l of text.split(/\r?\n/)) {
    if (l.length < 600) continue;
    const r = {
      muni: field(l, 1, 4),
      usable: field(l, 34, 34) === "U" && !field(l, 35, 37).trim(),
      price: Number(field(l, 47, 55)) || Number(field(l, 38, 46)) || 0,
      deed: field(l, 339, 344),
      block: field(l, 351, 359).trim(),
      lot: field(l, 360, 368).trim(),
      qual: field(l, 620, 624).trim(),
      cls: field(l, 627, 629).trim(),
      living: Number(field(l, 657, 663).trim()) || 0
    };
    sales.set([r.muni, r.block, r.lot, r.deed, r.price].join("|"), r); // same deed in both files counted once
  }
}

const now = new Date();
const dated = [...sales.values()].map((r) => ({ ...r, date: deedDate(r.deed) })).filter((r) => r.date && r.date <= now);
const latest = dated.reduce((m, r) => (r.date > m ? r.date : m), new Date(0));
const start = new Date(Date.UTC(latest.getUTCFullYear() - 1, latest.getUTCMonth(), latest.getUTCDate() + 1));
const used = dated.filter((r) => r.usable && r.cls === "2" && r.price > 0 && r.date >= start);

const groups = {};
for (const r of used) {
  const type = /^c/i.test(r.qual) ? "condo" : "house";
  for (const key of [type, "all"]) ((groups[r.muni] ||= {})[key] ||= []).push(r);
}

const muniRes = await fetch(MUNI_URL + "?" + new URLSearchParams({
  where: "1=1", groupByFieldsForStatistics: "PCL_MUN,MUN_NAME,COUNTY", f: "json",
  outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" }])
}));
const names = {};
const muniJson = await muniRes.json();
if (!Array.isArray(muniJson.features)) throw new Error("municipality names query failed: " + JSON.stringify(muniJson.error || muniJson));
for (const { attributes: a } of muniJson.features) {
  if (a.MUN_NAME && (!names[a.PCL_MUN] || a.n > names[a.PCL_MUN].n)) names[a.PCL_MUN] = { name: a.MUN_NAME, county: a.COUNTY, n: a.n };
}

const out = {};
for (const [muni, byType] of Object.entries(groups)) {
  const entry = {};
  for (const [type, rows] of Object.entries(byType)) {
    if (rows.length < MIN_SALES) continue;
    const withArea = rows.filter((r) => r.living > 0);
    entry[type] = {
      sales: rows.length,
      medianPrice: Math.round(median(rows.map((r) => r.price))),
      medianPerSqFt: withArea.length >= MIN_SALES ? Math.round(median(withArea.map((r) => r.price / r.living))) : null,
      salesWithArea: withArea.length
    };
  }
  if (Object.keys(entry).length) out[muni] = { name: names[muni]?.name || null, county: names[muni]?.county || null, ...entry };
}

const iso = (d) => d.toISOString().slice(0, 10);
const header = `/* PRADIXIUM™ — New Jersey residential sales by municipality (GENERATED)
 * Do not edit by hand — regenerate with: node scripts/build-nj-sales.mjs
 * Source: New Jersey Department of the Treasury, Division of Taxation —
 * SR1A sales files (${FILES.join(", ")}), every recorded deed in NJ with the
 * assessor's usable/non-usable determination and the living area.
 * https://www.nj.gov/treasury/taxation/lpt/statdata.shtml
 * Usable class-2 (residential) sales only, deeds ${iso(start)} to ${iso(latest)};
 * condo vs house by the SR1A condominium qualifier; 10+ sales per figure.
 * Keys are the 4-digit NJ county+district (municipality) codes.
 */
`;
writeFileSync(OUT, header + `export const NJ_SALES_META = ${JSON.stringify({
  source: "New Jersey Department of the Treasury — SR1A sales file",
  sourceUrl: "https://www.nj.gov/treasury/taxation/lpt/statdata.shtml",
  periodFrom: iso(start), periodTo: iso(latest), builtOn: iso(now), minSales: MIN_SALES
}, null, 2)};

export const NJ_SALES_BY_MUNI = ${JSON.stringify(out)};

export function getNjMuniSales(muniCode) {
  const m = NJ_SALES_BY_MUNI[String(muniCode || "").trim()];
  return m ? { code: String(muniCode).trim(), ...m } : null;
}
`);
console.log(`NJ: ${used.length} usable residential sales ${iso(start)}..${iso(latest)} → ${Object.keys(out).length} municipalities`);
