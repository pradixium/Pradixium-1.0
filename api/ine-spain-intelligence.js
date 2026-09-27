export default async function handler(req, res) {
  const city = String(req.query?.city || "").trim();
  const country = String(req.query?.country || "Spain").trim();

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (normalize(country) !== "spain") {
    return res.status(200).json({
      success: true,
      source: "INE",
      status: "COUNTRY_NOT_SUPPORTED_YET",
      data: null
    });
  }

  if (!city) {
    return res.status(400).json({
      success: false,
      source: "INE",
      status: "CITY_REQUIRED"
    });
  }

  const provinceMap = {
    "alicante": { code: "03", names: ["alicante", "alicante alacant", "alacant"], community: ["comunitat valenciana", "comunidad valenciana"] },
    "torrevieja": { code: "03", names: ["alicante", "alicante alacant", "alacant"], community: ["comunitat valenciana", "comunidad valenciana"] },
    "madrid": { code: "28", names: ["madrid"], community: ["comunidad de madrid", "madrid"] },
    "barcelona": { code: "08", names: ["barcelona"], community: ["cataluna", "catalunya"] },
    "valencia": { code: "46", names: ["valencia", "valencia valencia"], community: ["comunitat valenciana", "comunidad valenciana"] },
    "sevilla": { code: "41", names: ["sevilla"], community: ["andalucia"] },
    "malaga": { code: "29", names: ["malaga"], community: ["andalucia"] },
    "murcia": { code: "30", names: ["murcia"], community: ["region de murcia", "murcia"] },
    "bilbao": { code: "48", names: ["bizkaia", "vizcaya"], community: ["pais vasco", "euskadi"] },
    "zaragoza": { code: "50", names: ["zaragoza"], community: ["aragon"] }
  };

  const cityKey = normalize(city);
  const location = provinceMap[cityKey] || {
    code: "",
    names: [cityKey],
    community: []
  };

  const fetchText = async (url, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/csv,text/plain,application/json",
          "User-Agent": "Pradixium/1.0"
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`INE request failed: ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  };

  const repair = (value) => {
    const text = String(value ?? "");
    if (!text.includes("Ã") && !text.includes("Â") && !text.includes("â")) return text;
    try { return Buffer.from(text, "latin1").toString("utf8"); } catch { return text; }
  };

  const splitCsvLine = (line, delimiter) => {
    const result = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (quoted) {
        if (char === '"' && next === '"') { field += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"') quoted = true;
      else if (char === delimiter) { result.push(field.trim()); field = ""; }
      else field += char;
    }
    result.push(field.trim());
    return result;
  };

  const parseCsv = (text) => {
    const clean = repair(text).replace(/^\uFEFF/, "");
    const lines = clean.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (!lines.length) return [];
    const sample = lines[0];
    const delimiters = [";", "\t", ","];
    const delimiter = delimiters.sort((a, b) => splitCsvLine(sample, b).length - splitCsvLine(sample, a).length)[0];
    const headers = splitCsvLine(lines[0], delimiter).map((header) => repair(header));
    return lines.slice(1).map((line) => {
      const values = splitCsvLine(line, delimiter);
      const row = {};
      headers.forEach((header, index) => { row[header] = repair(values[index] ?? ""); });
      return row;
    });
  };

  const numeric = (value) => {
    let text = String(value ?? "").trim().replace(/\u00a0/g, "").replace(/\s/g, "");
    if (!text) return null;
    if (text.includes(".") && text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
    else if (text.includes(",")) text = text.replace(",", ".");
    else if ((text.match(/\./g) || []).length > 1) text = text.replace(/\./g, "");
    text = text.replace(/[^0-9.-]/g, "");
    const valueNumber = Number(text);
    return Number.isFinite(valueNumber) ? valueNumber : null;
  };

  const findColumn = (headers, patterns) => headers.find((header) => patterns.some((pattern) => pattern.test(normalize(header)))) || null;

  const rowText = (row) => Object.values(row).map(normalize).join(" | ");
  const matchesAny = (row, terms) => {
    const text = rowText(row);
    return terms.some((term) => text.includes(normalize(term)));
  };

  const yearFromRow = (row) => {
    const header = findColumn(Object.keys(row), [/ano/, /year/, /fecha/, /periodo/]);
    const text = header ? String(row[header]) : rowText(row);
    const matches = text.match(/20\d{2}/g);
    return matches ? Number(matches[matches.length - 1]) : null;
  };

  const compactRows = (rows, locationTerms, max = 12) => {
    const matches = rows.filter((row) => matchesAny(row, locationTerms));
    const headers = Object.keys(rows[0] || {});
    const numericColumns = headers.filter((header) => /valor|value|dato|total|renta|ocupados|poblacion|indice|media|mediana|variacion|porcentaje|porcentaje|capacidad|establecimientos/i.test(normalize(header)));
    const selected = matches.slice(-max);
    return selected.map((row) => {
      const values = {};
      headers.forEach((header) => {
        const raw = row[header];
        const parsed = numericColumns.includes(header) ? numeric(raw) : null;
        values[header] = parsed !== null ? parsed : raw;
      });
      return values;
    });
  };

  const datasets = [
    {
      key: "population",
      table: "59589",
      name: "Resident population by date, sex and age — ECP",
      url: "https://www.ine.es/jaxiT3/files/t/csv_bdsc/59589.csv",
      location: location.names
    },
    {
      key: "foreignPopulation",
      table: "56947",
      name: "Resident population by date, sex, age and nationality group — ECP",
      url: "https://www.ine.es/jaxiT3/files/t/csv_bd/56947.csv",
      location: location.names.concat(["extranjera", "extranjero"])
    },
    {
      key: "income",
      table: "31025",
      name: "Mean and median income indicators — ADRH",
      url: "https://www.ine.es/jaxiT3/files/t/csv_bd/31025.csv",
      location: [cityKey]
    },
    {
      key: "employment",
      table: "79336",
      name: "Employed population by economic sector and province — EPA",
      url: "https://www.ine.es/jaxiT3/files/t/csv_bdsc/79336.csv",
      location: location.names
    },
    {
      // % change series (not an absolute €/m² price) — kept for context,
      // but NOT used as the headline benchmark anymore. See
      // "absolutePriceDatasets" below for the real benchmark source.
      key: "housingPriceIndex",
      table: "25171",
      name: "Housing Price Index by Autonomous Community — IPV (% change)",
      url: "https://www.ine.es/jaxiT3/files/t/csv_bd/25171.csv",
      location: location.community
    },
    {
      key: "tourism",
      table: "72966",
      name: "Open establishments and capacity by accommodation type",
      url: "https://www.ine.es/jaxi/files/tpx/csv_bdsc/72966.csv",
      location: ["espana", "spain"]
    }
  ];

  const results = {};
  const errors = [];

  await Promise.all(datasets.map(async (dataset) => {
    try {
      const rows = parseCsv(await fetchText(dataset.url, 8000));
      const matched = compactRows(rows, dataset.location, 12);
      results[dataset.key] = {
        table: dataset.table,
        name: dataset.name,
        latestYear: matched.map(yearFromRow).filter(Boolean).sort((a, b) => b - a)[0] || null,
        matchedRows: matched,
        rowCount: matched.length,
        source: "INE"
      };
    } catch (error) {
      errors.push({ key: dataset.key, message: error?.message || "INE dataset unavailable" });
      results[dataset.key] = {
        table: dataset.table,
        name: dataset.name,
        matchedRows: [],
        rowCount: 0,
        source: "INE",
        status: "UNAVAILABLE"
      };
    }
  }));

  // ---------------------------------------------------------------------
  // ABSOLUTE €/m² BENCHMARK — table 25171 above is a year-over-year %
  // change series, not a price. engine.js / report.html need a real
  // absolute price (marketData.benchmarkEurPerM2) to show "MIVAU
  // BENCHMARK". INE table 69337 ("Urban Indicators") publishes an
  // actual average price per m² at MUNICIPALITY level — this is the
  // correct source for that field.
  // ---------------------------------------------------------------------
  let benchmarkEurPerM2 = null;
  let benchmarkYear = null;

  try {
    // NOTE: this national municipal-level table is much larger than the
    // others (it covers every municipality in Spain), so it gets a much
    // longer timeout. Safe on Vercel Pro (up to 60s per function).
    const municipalText = await fetchText("https://www.ine.es/jaxiT3/files/t/csv_bdsc/69337.csv", 25000);
    const municipalRows = parseCsv(municipalText);
    const municipalHeaders = Object.keys(municipalRows[0] || {});

    const municipalityHeader = findColumn(municipalHeaders, [/municipio/, /municipality/]);
    const yearHeader = findColumn(municipalHeaders, [/ano/, /year/]);
    const flatPriceHeader = findColumn(municipalHeaders, [/preciomediopormetrocuadradodelaviviendatipopiso/]);
    const overallPriceHeader = municipalHeaders.find((header) => {
      const n = normalize(header);
      return n.includes("precio") && n.includes("metro") && !n.includes("piso") && !n.includes("unifamiliar");
    });

    const cityMatches = municipalRows.filter((row) =>
      municipalityHeader ? matchesAny(row, location.names) === false ? false : normalize(row[municipalityHeader]).includes(cityKey) : false
    );

    const parsedMunicipal = cityMatches
      .map((row) => ({
        year: yearHeader ? Number((String(row[yearHeader] || "").match(/20\d{2}/) || [])[0]) : null,
        flatPrice: flatPriceHeader ? numeric(row[flatPriceHeader]) : null,
        overallPrice: overallPriceHeader ? numeric(row[overallPriceHeader]) : null
      }))
      .filter((row) => Number.isFinite(row.year))
      .sort((a, b) => b.year - a.year);

    const latest = parsedMunicipal[0];
    if (latest) {
      benchmarkEurPerM2 = latest.flatPrice ?? latest.overallPrice ?? null;
      benchmarkYear = latest.year;
    }

    results.municipalPriceIndex = {
      table: "69337",
      name: "INE Urban Indicators — average price per m² (municipality level)",
      benchmarkEurPerM2,
      year: benchmarkYear,
      matchedRows: cityMatches.length,
      source: "INE"
    };
  } catch (error) {
    errors.push({ key: "municipalPriceIndex", message: error?.message || "INE municipal price dataset unavailable" });
    results.municipalPriceIndex = {
      table: "69337",
      name: "INE Urban Indicators — average price per m² (municipality level)",
      benchmarkEurPerM2: null,
      matchedRows: 0,
      source: "INE",
      status: "UNAVAILABLE"
    };
  }

  // ---------------------------------------------------------------------
  // FLAT FIELDS — these are what engine.js's renderMarketEvidence() and
  // report.html actually read (marketData.benchmarkEurPerM2,
  // marketData.city / marketData.province). Everything above is kept as
  // detailed supporting data; these top-level fields are the connector
  // that was missing — the orchestrator forwards this whole "data"
  // object straight through as marketData with no relabeling, so the
  // field names here must match what the frontend expects exactly.
  // ---------------------------------------------------------------------
  results.benchmarkEurPerM2 = benchmarkEurPerM2;
  results.pricePerM2 = benchmarkEurPerM2;
  results.benchmarkYear = benchmarkYear;
  results.city = city;
  results.province = location.community[0]
    ? location.community[0].replace(/\b\w/g, (c) => c.toUpperCase())
    : city;

  return res.status(200).json({
    success: true,
    source: "INE",
    status: errors.length ? "PARTIAL" : "CONNECTED",
    location: {
      city,
      provinceCode: location.code || null,
      provinceTerms: location.names,
      autonomousCommunityTerms: location.community
    },
    data: results,
    errors,
    methodology: {
      population: "INE ECP table 59589",
      foreignPopulation: "INE ECP table 56947",
      income: "INE ADRH municipal table 31025",
      employment: "INE EPA provincial table 79336",
      housingPriceIndex: "INE IPV autonomous-community table 25171 (% change, contextual only)",
      municipalPriceIndex: "INE Urban Indicators table 69337 (absolute €/m² — used as the headline benchmark)",
      tourism: "INE tourism table 72966"
    }
  });
}
