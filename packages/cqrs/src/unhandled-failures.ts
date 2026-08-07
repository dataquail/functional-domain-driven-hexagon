import type * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";

/** Which isolated position the work was running in when it failed. */
export type UnhandledFailureKind = "after-commit-handler" | "saga";

export interface UnhandledFailure {
  /** The handler or saga that failed, by the name it was registered under. */
  readonly source: string;
  readonly kind: UnhandledFailureKind;
  /** The event being reacted to, when the failure happened while handling one. */
  readonly eventTag: string | undefined;
  readonly cause: Cause.Cause<unknown>;
}

/**
 * Where a failure goes when no caller is left to receive it.
 *
 * Eventual reactions are deliberately isolated: the producer has already
 * committed, so a reaction's failure must not undo it. That isolation leaves
 * nowhere for the failure to surface — the dispatching fiber finished long ago.
 * Without somewhere to report it, the only record is a log line, which nothing
 * can alert on and no test can assert against.
 *
 * The analogue of NestJS CQRS's `UnhandledExceptionBus`. Named for failures
 * rather than exceptions because that is what these are: a `Cause` covering a
 * typed failure, a defect, or an interrupt.
 */
export interface UnhandledFailuresShape {
  readonly report: (failure: UnhandledFailure) => Effect.Effect<void>;
  /**
   * Subscribes to failures as they are reported. Only failures reported while
   * subscribed arrive; the log is the durable record, this is the programmatic one.
   */
  readonly stream: Effect.Effect<Stream.Stream<UnhandledFailure>, never, Scope.Scope>;
}

export class UnhandledFailures extends Context.Service<UnhandledFailures, UnhandledFailuresShape>()(
  "@org/cqrs/UnhandledFailures",
) {}

export const makeUnhandledFailures = (): Layer.Layer<UnhandledFailures> =>
  Layer.effect(
    UnhandledFailures,
    Effect.gen(function* () {
      // Unbounded so reporting a failure can never block the isolated position
      // that is already failing.
      const reported = yield* PubSub.unbounded<UnhandledFailure>();

      return UnhandledFailures.of({
        report: (failure) => Effect.asVoid(PubSub.publish(reported, failure)),
        stream: Effect.map(PubSub.subscribe(reported), Stream.fromSubscription),
      });
    }),
  );

/**
 * Logs a failure and, if a host wired somewhere to report it, reports it too.
 *
 * Resolved from ambient context rather than declared as a dependency, so adding
 * a reporting surface is additive: a host that wires none keeps exactly the
 * behaviour it had, and the log stays the record either way.
 *
 * Private to the package — the positions that need it are the ones that isolate
 * failures, and they are all in here.
 *
 * @internal
 */
export const reportUnhandled = (failure: UnhandledFailure): Effect.Effect<void> =>
  Effect.logError(`Unhandled failure in ${failure.kind} '${failure.source}'`, failure.cause).pipe(
    Effect.andThen(
      Effect.flatMap(Effect.serviceOption(UnhandledFailures), (failures) =>
        Option.isNone(failures) ? Effect.void : failures.value.report(failure),
      ),
    ),
  );
