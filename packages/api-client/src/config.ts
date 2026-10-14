import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

// The CLI/MCP point at a deployed server via `APP_API_URL`; the default targets the local BFF.
export const resolveBaseUrl: Effect.Effect<string> = Config.String("APP_API_URL").pipe(
  Config.withDefault("http://localhost:3001"),
  Effect.orDie,
);

// CI/headless override: a pre-minted PAT in the environment wins over any
// stored credential, so pipelines need no `auth login` and no on-disk state.
export const tokenFromEnv: Effect.Effect<Option.Option<string>> = Config.String(
  "APP_API_TOKEN",
).pipe(Config.option, Config.map(Option.filter((token) => token.length > 0)), Effect.orDie);
