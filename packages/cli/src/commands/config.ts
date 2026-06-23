import * as Args from "@effect/cli/Args";
import * as Command from "@effect/cli/Command";
import { saveDefaultOrg } from "@org/api-client";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

const orgIdArg = Args.text({ name: "orgId" });

const setOrg = Command.make("set-org", { orgId: orgIdArg }, ({ orgId }) =>
  Effect.gen(function* () {
    yield* saveDefaultOrg(orgId);
    yield* Console.log(`Default organization set to ${orgId}.`);
  }),
);

export const configCommand = Command.make("config", {}, () =>
  Console.log("Usage: org config set-org <orgId>"),
).pipe(Command.withSubcommands([setOrg]));
