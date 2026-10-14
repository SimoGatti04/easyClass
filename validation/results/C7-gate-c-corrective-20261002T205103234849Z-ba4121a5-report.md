# C7 Gate C Corrective Execution Report

**Execution ID:** `gate-c-corrective-20261002T205103234849Z-ba4121a5`
**Verdict:** `C7_EXECUTION_PARTIAL_ENVIRONMENT_BLOCKED`
**Execution root:** `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5`

## Frozen basis

- Freeze: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/execution-freeze.json` (SHA-256 `6593082268061c5bfb11f15df3fc31f4481187936bc3e0aee77e7362f794f465`)
- Matrix SHA-256: `30d9832266cdcef92ecee66a2e10101cef6729dbc877cd540694775f36b72665`
- Live preflight: `validation/work/C6/preflight/live-preflight-20261002T144901677041Z.json`; PASS / LIVE_CATALOG; corpus calls 0; historical attempts preserved.
- Execution-time catalog identity basis: `LIVE_CATALOG`
- Selected models: `agy/gemini-3.8-flash-tiered, groq/qwen/qwen3.8-27b`

## Execution counts

- Scheduled quality replicates: 12
- Completed quality replicates: 8
- QUALITY_PASS: 7
- QUALITY_FAIL: 1
- ENVIRONMENT_BLOCKED quality slots: 1
- RUNNER_FAILURE quality slots: 0
- AUTH_REQUIRED_TEACHER_SERVICE slots: 0
- Atomic inference calls: 33
- Bounded repair calls: 0
- Inference transport attempts: 33
- Catalog bootstrap attempts: 1

## Matrix results

| Task | Model | Scenario | Profile | Replicate 1 | Replicate 2 |
|---|---|---|---|---|---|
| CORR-01 | `agy/gemini-3.8-flash-tiered` | dbms_sql | `remote.generation` | QUALITY_PASS | QUALITY_PASS |
| CORR-02 | `agy/gemini-3.8-flash-tiered` | excel | `remote.generation` | QUALITY_PASS | QUALITY_FAIL |
| CORR-03 | `agy/gemini-3.8-flash-tiered` | dbms_sql | `remote.longform` | QUALITY_PASS | QUALITY_PASS |
| CORR-04 | `agy/gemini-3.8-flash-tiered` | excel | `remote.longform` | QUALITY_PASS | QUALITY_PASS |
| CORR-05 | `groq/qwen/qwen3.8-27b` | dbms_sql | `remote.generation` | ENVIRONMENT_BLOCKED | NOT_RUN_STOPPED |
| CORR-06 | `groq/qwen/qwen3.8-27b` | excel | `remote.generation` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |

## Per-replicate deterministic evidence

### CORR-01 replica 1 — QUALITY_PASS

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-01/replicate-01`
- Stage 1 schema/C2: True / PASS
- Stage 2 schema/C2: True / PASS
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-01 replica 2 — QUALITY_PASS

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-01/replicate-02`
- Stage 1 schema/C2: True / PASS
- Stage 2 schema/C2: True / PASS
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-02 replica 1 — QUALITY_PASS

- Scenario/profile/model: `excel` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-02/replicate-01`
- Stage 1 schema/C2: True / PASS
- Stage 2 schema/C2: True / PASS
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-02 replica 2 — QUALITY_FAIL

- Scenario/profile/model: `excel` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-02/replicate-02`
- Stage 1 schema/C2: True / PASS
- Stage 2 schema/C2: True / PASS
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-03 replica 1 — QUALITY_PASS

- Scenario/profile/model: `dbms_sql` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-03/replicate-01`
- Pipeline state: LONGFORM_COMPLETE_PENDING_REVIEW; sections 5; words 3574
- Initial hard issues: 0; final unresolved issues: 0

### CORR-03 replica 2 — QUALITY_PASS

- Scenario/profile/model: `dbms_sql` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-03/replicate-02`
- Pipeline state: LONGFORM_COMPLETE_PENDING_REVIEW; sections 5; words 3566
- Initial hard issues: 0; final unresolved issues: 0

### CORR-04 replica 1 — QUALITY_PASS

- Scenario/profile/model: `excel` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-04/replicate-01`
- Pipeline state: LONGFORM_COMPLETE_PENDING_REVIEW; sections 5; words 3555
- Initial hard issues: 0; final unresolved issues: 0

### CORR-04 replica 2 — QUALITY_PASS

- Scenario/profile/model: `excel` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-04/replicate-02`
- Pipeline state: LONGFORM_COMPLETE_PENDING_REVIEW; sections 5; words 3588
- Initial hard issues: 0; final unresolved issues: 0

### CORR-05 replica 1 — ENVIRONMENT_BLOCKED

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-05/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-05 replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-05/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-06 replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-06/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### CORR-06 replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/outputs/operational-attempts/CORR-06/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

## Review state (not adjudicated)

No qualitative score, eligibility, profile status, default, or Domain Owner decision was assigned. SOURCE_FACT ≥95% remains a human review item; zero deterministic hits is not interpreted as 100% source fidelity.
C4/C5 completion and deterministic checks are technical evidence only. General domain claims and pedagogical proposals remain distinct and require appropriate human review.

## Persistence, guards, and manifest

- Manifest schema validation: **PASS** (`validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/artifacts/MANIFEST.json`).
- Secret leakage scan: **PASS**.
- Corpus/source guard scan: **PASS**.
- Historical attempts 01–09 changed: **NO** (verified against C6 fingerprint).
- Registry mutations: **0**; Gate D mutations: **0**.
- Domain Owner packet (JSON): `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/review/DOMAIN_OWNER_SIGNOFF_PACKET.json`; human-readable packet: `validation/work/C7/executions/gate-c-corrective-20261002T205103234849Z-ba4121a5/review/DOMAIN_OWNER_SIGNOFF_PACKET.md`.
- Packet decision intentionally unfilled. The immutable C6 packet schema only accepts a completed approve/amend/reject decision; this execution does not alter that schema or claim the unsigned template validates as signed evidence.

## Technical status

`C7_EXECUTION_PARTIAL_ENVIRONMENT_BLOCKED`. This verdict describes benchmark execution only; it does not establish model eligibility or authorize Gate D.
