import * as path from "node:path";
import { configDefaults, type ViteUserConfig } from "vitest/config";

// Two mutually exclusive test modes, selected by the `TEST_INTEGRATION` env
// var (set by the `test:integration` scripts). The unit suite runs every
// `*.test.ts` EXCEPT `*.integration.test.ts` and needs no auxiliary services.
// The integration suite runs ONLY `*.integration.test.ts` and requires a real
// database — its global-setup hard-fails (never skips) when the DB is
// unconfigured or unreachable.
const runIntegration = process.env.TEST_INTEGRATION === "true";

const alias = (name: string) => {
  const target = process.env.TEST_DIST !== undefined ? "dist/dist/esm" : "src";
  const scopedName = `@org/${name}`;
  return {
    [`${scopedName}/test`]: path.join(__dirname, "packages", name, "test"),
    [`${scopedName}`]: path.join(__dirname, "packages", name, target),
  };
};

// This is a workaround, see https://github.com/vitest-dev/vitest/issues/4744
const config: ViteUserConfig = {
  esbuild: {
    target: "es2020",
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"],
  },
  test: {
    onConsoleLog: (log) => {
      console.log(log);
    },
    setupFiles: [path.join(__dirname, "setupTests.ts")],
    fakeTimers: {
      toFake: undefined,
    },
    sequence: {
      concurrent: true,
    },
    include: runIntegration
      ? ["test/**/*.integration.test.ts", "src/**/*.integration.test.ts"]
      : ["test/**/*.test.ts", "src/**/*.test.ts"],
    exclude: runIntegration
      ? [...configDefaults.exclude]
      : ["**/*.integration.test.ts", ...configDefaults.exclude],
    // A package may legitimately have tests for only one suite (e.g. @org/jobs
    // has integration tests but no unit tests), so an isolated per-package run
    // of the other suite finds zero files. Don't treat that as a failure — the
    // integration global-setup, not an empty file set, is what enforces "fail,
    // don't skip" when the DB is missing.
    passWithNoTests: true,
    alias: {
      ...alias("cli"),
      ...alias("contracts"),
      ...alias("database"),
      ...alias("jobs"),
      ...alias("server"),
    },
  },
};

export default config;
