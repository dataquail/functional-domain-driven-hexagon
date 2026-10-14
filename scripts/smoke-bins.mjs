#!/usr/bin/env node
// Runs the bundled `org` and `org-mcp` binaries the way a user does — plain node
// on the built file — so a bundle that cannot resolve a module fails CI.
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLI = join(ROOT, "packages/cli/build/bin/main.js");
const MCP = join(ROOT, "packages/mcp/build/bin/main.js");

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const cli = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
if (cli.status !== 0 || !cli.stdout.includes("USAGE")) {
  fail(`org --help exited ${cli.status}\n${cli.stderr}`);
}
console.log("✓ org --help");

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "smoke-bins", version: "0" },
  },
};

const mcp = spawn(process.execPath, [MCP], { stdio: ["pipe", "pipe", "pipe"] });
let stdout = "";
let stderr = "";
const timer = setTimeout(() => {
  mcp.kill();
  fail(`org-mcp did not answer initialize within 10s\n${stderr}`);
}, 10_000);

mcp.stderr.on("data", (chunk) => {
  stderr += chunk;
});
mcp.stdout.on("data", (chunk) => {
  stdout += chunk;
  const line = stdout.split("\n").find((candidate) => candidate.includes('"id":1'));
  if (line === undefined) return;
  clearTimeout(timer);
  mcp.kill();
  if (!line.includes('"result"')) fail(`org-mcp answered initialize with an error\n${line}`);
  console.log("✓ org-mcp initialize");
});
mcp.on("exit", (code) => {
  if (!stdout.includes('"id":1')) {
    clearTimeout(timer);
    fail(`org-mcp exited ${code} before answering initialize\n${stderr}`);
  }
});
mcp.stdin.write(`${JSON.stringify(initialize)}\n`);
