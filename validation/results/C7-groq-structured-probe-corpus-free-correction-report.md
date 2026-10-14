# C7 Groq structured-probe corpus-free correction report

**Date:** 2026-10-06  
**Verdict:** PASS — `READY_FOR_NEW_GROQ_LIVE_PREFLIGHT` (review is still required before any live preflight)

## Scope and safety

This is a local-only correction of the synthetic structured-preflight request builder and its C7 tests. No live preflight was run; no actual network calls, corpus model calls, corpus submissions, quality samples, registry/profile changes, or Gate D actions occurred. No C2–C6 code, frozen contract, source pin, evaluator overlay/ledger, or historical preflight was modified. The fake end-to-end test used a mocked catalog result and a local fake SSE response through the production C6 transport; its three logical calls (catalog, base route probe, structured route probe) were simulated, not sent remotely.

## Previous blocker

The production `_make_stage1_structured_probe()` built a `Stage1Request` using `contract.request_contract_dict()` and `contract.stage1_output_schema` directly. The production C6 renderer serialized these into the model-visible canonical request. The frozen Excel contract contained a source-ID enum literal (`excel_demo_b1.md`) and scenario-specific values, so the existing fail-closed continuation guard raised `CORPUS_SOURCE_ID_IN_STRUCTURED_PREFLIGHT_REQUEST` before structured transport.

The request guard was not weakened and no real identifier was allowlisted.

## Correction

The runner now creates an in-memory `SYNTHETIC_STAGE1_PROBE_CONTRACT` from deep copies of the frozen contract view and Stage 1 schema. The frozen Excel contract remains the local structural authority, but the real model-visible contract is not serialized.

Sanitization is applied to Python/JSON structures before rendering, not to rendered JSON text. It substitutes the fixture scenario literal with `synthetic`, the source-ID enum value with `synthetic-source.md`, and contract task/version identifiers with synthetic values. Human-readable annotations are changed only if they contain an authority-derived protected literal. Schema keys, property names, required arrays, types, object/array nesting, additional-properties settings, cardinality constraints, branching, and renderer family are retained. Numeric/boolean constants and other unchanged semantic constraints remain exact.

The request retains an empty source list, `Synthetic content only; no corpus.`, empty task-context source IDs/hashes, and `evidence_prompt_view = null`. The synthetic response fixture uses only synthetic values and passes the sanitized schema.

## Structural equivalence and identifier scan

The builder deterministically normalizes only permitted non-structural schema literal payloads when computing shape fingerprints. It also checks that the original-to-synthetic request differs only in permitted synthetic literal locations. Any mismatch fails closed.

- Original Stage 1 schema shape SHA-256: `044c409680bce74db0118ff6e907d341e9f11fd7eee1e048a92c9c1d5ba31381`
- Synthetic Stage 1 schema shape SHA-256: `044c409680bce74db0118ff6e907d341e9f11fd7eee1e048a92c9c1d5ba31381`
- Original task-contract shape SHA-256: `d738e917e04935441895585df7eab1315fe75fa62dbac9366f236f51a9fc8242`
- Synthetic task-contract shape SHA-256: `d738e917e04935441895585df7eab1315fe75fa62dbac9366f236f51a9fc8242`
- Complete Stage1Request contract-view shape fingerprint: equal before/after; recorded in renderer metadata.

The protected-identifier set is derived from local `source-pins.json` authority: source IDs, paths and basenames, pinned and locally verified source hashes, scenario identifiers, held-out identifiers, and the frozen contract task/version IDs. Canonical structured request, rendered messages, and response format are serialized locally and scanned against that set before use. The real C6 renderer’s local-projection guard remains in the path.

The continuation-specific C6 transport wrapper verifies the exact prepared payload and then calls the production generic `request_guard.assert_model_safe` checks for secret, held-out, visibility, and corpus/source markers. It does not add exceptions for real source identifiers.

## Production-path verification

The tests now directly call the production `_make_stage1_structured_probe()`; there is no test-only replacement builder in the preflight tests. The successful end-to-end fake test uses:

1. production synthetic structured request builder;
2. production C6 generation renderer and local-projection check;
3. production C6 `OmniRouteChatClient` and SSE parser;
4. production generic request guard through the continuation’s exact-payload guard;
5. a mocked catalog and local fake terminal SSE transport.

The fake preflight returned `PASS`, observed one simulated catalog request, one base route probe, and one structured probe; `STRUCTURED_SCHEMA_VALIDATED`, JSON parse, and schema validation all passed. `preflight.json` was written and read back from the temporary test directory before cleanup. The structured request, rendered model-visible request, and synthetic response were checked for protected identifiers; the response contained only `scenario_id = synthetic` and `source_ids = [synthetic-source.md]`.

## Regression tests

All 10 local continuation preflight tests passed (`GroqContinuationLivePreflightFailureTests`, 10/10). Coverage includes setup failure and primary-error persistence, optional schema metadata failure, pre-network guard failure and stale-record protection, transport failure, invalid JSON, schema-invalid JSON, successful structured output and distinct call records, persisted fake full preflight, and persistence failure. Accounting remained exact in the covered failure branches. The fake preflight used no actual network transport and recorded zero corpus calls.

## Quality request invariance

The existing offline request-equivalence smoke was run before and after this change using the local fake backend only. Its CORR-05 and CORR-06 Stage 1/Stage 2 rendered and structured request hashes matched exactly:

| Case | Rendered Stage 1 | Rendered Stage 2 | Structured Stage 1 | Structured Stage 2 |
|---|---|---|---|---|
| CORR-05 | `3a14a9a45338fcf4c9b93d95314f07b55ab156982618173f572ebc9b044341a5` | `5fb6d58aa7ae74e37948c970e1e1c8f316fd08be80400bc3db2b00124ac30f8f` | `c24738d9d6b6a45777ea56e78fa9ec3d17b213c71083baa31ce5eb07d14d5d2c` | `a8805451baa42740961be3e367ff6a0880ffc26df59541550853e3e209e10a1c` |
| CORR-06 | `34e64d19600edf35b6f5fd26a5bf27bab56bf716ca28d006effde20fe080ff5e` | `2e6fe05e7d4e5af9287178afd741b8a86635b9c59ce6fac415a1ef987a594de1` | `a3a1a638b21cab78e85bccadc50c728bf5e7b564a761eca038ad97fc86ad654f` | `efcbef881a706ee5510b14ba226fb5059a724e9dc78f72e75893e47d4aa4f1c6` |

This was request-rendering equivalence verification with fake local outputs, not a provider quality sample or live model call.

## Frozen-input and history preservation

The following authority files remained byte-identical to their pre-change SHA-256 values:

| File | SHA-256 |
|---|---|
| `validation/work/C6/inputs/contracts/dbms_sql-generation.json` | `82f706565dfadeec959f11cd632e9113a2e7ba33f624ecbb6a7de2e1c42f0eed` |
| `validation/work/C6/inputs/contracts/excel-generation.json` | `a02cd7c3ddc8d41a7e321eb8264647f184db039ba86ef15bca79d79fbb2c6123` |
| `validation/work/C6/inputs/corrective-matrix.json` | `30d9832266cdcef92ecee66a2e10101cef6729dbc877cd540694775f36b72665` |
| `validation/work/C6/inputs/source-pins.json` | `8856d9981f7f796f4555210156bf0ed6bc8d7efd577ae2dbd241802a50f3c4a6` |

Historical preflight `validation/work/C7/continuation-preflights/groq-continuation-preflight-20261006T181549215475Z-894eb791/` was preserved byte-for-byte. Its existing five files retained their recorded SHA-256 hashes, and `preflight.json` remains absent; no retroactive artifact was added.

## Changed files and outcome

- `validation/work/C7/scripts/run_c7_groq_continuation.py` — deterministic synthetic contract derivation, shape checks/fingerprints, and denylist scan.
- `validation/work/C7/tests/test_groq_continuation.py` — direct production-builder and production-builder fake end-to-end tests; synthetic response fixture updated.
- `validation/results/C7-groq-structured-probe-corpus-free-correction-report.md` — this report.

**Outcome:** all required local checks passed. The runner is ready for a separate review before any new live Groq preflight. No live preflight was launched by this task.
