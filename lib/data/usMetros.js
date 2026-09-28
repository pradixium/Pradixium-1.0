/* PRADIXIUM™ — Top 50 U.S. Metro Areas (county → FHFA metro price index)
 * The 50 largest U.S. Metropolitan Statistical Areas by population, and
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
 * Every series was matched by its FHFA code in the quarterly file
 * (hpi_at_metro.csv) and its 2026Q2 one-year change checked against the
 * JSON used at runtime (74 series, 420 counties, 0 mismatches). One label
 * differs: OMB 2023 names the division "Lake County, IL"; FHFA still
 * labels that same series "Lake County-Kenosha County, IL (MSAD)".
 *
 * County keys are 5-digit state+county FIPS codes. Delineations change
 * roughly once a decade; population ranks shift yearly — re-generate from
 * the same files, don't hand-edit.
 */
export const US_TOP_METROS = [
  { rank: 1, cbsa: "35620", title: "New York-Newark-Jersey City, NY-NJ", population2024: 19940274,
    fhfaByCounty: {
      "Lakewood-New Brunswick, NJ (MSAD)": ["34023", "34025", "34029", "34035"],
      "Nassau County-Suffolk County, NY  (MSAD)": ["36059", "36103"],
      "Newark, NJ (MSAD)": ["34013", "34019", "34027", "34037", "34039"],
      "New York-Jersey City-White Plains, NY-NJ  (MSAD)": ["34003", "34017", "34031", "36005", "36047", "36061", "36079", "36081", "36085", "36087", "36119"]
    } },
  { rank: 2, cbsa: "31080", title: "Los Angeles-Long Beach-Anaheim, CA", population2024: 12927614,
    fhfaByCounty: {
      "Anaheim-Santa Ana-Irvine, CA  (MSAD)": ["06059"],
      "Los Angeles-Long Beach-Glendale, CA  (MSAD)": ["06037"]
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
      "Arlington-Alexandria-Reston, VA-WV (MSAD)": ["51013", "51043", "51047", "51059", "51061", "51107", "51153", "51157", "51177", "51179", "51187", "51510", "51600", "51610", "51630", "51683", "51685", "54037"],
      "Frederick-Gaithersburg-Bethesda, MD (MSAD)": ["24021", "24031"],
      "Washington, DC-MD (MSAD)": ["11001", "24017", "24033"]
    } },
  { rank: 8, cbsa: "12060", title: "Atlanta-Sandy Springs-Roswell, GA", population2024: 6411149,
    fhfaByCounty: {
      "Atlanta-Sandy Springs-Roswell, GA (MSAD)": ["13013", "13035", "13045", "13063", "13077", "13085", "13089", "13097", "13113", "13117", "13121", "13135", "13149", "13151", "13159", "13187", "13199", "13211", "13217", "13227", "13231", "13247", "13255", "13297"],
      "Marietta, GA (MSAD)": ["13015", "13057", "13067", "13143", "13223"]
    } },
  { rank: 9, cbsa: "37980", title: "Philadelphia-Camden-Wilmington, PA-NJ-DE-MD", population2024: 6330422,
    fhfaByCounty: {
      "Camden, NJ  (MSAD)": ["34005", "34007", "34015"],
      "Montgomery County-Bucks County-Chester County, PA  (MSAD)": ["42017", "42029", "42091"],
      "Philadelphia, PA  (MSAD)": ["42045", "42101"],
      "Wilmington, DE-MD-NJ  (MSAD)": ["10003", "24015", "34033"]
    } },
  { rank: 10, cbsa: "38060", title: "Phoenix-Mesa-Chandler, AZ", population2024: 5186958,
    fhfaByCounty: {
      "Phoenix-Mesa-Chandler, AZ": ["04013", "04021"]
    } },
  { rank: 11, cbsa: "14460", title: "Boston-Cambridge-Newton, MA-NH", population2024: 5025517,
    fhfaByCounty: {
      "Boston, MA  (MSAD)": ["25021", "25023", "25025"],
      "Cambridge-Newton-Framingham, MA  (MSAD)": ["25009", "25017"],
      "Rockingham County-Strafford County, NH  (MSAD)": ["33015", "33017"]
    } },
  { rank: 12, cbsa: "40140", title: "Riverside-San Bernardino-Ontario, CA", population2024: 4744214,
    fhfaByCounty: {
      "Riverside-San Bernardino-Ontario, CA": ["06065", "06071"]
    } },
  { rank: 13, cbsa: "41860", title: "San Francisco-Oakland-Fremont, CA", population2024: 4648486,
    fhfaByCounty: {
      "Oakland-Fremont-Berkeley, CA (MSAD)": ["06001", "06013"],
      "San Francisco-San Mateo-Redwood City, CA  (MSAD)": ["06075", "06081"],
      "San Rafael, CA  (MSAD)": ["06041"]
    } },
  { rank: 14, cbsa: "19820", title: "Detroit-Warren-Dearborn, MI", population2024: 4400578,
    fhfaByCounty: {
      "Detroit-Dearborn-Livonia, MI  (MSAD)": ["26163"],
      "Warren-Troy-Farmington Hills, MI  (MSAD)": ["26087", "26093", "26099", "26125", "26147"]
    } },
  { rank: 15, cbsa: "42660", title: "Seattle-Tacoma-Bellevue, WA", population2024: 4145494,
    fhfaByCounty: {
      "Everett, WA (MSAD)": ["53061"],
      "Seattle-Bellevue-Kent, WA  (MSAD)": ["53033"],
      "Tacoma-Lakewood, WA  (MSAD)": ["53053"]
    } },
  { rank: 16, cbsa: "33460", title: "Minneapolis-St. Paul-Bloomington, MN-WI", population2024: 3757952,
    fhfaByCounty: {
      "Minneapolis-St. Paul-Bloomington, MN-WI": ["27003", "27019", "27025", "27037", "27053", "27059", "27079", "27095", "27123", "27139", "27141", "27163", "27171", "55093", "55109"]
    } },
  { rank: 17, cbsa: "45300", title: "Tampa-St. Petersburg-Clearwater, FL", population2024: 3424560,
    fhfaByCounty: {
      "St. Petersburg-Clearwater-Largo, FL (MSAD)": ["12103"],
      "Tampa, FL (MSAD)": ["12053", "12057", "12101"]
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
    } },
  { rank: 21, cbsa: "16740", title: "Charlotte-Concord-Gastonia, NC-SC", population2024: 2883370,
    fhfaByCounty: {
      "Charlotte-Concord-Gastonia, NC-SC": ["37007", "37025", "37071", "37097", "37109", "37119", "37159", "37179", "45023", "45057", "45091"]
    } },
  { rank: 22, cbsa: "12580", title: "Baltimore-Columbia-Towson, MD", population2024: 2859024,
    fhfaByCounty: {
      "Baltimore-Columbia-Towson, MD": ["24003", "24005", "24013", "24025", "24027", "24035", "24510"]
    } },
  { rank: 23, cbsa: "41180", title: "St. Louis, MO-IL", population2024: 2811927,
    fhfaByCounty: {
      "St. Louis, MO-IL": ["17005", "17013", "17027", "17083", "17117", "17119", "17133", "17163", "29071", "29099", "29113", "29183", "29189", "29219", "29510"]
    } },
  { rank: 24, cbsa: "41700", title: "San Antonio-New Braunfels, TX", population2024: 2763006,
    fhfaByCounty: {
      "San Antonio-New Braunfels, TX": ["48013", "48019", "48029", "48091", "48187", "48259", "48325", "48493"]
    } },
  { rank: 25, cbsa: "12420", title: "Austin-Round Rock-San Marcos, TX", population2024: 2550637,
    fhfaByCounty: {
      "Austin-Round Rock-San Marcos, TX": ["48021", "48055", "48209", "48453", "48491"]
    } },
  { rank: 26, cbsa: "38900", title: "Portland-Vancouver-Hillsboro, OR-WA", population2024: 2537904,
    fhfaByCounty: {
      "Portland-Vancouver-Hillsboro, OR-WA": ["41005", "41009", "41051", "41067", "41071", "53011", "53059"]
    } },
  { rank: 27, cbsa: "40900", title: "Sacramento-Roseville-Folsom, CA", population2024: 2463127,
    fhfaByCounty: {
      "Sacramento-Roseville-Folsom, CA": ["06017", "06061", "06067", "06113"]
    } },
  { rank: 28, cbsa: "38300", title: "Pittsburgh, PA", population2024: 2429917,
    fhfaByCounty: {
      "Pittsburgh, PA": ["42003", "42005", "42007", "42019", "42051", "42073", "42125", "42129"]
    } },
  { rank: 29, cbsa: "29820", title: "Las Vegas-Henderson-North Las Vegas, NV", population2024: 2398871,
    fhfaByCounty: {
      "Las Vegas-Henderson-North Las Vegas, NV": ["32003"]
    } },
  { rank: 30, cbsa: "17140", title: "Cincinnati, OH-KY-IN", population2024: 2302815,
    fhfaByCounty: {
      "Cincinnati, OH-KY-IN": ["18029", "18047", "18115", "21015", "21023", "21037", "21077", "21081", "21117", "21191", "39015", "39017", "39025", "39061", "39165"]
    } },
  { rank: 31, cbsa: "28140", title: "Kansas City, MO-KS", population2024: 2253579,
    fhfaByCounty: {
      "Kansas City, MO-KS": ["20091", "20103", "20107", "20121", "20209", "29013", "29025", "29037", "29047", "29049", "29095", "29107", "29165", "29177"]
    } },
  { rank: 32, cbsa: "18140", title: "Columbus, OH", population2024: 2225377,
    fhfaByCounty: {
      "Columbus, OH": ["39041", "39045", "39049", "39073", "39089", "39097", "39117", "39127", "39129", "39159"]
    } },
  { rank: 33, cbsa: "26900", title: "Indianapolis-Carmel-Greenwood, IN", population2024: 2174833,
    fhfaByCounty: {
      "Indianapolis-Carmel-Greenwood, IN": ["18011", "18013", "18057", "18059", "18063", "18081", "18095", "18097", "18109", "18145", "18159"]
    } },
  { rank: 34, cbsa: "17410", title: "Cleveland, OH", population2024: 2171877,
    fhfaByCounty: {
      "Cleveland, OH": ["39007", "39035", "39055", "39085", "39093", "39103"]
    } },
  { rank: 35, cbsa: "34980", title: "Nashville-Davidson--Murfreesboro--Franklin, TN", population2024: 2150553,
    fhfaByCounty: {
      "Nashville-Davidson--Murfreesboro--Franklin, TN": ["47015", "47021", "47037", "47043", "47081", "47111", "47119", "47147", "47149", "47159", "47165", "47169", "47187", "47189"]
    } },
  { rank: 36, cbsa: "41940", title: "San Jose-Sunnyvale-Santa Clara, CA", population2024: 1995484,
    fhfaByCounty: {
      "San Jose-Sunnyvale-Santa Clara, CA": ["06069", "06085"]
    } },
  { rank: 37, cbsa: "47260", title: "Virginia Beach-Chesapeake-Norfolk, VA-NC", population2024: 1794278,
    fhfaByCounty: {
      "Virginia Beach-Chesapeake-Norfolk, VA-NC": ["37029", "37053", "37073", "51073", "51093", "51095", "51115", "51181", "51199", "51550", "51650", "51700", "51710", "51735", "51740", "51800", "51810", "51830"]
    } },
  { rank: 38, cbsa: "27260", title: "Jacksonville, FL", population2024: 1760548,
    fhfaByCounty: {
      "Jacksonville, FL": ["12003", "12019", "12031", "12089", "12109"]
    } },
  { rank: 39, cbsa: "39300", title: "Providence-Warwick, RI-MA", population2024: 1700901,
    fhfaByCounty: {
      "Providence-Warwick, RI-MA": ["25005", "44001", "44003", "44005", "44007", "44009"]
    } },
  { rank: 40, cbsa: "33340", title: "Milwaukee-Waukesha, WI", population2024: 1574452,
    fhfaByCounty: {
      "Milwaukee-Waukesha, WI": ["55079", "55089", "55131", "55133"]
    } },
  { rank: 41, cbsa: "39580", title: "Raleigh-Cary, NC", population2024: 1562009,
    fhfaByCounty: {
      "Raleigh-Cary, NC": ["37069", "37101", "37183"]
    } },
  { rank: 42, cbsa: "36420", title: "Oklahoma City, OK", population2024: 1497821,
    fhfaByCounty: {
      "Oklahoma City, OK": ["40017", "40027", "40051", "40081", "40083", "40087", "40109"]
    } },
  { rank: 43, cbsa: "31140", title: "Louisville/Jefferson County, KY-IN", population2024: 1394234,
    fhfaByCounty: {
      "Louisville/Jefferson County, KY-IN": ["18019", "18043", "18061", "18175", "21029", "21103", "21111", "21163", "21179", "21185", "21211", "21215"]
    } },
  { rank: 44, cbsa: "40060", title: "Richmond, VA", population2024: 1370165,
    fhfaByCounty: {
      "Richmond, VA": ["51007", "51036", "51041", "51053", "51075", "51085", "51087", "51097", "51101", "51127", "51145", "51149", "51183", "51570", "51670", "51730", "51760"]
    } },
  { rank: 45, cbsa: "32820", title: "Memphis, TN-MS-AR", population2024: 1339345,
    fhfaByCounty: {
      "Memphis, TN-MS-AR": ["05035", "28009", "28033", "28093", "28137", "28143", "47047", "47157", "47167"]
    } },
  { rank: 46, cbsa: "41620", title: "Salt Lake City-Murray, UT", population2024: 1300762,
    fhfaByCounty: {
      "Salt Lake City-Murray, UT": ["49035", "49045"]
    } },
  { rank: 47, cbsa: "13820", title: "Birmingham, AL", population2024: 1192583,
    fhfaByCounty: {
      "Birmingham, AL": ["01007", "01009", "01021", "01073", "01115", "01117", "01127"]
    } },
  { rank: 48, cbsa: "23420", title: "Fresno, CA", population2024: 1189557,
    fhfaByCounty: {
      "Fresno, CA": ["06019", "06039"]
    } },
  { rank: 49, cbsa: "24340", title: "Grand Rapids-Wyoming-Kentwood, MI", population2024: 1178826,
    fhfaByCounty: {
      "Grand Rapids-Wyoming-Kentwood, MI": ["26015", "26067", "26081", "26117", "26139"]
    } },
  { rank: 50, cbsa: "25540", title: "Hartford-West Hartford-East Hartford, CT", population2024: 1169048,
    fhfaByCounty: {
      "Hartford-West Hartford-East Hartford, CT": ["09110", "09130"]
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
