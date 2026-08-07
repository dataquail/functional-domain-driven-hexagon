import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Command from "./command.js";
import { makeCommandBus } from "./command-bus.js";
import { mergeDispatchTables } from "./dispatch-table.js";
import * as Query from "./query.js";
import { makeQueryBus } from "./query-bus.js";

const CreateThing = Command.make("CreateThingCommand", { payload: { name: Schema.String } });
const ArchiveThing = Command.make("ArchiveThingCommand", { payload: { id: Schema.String } });
const FindThing = Query.make("FindThingQuery", {
  payload: { id: Schema.String },
  success: Schema.String,
});

const thingCommands = Command.group(CreateThing, ArchiveThing);
const thingQueries = Query.group(FindThing);

/** Stands in for a module's built dispatch surface, without the transport. */
const dispatcherFor = (tags: ReadonlyArray<string>) =>
  Object.fromEntries(tags.map((tag) => [tag, () => Effect.void]));

describe("message groups", () => {
  it("name the tags they carry, so a bus can be checked against them", () => {
    deepStrictEqual(thingCommands.tags, ["CreateThingCommand", "ArchiveThingCommand"]);
    deepStrictEqual(thingQueries.tags, ["FindThingQuery"]);
  });
});

describe("makeCommandBus completeness", () => {
  // The failure this exists to stop: a module whose dispatch surface was never
  // merged at the composition root. Every dispatch site still compiles, and the
  // first call to one of its tags dies — possibly in production, on a rarely-hit
  // endpoint. Checking at boot turns that into a startup failure.
  it("rejects a declared tag that nothing routes, naming it", () => {
    throws(
      () =>
        makeCommandBus(mergeDispatchTables(dispatcherFor(["CreateThingCommand"])), {
          declaredIn: [thingCommands],
        }),
      /ArchiveThingCommand/,
    );
  });

  it("accepts a table that routes every declared tag", () => {
    const bus = makeCommandBus(
      mergeDispatchTables(dispatcherFor(["CreateThingCommand", "ArchiveThingCommand"])),
      { declaredIn: [thingCommands] },
    );

    deepStrictEqual([...bus.tags].sort(), ["ArchiveThingCommand", "CreateThingCommand"]);
  });

  // A table may legitimately route more than the groups handed to the check —
  // a host that composes a subset of its modules for a test, say.
  it("allows a table that routes more than was declared", () => {
    const bus = makeCommandBus(
      mergeDispatchTables(dispatcherFor(["CreateThingCommand", "ArchiveThingCommand"])),
      { declaredIn: [Command.group(CreateThing)] },
    );

    deepStrictEqual(bus.tags.has("ArchiveThingCommand"), true);
  });

  it("checks nothing when no groups are declared", () => {
    const bus = makeCommandBus(mergeDispatchTables(dispatcherFor(["CreateThingCommand"])));

    deepStrictEqual([...bus.tags], ["CreateThingCommand"]);
  });
});

describe("makeQueryBus completeness", () => {
  it("rejects a declared tag that nothing routes, naming it", () => {
    throws(
      () => makeQueryBus(mergeDispatchTables({}), { declaredIn: [thingQueries] }),
      /FindThingQuery/,
    );
  });

  it("accepts a table that routes every declared tag", () => {
    const bus = makeQueryBus(mergeDispatchTables(dispatcherFor(["FindThingQuery"])), {
      declaredIn: [thingQueries],
    });

    deepStrictEqual([...bus.tags], ["FindThingQuery"]);
  });
});

describe("message predicates", () => {
  // What lets a host reflect over its own module barrels and ask "is every
  // message I export actually reachable?" — the check a bus cannot make, because
  // a definition nobody put in a group is invisible to it.
  it("recognise their own side and reject the other's", () => {
    deepStrictEqual(Command.is(CreateThing), true);
    deepStrictEqual(Command.is(FindThing), false);
    deepStrictEqual(Query.is(FindThing), true);
    deepStrictEqual(Query.is(CreateThing), false);
  });

  it("reject values that are not messages at all", () => {
    for (const notAMessage of [undefined, null, {}, "CreateThingCommand", thingCommands]) {
      deepStrictEqual(Command.is(notAMessage), false);
      deepStrictEqual(Query.is(notAMessage), false);
    }
  });
});
