import process from "node:process";

import { DEFAULT_OUT_DIR, readCli, runGenerator } from "../lib/diagram/generator.mjs";
import { generator as packages } from "./packages.mjs";
import { generator as serverHexagon } from "./server-hexagon.mjs";
import { generator as serverModule } from "./server-module.mjs";
import { generator as serverModules } from "./server-modules.mjs";
import { generator as serverUseCase } from "./server-usecase.mjs";
import { generator as webFeature } from "./web-feature.mjs";
import { generator as webOverview } from "./web-overview.mjs";

const GENERATORS = [
  packages,
  serverModules,
  serverHexagon,
  serverUseCase,
  serverModule,
  webOverview,
  webFeature,
];

const cli = readCli();

if (cli.has("help")) {
  process.stdout.write(`
diagrams — render the architecture from the code, as mermaid

  node scripts/diagrams/index.mjs [--only <name,name>] [--out-dir <path>]
  node scripts/diagrams/<name>.mjs --help     per-generator options

generators:
${GENERATORS.map((generator) => `  ${generator.name.padEnd(16)}${generator.describe}`).join("\n")}

Output defaults to ${DEFAULT_OUT_DIR}/<slug>.mmd (gitignored). Run a generator
directly for stdout plus a mermaid.live URL.

`);
  process.exit(0);
}

const only = cli.flag("only");
const selected =
  only === undefined
    ? GENERATORS
    : GENERATORS.filter((generator) => only.split(",").includes(generator.name));

if (selected.length === 0) {
  process.stderr.write(`diagrams: --only matched no generator\n`);
  process.exit(1);
}

const argv = [...cli.argv, "--no-link"];
if (cli.flag("out-dir") === undefined) argv.push("--out-dir", DEFAULT_OUT_DIR);

const written = [];
for (const generator of selected) {
  // A module's file-level import graph mostly redraws what the folder layout
  // already guarantees; its one real use is showing a forbidden edge, so the
  // default is the folder view and the file view is opt-in.
  const options =
    generator === serverModule && !cli.argv.includes("--granularity")
      ? [...argv, "--granularity", "folder"]
      : argv;
  written.push(...(await runGenerator(generator, options)));
}

process.stderr.write(`\n${written.length} diagrams written:\n`);
for (const file of written.sort()) process.stderr.write(`  ${file}\n`);
