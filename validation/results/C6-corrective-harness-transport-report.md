# C6 Corrective Harness, Transport Adapter, and Live Preflight Report

**Date:** 2026-10-02  
**Scope:** Local C6 implementation and validation only. No corrective corpus benchmark was executed.

## Verdict

- **Implementation:** `C6_IMPLEMENTATION_PASS`
- **C7 execution:** `C7_EXECUTION_BLOCKED_BY_ENVIRONMENT`
- **Reason:** local suites, C6 dry-run, source pins, and validate-only checks pass; live catalog refresh exhausted transient transport attempts and both synthetic route probes ended in transport failure. No model-quality evidence was collected.
- **Remote activity:** the authorized no-corpus live preflight made **5 calls total** (3 catalog calls, 2 synthetic route probes). **Corpus calls: 0.** No C7 quality calls were made.

C6 did not run CORR-01…CORR-06 against lesson/workbook material, did not conduct human/domain-owner review, did not update registry/profile status, and did not start Gate D.

## Frozen benchmark matrix

The declarative matrix is `validation/work/C6/inputs/corrective-matrix.json`. It contains exactly six configurations, each with two quality replicates (12 slots total):

| Task | Model | Scenario | Profile | Adapter |
|---|---|---|---|---|
| CORR-01 | `agy/gemini-3.8-flash-tiered` | DBMS SQL | `remote.generation` | C4 two-stage generation |
| CORR-02 | `agy/gemini-3.8-flash-tiered` | Excel | `remote.generation` | C4 two-stage generation |
| CORR-03 | `agy/gemini-3.8-flash-tiered` | DBMS SQL | `remote.longform` | C5 longform |
| CORR-04 | `agy/gemini-3.8-flash-tiered` | Excel | `remote.longform` | C5 longform |
| CORR-05 | `groq/qwen/qwen3.8-27b` | DBMS SQL | `remote.generation` | C4 two-stage generation |
| CORR-06 | `groq/qwen/qwen3.8-27b` | Excel | `remote.generation` | C4 two-stage generation |

No Dots route, Groq longform configuration, model substitution, or reserve candidate is included. The matrix's source-file SHA-256 is `35a160ec7be0b3749ed3b31b53188aca382fbedf0bc8234e52bd873513545130`.

A **quality replicate is not an HTTP call**. A generation replicate contains Stage 1 and Stage 2 atomic inference calls. A longform replicate contains a plan, bounded section calls, and possibly separately counted bounded repairs. The local fake execution completed **12 quality replicates through 36 simulated atomic inference calls** (repair calls 0, transport attempts 0). These are not remote calls. The separate history fixture completed two local-only slots through seven simulated calls.

## Harness and adapter

- Generic matrix-driven scheduler/accounting: `validation/work/C6/scripts/harness.py`.
- Runner modes: `--validate-only`, `--dry-run`, and `--live-preflight` in `validation/work/C6/scripts/run_c6.py`. There is no corpus-execution mode in C6.
- Corrective scenario builders: `validation/work/C6/scripts/scenario_builders.py`.
- OmniRoute transport/adapters: `validation/work/C6/scripts/omniroute_transport.py`.
- Catalog policy and frozen identity basis: `validation/work/C6/scripts/catalog.py`.
- Model-visible request and no-corpus guards: `validation/work/C6/scripts/request_guard.py`.
- Fake transport and failure injections: `validation/work/C6/scripts/failure_injection.py`.

The generic harness selects adapters and scenario builders by declared references; it does not branch on model, task ID, or subject. The orthogonal history fixture is registered only for local dry-run and is not part of the 6×2 corrective matrix.

C4 and C5 remain neutral cores. The transport adapters use their structured request objects as the source of truth. The versioned renderers hash the canonical request, rendered messages, and response schema:

- generation: `c6-openai-compatible-generation-renderer-v1`
- longform plan: `c6-openai-compatible-longform-plan-renderer-v1`
- longform bounded text: `c6-openai-compatible-longform-text-renderer-v1`
- canonical JSON: `sorted-keys-utf8-compact-v1`

Shared model parameters are temperature 0.2, top_p 0.9, streaming enabled, and usage included. C4 Stage 1 and Stage 2 are capped at 4,500 output tokens each (9,000 maximum combined); C5 plan, section, and repair calls are capped at 3,000 each. These are maximum output caps, not length targets. No model-specific tuning or `reasoning_effort` is introduced.

C4 transport results become `GenerationResponse` only after a terminal valid response. Transport/identity/operational failures use typed exceptions so they are not disguised as ordinary generation results. The C5 adapter implements plan, section, and repair calls using the C5-built request unchanged; evidence visibility/scoping remains in C5 and no evidence is added by the adapter.

## Transport, SSE, retries, and slot semantics

`validation/shared/omniroute_sse.py` is the sole implementation used for streaming/SSE parsing, keepalive handling, completion/EOF semantics, and model identity resolution. The adapter does not implement a competing parser. Keepalive is excluded from identity and cannot terminate the stream; real content, finish reason, terminal completion, and identity are recorded separately.

A single inference scheduling action makes one atomic call. There is no automatic retry for route probes, C4 stages, plan, sections, or repair. The only bounded retries are catalog bootstrap attempts: at most three, with 2/5-second backoff, and only for the explicitly transient transport classes or HTTP 502/503/504. HTTP 429 is recorded as operational availability evidence with Retry-After when present, not as model-quality failure.

Transport-blocked attempts remain `ENVIRONMENT_BLOCKED`; they do not consume a quality replicate or silently advance replicate 1 to replicate 2. Terminal identity-valid model responses can generate quality failures (including `finish_reason=length`). Partial C4/C5 evidence is checkpointed and preserved if a later atomic call is transport-blocked. Checkpoints are written atomically per call.

## Catalog and live preflight

The preflight reads credentials exclusively through `validation/shared/runtime_config.py`; validate-only reported dedicated credential status `AVAILABLE` without exposing the value. No alternate credential source is configured or read.

The frozen attempt-07 catalog is permitted only as identity-resolution metadata after transient live catalog transport exhaustion. It is not used for discovery, selection, current availability, ranking, or replacement. Live catalog HTTP 401/403 and malformed HTTP 200 responses remain fail-closed; a valid live catalog is authoritative. Direct route probes are one-shot and use only the exact synthetic `READY` probe. If a route returns 401/403, a separate catalog control distinguishes global authorization from route-level denial.

Recorded live-preflight evidence (`validation/work/C6/metrics/live-preflight.json`):

- Catalog refresh: 3 attempts, all `TRANSPORT_FAILURE`; frozen attempt-07 identity basis validated and used.
- Gemini (`agy/gemini-3.8-flash-tiered`): one synthetic probe, `ENVIRONMENT_TRANSPORT_FAILURE` (`URLError`, no HTTP status).
- Groq (`groq/qwen/qwen3.8-27b`): one synthetic probe, `ENVIRONMENT_TRANSPORT_FAILURE` (`URLError`, no HTTP status).
- Totals: 5 remote calls (3 catalog + 2 route probes), 0 corpus calls; no inference retry.
- Result: `ENVIRONMENT_BLOCKED`, not a model-quality failure and not a credential verdict.

The result-persistence ordering was corrected so the `historical_attempts_preserved` check is set **before** the live artifact is written. The existing no-corpus result was repaired locally to include the preservation flag; no network call was repeated. A regression test verifies the field is included in the persisted payload.

## Redaction, source pins, and request guards

The transport stores only allowlisted/sanitized response headers and sanitizes returned IDs, response IDs, and response text. Authorization headers and secret values are not persisted. Regression coverage uses a secret sentinel and verifies it does not appear in stored request/response artifacts. The report does not include the sentinel or credential value.

Pinned sources are validated without sending them:

| Source | SHA-256 |
|---|---|
| `dbms_student_lesson.md` | `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` |
| `excel_demo_b1.md` | `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414` |
| `excel-workbook-ast-projection.json` | `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed` |
| `excel_demo.xlsx` (C3/provider requirement) | `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7` |

`excel_teacher.md` and held-out/reference material are prohibited. Before remote calls, model-visible request guards reject credential/header material, non-prompt-visible evidence, held-out markers, and unexpected preflight context. Live preflight requires exact equality to the synthetic probe payload; therefore it cannot carry DBMS/Excel source fragments, workbook AST, EvidencePack, or C4/C5 scenario payload.

## Local verification

- C2 semantic completeness regression: **17/17 PASS**.
- C3 evidence regression: **38/38 PASS**.
- C4 two-stage generation regression: **42/42 PASS**.
- C5 corrected longform regression: **48/48 PASS**.
- C6 harness/transport tests after the persistence fix: **61/61 PASS**.
- `--validate-only`: **PASS**; exactly six configurations and 12 slots, source pins and frozen identity metadata verified, genericity/schema checks pass, dedicated credential status `AVAILABLE`, remote calls 0, corpus calls 0.
- Fresh temporary-directory fake dry-run after final local fixture changes: **PASS**; 12/12 simulated replicates, 36 simulated atomic calls, 18/18 failure-injection checks, two-slot/seven-call orthogonal history fixture, manifest and Domain Owner packet schema checks pass; network calls 0, corpus calls 0.
- Historical attempts 01–09 are verified preserved by local checks.

The 18 failure injections cover bounded catalog retries, auth/malformed catalog stops, route transport and HTTP failures, 429, heartbeat-only timeout, identity and alias failures, terminal quality failure, partial C4/C5 preservation, and bounded repair transport failure. No provider call is used by these tests.

The live-artifact persistence regression, all local tests, validate-only, and the temporary-target dry-run ran without additional network activity.

## C7 provenance and sign-off preparation

C7's machine-readable acceptance policy is `validation/work/C6/inputs/c7-acceptance-policy.json`. The manifest schema is `validation/work/C6/inputs/c7-manifest.schema.json`; the local fake manifest fixture is `validation/work/C6/outputs/dry-run/c7-manifest-fixture.json`. The Domain Owner packet schema is `validation/work/C6/inputs/domain-owner-signoff-packet.schema.json`, with a synthetic, unfilled fixture at `validation/work/C6/outputs/dry-run/domain-owner-signoff-packet-fixture.json`.

The C7 manifest schema accounts for matrix, source/core and renderer hashes, catalog identity basis, route preflight, operational attempts, completed quality replicates, model-visible request/response references, deterministic validations, final artifacts, and Domain Owner sign-off packet. A future packet is explicitly `DOMAIN_OWNER_SIGNOFF_PACKET` with approve/amend/reject support; C6 makes no real human judgment and does not call prior assistant review a human review.

## Known limitation and readiness

The C6 implementation and local fake execution are sound, but the live route preflight did not establish current route availability because the environment could not complete the catalog or route connections. The frozen catalog was valid only for identity resolution and cannot substitute for live availability. C7 corpus execution therefore remains blocked until a separately authorized preflight establishes current route availability. No socket workaround or code change was attempted.

**Final status: `C6_IMPLEMENTATION_PASS` / `C7_EXECUTION_BLOCKED_BY_ENVIRONMENT`.**


## Pre-C7 Integration Corrections — 2026-10-02

This addendum records the local C6 corrections made after the pre-C7 architecture/integration review. It supplements, and does not rewrite, the preceding report or its live-preflight history. No live-preflight, catalog request, route probe, corpus request, or C7 execution was performed during this correction pass. Attempts 01–09 were preserved. Credential status during local validation was `NOT_READ_LOCAL_ONLY`.

### Corrected blockers and implementation

- **Excel AST exposure:** Excel local validation assets are now distinct from model-visible source context. `excel_demo_b1.md` and explicitly `PROMPT_VISIBLE` bounded evidence are sent to the model; the full AST projection and workbook remain local validation/provenance authority. Source pins still cover the lesson, AST projection, and workbook. The real generation and longform renderers run the AST-dump guard against serialized content, not merely filenames.
- **Excel longform path:** C6 binds plan-declared `evidence_requirements` to only the relevant bounded packs after the plan is frozen. The Excel scenario uses the C5 `ExcelHistoricalSectionValidator` through the actual C6 adapter for section checks and bounded repairs. Unknown requirements fail closed. DBMS retains no invented factual checker.
- **Excel generation post-validation:** the C6-only `ExcelGenerationArtifactValidator` validates the final C4 artifact against C3 evidence and preserves the artifact for review. Machine-readable output distinguishes hard issues, warnings, supporting evidence IDs, deterministically checked claims, and claims requiring review. It detects M3/M4 role contradictions, an incorrect seller-average top claim, cited missing coordinates, and checkable stored-formula contradictions. Qualified coordinates are resolved against their named sheet (including quoted Excel sheet syntax); unqualified benchmark coordinates retain the declared `Vendite` context.
- **Runner failure isolation:** local builder, renderer, validator, persistence/checkpoint, assembly, and accounting exceptions are classified as `RUNNER_FAILURE`, not `QUALITY_FAIL`. The affected quality replicate is not consumed, scheduling stops, and earlier terminal model responses remain preserved. Terminal model-quality outcomes such as `finish_reason=length` still count as quality failures; transport/route failures remain `ENVIRONMENT_BLOCKED`.
- **Effective contract provenance:** the matrix points to the exact four materialized contracts used at runtime, including the Excel generation contract rather than the historical DBMS reference. The manifest schema includes effective contract hashes and source-asset roles.
- **Dry-run boundary:** the fresh fake dry-run exercised the real request builders/renderers, evidence/validator boundaries, harness classification, and provenance/sign-off schemas on a clean temporary target.

Implementation files:

- `validation/shared/longform_generation.py`
- `validation/work/C5/excel_validator.py`
- `validation/work/C6/scripts/scenario_builders.py`
- `validation/work/C6/scripts/harness.py`
- `validation/work/C6/scripts/request_guard.py`
- `validation/work/C6/scripts/omniroute_transport.py`
- `validation/work/C6/scripts/run_c6.py`
- `validation/work/C6/scripts/failure_injection.py`
- `validation/work/C6/scripts/excel_generation_validator.py` (new C6-specific validator)
- `validation/work/C6/tests/test_c6_harness_transport.py`
- `validation/work/C6/inputs/corrective-matrix.json`
- `validation/work/C6/inputs/c7-manifest.schema.json`
- `validation/work/C6/inputs/contracts/dbms_sql-generation.json`
- `validation/work/C6/inputs/contracts/excel-generation.json`
- `validation/work/C6/inputs/contracts/dbms_sql-longform.json`
- `validation/work/C6/inputs/contracts/excel-longform.json`

### Regression evidence

| Local check | Result |
|---|---:|
| C2 semantic completeness | **17/17 PASS** |
| C3 bounded evidence | **38/38 PASS** |
| C4 two-stage generation | **42/42 PASS** |
| C5 corrected longform | **48/48 PASS** |
| C6 harness/transport and integration regressions | **69/69 PASS** |
| Failure injections (including A–F) | **24/24 PASS** |
| Validate-only | **PASS**; `NOT_READ_LOCAL_ONLY`, remote calls 0, corpus calls 0 |
| Fresh temporary-target fake dry-run | **PASS**; 12/12 simulated quality slots, 36 simulated atomic calls, remote calls 0, corpus calls 0 |
| Historical attempts 01–09 integrity check | **PASS** |

C6 regressions assert that requests contain the pinned lesson context and required bounded prompt-visible evidence but exclude serialized AST/cell dumps, `VALIDATOR_ONLY`/`TEACHER_ONLY` evidence, held-out material, and credentials. Fake C6 end-to-end paths exercise both Excel longform detection→bounded repair→revalidation and C4 completion→generation post-validation. The generation regression detects both the M3/M4 contradiction and wrong ranking claim; the coordinate regression covers named/quoted sheets. Failure injection verifies local exceptions do not consume quality replicates and remain disjoint from model-quality and transport outcomes.

Pinned source SHA-256 values were revalidated unchanged:

| Input | SHA-256 |
|---|---|
| `dbms_student_lesson.md` | `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` |
| `excel_demo_b1.md` | `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414` |
| `excel-workbook-ast-projection.json` | `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed` |
| `excel_demo.xlsx` | `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7` |

Effective C6 contract hashes:

| Contract | SHA-256 |
|---|---|
| `dbms_sql-generation.json` | `82f706565dfadeec959f11cd632e9113a2e7ba33f624ecbb6a7de2e1c42f0eed` |
| `excel-generation.json` | `a02cd7c3ddc8d41a7e321eb8264647f184db039ba86ef15bca79d79fbb2c6123` |
| `dbms_sql-longform.json` | `2c393f0b4c35961fce671016dcd3564a717544fede958b2b52bdae3b7c960b10` |
| `excel-longform.json` | `06969633f1e40533765a1b68138ba1ab27c5feb2bb951f7288d30ee197fabf8a` |

### Verdict

The local C6 acceptance criteria are **PASS**. These corrections do not change the earlier environment finding and do not establish present-day route availability. **C7 remains `C7_EXECUTION_BLOCKED_BY_ENVIRONMENT`** until a separately authorized new live preflight is reviewed and passes. No C7 corpus execution was started.


## New Live Preflight — 2026-10-02

**Outcome: NOT EXECUTED — `LOCAL_PREFLIGHT_RUNNER_FAILURE`.** The required local checks passed for the matrix, pins, effective contracts, frozen identity inputs, and the corrected C6 implementation (`--validate-only`: PASS; six tasks, 12 quality slots). Historical attempts 01–09 and the previous live-preflight artifact remain unchanged. The dedicated credential was not loaded during these local-only checks (`NOT_READ_LOCAL_ONLY`).

Before any network access, inspection found a reproducible artifact-persistence collision: the approved `--live-preflight` path writes to the fixed `validation/work/C6/metrics/live-preflight.json`, which already contains the preceding preflight. There is no versioned output-path option, so invoking the runner would overwrite evidence that this task explicitly requires preserving. The run was stopped before credential loading or any request; no code workaround or network probe was attempted.

A new, non-overwriting stop record was created at `validation/work/C6/preflight/live-preflight-20261002-blocked-local-runner.json`. It records the local checks and the blocked attempt without representing it as a live result.

| Requested result | This attempt |
|---|---|
| Local source/matrix/contract checks | **PASS**; hashes match the previous validated state |
| Dedicated credential availability | **NOT TESTED**; secret was not read |
| Live catalog | **NOT ATTEMPTED**; 0 attempts |
| Catalog identity basis | **NONE** |
| Gemini route | **NOT PROBED — BLOCKED before network** |
| Groq route | **NOT PROBED — BLOCKED before network** |
| Remote calls / corpus calls / inference retries | **0 / 0 / 0** |
| Previous live-preflight artifact | **PRESERVED**; SHA-256 `1021ba2f9815c1611171480bd04c879e0bea612c3e95599d03783fdefbb8464c` |
| C7 | **NOT STARTED** |

Current environment availability was not assessed by this attempt. The previous historical environment verdict remains `C7_EXECUTION_BLOCKED_BY_ENVIRONMENT`; the immediate blocker for a new review is the local preflight artifact-persistence collision. A new live preflight requires a versioned, non-overwriting output target and local revalidation before it is run.


## Versioned Preflight Persistence Correction — 2026-10-02

This append-only correction preserves the preceding report, the legacy live-preflight artifact, and the prior blocked-runner record. Only the C6 runner and its regression suite were changed; catalog/transport taxonomy, retry policy, route-probe semantics, matrix, model IDs, source pins, and acceptance criteria were not changed.

### Persistence design

- `validation/work/C6/scripts/run_c6.py` now accepts `--preflight-output <path>` for `--live-preflight`. Without it, the runner creates a UTC timestamped JSON target under `validation/work/C6/preflight/`.
- The target is selected and exclusively reserved before validation reaches credential loading or networking. An existing final path or reservation fails closed as `PREFLIGHT_ARTIFACT_COLLISION`; the runner does not select a silent alternate name.
- Publication uses an atomic no-replace operation. A competing writer cannot replace an existing result. The legacy `validation/work/C6/metrics/live-preflight.json` is no longer a write target.
- All returned preflight outcomes, including auth/configuration stops, catalog stops, environment blocks, PASS, and caught local runner errors, pass through the same versioned persistence path. Persisted results and sanitized stdout expose `artifact_path`; error details and credentials are not printed.
- Collision regression verifies that credential loading, catalog access, and route client creation remain uncalled. Local runner exceptions are persisted as `LOCAL_PREFLIGHT_RUNNER_FAILURE` when the reserved path remains writable.

### Local verification and preservation

| Check | Result |
|---|---|
| Python syntax/import check | **PASS** |
| C6 regression suite, including P1–P9 | **77/77 PASS** |
| `--validate-only` | **PASS**; source pins, matrix, frozen identity inputs, effective contract hashes, and import checks passed |
| Credential status during local checks | **NOT_READ_LOCAL_ONLY** |
| Local network / corpus calls | **0 / 0** |
| Legacy `validation/work/C6/metrics/live-preflight.json` SHA-256 before and after | **UNCHANGED** — `1021ba2f9815c1611171480bd04c879e0bea612c3e95599d03783fdefbb8464c` |
| Prior `validation/work/C6/preflight/live-preflight-20261002-blocked-local-runner.json` SHA-256 before and after | **UNCHANGED** — `f3bbaf735dd2ff9e03da902fb4b4da44790ea48016d777764e22df1ee9427a8f` |
| Unfinished test reservations or temporary artifacts | **NONE** |

Persistence cases P1–P8 passed: explicit target, legacy preservation, distinct artifacts, pre-network collision, AUTH early result, environment-blocked result, PASS result, and sanitized stdout path. P9 additionally confirms a caught local runner error is persisted to its already-reserved versioned target without exposing its exception message.

### Live execution status

The single live-preflight command was **not launched**: the runtime execution-approval gate denied the network action before the runner process started. Therefore no credential was loaded, no catalog or route request was made, and no new live artifact was created. Added remote calls: **0**; corpus calls: **0**; inference retries: **0**. Credential verdict: **NOT_READ_LOCAL_ONLY**. Live catalog and current route availability: **NOT_ATTEMPTED / NOT_ASSESSED**. No `Versioned Live Preflight Result` section is recorded because the network was not reached.

**Persistence correction: PASS.** The live availability review remains pending; C7 was not started and remains blocked until the separately authorized live preflight is completed and reviewed.


## Versioned Live Preflight Result — 2026-10-02

This is the single explicitly authorized synthetic C6 live-preflight execution following the versioned-persistence correction. It used the runner's generated immutable target and did not execute C7 or any CORR task.

- **Artifact:** `validation/work/C6/preflight/live-preflight-20261002T144901677041Z.json`
- **Artifact SHA-256:** `ac769225049efc9d735be7dd7de2e6b32b10d7d7a0d06813977d38d58dfacecd`
- **Live catalog:** `CATALOG_AVAILABLE`, HTTP 200, one request.
- **Catalog identity basis:** `LIVE_CATALOG` (authoritative; frozen fallback was not used).
- **Gemini route** (`agy/gemini-3.8-flash-tiered`): **PASS** — HTTP 200, identity verified, non-empty model content, `finish_reason=stop`, terminal completion `done`.
- **Groq route** (`groq/qwen/qwen3.8-27b`): **PASS** — HTTP 200, identity verified, non-empty model content, `finish_reason=stop`, terminal completion `done`.
- **Accounting:** 3 remote calls total (1 catalog + 2 route probes); corpus calls 0; inference retries 0; no quality replicates consumed.
- **Credential verdict:** the dedicated credential loaded through `validation/shared/runtime_config.py` was accepted for catalog and both route requests; no alternate credential source was used and `secret_persisted=false`.
- **Local runner verdict:** `PASS`; persisted status `PASS`; historical-attempt preservation check passed.
- **Environment verdict:** both selected routes were operational during this preflight.
- The legacy preflight and prior blocked-runner artifact remain byte-identical to their recorded SHA-256 values. The new artifact is separate and non-overwriting.

**Outcome: `LIVE_PREFLIGHT_PASS` / `READY_FOR_C7_EXECUTION_REVIEW`.** This is readiness for a separate execution review only; C7 remains unauthorized and was not started.
