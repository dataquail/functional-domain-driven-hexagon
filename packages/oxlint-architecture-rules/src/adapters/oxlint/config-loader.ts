import { readFileSync } from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import * as Result from "effect/Result";

import {
  type BaselineFilter,
  decodeBaseline,
  EMPTY_BASELINE,
  makeBaselineFilter,
} from "../../core/baseline.js";
import {
  type CompiledExportRule,
  compileExportRules,
  exportRulesFailingTheirProbe,
} from "../../core/exports.js";
import {
  type CompiledImportRule,
  compileImportRules,
  rulesFailingTheirProbe,
} from "../../core/imports.js";
import {
  type CompiledMemberRule,
  compileMemberRules,
  memberRulesFailingTheirProbe,
} from "../../core/members.js";
import {
  type CompiledStructure,
  compileStructure,
  structureRulesFailingTheirProbe,
} from "../../core/structure.js";
import { ConfigInvalid } from "../../domain/architecture-error.js";
import { makeFileSystemLive } from "../../infrastructure/file-system-live.js";
import { makeModuleResolverLive } from "../../infrastructure/module-resolver-live.js";
import { lowerManifest } from "../../manifest/compile.js";
import { decodeManifest, type Manifest } from "../../manifest/manifest.js";
import type { FileSystem } from "../../ports/file-system.js";
import type { ModuleResolver } from "../../ports/module-resolver.js";

export type LoadedPolicy = {
  readonly repoRoot: string;
  readonly config: Manifest;
  readonly importRules: ReadonlyArray<CompiledImportRule>;
  readonly exportRules: ReadonlyArray<CompiledExportRule>;
  readonly memberRules: ReadonlyArray<CompiledMemberRule>;
  readonly structure: CompiledStructure;
  readonly fileSystem: FileSystem;
  // Violations this repository is carrying while it adopts the policy. Applied
  // at report time so a baselined finding costs nothing but a line in a file.
  readonly baseline: BaselineFilter;
  readonly resolver: ModuleResolver;
  readonly ignoreUnresolved: ReadonlyArray<RegExp>;
};

const readBaselineAt = (repoRoot: string, at: string) => {
  try {
    return decodeBaseline(JSON.parse(readFileSync(path.resolve(repoRoot, at), "utf8")) as unknown);
  } catch {
    // An absent or unreadable baseline carries nothing, which is the safe
    // direction: every violation reports.
    return EMPTY_BASELINE;
  }
};

export const DEFAULT_CONFIG_FILENAME = "architecture.config.mjs";

// Anything wrong with the policy — a missing file, a bad shape, an uncompilable
// pattern — must stop the lint run. A plugin that loads with an empty policy
// reports nothing and looks exactly like a clean codebase.
export const loadPolicy = async (
  repoRoot: string,
  configFilename: string = DEFAULT_CONFIG_FILENAME,
): Promise<LoadedPolicy> => {
  const configPath = path.resolve(repoRoot, configFilename);

  const module: unknown = await import(pathToFileURL(configPath).href).catch((cause: unknown) => {
    throw new ConfigInvalid({ configPath, detail: String(cause) });
  });

  const exported =
    typeof module === "object" && module !== null && "default" in module ? module.default : module;

  const decoded = decodeManifest(configPath, exported);
  if (Result.isFailure(decoded)) throw decoded.failure;
  const config = decoded.success;

  // The manifest is the authoring surface; these flat rules are the machine's.
  const rules = lowerManifest(config);

  const importRules = compileImportRules(rules.imports);
  if (Result.isFailure(importRules)) throw importRules.failure;

  const exportRules = compileExportRules(rules.exports);
  if (Result.isFailure(exportRules)) throw exportRules.failure;

  const memberRules = compileMemberRules(rules.members);
  if (Result.isFailure(memberRules)) throw memberRules.failure;

  const structure = compileStructure(rules.structure);
  if (Result.isFailure(structure)) throw structure.failure;

  const vacuous = [
    ...rulesFailingTheirProbe(importRules.success),
    ...exportRulesFailingTheirProbe(exportRules.success),
    ...memberRulesFailingTheirProbe(memberRules.success),
  ]
    .map((rule) => rule.name)
    .concat(structureRulesFailingTheirProbe(structure.success));
  if (vacuous.length > 0) {
    throw new ConfigInvalid({
      configPath,
      detail:
        `these import rules do not report their own probe, so they enforce nothing: ` +
        `${vacuous.join(", ")}. Fix the rule or its probe — ` +
        `a rule that cannot flag a violation it was written for is worse than no rule.`,
    });
  }

  return {
    repoRoot,
    config,
    importRules: importRules.success,
    exportRules: exportRules.success,
    memberRules: memberRules.success,
    structure: structure.success,
    fileSystem: makeFileSystemLive(repoRoot),
    baseline: makeBaselineFilter(
      config.baseline === undefined ? EMPTY_BASELINE : readBaselineAt(repoRoot, config.baseline),
    ),
    resolver: makeModuleResolverLive(repoRoot, config.resolve),
    ignoreUnresolved: (config.resolve.ignoreUnresolved ?? []).map(
      (pattern: string) => new RegExp(pattern),
    ),
  };
};
