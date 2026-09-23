"use strict";
/*
 * Pubblicazione automatica della Coppa.
 * Si attiva sulle scritture GIA' effettuate dagli Elfi nel documento privato.
 * L'evento contiene l'intero documento: NON legge gli Elfi uno a uno e
 * NON richiede che un Narratore lasci aperta la pagina di gestione.
 * L'unica lettura aggiuntiva del backend è il documento pubblico, in
 * una transazione che blocca la pubblicazione di eventi fuori ordine.
 */
const {onDocumentWritten}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue,Timestamp}=require("firebase-admin/firestore");
const {buildPublicSnapshot}=require("./lib/cup-engine");

initializeApp();
const db=getFirestore();

exports.publishCupPublicOnPrivateWrite=onDocumentWritten(
  {
    document:"coppa_case/{yearId}",
    region:"europe-west1",
    memory:"256MiB",
    maxInstances:1,
    concurrency:1,
    retry:false
  },
  async event=>{
    const after=event.data?.after;
    // La cancellazione del documento privato non cancella la classifica storica.
    if(!after?.exists)return;
    const yearId=String(event.params.yearId||"");
    if(!/^\d{4}_\d{2}$/.test(yearId))return;
    const privateData=after.data()||{};
    const sourceUpdateTime=after.updateTime||
      Timestamp.fromDate(new Date(event.time||Date.now()));
    const ref=db.doc(`coppa_case_pubblica/${yearId}`);

    await db.runTransaction(async tx=>{
      const existingSnap=await tx.get(ref); // 1 sola lettura: documento pubblico
      const existing=existingSnap.exists?existingSnap.data():{};
      const processed=existing.sourceUpdateTime;
      if(processed?.toMillis?.()>=sourceUpdateTime.toMillis())return;

      // Sono riutilizzate le stesse funzioni di calcolo del tool browser.
      // Le statistiche dei mesi chiusi vengono preservate come nel pannello Staff.
      const next=buildPublicSnapshot(yearId,privateData,existing);
      tx.set(ref,{
        ...next,
        publishedAt:FieldValue.serverTimestamp(),
        sourceUpdateTime
      });
    });
  }
);
