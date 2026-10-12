/* eslint-disable */
/**
 * @fileoverview prevent relative imports going up more than one level (../../)
 * in packages that configure a `@/` path alias.
 *
 * The alias does not resolve to the same place in every package — server maps
 * `@/*` to `src/*`, web maps it to the package root — so the root is declared
 * per package rather than assumed to be `src`. A package absent from the map
 * has no alias for the fix to point at, so the rule must not run there: telling
 * an author to "use @/..." in a package with no such path is worse than silence.
 */

import path from "path";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

// package prefix → the directory its `@/` alias resolves to, relative to the
// package. Keep in sync with each package's tsconfig `paths`.
const ALIAS_ROOT_BY_PACKAGE = {
  "packages/server": "src",
  "packages/web": ".",
};

export default {
  meta: {
    docs: {
      description:
        "prevent relative imports going up more than one level (../../) in packages with a @/ alias",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
  },

  create: function (context) {
    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    function isExternal(name) {
      return isScoped(name) || isExternalModule(name);
    }

    const scopedRegExp = /^@[^/]+\/[^/]+/;
    function isScoped(name) {
      return scopedRegExp.test(name);
    }

    const externalModuleRegExp = /^\w/;
    function isExternalModule(name) {
      return externalModuleRegExp.test(name);
    }

    function getRelativePathDepth(importPath) {
      if (!importPath.startsWith(".")) {
        return 0;
      }
      const parts = importPath.split("/");
      let depth = 0;
      for (const part of parts) {
        if (part === "..") {
          depth++;
        } else if (part !== ".") {
          break; // Stop counting once we hit a directory/file name
        }
      }
      return depth;
    }

    const cwd = context.getCwd();

    // The package prefix governing this file, or null when the package
    // configures no `@/` alias.
    function getAliasedPackagePrefix(filename) {
      const relativeFilePath = path.relative(cwd, filename);
      return (
        Object.keys(ALIAS_ROOT_BY_PACKAGE).find((prefix) =>
          relativeFilePath.startsWith(prefix + path.sep),
        ) ?? null
      );
    }

    // The absolute directory this package's `@/` resolves to.
    function getAliasRoot(prefix) {
      return path.resolve(cwd, prefix, ALIAS_ROOT_BY_PACKAGE[prefix]);
    }

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    const assertNoDeepRelativeImport = (node, importPath) => {
      if (typeof importPath !== "string" || isExternal(importPath)) {
        return; // skip external imports and non-strings
      }

      const fileName = context.filename;

      // Only apply this rule within packages that configure the alias.
      const prefix = getAliasedPackagePrefix(fileName);
      if (prefix === null) {
        return;
      }

      const relativeDepth = getRelativePathDepth(importPath);

      // Allow './' and '../' but disallow '../../' and deeper
      if (relativeDepth > 1) {
        context.report({
          node,
          message: `Relative import "${importPath}" goes up more than one level. Use "@/..." alias instead.`,
          fix(fixer) {
            try {
              const fileDir = path.dirname(fileName);
              const aliasRoot = getAliasRoot(prefix);

              const absoluteImportPath = path.resolve(fileDir, importPath);

              // Extract the original extension, if any
              const originalExt = path.extname(importPath);

              // Calculate the path relative to the alias root
              let relativeToRoot = path.relative(aliasRoot, absoluteImportPath);

              // An import resolving outside the alias root (another package) is
              // not expressible as `@/...`. `no-relative-import-outside-package`
              // reports that case with the right advice, so leave it unfixed.
              if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
                return null;
              }

              // If there was no original extension, remove common extensions from the calculated path
              if (!originalExt) {
                relativeToRoot = relativeToRoot.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, "");
              }

              // Ensure path uses forward slashes for consistency
              relativeToRoot = relativeToRoot.replace(/\\/g, "/");

              const aliasedPath = `@/${relativeToRoot}`;
              const targetNode = node.type === "CallExpression" ? node.arguments[0] : node.source;
              return fixer.replaceText(targetNode, `'${aliasedPath}'`);
            } catch (e) {
              return null; // Don't apply fix if calculation fails
            }
          },
        });
      }
    };

    return {
      ImportDeclaration: function (node) {
        if (node.importKind === "type") {
          return; // skip type imports
        }
        assertNoDeepRelativeImport(node, node.source.value);
      },

      CallExpression: function (node) {
        // Check for require() calls
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments.length > 0 &&
          node.arguments[0].type === "Literal"
        ) {
          assertNoDeepRelativeImport(node, node.arguments[0].value);
        }
        // Optional: Check for dynamic import() expressions
        else if (
          node.callee.type === "Import" && // Check for dynamic import()
          node.arguments.length > 0 &&
          node.arguments[0].type === "Literal"
        ) {
          assertNoDeepRelativeImport(node, node.arguments[0].value);
        }
      },
    };
  },
};
