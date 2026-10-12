// Drift gate: each fixture's default output must round-trip through
// the `@org/contracts` schemas (encode → decode). If a contract field
// is added/removed/renamed, this test breaks before any feature test
// does.

import * as TodosContract from "@org/contracts/api/TodosContract";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { makeCreateTodoPayload, makeTodo } from "./todo";

const roundTrip = <A, I>(schema: Schema.Codec<A, I>, value: A) =>
  Effect.runPromise(
    Effect.flatMap(Schema.encodeEffect(schema)(value), (encoded) =>
      Schema.decodeUnknownEffect(schema)(encoded),
    ),
  );

describe("todo fixtures", () => {
  it("makeTodo() round-trips through TodosContract.Todo", async () => {
    await expect(roundTrip(TodosContract.Todo, makeTodo())).resolves.toBeDefined();
  });

  it("makeTodo() honors overrides", () => {
    expect(makeTodo({ completed: true }).completed).toBe(true);
  });

  it("makeCreateTodoPayload() round-trips through TodosContract.CreateTodoPayload", async () => {
    await expect(
      roundTrip(TodosContract.CreateTodoPayload, makeCreateTodoPayload()),
    ).resolves.toBeDefined();
  });
});
