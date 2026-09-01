# Rule: frontend (web + component library)

**Scope:** `packages/web/` and `packages/components/` — read before touching frontend code.
**Backing ADRs:** 0026 (Atom + MVVM), 0015 (component library), 0018 (Next renderer + proxy), 0019 (integration seam).

The frontend is a Next.js (App Router) renderer that proxies `/api/*` to the Effect server. The Effect server stays the BFF — Next renders + proxies but does NOT terminate auth. See ADR-0018.

**There is no TanStack.** State is Effect Atom (`effect/unstable/reactivity`, bundled in `effect`) with the React bindings from `@effect/atom-react`. Queries, mutations, invalidation and form state all live in that graph. A `@tanstack/*` import fails `pnpm lint` (`architecture/imports`, rule `web-no-tanstack`).

## MVVM: Model → ViewModel → View

The arrow points one way and is enforced. Nothing else in this file matters as much.

| Tier          | Lives in                         | May depend on                        | Tested by                                           |
| ------------- | -------------------------------- | ------------------------------------ | --------------------------------------------------- |
| **Model**     | `services/`                      | `@org/contracts`, `effect`           | `AtomRegistry` + MSW; no React                      |
| **ViewModel** | `features/**/*.view-model.ts`    | the Model                            | `AtomRegistry.make()`, `registry.get/set`; no React |
| **View**      | `features/**/*.view.tsx`         | its own ViewModel, `@org/components` | RTL with the ViewModel's output injected            |
| framework     | `app/`, `services/**/*.client.*` | anything                             | integration tier                                    |

- A **View may not import `services/`.** Everything it renders or dispatches arrives as an atom its ViewModel exposes.
- A **ViewModel may not import React**, `@effect/atom-react`, or any View.
- The **Model may not import `features/`.**
- A **View may only call the atom-React hooks** (`useAtomValue`, `useAtomSet`, `useAtomSuspense`, …) plus `useId`/`useCallback`. No `useState`, no `useEffect`, no `useReducer` — that state belongs in the ViewModel. A prop you would have copied into state becomes an `Atom.family` key instead (see `approve-device.view-model.ts`).

**File taxonomy** (`architecture.config.mjs`, `structure.folders`, deny-by-default): a file in `features/**` is a `*.view.tsx`, a `*.view-model.ts`, or a `*.test.{ts,tsx}`. Nothing else. Every `*.view-model.ts` owes a sibling `*.view-model.test.ts`; views carry no parity obligation. **There is no presenter tier** — it existed to hold TanStack, which is gone.

## Layout (`packages/web/`, no `src/` wrapper)

- `app/` — Next file-based routes. `(authed)/` is the protected route group (server-side guard in `(authed)/layout.tsx` calls `/auth/me`, `redirect()`s on 401). `app/providers.tsx` is `ThemeProvider → AtomProvider`. `app/**` is framework surface: it keeps its intrinsics and composes the Model directly.
- `features/` — one folder per feature, `*.view.tsx` + `*.view-model.ts` + tests.
- `services/` — the Model.
  - `services/atom/` — the kernel: `api-atoms.shared.ts` (the whole HTTP surface as atoms), `api-transport.shared.ts`, `reactivity-keys.ts`, `form-validation.ts`, `notifications.shared.ts`, `navigation.shared.ts`, `prefetch.server.ts`, `dehydration.shared.ts`, `hydration-boundary.tsx`, `registry.client.tsx`, the two bridges, `tracing.client.ts`.
  - `services/data-access/<feature>.atoms.ts` — that feature's query/mutation atoms; `<feature>.server.ts` — its `prefetch*` helpers (`import "server-only"`).
  - `services/format/` — presentation helpers a ViewModel uses.
  - Environment suffixes still apply: `*.shared.ts` (agnostic), `*.server.ts` (`import "server-only"`), `*.client.tsx` (`"use client"`).
- `instrumentation.ts` — Node OTEL via `@vercel/otel`. Browser OTEL is `services/atom/tracing.client.ts`, registered with `Atom.runtime.addGlobalLayer`.

## Reading and writing data

```ts
// Model
export const usersQueryAtom = (v: Vars) =>
  ApiAtoms.query("user", "find", {
    query: new UserContract.FindUsersParams(v),
    reactivityKeys: ReactivityKeys.users, // what refreshes me
    serializationKey: `${v.page}:${v.pageSize}`, // what makes me hydratable
  });
export const createUserAtom = ApiAtoms.mutation("user", "create");

// ViewModel
export const submitAtom = ApiAtoms.runtime.fn<void>()((_, get) =>
  Effect.gen(function* () {
    yield* get.setResult(createUserAtom, {
      payload: new UserContract.CreateUserPayload(get(fieldsAtom)),
      reactivityKeys: ReactivityKeys.users, // what I dirty
    });
  }).pipe(notify(get, { success: () => "User created!" })),
);
```

- **Invalidation is a reactivity key, not a query key.** Both sides declare against `services/atom/reactivity-keys.ts`; a typo there is a missing property, not a stale screen.
- **Hydration**: a route composes `<AtomHydrationBoundary prefetch={[prefetchX(...)]} fallback={...}>`; the View reads with `useAtomSuspense`. Only a query declared with `serializationKey` is hydratable. The prefetch encodes through the endpoint's own schema, so `Schema.DateTimeUtc` is a real `DateTime.Utc` on the client.
- **Never build an atom runtime on the server.** `Atom.defaultMemoMap` is module-global and never evicts, so a per-request layer would leak one entry per request. `prefetch.server.ts` runs the plain Effect and reads the atom's serialization metadata — it never mounts the atom. (ADR-0026.)
- **Notifications and navigation are state**, not injected services: write `notify(get, …)` / `navigateTo(get, href)` in a ViewModel, and one bridge at the edge of the app turns it into sonner or `router.push`. A test reads the atom back.
- **Forms** are fields-as-atoms + a derived errors atom over the contract schema (`validateWithSchema`). Validation surfaces only after the first submit attempt (`submitAttemptedAtom`). Put the `notify` wrapper _inside_ the validation guard, or an invalid submit announces success.

## Component library (`packages/components/`, ADR-0015)

Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may import `@radix-ui/*`, `lucide-react`, `recharts`, or `sonner`. New icons: a one-line `createIcon` wrapper in `primitives/icon/icons.ts`.

**The prop API is the contract.** In `features/**`, `patterns/**` and `app/**`:

- **No raw intrinsics.** `react/forbid-elements` bans the whole set a screen would reach for — `div`, `span`, `p`, `h1`–`h4`, `ul`/`ol`/`li`, `nav`, `a`, `button`, `input`, `label`, `select`, `form`, `section`, `header`, `footer`, `main`, `table`, `img`. Use `Stack`, `Grid`, `Container`, `Surface`, `Text`, `Heading`, `List`, `Nav`, `Link`, `Button`, `Input`, `Label`, `Select`, `Form`, …
- **No `className`, no `style`** (`local/no-inline-styling`). And it is not merely lint-banned: **no primitive accepts `className`**, so passing one is a type error. The lint rule is the backstop for a primitive regressing to a DOM spread.
- **When a primitive can't express what you need, widen the primitive and prove the variant in its story.** Never reopen `className`, never add a DOM spread. Every primitive is the `Icon` shape: explicit props, closed unions mapped through literal class tables.
- **Only `app/layout.tsx` is exempt** — `<html>`/`<body>` are the document root and no primitive can own them. A route's `page.tsx` is a screen like any other.

**Composing a page**: `PageShell` (centred, width-capped column) wraps `CardSection`s (a titled card); the authed layout is an `AppShell`. A page states what its sections are called, not how a card title is sized:

```tsx
<PageShell width="sm">
  <CardSection title="Invite a teammate">
    <InviteForm orgId={orgId} />
  </CardSection>
</PageShell>
```

`Input`, `Checkbox` and `Select` are **strictly controlled** — value and change handler are required, and `defaultValue`/`defaultChecked` do not exist. Uncontrolled state in a View is state outside the ViewModel.

Every primitive and pattern needs a sibling `*.stories.tsx`. Storybook: `pnpm -F @org/components storybook`; a static build is part of `check:all`.

## Tests

| Tier            | Harness                                                                           |
| --------------- | --------------------------------------------------------------------------------- |
| **Model**       | `AtomRegistry.make({initialValues: [[apiTransportAtom, …]]})` + MSW               |
| **ViewModel**   | same, plus `AtomRegistry.getResult(registry, atom, {suspendOnWaiting})`           |
| **View**        | `renderView(<X />, { initialValues: [[atom, value]] })` (`test/atom-harness.tsx`) |
| **Integration** | `renderWithHarness` (`test/integration-harness.tsx`) — registry + bridges + MSW   |
| **Acceptance**  | `packages/acceptance` (Playwright), unchanged                                     |

- **MSW is installed globally** (`test/setup.ts`), not per file, and `renderView` disposes its registry after each test. Both exist because mounting a View mounts the query atoms it reads, and a reactivity-wrapped atom fetches on mount _however its atoms were seeded_ — so "this test does not need a server" is not something a test file can decide for itself. A View test that renders a list still registers a handler serving the same data it seeds; otherwise the in-flight request fails with no consumer.
- MSW resolves the **most recently registered handler first**, and `server.use(a, b)` keeps `a` ahead of `b`. To make a refetch see different data than the first load, register the second handler in its own later `server.use(...)` call.
- An action atom starts `AsyncResult.initial` and not waiting. A View test asserts the write happened by checking it is no longer pristine, not by checking `waiting` (which may already have settled).
- The integration harness deliberately does **not** mount `NavigationBridge`: it holds the Next router. Assert on `navigationRequestAtom` instead.

## Run locally

```bash
pnpm bootstrap                    # Docker (postgres, jaeger, zitadel) + migrate + seed
pnpm --filter @org/server dev     # BFF on :3001
pnpm --filter @org/web dev        # Next.js on :3000 (browser-facing); /api/* rewrites to :3001
```
