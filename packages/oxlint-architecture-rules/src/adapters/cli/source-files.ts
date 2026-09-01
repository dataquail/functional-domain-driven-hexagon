import { readdirSync, statSync } from "node:fs";
import * as path from "node:path";

// Folders no policy is written about and no linter visits.
const SKIPPED = new Set([
  "node_modules",
  "build",
  "dist",
  ".next",
  ".git",
  "storybook-static",
  "coverage",
]);

const SOURCE = /\.(ts|tsx|mts|cts)$/;

// A declaration file states types, not code; no linter visits one and no policy
// is written about one.
const DECLARATION = /\.d\.[cm]?ts$/;

export const listSourceFiles = (
  repoRoot: string,
  roots: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const found: Array<string> = [];
  const walk = (absolute: string): void => {
    for (const entry of readdirSync(absolute)) {
      if (SKIPPED.has(entry)) continue;
      const child = path.join(absolute, entry);
      if (statSync(child).isDirectory()) walk(child);
      else if (SOURCE.test(entry) && !DECLARATION.test(entry)) {
        found.push(path.relative(repoRoot, child).replaceAll(path.sep, "/"));
      }
    }
  };
  for (const root of roots) {
    const absolute = path.resolve(repoRoot, root);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else found.push(path.relative(repoRoot, absolute).replaceAll(path.sep, "/"));
  }
  return found.sort();
};
