import { formOptions } from "@tanstack/react-form";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

type BuildTuple<N extends number, Acc extends ReadonlyArray<unknown> = []> = Acc["length"] extends N
  ? Acc
  : BuildTuple<N, [...Acc, unknown]>;

// Computes N - 1 for a number type N.
type Prev<N extends number> = BuildTuple<N> extends [unknown, ...infer Rest] ? Rest["length"] : 0;

// Recursive type to generate dot-notation paths for a type `Data` up to a depth `Depth`.
type PathsLimited<Data, Path extends string = "", Depth extends number = 3> =
  // Base case: Depth limit reached
  Depth extends 0
    ? `${Path}${Path extends "" ? "" : "."}${string}` | Path // Allow the current path or any string suffix.
    : Data extends ReadonlyArray<infer Element>
      ? // For arrays: Generate paths for numeric indices and recurse on the element type.
          | `${Path}${Path extends "" ? "" : "."}${number}`
          | PathsLimited<Element, `${Path}${Path extends "" ? "" : "."}${number}`, Prev<Depth>>
      : Data extends object
        ? // For objects: Generate paths for keys and recurse on property types.
          {
            [Key in keyof Data]-?: Key extends string | number
              ?
                  | `${Path}${Path extends "" ? "" : "."}${Key}`
                  | PathsLimited<
                      Data[Key],
                      `${Path}${Path extends "" ? "" : "."}${Key}`,
                      Prev<Depth>
                    >
              : never;
          }[keyof Data]
        : // Primitive/leaf node: Return the accumulated path.
          Path;

export type Paths<Data> = PathsLimited<Data>;

type RootErrorKey = "";
type SchemaValidatorResult<SchemaInput extends Record<PropertyKey, any>> = Partial<
  Record<Paths<SchemaInput> | RootErrorKey, string>
> | null;

type SchemaValidatorFn<SchemaInput extends Record<PropertyKey, any>> = (submission: {
  value: SchemaInput;
}) => SchemaValidatorResult<SchemaInput>;

export const validateWithSchema = <A, I extends Record<PropertyKey, any>>(
  schema: Schema.Codec<A, I>,
): SchemaValidatorFn<I> => {
  // Standard Schema v1 surfaces validation issues as a flat
  // `{ path, message }[]`, which is exactly the shape this validator
  // reduces into TanStack Form's dotted-path error map. Synchronous
  // input schemas never return a Promise here.
  const standard = Schema.toStandardSchemaV1(schema, {
    parseOptions: { errors: "all", onExcessProperty: "ignore" },
  });

  return (submission: { value: I }): SchemaValidatorResult<I> => {
    const result = standard["~standard"].validate(submission.value);
    if (result instanceof Promise) {
      throw new Error("validateWithSchema expects a synchronous schema");
    }
    if (result.issues === undefined) {
      return null;
    }

    const acc: Record<string, string> = {};
    for (const issue of result.issues) {
      const key = (issue.path ?? [])
        .map((segment) => (typeof segment === "object" ? segment.key : segment))
        .join(".");
      acc[key] = issue.message;
    }

    return (Object.keys(acc).length > 0 ? acc : null);
  };
};

type HandledValidatorKey = "onSubmit" | "onChange" | "onBlur";

export const makeFormOptions = <
  SchemaA,
  SchemaI extends Record<PropertyKey, any>,
  ValidatorKey extends HandledValidatorKey,
>(opts: {
  schema: Schema.Codec<SchemaA, SchemaI>;
  defaultValues: SchemaI;
  validator: ValidatorKey;
}) => {
  const specificValidatorFn = validateWithSchema(opts.schema);

  const validators = Match.value(opts.validator satisfies HandledValidatorKey).pipe(
    Match.when("onSubmit", () => ({ onSubmit: specificValidatorFn })),
    Match.when("onChange", () => ({ onChange: specificValidatorFn })),
    Match.when("onBlur", () => ({ onBlur: specificValidatorFn })),
    Match.exhaustive,
  );

  // `formOptions` is typed as returning `T | undefined` because its arg
  // is optional, but with `defaultValues` set the result is always defined.
  const out = formOptions({
    defaultValues: opts.defaultValues,
    validators,
  });
  return out as NonNullable<typeof out>;
};
