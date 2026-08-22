/**
 * @fileoverview A View's whole contract is "given these atom values, render
 * this; on this interaction, write that". `useState`, `useEffect`, `useReducer`
 * and friends put state and behaviour somewhere no test can reach without a
 * renderer — which is exactly the coupling ADR-0026's MVVM layering exists to
 * remove. State belongs in the ViewModel as an atom.
 *
 * The allowlist is the atom-React bindings plus the two hooks that carry no
 * state of their own (`useId`, `useCallback` — the latter only wraps a handler
 * that already delegates). Everything else in `use*` position is a finding.
 */

const ALLOWED = new Set([
  // The bridge between the atom graph and React.
  "useAtom",
  "useAtomValue",
  "useAtomSet",
  "useAtomSuspense",
  "useAtomRefresh",
  "useAtomSubscribe",
  "useAtomMount",
  "useAtomInitialValues",
  // Stateless: an SSR-safe unique id, and a memo over a delegating handler.
  "useId",
  "useCallback",
]);

const isHookName = (name) =>
  typeof name === "string" &&
  name.length > 3 &&
  name.startsWith("use") &&
  name[3] === name[3].toUpperCase();

const calleeName = (callee) => {
  if (callee.type === "Identifier") return callee.name;
  if (callee.type === "MemberExpression" && callee.property.type === "Identifier") {
    return callee.property.name;
  }
  return undefined;
};

export default {
  meta: {
    type: "problem",
    docs: {
      description: "views may only call the atom-React bindings, not stateful React hooks",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (!isHookName(name) || ALLOWED.has(name)) return;

        context.report({
          node,
          message: `\`${name}\` puts state or behaviour in the View, where it can only be tested through a renderer. Move it to the sibling *.view-model.ts as an atom and read it here with useAtomValue/useAtomSet (ADR-0026).`,
        });
      },
    };
  },
};
