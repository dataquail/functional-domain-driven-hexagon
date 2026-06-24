#!/usr/bin/env node
import * as Command from "@effect/cli/Command";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { authCommand } from "./commands/auth.js";
import { configCommand } from "./commands/config.js";
import { orgsCommand } from "./commands/orgs.js";
import { todosCommand } from "./commands/todos.js";
import type { CliError } from "./internal.js";

const root = Command.make("org", {}, () =>
  Console.log("Run `org --help` to see available commands."),
).pipe(Command.withSubcommands([authCommand, orgsCommand, todosCommand, configCommand]));

const run = Command.run(root, {
  name: "org — effect-monorepo CLI",
  version: "0.0.0",
});

run(process.argv).pipe(
  // Commands funnel fatal failures to `CliError`; print one clean line and
  // exit non-zero. @effect/cli's own help / validation handling is untouched.
  Effect.catchTag("CliError", (error: CliError) =>
    Console.error(error.message).pipe(Effect.zipRight(Effect.sync(() => (process.exitCode = 1)))),
  ),
  Effect.provide(Layer.mergeAll(NodeContext.layer, FetchHttpClient.layer)),
  NodeRuntime.runMain,
);
