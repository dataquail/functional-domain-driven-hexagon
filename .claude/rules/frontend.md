# Rule: frontend (web + component library)

**Scope:** `packages/web/` and `packages/components/` — read before touching frontend code.
**Backing ADRs:** 0014 (view-layer tiering), 0015 (component library), 0018 (Next.js renderer + proxy).

The frontend is a Next.js (App Router) renderer that proxies `/api/*` to the Effect server. The Effect server stays the BFF — Next renders + proxies but does NOT terminate auth. See ADR-0018.

**Layout** (`packages/web/`, no `src/` wrapper):

- `app/` — Next file-based routes. `(authed)/` is the route group for protected pages (server-side guard in `(authed)/layout.tsx` calls `/auth/me`, `redirect()`s on 401). `app/providers.tsx` wires `ThemeProvider → QueryClientProvider → RuntimeProvider → Toaster`.
- `features/` — feature-shaped views and presenters (no `src/` wrapper). Every source file carries one of three view-tier stereotypes: `*.view.tsx` (naked component), `*.presenter.{ts,tsx}`, or `*.view-model.ts` — a bare `*.tsx` with no stereotype fails lint (deny-by-default, see View tiering below).
- Bespoke component library lives in a sibling workspace package — `@org/components` (`packages/components/`). Web imports primitives via `@org/components/primitives/<name>`. Storybook is hosted there too. Same primitives → patterns → features direction as before; the only thing that changed is the package boundary.
- `services/` — runtime, ApiClient, data-access. Files split by environment when behavior differs:
  - `*.shared.ts` — environment-agnostic (e.g. the shared `ApiClient` `Context.Service`).
  - `*.server.ts` — server-only (`import "server-only"`; reads cookies via `next/headers`).
  - `*.client.tsx` — browser-only (`"use client"`; mounts via `RuntimeProvider`).
  - `data-access/<feature>-queries.ts` — server-safe Effects (no `"use client"` so server components can prefetch).
  - `data-access/use-<feature>-queries.ts` — client hooks wrapping the Effects in `useEffectSuspenseQuery`/`useEffectMutation`.
- `lib/tanstack-query/` — `prefetchEffectQuery` (server), `useEffectSuspenseQuery` and `useEffectMutation` (client), `make-form-options.ts`, `query-data-helpers.ts`.
- `instrumentation.ts` — Node OTEL bootstrap via `@vercel/otel` (Phase 5 of the migration). Browser OTEL ports later as a follow-up.

**Data fetching default** (ADR-0018): each route's `page.tsx` runs `prefetchEffectQuery` server-side, dehydrates the cache into `<HydrationBoundary>`, and the leaf component reads via `useEffectSuspenseQuery`. Plain `useQuery` is allowed only for client-only side data (search-as-you-type, polling). Mutations stay client-side via `useEffectMutation`.

**View tiering** (ADR-0014): naked component (`*.view.tsx`) → `*.presenter.{ts,tsx}` (React-coupled libraries: TanStack Form, react-hook-form, etc.) → `*.view-model.ts` (pure Effect, framework-agnostic). Views may not import Effect runtime primitives or `@tanstack/react-query` directly. Enforced by the `web-*` rules in `.dependency-cruiser.cjs` (web pass) and by the `project-structure/folder-structure` config (`eslint.project-structure.mjs`, `webFeatures`), which is deny-by-default: only those three stereotypes (plus their sibling tests) are admitted in `features/**`. Parity: every `*.presenter.{ts,tsx}` owes a `*.presenter.test.tsx` and every `*.view-model.ts` owes a `*.view-model.test.ts`; views are dumb projection and carry no parity obligation.

**Component library** (`packages/components/`, ADR-0015). Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Dependency direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may import `@radix-ui/*`, `lucide-react`, `recharts`, or `sonner`. New icons: add a one-line `createIcon` wrapper to `primitives/icon/icons.ts`; never import `lucide-react` from outside `primitives/`. Every primitive and pattern needs a sibling `*.stories.tsx` (enforced by the `project-structure/folder-structure` rule — `eslint.project-structure.mjs`, `componentsPrimitives`/`componentsPatterns`). Storybook runs via `pnpm -F @org/components storybook`; a static build is part of `check:all`.

**Run locally**:

```bash
pnpm bootstrap                    # Docker (postgres, jaeger, zitadel) + migrate + seed
pnpm --filter @org/server dev     # BFF on :3001
pnpm --filter @org/web dev        # Next.js on :3000 (browser-facing); /api/* rewrites to :3001
```
