import { type LiveRuntimeContext } from "@/services/live-layer";
import { useRuntime } from "@/services/runtime/use-runtime";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import type * as SubscriptionRef from "effect/SubscriptionRef";
import * as React from "react";

export type AnyEffect = Effect.Effect<unknown, unknown, LiveRuntimeContext>;
export type AnyAction = AnyEffect | ((...args: ReadonlyArray<never>) => AnyEffect);
export type ActionRecord = Record<string, AnyAction>;

export type ViewModel<TState, TActions extends ActionRecord> = {
  readonly state: SubscriptionRef.SubscriptionRef<TState>;
  readonly actions: TActions;
};

type WrappedAction<A> = A extends (...args: infer Args) => Effect.Effect<unknown, unknown, unknown>
  ? (...args: Args) => void
  : A extends Effect.Effect<unknown, unknown, unknown>
    ? () => void
    : never;

export type WrappedActions<T extends ActionRecord> = {
  readonly [K in keyof T]: WrappedAction<T[K]>;
};

const isEffect = (value: unknown): value is Effect.Effect<unknown, unknown, unknown> =>
  typeof value === "object" && value !== null && Effect.isEffect(value);

export const useViewModel = <TState, TActions extends ActionRecord>(
  make: Effect.Effect<ViewModel<TState, TActions>, never, LiveRuntimeContext | Scope.Scope>,
  initialState: TState,
): { state: TState; actions: WrappedActions<TActions> } => {
  const runtime = useRuntime();
  const [state, setState] = React.useState<TState>(initialState);
  const [vm, setVm] = React.useState<ViewModel<TState, TActions> | null>(null);

  React.useEffect(() => {
    const fiber = runtime.runFork(
      Effect.gen(function* () {
        const built = yield* make;
        setVm(built);
        yield* built.state.changes.pipe(
          Stream.tap((next) =>
            Effect.sync(() => {
              setState(() => next);
            }),
          ),
          Stream.runDrain,
        );
      }).pipe(Effect.scoped),
    );

    return () => {
      setVm(null);
      runtime.runFork(Fiber.interrupt(fiber));
    };
  }, [runtime]);

  const actions = React.useMemo(
    () =>
      new Proxy({} as WrappedActions<TActions>, {
        get(_target, prop) {
          if (typeof prop !== "string" || vm === null) return () => undefined;
          const action = vm.actions[prop as keyof TActions];
          if (action === undefined) return () => undefined;
          if (isEffect(action)) {
            return () => runtime.runFork(action);
          }
          if (typeof action === "function") {
            return (...args: ReadonlyArray<unknown>) =>
              runtime.runFork((action as (...a: ReadonlyArray<unknown>) => AnyEffect)(...args));
          }
          return () => undefined;
        },
      }),
    [runtime, vm],
  );

  return { state, actions };
};
