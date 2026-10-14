# Teacher Service

Teacher Service is a teacher-centric, modular service and MCP server designed to minimize extra-classroom preparation workload while preserving complete pedagogical control, traceability, and material quality.

The project has transitioned from AI feasibility validation (C0–C13) into active product MVP implementation under Domain Owner direction.

Runtime configuration is loaded from the inherited process environment and the private `.env.local` file by the `mcp` and `start:http` scripts; inherited environment variables take precedence. For deployment through PM2, provide those variables through the process manager/secret mechanism rather than committing `.env.local`. See [docs/operations.md](docs/operations.md).

## Core Capabilities (MVP)

1. **Teaching Context & Organization**:
   - Academic Classes, Subjects, Lessons, Collections, and context associations.
2. **Knowledge & Materials Management**:
   - Approved pedagogical roles: `Teacher Material`, `Student Material`, `Support Material`, and explicit `Assessable Material`.
   - Comprehensive CRUD, search (SQLite FTS5), import, duplicate, archive, restore, and safe deletion.
   - Immutable versioning, diffs, rollbacks, and multi-format exports (Markdown, HTML, JSON).
3. **AI Generation & Iterative Workflows**:
   - Lesson Plans, full detailed Teacher Scripts, canonical Student Materials, Exercises, and Assessment drafts with reserved teacher solutions.
   - Iterative revisions, expansion, and selective section regeneration with full provenance tracking.
   - OmniRoute provider adapter with configurable models and resilient fallback generator.
4. **Teacher Interface**:
   - Lightweight, responsive built-in web UI to inspect classes, navigate lessons, edit materials, trigger generations, and export deliverables.
5. **Model Context Protocol (MCP) Integration**:
   - Stdio transport for local clients (ChatGPT Desktop, Claude Desktop, CLI).
   - Streamable HTTP transport for remote ChatGPT connection with Cloudflare Access / Bearer token authentication.
   - ChatGPT plugin manifests and schemas.

## Quick Start

```bash
# Install dependencies
pnpm install

# Create the ignored, private local runtime configuration (then fill approved values)
cp .env.example .env.local
chmod 600 .env.local

# Run automated tests
pnpm test

# Run MCP server (stdio)
pnpm mcp

# Start HTTP server (MCP Streamable HTTP + Teacher Web UI)
pnpm start:http
```

## Architectural Documentation

- [STATUS.md](STATUS.md) — Operational status, gate resolutions, and checkpoint progression.
- [docs/00-design-method.md](docs/00-design-method.md) — Design principles and modular architecture.
- [docs/dossiers/](docs/dossiers/) — Approved domain dossiers (Teacher Experience, Knowledge & Materials, Assessment, AI Architecture).
- [validation/](validation/) — Preserved technical evidence and historical benchmark reports (C0–C13).
