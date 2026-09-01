#!/usr/bin/env node
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { run } from "./run.js";

const exit = await Effect.runPromiseExit(run(process.cwd(), process.argv.slice(2)));

if (Exit.isFailure(exit)) {
  // The expected failures carry their own sentence; anything else is a defect
  // and deserves the full cause.
  const squashed = Cause.squash(exit.cause);
  const message =
    typeof squashed === "object" && squashed !== null && "message" in squashed
      ? String(squashed.message)
      : Cause.pretty(exit.cause);
  process.stderr.write(`\n${message}\n`);
  process.exitCode = 1;
}
