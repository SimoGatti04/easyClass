# Teacher Service

Teacher Service is a teacher-focused application and MCP server for managing
teaching context, versioned materials, grounded generation, assessments, and
grading while preserving teacher control and provenance.

## Runtime status

- **CURRENT — production:** one Teacher Service workload on K3s in namespace
  `class`; the web app uses `https://class.simogatti.it` and MCP uses
  `https://mcp-teacher.simogatti.it/mcp` behind the existing protected route.
- **CURRENT — persistence:** SQLite and FileStore use the distinct
  `class-teacher-db` and `class-teacher-files` PVCs. They are production data.
- **DEPRECATED:** the previous Mac mini/PM2 production runtime and
  portale-classi PostgreSQL/uploads. Do not restart or reconnect those runtimes.
  The repository's local `.env.local` and local SQLite remain for development
  only.
- **CURRENT — local product UI:** C3/C4 student flows and the C5 teacher
  workspace (activity queues, live monitoring, submissions, grading and results)
  are implemented and locally verified. C5 has not been released to production.
- **PLANNED — C6:** integrity-evidence analysis and expanded MCP workflows.

## Current capabilities

- Classes, subjects, lessons, collections, and versioned materials.
- Teacher/Student/Support material roles, publication and explicit assessment
  grounding protections.
- Context-aware AI rules and source selection, generation, revision, and
  provenance through the OmniRoute adapter.
- Assessment blueprints, protected teacher solutions, student submissions,
  grading proposals, teacher review, and exports.
- MCP stdio and Streamable HTTP transports with Cloudflare Access identity
  verification and a separate explicit teacher allowlist.

The feature surface is broader than the verified production integration
surface. See [STATUS.md](STATUS.md) for exact test and live-integration
results. Mock transports are test/development-only and are not reported as
successful live AI generation.

## Local development

Use Node.js 26.5.0 and pnpm 10.32.1 as pinned in `.mise.toml`. The declared
minimum runtime is Node.js 22.5.0 because the application uses the built-in
`node:sqlite` API.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
chmod 600 .env.local
pnpm test
pnpm mcp
pnpm start:http
```

Local secrets and generated data are ignored. Never use production records as
test fixtures. Production operations and rollback are documented in
[docs/operations.md](docs/operations.md).

## Architecture and evidence

- [AGENTS.md](AGENTS.md) — project entry point and invariants.
- [STATUS.md](STATUS.md) — current checkpoint and historical progress.
- [docs/operations.md](docs/operations.md) — production K3s operations.
- [docs/dossiers/](docs/dossiers/) — approved domain rules.
- [validation/](validation/) — preserved C0–C13 historical evidence.
