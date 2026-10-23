# Teacher Service — Roadmap & Contratti di Dominio C3–C7
**Sistema Integrato di Esercitazioni, Verifiche, Studenti, Consegne, Correzioni, Monitoraggio Live e Anticopiatura**

**Aggiornato:** 2026-10-23 (Europe/Rome)
**Ruolo:** Software Engineering / UI-UX Engineering
**Stato Normativo:** Approvato dal Domain Owner
**Riferimenti di Dominio:** Dossier 01–11, in particolare Dossier 04 (§46–48), Dossier 05 (§56–57), Dossier 06 (§1–4), Dossier 09 (§1–6).

---

## 1. Visione di Prodotto & Principi Architetturali

Il sistema Teacher Service si estende oltre la preparazione lezioni ("Tomorrow is ready" - T1) integrando in un unico flusso digitale:
1. **Homepage Unificata**: punto di ingresso chiaro con biforcazione immediata tra **Area Studenti** (pubblica) e **Area Docente** (protetta).
2. **Identificazione Leggera Studenti**: nessun account permanente o password. Il docente distribuisce un codice/QR monouso individuale per attività; il riscatto emette una sessione temporanea, revocabile e legata allo studente e alla prova. La rubrica non è esposta come metodo di autenticazione.
3. **Dominio Unificato Attività (Dossier 05 §1)**: verifiche sommative ed esercitazioni formative condividono la stessa struttura (quesiti a scelta multipla, a risposta aperta, codice sorgente e quesiti con allegati file).
4. **Postazione d'Aula & Seat Map (Dossier 05)**: all'inizio di ogni attività, lo studente dichiara obbligatoriamente fila, banco e i vicini di banco immediati (con opzione esplicita «Nessuno»).
5. **Autosalvataggio Persistente & Resilienza**: salvataggio continuo in background delle risposte fornite, con possibilità di chiusura accidentale del browser e ripristino istantaneo della sessione.
6. **Monitoraggio d'Aula Non Invasivo (Dossier 05)**: visualizzazione in tempo reale dello stato di avanzamento degli studenti (risposte effettivamente salvate) e della disposizione fisica dei banchi. **Zero proctoring invasivo**: nessun tracciamento di tasti, telecamere, schede del browser o microfoni.
7. **Grading a Due Livelli & Sovranità del Docente (Dossier 06)**: correzione deterministica (per quiz oggettivi) ed assistita da AI (per quesiti aperti/codice). La proposta AI è sempre un suggerimento non vincolante; il voto finale appartiene esclusivamente al docente.
8. **Integrità Multilivello senza Profiling (Dossier 06)**: rilevamento di correlazioni su 5 livelli (prossimità Seat Map, errori rari identici, codice superfluo identico, similarità semantica/AST, fonti web). Le evidenze sono registrate in uno storico riservato al docente, senza produrre punteggi di colpevolezza o sanzioni automatiche.
9. **Superfici di Accesso e Sicurezza**:
   - Superficie pubblica studente e API di consultazione: nessun Cloudflare Access, ma ogni sessione/operazione sul tentativo richiede il codice/session token previsto; soluzioni (`teacher_solution`) e rubriche (`rubric_json`) sono rimosse lato server.
   - Area Docente e Server MCP: Cloudflare Access più autorizzazione esplicita del principal docente (`verifyTeacherAuthorization`, fail-closed). La navigazione hash del frontend non è un confine di sicurezza.

---

## 2. Matrice dello Stato Funzionale (CURRENT / PLANNED / DEPRECATED)

| Componente / Area | Stato | Dettagli Architetturali |
|---|---|---|
| **Preparazione Lezioni T1 ("Tomorrow is ready")** | **CURRENT** | Lesson Plan, Teacher Script, Dispensa Studente, Esercizi, Modali, Conferma e Versionamento. Intatto e funzionante. |
| **Homepage Portale con Biforcazione Studente/Docente** | **CURRENT** | Homepage e routing client (`#/`, `#/studente`, `#/docente`); il routing hash è solo navigazione, mai autorizzazione. |
| **Identificazione Leggera Studente** | **CURRENT** | Codice/QR individuale monouso per attività e sessione breve revocabile; nessun account permanente e nessuna autenticazione tramite elenco pubblico. |
| **Dichiarazione Seat Map (Fila, Banco, Vicini)** | **CURRENT** | Modulo obbligatorio con fila, banco e scelta «Nessuno» per i vicini; persistenza lato server. |
| **Autosalvataggio e Svolgimento Prova (Frontend)** | **CURRENT** | Quesiti multipli, aperti, codice e allegati; revisioni monotone, cache IndexedDB isolata per sessione, ripristino offline e riconciliazione esplicita dei conflitti. La copia locale non è presentata come salvata sul server. |
| **API Studente Isolate (`/api/student/*`)** | **CURRENT** | Consultazione pubblica dove appropriato; ogni accesso/modifica al tentativo è vincolato a session token individuale. Soluzioni e rubriche sono filtrate lato server. |
| **Timer & Scadenza (C4)** | **CURRENT** | Scadenza calcolata dal server e persistente attraverso i refresh; conto alla rovescia e avvisi UI a 10/5 minuti. Upload e scritture tardive vengono respinti; l’eventuale tempo extra è gestito dal dato server esistente. |
| **Editor di Codice e Allegati (C4)** | **CURRENT** | Editor leggero con numeri riga, indentazione e supporto touch; anteprima protetta per immagini, PDF e testo/codice. |
| **Consegna Definitiva (C4)** | **CURRENT** | Riepilogo risposte/allegati prima della conferma, snapshot dell’invio, blocco delle modifiche concorrenti e tentativo sigillato lato server. |
| **Protezione Area Docente & MCP** | **CURRENT** | Cloudflare Access più autorizzazione esplicita teacher principal; fallimento chiuso 401/403. Nessuna modifica d’infrastruttura in C4. |
| **Dashboard Docente Multi-Scheda (C5)** | **CURRENT** | Panoramica operativa con code per preparazione, prove attive, consegne da correggere e valutazioni confermate; collegamenti rapidi a monitoraggio e correzione. |
| **Registro Studenti (Docente)** | **CURRENT** | Inserimento singolo, importazione massiva un nominativo per riga, rimozione. |
| **Monitoraggio Live d'Aula (Seat Map & Roster)** | **CURRENT** | Seat Map e roster, presenti/non iniziati/in corso/consegnati/ritirati, timestamp ultimo autosave confermato dal server, conteggio risposte, stato timer e segnalazione singola delle nuove consegne; polling ogni 10s. Assenza di aggiornamenti non è interpretata come inattività o condotta scorretta. |
| **Gestione Consegne e Revisione Voto Docente (C5)** | **CURRENT** | Correzione per studente e per quesito, punteggi/feedback/note, proposte deterministiche/AI non definitive, conferma docente, cronologia non distruttiva, statistiche e export CSV/JSON/Markdown. Le metriche usano soltanto voti definitivi confermati e dichiarano il denominatore. |
| **Integrity Evidence & UI Docente (C6)** | **CURRENT — LOCALE** | Vista funzionale collegata alle API protette: evidenze on-demand, filtri per tipo/revisione, confronto contestuale di risposte, review docente append-only. Nessuna decisione o sanzione automatica; non rilasciato in produzione. |
| **Ambiente di Anteprima Locale Isolato (`pnpm dev:preview`)** | **CURRENT** | Esecuzione locale e su LAN Wi-Fi (0.0.0.0), storage isolato in `.tmp/dev-preview/`, seed dati dimostrativi, cleanup sicuro. |
| **Test browser C4** | **CURRENT** | Flusso Playwright reale su Chromium locale con due studenti e viewport mobile/tablet/desktop, autosave, interruzione/ripristino offline, timer, allegati e verifica docente. Emulazione viewport, non collaudo su dispositivi fisici. |
| **Test browser C5** | **CURRENT** | Flusso Playwright reale su frontend e HTTP locale: docente crea/attiva, due studenti lavorano, monitoraggio, tempo extra idempotente, consegna, ritiro/riapertura, correzione per quesito, conferma voti, statistiche ed export; viewport desktop/tablet/mobile. Dati SQLite/FileStore sintetici isolati e AI mock. |
| **Operazioni Docente Durante la Prova (C5)** | **CURRENT** | Tempo extra configurabile e azione rapida; ritiro docente distinto dalla consegna volontaria; riapertura con motivazione e controllo di scadenza/sessione. Operazioni idempotenti, condizionali e registrate nell'audit; nessuna risposta già salvata viene eliminata. |
| **MCP Assessment & Integrity Evidence (C6)** | **CURRENT — LOCALE** | Tool teacher-authorized per elenco/dettaglio consegne, proposta di grading AI non finale, analisi deterministica e registrazione della review. Il confronto codice è lessicale (JavaScript/TypeScript/Python), non AST; semantica, Web e allegati non sono analizzati. |
| **Deployment e Rilascio Infrastrutturale K3s (C7)** | **PLANNED** | Verifica su ingress cluster K3s, aggiornamento manifesti se necessario, test in ambiente reale. |
| **Proctoring Invasivo / Tracciamento Webcam / Keylogger** | **DEPRECATED / PROHIBITED** | Rigorosamente escluso e vietato da policy etica e normativa scolastica. |
| **Vecchia Dashboard Monolitica T1 senza schede** | **DEPRECATED** | Sostituita dal router e dalla shell modulare multi-scheda. |

---

## 3. Contratti Dettagliati per i Prossimi Checkpoint

### Checkpoint C4 — Student Experience, Attività Digitali, Allegati, Autosave e Seat Map
- **Obiettivo**: Perfezionare e rendere a prova di bomba l'esperienza studente in aula su PC, tablet e smartphone.
- **Contratti Frontend & UX**:
  - Timer d'attività reattivo: visualizzazione tempo residuo con avvisi visivi a 10 e 5 minuti dal termine.
  - Sincronizzazione offline: durante brevi interruzioni le risposte e i file pendenti restano in IndexedDB associati alla sessione e all’attività; alla riconnessione si sincronizzano con revisioni monotone. Le divergenze sono presentate per scelta esplicita, non sovrascritte silenziosamente.
  - Editor leggero con numerazione righe, indentazione e interazione touch per quesiti di tipo `code`.
  - Anteprima immediata degli allegati caricati (immagini, diagrammi, file sorgenti, PDF).
  - Conferma di consegna con riepilogo delle domande risposte e domande eventualmente lasciate in bianco prima della sottomissione definitiva.
- **Contratti Backend**:
  - `POST /api/student/activities/:id/autosave`: idempotente, accetta risposte parziali e aggiorna `last_saved_at`.
  - `POST /api/student/activities/:id/submit`: sigilla il tentativo con `status = submitted`, impedendo ulteriori modifiche da parte dello studente.
- **Esito C4 (2026-10-23): CURRENT e verificato localmente.** Il browser usa snapshot di revisione per invio, disabilita mutazioni mentre la consegna è in volo, dichiara salvataggio solo dopo conferma server e conserva le bozze locali divergenti. Il backend applica scadenza anche agli upload e sigilla il tentativo. Non include le azioni operative C5 né le funzioni C6/C7.

### Checkpoint C5 — Monitoraggio Live, Consegne e Correzioni Docente
- **Stato:** CURRENT, implementato e verificato localmente; nessun rilascio produttivo. C6/C7 restano PLANNED.
- **Dashboard:** panoramica operativa con code separate per attività da preparare, prove in corso, consegne da correggere e valutazioni confermate; navigazione diretta tra attività, monitoraggio e correzioni.
- **Monitoraggio:** le viste Seat Map e roster mostrano chi non ha iniziato, tentativi in corso, consegnati, ritirati, ultimo salvataggio confermato (`last_saved_at`), risposte presenti, tempo extra e scadenza. Aggiornamento periodico ogni 10 secondi; le nuove consegne vengono annunciate una volta per evento osservato. Mancanza di attività non è trattata come prova di inattività.
- **Azioni docente:** shortcut rapido +5 minuti e tempo extra configurabile; ritiro forzato che conserva le risposte e rimane distinto dalla consegna volontaria; riapertura con motivazione, controllo dello stato dell'attività/sessione e del tempo residuo o aggiuntivo. Le mutazioni sono condizionali, idempotenti e registrate con autore, motivazione e dettagli; i controlli teacher restano lato server.
- **Correzione:** modalità per studente e per quesito. Override di punteggio per quesito, feedback, annotazioni e voto finale con history progressiva; le proposte automatiche/AI non finalizzano il voto e una valutazione definitiva non viene sovrascritta da elaborazioni successive. Le statistiche includono conteggi, media, deviazione standard di popolazione e distribuzione, usando soltanto voti definitivi confermati e riportando il denominatore. Export CSV, JSON e Markdown riutilizza il servizio applicativo.
- **Verifica browser:** `pnpm run test:browser:c5` esercita il frontend reale e il server HTTP con due studenti sintetici, azioni docente, correzione, conferma, statistiche ed export a viewport desktop/tablet/mobile; SQLite e FileStore sono sotto `.tmp/dev-preview/` e vengono rimossi dal test. AI mock solo per questo test.

### Checkpoint C6 — MCP Assessment & Integrity Evidence

**Stato: CURRENT — implementato e verificato localmente; nessun rilascio produttivo.** Il ramo di lavoro C6 è derivato dal commit C5 `b66a4da`; i dettagli finali di commit sono riportati in `STATUS.md`.

- **Contratti MCP esposti dal server esistente:**
  - `list_student_submissions(assessmentId)`: metadati/stato di ogni consegna senza testo delle risposte o note interne.
  - `get_submission_detail(submissionId)`: dettaglio per il docente autorizzato, riusando il servizio assessment.
  - `grade_submission_ai(submissionId, model)`: proposta tramite il grading esistente; non promuove la proposta a voto definitivo. L’invio a un provider esterno dei contenuti delle risposte resta disabilitato salvo opt-in esplicito di configurazione.
  - `analyze_integrity_evidence(assessmentId)`: confronto locale on-demand dei tentativi definitivi e delle fonti di valutabilità associate.
  - `record_integrity_review(assessmentId, evidenceId, decision, idempotencyKey)`: decisione docente append-only, distinta dal grading e senza conseguenze disciplinari automatiche.
- Tutte le invocazioni MCP e le nuove route HTTP passano l’autorizzazione teacher-principal già esistente; autenticazione senza grant docente non basta. Le API studente non restituiscono report, risposte altrui, rubriche o soluzioni riservate.
- **Evidence implementate:** similarità testuale per risposte estese con estratti minimi; confronto lessicale normalizzato del codice per JavaScript, TypeScript e Python; contesto di prossimità Seat Map; sovrapposizione legittima con la specifica versione Student/Support Material pubblicata e associata al quesito. Risposte brevi, traccia e porzioni di fonte sono escluse dalle osservazioni comparative ove riconosciute. Le fonti esterne non vengono consultate e i contenuti non sono inviati a ricerca Web o AI durante l’analisi.
- **Persistenza e minimizzazione:** i report vengono ricalcolati on-demand e non persistono gli estratti delle risposte. Sono persistiti soltanto eventi di review con ID/versione analisi, riferimenti alle consegne, decisione, nota limitata, principal, timestamp e chiave idempotente.
- **Limiti espliciti (PLANNED/non implementati):** parser AST, confronto semantico/parafrasi, rilevamento autonomo di errori rari o codice superfluo, confronto con fonti Web e analisi del contenuto binario degli allegati. La normalizzazione lessicale non è un’analisi strutturale e i suoi filtri deterministici non sono soglie di probabilità o indicatori di colpevolezza; restano euristiche non calibrate. Le osservazioni non attestano copiatura.
- La UI docente usa i dati delle API protette e salva le review separatamente; la verifica browser C6 copre rendering desktop/mobile, persistenza della review e diniego anonimo. Test AI solo con adapter mock e dati sintetici; nessun test ChatGPT remoto, provider AI reale o dati scolastici reali.
- **Readiness per C7:** C6 fornisce una base locale utilizzabile per il checkpoint di verifica C7. Non è autorizzato né dichiarato un rilascio: C7 dovrà validare i controlli end-to-end e decidere esplicitamente se accettare questi limiti o estendere prima l’analisi strutturale/semantica. C7 resta PLANNED.

### Checkpoint C7 — Test Completi, Verifica K3s & Rilascio Infrastrutturale
- **Obiettivo**: Validazione finale end-to-end, conformità dev-env e verifica del runtime K3s di produzione.
- **Contratti & Requisiti**:
  - Suite automatica completa (unit, server, mcp, integration, browser) passante al 100%.
  - Nessuna regressione sui tool MCP esistenti o sui flussi di preparazione lezione T1.
  - Verifica dell'instradamento Cloudflare Access:
    - `https://class.simogatti.it/` e `https://class.simogatti.it/api/student/*` accessibili liberamente agli studenti.
    - `https://class.simogatti.it/api/*` e `https://mcp-teacher.simogatti.it/mcp` rigorosamente protetti da autenticazione ed autorizzazione docente.
  - Documentazione operativa in `docs/operations.md` aggiornata e sincronizzata.
