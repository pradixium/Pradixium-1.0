export default async function handler(req, res) {
  const city = String(req.query?.city || "").trim();
  const country = String(req.query?.country || "Spain").trim();

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'`´]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const cityKey = normalize(city);
  const countryKey = normalize(country);

  if (countryKey !== "spain") return res.status(200).json({ success:true, source:"INE", data:null, status:"COUNTRY_NOT_SUPPORTED_YET" });
  if (!cityKey) return res.status(400).json({ success:false, source:"INE", status:"CITY_REQUIRED" });

  const provinceNames = {
    "01":"Araba/Álava","02":"Albacete","03":"Alicante/Alacant","04":"Almería","05":"Ávila","06":"Badajoz","07":"Balears, Illes","08":"Barcelona","09":"Burgos","10":"Cáceres","11":"Cádiz","12":"Castellón/Castelló","13":"Ciudad Real","14":"Córdoba","15":"Coruña, A","16":"Cuenca","17":"Girona","18":"Granada","19":"Guadalajara","20":"Gipuzkoa","21":"Huelva","22":"Huesca","23":"Jaén","24":"León","25":"Lleida","26":"Rioja, La","27":"Lugo","28":"Madrid","29":"Málaga","30":"Murcia","31":"Navarra","32":"Ourense","33":"Asturias","34":"Palencia","35":"Palmas, Las","36":"Pontevedra","37":"Salamanca","38":"Santa Cruz de Tenerife","39":"Cantabria","40":"Segovia","41":"Sevilla","42":"Soria","43":"Tarragona","44":"Teruel","45":"Toledo","46":"Valencia/València","47":"Valladolid","48":"Bizkaia","49":"Zamora","50":"Zaragoza","51":"Ceuta","52":"Melilla"
  };

  // FIX: instead of downloading INE's full ~8,000-municipality catalogue
  // on every single request just to find one city's province code (this
  // was the actual cause of the timeout — that list is large and INE is
  // not always fast), we keep a small static lookup for the cities this
  // app actually serves. Instant, no network call, no timeout risk.
  // Add more cities here as needed — key is the normalized city name,
  // value is the 2-digit INE province code (see provinceNames above).
  const CITY_TO_PROVINCE_CODE = {
    "alicante": "03", "alacant": "03", "torrevieja": "03", "benidorm": "03", "elche": "03", "elx": "03",
    "madrid": "28",
    "barcelona": "08",
    "valencia": "46",
    "sevilla": "41",
    "malaga": "29",
    "murcia": "30",
    "bilbao": "48",
    "zaragoza": "50",
    "palma": "07", "palma de mallorca": "07",
    "las palmas": "35", "las palmas de gran canaria": "35",
    "santa cruz de tenerife": "38",
    "girona": "17",
    "castellon": "12", "castello": "12",
  };

  const resolveMunicipalityStatic = () => {
    const provinceCode = CITY_TO_PROVINCE_CODE[cityKey];
    if (!provinceCode) return { matched: false };
    return {
      matched: true,
      municipality: { name: city, code: null, tempUS3Id: null },
      provinceCode,
      province: provinceNames[provinceCode] || null
    };
  };

  // FIX: every outbound call now has its own hard timeout, so one slow/dead
  // INE endpoint can't hang the whole function past Vercel's execution
  // limit.
  const fetchJson = async (url, timeoutMs = 7000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Pradixium/1.0" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`INE request failed: ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const safe = async (promise) => {
    try { return await promise; } catch (err) { console.warn("INE sub-request failed:", err?.message || err); return null; }
  };

  const parseNumber = (value) => {
    if (value===null || value===undefined) return null;
    const text=String(value).trim().replace(/\s/g,""); if(!text) return null;
    let normalized=text;
    if(normalized.includes(".")&&normalized.includes(",")) normalized=normalized.replace(/\./g,"").replace(",",".");
    else if(normalized.includes(",")) normalized=normalized.replace(",",".");
    normalized=normalized.replace(/[^0-9.-]/g,"");
    const number=Number(normalized); return Number.isFinite(number)?number:null;
  };
  const getSeries = (payload) => { if(Array.isArray(payload)) return payload; for(const candidate of [payload?.Data,payload?.data,payload?.Series,payload?.series,payload?.Values,payload?.values]) if(Array.isArray(candidate)) return candidate; return []; };
  const getSeriesName = (series) => String(series?.Nombre||series?.NombreSerie||series?.name||series?.Name||series?.serie||"");
  const getObservations = (series) => { const values=series?.Data||series?.data||series?.Observaciones||series?.observations||series?.Values||series?.values; return Array.isArray(values)?values:[]; };
  const observationValue = (item) => typeof item === "number" ? item : parseNumber(item?.Valor ?? item?.valor ?? item?.Value ?? item?.value ?? item?.Dato ?? item?.dato);
  const observationDate = (item) => item?.Fecha||item?.fecha||item?.Date||item?.date||item?.Periodo||item?.period||"";
  const latestObservation = (series) => { const observations=getObservations(series).map(item=>({date:observationDate(item),value:observationValue(item)})).filter(item=>item.value!==null); observations.sort((a,b)=>String(b.date).localeCompare(String(a.date))); return observations[0]||null; };

  try {
    const municipality = resolveMunicipalityStatic();
    if (!municipality.matched || !municipality.provinceCode) {
      return res.status(200).json({ success:true, source:"INE", data:{city,country,municipality:null,province:null,provinceCode:null,transactionMarket:null,mortgageMarket:null}, status:"INE_CITY_NOT_FOUND" });
    }

    const provinceKey = normalize(provinceNames[municipality.provinceCode] || "");

    const [transactionsPayload, mortgagePayload] = await Promise.all([
      safe(fetchJson("https://servicios.ine.es/wstempus/js/EN/DATOS_TABLA/6150?tip=AM&nult=24", 7000)),
      safe(fetchJson("https://servicios.ine.es/wstempus/js/EN/DATOS_TABLA/3232?tip=AM&nult=12", 7000))
    ]);

    const transactionSeries = getSeries(transactionsPayload);
    const matchingTransactionSeries = transactionSeries.filter(series => {
      const seriesName = normalize(getSeriesName(series));
      return seriesName.includes(provinceKey) || seriesName.includes(municipality.provinceCode);
    });
    const transactionObservations = [];
    for (const series of matchingTransactionSeries) {
      const latest = latestObservation(series);
      if (latest) transactionObservations.push({ series: getSeriesName(series), date: latest.date, value: latest.value });
    }
    transactionObservations.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const latestTransaction = transactionObservations[0] || null;

    const mortgageSeries = getSeries(mortgagePayload);
    const matchingMortgageSeries = mortgageSeries.filter(series => {
      const seriesName = normalize(getSeriesName(series));
      return seriesName.includes(provinceKey) || seriesName.includes(municipality.provinceCode);
    });
    const mortgageObservations = [];
    for (const series of matchingMortgageSeries) {
      const latest = latestObservation(series);
      if (latest) mortgageObservations.push({ series: getSeriesName(series), date: latest.date, value: latest.value });
    }
    mortgageObservations.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const mortgageData = { latest: mortgageObservations[0] || null, matchedSeries: matchingMortgageSeries.length, observations: mortgageObservations.slice(0, 12) };

    return res.status(200).json({
      success: true,
      source: "INE",
      data: {
        city, country,
        municipality: municipality.municipality,
        province: municipality.province,
        provinceCode: municipality.provinceCode,
        transactionMarket: {
          table: "6150", name: "Compraventa de viviendas según régimen y estado", frequency: "Monthly",
          latest: latestTransaction, matchedSeries: matchingTransactionSeries.length,
          observations: transactionObservations.slice(0, 24)
        },
        mortgageMarket: {
          table: "3232", name: "Hipotecas por naturaleza de la finca, meses, provincias y número e importe", frequency: "Monthly",
          ...mortgageData
        }
      },
      status: latestTransaction ? "INE_CONNECTED" : "INE_CONNECTED_NO_MATCHING_SERIES"
    });
  } catch (error) {
    console.error("INE market data handler error:", error);
    return res.status(502).json({ success: false, source: "INE", status: "INE_UNAVAILABLE", error: error?.message || "Unable to retrieve INE data." });
  }
}
