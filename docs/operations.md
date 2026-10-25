# Teacher Service — Production Operations (K3s)

**Scope:** production runtime only. The production source of truth is the
K3s app bundle in `infra/k3s/apps/class/`; this document does not describe the
retired Mac mini/PM2 deployment.

## Current architecture

- One Teacher Service Deployment (`class/class`) serves `https://class.simogatti.it`
  and the Streamable HTTP MCP route `https://mcp-teacher.simogatti.it/mcp`.
- The existing Cloudflare Access/Tunnel and hostnames are unchanged by this
  application runbook. Do not edit Cloudflare or expose a new ingress here.
- The app image is selected by an immutable GHCR tag in `app.yaml`; the
  deployment uses the `class` Service and HTTPRoutes in the same bundle.
- SQLite is stored on the node-local `class-teacher-db` PVC at
  `/srv/class/teacher-service/db`. FileStore is stored separately on
  `class-teacher-files` at `/srv/class/teacher-service/files`. Both are
  authoritative production data and must be preserved during application or
  legacy-resource cleanup.
- Runtime secrets flow from Infisical through External Secrets Operator to
  `class/class-secrets`. Non-secret runtime settings are in `class-config`.
  The Teacher Service OmniRoute key must use the dedicated
  `/teacher-service/prod/TEACHER_SERVICE_OMNIROUTE_API_KEY` path once that
  source is provisioned and verified; never fall back silently to portal
  credentials. Secret values must not be printed or committed.
- OmniRoute is reached through the in-cluster Service DNS endpoint configured
  in `class-config`.

## Deployment

1. Build and validate the application image with the repository Dockerfile.
   The build installs the exact pnpm version declared in `package.json` and
   uses `pnpm-lock.yaml` with `--frozen-lockfile`.
2. Push the image to the approved GHCR repository under a new immutable tag;
   do not use a moving tag in K3s manifests.
3. Update only the image tag in `infra/k3s/apps/class/app.yaml`, after the
   application and image have been reviewed.
4. From the infra repository/worktree, validate the bundle and apply it with
   the repository wrapper:

   ```bash
   kubectl kustomize k3s/apps/class
   make k-apply APP=class
   make k ARGS='-n class rollout status deployment/class'
   make k ARGS='-n class get deployment,pod,svc,pvc,httproute -o wide'
   ```

   Use the infra repository's `make k`/`make k-apply` wrappers; do not use a
   local kubectl context. Confirm both application health and the protected
   data PVCs after rollout. Do not include secret values in diagnostic output.

## Rollback

- Restore the previous reviewed immutable image tag in `app.yaml` and apply
  the class bundle again using `make k-apply APP=class`.
- Wait for `deployment/class` rollout completion and verify `/health`, the
  Service/HTTPRoutes, SQLite integrity, and FileStore access.
- A direct `rollout undo` is an emergency-only temporary action: reconcile the
  resulting image back into the manifest immediately. Do not roll back storage
  deletion or database/filesystem data changes by applying old manifests.

## Persistent data and recovery risk

The `class-teacher-db` and `class-teacher-files` PVCs and their node-local
folders are production data. They are deliberately retained. **Independent
backup to separate storage is deferred by Domain Owner direction.** Therefore
SQLite and FileStore currently share the failure domain of `<backup-host>` and
its local storage. PVC retention is not a backup and does not protect against
node/disk loss, corruption, or accidental deletion. No new backup system is
part of this checkpoint.

The former portal-classi PostgreSQL database, uploads, and SQL dump are not a
Teacher Service recovery mechanism and are retired only after their pod and
volume consumers are detached and verified absent.

## Snapshot, restore and schema rollback

### CURRENT — source-code capability, isolated proof only

The repository now provides `bin/teacher-service-store-snapshot.js` for
SQLite + FileStore snapshots. `create` uses SQLite `VACUUM INTO`, copies the
FileStore tree, writes a SHA-256 inventory, and checks SQLite integrity and
foreign keys. `verify` checks the manifest, database hash/integrity, and every
stored file. `restore` validates the snapshot and restores only to **new,
non-existing** database and FileStore targets; it never overwrites or merges.
The database and FileStore are not one transactional storage system: all
application writers must be quiesced before `create`, so the two copies
represent one application state.

An isolated synthetic T1/C6 fixture has been snapshotted and restored through
the CLI. The restored SQLite database retained both versions of the material,
passed `integrity_check` and `foreign_key_check`, and the restored attachment
matched its original bytes. This proves the local procedure on a fixture only.
The production image has not been rebuilt with this code. **No production
snapshot or restore has been run, and no production PVC has been read.**

### PLANNED — production procedure, requires separate authorization

Before any production operation, the Domain Owner must approve the maintenance
window, destination path, retention, free-space check and operator. Independent
backup storage remains deferred; no destination has been selected or proven to
survive `<backup-host>`/node-local storage loss. A snapshot on the existing node
would help with application/schema rollback but would not be an independent
backup. Do not create one in this checkpoint.

After the procedure is authorized and the CLI is included in a reviewed image:

1. Quiesce all REST, MCP and background writers; confirm no active upload or
   generation operation. Keep the original PVC contents untouched.
2. Mount the existing database and FileStore read-only into the approved
   maintenance context and provide a separate, pre-authorized snapshot target
   that is outside both source paths. The snapshot target must not be ephemeral
   if the result is expected to survive a pod restart.
3. Run the commands from the reviewed Teacher Service source/image, substituting
   only operator-verified paths:

   ```bash
   node bin/teacher-service-store-snapshot.js create \
     "$DB_PATH" "$FILESTORE_PATH" "$SNAPSHOT_DIR"
   node bin/teacher-service-store-snapshot.js verify "$SNAPSHOT_DIR"
   ```

4. Preserve the complete snapshot directory as one unit. Do not copy only the
   SQLite file: material history, provenance, submissions and attachments are
   split between SQLite and FileStore.
5. Restore only to fresh target paths:

   ```bash
   node bin/teacher-service-store-snapshot.js restore \
     "$SNAPSHOT_DIR" "$RESTORE_DB_PATH" "$RESTORE_FILESTORE_PATH"
   ```

6. Before switching traffic, start the intended image against the restored
   copies, inspect `/health`, SQLite integrity/foreign keys, exact material
   version history and representative attachment hashes, then run the
   synthetic C4–C6/MCP smoke checks. Never use the only original PVC as a
   restore target.

### Additive migration and rollback safety

`DatabaseManager` applies `CREATE TABLE IF NOT EXISTS` plus explicit
`ALTER TABLE ... ADD COLUMN` migrations. The automated legacy-schema fixture
verifies a T1-shaped database can be opened by the current schema while
preserving its seeded data. The snapshot fixture separately verifies T1/C6
material-version recovery. These are local synthetic proofs, not a production
migration rehearsal.

A previous image must not be assumed compatible merely because the current
migrations are additive. Before a production image rollback after a migration,
verify that exact previous image against a restored copy. If that is not
proven, do not point the old image at the migrated database: keep the migrated
PVC untouched and recover the previous schema/data into new targets, then
change the workload/PVC references only under a separately authorized C7B
plan. No destructive reverse migration is implemented.

**Production backup: NOT VERIFIED. Production restore: NOT VERIFIED.** The two
PVCs remain node-local and their loss/corruption risk remains open.

## Teacher access and MCP

- Cloudflare Access assertion validation and teacher identity mapping are
  enforced in the application; an authenticated identity without an explicit
  teacher mapping is not a teacher.
- Teacher REST routes under `/api/*`, except the isolated `/api/student/*`
  surface, require authentication plus explicit teacher membership. The public
  student route uses revocable, expiring application sessions and server-side
  class/submission checks; it does not accept a client-supplied `studentId` as
  identity proof. `/mcp` keeps its existing separate transport/authentication
  contract and also requires teacher authorization for teacher-only tools.
- Do not add role headers/query parameters or share a non-teacher bearer token.
  Edge routing is a separate control: local hash routing does not protect
  routes at Cloudflare, and this runbook does not prove student-public/teacher-
  protected Cloudflare path behavior. See the C7A readiness report and the
  routing proposal's non-executable status before any C7B change.
- Student claim-code rate limiting resolves the direct socket peer by default.
  `CF-Connecting-IP` is used only when that peer matches an explicitly trusted
  `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS` range; untrusted `X-Forwarded-For` and
  `CF-Connecting-IP` headers are ignored. The current versioned K3s app bundle
  does not set that variable. Therefore the actual proxy peer and rate-limit
  bucket behavior in production are **NOT VERIFIED**; before C7B, determine the
  immediate Traefik peer/CIDR from approved runtime evidence, configure only
  that trusted range through non-secret runtime configuration, and repeat the
  spoofing/rate-limit test through the edge. Do not guess the CIDR or trust all
  private addresses.
- The plugin endpoint remains `https://mcp-teacher.simogatti.it/mcp`.
  Local protocol tests are not evidence of authenticated ChatGPT connectivity;
  report remote ChatGPT as verified only after a real authenticated client
  session succeeds.

## Local development

The production runbook remains K3s-only. For local development, use the pinned
project Node/pnpm versions, `.env.local` (owner-only and ignored), and the
commands in `README.md`. Local SQLite and FileStore are separate development
state; never copy production data into local tests.

## Rate Limiting & Proxy Trust Configuration (C7A-R2)

- Student claim code endpoint (`POST /api/student/claim-code`) enforces multi-tiered rate limits persisted in SQLite (`student_claim_rate_limits`):
  - `TEACHER_SERVICE_CLAIM_RATE_LIMIT_DEVICE_MAX`: 5 consecutive failures per device. Device identification supports both the client header `X-Student-Device-Id` / body `deviceId` and automatic server-issued HttpOnly cookie `ts_device_id`.
  - *Classroom Fallback Protection:* When a browser does not send a custom device header, the server issues a unique `ts_device_id` cookie. We strictly avoid grouping anonymous requests into a naive, tiny shared device bucket (such as `anon:IP` with a 5-failure threshold), which would involuntarily lock out 30+ students in an entire classroom after 5 collective typos. Each browser receives its own isolated device allowance.
  - `TEACHER_SERVICE_CLAIM_RATE_LIMIT_CODE_MAX`: 5 failures per IP + code (prevents targeted guessing of a specific access code, even if device IDs or cookies are rotated or omitted).
  - `TEACHER_SERVICE_CLAIM_RATE_LIMIT_IP_MAX`: 120 failures per 5 minutes per IP (absorbs 30-35 students under shared NAT router making 2-3 typos each while blocking sustained brute-force enumeration).
  - `TEACHER_SERVICE_CLAIM_RATE_LIMIT_IP_BURST`: 75 failures per 10 seconds per IP (protects against automated rapid burst enumeration while absorbing simultaneous classroom exam starts).
- Proxy trust is governed by `TEACHER_SERVICE_TRUSTED_PROXY_CIDRS`. In production, this must match only the specific, verified peer IP of Traefik or the Tunnel egress. If unset or non-matching, `resolveClientIp` falls back fail-closed to the direct TCP socket address, preventing any IP header spoofing.

## Feature Gates & Operational Controls (C7A-R2)

- `TEACHER_SERVICE_ENABLE_INTEGRITY_ANALYSIS`: Defaults to `false` in production.
  - When disabled:
    - Integrity analysis tab in Teacher web UI is hidden.
    - REST endpoints (`/api/assessments/:id/integrity-preview`, `/api/assessments/:id/integrity-reviews`) return 404 Not Found.
    - MCP tools (`analyze_integrity_evidence`, `record_integrity_review`) are removed from `tools/list` and reject invocations.
    - Core teacher monitoring, live exam operations, extra time, manual submission withdrawal, and grading remain fully enabled.
- `TEACHER_SERVICE_ENABLE_STUDENT_EXTERNAL_GRADING`: Defaults to `false` in production. Student submissions are graded internally via local rules and rubrics; external LLM submission processing requires explicit configuration.

## Data-Loss Policy & Rollback Principles

- **Pre-cutover Rollback:** During the maintenance window, before live student/teacher traffic is routed to the new release, rolling back to the pre-deployment snapshot is completely non-destructive (zero data loss).
- **Post-cutover Rollback:** Once real classroom examinations occur or teacher grades are recorded, restoring the pre-deployment database snapshot would permanently overwrite and destroy newly created student submissions and evaluations.
  - Never blindly restore a pre-deployment database snapshot on a live running system.
  - In emergency post-cutover rollback, always perform a delta export/snapshot of all new data first.
  - The SQLite schema migration is additive (columns with defaults, new non-conflicting tables), allowing older T1 versions of the service to read existing baseline records without failure.
  - If a PVC restoration is ever executed on K3s/Longhorn, restore into a NEW isolated volume or path. Never overwrite the original PVCs in-place.

## Non-Atomic Store Recovery Mechanics & Mandatory Pre-Attachment Verification (C7B-P0 Errata)

- **Non-Atomic Filesystem Invariant:**
  SQLite snapshot (`VACUUM INTO`) and FileStore replication (`fs.cpSync`) do **not** constitute a single POSIX atomic transaction. An interruption (process kill, disk full, node failure) between or during these operations could leave an incomplete snapshot or mismatched data versions.
- **Limits of JavaScript Exception Handlers:**
  A JavaScript `try/catch` or `finally` block only handles caught JavaScript exceptions. It **cannot** run or guarantee filesystem cleanup after `SIGKILL`, an abrupt process crash, kernel OOM kill, hardware crash, or power outage. If an ungraceful termination occurs midway through restore, staging files (`.teacher-service-*-restore-*`) or partially copied targets may remain on the filesystem.
- **Mandatory Pre-Attachment Verification Gate:**
  Before any restored volume or directory can be connected or mounted to the running application workload, the operator or automation **must** execute:
  ```bash
  node bin/teacher-service-store-snapshot.js verify-target <database.sqlite> <filestore-dir> [snapshot-dir]
  ```
  This gate programmatically verifies:
  1. Both target database and FileStore exist and are regular file / directory.
  2. No lingering staging artifacts (`.teacher-service-*-restore-*`) remain in target parent directories.
  3. SQLite database passes `PRAGMA integrity_check` (`ok`) and `PRAGMA foreign_key_check` (0 violations).
  4. FileStore tree matches the snapshot `manifest.json` exactly in file count, paths, sizes, and SHA-256 hashes.
  If any check fails, the target is rejected, cleaned, and the restore retried from the verified snapshot before mounting.
- **Verified in Automated Suites:**
  `tests/integration/snapshot-partial-failures.test.js` (9/9 tests PASS), including fault injection and real child process `SIGKILL` testing proving that unhandled terminations leave incomplete states that the mandatory verification gate successfully catches.

## Verified T1 Container Rollback Compatibility (C7B-P0)

- The real production T1 container image (`ghcr.io/simogatti04/class:20261020-f962706`, Linux amd64) was booted and executed in isolated environments against:
  1. A pre-migration baseline store.
  2. A store migrated forward with C6 schema changes.
  3. A store restored from a pre-migration snapshot into clean target volumes.
- In all three scenarios, the legacy T1 runtime:
  - Responded `200 OK` on `/health`.
  - Initialized SQLite and passed all foreign-key and integrity pragma checks.
  - Successfully queried and resolved classes, subjects, lessons, materials, specific versions, and FileStore raw attachments without SQL errors.
- Proves that the schema migration is strictly backward-compatible with the T1 binary, enabling instant container image rollback if needed during pre-cutover verification.

## Cloudflare Edge & Application Cutover Sequence (C7B-P0 Reconciliation)

- **Strict Phasing Invariant:**
  The Cloudflare Terraform saved plan must be generated, inspected, and approved *before* the maintenance window begins. However, the edge change that opens student routes (`/studente`, `/api/student/*`) must **never** be applied before the new application runtime is deployed, initialized, and verified healthy. Exposing paths prior to container readiness risks exposing a failing backend or routing student traffic to an incompatible container.
- **Access Application Replacement & AUD Rotation Safeguard:**
  - With Cloudflare provider 5.24.0, changing the path scope or configuration of `cloudflare_zero_trust_access_application.k3s["class"]` can trigger a resource replacement (`destroy and then create replacement`).
  - Resource replacement **rotates the Cloudflare Access Application AUD**.
  - If the AUD rotates, the existing Pod running with the old `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` will reject all valid teacher JWT assertions with `401 Unauthorized` (fail-closed behavior).
  - **Coordinated Cutover Procedure:**
    1. *Pre-Maintenance:* Generate and review saved plans for Access and routing using canonical wrappers. Identify whether `class` application shows `~ update in-place` or `-/+ destroy and then create replacement`.
    2. *Maintenance Start:* Quiesce traffic, execute SQLite + FileStore snapshot, run `node bin/teacher-service-store-snapshot.js verify <snapshot-dir>` to verify integrity before making any changes.
    3. *Workload Deploy & Internal Pre-Opening Gate:*
       - Apply K3s deployment manifest with the new container image tag.
       - Verify Pod enters `Running` and Kubernetes readiness probes pass.
       - **Execute Internal Read-Only Smoke Test Gate:** `node bin/teacher-service-smoke-test.js http://127.0.0.1:8770` (verified by `tests/server/pre-opening-smoke.test.js`).
         Validates:
         - `/health` -> 200 OK, service metadata.
         - SPA root `/` and `/studente` -> 200 OK, HTML shell.
         - Database read path `/api/student/classes` -> 200 OK, JSON classes list (0 writes).
         - Fail-closed teacher authorization `/api/classes` -> 401/403 Forbidden.
         - Student claim router `/api/student/claim-code` -> 400 Bad Request / ValidationError on empty body (0 writes).
         - MCP transport `/mcp` -> active transport response.
       - *Strict Invariant:* If any internal smoke check fails, do NOT proceed with edge changes.
    4. *Edge Apply:* Apply Cloudflare Access plan only after step 3 passes completely.
    5. *AUD Reconciliation:* If the Access application was replaced, read the new AUD from the Terraform output/state, update `TEACHER_SERVICE_WEB_CF_ACCESS_AUD` in `infra/k3s/apps/class/configmap.yaml`, apply the ConfigMap, and restart the Pod.
    6. *Post-Cutover Public Smoke Tests:* Validate external teacher login on `/docente`, student access on `/studente`, claim API on `/api/student/claim-code`, and MCP on `https://mcp-teacher.simogatti.it/mcp`.
    7. *Emergency Abort & Cloudflare Rollback:*
       - **Do NOT re-apply an old saved plan:** A previously saved plan is potentially stale against mutated Terraform state and must never be applied blindly.
       - **Fresh Rollback Plan Workflow:**
         a. Revert declarative manifests in `infra` to the baseline configuration (full-domain root Access protection on `class.simogatti.it`).
         b. Run `make cf-save-access-plan` against the *current* state to produce a fresh, verified rollback plan.
         c. Verify the bundle with `make cf-verify-access-plan`.
         d. Review and apply the verified rollback plan with `make cf-apply-access-plan`.
       - **Provider Unavailability Fallback:**
         If the Cloudflare API or provider is temporarily unreachable, the application layer acts as the fail-closed defense line. All teacher and management endpoints require JWT assertions with valid teacher identity mapping. If necessary during an outage, the operator can immediately stop or scale down the K3s workload (`kubectl scale deployment class --replicas=0 -n class`) to eliminate exposure until Cloudflare API connectivity is restored and the verified rollback plan is applied.
