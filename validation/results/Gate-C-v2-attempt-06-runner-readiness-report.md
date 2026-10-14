# Gate C v2 — attempt-06 runner readiness

## Esito

**BLOCKED** — solo preparazione locale; attempt-06 non eseguito.

## Root cause attempt-05

Attempt-05 è `TECHNICAL_PARTIAL / RUNNER_FAILURE`, non decision-grade. Il driver registrava generation nell'aggregato solo dopo `run_longform`; il fallimento della sezione DBMS Groq ha quindi eliminato una generation DBMS valida dal registro, alterando missing counts, profile e ranking. Le exception generiche impostavano inoltre `route_state=RUN_FAILURE`, facendo saltare Excel sullo stesso modello. Il ranking anteponeva source hits/schema failures ai deliverable mancanti; il packet non era completamente blindato e il manifest non copriva raw/blinded/catalog/review packet. Gli output e report raw attempt-05 restano invariati.

## Fix attempt-06

- Coorte congelata e invariata: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`; roots: `gemini-3.8-flash-tiered`, `qwen/qwen3.8-27b`, `dots-studio/dots-3-note-preview:free`.
- Target `outputs/attempt-06`, `logs/attempt-06`, `metrics/attempt-06`; nessun output di attempt-06 creato in questa preparazione.
- Generation e longform hanno celle/stati indipendenti; ogni deliverable/failure è checkpointed append-only in `metrics/attempt-06/result-checkpoints.jsonl` con flush+fsync.
- Failure scope separati: `GLOBAL_AUTH_FAILURE`, `ROUTE_UNAVAILABLE_OR_ACCESS_DENIED`, `TASK_RUN_FAILURE`, `SECTION_RUN_FAILURE`, `DELIVERABLE_TECHNICAL_FAILURE`. Empty output/heartbeat-only, length, invalid JSON/schema e task exception non promuovono da soli una route failure.
- Longform incompleto restituisce plan, sezioni completate, sezione/codice di failure, `assembled_script=null`, `technical_pass=false`; nessuna falsa assembly, nessuna sezione inventata, nessun retry fuori dal singolo repair bounded.
- La generation technical failure non blocca longform. Un task DBMS non blocca Excel; le route failure vere non vengono sostituite.
- Phase 2 si calcola soltanto dopo la matrice 3×2: missing/not-run, technical-invalid, deterministic checker hits, schema, truncation/finish, word budget, stable Model ID. I missing non sono zero-error e nessun LLM judge è usato.
- I conteggi restano `deterministic_checker_hits`; nessuna equivalenza automatica a violazioni uniche o human-confirmed.

## Regression A–G

- Regression A: **PASS**
- Regression B: **PASS**
- Regression C: **PASS**
- Regression D: **PASS**
- Regression E: **PASS**
- Regression F: **PASS**
- Regression G: **PASS**

## Blinding e provenance

Summary blindati solo con candidate code, scenario e risultati deterministici. Leak scanner copre Model ID/provider/root, request/response ID e slug/path modello; gli artifact che perdono identità sono esclusi. Il manifest attempt-specific inventaria hash catalog, cohort, source set, file raw attempt-06, artifact blindati, aggregati e packet umano.

## Validate-only e sicurezza

- frozen_cohort_identity: **PASS** — {"model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free"], "roots": {"agy/gemini-3.8-flash-tiered": "gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b": "qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free": "dots-studio/dots-3-note-preview:free"}}
- historical_stage_evidence: **PASS** — [{"stage": "stage_a", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_b", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}]
- source_hashes_and_source_set: **PASS** — [{"provided_file": "dbms_student_lesson.md", "sha256": "d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035", "bytes": 3623}, {"provided_file": "excel_demo_b1.md", "sha256": "224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414", "bytes": 9864}, {"provided_file": "excel-workbook-ast-projection.json", "sha256": "e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed", "bytes": 148340}]
- attempt05_classified_non_decision_grade: **PASS** — {"status": "TECHNICAL_PARTIAL", "attempt": "attempt-05"}
- attempt06_target_and_checkpoint: **PASS** — {"OUT": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/outputs/attempt-06", "LOGS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/logs/attempt-06", "METRICS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/metrics/attempt-06", "ATTEMPT_ART": "~/Workspace/teacher-service-design/validation/artifacts/Gate-C-v2/attempt-06"}
- attempt06_targets_clean: **FAIL** — {"nonempty_targets": ["validation/work/Gate-C-v2/outputs/attempt-06", "validation/work/Gate-C-v2/metrics/attempt-06", "validation/artifacts/Gate-C-v2/attempt-06"]}
- no_discovery_or_replacement: **PASS** — {"selection": "frozen cohort only"}
- failure_scope_and_auth_semantics: **PASS** — {"heartbeat_empty": "DELIVERABLE_TECHNICAL_FAILURE", "identity_failure": "ROUTE_UNAVAILABLE_OR_ACCESS_DENIED"}
- shared_sse_helper_integration: **PASS** — {"status": "PASS", "synthetic_provider_calls": 0, "shared_helper_only": true, "heartbeat_ignored_for_identity_content_and_termination": true}
- phase2_ranking_semantics: **PASS** — {"criteria_order": ["missing_or_not_run_deliverables", "technical_invalid_deliverables", "deterministic_checker_hits", "schema_failures", "truncation_or_finish_failures", "longform_word_budget_failures", "model_id"]}
- attempt05_not_imported_and_no_selection: **PASS** — {"no_attempt05_result_import": true, "no_candidate_discovery": true}
- review_key_mapping_coherent: **PASS** — {"path": "validation/artifacts/Gate-C-v2/review-key.json"}
- manifest_inventory_configuration: **PASS** — {"attempt_artifacts": "validation/artifacts/Gate-C-v2/attempt-06", "required_inventory_kinds": ["catalog", "cohort", "sources", "raw", "blinded", "aggregates", "review_packet"], "synthetic_inventory_hash_test": "PASS"}
- regression_A_G: **PASS** — {"tests": {"A": "PASS", "B": "PASS", "C": "PASS", "D": "PASS", "E": "PASS", "F": "PASS", "G": "PASS"}, "all_passed": true, "provider_calls": 0, "network_calls": 0}
- remote_calls_zero: **PASS** — {"count": 0}

Source hashes invariati:
- `dbms_student_lesson.md` — `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- `excel_demo_b1.md` — `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`
- `excel-workbook-ast-projection.json` — `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`

- Attempt-05 preservato durante validate-only: **NO**.
- Provider/remote calls: **0**; corpus inviato: **false**.
- Attempt-06 eseguito: **false**.
- Readiness: **BLOCKED**.
