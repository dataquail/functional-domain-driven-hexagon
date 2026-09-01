import type {
  ExportRule,
  ImportRule,
  MemberRule,
  StructureFolder,
  StructureParity,
  StructureRoot,
} from "../domain/architecture-config.js";
import { anchored, type CaptureIndex, globToRegexSource, prefixed } from "./glob.js";
import { globsOf, type ImportsSpec, type Manifest, type ManifestNode } from "./manifest.js";

// The manifest is the authoring surface; these flat rules are the machine's.
// Lowering rather than interpreting keeps one evaluator, one probe mechanism and
// one set of semantics — the tree only decides what gets written.
export type LoweredRules = {
  readonly imports: ReadonlyArray<ImportRule>;
  readonly exports: ReadonlyArray<ExportRule>;
  readonly members: ReadonlyArray<MemberRule>;
  readonly structure: {
    readonly roots: ReadonlyArray<StructureRoot>;
    readonly folders: ReadonlyArray<StructureFolder>;
    readonly parity: ReadonlyArray<StructureParity>;
  };
};

const FOLDER_KEY = /\/$/;

// The marker an open folder's allowlist carries: it admits any name, so it has
// no layout policy to prove.
export const ANY_FILE = "^.*$";

// The `from` side of a rule that applies to every file, wherever the repository
// happens to keep its packages.
const EVERY_FILE = "";

// A key may name several patterns that share one node: the four `*-ops.ts`
// stereotypes carry identical policy, and saying it once is the point of writing
// the architecture as a tree.
const ALTERNATIVE = /\s*\|\s*/;

const isFolderKey = (key: string): boolean => FOLDER_KEY.test(key);

const stripSlash = (key: string): string => key.replace(FOLDER_KEY, "");

// Split first, then strip: `"http/ | cli/"` carries a trailing slash on every
// alternative, not only the last one.
const alternativesOf = (key: string): ReadonlyArray<string> =>
  key
    .split(ALTERNATIVE)
    .map(stripSlash)
    .filter((one) => one !== "");

const expandAliases = (glob: string, aliases: Readonly<Record<string, string>>): string => {
  for (const [alias, target] of Object.entries(aliases)) {
    if (glob === alias) return target;
    if (glob.startsWith(`${alias}/`)) return target + glob.slice(alias.length);
  }
  return glob;
};

type Frame = {
  // Regex source for this node's own path, unanchored.
  readonly pathSource: string;
  // Glob for this node's path, used to synthesise probes.
  readonly pathGlob: string;
  readonly captures: CaptureIndex;
  readonly nextGroup: number;
  // Accumulated down the tree. `reset` is the only thing that clears it.
  readonly allow: ReadonlyArray<string>;
  readonly importsMessage: string;
};

// A probe is the node's own path with its wildcards filled in, so a rule is
// proven against the shape it was written for and nobody hand-writes one.
const PROBE_WORDS = ["alpha", "beta", "gamma", "delta"];

const probePathOf = (pathGlob: string, leaf: string): string => {
  let word = 0;
  const filled = pathGlob
    .replace(/\{[a-zA-Z][a-zA-Z0-9]*\}/g, () => {
      const value = PROBE_WORDS[word % PROBE_WORDS.length] ?? "alpha";
      word += 1;
      return value;
    })
    .replace(/\*\*/g, "deep")
    .replace(/\*/g, "zz");
  if (leaf === "") return filled;
  return filled === "" ? leaf : `${filled}/${leaf}`;
};

// The probe name must satisfy the rule's own `match`, or the rule cannot report
// it and the vacuity check fires on a healthy rule.
const probeMemberName = (match: string | ReadonlyArray<string> | undefined): string => {
  if (match === undefined) return "zzProbeMember";
  const first = globsOf(match)[0] ?? "";
  return `${first
    // A character class stands for one character, so the probe uses the first
    // one it admits: `use[A-Z]*` has to be proven with `useA…`, not `use[A-Z]…`.
    .replace(/\[\^?([^\]])[^\]]*\]/g, "$1")
    .replace(/\*/g, "")}ZzProbe`;
};

type Denial = {
  readonly match: string;
  readonly matchNot: ReadonlyArray<string>;
  readonly except: ReadonlyArray<string>;
  readonly message: string;
  // A concrete path the denial matches, so its probe aims at the shape it was
  // written for rather than at one generic target for every denial.
  readonly probe: string;
};

const mergeImports = (
  frame: Frame,
  spec: ImportsSpec | undefined,
  aliases: Readonly<Record<string, string>>,
  captures: CaptureIndex,
  nextGroup: number,
): Pick<Frame, "allow" | "importsMessage"> & { readonly deny: ReadonlyArray<Denial> } => {
  if (spec === undefined)
    return { allow: frame.allow, deny: [], importsMessage: frame.importsMessage };

  const compileAllow = (glob: string): string =>
    prefixed(
      globToRegexSource(expandAliases(glob, aliases), captures, { declaring: false, nextGroup })
        .source,
    );

  const own = globsOf(spec.allow ?? []).map(compileAllow);
  const external = (spec.external ?? []).map(
    (name) => `/node_modules/${name.replace(/[.+^$()|[\]\\]/g, "\\$&")}/`,
  );
  const deny = (spec.deny ?? []).flatMap((entry) =>
    globsOf(entry.match).map((glob) => ({
      match: compileAllow(glob),
      matchNot: globsOf(entry.matchNot ?? []).map(compileAllow),
      except: globsOf(entry.except ?? []).map(compileAllow),
      message: entry.message,
      probe: probePathOf(expandAliases(glob, aliases), ""),
    })),
  );

  // `reset` drops inherited ALLOWANCES only. A prohibition always accumulates, so
  // resetting can never make a subtree quieter than its ancestors — the direction
  // a mistake here would be dangerous in.
  const dropping = spec.reset === true || spec.unrestricted === true;
  return {
    allow: dropping ? [...own, ...external] : [...frame.allow, ...own, ...external],
    // Only what this node declares. A prohibition is emitted once, over its whole
    // subtree, so descendants neither re-emit it nor can escape it — which is
    // what makes `reset` structurally unable to make a subtree quieter.
    deny,
    importsMessage: spec.message ?? frame.importsMessage,
  };
};

export const lowerManifest = (manifest: Manifest): LoweredRules => {
  const aliases = manifest.aliases ?? {};
  const imports: Array<ImportRule> = [];
  const exports: Array<ExportRule> = [];
  const members: Array<MemberRule> = [];
  const roots: Array<StructureRoot> = [];
  const folders: Array<StructureFolder> = [];
  const parity: Array<StructureParity> = [];

  const walk = (
    key: string,
    node: ManifestNode,
    parent: Frame,
    name: string,
    siblings: ReadonlyArray<string>,
  ): void => {
    const literalSiblings = siblings
      .filter((sibling) => sibling !== key)
      .flatMap(alternativesOf)
      .filter((sibling) => !/[*{]/.test(sibling));
    const alternatives = alternativesOf(key).map((one) => expandAliases(one, aliases));
    const [first = ""] = alternatives;
    if (alternatives.length > 1 && alternatives.some((one) => one.includes("{"))) {
      throw new Error(
        `key "${key}" both names several patterns and declares a capture. A capture has to come ` +
          `from one place, so give the capturing pattern its own key.`,
      );
    }
    // The probe, the path and every descendant hang off the first alternative;
    // the rest only widen what the pattern matches.
    const joinedGlob = parent.pathGlob === "" ? first : `${parent.pathGlob}/${first}`;
    const compiledFirst = globToRegexSource(first, parent.captures, {
      declaring: true,
      nextGroup: parent.nextGroup,
    });
    const compiled =
      alternatives.length === 1
        ? compiledFirst
        : {
            captures: compiledFirst.captures,
            source: `(?:${alternatives
              .map(
                (one) =>
                  globToRegexSource(one, parent.captures, {
                    declaring: false,
                    nextGroup: parent.nextGroup,
                  }).source,
              )
              .join("|")})`,
          };
    // `(?!domain-services$|ports$)` — written by the compiler, from the fact that
    // those keys are siblings of this one.
    const guarded =
      literalSiblings.length > 0 && /[*{]/.test(first)
        ? `(?!(?:${literalSiblings.map((one) => one.replace(/[.+^$()|[\]\\*?{}]/g, "\\$&")).join("|")})(?:/|$))${compiled.source}`
        : compiled.source;
    const pathSource = parent.pathSource === "" ? guarded : `${parent.pathSource}/${guarded}`;
    const nextGroup =
      parent.nextGroup +
      (Object.keys(compiled.captures).length - Object.keys(parent.captures).length);

    const merged = mergeImports(parent, node.imports, aliases, compiled.captures, nextGroup);
    const ownDenials = merged.deny;
    const frame: Frame = {
      pathSource,
      pathGlob: joinedGlob,
      captures: compiled.captures,
      nextGroup,
      allow: merged.allow,
      importsMessage: merged.importsMessage,
    };

    const isFolder = isFolderKey(key) || node.children !== undefined;
    const selfPattern = anchored(pathSource);

    const childEntries = Object.entries(node.children ?? {});
    // The nearest descendants — at any depth — that state their own import
    // policy. A folder's allowlist covers its whole subtree except these, and
    // each of them emits a rule over its own subtree in turn. Descent stops at a
    // node that overrides, because everything below it is that node's business.
    const overridingDescendants = (
      from: ManifestNode,
      atPath: string,
      atCaptures: CaptureIndex,
      atGroup: number,
    ): ReadonlyArray<string> =>
      Object.entries(from.children ?? {}).flatMap(([childKey, child]) =>
        alternativesOf(childKey).flatMap((one) => {
          // `declaring` because a folder key may itself name a capture
          // (`{subdomain}/`). The extra group is harmless in an exclusion, which
          // is matched on its own rather than substituted into.
          const childCompiled = globToRegexSource(one, atCaptures, {
            declaring: true,
            nextGroup: atGroup,
          });
          const source = `${atPath}/${childCompiled.source}`;
          const childGroup =
            atGroup + (Object.keys(childCompiled.captures).length - Object.keys(atCaptures).length);
          if (child.imports !== undefined) {
            return [isFolderKey(childKey) ? prefixed(`${source}/`) : anchored(source)];
          }
          return isFolderKey(childKey)
            ? overridingDescendants(child, source, childCompiled.captures, childGroup)
            : [];
        }),
      );

    const overridingChildren = overridingDescendants(
      node,
      pathSource,
      compiled.captures,
      nextGroup,
    );

    if (isFolder) {
      const childKeys = childEntries;
      const fileKeys = childKeys.filter(([childKey]) => !isFolderKey(childKey));
      if (node.partial !== true)
        folders.push({
          name: `${name}/layout`,
          message: node.message ?? "This folder does not admit that file.",
          probe: { path: probePathOf(joinedGlob, "zzprobe-stray.ts") },
          folder: selfPattern,
          // An open folder still CLAIMS its folder — otherwise no rule governs
          // it and the taxonomy root fires — it just admits any file name.
          files:
            node.layout === "open"
              ? [ANY_FILE]
              : fileKeys.flatMap(([childKey]) =>
                  alternativesOf(childKey).map((one) =>
                    anchored(
                      globToRegexSource(one, compiled.captures, { declaring: false, nextGroup })
                        .source,
                    ),
                  ),
                ),
        });
      const siblingKeys = childKeys.map(([childKey]) => childKey);
      for (const [childKey, child] of childKeys) {
        walk(childKey, child, frame, `${name}/${alternativesOf(childKey)[0] ?? ""}`, siblingKeys);
      }
    }

    // Outbound. One allowlist stands in for every "may not reach X" rule that
    // would otherwise be written separately and far from here.
    //
    // Import policy belongs to a folder, so it lowers once per folder — matching
    // that folder's direct children — rather than once per file kind inside it.
    // A file node emits its own only when it says something its folder did not.
    const emitsOwnImports = isFolder ? node.imports !== undefined : node.imports !== undefined;
    const scope = isFolder ? prefixed(`${pathSource}/`) : selfPattern;
    const scopeProbe = isFolder
      ? probePathOf(joinedGlob, "zzprobe.ts")
      : probePathOf(joinedGlob, "");

    const admitsEverything = frame.allow.some((pattern) => pattern === "^.*" || pattern === "^");
    const hasAllowlist = frame.allow.length > 0 && !admitsEverything;

    if (emitsOwnImports && node.imports?.unrestricted !== true && !hasAllowlist) {
      throw new Error(
        `"${name}" states an \`imports\` policy with no allowlist. If that is deliberate — the ` +
          `tier is not tightened yet and only its prohibitions apply — say \`unrestricted: true\`, ` +
          `so the gap is a sentence someone wrote rather than an omission nobody noticed.`,
      );
    }

    if (emitsOwnImports) {
      const exemptions = overridingChildren.length > 0 ? { fromNot: overridingChildren } : {};

      if (hasAllowlist) {
        imports.push({
          name: `${name}/imports`,
          message: frame.importsMessage,
          probe: { from: scopeProbe, to: "packages/zzprobe/nowhere.ts" },
          from: scope,
          ...exemptions,
          toNot: [...frame.allow],
        });
      }
    }

    // Prohibitions are emitted once, over this node's whole subtree, and carry no
    // exemptions: a node cannot opt out of an ancestor's prohibition.
    for (const [index, denial] of ownDenials.entries()) {
      imports.push({
        name: `${name}/deny-${String(index)}`,
        message: denial.message,
        probe: { from: probePathOf(joinedGlob, isFolder ? "zzprobe.ts" : ""), to: denial.probe },
        from: isFolder ? prefixed(`${pathSource}/`) : selfPattern,
        ...(denial.except.length > 0 ? { fromNot: [...denial.except] } : {}),
        to: denial.match,
        ...(denial.matchNot.length > 0 ? { toNot: [...denial.matchNot] } : {}),
      });
    }

    // Inbound. "This file is private to X" belongs beside the file, not in a
    // distant rule whose `from` side grows an exclusion for every new caller.
    if (node.importedBy !== undefined) {
      // An `importedBy` allowlist is matched against the IMPORTER, while the
      // captures on this node were declared by the TARGET's path — so a
      // `{capture}` here has nothing to resolve against and would compile to a
      // pattern that never matches, silently over-reporting. Refuse it rather
      // than emit a rule whose exemptions do not work.
      for (const allowed of globsOf(node.importedBy.allow)) {
        const referenced = allowed.match(/\{[a-zA-Z][a-zA-Z0-9]*\}/g) ?? [];
        if (referenced.length > 0) {
          throw new Error(
            `"${name}" allows ${referenced.join(", ")} in importedBy, but a capture from this ` +
              `node's own path cannot be used there: importedBy patterns are matched against the ` +
              `importing file, and ${referenced[0] ?? ""} was declared by this file's path. Use a ` +
              `wildcard (the barrel rules are what stop another module reaching in), or move the ` +
              `restriction to that importer's own node as an \`imports\` allowlist.`,
          );
        }
      }
      const asTarget = (glob: string) =>
        prefixed(
          globToRegexSource(expandAliases(glob, aliases), compiled.captures, {
            declaring: false,
            nextGroup,
          }).source,
        );
      // On a folder the restriction covers the whole subtree — "a module is
      // private" is a statement about everything under it, not about the folder
      // node itself.
      const exempt = globsOf(node.importedBy.matchNot ?? []).map((glob) =>
        anchored(
          `${pathSource}/${globToRegexSource(glob, compiled.captures, { declaring: false, nextGroup }).source}`,
        ),
      );
      imports.push({
        name: `${name}/imported-by`,
        message: node.importedBy.message,
        probe: {
          from: "packages/zzprobe/outsider.ts",
          to: probePathOf(joinedGlob, isFolder ? "zzprobe.ts" : ""),
        },
        from: EVERY_FILE,
        fromNot: globsOf(node.importedBy.allow).map(asTarget),
        to: isFolder ? prefixed(`${pathSource}/`) : selfPattern,
        ...(exempt.length > 0 ? { toNot: exempt } : {}),
      });
    }

    for (const [index, spec] of (node.members ?? []).entries()) {
      const asRegex = (globs: string | ReadonlyArray<string>) =>
        globsOf(globs).map((one) =>
          anchored(
            globToRegexSource(one, compiled.captures, { declaring: false, nextGroup }).source,
          ),
        );
      members.push({
        name: `${name}/members-${String(index)}`,
        message: spec.message,
        probe: {
          from: probePathOf(joinedGlob, ""),
          name: probeMemberName(spec.match),
          ...(spec.in === undefined ? {} : { in: "ZzProbeRepositoryShape" }),
        },
        from: selfPattern,
        subject: spec.subject,
        ...(spec.in === undefined ? {} : { in: asRegex(spec.in) }),
        ...(spec.match === undefined ? {} : { match: asRegex(spec.match) }),
        ...(spec.matchNot === undefined ? {} : { matchNot: asRegex(spec.matchNot) }),
        ...(spec.allow === undefined ? {} : { allow: asRegex(spec.allow) }),
      });
    }

    if (node.requires !== undefined && node.requires.length > 0) {
      const exempt = (node.requiresNot ?? []).map(
        (basename) =>
          `/${globToRegexSource(basename, compiled.captures, { declaring: false, nextGroup }).source}$`,
      );
      parity.push({
        name: `${name}/requires`,
        message: node.message ?? "This file needs its sibling.",
        probe: { path: probePathOf(joinedGlob, "") },
        file: selfPattern,
        ...(exempt.length > 0 ? { fileNot: exempt } : {}),
        requires: [...node.requires],
      });
    }
  };

  const emptyFrame: Frame = {
    pathSource: "",
    pathGlob: "",
    captures: {},
    nextGroup: 1,
    allow: [],
    importsMessage: "This import is not on this folder's allowlist.",
  };

  // Repo-wide prohibitions: `from` is every file, so no tier can be written
  // that escapes them.
  const globalFrame: Frame = { ...emptyFrame };
  for (const [index, denial] of mergeImports(
    globalFrame,
    { unrestricted: true, deny: manifest.deny ?? [] },
    aliases,
    {},
    1,
  ).deny.entries()) {
    imports.push({
      name: `repo/deny-${String(index)}`,
      message: denial.message,
      probe: { from: "packages/zzprobe/anywhere.ts", to: denial.probe },
      from: EVERY_FILE,
      ...(denial.except.length > 0 ? { fromNot: [...denial.except] } : {}),
      to: denial.match,
      ...(denial.matchNot.length > 0 ? { toNot: [...denial.matchNot] } : {}),
    });
  }

  for (const [key, node] of Object.entries(manifest.tree)) {
    // A taxonomy root is a region whose folders are enumerated. A key naming a
    // single file has no folders to deny, and an open tree governs every folder
    // it contains — neither has anything for a root to catch.
    if ((isFolderKey(key) || node.children !== undefined) && node.layout !== "open")
      roots.push({
        name: `${stripSlash(key)}/taxonomy`,
        message:
          node.message ??
          "This folder is not part of the taxonomy. Declare it in the manifest deliberately, or move the file into the folder that owns it.",
        probe: { path: probePathOf(expandAliases(stripSlash(key), aliases), "zzprobe/stray.ts") },
        path: prefixed(
          globToRegexSource(
            expandAliases(stripSlash(key), aliases),
            {},
            {
              declaring: true,
              nextGroup: 1,
            },
          ).source,
        ),
      });
    walk(
      key,
      node,
      emptyFrame,
      stripSlash(key)
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
      Object.keys(manifest.tree),
    );
  }

  for (const rule of manifest.exports ?? []) {
    const asPattern = (glob: string) =>
      prefixed(
        globToRegexSource(expandAliases(glob, aliases), {}, { declaring: false, nextGroup: 1 })
          .source,
      );
    exports.push({
      name: rule.name,
      message: rule.message,
      probe: {
        from: "packages/zzprobe/anywhere.ts",
        to: probePathOf(expandAliases(globsOf(rule.module)[0] ?? "", aliases), ""),
        symbol: rule.symbols?.[0] ?? "zzProbeSymbol",
      },
      from: EVERY_FILE,
      ...(rule.except === undefined ? {} : { fromNot: globsOf(rule.except).map(asPattern) }),
      to: globsOf(rule.module).map(asPattern),
      ...(rule.symbols === undefined ? {} : { symbols: [...rule.symbols] }),
      ...(rule.fix === undefined ? {} : { fix: rule.fix }),
    });
  }

  return { imports, exports, members, structure: { roots, folders, parity } };
};
