import { mergeConfig, type UserConfigExport } from "vitest/config";
import shared from "../../vitest.shared.ts";

const config: UserConfigExport = {};

export default mergeConfig(shared, config);
