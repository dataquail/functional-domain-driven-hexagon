// Enforces a closed vocabulary of file *kinds* per stereotype folder in
// `packages/server/src/modules/`. Test-parity (check-test-parity.mjs) asks
// "does this file have its required sibling?"; this asks the inverse and
// stricter question: "is this file even allowed to exist here?".
//
// The point is to stop new, unsanctioned file conventions from creeping in
// — the stray `todo-helpers.ts` or `session-utils.ts` that should have been
// a method on an aggregate root or a named stereotype. Each rule lists the
// filename patterns a folder admits; anything else fails with a hint that
// points at where the logic probably belongs.
//
// Conventions:
//   - Test files (`*.test.ts(x)`, `*.integration.test.ts(x)`) are exempt
//     everywhere: they mirror a subject and are governed by the parity
//     check + naming rules, not by this one. The risk this guard addresses
//     is oddball *source* files.
//   - A `pair` rule handles folders whose primary source file is
//     intentionally free-named (command/query handlers): a bare `X.ts` is
//     admitted only if its schema sibling (`X-command.ts` / `X-query.ts`)
//     exists — which is exactly what distinguishes a real handler from a
//     smuggled-in utility.
//   - `allow: []` means the folder admits no direct source files at all
//     (e.g. `domain/ports/` — ports must live in a tier subfolder).
//   - `dirRules` (after the file rules) validate the inverse for folders: a
//     container (the module root, `domain/`, `interface/`, …) admits only a
//     closed set of *subfolders*, so a stray directory fails like a stray file.

import * as Glob from "glob";
import * as Fs from "node:fs";
import * as Path from "node:path";

const M = "packages/server/src/modules";

const TEST = /\.(test|integration\.test)\.tsx?$/;
const has = (dir, name) => Fs.existsSync(Path.join(dir, name));

const rules = [
  // ── module root ─────────────────────────────────────────────────────
  // The module root holds only aggregation/composition files; all feature
  // code lives in a stereotype subfolder (domain/, commands/, …).
  {
    label: "module root",
    dir: `${M}/*/*.ts`,
    allow: [
      /^index\.ts$/,
      /\.module\.ts$/,
      /\.command-handlers\.ts$/,
      /\.query-handlers\.ts$/,
      /\.event-span-attributes\.ts$/,
      /\.shared-deps\.ts$/,
    ],
    hint: "The module root admits only aggregation files: index.ts (barrel), <feature>.module.ts (composed Layer), <feature>.command-handlers.ts / .query-handlers.ts (bus-registration maps), <feature>.event-span-attributes.ts, and <feature>.shared-deps.ts. Feature code belongs in a stereotype subfolder.",
  },
  // ── domain/ ─────────────────────────────────────────────────────────
  {
    label: "domain",
    dir: `${M}/*/domain/*.ts`,
    allow: [
      /\.root\.ts$/,
      /\.aggregate\.ts$/,
      /\.entity\.ts$/,
      /\.value-object\.ts$/,
      /\.id\.ts$/,
      /\.errors\.ts$/,
      /\.events\.ts$/,
      /\.domain-service\.ts$/,
    ],
    hint: "domain/ admits aggregate roots (*.root.ts), constituent aggregates (*.aggregate.ts), entities (*.entity.ts), value objects (*.value-object.ts), IDs (*.id.ts), errors (*.errors.ts), events (*.events.ts), and domain services (*.domain-service.ts — stateless logic no aggregate owns; ADR-0026). A free-standing helper usually belongs as a method on the aggregate root — or as a *.value-object.ts if it models a value.",
  },
  {
    label: "domain/value-objects",
    dir: `${M}/*/domain/value-objects/*.ts`,
    allow: [/\.value-object\.ts$/],
    hint: "domain/value-objects/ admits only *.value-object.ts files.",
  },
  {
    label: "domain/ports (tier subfolders only)",
    dir: `${M}/*/domain/ports/*.ts`,
    allow: [],
    hint: "A port must live in a tier subfolder: domain/ports/repositories/, domain/ports/clients/ (third-party systems), or domain/ports/acl/ (other bounded contexts).",
  },
  {
    label: "domain/ports/repositories",
    dir: `${M}/*/domain/ports/repositories/*.ts`,
    allow: [/\.repository\.ts$/],
    hint: "Repository ports are named *.repository.ts.",
  },
  {
    label: "domain/ports/clients",
    dir: `${M}/*/domain/ports/clients/*.ts`,
    allow: [/\.client\.ts$/],
    hint: "domain/ports/clients/ holds capability-named port declarations for third-party systems, named *.client.ts. No test files — adapter behavior is tested beside the adapter in infrastructure/clients/.",
  },
  {
    label: "domain/ports/acl",
    dir: `${M}/*/domain/ports/acl/*.ts`,
    allow: [/\.acl\.ts$/],
    hint: "domain/ports/acl/ holds capability-named port declarations for other bounded contexts, named *.acl.ts. No test files — adapter behavior is tested beside the adapter in infrastructure/acl/.",
  },
  // ── commands/ & queries/ (schema + paired handler) ──────────────────
  {
    label: "commands",
    dir: `${M}/*/commands/*.ts`,
    allow: [/\.command\.ts$/],
    pair: (file) =>
      Path.basename(file).endsWith(".handler.ts") &&
      has(Path.dirname(file), Path.basename(file).replace(/\.handler\.ts$/, ".command.ts")),
    hint: "commands/ holds a <verb-noun>.command.ts schema and its <verb-noun>.handler.ts handler. A source file that is neither a *.command.ts nor a *.handler.ts paired to one (no sibling *.command.ts) is out of place — model shared logic on the aggregate root or a domain service.",
  },
  {
    label: "queries",
    dir: `${M}/*/queries/*.ts`,
    allow: [/\.query\.ts$/],
    pair: (file) =>
      Path.basename(file).endsWith(".handler.ts") &&
      has(Path.dirname(file), Path.basename(file).replace(/\.handler\.ts$/, ".query.ts")),
    hint: "queries/ holds a <verb-noun>.query.ts schema and its <verb-noun>.handler.ts handler. A source file that is neither a *.query.ts nor a *.handler.ts paired to one is out of place.",
  },
  // ── event-handlers/ (each non-test file is a handler) ────────────────
  {
    label: "event-handlers",
    dir: `${M}/*/event-handlers/*.ts`,
    allow: [/\.handler\.ts$/],
    hint: "event-handlers/ holds one *.handler.ts per file (reacting to a trigger). Shared logic belongs on the aggregate or a domain service, not a loose utility here.",
  },
  {
    label: "event-handlers/triggers",
    dir: `${M}/*/event-handlers/triggers/*.ts`,
    allow: [/\.triggers\.ts$/],
    hint: "event-handlers/triggers/ admits only <publisher>.triggers.ts trigger declarations.",
  },
  // ── infrastructure/ (three adapter buckets) ─────────────────────────
  {
    label: "infrastructure (adapter subfolders only)",
    dir: `${M}/*/infrastructure/*.{ts,tsx}`,
    allow: [],
    hint: "infrastructure/ is a container — files belong in a bucket: infrastructure/repositories/, infrastructure/clients/, or infrastructure/acl/.",
  },
  {
    label: "infrastructure/repositories",
    dir: `${M}/*/infrastructure/repositories/*.ts`,
    allow: [/\.repository-live\.ts$/, /\.repository-fake\.ts$/, /\.mapper\.ts$/],
    hint: "infrastructure/repositories/ admits only *.repository-live.ts, *.repository-fake.ts, and *.mapper.ts.",
  },
  {
    label: "infrastructure/clients",
    dir: `${M}/*/infrastructure/clients/*.{ts,tsx}`,
    allow: [/\.client-live\.ts$/, /\.client-fake\.ts$/, /\.client\.ts$/, /\.email\.tsx$/],
    hint: "infrastructure/clients/ holds third-party adapters: a port-backed *.client-live.ts + *.client-fake.ts (behind a domain/ports/clients/*.client.ts port), self-contained service clients with no port (*.client.ts), and email templates (*.email.tsx).",
  },
  {
    label: "infrastructure/acl",
    dir: `${M}/*/infrastructure/acl/*.ts`,
    allow: [/\.acl-live\.ts$/, /\.acl-fake\.ts$/],
    hint: "infrastructure/acl/ holds anti-corruption adapters to other modules: a port-backed *.acl-live.ts + *.acl-fake.ts (behind a domain/ports/acl/*.acl.ts port). It is the only place a module may import another module's barrel.",
  },
  // ── interface/ (one subfolder per inbound protocol) ─────────────────
  // interface/http and cli additionally admit *.util.ts — pure, leaf, shared
  // protocol/wire plumbing extracted from an endpoint for testability
  // (ADR-0026). It is deliberately allowed in NO other stereotype folder: a
  // shared helper in the application layer (commands/queries/event-handlers) is
  // a smell — it's either domain logic (→ an aggregate op) or trivial (→ inline).
  {
    label: "interface (protocol subfolders only)",
    dir: `${M}/*/interface/*.{ts,tsx}`,
    allow: [],
    hint: "interface/ is a container — files belong in a protocol subfolder: interface/http/, interface/cli/, or interface/events/.",
  },
  {
    label: "interface/http",
    dir: `${M}/*/interface/http/*.ts`,
    allow: [/\.endpoint\.ts$/, /^index\.ts$/, /\.util\.ts$/],
    hint: "interface/http/ admits <name>.endpoint.ts endpoints (ADR-0013), an index.ts barrel that registers the endpoint groups, and *.util.ts protocol helpers (ADR-0026).",
  },
  {
    label: "interface/cli",
    dir: `${M}/*/interface/cli/*.ts`,
    allow: [/\.endpoint\.ts$/, /^index\.ts$/, /\.util\.ts$/],
    hint: "interface/cli/ admits <name>.endpoint.ts endpoints (ADR-0024), an index.ts barrel that registers the endpoint groups, and *.util.ts protocol helpers (ADR-0026).",
  },
  {
    label: "interface/events",
    dir: `${M}/*/interface/events/*.ts`,
    allow: [/\.event-adapter\.ts$/],
    hint: "interface/events/ admits only <publisher>.event-adapter.ts ACL adapters (ADR-0007).",
  },
  // ── policies/ ───────────────────────────────────────────────────────
  {
    label: "policies",
    dir: `${M}/*/policies/*.ts`,
    allow: [
      /\.policies\.ts$/,
      /\.resource-resolver\.ts$/,
      /\.resource-resolvers\.ts$/,
      /\.policy\.ts$/,
    ],
    hint: "policies/ admits *.policies.ts registries, *.resource-resolver(s).ts, and is-*.policy.ts check functions.",
  },
  {
    label: "policies/public",
    dir: `${M}/*/policies/public/*.ts`,
    allow: [/\.service-live\.ts$/],
    hint: "policies/public/ holds this module's Live implementations of platform ACL service ports (*.service-live.ts) — the data/capability it publishes to the centralized policy registry (server.ts wires them).",
  },
];

// Directory allowlists: a parent folder that admits only a closed set of
// SUBFOLDERS. The file `rules` above guard what may live *in* a folder; these
// guard which nested folders may exist at all — so a stray `modules/x/helpers/`
// or `interface/grpc/` fails just like a stray file would.
const dirRules = [
  {
    label: "module root",
    parent: `${M}/*`,
    allowDirs: [
      "domain",
      "commands",
      "queries",
      "event-handlers",
      "infrastructure",
      "interface",
      "policies",
    ],
    hint: "A module admits only the stereotype subfolders: domain/, commands/, queries/, event-handlers/, infrastructure/, interface/, policies/.",
  },
  {
    label: "domain/",
    parent: `${M}/*/domain`,
    allowDirs: ["ports", "value-objects"],
    hint: "domain/ admits only the ports/ and value-objects/ subfolders (alongside its stereotype files).",
  },
  {
    label: "domain/ports/",
    parent: `${M}/*/domain/ports`,
    allowDirs: ["repositories", "clients", "acl"],
    hint: "domain/ports/ admits only the repositories/, clients/, and acl/ tier subfolders.",
  },
  {
    label: "infrastructure/",
    parent: `${M}/*/infrastructure`,
    allowDirs: ["repositories", "clients", "acl"],
    hint: "infrastructure/ admits only the repositories/, clients/, and acl/ bucket subfolders.",
  },
  {
    label: "interface/",
    parent: `${M}/*/interface`,
    allowDirs: ["http", "cli", "events"],
    hint: "interface/ admits only the http/, cli/, and events/ protocol subfolders.",
  },
  {
    label: "event-handlers/",
    parent: `${M}/*/event-handlers`,
    allowDirs: ["triggers"],
    hint: "event-handlers/ admits only the triggers/ subfolder (alongside its *.handler.ts files).",
  },
  {
    label: "policies/",
    parent: `${M}/*/policies`,
    allowDirs: ["public"],
    hint: "policies/ admits only the public/ subfolder (alongside its policy files).",
  },
];

let violations = 0;
for (const rule of dirRules) {
  for (const parent of Glob.globSync(rule.parent)) {
    if (!Fs.statSync(parent).isDirectory()) continue;
    for (const entry of Fs.readdirSync(parent, { withFileTypes: true })) {
      if (!entry.isDirectory() || rule.allowDirs.includes(entry.name)) continue;
      violations++;
      const rel = Path.relative(process.cwd(), Path.join(parent, entry.name));
      console.error(`✖ ${rule.label}: unexpected folder ${rel}/`);
      console.error(`    ${rule.hint}`);
    }
  }
}
for (const rule of rules) {
  for (const file of Glob.globSync(rule.dir)) {
    const base = Path.basename(file);
    if (TEST.test(base)) continue; // tests governed elsewhere
    const ok = rule.allow.some((re) => re.test(base)) || (rule.pair && rule.pair(file));
    if (!ok) {
      violations++;
      console.error(`✖ ${rule.label}: unexpected file ${Path.relative(process.cwd(), file)}`);
      console.error(`    ${rule.hint}`);
    }
  }
}

if (violations > 0) {
  console.error(
    `\n${violations} folder-layout violation(s). Files must match their folder's sanctioned vocabulary — see the hint on each.`,
  );
  process.exit(1);
}
console.log("✔ all folder-layout checks pass");
