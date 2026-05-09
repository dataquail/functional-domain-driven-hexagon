# Local development setup

Bringing this monorepo up from a fresh clone has more moving parts than a typical Node project: a Postgres app DB, a self-hosted Zitadel for authentication (with its _own_ Postgres), a one-shot seed step that wires the two together, and a couple of generated secrets that have to land in `.env`. The flow below collapses all of that into one command.

## TL;DR

```sh
pnpm install
pnpm bootstrap
pnpm dev      # see Run the app for what `dev` actually starts
```

`pnpm bootstrap` is idempotent — re-running it never overwrites a value that's already populated in `.env`, so it's safe to use as a "did I miss anything?" command too.

If something goes sideways and you'd rather start over: [`pnpm auth:reset` then `pnpm bootstrap`](#start-over).

## Prerequisites

- **Node** 22.13.x (see [package.json](../package.json) → `engines.node`)
- **pnpm** 10.3.x (`corepack enable` then `corepack prepare pnpm@10.3.0 --activate`)
- **Docker** with `docker compose` v2 (Docker Desktop, OrbStack, or Linux engine)

You do **not** need anything Zitadel-related installed on the host. Everything runs in containers.

## What `pnpm bootstrap` does

The script lives at [scripts/dev-bootstrap.mjs](../scripts/dev-bootstrap.mjs). It walks through the nine phases below in order; each phase's effect on disk is described so you can run any step by hand if you need to. The bootstrap script is idempotent at every phase — values already present are left alone.

### 1. Materialize `.env`

```sh
cp .env.example .env    # only if .env doesn't exist
```

The repo ignores `.env` but tracks `.env.example`. The bootstrap copies the template on the first run and then never touches it again. Anything _you_ change later (e.g. a custom `ZITADEL_ADMIN_PASSWORD`) survives subsequent `pnpm bootstrap` runs.

### 2. Generate `SESSION_COOKIE_SECRET`

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This is the HMAC key the server uses to sign session cookies (see [ADR-0016](adr/0016-authentication-with-self-hosted-zitadel.md)). The bootstrap generates 32 random bytes and writes the hex string to `SESSION_COOKIE_SECRET` in `.env`. **If the field already has a value, the bootstrap leaves it alone** — rotating the secret on every setup run would silently invalidate every active session in the local DB.

### 3. Bring up Zitadel

```sh
docker compose up -d zitadel
# equivalent: pnpm auth:up
```

Two containers end up running, with `postgres` pulled in by `zitadel`'s `depends_on` clause:

- `postgres` — the single Postgres 16 instance. It hosts **both** the app DB (`effect-monorepo`) and Zitadel's data (`zitadel`), as peer databases. The init script at [infra/postgres/init/01-create-zitadel-db.sql](../infra/postgres/init/01-create-zitadel-db.sql) runs once on first boot and creates the `zitadel` database alongside the app DB. Database-level isolation is plenty for this app — no need to run a second Postgres just for Zitadel.
- `zitadel` — the Zitadel server itself, mounting [`infra/zitadel/zitadel.yaml`](../infra/zitadel/zitadel.yaml) for configuration. Connects to the `zitadel` database on the same Postgres container.

The compose command passes both `--config` (runtime) and `--steps` (FirstInstance) at the same yaml file. Without `--steps`, Zitadel silently ignores the `FirstInstance` block and the bootstrap PAT below is never generated.

### 4. Wait for Zitadel to be ready

```sh
curl -f http://localhost:8080/debug/ready
```

The bootstrap polls this endpoint every 2s with a 180s deadline. On a cold start Zitadel sometimes loses the race to the DB and exits on its first attempt — `restart: unless-stopped` in compose means it'll come back up automatically, but the wait window has to be patient.

### 5. Wait for the bootstrap PAT

```
infra/zitadel/.machinekey/zitadel-bootstrap.pat
```

`zitadel.yaml` declares a service-user (`bootstrap-bot`) with a long-lived PAT under `FirstInstance.Org.Machine`. Zitadel writes the PAT to the path declared in `FirstInstance.PatPath`, which we bind-mount onto `infra/zitadel/.machinekey/`. This file is the entire reason we don't ask developers to log into the Zitadel console and create a service user by hand.

The directory is gitignored. Re-running setup against an existing Zitadel does nothing here — `FirstInstance` only fires on a brand-new Zitadel database.

### 6. Persist `ZITADEL_BOOTSTRAP_PAT`

The bootstrap reads the file from step 5 and writes it into `.env`. The seed script in step 8 reads either the env var or the file (whichever is present), so this is somewhat redundant — but having the value in `.env` makes the running server able to call back into Zitadel as the bootstrap user if we need that later.

### 7. Wait for the gRPC management API

```sh
curl -fsS -X POST http://localhost:8080/management/v1/projects/_search \
  -H "Authorization: Bearer $(cat infra/zitadel/.machinekey/zitadel-bootstrap.pat)" \
  -H "host: localhost:8080" \
  -d '{}'
```

`/debug/ready` only reflects HTTP server health; the gRPC backend that backs `/management/*` can lag a few seconds behind on cold boots. Without this extra wait the seed sometimes races in and gets a 503 with `transport: connection refused`. The bootstrap polls `/management/v1/projects/_search` with the bootstrap PAT until it returns 200.

### 8. Run the seed

```sh
docker compose --profile seed-zitadel up --abort-on-container-exit seed-zitadel
# equivalent: pnpm auth:seed
```

The seed lives at [`infra/zitadel/seed.mjs`](../infra/zitadel/seed.mjs). It's idempotent and does three things:

1. Creates the `effect-monorepo` Zitadel project + the `effect-monorepo-bff` OIDC application (web app, auth-code + PKCE, basic auth).
2. Looks up the admin human user that `FirstInstance` created and grabs their `sub`.
3. Inserts a corresponding row in the **app DB**'s `users` table (with `role=admin`) and a row in `auth_identities` mapping the Zitadel `sub` to the local `users.id`. This is what lets `SignIn` succeed at first login without JIT-provisioning the admin with the default role.

On its first run (only — the secret can't be re-derived afterward), the seed prints a machine-readable line:

```
__seed__ ZITADEL_CLIENT_ID=<id> ZITADEL_CLIENT_SECRET=<secret>
```

The bootstrap captures this line. On subsequent runs the line is omitted; the script handles that gracefully and doesn't touch `.env`.

### 9. Persist `ZITADEL_CLIENT_ID` + `ZITADEL_CLIENT_SECRET`

Parsed from the `__seed__` line and written to `.env`. If the seed didn't emit one (re-running against an already-configured Zitadel), the existing values in `.env` are left alone.

## Run the app

After `pnpm bootstrap`:

```sh
pnpm --filter @org/server dev    # API on :3001
pnpm --filter @org/client dev    # SPA on :5173, proxies /auth /users /todos to :3001
pnpm --filter @org/web dev       # Next.js renderer on :3000, proxies /api/* to :3001 (optional during migration; see ADR-0018)
```

Sign in at [http://localhost:5173/auth/login](http://localhost:5173/auth/login) using the credentials in `.env` (`ZITADEL_ADMIN_EMAIL` / `ZITADEL_ADMIN_PASSWORD`). The first successful login walks through Zitadel's hosted UI; subsequent logins ride the Zitadel SSO cookie and feel near-silent.

## Start over

Most "Zitadel is acting weird" problems are quickest to fix by tearing down and re-bootstrapping. The reset wipes Zitadel state only — your app DB is untouched.

```sh
pnpm auth:reset    # see scripts/auth-reset.mjs
pnpm bootstrap
```

`pnpm auth:reset` does:

1. `docker compose stop zitadel` — stops Zitadel so it doesn't fight the database drop
2. `docker compose up -d --wait postgres` — ensures Postgres is healthy
3. `psql -c "DROP DATABASE IF EXISTS zitadel WITH (FORCE)"` and `psql -c "CREATE DATABASE zitadel"` — recreates the Zitadel database on the same Postgres container without touching the app DB
4. `docker compose rm -f zitadel` — removes the Zitadel container so a fresh one is created on the next `auth:up`
5. `rm -rf infra/zitadel/.machinekey/` — drops the bootstrap PAT file
6. Clears `ZITADEL_BOOTSTRAP_PAT`, `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET` in `.env` (preserves `SESSION_COOKIE_SECRET` and everything else)

To wipe the **app DB** too (rare — usually only useful for migration testing), run `docker compose down -v` and re-apply migrations via `docker compose --profile migrate up`.

## Troubleshooting

### "Zitadel did not become ready within 180s"

Look at the logs:

```sh
pnpm auth:logs
```

Common causes:

- **Port 8080 already in use** by another local service. Stop it or change the port mapping in [docker-compose.yml](../docker-compose.yml).
- **Zitadel DB connect race fails repeatedly** — usually transient; `restart: unless-stopped` should recover. If it doesn't, `pnpm auth:reset` to start clean.

### "Bootstrap PAT never appeared"

Means Zitadel never wrote `infra/zitadel/.machinekey/zitadel-bootstrap.pat`. The most common reason is that your local Zitadel volume was created _before_ the `FirstInstance.Org.Machine` block was added to `zitadel.yaml` — `FirstInstance` only runs once per Zitadel database. Run `pnpm auth:reset` and retry.

### Seed reports "Errors.Instance.Domain.AlreadyExists"

Zitadel's setup got partway through `FirstInstance` on a previous attempt and is now stuck. `pnpm auth:reset`.

### "OIDC app already existed" (no `__seed__` line)

The seed found `effect-monorepo-bff` already in Zitadel and skipped creation. Zitadel's API doesn't let us re-read the client secret after creation, so if you've lost `ZITADEL_CLIENT_SECRET`, the simplest path is `pnpm auth:reset && pnpm bootstrap`. If you can't reset (e.g. you've made admin-console changes you want to keep), open the Zitadel console at [http://localhost:8080/ui/console](http://localhost:8080/ui/console), navigate to Default Organization → Projects → effect-monorepo → effect-monorepo-bff, and regenerate the secret manually.

### Login UI gets stuck on "2-Factor Setup"

Zitadel's hosted UI prompts every fresh user to set up MFA. The Playwright drivers handle this automatically (see [packages/acceptance/drivers/pages/zitadel-login-page.ts](../packages/acceptance/drivers/pages/zitadel-login-page.ts)); for human logins, click "Skip" once and Zitadel won't ask again for `MFAInitSkipLifetime` (default 30 days).

## Related ADRs

- [0016 — Authentication with self-hosted Zitadel](adr/0016-authentication-with-self-hosted-zitadel.md)
- [0017 — Frontend auth flow](adr/0017-frontend-auth-flow.md)
