#!/usr/bin/env node
import * as Command from "effect/unstable/cli/Command";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
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

// `Command.run` reads argv from the `Stdio` service (provided by
// `NodeServices.layer`) and returns the program Effect directly.
Command.run(root, {
  version: "0.0.0",
}).pipe(
  // Commands funnel fatal failures to `CliError`; print one clean line and
  // exit non-zero. The CLI's own help / validation handling is untouched.
  Effect.catchTag("CliError", (error: CliError) =>
    Console.error(error.message).pipe(Effect.andThen(Effect.sync(() => (process.exitCode = 1)))),
  ),
  Effect.provide(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer)),
  NodeRuntime.runMain,
);
