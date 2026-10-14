# Teacher Service — Operations & MCP Connection Readiness

## Local configuration

Copy `.env.example` to the ignored `.env.local` and set values through the operator-controlled local configuration path. Keep file permissions owner-only (`chmod 600 .env.local`). The `npm run mcp` and `npm run start:http` scripts load `.env.local` using Node's built-in `--env-file`; variables already injected by the process manager take precedence.

Required/optional variables:

- `TEACHER_SERVICE_OMNIROUTE_BASE_URL`: exact configured OpenAI-compatible gateway. The current target is `http://198.51.100.62:32128/v1` over Tailscale. The Tailscale address was verified on `<backup-host>`, where infra maps NodePort `32128` to the OmniRoute Service port `20128`. `http://198.51.100.13:32128/v1` reaches the same host's LAN NodePort, but is not the configured client target; do not silently switch between paths.
- `TEACHER_SERVICE_OMNIROUTE_API_KEY`: secret credential; never commit, print, include in diagnostics, or send anywhere other than the configured gateway.
- `TEACHER_SERVICE_DEFAULT_MODEL`: optional model override. If unset, the adapter uses its configured default.
- `TEACHER_SERVICE_WEB_SEARCH_URL`: optional SearXNG-compatible `/search` endpoint. Leave unset until an existing provider has been located and explicitly configured; URL registration alone is not web search.
- `TEACHER_SERVICE_CF_ACCESS_AUD`: operator-supplied Cloudflare Access application audience required for assertion verification. It has no PM2 fallback; strict authentication fails closed if it is missing.
- `TEACHER_SERVICE_CF_ACCESS_ISS`: Cloudflare Access issuer. The application default is the configured `simogatti.cloudflareaccess.com` tenant; PM2 can pass an explicit override.
- `TEACHER_SERVICE_TEACHER_EMAILS`: comma-, semicolon-, or newline-separated exact email identities allowed to act as teachers. These identities are matched case-insensitively only against the email claim in a verified Cloudflare Access assertion. Empty means no remote teacher principals are authorized. Wildcards and caller-provided role claims are not supported.

For PM2, export the same values using the host's approved secret/configuration mechanism before starting `ecosystem.config.cjs`; the PM2 ecosystem file forwards only the explicitly named settings. In particular, set the Access audience and teacher-email allowlist explicitly. Missing audience prevents authenticated requests in strict mode, and an empty teacher allowlist grants no teacher access.

## Local Streamable HTTP validation

The HTTP server binds to `127.0.0.1:8770` by default. Do not change the bind address or create a public ingress as part of local verification.

```bash
npm test
npm run start:http
```

A local protocol client can use `http://127.0.0.1:8770/mcp` only in a test configuration with a synthetic identity and an injected test authorizer. That test does not establish remote ChatGPT readiness. Production teacher access requires a real verified Cloudflare assertion whose email is present in `TEACHER_SERVICE_TEACHER_EMAILS`; authentication by shared bearer alone is intentionally insufficient.

## Live integration smoke check

The optional live runner is deliberately explicit and writes an isolated database, generated artifacts, source snapshots, and sanitized diagnostics under a unique directory in `validation/live-integrations/`. It sends only synthetic teaching content and a public Python documentation page. It refuses production mode, mock mode, a missing credential, or any OmniRoute endpoint other than the exact approved Tailscale target (`http://198.51.100.62:32128/v1`).

```bash
node --env-file=.env.local bin/teacher-service-live-check.js --confirm-live
```

The runner independently records public-page retrieval, configured web search, a direct OmniRoute completion, and an integrated MCP contextual generation. It does not impose any product quotas; each invocation is an explicit smoke-check run. Inspect the generated `report.json` and artifacts before removing the evidence directory.

## Product domains and migration boundary

`class.simogatti.it` is the planned domain for the complete Teacher Service web interface and will replace the current `portale-classi` portal. This is a separate migration: inventory and verify the existing portal's functionality, then cut over only with a continuity plan; do not replace or interrupt the current service as part of MCP publication. The MCP endpoint and future web interface will share the same Teacher Service backend and persistence, with authorization appropriate to each audience.

The current remote publication is limited to the Teacher Service MCP endpoint at `/mcp`; the dashboard and REST API are not intended as remote surfaces on `mcp-teacher.simogatti.it`.

## ChatGPT remote connection — not yet provisioned or verified

`plugin/mcp.json` names the intended Streamable HTTP endpoint but is only a connection descriptor; it is not evidence that DNS, ingress, Cloudflare Access, or ChatGPT authentication is working. The local implementation is ready to be exposed only after the operator supplies the teacher email mapping and verifies the Cloudflare Access audience/issuer and identity policy.

Before any remote connection:

1. Keep the origin bound to loopback and route only through an explicitly approved protected tunnel/connector. Do not open host ports or change DNS/Cloudflare configuration without separate infrastructure authorization.
2. Ensure Cloudflare Access injects its signed `Cf-Access-Jwt-Assertion`; the origin verifies RS256, issuer, audience, and validity, then separately checks the signed email against `TEACHER_SERVICE_TEACHER_EMAILS`.
3. Verify non-teacher identities and shared bearer tokens receive `403` for both `/mcp` and `/api/*`.
4. Test initialize, tool discovery, read/write, and session isolation through the deployed protected path using a synthetic isolated data store before connecting the ChatGPT client.
5. Distinguish a successful local protocol test from an authenticated remote ChatGPT test. Do not state remote readiness until the latter is completed.

The current remote endpoint in the plugin descriptor has **not** been tested in this checkpoint. No live/public ingress, DNS, Access, Tunnel, or production service was changed; only the local declarative Terraform manifest was prepared for review.

## Architettura e Deployment Definitivo (K3s)

In conformità con le decisioni vincolanti del Domain Owner:
- **Web UI & Portale**: `https://class.simogatti.it` è il dominio dell'interfaccia web completa, in sostituzione immediata dell'inutilizzato `portale-classi`.
- **MCP Endpoint**: `https://mcp-teacher.simogatti.it/mcp` per il collegamento di ChatGPT con Cloudflare Access Managed OAuth e autorizzazione docente.
- **Backend Unificato**: Una sola istanza logica di Teacher Service in esecuzione su K3s (cluster `<backup-host>`), che serve sia l'interfaccia Web sia l'endpoint MCP. Non è prevista una seconda istanza produttiva su MacMini.
- **Storage & Persistenza**:
  - SQLite persistente con WAL (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) sul PVC `class-teacher-db` montato in `/app/storage/db`.
  - FileStore persistente per gli allegati/documenti sul PVC `class-teacher-files` montato in `/app/storage/files`.
  - Dati legacy di `portale-classi` (PostgreSQL e upload storici) preservati per rollback in `/srv/class/backup_before_teacher_service_20261014.sql` e volume mounts dedicati.
- **Connettività AI OmniRoute**: Raggiungibile tramite rete interna al cluster Kubernetes all'indirizzo `http://omniroute.omniroute.svc.cluster.local:20128/v1` con chiave gestita tramite Infisical ExternalSecret.

## Architettura e Deployment Definitivo (K3s)

In conformità con le decisioni vincolanti del Domain Owner:
- **Web UI & Portale**: `https://class.simogatti.it` è il dominio dell'interfaccia web completa, in sostituzione immediata dell'inutilizzato `portale-classi`.
- **MCP Endpoint**: `https://mcp-teacher.simogatti.it/mcp` per il collegamento di ChatGPT con Cloudflare Access Managed OAuth e autorizzazione docente.
- **Backend Unificato**: Una sola istanza logica di Teacher Service in esecuzione su K3s (cluster `<backup-host>`), che serve sia l'interfaccia Web sia l'endpoint MCP. Non è prevista una seconda istanza produttiva su MacMini.
- **Storage & Persistenza**:
  - SQLite persistente con WAL (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) sul PVC `class-teacher-db` montato in `/app/storage/db`.
  - FileStore persistente per gli allegati/documenti sul PVC `class-teacher-files` montato in `/app/storage/files`.
  - Dati legacy di `portale-classi` (PostgreSQL e upload storici) preservati per rollback in `/srv/class/backup_before_teacher_service_20261014.sql` e volume mounts dedicati.
- **Connettività AI OmniRoute**: Raggiungibile tramite rete interna al cluster Kubernetes all'indirizzo `http://omniroute.omniroute.svc.cluster.local:20128/v1` con chiave gestita tramite Infisical ExternalSecret.
