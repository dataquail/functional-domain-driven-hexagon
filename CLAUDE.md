# Project conventions

Effect v4 monorepo, hexagonal architecture, DDD. Full rationale lives in `docs/adr/`; the working-memory digests live in `.claude/rules/`.

**Before working in an area, read its rule file** — `.claude/rules/` is not auto-loaded, so pull in the relevant one:

| Working on…                                           | Read                                             | Backing ADRs                            |
| ----------------------------------------------------- | ------------------------------------------------ | --------------------------------------- |
| Adding/moving files in a server feature module        | `.claude/rules/server-module-layout.md`          | 0002, 0003, 0013, 0022–0024             |
| New file kind, test, fake, stereotype (parity/layout) | `.claude/rules/server-file-taxonomy.md`          | 0008                                    |
| Writing or running server/jobs tests                  | `.claude/rules/server-testing.md`                | 0009                                    |
| Handlers, layers, event buses, SQL, auth (server)     | `.claude/rules/server-effect-and-persistence.md` | 0004, 0006, 0007, 0012, 0016–0017, 0020 |
| Frontend (`packages/web`, `packages/components`)      | `.claude/rules/frontend.md`                      | 0014, 0015, 0018                        |
| Writing comments (any package)                        | `.claude/rules/comments.md`                      | —                                       |

## Monorepo map

| Package             | What it is                                                                         |
| ------------------- | ---------------------------------------------------------------------------------- |
| `@org/server`       | The Effect BFF backend (`src/modules/`, `src/platform/`, HTTP). Bulk of the rules. |
| `@org/web`          | Next.js App Router renderer + `/api/*` proxy; the server stays the BFF (ADR-0018). |
| `@org/components`   | Bespoke component library (primitives + patterns) + Storybook (ADR-0015).          |
| `@org/contracts`    | Shared HTTP API contracts, schemas, errors — consumed by server and clients.       |
| `@org/database`     | DB access kernel (slonik, `RowSchemas`, `db.makeQuery`) + migrations.              |
| `@org/jobs`         | Background/cron jobs.                                                              |
| `@org/cli`          | Command-line client (device-flow auth, organizations, todos).                      |
| `@org/mcp`          | MCP (stdio) server exposing the CLI surface as tools.                              |
| `@org/api-client`   | Shared typed client + credential store for the CLI and MCP.                        |
| `@org/acceptance`   | Playwright acceptance tests (specs / drivers / pages / infrastructure).            |
| `@org/test-drivers` | Tier-agnostic page-driver contracts + per-tier adapters (Playwright / RTL).        |

## Commands

| Command                                                | What it runs                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `pnpm check:all`                                       | lint + lint:deps + typecheck + check:effect + tests + storybook (the full gate)                 |
| `pnpm lint`                                            | ESLint — includes the `project-structure/folder-structure` file-taxonomy rule (layout + parity) |
| `pnpm check:effect`                                    | `@effect/language-service` diagnostics across all projects; fails on any finding                |
| `pnpm test`                                            | vitest **unit** suite (excludes `*.integration.test.ts`), no DB                                 |
| `DATABASE_URL_TEST=postgres://… pnpm test:integration` | **integration** suite only (`*.integration.test.ts`); hard-fails if no DB                       |
| `pnpm lint:deps`                                       | dependency-cruiser architecture rules                                                           |

## Always in scope

- **Effect v4 baseline.** Pinned to `effect@4.0.0-beta.94` (exact — `effect/unstable/*` may break on beta bumps). Domain result idiom is `effect/Result` (not `Either`); errors are `Schema.TaggedErrorClass`; services are `Context.Service<Self, Shape>()("Id")` with an explicit `Layer`. HTTP is `effect/unstable/httpapi` + `effect/unstable/http`. Server-side gotchas and event-bus/UoW/span rules are in `.claude/rules/server-effect-and-persistence.md`.
- **Comments are a last resort** — code is self-documenting, behavior is documented through tests. Full policy: `.claude/rules/comments.md`.
