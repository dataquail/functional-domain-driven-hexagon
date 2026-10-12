// Schema-backed field validation, independent of any form library.
//
// Standard Schema v1 surfaces issues as a flat `{ path, message }[]`, which
// reduces cleanly to the dotted-path error map a form renders. Input schemas
// here are synchronous, so the validator is too -- which is what lets a
// ViewModel expose errors as a plain derived atom.

import * as Schema from "effect/Schema";

export type FieldErrors<Fields> = Partial<Record<keyof Fields & string, string>>;

export const validateWithSchema = <A, I extends Record<string, unknown>>(
  schema: Schema.Codec<A, I>,
): ((input: I) => FieldErrors<I> | null) => {
  const standard = Schema.toStandardSchemaV1(schema, {
    parseOptions: { errors: "all", onExcessProperty: "ignore" },
  });

  return (input: I): FieldErrors<I> | null => {
    const result = standard["~standard"].validate(input);
    if (result instanceof Promise) {
      throw new Error("validateWithSchema expects a synchronous schema");
    }
    if (result.issues === undefined) return null;

    const errors: Record<string, string> = {};
    for (const issue of result.issues) {
      const key = (issue.path ?? [])
        .map((segment) => (typeof segment === "object" ? segment.key : segment))
        .join(".");
      errors[key] = issue.message;
    }
    return Object.keys(errors).length > 0 ? (errors as FieldErrors<I>) : null;
  };
};
