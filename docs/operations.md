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
