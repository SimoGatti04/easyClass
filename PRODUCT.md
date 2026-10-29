# Teacher Service — Product Context

## Product

Teacher Service R3 is a teacher-focused web application and MCP server for managing teaching context, versioned learning materials, assessments, and grading while preserving teacher control and source provenance. This reflects the repository overview and current local implementation; release status is tracked separately in `STATUS.md`.

## Platform and users

- **Platform:** web application with a teacher workspace, a student class portal, and an MCP server.
- **Teachers** organize classes, subjects, lessons, collections, and materials; prepare and monitor assessments; review submissions; and confirm final grading decisions.
- **Students** use the class portal to access eligible published materials and participate in PIN-gated digital activities.

The Domain Owner approved **Direction B — Operational Console** for the teacher workspace and **Direction A — Learning Studio** for a later student-portal redesign. Both are presentations of one shared design system; the student direction is not implemented by UX1.

## Core workflows currently represented

1. Manage classes, subjects, lessons, and collections.
2. Create and version teaching materials, and publish eligible student-facing versions.
3. Prepare assessment blueprints and monitor activity and student attempts.
4. Review submissions, consider deterministic or AI-assisted proposals, and record teacher-controlled final decisions.
5. Review integrity evidence with its stated limitations; an analysis is not itself a misconduct finding or sanction.

The teacher UI includes preparation, activities, student register, live monitoring, correction, concluded evaluations, and a feature-gated integrity review. See `README.md`, `STATUS.md`, `docs/dossiers/`, and the corresponding files under `client/src/components/` for implementation and domain detail.

## Product invariants

- Authentication alone does not grant teacher authority; teacher-only data requires an explicitly teacher-authorized principal.
- Student access to learning material is governed by publication eligibility and the published version, not by teacher-only material visibility.
- AI grading and integrity analysis are decision support; they do not replace the teacher's final grading decision or constitute an automatic misconduct finding.
- Production runs on K3s. UX1 is local-only and does not authorize changes to production, data, routing, or deployment.
