# Teacher Service — Agent Entry Point

Before making changes, inspect the current Git branch, working tree, active
worktrees, and the current `STATUS.md` checkpoint. Preserve unrelated changes
and C0–C13 historical evidence.

## Source of truth and project guidance

- Current implementation/status: [STATUS.md](STATUS.md)
- Project overview and local commands: [README.md](README.md)
- **Production operations:** [docs/operations.md](docs/operations.md), which
  describes K3s only
- Product/domain rules and approved decisions: [docs/dossiers/](docs/dossiers/)
- Historical feasibility/validation evidence: [validation/](validation/)
- Production K3s desired state: `~/Workspace/infra/k3s/apps/class/`
- Shared development environment conventions:
  `~/Workspace/development-environment/AGENTS.md` and the relevant
  detailed documents under `docs/environment/` and `docs/engineering/`.

## Invariants

- Production is K3s. Do not revive the retired Mac mini/PM2 runtime.
- Preserve the `class` namespace and Service, current domains/HTTPRoutes,
  `class-teacher-db` and `class-teacher-files` PVCs, SQLite, and FileStore.
- Teacher-only data requires an explicitly teacher-authorized principal;
  authentication by itself does not grant teacher authority.
- Never print, persist, or commit secrets. Infisical/ESO is the production
  configuration path.
- Do not create public ingress or modify Cloudflare without a separate explicit
  authorization.
- Do not introduce independent backup infrastructure; document the residual
  SQLite/FileStore single-node risk.
- Do not build the C2 dashboard during C1 cleanup.

Run `pnpm test` after code changes and record exact local/live verification in
`STATUS.md`. Distinguish CURRENT, DEPRECATED, and PLANNED behavior.
