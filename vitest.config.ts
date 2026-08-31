import { coverageConfigDefaults, defineConfig } from "vitest/config";

// Coverage is a ROOT-level concern in Vitest workspace mode: a project config's
// `test.coverage` is ignored, and a per-package run would drop every file
// outside that package's own root — attributing @org/contracts and
// @org/database to nothing even though the server suites are what exercise
// them. So every coverage run goes through this config (`pnpm test:coverage:*`)
// as a root workspace run, writing a blob report that `pnpm coverage:merge`
// folds into one number.
//
// Only the merged run gates. No single suite sees all the code — HTTP endpoints
// are reachable only from the integration suite, command handlers only from the
// unit suite — so thresholds checked on one blob run would fail on code the
// other run covers.
const isMergedRun = process.argv.some((arg) => arg.startsWith("--merge-reports"));

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: isMergedRun ? ["text-summary", "html", "lcov", "json-summary"] : ["text-summary"],
      // Only the packages that carry a Vitest suite. A package whose tests live
      // at another tier (@org/acceptance, @org/components' Storybook) or that
      // has none yet (@org/cli, @org/mcp, @org/api-client) would report 0% and
      // turn the gate into noise instead of signal.
      include: [
        "packages/contracts/src/**/*.ts",
        "packages/database/src/**/*.ts",
        "packages/jobs/src/**/*.ts",
        "packages/server/src/**/*.{ts,tsx}",
        "packages/web/features/**/*.{ts,tsx}",
        "packages/web/services/**/*.{ts,tsx}",
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/*.test.{ts,tsx}",
        "**/test-utils/**",
        "**/test/**",
        // Test doubles: production-graph files that only a test constructs.
        // Counting them credits the number with code no user ever runs.
        "**/*-fake.ts",
        // Process entrypoints. Every Vitest suite builds its own runtime from
        // the same layers, so these run only under `pnpm dev`, the deployed
        // process, or the Playwright acceptance tier.
        "packages/server/src/server.ts",
        "packages/jobs/src/main.ts",
        "packages/database/src/scripts/**",
        // `import "server-only"` — unloadable in the jsdom Model tier, so no
        // Vitest suite can reach them at all (ADR-0019, ADR-0026).
        "packages/web/**/*.server.ts",
      ],
      // A ratchet, not an aspiration: each floor sits a couple of points under
      // what the merged suites actually reach today. Raise them when coverage
      // rises; never lower one to make a red build green. The per-package
      // floors exist so a gain in one package cannot mask a rot in another.
      thresholds: isMergedRun
        ? {
            statements: 90,
            branches: 95,
            functions: 80,
            lines: 90,
            "packages/server/src/**": {
              statements: 92,
              branches: 95,
              functions: 85,
              lines: 92,
            },
            "packages/web/{features,services}/**": {
              statements: 80,
              branches: 95,
              functions: 67,
              lines: 80,
            },
            "packages/database/src/**": {
              statements: 77,
              branches: 92,
              functions: 64,
              lines: 77,
            },
            "packages/contracts/src/**": { statements: 95, lines: 95 },
            "packages/jobs/src/**": { statements: 80, lines: 80 },
          }
        : undefined,
    },
  },
});
