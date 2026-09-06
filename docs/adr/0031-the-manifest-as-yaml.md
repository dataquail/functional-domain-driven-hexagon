# ADR-0031: the architecture manifest as YAML, one file per package

- Status: Accepted
- Date: 2026-09-06

## Context and Problem Statement

ADR-0028 wrote the architecture as one manifest and, when it passed 1500 lines,
split its _authoring_ across five JavaScript modules — `architecture.config.mjs`
composing `packages/architecture.mjs` and one `architecture.mjs` per package
with tiers of its own — while keeping the _evaluation_ one. ADR-0029 made the
engine a dependency; ADR-0030 pinned it to `@goodbones/*@0.1.0-beta.1`.

Two betas later the manifest is a **data file**. Beta.2 taught the engine to
discover `architecture.yaml`, `.yml` or `.json` at the repository root before
falling back to `architecture.config.mjs`, to read them through one YAML 1.2
parser, to generate a JSON Schema from its own decoder, and to report a decode
error with the file, line and column; it added `defs` / `use` for the one code
feature a literal manifest uses, a shared constant. But it had no way to split a
data manifest across files — no include, by design — so the first cut of this
change collapsed the five modules into one 1800-line `architecture.yaml`, and
recorded the monolith as the price of the format.

Beta.3 removes that price. `{ include: <path> }` standing anywhere in a manifest
is replaced whole by the file it names, resolved relative to the file that wrote
it; an included file may carry its own `$schema` and a top-level `defs` that
joins one namespace with every other file's; and every error, probe and coverage
number is computed on the assembled manifest and reported against the file the
offending line was written in. The docs describe the module form as the escape
hatch for a _generated_ manifest. Ours is a literal.

The question was whether to keep the module form the engine still honours, or
to move to the form every page of its documentation is now written in — and,
having moved, how to divide it.

## Decision

**The manifest is YAML: a root `architecture.yaml` that includes one
`architecture.yaml` per package, beside the package it governs. The five `.mjs`
files are deleted.** The pins move to `@goodbones/*@0.1.0-beta.3`.

- **The root holds what is true of the whole repository, and the index.**
  `resolve`, `aliases`, the repo-wide `deny` and `exports`, `graph`, `limits`,
  and under `tree` one `include` line per package pointing at
  `packages/<package>/architecture.yaml`. An include is replaced whole — nothing
  may be written beside it, and there is no merge — so the root's `tree` is the
  complete list of files that take part. It is ~340 lines, about what
  `architecture.config.mjs` was.
- **One node file per package, beside the package.** ADR-0028 grouped the six
  leaf packages into one `packages/architecture.mjs` because a module can export
  six keys; an include yields one value, so each package — `contracts`,
  `database`, `api-client`, `cli`, `mcp`, `jobs`, `components`, `web`, `server`
  — has its own file holding its one node. The leaf files are 20–50 lines. Each
  names the node schema (`architecture-node.schema.json`) on its first line, so
  an editor validates it as one node of the tree.
- **A fragment lives in the narrowest file that covers all its users.** Every
  file's `defs` share one namespace and a name defined twice is refused, so the
  question of where a fragment goes has one answer: `server-test-file`,
  `constituent-ops`, `port-consumers` and the rest of the server's vocabulary in
  the server's file; `story-file` and `component-story-parity` in components';
  `view-file` and `view-model-file` in web's; `no-default-exports`,
  `test-exports-nothing` and `frontend-test-file` — used by web _and_
  components — in the root. That is the same division ADR-0028's modules made
  with `import`, without the import.
- **Shared JavaScript became `defs`.** The two arrays that were spread into a
  `surface` became two single-rule fragments used side by side
  (`one-handler-export`, `camel-case-value-exports`). The two consumer lists
  that were spread into `importedBy.allow` became whole `importedBy` fragments
  (`port-consumers`, `acl-port-consumers`), because the schema admits `use` at
  node, `imports` and rule-item positions and not inside an `allow` list.
  `noDefaultExports(except)` became the `no-default-exports` fragment used per
  root with `except` overridden; an override replaces the list rather than
  merging with it, so each root repeats `**/vitest.config.ts` beside its own
  exemptions — the price of "no deep merge", visible where it is paid.
- **The policy is unchanged, and that was checked, not assumed.** The YAML was
  written by hand rather than taken from `architecture migrate`, so the
  comments — which the migration cannot carry and which are most of what makes
  the manifest legible — survived. The decoded form of the assembled manifest
  was compared, key order included, with the decoded form of the deleted
  modules: identical. `architecture check` reports the same 869 files and 0
  violations; the 166 edges and 12 graph shapes in `lint:edges` hold with the
  same verdicts; the 33 rule probes in `lint:rules` fire; the coverage floors
  are unchanged.
- **The files are quoted, folded and formatted.** Every glob and every message
  is quoted — a bare `*`, `@`, backtick or `{` means something else to YAML —
  and long messages are `>-` folded block scalars. Prettier formats them on
  commit like any other YAML in the repo, and the `**/architecture.mjs` lint
  ignore is gone with the files it ignored.
- **`lint:edges` reads the manifest the way the hosts do.** It used to `import`
  the module's default export; it now runs the engine's own `findManifestFile`
  → `readManifestFile` → `decodeManifest`, which assembles the includes and
  expands the `defs`, so the edge table is judged against the policy exactly as
  the plugin and the CLI read it.

## Consequences

- Positive: a decode error names a file and a line, and the file is the one
  beside the package; an editor validates each file as it is typed; the files
  are inert — read, not run, in the language server as much as in CI; a host in
  another language could read them.
- Positive: the separation of concerns ADR-0028 wanted is sharper than the
  module form gave it. A package's policy is one file next to its code with
  nothing else in it, the root is a readable index rather than a composition,
  and nothing in the policy is JavaScript any more, so nothing in it can drift
  into being a little engine of its own.
- Negative: an included file is replaced whole, so a section cannot be
  assembled from partial files by merging. That is why the six leaf packages
  are six small files rather than one, and why a fragment two packages share
  must move up to the root.
- Negative: a shallow `use` override cannot extend a list, so a per-root
  exemption list repeats the shared entry. Six occurrences today; if that
  grows, the fix is a second fragment, not a merge.
- Neutral: the remaining `.mjs` at the root are the probe and edge scripts,
  which are tests of the policy rather than the policy.

## Alternatives Considered

- **Keep the JavaScript modules.** The engine still reads them. Rejected: the
  docs now describe the module as the escape hatch for generated manifests,
  ours is a literal, and staying on the form the reference pages are not
  written in means translating every example.
- **One `architecture.yaml`.** What beta.2 allowed, and what the first cut of
  this change shipped. Rejected once beta.3 landed: an 1800-line file is the
  shape ADR-0028 split to escape, and the engine no longer requires it.
- **One file for the six leaf packages, as ADR-0028 had.** Not expressible: an
  include is one value, and a `tree` cannot splice a map. Six 20-to-50-line
  files beside their packages are the better shape anyway.
- **A generator that emits one `architecture.yaml` from per-package fragments.**
  Rejected as ADR-0028 rejected a build step: a generated file is either
  committed, and the reader is told not to edit the file they are reading, or
  not, and the editor's validation and the CLI's line numbers point at a file
  that is not in the repository. `include` is the engine doing this at load,
  with the line numbers intact.
- **YAML anchors and merge keys instead of `defs`.** The parser resolves them
  before the manifest is read, so they work within one file — and only within
  one file. Rejected: they cannot cross an include, an error inside a merged
  key cannot name its line, and `defs` is the mechanism the engine's own
  documentation uses.
- **`architecture.json`.** The same parser, the same schema, no quoting rules.
  Rejected: no comments, and the comments are most of the manifest.

## References

- ADR-0028 — the manifest; this ADR changes its format and keeps its per-area
  split in a form the data file can express.
- ADR-0029, ADR-0030 — the engine as a dependency, and the beta this ADR bumps
  from.
- `@goodbones/*@0.1.0-beta.3`; the manifest, formats, `defs`/`use` and
  "Splitting the manifest: `include`" sections at
  <https://dataquail.github.io/goodbones/architecture-rules/manifest/>.
