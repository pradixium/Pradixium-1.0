/* PRADIXIUM™ — Lithuania Official Auction Watch
 * Source: evarzytynes.lt, the State Enterprise Centre of Registers'
 * (Valstybės įmonė Registrų centras) official e-auction portal, where
 * bailiffs (antstoliai) and insolvency administrators (nemokumo
 * administratoriai) must publish their real-estate sales.
 *
 * Reads only the public auction LIST pages (real estate, "announced and
 * running") and returns the fields shown there: auction number, state,
 * auction kind, start/end, starting price, last bid, the property line
 * (type + area) and its address. Detail pages carry contacts and owner
 * names — those are personal data and are deliberately never read or
 * copied; every row links to the official page instead.
 *
 * Fails closed: if the page structure changes and rows cannot be parsed,
 * the endpoint says so and returns no rows — it never guesses.
 *
 *   GET /api/lt-auctions?municipality=461&subtype=3&kind=bailiff
 */
const BASE = "https://www.evarzytynes.lt";
const LIST = BASE + "/evs/pages/auctions.do";
const SOURCE = "Registrų centras (State Enterprise Centre of Registers) — evarzytynes.lt official e-auctions";
const MAX_PAGES = 6;          // 20 rows per page
const FETCH_MS = 7000;

// codes and names exactly as in the portal's own search form (checked Sept 2026)
export const LT_MUNICIPALITIES = {"461":"Vilniaus m. sav.","43":"Kauno m. sav.","112":"Klaipėdos m. sav.","259":"Šiaulių m. sav.","205":"Panevėžio m. sav.","2":"Alytaus m. sav.","114":"Palangos m. sav.","260":"Akmenės r. sav.","4":"Alytaus r. sav.","393":"Anykščių r. sav.","42":"Birštono sav.","206":"Biržų r. sav.","3":"Druskininkų sav.","1191":"Elektrėnų sav.","413":"Ignalinos r. sav.","44":"Jonavos r. sav.","267":"Joniškio r. sav.","346":"Jurbarko r. sav.","53":"Kaišiadorių r. sav.","1192":"Kalvarijos sav.","63":"Kauno r. sav.","1193":"Kazlų Rūdos sav.","215":"Kėdainių r. sav.","278":"Kelmės r. sav.","115":"Klaipėdos r. sav.","127":"Kretingos r. sav.","228":"Kupiškio r. sav.","27":"Lazdijų r. sav.","162":"Marijampolės sav.","359":"Mažeikių r. sav.","426":"Molėtų r. sav.","113":"Neringos sav.","1196":"Pagėgių sav.","289":"Pakruojo r. sav.","235":"Panevėžio r. sav.","247":"Pasvalio r. sav.","367":"Plungės r. sav.","86":"Prienų r. sav.","298":"Radviliškio r. sav.","98":"Raseinių r. sav.","1197":"Rietavo sav.","438":"Rokiškio r. sav.","136":"Skuodo r. sav.","187":"Šakių r. sav.","513":"Šalčininkų r. sav.","311":"Šiaulių r. sav.","332":"Šilalės r. sav.","146":"Šilutės r. sav.","539":"Širvintų r. sav.","526":"Švenčionių r. sav.","323":"Tauragės r. sav.","381":"Telšių r. sav.","487":"Trakų r. sav.","501":"Ukmergės r. sav.","449":"Utenos r. sav.","16":"Varėnos r. sav.","163":"Vilkaviškio r. sav.","462":"Vilniaus r. sav.","459":"Visagino sav.","403":"Zarasų r. sav."};
// real-estate subtypes of the portal's form (estateType=1)
const SUBTYPES = { "2": "Buildings", "3": "Premises / apartments", "1": "Land plots", "4": "Other structures" };
const SUBTYPE_BY_LT = { "Pastatai": "Buildings", "Patalpos/Butai": "Premises / apartments", "Sklypai": "Land plots", "Kiti statiniai": "Other structures" };
// the portal's "kind" codes
const KINDS = { bailiff: { code: "1", lt: "Antstolių varžytynės", en: "Bailiff auction" }, insolvency: { code: "2", lt: "Nemokumo administratorių varžytynės", en: "Insolvency administrator auction" } };
const STATES = { "Paskelbtos": "Announced", "Vykstančios": "Running" };

const decode = (s) => String(s ?? "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&scaron;/g, "š").replace(/&Scaron;/g, "Š").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (s) => decode(String(s ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const eur = (s) => { const m = text(s).match(/^([\d\s]+(?:,\d+)?)\s*Eur$/); return m ? Number(m[1].replace(/\s/g, "").replace(",", ".")) : null; };
const num = (s) => Number(String(s).replace(/\s/g, "").replace(",", "."));

function field(chunk, label) {
  const m = chunk.match(new RegExp(`<span class="txt">\\s*(?:\\s|<[^>]+>)*${label}:\\s*(?:\\s|<[^>]+>)*</span>([\\s\\S]*?)</li>`));
  return m ? text(m[1]) : null;
}

// one list page → rows; null if the page does not look like the known structure
export function parseList(html) {
  const list = html.match(/<ul class="bid_list">([\s\S]*)/);
  const links = (html.match(/\/evs\/pages\/auction\.do\?id=\d+/g) || []).length;
  if (!list) return links ? null : { rows: [], lastPage: 0 };
  const pages = [...html.matchAll(/data-page="(\d+)"/g)].map((m) => Number(m[1]));
  const chunks = list[1].split(/<h2 class="no">/).slice(1);
  const rows = [];
  for (const c of chunks) {
    const link = c.match(/href="\/evs\/pages\/auction\.do\?id=(\d+)&(?:amp;)?number=(\d+)"/);
    if (!link) return null;
    const state = text(c.match(/label-primary[^"]*">([^<]*)</)?.[1]);
    const kind = text(c.match(/label-default[^"]*">([^<]*)</)?.[1]);
    const start = field(c, "Pradžia"), end = field(c, "Pabaiga");
    const startPrice = eur(field(c, "Pradinė kaina"));
    const lastBidTxt = field(c, "Paskutinė siūloma kaina");
    const items = [...(c.match(/<ul class="list">([\s\S]*?)<\/ul>/)?.[1] || "").matchAll(/<li>([\s\S]*?)<br\s*\/?>\s*<span class="small">([\s\S]*?)<\/span>\s*<\/li>/g)]
      .map((m) => {
        const desc = text(m[1]), address = text(m[2]);
        // area only when the line names exactly one property; "1/4 dalis" = a fractional share is sold
        const one = (desc.match(/kv\.\s*m|\sa\.\s*\(/g) || []).length === 1;
        const sq = one && desc.match(/,\s*([\d\s]+(?:,\d+)?)\s*kv\.\s*m\.?$/), ar = one && desc.match(/,\s*([\d\s]+(?:,\d+)?)\s*a\.\s*\(/);
        const share = desc.match(/(\d+\/\d+)\s*dalis/);
        return { description: desc, address, areaM2: sq ? num(sq[1]) : null, areaAres: ar ? num(ar[1]) : null, share: share ? share[1] : null };
      });
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(start || "") || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(end || "") || !items.length) return null;
    const subtypeLt = text(c.match(/<img[^>]*alt="([^"]*)"/)?.[1]) || null;
    rows.push({
      id: link[1], number: link[2], url: `${BASE}/evs/pages/auction.do?id=${link[1]}&number=${link[2]}`,
      state: STATES[state] || state || null, stateLt: state || null,
      kind: Object.values(KINDS).find((k) => k.lt === kind)?.en || kind || null, kindLt: kind || null,
      start, end, startPriceEur: startPrice,
      lastBidEur: eur(lastBidTxt),
      subtype: SUBTYPE_BY_LT[subtypeLt] || null, subtypeLt,
      items,
      // only for a single whole property measured in m² (not a share): starting price ÷ official area
      startPricePerM2: items.length === 1 && !items[0].share && items[0].areaM2 > 0 && startPrice ? Math.round(startPrice / items[0].areaM2) : null
    });
  }
  return { rows, lastPage: pages.length ? Math.max(...pages) : 0 };
}

// Registrų centras' public "average market value" (mass valuation) search by
// unique number. Cloudflare blocks server requests to it (tested from this
// sandbox and from Vercel, Sept 2026), so the visitor opens it themselves.
const VALUE_SEARCH = "https://www.registrucentras.lt/masvert/paieska-un";

export function parseUniqueNumbers(html) {
  const out = [];
  for (const m of html.matchAll(/<span class="left">Unikalus Nr\.:<\/span>\s*<span class="right">([^<]*)<\/span>[\s\S]*?<span class="left">Adresas:<\/span>\s*<span class="right">([^<]*)<\/span>/g)) {
    const un = text(m[1]);
    if (/^\d{4}-\d{4}-\d{4}(:\d{1,5})?$/.test(un) && !out.some((x) => x.uniqueNumber === un)) out.push({ uniqueNumber: un, address: text(m[2]) });
  }
  return out;
}

// Bank of Israel official representative rate (ILS per EUR), for Israeli
// investors; null if it does not answer quickly — prices then stay in EUR only
async function ilsPerEur() {
  try {
    const r = await fetch("https://boi.org.il/PublicApi/GetExchangeRate?key=EUR", { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    const rate = Number(j?.currentExchangeRate), unit = Number(j?.unit) || 1;
    return rate > 0 && j?.key === "EUR" ? { ilsPerEur: rate / unit, asOf: String(j.lastUpdate || "").slice(0, 10) || null, source: "Bank of Israel representative rate", sourceUrl: "https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/" } : null;
  } catch (e) { return null; }
}

async function getPage(params, page) {
  const q = new URLSearchParams({ listType: "1", estateType: "1", stateType: "PASKELBTA-IR-VYKSTA", sortBy: "endDate.ASC", ...params, page: String(page) });
  const res = await fetch(`${LIST}?${q}`, { headers: { "user-agent": "Pradixium/1.0 (+https://pradixium.com)", accept: "text/html" }, signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = parseList(await res.text());
  if (!parsed) throw new Error("format");
  return parsed;
}

async function getKind(params) {
  const first = await getPage(params, 0);
  const more = [];
  for (let p = 1; p <= Math.min(first.lastPage, MAX_PAGES - 1); p++) more.push(getPage(params, p));
  const rest = await Promise.all(more);
  return { rows: [first, ...rest].flatMap((x) => x.rows), truncated: first.lastPage > MAX_PAGES - 1 };
}

export default async function handler(req, res) {
  const q = req.query || {};
  // one auction's official property number(s) — the only field read from a
  // detail page (plus its address, to label it); no contacts or owner names
  if (q.id || q.number) {
    const id = String(q.id || ""), number = String(q.number || "");
    if (!/^\d{1,10}$/.test(id) || !/^\d{1,10}$/.test(number)) return res.status(400).json({ ok: false, error: "Invalid auction" });
    try {
      const r = await fetch(`${BASE}/evs/pages/auction.do?id=${id}&number=${number}`, { headers: { "user-agent": "Pradixium/1.0 (+https://pradixium.com)", accept: "text/html" }, signal: AbortSignal.timeout(FETCH_MS) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const properties = parseUniqueNumbers(await r.text());
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json({ ok: true, source: SOURCE, properties, valueSearchUrl: VALUE_SEARCH });
    } catch (e) {
      return res.status(502).json({ ok: false, error: "The official portal did not answer in time." });
    }
  }
  const municipality = q.municipality ? String(q.municipality) : "";
  const subtype = q.subtype ? String(q.subtype) : "";
  const kind = q.kind ? String(q.kind) : "all";
  if ((municipality && !LT_MUNICIPALITIES[municipality]) || (subtype && !SUBTYPES[subtype]) || !["all", ...Object.keys(KINDS)].includes(kind)) {
    return res.status(400).json({ ok: false, error: "Invalid filter" });
  }
  const kinds = kind === "all" ? Object.keys(KINDS) : [kind];
  const base = { ...(municipality && { municipality }), ...(subtype && { estateSubtype: subtype }) };
  try {
    const [fx, ...results] = await Promise.all([ilsPerEur(), ...kinds.map((k) => getKind({ ...base, kind: KINDS[k].code }))]);
    const seen = new Set();
    const rows = results.flatMap((r) => r.rows).map((r) => (subtype && !r.subtype ? { ...r, subtype: SUBTYPES[subtype] } : r)).filter((r) => !seen.has(r.id) && seen.add(r.id)).sort((a, b) => a.end.localeCompare(b.end));
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({
      ok: true, source: SOURCE, sourceUrl: BASE + "/", retrievedAt: new Date().toISOString(),
      filters: { municipality: municipality ? LT_MUNICIPALITIES[municipality] : null, subtype: SUBTYPES[subtype] || null, kind: kinds.map((k) => KINDS[k].en) },
      truncated: results.some((r) => r.truncated), count: rows.length, rows, fx,
      note: "Starting prices are set by the bailiff or insolvency administrator for the auction; they are not market values. Always read the official auction page (conditions, encumbrances, occupancy) before bidding."
    });
  } catch (e) {
    return res.status(502).json({ ok: false, source: SOURCE, sourceUrl: BASE + "/", error: e.message === "format" ? "The official portal's page format changed — no rows shown rather than possibly wrong ones." : "The official portal did not answer in time." });
  }
}
