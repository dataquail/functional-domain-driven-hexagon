import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { makeFormOptions, validateWithSchema } from "./make-form-options";

const EmailField = Schema.Struct({
  email: Schema.NonEmptyString,
});

const AddressField = Schema.Struct({
  address: Schema.Struct({
    country: Schema.NonEmptyString,
  }),
});

const RefinedPositive = Schema.Struct({
  count: Schema.Number,
}).pipe(
  Schema.filter((s) => (s.count > 0 ? undefined : "count must be positive"), {
    identifier: "PositiveCount",
  }),
);

const MultiField = Schema.Struct({
  email: Schema.NonEmptyString,
  country: Schema.NonEmptyString,
});

describe("validateWithSchema", () => {
  it("returns null when input is valid", () => {
    const validate = validateWithSchema(EmailField);
    expect(validate({ value: { email: "a@b.com" } })).toBeNull();
  });

  it("flattens a single field error to its dot-path key", () => {
    const validate = validateWithSchema(EmailField);
    const result = validate({ value: { email: "" } });
    expect(result).not.toBeNull();
    expect(result?.email).toBeDefined();
  });

  it("dot-joins nested paths", () => {
    const validate = validateWithSchema(AddressField);
    const result = validate({ value: { address: { country: "" } } }) as Record<
      string,
      string | undefined
    > | null;
    expect(result).not.toBeNull();
    expect(result?.["address.country"]).toBeDefined();
  });

  it("reports every field error when errors: 'all' is used (default)", () => {
    const validate = validateWithSchema(MultiField);
    const result = validate({ value: { email: "", country: "" } });
    expect(result).not.toBeNull();
    expect(result?.email).toBeDefined();
    expect(result?.country).toBeDefined();
  });

  it("keys root-level (path length 0) errors under '' (RootErrorKey)", () => {
    const validate = validateWithSchema(RefinedPositive);
    const result = validate({ value: { count: -1 } }) as Record<string, string | undefined> | null;
    expect(result).not.toBeNull();
    expect(result?.[""]).toBeDefined();
  });

  it("honors onExcessProperty: 'ignore' — extra props don't surface as errors", () => {
    const validate = validateWithSchema(EmailField);
    const result = validate({
      value: { email: "a@b.com", extra: "ignored" } as unknown as { email: string },
    });
    expect(result).toBeNull();
  });
});

describe("makeFormOptions", () => {
  it("wires validators.onSubmit when validator: 'onSubmit'", () => {
    const opts = makeFormOptions({
      schema: EmailField,
      defaultValues: { email: "" },
      validator: "onSubmit",
    });
    expect(opts?.validators?.onSubmit).toBeDefined();
    expect(opts?.validators?.onChange).toBeUndefined();
    expect(opts?.validators?.onBlur).toBeUndefined();
  });

  it("wires validators.onChange when validator: 'onChange'", () => {
    const opts = makeFormOptions({
      schema: EmailField,
      defaultValues: { email: "" },
      validator: "onChange",
    });
    expect(opts?.validators?.onChange).toBeDefined();
    expect(opts?.validators?.onSubmit).toBeUndefined();
  });

  it("wires validators.onBlur when validator: 'onBlur'", () => {
    const opts = makeFormOptions({
      schema: EmailField,
      defaultValues: { email: "" },
      validator: "onBlur",
    });
    expect(opts?.validators?.onBlur).toBeDefined();
    expect(opts?.validators?.onSubmit).toBeUndefined();
  });

  it("returns defaultValues unchanged", () => {
    const defaults = { email: "preset@example.com" };
    const opts = makeFormOptions({
      schema: EmailField,
      defaultValues: defaults,
      validator: "onSubmit",
    });
    expect(opts?.defaultValues).toEqual(defaults);
  });
});
