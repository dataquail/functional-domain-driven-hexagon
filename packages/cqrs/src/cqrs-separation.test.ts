import { describe, it } from "@effect/vitest";
import { Command, type CommandBusShape, Query, type QueryBusShape } from "@org/cqrs";
import { deepStrictEqual } from "assert";
import * as Schema from "effect/Schema";

// The reason there are two facades instead of one. A command group and a query group
// are distinct types, so neither side will build a dispatcher over the other side's
// group, and neither bus Tag will accept the other side's definition. The guarantee
// is compile-time — nothing observable at runtime distinguishes them — so
// it is asserted with `@ts-expect-error`: were the separation ever lost, these calls
// would start compiling and the unused directive would fail the build.

const DoThing = Command.make("DoThingCommand", { payload: { id: Schema.String } });
const FindThing = Query.make("FindThingQuery", {
  payload: { id: Schema.String },
  success: Schema.String,
});

const commands = Command.group(DoThing);
const queries = Query.group(FindThing);

describe("CQRS separation", () => {
  it("the write side will not build a dispatcher over a query group", () => {
    // @ts-expect-error a query group is not a command group
    const rejected = () => Command.dispatcher(queries);
    deepStrictEqual(typeof rejected, "function");
  });

  it("the read side will not build a dispatcher over a command group", () => {
    // @ts-expect-error a command group is not a query group
    const rejected = () => Query.dispatcher(commands);
    deepStrictEqual(typeof rejected, "function");
  });

  it("a command's handlers cannot be registered against a query group", () => {
    // @ts-expect-error the tags belong to the other side's group
    const rejected = () => Command.handlersOf(queries, {});
    deepStrictEqual(typeof rejected, "function");
  });

  it("each side accepts its own group", () => {
    const commandSide = () => Command.dispatcher(commands);
    const querySide = () => Query.dispatcher(queries);
    deepStrictEqual([typeof commandSide, typeof querySide], ["function", "function"]);
  });

  it("the application-wide buses reject the other side's definition", () => {
    const dispatchOnWrongBus = (bus: CommandBusShape, queryBus: QueryBusShape) => [
      // @ts-expect-error a query cannot be dispatched on the command bus
      () => bus.execute(FindThing, { id: "x" }),
      // @ts-expect-error a command cannot be dispatched on the query bus
      () => queryBus.execute(DoThing, { id: "x" }),
    ];
    deepStrictEqual(typeof dispatchOnWrongBus, "function");
  });
});
