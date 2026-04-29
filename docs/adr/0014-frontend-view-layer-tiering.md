# ADR-0014: Frontend layering — data-access ports, ViewModels, and Presenters

- Status: Accepted
- Date: 2026-04-28

## Context and Problem Statement

The frontend has the same coupling risk as the server: business logic embedded in framework-aware code is hard to test, hard to evolve, and hard to reason about in isolation. On the server we addressed it via hexagonal layering with strict isolation (ADR-0001 through ADR-0008). The frontend equivalent is harder because the "framework" is React, and parts of the React ecosystem — TanStack Query, TanStack Form, react-hook-form, drag-and-drop libraries, animation libraries — are intrinsically React-coupled. They expose hooks, not framework-agnostic Observables. Forcing a framework-agnostic discipline on top of them is either impossible or grossly unergonomic.

A naive "all logic in components" approach trades testability for short-term velocity: components import `useQuery` and `Effect.gen` and `useForm` directly; the next person reading the component cannot tell what's view, what's data, what's orchestration. A strict-MVVM approach (everything is a framework-agnostic ViewModel) gets the testability back but leaves no place for React-coupled library orchestration.

The forces:

- Components should not encode business logic, library choice, or async control flow. Their job is to render state and dispatch intents.
- Pure-Effect orchestration is testable without a renderer; that property is worth preserving where it's achievable.
- React-coupled libraries are sometimes the right tool. The architecture must accommodate them without forcing a framework-agnostic adapter that defeats the point.
- Agents and contributors need a mechanical rule for "where does this code go?" — fuzzy heuristics produce drift.

## Decision

Three layers, with the view layer tiered into three forms classified by the _shape of their dependencies_, not their size.

### Data-access layer (ports)

`packages/client/src/services/data-access/` is the hexagonal port for everything the application reads or writes. Each query or mutation publishes up to three shapes from a single definition, all backed by the same TanStack cache:

- **Hook** (`useTodosQuery`) — for components and presenters.
- **Effect** (`getTodos`, `createTodo(input)`) — for ViewModels and any non-React orchestration.
- **Observable** (`observeTodos: Stream<...>`) — built on TanStack's framework-agnostic `QueryObserver`, for ViewModels that need reactive subscriptions.

Components import the hook shape. ViewModels import the Effect or Observable shape. The TanStack library itself is not visible above this layer.

### View layer — three tiers

**Tier 1 — naked component**. JSX plus 1–3 hook calls from `services/data-access/` and any pure derivation. No abstraction file. Most leaf components live here.

**Tier 2 — Presenter (`*.presenter.ts` or `*.presenter.tsx`)**. A React-coupled custom hook (and, when JSX is needed, an accompanying provider or wrapper component) that orchestrates intrinsically-React libraries (TanStack Form, react-hook-form, etc.) with data-access calls. The `.tsx` form is appropriate when the Presenter must export JSX itself — for example, a context provider that scopes multi-step form state across screens, or a wrapper that interfaces with a JSX-input library like react-pdf. The Presenter is _allowed_ to depend on the React framework and on React-coupled libraries; that's the point of the tier. It corresponds to the Presenter in MVP. Tested with `renderHook` (or `render`, when JSX is involved) from `@testing-library/react`.

**Tier 3 — ViewModel (`*.view-model.ts`)**. Pure Effect orchestration, owns its state in a `SubscriptionRef`, exposes actions as Effects. Bridged into React by the generic `useViewModel` adapter in `lib/view-model.ts`. The ViewModel is framework-agnostic — it cannot import React or any React-coupled library. Tested as plain Effects with `it.effect`, no renderer.

A single feature may use any combination. A todos page might have a `*.view-model.ts` for list state and worker orchestration plus an `add-todo.presenter.ts` for the form. Components consume the projected state from each via thin React adapters; they import nothing from `effect/Effect`, `@tanstack/react-query`, or `@tanstack/react-form`.

### The graduation rule

The decision of which tier a piece of logic belongs in is mechanical and based on what it must coordinate:

- React-library state (form fields, drag handlers, animation refs) plus possibly data-access → **Presenter**. The library's hook is the source of truth and cannot be expressed as an Effect.
- Effect-shaped orchestration (queries, mutations, streams, derivations) with no React-library state → **ViewModel**.
- Just data plus JSX → **naked component**.

The architecture does not name the whole — it names the parts. Hexagonal at the application boundary, MVVM where the orchestration is framework-agnostic, MVP where it isn't.

### Enforcement

Per ADR-0008, layering is enforced by `pnpm lint:deps` (dependency-cruiser) and `pnpm lint:tests` (file-existence parity). This ADR adds the following rules to that configuration; their implementation lands alongside this ADR.

**Dependency-cruiser:**

- `client-tanstack-allowlist` — `@tanstack/react-query` and `@tanstack/query-core` may only be imported by `services/data-access/**`, `services/common/query-client.ts`, `lib/tanstack-query/**`, and `global-providers.tsx`. Anywhere else fails CI.
- `client-component-no-effect-runtime` — files matching `features/**/*.tsx` (and excluding `*.presenter.tsx`) may not import `effect/Effect`, `effect/Stream`, `effect/Fiber`, `effect/Ref`, `effect/SubscriptionRef`, `effect/Layer`, `effect/Scope`, `effect/Runtime`, `effect/ManagedRuntime`, `effect/Cause`, `effect/Exit`, or `effect/Match`. Allowed effect modules in components: `effect/Schema`, `effect/Function`, `effect/Either`, `effect/Option`, `effect/Predicate`, `effect/Duration`. The moment a component reaches for `Effect.gen` or similar, the violation surfaces and the contributor must extract to a Presenter or ViewModel.
- `client-react-form-presenter-only` — `@tanstack/react-form` and `react-hook-form` may only be imported by `features/**/*.presenter.{ts,tsx}` and the shared `lib/tanstack-query/` helpers (e.g. `make-form-options.ts`). The Effect-runtime rule above doesn't catch React-coupled libraries because their hooks live entirely outside `effect/`; this rule closes that gap so `useForm` cannot leak back into a `.tsx` component without a Presenter. Test files exempted.
- `client-view-model-no-react` — `features/**/*.view-model.ts` may not import `react`, `react-dom`, `@tanstack/react-*`, `react-hook-form`, or any package matching `react-*` / `*-react`. ViewModels are framework-agnostic.
- `client-presenter-allowed` — `features/**/*.presenter.{ts,tsx}` is the kitchen-sink tier; it may import React, React-coupled libraries, Effect runtime primitives, sibling ViewModels, and data-access hooks/Effects.

**Test parity (`scripts/check-test-parity.mjs`):**

- `features/**/*.view-model.ts` requires sibling `*.view-model.test.ts`.
- `features/**/*.presenter.{ts,tsx}` requires sibling `*.presenter.test.ts` _or_ `*.presenter.test.tsx`. The presenter's extension and the test's extension are independent: a presenter that only exports a hook is fine to test from `.test.ts` (the JSX wrapper comes from a shared test harness); a presenter that exports JSX itself (a provider, a wrapper component) or whose test renders JSX inline picks `.test.tsx`. Either satisfies parity.
- Components are not subject to parity. Components that consume a Presenter or ViewModel are dumb projection; the test value is captured at the abstraction.

The two filename suffixes (`*.view-model.ts`, `*.presenter.ts`) double as detector and documentation. A reader can tell at a filename glance which tier a file belongs to and what testing approach applies. They are bypassable (a contributor could put orchestration in a non-suffixed file), but bypass is the kind of thing review catches; the rules' job is to catch _forgetfulness_, not malice.

## Consequences

- **Mechanical graduation.** A contributor or agent cannot drift past the boundary unnoticed. Reaching for `Effect.gen` in a `.tsx` fails dep-cruiser; the violation prompts a choice: Presenter (if React-library state is involved) or ViewModel (if not). The "wait too long" half of the drift problem is automated.
- **Premature ejection is acceptable.** The "eject too early" half is left to PR review. Creating a `*.view-model.ts` for trivial state costs ~30 lines of boilerplate and is reversible. The architecture stays consistent; reviewers can flag style without the tooling needing to encode it.
- **Two test seams.** Pure-Effect tests for ViewModels, `renderHook` tests for Presenters and `useViewModel` itself. The `@testing-library/react` dependency is acknowledged and bounded — it appears only in `*.presenter.test.tsx` files and the one `view-model.test.tsx` for the generic adapter.
- **Library coupling stays bounded.** TanStack Query lives behind `services/data-access/`. TanStack Form (or any future React-coupled library) lives behind a Presenter. Components see neither. Swapping TanStack Query for another fetching library is a localized change.
- **No path for "a hook that's neither Presenter nor ViewModel."** A custom hook that orchestrates anything substantive must declare its tier via filename. `use-*.ts` outside the two recognized patterns is reserved for trivial adapters (e.g. the existing `use-runtime.tsx`); the parity check does not require tests for them. If reviewers see substantive logic in such a file, the comment is "this is a Presenter, rename it."
- **Some short-term churn.** Existing components that import Effect runtime primitives or TanStack Query directly will fail the new rules at adoption. Migration is mechanical: extract to a Presenter or ViewModel; sometimes both.

## Alternatives considered

- **Strict MVVM (Tier 3 only).** Every feature gets a framework-agnostic ViewModel; React-coupled libraries are wrapped in custom Effect adapters. Rejected: no ergonomic adapter exists for libraries like TanStack Form whose state is intrinsically React-controlled. Forcing one would either reimplement the library badly or drop the library and use lower-level primitives. Both are worse than allowing a Presenter tier.
- **Hooks-only (Tier 2 only).** Every feature with non-trivial logic gets a `*.hook.ts`. Rejected: loses the testability dividend of pure-Effect ViewModels. Tests would require a renderer everywhere even when the orchestration is genuinely framework-agnostic.
- **No suffix conventions; classify by content.** Rely on review to spot Presenters and ViewModels by what's inside them. Rejected: parity rules and dep-cruiser rules need a filename anchor to fire, and "is this React-coupled?" is not something static analysis can tell from the file body alone in any practical way.
- **Coin a name for the whole architecture.** "Pragmatic hexagonal," "graduated MVVM," etc. Rejected: coined names harden into shibboleths. The named parts (Port, Adapter, ViewModel, Presenter) carry established semantics; the whole is just a layering.

## Related

- ADR-0001 (functional core, imperative shell) — the same separation between framework-agnostic logic and effectful shell, applied to the frontend. ViewModels are the frontend "core"; Presenters and components are the shell.
- ADR-0008 (architecture enforcement via dependency-cruiser) — the configuration mechanism and conventions this ADR extends.
- ADR-0009 (testing pyramid) — the testing principles. Frontend extension: pure-Effect tests for ViewModels are the analogue of domain unit tests; Presenter tests are the analogue of integration tests at a feature seam.
