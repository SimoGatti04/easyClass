# C7 Gate C Corrective Execution Report

**Execution ID:** `gate-c-corrective-20261002T165755866150Z-afe571f8`
**Verdict:** `C7_EXECUTION_PARTIAL_RUNNER_FAILURE`
**Execution root:** `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8`

## Frozen basis

- Freeze: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/execution-freeze.json` (SHA-256 `2b770d0a083a0a0c661518ae0bd1b7454710ce069ff1f931cb03060ffd42e334`)
- Matrix SHA-256: `30d9832266cdcef92ecee66a2e10101cef6729dbc877cd540694775f36b72665`
- Live preflight: `validation/work/C6/preflight/live-preflight-20261002T144901677041Z.json`; PASS / LIVE_CATALOG; corpus calls 0; historical attempts preserved.
- Execution-time catalog identity basis: `LIVE_CATALOG`
- Selected models: `agy/gemini-3.8-flash-tiered, groq/qwen/qwen3.8-27b`

## Execution counts

- Scheduled quality replicates: 12
- Completed quality replicates: 0
- QUALITY_PASS: 0
- QUALITY_FAIL: 0
- ENVIRONMENT_BLOCKED quality slots: 0
- RUNNER_FAILURE quality slots: 1
- AUTH_REQUIRED_TEACHER_SERVICE slots: 0
- Atomic inference calls: 0
- Bounded repair calls: 0
- Inference transport attempts: 0
- Catalog bootstrap attempts: 1

## Matrix results

| Task | Model | Scenario | Profile | Replicate 1 | Replicate 2 |
|---|---|---|---|---|---|
| CORR-01 | `agy/gemini-3.8-flash-tiered` | dbms_sql | `remote.generation` | RUNNER_FAILURE | NOT_RUN_STOPPED |
| CORR-02 | `agy/gemini-3.8-flash-tiered` | excel | `remote.generation` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |
| CORR-03 | `agy/gemini-3.8-flash-tiered` | dbms_sql | `remote.longform` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |
| CORR-04 | `agy/gemini-3.8-flash-tiered` | excel | `remote.longform` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |
| CORR-05 | `groq/qwen/qwen3.8-27b` | dbms_sql | `remote.generation` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |
| CORR-06 | `groq/qwen/qwen3.8-27b` | excel | `remote.generation` | NOT_RUN_STOPPED | NOT_RUN_STOPPED |

## Per-replicate deterministic evidence

### None replica 1 — RUNNER_FAILURE

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-01/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-01/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-02/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-02/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-03/replicate-01`
- Pipeline state: not available; sections 0; words not assembled
- Initial hard issues: not available; final unresolved issues: not available

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-03/replicate-02`
- Pipeline state: not available; sections 0; words not assembled
- Initial hard issues: not available; final unresolved issues: not available

### None replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-04/replicate-01`
- Pipeline state: not available; sections 0; words not assembled
- Initial hard issues: not available; final unresolved issues: not available

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.longform` / `agy/gemini-3.8-flash-tiered`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-04/replicate-02`
- Pipeline state: not available; sections 0; words not assembled
- Initial hard issues: not available; final unresolved issues: not available

### None replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-05/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `dbms_sql` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-05/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 1 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-06/replicate-01`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

### None replica 2 — NOT_RUN_STOPPED

- Scenario/profile/model: `excel` / `remote.generation` / `groq/qwen/qwen3.8-27b`
- Repairs: 0
- Attempt path: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/outputs/operational-attempts/CORR-06/replicate-02`
- Stage 1 schema/C2: not available / not available
- Stage 2 schema/C2: not available / not available
- Excel/source-specific validation: not available; hard issues 0; claims requiring review not quantified by available checker

## Review state (not adjudicated)

No qualitative score, eligibility, profile status, default, or Domain Owner decision was assigned. SOURCE_FACT ≥95% remains a human review item; zero deterministic hits is not interpreted as 100% source fidelity.
C4/C5 completion and deterministic checks are technical evidence only. General domain claims and pedagogical proposals remain distinct and require appropriate human review.

## Persistence, guards, and manifest

- Manifest schema validation: **PASS** (`validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/artifacts/MANIFEST.json`).
- Secret leakage scan: **PASS**.
- Corpus/source guard scan: **PASS**.
- Historical attempts 01–09 changed: **NO** (verified against C6 fingerprint).
- Registry mutations: **0**; Gate D mutations: **0**.
- Domain Owner packet (JSON): `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/review/DOMAIN_OWNER_SIGNOFF_PACKET.json`; human-readable packet: `validation/work/C7/executions/gate-c-corrective-20261002T165755866150Z-afe571f8/review/DOMAIN_OWNER_SIGNOFF_PACKET.md`.
- Packet decision intentionally unfilled. The immutable C6 packet schema only accepts a completed approve/amend/reject decision; this execution does not alter that schema or claim the unsigned template validates as signed evidence.

## Technical status

`C7_EXECUTION_PARTIAL_RUNNER_FAILURE`. This verdict describes benchmark execution only; it does not establish model eligibility or authorize Gate D.
