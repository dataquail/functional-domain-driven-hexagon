# ADR-0017: Frontend authentication — server-mediated, no tokens in the client

- Status: Accepted
- Date: 2026-04-30

## Context and Problem Statement

ADR-0016 picked Zitadel as the IdP and put the OIDC dance entirely on the server: the browser never sees an access or id token, only a session cookie. That decision shapes the frontend's auth code: there is no token to manage, no `oidc-client-ts` SDK to import, no refresh-token storage strategy to argue about. What's left for the frontend to own is small but specific — knowing whether the user is signed in, redirecting to the right place when they aren't, and offering a sign-out affordance.

The constraints from the rest of the frontend:

- Components in `features/` may not import Effect runtime primitives or `@tanstack/react-query` directly (ADR-0014). Auth state surfaces through the existing data-access tier.
- Logic that touches React-coupled libraries belongs in `*.presenter.{ts,tsx}`; framework-agnostic logic in `*.view-model.ts`. Both require sibling tests.
- The renderer is Next.js (App Router); the Effect server stays the BFF and Next is a same-origin proxy in front of it (ADR-0018).

## Decision

The frontend owns three things: a query for `/auth/me`, a server-side route guard on the authed layout, and a sign-out button that does a simple navigation. Everything else is a server redirect.

### `services/data-access/auth-queries` — `AuthQueries`

A single file in the data-access tier. Three exports:

- `useCurrentUserQuery()` — calls `GET /auth/me`. The response includes `userId` and the caller's authorization flags (e.g. `isSuperAdmin`). `staleTime: "5 minutes"`. **Crucially:** opts out of the global error toast (`toastifyErrors: { orElse: false }`, `toastifyDefects: false`) — a 401 from this query is the _signal_ that drives the redirect, not a user-facing error.
- `beginLogin` — `Effect.sync(() => window.location.assign("/auth/login"))`.
- `beginLogout` — `Effect.sync(() => window.location.assign("/auth/logout"))`.

There is no mutation, no fetch SDK. Login and logout are both **navigations**, because the server owns the redirect chain (ADR-0016). A `useLogoutMutation` that POSTs, invalidates `/auth/me`, then navigates was rejected: the invalidation triggered an immediate refetch with the just-cleared cookie, which 401'd and raced with the navigation to produce a spurious error toast on every logout. A plain navigation removes that failure mode.

### `app/(authed)/layout.tsx` — server-component guard

The authed route group's layout is a **server component**. It calls `/auth/me` server-side (via the server `ApiClient` variant, which reads the inbound cookie). On 401 it `redirect()`s to `/auth/login` via `next/navigation`; on success it renders children. Because the check runs on the server before the authed layout renders, there is no blank-surface or "Signing you in…" flash — the page simply doesn't render until the check resolves.

### `ApiClient` and same-origin

`ApiClient` provides `FetchHttpClient.RequestInit` with `credentials: "include"` (belt-and-suspenders; same-origin requests attach the cookie anyway). Its client-side `baseUrl` is `/api` (relative); a server-side variant reads the inbound cookie via `next/headers` and forwards it on outbound calls. Same-origin is achieved by Next's `rewrites()` config: the browser hits `/api/*` on the Next origin and Next forwards to the Effect server with the `Cookie` header attached (ADR-0018). The session cookie is `SameSite=Strict`, so the single public origin is what keeps it flowing.

### What the frontend does **not** own

- **No OIDC SDK.** `oidc-client-ts`, `oauth4webapi`, etc. are not dependencies. The server owns the dance.
- **No callback route.** Zitadel redirects to `/auth/callback` on our server, not on the frontend. The browser never sees the OIDC `code`.
- **No token storage.** No `sessionStorage`, `localStorage`, or in-memory token cache. The session cookie is `HttpOnly` and inaccessible to JS.
- **No refresh logic.** When the cookie expires, `/auth/me` 401s, the guard redirects, the OIDC flow re-establishes a session. Zitadel's SSO cookie usually makes that silent.

## Enforcement

- **`pnpm lint:deps`** — `auth-queries` follows the same rule as every other data-access file (ADR-0014): features consume it through the tiering, not directly.
- **`pnpm lint`** — the existing rule banning Effect-runtime imports from `features/**/*.tsx` keeps auth state from being grabbed unsafely from a component.
- **End-to-end coverage** — Playwright drives the real Zitadel hosted UI (`auth-setup` project + `login.spec.ts`). The guard redirect, the cookie, the rewrite, and the data-access layer are all exercised on every test run.

## Consequences

- **The frontend's auth code is small and obvious.** A query, a server-component guard, and a sign-out navigation. No state machine, no token refresh job, no storage lifecycle.
- **Logout actually logs out.** Click sign-out → server revokes session row → 302 to Zitadel `end_session` → SSO cookie cleared → 302 to `/auth/login` → fresh password prompt.
- **`SameSite=Strict` has a small UX cost.** A cross-site deep link (an emailed `https://app/users/42` from another origin) won't carry the cookie on the initial top-level navigation, so the user lands logged-out and bounces through Zitadel. Usually silent; occasionally a flash. Acceptable for an internal-style app.
- **`prompt=login` on every login (ADR-0016) means every authentication shows the password form.** There's no "silent re-auth on the same browser" UX; lifting it requires storing `id_token` and passing `id_token_hint` to `end_session`.

## Alternatives considered

- **`oidc-client-ts` in the frontend.** Rejected — defeats the BFF (ADR-0016), doubles the surface area, and collapses the cookie story.
- **A `useLogoutMutation` that POSTs then redirects.** Rejected after the orphan-refetch toast problem; a plain navigation is simpler and removes the failure mode.
- **Render "Signing you in…" copy in a client guard's pending state.** Rejected — with the server-component guard there is no pending state to render; the page renders only after the check resolves.
- **Skip `SameSite=Strict` and rely on CORS+credentials.** Rejected — SameSite is a real defense layer, the deep-link cost is small, and the same-origin proxy is needed for cookie scoping anyway.

## Related

- ADR-0014 (frontend layering) — auth lives in the data-access tier; the guard is a route-group layout; tiering rules apply.
- ADR-0016 (server-side auth) — the BFF and the contract this ADR is the frontend counterpart to.
- ADR-0018 (Next.js renderer) — the server-component guard and the `/api/*` rewrite this ADR relies on.
