# Gate B — Local Capability Validation

## Executive result

**PARTIAL — Gate C blocked.** The deterministic audit and reuse of B1/B2/B4 evidence are recorded, but the capability-specific semantic benchmarks cannot be accepted without independently authored/reviewed human gold. No accuracy, F1, confusion matrix, or semantic-model latency is claimed for the new tasks.

A gold-builder draft created during this continuation was quarantined as `validation/work/Gate-B/scripts/build_gold.unreviewed_draft.py` and disabled. Its preflight aborted before any JSONL write; the draft is unvalidated and its labels were not used for evaluation. The `validation/corpus/gold/gate-b/` directory contains no JSONL gold set. A qualified human annotator must independently author/review the labels before these data can be used.

No model inference request was made. A single localhost `/v1/models` call confirmed the installed model inventory; it did not submit any benchmark examples. No remote model was called. No confidence calibration was performed.

## Local capability matrix

| Capability | Minimum method / result | Evidence and boundary |
|---|---|---|
| Structural/schema/contract checks | **DETERMINISTIC** | Offline checks of B3/B5 metadata confirm direct JSON/schema and contract failures. Suitable for `AUTO_INTERNAL`; not a semantic quality score. |
| Verbatim repetition | **ALGORITHMIC** | Exact normalized paragraph/line counts identify repeated text without a tuned threshold. This does not establish near-duplicate recall or precision. |
| Semantic near-duplicates | **UNVERIFIED** | No human gold; no embedding or small-model comparison. |
| Source grounding | **BLOCKED** | No valid independent gold, therefore no accuracy or checker recommendation can be claimed. |
| Short semantic tagging | **BLOCKED** | No valid independent gold, therefore no comparison can be claimed. |
| Generated-artifact semantic checks | **BLOCKED** | Deterministic subchecks may be used where requirements are machine-verifiable; semantic judgments remain unvalidated and human-reviewed. |
| Relevance after retrieval | **NOT_NEEDED by default** | Reuse B2 retrieval and B4: no additional decision model justified as a default post-retrieval stage; optional Rizzo relevance expansion remains `SUGGEST_ONLY`. |
| File type/source category/subject/local-search dispatch | **DETERMINISTIC / simple baseline** | Reuse B4 only; not rerun in this gate. |

## Reused evidence

- **B1:** Marker for PDF and MinerU for Office are reused for the demonstrated parsing scope. The B1 XLSX cell-level limitation remains in force.
- **B2:** Qwen3-Embedding-0.6B is eligible for the demonstrated dense-retrieval role; FTS5 remains useful for exact/lexical search. Qwen3-Reranker-0.6B is not a default retrieval stage.
- **B4:** file type and source category are deterministic; simple subject and local-search baselines meet or exceed Rizzo on the tested cases; Rizzo relevance remains suggestion-only for recall-first candidate expansion. No Rizzo benchmark was repeated.
- **B0 discrepancy:** the B0 report records an inconsistent `rizzo-flow status` CLI result alongside a functioning listener, `/health`, and `/v1/decisions`. This anomaly was not corrected or retested in this gate.

## Offline deterministic audit of existing B3/B5 artifacts

`validation/work/Gate-B/scripts/audit_deterministic.py` reads only existing local artifacts and metrics; it uses no gold labels and makes no model calls.

- Existing run metrics: B3 has 33 rows (12 MiniCPM5, 12 Gemini, 9 Ornith); B5/B6 has 12 local generation records. These are reused measurements, not new Gate B inference runs.
- Against the B5/B6 metadata contract, **0/8** parseable-or-unparseable B3 metadata outputs fully satisfy all required fields/enums; **5/8** parse as JSON. **0/3** B5/B6 metadata responses are bare parseable JSON (all are rejected by the raw-JSON check). These are deterministic format/schema observations only.
- Exact repetition counts were computed on 25 B3 and 9 B5 text artifacts. The audit found 6 B3 and 5 B5 exact-duplicate paragraph groups (707 duplicate paragraph instances beyond first occurrences) and 35 repeated-line groups in total. Counts are descriptive; no semantic-similarity threshold was selected or evaluated.
- Existing B3 latency and completion fields are preserved in the audit JSON for traceability. They are not used as quality scores for any bounded semantic capability.

## New bounded benchmarks

| Benchmark | Gold size | Methods compared | Accuracy/F1/confusion | Latency/failures | Status |
|---|---:|---|---|---|---|
| Grounding | 0 usable | None | Not measured | Not measured | BLOCKED: independent human labels required |
| Short tagging | 0 usable | None | Not measured | Not measured | BLOCKED: independent human labels required |
| Artifact semantic checks | 0 usable | None | Not measured | Not measured | BLOCKED: independent human labels required |
| Semantic near-duplicate comparison | 0 labeled pairs | Exact-repeat audit only | Not measured | No model latency | PARTIAL: near-duplicate behavior unverified |

No calibration status is claimed because no confidence threshold was selected or evaluated. Rizzo softmax/option scores are not treated as calibrated confidence.

## Grounding checker

**Recommendation: BLOCKED / no validated recommendation.** Until independent human annotation exists and a bounded comparison is completed, grounding output must not be deployed as a truth signal. Any future checker must remain advisory with human review; deterministic exact evidence can be a control signal but does not by itself resolve paraphrase or entailment.

## Semantic tagging and artifact semantic checks

Both remain **unverified**. No MiniCPM5, Qwen embedding, or Rizzo task-level result is inferred from long-form generation results or runtime inventory. The small model adds **no validated use case demonstrated in this Gate B continuation**; this is not evidence that it has no possible bounded use.

## Small model role

- **Value demonstrated in the new bounded tasks:** none; no new task inference was run.
- **Not justified as long-form generator:** reuse the B3/B5 reports, which found important completeness, repetition, duration, and truncation limitations. That evidence is not substituted for bounded task accuracy.

## Rizzo role

- **Optional:** relevance/candidate expansion, `SUGGEST_ONLY`, as already concluded by B4.
- **Not the default:** file type, source category, subject candidate choice, and local-search-needed decisions where simpler methods performed as well or better in B4.
- **Gate B:** no new Rizzo decisions or calls were run.

## Embedding role

The reused validated/eligible role is dense retrieval from B2. No Gate B evidence establishes embeddings as sufficient for grounding, tagging, or artifact semantic checks.

## Deterministic wins

- JSON parsing, required-field/enum/type checks, response-contract checks, finish reason/truncation detection, and duration arithmetic.
- Exact file/type and source-category routing, plus the simpler tested B4 decision baselines.
- Exact verbatim repetition detection; semantic near-duplicate detection remains open.

## Profile validation

The separate profile artifact reuses existing evidence only: `local.embedding = ELIGIBLE`, `local.typed_decision = SUGGEST_ONLY` for relevance expansion, and B1 parsing profiles retain their existing validated scope. `local.semantic_small` has **no Gate B status assigned** because the human-labeled benchmark is blocked. The global Model Registry lifecycle is unchanged.

## Automation boundaries

- Structural validation: `AUTO_INTERNAL`.
- Retrieval and bounded dispatch: internal routing only within the prior evidence scope.
- Grounding, semantic tagging, and semantic artifact checks: unverified; human review required before any operational use.
- Grade/integrity decisions: `FORBIDDEN_AS_AUTHORITY`.

## Failures / limits

1. No independent human annotator has been identified; the unreviewed draft labels are quarantined and must not be treated as gold.
2. No bounded model/embedding inference or semantic accuracy benchmark was executed.
3. Exact duplication checks do not evaluate semantic similarity.
4. Previous B1–B5 evidence was reused; no duplicate benchmark was run.
5. No changes were made to `development-environment`, Rizzo Flow, oMLX, OmniRoute, or the global registry.
6. Gate C and Gate D were not started.

## Files produced

- `validation/results/Gate-B-local-capabilities-report.md`
- `validation/artifacts/Gate-B/local-capability-matrix.json`
- `validation/artifacts/Gate-B/profile-validation.json`
- `validation/artifacts/Gate-B/benchmark-summary.json`
- `validation/artifacts/Gate-B/MANIFEST.json`
- `validation/work/Gate-B/metrics/deterministic-audit.json`
- `validation/work/Gate-B/scripts/audit_deterministic.py`
- `validation/work/Gate-B/scripts/build_gold.py` (disabled pending human annotation)
- `validation/work/Gate-B/scripts/build_gold.unreviewed_draft.py` (quarantined; not an authoritative builder)

## Gate C readiness

**BLOCKED.** Resume only after a qualified human annotator independently authors/reviews the bounded gold labels, with provenance and rationale checks, then rerun the bounded local comparisons. No Gate C work has begun.

## Post-Gold-v2 definitive revalidation — 30 settembre 2026

> La sezione storica precedente resta intatta e descrive correttamente lo stato PARTIAL pre-Gold. Questa aggiunta la supersede solo per i due task semantici rivalutati sul Gold v2 definitivo.

- Gold verificato: 81 casi — 51 Grounding (33 SUPPORTED, 18 UNSUPPORTED), 30 Artifact (18 SATISFIED, 9 VIOLATED, 2 PARTIAL, 1 UNKNOWN); 73 real + 8 controlled perturbation. Hash: `89f89faf8e718e33a049b36a5279893edce667de5c29844f6b81e9b65292e9c3`.
- Grounding MiniCPM5-2B-MLX: 38/51 accuracy (74,5%), macro-F1 0,673; false-supported **11/18 (61,1%)**. L’overlap lessicale normalizzato ≥0,65 ottiene 29/51 (56,9%), 0/18 false-supported ma solo 11/33 recall SUPPORTED. Esito: **HUMAN_REQUIRED**; modello **REJECTED_FOR_PROFILE**; lessico solo per evidence triage.
- Artifact checker MiniCPM: 8/30 (26,7%), macro-F1 0,166, weighted-F1 0,157, 0/18 SATISFIED identificati. Sul binario SATISFIED/NEEDS_REVIEW: accuracy 11/30 (36,7%), recall NEEDS_REVIEW 91,7%, una falsa clearance. Il fail-closed deterministico ottiene 12/30 (40%), zero false clearance e 100% recall NEEDS_REVIEW, rivedendo tutti. Esito: **HUMAN_REQUIRED**; profilo **REJECTED_FOR_PROFILE**.
- Latenza local MiniCPM: grounding p50/p95 `1772.3/3029.0 ms`; artifact `1869.1/2749.5 ms`. Output strutturati validi 81/81 nel pass accettato; failure/schema finale 0. Il primo pass Artifact con enum errato è invalidato (30 output) e non contato come failure modello.
- Embedding Qwen resta **ELIGIBLE** solo per retrieval B2; la cosine similarity non è entailment. Rizzo non è stato rieseguito ed è **NOT_NEEDED** per questi task; l’uso B4 relevance resta `SUGGEST_ONLY`.
- **Gate B: PASS come revalidation completa; nessun semantic model promosso. Gate D: BLOCKED finché Gate C v2 non è completato** secondo la sequenza canonica.
- Report dettagliato: `validation/results/Gate-B-v2-revalidation-report.md`. Artifact e manifest: `validation/artifacts/Gate-B-v2/`.
