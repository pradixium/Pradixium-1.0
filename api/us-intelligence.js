/* PRADIXIUM™ — U.S. NATIONAL INTELLIGENCE ENGINE */
const s=v=>String(v??'').trim(),enc=v=>encodeURIComponent(s(v));
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
const STATE_CODES=Object.fromEntries(Object.entries(STATES).map(([k,v])=>[v,k]));
async function json(url,timeoutMs=5000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);try{const r=await fetch(url,{headers:{accept:'application/json'},cache:'no-store',signal:controller.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json();}finally{clearTimeout(timer);}}
function first(g,n){const a=g?.[n];return Array.isArray(a)&&a.length?a[0]:null;}
function field(g,n,keys){const r=first(g,n);for(const k of keys)if(r?.[k]!==undefined&&r?.[k]!==null&&r?.[k]!=='')return r[k];return null;}
async function geocode(address,city,state,zip){if(!address&&!city)return null;const line=[address,city,state,zip].filter(Boolean).join(', ');const u='https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address='+enc(line)+'&benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json';const j=await json(u);const m=j?.result?.addressMatches?.[0];if(!m)return null;const g=m.geographies||{};const stateName=field(g,'States',['NAME'])||state||null;const stateFips=field(g,'States',['STATE','GEOID'])||null;const county=field(g,'Counties',['NAME']);const tract=field(g,'Census Tracts',['NAME','BASENAME']);const place=field(g,'Incorporated Places',['NAME'])||field(g,'Census Designated Places',['NAME'])||city||null;const zcta=field(g,'2020 Census ZIP Code Tabulation Areas',['NAME'])||zip||null;return {matchedAddress:m.matchedAddress||line,longitude:m.coordinates?.x??null,latitude:m.coordinates?.y??null,state:stateName,stateCode:STATE_CODES[stateName]||stateFips||state||null,stateFips:stateFips?String(stateFips).slice(-2):null,county,city:place,zip:zcta,tract};}
async function hpiState(state){if(!state)return null;const a=await json('https://www.fhfa.gov/hpi-state/json').catch(()=>null);return Array.isArray(a)?a.find(x=>s(x.name).toLowerCase()===s(state).toLowerCase())||null:null;}
async function hpiCity(city,state){if(!city)return null;const a=await json('https://www.fhfa.gov/hpi-city/json').catch(()=>null);if(!Array.isArray(a))return null;const c=s(city).toLowerCase(),code=STATE_CODES[s(state)]?.toLowerCase();return a.find(x=>{const n=s(x.name).toLowerCase();return n.startsWith(c+',')&&(!code||n.includes(', '+code));})||null;}
function hpi(r,level){if(!r)return null;const y=level==='state'?r.sa_1y:r.nsa_1y;return {source:'FHFA HPI',level,name:r.name||null,period:r.period||null,oneYear:Number.isFinite(Number(y))?Number(y):null};}
function nf(x){return s(x).toLowerCase().replace(/[^a-z0-9]+/g,'');}
const normGroups=a=>a.map(nf);
function choose(fields,rec,groups){for(const group of normGroups(groups))for(const f of Array.isArray(fields)?fields:[]){const a=nf(f.name),b=nf(f.alias);if(group.some(g=>a===g||b===g||a.includes(g)||b.includes(g))){const n=Number(String(rec?.[f.name]??'').replace(/[$,]/g,''));if(Number.isFinite(n)&&n>0)return {value:n,field:f.name,alias:f.alias||f.name};}}return null;}
function textField(fields,rec,groups){for(const group of normGroups(groups))for(const f of Array.isArray(fields)?fields:[]){const a=nf(f.name),b=nf(f.alias);if(group.some(g=>a===g||b===g||a.includes(g)||b.includes(g))){const v=rec?.[f.name];if(v!==undefined&&v!==null&&s(v))return {value:s(v),field:f.name,alias:f.alias||f.name};}}return null;}
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

async function arcgisParcel(geo,state,county,address){if(!geo?.latitude||!geo?.longitude||!county)return null;

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
function saleAdjusted(p,h){if(!p?.salePrice)return null;let v=p.salePrice;const d=p.saleDate?new Date(p.saleDate):null;if(d&&!Number.isNaN(d.getTime())&&h?.oneYear!=null){const age=Math.max(0,Math.min(5,(Date.now()-d.getTime())/(365.25*86400000)));v*=Math.pow(1+Math.max(-.15,Math.min(.15,Number(h.oneYear)/100)),age);}return Math.round(v/1000)*1000;}
export default async function handler(req,res){const address=s(req.query?.address),city=s(req.query?.city),state=s(req.query?.state),zip=s(req.query?.zip||req.query?.postalCode),propertyType=s(req.query?.propertyType),askingPrice=Number(req.query?.askingPrice);if(!address&&!city)return res.status(400).json({success:false,error:'city or address is required'});try{const geo=await geocode(address,city,state,zip);const rs=geo?.state||state||null,rc=geo?.city||city||null;const [sh,ch]=await Promise.all([hpiState(rs),hpiCity(rc,rs)]);const mh=hpi(ch,'metro')||hpi(sh,'state');const p=await arcgisParcel(geo,rs,geo?.county,address);let fair=p?.fairValue||null,method=fair?'official local market/just/appraised property value':null;if(!fair&&p?.salePrice){fair=saleAdjusted(p,mh);method='recent official property sale price adjusted by FHFA market trend';}const property={address:p?.propertyAddress||geo?.matchedAddress||address||null,propertyType:p?.propertyType||propertyType||null,latitude:geo?.latitude??null,longitude:geo?.longitude??null,state:rs,stateCode:geo?.stateCode||null,county:geo?.county||null,city:rc,zip:geo?.zip||zip||null,censusTract:geo?.tract||null,livingAreaSqFt:p?.livingAreaSqFt||null,bedrooms:p?.bedrooms||null,bathrooms:p?.bathrooms||null};
    const prestige=usPrestigeSignals(property.address||address,rc,rs);const valuationEvidence=fair?{fairValue:fair,method,comparablesCount:p?.comparablesCount||1,valuePerSqFt:p?.livingAreaSqFt?fair/p.livingAreaSqFt:null,source:p?.source||'Public property record',geography:geo?.county||rc,modelled:!p?.fairValue,transactionAnchor:p?.salePrice||null,saleDate:p?.saleDate||null,assessedValue:p?.assessedValue||null}:null;const data={market:'United States',region:rs,city:rc,area:geo?.county||geo?.zip||null,property,prestige,transactionEvidence:{status:p?.salePrice?'official_local_transaction':'property_record_without_sale',exactPropertySales:Boolean(p?.salePrice),salePrice:p?.salePrice||null,saleDate:p?.saleDate||null,source:p?.source||null},valuationEvidence,macroEvidence:{fhfaState:hpi(sh,'state'),fhfaMetro:hpi(ch,'metro'),geographicSource:'U.S. Census Bureau Geocoder / TIGERweb',marketSource:'FHFA HPI',localPropertySource:p?.source||null},sourceLevel:fair?'local-property-record':'federal-geography',evidenceConfidence:fair?(p?.fairValue?'High':'Medium'):(geo?'Low':20),evidenceStatus:fair?'official/public U.S. property evidence resolved; Fair Value calculated':'U.S. geography resolved; property valuation evidence unavailable',methodology:'Nationwide U.S. model: Census geocoding resolves the property geography; public parcel/property records are discovered dynamically from authoritative/public Feature Services; explicit market/just/appraised value is preferred, otherwise a recent recorded sale may be adjusted by FHFA market trend. Tax assessed value alone is never promoted to Fair Value. U.S. area is retained in square feet.'};return res.status(200).json({success:true,country:'United States',state:rs,city:rc,address,propertyType:data.property.propertyType,askingPrice:Number.isFinite(askingPrice)&&askingPrice>0?askingPrice:null,data,source:'U.S. Census Bureau + FHFA + public U.S. property records'});}catch(e){return res.status(200).json({success:true,country:'United States',state:state||null,city:city||null,address,propertyType:propertyType||null,data:{market:'United States',region:state||null,city:city||null,property:{address:address||null,propertyType:propertyType||null},transactionEvidence:null,valuationEvidence:null,macroEvidence:null,evidenceConfidence:10,evidenceStatus:'official U.S. request failed',error:String(e?.message||e)},source:'U.S. Census Bureau + FHFA + public U.S. property records'});}}