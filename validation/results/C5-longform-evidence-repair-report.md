# C5 — Longform Evidence Injection, Deterministic Section Validation, and Bounded Repair

**Verdict:** **PASS**  
**Scope:** C5 only; offline fake/replay backend; no real model-quality claim.

## Scope and non-goals

C5 adds longform evidence scoping, an injected deterministic section-validator port, and at most one issue-targeted repair per bounded section. It does not implement C6/C7, connect OmniRoute, conduct corrective benchmarking, alter registry/status, or begin Gate D. No historical Gate C output is rewritten.

## Preserved architecture

The canonical sequence remains **PLAN → 4–6 bounded sections → deterministic assembly → local checks → at most one bounded repair per section → L3 review**. There is no monolithic generation, extra planning layer, agent loop, multi-model debate, or global rewrite. A plan must complete technically with `finish_reason=stop`, parse strictly, and pass duration, contiguous coverage, count, and word-target validation before any section call. A failed/truncated plan produces zero section calls.

## Plan freeze, exact binding, and section requests

The frozen plan identity hashes the plan payload, versioned task contract, source-context hash, prompt-visible plan-evidence hash, canonical request hash, and validation result. Section request traces carry the exact `plan_id` and `plan_hash`, section index/spec, task/source context, selected prompt evidence, and target budget. T6 checks every section reference against the persisted frozen hash; assembly rejects a section set with a different hash, missing/extra IDs, or out-of-plan ordering.

## Evidence scoping and visibility

Plan evidence is optional and section packs are caller-selected independently. Model requests are built only from `EvidencePack.for_prompt()` (`PROMPT_VISIBLE`). Validators receive `for_validation()` (`PROMPT_VISIBLE` plus `VALIDATOR_ONLY`); `TEACHER_ONLY` is absent. Repair requests contain the exact affected section, structured issues, and the exact union of cited supporting evidence IDs—never the other sections or full canonical pack. Supplemental assertions verify the M3/M4 repair carries only its two cell facts, while the top-seller repair carries the derived ranking only, with no M3/M4 facts.

## Validator port and Excel fixture adapter

The core accepts an injected `SectionValidator` and a shared typed `SectionValidationResult`; it has no domain-specific fact-checking rules. The Excel-only fixture adapter uses C3 evidence: (1) M3 is the “Aliquota commissione” label and M4 is numeric 0.05 with a 0% format; (2) the ranking is computed by the C3 derivation, not hardcoded, and identifies Marco (about 89.32), ahead of Anna (about 86.33) and Sara (about 74.73). It detects the historically confirmed M3/M4 inversion and “Esatto, Sara!” claim. The validation rule is scoped to the selected section evidence.

Historical `deterministic_checker_hits=30` is preserved only as a diagnostic. It is not translated into factual issue count: the new evidence-backed pass reports two hard issues for the two confirmed claims and does not import old checker codes.

## Bounded repair, acceptance, and drift

Warnings alone never trigger repair. A hard issue triggers at most one call for its section. The initial response/validation, repair request/response/revalidation, decision, and selected final text remain separately serialized. A repair is selected only when the response is technically complete (`stop`, non-empty), all targeted issues resolve, no new hard issue appears, word limits still hold, and configured token-edit drift is within the task threshold. Failed repair preserves the initial text and unresolved issue; there is no second call. The Excel correction replays use minimal fake edits; they demonstrate the mechanism, not model capability. Synthetic cases reject persistent issues, newly introduced issues, and fixture-calibrated excessive rewrite drift.

## Deterministic assembly and L3 state

Assembly concatenates only selected section versions in frozen-plan order; it makes no model call and performs no rewrite. It enforces exact section IDs/order and plan-hash binding. Technical completion remains `LONGFORM_COMPLETE_PENDING_REVIEW` or `LONGFORM_COMPLETE_WITH_ISSUES`; final items remain `DRAFT`, `PENDING_L3_REVIEW`, human review required, not applied, and not published.

## Historical and orthogonal replays

| Replay | State | Fake backend calls | New hard issues | Repairs selected | Technical pass |
|---|---|---:|---:|---:|---|
| historical_dbms_structural | LONGFORM_COMPLETE_PENDING_REVIEW | 6 | 0 | 0 | True |
| historical_excel_detection | LONGFORM_COMPLETE_WITH_ISSUES | 6 | 2 | 0 | False |
| historical_excel_corrected_repair | LONGFORM_COMPLETE_PENDING_REVIEW | 8 | 0 | 2 | True |
| orthogonal_history_repair | LONGFORM_COMPLETE_PENDING_REVIEW | 6 | 0 | 1 | True |

The DBMS/SQL historical replay is structural only: plan parse/validation, ordered sections, and deterministic assembly. It does not claim to find every domain-knowledge defect. The Excel detection replay uses attempt-07 initial sections; its corrected replay applies the two minimal fixture corrections. The orthogonal history fixture uses the same core/validator result and repair path to correct the evidence-backed year 1765 → 1764, with a 45-minute task contract. This demonstrates duration and word budgets are task-configurable rather than universally fixed.

## Source attribution and genericity

Prompt instructions distinguish `SOURCE_FACT`, `GENERAL_DOMAIN_KNOWLEDGE`, `PEDAGOGICAL_PROPOSAL`, and expected/example classroom responses; hypothetical student speech is explicitly framed as possible/expected, never observed. The core genericity and provider-neutrality scans pass. Domain-specific terms and rules exist only in the Excel/history fixture adapters, not in the core. DBMS replay uses no spreadsheet evidence provider.

## Regression test matrix

| T1 | Longform contract canonical roundtrip | PASS |
| T2 | Deterministic plan request hash | PASS |
| T3 | Plan truncation blocks sections | PASS |
| T4 | Invalid plan blocks sections | PASS |
| T5 | Frozen plan hash stable | PASS |
| T6 | Every section bound to exact frozen plan hash | PASS |
| T7 | PROMPT_VISIBLE reaches section request | PASS |
| T8 | VALIDATOR_ONLY absent from model request | PASS |
| T9 | VALIDATOR_ONLY available to validator | PASS |
| T10 | TEACHER_ONLY absent from model and validator | PASS |
| T11 | Normal section pass | PASS |
| T12 | Section truncation fails closed | PASS |
| T13 | Hard issue triggers one bounded repair | PASS |
| T14 | Warning alone does not trigger repair | PASS |
| T15 | Repair limited to target section | PASS |
| T16 | Repair evidence limited to supporting IDs | PASS |
| T17 | Successful repair is revalidated | PASS |
| T18 | Failed repair gets no second attempt | PASS |
| T19 | New hard issue rejects repair | PASS |
| T20 | Excessive repair drift rejected | PASS |
| T21 | Initial section preserved | PASS |
| T22 | Assembly follows plan order | PASS |
| T23 | Foreign plan binding rejected | PASS |
| T24 | Unresolved issue blocks technical pass | PASS |
| T25 | Historical DBMS structural replay | PASS |
| T26 | Historical Excel issues detected with evidence | PASS |
| T27 | Historical checker hits not promoted automatically | PASS |
| T28 | Corrected Excel local repair replay | PASS |
| T29 | Orthogonal domain full pipeline | PASS |
| T30 | Orthogonal domain evidence-backed repair | PASS |
| T31 | Duration is configurable | PASS |
| T32 | Total word budget is configurable | PASS |
| T33 | Source attribution contract included | PASS |
| T34 | Core has no domain-specific branches | PASS |
| T35 | Core is provider-neutral | PASS |
| T36 | Network access blocked | PASS |
| T37 | No credential-read path | PASS |
| T38 | Deterministic hashes and replay | PASS |
| T39 | Final artifact is DRAFT / L3 pending | PASS |
| T40 | No apply/publish side effect | PASS |
| T41 | C2 complete regression suite (17/17) | PASS |
| T42 | C3 complete regression suite (38/38) | PASS |
| T43 | C4 complete regression suite (42/42) | PASS |

The C5 suite contains 43 tests: T1–T40 plus three supplemental checks for provenance-hash sensitivity, exact M3/M4 repair isolation, and minimal seller-ranking repair evidence. C2/C3/C4 complete local unit-test suites were rerun without invoking their artifact-generating runners.

## Source hashes

Pinned source-file hashes and the C3-pinned input checks:

- `longform_core`: `09f2467e4f85ad29dea2069a7f0fd80ea1bb3c503236790ad73b3fe1d3db56a9`
- `evidence_core`: `0de76230cd0e58b7846a52e0d5f5873de3adca3a84d7ee9b1d210be4c3dbb62c`
- `spreadsheet_evidence_adapter`: `52d5f92c79c64010bb1e5faa8031577920d2626c1623a29483bcda26febe6e6a`
- `excel_validator`: `973207482c31c9714a46b96873c28740f4665903c8ea5cca4f8430b16c78d43d`
- `c5_scenario`: `15b36322b6794784a7d81ce0b9326e56d15f021db2150885fd91a2f45850b9a4`
- `c5_tests`: `85899816b5454970ed84af44a549bbb0dfda03ca35cc4a2f216541c724dbcdd0`
- `c5_runner`: `68013aa96223c61232ea81fea8f6403685bdaa270581b77f9a5945eccbf5904b`
- `c3_scenario`: `c6000e46b9ceef89ee01e9c00fbbd74d4e389e7d0333c545ff47a481cfe16048`
- `c3_benchmark_config`: `d177df94a3e52c3ee49264cc913e11354e24aed70fd4264aea96a2f0618ba418`
- `excel_demo_workbook`: `fb8a07d2bfc17839bf8cb3aa9955b36e12c7f4cbb9dfab620d38e05e60bd42b7`
- `excel_ast_projection_file`: `e3c0a67333178ab633fc416ac45a83c58310cafcc4d47cc9c2591528256d52ed`
- `excel_scenario_source`: `224091bf6e6867be20dbc59838e4b194e61a15f0ec60f73dda379593a80ce414`

Workbook SHA and scenario-source SHA were checked against the existing C3 benchmark config; projection/provider checks were exercised by the C3 evidence test suite. The held-out `excel_teacher.md` was not used.

## Historical preservation and offline safety

- Attempt-07 files inventoried: **177**.
- Before/after inventory hash match: **True**; original evidence remains untouched.
- Remote/provider/socket calls: **0**; corpus sent: **false**.
- Credential reads: **0**; runtime config and secret files are not loaded.
- Apply/publish side effects: **0**; C6 started: **false**.

## Limitations

- All section generation and repairs use fake local backends; this is not evidence of any model’s output quality, provider compliance, latency, or reliability.
- The Excel validator is intentionally scenario-local and pattern-bounded; it is not a universal spreadsheet fact checker.
- The orthogonal history validator is a synthetic source-text fixture, not a production text extraction system.
- Deterministic rules detect only declared, evidence-backed issue classes. General-domain accuracy, pedagogy, and other factual claims still require qualified human/domain review.
- Token edit ratio detects configured lexical rewrite drift; it is not semantic similarity.

## C5 verdict

**C5 = PASS.** The canonical pipeline is preserved, section-specific evidence and validator visibility are enforced, the two confirmed Excel issues are detected and can be locally repaired with bounded evidence, failed/drifting repairs do not pass silently, DBMS structural and orthogonal-domain replays pass, C2/C3/C4 regressions are recorded, and no network or credential access occurred. **C6 remains unstarted and requires separate review.**

## Repair Visibility Boundary Correction — 2026-10-01

**Execution date:** October 1, 2026. The requested heading date, October 2, 2026, is the following day; this addendum uses the actual execution date rather than a future date.

### Bug and risk

The original repair builder selected supporting evidence from `pack.for_validation()` and serialized `SectionIssue.to_dict()`. As a result, validator-only records could cross into a model request, and the validator-authored `message` could disclose information derived from them. This violated the C3 visibility contract even though plan/section requests already used the prompt-scoped view.

### Correction

- Validation remains unchanged: `SectionValidator` receives `pack.for_validation()` (`PROMPT_VISIBLE` + `VALIDATOR_ONLY`); `TEACHER_ONLY` is excluded.
- All model request builders—plan, section, and repair—are statically checked to source evidence only through `for_prompt()`.
- Repair evidence now comes only from the section pack's `for_prompt()` view. If any evidence ID required by any hard issue is outside that view, the whole section repair is blocked; there is no partial-evidence repair or automatic visibility promotion.
- The blocked outcome is explicit: `RepairDecision.reason=REPAIR_BLOCKED_BY_EVIDENCE_VISIBILITY`, `attempted=false`, and section state `SECTION_REPAIR_BLOCKED_BY_EVIDENCE_VISIBILITY`. The initial text and full validator audit remain local and intact; the final longform retains the issue and becomes `LONGFORM_COMPLETE_WITH_ISSUES` when otherwise complete.
- `SectionIssue.to_dict()` remains the full local audit form. A separate repair-safe representation contains only a safe issue ID, issue code, offending span, and prompt-visible supporting IDs; it omits `message`. The repair instruction asks the model to use only the supplied prompt-visible evidence and does not disclose a validator-derived answer.

### Regression evidence

| Case | Result |
|---|---|
| Prompt-visible supporting evidence reaches repair | PASS |
| Validator-only evidence blocks repair and message does not leak | PASS |
| Mixed prompt-visible/validator-only evidence fails closed | PASS |
| Model request builders use prompt view only | PASS |
| Excel evidence remains explicitly prompt-visible | PASS |
| Orthogonal visible-evidence repair passes | PASS |
| Orthogonal validator-only evidence blocks repair | PASS |

The dedicated `SECRET-7429` test confirms that the validator audit retains the private message and evidence ID while no repair call is made and neither value occurs in serialized model requests. A mixed visible/hidden evidence requirement blocks the entire repair. Historical Excel M3/M4 and Marco/Sara repairs continue to pass because the Teacher Script caller explicitly marks those scoped facts `PROMPT_VISIBLE`; the core applies no visibility override. The history fixture passes with visible evidence and blocks the validator-only 1764 fact without leaking it.

| Regression suite | Passed | Result |
|---|---:|---|
| C2 | 17/17 | PASS |
| C3 | 38/38 | PASS |
| C4 | 42/42 | PASS |

Updated C5 tests: **48/48**. Network/provider calls: **0**; credential reads: **0**; corpus sent: **false**. The original C5 PASS remains historical evidence of the earlier implementation, but its repair-visibility claim required this correction before any remote integration. C6 remains unstarted.
