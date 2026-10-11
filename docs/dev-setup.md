# Local development setup

Bringing this monorepo up from a fresh clone has a few moving parts: a Postgres with the app, test and identity databases, the identity Worker (Better Auth, the OIDC issuer) running under `alchemy dev`, a seed that registers the app with it and creates an admin, and a couple of generated secrets that have to land in `.env`. The flow below collapses all of that into one command.

## TL;DR

```sh
pnpm install
pnpm bootstrap
pnpm dev      # server :3001, web :3000, identity Worker :3002
```

`pnpm bootstrap` is idempotent — re-running it never overwrites a value that's already populated in `.env`, so it's safe to use as a "did I miss anything?" command too.

Prefer not to run any of it on your laptop? A codespace does all of the below
on creation — see [codespaces.md](codespaces.md).

## Prerequisites

- **Node** 22.15 or newer on the 22 line — [.nvmrc](../.nvmrc) pins 22.21.1 (Alchemy's CLI needs `module.registerHooks`, new in 22.15)
- **pnpm** 10.3.x (`corepack enable` then `corepack prepare pnpm@10.3.0 --activate`)
- **Docker** with `docker compose` v2 (Docker Desktop, OrbStack, or Linux engine)

## What `pnpm bootstrap` does

The script lives at [scripts/dev-bootstrap.mjs](../scripts/dev-bootstrap.mjs). It walks through the six phases below in order; each is described so you can run it by hand.

### 1. Materialize `.env`

```sh
cp .env.example .env    # only if .env doesn't exist
```

The repo ignores `.env` but tracks `.env.example`. The bootstrap copies the template on the first run and then never touches it again; anything you change later survives subsequent runs.

### 2. Generate `SESSION_COOKIE_SECRET` and `BETTER_AUTH_SECRET`

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_COOKIE_SECRET` is the HMAC key the server signs session cookies with; `BETTER_AUTH_SECRET` signs everything the identity Worker issues. Each is generated only when empty — rotating either on every run would silently end every local session.

### 3. Bring up Postgres, Mailpit and Jaeger

```sh
docker compose up -d --wait postgres mailpit jaeger
```

Postgres 16 hosts the app DB (`effect-monorepo`) and, from [infra/postgres/init/](../infra/postgres/init), the test DB. Mailpit is the local mail sink (UI on :8025): the server sends over SMTP, the identity Worker through its HTTP send API. Jaeger collects traces (UI on :16686).

### 4. Ensure the identity database

```sh
docker compose exec -T postgres psql -U postgres -c 'CREATE DATABASE "effect-monorepo-identity"'
```

Creates the identity Worker's database on the same Postgres when it is missing, and writes `IDENTITY_DATABASE_URL` into `.env` if it is not there yet. Under `pnpm dev:cf` the identity Hyperdrive passes straight through to it.

### 5. Migrate the databases

```sh
pnpm db:migrate
pnpm --filter @org/database db:migrate:test
```

`db:migrate` applies the app's migrations (tracked in `effect_sql_migrations`, ADR-0011) and then Better Auth's against the identity database. The test DB is migrated too, because the integration suite reads `DATABASE_URL_TEST`. Idempotent.

### 6. Seed the identity Worker

```sh
pnpm dev:cf          # in another terminal, if it isn't running
pnpm seed:identity
```

The bootstrap boots `pnpm dev:cf` just long enough for the seed. [scripts/seed-identity.mjs](../scripts/seed-identity.mjs) calls the identity Worker's seed endpoint (open only when `IDENTITY_SEED_TOKEN` is set) to register the app as a trusted OIDC client with `IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET` and create the admin (`IDENTITY_ADMIN_EMAIL` / `IDENTITY_ADMIN_PASSWORD`) with a verified email, then records the admin in the app DB as a super-admin. Re-running resets the admin's password to the one in `.env`.

## Run the app

```sh
pnpm dev
```

starts the BFF on :3001, the Next renderer on :3000 (`/api/*` rewrites to :3001, ADR-0018) and the Workers stack — with the identity Worker on :3002 — under `alchemy dev`. Sign in at [http://localhost:3000/api/auth/login](http://localhost:3000/api/auth/login) as the admin, or create an account there: sign-up is open behind email verification, and the link lands in Mailpit.

## Run the Workers stack

The Cloudflare side of the stack lives in [packages/infra](../packages/infra) and is run by Alchemy: the databases' Hyperdrive configurations, the domain-event queues, a placeholder Worker, and the identity Worker whose code is [packages/identity](../packages/identity).

```sh
pnpm dev:cf         # alchemy dev: everything in workerd and local emulators, nothing in the cloud
pnpm dev:cf:check   # boots it, asks the placeholder Worker for SELECT 1, shuts it down
```

Under `alchemy dev` no Cloudflare or Neon resource is created and no credentials are read: Hyperdrive passes straight through to the docker Postgres named by `DATABASE_URL` (and `IDENTITY_DATABASE_URL`), the queues run in Alchemy's local broker, and state is kept in `packages/infra/.alchemy/`. Alchemy keeps a dev sidecar running between invocations; stop it with the process group if a port stays taken.

### Deploying a stage

Deploying creates real Cloudflare and Neon resources, so it needs credentials (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, or `alchemy login`; `NEON_API_KEY`):

```sh
pnpm deploy:cf --stage staging         # once: owns the staging Neon projects every preview branches from
pnpm deploy:cf --stage dev_$USER       # schema-only Neon branches of staging, their Hyperdrives, the queues
pnpm destroy:cf --stage dev_$USER
```

`prod` and `staging` own their Neon projects and keep them if the stack is removed; every other stage gets a branch of staging's projects that expires a week after its last deploy. `pnpm deploy` is pnpm's own command, hence `deploy:cf`.

To migrate a deployed database, point `pnpm db:migrate` at its **direct** (not pooled) URL; the driver reads `sslmode=require` from the URL:

```sh
DATABASE_URL='postgresql://…neon.tech/neondb?sslmode=require' pnpm db:migrate
```

`db:migrate` runs `db:migrate:app` and then `db:migrate:identity` (Better Auth's migrations against `IDENTITY_DATABASE_URL`), so a deployed stage needs both direct URLs:

```sh
DATABASE_URL='postgresql://…app…?sslmode=require' IDENTITY_DATABASE_URL='postgresql://…identity…?sslmode=require' pnpm db:migrate
```

A deployed identity Worker takes `BETTER_AUTH_SECRET`, `IDENTITY_BASE_URL` and `APP_URL` from the deploy environment, and sends mail through the Cloudflare Email binding (Email Sending is in beta and needs the Workers Paid plan). Leave `IDENTITY_SEED_TOKEN` unset there: without it the seed endpoint does not exist.

## Start over

The identity Worker's state is its own database. To start it clean, drop and recreate it, then migrate and seed again:

```sh
docker compose exec -T postgres psql -U postgres -c 'DROP DATABASE IF EXISTS "effect-monorepo-identity" WITH (FORCE)'
pnpm bootstrap
```

To wipe everything, `docker compose down -v` and run `pnpm bootstrap` again.

## Troubleshooting

### "The identity Worker is not reachable"

`pnpm seed:identity` and the acceptance suite need `pnpm dev:cf` running. If it is, check that :3002 is free — the identity Worker's dev port is fixed.

### Sign-in says "Invalid email or password" for the admin

The admin's password is whatever the last seed set. Run `pnpm seed:identity` again to reset it to `IDENTITY_ADMIN_PASSWORD`.

### The token exchange fails with `invalid_client`

The server's `IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET` no longer match the client the identity Worker holds. The seed keeps an existing client's secret, so after changing the secret drop the identity database (see [Start over](#start-over)) and re-seed.

## Related

- [GitHub Codespaces](codespaces.md) — the same environment, provisioned on creation

## Related ADRs

- [0034 — The identity Worker: Better Auth as the OIDC issuer](adr/0034-identity-worker-with-better-auth.md)
- [0017 — Frontend auth flow](adr/0017-frontend-auth-flow.md)
