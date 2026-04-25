/* eslint-disable */
/**
 * @fileoverview Enforce path imports for Effect modules instead of namespace imports
 */

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

export default {
  meta: {
    docs: {
      description: "Enforce path imports for Effect modules instead of namespace imports",
      category: "Best Practices",
      recommended: true,
    },
    fixable: "code",
    schema: [],
  },

  create: function (context) {
    const effectPackages = [
      "effect",
      "@effect/platform",
      "@effect/rpc",
      "@effect/sql",
      "@effect/platform-browser",
      "@effect/platform-node",
    ];

    return {
      ImportDeclaration(node) {
        const sourceValue = node.source.value;

        if (!effectPackages.includes(sourceValue)) {
          return;
        }

        // Check for named imports (not namespace imports)
        const namedImports = node.specifiers.filter(
          (specifier) => specifier.type === "ImportSpecifier",
        );

        if (namedImports.length === 0) {
          return;
        }

        // If we have named imports, report the issue on the entire import declaration
        context.report({
          node,
          message: `Use path imports instead of named imports from '${sourceValue}'`,
          fix(fixer) {
            // If all specifiers are named imports, replace the entire declaration
            if (namedImports.length === node.specifiers.length) {
              const newImports = namedImports
                .map((specifier) => {
                  const importedName = specifier.imported.name;
                  const localName = specifier.local.name;
                  return `import * as ${localName} from "${sourceValue}/${importedName}";`;
                })
                .join("\n");

              return fixer.replaceText(node, newImports);
            }

            // If there are mixed imports (named and namespace), handle them separately
            else {
              const fixes = [];

              // Create new import statements for each named import
              const newImports = namedImports
                .map((specifier) => {
                  const importedName = specifier.imported.name;
                  const localName = specifier.local.name;
                  return `import * as ${localName} from "${sourceValue}/${importedName}";`;
                })
                .join("\n");

              // Add the new imports after the current import
              fixes.push(fixer.insertTextAfter(node, "\n" + newImports));

              // Remove all named imports from the original declaration
              for (const specifier of namedImports) {
                fixes.push(fixer.remove(specifier));

                // Handle commas
                const specifierIndex = node.specifiers.indexOf(specifier);

                // If this is not the last specifier and there's a comma after it
                if (specifierIndex < node.specifiers.length - 1) {
                  const tokenAfter = context.getTokenAfter(specifier);
                  if (tokenAfter.value === ",") {
                    fixes.push(fixer.remove(tokenAfter));
                  }
                }
                // If this is not the first specifier and there's a comma before it
                else if (specifierIndex > 0) {
                  const tokenBefore = context.getTokenBefore(specifier);
                  if (tokenBefore.value === ",") {
                    fixes.push(fixer.remove(tokenBefore));
                  }
                }
              }

              return fixes;
            }
          },
        });
      },
    };
  },
};
