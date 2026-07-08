import * as Command from "effect/unstable/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

import { authedClient, toCliError } from "../internal.js";

const list = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const client = yield* authedClient;
    const orgs = yield* client.cliOrganization.listMine();
    if (orgs.length === 0) {
      yield* Console.log("(no organizations)");
      return;
    }
    for (const org of orgs) {
      yield* Console.log(`${org.id}  ${org.name}${org.isAdmin ? "  (admin)" : ""}`);
    }
  }).pipe(Effect.catch((error) => Effect.fail(toCliError(error)))),
);

export const orgsCommand = Command.make("orgs", {}, () => Console.log("Usage: org orgs list")).pipe(
  Command.withSubcommands([list]),
);
