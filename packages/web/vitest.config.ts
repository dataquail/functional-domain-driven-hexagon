import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

import { webSvelteAliases } from "./aliases";

// Kit's own plugin resolves the project from process.cwd(), which is the repo
// root in a workspace run, so tests compile components with the plain Svelte
// plugin, and `$app/*` resolves to stubs under test/kit/ that a test mocks.
export default defineConfig({
  plugins: [svelte({ configFile: false }), svelteTesting()],
  resolve: {
    alias: [
      ...webSvelteAliases,
      {
        find: /^\$app\/(.*)$/,
        replacement: `${decodeURIComponent(new URL("./test/kit/", import.meta.url).pathname)}$1.ts`,
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: [
      "features/**/*.test.ts",
      "services/**/*.test.ts",
      "src/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
});
