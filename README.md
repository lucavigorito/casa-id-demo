# Casa ID · versione demo

Casa ID è la carta d'identità digitale dell'immobile: un fascicolo per ogni immobile in cui agenzia, tecnico e notaio caricano i documenti, e il proprietario decide chi può vederli.

Questa è la **versione dimostrativa** da far provare a proprietari e professionisti. È un sito statico (HTML, CSS, JavaScript) che usa **Supabase** per account, database e archivio dei file (server in UE).

## Cosa fa

- Registrazione e accesso con email e password, scegliendo il ruolo: proprietario, familiare, agenzia, broker, tecnico, notaio.
- Fascicolo per immobile con codice Casa ID, sei sezioni, completezza, ricerca.
- Caricamento di PDF e immagini (fino a 20 MB) e visualizzazione dentro l'app.
- Accessi a livelli: titolare, delegato, professionista con sezioni e scadenza. Gli inviti si fanno per email, anche a chi non è ancora registrato.
- Link di sola lettura per banca, acquirente o inquilino, con scadenza e revoca.
- Scadenze inserite nei documenti, registro degli accessi.
- Servizi tecnici su preventivo: il professionista indica il costo totale, il proprietario accetta o rifiuta prima che la pratica parta.
- Esportazione dell'intero fascicolo in ZIP con indice CSV.
- Esempio illustrativo consultabile senza registrazione, pagina Domande frequenti.
- Fascicolo di esempio già compilato, per chi vuole provare subito.

Non sono inclusi SPID/CIE, pagamenti e notifiche email: arrivano con l'MVP.

## Struttura

| File | Contenuto |
| --- | --- |
| `index.html` | Pagina dell'applicazione |
| `app.js` | Logica dell'applicazione |
| `styles.css` | Stile (colori istituzionali, Titillium Web) |
| `config.js` | Indirizzo e chiave pubblica del progetto Supabase |
| `supabase/schema.sql` | Tabelle, permessi e archivio file da creare in Supabase |

## Messa online, passo per passo

### 1. Supabase
1. Crea un progetto (regione **Central EU – Frankfurt**).
2. Apri **SQL Editor › New query**, incolla tutto il contenuto di `supabase/schema.sql` e premi **Run**. Deve comparire "Success".
   Poi, in una nuova query, esegui allo stesso modo `supabase/migrazione-01-preventivi.sql` (servizi con preventivo).
3. In **Authentication › Sign In / Providers › Email** disattiva **Confirm email** (per la demo i tester entrano subito dopo la registrazione).
4. In **Authentication › URL Configuration** imposta **Site URL** con l'indirizzo del sito (lo avrai al punto 3).
5. In **Project Settings › API** copia **Project URL** e **anon public key** e incollali in `config.js`.

La chiave *anon public* è fatta per stare nel sito: i dati sono protetti dai permessi scritti in `schema.sql`. Non inserire mai nel sito la chiave *service_role*.

### 2. GitHub
Carica questi file in un repository (anche privato).

### 3. Vercel
1. **Add New › Project**, scegli il repository.
2. Framework preset: **Other**. Nessun comando di build.
3. **Deploy**. Otterrai un indirizzo tipo `casa-id-demo.vercel.app`.

Ogni modifica caricata su GitHub viene pubblicata in automatico.

## Provare in locale

Basta un server statico nella cartella del progetto, per esempio `npx serve .`, poi apri l'indirizzo indicato.

## Note sulla sicurezza della demo

- I permessi sono applicati dal database: ognuno vede solo i fascicoli e le sezioni a cui ha accesso.
- I file sono in un archivio privato; chi ha un link ospite valido vede solo i file delle sezioni condivise.
- È comunque una demo: usare solo documenti di prova, non documenti reali o dati di terzi.
