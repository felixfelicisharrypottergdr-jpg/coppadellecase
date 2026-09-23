"use strict";
const YEAR_RE=/^\d{4}_\d{2}$/;
function activeSchoolYearId(now=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Rome",year:"numeric",month:"2-digit"}).formatToParts(now);
  const get=key=>Number(parts.find(x=>x.type===key)?.value);
  const year=get("year"),month=get("month");
  const start=month>=9?year:year-1;
  return `${start}_${String((start+1)%100).padStart(2,"0")}`;
}
function deepSort(value){
  if(Array.isArray(value))return value.map(deepSort);
  if(value&&typeof value==="object"&&!(value instanceof Date)){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,deepSort(value[key])]));
  }
  return value;
}
function publicComparable(value){
  value=value&&typeof value==="object"?value:{};
  return JSON.stringify(deepSort({
    schemaVersion:1,
    yearId:value.yearId||"",
    annual:value.annual||{},
    months:value.months||{},
    stats:value.stats||{}
  }));
}
function isNewerSource(sourceTime,processedTime){
  const a=sourceTime?.toMillis?.(),b=processedTime?.toMillis?.();
  return typeof a==="number"&&(typeof b!=="number"||a>b);
}
module.exports={YEAR_RE,activeSchoolYearId,publicComparable,isNewerSource};
