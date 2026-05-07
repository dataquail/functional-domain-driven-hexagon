import * as Either from "effect/Either";
import { pipe } from "effect/Function";
import { TreeFormatter } from "effect/ParseResult";
import * as Schema from "effect/Schema";

const EnvVars = Schema.Struct({
  API_URL: Schema.URL,
  ENV: Schema.Literal("dev", "staging", "prod").annotations({
    decodingFallback: () => Either.right("prod" as const),
  }),
  OTLP_URL: Schema.URL.annotations({
    decodingFallback: () => Either.right(new URL("http://localhost:4318/v1/traces")),
  }),
});

type EnvVarsShape = typeof EnvVars.Type;

const compute = (() => {
  let cached: EnvVarsShape | undefined;
  return (): EnvVarsShape => {
    if (cached !== undefined) return cached;
    cached = pipe(
      {
        API_URL: import.meta.env.VITE_API_URL,
        ENV: import.meta.env.VITE_ENV,
        OTLP_URL: import.meta.env.VITE_OTLP_URL,
      } satisfies Record<keyof typeof EnvVars.Encoded, unknown>,
      Schema.decodeUnknownEither(EnvVars),
      Either.getOrElse((parseIssue) => {
        throw new Error(
          `❌ Invalid environment variables: ${TreeFormatter.formatErrorSync(parseIssue)}`,
        );
      }),
    );
    return cached;
  };
})();

export const envVars: EnvVarsShape = {
  get API_URL() {
    return compute().API_URL;
  },
  get ENV() {
    return compute().ENV;
  },
  get OTLP_URL() {
    return compute().OTLP_URL;
  },
};
