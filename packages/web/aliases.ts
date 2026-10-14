// Vite takes absolute alias targets while it loads its config, before any Effect runtime exists.
const fromHere = (relative: string): string =>
  // oxlint-disable-next-line effect/noModulePathFacts -- Vite's config loader has no Path service to ask
  decodeURIComponent(new URL(relative, import.meta.url).pathname);

const PACKAGE_ROOT = fromHere("./");

const CONTRACTS_BUILD = fromHere("../contracts/build/esm/");

// `@/` is the package root, as in @org/web, so a ViewModel or a Model file moves
// between the two renderers without an edit. Contracts resolve through their
// built ESM, the shape the runtime loads.
export const webSvelteAliases = [
  { find: /^@\/(.*)$/, replacement: `${PACKAGE_ROOT}$1` },
  { find: /^@org\/contracts$/, replacement: `${CONTRACTS_BUILD}index.js` },
  { find: /^@org\/contracts\/(.*)$/, replacement: `${CONTRACTS_BUILD}$1.js` },
];
