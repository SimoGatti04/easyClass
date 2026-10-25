# C7B-R3 — Public Class Portal & Shared-Class PIN

**Decision source:** Domain Owner's final C7B-R3 request, 25 October 2026.
**State:** local implementation and verification only; no production release or edge change was performed.

## CURRENT / DEPRECATED / PLANNED

- **CURRENT (source tree):** public class directory; public, published-material reading; a per-class shared four-digit activity PIN; class-scoped browser access sessions; declarative student-name selection immediately before an activity; separate attempt tokens; server-side autosave and submission recovery.
- **CURRENT (production):** the previously observed T1/K3s state remains unchanged. C7B-R3 code, schema additions, PIN secret, public routing, and the class portal are **not deployed or live-verified** by this checkpoint.
- **DEPRECATED:** issuing or redeeming individual six-character student codes and QR-based student access. The legacy credential table is retained additively for historical compatibility; its issuance/redeem routes are disabled.
- **PLANNED:** Cloudflare path-scoped public/student and protected/teacher rollout; secret provisioning through the existing Infisical/External Secrets path; supervised C7B release, migration, rollback, and production smoke test. This document is not authorization to perform them.

## HTTP surface and authorization matrix

| Surface | Route family | Application requirement | Edge requirement / status |
|---|---|---|---|
| Public entry | `GET /`, `GET /studente`, `GET /studente/**` | Public SPA shell; student view never renders teacher data | Public route is proposed; live Cloudflare path policy is **NOT VERIFIED** |
| Public class directory | `GET /api/student/classes`, `GET /api/student/classes/:classId` | Anonymous; returns only class selection metadata | Must remain outside teacher Access policy; not live-verified |
| Public materials | `GET /api/student/classes/:classId/materials` and `/materials/:materialId/versions/:version[/download|/preview]` | Anonymous; `MaterialService` returns only explicitly published, currently available versions and safe fields | Must remain public; private CRUD/export routes remain protected |
| PIN redemption | `POST /api/student/classes/:classId/access` | Four-digit shared class PIN, rate-limited; sets an HttpOnly class-navigation cookie; does not disclose a roster or activity list on failure | Public edge path; app session required for subsequent activity access |
| Activity directory and roster | `GET /api/student/classes/:classId/activities`, `/activities/:activityId/students`, `/activities/:activityId/neighbors` | Valid non-revoked class session; only active/enabled activities in that class; full roster appears only in the pre-start selection flow | Public edge path, application session mandatory |
| Attempt start and student work | `POST /api/student/classes/:classId/activities/:activityId/start`; `/api/student/activities/:assessmentId/**` | Start requires class session and declared same-class student. Work APIs require the attempt bearer bound to that assessment/student; monotonic revisions, timer and submitted-state checks remain server-side | Public edge path, attempt session mandatory |
| Teacher and administrative APIs | `/api/**` except explicitly public `/api/student/**` | Cloudflare Access assertion plus explicit teacher-principal authorization; fail closed | Must remain protected; route policy must explicitly avoid broad bypasses |
| MCP | `https://mcp-teacher.simogatti.it/mcp` | Existing authenticated MCP/teacher-principal checks | Domain and integration must remain unchanged |

The old unscoped student roster endpoint is intentionally unavailable. No class name, activity title/ID, roster, teacher solution, private material, or unpublished version is returned to an anonymous activity caller.

## PIN, session, and recovery contract

1. A teacher-authorized REST or MCP operation creates/rotates or revokes one active PIN per class. The code is server-generated using cryptographic randomness, exactly four digits (leading zeros preserved), stored as a class-bound HMAC, and returned in cleartext only in the generation response. Status reads never reveal it. The configured HMAC secret must be stable and at least 32 bytes; absent/short configuration fails closed.
2. The PIN has no automatic expiration. Redemption creates a 12-hour class-navigation session in an HttpOnly cookie. PIN rotation/revocation invalidates class-navigation sessions and prevents new entry; it does not revoke already-issued attempt tokens, delete work, or reset timers.
3. Before start, the client declares the roster name and seat/neighbors. This is intentionally declarative identity, not strong authentication. Server checks still bind the selected student, class, activity and attempt.
4. A repeated start for the same class/activity/student returns the existing attempt rather than creating a second submission. Following loss of an attempt token, the student can redeem the current class PIN, select the same activity/name, and recover the server submission. A newly issued attempt token is bound to that same submission.
5. IndexedDB drafts are keyed by class + declared student + assessment, not by bearer token. This permits same-device recovery after token renewal without attaching a draft to a different selected student. It is local best-effort recovery only; unsaved data on a lost device is not recoverable. The cache never stores the bearer token.
6. Definitive submission remains immutable until explicit, audited teacher reopening. PIN rotation does not reopen or alter a submitted attempt.

## Schema and T1 rollback impact

The migration is additive. The legacy personal-credential table and existing submission/material data are preserved. The new PIN/session tables and nullable `student_attempt_sessions.class_session_id` reference are added without reinterpreting an existing attempt's assessment version. The application rejects starting a new attempt against a changed assessment version after an attempt has begun.

The prior T1 binary does not implement shared-class PIN entry. Reverting only the image preserves SQLite rows and files, but students cannot resume C7B-R3-created attempts through the old individual-code flow. Do not delete the new tables, migrate data backwards, or restore an older database as an automatic rollback. Before C7B, P2 must add an explicit tested decision for in-flight attempts: close/restrict new starts, preserve the database and new submissions, revert the application only if needed, and return to a compatible release only after those attempts are retained/reviewed. Test binary rollback against an isolated copy containing synthetic post-upgrade attempts.

Before release, add the stable secret key `TEACHER_SERVICE_CLASS_PIN_SECRET` through the existing Infisical → External Secrets Operator → Kubernetes Secret path. Do not place the value in Git, ConfigMaps, logs, or command output. The live secret mapping/value and Cloudflare rules were not inspected or changed in R3; verify presence without revealing the value during the separately authorized preflight.

## C7B-P2 and access-policy prerequisites

- Add a migration preflight that confirms the existing class database is backed up through the already approved operational procedure, checks the additive schema on a synthetic copy, and records the exact application image/schema compatibility pair.
- Add a smoke test for public `/`, `/studente/**`, class list/materials, and PIN redemption, plus negative checks that `/docente/**`, administrative APIs, teacher materials, unpublished resources, and MCP teacher operations remain protected.
- Compare the declared Terraform/Cloudflare path scopes with the live configuration under read-only access. Keep `/`, `/studente*`, public class/material reads, and authenticated student session/activity endpoints public at the edge, while protecting `/docente*` and administrative APIs. Never add a global Access bypass; preserve MCP hostname/policy.
- Verify trusted client-IP behavior through the actual proxy chain before adjusting the PIN limiter. Application code ignores forwarding headers unless the immediate peer matches an explicitly configured trusted proxy CIDR. Do not use a client-supplied IP header as limiter identity.
- Verify the stable class PIN HMAC secret is present and does not change across restarts/replicas. A missing secret produces 503 by design.
- Execute only under the separate C7B authorization: rollout, smoke tests, monitoring, and the tested rollback choice for in-progress attempts. No such action is authorized by this R3 checkpoint.

## Verification record

Exact local suites and outcomes are recorded in `STATUS.md` and the R3 addendum in `docs/c7b-release-go-no-go.md`. All R3 fixtures use synthetic students/materials and isolated SQLite/FileStore. Production Cloudflare, K3s, PVCs, ChatGPT remote MCP, and production data recovery are outside this verification and remain **NOT VERIFIED**.

## C7B-R3 implementation and verification checkpoint (25 October 2026)

### Delivered in the local source tree

- Public homepage/class directory and class detail navigation use real HTTP paths. Class-material reading is anonymous and limited to explicitly published, currently available material versions; downloads/readers use the existing material service and sanitize rendered Markdown.
- Each class has one teacher-managed four-digit PIN, generated with cryptographic randomness and retained as a class-bound HMAC. The PIN is not automatically expired, is revealed only when generated, and has teacher-only create/rotate/revoke operations. Rate limits account for shared NAT and do not trust caller-forged forwarding headers from untrusted direct peers.
- A successful PIN redemption grants a class-scoped HttpOnly navigation session. Activity listings, pre-start roster and neighbors require that session. Start creates/resumes the separate bearer attempt token. PIN rotation/revocation prevents new navigation, but leaves started attempts, saved responses, attachments, submissions and server timer intact.
- The student picks an activity and then declares their roster name and seat/neighbors. This is the Domain Owner-approved lightweight declaration, not strong identity proof. There are no student accounts, individual PINs, one-time personal codes or QR flows. Historical credential schema remains additive; legacy issuance/redeem endpoints are retired.
- Client recovery keeps server attempt data authoritative and indexes local drafts by class, declared student and activity, not bearer token. A token change cannot silently attach a cached draft to a different selected student.

### Verification executed

- `pnpm test`: **34 suites passed, 0 failed**. This includes the complete student HTTP/API, class portal, rate-limit, routing, MCP, T1, migration, and isolated persistence suites.
- `pnpm test:browser:c4`: **PASS**; two browser students, published material read, shared PIN, response saving, offline recovery, attachments, timer and submission.
- `pnpm test:browser:c5`: **PASS**; teacher creates/activates an activity, generates the shared PIN through the dashboard roster UI, two independent student browser contexts enter, and the existing monitor/correction/export flow completes.
- `pnpm test:browser:c6`: **PASS**; C6 browser regression.
- `pnpm test:browser:c7a`: **PASS**; one assessment and one isolated application/database/FileStore flow observed through teacher UI/API, two student sessions, grading/export, MCP and C6 review.
- `node --test tests/browser/t1-browser.test.js`: **PASS**; existing T1 React bundle workflow.
- `pnpm run build:client`: **PASS**, also rebuilt by the browser scripts.

All test data used local temporary SQLite/FileStore instances and synthetic identities/material. The first full-suite attempt caught one legacy timer-test fixture that no longer supplied the mandatory published source grounding; after correcting the fixture to reference the exact published synthetic material version, the complete suite passed. No student or production data was accessed.

### Edge/IaC comparison (read-only)

The local Cloudflare Access declaration currently represents the `class` host with an empty `primary_path` and an empty destination path, i.e. a host-wide application. The pinned Terraform provider is `cloudflare/cloudflare` `5.24.0`; its `cloudflare_zero_trust_access_application` supports a hostname plus path in `domain`, and public destination URIs can include paths and wildcards. Cloudflare documents path-scoped self-hosted applications and states that the most-specific path takes precedence without inheriting the less-specific path's policy. Thus the provider can express the desired separation, but the current declaration does not: a future IaC change and reviewed saved plan are required. It must explicitly leave `/` and `/studente/**` public, leave only the intended `/api/student/**` surface public, protect `/docente/**` and teacher REST/API management paths, preserve the MCP hostname/path, and define unmatched management paths as protected/denied; do not add a host-wide public bypass. The current declaration is therefore **not compatible as-is** with R3's desired public/student vs protected/teacher boundary. This was a source review only: no Cloudflare live read, Terraform apply, DNS/Tunnel change or production route test was performed. The `infra/main` working tree had pre-existing OmniRoute changes; it was not modified. Consulted official references: Cloudflare One *Application paths* and Terraform Registry `cloudflare_zero_trust_access_application` for provider 5.24.0 (reviewed 25 October 2026).

### Current release decision

- **Software readiness:** **PASS — locally verified on synthetic fixtures**, including direct `/docente` and `/studente` browser navigation. This does not establish live Cloudflare behavior or remote ChatGPT connectivity.
- **Infrastructure readiness:** **BLOCKED / NOT VERIFIED** — path-scoped Access policy and its edge precedence are not implemented/live-verified; presence of `TEACHER_SERVICE_CLASS_PIN_SECRET` in the production Infisical/ESO path was not inspected; no production backup/restore or rollback after R3 schema/data has been executed.
- **Overall:** **NO-GO; C7B remains blocked and unauthorized.** Do not deploy until a separately authorized IaC/edge checkpoint, secret-presence check, data recovery gate, and production migration/rollback plan are validated. In particular, rolling back to the old T1 image cannot restore access to attempts started under the shared-PIN flow; preserve the upgraded SQLite/FileStore and do not auto-restore or delete them.
