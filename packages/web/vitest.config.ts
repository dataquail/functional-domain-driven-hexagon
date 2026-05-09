// Vitest config for @org/web. Presenter tests run against jsdom with
// React's JSX transform (esbuild's "automatic" runtime — no Vite plugin
// dependency, no Babel pipeline). The setup file mounts
// @testing-library/jest-dom matchers and registers cleanup() between
// tests. Listed in the root vitest.workspace.ts so `pnpm test` from the
// repo root picks these up alongside the server suite.

import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    target: "es2020",
  },
  // Aliases use array form so the `@org/contracts/<subpath>` regex maps
  // each subpath import to its built `.js` file. The bare-package alias
  // (`@org/contracts` → index.js) and the `@/` prefix follow the same
  // resolution as Next/Turbopack uses at runtime, so tests see the same
  // module shape the app does.
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.join(__dirname, "./$1") },
      {
        find: /^@org\/contracts$/,
        replacement: path.join(__dirname, "../contracts/build/esm/index.js"),
      },
      {
        find: /^@org\/contracts\/(.*)$/,
        replacement: path.join(__dirname, "../contracts/build/esm/$1.js"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    globals: true,
    include: ["features/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}"],
  },
});
