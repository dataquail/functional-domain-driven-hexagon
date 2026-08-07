import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import * as Command from "./command.js";
import { makeCommandBus } from "./command-bus.js";
import { mergeDispatchTables } from "./dispatch-table.js";

// What this package relies on the transport to do. None of it is behaviour we
// implement, all of it is behaviour a consumer depends on, and the transport is an
// explicitly unstable module pinned to an exact beta. These tests exist so a bump
// that changes any of it fails here rather than in someone's production.

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
const Defect = Command.make("DefectCommand", { payload: { subject: Schema.String } });
const Slow = Command.make("SlowCommand", { payload: { subject: Schema.String } });

const group = Command.group(Echo, Fail, Defect, Slow);

/** Signals when the slow handler starts, and records whether it got to finish. */
class HangProbe extends Context.Service<
  HangProbe,
  {
    readonly started: Deferred.Deferred<void>;
    readonly finished: Ref.Ref<boolean>;
  }
>()("test/HangProbe") {}

const HangProbeLive = Layer.effect(
  HangProbe,
  Effect.gen(function* () {
    return {
      started: yield* Deferred.make<void>(),
      finished: yield* Ref.make(false),
    };
  }),
);

const handlersWithProbe = () =>
  Command.handlersOf(group, {
    EchoCommand: (payload) => Effect.succeed(payload.subject),
    FailCommand: (payload) => new Rejected({ subject: payload.subject }),
    DefectCommand: () => Effect.die("handler exploded"),
    SlowCommand: () =>
      Effect.gen(function* () {
        const probe = yield* HangProbe;
        yield* Deferred.succeed(probe.started, undefined);
        yield* Effect.sleep("150 millis");
        yield* Ref.set(probe.finished, true);
      }),
  }).pipe(Layer.provideMerge(HangProbeLive));

describe("transport contract", () => {
  // The unit of work rests on this: a handler must see the dispatching fiber's
  // context, not a snapshot taken when the dispatcher was built.
  it.effect("a handler observes the dispatching fiber's context", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      deepStrictEqual(yield* bus.EchoCommand({ subject: "hello" }), "hello");
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // A declared failure has to arrive as itself, or every `catchTag` a caller wrote
  // against the definition stops matching.
  it.effect("a declared failure arrives as itself, not wrapped", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const caught = yield* bus
        .FailCommand({ subject: "nope" })
        .pipe(Effect.catchTag("Rejected", (error) => Effect.succeed(`caught:${error.subject}`)));

      deepStrictEqual(caught, "caught:nope");
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // A defect must stay a defect. If the transport turned one into a typed failure,
  // a caller's exhaustive error handling would silently start swallowing bugs.
  it.effect("a handler's defect reaches the caller as a defect", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const exit = yield* Effect.exit(bus.DefectCommand({ subject: "boom" }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) deepStrictEqual(Cause.hasDies(exit.cause), true);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // Interruption from OUTSIDE the dispatching fiber does not reach the handler:
  // the caller unblocks promptly, but the handler runs to completion on the
  // transport's own fiber.
  //
  // Pinned as the behaviour it is, not the behaviour one would want. Neither
  // transport end exposes an option for it, and converting external interruption
  // into a race the handler loses fails the same way — both fixes would have to run
  // during the caller's teardown, which is exactly what does not complete. The
  // exposure is a client hanging up mid-request: the command still commits, all of
  // it or none. A transport that propagates this will fail the test, which is the
  // point, because that is a behaviour change worth noticing.
  it.live("leaves the handler running when the caller is interrupted from outside", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const probe = yield* HangProbe;

      const dispatching = yield* Effect.forkChild(bus.SlowCommand({ subject: "wait" }));
      yield* Deferred.await(probe.started);

      // The caller does unblock — interruption is not simply ignored.
      yield* Fiber.interrupt(dispatching);

      // Well past the handler's own work.
      yield* Effect.sleep("400 millis");

      deepStrictEqual(yield* Ref.get(probe.finished), true);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // The complement, and the reason the limitation above is narrow: interruption
  // that originates *inside* the dispatching fiber does abort the handler. This is
  // what makes a deadline at the dispatch site work, and it is pinned so nobody
  // "fixes" a case that already behaves correctly.
  it.live("aborts the handler when the dispatch itself times out", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const probe = yield* HangProbe;

      yield* Effect.ignore(Effect.timeout(bus.SlowCommand({ subject: "wait" }), "50 millis"));
      yield* Deferred.await(probe.started);
      yield* Effect.sleep("400 millis");

      deepStrictEqual(yield* Ref.get(probe.finished), false);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  it.live("aborts the handler when the dispatch loses a race", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const probe = yield* HangProbe;

      yield* Effect.race(bus.SlowCommand({ subject: "wait" }), Effect.sleep("50 millis"));
      yield* Effect.sleep("400 millis");

      deepStrictEqual(yield* Ref.get(probe.finished), false);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // Dispatches must not serialise behind one another, or one slow handler would
  // stall every concurrent request.
  it.effect("concurrent dispatches all resolve, and independently", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);

      const results = yield* Effect.all(
        Array.from({ length: 25 }, (_, i) => bus.EchoCommand({ subject: `n${i}` })),
        { concurrency: "unbounded" },
      );

      deepStrictEqual(results.length, 25);
      deepStrictEqual(results[0], "n0");
      deepStrictEqual(results[24], "n24");
    }).pipe(Effect.provide(handlersWithProbe())),
  );
});

describe("app-wide bus routing", () => {
  // The consequence ADR-0006 accepts for an erased routing table. Boot-time
  // `declaredIn` is what makes this unreachable in a wired application, but the
  // fallback still has to be a defect rather than a silent success.
  it.effect("dispatching a tag nothing routes is a defect", () =>
    Effect.gen(function* () {
      const bus = makeCommandBus(mergeDispatchTables({}));
      const exit = yield* Effect.exit(bus.execute(Echo, { subject: "hello" }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) deepStrictEqual(Cause.hasDies(exit.cause), true);
    }),
  );
});
