import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared.js";

const config: UserConfigExport = {
  test: {
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
    },
    // Integration tests in this package share one Postgres DB and truncate
    // between cases, so two test files running in parallel would race on the
    // same tables. Serialize at the file level.
    fileParallelism: false,
    sequence: { concurrent: false },
    // Apply migrations once before any test file loads. Avoids races between
    // test files that each call runMigrations in beforeAll, which would
    // otherwise destructively reset the schema mid-suite.
    globalSetup: [path.join(import.meta.dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
