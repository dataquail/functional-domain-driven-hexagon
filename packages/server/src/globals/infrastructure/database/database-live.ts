import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";

// Every deployed host reaches Postgres through a transaction-mode pooler:
// Hyperdrive on Cloudflare, Neon's PgBouncer endpoint on AWS.
export const DatabaseLive = Layer.unwrap(
  Effect.map(EnvVars, (env) =>
    Database.layer({
      url: env.DATABASE_URL,
      ssl: env.DATABASE_SSL,
      behindTransactionPooler: true,
    }),
  ),
);
