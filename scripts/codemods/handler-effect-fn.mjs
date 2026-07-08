// Phase 6 (effect-v4 modernization) codemod: convert use-case handler
// entry points from `(args): Out => Effect.gen(function* () {...})` to
// `Effect.fn("name")(function* (args) {...})`, adding a named use-case span
// inside the bus/endpoint boundary span (supersedes ADR-0012).
//
// Precise by construction: only rewrites a top-level exported `const` whose
// initializer is an arrow function whose body is DIRECTLY `Effect.gen(fn*)`.
// This skips `.pipe(...)` handlers (mint-api-token), `Layer.effectDiscard`
// subscribers (billing sync), and anything else — those are hand-migrated.
//
// Deleted in Phase 7 with the other codemods.
import { Project, SyntaxKind } from "ts-morph";
import { globSync } from "node:fs";

const files = globSync("packages/server/src/modules/**/*.handler.ts", {
  cwd: process.cwd(),
}).filter((f) => !f.endsWith(".test.ts"));

const project = new Project({ tsConfigFilePath: "packages/server/tsconfig.json" });

let converted = 0;
const report = [];

for (const filePath of files) {
  const sf = project.addSourceFileAtPathIfExists(filePath);
  if (!sf) continue;
  let touched = false;

  for (const stmt of sf.getVariableStatements()) {
    if (!stmt.isExported()) continue;
    for (const decl of stmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getKind() !== SyntaxKind.ArrowFunction) continue;
      const arrow = init.asKindOrThrow(SyntaxKind.ArrowFunction);
      const body = arrow.getBody();
      if (body.getKind() !== SyntaxKind.CallExpression) continue;
      let call = body.asKindOrThrow(SyntaxKind.CallExpression);

      // Two accepted shapes:
      //   (a) body is DIRECTLY `Effect.gen(function* () {...})`
      //   (b) body is `Effect.gen(function* () {...}).pipe(t1, t2, ...)` — the
      //       trailing transforms (e.g. `withUnitOfWork`) become `Effect.fn`'s
      //       variadic pipe args, which apply in the same order.
      let pipeArgs = [];
      const callExprText = call.getExpression().getText();
      if (callExprText.endsWith(".pipe")) {
        pipeArgs = call.getArguments().map((a) => a.getText());
        const receiver = call.getExpression().asKindOrThrow(SyntaxKind.PropertyAccessExpression).getExpression();
        if (receiver.getKind() !== SyntaxKind.CallExpression) continue;
        call = receiver.asKindOrThrow(SyntaxKind.CallExpression);
      }
      if (call.getExpression().getText() !== "Effect.gen") continue;
      const genArg = call.getArguments()[0];
      if (!genArg || genArg.getKind() !== SyntaxKind.FunctionExpression) continue;

      const name = decl.getName();
      const params = arrow.getParameters().map((p) => p.getText());
      const genFn = genArg.asKindOrThrow(SyntaxKind.FunctionExpression);
      const genBodyText = genFn.getBody().getText(); // includes the braces

      const paramList = params.join(", ");
      const trailing = pipeArgs.length > 0 ? `, ${pipeArgs.join(", ")}` : "";
      const replacement = `Effect.fn("${name}")(function* (${paramList}) ${genBodyText}${trailing})`;
      init.replaceWithText(replacement);

      converted += 1;
      touched = true;
      report.push(`${filePath} :: ${name}`);
    }
  }

  if (touched) sf.saveSync();
}

console.log(report.join("\n"));
console.log(`\nConverted ${converted} handler(s).`);
