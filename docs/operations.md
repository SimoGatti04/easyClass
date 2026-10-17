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

## Teacher access and MCP

- Cloudflare Access assertion validation and teacher identity mapping are
  enforced in the application; an authenticated identity without an explicit
  teacher mapping is not a teacher.
- `/api/*` and `/mcp` share the same fail-closed teacher authorization. Do not
  add role headers/query parameters or share a non-teacher bearer token.
- The plugin endpoint remains `https://mcp-teacher.simogatti.it/mcp`.
  Local protocol tests are not evidence of authenticated ChatGPT connectivity;
  report remote ChatGPT as verified only after a real authenticated client
  session succeeds.

## Local development

The production runbook remains K3s-only. For local development, use the pinned
project Node/pnpm versions, `.env.local` (owner-only and ignored), and the
commands in `README.md`. Local SQLite and FileStore are separate development
state; never copy production data into local tests.
