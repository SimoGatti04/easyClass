# Gate C v2 — attempt-07 runner readiness

## Esito

**READY_FOR_MODELS_ATTEMPT_07** — preparazione locale soltanto; attempt-07 non eseguito.

## Interpretazione canonica attempt-06

`ABORTED_PREBENCHMARK_CATALOG_TRANSPORT_FAILURE`. L'unico GET iniziale `/v1/models` ha `http_status=null` e `classification=TRANSPORT_FAILURE`; non è stato ottenuto il catalogo, nessuna route è stata testata e nessuna inference/corpus è partita. I valori raw `CANDIDATE_UNAVAILABLE` sono conservati byte-per-byte e non sono conclusioni sulle route.

## Coorte e target

- Coorte congelata: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`.
- Attempt target: `outputs/attempt-07`, `logs/attempt-07`, `metrics/attempt-07`, `artifacts/Gate-C-v2/attempt-07` e `human-review-packet-attempt-07.md`.
- Attempt-01 … attempt-06 restano immutati; attempt-07 è pulito e verrà creato solo quando un run Models sarà effettivamente avviato.
- Nessuna candidate discovery, rediscovery, reserve o sostituzione.

## Retry catalogo limitato

Solo il GET bootstrap `/v1/models` usa massimo 3 tentativi con backoff deterministico 2 s e 5 s. Retry ammesso per `URLError` senza status, timeout/socket timeout, connection reset/aborted e HTTP 502/503/504. Non retry per altri status HTTP, 400/401/403/404/altri 4xx o JSON/catalog semanticamente invalido. Ogni tentativo persiste timestamp, status, classificazione, request ID, body/error sanitizzato e latenza. Il controllo auth indipendente e tutte le inference restano one-shot: generation, plan, section, repair e phase 2 non ricevono retry aggiuntivi.

## Regression sintetiche locali A–L

- Regression A: **PASS**
- Regression B: **PASS**
- Regression C: **PASS**
- Regression D: **PASS**
- Regression E: **PASS**
- Regression F: **PASS**
- Regression G: **PASS**
- Regression H: **PASS**
- Regression I: **PASS**
- Regression J: **PASS**
- Regression K: **PASS**
- Regression L: **PASS**

- H–L: H transport poi catalogo valido/prosegue; I tre errori transport/abort pre-benchmark senza route probe o corpus; J 401/no retry/auth globale; K 503 retryabile; L JSON HTTP 200 invalido/no retry/`OPERATIONAL_ERROR`.
- Provider calls: **0**; network calls: **0**; corpus sent: **false**.

## Source hashes e provenance/blinding

- frozen_cohort_identity: **PASS** — {"model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free"], "roots": {"agy/gemini-3.8-flash-tiered": "gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b": "qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free": "dots-studio/dots-3-note-preview:free"}}
- historical_stage_evidence: **PASS** — [{"stage": "stage_a", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_b", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}]
- source_hashes_and_source_set: **PASS** — [{"provided_file": "dbms_student_lesson.md", "sha256": "d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035", "bytes": 3623}, {"provided_file": "excel_demo_b1.md", "sha256": "224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414", "bytes": 9864}, {"provided_file": "excel-workbook-ast-projection.json", "sha256": "e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed", "bytes": 148340}]
- attempt05_classified_non_decision_grade: **PASS** — {"status": "TECHNICAL_PARTIAL", "attempt": "attempt-05"}
- attempt07_target_and_checkpoint: **PASS** — {"OUT": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/outputs/attempt-07", "LOGS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/logs/attempt-07", "METRICS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/metrics/attempt-07", "ATTEMPT_ART": "~/Workspace/teacher-service-design/validation/artifacts/Gate-C-v2/attempt-07", "human_review_packet": "~/Workspace/teacher-service-design/validation/results/Gate-C-v2-human-review-packet-attempt-07.md"}
- attempt07_targets_clean: **PASS** — {"nonempty_targets": []}
- attempt06_canonical_interpretation: **PASS** — {"canonical_status": "ABORTED_PREBENCHMARK_CATALOG_TRANSPORT_FAILURE", "route_states": "NOT_TESTED", "raw_attempt06_modified": false}
- no_discovery_or_replacement: **PASS** — {"selection": "frozen cohort only"}
- failure_scope_and_auth_semantics: **PASS** — {"heartbeat_empty": "DELIVERABLE_TECHNICAL_FAILURE", "identity_failure": "ROUTE_UNAVAILABLE_OR_ACCESS_DENIED"}
- shared_sse_helper_integration: **PASS** — {"status": "PASS", "synthetic_provider_calls": 0, "shared_helper_only": true, "heartbeat_ignored_for_identity_content_and_termination": true}
- phase2_ranking_semantics: **PASS** — {"criteria_order": ["missing_or_not_run_deliverables", "technical_invalid_deliverables", "deterministic_checker_hits", "schema_failures", "truncation_or_finish_failures", "longform_word_budget_failures", "model_id"]}
- attempt05_not_imported_and_no_selection: **PASS** — {"no_attempt05_result_import": true, "no_candidate_discovery": true}
- review_key_mapping_coherent: **PASS** — {"path": "validation/artifacts/Gate-C-v2/review-key.json"}
- manifest_inventory_configuration: **PASS** — {"attempt_artifacts": "validation/artifacts/Gate-C-v2/attempt-07", "required_inventory_kinds": ["catalog", "cohort", "sources", "raw", "blinded", "aggregates", "review_packet"], "synthetic_inventory_hash_test": "PASS"}
- catalog_retry_scope_and_limits: **PASS** — {"max_attempts": 3, "backoff_seconds": [2, 5], "retryable_http_statuses": [502, 503, 504], "retry_scope": "initial GET /v1/models bootstrap only", "inference_retry": false}
- regression_A_L: **PASS** — {"tests": {"A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS", "F": "PASS", "G": "PASS", "H": "PASS", "I": "PASS", "J": "PASS", "K": "PASS", "L": "PASS"}, "all_passed": true, "provider_calls": 0, "network_calls": 0, "synthetic_catalog_attempts": 9}
- remote_calls_zero: **PASS** — {"count": 0, "corpus_sent": false}

Source hashes invariati:
- `dbms_student_lesson.md` — `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- `excel_demo_b1.md` — `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`
- `excel-workbook-ast-projection.json` — `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`

- Attempt-06 preservato: **YES**.
- Readiness: **READY_FOR_MODELS_ATTEMPT_07**.
