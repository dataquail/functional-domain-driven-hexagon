import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/common/env-vars.js";

// Production binding for the `Database` Tag. Exposed at platform/
// (not inline in server.ts) so module-root handler-registration files
// can compose it into their wrapping chains when discharging persistence
// dependencies upfront (ADR pending — Stage D-α handler encapsulation).
export const DatabaseLive = Layer.unwrapEffect(
  EnvVars.pipe(
    Effect.map((envVars) =>
      Database.layer({
        url: envVars.DATABASE_URL,
        ssl: envVars.ENV === "prod",
      }),
    ),
  ),
).pipe(Layer.provide(EnvVars.Default));
