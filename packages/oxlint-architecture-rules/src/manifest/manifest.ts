import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { ResolveConfig } from "../domain/architecture-config.js";
import { ConfigInvalid } from "../domain/architecture-error.js";

// A manifest is a tree of nodes keyed by path pattern, where everything the
// architecture says about a part of the tree is written at that part of the tree.
// A node is a folder (it has `children` and/or `files`) or a file (its key names
// a filename pattern).
//
// The default is tight: a folder admits only the children it lists, and a node
// may import only what it or an ancestor allows. Laxity is opted into, by name,
// at the node that wants it.

const Globs = Schema.Union([Schema.String, Schema.Array(Schema.String)]);

// A prohibition. `match`/`matchNot` describe the target; `except` names the
// importers it does not apply to. The exemption is declared by the author of the
// prohibition, in the same breath — a descendant still cannot opt itself out.
const Denial = Schema.Struct({
  match: Globs,
  matchNot: Schema.optionalKey(Globs),
  except: Schema.optionalKey(Globs),
  message: Schema.String,
});

// Outbound: what this part of the tree may reach.
const Imports = Schema.Struct({
  message: Schema.optionalKey(Schema.String),
  // Repo-relative globs, after alias expansion. A target matching none of these
  // is the violation — so widening is something you do by name, in the open.
  allow: Schema.optionalKey(Globs),
  // npm package names. Omit to inherit; `[]` to forbid every external.
  external: Schema.optionalKey(Schema.Array(Schema.String)),
  // Checked before `allow`, and wins over it. This is how a rule keeps a
  // specific, better message for a mistake the allowlist would also catch.
  deny: Schema.optionalKey(Schema.Array(Denial)),
  // The one widening mechanism: stop inheriting ancestors' allowances. Inherited
  // `deny` entries are unaffected — a prohibition only ever accumulates.
  reset: Schema.optionalKey(Schema.Boolean),
  // "This tier has no allowlist yet; only the prohibitions below apply." Implies
  // `reset`. Required whenever a node states `imports` without an `allow`, so
  // that an untightened tier is a sentence someone wrote rather than a gap in
  // the config — and so `grep unrestricted` is the adoption backlog.
  unrestricted: Schema.optionalKey(Schema.Boolean),
});

// Inbound: who may reach this part of the tree. Four of the rules governing
// `domain/` are of this shape — "*.root-ops.ts is private to command handlers" —
// and stating them here is what stops them being a distant rule with a growing
// exclusion list on its `from` side.
const ImportedBy = Schema.Struct({
  message: Schema.String,
  allow: Globs,
  // Targets inside this node's subtree the restriction does not cover — the
  // module barrel is the obvious one: a module is private except through it.
  matchNot: Schema.optionalKey(Globs),
});

const Members = Schema.Struct({
  message: Schema.String,
  subject: Schema.Literals(["type-members", "calls"]),
  in: Schema.optionalKey(Globs),
  match: Schema.optionalKey(Globs),
  matchNot: Schema.optionalKey(Globs),
  allow: Schema.optionalKey(Globs),
});

// Which importers may name a given exported symbol. A path rule cannot say
// this: every importer of a barrel resolves to the same file, so only the
// imported name separates a bus factory from the Tag beside it.
const ExportRestriction = Schema.Struct({
  name: Schema.String,
  message: Schema.String,
  // The module the symbols come from, matched against its RESOLVED path.
  module: Globs,
  // Exact exported names. Omit to mean "any named import from that module",
  // which is how a rule bans a binding form rather than a name.
  symbols: Schema.optionalKey(Schema.Array(Schema.String)),
  except: Schema.optionalKey(Globs),
  fix: Schema.optionalKey(Schema.Literal("subpath-namespace-import")),
});

export type ManifestNode = {
  readonly message?: string;
  // Carry policy for the subtree without claiming to enumerate this folder's
  // contents. What makes incremental adoption possible — and what lets a
  // prototype cover one branch without rejecting every sibling.
  readonly partial?: boolean;
  // "This folder admits any source file; only its subfolders are enumerated."
  // A tier that is deliberately permissive about file names — the component
  // library is, by design — says so, rather than carrying a layout rule that
  // could never reject anything.
  readonly layout?: "open";
  readonly imports?: typeof Imports.Type;
  readonly importedBy?: typeof ImportedBy.Type;
  readonly members?: ReadonlyArray<typeof Members.Type>;
  // Files this node must have beside it. `{base}` is this file's name minus its
  // final extension; `../` resolves against the node's own folder.
  readonly requires?: ReadonlyArray<string>;
  // Filenames this node's `requires` does not apply to — the exemption lives on
  // the obligation it exempts, rather than as a separate more-specific key that
  // has to win a precedence contest.
  readonly requiresNot?: ReadonlyArray<string>;
  // Folder nodes only. Deny-by-default: a child matching no key is a violation.
  readonly children?: Readonly<Record<string, ManifestNode>>;
};

const ManifestNodeSchema: Schema.Codec<ManifestNode> = Schema.suspend(() =>
  Schema.Struct({
    message: Schema.optionalKey(Schema.String),
    partial: Schema.optionalKey(Schema.Boolean),
    layout: Schema.optionalKey(Schema.Literal("open")),
    imports: Schema.optionalKey(Imports),
    importedBy: Schema.optionalKey(ImportedBy),
    members: Schema.optionalKey(Schema.Array(Members)),
    requires: Schema.optionalKey(Schema.Array(Schema.String)),
    requiresNot: Schema.optionalKey(Schema.Array(Schema.String)),
    children: Schema.optionalKey(Schema.Record(Schema.String, ManifestNodeSchema)),
  }),
);

export const Manifest = Schema.Struct({
  // How an import specifier becomes a file. Every pattern below is matched
  // against a resolved path, so this is what makes the rest of the file mean
  // anything.
  resolve: ResolveConfig,
  baseline: Schema.optionalKey(Schema.String),
  // Prohibitions that hold everywhere, declared once. `not-to-spec` and the
  // "this driver lives in one package" rules are statements about the whole
  // repo, not about a tier — putting them on every tree root would be six
  // copies and a seventh forgotten.
  deny: Schema.optionalKey(Schema.Array(Denial)),
  exports: Schema.optionalKey(Schema.Array(ExportRestriction)),
  // Shorthands expanded in every glob, so a pattern reads the way the repo's own
  // imports do rather than repeating `packages/server/src` on every line.
  aliases: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  tree: Schema.Record(Schema.String, ManifestNodeSchema),
});

export type Manifest = typeof Manifest.Type;
export type ImportsSpec = typeof Imports.Type;
export type ImportedBySpec = typeof ImportedBy.Type;
export type MembersSpec = typeof Members.Type;
export type ExportRestriction = typeof ExportRestriction.Type;

export const globsOf = (globs: string | ReadonlyArray<string>): ReadonlyArray<string> =>
  typeof globs === "string" ? [globs] : globs;

const decode = Schema.decodeUnknownResult(Manifest);

export const decodeManifest = (
  configPath: string,
  input: unknown,
): Result.Result<Manifest, ConfigInvalid> =>
  Result.mapError(
    decode(input),
    (issue) => new ConfigInvalid({ configPath, detail: String(issue) }),
  );
