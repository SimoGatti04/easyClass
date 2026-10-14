# B4 — Typed Decisions / Rizzo Flow Benchmark

## Metadata

- **Ruolo:** Decision Systems Engineer
- **Task:** B4 — Typed Decisions / Rizzo Flow
- **Data:** 29 settembre 2026 (CEST)
- **Host/hardware:** Apple Silicon Mac mini M4, 24 GiB unified memory (inventario B0); B4 ha misurato il servizio sulla macchina locale.
- **Runtime:** Rizzo Flow API su `127.0.0.1:8017`; `/health` ha restituito `ready`. Health metadata: Spark-X2.5-4B Q8_0, llama.cpp b11081, Metal GPU, prompt `spark-decisions-v3`; fingerprint riportato dal servizio nel file metrics.
- **Client:** Python 3.14.7, macOS/Darwin arm64.
- **Corpus:** sei sorgenti CORPUS reali staged per B1 e i sei artifact Markdown selezionati; gold set JSONL di 116 casi. Nessun dato individuale studenti.
- **Integrità gold:** SHA-256 `de1d671383a2ef6538ae851fb7219cb7a50d2a4fdbf0eab3b581ccabcb21f147`.
- **Stato workspace:** non è presente `.git`; nessun commit/ref disponibile.

## Objective

Stabilire, capability per capability, se Spark-X2.5 / Rizzo Flow porta un vantaggio misurabile su decisioni finite del Teacher Service rispetto a metodi meno complessi. Il benchmark non valuta se Rizzo “funziona in generale”.

## Preconditions

- Prima dell’esecuzione richiesta: `python3 validation/scripts/verify_bundle.py` → **VALIDATION_BUNDLE: PASS**, required files 30, checksums corpus 6/6 PASS.
- B1 precondizione: **IMPROVE non bloccante** per ricerca testuale sui sei artifact; caveat XLSX cell-address/formula-aware rimane fuori da questo task.
- B0 runtime: il report documenta CLI `rizzo-flow status` discordante con listener/API funzionanti. B4 ha verificato `/health` e ha usato solo `POST /v1/decisions`. **La discrepanza CLI non è stata corretta né investigata/modificata.**

## Setup

- **Rizzo:** 116 richieste individuali `POST /v1/decisions`, una per caso, `mode=shared`, schema `choice`; ordine delle opzioni permutato deterministicamente per ID. Nessun output generativo, e `generated_tokens=0` in tutte le risposte valide.
- **Baseline:** regole deterministiche per tipo file e ruolo fonte; lessico fisso per materia; overlap lessicale per pertinenza e copertura dell’indice locale. Soglie definite nel runner, non adattate al gold.
- **Small LLM baseline:** non eseguito. Il runtime Ollama disponibile esponeva `nomic-embed-text` (embedding, non classificatore generativo); la richiesta non autenticata a oMLX `/v1/models` ha risposto `API key required`. Per queste capability è stata preferita la baseline deterministica/lessicale più semplice e verificabile.
- **Calibration:** non prevista e non misurata; nessuna confidence threshold è usata. Rizzo ha marcato i punteggi come `uncalibrated_conditional_option_scores`; non sono interpretati come probabilità calibrate.
- **Latency:** wall-clock end-to-end su loopback per Rizzo (include HTTP + servizio); baseline misura il solo classificatore locale su input già disponibili, senza I/O ingestion. Percentili empirici nearest-rank. Non sono misure di throughput.

## Results — overview

| Capability | n | Baseline (accuracy; p50) | Rizzo (accuracy; p50 / p95) | API error; no-decision rate Rizzo | Decisione su Rizzo |
|---|---:|---|---|---|---|
| `material_type_classification` | 6 | 6/6 (100.0%; abstain 0.0%); 0.017 ms | 6/6 (100.0%; no-decision 0.0%); 1161.342 ms / 13421.968 ms | 0/6 (0.0%) request error; 0/6 (0.0%) abstain | **NOT_USEFUL** |
| `source_category` | 6 | 6/6 (100.0%; abstain 0.0%); 0.011 ms | 4/6 (66.7%; no-decision 0.0%); 1843.522 ms / 2216.641 ms | 0/6 (0.0%) request error; 0/6 (0.0%) abstain | **NOT_USEFUL** |
| `subject_candidate_choice` | 32 | 27/32 (84.4%; abstain 9.4%); 0.129 ms | 27/32 (84.4%; no-decision 12.5%); 1554.382 ms / 2457.134 ms | 0/32 (0.0%) request error; 4/32 (12.5%) abstain | **NOT_USEFUL** |
| `relevance_yes_no` | 32 | 29/32 (90.6%; abstain 0.0%); 0.081 ms | 29/32 (90.6%; no-decision 0.0%); 1569.360 ms / 1658.112 ms | 0/32 (0.0%) request error; 0/32 (0.0%) abstain | **SUGGEST_ONLY** |
| `local_search_needed` | 40 | 34/40 (85.0%; abstain 0.0%); 0.331 ms | 24/40 (60.0%; no-decision 0.0%); 8773.524 ms / 11431.574 ms | 0/40 (0.0%) request error; 0/40 (0.0%) abstain | **NOT_USEFUL** |

Rizzo ha avuto **0 errori HTTP/runtime** su 116 richieste. Quattro risposte (`4/116 = 3,4%`) sono astensioni `insufficient_evidence` (tutte in scelta materia); sono conteggiate come non corrette nell’accuracy e nel failure/no-decision rate. Non sono stati osservati output fuori dalle opzioni ammesse.

Accuracy complessiva micro: baseline **102/116 = 87,9%**; Rizzo **90/116 = 77,6%**. Il dato aggregato non sostituisce le decisioni capability-specific qui sotto.

### Material type classification

- **Dataset size:** 6 (gold labels e provenance in `validation/corpus/gold/typed-decisions-gold.jsonl`).
- **Baseline:** Deterministic extension→format map (`.pdf`, `.docx`, `.xlsx`).
- **Accuracy:** baseline 6/6 (100.0%); Rizzo 6/6 (100.0%).
- **Failure rate / pattern:** no-decision rate = (request errors + abstentions/invalid decisions)/n; wrong finite choices remain errors in accuracy/confusion, not API failures. Baseline abstentions 0/6 (0.0%); Rizzo abstentions/invalid 0/6 (0.0%); Rizzo request errors 0/6 (0.0%). Entrambi i metodi classificano correttamente tutti e sei i file osservati; il tipo è già codificato nel suffisso e nel manifest.
- **Latency p50 / p95:** baseline 0.017 ms / 0.048 ms; Rizzo wall 1161.342 ms / 13421.968 ms (server `total_seconds` p50 1159.959 ms, p95 13387.313 ms).
- **Calibration:** not measured / not applicable; no thresholds planned. Rizzo scores are uncalibrated conditional option scores.
- **Decision:** **NOT_USEFUL** — La regola deterministica sul suffisso raggiunge 6/6 e produce il risultato in ~0,017 ms mediana, contro ~1,16 s per Rizzo (p95 13,42 s). Un errore di formato è a basso impatto e reversibile, ma non c’è vantaggio: la regola può essere applicata deterministicamente, con fallback se il suffisso è ignoto.

**Confusion matrix — baseline** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | pdf | docx | xlsx | ABSTAIN |
|---|---:|---:|---:|---:|
| pdf | 3 | 0 | 0 | 0 |
| docx | 0 | 2 | 0 | 0 |
| xlsx | 0 | 0 | 1 | 0 |

**Confusion matrix — Rizzo Flow** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | pdf | docx | xlsx | ABSTAIN |
|---|---:|---:|---:|---:|
| pdf | 3 | 0 | 0 | 0 |
| docx | 0 | 2 | 0 | 0 |
| xlsx | 0 | 0 | 1 | 0 |

### Source category

- **Dataset size:** 6 (gold labels e provenance in `validation/corpus/gold/typed-decisions-gold.jsonl`).
- **Baseline:** Deterministic filename-pattern rule; categories cross-checked against document purpose.
- **Accuracy:** baseline 6/6 (100.0%); Rizzo 4/6 (66.7%).
- **Failure rate / pattern:** no-decision rate = (request errors + abstentions/invalid decisions)/n; wrong finite choices remain errors in accuracy/confusion, not API failures. Baseline abstentions 0/6 (0.0%); Rizzo abstentions/invalid 0/6 (0.0%); Rizzo request errors 0/6 (0.0%). Rizzo confonde entrambi i copioni docente (DBMS e cybersecurity) con `teacher_guide`; la regola sul filename è 6/6.
- **Latency p50 / p95:** baseline 0.011 ms / 0.032 ms; Rizzo wall 1843.522 ms / 2216.641 ms (server `total_seconds` p50 1842.078 ms, p95 2215.303 ms).
- **Calibration:** not measured / not applicable; no thresholds planned. Rizzo scores are uncalibrated conditional option scores.
- **Decision:** **NOT_USEFUL** — La regola basata sul nome/file raggiunge 6/6. Rizzo sbaglia entrambi i teacher script (li etichetta teacher_guide), quindi non è adatto ad applicare o suggerire questa categoria nel campione. Un ruolo errato può propagarsi a classificazione/visualizzazione downstream: il revisore umano non giustifica un classificatore più lento e meno accurato.

**Confusion matrix — baseline** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | teacher_script | student_handout | teacher_guide | instructor_demo | ABSTAIN |
|---|---:|---:|---:|---:|---:|
| teacher_script | 2 | 0 | 0 | 0 | 0 |
| student_handout | 0 | 1 | 0 | 0 | 0 |
| teacher_guide | 0 | 0 | 2 | 0 | 0 |
| instructor_demo | 0 | 0 | 0 | 1 | 0 |

**Confusion matrix — Rizzo Flow** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | teacher_script | student_handout | teacher_guide | instructor_demo | ABSTAIN |
|---|---:|---:|---:|---:|---:|
| teacher_script | 0 | 0 | 2 | 0 | 0 |
| student_handout | 0 | 1 | 0 | 0 | 0 |
| teacher_guide | 0 | 0 | 2 | 0 | 0 |
| instructor_demo | 0 | 0 | 0 | 1 | 0 |

### Subject candidate choice

- **Dataset size:** 32 (gold labels e provenance in `validation/corpus/gold/typed-decisions-gold.jsonl`).
- **Baseline:** Fixed lexicon score over section heading + excerpt; tied/no-match result abstains.
- **Accuracy:** baseline 27/32 (84.4%); Rizzo 27/32 (84.4%).
- **Failure rate / pattern:** no-decision rate = (request errors + abstentions/invalid decisions)/n; wrong finite choices remain errors in accuracy/confusion, not API failures. Baseline abstentions 3/32 (9.4%); Rizzo abstentions/invalid 4/32 (12.5%); Rizzo request errors 0/32 (0.0%). Rizzo: DBMS 8/8 e cybersecurity 8/8; storia 4/8 corretti, 3 astensioni e 1 errore verso cybersecurity; Excel 7/8 e 1 astensione. Baseline: 27/32, con 3 astensioni e due errori categoriali oltre a queste.
- **Latency p50 / p95:** baseline 0.129 ms / 0.180 ms; Rizzo wall 1554.382 ms / 2457.134 ms (server `total_seconds` p50 1553.108 ms, p95 2455.956 ms).
- **Calibration:** not measured / not applicable; no thresholds planned. Rizzo scores are uncalibrated conditional option scores.
- **Decision:** **NOT_USEFUL** — Accuracy identica alla lexicon baseline (27/32), con 4 astensioni Rizzo contro 3 astensioni della baseline e ~1,55 s di latenza mediana contro <0,13 ms. Un link materia errato è correggibile ma può contaminare retrieval/ranking; il vantaggio sulle aree facili non compensa astensioni/errori sulla storia.

**Confusion matrix — baseline** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | dbms_sql | cybersecurity | computing_history | spreadsheet_excel | ABSTAIN |
|---|---:|---:|---:|---:|---:|
| dbms_sql | 5 | 0 | 0 | 1 | 2 |
| cybersecurity | 0 | 7 | 0 | 0 | 1 |
| computing_history | 0 | 0 | 8 | 0 | 0 |
| spreadsheet_excel | 1 | 0 | 0 | 7 | 0 |

**Confusion matrix — Rizzo Flow** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | dbms_sql | cybersecurity | computing_history | spreadsheet_excel | ABSTAIN |
|---|---:|---:|---:|---:|---:|
| dbms_sql | 8 | 0 | 0 | 0 | 0 |
| cybersecurity | 0 | 8 | 0 | 0 | 0 |
| computing_history | 0 | 1 | 4 | 0 | 3 |
| spreadsheet_excel | 0 | 0 | 0 | 7 | 1 |

### Yes/no relevance

- **Dataset size:** 32 (gold labels e provenance in `validation/corpus/gold/typed-decisions-gold.jsonl`).
- **Baseline:** Fixed lexical rule: ≥2 shared content terms, or one shared ≥9-character term.
- **Accuracy:** baseline 29/32 (90.6%); Rizzo 29/32 (90.6%).
- **Failure rate / pattern:** no-decision rate = (request errors + abstentions/invalid decisions)/n; wrong finite choices remain errors in accuracy/confusion, not API failures. Baseline abstentions 0/32 (0.0%); Rizzo abstentions/invalid 0/32 (0.0%); Rizzo request errors 0/32 (0.0%). Rizzo ha 16/16 veri positivi e 13/16 veri negativi: nessun falso negativo, ma 3 falsi positivi (RE-002, RE-012, RE-024). La baseline ha 13/16 veri positivi e 16/16 veri negativi: 3 falsi negativi (RE-003, RE-013, RE-029), nessun falso positivo.
- **Latency p50 / p95:** baseline 0.081 ms / 0.095 ms; Rizzo wall 1569.360 ms / 1658.112 ms (server `total_seconds` p50 1568.180 ms, p95 1656.995 ms).
- **Calibration:** not measured / not applicable; no thresholds planned. Rizzo scores are uncalibrated conditional option scores.
- **Decision:** **SUGGEST_ONLY** — Accuracy pareggiata a 29/32, ma Rizzo trova 16/16 positivi (recall 100% contro 81,3% della regola) al costo di 3 falsi positivi (precision 84,2% contro 100%). Può essere valutato solo come espansione recall-first di candidati da mostrare al docente, mai come filtro che esclude fonti; un falso positivo aggiunge rumore ma è reversibile nella review; un falso negativo usato come filtro nasconderebbe una fonte, quindi non è consentito auto-escludere. Non c’è guadagno di accuracy e la latenza mediana è ~1,57 s.

**Confusion matrix — baseline** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | yes | no | ABSTAIN |
|---|---:|---:|---:|
| yes | 13 | 3 | 0 |
| no | 0 | 16 | 0 |

**Confusion matrix — Rizzo Flow** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | yes | no | ABSTAIN |
|---|---:|---:|---:|
| yes | 16 | 0 | 0 |
| no | 3 | 13 | 0 |

### Local-search-needed yes/no

- **Dataset size:** 40 (gold labels e provenance in `validation/corpus/gold/typed-decisions-gold.jsonl`).
- **Baseline:** Fixed lexical coverage: selected evidence first; otherwise search when ≥2 request terms match the six-file local heading/path index.
- **Accuracy:** baseline 34/40 (85.0%); Rizzo 24/40 (60.0%).
- **Failure rate / pattern:** no-decision rate = (request errors + abstentions/invalid decisions)/n; wrong finite choices remain errors in accuracy/confusion, not API failures. Baseline abstentions 0/40 (0.0%); Rizzo abstentions/invalid 0/40 (0.0%); Rizzo request errors 0/40 (0.0%). Rizzo: 11/20 casi `search_local` corretti (9 falsi skip) e 13/20 `skip_local` corretti (7 falsi search); la baseline: 19/20 e 15/20 rispettivamente. Rizzo ha attivato ricerca anche su 7 richieste chiaramente fuori dal corpus e ha mancato nove richieste per cui l’indice conteneva materiale.
- **Latency p50 / p95:** baseline 0.331 ms / 1.159 ms; Rizzo wall 8773.524 ms / 11431.574 ms (server `total_seconds` p50 8771.324 ms, p95 11430.333 ms).
- **Calibration:** not measured / not applicable; no thresholds planned. Rizzo scores are uncalibrated conditional option scores.
- **Decision:** **NOT_USEFUL** — Rizzo ottiene 24/40 (60%), contro 34/40 (85%) della baseline lessicale, e richiede ~8,77 s mediani (p95 11,43 s). Sbaglia spesso sia query con fonti presenti nell’indice sia richieste fuori dal corpus; un falso skip può perdere una fonte e un falso search spreca tempo; entrambe le azioni interne sono recuperabili, ma la baseline evita più errori con latenza trascurabile.

**Confusion matrix — baseline** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | search_local | skip_local | ABSTAIN |
|---|---:|---:|---:|
| search_local | 19 | 1 | 0 |
| skip_local | 5 | 15 | 0 |

**Confusion matrix — Rizzo Flow** (rows=gold, columns=prediction; abstentions included):

| Gold \ Predetto | search_local | skip_local | ABSTAIN |
|---|---:|---:|---:|
| search_local | 11 | 9 | 0 |
| skip_local | 7 | 13 | 0 |

## Candidate tasks assessed but excluded

- **Class candidate choice:** no real class identifiers, membership, or class↔subject candidate mapping exist in this six-file staged corpus. Creating them would invent gold labels; excluded, not scored.
- **Bounded routing among capability notes:** no CORPUS-derived real request set or validated capability-note targets are present. Synthetic router examples would not evidence product value; excluded, not scored.

## Interpretation

### Measured facts

- The deterministic/lexical baselines match or exceed Rizzo accuracy on four of five tested capabilities; Rizzo ties baseline on relevance accuracy and has a different recall/precision tradeoff.
- Material-type and source-category decisions are explicitly represented in file metadata/naming and are solved without inference.
- The best Rizzo-specific evidence is relevance recall: it recovers three relevant items missed by the fixed lexical rule, while adding three false positives. This is only a candidate-expansion tradeoff, not an accuracy gain.
- Local-search-needed routing is the weakest Rizzo result (60% vs 85%) and its request latency is much higher than the simple index rule.
- Overall requests succeeded at the API level, but “HTTP success” did not mean a correct decision; abstentions and semantic errors are reported separately.

### Limitations

- Gold derives from one teacher’s six staged files. Type/source role have only six cases; subject cases cluster by one or two source documents; local search “absence” is only absence from this bounded set. These results do not establish generalization to a full Teacher Service library, arbitrary file formats, other teachers, or unseen subjects.
- The deterministic baseline can be enriched with explicit user metadata in production; the test deliberately avoids feeding the expected label to either implementation.
- La prima richiesta misurata del task material type è stata particolarmente lenta (13,42 s); mediana e p95 sono riportate separatamente per rendere visibile la variabilità. Longer local-index states took substantially longer than short classifications.
- No calibration set, confidence-threshold policy, large library retrieval evaluation, class mapping dataset, or human usability study was tested.

### Recommendation

Keep typed decisions as an **implementation option**, not a default AI service. Prefer schema/file metadata, deterministic domain rules, or lexical retrieval where they already solve the task. The only bounded Rizzo role worth further validation is **recall-oriented relevance candidate expansion in a teacher-visible suggestion list**, with no source exclusion, no automatic application, and no reliance on raw scores as confidence. Before production use, repeat this capability on a larger, source-held-out corpus and assess teacher acceptance/false-positive cost. No autonomous action is authorized by this B4 benchmark.

## Decision

| Capability | B4 decision for Rizzo | Operational boundary |
|---|---|---|
| Material type classification | **NOT_USEFUL** | Deterministic extension/type metadata; may be auto-applied by the deterministic rule when known, not by Rizzo. |
| Source category | **NOT_USEFUL** | Filename/domain metadata; two teacher scripts were misclassified. |
| Subject candidate choice | **NOT_USEFUL** | No advantage over fixed lexicon; abstentions/errors remain. |
| Yes/no relevance | **SUGGEST_ONLY** | Recall-first candidate expansion only; teacher reviews candidates; never suppress a source based on Rizzo `no`. |
| Local-search-needed yes/no | **NOT_USEFUL** | Keep deterministic lexical corpus coverage; Rizzo is less accurate and much slower. |
| Class candidate choice | **NOT_USEFUL** — excluded from scoring | No valid class labels or context in corpus. |
| Capability-note routing | **NOT_USEFUL** — excluded from scoring | No real routing corpus; artificial for this benchmark. |

No capability is an `AUTO_CANDIDATE` for Rizzo on this evidence. The relevance suggestion remains internal/reversible and must pass the Dossier 08 Automation Policy; external publication, student-facing action, or any high-impact decision is out of scope and remains approval-gated. Dossier 10’s least-complex/verifiable-first rule favors the simpler methods here.

## Files produced

- `validation/corpus/gold/typed-decisions-gold.jsonl` — 116-case gold dataset.
- `validation/work/B4/inputs/labeling-and-scope.md` — annotation, scope, and exclusions.
- `validation/work/B4/scripts/{build_gold.py,validate_gold.py,run_b4.py,assemble_report.py}` — reproducible generation, validation, run, report scripts.
- `validation/work/B4/outputs/` — per-case baseline and raw Rizzo responses.
- `validation/work/B4/metrics/metrics.json` — per-capability accuracy, latency, failure and confusion metrics.
- `validation/artifacts/B4/` — frozen summary metrics, confusion matrices, case outcomes, and SHA-256 manifest.
- `validation/results/B4-decisions-report.md` — this report.

**Filesystem containment check: PASS.** Tutti i file creati/modificati sono sotto `~/Workspace/teacher-service-design/`; development-environment è stato solo letto/chiamato via API. Nessuna modifica al corpus sorgente o alla configurazione Rizzo.

## Test eseguiti

- `python3 validation/scripts/verify_bundle.py` pre-run: PASS.
- `python3 validation/work/B4/scripts/build_gold.py`: 116 casi generati.
- `python3 validation/work/B4/scripts/validate_gold.py`: PASS, campi/choices/provenance/hash.
- Health check Rizzo: `/health` → ready.
- `POST /v1/decisions`: 116/116 richieste concluse senza errore HTTP/runtime; 4 astensioni semantiche.
- Baseline e metriche: eseguite su tutti i 116 casi.
- `python3 validation/scripts/verify_bundle.py` post-run: **PASS** (30 required files; corpus checksums 6/6).

## Non tested

- Materiali CORPUS oltre ai sei file stage, altre biblioteche/docenti o classi reali.
- Subject/class coverage generale, class candidate mapping, capability-note routing.
- Large-scale retrieval, embeddings/reranking, generative LLM comparison, authenticated oMLX structured classifier.
- Calibrazione, soglie di confidenza, safety threshold, drift, throughput/concurrency, peak memory, network/remote deployment.
- Auto-apply, publication, student data, grading, assessment, or any downstream B5/B6 integration.

## Next step

B4 chiuso. Se il progetto vorrà approfondire Rizzo, il solo candidato è una nuova validazione indipendente della **relevance candidate expansion** su corpus più ampio/source-held-out; mantenere B5/B6 non avviati in questo task.
