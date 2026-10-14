# GitHub Codespaces

A codespace gives each branch its own fully provisioned stack — Postgres (app DB, test DB and the identity DB), migrated schemas, the identity Worker with a seeded OIDC client and admin user, Mailpit and Jaeger — so several features can be developed in parallel without them fighting over one laptop's ports and databases.

## Quick start

1. **Code → Create codespace on branch**. Provisioning takes a few minutes on a cold start.
2. When the terminal prints `Dev environment ready`, check whether it also printed **`ACTION REQUIRED — port 3002 could not be published`**. If so, open the **PORTS** panel, right-click port `3002` → **Port Visibility** → **Public**. See [Why port 3002 must be public](#why-port-3002-must-be-public).
3. `pnpm dev` — Next on `:3000`, the BFF on `:3001`, the identity Worker on `:3002`.
4. Open the forwarded `:3000` URL and sign in at `/api/auth/login`. Credentials are `IDENTITY_ADMIN_EMAIL` / `IDENTITY_ADMIN_PASSWORD` in `.env` — provisioning deliberately doesn't echo the password, because lifecycle output lands in the codespace creation log.

Everything else is already running: Mailpit on `:8025`, Jaeger on `:16686`, Postgres on `:5432`.

## What runs where

The dev container is a **service in the repo's own Compose project** ([`.devcontainer/docker-compose.yml`](../.devcontainer/docker-compose.yml) merged over [`docker-compose.yml`](../docker-compose.yml)), joined to `jaeger-network`. So inside the codespace, `postgres`, `mailpit` and `jaeger` resolve as hostnames, exactly as they do between containers — that is why `.env` there points at `postgres:5432` rather than `localhost:5432`. Everything `pnpm dev` starts — Next, the BFF, and the identity Worker under `alchemy dev` — runs in that same container, so `:3000`, `:3001` and `:3002` are plain `localhost`.

Docker itself is reachable (`docker-outside-of-docker`) for `docker logs effect-monorepo-postgres` and friends, but the stack is **not** driven with `docker compose` from here. Compose run from the workspace resolves the relative bind paths to container-side paths the VM's daemon cannot see; it creates them as empty directories, and because the services use fixed `container_name`s the resulting broken containers replace the working ones — which takes the whole codespace down on its next start. `pnpm bootstrap` refuses to run in a codespace for this reason, and `scripts/local-only.sh` guards the other commands and VS Code tasks that would do it.

Codespaces only forwards ports that something is listening on in the _primary_ container. The dev-containers spec has a `"service:port"` form of `forwardPorts` for exactly this case, but Codespaces does not implement it — the entries are ignored silently. [`scripts/codespaces-port-forwarder.mjs`](../scripts/codespaces-port-forwarder.mjs), started from `postStartCommand` with `setsid` (a plain `&` job dies with the hook's shell), therefore listens on 8025/16686/4318/5432 in the dev container and pipes each to its service.

## Why port 3002 must be public

`oidc.client.ts` uses `openid.discovery()`, which **validates that the issuer it discovers equals `IDENTITY_ISSUER`**. The identity Worker stamps `IDENTITY_BASE_URL` into its issuer, and the browser has to reach it at the forwarded `https://<codespace>-3002.app.github.dev`, so the server's back channel (discovery, token exchange, JWKS) must use that same URL. A private forwarded port answers a server-to-server call with GitHub's authentication wall, which the OIDC client cannot satisfy.

Provisioning tries `gh codespace ports visibility 3002:public` while the Worker is up; the token in a codespace often lacks the scope for it, hence the manual fallback.

**This puts the identity Worker on the open internet for the life of the codespace** (at an unguessable URL). Provisioning therefore replaces the template's well-known `IDENTITY_ADMIN_PASSWORD`, `IDENTITY_SEED_TOKEN` and `IDENTITY_CLIENT_SECRET` with random values per codespace. Don't put real data in a codespace, and delete codespaces you're done with.

## How provisioning is sequenced

| Hook                                              | Runs                          | Does                                                                    |
| ------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Compose                                           | container creation            | Postgres (+ the test DB), Mailpit, Jaeger                               |
| [`on-create.sh`](../.devcontainer/on-create.sh)   | in the container, once        | `pnpm install`, build `@org/contracts`                                  |
| [`post-start.sh`](../.devcontainer/post-start.sh) | in the container, every start | starts the port forwarder, then runs `scripts/codespaces-provision.mjs` |

[`codespaces-provision.mjs`](../scripts/codespaces-provision.mjs) is idempotent:

1. creates `.env` from `.env.example` if missing, generates `SESSION_COOKIE_SECRET` and `BETTER_AUTH_SECRET`, and — in a codespace — points it at the Compose hostnames and the forwarded origins: `APP_URL` and both redirect URIs from `:3000`, `IDENTITY_BASE_URL` and `IDENTITY_ISSUER` (`…/api/auth`) from `:3002`;
2. creates the `effect-monorepo-identity` database;
3. runs `pnpm db:migrate` (app + identity) and the test DB migration;
4. boots the identity Worker with `pnpm dev:cf` just long enough to run `pnpm seed:identity` (over loopback) and publish port 3002, then stops it.

The redirect URIs are `https` on purpose: the seed registers the app as a Better Auth `web` client whenever a redirect URI is not loopback, and Better Auth refuses plain-`http` redirect URIs for web clients.

`CODESPACE_NAME` is not available during a prebuild, and prebuilds run `postCreateCommand` — so provisioning lives in `postStartCommand`, which never runs in a prebuild.

## Running the test suites

Unit tests need nothing extra. The integration suite needs the test DB, which provisioning has already created and migrated:

```sh
pnpm test              # unit
pnpm test:integration  # reads DATABASE_URL_TEST → postgres:5432/effect-monorepo-test
```

## Getting a shell

```sh
gh codespace ssh -c <codespace-name>
```

The `sshd` feature is enabled for this. Use the full name (`gh codespace list`), not the two-word display name. Worth knowing when a lifecycle command fails: the creation log shows the error but not the state that produced it, and the recovery container the codespace falls back to has neither your tooling nor Docker.

## Troubleshooting

**`Failed to build authorize URL: ClientError: unexpected HTTP response status code`.** The server's OIDC discovery is reaching GitHub's port-forwarding error page instead of the identity Worker. Either the Worker isn't running (`pnpm dev` starts it) or port `3002` is still **private**, so the request hits the authentication wall.

**Sign-in bounces, or the server logs an issuer mismatch.** `IDENTITY_ISSUER` in `.env` doesn't equal `IDENTITY_BASE_URL` + `/api/auth`, or `IDENTITY_BASE_URL` isn't `https://<codespace>-3002.app.github.dev`.

**The identity Worker rejects the redirect URI.** `IDENTITY_REDIRECT_URI` / `IDENTITY_POST_LOGOUT_REDIRECT_URI` must be the forwarded `https` `:3000` URL; fix `.env` and re-run provisioning, which re-registers the client.

**`pnpm dev:cf` fails with port 3002 in use.** Another `alchemy dev` is still running (`pkill -f "alchemy dev"`); the port is fixed with `strictPort`.

**Provisioning didn't finish.** It's idempotent — re-run `node scripts/codespaces-provision.mjs`.

**The codespace starts into a recovery container**, with `error mounting "/workspaces/…"` in the creation log. Something ran `docker compose` from inside the workspace and left a service pointing at a path that only exists in the dev container. Recreating the codespace is the reliable fix; the guards above exist to stop it happening again.

**Browser traces don't reach Jaeger.** `NEXT_PUBLIC_OTLP_URL` points at the forwarded `:4318`; make that port public too. Server-side tracing is unaffected — it goes to `jaeger:4318` over the Compose network.

## Prebuilds

Enabling prebuilds (repo **Settings → Codespaces → Set up prebuild**) caches the image, the pnpm store and `node_modules`, which is the slow part of a cold start. Provisioning is deliberately _not_ prebaked: it writes codespace-specific URLs.

## Related

- [Local development setup](dev-setup.md) — the laptop equivalent, via `pnpm bootstrap`
- [ADR-0018 — Next.js renderer and proxy](adr/0018-frontend-nextjs-renderer-and-proxy.md)
