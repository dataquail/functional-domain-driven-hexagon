# ADR-0018: Frontend renderer is Next.js; the Effect server stays the BFF

- Status: Accepted
- Date: 2026-05-08

## Context and Problem Statement

The frontend is a renderer with a single job: render pages and proxy API calls to the Effect server. As a consulting template, the largest weakness of a static CSR-only SPA is optionality: an engagement that needs SSR (SEO, marketing-adjacent product, slow-network performance work) would require a framework migration mid-engagement. Choosing a renderer that supports CSR _or_ SSR per engagement without changing the architecture avoids that.

The decision is _not_ "add SSR." It is "pick the renderer that lets us choose CSR or SSR per engagement without changing the architecture."

The forces:

- We already have a working BFF (ADR-0016, ADR-0017): the Effect server runs the OIDC dance and issues an `HttpOnly` session cookie. Replacing it with a renderer-based BFF would re-do work that already works.
- The frontend uses TanStack Query everywhere, via Effect-aware hooks (`useEffectMutation` + `useEffectSuspenseQuery` in `packages/web/lib/tanstack-query/`). A renderer that natively supports `prefetchQuery` + `<HydrationBoundary>` preserves this surface and lets routes graduate to SSR per-need.
- The cookie story breaks if the renderer and the Effect server are on different origins. `SameSite=Strict` (ADR-0017) means the browser will not attach the cookie cross-site; CORS+credentials does not save us.
- We don't want a second auth authority. Two services holding session state means two OIDC SDKs, two refresh paths, two revocation stories.

## Decision

The frontend renderer is **Next.js (App Router, deployed as a Node server)**. Four sub-decisions lock the shape.

### 1. Server-side prefetch + `<HydrationBoundary>` + `useSuspenseQuery` is the default

Each route's `page.tsx` runs `prefetchEffectQuery(...)` on the server for the data it owns, dehydrates, and wraps the client subtree in `<HydrationBoundary>`. The leaf component uses `useEffectSuspenseQuery` so the cache is populated before paint and the client never shows an initial spinner for prefetched data. Plain `useQuery` is allowed only for client-only side data (search-as-you-type, polling, optimistic reads). Mutations stay client-side via `useEffectMutation`. Server Actions are not adopted.

### 2. The Effect server remains the BFF

It owns the OIDC dance with Zitadel, the session cookie, `CurrentUser`, and the role table. Next.js does **not** terminate auth, mint its own session, or hold OIDC tokens. Auth is _through_ Next, not _at_ Next. The auth-side files in `modules/auth/` and `platform/auth/` are unchanged; the trust boundary is the Effect server.

### 3. Next.js is a same-origin proxy in front of the Effect server

A single origin reaches the browser. The browser hits page paths and `/api/*` on the Next origin; Next forwards `/api/*` to the Effect server via `rewrites()` with the inbound `Cookie` header attached. Consequences:

- **No CORS.** The browser only ever talks to one origin; the Effect server's CORS policy collapses to "internal only."
- **No service-to-service auth between Next and Effect.** The user's session cookie is the only credential — no API key, mTLS, or signed envelope between the two services.
- **Same cookie scope.** The session cookie is `HttpOnly; SameSite=Strict; Path=/` on the public origin (dev: `localhost:3000`; prod: whatever ingress fronts the deployment). The Effect server's `Set-Cookie` flows back through the rewrite unchanged.
- Next's file-system router owns page paths; the rewrite owns `/api/*`; the two are disjoint by path.

### 4. OpenTelemetry is wired on Next via `instrumentation.ts`

Next initializes the Node OTEL SDK in `packages/web/instrumentation.ts` on boot (`@vercel/otel`), exporting to the same OTLP collector as the Effect server (ADR-0012). W3C trace context propagates so a request entering Next produces a span, the proxied call to the Effect server inherits the trace id, and Jaeger shows browser → Next → Effect as a single trace. The browser tracer lives at `services/common/web-sdk.client.ts` and points at the same collector.

## Consequences

- **One renderer buys SSR optionality forever.** Future engagements pick "ship as-is" (CSR-effective, SSR-shell) without architectural changes.
- **Hosting is "Node server + CDN," not "S3 + CDN."** A static SPA can be a cheap CloudFront + S3; Next needs a runtime. For a one-person consulting template the cognitive consistency of one deploy story is worth the marginal hosting cost.
- **`useSuspenseQuery` shifts the error-handling model.** Errors throw and propagate to the nearest `error.tsx` boundary; each route picks its boundary deliberately. The toast path remains available for client-only `useQuery` callers.
- **Per-request Effect runtime on the server.** `ManagedRuntime` is constructed per request (cached on the request via `React.cache`), not as a module singleton — module-singleton state would leak between requests.
- **App Router cognitive overhead.** Server vs client component boundaries, `"use client"`, request-scoped vs module-scoped state — real overhead a SPA didn't impose.

## Alternatives considered

- **Static export as the deploy target.** Rejected: defers the SSR migration to mid-engagement, at a worse time with more accumulated code. Prefetch + hydrate + suspense requires a server, so `output: 'export'` is out.
- **TanStack Start instead of Next.js.** Genuinely close. Chosen against because (a) Next is the industry default clients recognize, which matters for a delivery-positioned template; (b) Next's instrumentation hook and middleware story are more mature for OTEL; (c) the BFF concern disappears once we commit to "Next is a proxy, not an auth authority."
- **Make Next.js the BFF; talk to the Effect server with a service token.** Rejected: doubles the auth surface area (two refresh paths, two revocation stories, a service credential to rotate). "The user's cookie is the only credential" is strictly simpler and no less secure.
- **Server Actions for mutations.** Deferred. Every existing mutation flows through `useEffectMutation` cleanly; adopt per-feature when the form-without-JS UX matters.

## Related

- ADR-0014 — frontend view-layer tiering (ViewModels are framework-agnostic Effect, reusable on both runtimes).
- ADR-0015 — frontend component library.
- ADR-0016 — server-side authentication (the Effect server remains the BFF).
- ADR-0017 — frontend auth flow (the server-component guard and `/api/*` rewrite).
- ADR-0012 — observability (extended to cover Next via `instrumentation.ts`).
