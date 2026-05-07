# ADR-0017: Frontend authentication — server-mediated, no tokens in the SPA

- Status: Accepted
- Date: 2026-04-30

## Context and Problem Statement

ADR-0016 picked Zitadel as the IdP and put the OIDC dance entirely on the server: the SPA never sees an access or id token, only a session cookie. That decision shapes the SPA's auth code: there is no token to manage, no `oidc-client-ts` SDK to import, no refresh-token storage strategy to argue about. What's left for the SPA to own is small but specific — knowing whether the user is signed in, redirecting to the right place when they aren't, and offering a sign-out affordance.

The constraints from the rest of the frontend (ADR-0014):

- Components in `features/` may not import Effect runtime primitives or `@tanstack/react-query` directly. Auth state has to surface through the existing data-access tier.
- Logic that touches React-coupled libraries belongs in `*.presenter.{ts,tsx}`; framework-agnostic logic in `*.view-model.ts`.
- Both presenter and view-model files require sibling tests via `pnpm lint:tests`.

## Decision

The SPA owns three things: a query for `/auth/me`, a route guard wrapping the root layout, and a sign-out button that does a simple navigation. Everything else is a server redirect.

### `services/data-access/auth-queries.tsx` — `AuthQueries` namespace

A single file in the data-access tier. Three exports:

- `useCurrentUserQuery()` — calls `GET /auth/me`. The response includes `userId` and `permissions: ReadonlyArray<Permission>`. `staleTime: "5 minutes"`. **Crucially:** opts out of the global error toast (`toastifyErrors: { orElse: false }`, `toastifyDefects: false`) — a 401 from this query is the _signal_ that drives the redirect, not a user-facing error.
- `beginLogin` — `Effect.sync(() => window.location.assign("/auth/login"))`. Consumed by the route guard.
- `beginLogout` — `Effect.sync(() => window.location.assign("/auth/logout"))`. Consumed by the sign-out button.

There is no mutation, no fetch, no SDK. Login and logout are both **navigations**, because the server owns the redirect chain (see ADR-0016). The previous design used a `useLogoutMutation` that POST'd, then invalidated `/auth/me`, then navigated — and the invalidation triggered an immediate refetch with the just-cleared cookie, which 401'd, which raced with the navigation and produced an "Something went wrong" error toast on every logout. Replacing the mutation with a navigation removed three failure modes at once.

### `features/__root/auth-guard.tsx` — wraps `RootLayout`

The guard renders `useCurrentUserQuery`. If the query is pending or in error, it renders a blank surface (a `<main>` with the background color, no copy — earlier "Signing you in…" copy was misleading during logout). On error it dispatches `beginLogin` exactly once via a `redirectingRef` latch. On success it renders children.

`RootLayout` wraps everything in `<AuthGuard>`.

### `ApiClient` always sends credentials

`packages/client/src/services/common/api-client.ts` provides `FetchHttpClient.RequestInit` with `credentials: "include"`. Same-origin requests would already attach the cookie by default, but `include` is correct for both same-origin (the Vite-proxied dev setup) and any cross-origin configuration. The server's CORS middleware allows the SPA's `APP_URL` specifically (browsers reject `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`).

### Same-origin via Vite proxy in dev

The session cookie is `SameSite=Strict`, which means the browser will not send it on cross-site requests at all. To keep the SPA same-origin with the API in dev, `vite.config.ts` proxies `/auth`, `/users`, `/todos` to `:3000`. The `/users` and `/todos` proxies use a `bypass` callback: when the request `Accept`s `text/html` (a real browser navigation) the proxy returns `/index.html` so Vite serves the SPA and TanStack Router takes over. When the request is a JSON fetch from the SPA, the proxy forwards to the API. Without that, `page.goto("/users")` from Playwright (or a manual page refresh on `/users`) hits the API and renders the JSON 400 instead of the form.

### What the SPA does **not** own

- **No OIDC SDK.** `oidc-client-ts`, `oauth4webapi`, etc. are not dependencies. The server owns the dance.
- **No callback route.** Zitadel redirects to `/auth/callback` on our server, not on the SPA. The SPA never sees the OIDC `code`.
- **No token storage.** No `sessionStorage`, no `localStorage`, no in-memory token cache. The session cookie is `HttpOnly` and inaccessible to JS.
- **No refresh logic.** When the cookie expires, `/auth/me` 401s, the guard redirects, the OIDC flow re-establishes a session. Zitadel's SSO cookie usually makes that silent.

## Enforcement

- **`pnpm lint:deps`** — `services/data-access/auth-queries.tsx` follows the same rule as every other data-access file: features don't import it directly, they import per ADR-0014.
- **`pnpm lint`** — the existing rule banning Effect-runtime imports from `features/**/*.tsx` (ADR-0014) keeps auth state from being grabbed unsafely from a component.
- **End-to-end coverage** — Playwright drives the real Zitadel hosted UI (`auth-setup` project + `login.spec.ts`). The SPA-side `AuthGuard` redirect, the cookie, the proxy, and the data-access layer are all exercised on every test run.

## Consequences

- **The SPA's auth code is small and obvious.** ~80 lines across `auth-queries.tsx`, `auth-guard.tsx`, and the sign-out button. There is no clever state machine, no token refresh job, no storage lifecycle.
- **Logout actually logs out.** Click sign-out → server revokes session row → 302 to Zitadel `end_session` → SSO cookie cleared → 302 to `/auth/login` → fresh password prompt.
- **`SameSite=Strict` has a small UX cost.** A cross-site deep link (someone clicks an emailed `https://app/users/42` from another origin) won't carry the cookie on the initial top-level navigation, so the user lands logged-out and bounces through Zitadel. Usually silent (Zitadel's SSO cookie); occasionally a flash. Acceptable for an internal-style app; revisit only if cross-site deep links become a marketing channel.
- **The dev proxy is a real piece of infrastructure now.** It's not just for cookies — the bypass callback is what makes `/users` work as both a SPA route and an API path. Removing the proxy in production deployments will need a different routing strategy (most likely the API behind `/api/*` or a different host).
- **`prompt=login` on every login (ADR-0016) means every authentication shows the password form.** The SPA-side consequence is that there's no "silent re-auth on the same browser" UX. We accept it for v1; lifting it requires storing `id_token` on the session row and passing `id_token_hint` to `end_session`.

## Alternatives considered

- **`oidc-client-ts` in the SPA.** Standard token-in-browser approach. Rejected — defeats the BFF (ADR-0016). Also doubles the surface area: the SPA would need to hold + refresh tokens, the server would still need to verify them on every request, and the cookie story collapses.
- **A `useLogoutMutation` that POSTs `/auth/logout` then redirects.** Original design. Rejected after we hit the orphan-refetch toast problem described above. The replacement — a plain navigation — is simpler and removes the failure mode entirely.
- **Render "Signing you in…" copy in the guard's pending/error states.** Initially shipped. Rejected after the user pointed out that it shows briefly during _logout_, which is the opposite of what's happening. A blank surface is honest.
- **Skip the SameSite=Strict cookie and rely on CORS+credentials.** Considered to make cross-site deep links seamless. Rejected: SameSite is a real defense layer on top of CSRF tokens, and the deep-link cost is small. Also: the same-origin proxy is needed for cookie scoping anyway.

## Related

- ADR-0014 (frontend layering) — auth lives in the data-access tier; the guard is a feature; tiering rules apply.
- ADR-0016 (server-side auth) — the BFF and the contract this ADR is the SPA-side counterpart to.
