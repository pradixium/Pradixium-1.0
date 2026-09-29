import { portugalLocalPrice } from '../lib/portugal/inePrices.js';

const MARKET = {
  country: 'Portugal',
  quarter: '2026-Q1',
  annualVariation: 17.8,
  quarterlyVariation: 3.8,
  index: 290.98,
  indexBase: '2015=100',
  source: 'INE Portugal / Eurostat',
  officialSource: 'https://www.ine.pt/'
};

// INE publishes real median-rent-per-m² figures for new rental contracts
// (not an estimate) — quarterly at the national level, and a municipality
// breakdown released less frequently, hence the mixed vintages below (each
// entry keeps the period it was actually reported for rather than being
// forced onto one date). Update by hand from INE's "Renda mediana de
// novos contratos de arrendamento" release — same fixture pattern already
// used for Belgium/Greece's price indices.
const PORTUGAL_RENT = {
  national: { rentEurPerM2: 9.46, changePercent: 9.1, period: '2026-Q1' },
  lisboa: { rentEurPerM2: 16.88, changePercent: null, period: '2025 Annual' },
  cascais: { rentEurPerM2: 16.20, changePercent: null, period: '2025 Annual' },
  oeiras: { rentEurPerM2: 15.03, changePercent: null, period: '2025 Annual' },
  algarve: { rentEurPerM2: 10.53, changePercent: null, period: '2025 Annual' },
  porto: { rentEurPerM2: 12.94, changePercent: null, period: '2025-Q1' },
  coimbra: { rentEurPerM2: 8.67, changePercent: 10.9, period: '2025-Q1' },
  braga: { rentEurPerM2: 7.45, changePercent: -0.9, period: '2025-Q1' }
};

const CITY_ALIASES = {
  lisbon: 'lisboa', cascais: 'cascais', oeiras: 'oeiras',
  algarve: 'algarve', faro: 'algarve', lagos: 'algarve', albufeira: 'algarve', portimao: 'algarve', loule: 'algarve',
  porto: 'porto', oporto: 'porto',
  coimbra: 'coimbra',
  braga: 'braga',
  // FIX: same misrouting bug as Spain (Marbella) and Belgium (Knokke-
  // Heist) -- these are real luxury developments/resorts that are
  // administratively part of Loulé municipality (already mapped to
  // "algarve" above), so a property here should resolve to the Algarve
  // rent figure, not silently fall to the national average. Comporta and
  // Sintra deliberately stay unmapped: they're genuinely distinct markets
  // with no dedicated PORTUGAL_RENT figure, so an honest "not matched"
  // fallback is correct for them rather than a guessed bucket.
  almancil: 'algarve', "quinta do lago": 'algarve', "vale do lobo": 'algarve',
  vilamoura: 'algarve', carvoeiro: 'algarve'
};

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function rentFor(city) {
  const key = CITY_ALIASES[normalize(city)] || null;
  return key ? { key, ...PORTUGAL_RENT[key] } : { key: 'national', ...PORTUGAL_RENT.national };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const city = String(req.query?.city || '').trim().slice(0, 120);
  const rent = rentFor(city);
  const address = String(req.query?.address || '').trim().slice(0, 200);
  const localPrice = portugalLocalPrice({ city, address, bedrooms: req.query?.bedrooms });
  return res.status(200).json({
    success: true,
    country: 'Portugal',
    city: city || null,
    data: {
      housingPriceIndex: MARKET,
      localPrice,
      localData: 'INE Portugal publishes transaction-based local housing prices down to municipality level.',
      rental: {
        available: true,
        matchedArea: rent.key,
        rentEurPerM2: rent.rentEurPerM2,
        changePercent: rent.changePercent,
        period: rent.period,
        source: 'INE Portugal — Renda mediana de novos contratos de arrendamento',
        coverageNote: rent.key === 'national'
          ? 'City not matched to a covered municipality — showing the national median instead.'
          : null
      },
      sources: {
        ine: 'Instituto Nacional de Estatística (INE) Portugal',
        eurostat: 'Eurostat housing price index (prc_hpi_q)'
      },
      sourceUrls: {
        ine: MARKET.officialSource,
        eurostat: 'https://ec.europa.eu/eurostat/'
      }
    }
  });
}
