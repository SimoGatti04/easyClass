# C12 — AI Generation Adapter & Experimental Readiness

**Date:** 10 October 2026 (Europe/Rome)  
**Result:** `PARTIAL — OFFLINE MOCK ADAPTER VERIFIED; REAL EXPERIMENT NOT READY`  
**Remote calls / inference calls / corpus calls:** `0 / 0 / 0`  
**Model quality:** `NOT_EVALUATED`  
**Registry, eligibility, sign-off, publication, Gate D:** unchanged.

## Scope and source review

Reviewed the active `STATUS.md`; C11 report, runner, contract, and procedure; C9 frozen source, scenario, generation/assessment contracts and acceptance criteria; Dossier 01 (lesson phases and planned-vs-actual distinction), Dossier 04 §§46–48, Dossier 05 §§56–58, Dossier 10 architecture boundaries, Dossier 11 data-minimization/external-routing guidance; Gate-A model registry and profile evidence; C6 request renderer, request guard, OmniRoute client, runtime-config source, and shared SSE helper; and the applicable development-environment/engineering instructions. The project has no root `.git`, `pyproject.toml`, or `uv.lock`; changes and preservation were verified with file hashes and run manifests rather than a Git diff.

## Implementation verified

The C12 files are a separate, explicitly experimental path:

- `validation/work/C12/scripts/ai_generation_adapter.py`
- `validation/work/C12/contracts/ai-generation-lifecycle-v1.json`
- `validation/work/C12/tests/test_ai_generation_adapter.py`
- `validation/work/C12/procedure.md`

The adapter uses the existing C6 structured request renderer and `OmniRouteChatClient`, with a hard mock-only boundary: its constructor accepts only the exact in-process `FakeSSEOpener`; an arbitrary callable cannot spoof the test marker. C12 has no credential loader, no live CLI mode, and no supported real network opener. The run itself uses an in-memory placeholder config and mock catalog/capability evidence; none of these is evidence about a current live route.

C12 records a distinct mode (`C12_MOCK_TRANSPORT_EXPERIMENTAL`), separate mock-transport and remote/inference counters, hash-linked checkpoints/manifests, immutable stage inputs, sanitized transport records, request/response provenance and technical validation outcomes. A terminal persisted fake call is recoverable without a second call; uncertain outcomes stop without retry. Teacher and Student preparation approvals are simulated, explicit, and bound to the exact artifact version/hash. No actual lesson, coverage, publication, or assessment-use authority is produced. `request_publication_or_use` fails closed.

The three stage requests are distinct and sequential:

1. Teacher Material receives the frozen source and source facts.
2. Student Material receives the approved preparation version of Teacher Material and planned objectives/competencies.
3. Assessment Draft receives the approved Student Material version, planned competencies and self-contained synthetic data; the request excludes source text and Teacher Material. The student-facing item and solution are persisted separately; the solution is `TEACHER_ONLY`, mode `0600`.

The local checks validate JSON parsing/schema, objective/concept scope and SQL correctness through SQLite. These are technical/trace checks only; factuality, pedagogical usefulness, ambiguity and editing effort still need human review. No literal similarity is required.

## Sandbox evidence

Retained demonstration:

- Run: `c12-20261010T150412Z-8eb455e8`
- Path: `validation/work/C12/runs/c12-20261010T150412Z-8eb455e8/`
- Final state: `ASSESSMENT_DRAFT_PREPARED_NOT_USE_AUTHORIZED`, checkpoint 9
- Manifest: 62 inventoried files; SHA-256 `26de0a98fa38528a4ebbafec7159feea02f3ac116256164c9b400adf8e9afe8d`
- Calls: 3 fake structured transport calls; remote/inference/corpus calls `0/0/0`; retries `0`
- Publication performed: `false`; assessment-use authorized: `false`
- Model quality: `NOT_EVALUATED`
- Teacher-only solution permission: `0600`

This is a code-path/software fixture demonstration, not output from an AI model. A second prior C12 mock run remains independently versioned and hash-valid; neither run is overwritten.

## Tests and preservation

Final combined offline command:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest \
  validation.work.C12.tests.test_ai_generation_adapter \
  validation.work.C10.tests.test_micro_e2e_runner \
  validation.work.C11.tests.test_preparation_delivery_lifecycle -v
```

**56/56 PASS:** C12 15, C10 23, C11 18. Coverage includes three distinct sequential requests and correct visibility, exact-version simulated gates, no premature generation, assessment minimization, hash-bound mock route/capability evidence, SQLite rejection of an incorrect answer key, failure isolation, interruption recovery without a duplicate call, uncertain-outcome stop, artifact-manifest integrity, private answer-key permissions, and refusal of publication/real-use actions.

The immutable pre-change baseline lists **1,052** files; all **1,052/1,052** remain present with matching SHA-256. Both C10/C11 demonstration runs load and verify against their manifests. No C7/C9/C10/C11 historical run, output, manifest, contract, registry, eligibility, sign-off, or Gate D state was changed. The one new test checks C12 behavior only.

## Readiness gaps — do not run a live experiment yet

The adapter is **not yet connected to the actual C11 orchestration runner**. C12 currently has its own run state machine and mirrors C11 preparation-gate semantics; it does not call C11 `start_run`/`resume_run` or reuse C11's authoritative approval/reconciliation functions. This separation currently avoids writing mock calls under C11's sandbox counters/status, but it leaves a real integration gap. A small reviewed bridge/refactor is required before calling the adapter “connected to C11”; it must preserve C12 execution-mode accounting and C11 version-bound lifecycle semantics without changing old runs.

Other blockers are independent:

- **Live execution is disabled:** the adapter rejects non-fake openers. Runtime configuration is only injectable; the real source was not loaded or inspected for values. Do not enable a live transport by monkey-patching.
- **Route/capability is unverified now:** `agy/gemini-3.8-flash-tiered` is only a candidate for a fresh, authorized check. The saved registry/catalog is historical; structured output is `unknown` in the registry snapshot. Existing Gate-C evidence does not establish eligibility for this C12 `remote.generation` experiment. No route availability, model quality, or fallback is asserted.
- **Real human gates are absent:** C12 approvals are mock-only; no authenticated, authoritative teacher review interface exists. The C11 sandbox's simulated approvals/coverage/distribution are not real authorization.
- **Data and cost approvals are missing:** the exact source/request projection, OmniRoute/external destination and processing/retention terms, maximum cost/token budget, persisted artifacts and retention period require explicit approval before any corpus transmission.
- **Use remains out of scope:** draft generation would not establish actual lesson coverage, publication, student availability, assessment readiness, or authorization to administer.

Accordingly, readiness for one real experiment is **BLOCKED**. The exact offline procedure and gated future checklist are in `validation/work/C12/procedure.md`. There is no live command in this checkpoint; the mock CLI must never be used as a live substitute.

## Normative alignment and change boundary

The preparation approvals are distinguished from actual coverage and use; the Assessment Draft traces to the prepared Student Material version and planned concepts. It allows new synthetic SQL values and semantic re-expression, while the technical SQLite check verifies the declared reference/equivalent SQL against the synthetic rows. This follows Dossier 04 §47 and Dossier 05 §57 without carrying forward old Excel-specific precision as a universal product criterion. C11 simulated readiness remains explicitly simulated and no C12 record claims `use_authorized=true`.

No live preflight, inference, corpus transmission, publication, registry/profile update, eligibility change, Domain Owner sign-off, or Gate D action was performed.
