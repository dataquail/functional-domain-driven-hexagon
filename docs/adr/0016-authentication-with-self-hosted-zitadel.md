# ADR-0016: Authentication via self-hosted Zitadel as a server-side BFF

- Status: Accepted
- Date: 2026-04-30

## Context and Problem Statement

The application needs an authentication boundary: a way for a user to prove they are who they claim to be, and a way for every protected endpoint to know who the caller is without re-establishing trust on every hop. The earlier `UserAuthMiddleware` Tag already pinned the _contract_ (a `CurrentUser` Context tag with `userId` + `permissions`), but the implementation was a stub that hard-coded an admin user. We needed the real thing.

The constraints that mattered:

- **Cost.** Auth0 is the easy answer and the expensive answer. Cognito is cheaper but lock-in heavy and lacking the features we'd want (clean OIDC, social providers behind a single switch, SAML when we get there).
- **Graduation.** Whatever we self-host now needs a clean upgrade path to a managed offering of the same product. A repo-template demo that paints itself into a corner is worse than no auth at all.
- **No tokens in the browser.** A SPA holding access + refresh tokens in `sessionStorage`/`localStorage` is the well-known XSS amplifier. We didn't want to ship a sample template that codifies that pattern.
- **Application-side roles.** Permissions live in our `users` table, not in Zitadel. `CurrentUser.permissions` is computed server-side per request from the local row.
- **Hex architecture must hold.** Auth shouldn't become the module that bends the rules — `domain/`, `commands/`, `queries/`, `interface/`, `infrastructure/` discipline applies.

## Decision

Self-host Zitadel via docker-compose. The server is the OIDC client; the SPA never sees an access or id token. A new `modules/auth/` owns a `Session` aggregate; the existing `UserAuthMiddleware` is reimplemented in terms of a session cookie that the server itself issues.

### Zitadel as the IdP, the server as the Relying Party

Zitadel runs alongside Postgres + Jaeger in `docker-compose.yml`. It owns identity (email, password, MFA, future social/SAML providers), nothing else. It does **not** own roles or app-level permissions — those stay in our DB.

The Zitadel admin user is declared via `FirstInstance` config (`infra/zitadel/zitadel.yaml`); the project + OIDC application are created idempotently by `infra/zitadel/seed.mjs`, which also pre-seeds the admin's local `users` + `auth_identities` rows so the first sign-in finds an existing identity. Non-admin users JIT-provision on first sign-in (Phase: deferred — currently rejected with `Unauthorized` until an `EnsureUser` path is wired).

The OIDC application is a confidential client (`client_secret` lives only on the server) so it can speak the back-channel token exchange.

### BFF: the server holds tokens, the browser holds a session cookie

Login flow: SPA navigates to `GET /auth/login` on **our** server. Server starts the OIDC dance with PKCE + a signed short-lived `oidc_pkce` cookie, redirects to Zitadel. Zitadel authenticates the user, redirects back to `/auth/callback?code=…` (proxied through Vite in dev so the browser sees one origin). Server exchanges the code on the back-channel, verifies the id_token via JWKS, runs the `SignIn` command, sets a `session=<uuid>.<hmac>` cookie, redirects to the SPA. **The Zitadel access and id tokens are discarded after id_token verification.** We don't make outbound calls as the user, so there's nothing to keep them around for; if that need ever appears, sessions can grow a token-storage column.

The session cookie is `HttpOnly; Secure; SameSite=Strict; Path=/`. The OIDC PKCE cookie is `SameSite=Lax` because it must survive Zitadel's cross-site redirect back to `/auth/callback`. Two cookies, two SameSite values, intentionally.

Logout flow: SPA navigates to `GET /auth/logout` (idempotent, public — works even with no live session). Server reads the cookie inline, revokes the `sessions` row, clears the cookie, and 302s to Zitadel's `end_session_endpoint` so the SSO cookie is also torn down. Zitadel redirects to `ZITADEL_POST_LOGOUT_REDIRECT_URI` (`/auth/login`), which kicks off a fresh OIDC dance — Zitadel sees no SSO cookie and prompts for credentials. `prompt=login` is added to the authorize URL so prior accounts don't surface in an account picker.

### `modules/auth/` owns Session

`Session` is an aggregate, not a leaf record. Sliding TTL with an absolute cap (`SESSION_TTL_SECONDS` / `SESSION_ABSOLUTE_TTL_SECONDS`). The aggregate, repository (live + fake), the `SignIn` command, the `findSession` query, and the four endpoints (`login`, `callback`, `me`, `logout`) all live under `modules/auth/` per the existing module conventions (ADR-0002, ADR-0013). A few things sit at platform level rather than inside the module:

- `platform/auth/cookie-codec.ts` — generic HMAC sign/verify, used by both the auth module and the auth middleware.
- `platform/auth/permissions-resolver.ts` — reads `users.role` and maps to `Set<Permission>`. Per-request DB lookup (cacheable later).
- `platform/middlewares/auth-middleware-live.ts` — the real implementation behind `UserAuthMiddleware`. Reads the cookie, calls `findSession`, calls `PermissionsResolver`, hydrates `CurrentUser`. The Tag and contract are unchanged from the stub-era `Policy.ts`.

### Slonik validation actually runs

A separate decision that fell out of this work: Slonik 48 stores a query's `resultParser` (StandardSchemaV1) in the query context but **does not invoke it** without an interceptor. We added `Database.ts`'s `result-parser` interceptor that runs the schema's `~standard.validate` on every row, throwing `SchemaValidationError` on issues and returning the validated/decoded value otherwise. Row schemas use `Schema.DateTimeUtcFromDate` so reads decode `Date → DateTime.Utc` directly; mappers no longer call `DateTime.unsafeFromDate`. Belt-and-suspenders typeParsers convert pg's millis-numbers to Date at the slonik layer so the schema's input contract is honored. This isn't auth-specific, but it surfaced because session timestamps were the first columns to actually round-trip the validation path.

## Enforcement

- **`pnpm lint:deps`** — `modules/auth/` follows the standard module rules (ADR-0008). The only auth-specific exception: `platform/middlewares/auth-middleware-live.ts` may import `findSession` and `SessionRepository` from `modules/auth/index.ts`. No new general rule; the import path stays through the barrel like every other cross-module dependency.
- **`pnpm lint:tests`** — `Session` aggregate, the two repositories (live + fake), and all four endpoint files require sibling tests. The redirect-shaped endpoints (`login`/`callback`/`logout`) use smoke tests with explicit comments; their behavior is covered end-to-end by the Playwright auth-setup project + `login.spec.ts` against a real Zitadel.
- **`pnpm check:all`** — the full gate. Integration tests for the live repos self-skip without `DATABASE_URL_TEST`.

## Consequences

- **The browser never holds a token.** Every API request is same-origin to the SPA's Vite dev server, which proxies to the API. The session cookie travels automatically. XSS in the SPA cannot exfiltrate access tokens because there are none to exfiltrate.
- **Logout is real logout.** Both our session and Zitadel's SSO session are torn down. Without the Zitadel-side teardown, a logout-then-revisit silently re-authenticated.
- **The graduation path is intact.** `OidcClient` depends only on OIDC discovery + JWKS. Pointing `ZITADEL_ISSUER` at Zitadel Cloud requires no code change.
- **Bootstrap PAT is a manual one-time step in dev.** The seed script's error message walks through it. CI would need to automate this — see Phase 7 in the scratch plan; not solved here.
- **The seed's "update existing OIDC app" path is partially broken.** Re-running `pnpm auth:seed` reports `[updated]` but Zitadel doesn't actually pick up the new `postLogoutRedirectUris`. Documented workaround: edit the post-logout URL once in the Zitadel console after first seed. Likely a body-shape mismatch with `UpdateOIDCAppConfig`; not investigated further.
- **CI E2E (`.github/workflows/e2e.yml`) is broken** until a Zitadel container + automated PAT bootstrap are wired into the workflow. Local E2E works.
- **Refresh tokens are not implemented.** Once our session expires, the user is bounced through Zitadel again; Zitadel's SSO cookie usually makes that silent. If/when we need refresh, the `sessions` table grows a `refresh_token` column and a refresh path lives in the auth module.

## Alternatives considered

- **Auth0 / Clerk / WorkOS hosted auth.** Faster to integrate, weaker on cost and lock-in. The point of this exercise was to ship a self-hostable template; a pure SaaS choice would have been worse for that.
- **AWS Cognito.** Cheaper than Auth0, but the developer experience and feature set (especially around passwordless, MFA, custom flows) didn't match what we'd get from Zitadel. Lock-in to AWS-specific concepts was the bigger objection.
- **Keycloak.** Mature, OSS, well-known. Rejected because Red Hat's hosted offering is the only managed path and it's a separate product, not "the same Keycloak in the cloud." Zitadel's `zitadel.cloud` is line-for-line the same software, which is exactly the graduation property we wanted.
- **Tokens in the browser (`sessionStorage`).** Common pattern, well-trod. Rejected on XSS grounds. The BFF model trades a small server complexity (a session table, a cookie codec) for not having to argue about `sessionStorage` vs `localStorage` vs in-memory vs HttpOnly forever.
- **JIT-provision the admin too.** Simpler code path. Rejected because permissions live app-side: a JIT'd admin would land with the default role and there'd be nobody able to grant the admin role to anyone else. Pre-seeding the admin row via the seed script is the v1 boot mechanism; non-admin JIT can be added later (or replaced by a Zitadel Action subscribed to `user.human.email.verified` if we ever need a pre-login row for non-admins).
- **A test-only `POST /auth/test/sign-in` endpoint** to skip the Zitadel UI in Playwright. Initially proposed in the planning doc. Rejected: the user explicitly wanted login to be a real critical-path test, not a fake. The auth-setup project drives the actual hosted UI on every test run.
- **Storing `id_token` to pass as `id_token_hint` on logout.** Cleaner Zitadel logout (no logout-confirm prompt, no need for `prompt=login`). Rejected for v1: would require a token-storage column on `sessions`, and we explicitly chose to discard tokens after callback to keep the session table small. `prompt=login` is the workaround.

## Related

- ADR-0002 (module layout) — `modules/auth/` follows the same shape as feature modules.
- ADR-0008 (depcruise) — the enforcement mechanism.
- ADR-0013 (HTTP endpoint conventions) — `*.endpoint.ts` per endpoint, `<feature>-http-live.ts` registers them.
- ADR-0017 (frontend auth) — the SPA-side counterpart.
