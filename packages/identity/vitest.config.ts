import * as path from "node:path";
import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared";

const config: UserConfigExport = {
  test: {
    // The integration tests share one identity database and truncate between cases.
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: [path.join(import.meta.dirname, "src/test-utils/global-setup.ts")],
  },
};

export default mergeConfig(shared, config);
