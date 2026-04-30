import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { orFail } from "../src/or-fail.js";

class NotFound {
  public readonly _tag = "NotFound";
}

describe("orFail", () => {
  it("passes the value through unchanged when the upstream effect succeeds with non-null", async () => {
    const result = await Effect.runPromise(
      Effect.succeed("hello").pipe(orFail(() => new NotFound())),
    );
    expect(result).toBe("hello");
  });

  it("fails with the provided error when the upstream effect succeeds with null", async () => {
    const exit = await Effect.runPromiseExit(
      Effect.succeed(null as string | null).pipe(orFail(() => new NotFound())),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error).toBeInstanceOf(NotFound);
    } else {
      throw new Error("expected typed Fail");
    }
  });

  it("propagates upstream failures unchanged", async () => {
    class DatabaseError {
      public readonly _tag = "DatabaseError";
    }
    const exit = await Effect.runPromiseExit(
      Effect.fail(new DatabaseError()).pipe(orFail(() => new NotFound())),
    );
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
      expect(exit.cause.error._tag).toBe("DatabaseError");
    } else {
      throw new Error("expected typed Fail");
    }
  });
});
