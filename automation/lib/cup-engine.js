"use strict";
/**
 * Motore condiviso dei calcoli della Coppa delle Case (GitHub Actions).
 * Calcoli estratti dalle funzioni omonime del tool pubblico al blob GitHub 6c24c686d248a899a95f8b15bbbd40ad447dbaa9.
 * In caso di modifiche all'algoritmo del tool, sincronizzare questo modulo e i test.
 * Non pubblica il documento privato: produce soltanto aggregati, record e il
 * riepilogo essenziale dei PG (nome, casa, stima, post e punti).
 */
const MONTH_NAMES=["Settembre","Ottobre","Novembre","Dicembre","Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno"];
const HOUSE_KEYS=["grifondoro","tassorosso","corvonero","serpeverde"];
const HOUSES=Object.fromEntries(HOUSE_KEYS.map(h=>[h,{name:h}]));

function buildPublicSnapshot(yearId,rawPrivate,previousPublic={}){
  if(!/^\d{4}_\d{2}$/.test(String(yearId)))throw new Error("Anno della Coppa non valido");
  const raw=rawPrivate&&typeof rawPrivate==="object"?rawPrivate:{};
  const state={
    yearId,
    docData:{
      summaries:raw.summaries&&typeof raw.summaries==="object"?raw.summaries:{},
      roster:sanitizeRoster(raw.roster),
      adjustments:raw.adjustments&&typeof raw.adjustments==="object"?raw.adjustments:{},
      overrides:raw.overrides&&typeof raw.overrides==="object"?raw.overrides:{}
    },
    publicData:previousPublic&&typeof previousPublic==="object"?previousPublic:{}
  };
  function sanitizeRoster(raw){const out={};Object.entries(raw&&typeof raw==="object"?raw:{}).forEach(([pg,value])=>{const r=value&&typeof value==="object"?Object.assign({},value):{},changes=r.statusChanges&&typeof r.statusChanges==="object"?r.statusChanges:{};r.statusChanges={};Object.entries(changes).forEach(([k,v])=>r.statusChanges[k]=v==="active"?"active":"frozen");r.freezeSnapshots=r.freezeSnapshots&&typeof r.freezeSnapshots==="object"?r.freezeSnapshots:{};r.house=String(r.house||"");out[pg]=r});return out}

  function numeric(v){v=Number(v);return Number.isFinite(v)?v:0}

  function normalizePg(s){return String(s||"").trim().replace(/\s+/g," ")}

  function monthDefs(yearId){const y=parseInt(String(yearId).slice(0,4),10);return MONTH_NAMES.map((name,i)=>{const year=i<4?y:y+1,month=i<4?9+i:i-3;return {name,year,key:`${year}-${String(month).padStart(2,"0")}`,label:`${name} ${year}`}})}

  function rawSocialNumber(v){if(v===null||v===undefined||String(v).trim()==="")return null;const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null}

  function rawBaseByOrdinal(n){n=Math.max(0,parseInt(n,10)||0);if(n===1)return 14;if(n===2)return 13;if(n===3)return 12;if(n===4)return 11;if(n===5)return 10;if(n===6||n===7)return 9;if(n===8||n===9)return 8;if(n===10||n===11)return 7;if(n===12||n===13)return 6;if(n>=14&&n<=17)return 5;if(n>=18&&n<=21)return 4;if(n>=22&&n<=25)return 3;if(n>=26&&n<=35)return 2;if(n>=36)return 1;return 0}

  function rawStimaBand(value){const v=rawSocialNumber(value);if(v===null||v<1)return {label:"Stima non disponibile",modifier:0};if(v<=4)return {label:"Indisciplinato",modifier:-1};if(v<=11)return {label:"Mediocre",modifier:-1};if(v<=22)return {label:"Ordinario",modifier:0};if(v<=29)return {label:"Modello",modifier:1};return {label:"Prediletto",modifier:1}}

  function basePointsForCount(count){count=Math.max(0,parseInt(count,10)||0);let total=0;for(let i=1;i<=count;i++)total+=rawBaseByOrdinal(i);return total}

  function hasOwn(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k)}

  function normalizeRosterStatus(value){return value==="active"?"active":"frozen"}

  function statusStateForMonth(rec,monthKey){
    const changes=rec&&rec.statusChanges&&typeof rec.statusChanges==="object"?rec.statusChanges:{};
    let chosen="",status="active";
    Object.keys(changes).sort().forEach(k=>{if(k<=monthKey&&k>=chosen){chosen=k;status=normalizeRosterStatus(changes[k])}});
    return {status,changeKey:chosen};
  }

  function statusForMonth(rec,monthKey){return statusStateForMonth(rec,monthKey).status}

  function currentRosterStatus(rec){
    const changes=rec&&rec.statusChanges&&typeof rec.statusChanges==="object"?rec.statusChanges:{};
    const keys=Object.keys(changes).sort();
    return keys.length?normalizeRosterStatus(changes[keys[keys.length-1]]):"active";
  }

  function emptyHouseTotals(){const out={};HOUSE_KEYS.forEach(h=>out[h]=0);return out}

  function sanitizePublicPerson(v){if(!v||typeof v!=="object")return null;const pg=normalizePg(v.pg),house=String(v.house||"");if(!pg)return null;return {pg,house:HOUSES[house]?house:"",points:numeric(v.points),posts:numeric(v.posts),stimaPoints:numeric(v.stimaPoints),rolePoints:numeric(v.rolePoints),extraPoints:numeric(v.extraPoints)}}

  function sanitizeMonthlyStats(raw){raw=raw&&typeof raw==="object"?raw:{};const houseLeaders={};HOUSE_KEYS.forEach(h=>{const x=sanitizePublicPerson(raw.houseLeaders&&raw.houseLeaders[h]);if(x)houseLeaders[h]=x});const status=["live","closed","upcoming"].includes(raw.status)?raw.status:"upcoming";return {status,signature:String(raw.signature||""),overall:sanitizePublicPerson(raw.overall),houseLeaders,postsChampion:sanitizePublicPerson(raw.postsChampion),stimaChampion:sanitizePublicPerson(raw.stimaChampion),houseSpirit:sanitizePublicPerson(raw.houseSpirit),extraChampion:sanitizePublicPerson(raw.extraChampion)}}

  function statsSignature(rows){const src=JSON.stringify(rows.map(x=>[x.pg,x.house,x.points,x.posts,x.stimaPoints,x.rolePoints,x.extraPoints]));let h=2166136261;for(let i=0;i<src.length;i++){h^=src.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

  function automaticMonthSummary(pg,monthKey){const ss=state.docData.summaries&&state.docData.summaries[pg],m=ss&&ss.months&&ss.months[monthKey];if(m&&typeof m==="object"){const posts=Math.max(0,parseInt(m.posts,10)||0),stimaValue=m.stimaValue??null,band=rawStimaBand(stimaValue),base=basePointsForCount(posts),stimaPoints=band.modifier*posts,role=numeric(m.role),manual=numeric(m.manual);return Object.assign({},m,{posts,base,stimaValue,stimaLabel:band.label,stimaModifier:band.modifier,stimaPoints,stima:stimaPoints,role,manual,total:base+stimaPoints+role+manual})}return {posts:0,base:0,stimaValue:null,stimaLabel:"",stimaModifier:0,stimaPoints:0,stima:0,role:0,manual:0,total:0}}

  function monthOverride(pg,monthKey){const p=state.docData.overrides&&state.docData.overrides[pg],o=p&&p[monthKey];return o&&typeof o==="object"&&!Array.isArray(o)?o:null}

  function monthSummary(pg,monthKey){const auto=automaticMonthSummary(pg,monthKey),o=monthOverride(pg,monthKey);if(!o)return Object.assign({},auto,{_automatic:auto,_override:null,_hasOverride:false});const posts=hasOwn(o,"postsValid")?Math.max(0,parseInt(o.postsValid,10)||0):Math.max(0,parseInt(auto.posts,10)||0),stimaValue=hasOwn(o,"stimaValue")?rawSocialNumber(o.stimaValue):auto.stimaValue,band=rawStimaBand(stimaValue),postsChanged=hasOwn(o,"postsValid"),stimaChanged=hasOwn(o,"stimaValue"),base=postsChanged?basePointsForCount(posts):numeric(auto.base),stimaPoints=(postsChanged||stimaChanged)?band.modifier*posts:numeric(auto.stimaPoints),role=hasOwn(o,"rolePoints")?numeric(o.rolePoints):numeric(auto.role),manual=hasOwn(o,"manualPoints")?numeric(o.manualPoints):numeric(auto.manual);return {posts,base,stimaValue,stimaLabel:band.label,stimaModifier:band.modifier,stimaPoints,stima:stimaPoints,role,manual,total:base+stimaPoints+role+manual,_automatic:auto,_override:o,_hasOverride:true}}

  function adjustmentsFor(pg,monthKey){const a=state.docData.adjustments&&state.docData.adjustments[pg];return a&&Array.isArray(a[monthKey])?a[monthKey]:[]}

  function adjustmentTotal(pg,monthKey){return adjustmentsFor(pg,monthKey).reduce((n,x)=>n+numeric(x.points),0)}

  function fantaAdjustmentTotal(pg,monthKey){return adjustmentsFor(pg,monthKey).reduce((n,x)=>n+(String(x&&x.type||"")==="fanta"?numeric(x.points):0),0)}

  function nonFantaAdjustmentTotal(pg,monthKey){return adjustmentsFor(pg,monthKey).reduce((n,x)=>n+(String(x&&x.type||"")==="fanta"?0:numeric(x.points)),0)}

  function allPgNames(){const seen={};[state.docData.summaries,state.docData.roster,state.docData.adjustments,state.docData.overrides].forEach(o=>Object.keys(o||{}).forEach(k=>seen[k]=1));return Object.keys(seen).sort((a,b)=>a.localeCompare(b,"it",{sensitivity:"base"}))}

  function effectiveMonthContribution(pg,monthKey){
    const rec=state.docData.roster[pg]||{},stateAt=statusStateForMonth(rec,monthKey);
    if(stateAt.status==="active"){
      const m=monthSummary(pg,monthKey);
      return {status:"active",posts:numeric(m.posts),base:numeric(m.base),stimaValue:m.stimaValue??null,stimaLabel:String(m.stimaLabel||""),stimaModifier:numeric(m.stimaModifier),stimaPoints:numeric(m.stimaPoints),role:numeric(m.role),manual:numeric(m.manual),staffDirect:adjustmentTotal(pg,monthKey),staffNonFanta:nonFantaAdjustmentTotal(pg,monthKey),staffFanta:fantaAdjustmentTotal(pg,monthKey),snapshot:false};
    }
    const snap=rec.freezeSnapshots&&typeof rec.freezeSnapshots==="object"?rec.freezeSnapshots[stateAt.changeKey]:null;
    /* Nel mese esatto del congelamento conserviamo solo ciò che era già maturato
       al momento del click. Nei mesi successivi il contributo è zero. */
    if(stateAt.changeKey===monthKey&&snap&&typeof snap==="object")return {status:"frozen",posts:numeric(snap.posts),base:numeric(snap.base),stimaValue:snap.stimaValue??null,stimaLabel:String(snap.stimaLabel||""),stimaModifier:numeric(snap.stimaModifier),stimaPoints:numeric(snap.stimaPoints),role:numeric(snap.role),manual:numeric(snap.manual),staffDirect:numeric(snap.staffDirect),staffNonFanta:snap.staffNonFanta===undefined?numeric(snap.staffDirect):numeric(snap.staffNonFanta),staffFanta:numeric(snap.staffFanta),snapshot:true};
    return {status:"frozen",posts:0,base:0,stimaValue:null,stimaLabel:"",stimaModifier:0,stimaPoints:0,role:0,manual:0,staffDirect:0,staffNonFanta:0,staffFanta:0,snapshot:false};
  }

  function calculateMonth(monthKey){
    const houses={};HOUSE_KEYS.forEach(h=>houses[h]={house:h,activePgs:[],inactivePgs:[],casualPgs:[],competitivePgs:[],casualPoints:0,competitivePoints:0,preservedPerformance:0,directZero:0,elfoDirect:0,staffDirect:0,fantaDirect:0,virtual:0,virtualPoints:0,balancedPerformance:0,total:0,median:0,zeroFallback:false});
    const competitiveValues=[];
    allPgNames().forEach(pg=>{
      const rec=state.docData.roster[pg];if(!rec||!HOUSES[rec.house])return;
      const c=effectiveMonthContribution(pg,monthKey),h=houses[rec.house],posts=numeric(c.posts);
      const elfoExtra=numeric(c.role)+numeric(c.manual),nonFantaStaff=numeric(c.staffNonFanta),fanta=numeric(c.staffFanta);
      const core=numeric(c.base)+numeric(c.stimaPoints)+elfoExtra+nonFantaStaff;
      h.elfoDirect+=elfoExtra;h.staffDirect+=nonFantaStaff+fanta;h.fantaDirect+=fanta;
      if(c.status!=="active"){h.preservedPerformance+=core;return}
      if(posts<=0){h.inactivePgs.push(pg);h.directZero+=elfoExtra+nonFantaStaff;return}
      h.activePgs.push(pg);
      if(posts<=4){h.casualPgs.push(pg);h.casualPoints+=core}
      else{h.competitivePgs.push(pg);h.competitivePoints+=core;competitiveValues.push(core)}
    });
    competitiveValues.sort((a,b)=>a-b);
    let median=0;
    if(competitiveValues.length){const mid=Math.floor(competitiveValues.length/2);median=competitiveValues.length%2?competitiveValues[mid]:Math.floor((competitiveValues[mid-1]+competitiveValues[mid])/2)}
    const maxCompetitive=Math.max(0,...HOUSE_KEYS.map(h=>houses[h].competitivePgs.length));
    HOUSE_KEYS.forEach(k=>{
      const h=houses[k];h.median=median;h.virtual=Math.max(0,maxCompetitive-h.competitivePgs.length);h.virtualPoints=h.virtual*median;
      h.balancedPerformance=h.casualPoints+h.competitivePoints+h.preservedPerformance+h.directZero+h.virtualPoints;
      h.total=h.balancedPerformance+h.fantaDirect;
    });
    return {houses,maxActive:maxCompetitive,maxCompetitive,median,competitiveValues};
  }

  function calculateAnnual(){const totals={};HOUSE_KEYS.forEach(h=>totals[h]=0);monthDefs(state.yearId).forEach(m=>{const c=calculateMonth(m.key);HOUSE_KEYS.forEach(h=>totals[h]+=c.houses[h].total)});return totals}

  function calculateMonthlyPublicStats(monthKey){
    const people=[];
    allPgNames().forEach(pg=>{
      const rec=state.docData.roster[pg];
      /* Un PG oggi congelato non compare in nessun record; un Attivo con 0 post
         non è eleggibile ai record del mese pur restando nel roster. */
      if(!rec||!HOUSES[rec.house]||currentRosterStatus(rec)==="frozen"||statusForMonth(rec,monthKey)!=="active")return;
      const m=monthSummary(pg,monthKey),staff=adjustmentTotal(pg,monthKey);
      if(numeric(m.posts)<=0)return;
      const points=numeric(m.base)+numeric(m.stimaPoints)+numeric(m.role)+numeric(m.manual)+staff;
      const extraPoints=numeric(m.manual)+Math.max(0,staff);
      people.push({pg,house:rec.house,points,posts:numeric(m.posts),stimaPoints:numeric(m.stimaPoints),rolePoints:numeric(m.role),extraPoints});
    });
    const pick=(arr,key,positiveOnly=false)=>{const pool=positiveOnly?arr.filter(x=>numeric(x[key])>0):arr.filter(x=>numeric(x[key])!==0||key==="points");return pool.length?pool.slice().sort((a,b)=>numeric(b[key])-numeric(a[key])||numeric(b.points)-numeric(a.points)||a.pg.localeCompare(b.pg,"it"))[0]:null};
    const houseLeaders={};HOUSE_KEYS.forEach(h=>{const x=pick(people.filter(p=>p.house===h),"points");if(x)houseLeaders[h]=x});
    return {status:"live",signature:statsSignature(people),overall:pick(people,"points"),houseLeaders,postsChampion:pick(people,"posts",true),stimaChampion:pick(people,"stimaPoints",true),houseSpirit:pick(people,"rolePoints",true),extraChampion:pick(people,"extraPoints",true)};
  }

  function calculatePublicStats(months){
    const defs=monthDefs(state.yearId),monthly={},wins={};HOUSE_KEYS.forEach(h=>wins[h]=0);
    const seasonRows=[];
    defs.forEach((md,i)=>{
      const totals=months&&months[md.key]?months[md.key]:emptyHouseTotals();
      const sum=HOUSE_KEYS.reduce((n,h)=>n+numeric(totals[h]),0);
      const ordered=HOUSE_KEYS.slice().sort((a,b)=>numeric(totals[b])-numeric(totals[a]));
      const top=numeric(totals[ordered[0]]),second=numeric(totals[ordered[1]]),leaders=ordered.filter(h=>numeric(totals[h])===top);
      const gap=ordered.length>1?Math.max(0,top-second):0;
      if(sum!==0&&leaders.length===1)wins[leaders[0]]++;
      seasonRows.push({key:md.key,label:md.label,points:sum,gap,house:leaders.length===1?leaders[0]:""});
      const next=defs[i+1],nextTotals=next&&months&&months[next.key]?months[next.key]:null,nextHasPoints=!!(nextTotals&&HOUSE_KEYS.some(h=>numeric(nextTotals[h])!==0));
      const old=state.publicData&&state.publicData.stats&&state.publicData.stats.months&&state.publicData.stats.months[md.key],fresh=calculateMonthlyPublicStats(md.key);
      fresh.status=nextHasPoints?"closed":(sum!==0?"live":"upcoming");
      if(old&&old.status==="closed"&&fresh.status==="closed"&&String(old.signature||"")===fresh.signature) monthly[md.key]=sanitizeMonthlyStats(old);
      else monthly[md.key]=fresh;
    });
    const active=seasonRows.filter(x=>x.points!==0),bestMonth=active.length?active.slice().sort((a,b)=>b.points-a.points)[0]:null,closestMonth=active.length?active.slice().sort((a,b)=>a.gap-b.gap||b.points-a.points)[0]:null;
    const winRows=HOUSE_KEYS.map(h=>({house:h,wins:wins[h]})).sort((a,b)=>b.wins-a.wins),maxWins=winRows[0]?.wins||0,monthlyWinner=maxWins>0&&winRows.filter(x=>x.wins===maxWins).length===1?winRows[0]:null;
    return {months:monthly,season:{bestMonth,closestMonth,monthlyWinner}};
  }

  function publicRosterFromPrivate(){const defs=monthDefs(state.yearId),rows=[];allPgNames().forEach(pg=>{const rec=state.docData.roster[pg];if(!rec||!HOUSES[rec.house])return;let posts=0,points=0,stimaValue=null,stimaLabel="";defs.forEach(md=>{const c=effectiveMonthContribution(pg,md.key);posts+=Math.max(0,parseInt(c.posts,10)||0);points+=numeric(c.base)+numeric(c.stimaPoints)+numeric(c.role)+numeric(c.manual)+numeric(c.staffDirect);if(c.stimaValue!==null&&c.stimaValue!==undefined){stimaValue=numeric(c.stimaValue);stimaLabel=String(c.stimaLabel||rawStimaBand(stimaValue).label||"")}});rows.push({pg,house:rec.house,stimaValue,stimaLabel,posts,points})});return rows.sort((a,b)=>a.pg.localeCompare(b.pg,"it",{sensitivity:"base"}))}

  function publicSnapshotFromPrivate(){const annual=calculateAnnual(),months={},breakdowns={};monthDefs(state.yearId).forEach(m=>{const calc=calculateMonth(m.key),tot=emptyHouseTotals();breakdowns[m.key]={};HOUSE_KEYS.forEach(h=>{const x=calc.houses[h];tot[h]=numeric(x.total);breakdowns[m.key][h]={casualPgs:x.casualPgs.length,casualPoints:numeric(x.casualPoints),competitivePgs:x.competitivePgs.length,competitivePoints:numeric(x.competitivePoints),median:numeric(calc.median),virtual:numeric(x.virtual),virtualPoints:numeric(x.virtualPoints),balancedPerformance:numeric(x.balancedPerformance),fantaDirect:numeric(x.fantaDirect),total:numeric(x.total)}});months[m.key]=tot});const stats=calculatePublicStats(months);stats.breakdowns=breakdowns;stats.roster=publicRosterFromPrivate();return {schemaVersion:1,yearId:state.yearId,annual,months,stats}}
  return publicSnapshotFromPrivate();
}
module.exports={buildPublicSnapshot};
