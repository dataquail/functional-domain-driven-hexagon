#!/usr/bin/env node
// Clones the Effect source into reference/effect at the exact tag this repo pins, so the
// source read as reference is the source compiled against. v4 is a beta with no published
// API docs — the source is the API reference.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// v4 is `main` here (v3 is the `v3` branch). The Effect-TS/effect-smol repo where v4 was
// incubated is archived; its history and tags were merged into this one.
const REMOTE = "https://github.com/Effect-TS/effect.git";
const DEST = join(ROOT, "reference/effect");

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const flagValue = (flag) => {
  const at = args.indexOf(flag);
  if (at === -1) return undefined;
  const value = args[at + 1];
  if (value === undefined || value.startsWith("--")) fail(`${flag} needs a value`);
  return value;
};

const pinnedEffectVersion = () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const spec = pkg.pnpm?.overrides?.effect ?? pkg.devDependencies?.effect;
  if (spec === undefined) fail("no `effect` version found in the root package.json");
  return spec.replace(/^[\^~=]/, "");
};

const gitQuery = (gitArgs, cwd = ROOT) => {
  const res = spawnSync("git", gitArgs, { cwd, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : undefined;
};

const gitRun = (gitArgs, cwd = ROOT) => {
  const res = spawnSync("git", gitArgs, { cwd, stdio: "inherit" });
  return res.status === 0;
};

const ref = flagValue("--ref") ?? `effect@${pinnedEffectVersion()}`;
const relDest = relative(ROOT, DEST);

if (args.includes("--force") && existsSync(DEST)) {
  console.log(`Removing ${relDest}`);
  rmSync(DEST, { recursive: true, force: true });
}

const clone = () => {
  console.log(`Cloning ${REMOTE} @ ${ref} → ${relDest}`);
  if (!gitRun(["clone", "--depth", "1", "--single-branch", "--branch", ref, REMOTE, DEST])) {
    fail(`clone failed. Is \`${ref}\` a real tag or branch in ${REMOTE}?`);
  }
};

const update = () => {
  // Only a tag can short-circuit: it is immutable, so "HEAD is already there" stays true.
  // A branch ref must always be fetched or it silently reports success on a stale checkout.
  const alreadyAt = gitQuery(["rev-parse", "--verify", `refs/tags/${ref}^{commit}`], DEST);
  if (alreadyAt !== undefined && alreadyAt === gitQuery(["rev-parse", "HEAD"], DEST)) {
    console.log(`${relDest} is already at ${ref}`);
    return;
  }
  console.log(`Fetching ${ref} into ${relDest}`);
  const fetchedTag = gitRun(
    ["fetch", "--force", "--depth", "1", "origin", `refs/tags/${ref}:refs/tags/${ref}`],
    DEST,
  );
  const target = fetchedTag ? `refs/tags/${ref}` : "FETCH_HEAD";
  if (!fetchedTag && !gitRun(["fetch", "--force", "--depth", "1", "origin", ref], DEST)) {
    fail(`could not fetch \`${ref}\`. Re-run with --force to re-clone from scratch.`);
  }
  if (!gitRun(["checkout", "--force", "--detach", target], DEST)) {
    fail(`could not check out \`${ref}\`. Re-run with --force to re-clone from scratch.`);
  }
};

if (!existsSync(DEST)) {
  clone();
} else if (existsSync(join(DEST, ".git"))) {
  update();
} else {
  fail(`${relDest} exists but is not a git checkout. Remove it, or re-run with --force.`);
}

const head = gitQuery(["log", "-1", "--format=%h %ad %s", "--date=short"], DEST);
console.log(`\n✓ ${relDest} @ ${ref}\n  ${head}`);
console.log(
  `  Idioms: ${relDest}/LLMS.md and ${relDest}/ai-docs/src\n` +
    `  Core modules: ${relDest}/packages/effect/src\n` +
    `  Usage examples: ${relDest}/packages/effect/test`,
);
