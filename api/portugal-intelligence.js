import { portugalLocalPrice, portugalRent } from '../lib/portugal/inePrices.js';

const MARKET = {
  country: 'Portugal',
  // INE HPI as published by Eurostat prc_hpi_q (PT, TOTAL; RCH_A / RCH_Q /
  // I15_Q), checked Oct 1 2026 — update each quarter
  quarter: '2026-Q2',
  annualVariation: 16.5,
  quarterlyVariation: 3.6,
  index: 301.43,
  indexBase: '2015=100',
  source: 'INE Portugal / Eurostat',
  officialSource: 'https://www.ine.pt/'
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  const city = String(req.query?.city || '').trim().slice(0, 120);
  const address = String(req.query?.address || '').trim().slice(0, 200);
  const localPrice = portugalLocalPrice({ city, address, bedrooms: req.query?.bedrooms });
  const rent = localPrice?.status === 'ok' ? portugalRent(localPrice) : null;
  return res.status(200).json({
    success: true,
    country: 'Portugal',
    city: city || null,
    data: {
      housingPriceIndex: MARKET,
      localPrice,
      localData: 'INE Portugal publishes transaction-based local housing prices down to municipality level.',
      rental: rent
        ? {
            available: true,
            matchedArea: rent.where,
            level: rent.level,
            rentEurPerM2: rent.rentEurPerM2,
            changePercent: rent.yoyPercent,
            period: rent.period,
            comparedWith: rent.comparedWith,
            source: `INE Portugal — median rent of new lease contracts, 12 months to ${rent.period}, ${rent.where} (${rent.level})`,
            sourceUrl: rent.sourceUrl,
            coverageNote: rent.note || null
          }
        : { available: false, coverageNote: 'INE publishes no rent figure for this place (no matched parish or municipality).' },
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
