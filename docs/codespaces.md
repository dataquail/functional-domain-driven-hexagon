# GitHub Codespaces

A codespace gives each branch its own fully provisioned stack — Postgres (app DB, test DB and Zitadel's DB), Zitadel with a seeded OIDC app and admin user, Flyway-migrated schemas, Mailpit and Jaeger — so several features can be developed in parallel without them fighting over one laptop's ports, database and Zitadel instance.

## Quick start

1. **Code → Create codespace on branch**. Provisioning takes a few minutes on a cold start.
2. When the terminal prints `Dev environment ready`, check whether it also printed **`ACTION REQUIRED — port 8080 could not be published`**. If so, open the **PORTS** panel, right-click port `8080` → **Port Visibility** → **Public**. See [Why port 8080 must be public](#why-port-8080-must-be-public).
3. `pnpm dev` — Next on `:3000`, the BFF on `:3001`.
4. Open the forwarded `:3000` URL and sign in at `/api/auth/login`. Credentials are `ZITADEL_ADMIN_EMAIL` / `ZITADEL_ADMIN_PASSWORD` in `.env` — provisioning deliberately doesn't echo the password, because lifecycle output lands in the codespace creation log.

Everything else is already running: Mailpit on `:8025`, Jaeger on `:16686`, the Zitadel console on `:8080/ui/console`, Postgres on `:5432`.

## What runs where

The dev container is a **service in the repo's own Compose project** ([`.devcontainer/docker-compose.yml`](../.devcontainer/docker-compose.yml) merged over [`docker-compose.yml`](../docker-compose.yml)), joined to `jaeger-network`. So inside the codespace, `postgres`, `zitadel`, `mailpit` and `jaeger` resolve as hostnames, exactly as they do between containers — that is why `.env` there points at `postgres:5432` rather than `localhost:5432`. The app processes you start with `pnpm dev` run in that same container, so `:3000` and `:3001` are plain `localhost`.

Docker itself is reachable (`docker-outside-of-docker`) for `docker logs effect-monorepo-zitadel` and friends, but the stack is **not** driven with `docker compose` from here. Compose run from the workspace resolves the relative bind paths to container-side paths the VM's daemon cannot see; it creates them as empty directories, and because the services use fixed `container_name`s the resulting broken containers replace the working ones — which takes the whole codespace down on its next start. `scripts/local-only.sh` guards the commands that would do it, in two modes: `pnpm bootstrap`, `pnpm auth:*` and `pnpm auth:reset` **refuse**, since you only reach them by typing them; the `Docker: *` and `Auth: Seed` VS Code tasks **skip** with a note, so composite tasks like `Dev: All` still get to `Dev: Servers` instead of dying on their first step.

Codespaces only forwards ports that something is listening on in the _primary_ container. The dev-containers spec has a `"service:port"` form of `forwardPorts` for exactly this case, but Codespaces does not implement it — the entries are ignored silently, and the service never appears in the PORTS panel at all. [`scripts/codespaces-port-forwarder.mjs`](../scripts/codespaces-port-forwarder.mjs), started from `postStartCommand`, therefore listens on 8080/8025/16686/4318/5432 in the dev container and pipes each to its service.

Zitadel's port needs its traffic repaired rather than just relayed, which is why that one is proxied at the HTTP layer while the rest stay raw byte pipes. GitHub's forwarder rewrites the inbound `Host` to `localhost:<port>` and moves the real hostname to `X-Forwarded-Host`. Zitadel sets its `zitadel.useragent` cookie with the domain taken straight from the request's `Host` (`setUserAgent(w, r.Host, …)` in its user-agent middleware), so it would scope that cookie to `localhost`, the browser would drop it as not matching the origin, and every request would then look like a new user agent — which the login UI reports as **User Agent does not correspond (EVENT-adk13)**.

Two consequences worth knowing before changing any of this:

- The proxy can only repair the header if it is the thing the tunnel reaches, so Zitadel must **not** also publish 8080 on the VM. `ZITADEL_HOST_PORT` moves it to 18080 in a codespace.
- The forwarder is started with `setsid`. A plain `&` background job dies with `postStartCommand`'s shell, which leaves 8080 unclaimed and silently sends the tunnel to Zitadel directly.

`ExternalDomain` is a separate concern: it decides which domain `FirstInstance` registers the instance under, so a request carrying the repaired `Host` can be matched to it. It comes from the `ZITADEL_EXTERNAL*` env vars alone — `infra/zitadel/zitadel.yaml` deliberately does not set it. `X-Forwarded-Proto: https` from the forwarder is what makes the discovered issuer `https://`, which is what the server checks it against.

## Why port 8080 must be public

`oidc.client.ts` uses `openid.discovery()`, which **validates that the issuer it discovers equals `ZITADEL_ISSUER`**. Zitadel keys each instance by the host it is reached on and stamps that host into the issuer. So the browser and the server's back channel (token exchange, JWKS) have to reach Zitadel at the _same_ URL — the forwarded `https://<codespace>-8080.app.github.dev`. A private forwarded port answers a server-to-server call with GitHub's authentication wall, which the OIDC client cannot satisfy.

`postStartCommand` tries `gh codespace ports visibility 8080:public` automatically; the token in a codespace often lacks the scope for it, hence the manual fallback.

**This puts a Zitadel on the open internet for the life of the codespace** (at an unguessable URL). Provisioning therefore gives every codespace its own random `ZITADEL_ADMIN_PASSWORD` and `ZITADEL_MASTERKEY` instead of the template's well-known ones. Don't put real data in a codespace Zitadel, and delete codespaces you're done with.

If your organization forbids public ports, the alternative is to keep them private and teach `oidc.client.ts` to split the browser-facing endpoints from the back-channel ones — that trade was considered and rejected here, because it puts dev-only branching in production auth code.

## How provisioning is sequenced

Zitadel's external domain has to be decided _before its first boot_ — `FirstInstance` only fires against a brand-new database. That constrains where each step can live:

| Hook                                                              | Runs                          | Does                                                                                   |
| ----------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| [`initialize.sh`](../.devcontainer/initialize.sh)                 | on the VM, **before** Compose | writes `.env` — codespace URLs, Compose hostnames, generated secrets                   |
| Compose                                                           | container creation            | Postgres (+ both peer DBs), Flyway on the dev and test DBs, Zitadel, Mailpit, Jaeger   |
| [`on-create.sh`](../.devcontainer/on-create.sh)                   | in the container, once        | `pnpm install`, build `@org/contracts`                                                 |
| [`codespaces-provision.mjs`](../scripts/codespaces-provision.mjs) | in the container, every start | waits for Zitadel, reads the bootstrap PAT, runs the seed, writes the client id/secret |

Two constraints are worth knowing before you move anything:

- `CODESPACE_NAME` is available to `initializeCommand` but **not during a prebuild**, so `initialize.sh` falls back to the localhost defaults there.
- Prebuilds run `postCreateCommand`, so Zitadel provisioning lives in `postStartCommand` instead — otherwise a prebuilt Zitadel would be keyed to a domain no codespace actually uses.

## Running the test suites

Unit tests need nothing extra. The integration suite needs the test DB, which Compose has already created and migrated:

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

**Zitadel's login screen shows "User Agent does not correspond (EVENT-adk13)".** Its user-agent cookie is scoped to a domain the browser isn't on, so it never comes back. Check `Domain=` on the `zitadel.useragent` cookie against the host in the address bar; if it says `localhost`, the request reached Zitadel without passing through the Host-rewriting proxy. Confirm something in the dev container is listening on 8080 (`ss -ltn | grep 8080`) and that Zitadel is not also publishing it (`docker port effect-monorepo-zitadel` should show 18080).

**`Failed to build authorize URL: ClientError: unexpected HTTP response status code`.** The server's OIDC discovery is reaching GitHub's port-forwarding error page instead of Zitadel. Either port `8080` isn't forwarded (`gh codespace ports` should list it — if not, the forwarder isn't running: check `/tmp/codespaces-port-forwarder.log`) or it's forwarded but still **private**, so the request hits the authentication wall.

**Sign-in bounces, or the server logs an issuer mismatch.** `ZITADEL_ISSUER` in `.env` doesn't match `https://<codespace>-8080.app.github.dev`.

**`Bootstrap PAT never appeared`.** Zitadel's `FirstInstance` only runs against a brand-new database, so a half-initialized volume never produces one. `docker logs effect-monorepo-zitadel` will say why; rebuilding the codespace is the quickest way back.

**`EACCES: permission denied, open '.../.env'` during provisioning.** `initializeCommand` runs as root on the host while the container runs as `node`, so `.env` has to be handed over deliberately — `initialize.sh` chowns it and rewrites it in place. A workspace left root-owned by an older revision heals on its next start; to unblock one immediately, `sudo chown node:node .env`.

**Provisioning didn't finish.** It's idempotent — re-run `node scripts/codespaces-provision.mjs`.

**The codespace starts into a recovery container**, with `error mounting "/workspaces/…"` in the creation log. Something ran `docker compose` from inside the workspace and left a service pointing at a path that only exists in the dev container. Recreating the codespace is the reliable fix; the guards above exist to stop it happening again.

**Provisioning reports a 3xx while waiting for Zitadel.** It dials Zitadel over plain HTTP on the Compose network while the instance is configured as externally-secure; if a build of Zitadel starts redirecting those to HTTPS, dial the public URL instead:
`ZITADEL_INTERNAL_URL=$ZITADEL_ISSUER node scripts/codespaces-provision.mjs` (port 8080 has to be public first).

**Browser traces don't reach Jaeger.** `NEXT_PUBLIC_OTLP_URL` points at the forwarded `:4318`; make that port public too. Server-side tracing is unaffected — it goes to `jaeger:4318` over the Compose network.

## Prebuilds

Enabling prebuilds (repo **Settings → Codespaces → Set up prebuild**) caches the image, the pnpm store and `node_modules`, which is the slow part of a cold start. Zitadel is deliberately _not_ prebaked, for the domain reason above.

## Related

- [Local development setup](dev-setup.md) — the laptop equivalent, via `pnpm bootstrap`
- [ADR-0016 — Authentication with self-hosted Zitadel](adr/0016-authentication-with-self-hosted-zitadel.md)
- [ADR-0018 — Next.js renderer and proxy](adr/0018-frontend-nextjs-renderer-and-proxy.md)
