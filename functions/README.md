# Coppa delle Case — pubblicazione automatica

Il tool `index.html` resta ospitato su GitHub Pages. Gli Elfi Studenti continuano a
scrivere il loro riepilogo nell'unico documento privato
`coppa_case/{anno}`, con i permessi Firestore già in uso.

Questa Cloud Function ascolta solo le modifiche di quel documento e ricalcola
l'intera classifica (Casual, Competitivi, mediana, PG virtuali, Fanta,
riepilogo Casa per Casa e Riepilogo PG). Pubblica il risultato in
`coppa_case_pubblica/{anno}` usando Firebase Admin SDK. Non ha bisogno
della password Staff o di modifiche alle Firestore Rules dei PG.

## Costi e letture

Per ogni variazione del documento privato: un'attivazione della Function,
una lettura transazionale del solo documento pubblico e una scrittura dello
stesso documento. NON viene eseguita alcuna scansione della collection Elfi.
L'evento include già il documento privato aggiornato. In condizioni normali,
un post salvato da Elfo = una modifica del documento privato; verificare
il comportamento reale del bridge se salva più volte per azione.

L'apertura della pagina pubblica continua a usare una lettura REST del
documento pubblico: chi apre la pagina dopo un post vede i dati aggiornati
non appena la Cloud Function ha terminato. Le pagine già aperte mantengono
il pulsante Aggiorna: il refresh automatico dei browser richiederebbe
ulteriori letture per ogni visitatore, e NON viene abilitato qui.

Firebase Cloud Functions richiede il piano Blaze (fatturazione attiva),
anche quando l'uso effettivo rimane nella quota gratuita. Possono esserci
piccoli costi di Artifact Registry/Cloud Build in fase di distribuzione.

## Attivazione (una sola volta, da un account autorizzato)

1. Abilitare il piano Blaze nel progetto Firebase `conteggi-eee1b` e
   impostare un avviso di budget.
2. Installare Node.js 22 e Firebase CLI, autenticarsi:
   `npm install -g firebase-tools`, `firebase login`.
3. Dalla root di QUESTA repository: `cd functions && npm install && npm test && cd ..`.
4. `firebase deploy --only functions:publishCupPublicOnPrivateWrite --project conteggi-eee1b`.
5. Aggiungere un nuovo post da un Elfo esistente (PG già associato a una Casa)
   e verificare i log della Function e la classifica pubblica.

La sola modifica su GitHub **non attiva** la Function: va distribuita nel
progetto Firebase. Non è necessario che il Narratore apra la gestione.

Il trigger non inserisce automaticamente i PG nuovi nel roster privato:
anche oggi la Casa del PG viene associata nel pannello Narratore; il nuovo
PG diventa conteggiabile una volta associato alla Casa.

## Manutenzione

`functions/lib/cup-engine.js` contiene le stesse funzioni di calcolo
del tool attuale. Quando cambia l'algoritmo nell'`index.html`,
sincronizzare questo modulo ed eseguire `npm test` prima del deploy.

La Function pubblica solo dati già destinati alla vista pubblica.
Nessuna password o dato riservato degli Elfi viene copiato nel documento
pubblico. Eventi vecchi o duplicati vengono scartati tramite
`sourceUpdateTime` e transazione sul documento pubblico.

In caso di errori di produzione controllare:
`firebase functions:log --only publishCupPublicOnPrivateWrite --project conteggi-eee1b`.
