# C13 — Unified Lifecycle & Live Experiment Readiness

**Date:** 11 October 2026 (Europe/Rome)  
**Result:** `PASS — C11-owned lifecycle integrated through the C6 call boundary; live execution remains blocked pending Domain Owner decisions and a fresh C6 preflight.`  
**Scope:** local implementation, fake transport, offline tests and provenance only.  
**Actual network / model / corpus calls:** `0 / 0 / 0`.  
**Credentials read:** `0`.  
**Model quality:** `NOT_EVALUATED`.

## Executive result

C13 now uses **one authoritative persisted state machine: C11**. The C13 generator is a replaceable backend port invoked by C11's existing `resume_run`/checkpoint/manifest operations. The implementation does not copy C11's versioning or approval logic into C12 and does not add a second lifecycle. C12 remains the source of the frozen structured request contracts and schemas; C6 remains the source of request rendering, safety guard, SSE transport, route identity checks and capability preflight.

The integrated mock test and demonstration traverse the same C11 lifecycle and the C6 renderer/client using only the concrete fake SSE transport. A separately guarded remote factory reaches the real C6 HTTP client and existing runtime configuration loader only after the exact phase gate and fresh capability evidence. Creating a dormant remote-mode C11 run is local and does not consume a short-lived preflight; current identity/capability is checked after the request is persisted/reviewed, immediately before the one generation call. The current plan is deliberately pending, so there is no enabled live run in this task.

## Source review and design decision

Read `STATUS.md`; C10, C11 and C12 reports, procedures, tests, runners and contracts; the C9 scenario/source/acceptance artifacts; C6 `request_guard.py`, `omniroute_transport.py`, `run_c6.py`, catalog behavior, shared SSE and runtime loader; and applicable guidance in Dossier 01, Dossier 04, Dossier 05, Dossier 10, Dossier 11 and the local development/environment verification notes.

The minimum integration was a C13 backend adapter over C11's experiment extension points. C11 owns the run ID, exact-version request and continuation gates, artifact versions, invalidation, checkpoint recovery and final manifest. The adapter projects C11 stage context into the existing C12 request/schema, calls the shared C6 renderer/client, and returns a validated structured payload to C11 for persistence. C10/C11/C12 historical runs and APIs were left intact.

C13 experimental decisions are not C11 didactic approvals. No C13 experiment can record actual lesson coverage, publication, student availability or Assessment use. The mode and accounting fields explicitly distinguish `C13_EXPERIMENTAL_MOCK` from `C13_EXPERIMENTAL_REMOTE` and both from ordinary C11 sandbox/product use.

## Implemented path

- **Stage 1 — Teacher Material:** frozen C9 source and in-scope facts are visible only to this request. The output is a preparation/experiment draft, not evidence that it was reviewed or taught.
- **Stage 2 — Student Material:** only the exact persisted Teacher Material experiment output, its version/hash and planned scope are used. C13 replaces C12's ordinary “approved preparation” wording with explicit experimental-draft wording; it does not mutate the frozen C12 contract.
- **Stage 3 — Assessment Draft:** only the exact Student Material experiment output/version, planned competencies and self-contained synthetic assessment data are supplied. Source, Teacher Material and answer-key input are excluded from the model request. C11 validates the result and the SQL reference behavior through SQLite. The student item and teacher-only solution are separate; the latter is persisted with mode `0600`.
- After each output, C11 commits the artifact and pauses. An exact-version continuation record binds the completed artifact and the complete next request projection. A wrong version/hash or changed projection is rejected. The continuation is an experiment-only decision, not approval for teaching or distribution.
- C6's real renderer, JSON Schema response format, generic request safety checks, SSE semantics, transport identity validation and terminal-completion checks are used by the adapter. No alternative provider key, endpoint, model, retry or silent fallback exists.
- Staged C6 request/call records and sanitized response content are committed into the C11-owned run and hashed in the manifest. Each phase's call intent includes the C6 capability evidence hash/path and the exact request hashes. Attempted, completed and uncertain calls are counted separately; a persisted terminal response is recovered without repeating the call, while an uncertain result stops with no retry.
- A fresh C6 `PASS` no older than 300 seconds is required for each generation phase and must cover the pinned Gemini and Groq route probes. The preflight is synthetic and corpus-free. A failed, stale, malformed or mismatched artifact blocks the phase before the runtime loader. Run creation is dormant/local; it does not spend the 300-second evidence window during request review.
- At the actual one-stage command boundary only, C13 calls the existing `load_teacher_service_omniroute_config()` loader and verifies the loaded base URL equals the owner-approved endpoint. No credentials were read or loaded during C13.

The prompt scope is the C9 objective `SELECT` / `FROM` / `WHERE` / `ORDER BY`; JOIN and aggregation are excluded rather than elevated to prerequisites. Examples and new values may be synthetic and semantically equivalent, with no exact wording requirement. Dossier 04 §47 and Dossier 05 §57 are used for factual reliability and competency coherence—not the old Excel-specific exactness criteria.

## Versioned authorization plan and pending Domain Owner decisions

Current plan: `validation/work/C13/plans/authorization-plan-v001.json`  
Canonical SHA-256: `3ee8465a97eff3c3d2002ecdad353b61a69c45d55d78bb3b97cd43e1a80c2f52`  
State: `PENDING_DOMAIN_OWNER_INPUT_AND_APPROVAL`. The companion file under `authorizations/` is explicitly a non-authorizing template. All pinned source/implementation hashes match the files at this report; the template binds the canonical plan hash.

The frozen source SHA-256 is `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`. The current candidate is `agy/gemini-3.8-flash-tiered`; `agy` is only the route namespace, not proof of the downstream serving provider. The plan's historical catalog snapshot is used only for identity alias resolution. It does not prove current route availability or select/fallback to a model.

The plan proposes, but does not grant:

- One generation request per phase, three total; no inference retry and no fallback.
- `max_tokens`: Teacher 3000, Student 2000, Assessment 2500; temperature 0.2, top_p 0.9, streaming enabled.
- Up to three fresh C6 synthetic preflights, each bounded to 9 HTTP calls/160 output tokens; total ceiling 27 preflight calls/480 preflight output tokens. Together with at most three generation requests, the full gateway ceiling is 30 calls and 7,980 output tokens.
- A maximum total spend of USD 1.00. **No independent account-level hard-cap evidence is available.** C13 now requires an owner-controlled, project-relative evidence artifact path and matching SHA-256 in both plan and authorization, and verifies the file hash before creating a generation-capable backend. A claimed hash without the evidence file is rejected.
- Exact OmniRoute base URL is unset; effective downstream provider is unresolved. The Domain Owner must identify the provider from an authoritative route record or explicitly accept that it remains unreported. Non-loopback HTTP is rejected; HTTPS is required.
- External processing approval is pending. Owner-only project storage and manual cleanup after 30 days are proposals, not approved retention terms. The source and drafts contain no student personal data in this proposed scenario.
- The Domain Owner must create a non-simulated authorization binding the exact plan SHA, route, source SHA, spend evidence path/hash, and data/retention decisions. The prototype checks that local version-bound record; it does not cryptographically authenticate a person's identity. The owner must control authorization-file creation. A template or `actor_id` is not authority.
- Before every phase call, review the exact persisted request projection, rendered messages, response schema, hashes, model, parameters and token limit; issue a one-call stage authorization. After an output, decide explicitly whether to continue using that exact artifact and next projection.

All requested authorization values and exact future command sequence are in `validation/work/C13/procedure.md`. No approval was inferred from the software tests.

## Offline test and demonstration evidence

Final command:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest \
  validation.work.C13.tests.test_unified_ai_experiment \
  validation.work.C12.tests.test_ai_generation_adapter \
  validation.work.C11.tests.test_preparation_delivery_lifecycle \
  validation.work.C10.tests.test_micro_e2e_runner -v
```

**66/66 PASS:** C13 10, C12 15, C11 18, C10 23.

C13 integration coverage includes:

- Three sequential structured fake calls through C11 and the real C6 renderer/client, with committed pause between each phase and exact continuation gate.
- Different stage request visibility; Assessment excludes source and Teacher Material. The teacher-only answer key remains separate and `0600`.
- No call before a persisted projection and matching gate; stale/wrong artifact version is rejected.
- Run creation without current capability evidence remains dormant; capability is required again for the actual phase gate. Pending global authorization, invalid capability scope/content, inconsistent downstream-provider declarations, non-loopback HTTP, and unverifiable spend evidence fail closed before credentials.
- Interruption after a terminal transport result recovers the persisted response without a duplicate call; an uncertain timeout is counted as uncertain and is never retried.
- No publication/use/actual-coverage state is produced.

Retained current-code demonstration:

- Run: `c11-20261011T013023Z-779169de`.
- Directory: `validation/work/C13/runs/c11-20261011T013023Z-779169de/`.
- Final state: `C13_ASSESSMENT_DRAFT_PREPARED_NOT_USE_AUTHORIZED`; 13 C11 checkpoints; 77 manifest entries; final manifest SHA-256 `bb0e60e9e547a49ca2f91475c2c6439565111bc5d23a6cc60ec47cc2e32d5d03`.
- Mode: `C13_EXPERIMENTAL_MOCK`. Three fake transport calls attempted/completed; remote/inference/corpus calls `0/0/0`; uncertain calls `0`; SQLite checks `2`.
- `publication_performed=false`, `assessment_use_authorized=false`, `actual_coverage=null`, `distribution=null`; model quality remains `NOT_EVALUATED`.
- The run's archived C13 backend source matches the current C13 adapter, and `c11.load_run()` verified the checkpoint pointer, complete manifest chain, inventory and hashes.

This is an integration and persistence demonstration only. The generated fixture outputs are not evidence of model factuality, pedagogy, route quality or live capability.

## Preservation and change boundary

A before/after SHA-256 audit of **1,787** files across Gate C v2 historical artifacts/outputs/logs/metrics and prior C7/C9/C10/C11/C12/C13 run roots found **1,787/1,787 unchanged and present**. The prior C13 demonstration and all historical C10–C12/C7 records were preserved. The only new run is the versioned C13 mock demonstration above.

C6, C10–C12 lifecycle contracts, C9 source, Dossier content, registry, model eligibility, C7 Domain Owner sign-off and Gate D were not edited. Gate D remains **BLOCKED**. A preliminary C13 mock run `c11-20261011T012545Z-7a7657f8` was also created during implementation and retained; it is a valid earlier mock execution, but the report's final demonstration is `c11-20261011T013023Z-779169de`, whose archived adapter snapshot matches the final source. Both runs independently verify through C11 manifests. Pre-existing hidden C13 scratch directories (`.dev-run*`, `.hashdebug`) were retained; they were not inspected for content or modified.

## Readiness decision

**Offline unified lifecycle + real-call boundary: PASS.** The current implementation has a supported no-monkey-patching path to one real C6 request after exact request review, version-bound owner authorization, fresh capability evidence and runtime-loader checks. It is not merely a mock-only adapter.

**Live experiment: BLOCKED / NOT AUTHORIZED.** Do not run `remote-start`/`remote-stage` yet. The plan is pending and the gateway URL, downstream-processor decision, spend-cap evidence, data-processing/retention approval and non-simulated Domain Owner authorization are unresolved. No fresh C6 preflight has been run in this task; current route/capability status is therefore unknown. A future authorized experiment must perform the C6 preflight immediately before each individual phase, inspect and bind that phase's exact request, and stop on any failure. No inference, source transmission, registry change, eligibility update, sign-off or Gate D transition is authorized by this report.
