import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { neonDatabase } from "../neon";

// A Lambda reaches Neon directly: the pooled URL through Neon's PgBouncer for the
// functions, the direct one for migrations and seeding.
const databaseUrls = Effect.fn("databaseUrls")(function* (neonProject: string) {
  const neon = yield* neonDatabase(neonProject);

  return {
    pooled: neon.pooledConnectionUri,
    direct: neon.connectionUri.pipe(Output.map(Redacted.make)),
  };
});

export const appDatabaseUrls = databaseUrls("app-db");

export const identityDatabaseUrls = databaseUrls("identity-db");
