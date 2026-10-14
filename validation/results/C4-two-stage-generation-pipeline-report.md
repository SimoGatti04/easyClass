# C4 — Generic Two-Stage `remote.generation` Pipeline

**Run date:** 2026-10-01  
**Verdict:** `PASS` — `READY_FOR_C5_REVIEW`  
**Scope:** Local implementation and scripted replay only. No provider/remote calls, corpus transmission, credential reads, apply/publish side effects, C5 work, or Gate D work.

## Scope and non-goals

C4 implements a provider-neutral two-stage generation core. Stage 1 generates a lesson plan plus task-declared metadata; Stage 2 generates only student material and is bound to the exact validated, persisted Stage 1 draft. The final output is assembled locally into the legacy three-field generation payload and remains a draft for L3 teacher review.

No real-model quality claim is made. OmniRoute, HTTP/SSE transport, longform repair, model registry/status, C5–C7, and Gate D are out of scope. Gate C historical artifacts were used read-only as replay fixtures.

## Architecture and contracts

- Core: `~/Workspace/teacher-service-design/validation/shared/two_stage_generation.py`
- Backend port: typed `GenerationBackend.generate(request) -> GenerationResponse`. The core has no HTTP, provider, model-ID, API-key, or SSE dependency. C4 injects only a scripted local fake backend.
- Structured, versioned Stage 1 and Stage 2 requests separate task contract, task context, selected source context, permitted evidence prompt view, stage instructions, output schema, and canonical request hash.
- Exactly one generation call is allowed per stage. There are no retries, repair calls, or fallbacks.
- Stage 1 returns only `lesson_plan` and task-driven `metadata`; its schema and C2 completeness contract run before Stage 2 can start.
- Successful Stage 1 is persisted as `FROZEN_STAGE1_DRAFT` with canonical payload/hash, schema and C2 results, task/prompt identifiers, and source/evidence references. The persisted bytes are reloaded and hash-verified before being handed to Stage 2.
- Stage 2 receives the exact frozen Stage 1 payload and hash, plus the caller-selected context and allowed evidence view. It emits only `student_material`; its frozen result records `depends_on_stage1_hash`.
- The public assembly boundary now also rejects drafts without recorded passing schema/C2 checks or with a mismatched task contract, in addition to rejecting a stale Stage 2-to-Stage 1 hash binding.

## C2 Semantic Completeness

The core imports and invokes the existing implementation in `~/Workspace/teacher-service-design/validation/shared/semantic_completeness.py`; C2 rules are not duplicated. Task fixtures supply separate Stage 1 and Stage 2 contracts. Stage 1 fails closed on C2 `FAIL`; Stage 2 runs C2 bundle evaluation against both deliverables, including `distinct_from` comparison. C2 `WARN` checks are retained in results and do not override a C2 `PASS`.

The C2 regression suite also passed: **17/17** local tests.

## C3 Evidence and visibility

The core accepts `EvidencePack | None` and constructs model-visible evidence only with `EvidencePack.for_prompt()`. The complete canonical pack is used only to compute a provenance hash; it is not placed in a generation request. Caller-selected source context remains a separate input, and no retrieval/provider was added.

The integration uses `~/Workspace/teacher-service-design/validation/shared/evidence.py` and its `EvidencePack.for_prompt()` contract. The history fixture proves that prompt-visible event facts reach both stages while a sensitive `VALIDATOR_ONLY` answer and a `TEACHER_ONLY` note do not appear in either captured request. Stage request tests also confirm the canonical full evidence pack is absent.

## Failure states and truncation

Machine-readable stage states distinguish technical, schema, and completeness failure, `STAGE2_NOT_RUN`, `ASSEMBLY_BLOCKED`, and `COMPLETE_PENDING_REVIEW`. A Stage 1 failure prevents any Stage 2 call. A Stage 2 failure leaves its validated Stage 1 freeze intact and does not create a final complete artifact. Backend exceptions and invalid response types are isolated to the relevant stage.

Only `technical_complete == true` and `finish_reason == "stop"` count as normal completion. A `length` finish fails technically even when the body is parseable JSON; the affected later stage is not promoted and assembly is blocked.

## Deterministic validation and assembly

A small deterministic strict-JSON/schema-subset validator checks object/field types, required fields, declared property constraints, and nested structures. Duplicate JSON keys, invalid JSON constants, and undeclared fields are rejected. The task contract declares required/optional metadata keys; undeclared metadata and output fields fail closed (`additionalProperties: false`).

Assembly is deterministic and does not rewrite or fill in content:

```json
{
  "lesson_plan": "<Stage 1>",
  "student_material": "<Stage 2>",
  "metadata": "<Stage 1>"
}
```

Canonical hashes cover requests, frozen stage payloads (Stage 2 hash includes the Stage 1 binding), and the final three-field payload. Operational timestamps are not part of canonical identity. Identical scripted inputs/responses produced identical hashes and persisted artifacts over repeat runs.

## L3 review semantics

The successful final state is `COMPLETE_PENDING_REVIEW`, with review state `DRAFT`. The audit records `NOT_APPLIED` and `NOT_PUBLISHED`; a review item explicitly requires teacher decision. No curriculum, lesson, or material state is changed. The term “approved” is not used for the Stage 1 result.

## Replay and orthogonal-domain fixtures

- **Historical Candidate B positive replay:** Stage 1 and Stage 2 validated; two fake calls; canonical three-field output exactly equals the historical payload. This is compatibility regression only, not a new benchmark.
- **Historical Candidate C negative replay:** Stage 1 JSON/schema validation passes; C2 completeness fails on the placeholder plan; Stage 2 is not run; final assembly is blocked; one fake call.
- **Orthogonal History fixture:** completes Stage 1 → frozen Stage 1 → Stage 2 → C2 bundle checks → canonical assembly using the same core and no domain-specific branch. Its compact metadata contract is distinct from the explicitly declared historical replay contract, demonstrating that metadata is task-driven rather than copied by core logic.
- Historical Candidate B and C input hashes are checked before and after replay; they remain unchanged.

## Genericity and provider neutrality

Automated source scans against the core report **0 domain/format-term hits** and **0 provider/model/transport-term hits**. The core contains no domain- or provider-specific branch. Subject/source differences are carried only through task contracts, request context, evidence, or fixtures.

## Test matrix and execution evidence

The C4 suite passed **42/42** tests: required T1–T28 plus supplemental cases for backend exceptions, one-call semantics, duplicate-key rejection, non-integer booleans, warning handling, request privacy, task/source/evidence provenance, and rejection of assembly from a Stage 2 draft without passing validation. The suite covers stage ordering, Stage 1 freeze/hash stability, exact Stage 2 binding, C2 integration, C3 visibility, truncation, failure isolation, both historical replays, orthogonal-domain generation, deterministic/idempotent artifacts, network blocking, and no apply/publish side effects.

| Test | Covered behavior | Result |
|---|---|---|
| T1 | Task contract canonical round-trip | PASS |
| T2 | Deterministic request hash | PASS |
| T3 | PROMPT_VISIBLE evidence reaches both stages | PASS |
| T4 | VALIDATOR_ONLY evidence excluded | PASS |
| T5 | TEACHER_ONLY evidence excluded | PASS |
| T6 | Stage 1 schema failure blocks Stage 2 | PASS |
| T7 | Stage 1 C2 failure blocks Stage 2 | PASS |
| T8 | Stage 1 truncation blocks Stage 2 | PASS |
| T9 | Stage 1 freeze hash stable and verifiable | PASS |
| T10 | Stage 2 receives exact persisted Stage 1 | PASS |
| T11 | Stage 2 schema failure preserves Stage 1 | PASS |
| T12 | Stage 2 C2 failure preserves Stage 1 | PASS |
| T13 | Stage 2 truncation preserves Stage 1 and blocks assembly | PASS |
| T14 | Near-duplicate student material fails distinction | PASS |
| T15 | Distinct plan/material pair passes | PASS |
| T16 | Canonical assembly is exact and non-mutating | PASS |
| T17 | Mismatched Stage 1 binding fails closed | PASS |
| T18 | Candidate B historical positive replay | PASS |
| T19 | Candidate C historical early block | PASS |
| T20 | Orthogonal History fixture completes | PASS |
| T21 | Core genericity scan | PASS |
| T22 | Core provider-neutrality scan | PASS |
| T23 | Network calls blocked / zero | PASS |
| T24 | Identical replays produce identical hashes/artifacts | PASS |
| T25 | Final state remains pending human review | PASS |
| T26 | No apply/publish side effect | PASS |
| T27 | Final artifact retains provenance references | PASS |
| T28 | Unknown output fields rejected by declared policy | PASS |

- C4 runner: `~/Workspace/teacher-service-design/validation/work/C4/scripts/run_c4.py`
- C4 tests: `~/Workspace/teacher-service-design/validation/work/C4/scripts/test_two_stage_generation.py`
- C4 fixture scenario: `~/Workspace/teacher-service-design/validation/work/C4/scenario.py`
- Task-contract fixtures: `~/Workspace/teacher-service-design/validation/work/C4/inputs/task-contract-fixtures.json`
- Metrics: `~/Workspace/teacher-service-design/validation/work/C4/metrics/c4-metrics.json`
- Logs: `~/Workspace/teacher-service-design/validation/work/C4/logs/c4-run.log`
- Replay artifacts: `~/Workspace/teacher-service-design/validation/work/C4/outputs/`

Recorded source hashes:

| Input | SHA-256 |
|---|---|
| C4 core | `5dd65cb3e079cb7baeeeecd195b36b00b9f536f4beb3e428477bc9a14369efdc` |
| C4 task-contract fixtures | `7652c44a1ec892359eb02f79d5066ec37552c10fb1f19e19d861bde8deca37ea` |
| Historical Candidate B fixture | `ffbacbd3b3fc9f43e42e0fdc007a14bd2eadf98aa5dd3534e92bff4e1c606e95` |
| Historical Candidate C fixture | `6c25ae60d734f170b82467eb1adb212b57c7b993d68b8b0881c331aa62eff329` |
| Selected source context | `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035` |

The C4 runner reported 0 provider calls, 0 remote/network calls, 0 credential reads, corpus not sent, 0 apply/publish side effects, and `c5_started=false`.

## Known limitations

- No real backend is connected; output quality, provider-specific structured-output compliance, latency, and transport behavior remain untested.
- The validator intentionally implements only the small JSON Schema subset needed by these task contracts.
- Deterministic C2 checks and successful replay are not human approval; L3 review remains mandatory.
- Stage 1 persistence makes future reuse possible, but this slice does not implement scheduling, resume orchestration, or longform/repair behavior.

## C4 acceptance

All requested C4 acceptance conditions passed locally. **C4 = PASS.** This report authorizes review only; it does not begin C5.
