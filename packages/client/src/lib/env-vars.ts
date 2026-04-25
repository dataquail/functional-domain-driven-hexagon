import * as Either from "effect/Either";
import { pipe } from "effect/Function";
import { TreeFormatter } from "effect/ParseResult";
import * as Schema from "effect/Schema";

const EnvVars = Schema.Struct({
  API_URL: Schema.URL,
  ENV: Schema.Literal("dev", "staging", "prod").annotations({
    decodingFallback: () => Either.right("prod" as const),
  }),
});

export const envVars = pipe(
  {
    API_URL: import.meta.env.VITE_API_URL,
    ENV: import.meta.env.VITE_ENV,
  } satisfies Record<keyof typeof EnvVars.Encoded, unknown>,
  Schema.decodeUnknownEither(EnvVars),
  Either.getOrElse((parseIssue) => {
    throw new Error(
      `❌ Invalid environment variables: ${TreeFormatter.formatErrorSync(parseIssue)}`,
    );
  }),
);
