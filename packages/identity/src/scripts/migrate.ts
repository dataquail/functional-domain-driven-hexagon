import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { config as dotenv } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import pg from "pg";

import { migrateIdentityDatabase } from "../auth/identity-migrations.js";

dotenv({ path: "../../.env" });

const VARIABLE = "IDENTITY_DATABASE_URL";

const identityDatabase = Effect.acquireRelease(
  Config.Redacted(VARIABLE).pipe(
    Effect.map((url) => new pg.Pool({ connectionString: Redacted.value(url), max: 1 })),
  ),
  (pool) => Effect.promise(() => pool.end()),
);

const migrate = Effect.gen(function* () {
  const applied = yield* migrateIdentityDatabase(yield* identityDatabase);
  yield* applied.length === 0
    ? Effect.log(`No pending identity migrations (${VARIABLE})`)
    : Effect.log(`Applied identity migrations: ${applied.join(", ")}`);
}).pipe(Effect.scoped);

NodeRuntime.runMain(migrate);
