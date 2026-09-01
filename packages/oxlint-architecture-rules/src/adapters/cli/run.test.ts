import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadPolicy } from "../oxlint/config-loader.js";
import { collectFindings } from "./run.js";

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
