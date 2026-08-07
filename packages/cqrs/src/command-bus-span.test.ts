import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { Command } from "@org/cqrs";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const CreateThing = Command.make("CreateThingCommand", {
  payload: { name: Schema.String, secret: Schema.String },
  success: Schema.String,
});

const TestGroup = Command.group(CreateThing);

// The handler reports the span it is running under, and that span's parent, so
// the assertions describe what the bus actually opened rather than an assumed
// naming scheme.
const handlers = Command.handlersOf(TestGroup, {
  CreateThingCommand: () =>
    Effect.gen(function* () {
      const span = yield* Effect.orDie(Effect.currentSpan);
      const parentName = Option.match(span.parent as Option.Option<{ readonly name?: string }>, {
        onNone: () => "none",
        onSome: (parent) => parent.name ?? "external",
      });
      return `${span.name}|${parentName}`;
    }),
});

// Reports the attributes on the span the handler is running under, so the
// redaction assertion below observes what a tracer would actually receive.
const attributesSeenByHandler = Command.handlersOf(TestGroup, {
  CreateThingCommand: () =>
    Effect.gen(function* () {
      const span = yield* Effect.orDie(Effect.currentSpan);
      return JSON.stringify(Object.fromEntries(span.attributes));
    }),
});

describe("Command.dispatcher spans", () => {
  it.effect("runs the handler inside a span named for the command tag", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      const observed = yield* bus.CreateThingCommand({ name: "widget", secret: "s3cret" });
      deepStrictEqual(observed, "command.CreateThingCommand|none");
    }).pipe(Effect.provide(handlers)),
  );

  it.effect("nests the dispatch span under the caller's span", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup);
      const observed = yield* bus
        .CreateThingCommand({ name: "widget", secret: "s3cret" })
        .pipe(Effect.withSpan("CallerLive.doThing"));
      deepStrictEqual(observed, "command.CreateThingCommand|CallerLive.doThing");
    }).pipe(Effect.provide(handlers)),
  );

  // Attributes come from a per-command extractor supplied at registration, so only
  // fields whose author has audited them reach a span. `secret` must not appear.
  it.effect("merges the per-command extractor's attributes into the dispatch span", () =>
    Effect.gen(function* () {
      const bus = yield* Command.dispatcher(TestGroup, {
        spanAttributes: {
          CreateThingCommand: (payload) => ({ "thing.name": payload.name }),
        },
      });
      const observed = yield* bus.CreateThingCommand({ name: "widget", secret: "s3cret" });
      deepStrictEqual(JSON.parse(observed), {
        "command.tag": "CreateThingCommand",
        "thing.name": "widget",
      });
    }).pipe(Effect.provide(attributesSeenByHandler)),
  );
});
