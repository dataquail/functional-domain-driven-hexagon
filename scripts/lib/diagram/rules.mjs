import { builtinModules, createRequire } from "node:module";
import path from "node:path";

import { repoRoot } from "./program.mjs";

const require = createRequire(import.meta.url);
const config = require(path.join(repoRoot, ".dependency-cruiser.cjs"));

const asPatterns = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

// `circular` needs the whole graph, and the cycle report already covers it.
const supported = config.forbidden.filter(
  (rule) => rule.from?.path !== undefined && rule.to?.circular === undefined,
);

const NPM_DEPENDENCY_TYPES = new Set([
  "npm",
  "npm-dev",
  "npm-peer",
  "npm-optional",
  "npm-no-pkg",
  "npm-unknown",
]);

const substitute = (pattern, match) =>
  pattern.replace(/\$(\d)/g, (_, digit) => match[Number(digit)] ?? "");

export const violatedRules = ({ external, from, to }) => {
  const broken = [];
  for (const rule of supported) {
    const match = new RegExp(rule.from.path).exec(from);
    if (match === null) continue;
    if (asPatterns(rule.from.pathNot).some((pattern) => new RegExp(pattern).test(from))) continue;

    const dependencyTypes = rule.to.dependencyTypes;
    if (
      dependencyTypes !== undefined &&
      dependencyTypes.some((type) => NPM_DEPENDENCY_TYPES.has(type)) !== external
    ) {
      continue;
    }

    const targets = asPatterns(rule.to.path);
    if (
      targets.length > 0 &&
      !targets.some((pattern) => new RegExp(substitute(pattern, match)).test(to))
    ) {
      continue;
    }
    if (
      asPatterns(rule.to.pathNot).some((pattern) => new RegExp(substitute(pattern, match)).test(to))
    ) {
      continue;
    }

    broken.push(rule.name);
  }
  return broken;
};

// dependency-cruiser sees pnpm's real paths, so its patterns are anchored on
// `/node_modules/<name>/`; an unresolved specifier has to be shaped the same way.
export const dependencyPath = ({ resolved, specifier }) => {
  if (resolved !== undefined) return resolved;
  if (specifier.startsWith("@org/")) {
    const [, pkg, ...rest] = specifier.split("/");
    const inner = rest.join("/");
    if (pkg === "components") return `packages/components/${inner === "" ? "index" : inner}.tsx`;
    return `packages/${pkg}/src/${inner === "" ? "index" : inner}.ts`;
  }
  return `node_modules/.pnpm/unresolved/node_modules/${specifier}/index.js`;
};

export const isCoreModule = (specifier) =>
  specifier.startsWith("node:") || builtinModules.includes(specifier);

export const isExternalPath = (target) => target.includes("node_modules/");

export const ruleComment = (name) => supported.find((rule) => rule.name === name)?.comment ?? name;
