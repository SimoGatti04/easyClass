# Gate C v2 — Remote Composite Generation Benchmark

## Stato corrente — audit post attempt-05 (1 ottobre 2026)

**TECHNICAL_PARTIAL — `RUNNER_FAILURE`; risultati non decision-grade.** L'esecuzione composita `attempt-05` è partita dopo `--validate-only = READY_FOR_MODELS_COMPOSITE_RUN` e ha completato solo una parte della matrice. Un difetto locale del runner ha scartato dal registro aggregato una generazione DBMS valida quando la successiva pipeline longform della stessa route si è interrotta. Questo altera i deliverable mancanti, il ranking oggettivo, la selezione della fase 2 e gli stati aggregati del profilo. Non assegnare eligibility né usare il ranking come confronto valido.

- Le tre route della coorte congelata hanno superato il current availability/identity guard; nessuna sostituzione o fallback inter-modello.
- Il corpus è stato inviato alle route per le chiamate composite: 29 richieste d'inferenza registrate più il GET catalogo iniziale, 30 chiamate totali secondo il run record.
- Il solo output generation completo, validato deterministicamente e direttamente recuperabile come artefatto è DBMS per una route; esso è stato omesso dagli aggregati a causa del successivo errore longform. Gli altri deliverable sono incompleti, troncati o non eseguiti.
- Nessun punteggio qualitativo è stato assegnato. Il packet blindato è **BLOCKED** per la valutazione di profilo; alcuni output parziali sono referenziati esclusivamente per eventuale diagnosi, non per dichiarare eligibility.
- `remote.reasoning` Gemini resta `HISTORICAL_ELIGIBLE`; il guard attuale conferma `CURRENT_ROUTE_OPERATIONAL`. La qualità reasoning non è stata rivalutata.

Le sezioni sottostanti che descrivono 11 probe e zero generazioni sono la fotografia storica di `attempt-02`; l'addendum finale documenta la progressione attempt-01…05 e sostituisce le conclusioni correnti dove in conflitto.

## Executive result — storico attempt-02 (superato dagli addenda successivi)

**TECHNICAL_FAIL.** Nessuna route ha superato il preflight di protocollo e identità; nessun modello è entrato nella coorte, quindi `remote.generation` e `remote.longform` non sono stati valutati. La causa osservata è una discrepanza gateway: tutte le 11 probe sintetiche hanno ricevuto HTTP 200 ma soltanto un chunk `keepalive` vuoto, con `model=keepalive`, nessun `finish_reason`, nessun contenuto e identità richiesta non ricostruibile. Non è una valutazione negativa della qualità dei modelli.

- Coorte richiesta: 3 route; coorte effettiva: 0.
- Probe failure: 11; probe pass: 0.
- Nel tentativo corretto `attempt-02`: generazioni didattiche inviate 0; sono partite soltanto probe sintetiche senza corpus. Il precedente `attempt-01`, invalidato e conservato come raw storico, aveva già inviato il Source Set DBMS a Gemini, Groq e Qwen per richieste generation/longform; tali output non sono inclusi come evidenza valida. Nessun Source Set Excel né reference held-out è stato inviato.
- Human review: impossibile senza output attribuibili; stato `BLOCKED`.

## Catalog at test time — historical attempt-02

- Check ufficiale `check_teacher_service_omniroute.py`: `READY`, 62 modelli visibili.
- Snapshot autorevole `/v1/models`: HTTP 200, 62 modelli, catturato `2026-09-30T16:29:58.878869+00:00`; latenza GET 32.34 ms.
- Confronto con Gate C v1: 62 persistenti, 0 nuovi, 0 scomparsi. Variazioni metadata su 62 record; campi cambiati: `created, permission, pricing`. Il catalogo ha aggiornato il campo `created` e i metadata `permission`; il record Groq include inoltre pricing dichiarato a zero, non assunto come costo affidabile. Il costo misurato resta `unknown`.
- Il catalogo è stato rifrescato prima del preflight e tutti i Model ID richiesti provengono dal catalogo live. Discovery non implica eligibility.

## Candidate selection

Sono stati definiti tre candidati primari con modalità testo input/output esplicite e reasoning dichiarato; i reserve sono stati sondati solo quando i precedenti non passavano la probe. Dopo 7 route fallite la coda è stata estesa, sulla base del catalogo live, con 4 route distinte. Le famiglie/provider dichiarati nella selezione erano: `agy`, `groq`, `mistral`, `nvidia`, `opencode-zen`, `openrouter`. La selezione e l’ordine sono registrati in `validation/work/Gate-C-v2/inputs/candidate-selection.md`.

| Model ID richiesto | HTTP | Model ID restituito | Finish reason | Latenza totale s | Stato |
|---|---:|---|---|---:|---|
| `agy/gemini-3.8-flash-tiered` | 200 | `keepalive` | null | 2.048 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `mistral/mistral-medium-3-5` | 200 | `keepalive` | null | 2.044 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `opencode-zen/mimo-v2.5-free` | 200 | `keepalive` | null | 16.262 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `nvidia/moonshotai/kimi-k3` | 200 | `keepalive` | null | 2.029 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `nvidia/deepseek-ai/deepseek-v4.1-flash` | 200 | `keepalive` | null | 2.067 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `groq/openai/gpt-oss-120b` | 200 | `keepalive` | null | 2.013 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `openrouter/qwen/qwen3.8-27b:free` | 200 | `keepalive` | null | 2.899 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `openrouter/google/gemma-4-31b-it:free` | 200 | `keepalive` | null | 2.034 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `openrouter/nvidia/nemotron-3.5-lightning:free` | 200 | `keepalive` | null | 2.027 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `nvidia/z-ai/glm-5.3` | 200 | `keepalive` | null | 2.027 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |
| `opencode-zen/mimo-v2.6-flash-free` | 200 | `keepalive` | null | 15.013 | UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY |

Non è stato fatto fallback inter-modello; ogni probe usa il Model ID esplicito della riga. La risposta `keepalive` non è stata conteggiata come modello effettivamente eseguito.

## remote.generation

**Nessuna generazione didattica è partita in `attempt-02`.** Il preflight è fallito prima dell’invio delle fonti per DBMS/SQL ed Excel in questo tentativo, pertanto non esistono output ufficiali Lesson Plan, Student Material o metadata valutabili. `attempt-01` aveva prodotto richieste DBMS, ma è invalidato per difetti di runner/protocollo e resta soltanto raw storico. Nessun punteggio rubric o editing effort è assegnato; tutti i profili candidati sono `UNAVAILABLE_FOR_TEST`, non `TECHNICALLY_REJECTED` per scarsa qualità.

Source separation verificata a livello di protocollo di benchmark:
- DBMS/SQL avrebbe usato `validation/work/Gate-C-v2/inputs/scenario_sources/dbms_student_lesson.md`, con target/reference distinti e non inviati.
- Excel avrebbe usato `excel_demo_b1.md` e `excel-workbook-ast-projection.json`; `excel_teacher.md` non è stato usato né aperto come input/reference durante questo tentativo.
- Cybersecurity e History restano `INSUFFICIENT_SOURCE_SEPARATION` secondo l’audit B3.

## remote.longform

**Nessun Teacher Script composito ufficiale è stato generato in `attempt-02`.** Nessun PLAN, sezione bounded, assembly, repair o controllo durata è stato eseguito in questo tentativo. `attempt-01` conteneva richieste longform DBMS ma è invalidato e non viene valutato. Non vi sono parole/sezioni valide, editing effort o punteggi da riportare. La pipeline composita non è stata esercitata nel tentativo corretto perché nessuna route ha superato il gate di identità.

## remote.reasoning

La precedente evidenza Gate C v1 di `agy/gemini-3.8-flash-tiered` per `remote.reasoning` (3 casi Teacher Service distinti, output JSON validi 3/3, revisione umana; stato storico `ELIGIBLE`/`VALIDATED`) è conservata e non cancellata. La route Gemini ha fallito anche la probe corrente con `keepalive`, quindi lo stato corrente è **availability regression / unavailable at preflight**, non un nuovo giudizio sulla qualità reasoning. Non è stata sostituita l’evidenza storica né eseguito un nuovo benchmark reasoning.

## Structured output reliability

La probe richiedeva `response_format=json_schema` con un contratto minimo. Esito: 0/11 contenuti JSON attribuibili; il parser e lo schema non sono stati soddisfatti perché i chunk erano vuoti. TTFT non misurabile, token usage assente, cost `unknown`. Non viene fatta alcuna affermazione di supporto JSON Schema per i candidati.

## Profile validation matrix

| Model | `remote.generation` | `remote.longform` | `remote.reasoning` |
|---|---|---|---|
| `agy/gemini-3.8-flash-tiered` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **HISTORICAL_ELIGIBLE; current route unavailable** |
| `mistral/mistral-medium-3-5` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `opencode-zen/mimo-v2.5-free` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `nvidia/moonshotai/kimi-k3` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `nvidia/deepseek-ai/deepseek-v4.1-flash` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `groq/openai/gpt-oss-120b` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `openrouter/qwen/qwen3.8-27b:free` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `openrouter/google/gemma-4-31b-it:free` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `openrouter/nvidia/nemotron-3.5-lightning:free` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `nvidia/z-ai/glm-5.3` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |
| `opencode-zen/mimo-v2.6-flash-free` | **UNAVAILABLE_FOR_TEST** | **UNAVAILABLE_FOR_TEST** | **NOT_TESTED** |


## Provisional recommendations

- `remote.generation`: nessuna route; nessun default provvisorio.
- `remote.longform`: nessuna route; nessun default provvisorio.
- `remote.reasoning`: l’evidenza storica di Gemini resta consultabile ma la route corrente è indisponibile alla probe. Nessuna nuova raccomandazione runtime finché l’identità di esecuzione non è ricostruibile.

## No-vendor-lock verification

La source of truth richiede profili/capability nel dominio e Model ID dinamici/configurabili (`docs/ai/model-routing-and-registry.md`, sezioni 4, 5, 8 e 11). Questo benchmark non modifica il registry canonico né codice di dominio; gli ID compaiono soltanto in snapshot, richieste di benchmark e artifact di validazione. Nessun default o requisito del dominio è stato legato a un provider.

## Failures / anomalies

- Le 11/11 richieste di probe in `attempt-02` hanno ottenuto HTTP 200, ma il corpo SSE conteneva un solo chunk `chat.completion.chunk` con `id=chatcmpl-keepalive`, `model=keepalive`, `choices[0].delta={}` e `finish_reason=null`.
- Le risposte di `attempt-02` non hanno contenuto testuale, usage o identità univoca; tutte sono state fermate come `UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY`. Nessuna corpus generation o fallback nascosto nel tentativo corretto; i retry bounded di `attempt-01` sono invalidati e non contati.
- Il check credenziale e il catalog endpoint sono `READY`/HTTP 200, ma questo non convalida il percorso chat-completions.
- `attempt-01` è invalidato metodologicamente: TTFT era misurato dopo il buffering del body; il runner non interrompeva subito le chiamate con risposta vuota/identità non verificata; lo schema generation includeva `uniqueItems`, rifiutato da Groq. Questi aspetti sono stati corretti per `attempt-02`; i raw precedenti restano conservati ma esclusi.
- Interpretazione limitata: pattern cross-route compatibile con una risposta keepalive del gateway al posto della completion; i dati non provano quale componente upstream abbia generato il comportamento. Fermata l’espansione dopo 11 prove distribuite su sei owner/provider distinti, per evitare richieste ripetitive inutili.

## Files produced

- Report: `validation/results/Gate-C-v2-remote-models-report.md`
- Human review packet: `validation/results/Gate-C-v2-human-review-packet.md` (bloccato, nessun output candidato)
- Catalog snapshot: `validation/artifacts/Gate-C-v2/catalog-snapshot.json`
- Preflight results: `validation/artifacts/Gate-C-v2/preflight-results.json`
- Profile validation: `validation/artifacts/Gate-C-v2/profile-validation.json`
- Runtime metrics: `validation/artifacts/Gate-C-v2/runtime-metrics.json`
- Deterministic checks: `validation/artifacts/Gate-C-v2/deterministic-checks.json`
- Review key: `validation/artifacts/Gate-C-v2/review-key.json` (vuota: nessuna coorte)
- Manifest: `validation/artifacts/Gate-C-v2/MANIFEST.json`
- Raw probe requests/responses: `validation/work/Gate-C-v2/outputs/attempt-02/`
- Candidate selection: `validation/work/Gate-C-v2/inputs/candidate-selection.md`

## Gate D readiness

**BLOCKED_PENDING_TRANSPORT_RUNNER_FIX.** La revisione manuale dei raw SSE e del runner ha dimostrato che `attempt-02` è metodologicamente invalidato da un bug del client di benchmark: `read_response_body()` interrompe lo stream al primo chunk OmniRoute `model=keepalive`, trattandolo erroneamente come identità del modello eseguito. In `attempt-01` gli stessi heartbeat sono seguiti da normali chunk del modello reale e da una terminazione effettiva. Di conseguenza le 11 classificazioni `UNAVAILABLE_FOR_TEST / GATEWAY_DISCREPANCY` non costituiscono evidenza di indisponibilità delle route, e la presunta regressione corrente di `remote.reasoning` va considerata **UNDETERMINED / NOT VALIDLY RETESTED**. Correggere il runner affinché ignori gli heartbeat ai fini di identity/content/finish, quindi ripetere il preflight. Non iniziare Gate D.

## Addendum — Transport fix / attempt-03 (2026-09-30)

- L'evidenza di route availability di `attempt-02` è **`INVALIDATED_TRANSPORT_CLIENT_BUG`**: il reader interrompeva lo stream e falliva l'identità sul heartbeat OmniRoute `model=keepalive`. Non deve essere letta come regressione delle 11 route.
- Il nuovo parser/reader ignora e conta separatamente i heartbeat, preserva gli ID e il contenuto degli eventi reali, verifica gli ID modello reali, continua fino al terminale/EOF/timeout e misura TTFT sul primo `delta.content` non vuoto. Le regression sintetiche A–E passano (F aggiuntivo incluso).
- `attempt-03` è evidenza valida di Stage A per `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b` e `openrouter/dots-studio/dots-3-note-preview:free`: HTTP valido, output non vuoto, identità attribuibile, finish reason `stop`. Non è stato inviato corpus.
- La prima esecuzione del driver ha avuto un bug locale di classificazione (`AttributeError` su `error=null`) che ha impedito Stage B; in seguito un reserve candidate ha attivato il ramo HTTP 401/403. Il vecchio handler non ha persistito status esatto/body; origine gateway-vs-route non attribuibile. Nessuna credenziale alternativa è stata usata e nessuna chiamata è stata eseguita dopo tale evento.
- Stage B structured-output support: 0 candidati testati; coorte di tre route strutturate: nessuna. Nessuna generazione DBMS/Excel o full benchmark è stato avviato. Quindi attempt-03 è **PARTIAL**, il rerun Gate C v2 resta **BLOCKED**.
- Per `remote.reasoning`, l'evidenza resta **`HISTORICAL_ELIGIBLE`** e il preflight corretto Gemini aggiorna la disponibilità corrente a **`CURRENT_ROUTE_OPERATIONAL`**; nessun task reasoning/qualità è stato ripetuto.

Dettagli, metriche e artifact: `validation/results/Gate-C-v2-transport-fix-report.md` e `validation/artifacts/Gate-C-v2-transport-fix/`.


## Addendum — composite benchmark attempt-05 (2026-10-01)

### Esito e coorte congelata

**Gate status: `TECHNICAL_PARTIAL`.** **Attempt status: `RUNNER_FAILURE` — non decision-grade.** Il `--validate-only` ha restituito `READY_FOR_MODELS_COMPOSITE_RUN`; attempt-05 ha usato la coorte congelata senza discovery, reserve, re-ranking della coorte o sostituzione silenziosa:

- `agy/gemini-3.8-flash-tiered`
- `groq/qwen/qwen3.8-27b`
- `openrouter/dots-studio/dots-3-note-preview:free`

Il check iniziale del catalogo live è HTTP 200, 61 modelli. Tutte e tre le probe correnti hanno `ROUTE_OPERATIONAL`, identità reale ricostruibile dal catalogo e `finish_reason=stop`. ID effettivamente osservati: `gemini-3.8-flash-tiered`, `qwen/qwen3.8-27b`, `dots-studio/dots-3-note-preview:free`. Il primo avvio isolato nel sandbox si era fermato al solo GET catalogo per errore di trasporto, prima dell'invio di corpus; l'esecuzione attempt-05 è avvenuta soltanto dopo il successivo accesso autorizzato al runtime. Nessuna credenziale è stata letta fuori dal loader Teacher Service e nessun fallback è stato usato.

Il source set effettivamente registrato è DBMS `dbms_student_lesson.md` (SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`) e, per Excel, `excel_demo_b1.md` (SHA-256 `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`) più `excel-workbook-ast-projection.json` (SHA-256 `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`). `excel_teacher.md` non compare nei source set inviati; nessun riferimento held-out o dato personale studente è stato inviato.

### RUNNER_FAILURE — causa e impatto

Nel ciclo principale di `validation/work/Gate-C-v2/scripts/run_composite_benchmark.py`, la generazione viene salvata in `results[(mid, sid)]` solo dopo che `run_longform()` è terminato (assegnazione successiva alla chiamata longform, riga 902 al momento dell'audit). Se la sezione longform genera `CandidateRunAbort`, il ramo di errore salva soltanto `run_error` e imposta `route_state=RUN_FAILURE`: la generazione già completata non viene riportata nel dataset usato da `score_object()`, `profile-validation.json` e dalla selezione della fase 2.

Evidenza concreta: la generation DBMS di `groq/qwen/qwen3.8-27b` è presente nei raw, in `parsed-output.json` e nel file blindato `CANDIDATE-B/dbms_sql/generation-output.json`. Il suo JSON passa parse, schema e semantic validation, ha 618 parole di Lesson Plan, 546 parole di Student Material e 0 hard source-specific violations. La successiva sezione longform 02 termina con 11 heartbeat, EOF, nessun model event reale, nessuna identità e nessun finish reason. Il runner registra il fallimento e perde la generation valida dall'aggregazione.

Di conseguenza, la classifica di fase 2 dichiara per quella route quattro deliverable mancanti e zero deliverable presenti; seleziona i codici `CANDIDATE-B` e `CANDIDATE-C`, ma non esegue le seconde run Excel perché entrambe le route risultano `RUN_FAILURE`. La classifica e gli status profilo aggregati non sono utilizzabili per confrontare i modelli. Il runner non è stato modificato e non sono state fatte altre chiamate remote dopo aver rilevato il difetto.

### Risultati tecnici osservabili — senza giudizio qualitativo

| Model ID | Current guard | `remote.generation` osservato | `remote.longform` osservato | Stato interpretabile |
|---|---|---|---|---|
| `agy/gemini-3.8-flash-tiered` | `ROUTE_OPERATIONAL` | DBMS ed Excel terminano con `finish_reason=length`; JSON non parsabile/schema non valido. In Excel il checker rileva 1 dettaglio source-specific non verificabile. | Entrambi gli script sono assemblati in 5 sezioni e time map 120 min; 4.193 parole DBMS e 4.404 Excel. Il checker segnala 0 dettagli invalidi DBMS e 28 Excel; entrambi falliscono il technical pass. | `TECHNICALLY_REJECTED` per i deliverable generati sui controlli oggettivi; nessun punteggio qualitativo. |
| `groq/qwen/qwen3.8-27b` | `ROUTE_OPERATIONAL` | DBMS JSON completo e tecnicamente valido, 0 hard violations; run Excel non eseguita. Output DBMS recuperabile nei raw ma omesso dall'aggregato. | DBMS si interrompe alla sezione 02 dopo heartbeat-only + EOF; nessuno script assemblato. Excel non eseguito. | Generation DBMS `PENDING_HUMAN_REVIEW` solo come output isolato; stato del profilo bloccato. Longform non completato; nessuna conclusione qualitativa. |
| `openrouter/dots-studio/dots-3-note-preview:free` | `ROUTE_OPERATIONAL` | DBMS termina con `finish_reason=length`, senza JSON/deliverable valido. Excel non eseguita. | Non avviata dopo il fallimento tecnico della generazione DBMS. | Generation DBMS `TECHNICALLY_REJECTED`; longform `NOT_RUN`, senza conclusione di qualità. |

`profile-validation.json` contiene stati aggregati generati dal runner ma, per il difetto sopra, **non è una fonte canonica per gli stati di profilo**. In particolare non usare il `TECHNICALLY_REJECTED` aggregato per la generation Groq come giudizio sul suo output DBMS: è in conflitto con la prova raw del JSON valido. La route Groq resta comunque incompleta sul profilo complessivo perché Excel non è stato eseguito.

### Teacher Script, controlli source-specific e repair

- Gemini DBMS: 5 sezioni, 120 minuti, 4.193 parole; nessun hard source-specific violation rilevato. Supera il target verbale indicativo di 3.000–4.000 parole e il runner marca il longform `LONGFORM_TECHNICAL_ISSUES`.
- Gemini Excel: 5 sezioni, 120 minuti, 4.404 parole. Il checker marca 28 riferimenti/celle/range non verificabili; il conteggio è quello del checker deterministico, non una valutazione didattica umana. Un riferimento alla generation Excel è anch'esso segnalato come non verificabile.
- Gemini generation: entrambi i JSON necessari non sono parsabili e hanno `finish_reason=length`; non si assegnano parole finali a Lesson Plan/Student Material non validati.
- Groq DBMS generation: output completo, schema/semantica validi; l'artefatto non è stato incluso negli aggregati per la causa locale descritta.
- Dots DBMS generation: risposta terminata a `length`; non c'è output strutturato valido.

**Hard source-specific violations osservate: 29** nei deliverable finali sottoposti ai controlli disponibili: 1 nella generation Excel Gemini e 28 nel Teacher Script Excel Gemini. La generation DBMS Groq, recuperabile nei raw ma omessa dagli aggregati, ne ha 0. Il conteggio non include in modo aggregato le varianti di repair rifiutate; non è un conteggio di claim unici né una sentenza umana. Heuristics di falsa attribuzione: nessun hit riportato.

Sono stati eseguiti **7 bounded repair**, tutti nei longform Gemini (3 DBMS, 4 Excel); nessun loop illimitato. La fase 2 Excel non è stata eseguita.

### Metriche runtime e failure

Ci sono 29 richieste d'inferenza in `request-index.jsonl` e 29 record di trasporto corrispondenti in `runtime-metrics.json`, oltre al GET catalogo: 30 chiamate remote secondo `execution-status.json`. Costi: `unknown` per tutti i candidati. I dati token sono quelli esposti dal gateway; le somme includono probe, plan, sezioni e repair, quindi non sono confronti di costo/efficienza a parità di output.

| Model ID | Chiamate d'inferenza | Latenza totale registrata | TTFT registrato | Token input/output registrati | Failure runtime |
|---|---:|---:|---:|---:|---|
| `agy/gemini-3.8-flash-tiered` | 22 | 1,726–52,525 s | 1,722–45,932 s | 637.985 / 168.623 | Nessuna failure di trasporto; 5 chiamate terminano `length`, incluse le due generation e repair troncati. |
| `groq/qwen/qwen3.8-27b` | 5 | 6,656–29,541 s | 4 chiamate: 6,636–28,743 s | 7.809 / 6.988; una sezione senza usage attribuibile | Una sezione longform HTTP 200 ma EOF dopo 11 heartbeat, senza model event, identity o finish reason. |
| `openrouter/dots-studio/dots-3-note-preview:free` | 2 | 3,148–87,896 s | 3,002 s sulla probe valida | 1.845 / 9.114 | La generation DBMS termina `length` e non produce un deliverable strutturato valido. |

I costi restano `unknown`. I token/s riportati in alcuni record non sono esposti qui come metrica decisionale perché presentano valori non positivi/non coerenti con la durata residua; TTFT, latency e usage grezzi restano consultabili nei record raw. Il conteggio “output words” per richieste separate non va sommato come volume finale, perché include sezioni e repair.

### Review packet, status e profilo reasoning

Il packet aggiornato è **BLOCKED** per una review umana completa a livello di profilo: mancano deliverable e scenari, e la fase 2 non è stata eseguita. Può servire solo per una revisione diagnostica dei singoli output presenti, senza concludere eligibility.

È stato rilevato anche un rischio di blindatura: i `deterministic-review-summary.json` sotto `blinded/CANDIDATE-A/` contengono Model ID/provider nel corpo. Non sono inclusi né referenziati nel packet; sono mantenuti intatti come raw attempt-05. Il packet fa riferimento solo agli output didattici anonimizzati verificati e marca esplicitamente gli output mancanti.

`remote.reasoning` resta **`HISTORICAL_ELIGIBLE`** per Gemini; il current availability guard attempt-05 conferma **`CURRENT_ROUTE_OPERATIONAL`**. Nessun benchmark reasoning è stato ripetuto e nessuna conclusione di qualità reasoning è stata modificata.

### Integrità, manifest e provenance

- I 7 file aggregati elencati nel `MANIFEST.json` hanno hash/dimensioni verificati: PASS.
- I 7 file storici conservati in `history/pre-attempt-05/` corrispondono agli hash/dimensioni registrati in `benchmark-provenance.json`: PASS.
- Il catalog snapshot specifico `catalog-snapshot-attempt-05.json` esiste, ma non è incluso tra i file hashati del `MANIFEST.json`; il manifest non hash-a neppure il raw tree attempt-05 né gli output blindati. La ricostruibilità integrale del run non è quindi certificata dal manifest corrente.
- Il `review-key.json` contiene il mapping separato; il packet non lo ripete.

### Decisione aggiornata

`TECHNICAL_PARTIAL — RUNNER_FAILURE`. Nessun modello è `ELIGIBLE` per `remote.generation` o `remote.longform`; nessun default provvisorio è raccomandato. Candidate-level output che superano i soli controlli tecnici possono restare `PENDING_HUMAN_REVIEW` soltanto per il singolo artifact, senza promozione del profilo.

- `remote.generation`: Gemini `TECHNICALLY_REJECTED`; Groq `PENDING_HUMAN_REVIEW` per il solo DBMS, con profilo bloccato; Dots `TECHNICALLY_REJECTED` per il DBMS provato.
- `remote.longform`: Gemini `TECHNICALLY_REJECTED` dai controlli tecnici correnti; Groq non ha prodotto un Teacher Script completo; Dots `NOT_RUN` dopo la generation fallita. Questi ultimi due non consentono una conclusione qualitativa.
- Phase-2 Excel codes selezionati dal ranking runner: `CANDIDATE-B`, `CANDIDATE-C`; **nessuna seconda run effettuata**.
- Human quality review e eligibility: **BLOCKED** fino a un nuovo attempt separato, dopo correzione del runner. Non correggere/re-eseguire nello stesso attempt-05.


## Addendum — attempt-06 runner preparation (2026-10-01)

- `attempt-05` resta **`TECHNICAL_PARTIAL / RUNNER_FAILURE`**, non decision-grade; nessun raw output attempt-05 è stato modificato.
- `attempt-06` runner preparato localmente e validato; **non ancora eseguito**. Nessuna chiamata remote/corpus in questa preparazione.

## Addendum — attempt-06 execution (2026-10-01)

### Esito

**`TECHNICAL_FAIL — BLOCKED_BEFORE_BENCHMARK`.** Il controllo locale `--validate-only` aveva restituito `READY_FOR_MODELS_ATTEMPT_06` con regression A–G PASS, nessun errore, zero chiamate remote e nessun corpus inviato. L'invocazione autorizzata di `--execute-attempt-06` ha effettuato una sola chiamata, il GET iniziale al catalogo `/v1/models`, che si è concluso con `TRANSPORT_FAILURE` (`URLError: bounded /v1/models request failed`; nessuno status HTTP o request ID). Non è stato possibile leggere il catalogo live e nessuna probe di route è partita. Il runner ha registrato `CANDIDATE_UNAVAILABLE`, `candidate_results=[]`, `corpus_sent=false`, `generation_started=false` e `longform_started=false`.

Un successivo avvio esatto è stato rifiutato dal guard locale `attempt06_targets_clean`, perché il primo avvio aveva già scritto lo stato di preflight sotto `outputs/attempt-06`, `metrics/attempt-06` e `artifacts/Gate-C-v2/attempt-06`. Ha restituito `BLOCKED`, `remote_calls=0`, `corpus_sent=false`; non ha sovrascritto i file. In conformità alla policy checkpoint/interruption, non sono state pulite le directory, riprese le chiamate o ricostruite manualmente le fasi. Nessuna modifica al runner o ai parametri.

### Coorte, route e matrice

La coorte rimane congelata, senza discovery, reserve, sostituzioni o fallback:

- `agy/gemini-3.8-flash-tiered` — **NOT_TESTED** in attempt-06; il catalogo non è stato ottenuto, quindi non si può assegnare uno stato route corrente.
- `groq/qwen/qwen3.8-27b` — **NOT_TESTED** in attempt-06; il catalogo non è stato ottenuto, quindi non si può assegnare uno stato route corrente.
- `openrouter/dots-studio/dots-3-note-preview:free` — **NOT_TESTED** in attempt-06; il catalogo non è stato ottenuto, quindi non si può assegnare uno stato route corrente.

La matrice Phase 1 3×2×2 è **NO / NOT_RUN** per tutte le celle: DBMS generation, DBMS longform, Excel generation ed Excel longform su ciascuna route. Non è un risultato di qualità o di indisponibilità delle singole route. Phase 2: **NO**, ranking non calcolato, nessun candidate code selezionato. Bounded repairs: **0**. `deterministic_checker_hits`: **0 osservati; nessun deliverable è stato controllato**.

Per Gemini, `remote.reasoning` resta `HISTORICAL_ELIGIBLE`. Ultima evidenza availability precedente: `CURRENT_ROUTE_OPERATIONAL` (attempt-05); attempt-06 non ha potuto rivalutare l'availability. La qualità reasoning non è stata riesaminata.

### Stato del runner, blindatura e provenance

- **Runner status: VALID (failed closed).** Non è stato osservato un nuovo bug locale: il fallimento è avvenuto sul trasporto del catalogo iniziale, prima della matrice; il secondo avvio ha rispettato il guard anti-sovrascrittura. Il benchmark attempt-06, tuttavia, non è decision-grade.
- Review packet attempt-06: `validation/results/Gate-C-v2-human-review-packet-attempt-06.md`, **BLOCKED**, matrice esplicitamente `NOT_RUN`, nessun punteggio.
- Leakage scan sul packet con `blinded_artifact_leaks()` del runner: **PASS**. Non esistono output generativi da scansionare; il packet non espone mapping o identificatori di route.
- Provenance/manifest attempt-specific completo: **FAIL / NOT PRODUCED**. Sono presenti soltanto `attempt-06-preflight.json` e `catalog-check.json`; non esistono catalog snapshot valido, inventory/hash completi di raw/blinded/aggregati/packet o `MANIFEST.json` attempt-06. Non è stato fabbricato un manifest parziale come se il benchmark fosse stato completato.
- Nessun contenuto del Source Set è stato inviato; attempt-05 e gli attempt storici non sono stati importati o modificati.

### Artifact e decisione

- Preflight: `validation/work/Gate-C-v2/outputs/attempt-06/preflight-results.json`
- Catalog check: `validation/work/Gate-C-v2/metrics/attempt-06/catalog-check.json`
- Execution status: `validation/work/Gate-C-v2/metrics/attempt-06/execution-status.json`
- Artifact preflight: `validation/artifacts/Gate-C-v2/attempt-06/attempt-06-preflight.json`
- Human review packet: `validation/results/Gate-C-v2-human-review-packet-attempt-06.md`

`attempt-06` è **ABORTED_BEFORE_BENCHMARK**, non `RUNNER_FAILURE` e non prova di route failure. Stato gate: **`TECHNICAL_FAIL`** perché nessuna cella Phase 1 è stata eseguita. Human review: **BLOCKED**. Non iniziare Gate D.


## Addendum — attempt-07 catalog-bootstrap correction (2026-10-01)

- Canonical interpretation of attempt-06: **`ABORTED_PREBENCHMARK_CATALOG_TRANSPORT_FAILURE`**. The sole initial `/v1/models` GET ended with `http_status=null` and `TRANSPORT_FAILURE`; no candidate route was probed, no corpus was sent, and no inference started.
- Raw attempt-06 files, including the historical `CANDIDATE_UNAVAILABLE` label, are preserved unchanged; that label is not evidence that any frozen route was unavailable.
- The local attempt-07 correction adds bounded retry only to initial catalog bootstrap; attempt-07 itself has not been executed and this preparation made zero remote calls.


## Addendum — composite benchmark attempt-07 (2026-10-01)

### Esito e integrità dell'esecuzione

**Gate status: `TECHNICAL_PARTIAL`. Attempt status: `RUNNER_FAILURE`; `DECISION_GRADE NO`.** Il preflight locale era stato superato (`READY_FOR_MODELS_ATTEMPT_07`). Il GET iniziale `/v1/models` è riuscito al **tentativo 1** con HTTP 200; il catalogo live è stato salvato nell'artefatto attempt-specific. Il current availability guard ha verificato tutte e tre le route congelate senza discovery, reserve, sostituzione o fallback inter-modello.

La Phase 1 è arrivata alla matrice 3×2×2 e `phase1-matrix.json` registra esplicitamente tutti i 12 deliverable. Dopo averla scritta, il runner è terminato nel ranking oggettivo: `score_objective()` invoca `.get()` su `plan_validation` quando il valore è `null` (`AttributeError: 'NoneType' object has no attribute 'get'`). È un **bug locale del runner**, non un errore del catalogo, autenticazione o trasporto. La Phase 2 non è partita; non è stato prodotto alcun ranking né selezione di codici per la seconda run Excel. Non è stato ripreso l'eseguibile, non è stato corretto il runner e non è stato ricostruito manualmente alcun ranking o aggregato.

### Route e risultati tecnici osservati

| Model ID congelato | Availability guard attempt-07 | remote.generation — DBMS / Excel | remote.longform — DBMS / Excel |
|---|---|---|---|
| `agy/gemini-3.8-flash-tiered` | `ROUTE_OPERATIONAL`; HTTP 200, identità reale verificata, `finish_reason=stop` | `INCOMPLETE` / `INCOMPLETE` (`finish_reason=length`; JSON/schema non validi) | `COMPLETE_TECHNICAL_PASS` / `COMPLETE_TECHNICAL_ISSUES` |
| `groq/qwen/qwen3.8-27b` | `ROUTE_OPERATIONAL`; HTTP 200, identità reale verificata, `finish_reason=stop` | `COMPLETE_TECHNICAL_PASS` / `INCOMPLETE` (contenuto vuoto) | `INCOMPLETE` / `INCOMPLETE` (DBMS fallisce alla sezione 02; Excel non ottiene un plan valido) |
| `openrouter/dots-studio/dots-3-note-preview:free` | `ROUTE_OPERATIONAL`; HTTP 200, identità reale verificata, `finish_reason=stop` | `COMPLETE_TECHNICAL_PASS` / `INCOMPLETE` (`finish_reason=length`, JSON non valido) | `INCOMPLETE` / `INCOMPLETE` (plan senza contenuto valido) |

Questi sono stati per singolo deliverable dalla matrice salvata; **non** sono un ranking o un giudizio qualitativo. La failure di un deliverable non è stata reinterpretata come route failure e non ha impedito l'esecuzione degli altri task. Non sono assegnati punteggi rubric o editing effort. Nessun candidato è dichiarato `ELIGIBLE` per `remote.generation` o `remote.longform`; il profilo non è stato finalizzato dal runner.

### Metriche, Phase 2 e revisione umana

- Catalog bootstrap: **successo al tentativo 1**; nessun retry del bootstrap.
- Phase 1: **completata**, con stati registrati per tutte le celle; le chiamate hanno usato la coorte e i parametri congelati.
- Phase 2 Excel: **non eseguita**; candidati selezionati: **non prodotti**.
- Bounded repairs totali e `deterministic_checker_hits` aggregati: **non prodotti dal runner**. I valori per-deliverable eventualmente presenti restano nei checkpoint/raw; non vengono sommati o ricostruiti dopo il crash. Un checker hit resta un indicatore deterministico, non un errore fattuale confermato.
- Costi: **unknown** salvo dati affidabili esposti dal gateway; non è stato costruito un aggregato di costo.
- `remote.reasoning` per Gemini: **`HISTORICAL_ELIGIBLE`**; current availability **`CURRENT_ROUTE_OPERATIONAL`** dal guard attempt-07. Nessuna rivalutazione della qualità reasoning.

Il runner non ha emesso export blindati attempt-07 né il packet finale. È stato creato un packet **BLOCKED** senza output grezzi, mapping, punteggi o editing effort; il leakage scanner è stato eseguito sul packet ed è **PASS**. Gli output raw restano conservati nei path attempt-07, ma non vengono esposti per una review qualitativa non blindata.

### Provenance e decisione

- Catalogo e preflight attempt-07: presenti.
- Raw e checkpoint attempt-07: presenti; la matrice copre tutte le 12 celle.
- Ranking/aggregati finali, file di artifact finali attempt-07, inventory/hash completo, `benchmark-provenance.json` attempt-specific e `MANIFEST.json` attempt-specific: **non prodotti**. Provenance/manifest: **FAIL / NOT PRODUCED**; il manifest preesistente non viene presentato come manifest attempt-07.
- Attempt-01…06 e i relativi artifact non sono stati importati o modificati.
- Review packet: `validation/results/Gate-C-v2-human-review-packet-attempt-07.md`, **BLOCKED**; leakage scan: **PASS**.

Conclusione: **`TECHNICAL_PARTIAL — RUNNER_FAILURE`, non decision-grade**. La Phase 1 contiene evidenza tecnica per-cellula, ma il difetto durante il ranking impedisce la Phase 2 e la finalizzazione blindata/provenance richiesta. Human quality review e qualsiasi decisione di eligibility restano bloccate fino a un attempt separato, dopo una correzione e validazione indipendenti del runner.


## Addendum — attempt-08 Phase-2 continuation preparation (2026-10-01)

- Canonical attempt-07 overall: **`RUNNER_FAILURE / NOT DECISION-GRADE`**; Phase 1: **`VALID_PHASE1_EVIDENCE`, complete and checkpointed**. The crash followed the complete 12-cell matrix and preceded ranking/Phase 2.
- Attempt-07 ranking: **`INVALID / NOT PRODUCED`**; Phase 2: **`NOT_RUN`**; final profile aggregation/manifest: not produced. Phase 1 inferences remain valid.
- Null-safe ranking post-processing, frozen objective ranking, and a posthoc provenance index are prepared from attempt-07 Phase 1 only.
- Attempt-08 is prepared as Phase-2-only continuation: Excel run-02 for exactly the frozen top two; no Phase 1 rerun, silent replacement, or reserve. This preparation made zero remote calls and sent no corpus.


## Addendum — attempt-08 Phase-2-only continuation (2026-10-01)

### ATTEMPT-07 PHASE-1 EVIDENCE

La Phase 1 resta **`VALID_PHASE1_EVIDENCE`**, completa e immutata. Il freeze post-hoc e il ranking congelato sono stati verificati rispetto agli hash della matrice/checkpoint; la selezione non è stata ricalcolata durante l'esecuzione. I due codici previsti dal ranking erano quelli associati ai primi due Model ID congelati. Non è stata rieseguita alcuna inference Phase 1 e nessun artifact attempt-07 è stato modificato.

Attempt-07 nel complesso rimane **`TECHNICAL_PARTIAL / RUNNER_FAILURE / NOT DECISION-GRADE`**: il suo crash nel ranking non invalida la matrice Phase 1, ma neppure viene cancellato dalla continuazione.

### ATTEMPT-08 PHASE-2 EVIDENCE

`--validate-only` ha restituito **`READY_FOR_MODELS_ATTEMPT_08_PHASE2`**, regressioni A–P PASS e zero chiamate remote. L'esecuzione autorizzata ha poi effettuato il solo bootstrap catalogo `/v1/models`, con **tre tentativi**, tutti `TRANSPORT_FAILURE`, nessuno status HTTP né request ID. Il retry budget approvato è esaurito.

Dopo il terzo errore di trasporto, il runner ha sollevato `NameError: _mark_phase2_unavailable is not defined` nel proprio ramo di gestione del fallimento del catalogo. È un **nuovo bug locale del runner**, distinto dalle route e non prova di indisponibilità dei candidati. In osservanza dello stop policy non sono stati effettuati altri tentativi, non è stato modificato il runner e non si è proseguito con guard o inference.

- Current availability dei due candidati Phase 2: **NOT_TESTED**; il catalogo non è stato acquisito e i route guard non sono partiti. Nessuna sostituzione o probe del terzo candidato.
- Phase 2 Excel generation run-02: **NOT_RUN** per entrambi i candidati selezionati.
- Phase 2 Excel longform run-02: **NOT_RUN** per entrambi i candidati selezionati.
- Inference sul corpus in attempt-08: **0**; nessun corpus Excel è stato inviato.
- Bounded repairs Phase 2: **0 eseguiti**. `deterministic_checker_hits` Phase 2: **0 osservati**, poiché nessun deliverable è stato prodotto o controllato.
- Ranking e selezione restano quelli congelati; non è stata eseguita Phase 2 e non sono stati generati aggregati combinati.

### COMBINED TECHNICAL RESULT

Il set combinato **non è finalizzato**: la Phase 1 attempt-07 resta evidenza tecnica per-cellula, ma mancano le seconde run Excel Phase 2 necessarie e l'aggregazione con reliability run-01/run-02. Non sono stati assegnati nuovi status di profilo né dichiarati profili `ELIGIBLE`; i fallimenti attempt-07 restano distinti e non sono cancellati da run-02, che qui non è avvenuta.

Gate status della continuation: **`TECHNICAL_FAIL`** (Phase 2 non raggiunta; runner failure nel ramo di bootstrap). Risultato combinato Gate C: **`TECHNICAL_PARTIAL`, `DECISION_GRADE NO`**.

### PENDING HUMAN REVIEW, BLINDING E PROVENANCE

Il packet attempt-08 è **BLOCKED**: non esistono artifact Phase 2 da accostare agli output Phase 1 e il runner non ha completato la preparazione/export blindato. È stato salvato un packet bloccato privo di contenuti candidati, ID, provider, root, request/response ID o path di routing; il leakage scanner del runner ha dato **PASS**. Nessun punteggio o editing effort è stato assegnato.

La provenance finale e il manifest composito richiesti (`PHASE_1_SOURCE=attempt-07`, `PHASE_2_SOURCE=attempt-08`, inventory/hash raw/blinded/aggregati/packet) sono **FAIL / NOT PRODUCED**. La validazione del freeze/ranking non equivale al manifest finale decision-grade.

`remote.reasoning` Gemini resta **`HISTORICAL_ELIGIBLE`**. In attempt-08 la disponibilità corrente non è stata verificata; l'ultima evidenza di route operational rimane quella del guard attempt-07. Nessuna valutazione reasoning è stata ripetuta.


## Addendum — attempt-08 canonical status / attempt-09 continuation preparation (2026-10-01)

- Canonical status: attempt-07 remains `TECHNICAL_PARTIAL / RUNNER_FAILURE / NOT DECISION-GRADE`, while its complete, checkpointed Phase 1 remains `VALID_PHASE1_EVIDENCE` and immutable.
- Attempt-08 is `TECHNICAL_FAIL / RUNNER_FAILURE / ABORTED_BEFORE_PHASE2`: three catalog GET transport failures, then a local `NameError` because `_mark_phase2_unavailable` was undefined. No route guard, inference, corpus, Phase 2 deliverable, or new model evidence resulted.
- Attempt-09 is prepared locally as a Phase-2-only continuation reusing attempt-07 Phase 1 and the already frozen top-2 ranking. This preparation makes zero remote calls and sends no corpus.


## Addendum — attempt-09 Phase-2-only continuation (2026-10-01)

### ATTEMPT-07 PHASE-1 EVIDENCE

Phase 1 remains **`VALID_PHASE1_EVIDENCE / COMPLETE / CHECKPOINTED / IMMUTABLE`**. `--validate-only` returned **`READY_FOR_MODELS_ATTEMPT_09_PHASE2`** with regressions A–Z and global-auth coverage passing, zero remote calls, and all frozen inputs/hashes valid. The selected top-2 remained unchanged. The frozen ranking is stored at the attempt-08 path referenced by the attempt-09 freeze (`validation/work/Gate-C-v2/metrics/attempt-08/frozen-phase1-ranking.json`); its SHA-256 and selection were verified. No duplicate ranking file exists under `metrics/attempt-09`; the authoritative runner and readiness report both reuse the immutable attempt-08 ranking. No Phase 1 call was repeated.

Attempt-07 overall remains **`TECHNICAL_PARTIAL / RUNNER_FAILURE / NOT DECISION-GRADE`**; the valid Phase 1 cells are not retroactively invalidated or rewritten. Attempt-08 remains **`RUNNER_FAILURE_BEFORE_PHASE2`** and contributes no model evidence.

### ATTEMPT-09 PHASE-2 EVIDENCE

The exact `--execute-attempt-09-phase2` command ran once. The live catalog refresh exhausted its three permitted attempts with `TRANSPORT_FAILURE` (`URLError`, no HTTP status). The runner therefore used **`FROZEN_ATTEMPT07_CATALOG_AFTER_TRANSIENT_REFRESH_FAILURE`** only as the pre-validated identity-resolution basis; hash, selected IDs, roots, and unique alias resolution passed. It was not used for discovery, ranking, availability, or route fallback.

The direct one-shot availability guard was then attempted once for each frozen selected route. Both returned a transport-level `URLError` before an HTTP status or model event; returned identity, content, and finish reason were therefore unavailable. Neither guard met the operational definition. The benchmark records both selected candidates as **`CANDIDATE_UNAVAILABLE` for this attempt's Phase 2**, with **no confirmed global-auth failure**. This is not evidence of a model-specific or provider-specific outage; the transport failure cannot be attributed beyond the failed request. No availability/inference retries were made.

Because neither selected route passed its guard, Excel generation run-02 and Excel longform run-02 were **`NOT_RUN`** for CANDIDATE-A and CANDIDATE-B, with four explicit checkpointed failure records. No third candidate was probed or substituted. No Source Set/corpus was sent; the only chat requests were the two synthetic, non-corpus availability guards. Bounded repairs: **0**. Phase-2 `deterministic_checker_hits`: **0 observed** (no Phase-2 deliverable was produced or checked).

### COMBINED TECHNICAL RESULT

- Attempt-09 execution completed its permitted catalog/identity/route-guard path without a new runner bug; runner status: **`VALID`**. Runtime execution status is `CANDIDATE_UNAVAILABLE`; the gate result is **`TECHNICAL_PARTIAL`**, because the Phase-2 deliverables could not be reached after transport-level guard failures.
- Combined profile states before human review: **CANDIDATE-A — `CANDIDATE_UNAVAILABLE`** for generation and longform; **CANDIDATE-B — `CANDIDATE_UNAVAILABLE`** for generation and longform; **CANDIDATE-C — `TECHNICALLY_REJECTED`** on its Phase-1-only technical evidence. No profile is declared `ELIGIBLE`.
- The attempt-09 Phase-2 matrix preserves all four second-run deliverables as `NOT_RUN`; Phase-1 attempt-07 evidence remains independently represented, so run-01 outcomes are not erased or replaced.
- `remote.reasoning` for Gemini remains **`HISTORICAL_ELIGIBLE`**. Current availability was **not confirmed** in attempt-09 because its direct guard failed at transport; no reasoning quality evaluation was repeated.

### PENDING HUMAN REVIEW, BLINDING, AND PROVENANCE

The combined blind review packet is **`validation/results/Gate-C-v2-human-review-packet-attempt-09.md`**. It includes the available Phase-1 run-01 artifacts and explicitly marks unavailable Phase-2 run-02 deliverables; it contains no rubric scores, pedagogical judgments, or human editing-effort labels. Leakage scan: **PASS** (packet and blinded tree, zero detected leaks).

The attempt-09 manifest/provenance was produced and independently verified: **234/234** referenced files/hashes and sizes match; Phase-1 matrix/checkpoint/ranking hashes and all three source hashes match; Phase-2 contains four failure checkpoints; blinded and aggregate inventories are present. Composition is `PHASE_1_SOURCE=attempt-07`, `PHASE_2_SOURCE=attempt-09`; attempt-08 is recorded as failed continuation only, with no model evidence. Provenance/manifest: **PASS**.

**`DECISION_GRADE YES` for the technical evidence set**: Phase-1/ranking freezes passed; scheduling was Phase-2-only and stopped correctly at non-operational guards; failures were checkpointed; the runner completed without a local bug; combination, blinding, and provenance validations passed. This status does **not** establish generation/longform quality eligibility: those profiles remain unavailable/pending the required human review and a separate valid Phase-2 execution. Human review may proceed on the blinded artifacts actually present, without inferring quality from missing run-02 outputs.
