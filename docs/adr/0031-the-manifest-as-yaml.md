# ADR-0031: the architecture manifest as YAML

- Status: Accepted
- Date: 2026-09-05

## Context and Problem Statement

ADR-0028 wrote the architecture as one manifest and, when it passed 1500 lines,
split its _authoring_ across five JavaScript modules — `architecture.config.mjs`
composing `packages/architecture.mjs` and one `architecture.mjs` per package
with tiers of its own — while keeping the _evaluation_ one. ADR-0029 made the
engine a dependency; ADR-0030 pinned it to `@goodbones/*@0.1.0-beta.1`.

The second beta makes the manifest a **data file**. The engine now discovers
`architecture.yaml`, `.yml` or `.json` at the repository root before it falls
back to `architecture.config.mjs`, reads them through one YAML 1.2 parser,
generates a JSON Schema from its own decoder, and reports a decode error with
the file, line and column. The JavaScript module is still read, and the docs are
explicit about what it is for: a manifest _generated_ from other data. Ours is a
literal. The one code feature it used — a shared constant, and one function of
one argument — is what the new `defs` / `use` mechanism exists to replace.

The question was whether to keep the module form the engine still honours, or to
move to the form every page of its documentation is now written in.

## Decision

**The manifest is `architecture.yaml`, one file at the repository root, and the
five `.mjs` files are deleted.** The pins move to `@goodbones/*@0.1.0-beta.2`.

- **One file, because the engine offers no other way to have several.** A data
  format has no `import`, and the engine deliberately adds no include, no
  interpolation and no deep merge: a manifest that needs those "needs a
  generator, and a generator can emit YAML". The per-area split was an authoring
  convenience the module form made free; the data form does not, and reproducing
  it with a build step would put a generator between the policy and the reader
  for the sake of five files whose contents never changed independently. The
  evaluation was one before and is one now; only the authoring surface merged.
- **Shared JavaScript became `defs`.** Every hoisted constant is a named fragment
  and every reference is `{ use: <name> }`: `server-test-file`, `frontend-test-file`,
  `story-file`, `view-file`, `view-model-file`, `constituent-ops`,
  `specification`, `port-declares-no-value`, `test-exports-nothing`. The two
  arrays that were spread into a `surface` became two single-rule fragments used
  side by side (`one-handler-export`, `camel-case-value-exports`). The two
  consumer lists that were spread into `importedBy.allow` became whole
  `importedBy` fragments (`port-consumers`, `acl-port-consumers`), because the
  schema admits `use` at node, `imports` and rule-item positions and not inside
  an `allow` list — the editor would flag a list-position reference the loader
  accepts. `noDefaultExports(except)` became the `no-default-exports` fragment
  used per root with `except` overridden; an override replaces the list rather
  than merging with it, so each root repeats `**/vitest.config.ts` beside its
  own exemptions. That repetition is the price of "no deep merge", and it is
  visible where it is paid.
- **The policy is unchanged, and that was checked, not assumed.** The YAML was
  written by hand rather than taken from `architecture migrate`, so the
  comments — which the migration cannot carry and which are most of what makes
  the manifest legible — survived. Its decoded form was then compared, key order
  included, with the decoded form of the deleted modules: identical.
  `architecture check` reports the same 869 files and 0 violations; the 166
  edges and 12 graph shapes in `lint:edges` hold with the same verdicts; the 33
  rule probes in `lint:rules` fire; the coverage floors are unchanged.
- **The file is quoted, folded and formatted.** Every glob and every message is
  quoted — a bare `*`, `@`, backtick or `{` means something else to YAML — and
  the long messages are `>-` folded block scalars so a sentence is not a
  200-column line. The first line names the published JSON Schema, so the YAML
  language server completes keys and flags a misspelled one before the loader
  runs. Prettier formats it on commit like any other YAML in the repo, and the
  `**/architecture.mjs` lint ignore is gone with the files it ignored.
- **`lint:edges` reads the manifest the way the hosts do.** It used to `import`
  the module's default export; it now runs the engine's own
  `findManifestFile` → `readManifestFile` → `decodeManifest` and lowers the
  decoded manifest, so the edge table is judged against the file exactly as the
  plugin and the CLI read it, `defs` expanded.

## Consequences

- Positive: a decode error names a line; an editor validates the manifest as it
  is typed; the file is inert — read, not run, in the language server as much as
  in CI; a host in another language could read it. One place to look instead of
  five, and a diff of the policy is a diff of one file.
- Positive: the ADR-0029 boundary is sharper. Nothing in this repo's policy is
  JavaScript any more, so nothing in it can drift into being a little engine of
  its own.
- Negative: the manifest is one 1800-line file again, which is the shape ADR-0028
  split to escape. Its sections are delimited and commented, `defs` keeps the
  repetition down, and `architecture explain <file>` answers "what governs this
  file?" without reading it top to bottom — but a reader who wants one package's
  policy reads it inside the whole.
- Negative: a shallow override cannot extend a list, so a per-root exemption
  list repeats the shared entry. Six occurrences today; if that grows, the fix
  is a second fragment, not a merge.
- Neutral: the remaining `.mjs` at the root are the probe and edge scripts,
  which are tests of the policy rather than the policy.

## Alternatives Considered

- **Keep the JavaScript modules.** The engine still reads them and the split
  authoring stays free. Rejected: the docs now describe the module as the escape
  hatch for generated manifests, ours is a literal, and staying on the form the
  reference pages are not written in means translating every example.
- **A generator that emits `architecture.yaml` from per-package YAML fragments.**
  Keeps the split. Rejected as ADR-0028 rejected a build step for the same
  reason in the other direction: a generated file is either committed, and then
  the reader is told not to edit the file they are reading, or not, and then the
  editor's schema validation and the CLI's line numbers point at a file that
  does not exist in the repository.
- **YAML anchors and merge keys instead of `defs`.** The parser resolves them
  before the manifest is read, so they work. Rejected because an error inside a
  merged key cannot name its line, a JSON manifest has no such thing, and `defs`
  is the mechanism the engine's own documentation uses.
- **`architecture.json`.** The same parser, the same schema, no quoting rules.
  Rejected: no comments, and the comments are most of the manifest.

## References

- ADR-0028 — the manifest; this ADR changes its format and undoes its per-area
  split, not its content.
- ADR-0029, ADR-0030 — the engine as a dependency, and the beta this ADR bumps
  from.
- `@goodbones/*@0.1.0-beta.2`; the manifest, formats and `defs`/`use` pages at
  <https://dataquail.github.io/goodbones/architecture-rules/manifest/>, and the
  JavaScript-manifest page that documents `architecture migrate`.
