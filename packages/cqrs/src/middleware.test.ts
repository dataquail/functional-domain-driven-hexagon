import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Metric from "effect/Metric";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import * as Command from "./command.js";
import * as Middleware from "./middleware.js";

class Rejected extends Schema.TaggedErrorClass<Rejected>()("Rejected", {
  subject: Schema.String,
}) {}

const Echo = Command.make("EchoCommand", {
  payload: { subject: Schema.String },
  success: Schema.String,
});
const Fail = Command.make("FailCommand", {
  payload: { subject: Schema.String },
  failure: Rejected,
});

const Slow = Command.make("SlowCommand", {
  payload: { subject: Schema.String },
  success: Schema.String,
});

const group = Command.group(Echo, Fail, Slow);

/** Records whether the slow handler was allowed to run to completion. */
class SlowProbe extends Context.Service<SlowProbe, { readonly finished: Ref.Ref<boolean> }>()(
  "test/middleware/SlowProbe",
) {}

const SlowProbeLive = Layer.effect(
  SlowProbe,
  Effect.map(Ref.make(false), (finished) => ({ finished })),
);

/**
 * Built per test rather than once per module: the suite runs its tests
 * concurrently, so a single shared probe would have them writing over each other.
 */
const handlers = () =>
  Command.handlersOf(group, {
    EchoCommand: (payload) => Effect.succeed(payload.subject),
    FailCommand: (payload) => new Rejected({ subject: payload.subject }),
    SlowCommand: (payload) =>
      Effect.gen(function* () {
        const probe = yield* SlowProbe;
        yield* Effect.sleep("200 millis");
        yield* Ref.set(probe.finished, true);
        return payload.subject;
      }),
  }).pipe(Layer.provideMerge(SlowProbeLive));

/** Appends a label on the way in and on the way out, to expose nesting order. */
const recording =
  (label: string, log: Ref.Ref<ReadonlyArray<string>>): Middleware.Middleware =>
  (dispatch) =>
  (payload) =>
    Ref.update(log, (prev) => [...prev, `>${label}`]).pipe(
      Effect.andThen(dispatch(payload)),
      Effect.tap(() => Ref.update(log, (prev) => [...prev, `<${label}`])),
    );

describe("Middleware", () => {
  it.effect("wraps a dispatch, outermost first", () =>
    Effect.gen(function* () {
      const log = yield* Ref.make<ReadonlyArray<string>>([]);
      const bus = yield* Command.dispatcher(group, {
        middleware: [recording("outer", log), recording("inner", log)],
      });

      deepStrictEqual(yield* bus.EchoCommand({ subject: "hello" }), "hello");
      deepStrictEqual(yield* Ref.get(log), [">outer", ">inner", "<inner", "<outer"]);
    }).pipe(Effect.provide(handlers())),
  );

  it.effect("sees the tag and side of the message it wraps", () =>
    Effect.gen(function* () {
      const seen = yield* Ref.make<ReadonlyArray<string>>([]);
      const report: Middleware.Middleware = (dispatch, context) => (payload) =>
        Ref.update(seen, (prev) => [...prev, `${context.side}:${context.tag}`]).pipe(
          Effect.andThen(dispatch(payload)),
        );

      const bus = yield* Command.dispatcher(group, { middleware: [report] });
      yield* bus.EchoCommand({ subject: "hello" });
      yield* Effect.ignore(bus.FailCommand({ subject: "nope" }));

      deepStrictEqual(yield* Ref.get(seen), ["command:EchoCommand", "command:FailCommand"]);
    }).pipe(Effect.provide(handlers())),
  );

  // A middleware that widened the error channel would invalidate every `catchTag`
  // written against the message definition, which is the property the typed bus
  // exists to provide. The constraint is what keeps the seam safe to open.
  it("cannot widen the declared channels", () => {
    const widensError: Middleware.Middleware = (dispatch) => (payload) =>
      // @ts-expect-error a middleware may not add an error the definition never declared
      // @effect-diagnostics-next-line missingEffectError:off
      Effect.andThen(dispatch(payload), Effect.fail("surprise" as const));
    const changesSuccess: Middleware.Middleware = (dispatch) => (payload) =>
      // @ts-expect-error a middleware may not change the success type
      Effect.as(dispatch(payload), 42);

    deepStrictEqual(typeof widensError, "function");
    deepStrictEqual(typeof changesSuccess, "function");
  });

  it.effect("a declared failure still arrives as itself through middleware", () =>
    Effect.gen(function* () {
      const log = yield* Ref.make<ReadonlyArray<string>>([]);
      const bus = yield* Command.dispatcher(group, { middleware: [recording("wrap", log)] });

      const caught = yield* bus
        .FailCommand({ subject: "nope" })
        .pipe(Effect.catchTag("Rejected", (error) => Effect.succeed(`caught:${error.subject}`)));

      deepStrictEqual(caught, "caught:nope");
    }).pipe(Effect.provide(handlers())),
  );
});

describe("Middleware.metrics", () => {
  it.effect("counts a success and a failure separately, and times both", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group, { middleware: [Middleware.metrics()] });

      yield* bus.EchoCommand({ subject: "hello" });
      yield* Effect.ignore(bus.FailCommand({ subject: "nope" }));

      const succeeded = yield* Metric.value(
        Metric.withAttributes(Middleware.dispatchTotal, {
          "cqrs.tag": "EchoCommand",
          "cqrs.side": "command",
          "cqrs.outcome": "success",
        }),
      );
      const failed = yield* Metric.value(
        Metric.withAttributes(Middleware.dispatchTotal, {
          "cqrs.tag": "FailCommand",
          "cqrs.side": "command",
          "cqrs.outcome": "failure",
        }),
      );

      deepStrictEqual(succeeded.count, 1);
      deepStrictEqual(failed.count, 1);

      // Timed on the failing path too — a slow failure is still a slow request.
      const timed = yield* Metric.value(
        Metric.withAttributes(Middleware.dispatchDuration, {
          "cqrs.tag": "FailCommand",
          "cqrs.side": "command",
        }),
      );
      deepStrictEqual(timed.count, 1);
    }).pipe(Effect.provide(handlers())),
  );
});

describe("Middleware.deadline", () => {
  it.effect("passes a dispatch that finishes in time straight through", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group, {
        middleware: [Middleware.deadline("5 seconds")],
      });

      deepStrictEqual(yield* bus.EchoCommand({ subject: "hello" }), "hello");
    }).pipe(Effect.provide(handlers())),
  );

  // A deadline is a property of how the host dispatches, not of the message, so no
  // definition declares it and no call site can be expected to handle it.
  it.live("raises expiry as a defect, naming the message and the limit", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group, {
        middleware: [Middleware.deadline("20 millis")],
      });

      const exit = yield* Effect.exit(bus.SlowCommand({ subject: "wait" }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const defect = Cause.squash(exit.cause);
        deepStrictEqual(defect instanceof Middleware.DeadlineExceeded, true);
        if (defect instanceof Middleware.DeadlineExceeded) {
          deepStrictEqual(defect.tag, "SlowCommand");
          deepStrictEqual(defect.side, "command");
          deepStrictEqual(defect.after, "20ms");
        }
      }
    }).pipe(Effect.provide(handlers())),
  );

  // Expiry has to reach the handler, not just release the caller: the point of a
  // deadline is that the work stops and the transaction it was running in rolls
  // back, rather than a dispatch nobody is waiting for carrying on writing.
  it.live("aborts the handler instead of leaving it running", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group, {
        middleware: [Middleware.deadline("20 millis")],
      });
      const probe = yield* SlowProbe;

      // `exit`, not `ignore`: the deadline raises a defect, which `ignore` lets through.
      yield* Effect.exit(bus.SlowCommand({ subject: "wait" }));
      yield* Effect.sleep("400 millis");

      deepStrictEqual(yield* Ref.get(probe.finished), false);
    }).pipe(Effect.provide(handlers())),
  );

  it.effect("leaves a declared failure alone", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group, {
        middleware: [Middleware.deadline("5 seconds")],
      });

      const caught = yield* bus
        .FailCommand({ subject: "nope" })
        .pipe(Effect.catchTag("Rejected", (error) => Effect.succeed(`caught:${error.subject}`)));

      deepStrictEqual(caught, "caught:nope");
    }).pipe(Effect.provide(handlers())),
  );
});
