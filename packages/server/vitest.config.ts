import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared.js";

const config: UserConfigExport = {
  // React Email templates (`infrastructure/external/*.tsx`) are transformed
  // with esbuild's automatic JSX runtime so tests can import the adapters
  // that render them without a classic `import React` in every template.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    alias: {
      "@/": path.join(__dirname, "src") + "/",
    },
    // Integration tests in this package share one Postgres DB and truncate
    // between cases, so two test files running in parallel would race on the
    // same tables. Serialize at the file level.
    fileParallelism: false,
    sequence: { concurrent: false },
    // Apply migrations once before any test file loads. Avoids races between
    // test files that each call runMigrations in beforeAll, which would
    // otherwise destructively reset the schema mid-suite.
    globalSetup: [path.join(__dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
