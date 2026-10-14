# Gate C v2 — attempt-09 Phase-2 continuation readiness

## Esito

**READY_FOR_MODELS_ATTEMPT_09_PHASE2** — preparazione esclusivamente locale. Provider/network calls: **0**; corpus sent: **false**; attempt-09 non eseguito.

## Interpretazione canonica e root causes

- attempt-07 overall: **TECHNICAL_PARTIAL / RUNNER_FAILURE / NOT DECISION-GRADE**. La Phase 1 è **VALID_PHASE1_EVIDENCE / COMPLETE / CHECKPOINTED / IMMUTABLE**; tutte le 12 celle sono esplicite. Il crash avvenne nel post-processing ranking dopo il completamento della matrice; nessun ranking Phase 1 fu prodotto allora.
- attempt-08: **TECHNICAL_FAIL / RUNNER_FAILURE / ABORTED_BEFORE_PHASE2**. Sono stati registrati 3 GET `/v1/models` con `TRANSPORT_FAILURE`; zero route guard, zero inference, zero corpus e zero deliverable Phase 2. Il failure handler invocava `_mark_phase2_unavailable(...)` non definita, causando `NameError`. Nessuna evidenza modello attempt-08 è aggiunta.
- Il runner attempt-09 implementa la primitive mancante, persiste entrambe le celle generation/longform come `NOT_RUN` con failure code/scope in caso di stop pre-Phase2 e non crea risultati fittizi.

## Catalog refresh: advisory solo per continuation frozen-cohort

Il bootstrap tenta massimo 3 GET con backoff 2s/5s; ritenta esclusivamente trasporto senza status e HTTP 502/503/504. `CATALOG_AVAILABLE` usa il catalog live. Solo l'esaurimento classificato `TRANSPORT_FAILURE`/`TRANSIENT_HTTP_FAILURE` consente `CATALOG_REFRESH_UNAVAILABLE_USING_FROZEN_IDENTITY_BASIS` e il catalog snapshot attempt-07 dopo verifica hash, presenza ID, root e alias univoci. Lo snapshot storico serve **solo** per identity resolution dei Model ID già congelati, non per discovery, selezione, ranking, disponibilità o fallback route. Se usato, `catalog_identity_basis=FROZEN_ATTEMPT07_CATALOG_AFTER_TRANSIENT_REFRESH_FAILURE` e `catalog_refresh_status=CATALOG_REFRESH_UNAVAILABLE_USING_FROZEN_IDENTITY_BASIS`; la classificazione grezza del refresh resta registrata separatamente. La route guard diretta one-shot è l'autorità per current availability. HTTP 401/403 e catalog HTTP 200 semanticamente malformato fermano senza fallback. Questa policy vale soltanto per il benchmark continuation frozen-cohort; la production Dynamic Model Catalog policy non cambia.

Un 401/403 sul route guard resta route-level. Solo un controllo indipendente `/v1/models` 401/403 conferma `AUTH_REQUIRED_TEACHER_SERVICE`; se il controllo fallisce per puro trasporto, il candidato è `ROUTE_ACCESS_DENIED_GLOBAL_AUTH_UNRESOLVED` e l'altro può proseguire.

## Phase 1 freeze e selezione immutabile

La matrice/checkpoint attempt-07 e i raw non sono modificati. La Phase 1 freeze attempt-09 è un **POSTHOC_PROVENANCE_INDEX** post-run, con hash matrix/checkpoint/catalog/cohort/source/raw. Il ranking congelato attempt-08 è riusato read-only e verificato per hash/input; non viene riscritto né riordinato.

- Ranking: `agy/gemini-3.8-flash-tiered, groq/qwen/qwen3.8-27b, openrouter/dots-studio/dots-3-note-preview:free`.
- Selected top-2: `agy/gemini-3.8-flash-tiered, groq/qwen/qwen3.8-27b`.
- Phase-1 SHA-256: `e105eb6a8c3b2b7bb3ab7c17df38abb3ce073760742feb706e9954020aa182ce`; frozen ranking SHA-256: `8f16a5eb7427742d9babb510ec98b410f5581cb82982e32168d4827c14795dec`.
- Phase 1 non viene schedulata in attempt-09; nessuna riselezione o reserve dopo remote calls.

## Attempt-09 scope

Solo Excel `remote.generation` run-02 e `remote.longform` run-02 per i due top-2 che superano il current availability guard. Nessuna Phase 1, nessuna DBMS run-02, nessuna route terza. Generation e longform sono indipendenti, con checkpoint separati dopo ciascun deliverable; nessun retry inference. Parametri invariati: temperature 0.2, top_p 0.9, stream true; token limit, prompt, schema, source set, epistemic contract, Spreadsheet Adapter e bounded repair restano quelli approvati.

Composizione finale: `PHASE_1_SOURCE=attempt-07` + `PHASE_2_SOURCE=attempt-09`. Attempt-08 compare solo nell'history, non come model evidence. I candidate code esistenti sono riutilizzati; leak scanner è obbligatorio su blinded artifacts e packet.

## Regression e failure-path coverage

A–Z: **PASS**. Error branches pre-corpus coperti sinteticamente: catalog transport/auth/malformed, missing selected ID, root/alias mismatch, route unavailable, route 401/403 con control transport, global auth, un candidato indisponibile e l'altro operativo. Failure-path branch coverage: **PASS**. Tutti i test usano fake responses/mocks; zero chiamate reali.

## Validate-only checks

- attempt09_target_clean_before_freeze: **PASS** — {"dirty_targets": []}
- phase1_attempt07_complete_12_of_12: **PASS** — {"matrix_cells": 6, "checkpoint_records": 14, "unique_checkpoint_deliverables": 12, "explicit_deliverables": 12}
- frozen_ranking_hash_and_selection: **PASS** — {"selected_top2_model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b"], "ranking": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free"], "sha256": "8f16a5eb7427742d9babb510ec98b410f5581cb82982e32168d4827c14795dec"}
- regression_A_Z: **PASS** — {"tests": {"A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS", "F": "PASS", "G": "PASS", "H": "PASS", "I": "PASS", "J": "PASS", "K": "PASS", "L": "PASS", "M": "PASS", "N": "PASS", "O": "PASS", "P": "PASS", "Q": "PASS", "R": "PASS", "S": "PASS", "T": "PASS", "U": "PASS", "V": "PASS", "W": "PASS", "X": "PASS", "Y": "PASS", "Z": "PASS", "GLOBAL_AUTH": "PASS"}, "all_passed": true, "failure_path_coverage": "PASS", "failure_path_branches": {"catalog_transport_exhaustion": "Q", "frozen_hash_root_alias_or_missing_id_mismatch": "R", "catalog_401_no_fallback": "S", "catalog_http200_malformed_no_fallback": "T", "fallback_guard_success_phase2_ready": "U", "route_guard_identity_mismatch_and_other_candidate_continues": "V", "unavailable_two_cell_checkpoint_no_nameerror": "W", "route401_control_transport_other_candidate_continues": "X", "confirmed_global_auth_stops_subsequent_guard": "GLOBAL_AUTH", "zero_phase1_scheduling": "Y", "attempt08_excluded_from_combined_model_evidence": "Z"}, "provider_calls": 0, "network_calls": 0}
- failure_path_branch_coverage: **PASS** — {"catalog_transport_exhaustion": "Q", "frozen_hash_root_alias_or_missing_id_mismatch": "R", "catalog_401_no_fallback": "S", "catalog_http200_malformed_no_fallback": "T", "fallback_guard_success_phase2_ready": "U", "route_guard_identity_mismatch_and_other_candidate_continues": "V", "unavailable_two_cell_checkpoint_no_nameerror": "W", "route401_control_transport_other_candidate_continues": "X", "confirmed_global_auth_stops_subsequent_guard": "GLOBAL_AUTH", "zero_phase1_scheduling": "Y", "attempt08_excluded_from_combined_model_evidence": "Z"}
- source_hashes_unchanged: **PASS** — [{"path": "validation/work/Gate-C-v2/inputs/scenario_sources/dbms_student_lesson.md", "sha256": "d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035", "size_bytes": 3623}, {"path": "validation/work/Gate-C-v2/inputs/scenario_sources/excel_demo_b1.md", "sha256": "224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414", "size_bytes": 9864}, {"path": "validation/work/Gate-C-v2/inputs/excel-workbook-ast-projection.json", "sha256": "e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed", "size_bytes": 148340}]
- spreadsheet_ast_available: **PASS** — {"sheet_count": 5}
- heldout_not_in_source_set: **PASS** — {"excel_teacher_used": false, "reference_sent_to_gateway": false}
- runtime_config_and_shared_sse: **PASS** — {"runtime_config_loader_imported": true, "shared_sse_helper_imported": true, "sse_integration": {"status": "PASS", "synthetic_provider_calls": 0, "shared_helper_only": true, "heartbeat_ignored_for_identity_content_and_termination": true}}
- zero_phase1_remote_scheduling: **PASS** — {"phase1_scheduling": false, "phase2": "Excel run-02 only"}
- catalog_refresh_and_auth_policy: **PASS** — {"max_attempts": 3, "backoff_seconds": [2, 5], "retryable_statuses": [502, 503, 504], "fallback_only_after_transient": true, "route_auth_transport_control": "ROUTE_ACCESS_DENIED_GLOBAL_AUTH_UNRESOLVED"}
- model_parameters_unchanged: **PASS** — {"base": {"temperature": 0.2, "top_p": 0.9, "stream": true, "stream_options": {"include_usage": true}}, "limits": {"probe": 160, "generation": 9000, "plan": 3000, "section": 3000, "repair": 3000}}
- blinding_configuration: **PASS** — {"review_key_attempt": "attempt-05", "candidate_codes": ["CANDIDATE-A", "CANDIDATE-B", "CANDIDATE-C"]}
- phase1_freeze_provenance: **PASS** — {"path": "validation/artifacts/Gate-C-v2/attempt-09/phase1-freeze.json", "matrix_sha256": "e105eb6a8c3b2b7bb3ab7c17df38abb3ce073760742feb706e9954020aa182ce", "checkpoint_sha256": "1af106246372a2990b73ba2d2db72028816e4f16d0ef5b6f9c55cf3b84d42751", "catalog_sha256": "82b73ac7e1dd96bfbc38a3bb96e9c3d99e6f898ec49c06def5e304f9e60151e9"}
- frozen_catalog_fallback_ready: **PASS** — {"catalog_hash": "82b73ac7e1dd96bfbc38a3bb96e9c3d99e6f898ec49c06def5e304f9e60151e9", "selected_ids_present": true, "roots_and_aliases_unique": true}
- attempt09_targets_clean: **PASS** — {"dirty_targets": []}
- attempt07_attempt08_immutable: **PASS** — {"protected_history_unchanged": true}
- remote_calls_zero: **PASS** — {"remote_calls": 0, "corpus_sent": false}

**Attempt target:** `outputs/attempt-09`, `logs/attempt-09`, `metrics/attempt-09`, `artifacts/Gate-C-v2/attempt-09`, `validation/results/Gate-C-v2-human-review-packet-attempt-09.md`.
**Previous attempts 01–08:** preservati. **Remote calls:** 0. **Corpus sent:** false.

**Readiness: READY_FOR_MODELS_ATTEMPT_09_PHASE2**.
