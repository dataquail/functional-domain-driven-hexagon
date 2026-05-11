# `@org/web` test utilities

Helpers for testing client-side React + Effect code without running
the real ApiClient or hitting the network. Pair with vitest + jsdom
(see `vitest.config.ts`).

## What lives here

| File                    | Purpose                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `presenter-harness.tsx` | `makePresenterHarness()` — wrapper + QueryClient + recording Toast layer. Used by `*.presenter.test.ts(x)` files. |
| `recording-toast.ts`    | A `Toast` Layer variant that records calls instead of side-effecting sonner. Read via `harness.getToasts()`.      |
| `setup.ts`              | Registered as `setupFiles`; wires `@testing-library/jest-dom` matchers and `cleanup()` between tests.             |

## When to use what

- **Presenter tests (`*.presenter.test.ts(x)`)** — pass a partial
  `apiClient` to `makePresenterHarness({ apiClient })`. Only the paths
  the presenter touches need to be filled in. Assert behavior via the
  hook's return shape, observed mutations on the partial client, and
  `harness.getToasts()`.

- **Bridge tests (`lib/tanstack-query/*.test.ts(x)`)** — for hooks that
  don't reach an ApiClient directly (e.g. `useEffectMutation`,
  `useEffectSuspenseQuery`), the presenter harness still works — pass
  `apiClient: {}`. The hook will be exercised against the harness's
  recording Toast and the supplied `queryFn`. For Suspense tests, wrap
  in a custom `React.Suspense` boundary (see
  `lib/tanstack-query/use-effect-suspense-query.test.tsx`).

- **`renderHook` vs. rendering JSX** — prefer `renderHook` for presenter
  unit tests. It avoids mounting the entire component tree and gives
  you direct access to the returned shape. Only render JSX when you're
  specifically asserting on DOM behavior (e.g. focus, ARIA, or the
  component-driver tier).

## Injecting a partial `apiClient`

`apiClient` accepts a `Record<string, unknown>` that's narrowed at the
call site to the contract shape. Only fill in the namespaces and
methods the presenter under test calls — TypeScript will yell only
about types you actually access, so the failure mode is loud and
local.

```ts
const apiClient = {
  user: {
    find: () => Effect.succeed(new UserContract.PaginatedUsers({ ... })),
    // create is omitted — the presenter under test never calls it.
  },
};
harness = makePresenterHarness({ apiClient });
```

If the test exercises the mutation path that touches a method you
omitted, the test will fail at runtime with a clear "not a function"
error, not silently pass.

## `RecordingToast` and `getToasts()`

The harness substitutes the prod `Toast` layer with `RecordingToast`,
which writes calls to a `Ref` instead of firing sonner. Read them via
the harness:

```ts
const toasts = await harness.getToasts();
expect(toasts).toEqual([{ kind: "success", message: "User created!" }]);
```

The shape is `ReadonlyArray<{ kind: "success" | "error"; message: string }>`.
Order is preserved.

## Common gotchas

- **Cleanup.** Every test must call `await harness.dispose()` in
  `afterEach` (the existing tests use a per-file `let harness` and an
  `afterEach`). Skipping dispose leaks the runtime across tests and
  causes intermittent failures.

- **`useSuspenseQuery` and pending state.** When a presenter uses
  `useEffectSuspenseQuery`, the hook will suspend on the first render.
  Wrap your `renderHook` assertions in `waitFor` (or, for JSX renders,
  wrap the tree in `React.Suspense`).

- **Defects.** `useEffectMutation` rethrows defects wrapped in a
  `QueryDefect`. If your test calls `mutateAsync`, wrap it in a
  `try/catch` — the rejection is expected behavior, not a test
  failure. The defect toast is recorded and assertable.

- **`mutate` is fire-and-forget; `mutateAsync` rejects on failure.**
  Match the production call site: presenters that use `.mutate(...)`
  should be tested via `act(() => result.current.mutate(...))` + a
  `waitFor` on the side-effect; presenters that use `.mutateAsync(...)`
  should be tested via `await act(async () => { try { await result.current.mutateAsync(...); } catch { /* expected */ } })`.
