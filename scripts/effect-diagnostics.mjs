// The Effect language-service diagnostics for every leaf tsconfig, run
// through `effect-tsgo diagnostics` (the LSP-based linter) and read as one
// set. Per-rule severities live in the shared tsconfig plugin config
// (tsconfig.base.json), so what is read here is what the editor shows.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Leaf tsconfigs with a non-empty `include` (the aggregator tsconfig.json in
// referenced packages has an empty include and would check nothing).
export const PROJECTS = [
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

export const readEffectDiagnostics = async () => {
  const perProject = await inLanes(PROJECTS, diagnosticsOfProject, CONCURRENCY);
  return PROJECTS.map((project, index) => ({ project, diagnostics: perProject[index] }));
};

// A project's program includes the files of the projects it references, so
// one diagnostic is reported under several projects; this keeps it once.
export const uniqueDiagnostics = (perProject) => {
  const byPosition = new Map();
  for (const { diagnostics } of perProject) {
    for (const diagnostic of diagnostics) {
      const key = `${diagnostic.file}:${diagnostic.line}:${diagnostic.column}:${diagnostic.name}`;
      if (!byPosition.has(key)) byPosition.set(key, diagnostic);
    }
  }
  return [...byPosition.values()].sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
};
