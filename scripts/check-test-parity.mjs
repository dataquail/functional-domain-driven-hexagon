// Enforces that every file matching a "subject" pattern has a sibling file
// satisfying the rule's requirement. Each rule names a subject glob, the
// requirement (used in error messages), and the candidate paths to look for —
// first match wins.
//
// NOTE: server-module parity (aggregate roots, command/query/event handlers,
// endpoints, event adapters, interface utils, repository/client/acl
// counterparts) and @org/components story parity have MOVED to the
// `project-structure/folder-structure` ESLint rule — see
// eslint.project-structure.mjs, run under `pnpm lint`. What remains here is the
// packages/web view-tiering parity (ViewModel / Presenter) and the
// tanstack-query bridge parity; these will move to the plugin's web config too,
// after which this script is retired.

import * as Glob from "glob";
import * as Fs from "node:fs";
import * as Path from "node:path";

const rules = [
  // ── Web (ADR-0014) ───────────────────────────────────────────────────
  // View-tiering parity for packages/web/.
  {
    label: "ViewModel",
    requirement: "sibling test",
    subject: "packages/web/features/**/*.view-model.ts",
    candidates: [(f) => f.replace(/\.view-model\.ts$/, ".view-model.test.ts")],
  },
  {
    label: "Presenter",
    requirement: "sibling test",
    subject: "packages/web/features/**/*.presenter.{ts,tsx}",
    // Test extension is independent of the presenter's: a presenter that only
    // exports a hook is fine to test from `.test.ts`; one that exports JSX
    // (provider, wrapper) or wants to render its hook through a JSX wrapper
    // typically picks `.test.tsx`. Either satisfies the parity rule.
    candidates: [
      (f) => f.replace(/\.presenter\.tsx?$/, ".presenter.test.ts"),
      (f) => f.replace(/\.presenter\.tsx?$/, ".presenter.test.tsx"),
    ],
  },
  // ── Bridge (web ↔ TanStack Query / Effect) ─────────────────────────
  // Files under `packages/web/lib/tanstack-query/` are the bridge
  // between two runtimes. They contain branch logic that's invisible
  // to presenter tests (toast surfacing, defect extraction, JSON
  // round-trip across the RSC/CC boundary, ParseError formatting). Each
  // non-barrel source file needs a sibling unit test.
  {
    label: "Tanstack-query bridge",
    requirement: "sibling test",
    subject: "packages/web/lib/tanstack-query/*.{ts,tsx}",
    ignore: ["**/*.test.ts", "**/*.test.tsx", "**/index.ts", "**/server-hydration-boundary.tsx"],
    candidates: [(f) => f.replace(/\.tsx?$/, ".test.ts"), (f) => f.replace(/\.tsx?$/, ".test.tsx")],
  },
];

let missing = 0;
for (const rule of rules) {
  const subjects = Glob.globSync(rule.subject, { ignore: rule.ignore ?? "**/*.test.ts" });
  for (const subject of subjects) {
    const tried = rule.candidates.map((fn) => fn(subject));
    if (!tried.some((p) => Fs.existsSync(p))) {
      missing++;
      const rel = Path.relative(process.cwd(), subject);
      console.error(`✖ ${rule.label} missing ${rule.requirement}: ${rel}`);
      for (const t of tried) {
        console.error(`    expected: ${Path.relative(process.cwd(), t)}`);
      }
    }
  }
}

if (missing > 0) {
  console.error(`\n${missing} unsatisfied parity check(s).`);
  process.exit(1);
}
console.log("✔ all parity checks pass");
