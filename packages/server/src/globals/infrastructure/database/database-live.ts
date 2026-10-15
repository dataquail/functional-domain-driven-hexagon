import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { EnvVars } from "@/globals/infrastructure/config/env-vars";

// The Worker reaches Postgres through Hyperdrive, which terminates TLS to the
// origin and pools in transaction mode.
export const DatabaseLive = Layer.unwrap(
  Effect.map(EnvVars, (env) =>
    Database.layer({ url: env.DATABASE_URL, ssl: false, behindTransactionPooler: true }),
  ),
);
