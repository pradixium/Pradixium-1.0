/* PRADIXIUM™ — which country / currency a pasted listing page belongs to.
 * Used by api/property-url.js. Only real signals: the site's own domain
 * (country TLD or a portal known to list one country), the listing's own
 * structured data (ISO country / currency codes) or an unambiguous currency
 * symbol on the page. No signal → null (the form keeps what the user chose).
 */

// ISO 3166-1 alpha-2 → the country name used by the site's dropdown
export const ISO_COUNTRY = {
  AL: "Albania", AD: "Andorra", AR: "Argentina", AM: "Armenia", AU: "Australia", AT: "Austria", AZ: "Azerbaijan",
  BS: "Bahamas", BB: "Barbados", BY: "Belarus", BE: "Belgium", BO: "Bolivia", BA: "Bosnia and Herzegovina", BR: "Brazil",
  BG: "Bulgaria", KH: "Cambodia", CA: "Canada", KY: "Cayman Islands", CL: "Chile", CO: "Colombia", HR: "Croatia",
  CY: "Cyprus", CZ: "Czech Republic", DK: "Denmark", DO: "Dominican Republic", EC: "Ecuador", EG: "Egypt", EE: "Estonia",
  FI: "Finland", FR: "France", GE: "Georgia", DE: "Germany", GR: "Greece", HU: "Hungary", IS: "Iceland", IN: "India",
  ID: "Indonesia", IE: "Ireland", IL: "Israel", IT: "Italy", JM: "Jamaica", JP: "Japan", KZ: "Kazakhstan", KE: "Kenya",
  XK: "Kosovo", KG: "Kyrgyzstan", LV: "Latvia", LI: "Liechtenstein", LT: "Lithuania", LU: "Luxembourg", MV: "Maldives",
  MT: "Malta", MX: "Mexico", MD: "Moldova", MC: "Monaco", ME: "Montenegro", MA: "Morocco", NL: "Netherlands",
  NZ: "New Zealand", NG: "Nigeria", MK: "North Macedonia", NO: "Norway", PY: "Paraguay", PE: "Peru", PL: "Poland",
  PT: "Portugal", PR: "Puerto Rico", RO: "Romania", RU: "Russia", SM: "San Marino", RS: "Serbia", SK: "Slovakia",
  SI: "Slovenia", SG: "Singapore", HK: "Hong Kong", ZA: "South Africa", KR: "South Korea", ES: "Spain", LK: "Sri Lanka", SE: "Sweden", CH: "Switzerland",
  TJ: "Tajikistan", TH: "Thailand", TT: "Trinidad and Tobago", TR: "Turkey", TM: "Turkmenistan", UA: "Ukraine",
  AE: "United Arab Emirates", GB: "United Kingdom", UK: "United Kingdom", US: "United States", UY: "Uruguay",
  UZ: "Uzbekistan", VN: "Vietnam"
};
const NAMES = new Set(Object.values(ISO_COUNTRY).map((n) => n.toLowerCase()));

// portals on generic domains (.com/.net) that list one country
const PORTALS = [
  [/(^|\.)(zillow|redfin|realtor|trulia|homes|loopnet|apartments)\.com$/, "United States"],
  [/(^|\.)(rightmove\.co\.uk|zoopla\.co\.uk|onthemarket\.com)$/, "United Kingdom"],
  [/(^|\.)(idealista\.com|kyero\.com|thinkspain\.com)$/, "Spain"],
  [/(^|\.)(seloger|logic-immo|bienici|meilleursagents|green-acres)\.com$/, "France"],
  [/(^|\.)(pararius)\.com$/, "Netherlands"],
  [/(^|\.)(imovirtual|supercasa)\.com$/, "Portugal"],
  [/(^|\.)(bayut|dubizzle|propertyfinder)\.(com|ae)$/, "United Arab Emirates"],
  [/(^|\.)(sahibinden|hepsiemlak|emlakjet|zingat)\.com$/, "Turkey"],
  [/(^|\.)(bazaraki|buysellcyprus)\.com$/, "Cyprus"],
  [/(^|\.)(spitogatos|xe)\.gr$|(^|\.)spitogatos\.com$/, "Greece"],
  [/(^|\.)(myhome|ss)\.ge$/, "Georgia"],
  [/(^|\.)property24\.com$|(^|\.)privateproperty\.co\.za$/, "South Africa"],
  [/(^|\.)mubawab\.ma$|(^|\.)avito\.ma$/, "Morocco"],
  [/(^|\.)(domain|realestate)\.com\.au$/, "Australia"],
  [/(^|\.)trademe\.co\.nz$/, "New Zealand"],
  [/(^|\.)realtor\.ca$/, "Canada"],
  [/(^|\.)(inmuebles24|vivanuncios)\.com(\.mx)?$/, "Mexico"],
  [/(^|\.)(zonaprop|argenprop)\.com(\.ar)?$/, "Argentina"],
  [/(^|\.)(zapimoveis|vivareal|imovelweb)\.com(\.br)?$/, "Brazil"],
  [/(^|\.)portalinmobiliario\.com$/, "Chile"],
  [/(^|\.)(fincaraiz|metrocuadrado)\.com(\.co)?$/, "Colombia"],
  [/(^|\.)(urbania|adondevivir)\.pe$/, "Peru"],
  [/(^|\.)(ddproperty|hipflat|thailand-property)\.com$/, "Thailand"],
  [/(^|\.)(99acres|magicbricks|housing|nobroker)\.com$/, "India"],
  [/(^|\.)(rumah123|lamudi)\.co\.id$/, "Indonesia"],
  [/(^|\.)suumo\.jp$|(^|\.)homes\.co\.jp$/, "Japan"],
  [/(^|\.)(otodom|morizon|gratka)\.pl$/, "Poland"],
  [/(^|\.)(sreality|bezrealitky)\.cz$/, "Czech Republic"],
  [/(^|\.)ingatlan\.com$/, "Hungary"],
  [/(^|\.)(njuskalo|index\.oglasi|crozilla)\.hr$|(^|\.)crozilla\.com$/, "Croatia"],
  [/(^|\.)(imobiliare|storia)\.ro$/, "Romania"],
  [/(^|\.)(imot|imoti)\.bg$/, "Bulgaria"],
  [/(^|\.)(homegate|immoscout24|newhome|comparis)\.ch$/, "Switzerland"],
  [/(^|\.)(daft|myhome)\.ie$/, "Ireland"],
  [/(^|\.)hemnet\.se$|(^|\.)booli\.se$/, "Sweden"],
  [/(^|\.)finn\.no$/, "Norway"],
  [/(^|\.)(boligsiden|boliga|home)\.dk$/, "Denmark"],
  [/(^|\.)(etuovi|oikotie)\.(com|fi)$/, "Finland"],
  [/(^|\.)(kv|city24)\.ee$/, "Estonia"],
  [/(^|\.)(ss|city24)\.lv$/, "Latvia"],
  [/(^|\.)(aruodas|domoplius)\.lt$/, "Lithuania"],
  [/(^|\.)(yad2|madlan|homeless)\.co\.il$/, "Israel"],
  [/(^|\.)(4zida|halooglasi|nekretnine)\.rs$/, "Serbia"],
  [/(^|\.)(realitica|estitor)\.com$/, "Montenegro"],
  [/(^|\.)(propertyguru\.com\.sg|99\.co|srx\.com\.sg|edgeprop\.sg)$/, "Singapore"],
  [/(^|\.)(28hse|squarefoot\.com\.hk|spacious\.hk|midland\.com\.hk|centaline-property|centanet)\.(com|hk)$|(^|\.)squarefoot\.com\.hk$/, "Hong Kong"]
];

// country code TLDs (also second-level: .co.uk, .com.au, .co.il …)
const TLD = {
  al: "AL", ad: "AD", ar: "AR", am: "AM", au: "AU", at: "AT", az: "AZ", bs: "BS", bb: "BB", by: "BY", be: "BE", bo: "BO",
  ba: "BA", br: "BR", bg: "BG", kh: "KH", ca: "CA", ky: "KY", cl: "CL", co: "CO", hr: "HR", cy: "CY", cz: "CZ", dk: "DK",
  do: "DO", ec: "EC", eg: "EG", ee: "EE", fi: "FI", fr: "FR", ge: "GE", de: "DE", gr: "GR", hu: "HU", is: "IS", in: "IN",
  id: "ID", ie: "IE", il: "IL", it: "IT", jm: "JM", jp: "JP", kz: "KZ", ke: "KE", kg: "KG", lv: "LV", li: "LI", lt: "LT",
  lu: "LU", mv: "MV", mt: "MT", mx: "MX", md: "MD", mc: "MC", me: "ME", ma: "MA", nl: "NL", nz: "NZ", ng: "NG", mk: "MK",
  no: "NO", py: "PY", pe: "PE", pl: "PL", pt: "PT", pr: "PR", ro: "RO", ru: "RU", sm: "SM", rs: "RS", sk: "SK", si: "SI",
  za: "ZA", kr: "KR", es: "ES", lk: "LK", se: "SE", ch: "CH", tj: "TJ", th: "TH", tt: "TT", tr: "TR", tm: "TM", ua: "UA",
  sg: "SG", hk: "HK", ae: "AE", uk: "GB", uy: "UY", uz: "UZ", vn: "VN"
};

export function countryFromHost(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^www\./, "");
  for (const [re, name] of PORTALS) if (re.test(h)) return name;
  const tld = h.split(".").pop();
  // .co and .me are also sold as generic domains — only a portal match counts
  if (tld === "co" || tld === "me" || tld === "tv" || tld === "io") return null;
  return TLD[tld] ? ISO_COUNTRY[TLD[tld]] : null;
}

// "ES", "Spain", "España" (JSON-LD addressCountry) → dropdown name
export function countryFromValue(v) {
  if (!v) return null;
  const s = String(typeof v === "object" ? v.name || v["@id"] || "" : v).trim();
  if (/^[A-Z]{2}$/i.test(s)) return ISO_COUNTRY[s.toUpperCase()] || null;
  const lower = s.toLowerCase();
  if (NAMES.has(lower)) return [...Object.values(ISO_COUNTRY)].find((n) => n.toLowerCase() === lower);
  const LOCAL = { "españa": "Spain", "espana": "Spain", "italia": "Italy", "deutschland": "Germany", "österreich": "Austria", "nederland": "Netherlands", "belgique": "Belgium", "belgië": "Belgium", "schweiz": "Switzerland", "suisse": "Switzerland", "polska": "Poland", "česko": "Czech Republic", "türkiye": "Turkey", "ישראל": "Israel", "ελλάδα": "Greece", "κύπρος": "Cyprus", "hrvatska": "Croatia", "magyarország": "Hungary", "românia": "Romania", "brasil": "Brazil", "méxico": "Mexico", "uae": "United Arab Emirates", "usa": "United States", "uk": "United Kingdom" };
  return LOCAL[lower] || null;
}

// unambiguous currency symbols / codes near a number on the page
const SYMBOLS = [
  [/₪|\bILS\b|\bNIS\b/, "ILS"], [/₺|\bTRY\b|\bTL\b/, "TRY"], [/\bAED\b|د\.إ/, "AED"], [/zł|\bPLN\b/, "PLN"],
  [/Kč|\bCZK\b/, "CZK"], [/\bHUF\b|\d\s?Ft\b/, "HUF"], [/R\$|\bBRL\b/, "BRL"], [/\bCHF\b/, "CHF"], [/¥|\bJPY\b/, "JPY"],
  [/₹|\bINR\b/, "INR"], [/฿|\bTHB\b/, "THB"], [/₾|\bGEL\b/, "GEL"], [/\bMAD\b|\bDH\b/, "MAD"], [/\bZAR\b/, "ZAR"],
  [/A\$|\bAUD\b/, "AUD"], [/C\$|\bCAD\b/, "CAD"], [/S\$|\bSGD\b/, "SGD"], [/HK\$|\bHKD\b/, "HKD"], [/NZ\$|\bNZD\b/, "NZD"], [/\bRON\b|\blei\b/i, "RON"], [/\bBGN\b|лв/, "BGN"],
  [/\bSEK\b/, "SEK"], [/\bNOK\b/, "NOK"], [/\bDKK\b/, "DKK"], [/\bMXN\b/, "MXN"], [/\bRSD\b|\bdin\b/i, "RSD"], [/₽|\bRUB\b/, "RUB"],
  [/₴|\bUAH\b/, "UAH"], [/£|\bGBP\b/, "GBP"], [/€|\bEUR\b/, "EUR"], [/US\$|\bUSD\b/, "USD"]
];
export function currencyFromText(text) {
  const t = String(text || "");
  for (const [re, code] of SYMBOLS) if (re.test(t)) return code;
  return null;
}

// Blocked / challenge pages (Cloudflare, DataDome, PerimeterX, captchas):
// never worked around — the customer is asked to type the figures instead.
export function looksBlocked(status, html) {
  if ([401, 403, 405, 429, 451, 503].includes(status)) return true;
  const h = String(html || "").slice(0, 20000);
  return /cf-chl|challenge-platform|datadome|captcha-delivery|px-captcha|perimeterx|Just a moment\.\.\.|Access Denied|Pardon Our Interruption|are you a robot|verify you are human/i.test(h);
}

// A country the pasted text names explicitly ("Deutschland", "Spain") —
// only when exactly one is named; the language alone never decides.
export function countryNamedIn(text) {
  const t = String(text || "");
  const found = new Set();
  const names = [...new Set(Object.values(ISO_COUNTRY))];
  for (const n of names) if (new RegExp(`(^|[^\\p{L}])${n.replace(/ /g, "\\s+")}($|[^\\p{L}])`, "iu").test(t)) found.add(n);
  const LOCAL = { "Deutschland": "Germany", "Österreich": "Austria", "Schweiz": "Switzerland", "España": "Spain", "Italia": "Italy", "Nederland": "Netherlands", "Belgique": "Belgium", "België": "Belgium", "Polska": "Poland", "Türkiye": "Turkey", "ישראל": "Israel", "Ελλάδα": "Greece", "Κύπρος": "Cyprus", "Hrvatska": "Croatia", "Magyarország": "Hungary", "România": "Romania", "Brasil": "Brazil", "México": "Mexico", "Sverige": "Sweden", "Norge": "Norway", "Danmark": "Denmark", "Suomi": "Finland", "Ísland": "Iceland", "Česko": "Czech Republic", "Slovensko": "Slovakia", "Slovenija": "Slovenia" };
  for (const [k, v] of Object.entries(LOCAL)) if (new RegExp(`(^|[^\\p{L}])${k}($|[^\\p{L}])`, "u").test(t)) found.add(v);
  return found.size === 1 ? [...found][0] : null;
}

// A German listing that names no country: German listing terms AND a
// German 5-digit postcode with its town ("50667 Köln"). Austria and
// Switzerland use 4-digit postcodes; a French 5-digit one comes with French.
export function germanListingCountry(text) {
  const t = String(text || "");
  const terms = (t.match(/\b(Kaufpreis|Wohnfläche|Grundstücksfläche|Zimmer|Kaltmiete|Hausgeld|Baujahr|Provision|Etage)\b/g) || []).length;
  return terms >= 2 && /(^|[\s,])\d{5}\s+\p{Lu}\p{Ll}/mu.test(t) && !/\b(pièces|chambres?|Prix|m² habitables)\b/i.test(t) ? "Germany" : null;
}

// The address lines of a pasted listing: a street with a number and/or a
// postcode followed by a town ("Musterstraße 12", "10115 Berlin")
const STREET = /(stra(ß|ss)e|str\.|gasse|weg|platz|allee|ring|damm|ufer|rue|avenue|boulevard|bd\.?|chemin|place|calle|c\/|avenida|avda\.?|plaza|carrer|passeig|via|viale|piazza|corso|largo|rua|travessa|street|st\.|road|rd\.?|lane|drive|straat|laan|gracht|ulica|ul\.|utca|út|vej|gade|gatan|vägen|katu|tie|sokak|caddesi|mahallesi|רחוב|רח')/iu;
export function addressFromText(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l.length <= 120);
  const street = lines.find((l) => STREET.test(l) && /\d/.test(l) && !/[€$£₪]|\bm²|\bm2\b|zimmer|rooms?|bed/i.test(l));
  const town = lines.find((l) => /(^|\s)(\d{4,5}|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\s+\p{Lu}[\p{L}.\- ]{2,40}$/u.test(l) && !/[€$£₪]/.test(l));
  const parts = [street, town && town !== street ? town : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
