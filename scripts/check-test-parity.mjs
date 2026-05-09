// Enforces that every file matching a "subject" pattern has a sibling file
// satisfying the rule's requirement. Each rule names a subject glob, the
// requirement (used in error messages), and the candidate paths to look for —
// first match wins.
//
// The naming conventions chosen as detectors are not arbitrary:
//   - `*-command.ts` / `*-query.ts` are the registry-merge schema files for
//     the typed bus (ADR-0006). Their existence announces "this command/query
//     exists"; the test sits next to the handler implementation file (drop
//     the suffix).
//   - `*.aggregate.ts` is the explicit DDD signal for an aggregate root.
//     Value objects, errors, and IDs in `domain/` are not subject to parity.
//   - `*-repository-live.ts` is the production repository implementation
//     (ADR-0005). Each must have an integration test (live SQL behavior) and
//     a fake counterpart (so use-case unit tests can run without a DB).
//   - `*.endpoint.ts` covers HTTP endpoints (ADR-0013).
//   - Files in `event-handlers/` are by-name, not schema-then-impl, so any
//     non-test file is a subject.

import * as Glob from "glob";
import * as Fs from "node:fs";
import * as Path from "node:path";

const rules = [
  {
    label: "HTTP endpoint",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/interface/*.endpoint.ts",
    candidates: [
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.integration.test.ts"),
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.test.ts"),
    ],
  },
  {
    label: "Command",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/commands/*-command.ts",
    candidates: [
      (f) => f.replace(/-command\.ts$/, ".test.ts"),
      (f) => f.replace(/-command\.ts$/, ".integration.test.ts"),
    ],
  },
  {
    label: "Query",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/queries/*-query.ts",
    candidates: [
      (f) => f.replace(/-query\.ts$/, ".integration.test.ts"),
      (f) => f.replace(/-query\.ts$/, ".test.ts"),
    ],
  },
  {
    label: "Event handler",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/event-handlers/*.ts",
    candidates: [
      (f) => f.replace(/\.ts$/, ".integration.test.ts"),
      (f) => f.replace(/\.ts$/, ".test.ts"),
    ],
  },
  {
    label: "Aggregate",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/domain/*.aggregate.ts",
    candidates: [
      (f) => f.replace(/\.aggregate\.ts$/, ".aggregate.test.ts"),
      (f) => f.replace(/\.aggregate\.ts$/, ".aggregate.integration.test.ts"),
    ],
  },
  {
    label: "Live repository",
    requirement: "sibling integration test",
    subject: "packages/server/src/modules/*/infrastructure/*-repository-live.ts",
    candidates: [(f) => f.replace(/-repository-live\.ts$/, "-repository-live.integration.test.ts")],
  },
  {
    label: "Live repository",
    requirement: "fake counterpart",
    subject: "packages/server/src/modules/*/infrastructure/*-repository-live.ts",
    candidates: [(f) => f.replace(/-repository-live\.ts$/, "-repository-fake.ts")],
  },
  // ── Web (ADR-0014) ───────────────────────────────────────────────────
  // View-tiering parity for packages/web/. Component-library parity
  // (Storybook stories) lives in @org/components — see below.
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
  // ── @org/components (ADR-0015) ──────────────────────────────────────
  // Every primitive and pattern needs a Storybook story so the
  // component library has a single navigable surface. Re-exports from
  // index.ts and the icon registry (icons.ts) are not subjects.
  {
    label: "Primitive component",
    requirement: "sibling Storybook story",
    subject: "packages/components/primitives/**/*.tsx",
    ignore: ["**/*.stories.tsx", "**/*.test.tsx", "**/index.tsx"],
    candidates: [(f) => f.replace(/\.tsx$/, ".stories.tsx")],
  },
  {
    label: "Pattern component",
    requirement: "sibling Storybook story",
    subject: "packages/components/patterns/**/*.tsx",
    ignore: ["**/*.stories.tsx", "**/*.test.tsx", "**/index.tsx"],
    candidates: [(f) => f.replace(/\.tsx$/, ".stories.tsx")],
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
