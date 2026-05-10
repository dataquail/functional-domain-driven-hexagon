"use client";

// Effect-based mutations on the client. The runner glue is local to
// this file: it bridges Effect's failure channel to TanStack's mutation
// callbacks and surfaces tagged errors / defects through the Toast
// service. `useEffectSuspenseQuery` (the read-side counterpart)
// intentionally does NOT use the runner — suspense errors throw to the
// nearest `error.tsx` boundary, which is the routing-layer concern.
// Mutations, by contrast, are user-driven and want toast feedback
// inline.

import { Toast } from "@/services/common/toast";
import { type ClientRuntimeContext, useRuntime } from "@/services/runtime.client";
import {
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Predicate from "effect/Predicate";
import * as React from "react";

export class QueryDefect extends Data.TaggedError("QueryDefect")<{
  cause: unknown;
}> {}

const hasStringMessage = Predicate.compose(
  Predicate.isRecord,
  Predicate.compose(
    Predicate.hasProperty("message"),
    Predicate.struct({ message: Predicate.isString }),
  ),
);

type EffectfulError<Tag extends string = string> = { _tag: Tag };
type ToastifyErrorsConfig<E extends EffectfulError> = {
  [K in E["_tag"]]?: (error: Extract<E, EffectfulError<K>>) => string;
} & {
  orElse?: boolean | string | "extractMessage";
};

type UseRunnerOpts<A, E extends EffectfulError> = {
  toastifyDefects?: boolean | string;
  toastifyErrors?: ToastifyErrorsConfig<E>;
  toastifySuccess?: (result: A) => string;
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong";
const DEFAULT_DEFECT_MESSAGE = "An unexpected error occurred";

const useRunner = <A, E extends EffectfulError, R extends ClientRuntimeContext>({
  toastifyDefects = true,
  toastifyErrors = {},
  toastifySuccess,
}: UseRunnerOpts<NoInfer<A>, NoInfer<E>> = {}): ((
  span: string,
) => (self: Effect.Effect<A, E, R>) => Promise<A>) => {
  const runtime = useRuntime();

  return React.useCallback(
    (span: string) =>
      (self: Effect.Effect<A, E, R>): Promise<A> => {
        const { orElse = true, ...tagConfigs } = toastifyErrors;

        return self
          .pipe(
            Effect.tapError((error) =>
              Effect.gen(function* () {
                const toast = yield* Toast;
                const errorTag = error._tag as keyof typeof tagConfigs;
                const tagHandler = tagConfigs[errorTag];

                if (tagHandler !== undefined) {
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                  const message = tagHandler(error as any);
                  yield* toast.error(message);
                  return;
                } else if (orElse !== false) {
                  if (orElse === "extractMessage" && hasStringMessage(error)) {
                    yield* toast.error(error.message);
                  } else if (typeof orElse === "string") {
                    yield* toast.error(orElse);
                  } else {
                    yield* toast.error(DEFAULT_ERROR_MESSAGE);
                  }
                }
              }),
            ),
            Effect.tap((result) =>
              toastifySuccess !== undefined
                ? Effect.flatMap(Toast, (toast) => toast.success(toastifySuccess(result)))
                : Effect.void,
            ),
            Effect.tapErrorCause(Effect.logError),
            Effect.withSpan(span),
            runtime.runPromiseExit,
          )
          .then(
            Exit.match({
              onSuccess: (value) => Promise.resolve(value),
              onFailure: (cause) => {
                if (Cause.isFailType(cause)) {
                  throw cause.error satisfies E;
                }

                if (toastifyDefects !== false) {
                  const defectMessage =
                    typeof toastifyDefects === "string" ? toastifyDefects : DEFAULT_DEFECT_MESSAGE;
                  runtime.runSync(Effect.flatMap(Toast, (toast) => toast.error(defectMessage)));
                }

                throw new QueryDefect({ cause: Cause.squash(cause) });
              },
            }),
          );
      },
    [runtime.runPromiseExit, runtime.runSync, toastifyDefects, toastifyErrors, toastifySuccess],
  );
};

export type QueryVariables = Record<string, unknown>;

type EffectfulMutationOptions<
  A,
  E extends EffectfulError,
  Variables,
  R extends ClientRuntimeContext,
> = Omit<
  UseMutationOptions<A, E | QueryDefect, Variables>,
  "mutationFn" | "onSuccess" | "onError" | "onSettled" | "onMutate" | "retry" | "retryDelay"
> & {
  mutationKey: QueryKey;
  mutationFn: (variables: Variables) => Effect.Effect<A, E, R>;
} & UseRunnerOpts<A, E>;

export function useEffectMutation<
  A,
  E extends EffectfulError,
  Variables,
  R extends ClientRuntimeContext,
>(
  options: EffectfulMutationOptions<A, E, Variables, R>,
): UseMutationResult<A, E | QueryDefect, Variables> {
  const effectRunner = useRunner<A, E, R>(options);
  const spanName = options.mutationKey[0] as string;

  const mutationFn = React.useCallback(
    (variables: Variables) => options.mutationFn(variables).pipe(effectRunner(spanName)),
    [effectRunner, spanName, options],
  );

  return useMutation<A, E | QueryDefect, Variables>({
    ...options,
    mutationFn,
    throwOnError: false,
  });
}
