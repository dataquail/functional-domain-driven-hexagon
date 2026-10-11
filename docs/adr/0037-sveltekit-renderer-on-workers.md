# ADR-0037: The SvelteKit renderer on Workers, and how MVVM holds in Svelte

- Status: Accepted
- Date: 2026-10-11
- Amends: ADR-0018 (the renderer and its `/api` proxy move into a SvelteKit Worker; Next is deleted in Phase 7), ADR-0026 (the bindings and the View rule, restated for Svelte), ADR-0036 (ESLint's markup rules reach the web app).

## Context and Problem Statement

The Cloudflare migration replaces the Next renderer with SvelteKit, deployed by Alchemy's `Cloudflare.Website.SvelteKit` beside the server and identity Workers (ADR-0034, ADR-0035), on the Svelte component library (ADR-0036). `packages/web-svelte` grows beside `packages/web` until the Phase 7 cutover.

Four things had to carry over without being re-argued:

- **The BFF stays the server** (ADR-0017, ADR-0018). The renderer proxies `/api/*`, and the session cookie is the only credential.
- **The Model and the ViewModels are framework-free** (ADR-0026). Their files and tests must move without edits.
- **A prefetch hydrates the first paint**, and no atom runtime is built on the server.
- **The View rule.** A React View may call only the atom hooks. That was a `members` rule on `use*` calls, and oxlint's JSX rules policed the markup. Neither applies to a `.svelte` file as written.

Three constraints shaped the answers:

- Alchemy's SvelteKit resource (2.0.0-beta.81) accepts only Kit ≥ 3. Kit 3 peers on TypeScript ^6, so the repo moved to TypeScript 6 first.
- `alchemy dev` runs Kit's Vite dev server in Node, behind a fixed-port proxy. Bindings are served from workerd.
- On Node 22, `module.registerHooks` (which Alchemy's Vite child installs) hands a `require()` inside an ESM-imported CommonJS module a null source. Tailwind's Vite and PostCSS plugins both load that way.

## Decision

**SvelteKit 3 in a Worker, with no adapter of its own.** The stack declares `Cloudflare.Website.SvelteKit("web", { env: { SERVER: server } })` on :3000. Alchemy injects its Cloudflare adapter, so there is no `svelte.config.js`. `src/lib/server/platform.ts` is the one file that reads `platform.env`.

**`hooks.server.ts` is the proxy and the request scope.**

- `/api/*` goes to `SERVER.fetch` with the prefix stripped and redirects not followed. The OIDC dance's `Location` and `Set-Cookie` reach the browser unchanged.
- Every other request gets a `ManagedRuntime` over the same binding, carrying the inbound cookie, and disposes it once the response is ready. Load functions reach it through `getRequestEvent()`.
- A guard is a load function: `redirect(302, "/api/auth/login")` without a session, `error(404)` for the admin, org-member and org-admin cuts.
- A prefetch is a `+page.server.ts` load that returns dehydrated atoms.
- Load data crosses to the browser through devalue, so it is plain values, never a `Schema.Class`.

**A bridge in `services/bridge/` stands in for `@effect/atom-react`.**

- `provideRegistry` gives one registry per tab, with a 30 s idle TTL, and one per server render, disposed with it.
- `atomValue` subscribes through `createSubscriber`. It reads before it subscribes, and defers notifications raised during a read, because Svelte refuses a state write inside a derived or a block condition.
- `atomSet` mounts its atom for the component's lifetime, as `useAtomSet` does.
- `<AtomResult>` stands in for a suspense read:
  - the success value, kept while a refresh is waiting;
  - the route's pending snippet while initial;
  - a failure thrown to the error boundary.
- `<HydrationBoundary>` hydrates new keys before its children render. It hydrates live keys afterwards and reads each one, because `Hydration.hydrate` alone only queues a value for an existing node.

**The ViewModels, the Model and their tests moved byte for byte.** `@/` is the package root in both renderers, so not even an import path changed. The kernel's React-only files did not move: `registry.client.tsx`, `hydration-boundary.tsx` and the two bridges are Svelte components in `services/`. The server-side helpers moved without `import "server-only"`, because Kit keeps `*.server.ts` out of the client itself.

**The View rule is an `architecture/members` rule on `*.view.svelte`.** The goodbones TypeScript pack reads a component's script blocks, so the oxlint plugin and the CLI both see a View's calls.

- The rule refuses every rune and every Svelte lifecycle or context function except `$props`.
- A View's imports allowlist names its ViewModel, the bridge's read functions and `AtomResult`, the component library and the contracts. It does not name the registry, the Model or Effect's runtime modules.
- The same family carries a second rule: a ViewModel or Model file never calls `run*` on an Effect, because the atom runtime runs it inside the registry's lifetime.
- **ESLint keeps the markup.** `svelte/no-restricted-html-elements` and the no-`class`/no-`style` rules from ADR-0036 now cover `web-svelte/features/**/*.view.svelte` and `web-svelte/src/routes/**`.
- Each new rule has a `lint:rules` probe, and the new tiers have refused and allowed `lint:edges` rows.

**Tailwind compiles outside Vite.** `@tailwindcss/cli` builds the component library's `globals.css` into `src/styles.generated.css` at install, and the app imports the compiled file. Nothing of Tailwind's loads inside Alchemy's Vite child.

**Acceptance chooses the renderer.** `WEB_RENDERER=svelte|next` (default `svelte`) decides whether the stack serves :3000 or leaves it to `next start`. `e2e.yml` runs both until Phase 7. The Playwright page objects navigate with `waitUntil: "networkidle"`, because a dev-mode renderer hydrates only after loading its modules one by one.

## Consequences

- The Next app is still in the tree, and still gated, until Phase 7. `pnpm dev` serves SvelteKit, and `pnpm dev:next` serves Next.
- **Local SSR runs in Node, not workerd.** Phase 7's preview stages are where the real Worker runtime is exercised.
- Moving to Node 24 would let Tailwind's Vite plugin come back. Until then, a change to the component library's classes needs `pnpm -F @org/web-svelte css`, which `pnpm dev` and the acceptance scripts already run.
- Kit 3 has no `$lib`, and `$app/environment` is now `$app/env`. Vitest resolves `$app/*` to stubs under `test/kit/` that a test mocks. The architecture resolver maps `$app/*` to Kit's runtime files.
- **The goodbones Svelte reader ends a `<script>` tag at the first `>`.** A `generics` attribute such as `Record<string, unknown>` hides the whole block. Name the constraint in `<script module>` until the reader is fixed.
- Alchemy beta.81 fails to build Kit 3 stable's 404/SPA fallback (upstream #2060, unreleased). `assets.notFoundHandling` stays unset until beta.82.
