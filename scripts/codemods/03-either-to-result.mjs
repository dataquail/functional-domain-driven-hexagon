#!/usr/bin/env node
// Phase 1 codemod (c): effect/Either -> effect/Result.
// v4 removed effect/Either; Result is the replacement (succeed=right, fail=left).
// Handles the domain-local `type Result` collision by renaming it to `Outcome`
// (validated: the domain payload type is used only within its own file).
//
// Per file that imports `effect/Either`:
//   1. rename any local `Result` type/interface (+ its bare-identifier refs) -> `Outcome`
//   2. swap the import to `effect/Result` and rebind the namespace `Either` -> `Result`
//   3. rewrite every `Either.<member>` access per the member map
import { Project, SyntaxKind, Node } from "ts-morph";

const memberMap = new Map(
  Object.entries({
    left: "fail",
    right: "succeed",
    isLeft: "isFailure",
    isRight: "isSuccess",
    Either: "Result", // the type constructor Either.Either<A,E> -> Result.Result<A,E>
    mapLeft: "mapError",
    getOrNull: "getOrNull",
    flip: "flip",
    map: "map",
    flatMap: "flatMap",
    getOrElse: "getOrElse",
    getOrThrow: "getOrThrow",
    match: "match",
  }),
);

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
const globs = process.argv.slice(2).length ? process.argv.slice(2) : ["packages/**/*.{ts,tsx}"];
project.addSourceFilesAtPaths([...globs, "!**/node_modules/**", "!**/dist/**", "!**/*.d.ts"]);

const stats = { files: 0, members: 0, outcomeRenames: 0, unmappedMembers: new Set() };

for (const sf of project.getSourceFiles()) {
  const eitherImport = sf.getImportDeclaration(
    (d) => d.getModuleSpecifierValue() === "effect/Either",
  );
  if (!eitherImport) continue;
  stats.files++;

  // 1. rename local `Result` declaration + bare refs -> `Outcome`
  const declaresResult =
    sf.getTypeAlias("Result") || sf.getInterface("Result") || sf.getClass("Result");
  if (declaresResult) {
    for (const id of sf.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (id.getText() !== "Result") continue;
      const parent = id.getParent();
      // skip the `Result` that is the member of a property access (e.g. Either.Either -> not this)
      if (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === id) continue;
      // skip qualified-name members (e.g. X.Result in a type position)
      if (Node.isQualifiedName(parent) && parent.getRight() === id) continue;
      id.replaceWithText("Outcome");
      stats.outcomeRenames++;
    }
  }

  // 2. rebind the import namespace Either -> Result
  const nsImport = eitherImport.getNamespaceImport();
  eitherImport.setModuleSpecifier("effect/Result");
  if (nsImport && nsImport.getText() === "Either") nsImport.replaceWithText("Result");

  // 3. rewrite Either.<member> accesses (property access AND qualified type names)
  for (const pa of sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    if (pa.getExpression().getText() !== "Either") continue;
    const m = pa.getName();
    if (memberMap.has(m)) {
      pa.getNameNode().replaceWithText(memberMap.get(m));
      stats.members++;
    } else stats.unmappedMembers.add(m);
    pa.getExpression().replaceWithText("Result");
  }
  for (const qn of sf.getDescendantsOfKind(SyntaxKind.QualifiedName)) {
    if (qn.getLeft().getText() !== "Either") continue;
    const m = qn.getRight().getText();
    if (memberMap.has(m)) {
      qn.getRight().replaceWithText(memberMap.get(m));
      stats.members++;
    } else stats.unmappedMembers.add(m);
    qn.getLeft().replaceWithText("Result");
  }
}

project.saveSync();
console.log(
  `files: ${stats.files}, member rewrites: ${stats.members}, Result->Outcome renames: ${stats.outcomeRenames}`,
);
if (stats.unmappedMembers.size)
  console.log(`⚠️ UNMAPPED Either members (review!): ${[...stats.unmappedMembers].join(", ")}`);
