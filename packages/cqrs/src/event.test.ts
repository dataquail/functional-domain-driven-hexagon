import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import * as Event from "./event.js";

const UserRegistered = Event.make("UserRegistered", {
  userId: Schema.String,
  email: Schema.String,
});

/** Stands in for anywhere an event is expected — a subscription, a saga's watch list. */
const acceptsAnEvent = (event: Event.Any) => event.tag;

describe("Event.make", () => {
  it("forwards construction, so declaring an event does not cost a level of indirection", () => {
    const registered = UserRegistered.make({ userId: "u1", email: "a@b.c" });

    deepStrictEqual(registered, { _tag: "UserRegistered", userId: "u1", email: "a@b.c" });
  });

  it("names the tag a bus routes on", () => {
    deepStrictEqual(UserRegistered.tag, "UserRegistered");
  });

  it("keeps the schema reachable for the callers that genuinely want one", () => {
    deepStrictEqual(Schema.isSchema(UserRegistered.schema), true);
  });
});

// The reason an event holds its schema instead of being one. Every schema
// combinator returns a NEW schema, which would carry neither the tag nor the
// brand — so an event that was a schema could be derived from into something that
// is no longer an event, with nothing at the call site to say so. Making the two
// different kinds of thing turns that from a silent runtime surprise into a
// compile error, which is what these `@ts-expect-error` directives assert: were an
// event ever to become a schema again, these would start compiling and the unused
// directives would fail the build.
describe("an event is not a schema", () => {
  it("a schema derived from the event's own schema is not accepted as an event", () => {
    const rejected = () => [
      // @ts-expect-error an annotated schema is a schema, not an event
      acceptsAnEvent(UserRegistered.schema.annotate({})),
      // @ts-expect-error an optional schema is a schema, not an event
      acceptsAnEvent(Schema.optional(UserRegistered.schema)),
      // @ts-expect-error the event's own schema is not the event
      acceptsAnEvent(UserRegistered.schema),
    ];

    deepStrictEqual(typeof rejected, "function");
  });

  it("an unrelated tagged struct is not accepted as an event", () => {
    const impostor = Schema.TaggedStruct("UserRegistered", { userId: Schema.String });
    const rejected = () =>
      // @ts-expect-error a tagged struct that was never declared as an event is not one
      acceptsAnEvent(impostor);

    deepStrictEqual(typeof rejected, "function");
  });
});

describe("Event.is", () => {
  it("identifies a declared event", () => {
    deepStrictEqual(Event.is(UserRegistered), true);
  });

  // The runtime half of the same guarantee, for a host reflecting over its barrels:
  // whatever a schema combinator hands back is never mistaken for an event.
  it("rejects the event's schema, anything derived from it, and non-events", () => {
    deepStrictEqual(
      [
        Event.is(UserRegistered.schema),
        Event.is(UserRegistered.schema.annotate({})),
        Event.is(Schema.TaggedStruct("UserRegistered", { userId: Schema.String })),
        Event.is({ tag: "UserRegistered" }),
        Event.is(undefined),
      ],
      [false, false, false, false, false],
    );
  });
});
