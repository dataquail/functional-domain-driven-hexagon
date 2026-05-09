# functional-domain-driven-hexagon Overview

A monorepo containing four packages:

- `packages/client`: A Vite React application
- `packages/server`: Backend server
- `packages/domain`: Shared domain logic consumed by both client and server
- `packages/database`: Database schema and migrations

## Prerequisites

Install these on your machine:

- **Node 22.14.0** — match `engines.node` in `package.json`. Use whatever version manager you like (`mise`, `fnm`, `nvm`, `asdf`).
- **pnpm 10.3.0** — auto-activated by [corepack](https://nodejs.org/api/corepack.html), which ships with Node. Run `corepack enable` once after installing Node.
- **Docker Desktop** (or any Docker + docker-compose) — runs Postgres, Flyway migrations, and Jaeger.
  - [Install Docker](https://docs.docker.com/get-docker/)

That's it. The server uses [tsx](https://github.com/privatenumber/tsx) (already a dev dependency) to run TypeScript directly, so no extra runtime is needed.

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy the env file (defaults match the docker-compose Postgres)
cp .env.example .env

# 3. Start Postgres + Jaeger (Jaeger UI: http://localhost:16686/search)
docker-compose up -d postgres jaeger

# 4. Run migrations against the dev DB
docker-compose --profile migrate up flyway

# (optional) create + migrate the test DB used by *.integration.test.ts
docker-compose exec postgres psql -U postgres -c 'CREATE DATABASE "effect-monorepo-test"'
docker-compose --profile migrate-test up flyway-test
```

## Authentication (Zitadel)

The server uses [Zitadel](https://zitadel.com) (self-hosted via docker-compose) as the OIDC identity provider. The SPA never holds an access or id token; the server is the OIDC client and issues a `HttpOnly` session cookie. See [ADR-0016](docs/adr/0016-authentication-with-self-hosted-zitadel.md) for the full design and [ADR-0017](docs/adr/0017-frontend-auth-flow.md) for the SPA side.

```bash
# 1. Boot Zitadel + its Postgres
pnpm auth:up

# 2. Wait ~30s for first init, then complete the one-time PAT bootstrap.
#    Open http://localhost:8080/ui/console
#    Sign in as admin@example.com / ChangeMe!1
#    Default Org → Service Users → New
#      Username: bootstrap-bot, Access Token Type: Bearer
#    On the new service user → Personal Access Tokens → New (copy the token)
#    Default Org → Members → Add Member: bootstrap-bot, role ORG_OWNER
#    Save the token to .env as ZITADEL_BOOTSTRAP_PAT=<token>

# 3. Generate a session cookie secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Save that into .env as SESSION_COOKIE_SECRET

# 4. Seed the OIDC project + app and the admin row in the dev DB
pnpm auth:seed
# Paste the printed ZITADEL_CLIENT_ID and ZITADEL_CLIENT_SECRET into .env

# 5. Restart the server so it picks up the new env vars
pnpm --filter server dev
```

After signing in once at `http://localhost:5173/auth/login`, the session cookie is set on the SPA origin and protected endpoints work normally.

**Known quirk:** the seed script's "update existing OIDC app" path reports `[updated]` but Zitadel doesn't actually pick up the new `postLogoutRedirectUris` on a re-run. If you change `ZITADEL_POST_LOGOUT_REDIRECT_URI` in `.env`, also update the URL manually once in the Zitadel console (Default Org → Projects → effect-monorepo → effect-monorepo-bff → URLs → Post-logout URLs).

**Acceptance tests** (Playwright) drive the real Zitadel hosted UI on every run — make sure `pnpm auth:up && pnpm auth:seed` have completed and dev servers on `:3000` / `:3001` / `:5173` are stopped before running `pnpm test:acceptance`. CI E2E (`.github/workflows/e2e.yml`) does not yet provision Zitadel; tracked as a follow-up.

## Development

```bash
# Start the Effect server (watch mode, port 3001)
pnpm --filter server dev

# Start the existing SPA client (Vite, port 5173)
pnpm --filter client dev

# Start the Next.js renderer (port 3000, proxies /api/* to the Effect server)
pnpm --filter @org/web dev
```

Port 3000 belongs to the Next.js renderer (browser-facing); the Effect server moved to 3001 and is reached via Next's `/api/*` rewrite. See [ADR-0018](docs/adr/0018-frontend-nextjs-renderer-and-proxy.md). The existing SPA at `:5173` continues to talk to the Effect server through Vite's proxy and remains the primary surface until Phase 6 cutover.

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
pnpm --filter client build
pnpm --filter server build
pnpm --filter domain build
pnpm --filter database build
```

### Installing Dependencies

To add dependencies to a specific package:

```sh
# Add a production dependency
pnpm add --filter client react-router-dom

# Add a development dependency
pnpm add -D --filter client @types/react
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
