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
    // Projects are listed explicitly so packages/acceptance/ (Playwright) isn't
    // auto-discovered and its `*.spec.ts` files aren't loaded as Vitest tests.
    // Acceptance specs run via `pnpm test:acceptance`.
    projects: [
      "packages/components",
      "packages/contracts",
      "packages/database",
      "packages/identity",
      "packages/infra",
      "packages/jobs",
      "packages/server",
      "packages/web",
    ],
    coverage: {
      provider: "v8",
      reporter: isMergedRun ? ["text-summary", "html", "lcov", "json-summary"] : ["text-summary"],
      // Only the packages that carry a Vitest suite. A package whose tests live
      // at another tier (@org/acceptance) or that
      // has none yet (@org/cli, @org/mcp, @org/api-client) would report 0% and
      // turn the gate into noise instead of signal.
      include: [
        "packages/components/{primitives,patterns,providers}/**/*.{ts,svelte}",
        "packages/contracts/src/**/*.ts",
        "packages/database/src/**/*.ts",
        "packages/identity/src/**/*.ts",
        "packages/infra/src/**/*.ts",
        "packages/jobs/src/**/*.ts",
        "packages/server/src/**/*.{ts,tsx}",
        // Routes are framework surface, covered by acceptance.
        "packages/web/{features,services}/**/*.{ts,svelte}",
        "packages/web/src/{hooks.server.ts,lib/**/*.ts}",
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "**/*.test.{ts,tsx}",
        "**/*.stories.svelte",
        "**/test-utils/**",
        "**/test/**",
        // Test doubles: production-graph files that only a test constructs.
        // Counting them credits the number with code no user ever runs.
        "**/*-fake.ts",
        // Process entrypoints. Every Vitest suite builds its own runtime from
        // the same layers, so these run only under `pnpm dev`, the deployed
        // process, or the Playwright acceptance tier.
        "packages/server/src/platform/worker/main.ts",
        "packages/database/src/scripts/**",
        // Resource declarations: only the Alchemy engine evaluates them, under
        // `alchemy dev` or a deploy.
        "packages/infra/src/stack/**",
        // Worker entrypoints run in workerd; `pnpm test:workers` is their test.
        "packages/infra/src/platform/worker/**",
        "packages/identity/src/platform/worker/**",
        "packages/identity/src/scripts/**",
      ],
      // A ratchet, not an aspiration: each floor sits a couple of points under
      // what the merged suites actually reach today. Raise them when coverage
      // rises; never lower one to make a red build green. The per-package
      // floors exist so a gain in one package cannot mask a rot in another.
      thresholds: isMergedRun
        ? {
            statements: 91,
            branches: 81,
            functions: 88,
            lines: 91,
            "packages/server/src/**": {
              statements: 90,
              branches: 75,
              functions: 85,
              lines: 90,
            },
            "packages/database/src/**": {
              statements: 54,
              branches: 87,
              functions: 44,
              lines: 53,
            },
            "packages/web/**": {
              statements: 90,
              branches: 86,
              functions: 87,
              lines: 90,
            },
            "packages/components/**": {
              statements: 97,
              branches: 91,
              functions: 95,
              lines: 97,
            },
            "packages/contracts/src/**": { statements: 95, lines: 95 },
            "packages/jobs/src/**": { statements: 80, lines: 80 },
          }
        : undefined,
    },
  },
});
