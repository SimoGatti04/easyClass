# Gate C v2 — composite runner readiness

## Esito

**READY_FOR_MODELS_COMPOSITE_RUN** — preparazione locale; benchmark Models non eseguito.

## Coorte congelata

- Model ID: `agy/gemini-3.8-flash-tiered`, `groq/qwen/qwen3.8-27b`, `openrouter/dots-studio/dots-3-note-preview:free`
- Root distinte: `gemini-3.8-flash-tiered`, `qwen/qwen3.8-27b`, `dots-studio/dots-3-note-preview:free`
- Evidenze: Stage A `attempt-03-preflight.json`; Stage B `attempt-04-preflight.json` con `schema_protocol_supported`, `json_parse_valid`, `schema_valid` e `semantic_valid` tutti true per ogni route.
- Artifact freeze: `validation/work/Gate-C-v2/inputs/cohort-v2.json`
- Policy: nessuna candidate discovery/ranking e nessuna sostituzione silenziosa; un guard di availability/identity fallito ferma il run.

## Attempt e preservazione

- Composite attempt target: **attempt-05**
- Output: `validation/work/Gate-C-v2/outputs/attempt-05/`
- Logs: `validation/work/Gate-C-v2/logs/attempt-05/`
- Metrics: `validation/work/Gate-C-v2/metrics/attempt-05/`
- Attempt storici: attempt-01 invalid historical; attempt-02 invalidated transport client bug; attempt-03 valid Stage A; attempt-04 valid Stage B; attempt-05 composite benchmark.
- Previous attempts preserved: **YES**. I target attempt-01..04 e gli artifact storici sono stati solo controllati localmente; attempt-05 non contiene output preesistenti.

## Validate-only

- cohort_contract: **PASS** — {"cohort_model_ids": ["agy/gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free"], "roots": {"agy/gemini-3.8-flash-tiered": "gemini-3.8-flash-tiered", "groq/qwen/qwen3.8-27b": "qwen/qwen3.8-27b", "openrouter/dots-studio/dots-3-note-preview:free": "dots-studio/dots-3-note-preview:free"}, "status": "COHORT_VALIDATED_READY_FOR_COMPOSITE_BENCHMARK"}
- stage_a_stage_b_evidence: **PASS** — [{"stage": "stage_a", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_a", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-transport-fix/attempt-03-preflight.json"}, {"stage": "stage_b", "model_id": "agy/gemini-3.8-flash-tiered", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "groq/qwen/qwen3.8-27b", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}, {"stage": "stage_b", "model_id": "openrouter/dots-studio/dots-3-note-preview:free", "status": "PASS", "artifact": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json"}]
- catalog_snapshot_references: **PASS** — {"attempt_03": "validation/artifacts/Gate-C-v2-transport-fix/catalog-snapshot.json", "attempt_04_live": "validation/work/Gate-C-v2/outputs/attempt-04/live-catalog-snapshot.json"}
- attempt04_manifest_integrity: **PASS** — [{"path": "validation/artifacts/Gate-C-v2-structured-preflight/attempt-04-preflight.json", "status": "PASS"}, {"path": "validation/artifacts/Gate-C-v2-structured-preflight/structured-output-metrics.json", "status": "PASS"}, {"path": "validation/results/Gate-C-v2-structured-preflight-report.md", "status": "PASS"}]
- source_hash_validation: **PASS** — [{"provided_file": "dbms_student_lesson.md", "sha256": "d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035", "bytes": 3623}, {"provided_file": "excel_demo_b1.md", "sha256": "224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414", "bytes": 9864}, {"provided_file": "excel-workbook-ast-projection.json", "sha256": "e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed", "bytes": 148340}]
- spreadsheet_ast: **PASS** — {"sheet_count": 5, "projection_schema": "gate-c-v2-cellaware-source-projection-v1"}
- runtime_config_loader_importable: **PASS** — "imported without loading or reading credential values"
- shared_sse_helper_importable: **PASS** — "validation/shared/omniroute_sse.py"
- sse_helper_integration: **PASS** — {"status": "PASS", "synthetic_provider_calls": 0, "heartbeat_ignored_for_identity_content_and_termination": true, "real_identity_content_finish_done_verified": true}
- auth_semantics_local_test: **PASS** — {"isolated_route_403_with_models_200": "ROUTE_ACCESS_DENIED", "global_only_when_models_401_403": "AUTH_REQUIRED_TEACHER_SERVICE"}
- attempt05_path_isolation: **PASS** — {"OUT": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/outputs/attempt-05", "LOGS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/logs/attempt-05", "METRICS": "~/Workspace/teacher-service-design/validation/work/Gate-C-v2/metrics/attempt-05"}
- attempt05_outputs_clean_for_future_run: **PASS** — {"nonempty_targets": []}
- frozen_cohort_no_rediscovery: **PASS** — {"cohort_path": "validation/work/Gate-C-v2/inputs/cohort-v2.json", "forbidden_selector_loads": [], "cohort_drives_run": true}
- no_heldout_payload_in_inputs: **PASS** — {"scenario_source_files": ["dbms_student_lesson.md", "excel_demo_b1.md"], "audit_contains_paths_only": true}
- review_key_not_preexisting_or_incoherent: **PASS** — "HISTORICAL_EMPTY_PLACEHOLDER"
- remote_calls_zero: **PASS** — {"count": 0}
- corpus_sent_false: **PASS** — {"value": false}

## Source hashes pinned

- `dbms_student_lesson.md` — `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- `excel_demo_b1.md` — `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`
- `excel-workbook-ast-projection.json` — `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`

Source Set immutato: `dbms_student_lesson.md`, `excel_demo_b1.md`, `excel-workbook-ast-projection.json`. `excel_teacher.md` non è input. L'audit contiene solo metadati/percorso di separazione; nessun payload held-out è presente nel bundle passato al modello.

## SSE e autorizzazione

Il runner usa la sola semantica condivisa di `validation/shared/omniroute_sse.py`: heartbeat separati da model identity, contenuto, response ID e terminazione; stream consumato fino a `[DONE]`/EOF/timeout/identity failure. Test sintetico locale di integrazione PASS.

401/403 su una route sono `ROUTE_ACCESS_DENIED` per quella route. `AUTH_REQUIRED_TEACHER_SERVICE` è globale solo se il controllo indipendente GET `/v1/models` restituisce anch'esso 401/403. Nessuna credenziale alternativa.

## Sicurezza e stato

- Chiamate remote durante questa preparazione: **0**
- Corpus inviato: **false**
- Generation/longform eseguiti: **false**
- Pipeline composta, contratti epistemici, Spreadsheet Adapter, rubriche e Source Set: invariati.
- Readiness: **READY_FOR_MODELS_COMPOSITE_RUN**
