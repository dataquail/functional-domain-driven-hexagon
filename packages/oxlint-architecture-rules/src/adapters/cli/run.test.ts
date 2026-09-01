import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadPolicy } from "../oxlint/config-loader.js";
import { check, type CliFailure, collectFindings, explain, run, writeBaseline } from "./run.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../.tmp-cli-tests");

// A tiny repository with a policy of its own, so the CLI is exercised end to end
// — walker, parser, resolver, all four evaluators — without asserting anything
// about this repository's own code.
const MANIFEST = `export default {
  resolve: { scopes: [{ files: "", tsconfig: "tsconfig.json" }], unresolved: "off" },
  exports: [
    {
      name: "no-factories",
      message: "A factory is built at a composition root.",
      module: "lib/**",
      symbols: ["makeBus"],
    },
  ],
  tree: {
    "src/": {
      message: "src/ admits a port and a view.",
      imports: {
        message: "src/ may reach only itself.",
        allow: ["src/**"],
      },
      children: {
        "*.repository.ts": {
          message: "A port needs its adapter.",
          requires: ["{base}-live.ts"],
          members: [
            {
              message: 'Port method "{name}" is not in the vocabulary.',
              subject: "type-members",
              in: "*RepositoryShape",
              allow: ["findOne"],
            },
          ],
        },
        "*.view.tsx": {
          members: [
            {
              message: "\`{name}\` puts state in the View.",
              subject: "calls",
              match: "use[A-Z]*",
              allow: ["useAtomValue"],
            },
          ],
        },
      },
    },
  },
};
`;

const write = (file: string, source: string) => {
  const at = path.join(repoRoot, file);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, source);
};

beforeAll(() => {
  mkdirSync(repoRoot, { recursive: true });
  write("architecture.config.mjs", MANIFEST);
  write("tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: "." } }));
  // imports: reaches outside `src/`.  exports: names a restricted factory.
  // members: a keyed finder, and a stateful hook.  structure: no `-live.ts`.
  write(
    "src/thing.repository.ts",
    'import { makeBus } from "../lib/bus.ts";\nexport type ThingRepositoryShape = { findOneById: () => void };\nexport const x = makeBus;\n',
  );
  write("src/thing.view.tsx", "export const V = () => useState(0);\n");
  write("lib/bus.ts", "export const makeBus = 1;\n");
});

afterAll(() => {
  rmSync(repoRoot, { force: true, recursive: true });
});

describe("collectFindings", () => {
  it("reports every family — a gap in one is a family the CLI silently skips", async () => {
    const policy = await loadPolicy(repoRoot);
    const findings = collectFindings(policy, ["src", "lib"]);

    expect([...new Set(findings.violations.map((one) => one.kind))].sort()).toEqual([
      "export",
      "import",
      "member",
      "structure",
    ]);
  });

  it("names the rule behind each one", async () => {
    const policy = await loadPolicy(repoRoot);
    const names = collectFindings(policy, ["src", "lib"]).violations.map((one) => one.ruleName);

    expect(names).toEqual(
      expect.arrayContaining([
        "src/imports",
        "no-factories",
        "src/*.repository.ts/members-0",
        "src/*.view.tsx/members-0",
        "src/*.repository.ts/requires",
      ]),
    );
  });

  it("counts the files it walked", async () => {
    const policy = await loadPolicy(repoRoot);
    expect(collectFindings(policy, ["src", "lib"]).files).toBe(3);
  });
});

// The suite runs tests concurrently (`sequence.concurrent`), and both of these
// are process-wide: one stdout descriptor, and one baseline file per fixture
// repository. The describes below are therefore sequential.
const captureReport = async (effect: Effect.Effect<void, CliFailure>) => {
  const lines: Array<string> = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: string) => {
    lines.push(String(chunk));
    return true;
  };
  try {
    const exit = await Effect.runPromiseExit(effect);
    return { exit, output: lines.join("") };
  } finally {
    process.stdout.write = original;
  }
};

describe.sequential("check", () => {
  it("names each violation and counts the files it walked", async () => {
    const { exit, output } = await captureReport(check(await loadPolicy(repoRoot), ["src", "lib"]));

    expect(Exit.isFailure(exit)).toBe(true);
    expect(output).toContain("src/thing.repository.ts");
    expect(output).toContain("3 files, ");
  });

  it("refuses to write a baseline when the policy declares nowhere to put one", async () => {
    const { exit } = await captureReport(writeBaseline(await loadPolicy(repoRoot), ["src"]));

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe.sequential("explain", () => {
  it("prints the allowlist, the prohibitions, the folder rule, and the siblings owed", async () => {
    const { output } = await captureReport(
      explain(await loadPolicy(repoRoot), "src/thing.repository.ts"),
    );

    expect(output).toContain("may import:");
    expect(output).toContain("src/imports");
    expect(output).toContain("lives in:");
    expect(output).toContain("owes:");
    expect(output).toContain("src/thing.repository-live.ts");
  });

  it("says so when no tier above the file states an allowlist", async () => {
    const { output } = await captureReport(explain(await loadPolicy(repoRoot), "lib/bus.ts"));

    expect(output).toContain("no tier above this file states an allowlist");
  });
});

// `run` is the dispatcher: its job is picking the command and the roots, which
// is what these assert. The reporting each command does is covered above —
// Vitest re-patches `process.stdout.write` across an await, so output written
// after `run`'s own async config load lands in its capture rather than ours.
describe.sequential("run", () => {
  it("defaults to check", async () => {
    const { exit } = await captureReport(run(repoRoot, ["check", "src", "lib"]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("routes explain", async () => {
    const { exit } = await captureReport(run(repoRoot, ["explain", "src/thing.repository.ts"]));

    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it("refuses explain without a file", async () => {
    const { exit } = await captureReport(run(repoRoot, ["explain"]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("refuses a command it does not have", async () => {
    const { exit } = await captureReport(run(repoRoot, ["lint"]));

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

// The baseline is one mutable file, so its tests get a repository of their own
// rather than racing the ones above for the same path.
const baselineRoot = path.resolve(here, "../../../.tmp-cli-baseline-tests");
const baselineAt = path.join(baselineRoot, ".architecture-baseline.json");

const writeIn = (root: string, file: string, source: string) => {
  const at = path.join(root, file);
  mkdirSync(path.dirname(at), { recursive: true });
  writeFileSync(at, source);
};

beforeAll(() => {
  mkdirSync(baselineRoot, { recursive: true });
  writeIn(
    baselineRoot,
    "architecture.config.mjs",
    MANIFEST.replace("tree: {", 'baseline: ".architecture-baseline.json",\n  tree: {'),
  );
  writeIn(baselineRoot, "tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: "." } }));
  writeIn(baselineRoot, "src/thing.repository.ts", 'import { makeBus } from "../lib/bus.ts";\n');
  writeIn(baselineRoot, "lib/bus.ts", "export const makeBus = 1;\n");
});

afterAll(() => {
  rmSync(baselineRoot, { force: true, recursive: true });
});

describe.sequential("baseline", () => {
  it("records every violation as a fingerprint", async () => {
    const { exit } = await captureReport(
      writeBaseline(await loadPolicy(baselineRoot), ["src", "lib"]),
    );
    const written = JSON.parse(readFileSync(baselineAt, "utf8")) as { entries: Array<string> };

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(written.entries).toEqual(
      expect.arrayContaining([
        expect.stringContaining("import|src/imports|src/thing.repository.ts"),
      ]),
    );
  });

  it("carries what it recorded, and says how many", async () => {
    const { exit, output } = await captureReport(
      check(await loadPolicy(baselineRoot), ["src", "lib"]),
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(output).toContain("carried by the baseline");
  });

  // The ratchet's teeth. A baseline that keeps entries the code no longer
  // produces stops being a record of debt and becomes a place to hide.
  it("fails on an entry that no longer fires, and says how to prune it", async () => {
    writeFileSync(
      baselineAt,
      JSON.stringify({ version: 1, entries: ["import|src/imports|src/gone.ts|lib/bus.ts"] }),
    );
    const { exit, output } = await captureReport(
      check(await loadPolicy(baselineRoot), ["src", "lib"]),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    expect(output).toContain("no longer fire");
    expect(output).toContain("architecture baseline");
  });
});

describe.sequential("resolution and a damaged baseline", () => {
  it("reports an unresolvable specifier when the policy asks it to", async () => {
    const root = path.resolve(here, "../../../.tmp-cli-unresolved");
    writeIn(
      root,
      "architecture.config.mjs",
      MANIFEST.replace('unresolved: "off"', 'unresolved: "error"'),
    );
    writeIn(root, "tsconfig.json", JSON.stringify({ compilerOptions: { baseUrl: "." } }));
    writeIn(root, "src/thing.repository.ts", 'import { x } from "nowhere-at-all";\n');

    const { exit, output } = await captureReport(check(await loadPolicy(root), ["src"]));
    rmSync(root, { force: true, recursive: true });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(output).toContain("unresolved:");
  });

  // A baseline nobody can parse carries nothing, which is the safe direction:
  // every violation reports.
  it("carries nothing when the baseline file is not readable as JSON", async () => {
    writeFileSync(baselineAt, "{ not json");
    const { exit, output } = await captureReport(
      check(await loadPolicy(baselineRoot), ["src", "lib"]),
    );
    rmSync(baselineAt, { force: true });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(output).not.toContain("carried by the baseline");
  });

  it("routes the baseline command", async () => {
    const { exit } = await captureReport(run(baselineRoot, ["baseline", "src", "lib"]));
    rmSync(baselineAt, { force: true });

    expect(Exit.isSuccess(exit)).toBe(true);
  });
});
