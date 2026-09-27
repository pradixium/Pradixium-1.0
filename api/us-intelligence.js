/* PRADIXIUM™ — U.S. NATIONAL INTELLIGENCE ENGINE */
import { findUsMetroByCounty } from '../lib/data/usMetros.js';
import { getNjMuniSales, NJ_SALES_META } from '../lib/data/njResidentialSales.js';
const s=v=>String(v??'').trim(),enc=v=>encodeURIComponent(s(v));
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const STATE_CODES=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v,k]));
async function json(url,timeoutMs=5000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer);}}
function first(g,n){const a=g?.[n];return Array.isArray(a)&&a.length?a[0]:null;}
function field(g,n,keys){const r=first(g,n);for(const k of keys)if(r?.[k]!==undefined&&r?.[k]!==null&&r?.[k]!=='')return r[k];return null;}
async function geocode(address,city,state,zip){if(!address&&!city)return null;const line=[address,city,state,zip].filter(Boolean).join(', ');const u='https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address='+enc(line)+'&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json';const j=await json(u);const m=j?.result?.addressMatches?.[0];if(!m)return null;const g=m.geographies||{};const stateName=field(g,'States',['NAME'])||state||null;const stateFips=field(g,'States',['STATE','GEOID'])||null;const county=field(g,'Counties',['NAME']);const countyFips=field(g,'Counties',['GEOID']);const tract=field(g,'Census Tracts',['NAME','BASENAME']);const place=field(g,'Incorporated Places',['NAME'])||field(g,'Census Designated Places',['NAME'])||city||null;const zcta=field(g,'2020 Census ZIP Code Tabulation Areas',['NAME'])||zip||null;return {matchedAddress:m.matchedAddress||line,longitude:m.coordinates?.x??null,latitude:m.coordinates?.y??null,state:stateName,stateCode:STATE_CODES[stateName]||stateFips||state||null,stateFips:stateFips?String(stateFips).slice(-2):null,county,countyFips:countyFips?String(countyFips):null,city:place,zip:zcta,tract};}
async function hpiState(state){if(!state)return null;const a=await json('https://www.fhfa.gov/hpi-state/json').catch(()=>null);return Array.isArray(a)?a.find(x=>s(x.name).toLowerCase()===s(state).toLowerCase())||null:null;}
// FHFA's JSON rows carry no date, so the release quarter is read from
// FHFA's own HPI page (its latest "house-price-index-report-YYYYqN" link).
// If that can't be read, period stays null — never guessed.
async function hpiPeriod(){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),5000);try{const r=await fetch('https://www.fhfa.gov/data/hpi',{cache:'no-store',signal:controller.signal});if(!r.ok)return null;const html=await r.text();const q=[...html.matchAll(/house-price-index-report-(\d{4})q([1-4])/gi)].map(m=>m[1]+'Q'+m[2]).sort();return q.length?q[q.length-1]:null;}catch{return null;}finally{clearTimeout(timer);}}
// Top-20 metros: exact FHFA series from the property's county (see
// lib/data/usMetros.js). Other metros fall back to the city-name match.
async function hpiCity(city,state,countyFips){const a=await json('https://www.fhfa.gov/hpi-city/json').catch(()=>null);if(!Array.isArray(a))return null;const metro=findUsMetroByCounty(countyFips);if(metro){const hit=a.find(x=>s(x.name)===metro.fhfaName);if(hit)return {...hit,topMetro:metro};}if(!city)return null;const c=s(city).toLowerCase(),code=STATE_CODES[s(state)]?.toLowerCase();return a.find(x=>{const n=s(x.name).toLowerCase();return n.startsWith(c+',')&&(!code||n.includes(', '+code));})||null;}
function hpi(r,level,period){if(!r)return null;const y=level==='state'?r.sa_1y:r.nsa_1y;return {source:'FHFA HPI',level,name:s(r.name).replace(/\s+/g,' ')||null,period:period||null,oneYear:Number.isFinite(Number(y))?Number(y):null,metroArea:r.topMetro?{rank:r.topMetro.rank,cbsa:r.topMetro.cbsa,title:r.topMetro.title}:null,sourceUrl:'https://www.fhfa.gov/data/hpi'};}
function nf(x){return s(x).toLowerCase().replace(/[^a-z0-9]+/g,'');}
const normGroups=a=>a.map(nf);
function choose(fields,rec,groups){for(const g of normGroups(groups))for(const f of Array.isArray(fields)?fields:[]){const a=nf(f.name),b=nf(f.alias);if(a===g||b===g||a.includes(g)||b.includes(g)){const n=Number(String(rec?.[f.name]??'').replace(/[$,]/g,''));if(Number.isFinite(n)&&n>0)return {value:n,field:f.name,alias:f.alias||f.name};}}return null;}
function textField(fields,rec,groups){for(const g of normGroups(groups))for(const f of Array.isArray(fields)?fields:[]){const a=nf(f.name),b=nf(f.alias);if(a===g||b===g||a.includes(g)||b.includes(g)){const v=rec?.[f.name];if(v!==undefined&&v!==null&&s(v))return {value:s(v),field:f.name,alias:f.alias||f.name};}}return null;}
// Known ultra-prime U.S. micro-locations. Same purpose as parisSignals()
// in api/france-intelligence.js: a whole-county/metro price average can
// make a genuinely prime address look like unexplained overpricing (this
// is exactly what happened testing a Surfside/Collins Avenue "Millionaire's
// Row" condo against Miami-Dade county figures) — this flags that context
// for the agent instead of leaving the gap unexplained.
const US_PRIME_ZONES=[
  {test:(t)=>/bal harbour|millionaire'?s? row/.test(t)||(/\bsurfside\b/.test(t)&&/collins av/.test(t))||/collins av\w*/.test(t)&&/\b(8[5-9]\d\d|9\d{3})\b/.test(t),zone:"Bal Harbour / Surfside — Millionaire's Row",tier:'ultra-prime'},
  {test:/beverly hills|bel[- ]?air|holmby hills/i,zone:'Beverly Hills / Bel Air',tier:'ultra-prime'},
  {test:/\bmalibu\b/i,zone:'Malibu',tier:'ultra-prime'},
  {test:/fisher island/i,zone:'Fisher Island',tier:'ultra-prime'},
  {test:/palm beach/i,zone:'Palm Beach',tier:'ultra-prime'},
  {test:/manhattan|park avenue|fifth avenue|central park west|tribeca|soho|upper east side|upper west side/i,zone:'Manhattan Prime',tier:'prime'},
  {test:/aspen|vail/i,zone:'Aspen / Vail',tier:'ultra-prime'},
  {test:/naples,? fl|scottsdale|newport beach/i,zone:'Naples FL / Scottsdale / Newport Beach',tier:'prime'},
  // Heritage/historic context — a different kind of value driver than a
  // pure wealth enclave (a Texas ranch or a French Quarter cottage isn't
  // "prime" by price/m² the way Beverly Hills is), but the same principle:
  // don't let a plain county-average benchmark make it look unexplained.
  {test:/french quarter|garden district|creole cottage|antebellum|national register of historic places/i,zone:'New Orleans Historic District',tier:'heritage'},
  {test:/historic district|historic downtown/i,zone:'Historic District',tier:'heritage'},
  {test:/hill country ranch|texas hill country|historic ranch|working ranch|ranch estate/i,zone:'Texas Ranch Estate',tier:'heritage'}
];
// This list can never be exhaustive for a country this size — it's meant
// to be extended incrementally as more markets come up, not a complete
// catalog of every prime or historic U.S. area.
function usPrestigeSignals(address,city,state){
  const text=`${address||''} ${city||''} ${state||''}`.toLowerCase();
  const match=US_PRIME_ZONES.find(z=>typeof z.test==='function'?z.test(text):z.test.test(text));
  return {isPrime:Boolean(match),zone:match?.zone||null,tier:match?.tier||'standard',methodology:'Known ultra-prime U.S. neighborhood/street match. Context only — not a substitute for a property-level appraisal.'};
}
function classify(v){const x=s(v).toLowerCase();if(!x)return null;if(/single.?family|detached|one.?family|residential single/.test(x))return 'Single-family';if(/town.?house|townhome/.test(x))return 'Townhouse';if(/condo|condominium/.test(x))return 'Condominium';if(/apartment|multi.?family|multifamily/.test(x))return 'Multi-family';if(/duplex/.test(x))return 'Duplex';if(/triplex/.test(x))return 'Triplex';if(/residential/.test(x))return 'Residential';return s(v);}
function escapeSql(v){return s(v).replace(/'/g,"''");}
function candidateScore(item,county,state){const x=(s(item.title)+' '+s(item.name)+' '+s(item.description)).toLowerCase();let n=0;if(x.includes(s(county).toLowerCase()))n+=8;if(x.includes('property appraiser'))n+=12;if(x.includes('assessor'))n+=10;if(x.includes('parcel'))n+=8;if(x.includes('property'))n+=5;if(x.includes(s(state).toLowerCase()))n+=3;return n;}
// Known, direct, authoritative statewide parcel sources — tried first and
// skip the fragile keyword-guessing search entirely when one exists for
// the resolved state. Florida's is FDOR's own statewide cadastral roll,
// aggregated yearly from all 67 county property appraisers (the real
// source county-level "property appraiser" keyword searches were only
// ever trying to rediscover one county at a time).
const KNOWN_STATEWIDE_PARCEL_SOURCES={
  FL:'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0'
};

async function tryParcelLayer(layerUrl,geo,address){
  const lm=await json(layerUrl+'?f=json').catch(()=>null);
  if(!lm?.fields)return null;
  const fields=lm.fields;
  const allNames=fields.map(f=>`${f.name} ${f.alias||''}`).join(' ');
  if(!/(address|situs|site|parcel|folio|property|sale|assess|value|bedroom|bathroom|building|living|usecode|dor_desc|landuse)/i.test(allNames))return null;
  const base=layerUrl+'/query?f=json&where=1%3D1&geometry='+enc(`${geo.longitude},${geo.latitude}`)+'&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&returnZ=false&returnM=false';
  let qj=await json(base).catch(()=>null);
  let rec=qj?.features?.[0]?.attributes||null;
  if(!rec){
    const af=fields.find(f=>/(site.*addr|siteaddress|propertyaddress|situs|true_site_addr|address)/i.test(`${f.name} ${f.alias||''}`));
    if(af&&address){
      const where=`UPPER(${af.name}) LIKE '%${escapeSql(s(address).toUpperCase().replace(/\s+/g,' '))}%'`;
      const exact=layerUrl+'/query?f=json&where='+enc(where)+'&outFields=*&returnGeometry=false&resultRecordCount=5';
      const ej=await json(exact).catch(()=>null);
      rec=ej?.features?.[0]?.attributes||null;
    }
  }
  if(!rec)return null;
  const fair=choose(fields,rec,['marketvalue','marketval','justvalue','justval','appraisedvalue','appraisedval','fairmarketvalue','fairvalue','rmvtotal','rmv']);
  const assessed=choose(fields,rec,['assessedvalue','assessedval','taxablevalue','taxvalue','assessedvalcur']);
  const sale=choose(fields,rec,['saleprice','price1','lastsaleprice','salesprice','priceofsale','saleamount','saleamt','consideration']);
  const sqft=choose(fields,rec,['livingareasf','buildingheatedarea','buildingactualarea','livingarea','grosslivingarea','buildingsf','totalarea']);
  const beds=choose(fields,rec,['bedroomcount','bedrooms','bedroom']);
  const baths=choose(fields,rec,['bathroomcount','bathrooms','bathroom']);
  const sd=fields.find(f=>/(sale.*date|date.*sale|dateofsale|dos1|lastsaledate)/i.test(`${f.name} ${f.alias||''}`));
  const af=fields.find(f=>/(site.*addr|siteaddress|propertyaddress|situs|true_site_addr|address)/i.test(`${f.name} ${f.alias||''}`));
  const tf=textField(fields,rec,['propertytype','propertytypecode','proptype','propertyclass','propertyclassification','usecode','usecodedesc','landuse','landusedesc','dor_desc','propertyuse','propertyusedesc','dorcode']);
  return {source:layerUrl.includes('Florida_Statewide_Cadastral')?'Florida Department of Revenue — Statewide Cadastral':'Public parcel/property service',serviceUrl:layerUrl,fairValue:fair?.value||null,assessedValue:assessed?.value||null,salePrice:sale?.value||null,saleDate:sd?rec[sd.name]:null,livingAreaSqFt:sqft?.value||null,bedrooms:beds?.value||null,bathrooms:baths?.value||null,propertyAddress:af?rec[af.name]:null,propertyType:classify(tf?.value),comparablesCount:1};
}

// Generic parcel lookup is OFF until each county's source is verified one
// at a time (as NYC and LA are above). It keyword-searched ArcGIS and took
// the first layer with a value-like field — which can be an unofficial
// copy — and Florida's statewide "just value" (JV) is set below market by
// design (cost-of-sale deduction), so neither may feed the verdict as-is.
// Until now a crash in choose() meant this path never produced output.
const UNVERIFIED_PARCEL_LOOKUP_ENABLED=false;
async function arcgisParcel(geo,state,county,address){if(!UNVERIFIED_PARCEL_LOOKUP_ENABLED)return null;if(!geo?.latitude||!geo?.longitude||!county)return null;

const knownSource=KNOWN_STATEWIDE_PARCEL_SOURCES[STATE_CODES[state]||state];
if(knownSource){
  const rec=await tryParcelLayer(knownSource,geo,address).catch(()=>null);
  if(rec)return rec;
}

// FIX: this used to try up to 75 candidate services x up to 40 layers each
// (potentially hundreds of sequential HTTP calls) with no time limit at
// all, which could easily run past the orchestrator's 15s fetch timeout —
// the whole US response (including geocoding/FHFA data that had already
// succeeded) would then come back empty. A hard deadline now cuts the
// search short and returns whatever was found so far instead of nothing.
const deadline=Date.now()+9000;
const qs=[`${county} ${state||''} property appraiser`,`${county} ${state||''} assessor parcel property`,`${county} ${state||''} parcel property`,`${county} ${state||''} property tax`,`${county} ${state||''} FeatureServer`];const seen=new Set(),items=[];for(const q of qs){if(Date.now()>deadline)break;const sj=await json('https://www.arcgis.com/sharing/rest/search?f=json&num=100&sortField=modified&sortOrder=desc&q='+enc(q)).catch(()=>null);for(const item of (Array.isArray(sj?.results)?sj.results:[])){const url=s(item?.url);if(!url||!/FeatureServer/i.test(url)||seen.has(url))continue;seen.add(url);items.push(item);}}items.sort((a,b)=>candidateScore(b,county,state)-candidateScore(a,county,state));
for(const item of items.slice(0,75)){if(Date.now()>deadline)break;const root=s(item.url).replace(/\/$/,'');const meta=await json(root+'?f=json').catch(()=>null);if(!meta)continue;const layers=Array.isArray(meta.layers)&&meta.layers.length?meta.layers.slice(0,40).map(x=>root+'/'+x.id):[root+'/0'];for(const layerUrl of layers){if(Date.now()>deadline)break;const lm=await json(layerUrl+'?f=json').catch(()=>null);if(!lm?.fields)continue;const fields=lm.fields;const allNames=fields.map(f=>`${f.name} ${f.alias||''}`).join(' ');if(!/(address|situs|site|parcel|folio|property|sale|assess|value|bedroom|bathroom|building|living|usecode|dor_desc|landuse)/i.test(allNames))continue;const base=layerUrl+'/query?f=json&where=1%3D1&geometry='+enc(`${geo.longitude},${geo.latitude}`)+'&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&returnZ=false&returnM=false';let qj=await json(base).catch(()=>null);let rec=qj?.features?.[0]?.attributes||null;
if(!rec){const af=fields.find(f=>/(site.*addr|siteaddress|propertyaddress|situs|true_site_addr|address)/i.test(`${f.name} ${f.alias||''}`));if(af&&address){const where=`UPPER(${af.name}) LIKE '%${escapeSql(s(address).toUpperCase().replace(/\s+/g,' '))}%'`;const exact=layerUrl+'/query?f=json&where='+enc(where)+'&outFields=*&returnGeometry=false&resultRecordCount=5';const ej=await json(exact).catch(()=>null);rec=ej?.features?.[0]?.attributes||null;}}
if(!rec)continue;const fair=choose(fields,rec,['marketvalue','marketval','justvalue','justval','appraisedvalue','appraisedval','fairmarketvalue','fairvalue','rmvtotal','rmv']);const assessed=choose(fields,rec,['assessedvalue','assessedval','taxablevalue','taxvalue','assessedvalcur']);const sale=choose(fields,rec,['saleprice','price1','lastsaleprice','salesprice','priceofsale','saleamount','saleamt','consideration']);const sqft=choose(fields,rec,['livingareasf','buildingheatedarea','buildingactualarea','livingarea','grosslivingarea','buildingsf','totalarea']);const beds=choose(fields,rec,['bedroomcount','bedrooms','bedroom']);const baths=choose(fields,rec,['bathroomcount','bathrooms','bathroom']);const sd=fields.find(f=>/(sale.*date|date.*sale|dateofsale|dos1|lastsaledate)/i.test(`${f.name} ${f.alias||''}`));const af=fields.find(f=>/(site.*addr|siteaddress|propertyaddress|situs|true_site_addr|address)/i.test(`${f.name} ${f.alias||''}`));const tf=textField(fields,rec,['propertytype','propertytypecode','proptype','propertyclass','propertyclassification','usecode','usecodedesc','landuse','landusedesc','dor_desc','propertyuse','propertyusedesc','dorcode']);return {source:item.title||'Public parcel/property service',serviceUrl:layerUrl,fairValue:fair?.value||null,assessedValue:assessed?.value||null,salePrice:sale?.value||null,saleDate:sd?rec[sd.name]:null,livingAreaSqFt:sqft?.value||null,bedrooms:beds?.value||null,bathrooms:baths?.value||null,propertyAddress:af?rec[af.name]:null,propertyType:classify(tf?.value),comparablesCount:1};}}
return null;}
// New York City — NYC Department of Finance "Rolling Sales": every
// recorded sale in the five boroughs over the prior 12 months, updated
// monthly (data.cityofnewyork.us dataset usep-8jbt). Official, free, no
// key. Rules, all from DOF's own dataset documentation:
//  - $0 = transfer without cash consideration (e.g. parent to child), not
//    a market sale. Nominal prices under $10,000 are excluded for the same
//    reason. Rows sharing one date+price are multi-property deeds (one
//    price for several lots) — excluded rather than guessed at.
//  - DOF "gross square feet" is the whole building measured from the
//    outside walls — NOT living area. So the figure is context only, never
//    fed into the value-gap verdict (a user's living area against a gross
//    area would always make the asking price look too high).
//  - Condos and co-ops carry no floor area at all in this data, so no
//    per-sq-ft figure exists for apartments — said plainly, not estimated.
const NYC_BOROUGH_BY_COUNTY={'36061':'1','36005':'2','36047':'3','36081':'4','36085':'5'};
const NYC_HOUSE_CATEGORIES=['01 ONE FAMILY DWELLINGS','02 TWO FAMILY DWELLINGS','03 THREE FAMILY DWELLINGS'];
const NYC_MIN_SALES=10,NYC_MIN_PRICE=10000;
const NYC_SALES_URL='https://data.cityofnewyork.us/resource/usep-8jbt.json';
const NYC_SOURCE={source:'NYC Department of Finance — Rolling Sales (12 months)',sourceUrl:'https://data.cityofnewyork.us/d/usep-8jbt'};
function uspsZip(zip,geo){const z=s(zip).match(/^\d{5}/)?.[0];if(z)return {zip:z,from:'input'};const m=s(geo?.matchedAddress).match(/(\d{5})(?:-\d{4})?\s*$/);if(m)return {zip:m[1],from:'geocoder'};return null;}
async function nycDofSales(geo,zip,propertyType){
  const borough=NYC_BOROUGH_BY_COUNTY[s(geo?.countyFips)];if(!borough)return null;
  const z=uspsZip(zip,geo);if(!z)return {...NYC_SOURCE,status:'no_zip'};
  const t=s(propertyType).toLowerCase();
  const q=w=>NYC_SALES_URL+'?$limit=5000&$where='+enc(`borough='${borough}' AND zip_code='${z.zip}' AND ${w}`);
  if(/house|villa|town/.test(t)){
    const rows=await json(q(`building_class_category in(${NYC_HOUSE_CATEGORIES.map(c=>`'${c}'`).join(',')}) AND sale_price>=${NYC_MIN_PRICE} AND gross_square_feet>0`)+'&$select=sale_price,gross_square_feet,sale_date',8000);
    if(!Array.isArray(rows)||rows.length>=5000)return null; // cap hit = possibly incomplete, so no figure
    const key=r=>r.sale_date+'|'+r.sale_price,count={};for(const r of rows)count[key(r)]=(count[key(r)]||0)+1;
    const used=rows.filter(r=>count[key(r)]===1),v=used.map(r=>Number(r.sale_price)/Number(r.gross_square_feet)).filter(Number.isFinite).sort((a,b)=>a-b);
    const dates=used.map(r=>s(r.sale_date).slice(0,10)).sort();
    const base={...NYC_SOURCE,zip:z.zip,zipFrom:z.from,category:'1–3 family homes',salesCount:v.length,excludedMultiPropertyDeeds:rows.length-used.length,periodFrom:dates[0]||null,periodTo:dates[dates.length-1]||null};
    if(v.length<NYC_MIN_SALES)return {...base,status:'insufficient_sales'};
    const mid=Math.floor(v.length/2),median=v.length%2?v[mid]:(v[mid-1]+v[mid])/2;
    return {...base,status:'ok',medianPerGrossSqFt:Math.round(median),areaBasis:'gross building area (DOF) — not living area; context only, not used in the verdict'};
  }
  if(/apartment|condo|co-?op/.test(t)){
    const c=await json(q(`(building_class_category like '%CONDO%' OR building_class_category like '%COOP%') AND sale_price>=${NYC_MIN_PRICE}`).replace('$limit=5000&','')+'&$select=count(*) as n',8000);
    return {...NYC_SOURCE,zip:z.zip,zipFrom:z.from,category:'condos / co-ops',status:'no_unit_area',salesCount:Number(c?.[0]?.n)||0};
  }
  return null;
}
// Los Angeles County — LA County Assessor (all official county sources).
// California publishes no open sale-price dataset, so three Assessor
// sources are combined, each labelled for exactly what it is:
//  1. The property itself: parcel found by exact situs address (house
//     number + street + ZIP — never by map point, since a geocoded point
//     sits on the street and can land on a neighbour's lot), then its
//     recorded ownership history from the Assessor's public portal. Only
//     a "Sale for Consideration" + "Good Transfer" with a documentary-
//     transfer-tax price counts as its last sale; trust, spouse, probate,
//     foreclosure and correction transfers are skipped.
//  2. Current roll value — Prop 13 assessed value (purchase price + at
//     most 2%/yr). Tax context only; it is NOT current market value.
//  3. Neighbourhood context: same-ZIP parcels the Assessor re-valued on a
//     change of ownership in the latest open-data roll (both land and
//     improvement base year = roll year, i.e. transfers Jul–Dec of the
//     prior year, before any 2% indexation). Checked against the portal:
//     for regular sales it equals the recorded sale price exactly; other
//     transfers are the Assessor's own market valuation. Per sq ft of the
//     Assessor's main building area. Context only, never the verdict.
const LA_COUNTY_FIPS='06037',LA_ROLL_YEAR='2025',LA_MIN_PARCELS=10;
const LA_PARCELS='https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query';
const LA_ROLL='https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Parcel_Data_2021_Table/FeatureServer/0/query';
const LA_PORTAL='https://portal.assessor.lacounty.gov';
const unitKey=v=>s(v).toUpperCase().replace(/^(NO|UNIT|APT|STE|#)\b/,'').replace(/[^A-Z0-9]/g,'');
function unitFromAddress(address){const m=s(address).match(/(?:#|\b(?:unit|apt|apartment|ste|suite|no)\.?)\s*([a-z0-9-]+)\s*$/i);return m?unitKey(m[1]):null;}
async function laParcel(geo,address,zip){
  const line=s(geo?.matchedAddress).split(',')[0].toUpperCase();const m=line.match(/^(\d+)\s+(.+)$/);if(!m)return {status:'no_address_match'};
  const where=`SitusHouseNo='${m[1]}' AND SitusFullAddress LIKE '${escapeSql(m[1]+' '+m[2])}%' AND SitusZIP LIKE '${zip}%'`;
  const j=await json(LA_PARCELS+'?f=json&returnGeometry=false&outFields=AIN,SitusFullAddress,SitusUnit,UseType,UseDescription,TaxRateCity,YearBuilt1,Units1,Bedrooms1,Bathrooms1,SQFTmain1,Roll_Year,Roll_LandValue,Roll_ImpValue,CENTER_LAT,CENTER_LON&where='+enc(where),8000);
  let f=(j?.features||[]).map(x=>x.attributes);
  if(f.length>1){const u=unitFromAddress(address);f=u?f.filter(x=>unitKey(x.SitusUnit)===u):[];if(f.length!==1)return {status:'multiple_units',units:(j.features||[]).length};}
  if(f.length!==1)return {status:'no_parcel_match'};
  return {status:'ok',...f[0]};
}
async function laLastSale(ain){
  const h=await json(LA_PORTAL+'/api/parcel_ownershiphistory?ain='+enc(ain),8000);
  const r=(h?.Parcel_OwnershipHistory||[]).find(x=>/^Sale for Consideration/i.test(s(x.DocumentTypeDesc))&&/Good Transfer/i.test(s(x.DocumentReasonCodeDesc))&&Number(x.DTTSalePrice)>0&&(s(x.NumberOfParcels)===''||s(x.NumberOfParcels)==='1'));
  if(!r)return null;const [mm,dd,yy]=s(r.RecordingDate).split('/');
  return {price:Number(r.DTTSalePrice),date:yy&&mm&&dd?`${yy}-${mm}-${dd}`:null,documentType:s(r.DocumentTypeDesc),priceBasis:'documentary transfer tax (as recorded by the Assessor)'};
}
async function laZipContext(zip,useType){
  const where=`RollYear='${LA_ROLL_YEAR}' AND SitusZIP5='${zip}' AND UseType='${useType}' AND Roll_LandBaseYear='${LA_ROLL_YEAR}' AND Roll_ImpBaseYear='${LA_ROLL_YEAR}' AND SQFTmain>0 AND Roll_totLandImp>0`;
  const j=await json(LA_ROLL+'?f=json&resultRecordCount=2000&outFields=SQFTmain,Roll_totLandImp,RecordingDate&where='+enc(where),10000);
  if(!Array.isArray(j?.features)||j.exceededTransferLimit)return null;
  const r=j.features.map(x=>x.attributes),v=r.map(x=>x.Roll_totLandImp/x.SQFTmain).filter(Number.isFinite).sort((a,b)=>a-b);
  const d=r.map(x=>x.RecordingDate).filter(Boolean).sort((a,b)=>a-b).map(t=>new Date(t).toISOString().slice(0,10));
  const base={rollYear:LA_ROLL_YEAR,zip,parcels:v.length,periodFrom:d[0]||null,periodTo:d[d.length-1]||null,category:useType==='CND'?'condos':'single-family homes'};
  if(v.length<LA_MIN_PARCELS)return {...base,status:'insufficient'};
  const mid=Math.floor(v.length/2);return {...base,status:'ok',medianPerSqFt:Math.round(v.length%2?v[mid]:(v[mid-1]+v[mid])/2)};
}
async function laAssessor(geo,address,zip,propertyType){
  if(s(geo?.countyFips)!==LA_COUNTY_FIPS)return null;
  const z=uspsZip(zip,geo);if(!z)return {status:'no_zip',source:'Los Angeles County Assessor'};
  const t=s(propertyType).toLowerCase(),useType=/apartment|condo/.test(t)?'CND':/house|villa|town/.test(t)?'SFR':null;
  const [parcel,zipContext]=await Promise.all([laParcel(geo,address,z.zip).catch(()=>null),useType?laZipContext(z.zip,useType).catch(()=>null):null]);
  const [lastSale,fire2025]=parcel?.status==='ok'?await Promise.all([laLastSale(parcel.AIN).catch(()=>null),laFire2025(parcel.AIN).catch(()=>null)]):[null,null];
  const roll=parcel?.status==='ok'?Number(parcel.Roll_LandValue||0)+Number(parcel.Roll_ImpValue||0):0;
  return {status:'ok',source:'Los Angeles County Assessor',sourceUrl:LA_PORTAL,zip:z.zip,
    parcel:parcel?.status==='ok'?{ain:parcel.AIN,address:s(parcel.SitusFullAddress),useDescription:s(parcel.UseDescription)||null,taxRateCity:s(parcel.TaxRateCity)||null,yearBuilt:Number(parcel.YearBuilt1)||null,units:Number(parcel.Units1)||null,bedrooms:Number(parcel.Bedrooms1)||null,bathrooms:Number(parcel.Bathrooms1)||null,livingAreaSqFt:Number(parcel.SQFTmain1)||null,latitude:Number(parcel.CENTER_LAT)||null,longitude:Number(parcel.CENTER_LON)||null}:null,
    parcelStatus:parcel?.status||'lookup_failed',
    lastSale,assessedValue:roll>0?{rollYear:s(parcel.Roll_Year),value:roll,basis:'Prop 13 assessed value — not current market value'}:null,
    zipContext,fire2025};
}
// January 2025 wildfires (Palisades, Eaton, …): LA County parcels joined
// with CAL FIRE Damage Inspection (DINS) results — official county layer.
const LA_DINS='https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/2025_Parcels_with_DINS_data/FeatureServer/5/query';
async function laFire2025(ain){
  const j=await json(LA_DINS+'?f=json&returnGeometry=false&outFields=Fire_Name,DAMAGE_1,STRUCTURECATEGORY,Debris_Cleared,Permit_Status&where='+enc(`AIN_1='${escapeSql(ain)}'`),8000);
  const a=j?.features?.[0]?.attributes;if(!j||!Array.isArray(j.features))return null;
  return a?{inPerimeter:true,fire:s(a.Fire_Name)||null,damage:s(a.DAMAGE_1)||null,debrisCleared:s(a.Debris_Cleared)||null,permitStatus:s(a.Permit_Status)||null}:{inPerimeter:false};
}

// Official hazard layers, queried at the parcel centre when known (LA),
// otherwise at the Census-geocoded address point (which sits on the street,
// so a lot right on a zone edge can read differently — said in the note).
//  - FEMA National Flood Hazard Layer: every U.S. address.
//  - California only: CAL FIRE Fire Hazard Severity Zones (State
//    Responsibility Area, effective 1 Apr 2024; Local Responsibility Area,
//    as recommended by the State Fire Marshal 2025) and California
//    Geological Survey Alquist-Priolo fault zones, liquefaction and
//    landslide zones.
const HAZARD_LAYERS={
  flood:'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28',
  fhszSRA:'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSZSRA_23_3/FeatureServer/0',
  fhszLRA:'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/FHSALRA25_v1_All/FeatureServer/0',
  fault:'https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Alquist_Priolo_Fault_Zones/FeatureServer/0',
  liquefaction:'https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Liquefaction_Zones/FeatureServer/0',
  landslide:'https://services2.arcgis.com/zr3KAIbsRSUyARHG/arcgis/rest/services/CGS_Landslide_Zones/FeatureServer/0'
};
// null = the lookup failed (never reported as "not in zone"); [] = checked, not in a zone.
async function pointQuery(url,lat,lon,fields){const j=await json(url+'/query?f=json&returnGeometry=false&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields='+enc(fields)+'&geometry='+enc(`${lon},${lat}`),8000).catch(()=>null);return Array.isArray(j?.features)?j.features.map(f=>f.attributes):null;}
const FEMA_SFHA_NOTE='Special Flood Hazard Area — federally backed mortgages require flood insurance';
async function usOfficialChecks(lat,lon,stateCode,atParcel,la){
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return [];
  const ca=stateCode==='CA',where=atParcel?'parcel centre':'address point';
  const [flood,sra,lra,fault,liq,slide]=await Promise.all([pointQuery(HAZARD_LAYERS.flood,lat,lon,'FLD_ZONE,ZONE_SUBTY,SFHA_TF'),ca?pointQuery(HAZARD_LAYERS.fhszSRA,lat,lon,'*'):null,ca?pointQuery(HAZARD_LAYERS.fhszLRA,lat,lon,'FHSZ,FHSZ_Description'):null,ca?pointQuery(HAZARD_LAYERS.fault,lat,lon,'*'):null,ca?pointQuery(HAZARD_LAYERS.liquefaction,lat,lon,'QUAD_NAME,RELEASED'):null,ca?pointQuery(HAZARD_LAYERS.landslide,lat,lon,'QUAD_NAME,RELEASED'):null]);
  const out=[];
  if(flood){const f=flood[0];const sfha=f?.SFHA_TF==='T';out.push({id:'flood',label:'Flood zone (FEMA)',value:f?`Zone ${s(f.FLD_ZONE)}${f.ZONE_SUBTY?` — ${s(f.ZONE_SUBTY).toLowerCase()}`:''}${sfha?`. ${FEMA_SFHA_NOTE}`:''}`:'No FEMA flood zone mapped at this point',level:sfha?'warn':'ok',source:'FEMA National Flood Hazard Layer',sourceUrl:'https://msc.fema.gov/portal/home',basis:where});}
  if(ca&&(sra||lra)){const zone=(sra?.[0]&&(s(sra[0].FHSZ_Description)||s(sra[0].HAZ_CLASS)))||(lra?.[0]&&s(lra[0].FHSZ_Description))||null;const real=zone&&!/non.?wildland/i.test(zone);out.push({id:'fire',label:'Fire hazard severity zone (CAL FIRE)',value:real?`${zone}${sra?.[0]?' (State Responsibility Area, effective Apr 2024)':' (Local Responsibility Area, State Fire Marshal recommendation 2025)'}`:'Not in a mapped fire hazard severity zone',level:real&&/very high|high/i.test(zone)?'warn':'ok',source:'CAL FIRE — Fire Hazard Severity Zones',sourceUrl:'https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones',basis:where});}
  if(ca&&fault)out.push({id:'fault',label:'Earthquake fault zone (Alquist-Priolo)',value:fault.length?'Inside a state-mapped Alquist-Priolo Earthquake Fault Zone (active fault nearby)':'Not in an Alquist-Priolo fault zone',level:fault.length?'warn':'ok',source:'California Geological Survey',sourceUrl:'https://maps.conservation.ca.gov/cgs/EQZApp/app/',basis:where});
  if(ca&&liq)out.push({id:'liquefaction',label:'Liquefaction zone (seismic)',value:liq.length?`Inside a state Seismic Hazard Zone for liquefaction (${s(liq[0].QUAD_NAME)} quadrangle)`:'Not in a mapped liquefaction zone',level:liq.length?'warn':'ok',source:'California Geological Survey — Seismic Hazards Program',sourceUrl:'https://maps.conservation.ca.gov/cgs/EQZApp/app/',basis:where});
  if(ca&&slide)out.push({id:'landslide',label:'Landslide zone (seismic)',value:slide.length?`Inside a state Seismic Hazard Zone for earthquake-induced landslides (${s(slide[0].QUAD_NAME)} quadrangle)`:'Not in a mapped landslide zone',level:slide.length?'warn':'ok',source:'California Geological Survey — Seismic Hazards Program',sourceUrl:'https://maps.conservation.ca.gov/cgs/EQZApp/app/',basis:where});
  const f25=la?.fire2025;
  const known=v=>v&&!/^(na|n\/a|null)$/i.test(v)?v:null;
  if(f25)out.push({id:'fire2025',label:'January 2025 wildfires',value:f25.inPerimeter?[`Parcel inside the ${known(f25.fire)?f25.fire+' ':''}fire perimeter`,known(f25.damage)&&`structure damage: ${f25.damage}`,known(f25.debrisCleared)&&`debris cleared: ${f25.debrisCleared}`,known(f25.permitStatus)&&`permit status: ${f25.permitStatus}`].filter(Boolean).join(' — '):'Parcel not inside the January 2025 fire perimeters',level:f25.inPerimeter?(/no damage/i.test(s(f25.damage))?'info':'warn'):'ok',source:'LA County Assessor parcels + CAL FIRE Damage Inspection (DINS)',sourceUrl:'https://data.lacounty.gov/',basis:'parcel'});
  const pc=la?.parcel;
  if(pc&&/^LOS ANGELES$/i.test(s(pc.taxRateCity))&&pc.yearBuilt){const covered=pc.yearBuilt<1978,edge=pc.yearBuilt===1978;out.push({id:'rso',label:'Rent control (City of LA RSO)',value:covered?`Built ${pc.yearBuilt} — as a rental, generally covered by the Rent Stabilization Ordinance (applies to rental properties first built on or before 1 Oct 1978); exemptions exist, confirm with LAHD`:edge?'Built 1978 — RSO cut-off is 1 Oct 1978; confirm with LAHD':`Built ${pc.yearBuilt} — after the RSO cut-off (1 Oct 1978), so generally not RSO; state rent caps (AB 1482) may still apply`,level:covered||edge?'info':'ok',source:'Los Angeles Housing Department (LAHD)',sourceUrl:'https://housing.lacity.gov/residents/rso-overview',basis:'parcel'});}
  return out;
}
// New Jersey — two official state sources:
//  1. NJ Office of GIS parcels joined with the Treasury MOD-IV tax list
//     (live): identifies the property and its municipality, its last sale
//     on the tax list (only if the assessor gave it no non-usable code),
//     year built and last year's actual property tax bill.
//  2. NJ Treasury SR1A sales (lib/data/njResidentialSales.js, rebuilt by
//     scripts/build-nj-sales.mjs): median price per sq ft of LIVING area
//     of usable residential sales in the same municipality, same type
//     (condo vs house), last 12 months. Living area is comparable to the
//     user's own size, so this is a real benchmark for the verdict.
// NJ MOD-IV dates are text YYMMDD.
const NJ_PARCELS='https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/Parcels_Composite_NJ_WM/FeatureServer/0/query';
const NJ_FIELDS='PCL_MUN,MUN_NAME,COUNTY,PROP_LOC,ZIP5,PROP_CLASS,DEED_DATE,SALE_PRICE,SALES_CODE,LAST_YR_TX,YR_CONSTR';
function yymmdd(v){const m=s(v).match(/^(\d{2})(\d{2})(\d{2})$/);if(!m)return null;const d=`20${m[1]}-${m[2]}-${m[3]}`,t=Date.parse(d);return Number.isFinite(t)&&t<=Date.now()?d:null;}
function addressParts(geo){const line=s(geo?.matchedAddress).split(',')[0].toUpperCase();const m=line.match(/^(\d+)\s+(.+)$/);if(!m)return null;const words=m[2].split(/\s+/),dirs=new Set(['N','S','E','W','NE','NW','SE','SW']);return {number:m[1],street:m[2],key:(dirs.has(words[0])&&words[1]?words[1]:words[0])};}
async function njParcel(geo,address,zip){
  const a=addressParts(geo);let rows=[];
  if(a&&zip){const j=await json(NJ_PARCELS+'?f=json&returnGeometry=false&outFields='+NJ_FIELDS+'&where='+enc(`ZIP5='${zip}' AND PROP_LOC LIKE '${a.number} %${escapeSql(a.key)}%'`),8000);rows=(j?.features||[]).map(x=>x.attributes).filter(r=>s(r.PROP_LOC).toUpperCase().startsWith(a.number+' '));}
  const u=unitFromAddress(address);if(rows.length>1&&u)rows=rows.filter(r=>unitKey(s(r.PROP_LOC).split(/#|\bUNIT\b|\bAPT\b/i)[1])===u);
  if(rows.length===1)return {match:'address',...rows[0]};
  const munis=[...new Set(rows.map(r=>r.PCL_MUN))];
  if(munis.length===1)return {match:'municipality',PCL_MUN:munis[0],MUN_NAME:rows[0].MUN_NAME,COUNTY:rows[0].COUNTY};
  if(!Number.isFinite(geo?.latitude))return null;
  const j=await json(NJ_PARCELS+'?f=json&returnGeometry=false&outFields=PCL_MUN,MUN_NAME,COUNTY&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&distance=40&units=esriSRUnit_Meter&geometry='+enc(`${geo.longitude},${geo.latitude}`),8000);
  const near=[...new Set((j?.features||[]).map(x=>x.attributes.PCL_MUN))];
  return near.length===1?{match:'municipality',...j.features[0].attributes}:null;
}
async function njEvidence(geo,address,zip,propertyType){
  if(geo?.stateCode!=='NJ')return null;
  const z=uspsZip(zip,geo);const pc=await njParcel(geo,address,z?.zip).catch(()=>null);
  if(!pc?.PCL_MUN)return {status:'no_parcel_match'};
  const t=s(propertyType).toLowerCase(),type=/apartment|condo/.test(t)?'condo':/house|villa/.test(t)?'house':'all';
  const muni=getNjMuniSales(pc.PCL_MUN),stats=muni?.[type]||null;
  const lastSale=pc.match==='address'&&!s(pc.SALES_CODE)&&Number(pc.SALE_PRICE)>100&&yymmdd(pc.DEED_DATE)?{price:Number(pc.SALE_PRICE),date:yymmdd(pc.DEED_DATE)}:null;
  return {status:'ok',source:NJ_SALES_META.source,sourceUrl:NJ_SALES_META.sourceUrl,
    municipality:{code:pc.PCL_MUN,name:muni?.name||s(pc.MUN_NAME)||null,county:muni?.county||s(pc.COUNTY)||null},
    type,typeLabel:type==='condo'?'condos':type==='house'?'houses (non-condo)':'all residential',
    stats:stats?{...stats,periodFrom:NJ_SALES_META.periodFrom,periodTo:NJ_SALES_META.periodTo}:null,
    parcel:pc.match==='address'?{address:s(pc.PROP_LOC),propertyClass:s(pc.PROP_CLASS)||null,yearBuilt:Number(pc.YR_CONSTR)||null,lastYearTax:Number(pc.LAST_YR_TX)>0?Number(pc.LAST_YR_TX):null,lastSale}:null};
}

// New York State outside NYC — NYS ITS "NYS Tax Parcels Public" (official;
// Suffolk, Westchester, Rockland, Putnam and most counties — Nassau does not
// share its roll here). Property facts + ORPTS full market value (assessed
// value ÷ the state equalization rate): context only, never the verdict.
const NYS_PARCELS='https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1/query';
async function nysParcel(geo,address,zip){
  if(geo?.stateCode!=='NY'||NYC_BOROUGH_BY_COUNTY[s(geo?.countyFips)])return null;
  // LOC_ZIP is empty in several counties, so match on county + number +
  // street; if the same address exists in more than one town, keep only
  // the town the geocoder named — otherwise return nothing rather than guess.
  const a=addressParts(geo),county=s(geo?.county).replace(/\s+County$/i,'');if(!a||!county)return null;
  const j=await json(NYS_PARCELS+'?f=json&returnGeometry=false&outFields=PARCEL_ADDR,COUNTY_NAME,MUNI_NAME,LOC_STREET,LOC_UNIT,FULL_MARKET_VAL,ROLL_YR,SQFT_LIVING,YR_BLT,NBR_BEDROOMS,NBR_FULL_BATHS,SCHOOL_NAME,PROP_CLASS&where='+enc(`COUNTY_NAME='${escapeSql(county)}' AND LOC_ST_NBR='${a.number}' AND LOC_STREET LIKE '${escapeSql(a.key)}%'`),8000);
  const want=s(a.street).replace(/^(N|S|E|W)\s+/,'');let rows=(j?.features||[]).map(x=>x.attributes).filter(r=>s(r.LOC_STREET).toUpperCase().replace(/^(N|S|E|W)\s+/,'')===want);
  const place=s(geo?.city).toLowerCase().replace(/\s+(village|city|town|cdp)$/,'');if(rows.length>1&&place){const m=rows.filter(r=>s(r.MUNI_NAME).toLowerCase().startsWith(place));if(m.length)rows=m;}
  const u=unitFromAddress(address);if(rows.length>1&&u)rows=rows.filter(r=>unitKey(r.LOC_UNIT)===u);
  if(rows.length!==1)return rows.length>1?{status:'multiple_units'}:null;const r=rows[0];
  return {status:'ok',source:'NYS Office of Information Technology Services — NYS Tax Parcels (ORPTS roll data)',address:s(r.PARCEL_ADDR),municipality:s(r.MUNI_NAME)||null,county:s(r.COUNTY_NAME)||null,
    fullMarketValue:Number(r.FULL_MARKET_VAL)>0?Number(r.FULL_MARKET_VAL):null,rollYear:s(r.ROLL_YR)||null,livingAreaSqFt:Number(r.SQFT_LIVING)||null,yearBuilt:Number(r.YR_BLT)||null,bedrooms:Number(r.NBR_BEDROOMS)||null,bathrooms:Number(r.NBR_FULL_BATHS)||null,schoolDistrict:s(r.SCHOOL_NAME)||null};
}
function saleAdjusted(p,h){if(!p?.salePrice)return null;let v=p.salePrice;const d=p.saleDate?new Date(p.saleDate):null;if(d&&!Number.isNaN(d.getTime())&&h?.oneYear!=null){const age=Math.max(0,Math.min(5,(Date.now()-d.getTime())/(365.25*86400000)));v*=Math.pow(1+Math.max(-.15,Math.min(.15,Number(h.oneYear)/100)),age);}return Math.round(v/1000)*1000;}
export default async function handler(req,res){const address=s(req.query?.address),city=s(req.query?.city),state=s(req.query?.state),zip=s(req.query?.zip||req.query?.postalCode),propertyType=s(req.query?.propertyType),askingPrice=Number(req.query?.askingPrice);if(!address&&!city)return res.status(400).json({success:false,error:'city or address is required'});try{const geo=await geocode(address,city,state,zip);const rs=geo?.state||state||null,rc=geo?.city||city||null;const [sh,ch,hp]=await Promise.all([hpiState(rs),hpiCity(rc,rs,geo?.countyFips),hpiPeriod()]);const mh=hpi(ch,'metro',hp)||hpi(sh,'state',hp);const isLA=s(geo?.countyFips)===LA_COUNTY_FIPS;const [p,nyc,la,nj,nys]=await Promise.all([isLA?null:arcgisParcel(geo,rs,geo?.county,address),nycDofSales(geo,zip,propertyType).catch(()=>null),laAssessor(geo,address,zip,propertyType).catch(()=>null),njEvidence(geo,address,zip,propertyType).catch(()=>null),nysParcel(geo,address,zip).catch(()=>null)]);let fair=p?.fairValue||null,method=fair?'official local market/just/appraised property value':null;if(!fair&&p?.salePrice){fair=saleAdjusted(p,mh);method='recent official property sale price adjusted by FHFA market trend';}const lp=la?.parcel,atParcel=Number.isFinite(lp?.latitude)&&Number.isFinite(lp?.longitude);const officialChecks=await usOfficialChecks(atParcel?lp.latitude:geo?.latitude,atParcel?lp.longitude:geo?.longitude,geo?.stateCode,atParcel,la).catch(()=>[]);if(nj?.parcel?.lastYearTax)officialChecks.push({id:'propertyTax',label:'Property tax (last year, actual bill)',value:`$${Math.round(nj.parcel.lastYearTax).toLocaleString('en-US')} — ${nj.municipality.name||'municipal'} tax list`,level:'info',source:'NJ Treasury — MOD-IV tax list',sourceUrl:'https://njogis-newjersey.opendata.arcgis.com/',basis:'parcel'});if(nys?.schoolDistrict)officialChecks.push({id:'schoolDistrict',label:'School district',value:nys.schoolDistrict,level:'info',source:'NYS Tax Parcels (ORPTS)',sourceUrl:'https://gis.ny.gov/parcels',basis:'parcel'});const property={address:p?.propertyAddress||geo?.matchedAddress||address||null,propertyType:p?.propertyType||propertyType||null,latitude:geo?.latitude??null,longitude:geo?.longitude??null,state:rs,stateCode:geo?.stateCode||null,county:geo?.county||null,city:rc,zip:geo?.zip||zip||null,censusTract:geo?.tract||null,livingAreaSqFt:p?.livingAreaSqFt||lp?.livingAreaSqFt||nys?.livingAreaSqFt||null,bedrooms:p?.bedrooms||lp?.bedrooms||nys?.bedrooms||null,bathrooms:p?.bathrooms||lp?.bathrooms||nys?.bathrooms||null,yearBuilt:lp?.yearBuilt||nys?.yearBuilt||nj?.parcel?.yearBuilt||null,units:lp?.units||null,schoolDistrict:nys?.schoolDistrict||null};
    const prestige=usPrestigeSignals(property.address||address,rc,rs);const valuationEvidence=fair?{fairValue:fair,method,comparablesCount:p?.comparablesCount||1,valuePerSqFt:p?.livingAreaSqFt?fair/p.livingAreaSqFt:null,source:p?.source||'Public property record',geography:geo?.county||rc,modelled:!p?.fairValue,transactionAnchor:p?.salePrice||null,saleDate:p?.saleDate||null,assessedValue:p?.assessedValue||null}:null;const localBenchmark=nj?.stats?.medianPerSqFt?{valuePerSqFt:nj.stats.medianPerSqFt,sales:nj.stats.salesWithArea,area:`${nj.municipality.name||'municipality'}${nj.municipality.county?`, ${nj.municipality.county} County`:''}`,typeLabel:nj.typeLabel,periodFrom:nj.stats.periodFrom,periodTo:nj.stats.periodTo,source:nj.source,sourceUrl:nj.sourceUrl,basis:'median sale price per sq ft of living area, usable (arm\'s-length) residential sales'}:null;const data={market:'United States',region:rs,city:rc,area:geo?.county||geo?.zip||null,property,prestige,officialChecks,localBenchmark,transactionEvidence:!p?.salePrice&&!la?.lastSale&&nj?.parcel?.lastSale?{status:'official_local_transaction',exactPropertySales:true,salePrice:nj.parcel.lastSale.price,saleDate:nj.parcel.lastSale.date,source:'NJ Treasury MOD-IV tax list — last recorded sale (no non-usable code)'}:p?.salePrice||!la?.lastSale?{status:p?.salePrice?'official_local_transaction':'property_record_without_sale',exactPropertySales:Boolean(p?.salePrice),salePrice:p?.salePrice||null,saleDate:p?.saleDate||null,source:p?.source||null}:{status:'official_local_transaction',exactPropertySales:true,salePrice:la.lastSale.price,saleDate:la.lastSale.date,source:'Los Angeles County Assessor — recorded sale ('+la.lastSale.priceBasis+')'},valuationEvidence,macroEvidence:{fhfaState:hpi(sh,'state',hp),fhfaMetro:hpi(ch,'metro',hp),geographicSource:'U.S. Census Bureau Geocoder / TIGERweb',marketSource:'FHFA HPI',localPropertySource:p?.source||null,nycSales:nyc||null,laAssessor:la||null,njSales:nj||null,nysParcel:nys||null},sourceLevel:fair?'local-property-record':'federal-geography',evidenceConfidence:fair?(p?.fairValue?'High':'Medium'):(geo?'Low':20),evidenceStatus:fair?'official/public U.S. property evidence resolved; Fair Value calculated':'U.S. geography resolved; property valuation evidence unavailable',methodology:'Nationwide U.S. model: Census geocoding resolves the property geography; public parcel/property records are discovered dynamically from authoritative/public Feature Services; explicit market/just/appraised value is preferred, otherwise a recent recorded sale may be adjusted by FHFA market trend. Tax assessed value alone is never promoted to Fair Value. U.S. area is retained in square feet.'};return res.status(200).json({success:true,country:'United States',state:rs,city:rc,address,propertyType:data.property.propertyType,askingPrice:Number.isFinite(askingPrice)&&askingPrice>0?askingPrice:null,data,source:'U.S. Census Bureau + FHFA + public U.S. property records'});}catch(e){return res.status(200).json({success:true,country:'United States',state:state||null,city:city||null,address,propertyType:propertyType||null,data:{market:'United States',region:state||null,city:city||null,property:{address:address||null,propertyType:propertyType||null},transactionEvidence:null,valuationEvidence:null,macroEvidence:null,evidenceConfidence:10,evidenceStatus:'official U.S. request failed',error:String(e?.message||e)},source:'U.S. Census Bureau + FHFA + public U.S. property records'});}}