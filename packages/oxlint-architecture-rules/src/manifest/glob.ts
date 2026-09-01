// The manifest is meant to read like a filesystem, so its patterns are globs
// rather than the regexes the rule IR speaks. This is the one translation.
//
//   *          one path segment, or part of one
//   **         any number of segments
//   /**        "…or nothing" — `a/**` matches `a` itself as well as `a/b/c`
//   {name}     a named capture of one segment when it appears in a tree key;
//              elsewhere, a back-reference to the ancestor that declared it
//   [A-Z]      a character class, passed through as written — the one place a
//              pattern needs to say something about a single character
//
// Everything else is literal, including the dots that make up a stereotype.

const ESCAPE = /[.+^$()|[\]\\]/g;

// Split on the tokens first so `**` is not read as two `*`s, `{name}`'s braces
// are not escaped, and a character class keeps its brackets.
const TOKEN_SOURCE = "\\[\\^?[^\\]]+\\]|\\{[a-zA-Z][a-zA-Z0-9]*\\}|\\*\\*|\\*|\\?";

export type CaptureIndex = Readonly<Record<string, number>>;

const escapeLiteral = (value: string): string => value.replace(ESCAPE, "\\$&");

const TOKENS = new RegExp(`(${TOKEN_SOURCE})`, "g");

export type GlobCompilation = {
  readonly source: string;
  readonly captures: CaptureIndex;
};

// `declaring` compiles `{name}` to a new capture group and records its position;
// otherwise `{name}` becomes a `$n` back-reference to the group an ancestor
// declared, which is what the rule IR substitutes at match time.
export const globToRegexSource = (
  glob: string,
  captures: CaptureIndex,
  options: { readonly declaring: boolean; readonly nextGroup: number },
): GlobCompilation => {
  const declared: Record<string, number> = { ...captures };
  let group = options.nextGroup;
  let out = "";

  for (const part of glob.split(TOKENS)) {
    if (part === "") continue;

    if (part === "**") {
      out += ".*";
      continue;
    }
    if (part === "*") {
      out += "[^/]*";
      continue;
    }
    if (part === "?") {
      out += "[^/]";
      continue;
    }

    // A character class is the one construct that passes through as written.
    if (part.startsWith("[") && part.endsWith("]")) {
      out += part;
      continue;
    }

    const capture = /^\{([a-zA-Z][a-zA-Z0-9]*)\}$/.exec(part);
    if (capture !== null) {
      const name = capture[1] ?? "";
      if (options.declaring && declared[name] === undefined) {
        declared[name] = group;
        out += "([^/]+)";
        group += 1;
      } else {
        const index = declared[name];
        if (index === undefined) {
          throw new Error(
            `pattern "${glob}" references {${name}}, which no ancestor path declares`,
          );
        }
        out += `$${String(index)}`;
      }
      continue;
    }

    out += escapeLiteral(part);
  }

  // `a/**` should match `a` itself, not just its descendants.
  return { source: out.replace(/\/\.\*$/, "(/.*)?"), captures: declared };
};

export const anchored = (source: string): string => `^${source}$`;

export const prefixed = (source: string): string => `^${source}`;
