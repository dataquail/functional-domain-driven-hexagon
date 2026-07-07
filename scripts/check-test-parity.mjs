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
//   - `*.root.ts` is the explicit DDD signal for an aggregate root (the root
//     of a consistency boundary; invariants live here). Other domain
//     stereotypes — `*.aggregate.ts` (a constituent aggregate, only a part of
//     a root), `*.entity.ts`, `*.value-object.ts`, errors, events, and IDs —
//     are NOT subject to parity.
//   - `*-repository-live.ts` is the production repository implementation
//     (ADR-0005). Each must have an integration test (live SQL behavior) and
//     a fake counterpart (so use-case unit tests can run without a DB).
//   - `*.endpoint.ts` covers HTTP endpoints in `interface/http/` (ADR-0013).
//   - `*-event-adapter.ts` covers cross-module event subscribers in
//     `interface/events/` (ADR-0007 ACL pattern).
//   - Files in `event-handlers/` are by-name, not schema-then-impl, so any
//     non-test file is a subject.

import * as Glob from "glob";
import * as Fs from "node:fs";
import * as Path from "node:path";

const rules = [
  {
    label: "HTTP endpoint",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/interface/http/*.endpoint.ts",
    candidates: [
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.integration.test.ts"),
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.test.ts"),
    ],
  },
  {
    label: "CLI endpoint",
    requirement: "sibling test",
    // CLI-facing wire endpoints in `interface/cli/` (ADR-0024) — a separate
    // inbound adapter from `interface/http/`, dispatching to the same bus.
    subject: "packages/server/src/modules/*/interface/cli/*.endpoint.ts",
    candidates: [
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.integration.test.ts"),
      (f) => f.replace(/\.endpoint\.ts$/, ".endpoint.test.ts"),
    ],
  },
  {
    label: "Event adapter",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/interface/events/*.event-adapter.ts",
    candidates: [
      (f) => f.replace(/\.event-adapter\.ts$/, ".event-adapter.test.ts"),
      (f) => f.replace(/\.event-adapter\.ts$/, ".event-adapter.integration.test.ts"),
    ],
  },
  {
    // The schema announces the command; the test sits on the handler.
    label: "Command",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/commands/*.command.ts",
    candidates: [
      (f) => f.replace(/\.command\.ts$/, ".handler.test.ts"),
      (f) => f.replace(/\.command\.ts$/, ".handler.integration.test.ts"),
    ],
  },
  {
    label: "Query",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/queries/*.query.ts",
    candidates: [
      (f) => f.replace(/\.query\.ts$/, ".handler.integration.test.ts"),
      (f) => f.replace(/\.query\.ts$/, ".handler.test.ts"),
    ],
  },
  {
    label: "Event handler",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/event-handlers/*.handler.ts",
    candidates: [
      (f) => f.replace(/\.handler\.ts$/, ".handler.integration.test.ts"),
      (f) => f.replace(/\.handler\.ts$/, ".handler.test.ts"),
    ],
  },
  {
    label: "Aggregate root",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/domain/*.root.ts",
    candidates: [
      (f) => f.replace(/\.root\.ts$/, ".root.test.ts"),
      (f) => f.replace(/\.root\.ts$/, ".root.integration.test.ts"),
    ],
  },
  {
    // ADR-0026: a domain service is stateless domain logic no aggregate owns.
    // Because it's real domain logic (not an aggregate op), it carries a test
    // obligation, unlike the other non-root domain stereotypes.
    label: "Domain service",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/domain/*.domain-service.ts",
    candidates: [(f) => f.replace(/\.domain-service\.ts$/, ".domain-service.test.ts")],
  },
  {
    // ADR-0026: a *.util.ts is a pure, leaf, shared protocol/wire helper in an
    // interface adapter. The sibling-test requirement is the anti-drift guard —
    // extracting a helper must be justified by a unit test, which is what
    // separates a deliberate extraction from a dumped utility.
    label: "Interface util",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/interface/{http,cli}/*.util.ts",
    candidates: [
      (f) => f.replace(/\.util\.ts$/, ".util.test.ts"),
      (f) => f.replace(/\.util\.ts$/, ".util.integration.test.ts"),
    ],
  },
  {
    label: "Live repository",
    requirement: "sibling integration test",
    subject: "packages/server/src/modules/*/infrastructure/repositories/*.repository-live.ts",
    candidates: [
      (f) => f.replace(/\.repository-live\.ts$/, ".repository-live.integration.test.ts"),
    ],
  },
  {
    label: "Live repository",
    requirement: "fake counterpart",
    subject: "packages/server/src/modules/*/infrastructure/repositories/*.repository-live.ts",
    candidates: [(f) => f.replace(/\.repository-live\.ts$/, ".repository-fake.ts")],
  },
  // ── Outbound adapters (ADR-0023) ────────────────────────────────────
  // A driven adapter behind a consumer-owned port, in one of two buckets:
  //   - `infrastructure/clients/*.client-live.ts` — adapters to true
  //     third-party systems (Stripe, the mailer), behind a
  //     `domain/ports/clients/*.client.ts` port.
  //   - `infrastructure/acl/*.acl-live.ts` — anti-corruption adapters to
  //     another bounded context, behind a `domain/ports/acl/*.acl.ts` port;
  //     the one place a module imports another module's barrel.
  // Like a live repository, each needs a test (the error-translation /
  // context-mapping behavior is the adapter's whole job) and a fake
  // counterpart (so consumer use-case unit tests run against a focused
  // port double instead of faking the typed bus). Self-contained clients
  // that are their own Effect.Service (e.g. `*.client.ts`, no port, no
  // `-live`/`-fake` split) are not subjects.
  {
    label: "Client adapter",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/infrastructure/clients/*.client-live.ts",
    candidates: [
      (f) => f.replace(/\.client-live\.ts$/, ".client-live.integration.test.ts"),
      (f) => f.replace(/\.client-live\.ts$/, ".client-live.test.ts"),
    ],
  },
  {
    label: "Client adapter",
    requirement: "fake counterpart",
    subject: "packages/server/src/modules/*/infrastructure/clients/*.client-live.ts",
    candidates: [(f) => f.replace(/\.client-live\.ts$/, ".client-fake.ts")],
  },
  {
    label: "ACL adapter",
    requirement: "sibling test",
    subject: "packages/server/src/modules/*/infrastructure/acl/*.acl-live.ts",
    candidates: [
      (f) => f.replace(/\.acl-live\.ts$/, ".acl-live.integration.test.ts"),
      (f) => f.replace(/\.acl-live\.ts$/, ".acl-live.test.ts"),
    ],
  },
  {
    label: "ACL adapter",
    requirement: "fake counterpart",
    subject: "packages/server/src/modules/*/infrastructure/acl/*.acl-live.ts",
    candidates: [(f) => f.replace(/\.acl-live\.ts$/, ".acl-fake.ts")],
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
  // NOTE: @org/components story parity (ADR-0015) is now enforced by the
  // `project-structure/folder-structure` rule (see eslint.project-structure.mjs,
  // componentsPrimitives/componentsPatterns), run under `pnpm lint`.
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
