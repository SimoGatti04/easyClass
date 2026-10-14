# Gate C — Remote Generation Benchmark

## Executive result

**PARTIAL — i criteri di accettazione del Gate C non sono soddisfatti.** L’esecuzione e la revisione sono state completate per i candidati selezionati dal catalogo aggiornato, ma l’evidenza non consente di promuovere una route a `ELIGIBLE` per `remote.generation` o `remote.longform`. `agy/gemini-3.8-flash-tiered` è `ELIGIBLE` per il solo profilo `remote.reasoning`, limitatamente ai task Teacher Service bounded qui valutati. `mistral/mistral-medium-3-5` non ha prodotto una risposta attribuibile al modello richiesto: il suo esito è un failure operativo/di identità, **non** una valutazione negativa della qualità di Mistral.

| Profilo | Route `ELIGIBLE` | Esito Gate C |
|---|---|---|
| `remote.generation` | **Nessuna** | Non soddisfatto: fallimenti ripetuti del contratto Excel e una risposta Excel troncata/non JSON. |
| `remote.longform` | **Nessuna** | Non soddisfatto: entrambi gli script Excel troncati e non conformi; script DBMS sopra il target e con contenuti SQL non supportati. |
| `remote.reasoning` | `agy/gemini-3.8-flash-tiered` | Soddisfatto a livello di candidato provvisorio, con revisione docente L3 obbligatoria. |

**Gate D: BLOCKED.** Mancano route eleggibili per i due profili che generano il lesson pack e, soprattutto, il Teacher Script. Il Gate B `PARTIAL` per assenza di human gold nel grounding checker non è stato trattato come blocker del Gate C.

## Catalog at test time

- Prima del benchmark, il check dedicato Teacher Service era `READY`; `validation/scripts/verify_bundle.py` risultava `PASS`.
- Snapshot autorevole: `validation/artifacts/Gate-C/catalog-snapshot.json`, `/v1/models` HTTP 200, **62 model ID**, catturato il **30 settembre 2026 alle 10:38:00 UTC**. L’accesso era quello del Teacher Service tramite `validation/shared/runtime_config.py`; non sono stati letti, stampati o salvati valori di credenziali. Nessun accesso OmniRoute è stato effettuato durante la presente revisione offline.
- Gate A aveva 8 ID OmniRoute. Al refresh: **61 nuovi**, **7 scomparsi**, **1 persistente**. Per l’ID persistente `agy/gemini-3.8-flash-tiered` è cambiato il campo metadata `created`; il catalogo non ha dimostrato altre variazioni di capability per l’ID comune.
- Il catalogo attuale comprende nuovi endpoint e varianti (tra cui Gemma 4 su endpoint OpenRouter free), ma la scoperta non è stata trattata come promozione o prova di qualità. Nessun candidato teorico è stato aggiunto dopo un failure.
- Nessun prezzo affidabile è esposto nelle evidenze raccolte: **costo = unknown**.

## Candidate selection

Sono stati selezionati due ID *dopo* il refresh, come documentato in `validation/work/Gate-C/inputs/candidate-selection.md`:

1. **`agy/gemini-3.8-flash-tiered`** — route/provider `agy`, descrittore corrente dichiara testo, contesto 1.000.000, output massimo 65.536 e reasoning. È stata la route con identità verificabile; la probe JSON Schema è riuscita. Il nome “flash-tiered” non è stato assunto come prova di costo o velocità.
2. **`mistral/mistral-medium-3-5`** — famiglia/provider differente, descriptor corrente dichiara testo, contesto 128.000 e reasoning; selezionato come comparatore non-Gemini e verificato separatamente, senza alias noto duplicato.

La selezione ha dato copertura a due famiglie diverse e una route ipotizzata fast/tiered; le capability dichiarate non sono state usate come esito. Dopo la probe, Mistral ha restituito HTTP 200 ma `model=keepalive`, contenuto vuoto e nessun `finish_reason`. I quattro successivi tentativi task-level isolati hanno mostrato la stessa anomalia. Il candidato è stato fermato senza retry sostitutivi, cambio ID o fallback; la qualità del modello Mistral resta **non valutata**.

## Source separation e privacy

| Scenario/caso | Source Set effettivamente inviato | Target/reference | Esito |
|---|---|---|---|
| DBMS/SQL | `dbms_student_lesson.md`, hash `d0088409…77c9035` | Teacher Script DBMS held-out, mai incluso nei prompt | `VALID_SOURCE_SEPARATION` |
| Excel | `excel_demo_no_cellrefs.md`, proiezione senza celle/formule, hash `ec0151a9…d960d` | DOCX docente Excel held-out, mai incluso nei prompt | `VALID_SOURCE_SEPARATION`; vincolo B1 mantenuto come hard constraint |
| Partial-source DBMS | `dbms_partial_excerpt.md`, solo definizioni/schema, hash `c8992a2c…6d6ce56` | Teacher Script DBMS held-out, mai incluso nei prompt | `VALID_SOURCE_SEPARATION` |
| Cybersecurity | nessun source trasmesso | Il solo artifact disponibile era anche il target/reference | `INSUFFICIENT_SOURCE_SEPARATION` |
| History | nessun source trasmesso | Nessuna fonte distinta sufficiente | `INSUFFICIENT_SOURCE_SEPARATION` |

I tre casi reasoning hanno usato gli stessi Source Set consentiti per i task DBMS e un input sintetico circoscritto, senza target/reference finale. Nessun dato personale studente è stato trasmesso. Audit completo: `validation/work/Gate-C/inputs/source-reference-audit.json`.

## remote.generation

Il task ha richiesto Lesson Plan, Student Material distinto e metadata strutturato; i due run per scenario hanno mantenuto source set e istruzioni equivalenti. La decisione è sull’intero profilo general generation, non soltanto sui casi riusciti.

### `agy/gemini-3.8-flash-tiered`

| Scenario | Risposte complete / 2 | JSON | Qualità osservata | Editing effort |
|---|---:|---|---|---|
| DBMS/SQL | 2/2 | 2/2 validi | Buoni piani di 120 minuti e handout leggibili; entrambi introducono `ROUND` e/o una formula specifica per lo sconto/fatturato netto che la fonte non documenta. Il metadata non rileva correttamente tali contenuti non supportati. | `moderate_edits` |
| Excel | 1/2 | 1 valido, 1 invalido per troncamento | Run 1 termina con `finish_reason=length` e JSON non parseabile. Run 2 ha struttura e fasi 0–120 coerenti, ma contiene riferimenti di cella/range ed esempi di formula proibiti dal prompt e dalla limitazione B1, anche quando li descrive come “non presenti” nella fonte. | run 1 `unusable`; run 2 `major_rewrite` |
| Partial-source DBMS | 2/2 | 2/2 validi | Entrambi dichiarano il gap e limitano il piano rispettivamente a 35 e 30 minuti; handout e metadata restano coerenti con la propria run. | `minor_edits` |

Il validator runtime registra schema valido per i cinque JSON completi, ma il suo `semantic_valid=true` non ha catturato i divieti specifici Excel né la formula non supportata DBMS. Pertanto la sola validità sintattica/schema non è sufficiente per il prodotto. Il controllo offline policy-specifico è in `validation/artifacts/Gate-C/posthoc-policy-audit.json`.

#### Student Material e distinctness

I materiali DBMS sono concise schede studente ma ripetono parte delle consegne nel copione. La misura diagnostica salvata riporta containment 8-gram del **25,7%** e **20,45%** sui due run: non equivale a copia integrale, ma la ripetizione delle consegne è una ridondanza concreta e comporta editing. Le verifiche manuali non trovano paragrafi interi duplicati. Partial-source ha containment **0,96%** e **0%**, con handout e script distinti per scopo e forma. Excel run 2 è all’1%; Excel run 1 non è analizzabile perché il JSON è troncato. Le flag `student_material_distinct_from_teacher_script=true` sono state quindi considerate dichiarazioni del modello, non prova automatica di distinctness.

**Decisione profilo: `REJECTED_FOR_PROFILE`.** Ci sono evidenze positive DBMS/partial, ma il doppio failure Excel su vincoli di fonte, di cui uno troncato, non permette una route general-purpose selezionabile. L’accettazione potrebbe cambiare solo dopo un benchmark successivo e una validazione semantica che respinga formule/celle vietate prima dell’uso; non è stata costruita né simulata una simile riparazione qui.

### `mistral/mistral-medium-3-5`

Nessun output generativo verificato: schema probe e due chiamate DBMS hanno restituito `keepalive`, zero parole e nessun finish reason. **Status del profilo per questo gate: `REJECTED_FOR_PROFILE` per impossibilità operativa di verificare la route; qualità: `NOT_EVALUATED`.** Non è un giudizio di qualità su Mistral.

## remote.longform

### Teacher Script — Gemini

| Scenario | Run 1 | Run 2 | Editing / decisione locale |
|---|---|---|---|
| DBMS/SQL | 5.711 parole, `stop`, 52,820 s | 5.008 parole, `stop`, 51,575 s | Entrambi costruiscono una sequenza didattica riconoscibile con fasi, transizioni, cue, esercizi, domande/risposte ed errori da correggere. Superano entrambi il target richiesto di 3.000–4.000 parole. Assumono anche aula remota, registrazione/chat/audio e dati/database predisposti; aggiungono contenuto `ROUND` e formula di sconto non supportati. **`moderate_edits`** per run: buona base, ma taglio e verifica fattuale obbligatori. |
| Excel | 5.099 parole, `length`, 64,529 s | 4.945 parole, `length`, 55,140 s | Entrambe le risposte sono troncate e non chiudono il copione; entrambe introducono formule o sintassi funzionale specifica contro il vincolo esplicito. Run 1 contiene inoltre un riferimento di cella (`F4`). **`unusable`** per entrambi. Nessuna inferenza/citazione cella-per-cella è stata accettata come valida solo perché plausibile. |
| Partial-source DBMS | 1.254 parole, `stop`, 19,087 s | 1.290 parole, `stop`, 18,491 s | Non si richiedeva un copione da 3–4k parole: la fonte sostiene soltanto un segmento breve. Entrambi si fermano dichiarando le lacune; i minutaggi supportati riportati sono rispettivamente 20 e 25 minuti. **`minor_edits`** per segmento parziale, ma questi run non provano la capacità di produrre uno script lungo completo. |

I copioni DBMS sono la migliore evidenza longform positiva: sono pronunciabili e pedagogicamente più ricchi di una scaletta. Non sono però sufficienti per `ELIGIBLE`: eccedono il target, riportano materiale SQL che il prompt vieta di inventare e presentano modalità di erogazione non fornite dalla fonte. La failure Excel è replicata in due run e riguarda sia troncamento sia un hard boundary di fonte, non una preferenza stilistica.

### `mistral/mistral-medium-3-5`

Entrambi i task script hanno risposta `keepalive` vuota. **`REJECTED_FOR_PROFILE` in questo gate per route non verificata; qualità non valutata.** Nessuna sostituzione automatica.

**Decisione profilo `remote.longform`: `REJECTED_FOR_PROFILE` per Gemini; nessuna route eligible.** Il modello ha evidenza di generazione narrativa DBMS e di gestione corretta di un estratto parziale, ma non supera la verifica ripetuta di compliance/completezza sul caso Excel né la soglia complessiva di usabilità/tenuta per il profilo.

## remote.reasoning

Sono stati usati tre casi diversi invece di ripetere lo stesso prompt. Le risposte Gemini sono state HTTP 200, `finish_reason=stop`, identità verificata e JSON/schema/required/enum/semantic validi **3/3**.

| Caso | Esito della revisione manuale |
|---|---|
| **Assessment Blueprint Design** | Blueprint di 60 minuti/30 punti: pesi e punti di sezione tornano, i tipi item richiesti sommano a sei, e la distribuzione base/intermediate/advanced è 40/50/10. Il rationale resta da approvare dal docente per l’interpretazione del livello avanzato e l’applicazione della JOIN. Editing: `minor_edits`. |
| **Assessment Consistency Check** | Rileva correttamente I8 fuori programma, skill duplicata I3/I4, JOIN a 5/30 punti contro target 9/30 e distribuzione point-weighted base 10, intermediate 14, advanced 6 contro target 15/12/3. Le raccomandazioni sono bounded e verificabili. Editing: `minor_edits`. |
| **Curriculum / Lesson Constraint** | Raccomanda di retargettare la verifica da 45 a 25 minuti esclusivamente su database/DBMS, termini, schema e chiavi già svolti; esclude SQL non coperto; la proposta temporale 10+15 coincide con il vincolo. I tipi di item sono una proposta, non coverage fattuale. Editing: `minor_edits`. |

**Decisione profilo: `ELIGIBLE` (evidence state `VALIDATED`) come candidato provvisorio**, limitata a task reasoning Teacher Service bounded e sempre con approvazione docente L3. Non è una raccomandazione per voti, decisioni personali o automazione di assessment senza controllo umano.

## Structured output reliability

- Probe `response_format=json_schema`: Gemini superata (HTTP 200, modello univocamente mappato); Mistral non superata perché la probe ha restituito `keepalive` e zero JSON.
- `remote.generation`: **5/6** output completi JSON/schema-valid; l’Excel run 1 è incompleto e invalido. Tra i cinque validi, i controlli generici non hanno rilevato le violazioni semantiche di fonte del DBMS e Excel.
- `remote.reasoning`: **3/3** validi anche per required fields, enum e vincoli semantici deterministici previsti nei casi.
- JSON valid non significa che il contenuto sia fondato; l’audit policy-specifico ha respinto le formule/celle Excel e le formule SQL non supportate. Non promuovere `remote.generation` sulla sola base del 5/6 strutturale.

## Runtime e risorse

Valori end-to-end misurati tramite OmniRoute/provider; mediana sui run del profilo/categoria, valori completi in `validation/artifacts/Gate-C/runtime-metrics.json`.

| Gemini, tipo chiamata | TTFT mediano | Latenza totale mediana | tokens/s riportati mediani | output visibile mediano |
|---|---:|---:|---:|---:|
| Generation, n=6 | 24,098 s | 43,094 s | 750,435 | 2.186 parole |
| Longform, n=6 | 17,252 s | 52,198 s | 467,405 | 4.977 parole |
| Reasoning, n=3 | 12,191 s | 14,509 s | 2.327,598 | 196 parole |

I tokens/s sono i valori derivati dall’usage del provider e **non** throughput affidabile della sola prosa visibile: `completion_tokens` include in alcune risposte molti `reasoning_tokens` e supera perfino `max_tokens` richiesto. I tempi non sono confrontabili con la sola inferenza locale. Peak RAM remoto non esposto; costo monetario `unknown`.

Per Mistral: probe + quattro task isolati, tutti HTTP 200 ma `keepalive`, zero output, TTFT e usage assenti. Le latenze registrate sono circa 23–28 s per risposta vuota; non vanno interpretate come performance del modello.

## Profile validation matrix

| Model | `remote.generation` | `remote.longform` | `remote.reasoning` |
|---|---|---|---|
| `agy/gemini-3.8-flash-tiered` | **REJECTED_FOR_PROFILE** | **REJECTED_FOR_PROFILE** | **ELIGIBLE** (`VALIDATED`) |
| `mistral/mistral-medium-3-5` | **REJECTED_FOR_PROFILE** — route non verificata; qualità non valutata | **REJECTED_FOR_PROFILE** — route non verificata; qualità non valutata | **REJECTED_FOR_PROFILE** — route non verificata; qualità non valutata |

“Rejected” per Mistral significa soltanto non candidabile in questo benchmark per mancata attribuzione dell’esecuzione, non scarsa qualità. Per Gemini, il giudizio è per profilo e su tutti gli scenari eseguiti; i successi DBMS/partial non vengono cancellati ma non superano il failure Excel ripetuto.

## Provisional recommendations

- **`remote.generation`: nessun `PROVISIONAL_DEFAULT_FOR_PROFILE`.** Non selezionare Gemini sulla base dei soli JSON validi o dei casi DBMS/partial; non è stata validata la conformità Excel. Non si raccomanda Mistral, perché la sua esecuzione non è verificata.
- **`remote.longform`: nessun `PROVISIONAL_DEFAULT_FOR_PROFILE`.** Gemini resta il ceiling remoto qualitativo osservato, ma non supera l’idoneità di profilo; Mistral non è stato valutato. Il requisito di Teacher Script non deve essere considerato risolto.
- **`remote.reasoning`: `agy/gemini-3.8-flash-tiered` — `PROVISIONAL_DEFAULT_FOR_PROFILE`, solo per i tre task bounded provati.** Mantenere output come bozza e revisione L3; nessuna promozione eterna o uso decisionale autonomo.

## No-vendor-lock verification

La source of truth progettuale richiede profili/capability nel dominio e mantiene i model ID come dati dinamici/configurazione: `docs/ai/model-routing-and-registry.md` §§4, 5, 8 e 11; `docs/dossiers/10-ai-architecture.md` §§10–11 e principi di separazione; task policy come `remote.generation`, `remote.longform`, `remote.reasoning`. Gli ID testati compaiono nei catalog snapshot, negli artifact, nei request metricati e nelle raccomandazioni operative, non come requisito del dominio. Questo benchmark non modifica il registry canonico o il codice di dominio e non stabilisce un default eterno.

## Failures / anomalies

1. **Mistral non identificabile:** la risposta al Model ID richiesto riporta `keepalive`, zero contenuto/usage e nessun finish reason sia nella probe sia nei quattro task. Nessun fallback o sostituzione: **0 fallback**. Qualità non valutata.
2. **Excel ripetutamente non conforme:** un output generation troncato e non JSON; il secondo include coordinate/range e formula esatta. Entrambi i Teacher Script Excel hanno `finish_reason=length` e includono contenuto formula-specifico non consentito; un output cita F4.
3. **DBMS introduce formule non fornite:** `ROUND` e una formula specifica per sconto/fatturato netto vengono proposte nonostante il vincolo no-invention. Le note di lacuna presenti nel testo non sanano il fatto che l’istruzione/formula è comunque stata fornita.
4. **Distinctness DBMS imperfetta:** le consegne degli esercizi si ripetono fra handout e script; l’overlap è stato considerato lavoro di editing, non diversità tra run.
5. **Interruzione operatore:** un tentativo Gemini DBMS generation run 2 è stato interrotto prima di completare la persistenza; una sola ripresa autorizzata ha prodotto la run valutata. `retry_events=1` su tale run, non un fallback.
6. **Usage anomalo:** contatori completion/reasoning talvolta superiori al cap richiesto; metriche throughput esplicitamente caveatate.

## Files produced

- Report: `validation/results/Gate-C-remote-models-report.md`
- Catalogo autorevole: `validation/artifacts/Gate-C/catalog-snapshot.json` (conservato)
- Scelta candidati: `validation/work/Gate-C/inputs/candidate-selection.md` (conservata)
- Audit source/reference: `validation/work/Gate-C/inputs/source-reference-audit.json` (conservato)
- Output raw completi, output parsi, request e metriche per run: `validation/work/Gate-C/outputs/`
- Metriche runtime consolidate: `validation/artifacts/Gate-C/runtime-metrics.json`
- Scorecard manuali per modello/profilo/caso: `validation/artifacts/Gate-C/model-scorecards.json`
- Stato profili, acceptance e readiness: `validation/artifacts/Gate-C/profile-validation.json`
- Audit offline di policy/semantica: `validation/artifacts/Gate-C/posthoc-policy-audit.json`
- Manifest e hash artifact: `validation/artifacts/Gate-C/MANIFEST.json`

## Gate D readiness

**BLOCKED.** Gate C ha evidenza sufficiente per una route provvisoriamente eleggibile in `remote.reasoning`, ma non ha una route `ELIGIBLE` per `remote.generation` o `remote.longform`. L’accettazione integrata T1 richiede la produzione di Lesson Plan/Student Material e soprattutto Teacher Script lungo, con grounding fedele. Non iniziare Gate D prima di risolvere/rivalidare questi due profili e aggiungere controlli deterministici specifici che impediscano al caso Excel di incorporare formule o celle non presenti nella proiezione B1.
