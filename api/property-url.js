export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const url = req.query.url;
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

  const hostname = targetUrl.hostname.toLowerCase();
  const isFranceSource = hostname.includes("meilleursagents.com") || hostname.endsWith(".fr");

  try {
    const response = await fetch(targetUrl.toString(), {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": isFranceSource ? "fr-FR,fr;q=0.9,en;q=0.7" : "en-US,en;q=0.9,es;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache"
      }
    });

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: `Property page returned ${response.status}`,
        source: hostname
      });
    }

    const html = await response.text();

    function clean(value) {
      if (value === null || value === undefined) return null;
      return String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#x2F;|&#47;/gi, "/")
        .replace(/&#36;/gi, "$")
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

    function extract(patterns) {
      for (const pattern of patterns) {
        const match = html.match(pattern);
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
        extract([
          /(?:"|')?(?:askingPrice|listPrice|listingPrice|salePrice|priceValue|priceText)(?:"|')?\s*:\s*(?:"|')([^"']+)(?:"|')/i,
          /(?:"|')?(?:askingPrice|listPrice|listingPrice|salePrice|priceValue|priceText)(?:"|')?\s*:\s*([0-9][0-9,\.\s]*)/i,
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
      if (/US\$\s*[0-9]/i.test(html) || /\bUSD\b/i.test(html)) currency = "USD";
      else if (/£|GBP/i.test(html)) currency = "GBP";
      else if (/€|EUR/i.test(html)) currency = "EUR";
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
    let size = floorSize && typeof floorSize === "object" ? floorSize.value : floorSize;

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
    const french = isFranceSource || /\b(France|Paris|Lyon|Marseille|Nice|Bordeaux|Toulouse|Nantes|Montpellier|Strasbourg|Lille|Rennes|Cannes|Antibes|Versailles)\b/i.test(html);

    if (!price) {
      price = numberFromText(extract([
        /(?:Price|List Price|Asking Price|Listed at|Sale Price|Prix)[^0-9$€£]{0,120}([$€£]?\s*[0-9][0-9,\.\s]*)/i,
        /([$€£]\s*[0-9][0-9,\.\s]{2,})/i,
        /([0-9][0-9,\.\s]{2,})\s*(?:USD|US\$|EUR|GBP|€|£)/i
      ]));
    }

    if (!size) {
      size = numberFromText(extract([
        /(?:Living Area|Living Space|Floor Area|Square Feet|Sq\.?\s*Ft\.?|Surface habitable|Surface Carrez|Surface|Superficie|Built area)[^0-9]{0,100}([0-9][0-9,\.\s]*)\s*(?:sq\.?\s*ft\.?|ft²|m(?:²|2))/i,
        /([0-9][0-9,\.\s]*)\s*(?:sq\.?\s*ft\.?|ft²|m(?:²|2))/i
      ]));
    }

    if (!bedrooms) {
      bedrooms = numberFromText(extract([
        /([0-9]+)\s*(?:bedrooms?|beds?)/i,
        /(?:Bedrooms?|Beds?)[^0-9]{0,40}([0-9]+)/i,
        /([0-9]+)\s*(?:chambres?|chambre)\b/i,
        // "pièces" is total room count (living room, kitchen, etc. included),
        // not bedrooms — only used as a last-resort fallback.
        /([0-9]+)\s*(?:pièces?|pieces?)/i
      ]));
    }

    if (!bathrooms) {
      bathrooms = numberFromText(extract([
        /([0-9]+(?:\.[0-9]+)?)\s*(?:bathrooms?|baths?|salles?\s*de\s*bain|baños?)/i,
        /(?:Bathrooms?|Baths?|Salles?\s*de\s*bain)[^0-9]{0,40}([0-9]+(?:\.[0-9]+)?)/i
      ]));
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
    if (!country) country = domainCountry || cityCountry || (isUS ? "United States" : (french ? "France" : null));
    if (!currency) currency = country === "United States" ? "USD" : country === "United Kingdom" ? "GBP" : "EUR";

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
