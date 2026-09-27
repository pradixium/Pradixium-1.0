const ITALY_HPI = {
  quarter: '2026-Q1',
  quarterlyVariation: 1.0,
  annualVariation: 5.2,
  scope: 'Italy',
  publication: '2026-06-19',
  officialSource: 'https://www.istat.it/en/press-release/house-prices-provisional-q1-2026/'
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const city = String(req.query?.city || '').trim().slice(0, 120);
  if (!city) return res.status(400).json({ success: false, error: 'City is required.' });

  return res.status(200).json({
    success: true,
    country: 'Italy',
    city,
    data: {
      housingPriceIndex: ITALY_HPI,
      sources: {
        istat: 'Istat — House Price Index (IPAB)',
        omi: 'Agenzia delle Entrate — Osservatorio del Mercato Immobiliare'
      },
      sourceUrls: {
        istat: ITALY_HPI.officialSource,
        omi: 'https://www.agenziaentrate.gov.it/portale/web/guest/quotazioni-immobiliari'
      },
      nextStep: 'Connect city-level government transaction and valuation data.'
    }
  });
}
