import * as Array from "effect/Array";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Equal from "effect/Equal";
import { identity } from "effect/Function";
import * as Hash from "effect/Hash";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as ParseResult from "effect/ParseResult";
import { ArrayFormatter, type ParseIssue } from "effect/ParseResult";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import * as Struct from "effect/Struct";

/**
 * A schema for validating email addresses.
 *
 * @category schema
 */
export const Email = (opts?: { requiredMessage?: string; invalidMessage?: string }) =>
  Schema.Trim.pipe(
    Schema.minLength(1, {
      message: () => opts?.requiredMessage ?? "Email is required",
    }),
    Schema.pattern(
      /^(?!\.)(?!.*\.\.)([A-Z0-9_+-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i,
      {
        message: () => opts?.invalidMessage ?? "Invalid email",
      },
    ),
    Schema.annotations({
      identifier: "Email",
    }),
  );

/**
 * A schema for validating URL strings.
 *
 * @category schema
 */
export const URLString = Schema.URL.pipe(
  Schema.transform(Schema.String, {
    decode: (input) => input.toString(),
    encode: (input) => new URL(input),
    strict: true,
  }),
);

/**
 * A schema for destructive transformations when you need to infer the type from the result of the transformation callback, without specifying the encoded type.
 *
 * @category schema
 */
export function destructiveTransform<A, B>(transform: (input: A) => B) {
  return <I, R>(self: Schema.Schema<A, I, R>): Schema.Schema<Readonly<B>, I, R> => {
    return Schema.transformOrFail(self, Schema.Any as Schema.Schema<Readonly<B>>, {
      decode: (input) =>
        ParseResult.try({
          try: () => transform(input) as Readonly<B>,
          catch: () => new ParseResult.Type(self.ast, input, "Error applying transformation"),
        }),
      encode: () =>
        ParseResult.fail(
          new ParseResult.Forbidden(
            self.ast,
            "Encoding is not supported for destructive transformations",
          ),
        ),
    });
  };
}

/**
 * Formats parse issues into a readable string, including the path for each issue.
 *
 * @category formatting
 * @param issue The ParseIssue to be formatted
 * @param opts Optional configuration:
 *   - newLines: number of newlines between messages
 *   - numbered: whether to prefix messages with numbers (1., 2., etc)
 * @returns An Effect that resolves to a formatted string of parse issues
 */
export const formatParseIssueMessages = (
  issue: ParseIssue,
  opts?: {
    newLines?: number;
    numbered?: boolean;
  },
) =>
  ArrayFormatter.formatIssue(issue).pipe(
    Effect.map((issues) =>
      issues
        .map(
          ({ message, path }, index) =>
            `${opts?.numbered === true ? `${index + 1}. ` : ""}[${path.length > 0 ? path.join(".") : "ROOT"}] ${message}`,
        )
        .join("\n".repeat(opts?.newLines ?? 1)),
    ),
  );

/**
 * Creates a schema that allows null values and falls back to null on decoding errors.
 *
 * @category schema
 */
export const NullOrFromFallible = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.NullOr(schema).pipe(
    Schema.annotations({
      decodingFallback: () => Either.right(null),
    }),
  );

/**
 * A schema for transforming a partitioned array of invalid values into a non-nullable array.
 *
 * @category schema
 */
export const ArrayFromFallible = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.Array(
    Schema.NullOr(schema).annotations({
      decodingFallback: (issue) =>
        Effect.zipRight(
          Effect.logWarning(
            `[ArrayFromFallible] Expected ${SchemaAST.getIdentifierAnnotation(schema.ast).pipe(
              Option.getOrElse(() => "unknown"),
            )}, got ${issue.actual}`,
          ),
          Effect.succeed(null),
        ),
    }),
  ).pipe(
    Schema.transform(Schema.typeSchema(Schema.Array(schema)), {
      decode: (array) => array.filter(Predicate.isNotNull),
      encode: identity,
      strict: true,
    }),
  );

/**
 * A schema for transforming a partitioned array of invalid values into a non-nullable HashSet.
 *
 * @category schema
 */
export const HashSetFromFallibleArray = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  ArrayFromFallible(schema).pipe(
    Schema.transform(Schema.typeSchema(Schema.HashSet(schema)), {
      decode: (array) => HashSet.fromIterable(array),
      encode: (hashSet) => Array.fromIterable(hashSet),
      strict: true,
    }),
  );

/**
 * A schema for transforming a partitioned array of invalid values into a non-nullable Set.
 *
 * @category schema
 */
export const SetFromFallibleArray = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  ArrayFromFallible(schema).pipe(
    Schema.transform(Schema.typeSchema(Schema.Set(schema)), {
      decode: (array) => new Set(array),
      encode: (set) => Array.fromIterable(set),
      strict: true,
    }),
  );

/**
 * Creates a schema that transforms an array into a HashSet during decoding and back to an array during encoding.
 *
 * @category schema
 * @param schema The schema for the elements in the array/HashSet
 * @returns A schema that transforms between Array<A> and HashSet<A>
 * @example
 * ```ts
 * const numberHashSet = HashSetFromIterable(Schema.Number)
 * // Decoding: number[] -> HashSet<number>
 * // Encoding: HashSet<number> -> number[]
 * ```
 */
export const HashSetFromIterable = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  Schema.transform(Schema.Array(schema), Schema.typeSchema(Schema.HashSet(schema)), {
    strict: true,
    decode: (array) => HashSet.fromIterable(array),
    encode: (hashSet) => Array.fromIterable(hashSet),
  });

export const noHashKey = Symbol("noHashKey");
/**
 * A schema for adding equality and hash functions to a resulting record.
 *
 * @category schema
 */
export const WithEquality =
  <A extends Record<string, unknown>, I, R>({
    equalityFn,
    hashKey,
  }:
    | {
        hashKey: keyof A;
        equalityFn?: (a: A, b: A) => boolean;
      }
    | {
        hashKey: typeof noHashKey;
        equalityFn: (a: A, b: A) => boolean;
      }) =>
  (schema: Schema.Schema<A, I, R>): Schema.Schema<A, I, R> =>
    Schema.transform(schema, Schema.Any, {
      decode: (value: A) => {
        const extensions: Partial<Record<symbol, unknown>> = {
          [Hash.symbol](this: A): number {
            if (hashKey === noHashKey) {
              return 0;
            }
            return Hash.cached(this, Hash.hash(this[hashKey]));
          },
          [Equal.symbol](that: unknown): boolean {
            if (!Schema.is(schema)(that)) {
              return false;
            }

            if (equalityFn !== undefined) {
              return equalityFn(this as unknown as A, that);
            }

            return Hash.hash(this) === Hash.hash(that);
          },
        };

        if (equalityFn !== undefined) {
          extensions[Equal.symbol] = function (that: unknown): boolean {
            return (
              Equal.isEqual(that) &&
              Schema.is(schema)(that) &&
              equalityFn(this as unknown as A, that)
            );
          };
        }

        return Object.assign(value, extensions);
      },
      encode: identity,
      strict: true,
    });

/**
 * Creates a schema that derives and attaches a property to the original schema.
 *
 * @category transformation
 */
export const deriveAndAttachProperty =
  <
    const Key extends string,
    FromA extends Record<string, unknown>,
    FromI,
    FromR,
    ToA,
    ToI,
    ToR,
    DecodeR = never,
  >(args: {
    key: Key;
    typeSchema: Schema.Schema<ToA, ToI, ToR>;
    decode: (input: FromA) => Effect.Effect<ToA, never, DecodeR>;
  }) =>
  (
    self: Schema.Schema<FromA, FromI, FromR>,
  ): Schema.Schema<FromA & { readonly [K in Key]: ToA }, FromI, FromR | ToR | DecodeR> => {
    const derivedSchema = Schema.typeSchema(
      Schema.Struct({
        [args.key]: args.typeSchema,
      } as const),
    );

    const extendedSchema = Schema.extend(Schema.typeSchema(self), derivedSchema);

    return Schema.transformOrFail(self, Schema.typeSchema(extendedSchema), {
      decode: (input) =>
        Effect.gen(function* () {
          const result = args.decode(input);

          if (Effect.isEffect(result)) {
            return yield* result.pipe(
              Effect.map((value) => ({
                ...input,
                [args.key]: value,
              })),
            );
          }

          return {
            ...input,
            [args.key]: result,
          };
        }),
      encode: (struct) => ParseResult.succeed(Struct.omit(args.key)(struct)),
      strict: false,
    });
  };

/**
 * Lifts a `Schema` to a `PropertySignature` and enhances it by specifying a different key for it in the Encoded type.
 *
 * @category schema
 */
export const fromKey: <const K extends string>(
  key: K,
) => <A, I, R>(
  self: Schema.Schema<A, I, R>,
) => Schema.PropertySignature<":", A, K, ":", I, false, R> =
  <const K extends string>(key: K) =>
  <A, I, R>(self: Schema.Schema<A, I, R>) =>
    self.pipe(Schema.propertySignature, Schema.fromKey(key));

/**
 * Reverses a schema, i.e., swaps the encoded and decoded types.
 *
 * @category schema
 */
export const reverseSchema = <A, I, R>(schema: Schema.Schema<A, I, R>): Schema.Schema<I, A, R> =>
  Schema.transformOrFail(Schema.typeSchema(schema), Schema.encodedSchema(schema), {
    decode: ParseResult.encode(schema),
    encode: ParseResult.decode(schema),
  });
