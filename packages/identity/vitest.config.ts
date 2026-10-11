import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared.js";

const config: UserConfigExport = {
  test: {
    // The integration tests share one identity database and truncate between cases.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: [path.join(__dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
