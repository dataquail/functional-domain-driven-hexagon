# functional-domain-driven-hexagon Overview

A monorepo of three Cloudflare Workers and the packages they share, declared and deployed by one Alchemy stack:

- `packages/web`: the SvelteKit app, a Cloudflare Worker that proxies `/api/*` to the server over a service binding (see [ADR-0037](docs/adr/0037-sveltekit-renderer-on-workers.md))
- `packages/components`: the Svelte 5 component library (primitives + patterns) and its Storybook ([ADR-0015](docs/adr/0015-frontend-component-library.md), [ADR-0036](docs/adr/0036-svelte-component-library-and-its-lint.md))
- `packages/server`: the Effect-based BFF / API server, run as a Cloudflare Worker (the auth authority — see ADR-0034, ADR-0035)
- `packages/identity`: the identity Worker — Better Auth as the OIDC issuer the server signs users in against
- `packages/infra`: the Alchemy stack (Neon, Hyperdrive, Queues, the three Workers, the zone's rules)
- `packages/contracts`: shared HTTP API contracts consumed by both web and server
- `packages/database`: database access primitives and migrations
- `packages/jobs`: cron jobs as Effects, run by the server Worker's `scheduled` handler
- `packages/cli`, `packages/mcp`, `packages/api-client`: the command-line client, its MCP server, and the typed client they share
- `packages/acceptance`: the Playwright acceptance suite

## Prerequisites

- **Node 24** — `.nvmrc` pins the exact version CI runs (24.21.0). Use whatever version manager you like (`mise`, `fnm`, `nvm`, `asdf`).
- **pnpm 10.3.0** — auto-activated by [corepack](https://nodejs.org/api/corepack.html), which ships with Node. Run `corepack enable` once after installing Node.
- **Docker** (Docker Desktop, or any Docker + compose) — runs Postgres, Mailpit and Jaeger.

## Setup

`pnpm install && pnpm bootstrap` does all of this and seeds the identity Worker (see
[Authentication](#authentication-the-identity-worker)). By hand:

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env file (defaults match the docker-compose Postgres)
cp .env.example .env

# 3. Start Postgres, Mailpit and Jaeger (Jaeger UI: http://localhost:16686/search)
docker compose up -d postgres mailpit jaeger

# 4. Create the identity database, then migrate it and the dev DB
docker compose exec postgres psql -U postgres -c 'CREATE DATABASE "effect-monorepo-identity"'
pnpm db:migrate

# (optional) migrate the test DB used by *.integration.test.ts. The database
# itself is created by infra/postgres/init/ on the volume's first boot.
pnpm --filter @org/database db:migrate:test

# (recommended) clone the Effect v4 source for reference — see below
pnpm effect:source
```

Migrations are applied by the `@effect/sql` migrator, which tracks what it has run in an `effect_sql_migrations` table. `pnpm --filter @org/database db:reset` drops every module schema so `db:migrate` can rebuild it.

### Effect v4 source reference

Effect v4 has no published API docs, so the upstream source is the reference — for you and for any coding agent. `pnpm effect:source` shallow-clones [Effect-TS/effect](https://github.com/Effect-TS/effect) into `reference/effect` (gitignored) at the tag matching the `effect` version pinned in the root `package.json`, so what you read is what you compile against. Re-run it after bumping that pin. `--ref main` looks at unreleased upstream, `--force` re-clones. Start at its `LLMS.md` and `ai-docs/`; agent-facing guidance lives in `.claude/rules/effect-v4-source.md`.

## Development

```bash
pnpm dev   # alchemy dev: the web Worker (:3000), server Worker (:3001) and identity Worker (:3002)
```

The browser only ever sees the web Worker's origin (`:3000`). Browser → SvelteKit Worker → `/api/*` over the `SERVER` service binding → Effect server Worker; the session cookie scopes to `:3000`. `alchemy dev` also runs the domain-event queue locally and exposes the crons at `/cdn-cgi/handler/scheduled`. See [ADR-0035](docs/adr/0035-server-on-cloudflare-workers.md) and [ADR-0037](docs/adr/0037-sveltekit-renderer-on-workers.md).

## Authentication (the identity Worker)

The identity provider is `packages/identity`: [Better Auth](https://www.better-auth.com) as an OIDC issuer, in its own Cloudflare Worker with its own database. The browser never holds an access or id token; the server is the OIDC client and issues a `HttpOnly` session cookie scoped to the app's origin. See [ADR-0034](docs/adr/0034-identity-worker-with-better-auth.md) for the design and [ADR-0017](docs/adr/0017-frontend-auth-flow.md) for the browser-side details it amends.

```bash
pnpm bootstrap   # postgres + mailpit + jaeger, secrets, migrations, then seeds the identity Worker
pnpm dev
```

`pnpm bootstrap` registers the app as a trusted OIDC client (`IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET`) and creates the admin (`IDENTITY_ADMIN_EMAIL` / `IDENTITY_ADMIN_PASSWORD`) with a verified email. Re-run just that step with `pnpm seed:identity` while `pnpm dev` is up. Sign in at `http://localhost:3000/api/auth/login`; anyone can also create an account there, behind email verification — the mail lands in Mailpit at `http://localhost:8025`.

**Acceptance tests** (Playwright) sign in through the identity Worker's real pages on every run. `pnpm test:acceptance` boots its own Workers stack under `alchemy dev`, with the app Hyperdrive pointed at the test database; stop `pnpm dev` first, since the dev ports `:3000`–`:3002` are fixed. With `ACCEPTANCE_BASE_URL`, `ACCEPTANCE_STAGE` and `ACCEPTANCE_DATABASE_URL` set it runs against a deployed `pr-<n>` stage instead.

## Billing (Stripe)

The billing module wraps Stripe behind a `BillingGateway` port. Tests run against an in-memory `FakeBillingGatewayLive` (no Stripe account needed); the `.env.example` placeholders for `STRIPE_*` are good enough for `pnpm test` and `pnpm check:all` to pass.

For the real-Stripe smoke loop (subscribe / cancel / webhook delivery against test-mode Stripe):

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_DEFAULT` from your Stripe dashboard (test mode).
2. Run `stripe listen --forward-to localhost:3001/webhooks/stripe`; copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. Restart `pnpm dev` so the server Worker picks up the env vars.
4. `POST /api/orgs/:orgId/billing/subscriptions` (as an org admin) → Stripe creates a customer + subscription → the CLI forwards `customer.subscription.created` back to your webhook.

## Deploying

Stages deploy from CI, never from a laptop: a pull request labelled `preview` gets its own `pr-<n>` stage with the acceptance suite run against it, and `main` deploys `staging`, then `prod` behind an approval. Each stage carries CPU limits, rate limits, a compute ceiling, a daily email cap and a kill switch. See [ADR-0039](docs/adr/0039-deploy-pipeline-stages-and-limits.md), [ADR-0038](docs/adr/0038-neon-behind-hyperdrive.md) for the databases, and [docs/dev-setup.md](docs/dev-setup.md#deploying) for the one-time setup.

## Component library

Every primitive and pattern has a story; a static build is part of `pnpm check:all`.

```sh
pnpm -F @org/components storybook   # http://localhost:6007
```

## Checking and testing

```sh
pnpm check:all     # lint, rule probes, edges, architecture, typecheck, Effect diagnostics, unit tests, Storybook
pnpm test          # the unit suite
pnpm test:watch
DATABASE_URL_TEST=postgres://… pnpm test:integration
pnpm test:acceptance
pnpm test:workers  # workerd smoke tests of the server Worker's handlers
```

## Installing dependencies

```sh
pnpm add --filter @org/web <package>
pnpm add -D --filter @org/components <package>
```
