import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { config as dotenv } from "dotenv";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import { requiresTls } from "../connection-url.ts";
import { runMigrations } from "../migrator.ts";

dotenv({
  path: "../../.env",
});

const reportApplied = (variable: string, applied: ReadonlyArray<readonly [number, string]>) => {
  if (applied.length === 0) return Effect.log(`No pending migrations (${variable})`);

  return Effect.log(
    `Applied ${applied.length} migration(s): ${applied.map(([, name]) => name).join(", ")}`,
  );
};

// `--test` targets DATABASE_URL_TEST, so the dev container can migrate both
// databases from the same dotenv file without exporting anything to the shell.
const targetVariable = (test: boolean) => {
  if (test) return "DATABASE_URL_TEST";

  return "DATABASE_URL";
};

const migrate = Command.make("migrate", { test: Flag.Boolean("test") }, ({ test }) =>
  Effect.gen(function* () {
    const variable = targetVariable(test);
    const url = yield* Config.Redacted(variable);
    const applied = yield* runMigrations({ url, ssl: requiresTls(url) });
    yield* reportApplied(variable, applied);
  }),
);

Command.run(migrate, { version: "0.0.0" }).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
