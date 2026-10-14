import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte({ configFile: false }), svelteTesting()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["{primitives,patterns,providers}/**/*.test.ts"],
  },
});
