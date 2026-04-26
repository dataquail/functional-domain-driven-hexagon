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

## Development

```bash
# Start the server (watch mode, port 3000)
pnpm --filter server dev

# Start the client (Vite, port 5173)
pnpm --filter client dev
```

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
