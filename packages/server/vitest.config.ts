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
  },
};

export default mergeConfig(shared, config);
