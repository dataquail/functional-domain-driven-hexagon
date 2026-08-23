import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import ts from "typescript";

export const repoRoot = path.resolve(import.meta.dirname, "../../..");

export const relativeToRepo = (fileName) =>
  path.relative(repoRoot, fileName).split(path.sep).join("/");

const programs = new Map();

// Loading the program is ~1s and drawing a diagram from it is ~1ms, so every
// reader shares one per tsconfig. `clearPrograms` is what a file watcher calls.
export const loadProgram = (tsconfig) => {
  const held = programs.get(tsconfig);
  if (held !== undefined) return held;
  const built = buildProgram(tsconfig);
  programs.set(tsconfig, built);
  return built;
};

export const clearPrograms = () => programs.clear();

const buildProgram = (tsconfig) => {
  const configPath = path.resolve(repoRoot, tsconfig);
  if (!fs.existsSync(configPath)) throw new Error(`no tsconfig at ${configPath}`);

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  if (parsed.errors.length > 0) {
    throw new Error(ts.flattenDiagnosticMessageText(parsed.errors[0].messageText, "\n"));
  }

  process.stderr.write(
    `  analysing ${parsed.fileNames.length} files from ${relativeToRepo(configPath)}\n`,
  );

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  });

  const cache = ts.createModuleResolutionCache(
    path.dirname(configPath),
    (name) => name,
    parsed.options,
  );

  const resolve = (specifier, containingFile) =>
    ts.resolveModuleName(specifier, containingFile, parsed.options, ts.sys, cache).resolvedModule
      ?.resolvedFileName;

  return { program, checker: program.getTypeChecker(), options: parsed.options, resolve };
};

export const parseFile = (fileName) =>
  ts.createSourceFile(
    fileName,
    fs.readFileSync(fileName, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

const importedNames = (node) => {
  if (ts.isExportDeclaration(node)) {
    if (node.exportClause !== undefined && ts.isNamedExports(node.exportClause)) {
      return node.exportClause.elements.map((element) => element.name.text);
    }
    return ["*"];
  }
  const clause = node.importClause;
  if (clause === undefined) return [];
  const names = [];
  if (clause.name !== undefined) names.push(clause.name.text);
  if (clause.namedBindings !== undefined) {
    if (ts.isNamespaceImport(clause.namedBindings)) names.push(clause.namedBindings.name.text);
    else for (const element of clause.namedBindings.elements) names.push(element.name.text);
  }
  return names;
};

export const importsOf = (sourceFile, resolve) => {
  const found = [];

  const record = (specifier, node, typeOnly) => {
    found.push({
      specifier,
      typeOnly,
      names: node === undefined ? [] : importedNames(node),
      resolved: resolve === undefined ? undefined : resolve(specifier, sourceFile.fileName),
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
    });
  };

  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const typeOnly = ts.isImportDeclaration(node)
        ? (node.importClause?.isTypeOnly ?? false)
        : node.isTypeOnly;
      record(node.moduleSpecifier.text, node, typeOnly);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      record(node.arguments[0].text, node, false);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return found;
};

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const SKIP_DIRECTORIES = new Set([
  "node_modules",
  "build",
  "dist",
  ".next",
  ".turbo",
  "storybook-static",
  "coverage",
  "test-results",
]);

export const walkSources = (root) => {
  const found = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") && entry.name !== ".storybook") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) visit(full);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith(".d.ts")) {
        found.push(full);
      }
    }
  };
  if (fs.existsSync(root)) visit(root);
  return found.sort();
};

export { ts };
