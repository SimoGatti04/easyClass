# Gate C v2 — attempt-08 Phase-2 continuation readiness

## Esito

**READY_FOR_MODELS_ATTEMPT_08_PHASE2** — preparazione locale; nessuna chiamata remote e nessun corpus inviato.

## Interpretazione attempt-07

Attempt-07 complessivo è **`TECHNICAL_PARTIAL / RUNNER_FAILURE / NOT DECISION-GRADE`**. La Phase 1 è **`VALID_PHASE1_EVIDENCE`, `COMPLETE`, `CHECKPOINTED`**: tutte le 12 celle sono state tentate e registrate. Il crash locale è avvenuto dopo la matrice Phase 1 e prima di ranking, selezione, Phase 2 e aggregazione finale. Il difetto era `score_objective()` non null-safe quando `plan_validation` vale `null` (`LONGFORM_INCOMPLETE`). Non ha alterato scheduling o preservazione dei deliverable. Ranking attempt-07: **INVALID / NOT PRODUCED**; Phase 2: **NOT_RUN**. Non si importano ranking, Phase 2 o profile aggregation inesistenti; nessuna inference Phase 1 è invalidata.

## Correzione e regression null-safety

`schema_validation`, `plan_validation`, `assembly` e `assembly.checks` opzionali/null sono normalizzati nei percorsi di ranking e nei riepiloghi blindati; completed_sections non-list è gestito in modo stabile. La semantica del ranking è invariata. A–P: **PASS**.

- A: **PASS**
- B: **PASS**
- C: **PASS**
- D: **PASS**
- E: **PASS**
- F: **PASS**
- G: **PASS**
- H: **PASS**
- I: **PASS**
- J: **PASS**
- K: **PASS**
- L: **PASS**
- M: **PASS**
- N: **PASS**
- O: **PASS**
- P: **PASS**

## Ranking frozen dalla sola matrice Phase 1

Input esclusivo: `validation/work/Gate-C-v2/metrics/attempt-07/phase1-matrix.json` — SHA-256 `e105eb6a8c3b2b7bb3ab7c17df38abb3ce073760742feb706e9954020aa182ce`. Nessun dato attempt-05, qualità umana o LLM judge è stato usato.

- Algoritmo: `gate-c-v2-objective-ranking-v1`.
- Ordine: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`.
- Top 2 congelati: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`.
- Criteri invariati: ["fewer missing/not-run deliverables", "fewer technical-invalid deliverables", "fewer deterministic_checker_hits", "fewer schema failures", "fewer truncation/finish failures", "fewer longform word-budget failures", "stable Model ID tie-break"].
- Artifact: `validation/work/Gate-C-v2/metrics/attempt-08/frozen-phase1-ranking.json`; `remote_calls=0`.

## Freeze provenance e mancato rerun Phase 1

`validation/artifacts/Gate-C-v2/attempt-08/phase1-freeze.json` è un **`POSTHOC_PROVENANCE_INDEX`** creato dopo il run, non durante attempt-07. Tutte le 12 celle sono checkpointed e la matrice è completa. Non è noto alcun bug che abbia alterato scheduling o preservazione. Il ranking è ricostruibile deterministicamente; ripetere Phase 1 introdurrebbe variabilità e costo senza correggere l'evidenza esistente.

- Phase 1 matrix SHA-256: `e105eb6a8c3b2b7bb3ab7c17df38abb3ce073760742feb706e9954020aa182ce`.
- Checkpoint SHA-256: `1af106246372a2990b73ba2d2db72028816e4f16d0ef5b6f9c55cf3b84d42751`.
- Raw artifacts Phase 1 inventariati/hashati: 176.

## Attempt-08 continuation

- Target: `outputs/attempt-08`, `logs/attempt-08`, `metrics/attempt-08`.
- Consentite solo le inference Excel run-02 per i due Model ID congelati; nessuna riselezione o reserve, nessuna Phase 1 remota.
- Parametri, prompt, schema, Excel Source Set, epistemic contract, Spreadsheet Adapter e bounded repair invariati.
- Availability guard solo sui due candidati selezionati; unavailable non viene sostituito.
- 401/403 isolato è route-level; la failure auth globale richiede conferma indipendente `/v1/models` 401/403 e interrompe ulteriori guard/inference.
- Catalog retries limitati a tre tentativi per le classi approvate, backoff 2s/5s; inference senza retry.
- Candidate codes esistenti riutilizzati solo se la mapping è una bijection coerente; leak scanner per artifact e packet.
- `remote.reasoning`: Gemini `HISTORICAL_ELIGIBLE`; lo stato corrente verrà guardato al run, senza ripetere il reasoning task.

## Validate-only

- cohort_frozen_identity: **PASS** — {"model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free"], "roots": {"agy/gemini-3.8-flash-tiered": "gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b": "qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free": "dots-studio/dots-3-note-preview:free"}}
- attempt07_phase1_complete_12_of_12: **PASS** — {"matrix_cells": 6, "checkpoint_records": 14, "unique_checkpoint_cells": 12}
- ranking_recalculable_and_two_selected: **PASS** — {"selected_top2_model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b"], "criteria_order": ["fewer missing/not-run deliverables", "fewer technical-invalid deliverables", "fewer deterministic_checker_hits", "fewer schema failures", "fewer truncation/finish failures", "fewer longform word-budget failures", "stable Model ID tie-break"]}
- regression_A_P: **PASS** — {"tests": {"A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS", "F": "PASS", "G": "PASS", "H": "PASS", "I": "PASS", "J": "PASS", "K": "PASS", "L": "PASS", "M": "PASS", "N": "PASS", "O": "PASS", "P": "PASS"}, "all_passed": true, "provider_calls": 0, "network_calls": 0}
- attempt08_runtime_targets_clean: **PASS** — {"dirty_targets": []}
- same_source_hashes_and_set: **PASS** — [{"path": "validation/work/Gate-C-v2/inputs/scenario_sources/dbms_student_lesson.md", "sha256": "d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035", "size_bytes": 3623}, {"path": "validation/work/Gate-C-v2/inputs/scenario_sources/excel_demo_b1.md", "sha256": "224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414", "size_bytes": 9864}, {"path": "validation/work/Gate-C-v2/inputs/excel-workbook-ast-projection.json", "sha256": "e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed", "size_bytes": 148340}]
- spreadsheet_ast_available: **PASS** — {"sheet_count": 5}
- heldout_not_in_source_set: **PASS** — {"reference_sent_to_gateway": false, "excel_teacher_used": false}
- runtime_config_and_sse_importable: **PASS** — {"runtime_config_loader_imported": true, "shared_sse_helper_imported": true, "sse_integration": {"status": "PASS", "synthetic_provider_calls": 0, "shared_helper_only": true, "heartbeat_ignored_for_identity_content_and_termination": true}}
- phase1_not_scheduled_in_attempt08: **PASS** — {"phase1_remote_scheduling": false, "phase2_task": "Excel run-02 only"}
- catalog_retry_scope: **PASS** — {"max_attempts": 3, "backoff_seconds": [2, 5], "retryable_statuses": [502, 503, 504], "inference_retry": false}
- route_level_auth_semantics: **PASS** — {"isolated_route_401_403": "ROUTE_ACCESS_DENIED", "global_only_after_independent_catalog_401_403": "AUTH_REQUIRED_TEACHER_SERVICE"}
- model_parameters_and_contracts_unchanged: **PASS** — {"base": {"temperature": 0.2, "top_p": 0.9, "stream": true, "stream_options": {"include_usage": true}}, "limits": {"probe": 160, "generation": 9000, "plan": 3000, "section": 3000, "repair": 3000}, "generation_and_longform_contracts": "shared approved functions"}
- provenance_configuration: **PASS** — {"attempt_artifact_root": "validation/artifacts/Gate-C-v2/attempt-08", "composition": {"PHASE_1_SOURCE": "attempt-07", "PHASE_2_SOURCE": "attempt-08"}, "hash_inventory_fields": ["posthoc_phase1_freeze", "raw_artifact_inventory", "phase1_ranking", "catalog_snapshot", "blinded_output_inventory", "aggregate_artifact_inventory", "review_packet", "source_hashes"]}
- blinding_review_key_coherent: **PASS** — {"reused_existing_mapping": "attempt-05", "candidate_codes": ["CANDIDATE-A", "CANDIDATE-B", "CANDIDATE-C"]}
- phase1_freeze_posthoc_provenance: **PASS** — {"path": "validation/artifacts/Gate-C-v2/attempt-08/phase1-freeze.json", "raw_inventory_files": 176}
- attempt07_raw_immutable: **PASS** — {"protected_tree_unchanged": true}
- remote_calls_zero: **PASS** — {"remote_calls": 0, "corpus_sent": false}

Source hash pins:
- `dbms_student_lesson.md` — SHA-256 `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- `excel_demo_b1.md` — SHA-256 `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`
- `excel-workbook-ast-projection.json` — SHA-256 `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`

Provider/network calls: **0**. Corpus sent: **false**. Attempt-07 raw/matrix/checkpoint/catalog: invariati.

**Readiness: READY_FOR_MODELS_ATTEMPT_08_PHASE2**.
