"use strict";
/**
 * Pubblicazione senza Cloud Functions e senza piano Blaze.
 * Questo script viene eseguito da GitHub Actions ogni cinque minuti.
 *
 * 2 letture Firestore per esecuzione (documento privato + pubblico),
 * 0 scritture se il documento privato non è cambiato; altrimenti massimo
 * 1 scrittura del documento pubblico. Non legge la collezione Elfi.
 */
const {buildPublicSnapshot}=require("./lib/cup-engine");
const {YEAR_RE,activeSchoolYearId,publicComparable,isNewerSource}=require("./lib/publication");

async function publishOnce({db,yearId,logger=console}){
  if(!YEAR_RE.test(yearId))throw new Error("Anno scolastico non valido");
  const {FieldValue}=require("firebase-admin/firestore");
  const privateRef=db.collection("coppa_case").doc(yearId);
  const publicRef=db.collection("coppa_case_pubblica").doc(yearId);
  let outcome="nessuna modifica";

  await db.runTransaction(async tx=>{
    // Le due letture avvengono DENTRO la transazione, quindi i documenti
    // restano coerenti anche se nel frattempo un Elfo registra un altro post.
    const privateSnap=await tx.get(privateRef);
    if(!privateSnap.exists){outcome="anno non ancora inizializzato";return}
    const publicSnap=await tx.get(publicRef);
    const previous=publicSnap.exists?publicSnap.data()||{}:{};
    const sourceTime=privateSnap.updateTime;
    if(!isNewerSource(sourceTime,previous.sourceUpdateTime)){
      outcome="riepilogo già elaborato";
      return;
    }

    // Engine ricavato dalle stesse funzioni del pannello Narratore.
    const fresh=buildPublicSnapshot(yearId,privateSnap.data()||{},previous);
    if(publicComparable(previous)===publicComparable(fresh)){
      // Anche se la modifica non cambia i punti (es. post escluso),
      // contrassegniamo la versione come elaborata una sola volta.
      if(publicSnap.exists)tx.update(publicRef,{sourceUpdateTime:sourceTime});
      outcome="cambiamento senza variazione della classifica";
      return;
    }
    tx.set(publicRef,{
      ...fresh,
      sourceUpdateTime:sourceTime,
      publishedAt:FieldValue.serverTimestamp()
    });
    outcome="classifica e registro PG pubblicati";
  },{maxAttempts:3});

  logger.log(`Coppa ${yearId}: ${outcome}`);
  return outcome;
}

async function main(){
  const secret=process.env.COPPA_FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!secret)throw new Error("Configura il secret GitHub COPPA_FIREBASE_SERVICE_ACCOUNT_JSON; nessuna credenziale va salvata nel repository.");
  const {initializeApp,cert,getApps}=require("firebase-admin/app");
  const {getFirestore}=require("firebase-admin/firestore");
  let serviceAccount;
  try{serviceAccount=JSON.parse(secret)}
  catch(_){throw new Error("Il secret COPPA_FIREBASE_SERVICE_ACCOUNT_JSON non contiene un JSON valido.");}
  if(!serviceAccount.project_id||!serviceAccount.private_key||!serviceAccount.client_email){
    throw new Error("Credenziale Firebase incompleta (project_id, private_key o client_email mancanti).");
  }
  if(serviceAccount.project_id!=="conteggi-eee1b"){
    throw new Error("Il secret punta a un progetto Firebase diverso da conteggi-eee1b.");
  }
  if(!getApps().length)initializeApp({credential:cert(serviceAccount),projectId:serviceAccount.project_id});
  const yearId=process.env.COPPA_YEAR_ID||activeSchoolYearId();
  await publishOnce({db:getFirestore(),yearId});
}

if(require.main===module){
  main().catch(e=>{console.error("Pubblicazione Coppa non riuscita:",e.code||e.message||"errore sconosciuto");process.exitCode=1;});
}
module.exports={publishOnce};
