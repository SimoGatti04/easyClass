---
target: Teacher Service dashboard
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:~/Workspace/teacher-service-design/client/src/components/TeacherArea.js"
target_fingerprint: "sha256:6f403f83c9c9d09fd3974b1b3179798e77859c30568b54f52f870745a98ee221"
target_path: ~/Workspace/teacher-service-design/client/src/components/TeacherArea.js
timestamp: 2026-10-28T12-18-42Z
slug: client-src-components-teacherarea-js
---
# UX0 — Teacher Service UI/UX critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | The active tab, counts, and queues are visible; freshness of dashboard counts is not. |
| 2 | Match system / real world | 3/4 | Teacher terminology is mostly familiar; KPI units are not always explicit. |
| 3 | User control and freedom | 3/4 | Navigation and exit are clear; cancellation was not exercised. |
| 4 | Consistency and standards | 3/4 | Sections are structured, though icon families and surface treatments vary. |
| 5 | Error prevention | 3/4 | The distinction between proposals and final grades is explicit. |
| 6 | Recognition rather than recall | 2/4 | Some counts lack a clear unit and queue items omit class/due context. |
| 7 | Flexibility and efficiency | 3/4 | Contextual Monitor and Correct actions help; overview lacks filters or refresh. |
| 8 | Aesthetic and minimalist design | 2/4 | The page is orderly, but KPI text is compressed and lower space is underused. |
| 9 | Error recovery | 2/4 | Error copy exists in code; no visible retry path in the overview. |
| 10 | Help and documentation | 1/4 | No contextual help is visible in the overview. |
| **Total** | | **25/40** | **Intermediate** |

## Design Specificity Verdict

Specificity is medium. The teacher workflow queues and the explicit distinction between grading proposals and confirmed grades are product-specific. The dark header, blue CTA, and KPI-card dashboard are generic administrative patterns. The existing navy/blue/light-surface foundation is recoverable; a complete redesign is not justified by this audit.

The deterministic `impeccable detect --json client/src` scan returned exit code 0 and JSON `[]`. It did not flag the KPI layout issue observed in Chrome. No false positives were reported. Browser overlay injection was unavailable because documented browser evaluation is read-only; no script was injected and no Impeccable live server was started.

## Priority Issues

1. **[P1] KPI hierarchy and unit ambiguity.** Labels, values, and helper text are visually adjacent; the same shared metric pattern affects the overview and live-monitor metrics. This makes counts harder to interpret during rapid scanning. Separate label/value/helper into a stable vertical hierarchy and state whether each number counts assessments, submissions, or grades.
2. **[P1] Dashboard does not yet organize the teacher's day.** “Panoramica verifiche” prioritizes assessment lifecycle, while the next lesson, material readiness, class context, and due work are not surfaced as the primary action queue. Make the first action context-dependent and bring the nearest teaching task into view.
3. **[P1, preview-only] Count/state inconsistency.** In the synthetic preview, correction summary counts one submission while two rows are displayed; an active assessment is also shown with zero questions. Confirm fixture and domain invariants before changing UI or inferring production behavior.
4. **[P2] Navigation presents seven destinations without a clear priority.** Grouping softens the choice, but preparation, activities, live monitoring, grading, and completed results compete at the same level. Consolidate the assessment lifecycle and define URL/Back/refresh behavior.
5. **[P2] Preparation context and publication state need clarification.** The teacher shell branding repeats inside lesson preparation; “saved” does not clearly communicate whether student visibility is already active. Keep class/subject/lesson context while removing duplicate branding and expose the existing publication state/preview semantics.

## Persona Red Flags

- **Time-pressed teacher:** sees correction and live queues, but lacks due/age indicators and an explicit next action.
- **Teacher with multiple classes:** a row identified mainly by activity title could be ambiguous if titles repeat; this is a conditional risk, not demonstrated by the one-class fixture.
- **First-time teacher:** no contextual help is visible; the proposal-vs-final-grade note is a useful reassurance.

## Minor Observations

- Emoji, Unicode glyphs, and monochrome symbols are mixed, though text labels preserve comprehension.
- “Teacher Service / Area docente” branding is repeated in the preparation surface.
- Student class selection, published materials, and PIN-gated activities are clearly separated in the observed desktop flow; mobile behavior remains unverified.
- Loading/error/empty states were not forced in the browser; the overview error path has no visible retry action in the inspected code.

## Questions to Consider

- Which should lead when a correction is pending and a lesson is imminent?
- Should every metric state whether it counts assessments, submissions, or grades?
- Does “saved” differ from “published to students,” and how should that distinction appear?
- Should the assessment lifecycle be one top-level destination with clear subviews?
