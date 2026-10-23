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
| **Dashboard Docente Multi-Scheda** | **CURRENT** | Schede: Preparazione T1, Attività, Studenti, Monitor Live, Consegne, Integrità C6. |
| **Registro Studenti (Docente)** | **CURRENT** | Inserimento singolo, importazione massiva un nominativo per riga, rimozione. |
| **Monitoraggio Live d'Aula (Seat Map & Roster)** | **CURRENT** | Mappa visiva dell'aula (cattedra, file di banchi, colori di stato, vicini) e tabella roster con auto-refresh (5s). |
| **Gestione Consegne e Revisione Voto Docente** | **CURRENT** | Elenco consegne, dettaglio risposte studente, correzione automatica/AI, input e conferma del voto finale docente. |
| **Anteprima Architettura Integrità (C6)** | **CURRENT (DEMO/UI)** | Scheda illustrativa/disclaimer e anteprima limitata; non equivale a confronto completo, Integrity Evidence operativa o giudizio automatico. |
| **Ambiente di Anteprima Locale Isolato (`pnpm dev:preview`)** | **CURRENT** | Esecuzione locale e su LAN Wi-Fi (0.0.0.0), storage isolato in `.tmp/dev-preview/`, seed dati dimostrativi, cleanup sicuro. |
| **Test browser C4** | **CURRENT** | Flusso Playwright reale su Chromium locale con due studenti e viewport mobile/tablet/desktop, autosave, interruzione/ripristino offline, timer, allegati e verifica docente. Emulazione viewport, non collaudo su dispositivi fisici. |
| **Ritiro Forzato / Riapertura Prova da Docente (C5)** | **PLANNED** | Azioni rapide nel live monitor per terminare la prova di uno studente o concedere tempo extra. |
| **Valutazione Comparativa MCP & Analisi Semantica AST (C6)** | **PLANNED** | Tool MCP dedicati per analisi di similarità strutturale su codice e testi, incroci con Seat Map. |
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
- **Obiettivo**: Consolidare gli strumenti operativi d'aula durante lo svolgimento della prova e la fase di revisione.
- **Contratti Frontend & Docente**:
  - Azioni d'aula dal vivo nel Monitoraggio:
    - Bottone "Ritira Prova" per forzare la consegna di uno studente.
    - Bottone "+5 min Extra" per estendere il tempo di singoli studenti con bisogni specifici (BES/DSA).
    - Notifica visiva immediata quando uno studente effettua la consegna definitiva.
  - Interfaccia di correzione guidata per quesito: possibilità per il docente di visualizzare tutte le risposte alla domanda Q1 di tutti gli studenti in sequenza, per una valutazione più equa e rapida.
  - Calcolo automatico della media di classe, deviazione standard e distribuzione dei punteggi.
- **Contratti Backend & Servizi**:
  - `AssessmentService.reviewGrading`: supporta override parziali per singolo quesito e storicizza le valutazioni precedenti in round non distruttivi (`evaluation_rounds`).

### Checkpoint C6 — Estensioni MCP, Confronti Semantici/Strutturali, Integrity Evidence & Fonti
- **Obiettivo**: Esporre le funzionalità di assessment, monitoraggio e analisi anticopiatura a ChatGPT tramite MCP.
- **Contratti Tool MCP**:
  - `list_student_submissions(assessmentId)`: recupera le consegne per l'attività.
  - `get_submission_detail(submissionId)`: recupera il dettaglio completo con risposte e soluzioni docente.
  - `grade_submission_ai(submissionId, model)`: esegue la correzione automatica assistita.
  - `analyze_integrity_evidence(assessmentId)`: esegue la scansione incrociata su 5 pilastri:
    1. *Seat Map Proximity*: confronta risposte tra banchi vicini (stessa fila, banchi adiacenti, dichiarazioni reciproche).
    2. *Rare Errors & Superfluous Code*: evidenzia errori specifici non comuni o porzioni di codice/commenti identici non richiesti.
    3. *AST & Semantic Similarity*: calcola indici di similarità strutturale su codice e similarità concettuale su testo libero.
    4. *Curriculum & Web Grounding*: verifica se passaggi di testo provengono verbatim da dispense di classe o fonti web.
    5. *Teacher Reserved Audit Log*: genera report riservato per il docente con raccomandazioni, senza sanzioni automatiche.
- **Invarianti di Sicurezza**:
  - Zero allucinazioni su fonti esterne; nessun invio di dati personali degli studenti a servizi non conformi GDPR.

### Checkpoint C7 — Test Completi, Verifica K3s & Rilascio Infrastrutturale
- **Obiettivo**: Validazione finale end-to-end, conformità dev-env e verifica del runtime K3s di produzione.
- **Contratti & Requisiti**:
  - Suite automatica completa (unit, server, mcp, integration, browser) passante al 100%.
  - Nessuna regressione sui tool MCP esistenti o sui flussi di preparazione lezione T1.
  - Verifica dell'instradamento Cloudflare Access:
    - `https://class.simogatti.it/` e `https://class.simogatti.it/api/student/*` accessibili liberamente agli studenti.
    - `https://class.simogatti.it/api/*` e `https://mcp-teacher.simogatti.it/mcp` rigorosamente protetti da autenticazione ed autorizzazione docente.
  - Documentazione operativa in `docs/operations.md` aggiornata e sincronizzata.
