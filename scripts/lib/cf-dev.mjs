// Boots `pnpm dev:cf` (the Workers stack under `alchemy dev`) in its own process
// group, waits for the stack to print a named output, and stops the whole group
// on demand. Shared by check-cf-dev.mjs and dev-bootstrap.mjs.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const POLL_INTERVAL_MS = 1_000;

export function startCfDev(cwd) {
  const dev = spawn("pnpm", ["dev:cf"], { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  dev.stdout.on("data", (chunk) => (output += chunk));
  dev.stderr.on("data", (chunk) => (output += chunk));

  // `alchemy dev` runs a supervisor, a child and workerd; signalling the process
  // group is what stops all three.
  const stop = () => {
    try {
      process.kill(-dev.pid, "SIGINT");
    } catch {
      /* already gone */
    }
  };

  const waitFor = async (timeoutMs, probe) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await probe();
      if (value !== undefined) return value;
      if (dev.exitCode !== null) return undefined;
      await sleep(POLL_INTERVAL_MS);
    }
    return undefined;
  };

  const waitForOutput = (name, timeoutMs) =>
    waitFor(timeoutMs, () => new RegExp(`${name}: '([^']+)'`).exec(output)?.[1]);

  return { stop, waitFor, waitForOutput, output: () => output };
}
