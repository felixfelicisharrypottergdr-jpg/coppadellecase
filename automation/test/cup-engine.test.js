"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {buildPublicSnapshot}=require("../lib/cup-engine");

const year="2026_27",month="2026-09";
function fixture(){
  return {
    roster:{
      A:{house:"grifondoro"},B:{house:"tassorosso"},
      C:{house:"corvonero"},D:{house:"serpeverde"}
    },
    summaries:{
      A:{months:{[month]:{posts:5,stimaValue:12}}},
      B:{months:{[month]:{posts:3,stimaValue:26}}},
      C:{months:{[month]:{posts:6,stimaValue:8}}},
      D:{months:{[month]:{posts:1,stimaValue:3}}}
    },
    adjustments:{A:{[month]:[{type:"fanta",points:7}]}}
  };
}
test("classificazione, mediana globale, punti virtuali e Fanta separato",()=>{
  const p=buildPublicSnapshot(year,fixture());
  const x=p.stats.breakdowns[month];
  assert.equal(x.grifondoro.median,61);
  assert.equal(x.grifondoro.virtual,0);
  assert.equal(x.grifondoro.total,67);
  assert.equal(x.corvonero.total,63);
  assert.equal(x.tassorosso.virtual,1);
  assert.equal(x.tassorosso.total,103);
  assert.equal(x.serpeverde.total,74);
  assert.equal(p.annual.tassorosso,103);
});
test("registro pubblico PG con Stima, post e punti personali",()=>{
  const p=buildPublicSnapshot(year,fixture());
  const a=p.stats.roster.find(x=>x.pg==="A");
  assert.deepEqual({house:a.house,posts:a.posts,points:a.points,stimaValue:a.stimaValue},
    {house:"grifondoro",posts:5,points:67,stimaValue:12});
  assert.equal(p.stats.roster.length,4);
});
test("nessun competititivo: non crea PG virtuali",()=>{
  const f=fixture();
  for(const p of Object.values(f.summaries)){p.months[month].posts=2}
  const x=buildPublicSnapshot(year,f).stats.breakdowns[month];
  for(const h of Object.keys(x)){assert.equal(x[h].virtual,0);assert.equal(x[h].median,0)}
});
test("conserva i record chiusi già pubblicati se i dati non cambiano",()=>{
  const f=fixture(),first=buildPublicSnapshot(year,f);
  const next=buildPublicSnapshot(year,f,first);
  assert.deepEqual(next.stats.months[month],first.stats.months[month]);
});
test("contributo maturato da PG congelato e Fanta separato",()=>{
  const f=fixture();
  f.roster.D.statusChanges={[month]:"frozen"};
  f.roster.D.freezeSnapshots={[month]:{posts:1,base:14,stimaPoints:-1,staffFanta:2,staffNonFanta:0}};
  const d=buildPublicSnapshot(year,f).stats.breakdowns[month].serpeverde;
  assert.equal(d.virtual,1);
  assert.equal(d.fantaDirect,2);
  assert.equal(d.total,76); // 13 punti maturati + 61 virtuali + 2 Fanta
});
