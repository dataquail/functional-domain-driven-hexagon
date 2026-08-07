import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
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
import { mergeDispatchTables, MissingHandler } from "./dispatch-table.js";

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

  // A defect belongs to the request that raised it. The transport can be asked to
  // treat one as fatal to the *connection* instead, and with one client/server
  // pair per module, shared process-wide, that would fail every dispatch in flight
  // beside it — one handler's bug 500-ing unrelated callers. Defects are not a
  // rare path here: a failed commit, an expired deadline and a forgotten unit of
  // work are all defects by design.
  it.live("a handler's defect leaves concurrent dispatches alone", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const probe = yield* HangProbe;

      const bystander = yield* Effect.forkChild(Effect.exit(bus.SlowCommand({ subject: "wait" })));
      yield* Deferred.await(probe.started);

      const exploded = yield* Effect.exit(bus.DefectCommand({ subject: "boom" }));
      const survived = yield* Fiber.join(bystander);

      // The defect still reaches its own caller, and only its own caller.
      deepStrictEqual(Exit.isFailure(exploded), true);
      deepStrictEqual(Exit.isSuccess(survived), true);
      deepStrictEqual(yield* Ref.get(probe.finished), true);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // The client builds the payload through its schema on the way in, so a value
  // that violates the schema it was declared with never reaches a handler. What
  // this pins is *where* it is rejected: an Effect-returning function must not
  // throw where it is called, or the failure escapes every combinator the caller
  // wrapped around it and, outside a fiber, Effect entirely.
  it.effect("a payload that fails its own schema dies in the effect, not at the call site", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);

      // Constructed, not run: this line throwing is the regression.
      const dispatch = bus.EchoCommand({ subject: 42 as never });
      const exit = yield* Effect.exit(dispatch);

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) deepStrictEqual(Cause.hasDies(exit.cause), true);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // Interruption from outside the dispatching fiber DOES reach the handler: the
  // client sends an interrupt for the request and the server interrupts the fiber
  // running it, so a caller that hangs up aborts the work and rolls its
  // transaction back rather than leaving it writing with nobody waiting.
  //
  // One qualification, which the scheduler turn below deliberately steps over: an
  // interrupt delivered before the server has registered the handler's fiber finds
  // nothing to interrupt and that dispatch runs on orphaned. Only reachable by
  // interrupting in the same turn the handler starts in, which no real caller does.
  it.live("aborts the handler when the caller is interrupted from outside", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(group);
      const probe = yield* HangProbe;

      const dispatching = yield* Effect.forkChild(bus.SlowCommand({ subject: "wait" }));
      yield* Deferred.await(probe.started);
      yield* Effect.sleep(0);

      yield* Fiber.interrupt(dispatching);

      // Well past the handler's own work.
      yield* Effect.sleep("400 millis");

      deepStrictEqual(yield* Ref.get(probe.finished), false);
    }).pipe(Effect.provide(handlersWithProbe())),
  );

  // Interruption that originates *inside* the dispatching fiber aborts the handler
  // too. This is what makes a deadline at the dispatch site work.
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
  it.effect("dispatching a tag nothing routes is a defect naming the bus and the tag", () =>
    Effect.gen(function* () {
      const bus = makeCommandBus(mergeDispatchTables({}));
      const exit = yield* Effect.exit(bus.execute(Echo, { subject: "hello" }));

      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const defect = Cause.squash(exit.cause);
        deepStrictEqual(defect instanceof MissingHandler, true);
        if (defect instanceof MissingHandler) {
          deepStrictEqual(defect.bus, "CommandBus");
          deepStrictEqual(defect.tag, "EchoCommand");
        }
      }
    }),
  );
});
