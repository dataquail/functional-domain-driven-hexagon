import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { config as dotenv } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import { MIGRATIONS_DIRECTORY, runMigrations } from "../migrations.js";

dotenv({
  path: "../../.env",
});

const migrate = Effect.gen(function* () {
  const url = yield* Config.redacted("DATABASE_URL");
  const applied = yield* runMigrations({ url, ssl: false }, MIGRATIONS_DIRECTORY);
  yield* applied.length === 0
    ? Effect.log("No pending migrations")
    : Effect.log(`Applied ${applied.length} migration(s): ${applied.map(([, n]) => n).join(", ")}`);
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(migrate);
