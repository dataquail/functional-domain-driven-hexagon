import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { config as dotenv } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import { runMigrations } from "../migrator.js";

dotenv({
  path: "../../.env",
});

// `--test` targets DATABASE_URL_TEST, so the dev container can migrate both
// databases from the same dotenv file without exporting anything to the shell.
const variable = process.argv.includes("--test") ? "DATABASE_URL_TEST" : "DATABASE_URL";

const migrate = Effect.gen(function* () {
  const url = yield* Config.redacted(variable);
  const applied = yield* runMigrations({ url, ssl: false });
  yield* applied.length === 0
    ? Effect.log(`No pending migrations (${variable})`)
    : Effect.log(`Applied ${applied.length} migration(s): ${applied.map(([, n]) => n).join(", ")}`);
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(migrate);
