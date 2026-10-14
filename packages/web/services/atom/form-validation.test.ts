import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";

import { hasFieldErrors, validateWithSchema, visibleOnceAttempted } from "./form-validation";

const Signup = Schema.Struct({
  email: Schema.String.check(Schema.isMinLength(3)),
  age: Schema.String.check(Schema.isMinLength(1)),
});

describe("validateWithSchema", () => {
  it("reports no errors when the input satisfies the schema", () => {
    const errors = validateWithSchema(Signup)({ email: "ada@example.com", age: "36" });

    expect(errors).toEqual({});
    expect(hasFieldErrors(errors)).toBe(false);
  });

  it("maps each issue onto its field", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: "36" });

    expect(hasFieldErrors(errors)).toBe(true);
    expect(Object.keys(errors)).toEqual(["email"]);
  });

  it("reports every failing field, not just the first", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: "" });

    expect(Object.keys(errors).sort()).toEqual(["age", "email"]);
  });
});

describe("visibleOnceAttempted", () => {
  it("hides the errors until the first submit attempt", () => {
    const errors = validateWithSchema(Signup)({ email: "a", age: "36" });

    expect(visibleOnceAttempted(false, errors)).toEqual({});
    expect(visibleOnceAttempted(true, errors)).toEqual(errors);
  });
});
