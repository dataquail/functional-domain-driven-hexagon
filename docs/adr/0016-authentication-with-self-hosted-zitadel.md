# ADR-0016: Authentication via self-hosted Zitadel as a server-side BFF

- Status: Accepted
- Date: 2026-04-30

## Context and Problem Statement

The application needs an authentication boundary: a way for a user to prove who they are, and a way for every protected endpoint to know who the caller is without re-establishing trust on every hop. Application code consumes a `CurrentUser` Context tag (`userId` + an `isSuperAdmin` flag); this ADR is the real implementation behind it.

The constraints that mattered:

- **Cost.** Auth0 is the easy answer and the expensive answer. Cognito is cheaper but lock-in heavy and lacking features we'd want (clean OIDC, social providers behind a single switch, SAML later).
- **Graduation.** Whatever we self-host now needs a clean upgrade path to a managed offering of the _same_ product. A repo-template demo that paints itself into a corner is worse than no auth at all.
- **No tokens in the browser.** A SPA holding access + refresh tokens in `sessionStorage`/`localStorage` is the well-known XSS amplifier. We don't ship a template that codifies that pattern.
- **Application-side roles.** Permissions live in our `users` table, not in Zitadel. `CurrentUser` is computed server-side per request from the local row.
- **Hex architecture must hold.** Auth doesn't get to bend the rules — `domain/`, `commands/`, `queries/`, `interface/`, `infrastructure/` discipline applies (ADR-0002).

## Decision

Self-host Zitadel via docker-compose. The server is the OIDC client; the browser never sees an access or id token. `modules/auth/` owns a `Session` aggregate; the auth middleware is implemented in terms of a session cookie the server itself issues.

### Zitadel as the IdP, the server as the Relying Party

Zitadel runs alongside Postgres + Jaeger in `docker-compose.yml`. It owns identity (email, password, MFA, future social/SAML providers), nothing else. It does **not** own roles or app-level permissions — those stay in our DB.

The Zitadel admin user is declared via `FirstInstance` config (`infra/zitadel/zitadel.yaml`); the project + OIDC application are created idempotently by `infra/zitadel/seed.mjs`, which also pre-seeds the admin's local `users` + `auth_identities` rows so the first sign-in finds an existing identity. The OIDC application is a confidential client (`client_secret` lives only on the server) so it can speak the back-channel token exchange.

### BFF: the server holds tokens, the browser holds a session cookie

Login flow: the browser navigates to `GET /auth/login` on **our** server (through Next's `/api/*` rewrite — ADR-0018). The server starts the OIDC dance with PKCE + a signed short-lived `oidc_pkce` cookie and redirects to Zitadel. Zitadel authenticates the user and redirects back to `/auth/callback?code=…`. The server exchanges the code on the back-channel, verifies the id_token via JWKS, runs the `SignIn` command, sets a `session=<uuid>.<hmac>` cookie, and redirects to the app. **The Zitadel access and id tokens are discarded after id_token verification** — we don't make outbound calls as the user, so there's nothing to keep them for; if that need appears, sessions grow a token-storage column.

The session cookie is `HttpOnly; Secure; SameSite=Strict; Path=/`. The OIDC PKCE cookie is `SameSite=Lax` because it must survive Zitadel's cross-site redirect back to `/auth/callback`. Two cookies, two SameSite values, intentionally.

Logout flow: the browser navigates to `GET /auth/logout` (idempotent, public — works even with no live session). The server reads the cookie inline, revokes the `sessions` row, clears the cookie, and 302s to Zitadel's `end_session_endpoint` so the SSO cookie is torn down too. Zitadel redirects to `ZITADEL_POST_LOGOUT_REDIRECT_URI` (`/auth/login`), kicking off a fresh dance; `prompt=login` on the authorize URL means prior accounts don't surface in an account picker.

### `modules/auth/` owns Session

`Session` is an aggregate, not a leaf record. Sliding TTL with an absolute cap (`SESSION_TTL_SECONDS` / `SESSION_ABSOLUTE_TTL_SECONDS`). The aggregate, repository (live + fake), the `SignIn` and `TouchSession` commands, the `findSession` query, and the four endpoints (`login`, `callback`, `me`, `logout`) live under `modules/auth/` per the module conventions (ADR-0002, ADR-0013). A few things sit at platform level:

- `platform/auth/cookie-codec.ts` — generic HMAC sign/verify, used by both the auth module and the auth middleware.
- `platform/middlewares/auth-middleware-live.ts` — the implementation behind the auth middleware. It reads the cookie, dispatches `FindSessionQuery`, dispatches `TouchSessionCommand` (sliding refresh), performs a one-line `users.role` lookup to populate the super-admin flag, and hydrates `CurrentUser`. Authorization checks themselves live in the per-route policy layer (ADR-0021).

### Sliding-TTL refresh via `TouchSessionCommand`

Every authenticated request, after `findSession` succeeds, the middleware dispatches `TouchSessionCommand` through the command bus. The handler:

- Skips the write when the prior `lastUsedAt` is younger than `SESSION_TOUCH_THRESHOLD_SECONDS` (default 60). Without this throttle, a busy client would hammer Postgres with one UPDATE per request for no real-world benefit.
- Computes the new `expiresAt` via the `Session.touch` aggregate function, which clamps to `absoluteExpiresAt` so the hard cap holds.
- Persists via `SessionRepository.updateOne`, whose SQL `WHERE revoked_at IS NULL` guards against touching a session revoked between the query and the command. `SessionNotFound` failures (revoked or deleted mid-flight) are swallowed — the user already has a valid `CurrentUser` for this request, and the next request fails cleanly.

This keeps lifecycle reads (`findSession`) and writes (`TouchSessionCommand`) on opposite sides of CQRS without putting business logic in the middleware.

### Physical eviction via `@org/jobs`

The TTL/revocation logic only governs _validity_ — expired and revoked rows still occupy `auth.sessions` until something physically deletes them. `@org/jobs` runs `purgeExpiredSessions` on an hourly cron (`Schedule.cron("0 * * * *")`, plus one eager run on boot):

```sql
DELETE FROM auth.sessions
WHERE expires_at < now()
   OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
```

The 7-day grace on revoked rows preserves a short audit window ("did this user actually sign out before X happened?"). A Postgres transaction-scoped advisory lock (`pg_try_advisory_xact_lock`) guards the run so concurrent replicas don't race on the DELETE — it auto-releases at transaction end. A second concurrent replica short-circuits with `{ skipped: true }`. `@org/jobs` is its own deployable: it depends on `@org/database` and owns its DELETE SQL directly — it does **not** import `@org/server` or share the auth module's `SessionRepository`. Duplicating one DELETE statement is cheaper than a cross-package domain extraction until a second job needs the same domain.

### Slonik validation actually runs

Slonik stores a query's `resultParser` (StandardSchemaV1) but does not invoke it without an interceptor. `Database.ts`'s `result-parser` interceptor runs the schema's `~standard.validate` on every row, throwing `SchemaValidationError` on issues and returning the validated value otherwise. Row schemas use `Schema.DateTimeUtcFromDate` so reads decode `Date → DateTime.Utc` directly; belt-and-suspenders `typeParsers` convert pg's millis-numbers to `Date` at the slonik layer. Not auth-specific, but session timestamps were the first columns to round-trip the validation path.

## Enforcement

- **`pnpm lint:deps`** — `modules/auth/` follows the standard module rules (ADR-0008). The only auth-specific exception: `platform/middlewares/auth-middleware-live.ts` may import `findSession` and `SessionRepository` from `modules/auth/index.ts` — through the barrel like every other cross-module dependency.
- **`pnpm lint`** — the folder-structure rule requires sibling tests for the `Session` aggregate, both repositories (live + fake), and the endpoint files; `login`/`logout` are the named endpoint-parity exemptions (ADR-0013), covered end-to-end by Playwright + `SessionRepositoryLive` integration tests against a real Zitadel.

## Consequences

- **The browser never holds a token.** Every API request is same-origin (ADR-0018); the session cookie travels automatically. XSS in the client cannot exfiltrate access tokens because there are none.
- **Logout is real logout.** Both our session and Zitadel's SSO session are torn down; without the Zitadel-side teardown, a logout-then-revisit silently re-authenticated.
- **The graduation path is intact.** `OidcClient` depends only on OIDC discovery + JWKS. Pointing `ZITADEL_ISSUER` at Zitadel Cloud requires no code change.
- **Non-admin JIT provisioning and refresh tokens are out of scope for v1.** Non-admin users are pre-seeded or provisioned via an `EnsureUser` path when needed; once a session expires the user is bounced through Zitadel (whose SSO cookie usually makes that silent). If refresh is needed, `sessions` grows a `refresh_token` column and a refresh path lives in the auth module.

## Alternatives considered

- **Auth0 / Clerk / WorkOS hosted auth.** Faster to integrate, weaker on cost and lock-in. The point was to ship a self-hostable template.
- **AWS Cognito.** Cheaper than Auth0, but DX and feature set (passwordless, MFA, custom flows) didn't match Zitadel, and AWS lock-in was the bigger objection.
- **Keycloak.** Rejected because Red Hat's hosted offering is a separate product, not "the same Keycloak in the cloud." Zitadel's `zitadel.cloud` is line-for-line the same software — the graduation property we wanted.
- **Tokens in the browser (`sessionStorage`).** Rejected on XSS grounds. The BFF model trades a small server complexity (a session table, a cookie codec) for not having to argue about storage strategies forever.
- **JIT-provision the admin too.** Rejected because permissions live app-side: a JIT'd admin would land with the default role and nobody could grant the admin role. Pre-seeding the admin row is the v1 boot mechanism.
- **Storing `id_token` to pass as `id_token_hint` on logout.** Cleaner Zitadel logout, but would require a token-storage column we deliberately avoid; `prompt=login` is the workaround.

## Related

- ADR-0002 (module layout) — `modules/auth/` follows the same shape as feature modules.
- ADR-0008 (enforcement) — the mechanism.
- ADR-0013 (HTTP endpoint conventions) — `*.endpoint.ts` per endpoint; `index.ts` registers them.
- ADR-0017 (frontend auth) — the browser-side counterpart.
- ADR-0018 (Next.js renderer) — the same-origin proxy the cookie flows through.
- ADR-0021 (per-route authorization) — how `CurrentUser` is consumed by policy checks.
