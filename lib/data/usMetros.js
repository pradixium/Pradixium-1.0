/* PRADIXIUM™ — Top 20 U.S. Metro Areas (county → FHFA metro price index)
 * The 20 largest U.S. Metropolitan Statistical Areas by population, and
 * which FHFA House Price Index series covers each of their counties.
 *
 * Why by county: FHFA publishes its metro HPI per MSA — or, for the
 * largest metros, per Metropolitan Division (MSAD) — and both are defined
 * by OMB as sets of whole counties. The Census geocoder already returns
 * the property's county, so a county lookup gives the exact official
 * series. Matching on the typed city name did not: FHFA names metros like
 * "Miami-Miami Beach-Kendall, FL (MSAD)", so a plain "Miami" (or any
 * suburb — Brooklyn, Santa Monica, Plano) silently fell back to the
 * state-wide index.
 *
 * Sources (all official, generated from the files — not typed by hand):
 *  - Ranking: U.S. Census Bureau, Vintage 2024 CBSA population estimates
 *    https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/metro/totals/cbsa-est2024-alldata.csv
 *  - Counties per MSA / Metropolitan Division: OMB Bulletin 23-01
 *    delineation file (July 2023)
 *    https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx
 *  - Series names: FHFA HPI metro list (https://www.fhfa.gov/hpi-city/json)
 *
 * One label exception: OMB 2023 names the division "Lake County, IL";
 * FHFA still labels that same series "Lake County-Kenosha County, IL
 * (MSAD)" (Kenosha is now listed by FHFA as its own metro).
 *
 * County keys are 5-digit state+county FIPS codes. Delineations change
 * roughly once a decade; population ranks shift yearly — re-generate from
 * the same files, don't hand-edit.
 */
export const US_TOP_METROS = [
  { rank: 1, cbsa: "35620", title: "New York-Newark-Jersey City, NY-NJ", population2024: 19940274,
    fhfaByCounty: {
      "New York-Jersey City-White Plains, NY-NJ  (MSAD)": ["34003", "34017", "34031", "36005", "36047", "36061", "36079", "36081", "36085", "36087", "36119"],
      "Newark, NJ (MSAD)": ["34013", "34019", "34027", "34037", "34039"],
      "Lakewood-New Brunswick, NJ (MSAD)": ["34023", "34025", "34029", "34035"],
      "Nassau County-Suffolk County, NY  (MSAD)": ["36059", "36103"]
    } },
  { rank: 2, cbsa: "31080", title: "Los Angeles-Long Beach-Anaheim, CA", population2024: 12927614,
    fhfaByCounty: {
      "Los Angeles-Long Beach-Glendale, CA  (MSAD)": ["06037"],
      "Anaheim-Santa Ana-Irvine, CA  (MSAD)": ["06059"]
    } },
  { rank: 3, cbsa: "16980", title: "Chicago-Naperville-Elgin, IL-IN", population2024: 9408576,
    fhfaByCounty: {
      "Chicago-Naperville-Schaumburg, IL (MSAD)": ["17031", "17043", "17063", "17111", "17197"],
      "Elgin, IL  (MSAD)": ["17037", "17089", "17093"],
      "Lake County-Kenosha County, IL (MSAD)": ["17097"],
      "Lake County-Porter County-Jasper County, IN (MSAD)": ["18073", "18089", "18111", "18127"]
    } },
  { rank: 4, cbsa: "19100", title: "Dallas-Fort Worth-Arlington, TX", population2024: 8344032,
    fhfaByCounty: {
      "Dallas-Plano-Irving, TX  (MSAD)": ["48085", "48113", "48121", "48139", "48231", "48257", "48397"],
      "Fort Worth-Arlington-Grapevine, TX  (MSAD)": ["48251", "48367", "48439", "48497"]
    } },
  { rank: 5, cbsa: "26420", title: "Houston-Pasadena-The Woodlands, TX", population2024: 7796182,
    fhfaByCounty: {
      "Houston-Pasadena-The Woodlands, TX": ["48015", "48039", "48071", "48157", "48167", "48201", "48291", "48339", "48407", "48473"]
    } },
  { rank: 6, cbsa: "33100", title: "Miami-Fort Lauderdale-West Palm Beach, FL", population2024: 6457988,
    fhfaByCounty: {
      "Fort Lauderdale-Pompano Beach-Sunrise, FL  (MSAD)": ["12011"],
      "Miami-Miami Beach-Kendall, FL  (MSAD)": ["12086"],
      "West Palm Beach-Boca Raton-Delray Beach, FL (MSAD)": ["12099"]
    } },
  { rank: 7, cbsa: "47900", title: "Washington-Arlington-Alexandria, DC-VA-MD-WV", population2024: 6436489,
    fhfaByCounty: {
      "Washington, DC-MD (MSAD)": ["11001", "24017", "24033"],
      "Frederick-Gaithersburg-Bethesda, MD (MSAD)": ["24021", "24031"],
      "Arlington-Alexandria-Reston, VA-WV (MSAD)": ["51013", "51043", "51047", "51059", "51061", "51107", "51153", "51157", "51177", "51179", "51187", "51510", "51600", "51610", "51630", "51683", "51685", "54037"]
    } },
  { rank: 8, cbsa: "12060", title: "Atlanta-Sandy Springs-Roswell, GA", population2024: 6411149,
    fhfaByCounty: {
      "Atlanta-Sandy Springs-Roswell, GA (MSAD)": ["13013", "13035", "13045", "13063", "13077", "13085", "13089", "13097", "13113", "13117", "13121", "13135", "13149", "13151", "13159", "13187", "13199", "13211", "13217", "13227", "13231", "13247", "13255", "13297"],
      "Marietta, GA (MSAD)": ["13015", "13057", "13067", "13143", "13223"]
    } },
  { rank: 9, cbsa: "37980", title: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD", population2024: 6330422,
    fhfaByCounty: {
      "Wilmington, DE-MD-NJ  (MSAD)": ["10003", "24015", "34033"],
      "Camden, NJ  (MSAD)": ["34005", "34007", "34015"],
      "Montgomery County-Bucks County-Chester County, PA  (MSAD)": ["42017", "42029", "42091"],
      "Philadelphia, PA  (MSAD)": ["42045", "42101"]
    } },
  { rank: 10, cbsa: "38060", title: "Phoenix-Mesa-Chandler, AZ", population2024: 5186958,
    fhfaByCounty: {
      "Phoenix-Mesa-Chandler, AZ": ["04013", "04021"]
    } },
  { rank: 11, cbsa: "14460", title: "Boston-Cambridge-Newton, MA-NH", population2024: 5025517,
    fhfaByCounty: {
      "Cambridge-Newton-Framingham, MA  (MSAD)": ["25009", "25017"],
      "Boston, MA  (MSAD)": ["25021", "25023", "25025"],
      "Rockingham County-Strafford County, NH  (MSAD)": ["33015", "33017"]
    } },
  { rank: 12, cbsa: "40140", title: "Riverside-San Bernardino-Ontario, CA", population2024: 4744214,
    fhfaByCounty: {
      "Riverside-San Bernardino-Ontario, CA": ["06065", "06071"]
    } },
  { rank: 13, cbsa: "41860", title: "San Francisco-Oakland-Fremont, CA", population2024: 4648486,
    fhfaByCounty: {
      "Oakland-Fremont-Berkeley, CA (MSAD)": ["06001", "06013"],
      "San Rafael, CA  (MSAD)": ["06041"],
      "San Francisco-San Mateo-Redwood City, CA  (MSAD)": ["06075", "06081"]
    } },
  { rank: 14, cbsa: "19820", title: "Detroit-Warren-Dearborn, MI", population2024: 4400578,
    fhfaByCounty: {
      "Warren-Troy-Farmington Hills, MI  (MSAD)": ["26087", "26093", "26099", "26125", "26147"],
      "Detroit-Dearborn-Livonia, MI  (MSAD)": ["26163"]
    } },
  { rank: 15, cbsa: "42660", title: "Seattle-Tacoma-Bellevue, WA", population2024: 4145494,
    fhfaByCounty: {
      "Seattle-Bellevue-Kent, WA  (MSAD)": ["53033"],
      "Tacoma-Lakewood, WA  (MSAD)": ["53053"],
      "Everett, WA (MSAD)": ["53061"]
    } },
  { rank: 16, cbsa: "33460", title: "Minneapolis-St. Paul-Bloomington, MN-WI", population2024: 3757952,
    fhfaByCounty: {
      "Minneapolis-St. Paul-Bloomington, MN-WI": ["27003", "27019", "27025", "27037", "27053", "27059", "27079", "27095", "27123", "27139", "27141", "27163", "27171", "55093", "55109"]
    } },
  { rank: 17, cbsa: "45300", title: "Tampa-St. Petersburg-Clearwater, FL", population2024: 3424560,
    fhfaByCounty: {
      "Tampa, FL (MSAD)": ["12053", "12057", "12101"],
      "St. Petersburg-Clearwater-Largo, FL (MSAD)": ["12103"]
    } },
  { rank: 18, cbsa: "41740", title: "San Diego-Chula Vista-Carlsbad, CA", population2024: 3298799,
    fhfaByCounty: {
      "San Diego-Chula Vista-Carlsbad, CA": ["06073"]
    } },
  { rank: 19, cbsa: "19740", title: "Denver-Aurora-Centennial, CO", population2024: 3052498,
    fhfaByCounty: {
      "Denver-Aurora-Centennial, CO": ["08001", "08005", "08014", "08019", "08031", "08035", "08039", "08047", "08059", "08093"]
    } },
  { rank: 20, cbsa: "36740", title: "Orlando-Kissimmee-Sanford, FL", population2024: 2940513,
    fhfaByCounty: {
      "Orlando-Kissimmee-Sanford, FL": ["12069", "12095", "12097", "12117"]
    } }
];

const BY_COUNTY = {};
for (const metro of US_TOP_METROS) {
  for (const [fhfaName, counties] of Object.entries(metro.fhfaByCounty)) {
    for (const fips of counties) BY_COUNTY[fips] = { metro, fhfaName };
  }
}

export function findUsMetroByCounty(countyFips) {
  const key = String(countyFips || "").trim();
  const hit = BY_COUNTY[key];
  if (!hit) return null;
  return { rank: hit.metro.rank, cbsa: hit.metro.cbsa, title: hit.metro.title, fhfaName: hit.fhfaName };
}
