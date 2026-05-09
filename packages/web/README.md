# @org/web

Next.js (App Router) renderer for the template. See [ADR-0018](../../docs/adr/0018-frontend-nextjs-renderer-and-proxy.md) for the architectural decision: Next renders + proxies, the Effect server stays the BFF (auth authority + domain).

## Routes

| URL      | File                                                                                                      | Auth     |
| -------- | --------------------------------------------------------------------------------------------------------- | -------- |
| `/`      | [app/(authed)/page.tsx](<./app/(authed)/page.tsx>) — Tasks (server-prefetched + suspense-read)            | required |
| `/users` | [app/(authed)/users/page.tsx](<./app/(authed)/users/page.tsx>) — Users list, server-prefetched + suspense | required |

The `(authed)` route group attaches a server-side auth guard ([app/(authed)/layout.tsx](<./app/(authed)/layout.tsx>)) that calls `/auth/me` via the BFF and `redirect()`s to `/api/auth/login` on 401 — no flicker, no client-side guard. Nav lives in [features/\_\_root/nav.tsx](./features/__root/nav.tsx) as a server component using `next/link`; sign-out is a plain `<a href="/api/auth/logout">` (the BFF's logout endpoint is GET-idempotent per ADR-0017).

Each route's `page.tsx` runs `prefetchEffectQuery` server-side, dehydrates the cache into `<HydrationBoundary>`, and the leaf component reads via `useEffectSuspenseQuery`. Plain `useQuery` is allowed only for client-only side data (search-as-you-type, polling). Mutations stay client-side via `useEffectMutation`.

## Local development

```bash
pnpm -F @org/web dev
```

Serves on `http://localhost:3000`. Browser → Next.js (`:3000`) → `/api/*` rewrite → BFF (`:3001`); the browser only ever sees the `:3000` origin so the session cookie scopes there.

## Toolchain

- **Next.js 16.2.6** (App Router) — see [AGENTS.md](./AGENTS.md): Next 16 has breaking changes from Next 15, so refer to `node_modules/next/dist/docs/` rather than training data when in doubt.
- **React 19.2.4**, **Tailwind v4** via `@tailwindcss/postcss`, **ESLint 9** via `eslint-config-next`.
- Scaffolded with `pnpm dlx create-next-app@latest` (locks in the canonical config), then aligned with workspace conventions: renamed to `@org/web`, runs on port `3000` (the browser-facing origin; BFF on `3001`), `dotenv -e ../../.env` so the package reads the shared root `.env` (including `SERVER_INTERNAL_URL` for the rewrite target). The bespoke component library and design tokens live in `@org/components` (`packages/components/`).

## How the `/api/*` proxy works

[next.config.ts](./next.config.ts) declares one rewrite: `/api/:path*` → `${SERVER_INTERNAL_URL}/:path*`. Next forwards the inbound `Cookie` header automatically and the BFF's `Set-Cookie` flows back through the rewrite unchanged, so the session cookie (`HttpOnly; SameSite=Strict`) scopes to the Next origin (`localhost:3000` in dev). The browser never talks to the BFF directly — no CORS, no cross-site cookie attachment risk. See [ADR-0018](../../docs/adr/0018-frontend-nextjs-renderer-and-proxy.md) for the full rationale.

## Why `predev` builds `@org/contracts`

Turbopack resolves workspace imports via tsconfig `paths`. The contracts source files use NodeNext-style `.js` import specifiers (`import * as AuthContract from "./api/AuthContract.js"`) — fine for the rest of the workspace which uses NodeNext resolution, but Turbopack's `bundler` resolution doesn't rewrite `.js` → `.ts` for source files. Pointing web's `paths` at the compiled `build/esm` (`.js`) + `build/dts` (`.d.ts`) output sidesteps the issue entirely, at the cost of needing the contracts package built before Next starts. `predev` and `prebuild` handle that automatically; if you change a contract while `pnpm dev` is running, restart the web dev server.

## Server-side query infrastructure

| File                                                                                                   | Role                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [services/api-client.server.ts](./services/api-client.server.ts)                                       | Server-only `ApiClient`. Reads inbound cookie via `next/headers`, forwards on every outbound `HttpApiClient` call. Uses `SERVER_INTERNAL_URL` directly (does NOT go through the `/api/*` rewrite). |
| [services/runtime.server.ts](./services/runtime.server.ts)                                             | `getServerRuntime()` — per-request `ManagedRuntime`, cached via `React.cache`. One runtime per request; no cookie leakage across requests.                                                         |
| [lib/query-client.shared.ts](./lib/query-client.shared.ts)                                             | `makeQueryClient()` — shared default options used by both server and client QueryClients.                                                                                                          |
| [lib/query-client.server.ts](./lib/query-client.server.ts)                                             | `getQueryClient()` — per-request server QueryClient via `React.cache`.                                                                                                                             |
| [lib/tanstack-query/effect-prefetch.server.ts](./lib/tanstack-query/effect-prefetch.server.ts)         | `prefetchEffectQuery({ queryKey, queryFn })` — runs the Effect on the server runtime, writes the result into the per-request QueryClient.                                                          |
| [lib/tanstack-query/use-effect-suspense-query.tsx](./lib/tanstack-query/use-effect-suspense-query.tsx) | Client-side hook. Pair with `<HydrationBoundary>` so first paint reads from cache. Errors throw to the nearest `error.tsx` boundary.                                                               |
| [app/providers.tsx](./app/providers.tsx)                                                               | Browser `QueryClientProvider` (singleton-per-tab pattern from TanStack Query SSR docs).                                                                                                            |

## Why top-level `app/` instead of `src/app/`

`create-next-app`'s default layout has no `src/` wrapper, and we kept it that way. Root scripts (`lint`, `lint:deps`, `check-test-parity`) target `packages/web/{app,features,lib,services}/**` directly via explicit globs rather than relying on a `src/` convention.
