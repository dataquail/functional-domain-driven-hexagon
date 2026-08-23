import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { DEFAULT_OUT_DIR, readCli } from "../lib/diagram/generator.mjs";
import { analyse, filterGraph } from "../lib/diagram/graph.mjs";
import { toMermaid } from "../lib/diagram/mermaid.mjs";
import { repoRoot } from "../lib/diagram/program.mjs";
import { allSlugs, draw, readers } from "../lib/diagram/registry.mjs";

const cli = readCli();

if (cli.has("help")) {
  process.stdout.write(`
diagrams — render the architecture from the code, as mermaid

  node scripts/diagrams/index.mjs [--only <kind,kind>] [--out-dir <path>]
  node scripts/diagrams/<name>.mjs --help     per-generator options
  pnpm diagrams:preview                       browse them, drilling in by click

kinds:
${readers.map((reader) => `  ${reader.kind}`).join("\n")}

Output defaults to ${DEFAULT_OUT_DIR}/<slug>.mmd (gitignored).

`);
  process.exit(0);
}

const only = cli.flag("only");
const kinds = only === undefined ? undefined : new Set(only.split(","));
const outDir = path.resolve(repoRoot, cli.flag("out-dir", DEFAULT_OUT_DIR));
const exclude = cli.flag("exclude") ? new RegExp(cli.flag("exclude")) : undefined;
const focus = cli.flag("focus") ? new RegExp(cli.flag("focus")) : undefined;

const wanted = allSlugs().filter((entry) => kinds === undefined || kinds.has(entry.kind));
if (wanted.length === 0) {
  process.stderr.write("diagrams: --only matched no kind\n");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

let violations = 0;
let cycles = 0;
let written = 0;
for (const { slug } of wanted) {
  const drawn = draw(slug);
  if (drawn === undefined) continue;
  const graph = filterGraph(drawn, { exclude, focus });
  if (graph.nodes.size === 0) continue;

  const report = analyse(graph);
  violations += report.violations.length;
  cycles += report.cycles.length;
  for (const edge of report.violations) {
    const label = (id) => graph.nodes.get(id)?.label ?? id;
    process.stderr.write(
      `  ✗ ${slug}: ${label(edge.from)} → ${label(edge.to)} — ${[...edge.violations].join("; ")}\n`,
    );
  }
  for (const cycle of report.cycles) {
    process.stderr.write(`  ↻ ${slug}: ${cycle.join(" → ")}\n`);
  }

  fs.writeFileSync(path.join(outDir, `${slug}.mmd`), `${toMermaid(graph)}\n`, "utf8");
  written += 1;
}

process.stderr.write(
  `\n${written} diagrams → ${path.relative(repoRoot, outDir)}/` +
    `${violations > 0 ? ` · ${violations} forbidden import(s)` : ""}` +
    `${cycles > 0 ? ` · ${cycles} cycle(s)` : ""}\n` +
    `browse them with \`pnpm diagrams:preview\`\n`,
);
