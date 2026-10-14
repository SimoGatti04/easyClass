# C9 — Historical Provenance & Micro-E2E Preparation

**Data:** 10 ottobre 2026 (Europe/Rome)  
**Modalità:** verifica locale; nessuna inference, chiamata remota o invio corpus.  
**Esito:** pacchetto del micro-scenario preparato e verificato localmente; esecuzione remota non avviata e non ancora pronta per un comando esistente, per i gate descritti sotto. Gate D resta `BLOCKED`.

## Sintesi

- Gli output storici C7 sono integri: **325/325** artifact elencati nel manifest dell’esecuzione risultano presenti e con hash corrispondente.
- I file sorgente C6 usati dall’esecuzione C7 non sono tutti più disponibili nella versione frozen: tre hash registrati in `execution-freeze.json` differiscono dai file C6 attuali, modificati durante C8. Nessuna copia byte-identica ai tre hash frozen è stata trovata nell’albero di progetto (2.785 file regolari controllati); nessun file storico è stato ricostruito o ripristinato.
- Le correzioni C8 sono state conservate come snapshot versione separata sotto `validation/work/C9/provenance/c8-current-correction/`; sono copie dei file C6 attuali, non sorgenti storiche C7.
- Il micro-corpus è una copia byte-identica della fonte DBMS testuale congelata. Il caso misura un solo obiettivo osservabile su `SELECT`, `FROM`, `WHERE` e `ORDER BY`; il nuovo dataset dell’item è esplicitamente sintetico e autosufficiente.
- I fixture locali coprono la catena e la chiave SQL in SQLite in-memory. La conferma docente e la pubblicazione usate dalle fixture sono **simulate**, non approvazioni reali.
- Il preflight locale finale è **PASS, 10/10 controlli**. Nessuna chiamata remota/corpus, nessuna lettura credenziali, nessuna mutazione C7/registry/Gate D.

## Parte A — Preservazione e provenienza C7

### Discrepanza source hash

Execution esaminata: `gate-c-corrective-20261002T223554140943Z-e3723564`. Confronto tra i valori `core_hashes` del suo `execution-freeze.json` e il codice attuale:

| File C6 | SHA-256 frozen C7 | SHA-256 corrente | Esito |
|---|---|---|---|
| `validation/work/C6/scripts/excel_generation_validator.py` | `63fb6aa2ef9c3f5c2bdd87a7c44235dc3ecea674e58f62a1c201be5f86c57965` | `55f36532256971e4730c6cddefc166d6e0322cfd5d4113022fa0b6e011aa3571` | diverso |
| `validation/work/C6/scripts/scenario_builders.py` | `109d65bc318a35e8be1d6c5db2fe6565d005321b0b3eae5fdee176f30af89e4a` | `03c7196f7c6664d423ec0b494284cbdb27ad43008c974bf12e36439f7ea1c377` | diverso |
| `validation/work/C6/tests/test_c6_harness_transport.py` | `d3b4072815c7b2f966a61b8a009a32a927288f3f1cc1c367cb1fd6d1a872c443` | `a816d4d2d312edb462076a6748d295ff16086acfc8afa12d216cb9ff8e9e5b78` | diverso |

Gli altri hash elencati in `core_hashes` del freeze corrispondono ai file attuali. La remediation Excel è documentata nel report C8: il validator `c6-excel-generation-artifact-validator-1.1.0` segnala il criterio testuale tra apici singoli in `CONTA.SE`/`COUNTIF`; aggiunge un fake scenario e regressioni specifiche dell’adapter. Il report C8 registra 82/82 test locali PASS; questa suite non è stata rieseguita nel task C9.

È stato cercato un contenuto con gli SHA frozen su **2.785 file regolari sotto il progetto**, escludendo `.git`: nessun match esatto. La ricerca per basename nell’area Workspace ha trovato solo le tre copie correnti. Non è stato trovato un backup autenticabile; pertanto non si è tentato di ripristinare o ricostruire l’implementazione pre-C8.

### Integrità degli output ≠ riproducibilità dell’esecuzione

Il controllo diretto del `validation/work/C7/executions/gate-c-corrective-20261002T223554140943Z-e3723564/artifacts/MANIFEST.json` ha verificato **325/325** artifact finali: zero mancanti, zero mismatch. Report C7, claim ledger, packet Domain Owner e gli output raw restano inalterati. Questo prova l’integrità degli output conservati, **non** la riproducibilità esatta dell’esecuzione: i tre file sorgente partecipanti non hanno più i byte attestati dal freeze e i loro snapshot storici non sono presenti nel perimetro di ricerca. La riproducibilità source-level è quindi `NOT_DEMONSTRATED`, non “restaurata” dal manifest degli output.

Per distinguere le versioni sono stati copiati i tre file C6 correnti in `validation/work/C9/provenance/c8-current-correction/`. Il relativo `MANIFEST.json` collega per ciascuno hash frozen C7, hash corrente C8 e hash della copia C9, e indica esplicitamente che la copia C8 non corrisponde al sorgente C7. I file sorgenti C6 originali e gli output C7 non sono stati modificati.

## Parte B — Micro-E2E DBMS/SQL preparato

### Corpus e obiettivo

La fonte è `validation/work/C9/inputs/sources/dbms_student_lesson.md`, copiata byte per byte da `validation/work/Gate-C-v2/inputs/scenario_sources/dbms_student_lesson.md`. Hash verificato: `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`, uguale al `source-pins.json` C6 e al freeze C7. Non è stato aggiunto altro corpus.

Obiettivo singolo: data una tabella descritta e le righe necessarie, lo studente compone una query che seleziona i campi richiesti, applica `WHERE costo < soglia` e ordina dal costo minore al maggiore con `ORDER BY`; spiega il ruolo delle clausole. La fonte supporta la struttura SQL, il filtro `prezzo < 50`, i campi `nome`/`prezzo` e la consegna sui prodotti meno costosi. I **30 minuti** sono una scelta pedagogica C9, non un fatto attribuito alla fonte; livello/classe resta non specificato.

La fonte non contiene DDL, database SQLite popolato, righe reali o la scala di `sconto_percento`. Il test non dipende da quei prerequisiti. L’Assessment usa invece una tabella `materiali(titolo, costo)` e righe ipotetiche dichiarate esplicitamente sintetiche, autonome e non attribuite alla fonte. Non richiede JOIN, funzioni aggregate, DDL/DML, database esterno o coordinamento Excel.

### Percorso e contratti minimi

1. **Fonte → Teacher Material:** breve guida/piano docente con claim verificabili, locator, distinzione fra fatti e proposte, lacune e sequenza didattica.
2. **Conferma copertura:** decisione docente reale dopo la lezione; piano e fixture non attestano che il contenuto sia stato effettivamente insegnato. `PARTIAL`/`NOT_CONFIRMED` blocca l’Assessment o impone una riduzione esplicita del target.
3. **Student Material:** solo dopo la conferma; spiegazione autonoma e leggibile dei concetti effettivamente coperti. Nessuna bozza diventa pubblicata/canonica senza approvazione del docente.
4. **Assessment:** solo sulla versione di Student Material pubblicata e disponibile; item nuovo ma autosufficiente, con trace item→obiettivo/prerequisiti→sezione/versione. La risposta non deve essere copiata letteralmente.

Contratti: `validation/work/C9/contracts/{teacher-material,coverage-confirmation,student-material,assessment}.contract.json`. Criteri: `validation/work/C9/acceptance/acceptance-criteria.md`; modulo non precompilato per la review reale: `validation/work/C9/acceptance/human-review-template.json`.

Sono state preparate fixture locali per controllare la catena: Teacher Material scritto a mano, coverage confirmation `SIMULATED_CONFIRMED_FOR_PIPELINE_TEST_ONLY`, Student Material e un item/chiave contrassegnati `SIMULATED`. La fixture dichiara `human_confirmation_received=false`, `actual_publication_authorized=false`; nessuna lezione, approvazione o pubblicazione reale è avvenuta. La fixture non costituisce una valutazione del modello né review semantica umana.

### Verifiche locali eseguite

Comando: `python3 validation/work/C9/scripts/validate_micro_e2e_fixture.py`. L’ultima esecuzione è PASS, 10/10 controlli: hash fonte/pin/freeze; supporto del target nella fonte; contratto e scope; integrità C7 325/325; separazione della copia C8; natura simulata della conferma; trace obiettivo/dispensa/item; confine dei prerequisiti; correttezza della chiave e dell’ordinamento in SQLite in-memory. Il comando è locale, usa solo libreria standard/SQLite, non apre connessioni e rifiuta di sovrascrivere output incompatibili.

Le query fixture `ORDER BY costo` e `ORDER BY costo ASC` restituiscono entrambe le stesse quattro righe ordinate; la riga `Album` a costo esattamente 20 è esclusa da `< 20`. Questo verifica la chiave sintetica e la policy di equivalenza del fixture, non l’output di un modello né un item reale assegnato agli studenti. Anche il parsing dei JSON C9 e la compilazione in memoria del validator sono PASS.

Durante la preparazione, una prima verifica locale ha correttamente rilevato una discordanza tra due stringhe di stato della conferma simulata; fixture e trace sono state allineate. I record locali di controllo iniziale sono conservati come `fixture-validation-attempt-01.json` (FAIL, errore di fixture corretto) e `fixture-validation-attempt-02.json` (PASS sul set precedente di 9 check); il risultato finale corrente è `fixture-validation.json` (PASS, 10/10). Nessun output C7 è coinvolto.

### Riutilizzo e blocchi per un’esecuzione reale

Componenti riusabili già presenti: `validation/shared/two_stage_generation.py` per generazione Stage 1/2 e binding dei draft; `validation/work/C6/scripts/omniroute_transport.py` per il transport/rendering structured-output; controlli C2/C4 per completezza e distinta Student Material. Non sono stati modificati.

Due lacune impediscono di chiamare il pacchetto un runner E2E già pronto:

- `TwoStageGenerationPipeline.run()` invia Stage 1 e Stage 2 nella stessa esecuzione senza pausa per conferma docente tra i due; il flusso richiesto deve sospendere Stage 2 finché il docente non attesta la copertura reale.
- Nel codice disponibile esistono task di blueprint/consistency Assessment, ma non un generatore end-to-end di Assessment Item con trace alla versione Student Material pubblicata. `run_c6.py` è il runner fisso C6 e `run_gate_c.py` avvia un benchmark più ampio; non sono sostituti sicuri di un Micro-E2E C9.

Serve quindi, in un successivo task autorizzato, una composizione/wrapper minimo e specifico C9 che riusi i componenti esistenti e abbia un gate manuale prima dello Student Material e dell’Assessment. Non serve un framework o un nuovo modello. Inoltre lo stato corrente non certifica un modello già ratificato/eleggibile: prima del live occorrono autorizzazione esplicita all’invio del corpus e scelta di una route già autorizzata, senza cambiare registry o eligibility.

Il runbook `validation/work/C9/procedure.md` contiene la procedura, i gate e i controlli da applicare; il suo preflight locale è già eseguibile. L’esecuzione remota della pipeline resta `NOT RUN/BLOCKED` fino a wrapper/gate umano e autorizzazioni.

## Contabilità, vincoli e stato finale

| Controllo | Esito verificato |
|---|---|
| Remote/network/provider calls | 0 |
| Corpus model calls / corpus sent | 0 / false |
| Credential reads | 0 |
| Attempt C7 raw/checkpoint/manifest writes | 0 |
| Registry/profile/eligibility mutations | 0 |
| Domain Owner sign-off mutation | 0 |
| Gate D mutations/started | 0 / no |
| C6/C7 contracts, C6 implementation, historical outputs | non modificati |

Gate D rimane `BLOCKED`; il packet C7 Domain Owner resta vuoto. L’integrità artifact C7 è PASS, ma la riproducibilità esatta del codice C7 non è dimostrata. La preparazione corpus/contratti/runbook C9 è PASS; il Micro-E2E remoto e l’approvazione docente sono `NOT RUN`.

## Convenzioni applicate

Letti `development-environment/AGENTS.md`, `docs/environment/README.md`, `docs/engineering/README.md`, `docs/engineering/agent-protocol.md`, `docs/engineering/testing.md`, `docs/engineering/coding.md`, `docs/engineering/documentation.md`; documenti prodotto `docs/dossiers/04-knowledge-materials.md` §47 e `docs/dossiers/05-assessment-system.md` §57; `STATUS.md`, report C8, report C7, claim ledger, packet Domain Owner, execution freeze, manifest C7, source pins e componenti C4/C6 rilevanti. Nessuna regola di exact-match o precisione Excel è stata trasferita al caso testuale.
