#!/usr/bin/env node
// Phase 1 codemod (b): Context.Tag (class form) -> Context.Service.
//   v3:  class X extends Context.Tag("Id")<X, Shape>() {}
//   v4:  class X extends Context.Service<X, Shape>()("Id") {}
// (arg order flips: the string id moves after the type-arg stage.)
//
// Only the class-heritage call form is transformed. Effect.Service and FiberRef
// are intentionally left for manual, per-service conversion (structural).
import { Project, SyntaxKind, Node } from "ts-morph";

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
const globs = process.argv.slice(2).length ? process.argv.slice(2) : ["packages/**/*.{ts,tsx}"];
project.addSourceFilesAtPaths([...globs, "!**/node_modules/**", "!**/dist/**", "!**/*.d.ts"]);

let count = 0;
const files = new Set();

for (const sf of project.getSourceFiles()) {
  // collect first (mutating during traversal forgets sibling nodes)
  const edits = [];
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const inner = call.getExpression();
    if (!Node.isCallExpression(inner)) continue;
    if (inner.getExpression().getText() !== "Context.Tag") continue;
    const idArgs = inner.getArguments().map((a) => a.getText()); // ["Id"]
    const typeArgs = call.getTypeArguments().map((t) => t.getText()); // [X, Shape]
    if (typeArgs.length === 0) continue;
    edits.push({
      node: call,
      text: `Context.Service<${typeArgs.join(", ")}>()(${idArgs.join(", ")})`,
    });
  }
  // apply last-to-first so earlier nodes keep their positions
  edits.sort((a, b) => b.node.getStart() - a.node.getStart());
  for (const { node, text } of edits) {
    if (node.wasForgotten()) continue;
    node.replaceWithText(text);
    count++;
    files.add(sf.getFilePath());
  }
}

project.saveSync();
console.log(`Context.Tag -> Context.Service: ${count} conversions across ${files.size} files`);
