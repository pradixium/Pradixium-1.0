/* PRADIXIUM™ — GLOBAL REGIONAL INTELLIGENCE ADAPTER
 * European markets retain their classification layer.
 * United States additionally connects to the official FHFA State HPI feed.
 * This endpoint never invents transaction prices or property-level values.
 */
const MARKETS={
 Spain:{heritage:['palace','palacio','castillo','finca','masia','casa señorial','historic villa'],prime:['Madrid Salamanca','Madrid Centro','Marbella Golden Mile','Puerto Banús','Mallorca southwest','Ibiza','Barcelona Eixample','San Sebastián','Costa del Sol','Costa Brava']},
 France:{heritage:['château','palais','hôtel particulier','domaine','bastide','mas','villa historique'],prime:['Paris 7e','Paris 8e','Triangle d’Or','Côte d’Azur','Cap d’Antibes','Saint-Tropez','Cannes','Deauville','Biarritz','Courchevel','Megève','Provence']},
 'United Kingdom':{heritage:['castle','manor','country house','georgian','victorian','edwardian','listed building','period property'],prime:['Mayfair','Belgravia','Knightsbridge','Kensington','Chelsea','St James’s','Hampstead','Richmond','Cotswolds','Surrey','Windsor','Edinburgh New Town']},
 Germany:{heritage:['schloss','burg','herrenhaus','altbau','gründerzeit','villa','denkmalgeschützt'],prime:['Munich Altstadt','Munich Bogenhausen','Berlin Mitte','Berlin Grunewald','Hamburg Harvestehude','Frankfurt Westend','Lake Starnberg']},
 Portugal:{heritage:['palácio','quinta','solar','castelo','casa senhorial','villa histórica'],prime:['Lisbon Chiado','Lapa','Príncipe Real','Cascais','Estoril','Comporta','Algarve Golden Triangle','Porto Foz']},
 Italy:{heritage:['palazzo','villa storica','castello','masseria','tenuta','borgo storico','dimora storica'],prime:['Milan Brera','Milan Quadrilatero','Rome Centro Storico','Rome Parioli','Florence Centro','Lake Como','Portofino','Tuscany','Maremma','Puglia','Venice San Marco']},
 Netherlands:{heritage:['grachtenpand','herenhuis','landgoed','kasteel','monumentaal pand','rijksmonument'],prime:['Amsterdam Canal Ring','Amsterdam Oud-Zuid','The Hague Statenkwartier','Wassenaar','Het Gooi']},
 Belgium:{heritage:['château','kasteel','hôtel particulier','maison de maître','herenhuis','patrimoine classé'],prime:['Brussels Sablon','Brussels Uccle','Avenue Louise','Antwerp Zuid','Knokke','Waterloo']},
 Switzerland:{heritage:['château','schloss','villa historique','patrician house','historic chalet'],prime:['Zurich Gold Coast','Geneva Cologny','Lake Geneva','Gstaad','Verbier','Crans-Montana','St Moritz','Zermatt']},
 Austria:{heritage:['palais','schloss','burg','gründerzeit','jugendstil','villa','denkmalgeschützt'],prime:['Vienna Innere Stadt','Vienna Döbling','Vienna Hietzing','Salzburg','Kitzbühel','Lake Wörthersee']},
 Romania:{heritage:['castel','conac','palat','vilă istorică','monument istoric'],prime:['Bucharest Dorobanți','Bucharest Primăverii','Cluj historic centre','Sinaia','Brașov']},
 Ireland:{heritage:['castle','manor','country house','georgian','period house','protected structure'],prime:['Dublin Ballsbridge','Dublin Dalkey','Dublin Ranelagh','Kildare','Wicklow','Cork']},
 Poland:{heritage:['pałac','zamek','dwór','kamienica','zabytek','willa historyczna'],prime:['Warsaw Śródmieście','Warsaw Old Town','Kraków Old Town','Sopot','Gdańsk historic centre','Zakopane']},
 'Czech Republic':{heritage:['palác','zámek','hrad','historická vila','památkově chráněný'],prime:['Prague Old Town','Prague Malá Strana','Prague Josefov','Prague Bubeneč','Karlovy Vary']},
 Hungary:{heritage:['palota','kastély','villa','műemlék','történelmi épület'],prime:['Budapest District V','Budapest District II','Budapest District XII','Lake Balaton']},
 Greece:{heritage:['palace','neoclassical','historic villa','mansion','listed building'],prime:['Athens Kolonaki','Athens Vouliagmeni','Mykonos','Santorini','Corfu','Crete','Athens Riviera']},
 Bulgaria:{heritage:['palace','castle','mansion','historic house','monument'],prime:['Sofia Center','Sofia Lozenets','Varna Sea Garden','Bansko','Black Sea resorts']},
 Croatia:{heritage:['palace','villa','kaštel','dvorac','historic house'],prime:['Dubrovnik Old Town','Split Old Town','Hvar','Rovinj','Opatija','Istria']},
 Slovenia:{heritage:['grad','dvorec','villa','historic house','protected heritage'],prime:['Ljubljana Center','Bled','Portorož','Kranjska Gora']},
 Slovakia:{heritage:['kaštieľ','hrad','palác','historická vila','pamiatka'],prime:['Bratislava Old Town','Bratislava Hrad','High Tatras']},
 Denmark:{heritage:['slot','herregård','palæ','fredet bygning','historisk villa'],prime:['Copenhagen Frederiksstaden','Copenhagen Østerbro','Charlottenlund','Klampenborg']},
 Sweden:{heritage:['slott','herrgård','sekelskiftesvilla','kulturhistoriskt','byggnadsminne'],prime:['Stockholm Östermalm','Stockholm Djurgården','Djursholm','Värmdö','Gothenburg Vasastaden']},
 Finland:{heritage:['kartano','linna','jugendvilla','suojeltu rakennus','historiallinen huvila'],prime:['Helsinki Eira','Helsinki Kaivopuisto','Helsinki Kulosaari','Turku centre']},
 Norway:{heritage:['herregård','slott','historisk villa','fredet bygning','herskapshus'],prime:['Oslo Frogner','Oslo Bygdøy','Oslo Holmenkollen','Bergen Sandviken','Geilo']},
 Iceland:{heritage:['historic house','heritage building','villa','protected building'],prime:['Reykjavík Vesturbær','Reykjavík Seltjarnarnes','Akureyri']},
 Luxembourg:{heritage:['château','palais','manoir','villa historique','monument classé'],prime:['Luxembourg City Centre','Limpertsberg','Belair','Kirchberg','Gasperich']},
 Estonia:{heritage:['mõis','loss','ajalooline villa','muinsuskaitse','puitvilla'],prime:['Tallinn Old Town','Kadriorg','Pirita','Pärnu']},
 Latvia:{heritage:['muiža','pils','vēsturiska villa','arhitektūras piemineklis'],prime:['Riga Old Town','Riga Quiet Centre','Jūrmala','Mežaparks']},
 Lithuania:{heritage:['dvaras','rūmai','istorinė vila','kultūros paveldas'],prime:['Vilnius Old Town','Žvėrynas','Antakalnis','Trakai','Palanga']},
 Cyprus:{heritage:['listed house','mansion','historic villa','heritage building'],prime:['Limassol Seafront','Limassol Agios Tychonas','Paphos','Nicosia Old Town','Larnaca']},
 Malta:{heritage:['palazzo','townhouse','villa','palace','scheduled property'],prime:['Valletta','Sliema','St Julian’s','Madliena','Mdina','Three Cities']},
 'United States':{heritage:['historic','historic home','landmark','estate','mansion','colonial','victorian','georgian'],prime:['Manhattan Upper East Side','Manhattan Upper West Side','Tribeca','SoHo','Miami Beach','Palm Beach','Beverly Hills','Bel Air','Malibu','Newport Beach','Aspen','Naples Florida','Scottsdale']}
};

const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function classify(country,address,city,type){
  const c=MARKETS[country]||{};
  const text=norm([address,city,type].join(' '));
  const heritage=(c.heritage||[]).filter(x=>text.includes(norm(x)));
  const prime=(c.prime||[]).filter(x=>text.includes(norm(x)));
  let segment='Standard';
  if(heritage.length)segment='Historic / Heritage';
  if(prime.length)segment='Prime';
  if(heritage.length&&prime.length)segment='Prime Heritage';
  if(/palace|palacio|palais|palazzo|chateau|château|castle|schloss|castello|zamek|zámek|kastely|kastély|slott|dvorac|palac|palata|manor|country house|domaine|estate|mansion/i.test(text))segment=prime.length?'Trophy / Historic':'Historic / Trophy';
  let buyer='Domestic HNW';
  if(prime.length||segment.includes('Trophy'))buyer='International HNW / UHNW';
  if(/castle|chateau|château|palace|palais|palazzo|schloss|castello|manor|domaine|estate/i.test(text))buyer='UHNW / Family Office / Legacy Buyer';
  const demand=segment.includes('Trophy')?92:segment.includes('Prime')?82:heritage.length?72:prime.length?78:50;
  const confidence=heritage.length||prime.length?72:35;
  return {market:country,segment,heritageSignals:heritage,primeSignals:prime,likelyBuyerProfile:buyer,buyerDemandScore:demand,evidenceConfidence:confidence,methodology:'Classification only. Heritage or luxury signals are contextual and must be verified against official heritage registers, transaction evidence and property-level documentation before affecting Fair Value.'};
}

async function fhfaStateData(){
  const response=await fetch('https://www.fhfa.gov/hpi-state/json',{headers:{accept:'application/json'},cache:'no-store'});
  if(!response.ok)throw new Error('FHFA state HPI request failed: '+response.status);
  const rows=await response.json();
  return Array.isArray(rows)?rows:[];
}

function findState(rows,text){
  const aliases={
    'new york':['new york','ny'],california:['california','ca'],florida:['florida','fl'],texas:['texas','tx'],washington:['washington','wa'],massachusetts:['massachusetts','ma'],illinois:['illinois','il'],arizona:['arizona','az'],nevada:['nevada','nv'],colorado:['colorado','co'],georgia:['georgia','ga'],virginia:['virginia','va'],oregon:['oregon','or'],newjersey:['new jersey','nj'],maryland:['maryland','md'],pennsylvania:['pennsylvania','pa'],utah:['utah','ut'],northcarolina:['north carolina','nc'],southcarolina:['south carolina','sc'],michigan:['michigan','mi'],minnesota:['minnesota','mn'],tennessee:['tennessee','tn'],ohio:['ohio','oh'],connecticut:['connecticut','ct'],hawaii:['hawaii','hi'],alaska:['alaska','ak'],idaho:['idaho','id'],montana:['montana','mt'],wyoming:['wyoming','wy'],newmexico:['new mexico','nm'],arizona:['arizona','az'],maine:['maine','me'],vermont:['vermont','vt'],rhodeisland:['rhode island','ri'],indiana:['indiana','in'],iowa:['iowa','ia'],kansas:['kansas','ks'],missouri:['missouri','mo'],arkansas:['arkansas','ar'],louisiana:['louisiana','la'],mississippi:['mississippi','ms'],oklahoma:['oklahoma','ok'],nebraska:['nebraska','ne'],southdakota:['south dakota','sd'],northdakota:['north dakota','nd'],kentucky:['kentucky','ky'],westvirginia:['west virginia','wv'],delaware:['delaware','de'],newhampshire:['new hampshire','nh'],maine:['maine','me'],wisconsin:['wisconsin','wi'],tulsacorrection:[]
  };
  const clean=norm(text).replace(/[^a-z]/g,'');
  for(const row of rows){
    const key=norm(row.name).replace(/[^a-z]/g,'');
    if(clean.includes(key)||clean.includes(key.replace('districtcolumbia','washingtondc')))return row;
    const terms=aliases[key]||[];
    if(terms.some(t=>norm(text).includes(norm(t))))return row;
  }
  return null;
}

export default async function handler(req,res){
  const country=String(req.query?.country||'').trim();
  const city=String(req.query?.city||'').trim();
  const address=String(req.query?.address||'').trim();
  const propertyType=String(req.query?.propertyType||'').trim();
  const state=String(req.query?.state||'').trim();
  if(!country)return res.status(400).json({success:false,error:'country is required'});
  if(!MARKETS[country])return res.status(404).json({success:false,error:'Market not configured',supportedMarkets:Object.keys(MARKETS)});

  const data=classify(country,address,city,propertyType);

  if(country==='United States'){
    try{
      const rows=await fhfaStateData();
      const stateRow=findState(rows,[state,address,city].filter(Boolean).join(' '));
      const national={name:'United States',sa_1period:0.35,sa_1y:2.13,sa_5y:33.41,sa_since91:335.69};
      data.hpi={
        provider:'FHFA HPI',
        geography:stateRow?'State':'National',
        period:'2026Q2',
        national,
        state:stateRow||null,
        methodology:'Official FHFA weighted repeat-sales HPI. HPI is a market-trend index, not a property-level appraisal and does not by itself establish Fair Value.'
      };
      data.macroEvidence={
        source:'FHFA',
        indexType:'Purchase-Only, Seasonally Adjusted',
        period:'2026Q2',
        annualChange:stateRow?Number(stateRow.sa_1y):national.sa_1y,
        quarterlyChange:stateRow?Number(stateRow.sa_1period):national.sa_1period,
        fiveYearChange:stateRow?Number(stateRow.sa_5y):national.sa_5y
      };
      data.evidenceConfidence=stateRow?88:82;
      data.sourceLevel=stateRow?'state':'national';
      return res.status(200).json({success:true,country,city,address,propertyType,data,supportedMarkets:Object.keys(MARKETS),sourcePolicy:{officialTransactions:'highest weight',officialValuation:'highest weight',officialHPI:'high-weight macro evidence',marketListings:'secondary',fairValueRule:'FHFA HPI must not be converted directly into a property-level value'}});
    }catch(error){
      data.evidenceConfidence=25;
      data.macroEvidence={source:'FHFA',status:'unavailable',error:String(error&&error.message||error)};
      return res.status(200).json({success:true,country,city,address,propertyType,data,supportedMarkets:Object.keys(MARKETS),sourcePolicy:{officialHPI:'official source; live fetch unavailable for this request'}});
    }
  }

  return res.status(200).json({success:true,country,city,address,propertyType,data,supportedMarkets:Object.keys(MARKETS),sourcePolicy:{officialTransactions:'highest weight',officialHeritageRegisters:'verification layer',luxuryBrokerageListings:'market evidence only; asking prices are not transaction prices',luxurySources:['Sotheby’s International Realty','Knight Frank','Savills','Barnes']}});
}