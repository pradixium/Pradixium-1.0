/* PRADIXIUM™ — Report language resolver
 * Decides which local language a property report should also be offered
 * in, so a local client (seller, agent, notary) in that market can read
 * it without depending on the investor's own language. Only covers
 * languages report.html actually has full label translations for — an
 * unsupported market resolves to English rather than mixing a translated
 * body with untranslated section labels.
 */

const COUNTRY_LANGUAGE = {
  spain: { code: "es", label: "Español" },
  france: { code: "fr", label: "Français" },
  germany: { code: "de", label: "Deutsch" },
  italy: { code: "it", label: "Italiano" },
  portugal: { code: "pt", label: "Português" },
  netherlands: { code: "nl", label: "Nederlands" },
  austria: { code: "de", label: "Deutsch" },
  israel: { code: "he", label: "Hebrew" }
};

const BELGIUM_FLEMISH_CITIES = [
  "antwerp", "antwerpen", "ghent", "gent", "bruges", "brugge", "leuven",
  "mechelen", "hasselt", "kortrijk", "aalst", "ostend", "oostende",
  "sint-niklaas", "genk", "roeselare", "turnhout"
];

const SWISS_FRENCH_CITIES = ["geneva", "geneve", "genève", "lausanne", "montreux", "vevey", "nyon", "fribourg", "sion", "neuchatel", "neuchâtel", "vaud"];
const SWISS_ITALIAN_CITIES = ["lugano", "bellinzona", "locarno", "ticino", "mendrisio"];

function matches(city, list) {
  const c = String(city || "").trim().toLowerCase();
  return Boolean(c) && list.some((name) => c.includes(name));
}

export function resolveReportLanguage(country, city) {
  const c = String(country || "").trim().toLowerCase();

  if (c === "belgium") {
    return matches(city, BELGIUM_FLEMISH_CITIES) ? { code: "nl", label: "Nederlands" } : { code: "fr", label: "Français" };
  }
  if (c === "switzerland") {
    if (matches(city, SWISS_ITALIAN_CITIES)) return { code: "it", label: "Italiano" };
    if (matches(city, SWISS_FRENCH_CITIES)) return { code: "fr", label: "Français" };
    return { code: "de", label: "Deutsch" };
  }

  return COUNTRY_LANGUAGE[c] || { code: "en", label: "English" };
}
