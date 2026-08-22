/**
 * @fileoverview A `className` or `style` passed from a screen is a design
 * decision made outside the design system: invisible to Storybook, to the a11y
 * addon, and to review, and impossible to change centrally afterwards. ADR-0015
 * bans both in `features/**` and `patterns/**` — if a primitive cannot express
 * what the screen needs, widen the primitive and prove the new variant in its
 * story.
 *
 * Prop types already reject `className` on a primitive that declares a closed
 * surface; this rule is the backstop for the case a primitive regresses to
 * spreading DOM props, which would silently reopen the door for every consumer
 * at once.
 */

const BANNED = new Set(["className", "style"]);

const nameOf = (attribute) => {
  if (attribute.name.type === "JSXIdentifier") return attribute.name.name;
  return undefined;
};

export default {
  meta: {
    type: "problem",
    docs: {
      description: "no className or style props outside the component library's primitives",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },

  create: function (context) {
    return {
      JSXAttribute(node) {
        const name = nameOf(node);
        if (name === undefined || !BANNED.has(name)) return;

        context.report({
          node,
          message: `\`${name}\` is a design decision made outside the design system — invisible to Storybook, to the a11y addon, and to review. Express it as a prop on the primitive instead, and if the primitive cannot say it, widen the primitive and prove the new variant in its story (ADR-0015).`,
        });
      },
    };
  },
};
