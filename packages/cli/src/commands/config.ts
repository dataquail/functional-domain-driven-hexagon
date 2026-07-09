import { saveDefaultOrg } from "@org/api-client";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";

const orgIdArg = Argument.string("orgId");

const setOrg = Command.make("set-org", { orgId: orgIdArg }, ({ orgId }) =>
  Effect.gen(function* () {
    yield* saveDefaultOrg(orgId);
    yield* Console.log(`Default organization set to ${orgId}.`);
  }),
);

export const configCommand = Command.make("config", {}, () =>
  Console.log("Usage: org config set-org <orgId>"),
).pipe(Command.withSubcommands([setOrg]));
