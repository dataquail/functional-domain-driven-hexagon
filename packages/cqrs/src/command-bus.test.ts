import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// Stands in for a handler dependency the composition root wires (a repository,
// a gateway): declared in the handler's requirements, never at a call site.
class HandlerDep extends Context.Service<HandlerDep, { readonly value: string }>()(
  "test/command-bus/HandlerDep",
) {}

// Stands in for a per-dispatch ambient service a caller enters after the bus is
// built — the unit of work's transaction context is the real one.
class Ambient extends Context.Service<Ambient, { readonly value: string }>()(
  "test/command-bus/Ambient",
) {}

class SubjectRejected extends Schema.TaggedErrorClass<SubjectRejected>()("SubjectRejected", {
  subject: Schema.String,
}) {}

const Echo = Command.make("Echo", {
  payload: { subject: Schema.String },
  success: Schema.String,
});

const Reject = Command.make("Reject", {
  payload: { subject: Schema.String },
  failure: SubjectRejected,
});

const TestGroup = Command.group(Echo, Reject);

const handlers = Command.handlersOf(TestGroup, {
  Echo: (payload) =>
    Effect.gen(function* () {
      const dep = yield* HandlerDep;
      const ambient = yield* Effect.serviceOption(Ambient);
      const seen = Option.match(ambient, {
        onNone: () => "absent",
        onSome: (a) => a.value,
      });
      return `${payload.subject}:${dep.value}:${seen}`;
    }),
  Reject: (payload) => new SubjectRejected({ subject: payload.subject }),
});

const withHandlerDep = (value: string) =>
  Effect.provide(handlers.pipe(Layer.provide(Layer.succeed(HandlerDep, { value }))));

describe("Command.dispatcher", () => {
  it.effect("dispatches without anything provided at the call site", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      const result = yield* bus.Echo({ subject: "hello" });
      deepStrictEqual(result, "hello:from-layer:absent");
    }).pipe(withHandlerDep("from-layer")),
  );

  // The load-bearing one. The handler runs on a fiber the transport forks, not the
  // caller's own, so nothing guarantees a priori that a service the caller entered
  // *after* the bus was built is visible to it. This is the property the
  // unit-of-work contract rests on: a command dispatched from inside a publisher's
  // transaction has to see that transaction to join it.
  it.effect("a handler observes services the caller entered after the bus was built", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      const result = yield* bus
        .Echo({ subject: "hello" })
        .pipe(Effect.provideService(Ambient, { value: "from-caller" }));
      deepStrictEqual(result, "hello:from-layer:from-caller");
    }).pipe(withHandlerDep("from-layer")),
  );

  // Precedence when the caller and the handler layer both supply a key. Pinned
  // because it is observable behaviour a consumer can depend on, and because the
  // obvious hand-rolled alternative (providing a captured context) has the
  // opposite precedence.
  it.effect("the caller's service wins over the handler layer's on collision", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      const result = yield* bus
        .Echo({ subject: "hello" })
        .pipe(Effect.provideService(HandlerDep, { value: "from-caller" }));
      deepStrictEqual(result, "hello:from-caller:absent");
    }).pipe(withHandlerDep("from-layer")),
  );

  // Callers map a declared failure onto their own vocabulary with `catchTag`, so it
  // has to arrive as itself — not wrapped, and not widened with a transport error
  // the caller would have to handle.
  it.effect("a declared failure arrives as itself and stays catchable by tag", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      // The `never` in the error slot is the assertion: had the bus widened the
      // channel with a transport error, catching the one declared tag would leave a
      // residue and this would stop compiling.
      const handled: Effect.Effect<string | void, never, never> = bus
        .Reject({ subject: "nope" })
        .pipe(Effect.catchTag("SubjectRejected", (e) => Effect.succeed(`caught:${e.subject}`)));
      deepStrictEqual(yield* handled, "caught:nope");
    }).pipe(withHandlerDep("from-layer")),
  );
});
