---
target: Teacher Service dashboard
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:~/Workspace/teacher-service-design/Teacher Service dashboard"
timestamp: 2026-10-28T19-15-46Z
slug: teacher-service-dashboard
---
# UX1 — Teacher Service dashboard critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Active location, counts, loading/error and retry states are available; no update timestamp. |
| 2 | Match System / Real World | 3/4 | Teaching vocabulary and class/subject/lesson context fit; activity/delivery/evaluation units still need care. |
| 3 | User Control and Freedom | 3/4 | Refresh, retry, correction and monitoring actions exist; cancellation was not exercised. |
| 4 | Consistency and Standards | 3/4 | Grouped nav and queue rows are consistent; the same activity appears in two queues for distinct actions. |
| 5 | Error Prevention | 3/4 | Actions are labeled and contextual; create/refresh can compete with attention actions. |
| 6 | Recognition Rather Than Recall | 3/4 | Queue rows include class, subject and lesson, and counts have explicit units. |
| 7 | Flexibility and Efficiency | 2/4 | Seven destinations remain in top navigation; no dashboard-level class filter or explicit priority. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Calm, legible operational layout; still resembles a conventional admin console. |
| 9 | Error Recovery | 3/4 | Dashboard and context failures expose retry paths; error states were tested but are absent from static captures. |
| 10 | Help and Documentation | 2/4 | Brief count explanations exist, but workflow terms have no persistent contextual help. |
| **Total** | | **28/40 — Good** | Solid foundation with focused refinements remaining. |

## Design Specificity Verdict

**LLM assessment:** The structure is workflow-specific: teaching context, correction queue and monitoring actions make it recognizable as Teacher Service. The navy/slate presentation, dividers and outlined buttons remain visually conventional and not yet strongly distinctive. The approved B direction is clear in information architecture, less in visual character.

**Deterministic scan:** 8 `side-tab` warnings in `client/app.css`; 7 are outside the overview route, and one at `.teacher-overview-context-warning` is an intentional error/context treatment. No findings in `TeacherArea.js` or `TeacherOverviewView.js`. The detector matches were verified in source; route-scope findings are not evidence of defects on the dashboard. No user-visible overlay was injected.

## Overall Impression

This is a substantial improvement over UX0: the teacher can identify work categories and their units more reliably. The largest remaining opportunity is to make the next action and mobile navigation unmistakable without adding urgency or counts unsupported by the backend.

## What’s Working

- KPI labels now state whether they count activities, submissions or evaluations.
- Queue entries carry class, subject and lesson context and offer direct “Correggi” or “Monitora” actions.
- Empty, loading, total-error and partial-context states are explicit; retry recovery is covered by the synthetic browser test.

## Priority Issues

1. **[P1] Active activities can have zero questions.** Not reproduced in UX1’s synthetic fixture (the sampled active activity has 2 questions), but `updateAssessment` appears to allow transition to `active` without checking question count (`src/services/assessment-service.js:339–370`). This is a functional/domain risk outside UX1 and must not be disguised as a frontend issue.
2. **[P2] Mobile navigation is clipped without a clear scroll cue.** At 768/390px, later destinations are not all visible. Add an affordance or compact navigation treatment.
3. **[P2] Same activity is repeated across correction and monitoring queues.** These are distinct actions, but grouping them under one activity could reduce repetition.
4. **[P2] Next action remains visually less decisive than create/refresh.** Emphasize existing work when present without inventing deadline or priority data.
5. **[P2] Potential N+1 detail requests in `ActivitiesView.js`.** Missing `itemCount` on active activities triggers one detail request per row; consider a later API count/batch contract rather than hiding unknown data.

## Persona Red Flags

- **Impatient teacher:** may need to scan competing queue/CTA elements before choosing the next action.
- **Mobile student:** student portal direction A is documented but was not redesigned or re-audited in UX1.
- **Accessibility-dependent user:** native controls, visible focus and a 12-control Tab walkthrough were checked; screen-reader behavior and reduced-motion preference remain unverified.

## Minor Observations

- Explanatory count copy is accurate but dense on a narrow screen.
- Existing student timer pulse styles lack a `prefers-reduced-motion` alternative.
- The browser tab title remains the generic English string “Teacher Service — Tomorrow is ready.”
- The current synthetic delivery/row discrepancy was not reproduced; the copy now explains the different counting grains.

## Questions to Consider

1. For UX2, should mobile navigation and queue synthesis come before the class → lesson → material → publication journey?
2. Should the double appearance of an activity be consolidated while preserving both correction and monitoring actions?
