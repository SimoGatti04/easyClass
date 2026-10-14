# C11 — Preparation vs Delivery Lifecycle

**Date:** 10 October 2026 (Europe/Rome)  
**Execution:** offline deterministic sandbox only  
**Result:** `C11_SANDBOX_IMPLEMENTATION_PASS`  
**Product/model quality:** `NOT_EVALUATED` — sandbox fixture output is not model evidence. Gate D remains `BLOCKED`.

## Summary

C11 adds a separate, sandbox-only composition instead of changing the historical C10 runner. It separates planned preparation from later actual coverage, distribution/availability, and assessment-use reconciliation:

```text
planned objective + frozen source
→ Teacher Material preparation draft + exact-version approval
→ Student Material preparation draft + separate exact-version approval
→ Assessment Draft + teacher-only solution + separate exact-version approval
→ simulated actual-coverage record
→ separate simulated distribution record
→ exact-version/prerequisite reconciliation + SQLite key checks
```

The first three artifacts are preparable before the lesson. Their preparation approvals do not attest that a lesson happened, that concepts were taught, that material was distributed, or that an assessment is ready to administer. Only a later reconciliation can emit the conspicuously simulated `ASSESSMENT_READY_FOR_USE_SIMULATED` state.

## Evidence and policy alignment

Preflight included `STATUS.md`, C9 report/procedure/scenario/contracts/criteria, C10 report/procedure/runner/tests, and the relevant canonical material:

- Dossier 01 §7 and §19: Before/During/After Lesson and Planned vs Actual Study Plan remain distinct.
- Dossier 04 §§46–47: material roles, provenance, exact versions, semantic reliability without literal matching.
- Dossier 05 §§56–57: an Assessment is ordinarily assessable against the exact Student Material version actually available; new self-contained problems are allowed; unsupported prerequisites block use.
- Development-environment guidance read: `AGENTS.md`, environment README, engineering README, agent protocol, coding, testing, documentation, project structure.

C9 contracts and evidence remain unchanged. C11 adds an explicit lifecycle contract and additive dossier clarifications; it does not turn an unpublished draft into Assessable Material.

## Implementation

New files:

- `validation/work/C11/scripts/preparation_delivery_runner.py` — resumable sandbox CLI and lifecycle composition.
- `validation/work/C11/contracts/preparation-delivery-lifecycle-v1.json` — machine-readable state/authority boundaries.
- `validation/work/C11/tests/test_preparation_delivery_lifecycle.py` — offline lifecycle and negative tests.
- `validation/work/C11/procedure.md` — runbook with exact commands.

The runner reuses C9 frozen inputs and the local C10 deterministic backend/checkers. It does not import the C6 transport or any credential loader. Each C11 run freezes and hashes its C9 inputs, C11 contract and runner source, plus the reused C10 runner source. Checkpoints, sanitized events, immutable versioned artifacts and hash-linked manifests are persisted under the project. Run IDs are unique; outputs are non-overwriting; run roots and revision inputs are constrained to project paths.

Teacher Material, Student Material, Assessment student item, and teacher-only solution are separate. The key is stored with file mode `0600`. Approval records bind the exact version and hash; Assessment approval binds both the item and its separate solution. Revising a material creates a new immutable version and invalidates dependent approvals/artifacts as applicable. Old versions and gate records are preserved. `resume` performs at most one eligible generation stage and does not regenerate while waiting for a gate.

Assessment Draft creation uses the planned Student Material/competency scope. It has `use_authorization=false`; draft-time checks are labeled `TECHNICAL_DRAFT_VALIDATION_PASS`, not assessability approval. After the lesson/distribution records, reconciliation verifies the exact version chain and actual covered concepts. Partial coverage produces `ASSESSMENT_REVIEW_REQUIRED`, identifies affected item prerequisites, and recommends revision or exclusion. SQL answer checks use SQLite in-memory; no literal matching is imposed.

All gate, lesson and distribution events in this prototype are explicitly `C11_SANDBOX_SIMULATED` / `SIMULATED_ONLY`. No `actor_id` is treated as identity proof. Real mode is not implemented and fails closed.

## Offline tests

Final commands and results:

```text
python3 -B -m unittest -q validation.work.C11.tests.test_preparation_delivery_lifecycle
Ran 18 tests — PASS

python3 -B -m unittest -q validation.work.C10.tests.test_micro_e2e_runner
Ran 23 tests — PASS
```

C11 tests cover:

- all three drafts created before any lesson/coverage record;
- explicit preparation approvals, exact-version rejection, and no gate inference;
- no automatic distribution and no Assessment use authorization at draft creation;
- readiness only after actual-coverage plus exact-version distribution records;
- partial coverage flags affected item(s) and recommends revision/exclusion;
- stale dependent versions and approval invalidation after revision;
- Assessment revision with new approval requirement;
- prerequisite outside the planned scope rejected;
- wrong SQL answer key rejected by the SQLite checker;
- pause/resume idempotence, backend interruption recovery, and artifact tamper detection;
- separate teacher-only solution with mode `0600`;
- external run/revision paths and real mode rejected before I/O.

C10's 23-test regression suite remains PASS. C10's saved example manifest was checked after C11: **32/32** listed files present with matching hashes. The C7 final-artifact manifest was rechecked: **325/325** files present with matching hashes. No C7, C9 or C10 run, manifest, or raw evidence was modified.

## Persisted demonstration

Canonical final demonstration run:

- Run ID: `c11-20261010T115757Z-62b3e580`
- Path: `validation/work/C11/runs/c11-20261010T115757Z-62b3e580/`
- State: `ASSESSMENT_READY_FOR_USE_SIMULATED`, checkpoint 10
- Manifest SHA-256: `aa8bc6718e931f970486ee1b3ff891c5111c713813d3c26cce55bc33cdc21640`
- Manifest inventory: 44 files
- Sandbox generation calls: 3; SQLite checks: 4 (draft and reconciliation, two each)
- Remote/inference/corpus-remote calls: `0 / 0 / 0`
- Frozen C9 source SHA-256: `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`
- Student Material SHA-256: `6cb7006cb6845fb8615d025347dc3e3197dde0688a65fa83cfc16b8ed9bbf483`
- Assessment item SHA-256: `4507a6c34433198ea864131c391d8e2650812bf13e95ac0e70bd9270d19f092f`
- Teacher-only solution SHA-256: `5094009f024d41d2781d119864f46a19d5fff184f40675ca3554d3e6e246bd0b`; permissions `0600`.

The Assessment Draft itself still records `use_authorization=false`. The terminal state means only that the sandbox successfully exercised the simulated later gates and local reconciliation. No actual lesson, teacher approval, publication, student availability, assessment use, or model-quality result is claimed.

An earlier C11 smoke run, `c11-20261010T115432Z-535306ef`, was retained as a separate immutable run; the later run above is the demonstration tied to the final runner source. Neither replaces or modifies C10 history.

## Readiness for a future real-model connection

**Ready as a local orchestration boundary:** stage separation, versioned drafts, explicit pause points, resume/checkpoint semantics, version-bound approval shape, actual-coverage/distribution reconciliation, protected solution storage, and deterministic test coverage.

**Not ready to run with a real model or real users:**

1. A narrowly scoped generation adapter must be implemented and reviewed to call the already-authorized C6 transport, preserving stage-specific visibility, bounded requests and no inference retries. C11 currently has no remote path.
2. A separately authorized decision is required for sending the exact frozen C9 source/corpus and selecting an already permitted route. This task did neither.
3. Real teacher review/coverage confirmation and Student Material/Assessment approval need an authoritative operational interface and version-bound records. `actor_id` alone is not authentication or authorization.
4. Actual publication/availability needs a reliable system-of-record; the sandbox distribution event is not proof students could access anything.
5. A real-run privacy, access-control, retention and Teacher-only solution handling review is needed, followed by human review of factuality, pedagogical quality, assessment alignment and editing effort.

No registry, eligibility, Domain Owner sign-off, or Gate D state was changed. No remote inference or corpus submission was performed.

## Documentation and workspace state

- Additive clarification in Dossier 01 §7/§19; new clarifications in Dossier 04 §48 and Dossier 05 §58.
- `STATUS.md` updated; historical C7/C9/C10 decisions remain intact.
- The project root has no `.git` directory, so Git status/diff verification was unavailable. Verification relied on the executed test suites, run manifests, and C7/C10 artifact hash checks.
- Resource inventory: C11 runs `c11-20261010T115432Z-535306ef` (initial smoke run) and `c11-20261010T115757Z-62b3e580` (final-source demonstration) are intentionally retained, owned by this C11 project work, for immutable provenance/evidence; cleanup trigger is a future explicit retention decision after their provenance is no longer needed. `validation/work/C11/.test-tmp/` is empty and intentionally retained as the test suite's project-local scratch root; the test suite removes its temporary children, and the root can be removed if the test harness moves. The external scratch file `/private/tmp/c11-status.json` was removed; no project-specific Python cache target was created. A pre-existing shared cache parent under `~/Library/Caches/com.apple.python~/Workspace/` was left untouched because it is outside the project and has other workspace consumers.
