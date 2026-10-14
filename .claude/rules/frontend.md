# Rule: frontend (web + component library)

**Scope:** `packages/web/` and `packages/components/` — read before touching frontend code.
**Backing ADRs:** 0026 (Atom + MVVM), 0015 (component library), 0019 (integration seam), 0036 (the Svelte library and its lint), 0037 (the SvelteKit renderer), 0039 (stages and limits).

The frontend is a SvelteKit 3 app (`@org/web`) running as a Cloudflare Worker the Alchemy stack declares, on a Svelte 5 component library (`@org/components`). It renders and proxies `/api/*` to the server Worker over a service binding; the Effect server stays the BFF — the renderer does NOT terminate auth. See ADR-0037.

**There is no TanStack.** State is Effect Atom (`effect/reactivity`, bundled in `effect`), read in Svelte through the app's own bridge (`services/bridge/`). Queries, mutations, invalidation and form state all live in that graph. A `@tanstack/*` import fails `pnpm lint`: no tier's allowlist in `packages/web/architecture.yaml` names the package.

## MVVM: Model → ViewModel → View

The arrow points one way and is enforced. Nothing else in this file matters as much.

| Tier          | Lives in                      | May depend on                                                  | Tested by                                            |
| ------------- | ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| **Model**     | `services/`                   | `@org/contracts`, `effect`                                     | `AtomRegistry` + MSW; no Svelte                      |
| **ViewModel** | `features/**/*.view-model.ts` | the Model                                                      | `AtomRegistry.make()`, `registry.get/set`; no Svelte |
| **View**      | `features/**/*.view.svelte`   | its ViewModel, the bridge, `@org/components`, `@org/contracts` | `renderView` with the ViewModel's atoms seeded       |
| framework     | `src/` (routes, hooks)        | anything                                                       | integration + acceptance tiers                       |

- A **View imports its ViewModel, `atom-bridge.svelte.ts`, `atom-result.svelte`, the component library and the contracts — nothing else.** Everything it renders or dispatches arrives as an atom its ViewModel exposes.
- A **View holds no state or behaviour.** An `architecture/members` rule on `*.view.svelte` refuses every rune and lifecycle call except `$props` and the bridge's functions. A prop you would have copied into state becomes an `Atom.family` key, read with a getter — `atomValue(() => fieldsAtom(initialCode))` — so a new prop re-subscribes.
- A **ViewModel may not import Svelte**, the bridge, or any View, and never runs an Effect by hand.
- The **Model may not import `features/`.**

**File taxonomy** (`packages/web/architecture.yaml`, deny-by-default): a file in `features/**` is a `*.view.svelte`, a `*.view-model.ts`, a test, or a `__tests__/test-*-page.svelte` that composes Views as their route does. Every `*.view-model.ts` owes a sibling `*.view-model.test.ts`.

## Layout (`packages/web/`)

- `src/routes/` — Kit's file routes. `(authed)/` is the protected group: `+layout.server.ts` calls `/auth/me` and `redirect(302, …)`s on 401. Routes are framework surface: they compose the Model directly (prefetch, the hydration boundary).
- `src/hooks.server.ts` — the `/api/*` proxy onto the `SERVER` service binding (prefix stripped, redirects not followed) and the per-request runtime, built over the binding and the cookie and disposed after the response; `getRequestEvent()` reaches it.
- `features/` — one folder per feature: Views, ViewModels, tests.
- `services/` — the Model.
  - `services/atom/` — the kernel: `api-atoms.shared.ts` (the whole HTTP surface as atoms), `api-transport.shared.ts`, `reactivity-keys.ts`, `form-validation.ts`, `notifications.shared.ts`, `navigation.shared.ts`, `prefetch.server.ts`, `dehydration.shared.ts`, the two bridges, `tracing.client.ts`.
  - `services/bridge/` — atoms to Svelte: the registry context, `atomValue`/`atomSet`, `<AtomResult>`, `<HydrationBoundary>`.
  - `services/data-access/<feature>.atoms.ts` — that feature's query/mutation atoms; `<feature>.server.ts` — its `prefetch*` helpers.
  - `services/format/` — presentation helpers a ViewModel uses.
  - Suffixes: `*.shared.ts` (agnostic), `*.server.ts` (Kit refuses it in the browser bundle), `*.client.ts` (browser only).
- Browser OTEL is `services/atom/tracing.client.ts` (`VITE_OTLP_URL`), registered with `Atom.runtime.addGlobalLayer`.

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

```svelte
<!-- View -->
<script lang="ts">
  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import { fieldsAtom, submitAtom } from "./create-user.view-model";

  const fields = atomValue(fieldsAtom);
  const submit = atomSet(submitAtom);
</script>
```

- **Invalidation is a reactivity key, not a query key.** Both sides declare against `services/atom/reactivity-keys.ts`; a typo there is a missing property, not a stale screen.
- **Hydration**: a route's load returns `collectPrefetched([prefetchX(...)])`; the page hands it to `<HydrationBoundary state>` beside a `pending` snippet, and the View reads through `<AtomResult atom>`. Only a query declared with `serializationKey` is hydratable. The prefetch encodes through the endpoint's own schema, so `Schema.DateTimeUtc` is a real `DateTime.Utc` on the client.
- **Load data is plain values.** Kit serialises it with devalue, which refuses a `Schema.Class`; return the fields a route reads.
- **Never build an atom runtime on the server.** `prefetch.server.ts` runs the plain Effect and reads the atom's serialization metadata — it never mounts the atom (ADR-0026).
- **Notifications and navigation are state**, not injected services: write `notify(get, …)` / `navigateTo(get, href)` in a ViewModel, and one bridge at the edge of the app turns it into svelte-sonner or `goto`. A test reads the atom back.
- **Forms** are fields-as-atoms + a derived errors atom over the contract schema (`validateWithSchema`). Validation surfaces only after the first submit attempt (`submitAttemptedAtom`). Put the `notify` wrapper _inside_ the validation guard, or an invalid submit announces success.

## Component library (`packages/components/`, ADR-0015, ADR-0036)

Two trees: `primitives/` (atoms) and `patterns/` (molecules + organisms). Direction: `features (web) → patterns → primitives → third-party`. Only `primitives/` may name Bits UI, `@lucide/svelte` or `svelte-sonner` — the package node and a repo-wide `deny` both hold it. New icons: a one-line `createIcon` wrapper in `primitives/icon/icons.ts`.

**The prop API is the contract.** In `features/**`, `patterns/**` and `src/routes/**`:

- **No raw intrinsics.** `svelte/no-restricted-html-elements` (`pnpm lint:svelte`) bans the set a screen would reach for — `div`, `span`, `p`, `h1`–`h4`, `ul`/`ol`/`li`, `nav`, `a`, `button`, `input`, `label`, `select`, `form`, `section`, `header`, `footer`, `main`, `table`, `img`. Use `Stack`, `Grid`, `Container`, `Surface`, `Text`, `Heading`, `List`, `Nav`, `Link`, `Button`, `Input`, `Label`, `Select`, `Form`, …
- **No `class`, no `style`.** No primitive's `*Props` (declared in `<script module>`) accepts one: `svelte-check` (in `pnpm check`) makes passing one a type error, an `architecture/members` rule refuses a `*Props` that reopens it, and ESLint refuses one in markup.
- **When a primitive can't express what you need, widen the primitive and prove the variant in its story.** Explicit props, closed unions mapped through literal class tables.
- **Strictly controlled inputs.** Value and change handler are required. `Checkbox`, `Select` and `Dialog` bind through a function binding (`bind:checked={() => checked, onCheckedChange}`); `Input` reports a string (`onValueChange`) and undoes an edit its owner does not take.

**Composing a page**: `PageShell` (centred, width-capped column) wraps `CardSection`s (a titled card); the authed layout is an `AppShell`:

```svelte
<PageShell width="sm">
  <CardSection title="Invite a teammate">
    <InviteForm {orgId} />
  </CardSection>
</PageShell>
```

- **Third parties**: Bits UI 2 (Checkbox, Dialog, Label, Select), `@lucide/svelte`, `svelte-sonner` (it renders the `[data-sonner-toast][data-type]` the drivers read — a test pins it). `Link` is a plain anchor: `external` sets `data-sveltekit-reload`, `prefetch` sets `data-sveltekit-preload-data`.
- **Children are snippets** (`children?: Snippet`); named slots (`footer`, `action`, `nav`, `leading`, `trailing`) are snippet props.
- **A compound primitive is a folder**: the root `card.svelte`, its `card-header.part.svelte` parts (no story of their own), and `card.ts` hanging the parts on the root, so `<Card.Header>` reads naturally — `@org/components/primitives/card` resolves to it, and nothing imports an `index` file (ADR-0040). `Select` takes `items: { value, label, disabled?, data-testid? }[]` rather than item children — Bits renders the selected label while the list is closed, before any item mounts.
- **A type a `.ts` file needs lives in `.ts`.** Type-aware oxlint sees a `.svelte` module only through Svelte's ambient declaration, so a named type imported from one is an error type there.
- **Stories** are Svelte CSF (`*.stories.svelte`, `defineMeta`); every primitive and pattern owes one. A story that composes several components is `asChild`. Storybook: `pnpm -F @org/components storybook` (:6007); a static build is part of `check:all`.
- **Styling**: Tailwind v4 from `styles/globals.css`, which the web app's root layout imports and `@tailwindcss/vite` compiles. Its `@source` lines name each tree that carries class names.

## Tests

| Tier            | Harness                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| **Model**       | `AtomRegistry.make({initialValues: [[apiTransportAtom, …]]})` + MSW                                  |
| **ViewModel**   | same, plus `AtomRegistry.getResult(registry, atom, {suspendOnWaiting})`                              |
| **View**        | `renderView(View, props, { initialValues })` (`test/atom-harness.ts`)                                |
| **Integration** | `renderWithHarness(TestPage)` (`test/integration-harness.ts`) — registry + bridges + MSW, real Views |
| **Component**   | `@testing-library/svelte` + `user-event`, jsdom, children through `createRawSnippet`                 |
| **Acceptance**  | `packages/acceptance` (Playwright) against `alchemy dev`, or a deployed preview (ADR-0039)           |

- **MSW is installed globally** (`test/setup.ts`), not per file, and `renderView` disposes its registry after each test. Mounting a View mounts the query atoms it reads, and a reactivity-wrapped atom fetches on mount _however its atoms were seeded_ — so a View test that renders a list still registers a handler serving the same data it seeds.
- MSW resolves the **most recently registered handler first**, and `server.use(a, b)` keeps `a` ahead of `b`. To make a refetch see different data than the first load, register the second handler in its own later `server.use(...)` call.
- An action atom starts `AsyncResult.initial` and not waiting. A View test asserts the write happened by checking it is no longer pristine, not by checking `waiting`.
- The integration harness does **not** mount the navigation bridge (it holds Kit's router), and dismisses toasts between tests, since svelte-sonner's store outlives a render. Assert on `navigationRequestAtom`.
- **Kit 3 in Vitest**: `$app/*` resolves to stubs under `test/kit/`; mock the one a test needs. jsdom lacks `matchMedia` and pointer capture, which the toaster and Bits Select call; `test/setup.ts` stubs them.
- Each package has its own coverage floor in the root `vitest.config.ts`.

## Gotchas

- **Kit 3**: no `$lib` (use `@/`), `$app/env` instead of `$app/environment`, `Handle` from `@sveltejs/kit/hooks`, no `svelte.config.js` — the Alchemy SvelteKit resource injects its own adapter, and Kit's options live in `vite.config.ts`.
- **goodbones' Svelte reader ends a `<script>` tag at the first `>`**: name a generics constraint in `<script module>` instead of writing `Record<string, unknown>` inside the attribute.
- **Under Vite dev the app hydrates late** (hundreds of module requests), so Playwright page objects navigate with `waitUntil: "networkidle"`.

## Run locally

```bash
pnpm bootstrap   # Docker (postgres, mailpit, jaeger) + migrate + seed the identity Worker
pnpm dev         # alchemy dev: web Worker :3000, server Worker :3001, identity Worker :3002
```
