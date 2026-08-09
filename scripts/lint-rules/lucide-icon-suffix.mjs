/**
 * @fileoverview lucide-react exports bare nouns (`Clock`, `Check`), which
 * collide with domain and component identifiers at the import site. ADR-0015
 * routes icons through `primitives/icon/icons.ts`, and the `Icon` suffix is what
 * keeps that wrapper's imports unambiguous.
 *
 * Replaces the lucide-react arm of the project's `no-restricted-syntax` config,
 * which oxlint does not implement.
 */

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "lucide-react imports must end with 'Icon'",
      category: "Stylistic Issues",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "lucide-react") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.imported.name.endsWith("Icon")) {
            continue;
          }

          context.report({
            node: specifier,
            message: `Lucide imports must end with 'Icon' (e.g., 'ClockIcon' instead of '${specifier.imported.name}')`,
          });
        }
      },
    };
  },
};
