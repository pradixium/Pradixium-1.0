/* PRADIXIUM™ — Japan: MLIT Real Estate Price Index (residential), latest
 * month of the original series (lib/data/japanPrices.json ← scripts/
 * build-jp.py): the narrowest area MLIT publishes for the place — Tokyo /
 * Aichi / Osaka prefecture, the Tokyo or Osaka metro area, else the region
 * — and the home's type (condominium / detached house).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

let doc;
function load() {
  if (doc === undefined) {
    try { doc = JSON.parse(readFileSync(path.join(process.cwd(), "lib", "data", "japanPrices.json"), "utf8")); } catch { doc = null; }
  }
  return doc;
}
const TOKYO_WARDS = ["chiyoda", "chuo", "minato", "shinjuku", "bunkyo", "taito", "sumida", "koto", "shinagawa", "meguro", "ota", "setagaya", "shibuya", "nakano", "suginami", "toshima", "kita", "arakawa", "itabashi", "nerima", "adachi", "katsushika", "edogawa", "roppongi", "ginza", "akasaka", "azabu", "ebisu", "daikanyama", "aoyama", "harajuku", "ikebukuro", "odaiba", "kichijoji", "hachioji", "tachikawa", "machida", "musashino", "mitaka"];
// [MLIT sheet name, English label, place words]
const AREAS = [
  ["東京都Tokyo", "Tokyo prefecture", ["tokyo"], TOKYO_WARDS],
  ["大阪府Osaka", "Osaka prefecture", ["osaka", "umeda", "namba", "sakai", "toyonaka", "suita"]],
  ["愛知県Aichi", "Aichi prefecture", ["aichi", "nagoya", "toyota", "okazaki"]],
  ["南関東圏Tokyo including", "Greater Tokyo (Tokyo, Kanagawa, Saitama, Chiba)", ["kanagawa", "yokohama", "kawasaki", "kamakura", "saitama", "chiba", "funabashi", "urayasu"]],
  ["京阪神圏Osaka including", "Keihanshin (Kyoto, Osaka, Hyogo)", ["kyoto", "kobe", "hyogo", "nishinomiya", "himeji"]],
  ["北海道地方Hokkaido", "Hokkaido region", ["hokkaido", "sapporo", "niseko", "hakodate", "otaru", "furano", "asahikawa", "kutchan"]],
  ["東北地方Tohoku", "Tohoku region", ["tohoku", "sendai", "miyagi", "aomori", "iwate", "akita", "yamagata", "fukushima"]],
  ["関東地方Kanto", "Kanto region", ["kanto", "ibaraki", "tochigi", "gunma", "karuizawa", "nikko", "tsukuba"]],
  ["北陸地方Hokuriku", "Hokuriku region", ["hokuriku", "niigata", "toyama", "ishikawa", "kanazawa", "fukui"]],
  ["中部地方Chubu", "Chubu region", ["chubu", "shizuoka", "hamamatsu", "nagano", "hakuba", "yamanashi", "gifu", "mie"]],
  ["近畿地方Kinki", "Kinki region", ["kinki", "kansai", "nara", "shiga", "wakayama"]],
  ["中国地方Chugoku", "Chugoku region", ["chugoku", "hiroshima", "okayama", "yamaguchi", "tottori", "shimane"]],
  ["四国地方Shikoku", "Shikoku region", ["shikoku", "matsuyama", "takamatsu", "kochi", "tokushima", "ehime", "kagawa"]],
  ["九州・沖縄地方Kyushu-Okinawa", "Kyushu-Okinawa region", ["kyushu", "okinawa", "naha", "fukuoka", "hakata", "kitakyushu", "kumamoto", "kagoshima", "nagasaki", "oita", "beppu", "miyazaki", "saga", "ishigaki", "miyakojima"]]
];

export function japanTrend({ text, propertyType } = {}) {
  const d = load();
  if (!d) return null;
  const w = new Set(String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z]+/).filter(Boolean));
  // a prefecture / city name wins over a ward name (Kita, Minato, Chuo
  // are wards of Osaka and Nagoya too)
  const hit = AREAS.find(([, , words]) => words.some((x) => w.has(x))) || AREAS.find(([, , , wards]) => (wards || []).some((x) => w.has(x)));
  const house = /house|villa|detached|chalet/i.test(String(propertyType || "")) && !/apart|flat|condo/i.test(String(propertyType || ""));
  const type = house ? "detached" : "condo";
  const key = hit ? hit[0] : "全国Japan";
  const a = d.areas[key] || {};
  const nat = d.areas["全国Japan"] || {};
  return {
    period: d.period, area: hit ? hit[1] : "Japan (national)", national: !hit, type, typeLabel: house ? "detached houses" : "condominiums",
    change: a[type]?.yoyPercent ?? null, sample: a[type]?.sample ?? null, nationalChange: nat[type]?.yoyPercent ?? null,
    allChange: a.all?.yoyPercent ?? null, source: d.source, sourceUrl: d.sourceUrl
  };
}
