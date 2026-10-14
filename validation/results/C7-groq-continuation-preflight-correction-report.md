# C7 Groq Continuation Preflight — Failure-Handling Correction Report

**Date:** 2026-10-06  
**Verdict:** `PASS` — `READY_FOR_NEW_GROQ_LIVE_PREFLIGHT_REVIEW`  
**Scope:** Local-only correction and mocked regression validation. No live preflight, freeze, or continuation execution was run.

## Historical preflight preserved

Preserved the failed preflight `groq-continuation-preflight-20261006T181549215475Z-894eb791` without adding a retroactive `preflight.json` or changing any existing file. Its five existing files retain their original SHA-256 hashes. The directory still contains exactly one base-route operation artifact and no structured-probe operation artifact.

The observed call count is **2**: one live catalog request plus one real base route probe. The base probe is PASS. No structured probe was sent, no freeze or continuation execution exists, and corpus calls are **0**. The evidence does not identify the historical primary structured-phase exception with certainty: the missing preflight result means it was masked and not durably recorded.

## Corrected failure boundary

`validation/work/C7/scripts/run_c7_groq_continuation.py` now initializes all optional structured-request, schema, renderer, and call-record fields before entering the structured phase. Structured progression is recorded explicitly as:

- `STRUCTURED_NOT_STARTED`
- `STRUCTURED_REQUEST_BUILT`
- `STRUCTURED_NETWORK_ATTEMPTED`
- `STRUCTURED_RESPONSE_RECEIVED`
- `STRUCTURED_SCHEMA_VALIDATED`

Handled failures preserve a stable failure code, failure stage, exception type, and whether the transport counter shows that the network boundary was reached. No exception message or traceback is persisted. Safe local `ContinuationError.code` values are retained separately when available. A request/schema metadata failure cannot proceed into later dereferences, and schema hashing converts immutable mappings to equivalent plain JSON values without changing schema contents.

### Reproducible primary local failure

The production `_make_stage1_structured_probe()` currently fails locally and reproducibly with `ContinuationError` code `CORPUS_SOURCE_ID_IN_STRUCTURED_PREFLIGHT_REQUEST`. Its existing model-visible marker guard rejects `excel_demo_b1.md`, which is present in the pinned Stage-1 contract/schema metadata. The correction now preserves that original exception type and code rather than allowing a later `UnboundLocalError` to mask it.

This underlying request/guard condition was **not changed**: the task was restricted to failure handling and persistence, and changing the request/schema or probe semantics was out of scope. The historical run's exact primary exception remains unknown; the reproducible current setup failure is not asserted to be the historical exception. A separate review should account for this known local stop before authorizing a new live preflight.

## Stale record and call accounting

Structured call records are selected only from newly appended client records with `pipeline_stage=STRUCTURED_ROUTE_PROBE`. If setup or a request guard fails before an operation is recorded, the structured record remains `null`; the earlier base-probe `last_record` is never reused.

Probe counts are derived from `CallCounters`; catalog counts use returned actual `attempt_count` values. Planned calls do not increment network counts. Structured setup and pre-network guard failures therefore add zero probe calls; transport-attempted branches are counted once. The preflight's authoritative total is catalog attempts plus actual transport-counter increments.

## Persistence behavior

All handled outcomes after versioned preflight-directory creation flow through one finalizer and attempt an exclusive write of `preflight.json`, including setup, pre-network guard, transport, invalid-output, and success outcomes. If that write fails, the returned/printed verdict becomes `LOCAL_PREFLIGHT_PERSISTENCE_FAILURE` with code `PREFLIGHT_ARTIFACT_PERSISTENCE_FAILED` and `preflight_persisted=false`; it does not claim a saved artifact.

## Regression and local validation

Updated `validation/work/C7/tests/test_groq_continuation.py` with direct `live_preflight()` tests; all outbound paths are mocked or use a deterministic fake opener. The transport-failure and invalid JSON/schema tests exercise the real C6 `OmniRouteChatClient` against that fake opener. The synthetic success test uses the unchanged pinned Stage-1 schema and renderer in a local-only request fixture. It does not establish that the unmodified production setup guard can reach a live structured call.

| Check | Result |
|---|---:|
| Structured setup failure; original type/code persisted; no stale record | PASS |
| Optional schema metadata failure; no uninitialized access | PASS |
| Pre-network guard failure; no structured network attempt/record | PASS |
| Structured transport failure through fake opener; actual operation record | PASS |
| Invalid JSON terminal response | PASS |
| Schema-invalid terminal response | PASS |
| Structured synthetic success; distinct base/structured records and schema metadata | PASS |
| Persistence-write failure reports explicit non-saved verdict | PASS |
| `test_groq_continuation.py` | 19/19 PASS |
| All C7 local tests | 41/41 PASS |
| Syntax check | PASS |
| Runner `--validate-only` | `READY_FOR_GROQ_CONTINUATION_EXECUTION_REVIEW` |

Validate-only reported network calls 0, corpus model calls 0, registry mutations 0, and Gate D mutations 0. No live preflight, `--freeze`, or `--execute` mode was invoked.

## Preservation and mutation accounting

A pre-edit SHA-256/size inventory covered 1,334 files in the historical failed preflight, all C7 execution trees, evaluator-audit/ledger material, C2–C6 work and artifacts, and prior C7 readiness/audit reports. Post-edit comparison: **0 missing, 0 changed, 0 added** in those protected scopes; all 465 inventoried directories remain. The failed preflight still has no `preflight.json`.

- Failed historical preflight: preserved, YES.
- C2–C6 mutations: 0.
- Evaluator overlay/ledger mutations: 0.
- Registry/profile mutations: 0.
- Gate D mutations: 0.
- Real remote calls in this correction task: 0.
- Corpus/model calls in this correction task: 0.

## Final

`PASS` — `READY_FOR_NEW_GROQ_LIVE_PREFLIGHT_REVIEW`. This means only that the local failure-handling/persistence correction and mocked regressions are ready for a separate review. It is **not** a live-preflight authorization or a claim that the current production structured-probe builder succeeds.
