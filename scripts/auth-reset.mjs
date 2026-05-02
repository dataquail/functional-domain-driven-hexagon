#!/usr/bin/env node
// Wipes the local Zitadel state so `pnpm bootstrap` can re-bootstrap from
// scratch. Destructive — but only of Zitadel state. The app DB (the
// `effect-monorepo` database living in the same Postgres container) is left
// alone; if you want to wipe that too, run `docker compose down -v`.
//
// Steps:
//   1. stop the zitadel container so it doesn't fight the database drop
//   2. ensure the postgres container is up and healthy (we drop the db inside it)
//   3. drop + recreate the `zitadel` database — this is what triggers a fresh
//      FirstInstance on the next Zitadel boot
//   4. remove the zitadel container so a fresh one is created on `auth:up`
//   5. remove the host bind-mount directory infra/zitadel/.machinekey/
//   6. clear the bootstrap-related fields in .env so the next `pnpm bootstrap`
//      isn't confused by stale values

import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { updateEnv } from "./lib/env-file.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = join(ROOT, ".env");
const MACHINEKEY_DIR = join(ROOT, "infra/zitadel/.machinekey");

const FIELDS_TO_CLEAR = ["ZITADEL_BOOTSTRAP_PAT", "ZITADEL_CLIENT_ID", "ZITADEL_CLIENT_SECRET"];

function main() {
  step("stop zitadel container", () => {
    spawnSync("docker", ["compose", "stop", "zitadel"], {
      cwd: ROOT,
      stdio: "inherit",
    });
  });

  step("ensure postgres is up (we drop the zitadel db inside it)", () => {
    const result = spawnSync("docker", ["compose", "up", "-d", "--wait", "postgres"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (result.status !== 0) throw new Error("postgres did not become healthy");
  });

  step("DROP DATABASE zitadel; CREATE DATABASE zitadel", () => {
    // FORCE terminates any leftover connections from a still-running zitadel
    // image — cheaper than a separate kill step and idempotent.
    runPsql(`DROP DATABASE IF EXISTS zitadel WITH (FORCE)`);
    runPsql(`CREATE DATABASE zitadel`);
  });

  step("remove zitadel container", () => {
    spawnSync("docker", ["compose", "rm", "-f", "zitadel"], {
      cwd: ROOT,
      stdio: "inherit",
    });
  });

  step(`remove ${MACHINEKEY_DIR}`, () => {
    if (existsSync(MACHINEKEY_DIR)) {
      rmSync(MACHINEKEY_DIR, { recursive: true, force: true });
    }
  });

  step("clear bootstrap fields in .env", () => {
    if (!existsSync(ENV_PATH)) return "(.env not present — skipping)";
    const cleared = Object.fromEntries(FIELDS_TO_CLEAR.map((k) => [k, ""]));
    const changed = updateEnv(ENV_PATH, cleared);
    return changed.length === 0 ? "already clear" : `cleared ${changed.join(", ")}`;
  });

  console.log("\nReset complete. Run `pnpm bootstrap` to re-provision Zitadel.");
}

function runPsql(sql) {
  const result = spawnSync(
    "docker",
    ["compose", "exec", "-T", "postgres", "psql", "-U", "postgres", "-d", "postgres", "-c", sql],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`psql failed: ${sql}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
}

function step(label, fn) {
  process.stdout.write(`• ${label}… `);
  const out = fn();
  console.log(typeof out === "string" ? `✓ ${out}` : "✓");
}

main();
