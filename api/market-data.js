export default async function handler(req, res) {
  const {
    city = "",
    country = "Spain",
    propertyType = "Property",
    size = ""
  } = req.query;

  const normalize = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const repairMojibake = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const text = String(value);
    if (!text.includes("Ã") && !text.includes("Â") && !text.includes("â")) {
      return text;
    }
    try {
      return Buffer.from(text, "latin1").toString("utf8");
    } catch {
      return text;
    }
  };

  const parseDelimitedCsv = (text, delimiter = ";") => {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (quoted) {
        if (char === '"' && next === '"') {
          field += '"';
          i += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        quoted = true;
      } else if (char === delimiter) {
        row.push(field.trim());
        field = "";
      } else if (char === "\n") {
        row.push(field.trim());
        if (row.some((value) => value !== "")) {
          rows.push(row);
        }
        row = [];
        field = "";
      } else if (char !== "\r") {
        field += char;
      }
    }

    row.push(field.trim());
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
    if (!rows.length) {
      return [];
    }

    const headers = rows[0].map((header) =>
      repairMojibake(header.replace(/^\uFEFF/, "").trim())
    );

    return rows.slice(1).map((values) => {
      const result = {};
      headers.forEach((header, index) => {
        result[header] = repairMojibake(values[index] ?? "");
      });
      return result;
    });
  };

  const detectDelimiter = (text) => {
    const firstLine =
      String(text || "")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .find((line) => line.trim() !== "") || "";

    const candidates = [";", ",", "\t"];
    let bestDelimiter = ";";
    let bestScore = -1;

    candidates.forEach((delimiter) => {
      let count = 0;
      let quoted = false;
      for (let i = 0; i < firstLine.length; i += 1) {
        const char = firstLine[i];
        const next = firstLine[i + 1];
        if (char === '"' && next === '"') {
          i += 1;
          continue;
        }
        if (char === '"') {
          quoted = !quoted;
          continue;
        }
        if (!quoted && char === delimiter) {
          count += 1;
        }
      }
      if (count > bestScore) {
        bestScore = count;
        bestDelimiter = delimiter;
      }
    });

    return bestDelimiter;
  };

  const parseCsv = (text) => {
    const repairedText = repairMojibake(text);
    const delimiter = detectDelimiter(repairedText);
    return parseDelimitedCsv(repairedText, delimiter);
  };

  const parseNumber = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }
    let text = repairMojibake(value).trim().replace(/\u00A0/g, "").replace(/\s/g, "");
    if (text.includes(".") && text.includes(",")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else if (text.includes(",")) {
      text = text.replace(",", ".");
    } else if ((text.match(/\./g) || []).length > 1) {
      text = text.replace(/\./g, "");
    } else if (text.includes(".")) {
      const parts = text.split(".");
      if (parts.length === 2 && parts[1].length === 3) {
        text = parts[0] + parts[1];
      }
    }
    text = text.replace(/[^\d.-]/g, "");
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  };

  const parseTransactionCount = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") {
      return null;
    }
    let text = repairMojibake(value).trim().replace(/\u00A0/g, "").replace(/\s/g, "");
    text = text.replace(/\./g, "").replace(/,/g, "").replace(/[^\d-]/g, "");
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  };

  const findHeader = (headers, predicates) =>
    headers.find((header) => predicates.some((predicate) => predicate(normalize(header)))) || null;

  const findYear = (row, yearHeader) => {
    if (!yearHeader) {
      return null;
    }
    const value = String(row[yearHeader] || "").trim();
    const match = value.match(/(?:^|\D)(20\d{2})(?:\D|$)/);
    return match ? Number(match[1]) : parseNumber(value);
  };

  const cityAliases = {
    alicante: ["alicante", "alicante/alacant", "alacant"],
    torrevieja: ["alicante", "alicante/alacant", "alacant"],
    madrid: ["madrid"],
    barcelona: ["barcelona"],
    valencia: ["valencia/valencia", "valencia"],
    sevilla: ["sevilla"],
    malaga: ["malaga"],
    murcia: ["murcia"],
    bilbao: ["bizkaia", "vizcaya"],
    zaragoza: ["zaragoza"]
  };

  // Foreign buyer / demand intelligence — Colegio de Registradores
  // "Estadistica Registral Inmobiliaria" (foreign-buyer share of
  // residential purchases) and its buyer-origin nationality breakdown.
  // The Registradores dataset isn't published as a stable machine-readable
  // CSV, so — same as the reference values already used elsewhere in this
  // codebase for this province — the most recent published figures are
  // kept here as a static table and extended as new provinces are added.
  const DEMAND_INTELLIGENCE = {
    alicante: {
      foreignBuyerShare: 43.53,
      annualForeignBuyerShare: 43.29,
      geography: "Alicante Province",
      currentPeriod: "Q1 2026",
      annualPeriod: "2025 Annual",
      source: "Registradores",
      level: "Province",
      buyerOrigin: {
        Netherlands: 12,
        UnitedKingdom: 10,
        Belgium: 9,
        period: "2025 Annual",
        source: "Registradores",
        geography: "Alicante Province"
      }
    },
    torrevieja: {
      foreignBuyerShare: 43.53,
      annualForeignBuyerShare: 43.29,
      geography: "Alicante Province",
      currentPeriod: "Q1 2026",
      annualPeriod: "2025 Annual",
      source: "Registradores",
      level: "Province",
      buyerOrigin: {
        Netherlands: 12,
        UnitedKingdom: 10,
        Belgium: 9,
        period: "2025 Annual",
        source: "Registradores",
        geography: "Alicante Province"
      }
    },
    // FIX: these additional provinces come from secondary reporting on the
    // same Registradores dataset (news coverage of the Q3/annual 2025
    // report), not a figure this codebase has verified against the
    // primary registradores.org report directly — registradores.org,
    // ine.es and mivau.gob.es are all unreachable from this sandbox's
    // network policy, so the numbers below couldn't be cross-checked
    // against the source table. No buyer-nationality breakdown is
    // available for them (unlike Alicante), so buyerOrigin is omitted
    // rather than guessed. Treat as approximate until confirmed.
    malaga: {
      foreignBuyerShare: 32.8,
      annualForeignBuyerShare: 32.8,
      geography: "Malaga Province",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    baleares: {
      foreignBuyerShare: 32.8,
      annualForeignBuyerShare: 32.8,
      geography: "Balearic Islands",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    tenerife: {
      foreignBuyerShare: 30.04,
      annualForeignBuyerShare: 30.04,
      geography: "Santa Cruz de Tenerife Province",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    girona: {
      foreignBuyerShare: 28.9,
      annualForeignBuyerShare: 28.9,
      geography: "Girona Province",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    murcia: {
      foreignBuyerShare: 22.8,
      annualForeignBuyerShare: 22.8,
      geography: "Murcia Province",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    almeria: {
      foreignBuyerShare: 20,
      annualForeignBuyerShare: 20,
      geography: "Almeria Province",
      currentPeriod: "2025 Annual",
      annualPeriod: "2025 Annual",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    "las palmas": {
      foreignBuyerShare: 20.31,
      annualForeignBuyerShare: 20.31,
      geography: "Las Palmas Province",
      currentPeriod: "Q4 2025",
      annualPeriod: "Q4 2025",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    tarragona: {
      foreignBuyerShare: 16.11,
      annualForeignBuyerShare: 16.11,
      geography: "Tarragona Province",
      currentPeriod: "Q4 2025",
      annualPeriod: "Q4 2025",
      source: "Registradores (secondary source, unverified)",
      level: "Province"
    },
    // FIX: coverage previously stopped at the coastal/resort provinces
    // with the HIGHEST foreign-buyer share, silently omitting Spain's
    // three biggest cities — exactly the ones most people analyzing a
    // Spanish property actually search for. Registradores' own national
    // report does break these out, just at much lower shares (interior/
    // urban demand vs. coastal second-home demand); reported here via the
    // same secondary press coverage as the province entries above, not
    // cross-checked against the primary report (unreachable from this
    // sandbox's network policy).
    madrid: {
      foreignBuyerShare: 4.6,
      annualForeignBuyerShare: 4.6,
      geography: "Madrid (city)",
      currentPeriod: "2025",
      annualPeriod: "2025",
      source: "Registradores (secondary source, unverified)",
      level: "Municipality"
    },
    barcelona: {
      foreignBuyerShare: 9.5,
      annualForeignBuyerShare: 9.5,
      geography: "Barcelona (city)",
      currentPeriod: "2025",
      annualPeriod: "2025",
      source: "Registradores (secondary source, unverified)",
      level: "Municipality"
    },
    valencia: {
      foreignBuyerShare: 12.8,
      annualForeignBuyerShare: 12.8,
      geography: "Valencia (city)",
      currentPeriod: "2025",
      annualPeriod: "2025",
      source: "Registradores (secondary source, unverified)",
      level: "Municipality"
    }
  };

  // Common municipality/resort names mapped to the province key they fall
  // under in DEMAND_INTELLIGENCE, so a free-text city entry like
  // "Marbella" or "Palma de Mallorca" resolves to its province's figures.
  const DEMAND_PROVINCE_ALIASES = {
    benidorm: "alicante",
    denia: "alicante",
    marbella: "malaga",
    fuengirola: "malaga",
    mijas: "malaga",
    estepona: "malaga",
    torremolinos: "malaga",
    benalmadena: "malaga",
    nerja: "malaga",
    "islas baleares": "baleares",
    mallorca: "baleares",
    "palma de mallorca": "baleares",
    palma: "baleares",
    ibiza: "baleares",
    menorca: "baleares",
    "santa cruz de tenerife": "tenerife",
    "costa brava": "girona",
    "lloret de mar": "girona",
    cartagena: "murcia",
    mojacar: "almeria",
    "roquetas de mar": "almeria",
    "las palmas de gran canaria": "las palmas",
    "gran canaria": "las palmas",
    maspalomas: "las palmas",
    salou: "tarragona",
    cambrils: "tarragona"
  };

  const strengthFor = (share) => {
    if (share >= 40) return "VERY STRONG";
    if (share >= 25) return "STRONG";
    if (share >= 15) return "MODERATE";
    return "LIMITED";
  };

  const cityKey = normalize(city);
  const provinceAliases = cityAliases[cityKey] || [cityKey];

  const matchesLocation = (value, aliases = provinceAliases) => {
    const normalized = normalize(repairMojibake(value));
    if (!normalized) {
      return false;
    }
    return aliases.some((alias) => {
      const normalizedAlias = normalize(alias);
      return (
        normalized === normalizedAlias ||
        normalized.includes(normalizedAlias) ||
        normalizedAlias.includes(normalized)
      );
    });
  };

  const municipalityAliases = {
    torrevieja: ["torrevieja"],
    alicante: ["alicante", "alicante/alacant", "alacant"],
    madrid: ["madrid"],
    barcelona: ["barcelona"],
    valencia: ["valencia", "valencia/valencia"],
    sevilla: ["sevilla"],
    malaga: ["malaga"],
    murcia: ["murcia"],
    bilbao: ["bilbao"],
    zaragoza: ["zaragoza"]
  };

  const municipalityNames = municipalityAliases[cityKey] || [cityKey];
  const matchesMunicipality = (value) => matchesLocation(value, municipalityNames);

  const isSpain = normalize(country) === "spain";

  if (!isSpain) {
    return res.status(200).json({
      success: true,
      data: {
        city,
        country,
        propertyType,
        size: size || null,
        status: "COUNTRY_NOT_SUPPORTED_YET",
        message: "Spain is currently the active pilot market."
      }
    });
  }

  // FIX: every outbound fetch now has its own hard timeout via
  // AbortController. Previously a slow/unreachable government CDN could
  // hang the whole function until Vercel force-killed it with no
  // response at all — this is what produced the endless "Loading..."
  // state on the property page.
  const fetchTextWithTimeout = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Request to ${url} returned ${response.status}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  };

  // FIX: each data source is now isolated — if MIVAU valuation fails but
  // transactions and INE succeed, the response still carries whatever
  // did come back instead of one failure wiping out everything (the old
  // code let any single throw fall through to the outer catch, which
  // turned the whole response into an error even when 2 of 3 sources
  // were fine).
  const safeFetchText = async (url, timeoutMs, label) => {
    try {
      return await fetchTextWithTimeout(url, timeoutMs);
    } catch (err) {
      console.warn(`${label} unavailable:`, err?.message || err);
      return null;
    }
  };

  const valuationUrl =
    "https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP006_01.csv";
  const transactionUrl =
    "https://cdn.mivau.gob.es/portal-web-mivau/Datos_MIVAU/CSV/VDP003_01.csv";
  const ineUrl = "https://www.ine.es/jaxiT3/files/t/csv_bdsc/69337.csv";

  // FIX: these three used to run sequentially (await, then await, then
  // await) inside nested try/catches. Now they all fire at once — total
  // wait time is however long the *slowest* one takes, not the sum of
  // all three.
  const [valuationText, transactionText, ineText] = await Promise.all([
    safeFetchText(valuationUrl, 8000, "MIVAU valuation dataset"),
    safeFetchText(transactionUrl, 8000, "MIVAU transaction dataset"),
    safeFetchText(ineUrl, 8000, "INE municipal urban indicators")
  ]);

  /*
   * ---------------------------------------------------------
   * 1. MIVAU GOVERNMENT APPRAISED VALUE
   * ---------------------------------------------------------
   */
  let latestValuation = null;
  let valuationAnnualChangePercent = null;
  let valuationMatches = [];

  if (valuationText) {
    try {
      const valuationRows = parseCsv(valuationText);
      const valuationHeaders = Object.keys(valuationRows[0] || {});

      const valuationProvinceHeader = findHeader(valuationHeaders, [
        (header) => header === "provincia",
        (header) => header.includes("provincia")
      ]);
      const valuationYearHeader = findHeader(valuationHeaders, [
        (header) => header === "ano",
        (header) => header.includes("ano") || header.includes("year")
      ]);
      const valuationQuarterHeader = findHeader(valuationHeaders, [
        (header) => header === "trimestre",
        (header) => header.includes("trimestre") || header.includes("quarter")
      ]);
      const valuationValueHeader = findHeader(valuationHeaders, [
        (header) => header === "valor",
        (header) => header.includes("valor") || header.includes("value")
      ]);
      const valuationRegimeHeader = findHeader(valuationHeaders, [
        (header) => header === "regimen",
        (header) => header.includes("regimen") || header.includes("regime")
      ]);
      const valuationCodeHeader = findHeader(valuationHeaders, [
        (header) => header === "cpro",
        (header) => header.includes("cpro") || header.includes("codprovincia")
      ]);
      const valuationCommunityHeader = findHeader(valuationHeaders, [
        (header) => header.includes("comunidad")
      ]);
      const valuationCommunityCodeHeader = findHeader(valuationHeaders, [
        (header) => header === "codauto",
        (header) => header.includes("codauto")
      ]);

      valuationMatches = valuationRows.filter((row) =>
        valuationProvinceHeader ? matchesLocation(row[valuationProvinceHeader]) : false
      );

      const validValuations = valuationMatches
        .map((row) => ({
          year: findYear(row, valuationYearHeader),
          quarter: parseNumber(valuationQuarterHeader ? row[valuationQuarterHeader] : null),
          value: parseNumber(valuationValueHeader ? row[valuationValueHeader] : null),
          regime: valuationRegimeHeader ? repairMojibake(row[valuationRegimeHeader]) : "",
          province: valuationProvinceHeader ? repairMojibake(row[valuationProvinceHeader]) : "",
          provinceCode: valuationCodeHeader ? repairMojibake(row[valuationCodeHeader]) : "",
          autonomousCommunity: valuationCommunityHeader
            ? repairMojibake(row[valuationCommunityHeader])
            : "",
          communityCode: valuationCommunityCodeHeader
            ? repairMojibake(row[valuationCommunityCodeHeader])
            : ""
        }))
        .filter(
          (row) => row.value !== null && Number.isFinite(row.year) && Number.isFinite(row.quarter)
        )
        .filter((row) => normalize(row.regime) === "libre")
        .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.quarter - a.quarter));

      latestValuation = validValuations[0] || null;

      // FIX: validValuations already holds the full multi-quarter history
      // (needed to find the latest row above), but the year-over-year
      // change hiding in that same array was never computed — every other
      // country adapter exposes a priceTrendPercent that feeds the
      // Pradixium Score's 20%-weighted price-trend factor, but Spain's
      // orchestrator branch had nothing to read, so Spain properties
      // always scored neutral on that factor. Same quarter, one year
      // earlier, is the standard YoY comparison point.
      if (latestValuation) {
        const yearAgo = validValuations.find(
          (row) => row.year === latestValuation.year - 1 && row.quarter === latestValuation.quarter
        );
        if (yearAgo && yearAgo.value > 0) {
          valuationAnnualChangePercent =
            Math.round(((latestValuation.value - yearAgo.value) / yearAgo.value) * 1000) / 10;
        }
      }
    } catch (err) {
      console.warn("MIVAU valuation parsing failed:", err?.message || err);
    }
  }

  /*
   * ---------------------------------------------------------
   * 2. MIVAU TRANSACTION DATA
   * ---------------------------------------------------------
   */
  let latestTransaction = null;
  let transactionMatches = [];
  let provinceHeader = null;
  let transactionProvinceTextHeader = null;
  let transactionCodeHeader = null;
  let yearHeader = null;
  let quarterHeader = null;
  let transactionCountHeader = null;
  let transactionValueHeader = null;

  if (transactionText) {
    try {
      const transactionRows = parseCsv(transactionText);
      const transactionHeaders = Object.keys(transactionRows[0] || {});

      provinceHeader = findHeader(transactionHeaders, [
        (header) => header === "provincia",
        (header) => header.includes("provincia"),
        (header) => header === "codprovincia",
        (header) => header.includes("codprovincia"),
        (header) => header === "cprov"
      ]);
      yearHeader = findHeader(transactionHeaders, [
        (header) => header === "ano",
        (header) => header.includes("ano") || header.includes("year")
      ]);
      quarterHeader = findHeader(transactionHeaders, [
        (header) => header === "trimestre",
        (header) => header.includes("trimestre") || header.includes("quarter")
      ]);
      transactionCountHeader = findHeader(transactionHeaders, [
        (header) => header === "numerotransacciones",
        (header) => header.includes("numerotransacciones"),
        (header) => header.includes("transacciones") && header.includes("numero"),
        (header) => header.includes("transactions") && header.includes("number")
      ]);
      transactionValueHeader = findHeader(transactionHeaders, [
        (header) => header === "valortransacciones",
        (header) => header.includes("valortransacciones"),
        (header) => header.includes("transacciones") && header.includes("valor"),
        (header) => header.includes("transactions") && header.includes("value")
      ]);
      transactionProvinceTextHeader = findHeader(transactionHeaders, [
        (header) => header === "provincia",
        (header) => header.includes("provincia") && !header.includes("codprovincia")
      ]);
      transactionCodeHeader = findHeader(transactionHeaders, [
        (header) => header === "codprovincia",
        (header) => header.includes("codprovincia"),
        (header) => header === "cpro"
      ]);

      const transactionProvinceCodes = {
        alicante: ["03", "3", "03003"],
        torrevieja: ["03", "3", "03003"],
        madrid: ["28", "28079"],
        barcelona: ["08", "8", "08019"],
        valencia: ["46", "46078"],
        sevilla: ["41", "41091"],
        malaga: ["29", "29067"],
        murcia: ["30", "30030"],
        bilbao: ["48", "48020"],
        zaragoza: ["50", "50297"]
      };
      const targetProvinceCodes = transactionProvinceCodes[cityKey] || [];

      transactionMatches = transactionRows.filter((row) => {
        if (transactionProvinceTextHeader) {
          const provinceValue = row[transactionProvinceTextHeader];
          if (matchesLocation(provinceValue)) {
            return true;
          }
        }
        if (transactionCodeHeader && targetProvinceCodes.length) {
          const rawCode = String(row[transactionCodeHeader] || "").trim().replace(/^0+/, "") || "0";
          return targetProvinceCodes.some((code) => {
            const normalizedCode = String(code).trim().replace(/^0+/, "") || "0";
            return rawCode === normalizedCode;
          });
        }
        if (provinceHeader && provinceHeader !== transactionCodeHeader) {
          return matchesLocation(row[provinceHeader]);
        }
        return false;
      });

      const parsedTransactions = transactionMatches
        .map((row) => ({
          year: findYear(row, yearHeader),
          quarter: parseNumber(quarterHeader ? row[quarterHeader] : null),
          transactions: parseTransactionCount(
            transactionCountHeader ? row[transactionCountHeader] : null
          ),
          transactionValue: parseNumber(
            transactionValueHeader ? row[transactionValueHeader] : null
          ),
          province: transactionProvinceTextHeader
            ? repairMojibake(row[transactionProvinceTextHeader])
            : null,
          provinceCode: transactionCodeHeader ? repairMojibake(row[transactionCodeHeader]) : null
        }))
        .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.quarter))
        .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.quarter - a.quarter));

      latestTransaction = parsedTransactions[0] || null;
    } catch (err) {
      console.warn("MIVAU transaction parsing failed:", err?.message || err);
    }
  }

  /*
   * ---------------------------------------------------------
   * 3. INE MUNICIPAL URBAN INDICATORS
   * ---------------------------------------------------------
   */
  let municipalBenchmark = null;
  let estimatedMunicipalValue = null;
  let municipalMarket = null;

  if (ineText) {
    try {
      const ineRows = parseCsv(ineText);
      const ineHeaders = Object.keys(ineRows[0] || {});

      const municipalityHeader = findHeader(ineHeaders, [
        (header) => header.includes("municipio"),
        (header) => header.includes("municipality")
      ]);
      const yearIneHeader = findHeader(ineHeaders, [
        (header) => header === "ano",
        (header) => header.includes("ano") || header.includes("year")
      ]);
      const flatPriceM2Header = findHeader(ineHeaders, [
        (header) => header.includes("preciomediopormetrocuadradodelaviviendatipopiso"),
        (header) => header.includes("precio") && header.includes("metro") && header.includes("piso")
      ]);
      const overallPriceM2Header = findHeader(ineHeaders, [
        (header) => header.includes("preciomediopormetrocuadradodelavivienda"),
        (header) =>
          header.includes("precio") &&
          header.includes("metro") &&
          !header.includes("piso") &&
          !header.includes("unifamiliar")
      ]);
      const singleFamilyPriceM2Header = findHeader(ineHeaders, [
        (header) => header.includes("preciomediopormetrocuadradodelaviviendatipounifamiliar"),
        (header) =>
          header.includes("precio") && header.includes("metro") && header.includes("unifamiliar")
      ]);

      const municipalityMatches = ineRows.filter((row) =>
        municipalityHeader ? matchesMunicipality(row[municipalityHeader]) : false
      );

      const ineParsed = municipalityMatches
        .map((row) => ({
          year: yearIneHeader ? findYear(row, yearIneHeader) : null,
          flatBenchmark: flatPriceM2Header ? parseNumber(row[flatPriceM2Header]) : null,
          overallBenchmark: overallPriceM2Header ? parseNumber(row[overallPriceM2Header]) : null,
          singleFamilyBenchmark: singleFamilyPriceM2Header
            ? parseNumber(row[singleFamilyPriceM2Header])
            : null
        }))
        .filter((row) => Number.isFinite(row.year))
        .sort((a, b) => b.year - a.year);

      const latestIne = ineParsed[0] || null;

      if (latestIne) {
        municipalBenchmark =
          latestIne.flatBenchmark ?? latestIne.overallBenchmark ?? latestIne.singleFamilyBenchmark ?? null;

        const numericSizeForMunicipal = parseNumber(size);
        if (municipalBenchmark !== null && numericSizeForMunicipal !== null) {
          estimatedMunicipalValue = municipalBenchmark * numericSizeForMunicipal;
        }

        municipalMarket = {
          municipality: city,
          benchmark: municipalBenchmark,
          overallBenchmark: latestIne.overallBenchmark,
          flatBenchmark: latestIne.flatBenchmark,
          singleFamilyBenchmark: latestIne.singleFamilyBenchmark,
          year: latestIne.year,
          source: "INE - Urban Indicators, Table 69337",
          dataset: "69337",
          dataLevel: "Municipality",
          matchedRows: municipalityMatches.length
        };
      }
    } catch (err) {
      console.warn("INE municipal data parsing failed:", err?.message || err);
    }
  }

  /*
   * ---------------------------------------------------------
   * 4. FINAL RESPONSE
   * ---------------------------------------------------------
   */
  const demandKey = DEMAND_PROVINCE_ALIASES[cityKey] || cityKey;
  const demandFixture = DEMAND_INTELLIGENCE[demandKey] || null;
  const demand = demandFixture
    ? { ...demandFixture, strength: strengthFor(demandFixture.foreignBuyerShare) }
    : null;

  const numericSize = parseNumber(size);
  const governmentBenchmark = latestValuation ? latestValuation.value : null;
  const estimatedGovernmentValue =
    governmentBenchmark !== null && numericSize !== null ? governmentBenchmark * numericSize : null;

  const transactionMarket = {
    latestYear: latestTransaction ? latestTransaction.year : null,
    latestQuarter: latestTransaction ? latestTransaction.quarter : null,
    province: latestTransaction
      ? latestTransaction.province
      : latestValuation
        ? latestValuation.province
        : null,
    provinceCode: latestTransaction
      ? latestTransaction.provinceCode
      : latestValuation
        ? latestValuation.provinceCode
        : null,
    transactions: latestTransaction ? latestTransaction.transactions : null,
    transactionValue: latestTransaction ? latestTransaction.transactionValue : null,
    matchedRows: transactionMatches.length,
    detectedHeaders: {
      province: provinceHeader,
      provinceText: transactionProvinceTextHeader,
      provinceCode: transactionCodeHeader,
      year: yearHeader,
      quarter: quarterHeader,
      transactionCount: transactionCountHeader,
      transactionValue: transactionValueHeader
    }
  };

  // FIX: status now reflects reality — which sources actually answered —
  // instead of a binary "found the benchmark or the whole thing is an
  // error". A page can now render valuation="not available" while still
  // showing real transaction and municipal numbers.
  let status = "NO_GOVERNMENT_BENCHMARK";
  if (governmentBenchmark !== null) {
    status = "GOVERNMENT_BENCHMARK_FOUND";
  }
  if (!valuationText && !transactionText && !ineText) {
    status = "ALL_SOURCES_UNAVAILABLE";
  }

  return res.status(200).json({
    success: true,
    data: {
      city,
      country,
      propertyType,
      size: numericSize !== null ? numericSize : size || null,
      governmentBenchmark,
      estimatedGovernmentValue,
      annualChangePercent: valuationAnnualChangePercent,
      // FIX: engine.js's renderMarketEvidence() reads benchmarkEurPerM2 /
      // pricePerM2 / governmentValue / city / province — these are
      // aliases pointing at the exact same values above, added so the
      // frontend actually picks them up instead of showing
      // "Not available" despite real data being present in the response.
      // (index.html loads engine.js, not script.js — confirmed directly
      // from the page source — so this is the file that actually matters.)
      benchmarkEurPerM2: governmentBenchmark,
      pricePerM2: governmentBenchmark,
      governmentValue: estimatedGovernmentValue,
      province: latestValuation ? latestValuation.province : null,
      municipalBenchmark,
      estimatedMunicipalValue,
      municipalMarket,
      demand,
      year: latestValuation ? latestValuation.year : null,
      quarter: latestValuation ? latestValuation.quarter : null,
      regime: latestValuation ? latestValuation.regime : null,
      province: latestValuation ? latestValuation.province : null,
      provinceCode: latestValuation ? latestValuation.provinceCode : null,
      autonomousCommunity: latestValuation ? latestValuation.autonomousCommunity : null,
      transactionMarket,
      source: "MIVAU - Ministerio de Vivienda y Agenda Urbana + INE - Urban Indicators",
      datasets: {
        valuation: "VDP006_01",
        transactions: "VDP003_01",
        municipality: "INE 69337"
      },
      sourcesReached: {
        valuation: Boolean(valuationText),
        transactions: Boolean(transactionText),
        municipal: Boolean(ineText)
      },
      matchedRows: valuationMatches.length,
      status
    }
  });
}
