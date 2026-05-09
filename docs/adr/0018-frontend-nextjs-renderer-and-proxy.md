# ADR-0018: Frontend renderer is Next.js; Effect server stays the BFF

- Status: Accepted
- Date: 2026-05-08

## Context and Problem Statement

ADR-0014 (view tiering) and ADR-0017 (frontend auth) describe a Vite/TanStack-Router SPA. As a consulting template, the SPA's largest weakness is optionality: a future engagement that needs SSR (SEO, marketing-adjacent product, slow-network performance work) requires a mid-engagement framework migration. Doing that migration on a clean template now is cheaper than doing it later under a deadline with accumulated feature code.

The decision is _not_ "add SSR." The decision is "pick the renderer that lets us choose CSR or SSR per engagement without changing the architecture."

The forces:

- We already have a working BFF (ADR-0016, ADR-0017): the Effect server runs the OIDC dance and issues an `HttpOnly` session cookie. Replacing it with a Next-based BFF would re-do work that already works.
- The frontend already uses TanStack Query everywhere, and Effect-based queries via `useEffectQuery` (`packages/client/src/lib/tanstack-query/effect-query.ts`). A renderer that natively supports `prefetchQuery` + `<HydrationBoundary>` lets us preserve this surface and graduate routes to SSR per-need.
- The cookie story breaks if Next and Effect are on different origins. `SameSite=Strict` (ADR-0017) means the browser will not attach the cookie cross-site at all; CORS+credentials does not save us.
- We don't want a second auth authority. Two services holding session state means two places that need OIDC SDK, two refresh-token paths, two revocation stories.

## Decision

The frontend renderer becomes Next.js (App Router, deployed as a Node server). Four sub-decisions lock the shape:

### 1. Server-side prefetch + `<HydrationBoundary>` + `useSuspenseQuery` is the default

Each route's `page.tsx` runs `queryClient.prefetchQuery(...)` on the server for the data it owns, dehydrates, and wraps the client subtree in `<HydrationBoundary>`. The leaf component uses `useSuspenseQuery` so the cache is populated before paint and the client never shows an initial spinner for prefetched data.

Plain `useQuery` is allowed only for client-only side data: search-as-you-type, polling, optimistic mutation reads. Mutations stay client-side via `useEffectMutation` and the existing `ApiClient`. Server Actions are not adopted in this pass.

### 2. The Effect server remains the BFF

It owns the OIDC dance with Zitadel, the session cookie, `CurrentUser` (`@org/contracts/Policy`), and the role table. Next.js does **not** terminate auth, does **not** mint its own session, and does **not** hold OIDC tokens. Auth is _through_ Next, not _at_ Next.

The auth-side files in [modules/auth/](packages/server/src/modules/auth/) and [platform/auth/](packages/server/src/platform/auth/) are unchanged. ADR-0016 and ADR-0017 still apply; this ADR amends the SPA-side parts of ADR-0017 (auth guard moves from a client component to a server component) but does not change the trust boundary.

### 3. Next.js is a same-origin proxy in front of the Effect server

A single origin reaches the browser. The browser hits `/<app>` and `/api/*` on the Next origin; Next forwards `/api/*` to the Effect server with the inbound `Cookie` header attached. Consequences:

- **No CORS.** The browser only ever talks to one origin. The Effect server's CORS policy collapses to "internal only."
- **No service-to-service auth between Next and Effect.** The user's session cookie is the only credential. We do not introduce an API key, mTLS, or signed request envelope between the two services.
- **Same cookie scope as today.** The session cookie is `HttpOnly; SameSite=Strict; Path=/` on the public origin. In dev that origin is `localhost:3000` (Next); in prod it is whatever ingress fronts the deployment. The Effect server's `Set-Cookie` flows back through the rewrite unchanged.
- **The dev proxy described in ADR-0017 goes away.** Vite's proxy with the `bypass` trick (return `/index.html` on `Accept: text/html`) is no longer needed. Next's file-system router owns page paths; the rewrite owns `/api/*`.

### 4. OpenTelemetry is wired on Next via `instrumentation.ts`

Next initializes the Node OTEL SDK in [packages/web/src/instrumentation.ts](packages/web/src/instrumentation.ts) on boot, exporting to the same OTLP collector as the Effect server (ADR-0012). W3C trace context propagates so a request entering Next produces a span; the proxied call to the Effect server inherits the trace ID; Jaeger shows browser → Next → Effect as a single trace per request.

The browser SDK from [services/common/web-sdk.ts](packages/client/src/services/common/web-sdk.ts) is preserved on the Next side and points at the same collector. The browser span becomes the parent of the Next span when the browser propagates trace context on `/api/*` calls.

## What this ADR does _not_ change

- **The view-tiering architecture (ADR-0014).** Naked component / Presenter / ViewModel still applies. ViewModels (`*.view-model.ts`) — being framework-agnostic Effect — are reusable on the server runtime as well as the client runtime, but their identity is unchanged.
- **The component library (ADR-0015).** `primitives/` and `patterns/` are unchanged. Storybook continues to run on Vite for the component package.
- **The data-access tier.** `services/data-access/*` files keep publishing the hook / Effect / Observable shapes from a single definition. The Effect shape gets new callers (server components prefetching); the hook shape gets a new sibling (`useSuspenseQuery`-backed); the Observable shape is unchanged.
- **The trust boundary.** Auth is still terminated at the Effect server. Roles still live in `users.role`. Policy still consumes `CurrentUser` from `@org/contracts/Policy`.

## What this ADR does change in earlier ADRs

- **ADR-0017 § "features/\_\_root/auth-guard.tsx"**: the auth guard moves from a client component to a server component in `app/(authed)/layout.tsx`. The check (call `/auth/me`, redirect on 401) is identical; the redirect mechanism becomes `next/navigation` `redirect()` instead of `window.location.assign`. The blank-surface UX during pending/error vanishes because the server doesn't render the authed layout until the check resolves.
- **ADR-0017 § "Same-origin via Vite proxy in dev"**: this section is superseded. Same-origin is achieved by Next.js's `rewrites()` config; the `bypass` callback is no longer needed because Next's file-system router and the `/api/*` rewrite are disjoint by path.
- **ADR-0017 § "ApiClient always sends credentials"**: client-side `ApiClient` keeps `credentials: "include"` (belt-and-suspenders) but its `baseUrl` becomes `/api` (relative) instead of `envVars.API_URL`. A new server-side `ApiClient` variant reads the inbound cookie via `next/headers` and forwards it on outbound calls.

## Enforcement

- **`pnpm lint:deps`** — extend the dependency-cruiser config to enforce that `import "server-only"` is present on `*.server.ts` files and that `*.server.ts` is never imported from a client component. (Implementation lands in Phase 2 of the migration.)
- **`pnpm lint:tests`** — file-existence parity rules in [scripts/check-test-parity.mjs](scripts/check-test-parity.mjs) extend to cover Next file conventions (`page.tsx` → optional integration test, `instrumentation.ts` → exempt). View-model and presenter parity is unchanged.
- **End-to-end coverage** — Playwright suites in [packages/acceptance/](packages/acceptance/) drive Next.js once cutover lands; the existing auth flow tests are the first canary.

## Consequences

- **One framework migration now buys SSR optionality forever.** Future engagements pick "ship as-is" (CSR-effective, SSR-shell) without architectural changes.
- **Hosting changes from "S3 + CDN" to "Node server + CDN."** This is a real cost: a static SPA can be a $5/month CloudFront + S3; a Next.js app needs a runtime. For a one-person consulting template the cognitive consistency of one deploy story is worth the marginal hosting cost.
- **Build matrix grows.** `pnpm build` now produces a Next bundle in addition to the Effect server bundle. CI parallelism matters more.
- **`useSuspenseQuery` shifts the error-handling model.** Today, errors from `useEffectQuery` flow through `useRunner` and surface as toasts (or are silently swallowed by `toastifyErrors: { orElse: false }`). With `useSuspenseQuery`, errors throw and propagate to the nearest `error.tsx` boundary. Each route picks its boundary deliberately; the toast path is still available for client-only `useQuery` callers.
- **Per-request Effect runtime on the server.** `ManagedRuntime` is constructed per request (cached on the request via `React.cache`), not as a module singleton. Module-singleton state would leak between requests and is a source of subtle correctness bugs.
- **The dev experience picks up the App Router learning curve.** Server vs client component boundaries, the `"use client"` directive, request-scoped vs module-scoped state — these are real cognitive overhead that a SPA didn't impose.

## Alternatives considered

- **Stay SPA, keep static export as the deploy target.** Rejected: defers the SSR migration to mid-engagement. The migration cost doesn't shrink — it just lands at a worse time, with more accumulated code to retrofit.
- **TanStack Start instead of Next.js.** Genuinely close call. TSS has less framework opinion about auth (no gravitational pull toward "Next is the BFF") and lets us keep the Effect server as the BFF more naturally. Chosen against because (a) Next is the industry default and clients recognize it, which matters for a template repo positioned for delivery; (b) Next's instrumentation hook and middleware story are more mature for OTEL; (c) the BFF concern goes away as soon as we commit to "Next is a proxy, not an auth authority" — it stops being a force that pulls us toward Next-as-BFF.
- **Make Next.js the BFF; talk to the Effect server with a service token.** Rejected: doubles the auth surface area. Two services holding session state means two refresh paths, two revocation stories, and a service-to-service credential to rotate. The "user's cookie is the only credential" pattern is strictly simpler and no less secure (the Effect server still validates the cookie on every request).
- **`output: 'export'` (static Next).** Rejected: invalidates decision (1). Prefetch + hydrate + suspense requires a server.
- **Server Actions for mutations.** Deferred. They're a useful tool for progressive enhancement but every existing mutation already flows through `useEffectMutation` cleanly. Adopt per-feature when the form-without-JS UX matters; not as a default.

## Related

- ADR-0014 — frontend view-layer tiering (unchanged; ViewModels are now reusable on both runtimes).
- ADR-0015 — frontend component library (unchanged).
- ADR-0016 — server-side authentication via self-hosted Zitadel (unchanged; Effect server remains the BFF).
- ADR-0017 — frontend auth flow (auth guard moves to server component; dev-proxy section superseded; cookie scoping unchanged).
- ADR-0012 — observability via Effect spans and OTLP (extended to cover Next via `instrumentation.ts`).
- [docs/scratch/nextjs-migration-plan.md](docs/scratch/nextjs-migration-plan.md) — phased migration plan that implements this ADR.
