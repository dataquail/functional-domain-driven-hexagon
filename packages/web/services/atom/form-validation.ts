// Schema-backed field validation, independent of any form library.
//
// A schema failure formats to a flat `{ path, message }[]`, which reduces
// cleanly to the dotted-path error map a form renders. Input schemas here are
// synchronous, so the validator is too -- which is what lets a ViewModel
// expose errors as a plain derived atom. A valid form has an empty map.

import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

// Keyed by the dotted field path the schema reported.
export type FieldErrors = { readonly [path: string]: string };

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();

const toFieldErrors = (issue: SchemaIssue.Issue): FieldErrors =>
  Object.fromEntries(
    formatIssue(issue).issues.map(({ message, path = [] }) => [
      path.map((segment) => String(segment)).join("."),
      message,
    ]),
  );

export const validateWithSchema = <A, I>(
  schema: Schema.Codec<A, I>,
): ((input: I) => FieldErrors) => {
  const decode = Schema.decodeUnknownResult(schema, {
    errors: "all",
    onExcessProperty: "ignore",
  });

  return (input) =>
    Result.match(decode(input), {
      onSuccess: () => ({}),
      onFailure: (error) => toFieldErrors(error.issue),
    });
};

export const hasFieldErrors = (errors: FieldErrors): boolean => Object.keys(errors).length > 0;

export const visibleOnceAttempted = (
  submitAttempted: boolean,
  errors: FieldErrors,
): FieldErrors => {
  if (submitAttempted) return errors;

  return {};
};
