/**
 * @fileoverview A default export has no canonical name, so every importer is
 * free to invent one and the symbol becomes ungreppable. Named exports keep one
 * name from declaration to call site.
 *
 * Replaces the `ExportDefaultDeclaration` arm of the project's
 * `no-restricted-syntax` config, which oxlint does not implement. Framework
 * conventions that *require* a default export (Next.js route files, Storybook
 * stories, Playwright config, vitest `globalSetup`) turn this rule off by path
 * in the lint config, the same way they did before.
 */

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Prefer named exports over default exports",
      category: "Stylistic Issues",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, message: "Prefer named exports" });
      },
    };
  },
};
