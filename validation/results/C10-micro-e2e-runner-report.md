# C10 — Micro-E2E Runner & Human Gates

**Date:** 10 October 2026 (Europe/Rome)  
**Execution mode:** offline deterministic sandbox only  
**Result:** `SANDBOX_IMPLEMENTATION_PASS`; no model-quality or real-teacher evidence was produced. Gate D remains `BLOCKED`.

## Outcome

C10 adds a small local, checkpointed orchestration over the prepared C9 scenario. It completed the software path:

```text
frozen C9 source
→ simulated Teacher Material
→ simulated coverage gate
→ simulated Student Material
→ simulated student approval
→ simulated publication (not actually available)
→ synthetic Assessment Item + teacher-only key
```

The runner stops at each human boundary until an explicit gate record exists. Sandbox records are conspicuously marked `SANDBOX_SIMULATED` / `SIMULATED_ONLY`; they cannot be represented as real teacher confirmation, approval, or publication. Real generation is intentionally disabled: `start --mode real` fails closed before creating a run or invoking a backend.

## Implementation and reuse

- Added `validation/work/C10/scripts/micro_e2e_runner.py`, a local CLI with `start`, `resume`, `status`, `sandbox-gate`, and `sandbox-demo` commands.
- Added `validation/work/C10/tests/test_micro_e2e_runner.py` (23 tests).
- Added the exact-command runbook `validation/work/C10/procedure.md`.
- The deterministic backend is local test code, not a model or provider adapter. The runner imports and reuses C4's bounded `validate_json_schema_subset` helper for local generated-object checks.
- C4's current two-stage pipeline has no intervening teacher gate, and C6 includes a real transport capable of remote calls. Neither was modified or invoked. No transport/credential loader is imported into the C10 runner.
- The Assessment generation context is deliberately limited to the published Student Material version, bound simulated gates, the objective identifier, the assessment contract, and the supplied synthetic rows. The frozen source text and private Teacher Material are not passed to the Assessment backend; a dedicated regression test asserts this boundary.

Each run gets a unique ID and freezes C9 inputs after checking the source hash against both scenario and source pins. Checkpoints and sanitized event logs are append-only, each checkpoint has a hash-linked manifest, files are written non-overwriting, and `CURRENT.json` points at the verified chain head. Resume performs no more than the next eligible stage. A failed or completed run is not automatically regenerated. The teacher-only key is a separate file with mode `0600`.

## Verification

Command:

```sh
python3.14 -B -m unittest -v validation.work.C10.tests.test_micro_e2e_runner
```

**Result: 23/23 PASS.** Coverage includes the full sandbox path; pause/resume without duplicate generation; missing, malformed, conflicting and wrong-version gates; sandbox/real authority separation; unpublished-material Assessment block; unconfirmed prerequisites; insufficient item data; incorrect SQL key; equivalent SQL forms; interrupted generation preserving prior artifacts; tamper detection; manifest/checkpoint integrity; zero remote accounting; and Assessment input privacy.

The Assessment verifier builds SQLite `:memory:` from the explicitly supplied synthetic schema and rows, computes expected rows independently, and executes the reference key plus an equivalent query under a read-only SQLite authorizer. Both queries passed. The strict `< 20` condition excluded the row at exactly 20; returned rows were ordered ascending. This is only a bounded software/key check, not a general SQL validator, teacher judgment, or validation of model-generated content.

### Completed example execution

The saved in-project demonstration is:

- Run: `c10-20261010T021024Z-27680679`
- Directory: `validation/work/C10/runs/c10-20261010T021024Z-27680679/`
- Terminal state: `COMPLETED_SANDBOX_ONLY`, checkpoint sequence 7
- Persisted files in terminal manifest inventory: 32
- Manifest: `manifests/MANIFEST-0007.json`
- Manifest SHA-256: `1412d8a245444ed7f639193d62454648a66457acfd3f39b809c652d92f8b18c8`
- Assessment validation: PASS; SQLite query checks: 2/2 PASS
- Accounting: `remote_calls=0`, `inference_calls=0`, `corpus_remote_calls=0`, `sandbox_generation_calls=3`
- Key: `artifacts/assessment/v0001/teacher-only-solution.json`, mode `0600`
- Availability: `SIMULATED_AVAILABLE_ONLY`; no real distribution occurred.

The item trace records the objective, four required skills, exact Student Material version and hash, publication-gate hash, and simulated availability. The key is absent from the student item artifact. The manifest chain was reloaded and verified by the runner's `status` path.

## Regression and historical preservation

C7 and C9 historical outputs, reports, contracts and fixture records were not edited by C10. The C7 execution manifest was checked again: **325/325** listed final artifacts exist and match their SHA-256; zero missing and zero mismatched. Manifest SHA-256: `328cee9301ea19fa454d899a4a7f6320fa283912487af126d3180ca70722628e`.

The frozen C9 source remains `d0088409d21d6537e3b96e1581466966fc254fc17695b44c23b6e7dfa77c9035`; the runner copies it and verifies it against the C9 scenario and source pins at run creation. No C7 output, registry, eligibility, Domain Owner sign-off, or Gate D state was changed. The workspace has no `.git` directory at its root; verification therefore used the C7 manifest rather than Git diff/status.

## Readiness for a future real Micro-E2E

**Not remotely runnable yet; no remote run is authorized or performed by C10.** The local state machine and simulated gates are ready for further review, but the production backend and authoritative teacher workflow are not implemented. Before a separate task can implement or run the real scenario, all of the following remain required:

1. Explicit approval for sending the exact frozen C9 source to a selected already-authorized route, together with confirmation of applicable data handling. C10 itself reads no credentials and makes no network requests.
2. A narrow, reviewed real backend adapter that uses the existing approved C6 transport/configuration path, makes only the intended bounded calls, records sanitized/versioned evidence, and does not add alternate credentials or inference retries. The C4 two-stage `run()` cannot be reused as-is across the mandatory teacher pause because it executes both stages together.
3. An operational real-mode gate submission path for version-bound, non-simulated teacher coverage confirmation; separate Student Material approval; and proof of actual publication/availability. The current CLI exposes only simulated gates and deliberately refuses real mode. Its real-gate shape validator is unit-tested, but that is not an operational real human-gate workflow or authentication system.
4. Teacher review of factual reliability, attribution, pedagogical usefulness, Student Material quality, alignment to actually confirmed coverage, Assessment sufficiency/correctness, and editing effort using C9 criteria. SQLite verifies only the narrow answer key and supplied data.
5. A separate authorization/review of persistence, access to the teacher-only solution, and retention of any real source or generated content.

The live test must remain one exploratory text-first case and must not be described as general model validation or eligibility. No approval or Gate D transition is implied by this sandbox pass.

## Exact local procedure

See `validation/work/C10/procedure.md` for the full commands to run the 23-test suite, execute the complete deterministic sandbox, or pause and resume one stage at a time. No remote execution should be appended to those commands.
