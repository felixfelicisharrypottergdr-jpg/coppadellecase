# Coppa delle Case — aggiornamento automatico gratuito

**Nessun piano Firebase a pagamento e nessuna Cloud Function.** La repository è
pubblica: il workflow utilizza i runner standard gratuiti di GitHub Actions.
Gli Elfi scrivono già il riepilogo nel documento privato
`coppa_case/{anno}` dopo un salvataggio personale riuscito; la sincronizzazione
non esegue scansioni della collection degli Studenti.

Ogni cinque minuti GitHub Actions:
1. legge il SOLO documento privato dell'anno corrente;
2. legge il SOLO documento pubblico dello stesso anno;
3. se le modifiche sono già pubblicate, non scrive nulla;
4. se è cambiato un riepilogo Elfo oppure una rettifica Staff, ricalcola
   Casual/Competitivi, mediana, virtuali, FantaHogwarts, record mensili,
   riepilogo Casa per Casa e Riepilogo PG; aggiorna il documento pubblico.

Una pagina aperta aggiorna silenziosamente il documento pubblico al massimo
ogni dieci minuti, soltanto se la scheda del browser è visibile. Il pulsante
«Aggiorna» rimane disponibile.

## Attivazione una tantum (necessaria)

Il workflow esiste nel codice ma **rimane inattivo finché non configuri il
secret**. Non caricare la chiave in una conversazione, in file committati o
nel sito.

1. In Firebase Console seleziona il progetto `conteggi-eee1b` e resta nel piano
   gratuito Spark. Vai in **Impostazioni progetto → Account di servizio →
   Firebase Admin SDK → Genera nuova chiave privata**. Conserva il file JSON
   appena generato senza caricarlo nella repository.
2. Nella repository GitHub
   `felixfelicisharrypottergdr-jpg/coppadellecase`, apri
   **Settings → Secrets and variables → Actions → New repository secret**.
   Imposta il nome **COPPA_FIREBASE_SERVICE_ACCOUNT_JSON** e nel valore incolla
   il CONTENUTO COMPLETO del file JSON generato al punto precedente.
   Conferma con **Add secret**. Il valore è cifrato e non viene incluso nei log.
3. In **Actions**, scegli il workflow
   «Coppa delle Case - aggiornamento gratuito», abilitalo se GitHub lo richiede
   e premi **Run workflow** per eseguire una prima sincronizzazione manuale.
   Nei log dovrebbe apparire "classifica e registro PG pubblicati" oppure
   "riepilogo già elaborato".
4. Da quel momento GitHub esegue i controlli autonomamente; non occorre aprire
   Gestione Narratore. Se aggiungi un PG nuovo, assegnagli prima la Casa nel
   pannello Narratore (il semplice riepilogo Elfo non può dedurre la Casa).

Se non trovi "Genera nuova chiave privata", potrebbero esserci restrizioni
amministrative sull'account Google Cloud: non aggirarle inserendo credenziali
nel codice del sito.

## Costi e limiti

- **GitHub Actions:** runner standard di repository pubblica gratuito.
  Questo progetto non usa runner maggiorati, artifact storage né cache a
  pagamento.
- **Firestore Spark:** massimo due letture ogni cinque minuti, cioè 576 letture
  al giorno per il processo automatico, più le letture del sito pubblico.
  Una scrittura soltanto quando il documento privato cambia e richiede
  una pubblicazione o l'aggiornamento della versione elaborata. Il conteggio
  non include le letture già effettuate dagli Elfi o dagli altri tool.
- La quota gratuita Firestore Standard al momento della preparazione è di
  50.000 letture e 20.000 scritture di documenti al giorno **per l'intero
  progetto**. Restano soggette a limiti anche dimensione documento (1 MiB),
  spazio e trasferimento in uscita. Non attivare Blaze se non vuoi fatture.

**Non è real-time istantaneo:** GitHub può posticipare le esecuzioni programmate,
e una pagina già aperta può impiegare un ulteriore intervallo di controllo per
mostrare i nuovi numeri. Un refresh manuale della pagina legge subito l'ultimo
documento già pubblicato.

**Attenzione GitHub:** in una repository pubblica GitHub può disattivare i
workflow programmati dopo 60 giorni senza attività nella repository. In tal
caso riabilita il workflow nella scheda Actions; fino alla riattivazione i dati
resteranno all'ultimo aggiornamento. Questo è un limite della soluzione gratuita.

## Sicurezza e manutenzione

La chiave di un account di servizio consente l'accesso server a Firestore
senza dipendere dalle regole dei player. Proteggi il secret, limita chi può
modificare il workflow sulla branch principale e revoca la chiave Firebase
se sospetti una compromissione.

Il workflow legge solo i due documenti della Coppa dell'anno corrente.
`lib/cup-engine.js` contiene gli stessi calcoli della pagina Narratore,
ma è una copia separata: quando si modifica l'algoritmo nel tool occorre
aggiornare anche il modulo e rieseguire i test.
