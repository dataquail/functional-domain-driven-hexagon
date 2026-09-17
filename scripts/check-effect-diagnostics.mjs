#!/usr/bin/env node
// CI gate for the Effect language-service diagnostics: any finding at any
// severity fails the build. Per-rule severities live in tsconfig.base.json's
// plugin config, so a rule the repository decides against is turned off there
// rather than tolerated here. The tool's own `--strict` exits non-zero only on
// errors and warnings, so the JSON output is read and counted instead.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Leaf tsconfigs with a non-empty `include` (the aggregator tsconfig.json in
// referenced packages has an empty include and would check nothing).
const PROJECTS = [
  "packages/contracts/tsconfig.src.json",
  "packages/contracts/tsconfig.test.json",
  "packages/database/tsconfig.src.json",
  "packages/database/tsconfig.test.json",
  "packages/api-client/tsconfig.src.json",
  "packages/server/tsconfig.src.json",
  "packages/server/tsconfig.test.json",
  "packages/jobs/tsconfig.src.json",
  "packages/jobs/tsconfig.test.json",
  "packages/cli/tsconfig.src.json",
  "packages/mcp/tsconfig.src.json",
  "packages/web/tsconfig.json",
  "packages/components/tsconfig.json",
].filter((project) => existsSync(join(ROOT, project)));

const CONCURRENCY = 4;

const diagnosticsOfProject = (project) =>
  new Promise((resolve, reject) => {
    execFile(
      "pnpm",
      ["exec", "effect-tsgo", "diagnostics", "--project", project, "--format", "json"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      (_exit, stdout, stderr) => {
        try {
          const parsed = JSON.parse(stdout || "[]");
          const diagnostics = Array.isArray(parsed) ? parsed : (parsed.diagnostics ?? []);
          resolve(
            diagnostics.map((diagnostic) => ({
              ...diagnostic,
              file: relative(ROOT, diagnostic.file ?? "").replaceAll("\\", "/"),
            })),
          );
        } catch {
          reject(
            new Error(
              `${project}: could not parse diagnostics output\n${(stderr ?? "").slice(0, 2000)}`,
            ),
          );
        }
      },
    );
  });

const inLanes = async (items, work, lanes) => {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(lanes, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
};

const perProject = await inLanes(PROJECTS, diagnosticsOfProject, CONCURRENCY).catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(2);
});

let total = 0;
PROJECTS.forEach((project, index) => {
  const diagnostics = perProject[index];
  if (diagnostics.length > 0) {
    total += diagnostics.length;
    console.error(`✗ ${project}: ${diagnostics.length} effect diagnostic(s)`);
    for (const d of diagnostics) {
      console.error(`    ${d.file}:${d.line}:${d.column}  ${d.severity} ${d.name}`);
    }
  } else {
    console.log(`✓ ${project}`);
  }
});

if (total > 0) {
  console.error(
    `\n${total} effect diagnostic(s) found. Fix them, disable the rule for a line with ` +
      `\`// @effect-diagnostics-next-line <rule>:off\`, or adjust the severity in ` +
      `tsconfig.base.json's plugin config if the rule doesn't apply.`,
  );
  process.exit(1);
}
console.log("\nNo effect diagnostics.");
