#!/usr/bin/env node
// The architectural rules (ADR-0008 taxonomy, ADR-0020 data boundaries, and the
// local rules) run through oxlint's JS plugin system, which is alpha. The
// failure mode that matters is not a crash but a rule going silently vacuous —
// still configured, still "passing", enforcing nothing. A clean lint run cannot
// distinguish that from a clean codebase.
//
// So each rule gets a probe: a file that violates it, written to the path its
// globs actually match, linted, and asserted on. A rule that stops firing fails
// this script loudly instead of quietly disarming an ADR.

// Known coverage gap, pre-dating this migration and identical under ESLint:
// no-cross-schema-slonik-access matches only a bare `sql` tag, while all 49
// server SQL sites use `sql.type(Schema)`, and its FROM/JOIN regexes cannot
// match a quoted schema like `"user".users` — which ADR-0020 requires. The probe
// below therefore proves the plugin loads and fires under oxlint; it does not
// prove ADR-0020 is enforced on production code. Tracked separately.

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

/** @type {Array<{rule: string, file: string, source: string}>} */
const PROBES = [
  {
    rule: "project-structure/server-modules",
    file: "packages/server/src/modules/todos/__probe-stray.ts",
    source: "export const probe = 1;\n",
  },
  {
    rule: "project-structure/web-features",
    file: "packages/web/features/__probe-untiered.tsx",
    source: "export const Probe = () => null;\n",
  },
  {
    rule: "project-structure/cqrs-package",
    file: "packages/cqrs/src/__probe-stray/probe.ts",
    source: "export const probe = 1;\n",
  },
  {
    rule: "local/use-case-db-via-make-query",
    file: "packages/server/src/modules/todos/commands/__probe.handler.ts",
    source: "export const probe = (db) => db.execute((client) => client.query());\n",
  },
  {
    rule: "local/bus-factories-at-composition-roots",
    file: "packages/server/src/modules/todos/commands/__probe-bus.handler.ts",
    source: 'import { makeCommandBus } from "@org/cqrs";\n\nexport const probe = makeCommandBus;\n',
  },
  {
    rule: "local/prefer-named-exports",
    file: "packages/server/src/__probe-default.ts",
    source: "const probe = 1;\nexport default probe;\n",
  },
  {
    rule: "local/no-array-push-spread",
    file: "packages/server/src/__probe-push.ts",
    source:
      "const items: Array<number> = [];\nconst target: Array<number> = [];\ntarget.push(...items);\n\nexport const probe = target;\n",
  },
  {
    rule: "local/lucide-icon-suffix",
    file: "packages/components/primitives/__probe-lucide.ts",
    source: 'import { Clock } from "lucide-react";\n\nexport const probe = Clock;\n',
  },
  {
    rule: "local/no-effect-namespace-imports",
    file: "packages/server/src/__probe-effect-ns.ts",
    source: 'import { Effect } from "effect";\n\nexport const probe = Effect;\n',
  },
  {
    // The effecttsgo rules exist only while `effect-tsgo patch --oxlint` is
    // applied to the oxlint binary, and that patch is reapplied by `prepare` on
    // every install. This probe is what catches a reinstall that silently
    // dropped it.
    rule: "effecttsgo/global-date",
    file: "packages/server/src/__probe-global-date.ts",
    source: "export const probe = (): Date => new Date();\n",
  },
  {
    rule: "@synapsestudios/data-boundaries/no-cross-schema-slonik-access",
    file: "packages/server/src/modules/todos/queries/__probe-cross-schema.handler.ts",
    source:
      // Bare `sql` tag on purpose. The plugin's isSlonikSqlCall only accepts an
      // `sql` identifier or `x.sql` member tag, so it cannot see the
      // `sql.type(Schema)` form every real query here uses — see the note above.
      'import { sql } from "@org/database/index";\n\n' +
      "export const probe = sql`SELECT id FROM wallet.wallets`;\n",
  },
];

const written = [];
const cleanup = () => {
  for (const file of written.toReversed()) {
    rmSync(path.join(repoRoot, file), { force: true });
  }
  rmSync(path.join(repoRoot, "packages/cqrs/src/__probe-stray"), {
    force: true,
    recursive: true,
  });
};

process.on("exit", cleanup);
process.on("SIGINT", () => process.exit(130));

for (const probe of PROBES) {
  const absolute = path.join(repoRoot, probe.file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, probe.source);
  written.push(probe.file);
}

let output = "";
try {
  output = execFileSync("npx", ["oxlint", "--format=json", ...PROBES.map((p) => p.file)], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (error) {
  // oxlint exits non-zero because the probes are violations. That is the point.
  output = typeof error.stdout === "string" ? error.stdout : "";
}

const diagnostics = (JSON.parse(output || '{"diagnostics":[]}').diagnostics ?? []).map((d) => ({
  rule: (d.code ?? "").replace(/^(.+?)\((.+)\)$/, "$1/$2"),
  file: (d.filename ?? d.labels?.[0]?.filename ?? "").replace(/^\.\//, ""),
}));

const results = PROBES.map((probe) => ({
  rule: probe.rule,
  fired: diagnostics.some((d) => d.rule === probe.rule && d.file === probe.file),
}));

const width = Math.max(...results.map((r) => r.rule.length));
for (const { fired, rule } of results) {
  process.stdout.write(
    `  ${fired ? "✓" : "✗"}  ${rule.padEnd(width)}  ${fired ? "fires" : "SILENT — rule is vacuous"}\n`,
  );
}

const silent = results.filter((r) => !r.fired);
if (silent.length > 0) {
  process.stderr.write(
    `\n${silent.length} of ${results.length} architectural rules did not fire on a known violation.\n` +
      "A configured rule that reports nothing enforces nothing. Fix the rule or its config.\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write(`\nAll ${results.length} architectural rules fire on a known violation.\n`);
}
