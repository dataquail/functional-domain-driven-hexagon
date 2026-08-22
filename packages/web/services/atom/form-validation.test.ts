import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { validateWithSchema } from "./form-validation";

const Signup = Schema.Struct({
  email: Schema.String.check(Schema.isMinLength(3)),
  age: Schema.String,
});

describe("validateWithSchema", () => {
  it("returns null when the input satisfies the schema", () => {
    expect(validateWithSchema(Signup)({ email: "ada@example.com", age: "36" })).toBeNull();
  });

  it("maps each issue onto its field", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: "36" });
    expect(errors).not.toBeNull();
    expect(Object.keys(errors ?? {})).toEqual(["email"]);
  });

  it("reports every failing field, not just the first", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: 36 as unknown as string });
    expect(Object.keys(errors ?? {}).sort()).toEqual(["age", "email"]);
  });
});
