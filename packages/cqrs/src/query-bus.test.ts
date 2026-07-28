import { describe, it } from "@effect/vitest";
import { Query } from "@org/cqrs";
import { deepStrictEqual } from "assert";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// Stands in for the read model's data source, wired at the composition root.
class ReadModel extends Context.Service<ReadModel, { readonly rows: ReadonlyArray<string> }>()(
  "test/query-bus/ReadModel",
) {}

// Stands in for a per-dispatch ambient service a caller enters after the bus is
// built — the unit of work's transaction context is the real one, and a query
// resolved during a mutation has to read through it.
class Ambient extends Context.Service<Ambient, { readonly value: string }>()(
  "test/query-bus/Ambient",
) {}

const FindThings = Query.make("FindThingsQuery", {
  payload: { prefix: Schema.String },
  success: Schema.Struct({ matches: Schema.Array(Schema.String), sawAmbient: Schema.String }),
});

const TestGroup = Query.group(FindThings);

const handlers = Query.handlersOf(TestGroup, {
  FindThingsQuery: (payload) =>
    Effect.gen(function* () {
      const readModel = yield* ReadModel;
      const ambient = yield* Effect.serviceOption(Ambient);
      return {
        matches: readModel.rows.filter((row) => row.startsWith(payload.prefix)),
        sawAmbient: Option.match(ambient, {
          onNone: () => "absent",
          onSome: (a) => a.value,
        }),
      };
    }),
});

const withReadModel = (rows: ReadonlyArray<string>) =>
  Effect.provide(handlers.pipe(Layer.provide(Layer.succeed(ReadModel, { rows }))));

describe("Query.dispatcher", () => {
  it.effect("dispatches without anything provided at the call site", () =>
    Effect.gen(function* () {
      const bus = yield* Query.dispatcher(TestGroup);
      const result = yield* bus.FindThingsQuery({ prefix: "a" });
      deepStrictEqual(result.matches, ["alpha", "acme"]);
    }).pipe(withReadModel(["alpha", "beta", "acme"])),
  );

  // A policy check resolved during a command runs inside that command's
  // transaction; the read has to see the transaction to read through it.
  it.effect("a handler observes services the caller entered after the bus was built", () =>
    Effect.gen(function* () {
      const bus = yield* Query.dispatcher(TestGroup);
      const result = yield* bus
        .FindThingsQuery({ prefix: "a" })
        .pipe(Effect.provideService(Ambient, { value: "from-caller" }));
      deepStrictEqual(result.sawAmbient, "from-caller");
    }).pipe(withReadModel(["alpha"])),
  );

  it.effect("opens one span named for the query tag, nested under the caller's", () =>
    Effect.gen(function* () {
      const spanGroup = Query.group(Query.make("SpanProbeQuery", { success: Schema.String }));
      const spanHandlers = Query.handlersOf(spanGroup, {
        SpanProbeQuery: () =>
          Effect.gen(function* () {
            const span = yield* Effect.orDie(Effect.currentSpan);
            const parentName = Option.match(
              span.parent as Option.Option<{ readonly name?: string }>,
              { onNone: () => "none", onSome: (parent) => parent.name ?? "external" },
            );
            return `${span.name}|${parentName}`;
          }),
      });
      const observed = yield* Effect.gen(function* () {
        const bus = yield* Query.dispatcher(spanGroup);
        return yield* bus.SpanProbeQuery(undefined).pipe(Effect.withSpan("CallerLive.read"));
      }).pipe(Effect.provide(spanHandlers));
      deepStrictEqual(observed, "query.SpanProbeQuery|CallerLive.read");
    }),
  );
});
