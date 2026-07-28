import { describe, it } from "@effect/vitest";
import { deepStrictEqual, throws } from "assert";
import * as Effect from "effect/Effect";

import { mergeDispatchTables } from "./dispatch-table.js";

const entry = (name: string) => () => Effect.succeed(name);

describe("mergeDispatchTables", () => {
  it("routes every contributing module's tags through one lookup", () => {
    const merged = mergeDispatchTables(
      { CreateWalletCommand: entry("wallet") },
      { CreateUserCommand: entry("user"), DeleteUserCommand: entry("user") },
    );

    deepStrictEqual(Object.keys(merged).sort(), [
      "CreateUserCommand",
      "CreateWalletCommand",
      "DeleteUserCommand",
    ]);
  });

  it("is empty when no module has contributed", () => {
    deepStrictEqual(Object.keys(mergeDispatchTables()), []);
  });

  it("rejects a tag claimed by two modules, naming the tag", () => {
    throws(
      () =>
        mergeDispatchTables(
          { CreateWalletCommand: entry("wallet") },
          { CreateWalletCommand: entry("impostor") },
        ),
      /CreateWalletCommand/,
    );
  });
});
