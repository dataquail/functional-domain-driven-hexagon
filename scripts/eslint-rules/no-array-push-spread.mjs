/**
 * @fileoverview `arr.push(...items)` passes every element as a separate
 * argument, so a large `items` overflows the call-stack argument limit and
 * throws at runtime on exactly the inputs that are hardest to reproduce. Build
 * the array instead.
 *
 * Replaces the `Array.push` spread arm of the project's `no-restricted-syntax`
 * config, which oxlint does not implement.
 */

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Do not use spread arguments in Array.push",
      category: "Possible Errors",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== "MemberExpression" ||
          node.callee.property.type !== "Identifier" ||
          node.callee.property.name !== "push"
        ) {
          return;
        }

        for (const argument of node.arguments) {
          if (argument.type === "SpreadElement") {
            context.report({
              node: argument,
              message: "Do not use spread arguments in Array.push",
            });
          }
        }
      },
    };
  },
};
