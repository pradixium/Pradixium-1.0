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
  const now = new Date();
  for (let i = 0; i <= maxMonthsBack; i += 1) {
    const label = monthLabel(now, i);
    const averageUrl = `https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Average-prices-${label}.csv`;
    const indexUrl = `https://publicdata.landregistry.gov.uk/market-trend-data/house-price-index-data/Indices-${label}.csv`;
    try {
      const [averageText, indexText] = await Promise.all([fetchText(averageUrl), fetchText(indexUrl)]);
      if (averageText && indexText) return { label, averageText, indexText };
    } catch (_error) {
      // This month's release isn't published under this filename (yet, or ever) — try the prior month.
    }
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

// ONS's "Price Index of Private Rents" publishes real average rent levels
// (not just an index) by country/region \u2014 a flat average for the whole
// area, same convention as this file's own house-price benchmark
// (AveragePrice is a "total", not a per-m\u00b2 rate). Unlike the live-fetched
// HPI CSV above, ONS doesn't publish this as a stable machine-readable
// feed, so this is a dated fixture \u2014 same pattern already used for
// Belgium/Greece/Portugal. Update by hand from ONS's monthly "Private
// rent and house prices, UK" bulletin.
const UK_RENT = {
  england: { monthlyRentGbp: 1459, annualChangePercent: 4.0, period: '2026-08 (12 months to)' },
  london: { monthlyRentGbp: 2317, annualChangePercent: 3.0, period: '2026-07 (12 months to)' },
  'north east': { monthlyRentGbp: 783, annualChangePercent: 6.3, period: '2026-07 (12 months to)' },
  wales: { monthlyRentGbp: 843, annualChangePercent: 4.5, period: '2026-07 (12 months to)' },
  scotland: { monthlyRentGbp: 1016, annualChangePercent: 1.7, period: '2026-07 (12 months to)' }
};

const UK_RENT_AREA_ALIASES = {
  // London boroughs/areas
  london: 'london', westminster: 'london', kensington: 'london', chelsea: 'london', camden: 'london',
  islington: 'london', hackney: 'london', greenwich: 'london', croydon: 'london', ealing: 'london',
  // North East England
  newcastle: 'north east', sunderland: 'north east', durham: 'north east', middlesbrough: 'north east',
  gateshead: 'north east', northumberland: 'north east',
  // Wales
  cardiff: 'wales', swansea: 'wales', newport: 'wales', wrexham: 'wales', bangor: 'wales',
  // Scotland
  edinburgh: 'scotland', glasgow: 'scotland', aberdeen: 'scotland', dundee: 'scotland', stirling: 'scotland', inverness: 'scotland'
};

function ukRentFor(city) {
  const key = UK_RENT_AREA_ALIASES[normalise(city)] || null;
  const area = key || 'england';
  return { area, ...UK_RENT[area] };
}

function postcodeFrom(value) {
  const match = String(value || '').toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? match[1].replace(/\s+/g, ' ') : null;
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
        category: row[14] || null
      });
    }
    ppdCache = { loadedAt: now, rows: parsed, year: resolved.year, error: null };
    return ppdCache;
  } catch (error) {
    ppdCache = { loadedAt: now, rows: [], year: null, error: String(error?.message || error) };
    return ppdCache;
  }
}

async function fetchTransactionEvidence(city, address, propertyType) {
  const cache = await loadPricePaid();
  if (!cache.rows.length) {
    return {
      available: false,
      source: 'HM Land Registry Price Paid Data',
      transactionWindow: cache.year ? `${cache.year} year-to-date file` : 'unavailable',
      sampleSize: 0,
      error: cache.error || 'Official Price Paid Data unavailable'
    };
  }

  const query = normalise(address || city);
  const postcode = postcodeFrom(address || city);
  const cityKey = normalise(city);
  const addressKey = normalise(address);
  const typeKey = normalise(propertyType);
  const typeMap = { detached: 'D', 'semi-detached': 'S', terraced: 'T', flat: 'F', maisonette: 'F' };
  const requestedType = Object.keys(typeMap).find((key) => typeKey.includes(key));

  let matches = cache.rows;
  if (postcode) {
    matches = matches.filter((row) => row.postcode === postcode);
  } else if (cityKey) {
    matches = matches.filter((row) => normalise(row.town) === cityKey || normalise(row.locality) === cityKey || normalise(row.district) === cityKey);
  }

  if (requestedType) {
    const typed = matches.filter((row) => row.propertyType === typeMap[requestedType]);
    if (typed.length >= 3) matches = typed;
  }

  const exactAddress = addressKey && addressKey.length > 5
    ? matches.filter((row) => {
        const haystack = normalise([row.paon, row.saon, row.street, row.locality, row.town, row.postcode].filter(Boolean).join(' '));
        return haystack.includes(addressKey) || addressKey.includes(haystack);
      })
    : [];

  const selected = exactAddress.length >= 1 ? exactAddress : matches;
  const prices = selected.map((row) => row.price);
  const latest = [...selected].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 15);

  return {
    available: selected.length > 0,
    source: 'HM Land Registry Price Paid Data',
    transactionWindow: `${cache.year} year-to-date file`,
    sampleSize: selected.length,
    exactAddressMatch: exactAddress.length > 0,
    medianTransactionPrice: median(prices),
    meanTransactionPrice: mean(prices),
    minTransactionPrice: prices.length ? Math.min(...prices) : null,
    maxTransactionPrice: prices.length ? Math.max(...prices) : null,
    latestTransactions: latest.map((row) => ({
      transactionId: row.transactionId,
      date: row.date,
      price: row.price,
      propertyType: row.propertyType,
      tenure: row.tenure,
      address: [row.paon, row.saon, row.street, row.locality, row.town, row.postcode].filter(Boolean).join(', ')
    })),
    methodology: exactAddress.length
      ? 'Exact-address evidence from the current official HM Land Registry Price Paid dataset.'
      : postcode
        ? 'Postcode-level transaction evidence from the current official HM Land Registry Price Paid dataset.'
        : 'City/district-level transaction evidence from the current official HM Land Registry Price Paid dataset.'
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

    const averageRows = parseCsv(hpiFiles.averageText).map((row) => row);
    const indexRows = parseCsv(hpiFiles.indexText).map((row) => row);

    const parseObjectCsv = (rows) => {
      if (!rows.length) return [];
      const headers = rows[0];
      return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
    };

    const averages = parseObjectCsv(averageRows);
    const indexes = parseObjectCsv(indexRows);
    const findLatest = (rows) => {
      const candidates = rows.filter((row) => !requested || normalise(row.RegionName).includes(requested) || requested.includes(normalise(row.RegionName)));
      return candidates[candidates.length - 1] || null;
    };

    const nationalAverage = findLatest(averages.filter((row) => normalise(row.RegionName) === 'united kingdom')) || averages[averages.length - 1] || null;
    const regional = findLatest(averages) || nationalAverage;
    const latestIndex = findLatest(indexes.filter((row) => normalise(row.RegionName) === 'united kingdom')) || indexes[indexes.length - 1] || null;
    const rental = ukRentFor(city);

    return res.status(200).json({
      success: true,
      country: 'United Kingdom',
      city: regional?.RegionName || city || 'United Kingdom',
      data: {
        market: 'UK House Price Index',
        period: hpiFiles.label,
        averagePrice: Number(regional?.AveragePrice) || null,
        nationalAveragePrice: Number(nationalAverage?.AveragePrice) || null,
        index: Number(latestIndex?.Index) || null,
        annualChangePercent: Number(regional?.AnnualChange) || null,
        monthlyChangePercent: Number(regional?.MonthlyChange) || null,
        transactionEvidence,
        rental: {
          available: true,
          matchedArea: rental.area,
          monthlyRentGbp: rental.monthlyRentGbp,
          annualChangePercent: rental.annualChangePercent,
          period: rental.period,
          source: 'ONS — Price Index of Private Rents, UK',
          coverageNote: rental.area === 'england'
            ? 'City not matched to a covered region — showing the England average instead.'
            : null
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
