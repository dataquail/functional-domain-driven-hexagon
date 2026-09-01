import * as Result from "effect/Result";

import type {
  StructureConfig,
  StructureFolder,
  StructureNaming,
  StructureParity,
  StructureRoot,
} from "../domain/architecture-config.js";
import type { PatternInvalid } from "../domain/architecture-error.js";
import type { Violation } from "../domain/violation.js";
import type { FileSystem } from "../ports/file-system.js";
import { compilePatterns } from "./patterns.js";

export type CompiledStructureRoot = {
  readonly name: string;
  readonly message: string;
  readonly path: ReadonlyArray<RegExp>;
  readonly probe: string;
};

export type CompiledStructureFolder = {
  readonly name: string;
  readonly message: string;
  readonly folder: ReadonlyArray<RegExp>;
  readonly files: ReadonlyArray<RegExp>;
  readonly probe: string;
};

export type CompiledStructureParity = {
  readonly name: string;
  readonly message: string;
  readonly file: ReadonlyArray<RegExp>;
  readonly fileNot: ReadonlyArray<RegExp>;
  readonly requires: ReadonlyArray<string>;
  readonly probe: string;
};

export type CompiledStructureNaming = {
  readonly name: string;
  readonly message: string;
  readonly file: ReadonlyArray<RegExp>;
  readonly fileNot: ReadonlyArray<RegExp>;
  readonly subject: number;
  readonly convention: RegExp | null;
  readonly sameAs: number | null;
  readonly probe: string;
};

export type CompiledStructure = {
  readonly roots: ReadonlyArray<CompiledStructureRoot>;
  readonly folders: ReadonlyArray<CompiledStructureFolder>;
  readonly parity: ReadonlyArray<CompiledStructureParity>;
  readonly naming: ReadonlyArray<CompiledStructureNaming>;
};

export const EMPTY_STRUCTURE: CompiledStructure = {
  roots: [],
  folders: [],
  parity: [],
  naming: [],
};

const compileRoot = (rule: StructureRoot): Result.Result<CompiledStructureRoot, PatternInvalid> => {
  const path = compilePatterns(rule.name, "path", rule.path);
  if (Result.isFailure(path)) return Result.fail(path.failure);
  return Result.succeed({
    name: rule.name,
    message: rule.message,
    path: path.success,
    probe: rule.probe.path,
  });
};

const compileFolder = (
  rule: StructureFolder,
): Result.Result<CompiledStructureFolder, PatternInvalid> => {
  const folder = compilePatterns(rule.name, "folder", rule.folder);
  if (Result.isFailure(folder)) return Result.fail(folder.failure);
  const files = compilePatterns(rule.name, "files", rule.files);
  if (Result.isFailure(files)) return Result.fail(files.failure);
  return Result.succeed({
    name: rule.name,
    message: rule.message,
    folder: folder.success,
    files: files.success,
    probe: rule.probe.path,
  });
};

const compileParity = (
  rule: StructureParity,
): Result.Result<CompiledStructureParity, PatternInvalid> => {
  const file = compilePatterns(rule.name, "file", rule.file);
  if (Result.isFailure(file)) return Result.fail(file.failure);
  const fileNot = compilePatterns(rule.name, "fileNot", rule.fileNot);
  if (Result.isFailure(fileNot)) return Result.fail(fileNot.failure);
  return Result.succeed({
    name: rule.name,
    message: rule.message,
    file: file.success,
    fileNot: fileNot.success,
    requires: [...rule.requires],
    probe: rule.probe.path,
  });
};

const compileNaming = (
  rule: StructureNaming,
): Result.Result<CompiledStructureNaming, PatternInvalid> => {
  const file = compilePatterns(rule.name, "file", rule.file);
  if (Result.isFailure(file)) return Result.fail(file.failure);
  const fileNot = compilePatterns(rule.name, "fileNot", rule.fileNot);
  if (Result.isFailure(fileNot)) return Result.fail(fileNot.failure);
  const convention = compilePatterns(rule.name, "convention", rule.convention);
  if (Result.isFailure(convention)) return Result.fail(convention.failure);
  return Result.succeed({
    name: rule.name,
    message: rule.message,
    file: file.success,
    fileNot: fileNot.success,
    subject: rule.subject,
    convention: convention.success[0] ?? null,
    sameAs: rule.sameAs ?? null,
    probe: rule.probe.path,
  });
};

const compileAll = <A, B>(
  items: ReadonlyArray<A>,
  compile: (item: A) => Result.Result<B, PatternInvalid>,
): Result.Result<ReadonlyArray<B>, PatternInvalid> => {
  const compiled: Array<B> = [];
  for (const item of items) {
    const one = compile(item);
    if (Result.isFailure(one)) return Result.fail(one.failure);
    compiled.push(one.success);
  }
  return Result.succeed(compiled);
};

export const compileStructure = (
  config: StructureConfig | undefined,
): Result.Result<CompiledStructure, PatternInvalid> => {
  if (config === undefined) return Result.succeed(EMPTY_STRUCTURE);

  const roots = compileAll(config.roots ?? [], compileRoot);
  if (Result.isFailure(roots)) return Result.fail(roots.failure);
  const folders = compileAll(config.folders ?? [], compileFolder);
  if (Result.isFailure(folders)) return Result.fail(folders.failure);
  const parity = compileAll(config.parity ?? [], compileParity);
  if (Result.isFailure(parity)) return Result.fail(parity.failure);
  const naming = compileAll(config.naming ?? [], compileNaming);
  if (Result.isFailure(naming)) return Result.fail(naming.failure);

  return Result.succeed({
    roots: roots.success,
    folders: folders.success,
    parity: parity.success,
    naming: naming.success,
  });
};

const anyMatches = (patterns: ReadonlyArray<RegExp>, value: string): boolean =>
  patterns.some((pattern) => pattern.test(value));

const dirnameOf = (file: string): string => {
  const cut = file.lastIndexOf("/");
  return cut === -1 ? "" : file.slice(0, cut);
};

const basenameOf = (file: string): string => file.slice(file.lastIndexOf("/") + 1);

// `{base}` is the filename minus its FINAL extension, so `create-todo.handler.ts`
// yields `create-todo.handler` and `{base}.test.ts` names its sibling test. The
// dot-delimited stereotype stays part of the base on purpose.
const baseOf = (basename: string): string => {
  const cut = basename.lastIndexOf(".");
  return cut <= 0 ? basename : basename.slice(0, cut);
};

// A `../` in a required path is resolved against the file's own folder, which is
// how a port three folders from its adapters names them.
const resolveSibling = (folder: string, relative: string): string => {
  const segments = folder === "" ? [] : folder.split("/");
  for (const segment of relative.split("/")) {
    if (segment === "..") segments.pop();
    else if (segment !== "." && segment !== "") segments.push(segment);
  }
  return segments.join("/");
};

export const requiredSiblingsOf = (
  rule: CompiledStructureParity,
  file: string,
): ReadonlyArray<string> => {
  const base = baseOf(basenameOf(file));
  const folder = dirnameOf(file);
  return rule.requires.map((template) =>
    resolveSibling(folder, template.replaceAll("{base}", base)),
  );
};

type NamingMatch = {
  readonly subject: string;
  readonly expected: string | null;
  // Whether the rule asked for a comparison at all. Without this a `sameAs`
  // naming a group the pattern never fills would fall back to "no convention"
  // and admit every name — vacuous, in the one family added to stop that.
  readonly comparing: boolean;
};

// The rule's pattern carries capture groups; `subject` says which one holds the
// name being judged, and `sameAs` which one it has to equal.
const firstNamingMatch = (rule: CompiledStructureNaming, file: string): NamingMatch | null => {
  for (const pattern of rule.file) {
    const found = pattern.exec(file);
    if (found === null) continue;
    const subject = found[rule.subject];
    if (subject === undefined) continue;
    return {
      subject,
      expected: rule.sameAs === null ? null : (found[rule.sameAs] ?? null),
      comparing: rule.sameAs !== null,
    };
  }
  return null;
};

const namingSatisfied = (rule: CompiledStructureNaming, named: NamingMatch): boolean =>
  named.comparing
    ? named.expected !== null && named.subject === named.expected
    : rule.convention === null || rule.convention.test(named.subject);

export const evaluateStructure = (
  structure: CompiledStructure,
  fileSystem: FileSystem,
  file: string,
): ReadonlyArray<Violation> => {
  const violations: Array<Violation> = [];
  const folder = dirnameOf(file);
  const basename = basenameOf(file);

  for (const rule of structure.parity) {
    if (!anyMatches(rule.file, file) || anyMatches(rule.fileNot, file)) continue;
    for (const sibling of requiredSiblingsOf(rule, file)) {
      if (fileSystem.exists(sibling)) continue;
      violations.push({
        kind: "structure",
        ruleName: rule.name,
        message: rule.message,
        file,
        subject: sibling,
      });
    }
  }

  for (const rule of structure.naming) {
    if (anyMatches(rule.fileNot, file)) continue;
    const named = firstNamingMatch(rule, file);
    if (named === null || namingSatisfied(rule, named)) continue;
    violations.push({
      kind: "structure",
      ruleName: rule.name,
      message: rule.message,
      file,
      subject: named.subject,
    });
  }

  const governing = structure.folders.filter((rule) => anyMatches(rule.folder, folder));

  if (governing.length > 0) {
    if (!governing.some((rule) => anyMatches(rule.files, basename))) {
      const rule = governing[0];
      if (rule !== undefined) {
        violations.push({
          kind: "structure",
          ruleName: rule.name,
          message: rule.message,
          file,
          subject: basename,
        });
      }
    }
    return violations;
  }

  // No folder rule governs this folder at all. Inside a taxonomy root that means
  // the folder itself is not part of the taxonomy — the stray-folder case a
  // per-file check would otherwise miss entirely.
  const root = structure.roots.find((candidate) => anyMatches(candidate.path, file));
  if (root !== undefined) {
    violations.push({
      kind: "structure",
      ruleName: root.name,
      message: root.message,
      file,
      subject: folder,
    });
  }

  return violations;
};

// A structure rule proves itself the same way the other families do: on a path
// it must reject. Parity is checked structurally — that the rule still selects
// its probe and still renders a sibling to demand — because asking the real
// filesystem at config-load time would make the guard depend on a fixture.
export const structureRulesFailingTheirProbe = (
  structure: CompiledStructure,
): ReadonlyArray<string> => {
  const failing: Array<string> = [];

  for (const rule of structure.naming) {
    const named = firstNamingMatch(rule, rule.probe);
    if (named === null || namingSatisfied(rule, named) || anyMatches(rule.fileNot, rule.probe)) {
      failing.push(rule.name);
    }
  }

  for (const rule of structure.parity) {
    const selects = anyMatches(rule.file, rule.probe) && !anyMatches(rule.fileNot, rule.probe);
    const demands = requiredSiblingsOf(rule, rule.probe).some((sibling) => sibling.length > 0);
    if (!selects || !demands) failing.push(rule.name);
  }

  const layoutOnly = { ...structure, parity: [] };
  const reported = (file: string): ReadonlyArray<string> =>
    evaluateStructure(layoutOnly, { exists: () => true }, file).map(
      (violation) => violation.ruleName,
    );

  for (const rule of structure.folders) {
    // A folder that admits any name claims its folder but states no policy, so
    // there is nothing for a probe to demonstrate.
    if (rule.files.some((pattern) => pattern.source === "^.*$")) continue;
    // The rule must govern its probe's folder AND the folder's admitted set —
    // the union of every governing rule — must still reject the basename.
    const governs = anyMatches(rule.folder, dirnameOf(rule.probe));
    if (!governs || reported(rule.probe).length === 0) failing.push(rule.name);
  }
  for (const rule of structure.roots) {
    if (!reported(rule.probe).includes(rule.name)) failing.push(rule.name);
  }

  return failing;
};
