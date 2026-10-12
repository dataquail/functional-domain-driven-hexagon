const PACKAGE_ROOT = decodeURIComponent(new URL("./", import.meta.url).pathname);
const CONTRACTS_BUILD = decodeURIComponent(
  new URL("../contracts/build/esm/", import.meta.url).pathname,
);

// `@/` is the package root, as in @org/web, so a ViewModel or a Model file moves
// between the two renderers without an edit. Contracts resolve through their
// built ESM, the shape the runtime loads.
export const webSvelteAliases = [
  { find: /^@\/(.*)$/, replacement: `${PACKAGE_ROOT}$1` },
  { find: /^@org\/contracts$/, replacement: `${CONTRACTS_BUILD}index.js` },
  { find: /^@org\/contracts\/(.*)$/, replacement: `${CONTRACTS_BUILD}$1.js` },
];
