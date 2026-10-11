// ESLint lints only the markup of Svelte components. oxlint lints their script
// blocks and every other file; it cannot see a template, so the library's
// template rules (ADR-0015) live here (ADR-0036).
import tsParser from "@typescript-eslint/parser";
import svelte from "eslint-plugin-svelte";

const WIDEN =
  " A screen must not reach for a raw DOM element — if the primitive cannot express what you need, widen it and prove the new variant in its story (ADR-0015).";

const PRIMITIVES = "@org/components-svelte/primitives";

const FORBIDDEN_ELEMENTS = [
  [["div"], `Use Stack (layout) or Surface (a bordered/tinted region) from ${PRIMITIVES} instead.`],
  [["span"], `Use Text from ${PRIMITIVES}/text.svelte (use \`as="span"\`) instead.`],
  [["p"], `Use Text from ${PRIMITIVES}/text.svelte instead.`],
  [["h1", "h2", "h3", "h4"], `Use Heading from ${PRIMITIVES}/heading.svelte instead.`],
  [["ul"], `Use List from ${PRIMITIVES}/list instead.`],
  [["ol"], `Use List from ${PRIMITIVES}/list (use \`as="ol"\`) instead.`],
  [["li"], `Use List.Item from ${PRIMITIVES}/list instead.`],
  [["nav"], `Use Nav from ${PRIMITIVES}/nav.svelte instead.`],
  [
    ["a"],
    `Use Link from ${PRIMITIVES}/link.svelte (use \`external\` for a full page load) instead.`,
  ],
  [["button"], `Use Button from ${PRIMITIVES}/button.svelte instead.`],
  [["input"], `Use Input from ${PRIMITIVES}/input.svelte instead.`],
  [["label"], `Use Label from ${PRIMITIVES}/label.svelte instead.`],
  [["select"], `Use Select from ${PRIMITIVES}/select.svelte instead.`],
  [["form"], `Use Form from ${PRIMITIVES}/form instead.`],
  [["section"], `Use Stack or Surface from ${PRIMITIVES} (both take \`as="section"\`) instead.`],
  [["header"], `Use Stack or Surface from ${PRIMITIVES} (both take \`as="header"\`) instead.`],
  [["footer"], `Use Stack or Surface from ${PRIMITIVES} (both take \`as="footer"\`) instead.`],
  [["main"], `Use Container from ${PRIMITIVES}/container.svelte (\`as="main"\`) instead.`],
  [
    ["table", "img"],
    `Use no primitive yet — add one to ${PRIMITIVES} and prove it in a story instead.`,
  ],
].map(([elements, message]) => ({ elements, message: message + WIDEN }));

const NO_PAINT =
  "A class or a style handed to an element from a screen is a design decision made outside the design system. Use the primitive's closed props; if it cannot express what you need, widen it and prove the new variant in its story (ADR-0015).";

export default [
  ...svelte.configs.base,
  {
    files: ["packages/**/*.svelte"],
    languageOptions: {
      parserOptions: { parser: tsParser, extraFileExtensions: [".svelte"] },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  {
    // A screen composes primitives; it never paints a raw element itself.
    files: ["packages/components-svelte/patterns/**/*.svelte"],
    ignores: ["**/*.stories.svelte"],
    rules: {
      "svelte/no-restricted-html-elements": ["error", ...FORBIDDEN_ELEMENTS],
      "svelte/no-inline-styles": ["error", { allowTransitions: false }],
      "no-restricted-syntax": [
        "error",
        { selector: "SvelteAttribute[key.name='class']", message: NO_PAINT },
        { selector: "SvelteAttribute[key.name='className']", message: NO_PAINT },
        { selector: "SvelteAttribute[key.name='style']", message: NO_PAINT },
        { selector: "SvelteDirective[kind='Class']", message: NO_PAINT },
      ],
    },
  },
];
