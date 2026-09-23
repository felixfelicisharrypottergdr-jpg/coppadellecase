"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {activeSchoolYearId,publicComparable,isNewerSource}=require("../lib/publication");
test("anno scolastico nel fuso italiano",()=>{
  assert.equal(activeSchoolYearId(new Date("2026-08-31T21:30:00Z")),"2025_26");
  assert.equal(activeSchoolYearId(new Date("2026-08-31T22:30:00Z")),"2026_27");
});
test("confronta il contenuto pubblico senza metadati, indipendente dall'ordine delle chiavi",()=>{
  const x={yearId:"2026_27",schemaVersion:1,annual:{a:1,b:2},months:{},stats:{season:{}}};
  const y={publishedAt:"ieri",stats:{season:{}},months:{},annual:{b:2,a:1},schemaVersion:1,yearId:"2026_27",sourceUpdateTime:"nascosto"};
  assert.equal(publicComparable(x),publicComparable(y));
});
test("non pubblicare modifiche vecchie o duplicate",()=>{
  const when=n=>({toMillis:()=>n});
  assert.equal(isNewerSource(when(200),when(100)),true);
  assert.equal(isNewerSource(when(100),when(100)),false);
  assert.equal(isNewerSource(when(50),when(100)),false);
  assert.equal(isNewerSource(when(100),undefined),true);
});
