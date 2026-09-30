import { readFileSync } from 'node:fs';
import path from 'node:path';
const esc = (value) => String(value || '').trim().slice(0, 300);

// FIX: these used to be hardcoded to one month's filename (e.g. "...-2026-06.csv").
// HM Land Registry publishes a new dated file every month and does not keep a
// stable "latest" alias, so a fixed filename silently goes stale — it either
// 404s once the archive layout shifts, or quietly serves an increasingly old
// release forever. Instead, walk backwards from the current month/year and use
// whichever real, currently-published government file responds first — same
// self-healing pattern already used for the U.S. Florida cadastral fallback.
function monthLabel(date, monthsAgo) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsAgo, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function resolveLatestUkHpiFiles(maxMonthsBack = 6) {
  // the newest release is usually 2 months back: probe every candidate month
  // at once with a HEAD request, then download only the newest that exists
  const now = new Date();
  const base = 'https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/';
  const labels = Array.from({ length: maxMonthsBack + 1 }, (_, i) => monthLabel(now, i));
  const exists = await Promise.all(labels.map(async (label) => {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 6000);
    try { const r = await fetch(`${base}Average-prices-${label}.csv`, { method: 'HEAD', signal: c.signal }); return r.ok; } catch { return false; } finally { clearTimeout(t); }
  }));
  for (let i = 0; i < labels.length; i += 1) {
    if (!exists[i]) continue;
    const label = labels[i];
    try {
      const [averageText, typeText] = await Promise.all([fetchText(`${base}Average-prices-${label}.csv`), fetchText(`${base}Average-prices-Property-Type-${label}.csv`).catch(() => null)]);
      if (averageText) return { label, averageText, typeText };
    } catch (_error) { /* listed but not readable — try the prior month */ }
  }
  return null;
}

async function resolveLatestPricePaid(maxYearsBack = 1) {
  const now = new Date();
  for (let i = 0; i <= maxYearsBack; i += 1) {
    const year = now.getUTCFullYear() - i;
    const url = `https://price-paid-data.publicdata.landregistry.gov.uk/pp-${year}.csv`;
    try {
      const text = await fetchText(url, 20000);
      if (text) return { year, text };
    } catch (_error) {
      // Early in a calendar year the current year's file may not exist yet — fall back to last year's.
    }
  }
  return null;
}

let ppdCache = { loadedAt: 0, rows: [], year: null, error: null };

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'text/csv,text/plain,*/*' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function csvLine(line) {
  const out = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      out.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  out.push(value);
  return out;
}

function parseCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map(csvLine);
  return rows;
}

function normalise(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// ONS Price Index of Private Rents (PIPR): average monthly private rent per
// local authority (England, Wales, London boroughs; Scotland by rental area)
// by bedrooms and home type — lib/data/ukRents.json ← scripts/build-uk-rents.py
// (re-run monthly). Only the property's OWN local authority is used; no
// match → no rent (a region's or England's average is never a town's rent).
let ukRentDoc;
function ukRentData() {
  if (ukRentDoc === undefined) { try { ukRentDoc = JSON.parse(readFileSync(path.join(process.cwd(), 'lib', 'data', 'ukRents.json'), 'utf8')); } catch { ukRentDoc = null; } }
  return ukRentDoc;
}
const laKey = (v) => normalise(v).replace(/^(city|county|royal borough) of /, '').replace(/, (city|county) of$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
function ukRentFor(names, bedrooms, propertyType) {
  const d = ukRentData();
  if (!d) return { available: false };
  const byName = {};
  for (const a of Object.values(d.areas)) if (/^(E0[6789]|W06|S33)/.test(a.code)) byName[laKey(a.name)] = a;
  const hit = names.map(laKey).map((k) => byName[k]).find(Boolean);
  if (!hit) return { available: false, reason: 'no_local_authority' };
  const beds = Number(bedrooms);
  const t = normalise(propertyType);
  const [key, label] = beds >= 1 ? (beds >= 4 ? ['bed4', '4+ bedroom homes'] : [`bed${beds}`, `${beds}-bedroom homes`])
    : /apart|flat|studio|penthouse|maison/.test(t) ? ['flat', 'flats and maisonettes']
    : /terrace|town/.test(t) ? ['terraced', 'terraced houses']
    : /semi/.test(t) ? ['semi', 'semi-detached houses']
    : /detached|villa/.test(t) ? ['detached', 'detached houses'] : ['all', 'all homes'];
  const v = hit[key]?.rent ? hit[key] : hit.all;
  return { available: Boolean(v?.rent), matchedArea: hit.name, monthlyRentGbp: v?.rent ?? null, annualChangePercent: v?.yoy ?? null,
    rentBasis: hit[key]?.rent ? label : 'all homes', period: d.period, sourceUrl: d.sourceUrl };
}

function postcodeFrom(value) {
  const match = String(value || '').toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  // "DL148ED" and "DL14 8ED" are the same postcode: the inward part is
  // always the last three characters
  const pc = match ? match[1].replace(/\s+/g, '') : null;
  return pc ? `${pc.slice(0, -3)} ${pc.slice(-3)}` : null;
}

function median(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function mean(values) {
  const a = values.filter(Number.isFinite);
  return a.length ? a.reduce((sum, value) => sum + value, 0) / a.length : null;
}

async function loadPricePaid() {
  const now = Date.now();
  if (ppdCache.rows.length && now - ppdCache.loadedAt < 21600000) return ppdCache;
  try {
    const resolved = await resolveLatestPricePaid();
    if (!resolved) throw new Error('No Price Paid Data file found for the current or prior year');
    const rows = parseCsv(resolved.text);
    const parsed = [];
    for (const row of rows) {
      if (row.length < 16) continue;
      const price = Number(row[1]);
      if (!Number.isFinite(price) || price <= 0) continue;
      parsed.push({
        transactionId: row[0] || null,
        price,
        date: row[2] || null,
        postcode: String(row[3] || '').trim().toUpperCase(),
        propertyType: row[4] || null,
        tenure: row[6] || null,
        paon: row[7] || null,
        saon: row[8] || null,
        street: row[9] || null,
        locality: row[10] || null,
        town: row[11] || null,
        district: row[12] || null,
        county: row[13] || null,
        category: row[14] || null,
        status: row[15] || null
      });
    }
    ppdCache = { loadedAt: now, rows: parsed, year: resolved.year, error: null };
    return ppdCache;
  } catch (error) {
    ppdCache = { loadedAt: now, rows: [], year: null, error: String(error?.message || error) };
    return ppdCache;
  }
}

// Site property type → Price Paid / UK HPI property types
function ukTypes(propertyType) {
  const t = normalise(propertyType);
  if (/apart|flat|studio|penthouse|maison/.test(t)) return { codes: ['F'], hpi: 'Flat', label: 'flats' };
  if (/town|terrace/.test(t)) return { codes: ['T'], hpi: 'Terraced', label: 'terraced houses' };
  if (/semi/.test(t)) return { codes: ['S'], hpi: 'Semi_Detached', label: 'semi-detached houses' };
  if (/detached|villa/.test(t) && !/house/.test(t)) return { codes: ['D'], hpi: 'Detached', label: 'detached houses' };
  if (/house|home|cottage|bungalow/.test(t)) return { codes: ['D', 'S', 'T'], hpi: null, label: 'houses' };
  return null; // commercial / land: no residential evidence applies
}

// Market sales only: PPD category A ("standard price paid": a single
// residential property sold for full market value) — category B holds
// repossessions, buy-to-lets, transfers to companies, and "O" (other)
// property types are not homes. The area is the narrowest one with enough
// sales: postcode → postcode sector → postcode district, or a named town /
// local authority. Never the whole country as if it were the place.
async function fetchTransactionEvidence(city, address, propertyType) {
  const cache = await loadPricePaid();
  const base = { source: 'HM Land Registry Price Paid Data', transactionWindow: cache.year ? `sales registered in ${cache.year} to date` : 'unavailable' };
  if (!cache.rows.length) return { ...base, available: false, sampleSize: 0, error: cache.error || 'Official Price Paid Data unavailable' };
  const text = [address, city].filter(Boolean).join(', ');
  // commercial / land: home sales still locate the local authority (its
  // HPI average is then shown as residential context only), but no sales
  // figure is returned for the property
  const nonResidential = !ukTypes(propertyType);
  const types = ukTypes(propertyType) || { codes: ['D', 'S', 'T', 'F'] };
  const market = cache.rows.filter((r) => r.category === 'A' && r.status !== 'D' && types.codes.includes(r.propertyType));
  const pc = postcodeFrom(text);
  const levels = [];
  if (pc) {
    const [out, inw] = pc.split(' ');
    levels.push(['postcode', pc, (r) => r.postcode === pc, 5]);
    levels.push(['postcode sector', `${out} ${inw[0]}`, (r) => r.postcode.startsWith(`${out} ${inw[0]}`), 10]);
    levels.push(['postcode district', out, (r) => r.postcode.split(' ')[0] === out, 10]);
    // too few sales around the postcode: its local authority, as the
    // registry records it for every sale in that postcode district
    const c = {};
    for (const r of cache.rows) if (r.postcode.split(' ')[0] === out && r.district) c[r.district] = (c[r.district] || 0) + 1;
    const pcLa = Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (pcLa) levels.push(['local authority', pcLa.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()), (r) => r.district === pcLa, 10]);
  }
  const parts = text.split(',').map((x) => x.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, '').trim()).filter(Boolean);
  // most specific place first ("Kensington, London" → Kensington and
  // Chelsea before London); "London" is never the City of London
  for (const part of parts) {
    const k = normalise(part);
    if (!k || /\d/.test(k) || /^(uk|united kingdom|england|great britain|gb|wales|scotland)$/.test(k)) continue;
    const la = (r) => { const d = normalise(r.district); return d === k || (k !== 'london' && d === `city of ${k}`) || d.startsWith(`${k} and `) || d.endsWith(` and ${k}`); };
    levels.push(['local authority', part, la, 10]);
    levels.push(['town', part, (r) => normalise(r.town) === k, 10]);
  }
  let selected = [], level = null, areaName = null;
  for (const [lv, name, pred, min] of levels) {
    const m = market.filter(pred);
    if (m.length >= min) { selected = m; level = lv; areaName = name; break; }
  }
  // the property's own last registered sale: same postcode + its number/name
  let ownSale = null;
  if (pc) {
    const toks = new Set(normalise(text.split(',')[0]).split(/[^a-z0-9]+/).filter(Boolean));
    const own = cache.rows.filter((r) => r.postcode === pc && r.paon && normalise(r.paon).split(/[^a-z0-9]+/).every((w) => toks.has(w))
      && (!r.saon || normalise(r.saon).split(/[^a-z0-9]+/).every((w) => toks.has(w))));
    // no address in the output: Price Paid's addresses are Royal Mail / OS
    // address data licensed for personal, non-commercial use only
    if (own.length === 1) ownSale = { date: own[0].date, price: own[0].price, category: own[0].category };
  }
  // the local authority the area lies in (as the Land Registry records it)
  const counts = {};
  for (const r of selected) counts[r.district] = (counts[r.district] || 0) + 1;
  // only a postcode area or a named local authority lies in ONE authority
  // (the "town" London spans 33 boroughs)
  const localAuthority = level && level !== 'town' ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null : null;
  if (nonResidential) return { ...base, available: false, sampleSize: 0, reason: 'not_residential', localAuthority };
  const prices = selected.map((r) => r.price);
  const latest = [...selected].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 15);
  const q = (p) => { const a = [...prices].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) * p)] : null; };
  return {
    ...base,
    available: selected.length > 0,
    level, areaName, localAuthority, typeLabel: types.label,
    sampleSize: selected.length,
    ownSale,
    medianTransactionPrice: median(prices),
    p25TransactionPrice: q(0.25), p75TransactionPrice: q(0.75),
    latestTransactions: latest.map((row) => ({
      transactionId: row.transactionId,
      date: row.date,
      price: row.price,
      propertyType: row.propertyType,
      tenure: row.tenure
      // no address: Price Paid's address data (Royal Mail PAF / OS
      // AddressBase) is licensed for non-commercial use only
    })),
    methodology: level ? `Market sales (Price Paid category A) of ${types.label} in ${level} ${areaName}, ${cache.year} to date.` : 'No area with enough market sales matched this address.'
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=7200');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const city = esc(req.query?.city);
  const address = esc(req.query?.address);
  const propertyType = esc(req.query?.propertyType);
  const requested = normalise(city);

  try {
    const [hpiFiles, transactionEvidence] = await Promise.all([
      resolveLatestUkHpiFiles(),
      fetchTransactionEvidence(city, address, propertyType)
    ]);

    if (!hpiFiles) throw new Error('No HM Land Registry HPI file found for the last 6 months');

    const parseObjectCsv = (rows) => {
      if (!rows.length) return [];
      // the Land Registry writes "Region_Name", "Average_Price" … — keys
      // without underscores, so both spellings work
      const headers = rows[0].map((h) => String(h).replace(/_/g, ''));
      return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
    };
    const averages = parseObjectCsv(parseCsv(hpiFiles.averageText));
    const byType = hpiFiles.typeText ? parseObjectCsv(parseCsv(hpiFiles.typeText)) : [];
    const lastDate = (rows) => rows.reduce((m, r) => (r.Date > m ? r.Date : m), '');
    const latestRows = (rows) => { const d = lastDate(rows); return rows.filter((r) => r.Date === d); };
    const la = transactionEvidence?.localAuthority || null;
    // exact name only: the local authority of the matched sales, else a
    // typed place that IS an HPI area ("Manchester", "Kensington and Chelsea")
    const names = [la, ...[address, city].join(',').split(',').map((x) => x.replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i, '').trim())].filter(Boolean).map(normalise);
    const same = (region, n) => { const r = normalise(region); return r === n || (n !== 'london' && r === `city of ${n}`) || (r.startsWith('city of ') && r.slice(8) === n.replace(/^city of /, '') && n.startsWith('city of')); };
    const pick = (rows) => { const latest = latestRows(rows); for (const n of names) { const r = latest.find((x) => same(x.RegionName, n)); if (r) return r; } return null; };
    const regional = pick(averages);
    const regionalType = byType.length ? pick(byType) : null;
    const nationalAverage = latestRows(averages).find((r) => normalise(r.RegionName) === 'united kingdom') || null;
    const types = ukTypes(propertyType);
    const typed = regionalType && types?.hpi ? Number(regionalType[`${types.hpi.replace(/_/g, '')}AveragePrice`]) || null : null;
    const rental = ukRentFor([la, regional?.RegionName, ...names].filter(Boolean), req.query?.bedrooms, propertyType);

    return res.status(200).json({
      success: true,
      country: 'United Kingdom',
      city: regional?.RegionName || city || 'United Kingdom',
      data: {
        market: 'UK House Price Index',
        period: regional?.Date ? regional.Date.slice(0, 7) : hpiFiles.label,
        hpiArea: regional?.RegionName || null,
        // the nation the matched area lies in (HPI area codes E/W/S/N…) —
        // Scotland (LBTT) and Wales (LTT) have their own transfer taxes
        nation: ({ E: 'England', W: 'Wales', S: 'Scotland', N: 'Northern Ireland' })[String(regional?.AreaCode || '')[0]] || null,
        hpiTypeLabel: typed ? types.label : regional ? 'all homes' : null,
        averagePrice: typed ?? (Number(regional?.AveragePrice) || null),
        allHomesAveragePrice: Number(regional?.AveragePrice) || null,
        nationalAveragePrice: Number(nationalAverage?.AveragePrice) || null,
        annualChangePercent: regional && regional.AnnualChange !== '' ? Number(regional.AnnualChange) : null,
        monthlyChangePercent: regional && regional.MonthlyChange !== '' ? Number(regional.MonthlyChange) : null,
        transactionEvidence,
        rental: {
          ...rental,
          source: rental.available ? `ONS — Price Index of Private Rents, ${rental.matchedArea}, ${rental.period}: average monthly rent of ${rental.rentBasis}` : 'ONS — Price Index of Private Rents',
          coverageNote: rental.available ? null : 'No local authority matched — no rent figure is applied (a regional or national average is not used for one town).'
        },
        sources: {
          hpi: 'HM Land Registry / UK House Price Index',
          transactions: 'HM Land Registry Price Paid Data',
          rentalMarket: 'ONS — Price Index of Private Rents, UK',
          coverage: 'UK HPI covers England, Wales, Scotland and Northern Ireland; Price Paid transaction detail is for England and Wales.'
        },
        sourceUrls: {
          hpi: 'https://www.gov.uk/government/collections/uk-house-price-index-reports',
          pricePaid: 'https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads',
          rentalMarket: 'https://www.ons.gov.uk/economy/inflationandpriceindices/bulletins/privaterentandhousepricesuk/latest'
        }
      }
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      country: 'United Kingdom',
      city: city || 'United Kingdom',
      data: {
        market: 'UK House Price Index',
        status: 'SOURCE_TEMPORARILY_UNAVAILABLE',
        message: 'Official HM Land Registry market data could not be fetched at this moment.',
        error: String(error?.message || error),
        sourceUrls: {
          hpi: 'https://www.gov.uk/government/collections/uk-house-price-index-reports',
          pricePaid: 'https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads'
        }
      }
    });
  }
}
