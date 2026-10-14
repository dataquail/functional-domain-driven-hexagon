import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

export type ExecutionContextShape = {
  readonly waitUntil: (effect: Effect.Effect<unknown>) => Effect.Effect<void>;
};

// Outside a Worker there is no invocation to outlive, so detached work is a detached fiber.
export const ExecutionContext = Context.Reference<ExecutionContextShape>("ExecutionContext", {
  defaultValue: () => ({ waitUntil: (effect) => Effect.asVoid(Effect.forkDetach(effect)) }),
});

export const waitUntil = (effect: Effect.Effect<unknown>): Effect.Effect<void> =>
  Effect.flatMap(Effect.service(ExecutionContext), (context) => context.waitUntil(effect));

export const makeWorkerExecutionContext = (
  register: (promise: Promise<unknown>) => void,
): ExecutionContextShape => ({
  waitUntil: (effect) =>
    Effect.flatMap(Effect.context<never>(), (context) =>
      Effect.sync(() => {
        register(Effect.runPromiseWith(context)(effect));
      }),
    ),
});
