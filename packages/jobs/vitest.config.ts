import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared";

const config: UserConfigExport = {
  test: {
    alias: {
      "@/": path.join(import.meta.dirname, "src") + "/",
    },
    // Mirrors packages/server: integration tests share one Postgres DB and
    // must serialize. Even with only one current job, keep the same shape so
    // a second integration test added later doesn't quietly race.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: [path.join(import.meta.dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
