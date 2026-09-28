/* PRADIXIUM™ — Colorado statewide fallback: "Colorado Public Parcels"
 * composite (Governor's Office of Information Technology, GIS team),
 * assembled from each county assessor's annual parcel delivery. Shown: the
 * county's total appraised (actual) value as delivered, with the date the
 * State received the county's file — Government Value, display only.
 * Colorado assessors value homes at market level as of a statutory
 * appraisal date (reappraisal every two years). Checked Sept 2026: El Paso,
 * Larimer, Grand, Gunnison, Clear Creek, Morgan and others deliver no values
 * (or, like Pueblo, no site addresses) → nothing is shown there.
 * Not shown: sale prices (no validity code), owner names (never requested).
 * Matching: parcels within 1 km of the geocoded point whose site address
 * number + street match (some counties give no ZIP, or "UNINCORPORATED").
 * Denver and the Denver-metro county modules run first.
 */
import { arcQueryNear, splitStreet, structuredEvidence } from "./_structured.js";

const URL = "https://gis.colorado.gov/public/rest/services/Address_and_Parcel/Colorado_Public_Parcels/FeatureServer/0";

const CONFIG = {
  name: "County Assessor (Colorado Public Parcels)", source: "Colorado Public Parcels — county assessor data compiled by the Governor's Office of Information Technology",
  sourceUrl: "https://geodata.colorado.gov/",
  valueLabel: "appraised (actual) value", idLabel: "parcel",
  note: "Colorado assessors value homes at market level as of the statutory appraisal date; sale prices in this file carry no validity code and are not shown.",
  spatial: true,
  find: ({ num, name, h, geo }) => arcQueryNear(h, URL, `situsAdd LIKE '${num} %'`,
    "countyName,parcel_id,situsAdd,sitAddCty,sitAddZip,apprValTot,landUseDsc,dateReceived", geo, 1000, 7000)
    .then((rs) => {
      const seen = new Set();
      return rs.map((r) => {
        let a = h.s(r.situsAdd).toUpperCase().replace(/\s+/g, " ").trim();
        const town = h.s(r.sitAddCty).toUpperCase();
        if (town && a.endsWith(" " + town)) a = a.slice(0, -town.length - 1);
        const m = a.match(/^(\d+)\s+(.+?)(?:\s+(?:UNIT|APT|STE|#)\s*(\S+))?$/);
        const st = m ? splitStreet(m[2]) : null;
        if (!st || m[1] !== num || st.name !== name || seen.has(r.parcel_id)) return null;
        seen.add(r.parcel_id);
        const v = Number(r.apprValTot);
        return { id: r.parcel_id, zip: h.s(r.sitAddZip), town, dir: st.dir, type: st.type, post: st.post, unit: m[3] || "", value: v > 1000 ? v : null,
          use: h.s(r.landUseDsc), areaText: r.dateReceived ? `${h.s(r.countyName)} County file received by the State ${h.s(r.dateReceived)}` : "" };
      }).filter(Boolean);
    })
};

export function matches(geo) {
  return geo?.stateCode === "CO";
}

export function evidence(ctx) {
  return structuredEvidence(CONFIG, ctx);
}
