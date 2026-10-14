# B5–B6 — Integration & Distributed Validation

**Data del report/manifest:** 2026-09-29  
**Scope:** feasibility gate; harness minimo, non prodotto.  
**Decisione:** **NOT YET FEASIBLE**.

## Executive result

| Gate | Esito | Evidenza sintetica |
|---|---|---|
| T1 | **NOT YET FEASIBLE** | La route local-only esiste, ma nessuno dei tre Teacher Script locali è utilizzabile domani senza riscrittura importante; due sono troncati e il terzo è molto sotto la durata promessa. |
| Remote-assisted | **NOT PROVEN** | Nessuna generazione B5/B6 è stata inviata a OmniRoute. Non era disponibile un’autorizzazione specifica a inviare il Source Set e i prompt a quel percorso remoto; nessun contenuto del corpus è stato trasmesso. I risultati Gemini di B3 sono solo contesto storico, non un confronto B5 controllato. |
| Distributed — PROCESS_BOUNDARY | **PASS** | Processo harness → wrapper HTTP parser separato → processi Marker/MinerU; chiamata separata al servizio oMLX. |
| Distributed — NETWORK_ENDPOINT | **PASS** | Wrapper HTTP su `127.0.0.1:8766` e API oMLX su `127.0.0.1:8000/v1` realmente usati. |
| Distributed — MULTI_HOST | **NOT_PROVEN** | Non è stata verificata la presenza di host fisicamente distinti. |
| Provenance | **PASS** | Request, Source Set, ranking, hash, parser e artefatti generati sono ricostruibili a livello di artefatto/Source Set; non è una prova di citazione automatica sentence-level. |

**Blocker principale:** MiniCPM5-2B-MLX non ha prodotto Teacher Script conformi alla promessa di un copione lungo e usabile; le risposte includono script troppo brevi o troncati, filler ripetuto e contenuti non sostenuti dal Source Set. JSON metadata e vari Student Material hanno ulteriori failure indipendenti.

## Obiettivo e perimetro

È stato eseguito il gate end-to-end richiesto:

`source reale → parser → artifact normalizzato/proiezione validata → chunk → retrieval B2 → Source Set top-k → Lesson Plan / Teacher Script / Student Material / metadata`

Sono stati usati soltanto gli scenari che il source-separation audit B3 consente di valutare: DBMS/SQL, Excel e partial-source DBMS. Cybersecurity e History/Enigma/Turing sono rimasti `INSUFFICIENT_SOURCE_SEPARATION`; non sono stati ricostruiti o sostituiti con fonti inventate.

Il percorso locale ha usato MiniCPM5-2B-MLX via oMLX per tutti i 12 artifact attesi. Non è stato eseguito fallback local→remote. Rizzo, vector DB, reranker, RRF, queue, framework agentici, UI o architettura di prodotto non sono stati introdotti. Marker/MinerU sono stati invocati nelle installazioni esistenti, senza modificarle.

Non esisteva una directory `.git` nel workspace al momento del gate; non è disponibile un commit/ref per identificare il candidato. I log locali dei parser riportano timestamp 2026-09-30, un giorno dopo la data corrente/manifest 2026-09-29; i timestamp sono stati conservati come osservati, ma la discrepanza dell’orologio host non è stata usata per attribuire la data del report.

## Pipeline effettivamente testata

1. **Preflight:** `python3 validation/scripts/verify_bundle.py` → `PASS`, 30 file richiesti e checksum corpus 6/6 validi.
2. **Parsing via HTTP:** harness e wrapper parser sono processi distinti. Il wrapper applica Marker 1.10.2 al PDF DBMS e MinerU 3.4.2 hybrid-engine all’XLSX.
3. **Normalizzazione e source separation:** Markdown UTF-8/LF; Excel usa la proiezione B3 senza riferimenti a celle; partial-source è esattamente le prime 35 righe del Markdown DBMS normalizzato già verificato dal protocollo B3.
4. **Chunking:** chunker B2 `heading-paragraph-table-context-v2`; indici FTS5 SQLite temporanei per scenario.
5. **Retrieval:** dense Qwen3-Embedding-0.6B per DBMS; FTS5 lexical per Excel e partial-source. Nessun RRF/reranker. Source Set limitato ai primi cinque chunk recuperati, senza correzione manuale del ranking.
6. **Generazione local-only:** richieste separate per i quattro artifact. Modello `MiniCPM5-2B-MLX`, `max_tokens=8500`, `temperature=0.2`, `top_p=0.9`. Request, risposte raw e metriche sono salvate nel workspace.
7. **Metadata:** validazione schema e semantica. Il validator non ha accettato alcun metadata JSON.
8. **Provenance:** ranking e Source Set includono documento, parser, hash sorgente/artifact/proiezione/chunk, line range, route, rank e score; i prompt salvati contengono i chunk effettivamente passati al modello.

### Parsing e recupero del wrapper

| Scenario | Parser/versione | HTTP | Tempo parser (s) | SHA normalized artifact | Verifica B1 |
|---|---|---:|---:|---|---|
| DBMS/SQL | Marker 1.10.2 | 200 | 55.340 | `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` | Match esatto |
| Excel | MinerU 3.4.2 | 200 | 17.418 | `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414` | Match esatto |

La prima richiesta Excel si è fermata esplicitamente con HTTP 422 `normalized_artifact_missing_or_ambiguous`: MinerU aveva prodotto due copie Markdown con contenuto normalizzato identico. Il wrapper è stato corretto per accettare più percorsi soltanto se il contenuto normalizzato coincide byte-per-byte e selezionare deterministicamente il Markdown top-level, poi confrontare l’hash B1. La seconda richiesta ha restituito hash identico all’artifact B1. La prima failure e la riparazione sono documentate in `validation/work/B5-B6/metrics/parser-wrapper-recovery.json`; non è stata cambiata la baseline di parsing B1.

## Scenario matrix

### DBMS / SQL — source completa

- **Input:** `dbms-sql/dbms_student_lesson.pdf`, Marker; l’input non include il Teacher Script di riferimento. Il reference B3 resta held-out.
- **Query:** “Prepara una lezione introduttiva che colleghi tabelle relazionali, relazioni e query SQL di base.”
- **Retrieval:** dense, 12 chunk indicizzati; 12 embedding; top-5 selezionati, nessun fallback. Costruzione embedding 4.8309 s, embedding query 0.1810 s, dense scan 0.003802 s, integrità FTS `ok`.
- **Source Set:** `c0002`, `c0004`, `c0012`, `c0005`, `c0003` (rank/score e line range nella sezione Provenance e nel file `outputs/retrieval/dbms_sql/retrieval.json`).
- **Generazione locale:** Lesson Plan 272 parole/15.037 s; Teacher Script 622 parole/34.430 s; Student Material 4,889 parole/247.260 s, troncato; metadata 161 parole/14.690 s, JSON non parseabile dal contratto.
- **Editing effort:** Lesson Plan `major_rewrite`; Teacher Script `major_rewrite`; Student Material `unusable`; metadata `unusable`.
- **Failure note:** il Teacher Script finisce formalmente con `stop`, ma propone solo circa 65 minuti di fasi per una lezione di 120 minuti e contiene spiegazioni ridondanti. La risposta Student Material termina a metà del 47º esercizio (`finish_reason=length`).

### Excel — workbook demo

- **Input:** `excel/excel_demo.xlsx`, MinerU; la generazione riceve solo `excel_demo_no_cellrefs.md`, proiezione redatta verificata B3. Non sono state valutate coordinate, formule o grounding cella-per-cella.
- **Query:** “Catalogo prodotti: Tastiera, Mouse, Webcam e passaggi testuali disponibili.”
- **Retrieval:** lexical FTS5; 11 chunk creati, un solo risultato selezionato, `excel_demo:c0005`; integrità FTS `ok`. La selezione contiene la tabella prodotti e i passaggi testuali; non dimostra retrieval generalizzato.
- **Generazione locale:** Lesson Plan 470 parole/25.568 s; Teacher Script 3,826 parole/236.937 s, troncato; Student Material 186 parole/9.539 s; metadata 262 parole/18.934 s, non schema-valid.
- **Editing effort:** Lesson Plan `major_rewrite`; Teacher Script `unusable`; Student Material `moderate_edits`; metadata `unusable`.
- **Failure note:** il Lesson Plan afferma 120 minuti ma le attività esplicite coprono 90. Lo script ripete 46 attività e riferimenti a celle omessi e termina a metà dell’attività 46. Il metadata usa `scenario_id=excel_demo`, rappresenta la distinctness come stringa invece che booleano e formula obiettivi basati su riferimenti-cella.

### Partial-source DBMS

- **Input:** proiezione esatta delle prime 35 righe del Markdown DBMS normalizzato; hash proiezione `c8992a2c9d1b5476f64b905c268c0553e96287b51b6d23d0a9a0b675a6d6ce56`. Sintassi SQL ed esercizi sono deliberatamente esclusi dal source.
- **Query:** “obiettivi introduttivi, tabelle, righe e colonne”.
- **Retrieval:** lexical FTS5; quattro chunk candidati, due selezionati (`c0002`, `c0004`); integrità FTS `ok`.
- **Generazione locale:** Lesson Plan 210 parole/11.278 s; Teacher Script 4,845 parole/243.496 s, troncato; Student Material 200 parole/11.620 s; metadata 183 parole/13.386 s, non schema-valid.
- **Editing effort:** Lesson Plan `major_rewrite`; Teacher Script `unusable`; Student Material `major_rewrite`; metadata `unusable`.
- **Failure note:** il Lesson Plan dichiara sostenibili 120 minuti benché gli slot elencati sommino 90 e include attività/query assenti dall’estratto. Il Teacher Script è dominato da filler ripetuto e contenuti SQL non disponibili; Student Material include una sezione chiamata “Teacher Script”.

### Scenario non valutabili

| Scenario richiesto | Stato | Motivo |
|---|---|---|
| Cybersecurity | `INSUFFICIENT_SOURCE_SEPARATION` | Source-separation audit B3: il materiale disponibile non consente un confronto indipendente valido senza leakage. |
| History / Enigma / Turing | `INSUFFICIENT_SOURCE_SEPARATION` | Stesso vincolo: non è stata passata la fonte/target contaminante al modello e non è stata inventata una fonte alternativa. |

## Metriche di generazione e scorecard

Tutti i 12 tentativi local-only hanno ricevuto HTTP 200. Nove risposte hanno `finish_reason=stop`; tre sono state troncate con `finish_reason=length`: DBMS Student Material, Excel Teacher Script e partial-source Teacher Script. Il flag tecnico `deliverable_complete` del harness è `true` in 6/12 chiamate; non equivale a usabilità. Tutti e tre i metadata sono stati rifiutati: prima per le fence JSON, e anche dopo una rimozione diagnostica delle fence restano errori semantici/schema.

| Scenario | Artifact | Parole | Fine | Tempo totale (s) | Metadata valido | Editing effort |
|---|---|---:|---|---:|---|---|
| DBMS/SQL | Lesson Plan | 272 | stop | 15.037 | n/a | major_rewrite |
| DBMS/SQL | Teacher Script | 622 | stop | 34.430 | n/a | major_rewrite |
| DBMS/SQL | Student Material | 4,889 | length | 247.260 | n/a | unusable |
| DBMS/SQL | metadata | 161 | stop | 14.690 | no | unusable |
| Excel | Lesson Plan | 470 | stop | 25.568 | n/a | major_rewrite |
| Excel | Teacher Script | 3,826 | length | 236.937 | n/a | unusable |
| Excel | Student Material | 186 | stop | 9.539 | n/a | moderate_edits |
| Excel | metadata | 262 | stop | 18.934 | no | unusable |
| Partial-source | Lesson Plan | 210 | stop | 11.278 | n/a | major_rewrite |
| Partial-source | Teacher Script | 4,845 | length | 243.496 | n/a | unusable |
| Partial-source | Student Material | 200 | stop | 11.620 | n/a | major_rewrite |
| Partial-source | metadata | 183 | stop | 13.386 | no | unusable |

La scorecard manuale con i nove campi 0–4 e la motivazione per ogni artifact è in `validation/artifacts/B5-B6/manual-scorecard.json`. La revisione è manuale secondo il protocollo B3; non è stato usato LLM-as-a-judge. I valori non sono aggregati in una media per decidere T1.

## Local vs remote

### B5/B6

Un confronto local-vs-remote **non è stato eseguito**. L’opzione remota configurata è OmniRoute con `agy/gemini-3.8-flash-tiered`, ma nessuna richiesta B5/B6 contenente i Source Set è stata inviata. Di conseguenza non esistono in questo gate metriche remote di qualità, editing effort, latenza o schema. Nessun risultato remoto compensa i failure local-only.

### Contesto storico B3 (non apples-to-apples con B5)

Il manual scorecard B3 registra per il solo Teacher Script:

| Scenario | MiniCPM5-2B-MLX B3 | Gemini via OmniRoute B3 | Uso qui |
|---|---|---|---|
| DBMS/SQL | `major_rewrite` (1/4 editing effort) | `moderate_edits` (2/4) | Contesto storico; non prova di B5 remote-assisted. |
| Excel | `unusable` (0/4) | `minor_edits` (3/4) | Contesto storico; non prova di B5 remote-assisted. |
| Partial-source | `unusable` (0/4) | `minor_edits` (3/4) | Contesto storico; non prova di B5 remote-assisted. |

La direzione del gap B3 è coerente con un ceiling remoto più alto, ma il confronto controllato B5 non c’è; non vengono calcolate delta B5 né latenza comparativa.

## Acceptance matrix T1

| Requisito | Esito | Evidenza / limite |
|---|---|---|
| T1-A Parsing | **PASS** | Marker/MinerU restituiscono artifacts normalizzati con hash identico ai due artifact B1 attesi; nessuna capacità XLSX cell-level inferita. |
| T1-B Retrieval | **PASS — casi eseguiti soltanto** | Tutti e tre i query run hanno restituito Source Set non vuoti e documentati. Non è prova di generalizzazione; restano i failure confusable, out-of-corpus e abstention noti da B2. |
| T1-C Lesson Plan | **FAIL** | Slot incompleti rispetto alla durata, prerequisiti/attività non supportati e scarsa operatività. |
| T1-D Teacher Script | **FAIL — requisito fondamentale** | Nessun output local-only soddisfa lunghezza, durata, completezza e usabilità promesse; due sono troncati, uno è troppo breve. |
| T1-E Student Material | **FAIL complessivo** | Un handout Excel richiede modifiche moderate; DBMS è enorme e troncato, partial-source non è correttamente student-facing. |
| T1-F Provenance | **PASS** | È possibile risalire da ciascuna request/output al Source Set e ai chunk/hash/parser/line range. Nessuna citazione automatica per frase richiesta da questo gate. |
| T1-G Local/private viability | **PASS tecnico, insufficiente per feasibility** | I 12 artifact sono stati richiesti esclusivamente alla route locale; non c’è dipendenza remota o fallback implicito. La qualità dei deliverable non soddisfa T1-C/D/E. |

Il gate non usa una media: i failure di T1-C, T1-D e T1-E, in particolare T1-D, determinano **NOT YET FEASIBLE**.

## Failure injection

| Failure | Risultato | Verifica |
|---|---|---|
| Parser failure | **PASS** — PDF malformato; HTTP 422, `parser_failed`, `ParserProcessError`; zero retry. | Errore esplicito, nessun parser fallback, source valida invariata. |
| Generation model unavailable | **PASS** — ID modello locale inesistente; HTTP 404, `not_found_error`. | Zero retry e nessun cross-route fallback. |
| Embedding/oMLX unavailable | **PASS** — endpoint d’iniezione `127.0.0.1:9`; dense branch produce `lexical_fallback`, 12 candidati. | Fallback reale e visibile in `outputs/retrieval/fi_embedding_dense/retrieval.json`; fail-fast, zero retry. I chunk lexical sono selezionati senza correzione manuale. |
| Remote endpoint unreachable | **PASS come controllo transport** — endpoint d’iniezione loopback non raggiungibile; `URLError`. | Nessun fallback locale; zero retry. Non è stata chiamata né resa irraggiungibile l’istanza OmniRoute configurata: questo test non prova la sua disponibilità B5. |

In tutti i test: nessuna corruzione di stato osservata; hash di corpus/artifact B1 e corpus/index B2 invariati. I log e request metadata delle injection non registrano credenziali.

## Provenance

| Scenario | Sorgente e parser | Projection SHA-256 | Source Set realmente passato |
|---|---|---|---|
| DBMS/SQL | `dbms-sql/dbms_student_lesson.pdf`; Marker 1.10.2; source SHA `6a1277ba8c83bad71649aa55d2cb20ae8446eaa30985b7129f0c53bbc127623d`; normalized/B1 SHA `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`. | uguale al normalized artifact | `c0002` rank1 0.75083524 (linea 9); `c0004` rank2 0.64363712 (23–35); `c0012` rank3 0.63801301 (110–111); `c0005` rank4 0.59816003 (39–65); `c0003` rank5 0.59093189 (13–19). |
| Excel | `excel/excel_demo.xlsx`; MinerU 3.4.2; source SHA `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7`; normalized/B1 SHA `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`. | proiezione B3 redatta SHA `ec0151a94b9ce9ed6ae4d505cbe0f300f7c33c7a11cbc071042954aeda5d960d` | `excel_demo:c0005`, rank1, BM25 -9.11140273, linee 187–247. |
| Partial-source | Stesso PDF DBMS e parser Marker; sorgente/artifact normalized hash come DBMS. | estratto esatto di 35 linee SHA `c8992a2c9d1b5476f64b905c268c0553e96287b51b6d23d0a9a0b675a6d6ce56` | `c0002` rank1, BM25 -1.76687705, linea 9; `c0004` rank2, BM25 -1.46920614, linee 23–35. |

I ranking completi, incluso ogni candidato, score, testo chunk e metrica sono archiviati in `validation/work/B5-B6/outputs/retrieval/<scenario>/retrieval.json`; i JSONL chunk sono a fianco. I prompt effettivi sono nei `request.json` di ciascun artifact e le risposte integrali in `response.raw.txt` o nel file artifact relativo. I metadata generati non sono un canale di provenance valido perché non superano il validator; la ricostruibilità del gate deriva dai trace indipendenti, non dai metadata falliti.

## Distributed proof

- **PROCESS_BOUNDARY: PASS.** Il runner avvia un processo HTTP wrapper separato per parsing; il wrapper avvia processi Marker/MinerU. Il runner invoca anche il servizio oMLX via API.
- **NETWORK_ENDPOINT: PASS.** Endpoint parser `http://127.0.0.1:8766/v1/parse`, health endpoint, e oMLX OpenAI-compatible su `http://127.0.0.1:8000/v1`. Le due capability HTTP non richiedono che la business logic dipenda da una chiamata in-process.
- **MULTI_HOST: NOT_PROVEN.** Tutti gli endpoint usati nel percorso local-only sono loopback sullo stesso host. Nessuna affermazione di distribuzione tra macchine.
- **Contratto locale/remoto:** la funzione chiamante usa la stessa semantica `GenerateNarrative` (model/messages/parametri, risposta testuale/finish/usage) e seleziona adapter/endpoint per route; la route remota B5 non è stata invocata, quindi l’equivalenza è provata nel codice del harness, non con una risposta remota B5 osservata.

## Platform Architecture inputs — fatti osservati soltanto

- Marker 1.10.2 ha normalizzato il PDF DBMS e riprodotto il checksum B1; MinerU 3.4.2 ha fatto lo stesso per l’XLSX dopo selezione deterministica tra copie identiche.
- Qwen3-Embedding-0.6B via oMLX ha restituito vettori 1024-d per i 12 chunk DBMS; il branch dense ha completato retrieval e il ramo di unavailable ha degradato visibilmente a FTS5 lexical.
- MiniCPM5-2B-MLX ha avuto tempi variabili e due script sono terminati al cap di 8.500 token; il terzo era breve rispetto ai 120 minuti richiesti.
- Una risposta HTTP 200/`stop` non garantisce artefatto utilizzabile né metadata conforme.
- Request/response, timeout, output raw, provenance e failure si possono registrare senza credenziali; per il remoto, il perimetro dei dati inviati richiede consenso e la route è opzionale.
- La prova distribuita è di processi/endpoint sullo stesso host; non prova multi-host.

Questi sono input fattuali per una fase successiva; questo report non disegna la Platform Architecture.

## Security / privacy

- Non sono stati introdotti né usati dati personali di studenti.
- Nessuna chiamata di generazione B5/B6 è stata inviata a OmniRoute; nessun Source Set o prompt del corpus è stato trasmesso all’esterno.
- Le credenziali sono state usate solo in memoria per le chiamate autorizzate e non sono presenti nei log/request salvati.
- Gli output dei modelli restano contenuto derivato non validato; la sola validazione automatica applicata al metadata è quella esplicita dello schema/semantica, che ha fallito per tutti e tre i casi.

## Known blockers

1. **Blocker prodotto principale — Teacher Script local-only:** qualità, copertura e durata incompatibili con la promessa T1.
2. **Output instabili/incoerenti:** tre risposte troncate; generazione DBMS Student Material espansa in ripetizioni; slot temporali dei piani non corrispondono alle durate dichiarate.
3. **Metadata:** 0/3 JSON validi nel contratto; tutti e tre falliscono anche controlli semantici dopo rimozione diagnostica delle fence.
4. **Student Material:** due output non usabili/da riscrivere; solo Excel è valutabile come recuperabile con modifiche moderate.
5. **Remote reference B5:** non eseguita; remote-assisted rimane non provata e non può essere usata per superare i failure local-only.
6. **Distributed multi-host:** non provato.
7. **Retrieval generalizzato:** non riesaminati nel gate confusable, query out-of-corpus o abstention; i tre query run non modificano i limiti B2.

## Files produced

- Report: `validation/results/B5-B6-integration-report.md`
- Scorecard manuale: `validation/artifacts/B5-B6/manual-scorecard.json`
- Manifest: `validation/artifacts/B5-B6/MANIFEST.json`
- Run metrics: `validation/work/B5-B6/metrics/integration-run.json`
- Recovery parser wrapper: `validation/work/B5-B6/metrics/parser-wrapper-recovery.json`
- Schema: `validation/work/B5-B6/inputs/metadata.schema.json`
- Harness: `validation/work/B5-B6/scripts/run_integration.py`
- Wrapper parser: `validation/work/B5-B6/scripts/parser_http_service.py`
- Richieste parser, normalized artifact, proiezioni, chunk, ranking, indici, prompt, risposte raw, metriche di generazione, failure injection e log: `validation/work/B5-B6/outputs/` e `validation/work/B5-B6/logs/`.

## Not tested

- Cybersecurity e History/Enigma/Turing come generazione end-to-end: `INSUFFICIENT_SOURCE_SEPARATION`.
- Generazione B5/B6 OmniRoute e confronto controllato local-vs-remote.
- Multi-host fisicamente distinto.
- Coordinate celle, formule workbook, calcoli cell-specific e grounding cell-by-cell XLSX.
- Retrieval fuori corpus/confusable/abstention in nuovi casi; valgono i limiti B2.
- UI, database prodotto, queue, orchestrazione generica, Rizzo e architettura finale.
- Qualsiasi dato personale studente (non presente/usato nel test).

## Decision

**NOT YET FEASIBLE.** T1-G è disponibile come percorso locale tecnico e T1-A/B/F hanno superato solo i casi verificati; i requisiti generativi centrali T1-C, T1-D e T1-E non sono soddisfatti. I risultati remoti B3 non sostituiscono l’evidenza mancante B5/B6 e non autorizzano un fallback cloud.
