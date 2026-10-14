# functional-domain-driven-hexagon Overview

A monorepo containing:

- `packages/web`: Next.js (App Router) renderer; proxies `/api/*` to the BFF (see [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md))
- `packages/server`: Effect-based BFF / API server (the auth authority — see ADR-0034)
- `packages/identity`: the identity Worker — Better Auth as the OIDC issuer the server signs users in against
- `packages/infra`: the Alchemy stack (Neon, Hyperdrive, Queues, Workers)
- `packages/contracts`: Shared HTTP API contracts consumed by both web and server
- `packages/database`: Database schema, migrations, and SQL access primitives
- `packages/jobs`: Background-job runner (cron-style)
- `packages/acceptance`: Playwright acceptance suite

## Setup in a codespace

The whole stack — Postgres, migrations, the identity Worker with a seeded OIDC
client and admin user, Mailpit, Jaeger — comes up provisioned when you create a
codespace on a branch, which is the quickest way to work several features in
parallel. See [docs/codespaces.md](docs/codespaces.md).

## Prerequisites

To run locally instead, install these on your machine:

- **Node 22** — `.nvmrc` pins the exact version CI runs (22.13.1); `engines.node` accepts any 22.x at or above it. Use whatever version manager you like (`mise`, `fnm`, `nvm`, `asdf`).
- **pnpm 10.3.0** — auto-activated by [corepack](https://nodejs.org/api/corepack.html), which ships with Node. Run `corepack enable` once after installing Node.
- **Docker Desktop** (or any Docker + docker-compose) — runs Postgres, Mailpit and Jaeger.
  - [Install Docker](https://docs.docker.com/get-docker/)

That's it. The server uses [tsx](https://github.com/privatenumber/tsx) (already a dev dependency) to run TypeScript directly, so no extra runtime is needed.

## Setup

`pnpm install && pnpm bootstrap` does all of this and seeds the identity Worker (see
[Authentication](#authentication-the-identity-worker)). By hand:

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env file (defaults match the docker-compose Postgres)
cp .env.example .env

# 3. Start Postgres, Mailpit and Jaeger (Jaeger UI: http://localhost:16686/search)
docker-compose up -d postgres mailpit jaeger

# 4. Create the identity database, then migrate it and the dev DB
docker compose exec postgres psql -U postgres -c 'CREATE DATABASE "effect-monorepo-identity"'
pnpm db:migrate

# (optional) migrate the test DB used by *.integration.test.ts. The database
# itself is created by infra/postgres/init/ on the volume's first boot.
pnpm --filter @org/database db:migrate:test

# (recommended) clone the Effect v4 source for reference — see below
pnpm effect:source
```

Migrations are applied by the `@effect/sql` migrator, which tracks what it has run
in an `effect_sql_migrations` table. A database last migrated by Flyway has no such
table, so it has to be replayed once — `pnpm --filter @org/database db:reset` drops
every module schema (and the leftover `flyway_schema_history`), then `db:migrate`
rebuilds it.

### Effect v4 source reference

Effect v4 has no published API docs, so the upstream source is the reference — for you and for any coding agent. `pnpm effect:source` shallow-clones [Effect-TS/effect](https://github.com/Effect-TS/effect) (v4 is its `main`; the `effect-smol` incubator repo is archived and its history merged here) into `reference/effect` (~38 MB, gitignored) at the tag matching the `effect` version pinned in the root `package.json`, so what you read is what you compile against. Re-run it after bumping that pin. `--ref main` looks at unreleased upstream, `--force` re-clones. The checkout is read-only reference: it is outside every package root and excluded from eslint/prettier, so no build or gate sees it. Start at its `LLMS.md` and `ai-docs/`; agent-facing guidance lives in `.claude/rules/effect-v4-source.md`.

## Authentication (the identity Worker)

The identity provider is `packages/identity`: [Better Auth](https://www.better-auth.com) as an OIDC issuer, in its own Cloudflare Worker with its own database. Locally `pnpm dev:cf` (part of `pnpm dev`) serves it on `:3002` under `alchemy dev`. The browser never holds an access or id token; the server is the OIDC client and issues a `HttpOnly` session cookie scoped to the Next origin. See [ADR-0034](docs/adr/0034-identity-worker-with-better-auth.md) for the design, [ADR-0017](docs/adr/0017-frontend-auth-flow.md) for the SPA-side details it amends, and [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md) for the Next-fronted refit.

```bash
pnpm bootstrap   # postgres + mailpit + jaeger, secrets, migrations, then seeds the identity Worker
pnpm dev         # server :3001, web :3000, identity Worker :3002
```

`pnpm bootstrap` registers the app as a trusted OIDC client (`IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET`) and creates the admin (`IDENTITY_ADMIN_EMAIL` / `IDENTITY_ADMIN_PASSWORD`) with a verified email. Re-run just that step with `pnpm seed:identity` while `pnpm dev:cf` is up. Sign in at `http://localhost:3000/api/auth/login`; anyone can also create an account there, behind email verification — the mail lands in Mailpit at `http://localhost:8025`.

**Acceptance tests** (Playwright) sign in through the identity Worker's real pages on every run: keep `pnpm dev:cf` running, stop dev servers on `:3000` / `:3001`, then run `pnpm test:acceptance`. CI E2E (`.github/workflows/e2e.yml`) starts the identity Worker the same way.

## Billing (Stripe)

The billing module wraps Stripe behind a `BillingGateway` port. Tests run against an in-memory `FakeBillingGatewayLive` (no Stripe account needed); the `.env.example` placeholders for `STRIPE_*` are good enough for `pnpm test` and `pnpm check:all` to pass.

For the real-Stripe smoke loop (subscribe / cancel / webhook delivery against test-mode Stripe):

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_DEFAULT` from your Stripe dashboard (test mode).
2. Run `stripe listen --forward-to localhost:3001/webhooks/stripe`; copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Restart the BFF so it picks up the env vars.
4. `POST /api/orgs/:orgId/billing/subscriptions` (as an org admin) → Stripe creates a customer + subscription → the CLI forwards `customer.subscription.created` back to your webhook.

## Development

```bash
# Start the Effect server (watch mode, port 3001)
pnpm --filter server dev

# Start the Next.js renderer (port 3000; /api/* rewrites to :3001)
pnpm --filter @org/web dev
```

The browser only ever sees the Next origin (`:3000`). Browser → Next.js → `/api/*` rewrite → Effect server (`:3001`); session cookie scopes to `:3000`. See [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md).

Run them in separate terminals, or use the **Dev: All** VS Code task (see [`.vscode/tasks.json`](.vscode/tasks.json)).

## Database Operations

To work with the database, use the following commands:

```bash
# Push schema changes to the local database
pnpm --filter database db:push

# Open Drizzle Studio to view and edit data
pnpm --filter database db:studio
```

## Operations

### Building Packages

**Building All Packages**

To build all packages in the monorepo:

```sh
pnpm build
```

**Building a Specific Package**

To build a specific package:

```sh
pnpm --filter @org/web build
pnpm --filter server build
pnpm --filter @org/contracts build
pnpm --filter database build
```

### Installing Dependencies

To add dependencies to a specific package:

```sh
# Add a production dependency
pnpm add --filter @org/web next-themes

# Add a development dependency
pnpm add -D --filter @org/web @types/react
```

### Checking and Testing

```sh
# Run all checks
pnpm check:all

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```
