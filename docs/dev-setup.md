# Local development setup

Bringing this monorepo up from a fresh clone has a few moving parts: a Postgres with the app, test and identity databases, the identity Worker (Better Auth, the OIDC issuer) running under `alchemy dev`, a seed that registers the app with it and creates an admin, and a couple of generated secrets that have to land in `.env`. The flow below collapses all of that into one command.

## TL;DR

```sh
pnpm install
pnpm bootstrap
pnpm dev      # alchemy dev: web Worker :3000, server Worker :3001, identity Worker :3002
```

`pnpm bootstrap` is idempotent — re-running it never overwrites a value that's already populated in `.env`, so it's safe to use as a "did I miss anything?" command too.

## Prerequisites

- **Node** 24 — [.nvmrc](../.nvmrc) pins 24.21.0
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

Postgres 16 hosts the app DB (`effect-monorepo`) and, from [infra/postgres/init/](../infra/postgres/init), the test DB. Mailpit is the local mail sink (UI on :8025): the server and the identity Worker both send through its HTTP API. Jaeger collects traces (UI on :16686).

### 4. Ensure the identity database

```sh
docker compose exec -T postgres psql -U postgres -c 'CREATE DATABASE "effect-monorepo-identity"'
```

Creates the identity Worker's database on the same Postgres when it is missing, and writes `IDENTITY_DATABASE_URL` into `.env` if it is not there yet. Under `alchemy dev` the identity Hyperdrive passes straight through to it.

### 5. Migrate the databases

```sh
pnpm db:migrate
pnpm --filter @org/database db:migrate:test
```

`db:migrate` applies the app's migrations (tracked in `effect_sql_migrations`, ADR-0011) and then Better Auth's against the identity database. The test DB is migrated too, because the integration suite reads `DATABASE_URL_TEST`. Idempotent.

### 6. Seed the identity Worker

```sh
pnpm dev             # in another terminal, if it isn't running
pnpm seed:identity
```

The bootstrap boots the Workers stack just long enough for the seed. [scripts/seed-identity.mjs](../scripts/seed-identity.mjs) calls the identity Worker's seed endpoint (open only when `IDENTITY_SEED_TOKEN` is set) to register the app as a trusted OIDC client with `IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET` and create the admin (`IDENTITY_ADMIN_EMAIL` / `IDENTITY_ADMIN_PASSWORD`) with a verified email, then records the admin in the app DB as a super-admin. Re-running resets the admin's password to the one in `.env`.

## Run the app

```sh
pnpm dev
```

starts the Workers stack under `alchemy dev`: the SvelteKit web Worker on :3000, whose `/api/*` proxy reaches the server Worker on :3001 over a service binding, and the identity Worker on :3002 (ADR-0035, ADR-0037). There is no Node server process. Sign in at [http://localhost:3000/api/auth/login](http://localhost:3000/api/auth/login) as the admin, or create an account there: sign-up is open behind email verification, and the link lands in Mailpit.

## Run the Workers stack

The Cloudflare side of the stack lives in [packages/infra](../packages/infra) and is run by Alchemy: the databases' Hyperdrive configurations, the domain-event queue and its dead-letter queue, the server Worker whose code is [packages/server/src/platform/worker/main.ts](../packages/server/src/platform/worker/main.ts), the identity Worker whose code is [packages/identity](../packages/identity), and the SvelteKit Worker built from [packages/web](../packages/web).

Under `alchemy dev` no Cloudflare or Neon resource is created and no credentials are read: Hyperdrive passes straight through to the docker Postgres named by `DATABASE_URL` (and `IDENTITY_DATABASE_URL`), the queues run in Alchemy's local broker (in memory, so a restart drops what is in flight), and state is kept in `packages/infra/.alchemy/`. Alchemy keeps a dev sidecar running between invocations; stop the whole process group with SIGINT, or it keeps :3001 and :3002.

Both crons fire on schedule, and any Worker's dev URL triggers one on demand:

```sh
curl 'http://localhost:3001/cdn-cgi/handler/scheduled?cron=*+*+*+*+*'   # the outbox sweep
curl 'http://localhost:3001/cdn-cgi/handler/scheduled?cron=0+*+*+*+*'   # the session purge
```

`pnpm test:workers` boots the same stack with Alchemy's test harness and drives the server Worker's `fetch`, `queue` and `scheduled` handlers over HTTP. It needs the docker Postgres and free dev ports, so stop `pnpm dev` first.

## Deploying

Stages deploy from GitHub Actions (ADR-0039): `preview.yml` deploys `pr-<n>` for a pull request labelled `preview` and destroys it when the label goes or the pull request closes; `deploy.yml` deploys `staging` and then `prod` after every green CI run on `main`; `kill-switch.yml` applies `KILL_SWITCH` to the zone at once. Each deploy runs the [deploy-stage](../.github/actions/deploy-stage/action.yml) action: `alchemy deploy --stage <s> --yes`, then the stack's outputs into the job's environment (`scripts/stage-env.mjs`), then `pnpm db:migrate` against the stage's direct database URLs.

### One-time setup

1. **The zone.** `APP_DOMAIN` must be a zone fully on Cloudflare, on a paid plan (Pro or above) for the hostname-matching rate limit and the usage alert. Prod serves `app.<domain>` / `auth.<domain>`, staging `app.staging.<domain>` / `auth.staging.<domain>`; Alchemy creates the DNS records and certificates.
2. **Email Sending.** Onboard the domain of `MAIL_FROM_ADDRESS` to Cloudflare Email Service (Workers Paid plan).
3. **The state store.** Once, with credentials for the account: `pnpm -F @org/infra exec alchemy provider cloudflare bootstrap`.
4. **GitHub environments** `preview`, `staging` and `production`; give `production` its required reviewers.
5. **Variables and secrets.** Set these per environment (variables in plain type, secrets in italics):

   | Name                                                                                                | preview | staging | production        |
   | --------------------------------------------------------------------------------------------------- | ------- | ------- | ----------------- |
   | `CLOUDFLARE_ACCOUNT_ID`, _`CLOUDFLARE_API_TOKEN`_, _`NEON_API_KEY`_                                 | ✓       | ✓       | ✓                 |
   | `CLOUDFLARE_WORKERS_SUBDOMAIN` (the account's `workers.dev` subdomain)                              | ✓       |         |                   |
   | `APP_DOMAIN`                                                                                        |         | ✓       | ✓                 |
   | _`BETTER_AUTH_SECRET`_, _`SESSION_COOKIE_SECRET`_, `IDENTITY_CLIENT_ID`, _`IDENTITY_CLIENT_SECRET`_ | ✓       | ✓       | ✓                 |
   | `IDENTITY_ADMIN_EMAIL`, _`IDENTITY_ADMIN_PASSWORD`_                                                 | ✓       | ✓       | ✓                 |
   | _`IDENTITY_SEED_TOKEN`_                                                                             | ✓       | ✓       | first deploy only |
   | _`STRIPE_SECRET_KEY`_, _`STRIPE_WEBHOOK_SECRET`_, `STRIPE_PRICE_ID_DEFAULT`                         | ✓       | ✓       | ✓                 |
   | `MAIL_FROM_ADDRESS`, `MAIL_DAILY_CAP` (optional, default 200)                                       | ✓       | ✓       | ✓                 |
   | `USAGE_ALERT_EMAIL`, `USAGE_ALERT_PRODUCT`, `USAGE_ALERT_LIMIT`                                     |         |         | ✓                 |
   | `USAGE_ALERT_WEBHOOK_URL`, _`USAGE_ALERT_WEBHOOK_SECRET`_ (optional)                                |         |         | ✓                 |

   `KILL_SWITCH` is a **repository** variable, read by staging's smoke test and by every prod deploy. `USAGE_ALERT_PRODUCT` and `USAGE_ALERT_LIMIT` take the values the account's `GET /accounts/{id}/alerting/v3/available_alerts` lists for `billing_usage_alert`.

6. **First deploys, in order.** Run `deploy.yml` by hand (`workflow_dispatch`): staging first, since every preview branches staging's databases, then approve prod. Once prod's seed step has registered the app's client and admin, delete prod's `IDENTITY_SEED_TOKEN`; the next deploy closes the seed endpoint.

### The kill switch

Set the repository variable `KILL_SWITCH=true` and run `kill-switch.yml`: it deploys only the zone's kill-switch rule, which blocks every app and identity host, prod's and staging's. Set it back to `false` and run it again to lift the block. Because every prod deploy applies the same variable, an ordinary deploy never lifts the switch by accident.

### By hand

A deploy from a laptop needs the same environment as CI (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, or `alchemy login`; `NEON_API_KEY`; every value above):

```sh
pnpm deploy:cf --stage dev_$USER    # schema-only Neon branches of staging, their Hyperdrives, the queues, the Workers
pnpm destroy:cf --stage dev_$USER
```

`pnpm deploy` is pnpm's own command, hence `deploy:cf`. To migrate a deployed database by hand, point `pnpm db:migrate` at its **direct** (not pooled) URLs; the migrators connect over TLS when the URL says `sslmode=require`:

```sh
DATABASE_URL='postgresql://…app…?sslmode=require' IDENTITY_DATABASE_URL='postgresql://…identity…?sslmode=require' pnpm db:migrate
```

Deployed stages export no Effect spans; Workers Observability carries their logs and traces (ADR-0039).

## Start over

The identity Worker's state is its own database. To start it clean, drop and recreate it, then migrate and seed again:

```sh
docker compose exec -T postgres psql -U postgres -c 'DROP DATABASE IF EXISTS "effect-monorepo-identity" WITH (FORCE)'
pnpm bootstrap
```

To wipe everything, `docker compose down -v` and run `pnpm bootstrap` again.

## Troubleshooting

### "The identity Worker is not reachable"

`pnpm seed:identity` needs the Workers stack running (`pnpm dev`). The acceptance suite boots its own, so it needs :3000–:3002 free — the dev ports are fixed.

### Sign-in says "Invalid email or password" for the admin

The admin's password is whatever the last seed set. Run `pnpm seed:identity` again to reset it to `IDENTITY_ADMIN_PASSWORD`.

### The token exchange fails with `invalid_client`

The server's `IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET` no longer match the client the identity Worker holds. The seed keeps an existing client's secret, so after changing the secret drop the identity database (see [Start over](#start-over)) and re-seed.

## Deploying to AWS

`packages/infra/aws.run.ts` deploys the same application to AWS (ADR-0041). It is deploy-only — `pnpm dev`
stays on the Cloudflare stack — and nothing in CI runs it. Its state lives in an S3 bucket Alchemy creates in
the account.

```sh
AWS_REGION=us-east-2 pnpm deploy:aws --stage staging   # beside Neon's aws-us-east-2
pnpm destroy:aws --stage staging
```

It reads the AWS credentials from the usual environment or profile, and beside them:

| Variable                                                                                           | What it is                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `APP_DOMAIN`                                                                                       | every stage answers on `app.<stage>.` / `auth.<stage>.` of it (bare for `prod`) |
| `AWS_HOSTED_ZONE_ID`                                                                               | the Route 53 zone of `APP_DOMAIN`: certificates, aliases and SES's DKIM records |
| `NEON_API_KEY`                                                                                     | as for the Cloudflare stack                                                     |
| `BETTER_AUTH_SECRET`, `IDENTITY_CLIENT_ID`, `IDENTITY_CLIENT_SECRET`, `SESSION_COOKIE_SECRET`      | as for the Cloudflare stack                                                     |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_DEFAULT`                            | as for the Cloudflare stack                                                     |
| `MAIL_FROM_ADDRESS`, `IDENTITY_MAIL_FROM_ADDRESS` (and optionally the `*_NAME`s, `MAIL_DAILY_CAP`) | senders under `APP_DOMAIN`, which SES verifies                                  |
| `IDENTITY_SEED_TOKEN` (optional)                                                                   | opens the issuer's seed endpoint, as on Cloudflare                              |

The stack's outputs carry the direct database URLs, so the migrate step is the Cloudflare one:
`pnpm -F @org/infra exec alchemy state read hexagon-aws/<stage>/output --backend aws | node scripts/stage-env.mjs`,
then `pnpm db:migrate`. SES starts in its sandbox, so until the account has production access only verified
recipients get mail.

## Related ADRs

- [0034 — The identity Worker: Better Auth as the OIDC issuer](adr/0034-identity-worker-with-better-auth.md)
- [0035 — The server on Cloudflare Workers](adr/0035-server-on-cloudflare-workers.md)
- [0017 — Frontend auth flow](adr/0017-frontend-auth-flow.md)
- [0037 — The SvelteKit renderer on Workers](adr/0037-sveltekit-renderer-on-workers.md)
- [0038 — Postgres on Neon, reached through Hyperdrive](adr/0038-neon-behind-hyperdrive.md)
- [0039 — The deploy pipeline, its stages, and its limits](adr/0039-deploy-pipeline-stages-and-limits.md)
- [0041 — AWS as a second host](adr/0041-aws-as-a-second-host.md)
