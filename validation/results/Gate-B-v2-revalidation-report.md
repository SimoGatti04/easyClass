# Gate B v2 — Local Capability Revalidation

**Data:** 30 settembre 2026 (Europe/Rome)  
**Esito del benchmark:** **PASS — revalidation completata; i profili semantici locali testati non sono promossi.**  
**Perimetro:** Gold v2 definitivo, 51 Source Grounding + 30 Artifact Semantic Check; nessuna modifica al Gold, Gate C, OmniRoute o ai runtime.  
**Esito readiness successivo:** **BLOCKED** per Gate D finché non è completato Gate C v2, come previsto dalla sequenza in `docs/validation/00-feasibility-benchmark-gate.md`.

> PASS significa che Gate B è stato eseguito e produce decisioni riproducibili per capability; non significa che MiniCPM o un semantic checker siano approvati per l’uso operativo.

## Sintesi decisionale

| Capability / profilo | Evidenza decisiva | Status profilo/capability | Confine di automazione |
|---|---|---|---|
| Source Grounding — MiniCPM5-2B-MLX / `local.semantic_small` | 38/51 (74,5%); **11/18 UNSUPPORTED falsamente marcati SUPPORTED** (61,1% false-supported rate) | **REJECTED_FOR_PROFILE** | **HUMAN_REQUIRED**; al massimo lexical evidence ranking `SUGGEST_ONLY`, mai verità o soppressione automatica |
| Artifact Semantic Check — MiniCPM5-2B-MLX / `local.semantic_small` | 8/30 (26,7%); 0/18 SATISFIED riconosciuti; 1 falsa clearance nel task binario | **REJECTED_FOR_PROFILE** | **HUMAN_REQUIRED**; fail-closed verso docente |
| Grounding lexical overlap | 29/51 (56,9%); 0 falsi SUPPORTED su 18 UNSUPPORTED ma 22/33 SUPPORTED mancati | `ALGORITHMIC`, limitato a ordinamento/triage | **SUGGEST_ONLY**; il mancato overlap non significa UNSUPPORTED |
| Qwen3-Embedding-0.6B / `local.embedding` | B2: retrieval denso utile (+8,3 pp Recall@5 rispetto alla baseline lessicale); cosine solo diagnostica in questo report | **ELIGIBLE** per il solo dense retrieval B2 | Non è entailment né checker di verità |
| Rizzo Flow / `local.typed_decision` | B4: nessun mapping diretto giustificato ai due task semantici; per task B4 rilevanza resta solo recall-first | **NOT_NEEDED** qui | La precedente rilevanza opzionale resta **SUGGEST_ONLY**; score non calibrati |

Nessun semantic checker sostituisce il docente come autorità sul materiale finale. Il test non ha usato confidence threshold: **calibration non eseguita / non applicabile**. La decisione di review non deriva da una probabilità del modello.

## Gold v2 e integrità

- Gold: **81 record** — Grounding **51** (`SUPPORTED 33`, `UNSUPPORTED 18`); Artifact **30** (`SATISFIED 18`, `VIOLATED 9`, `PARTIAL 2`, `UNKNOWN 1`).
- Provenienza: **73 real**, **8 controlled perturbations**.
- SHA-256 `gold-v2.jsonl`: `89f89faf8e718e33a049b36a5279893edce667de5c29844f6b81e9b65292e9c3`. I conteggi sono verificati contro `Gate-B-gold-v2-report.md` e `Gate-B-gold-v2-reconciliation.md`; nessuna label è stata ricostruita o cambiata.
- Prompt per esempio: solo `claim + source_excerpt` per Grounding; `requirement + artifact_excerpt` e solo eventuale source context già presente nell’input Gold per Artifact. Label, annotazioni, note, provenance e classi epistemiche sono esclusi dal prompt.
- Non sono stati usati file quarantined/unreviewed, né chiamati modelli remoti. Nessun download, fine-tuning o fallback remoto.

## Protocollo locale e correzione harness

- Modello misurato: `MiniCPM5-2B-MLX` via oMLX su loopback; identità della risposta verificata.
- Preflight sintetico non-Gold: schema JSON per Source Grounding osservato funzionante. Ogni output finale è stato inoltre validato localmente contro lo schema stretto specifico del task.
- Parametri: temperatura `0.0`, `max_tokens=256`, risposta non-streaming; schema JSON con enum del task, `evidence_span` e `short_reason`. Nessuna chain-of-thought richiesta o salvata.
- **Correzione harness trasparente:** il primo pass Artifact riutilizzava per errore l’enum JSON Schema di Source Grounding. I 30 output di quel pass sono stati invalidati e non entrano in metriche o confusion matrix. I 30 casi sono stati rieseguiti con l’enum corretto e le predizioni finali sono tutte schema-valid. L’errore era nel harness, non conteggiato come fallimento del modello. I 51 risultati Grounding validi e gli embedding B2 sono stati riutilizzati senza nuove chiamate.
- Run finale accettato: 81 output strutturati validi; failure rate e schema error rate **0/81**. Il pass errato escluso: 30 output; nessun output gold/label è stato esposto al modello.

## A. Source Grounding Check

**Input:** claim + bounded raw source evidence. **Label:** `SUPPORTED` / `UNSUPPORTED`.  
Il task applica il contratto epistemico definitivo: parafrasi e derivazioni corrette non sono scartate perché non verbatim; `GENERAL_DOMAIN_KNOWLEDGE` e `PEDAGOGICAL_PROPOSAL` non sono grounding failure solo per la mancata copia; una falsa attribuzione alla fonte è invece `UNSUPPORTED`. Embedding similarity non è entailment.

### Risultati quantitativi

| Metodo | Accuracy | Macro F1 | SUPPORTED P/R/F1 | UNSUPPORTED P/R/F1 | False-supported | Latenza p50 / p95 | Failure / schema |
|---|---:|---:|---|---|---:|---:|---:|
| Lexical overlap normalizzato, coverage ≥ 0,65 | 56.9% | 0.560 | P 1.000 / R 0.333 / F1 0.500 | P 0.450 / R 1.000 / F1 0.621 | 0/18 | 0.028 / 0.076 ms | 0 / 0 |
| MiniCPM5-2B-MLX | 74.5% | 0.673 | P 0.738 / R 0.939 / F1 0.827 | P 0.778 / R 0.389 / F1 0.519 | **11/18 (61.1%)** | 1772.3 / 3029.0 ms | 0 / 0% |

Il cutoff lexicale `0,65` è un comparatore di overlap fissato per questo calcolo, **non una confidence threshold né una soglia di promozione**. L’exact containment è misurato per caso nelle predizioni; nessuna similarità è trasformata in prova.

**Confusion matrix — overlap lessicale:**

| Gold \ Predetto | SUPPORTED | UNSUPPORTED | FAILURE |
|---|---:|---:|---:|
| SUPPORTED | 11 | 22 | 0 |
| UNSUPPORTED | 0 | 18 | 0 |

**Confusion matrix — MiniCPM:**

| Gold \ Predetto | SUPPORTED | UNSUPPORTED | FAILURE |
|---|---:|---:|---:|
| SUPPORTED | 31 | 2 | 0 |
| UNSUPPORTED | 11 | 7 | 0 |

### Pattern e decisione

- MiniCPM riconosce **31/33** claim SUPPORTED, ma marca come SUPPORTED **11/18** claim UNSUPPORTED: falso-supported 61,1%. Gli ID falsamente supportati sono: `GB-GR-035, GB-GR-037, GB-GR-038, GB-GR-040, GB-GR-041, GB-GR-042, GB-GR-043, GB-GR-045, GB-GR-046, GB-GR-047, GB-GR-048`. Questo include la falsa attribuzione esplicita `GB-GR-035` e claim sull’assenza di contenuti dal source set parziale.
- Due SUPPORTED diventano UNSUPPORTED: `GB-GR-015, GB-GR-016`. Il profilo tende quindi anche a essere troppo restrittivo su derivazioni/asserzioni supportate.
- L’overlap ≥0,65 ha 100% precisione SUPPORTED nel campione e **zero** false-supported, ma trova solo 11/33 supportati (recall 33,3%); quindi non può escludere fonti o emettere verdetti completi. È al massimo un ordinamento conservativo di elementi da sottoporre a review.
- Embedding cosine Qwen3: media post-hoc **0.647** su SUPPORTED e **0.502** su UNSUPPORTED. Il dato è solo descrittivo, su corpus piccolo; non è entailment, non ha soglia, e non è usato per classificare.
- Latency locale p50 `1772.3 ms`, p95 `3029.0 ms`; schema/failure 0%. La buona latenza e l’accuracy micro non compensano il rischio di falsa sicurezza.

**Decisione:** Source Grounding = **HUMAN_REQUIRED**. Miglior metodo: supporto lessicale/estrazione deterministica come priorità di evidence, poi review umana; non c’è un classificatore automatico con rischio accettabile dimostrato. MiniCPM/local semantic grounding checker = **REJECTED_FOR_PROFILE**. Nessun output grounding può essere autorità.

## B. Artifact Semantic Check

**Input:** requirement + bounded artifact excerpt; nessun contesto source assente è stato ricostruito. **Label:** `SATISFIED`, `PARTIAL`, `VIOLATED`, `UNKNOWN`.  
Il checker non giudica schema/enum/JSON, `finish_reason`, conteggi minuti o altri controlli già deterministici.

### Risultati quantitativi — task originale

| Metodo | Accuracy | Macro F1 | Weighted F1 | SATISFIED P/R/F1 | PARTIAL P/R/F1 | VIOLATED P/R/F1 | UNKNOWN P/R/F1 | Latenza p50 / p95 | Failure / schema |
|---|---:|---:|---:|---|---|---|---|---:|---:|
| Deterministic fail-closed → UNKNOWN | 3.3% | 0.016 | 0.002 | P 0.000 / R 0.000 / F1 0.000 | P 0.000 / R 0.000 / F1 0.000 | P 0.000 / R 0.000 / F1 0.000 | P 0.033 / R 1.000 / F1 0.065 | 0.000 / 0.000 ms | 0 / 0 |
| MiniCPM5-2B-MLX | 26.7% | 0.166 | 0.157 | P 0.000 / R 0.000 / F1 0.000 | P 0.111 / R 0.500 / F1 0.182 | P 0.350 / R 0.778 / F1 0.483 | P 0.000 / R 0.000 / F1 0.000 | 1869.1 / 2749.5 ms | 0 / 0 |

**Confusion matrix — deterministic fail-closed:**

| Gold \ Predetto | SATISFIED | PARTIAL | VIOLATED | UNKNOWN | FAILURE |
|---|---:|---:|---:|---:|---:|
| SATISFIED | 0 | 0 | 0 | 18 | 0 |
| PARTIAL | 0 | 0 | 0 | 2 | 0 |
| VIOLATED | 0 | 0 | 0 | 9 | 0 |
| UNKNOWN | 0 | 0 | 0 | 1 | 0 |

**Confusion matrix — MiniCPM:**

| Gold \ Predetto | SATISFIED | PARTIAL | VIOLATED | UNKNOWN | FAILURE |
|---|---:|---:|---:|---:|---:|
| SATISFIED | 0 | 7 | 11 | 0 | 0 |
| PARTIAL | 0 | 1 | 1 | 0 | 0 |
| VIOLATED | 1 | 1 | 7 | 0 | 0 |
| UNKNOWN | 0 | 0 | 1 | 0 | 0 |

### Filtro secondario SATISFIED vs NEEDS_REVIEW

`NEEDS_REVIEW = PARTIAL | VIOLATED | UNKNOWN`. Gli output del modello mancanti o non validi sarebbero fail-closed su NEEDS_REVIEW.

| Metodo | Accuracy | Macro F1 | NEEDS_REVIEW precision / recall | False clearance | Quota review |
|---|---:|---:|---|---:|---:|
| Deterministic fail-closed | 40.0% | 0.286 | 0.400 / 1.000 | 0 | 100.0% |
| MiniCPM, fail-closed sugli errori tecnici | 36.7% | 0.268 | 0.379 / 0.917 | **1** | 96.7% |

### Pattern e decisione

- MiniCPM riconosce **0/18 SATISFIED**; classifica gli 18 come PARTIAL (7) o VIOLATED (11). Non alleggerisce il lavoro del docente.
- Nei casi non-SATISFIED, sbaglia `GB-AC-004` come SATISFIED, creando **1 falsa clearance** su 12 casi che richiedevano review. Il fail-closed deterministico non ne ha: review recall 100%, ma richiede di rivedere tutti i 30 casi. MiniCPM marca 29/30 come review (96,7%), con recall 91,7% e una falsa clearance: è peggiore e non riduce il carico in modo sicuro.
- `PARTIAL` (n=2) e `UNKNOWN` (n=1) hanno supporto troppo basso per conclusioni generalizzabili. La loro scarsa resa è un segnale di rischio, non una stima stabile di comportamento futuro.
- Latenza MiniCPM p50 `1869.1 ms`, p95 `2749.5 ms`; schema/failure 0% nel pass valido. Nessuna calibration o confidence threshold.

**Decisione:** Artifact Semantic Check = **HUMAN_REQUIRED**. Per il filtro di review, tenere il fail-closed deterministic routing verso il docente invece di un verdetto AI; applicare automaticamente solo i controlli perfettamente verificabili via codice (JSON/schema, enum, campi, tempi, finish reason). MiniCPM/local artifact checker = **REJECTED_FOR_PROFILE**.

## Riutilizzo di B1/B2/B4 e confini

- **B1:** si riutilizzano i limiti già accertati del parsing, inclusa la perdita di coordinate/formule XLSX senza adapter cell-aware; nessun nuovo test B1.
- **B2:** Qwen3-Embedding-0.6B rimane **ELIGIBLE** per dense retrieval nel perimetro misurato; FTS5/exact resta preferibile per query letterali. B2 aveva dense Recall@5 `0,792` (+8,3 pp sulla baseline lessicale), con latenza p50 `125,196 ms` sul run precedente. Nessun valore B2 è interpretato come grounding entailment.
- **B4:** nessun Rizzo benchmark è stato rieseguito. `material_type`, `source_category`, soggetto e local-search routing restano deterministici/lessicali come già concluso; relevance è pareggiata in accuracy ma recall-first e `SUGGEST_ONLY`. Non c’è mapping diretto giustificato dai task Rizzo ai due task semantici correnti: **Rizzo = NOT_NEEDED** qui.
- **B3/B5–B6:** evidenza long-form riusata soltanto per mantenere il confine; non inferita come accuracy bounded. Il presente benchmark non promuove MiniCPM alla generazione long-form.
- Dossier 08: controlli semantici non sono autorità; le bozze passano da review. Dossier 10: prevale il metodo meno complesso/verificabile; embeddings recuperano candidate evidence, non entailment.

## Stati finali capability/profile

| Capability | Miglior metodo pratico | Metodo status | Profilo locale / stato | Automation boundary |
|---|---|---|---|---|
| Source Grounding | Lessico/overlap per ordinare candidate evidence, poi review | `ALGORITHMIC` con uso **SUGGEST_ONLY** | `local.semantic_small`: **REJECTED_FOR_PROFILE** | **HUMAN_REQUIRED**; **FORBIDDEN_AS_AUTHORITY** |
| Artifact Semantic Check | Deterministic fail-closed + review umana; regole deterministiche solo per sotto-task formalizzabili | `DETERMINISTIC` per controlli di schema/policy codificabili; semantica = review | `local.semantic_small`: **REJECTED_FOR_PROFILE** | **HUMAN_REQUIRED**; **FORBIDDEN_AS_AUTHORITY** |
| Dense retrieval | Qwen3 embedding + FTS5/exact fallback nel perimetro B2 | `ALGORITHMIC` | `local.embedding`: **ELIGIBLE** (riuso B2 soltanto) | Non conferisce verità al match |
| Rizzo typed decisions | Nessuna chiamata per questi task | **NOT_NEEDED** | `local.typed_decision` invariato per task; relevance B4 resta `SUGGEST_ONLY` | No auto-esclusione fonti |
| Structural/format/temporal checks | Regole e validatori | `DETERMINISTIC` | **VALIDATED** nel perimetro B5/B6 già misurato | `AUTO_INTERNAL` dove policy e precondizioni sono rispettate |

`VALIDATED`/`ELIGIBLE` sono circoscritti al profilo/capability e alle evidenze richiamate. Nessuna modifica al Model Registry globale.

## Gate outcome, limiti e readiness

- **Gate B: PASS come revalidation completata.** Nessun modello semantico locale è promosso. Le scelte operative sono determinate: retrieval resta B2, task exact/schema restano deterministici, giudizi semantici restano al docente.
- **Gate D: BLOCKED** finché non viene completato Gate C v2; la sequenza canonica richiede Gate C Remote Generation Benchmark prima del Revised End-to-End T1. Gate C non è stato avviato né modificato in questo task.
- Nessun modello remoto, OmniRoute o fallback è stato chiamato. Non si è eseguito B1/B2/B4 di nuovo, né Gate C/D.
- Nessuna accuracy aggregata è usata per autorizzare automatismi. Una singola falsa attribuzione/falsa clearance ha costi di falsa sicurezza superiori a una review aggiuntiva; entrambe le capability restano docente-controlled.

## Artefatti

- `validation/artifacts/Gate-B-v2/predictions.jsonl`
- `validation/artifacts/Gate-B-v2/metrics.json`
- `validation/artifacts/Gate-B-v2/confusion-matrices.json`
- `validation/artifacts/Gate-B-v2/runtime-metrics.json`
- `validation/artifacts/Gate-B-v2/MANIFEST.json`
- `validation/work/Gate-B-v2/run_revalidation.py`
- `validation/work/Gate-B-v2/finalize_outputs.py`
- `validation/work/Gate-B-v2/harness-correction.md`
- `validation/results/Gate-B-local-capabilities-report.md` (sezione post-Gold-v2 aggiunta, storico PARTIAL conservato)
- `validation/results/Gate-B-v2-revalidation-report.md`

## Verifiche finali

- Bundle pre-run: `python3 validation/scripts/verify_bundle.py` → **PASS**.
- Gold count/label/origin/hash: **PASS**; Gold non modificato.
- ID e input hash 1:1 tra Gold e predictions: **PASS**.
- Tutte le predizioni finali: schema-valid; failure e schema error rate finali 0; harness artifact errato escluso e documentato.
- Confusion matrix totals: 51 e 30; classi e conteggi verificati contro il Gold canonico.
- Hash di tutti e cinque gli artifact confrontati con `MANIFEST.json`: **PASS**.
- Nessun modello remoto o chiamata Gate C/D.
