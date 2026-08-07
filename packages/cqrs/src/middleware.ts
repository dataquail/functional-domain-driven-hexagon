import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

/** What a middleware knows about the message it is wrapping. */
export interface DispatchContext {
  readonly tag: string;
  readonly side: "command" | "query";
}

/**
 * Behaviour applied once, around every dispatch, instead of at each of the call
 * sites — the seam that makes tracing, metrics, and audit logging properties of
 * the bus rather than obligations on its callers.
 *
 * **A middleware may not change the success or error channels.** That constraint
 * is the whole reason the typed bus survives having a seam: a caller's inferred
 * type comes from the message definition, so anything able to widen `E` here
 * would silently invalidate every `catchTag` written against it. Retry, timeout
 * with a fallback, logging, metrics and spans all fit. Validation does not — it
 * introduces a decode failure the definition never declared, which is why
 * schemas are enforced as a codec-compatibility assertion in tests instead.
 *
 * Middleware is applied in the order given, outermost first.
 */
export type Middleware = <A, E>(
  dispatch: (payload: never) => Effect.Effect<A, E>,
  context: DispatchContext,
) => (payload: never) => Effect.Effect<A, E>;

/**
 * Per-message attribute extractors, keyed by tag.
 *
 * `never` in argument position is the contravariance trick the event registry
 * also uses: it lets one map hold extractors written against their own concrete
 * payloads. Routing by tag before invocation is what makes that safe.
 */
export type AttributeExtractors = Readonly<
  Record<string, (payload: never) => Record<string, string | number | boolean>>
>;

/**
 * Opens one span per dispatch, named `<spanPrefix>.<tag>` and nested under
 * whatever span the caller is already in.
 *
 * Attributes come from a per-tag extractor rather than from the payload wholesale,
 * so only fields whose author has audited them reach a span. Omitting a tag is the
 * safe default: a payload can carry a bearer token or an opaque subject id, and a
 * span is the last place that should end up.
 */
export const span = (options: {
  readonly spanPrefix: string;
  readonly attributes?: AttributeExtractors;
}): Middleware => {
  const extractors = options.attributes ?? {};

  return (dispatch, context) => {
    const extractor = extractors[context.tag];

    return (payload) =>
      dispatch(payload).pipe(
        Effect.withSpan(`${options.spanPrefix}.${context.tag}`, {
          attributes: {
            [`${options.spanPrefix}.tag`]: context.tag,
            ...(extractor === undefined ? {} : extractor(payload)),
          },
        }),
      );
  };
};

/**
 * A dispatch outlived its deadline. Raised as a defect, not a failure: a caller's
 * error handling comes from the message definition, and a deadline is a property
 * of how the *host* chose to dispatch — no definition declares it, so no call site
 * can be expected to handle it.
 */
export class DeadlineExceeded extends Schema.TaggedErrorClass<DeadlineExceeded>("DeadlineExceeded")(
  "DeadlineExceeded",
  {
    tag: Schema.String,
    side: Schema.String,
    after: Schema.String,
  },
) {}

/**
 * Gives every dispatch a time limit, and **aborts the handler** when it expires.
 *
 * That second half is the reason this exists rather than being left to callers.
 * The transport does not propagate interruption applied from outside a dispatching
 * fiber, so a handler normally runs to completion even once nobody is waiting for
 * it. A timeout is interruption from the *inside*, which does reach the handler —
 * so a deadline is the one place a dispatch can be genuinely called off, and the
 * transaction it was running in rolls back.
 *
 * Not installed by default. What a sensible limit is, and whether abandoning work
 * partway is better than finishing it, are decisions only the host can make.
 */
export const deadline =
  (duration: Duration.Input): Middleware =>
  (dispatch, context) => {
    const after = `${String(Duration.toMillis(duration))}ms`;

    return (payload) =>
      // `timeoutOption` rather than `timeout`: it reports expiry as an absent value
      // instead of adding an error, so the declared channels come through untouched
      // and the defect below is the only thing this adds.
      dispatch(payload).pipe(
        Effect.timeoutOption(duration),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.die(new DeadlineExceeded({ tag: context.tag, side: context.side, after })),
            onSome: Effect.succeed,
          }),
        ),
      );
  };

/**
 * The counter `metrics()` writes to. Exported because a metric's name and
 * dimensions are a public contract the moment they reach a dashboard, and so a
 * consumer can read or re-register it without having to guess how it was declared.
 */
export const dispatchTotal = Metric.counter("cqrs_dispatch_total", {
  description: "Messages dispatched, by tag, side and outcome",
  incremental: true,
});

/** The duration histogram `metrics()` writes to — see `dispatchTotal`. */
export const dispatchDuration = Metric.timer("cqrs_dispatch_duration", {
  description: "Time to resolve a dispatch, by tag and side",
});

/**
 * Counts and times every dispatch, tagged by message and outcome.
 *
 * Both a failure and a success are recorded, and the duration is measured across
 * either — timing only the successes would flatter exactly the messages whose
 * latency matters most, since a slow failure is still a slow request.
 */
export const metrics = (): Middleware => (dispatch, context) => {
  const dimensions = { "cqrs.tag": context.tag, "cqrs.side": context.side };
  const duration = Metric.withAttributes(dispatchDuration, dimensions);
  const succeeded = Metric.withAttributes(dispatchTotal, {
    ...dimensions,
    "cqrs.outcome": "success",
  });
  const failed = Metric.withAttributes(dispatchTotal, {
    ...dimensions,
    "cqrs.outcome": "failure",
  });

  return (payload) =>
    // Measuring the exit rather than the success keeps a failed dispatch on the
    // same footing as a slow one; re-raising the exit preserves the cause.
    Effect.timed(Effect.exit(dispatch(payload))).pipe(
      Effect.flatMap(([elapsed, exit]) =>
        Metric.update(duration, elapsed).pipe(
          Effect.andThen(Metric.update(Exit.isSuccess(exit) ? succeeded : failed, 1)),
          Effect.andThen(exit),
        ),
      ),
    );
};
