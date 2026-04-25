import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared.js";

const config: UserConfigExport = {
  test: {
    alias: {
      "@/": path.join(__dirname, "src") + "/",
    },
    // Integration tests in this package share one Postgres DB and truncate
    // between cases, so two test files running in parallel would race on the
    // same tables. Serialize at the file level.
    fileParallelism: false,
    // Override the global `sequence.concurrent: true` from vitest.shared.ts —
    // integration tests share one Postgres DB and truncate between cases, so
    // tests in different files MUST run sequentially. Workspace mode in 2.1
    // does not always honour fileParallelism alone, so also force a single
    // worker via the pool options.
    sequence: { concurrent: false },
    poolOptions: {
      forks: { singleFork: true },
      threads: { singleThread: true },
    },
    // Apply migrations once before any test file loads. Avoids races between
    // test files that each call runMigrations in beforeAll, which would
    // otherwise destructively reset the schema mid-suite.
    globalSetup: [path.join(__dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
