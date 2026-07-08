#!/usr/bin/env node
// Phase 1 codemod (a): mechanical, AST-precise import-path + identifier renames.
// AST (ts-morph) not regex, so `Schema.decode` (v3 decoder) renames to `decodeEffect`
// without also mangling the *new* v4 `Schema.decode` transformation combinator, and
// `decodeUnknown` is never partially matched by `decode`.
//
// Does NOT touch effect/Either -> that is codemod (c) (needs binding + method rewrites together).
//
// Usage: node scripts/codemods/02-mechanical-renames.mjs [glob ...]
//   default glob = all first-party ts/tsx under packages/
import { Project, SyntaxKind } from "ts-morph";

// --- import module-specifier map ---------------------------------------------
const HTTPAPI = [
  "HttpApi",
  "HttpApiClient",
  "HttpApiGroup",
  "HttpApiEndpoint",
  "HttpApiBuilder",
  "HttpApiSchema",
  "HttpApiMiddleware",
  "HttpApiScalar",
  "HttpApiSwagger",
];
const HTTP = [
  "HttpServer",
  "HttpServerRequest",
  "HttpServerResponse",
  "HttpClient",
  "HttpClientRequest",
  "HttpClientResponse",
  "HttpMiddleware",
  "HttpRouter",
  "HttpApp",
  "FetchHttpClient",
  "HttpServerError",
  "HttpClientError",
];
const specifierMap = new Map();
for (const m of HTTPAPI) specifierMap.set(`@effect/platform/${m}`, `effect/unstable/httpapi/${m}`);
for (const m of HTTP) specifierMap.set(`@effect/platform/${m}`, `effect/unstable/http/${m}`);
specifierMap.set("@effect/platform/Path", "effect/Path");
specifierMap.set("@effect/platform/FileSystem", "effect/FileSystem");

// --- namespace-qualified identifier renames (object.name) --------------------
// keyed "Object.name" -> new name
const qualifiedRenames = new Map(
  Object.entries({
    "Schema.TaggedError": "TaggedErrorClass",
    "Schema.annotations": "annotate",
    "Schema.decodeUnknown": "decodeUnknownEffect",
    "Schema.decode": "decodeEffect",
    "Schema.encodeUnknown": "encodeUnknownEffect",
    "Schema.encode": "encodeEffect",
    "Schema.encodedSchema": "toEncoded",
    "Schema.typeSchema": "toType",
    "Schema.between": "isBetween",
    "Schema.greaterThan": "isGreaterThan",
    "Schema.lessThan": "isLessThan",
    "Schema.greaterThanOrEqualTo": "isGreaterThanOrEqualTo",
    "Schema.lessThanOrEqualTo": "isLessThanOrEqualTo",
    "Schema.minLength": "isMinLength",
    "Schema.maxLength": "isMaxLength",
    "Schema.pattern": "isPattern",
    "Schema.DateFromSelf": "Date",
    "Effect.catchAllCause": "catchCause",
    "Effect.catchAllDefect": "catchDefect",
    "Effect.catchAll": "catch",
    "Effect.fromEither": "fromResult",
  }),
);

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  skipFileDependencyResolution: true,
});
const globs = (
  process.argv.slice(2).length ? process.argv.slice(2) : ["packages/**/*.{ts,tsx}"]
).map((g) => g);
project.addSourceFilesAtPaths([...globs, "!**/node_modules/**", "!**/dist/**", "!**/*.d.ts"]);

const changes = {
  specifiers: 0,
  qualified: 0,
  annotateMethod: 0,
  httpApiStatus: 0,
  files: new Set(),
};

for (const sf of project.getSourceFiles()) {
  let touched = false;

  // 1. import/export module specifiers
  for (const decl of [...sf.getImportDeclarations(), ...sf.getExportDeclarations()]) {
    const spec = decl.getModuleSpecifierValue?.();
    if (spec && specifierMap.has(spec)) {
      decl.setModuleSpecifier(specifierMap.get(spec));
      changes.specifiers++;
      touched = true;
    }
  }

  // 2a. SEMANTIC: HttpApiSchema.annotations({ status: N }) -> { httpApiStatus: N }
  //     v4 dropped HttpApiSchema.annotations; the status lives in a plain annotations
  //     object under the `httpApiStatus` key (verified against HttpApiSchema.d.ts).
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (
      callee.getKind() === SyntaxKind.PropertyAccessExpression &&
      callee.getText() === "HttpApiSchema.annotations"
    ) {
      const arg = call.getArguments()[0];
      if (arg && arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const statusProp = arg.getProperty("status");
        if (statusProp && statusProp.getKind() === SyntaxKind.PropertyAssignment) {
          statusProp.getNameNode().replaceWithText("httpApiStatus");
        }
        call.replaceWithText(arg.getText());
        changes.httpApiStatus++;
        touched = true;
      }
    }
  }

  // 2b. qualified identifier renames (Object.name) + the `.annotations(` method.
  //     Exclude HttpApiSchema (handled semantically in 2a).
  for (const pa of sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const name = pa.getName();
    const objText = pa.getExpression().getText();
    const key = `${objText}.${name}`;
    if (qualifiedRenames.has(key)) {
      pa.getNameNode().replaceWithText(qualifiedRenames.get(key));
      changes.qualified++;
      touched = true;
    } else if (name === "annotations" && objText !== "HttpApiSchema") {
      // schema instance method: `.annotations(` -> `.annotate(`
      pa.getNameNode().replaceWithText("annotate");
      changes.annotateMethod++;
      touched = true;
    }
  }

  if (touched) changes.files.add(sf.getFilePath());
}

project.saveSync();
console.log(
  `specifiers: ${changes.specifiers}, qualified renames: ${changes.qualified}, .annotations->.annotate methods: ${changes.annotateMethod}`,
);
console.log(`files touched: ${changes.files.size}`);
