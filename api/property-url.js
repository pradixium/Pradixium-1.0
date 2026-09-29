import { countryFromHost, countryFromValue, currencyFromText, looksBlocked, countryNamedIn, addressFromText } from "../lib/listing/detect.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }
  // POST { text, url? }: the listing text the customer copied from the page
  // (works for every site, including those that block automatic reading —
  // nothing is fetched from the portal)
  const pasted = req.method === "POST" ? String(req.body?.text || "").slice(0, 200000) : null;
  if (req.method === "POST" && pasted.trim().length < 20) {
    return res.status(400).json({ success: false, error: "Paste the text of the listing page (price, size, address)." });
  }

  const url = req.method === "POST" ? (req.body?.url || "https://pasted.listing/") : req.query.url;
  if (!url) {
    return res.status(400).json({ success: false, error: "Missing property URL" });
  }

  let targetUrl;
  try {
    targetUrl = new URL(url);
    if (!["http:", "https:"].includes(targetUrl.protocol)) throw new Error("Invalid protocol");
  } catch {
    return res.status(400).json({ success: false, error: "Invalid property URL" });
  }

  let hostname = targetUrl.hostname.toLowerCase();
  const isFranceSource = hostname.includes("meilleursagents.com") || hostname.endsWith(".fr");

  try {
    const response = pasted != null
      ? { ok: true, status: 200, text: async () => pasted.replace(/</g, " ").replace(/\r?\n/g, "<br>\n") }
      : await fetch(targetUrl.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": isFranceSource ? "fr-FR,fr;q=0.9,en;q=0.7" : "en-US,en;q=0.9,es;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });

    const html = response.ok ? await response.text() : "";
    if (pasted != null && hostname === "pasted.listing") hostname = "";
    // Many portals block automated readers (Cloudflare, DataDome…). That is
    // never worked around: the customer is told to type the figures in.
    if (pasted == null && (!response.ok || looksBlocked(response.status, html))) {
      return res.status(200).json({
        success: false,
        blocked: looksBlocked(response.status, html),
        error: looksBlocked(response.status, html)
          ? `${hostname} does not allow automatic reading of its pages — please type the price, size and address from the listing.`
          : `The listing page answered with an error (HTTP ${response.status}) — please check the link or type the details.`,
        source: hostname
      });
    }

    function clean(value) {
      if (value === null || value === undefined) return null;
      return String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        // FIX: a real live listing title came back as "Berl&#xED;n"
        // instead of "Berlín" — the entity list above only covered a
        // hand-picked handful (amp/quot/apos/nbsp + a few numeric ones),
        // so any OTHER numeric character reference (any accented letter
        // in é/í/ñ/ü/ç/etc., which Spanish/French/Portuguese/Italian
        // listing titles are full of) passed straight through unescaped.
        // A general decimal/hex numeric-entity decoder covers all of them
        // at once instead of hardcoding every possible accented letter.
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/\s+/g, " ")
        .trim();
    }

    function numberFromText(value) {
      if (value === null || value === undefined) return null;
      const raw = clean(value);
      if (!raw) return null;

      const match = raw.match(/(?:[$€£]|USD|EUR|GBP)?\s*([0-9][0-9\s.,]*)/i);
      if (!match) return null;

      let number = match[1].replace(/[\s\u00a0\u202f]/g, "");
      if (number.includes(",") && number.includes(".")) {
        if (number.lastIndexOf(",") > number.lastIndexOf(".")) {
          number = number.replace(/\./g, "").replace(",", ".");
        } else {
          number = number.replace(/,/g, "");
        }
      } else if (number.includes(",")) {
        const parts = number.split(",");
        number = parts[1] && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : parts.join("");
      } else if ((number.match(/\./g) || []).length > 1) {
        number = number.replace(/\./g, "");
      } else if (number.includes(".") && number.split(".")[1]?.length === 3) {
        number = number.replace(".", "");
      }

      const result = Number(number);
      return Number.isFinite(result) ? result : null;
    }

    // what a visitor sees: no scripts (except JSON-LD), styles or SVG
    // drawings — a price regex once picked "80" out of an SVG path
    const visible = html.replace(/<script(?![^>]*ld\+json)[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<noscript[\s\S]*?<\/noscript>/gi, " ");
    const visibleText = visible.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
    function extract(patterns, src = visible) {
      for (const pattern of patterns) {
        const match = src.match(pattern);
        if (match && match[1]) return clean(match[1]);
      }
      return null;
    }

    function extractMeta(property) {
      const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i")
      ];
      return extract(patterns);
    }

    function parseJsonLd() {
      const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      const values = [];
      for (const match of scripts) {
        try {
          const parsed = JSON.parse(match[1].trim());
          values.push(parsed);
        } catch {
          // Ignore malformed JSON-LD blocks.
        }
      }
      return values;
    }

    function findListing(value, depth = 0) {
      if (!value || typeof value !== "object" || depth > 8) return null;
      const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
      const typeText = types.filter(Boolean).join(" ").toLowerCase();
      if (
        value.offers || value.mainEntity || value.itemOffered || value.about ||
        value.numberOfBedrooms || value.numberOfBathroomsTotal || value.floorSize ||
        value.address || typeText.includes("product") || typeText.includes("residence") ||
        typeText.includes("apartment") || typeText.includes("house") || typeText.includes("realestate")
      ) return value;

      for (const key of Object.keys(value)) {
        const found = findListing(value[key], depth + 1);
        if (found) return found;
      }
      return null;
    }

    function findOffer(value, depth = 0) {
      if (!value || typeof value !== "object" || depth > 8) return null;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findOffer(item, depth + 1);
          if (found) return found;
        }
        return null;
      }
      if (value.price !== undefined && value.price !== null) return value;
      if (value.priceSpecification && typeof value.priceSpecification === "object") {
        const found = findOffer(value.priceSpecification, depth + 1);
        if (found) return found;
      }
      for (const key of Object.keys(value)) {
        const found = findOffer(value[key], depth + 1);
        if (found) return found;
      }
      return null;
    }

    // A search/listing-index page (many properties, not one) has no single
    // price or size to extract — guessing one from whatever number happens
    // to appear first on the page would be a fabricated data point, not a
    // real property's asking price. Detect it up front (its own JSON-LD
    // type, or a /search//zoeken//recherche/ path) and say so plainly
    // instead of either failing silently or extracting the wrong number.
    const jsonLdBlocks = parseJsonLd();
    const metaDescription = extractMeta("og:description") || extractMeta("description") || extractMeta("twitter:description") || "";
    const looksLikeListIndex = jsonLdBlocks.some((item) => {
      const types = [item].flat().flatMap((v) => (Array.isArray(v?.["@type"]) ? v["@type"] : [v?.["@type"]])).filter(Boolean);
      return types.some((t) => /itemlist|searchresultspage|collectionpage/i.test(String(t)));
    }) || /\/(search|zoeken|recherche|resultats|r[eé]sultats)(\/|$|\?)/i.test(targetUrl.pathname);

    let listing = null;
    for (const item of jsonLdBlocks) {
      listing = findListing(item);
      if (listing) break;
    }

    if (!listing && looksLikeListIndex) {
      return res.status(200).json({
        success: false,
        error: "This looks like a search results page with multiple properties, not a single listing. Please paste the link to one specific property listing instead.",
        url: targetUrl.toString(),
        source: hostname
      });
    }

    const entity = listing?.mainEntity || listing?.about || listing?.itemOffered || listing || {};
    const offer = findOffer(listing?.offers || entity.offers || listing || entity);
    const addressObject = entity.address || listing?.address || null;

    let price = offer?.price ?? null;
    let currency = offer?.priceCurrency || offer?.currency || null;

    if (price === null || price === undefined || price === "") {
      const priceCandidates = [
        extractMeta("product:price:amount"),
        extractMeta("og:price:amount"),
        extractMeta("price"),
        extractMeta("twitter:data1"),
        // the page's own description ("… for £499,000") before any loose number
        extract([/([$€£₪₺]\s?[0-9][0-9,\.]{3,})/, /((?:AED|USD|EUR|GBP|CHF|TRY|ILS)\s?[0-9][0-9,\.]{3,})/, /([0-9][0-9,\.\s]{3,}\s?(?:€|£|₪|₺|zł|Kč|Ft|TL|AED|CHF))/], metaDescription),
        extract([
          /(?:"|')?(?:askingPrice|listPrice|listingPrice|salePrice|priceValue|priceText|primaryPrice|displayPrice)(?:"|')?\s*:\s*(?:"|')([^"']+)(?:"|')/i,
          /(?:"|')?(?:askingPrice|listPrice|listingPrice|salePrice|priceValue|priceText)(?:"|')?\s*:\s*([0-9][0-9,\.\s]*)/i
        ], html),
        extract([
          /data-(?:asking-)?price=["']([^"']+)["']/i,
          /(?:class|id)=["'][^"']*(?:listing-price|asking-price|sale-price|property-price|price)[^"']*["'][^>]*>\s*([^<]{2,80})</i,
          /([$€£]\s?[0-9][0-9,\.\s]{2,})/i,
          /([0-9][0-9,\.\s]{2,})\s*(?:USD|US\$|EUR|GBP|€|£)/i
        ])
      ];
      for (const candidate of priceCandidates) {
        const parsed = numberFromText(candidate);
        if (parsed !== null) {
          price = parsed;
          break;
        }
      }
    } else {
      price = numberFromText(price);
    }

    if (!currency) {
      const currencyMatch = html.match(/(?:priceCurrency|currency|currencyCode)\s*["']?\s*[:=]\s*["']([A-Z]{3})["']/i);
      currency = currencyMatch?.[1] || null;
    }
    if (!currency) {
      // a symbol next to a number, else anywhere in the page's meta/title
      const near = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/.{0,6}[0-9][0-9.,\s]{3,}.{0,6}/g) || [];
      currency = currencyFromText(near.slice(0, 40).join(" ")) || null;
    }

    let address = null;
    let city = null;
    let country = null;
    if (addressObject && typeof addressObject === "object") {
      address = [addressObject.streetAddress, addressObject.addressLocality, addressObject.addressRegion, addressObject.postalCode, addressObject.addressCountry]
        .filter(Boolean).join(", ");
      city = addressObject.addressLocality || null;
      country = addressObject.addressCountry || null;
    } else if (typeof addressObject === "string") {
      address = clean(addressObject);
    }

    let bedrooms = entity.numberOfBedrooms || listing?.numberOfBedrooms || null;
    let bathrooms = entity.numberOfBathroomsTotal || entity.numberOfBathrooms || listing?.numberOfBathroomsTotal || null;
    let floorSize = entity.floorSize || listing?.floorSize || null;
    let size = floorSize && typeof floorSize === "object" ? numberFromText(floorSize.value) : numberFromText(floorSize);
    // schema.org unitCode FTK / SQF = square feet (US, UK, Dubai listings)
    let sizeInFeet = floorSize && typeof floorSize === "object" && /^(FTK|SQF|sq ?ft|ft2|ft²)$/i.test(String(floorSize.unitCode || floorSize.unitText || ""));

    const domainCountry =
      /(^|\.)(idealista\.com|fotocasa\.es|pisos\.com|habitaclia\.com|kyero\.com)$/.test(hostname) && hostname.includes(".es") ? "Spain" :
      /(^|\.)(idealista\.com|fotocasa\.es|pisos\.com|habitaclia\.com)$/.test(hostname) ? "Spain" :
      /(^|\.)(seloger\.com|leboncoin\.fr|logic-immo\.com|bienici\.com|pap\.fr)$/.test(hostname) ? "France" :
      /(^|\.)(rightmove\.co\.uk|zoopla\.co\.uk|onthemarket\.com)$/.test(hostname) ? "United Kingdom" :
      /(^|\.)(zillow\.com|redfin\.com|realtor\.com|trulia\.com|homes\.com)$/.test(hostname) ? "United States" :
      /(^|\.)(realo\.be|immoweb\.be|immovlan\.be|zimmo\.be|logic-immo\.be)$/.test(hostname) ? "Belgium" :
      /(^|\.)(immobilienscout24\.de|immowelt\.de|immonet\.de)$/.test(hostname) ? "Germany" :
      /(^|\.)(immobiliare\.it|casa\.it|idealista\.it)$/.test(hostname) ? "Italy" :
      /(^|\.)(idealista\.pt|imovirtual\.com|remax\.pt)$/.test(hostname) ? "Portugal" :
      /(^|\.)(funda\.nl|pararius\.com)$/.test(hostname) ? "Netherlands" :
      null;

    const isUS = !domainCountry && (/\b(United States|USA)\b/i.test(html) || /US\$\s*[0-9]/i.test(html) || /\$\s*[0-9][0-9,\.]{2,}/.test(html));
    const french = isFranceSource || (!domainCountry && !countryFromHost(hostname) && /\b(France|Paris|Lyon|Marseille|Bordeaux|Toulouse|Nantes|Montpellier|Strasbourg)\b/.test(visible));

    if (!price) {
      price = numberFromText(extract([
        /(?:Price|List Price|Asking Price|Listed at|Sale Price|Prix|Precio|Prezzo|Preço|Preis|Kaufpreis|Vraagprijs|Cena|Ár|Fiyat|Τιμή|מחיר|Цена)[^0-9$€£₪₺]{0,120}([$€£₪₺]?\s*[0-9][0-9,\.\s]*)/i,
        /([₪₺]\s*[0-9][0-9,\.\s]{2,})/,
        /(?:AED|USD|EUR|GBP|CHF|TRY|ILS|NIS|PLN|CZK|HUF|RON|BGN|SEK|NOK|DKK|ZAR|MAD|CAD|AUD|NZD|MXN|BRL|INR|THB|JPY|GEL|R\$)\s*([0-9][0-9,\.\s]{2,})/,
        /([0-9][0-9,\.\s]{2,})\s*(?:₪|₺|AED|zł|Kč|Ft|CHF|PLN|CZK|HUF|TRY|ILS|RON|BGN|SEK|NOK|DKK)/,
        /([$€£]\s*[0-9][0-9,\.\s]{2,})/i,
        /([0-9][0-9,\.\s]{2,})\s*(?:USD|US\$|EUR|GBP|€|£)/i
      ]));
    }

    if (!size) {
      // the unit is captured with the number: square feet are converted
      const m = (metaDescription + " " + visible).replace(/<[^>]+>/g, " ").match(/(?:Living Area|Living Space|Floor Area|Built area|Interior|Surface habitable|Surface Carrez|Surface|Superficie|Superficie construida|Área|Area|Wohnfläche|Woonoppervlakte|Metraż|Powierzchnia|Užitná plocha|Alapterület|Brutto|Net|שטח)?[^0-9<]{0,60}?([0-9][0-9,\.\s]{0,9})\s*(sq\.?\s*ft\.?|sqft|ft²|ft2|square feet|m²|m2|sq\.?\s*m|sqm|מ"ר|מ״ר|кв\.?\s*м)/i);
      if (m) { size = numberFromText(m[1]); if (/ft|feet/i.test(m[2])) sizeInFeet = true; }
    }
    if (size && sizeInFeet) size = Math.round(size * 0.092903);

    if (!bedrooms) {
      bedrooms = numberFromText(extract([
        // "BEDROOMS 1" / "Bedrooms: 3" (a label, not a sentence)
        /(?:BEDROOMS?|Bedrooms?:|Beds?:)\s*([0-9]+)\b/,
        /([0-9]+)\s*(?:bedrooms?|beds?)/i,
        /([0-9]+)\s*(?:chambres?|chambre)\b/i,
        /([0-9]+)\s*(?:dormitorios?|habitaciones?|quartos?|camere(?:\s+da\s+letto)?|Schlafzimmer|slaapkamers?|sypialnie|ložnice|hálószoba|υπνοδωμάτια|yatak odası)(?![a-z])/i,
        // "pièces" is total room count (living room, kitchen, etc. included),
        // not bedrooms — only used as a last-resort fallback.
        /([0-9]+)\s*(?:pièces?|pieces?)/i
      ], visibleText));
    }

    if (!bathrooms) {
      bathrooms = numberFromText(extract([
        /(?:BATHROOMS?|Bathrooms?:|Baths?:)\s*([0-9]+(?:\.[0-9]+)?)\b/,
        /([0-9]+(?:\.[0-9]+)?)\s*(?:bathrooms?|baths?|salles?\s*de\s*bain|baños?|bagni|casas?\s*de\s*banho|Badezimmer|badkamers?|łazienki|koupelny|fürdőszoba|μπάνια)/i,
        /(?:Salles?\s*de\s*bain)\s*:?\s*([0-9]+)\b/i
      ], visibleText));
    }

    if (!address) {
      address = extract([
        /<h1[^>]*>([\s\S]*?)<\/h1>/i,
        /class=["'][^"']*(?:address|adresse|direccion|ubicacion|location)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
      ]);
    }

    if (!city) {
      const cityMatch = html.match(/\b(Surfside|Miami Beach|Miami|New York|Los Angeles|San Francisco|Chicago|Houston|Boston|Dallas|Austin|Seattle|Alicante|Madrid|Barcelona|Valencia|Malaga|Málaga|Murcia|Bilbao|Zaragoza|Sevilla|Paris|Lyon|Marseille|Nice|Bordeaux|Toulouse|Nantes|Montpellier|Strasbourg|Lille|Rennes|Cannes|Antibes|Versailles|Bruxelles|Brussels|Brussel|Antwerpen|Antwerp|Gent|Ghent|Brugge|Bruges|Leuven|Li[eè]ge|Charleroi|Namur)\b/i);
      if (cityMatch) city = cityMatch[1];
    }

    const postalMatch = html.match(/\b(\d{5})(?:-\d{4})?\b/);
    const usStateMatch = html.match(/\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);
    if (!city && postalMatch && french) city = postalMatch[1];

    const SPAIN_CITIES = /^(Alicante|Madrid|Barcelona|Valencia|Malaga|Málaga|Murcia|Bilbao|Zaragoza|Sevilla)$/i;
    const FRANCE_CITIES = /^(Paris|Lyon|Marseille|Nice|Bordeaux|Toulouse|Nantes|Montpellier|Strasbourg|Lille|Rennes|Cannes|Antibes|Versailles)$/i;
    const US_CITIES = /^(Surfside|Miami Beach|Miami|New York|Los Angeles|San Francisco|Chicago|Houston|Boston|Dallas|Austin|Seattle)$/i;
    const BELGIUM_CITIES = /^(Bruxelles|Brussels|Brussel|Antwerpen|Antwerp|Gent|Ghent|Brugge|Bruges|Leuven|Li[eè]ge|Charleroi|Namur)$/i;
    const cityCountry = city && SPAIN_CITIES.test(city) ? "Spain" : city && FRANCE_CITIES.test(city) ? "France" : city && US_CITIES.test(city) ? "United States" : city && BELGIUM_CITIES.test(city) ? "Belgium" : null;

    // FIX: this used to fall back to "United States"/"France"/"Spain" as a
    // last resort even with zero evidence for any of them — a Belgian,
    // German, Italian or any other unrecognized listing got silently
    // mislabeled as Spain. No signal at all means no guess: leave country
    // null and let the form keep whatever the person already selected.
    country = countryFromValue(country) || domainCountry || countryFromHost(hostname) || cityCountry || (isUS ? "United States" : (french ? "France" : null));
    // pasted listing text: its own address lines and a country it names
    if (pasted != null) {
      const a = addressFromText(pasted);
      if (a && !(addressObject && typeof addressObject === "object")) address = a;
      if (!country) country = countryNamedIn(pasted);
    }

    const typeValue = entity["@type"] || listing?.["@type"] || "Apartment";
    const propertyType = Array.isArray(typeValue) ? typeValue[0] : typeValue;

    const property = {
      address: address || null,
      city: city || null,
      country: country || null,
      state: usStateMatch?.[1] || null,
      postalCode: usStateMatch?.[2] || postalMatch?.[1] || null,
      price: price !== null && price !== undefined ? Number(price) : null,
      askingPrice: price !== null && price !== undefined ? Number(price) : null,
      currency,
      askingCurrency: currency,
      bedrooms: bedrooms !== null && bedrooms !== undefined ? Number(bedrooms) : null,
      bathrooms: bathrooms !== null && bathrooms !== undefined ? Number(bathrooms) : null,
      size: size !== null && size !== undefined ? Number(size) : null,
      propertyType: propertyType || "Apartment",
      name: entity.name || listing?.name || null
    };

    const foundAnything = [property.price, property.size, property.bedrooms, property.bathrooms, property.address, property.city]
      .some(value => value !== null && value !== undefined && value !== "");

    if (!foundAnything) {
      return res.status(200).json({
        success: false,
        error: "No property data found on the listing page",
        url: targetUrl.toString(),
        source: hostname
      });
    }

    return res.status(200).json({
      success: true,
      sourceUrl: targetUrl.toString(),
      source: hostname,
      property
    });
  } catch (error) {
    console.error("Property URL error:", error);
    return res.status(500).json({ success: false, error: "Unable to read property page" });
  }
}
