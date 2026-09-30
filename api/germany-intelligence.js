import { nrwReferenceValue } from '../lib/germany/irw.js';
import { germanRent } from '../lib/germany/rents.js';

const esc = (value) => String(value || '').trim().slice(0, 160);

// Destatis Häuserpreisindex, press release Nr. 336 of 24 Sep 2026 (Q2 2026,
// provisional) + the index table (2025=100)
const GERMANY_HPI = {
  period: '2026-Q2',
  indexBase: '2025=100',
  totalIndex: 100.6,
  newResidentialIndex: 101.2,
  existingResidentialIndex: 100.5,
  annualChangePercent: 0.6,
  newResidentialAnnualChangePercent: 1.5,
  existingResidentialAnnualChangePercent: 0.5,
  publicationDate: '2026-09-24',
  source: 'Statistisches Bundesamt (Destatis)',
  sourceUrl: 'https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/09/PD26_336_61262.html'
};

// the same release, TOP-7 metros (Berlin, Hamburg, München, Köln,
// Frankfurt am Main, Stuttgart, Düsseldorf) — change on Q2 2025
const TOP7 = new Set(['11000000', '02000000', '09162000', '05315000', '06412000', '08111000', '05111000']);
const TOP7_HPI = { period: '2026-Q2', area: 'TOP-7 metros (Berlin, Hamburg, München, Köln, Frankfurt am Main, Stuttgart, Düsseldorf)', flatsAnnualChangePercent: -0.4, housesAnnualChangePercent: 0.7 };

const CITY_ALIASES = {
  berlin: 'Berlin',
  munich: 'Munich',
  muenchen: 'Munich',
  munich: 'Munich',
  hamburg: 'Hamburg',
  frankfurt: 'Frankfurt am Main',
  cologne: 'Cologne',
  koeln: 'Cologne',
  düsseldorf: 'Düsseldorf',
  dusseldorf: 'Düsseldorf',
  stuttgart: 'Stuttgart',
  leipzig: 'Leipzig',
  dortmund: 'Dortmund',
  dresden: 'Dresden',
  hannover: 'Hannover',
  nuremberg: 'Nuremberg',
  nuernberg: 'Nuremberg'
};

function normalise(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=21600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const city = esc(req.query?.city);
  const address = esc(req.query?.address);
  // NRW: the address's own Immobilienrichtwert zone (null elsewhere)
  let irw = null;
  try { irw = nrwReferenceValue({ address, city, propertyType: esc(req.query?.propertyType), size: esc(req.query?.size) }); } catch { irw = null; }
  if (irw?.status === 'not_nrw') irw = null;
  let rent = null;
  try { rent = germanRent({ ags: irw?.ags, address, city }); } catch { rent = null; }
  const ags = irw?.ags || rent?.ags || null;
  const regional = ags && TOP7.has(ags) ? TOP7_HPI : null;
  const key = normalise(city);
  const resolvedCity = CITY_ALIASES[key] || city || 'Germany';

  return res.status(200).json({
    success: true,
    country: 'Germany',
    city: resolvedCity,
    data: {
      market: 'German Residential Property Market',
      housingPriceIndex: { ...GERMANY_HPI, regional },
      irw,
      rent,
      cityLevelStatus: city ? 'REGIONAL_DATA_LAYER_PENDING' : 'NATIONAL_DATA_AVAILABLE',
      cityLevelNote: 'Germany does not publish a single nationwide open transaction database equivalent to France DVF or England and Wales Price Paid Data. City-level valuation should use the relevant local Gutachterausschuss / BORIS regional source rather than estimated figures.',
      sources: {
        nationalIndex: 'Statistisches Bundesamt (Destatis) — Häuserpreisindex',
        landValues: 'Destatis / GENESIS-Online — Kaufwerte für Bauland',
        regionalPropertyData: 'Local Gutachterausschüsse and BORIS regional portals'
      },
      sourceUrls: {
        destatis: 'https://www.destatis.de/DE/Themen/Wirtschaft/Preise/Baupreise-Immobilienpreisindex/_inhalt.html',
        genesis: 'https://www-genesis.destatis.de/genesis/online',
        boris: 'https://www.boris-d.de/'
      },
      coverage: 'National German housing-price index available. Local transaction/valuation coverage varies by Bundesland and municipality.'
    }
  });
}
