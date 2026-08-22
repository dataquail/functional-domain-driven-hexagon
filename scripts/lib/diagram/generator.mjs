import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";

import { analyse, filterGraph } from "./graph.mjs";
import { toMermaid } from "./mermaid.mjs";
import { repoRoot } from "./program.mjs";

export const DEFAULT_OUT_DIR = "docs/diagrams";

const SHARED_OPTIONS = `  --focus <regex>       keep only matching nodes, and the edges among them
  --exclude <regex>     drop matching nodes
  --direction <dir>     TB | BT | LR | RL   [LR]
  --out-dir <path>      write <slug>.mmd files here instead of stdout
  --quiet               suppress the per-diagram summary
  --no-link             skip the mermaid.live URL`;

export const readCli = (argv = process.argv.slice(2)) => ({
  argv,
  flag: (option, fallback) => {
    const at = argv.indexOf(`--${option}`);
    return at === -1 || at === argv.length - 1 ? fallback : argv[at + 1];
  },
  has: (option) => argv.includes(`--${option}`),
});

// Same envelope @effect/language-service uses for its hover graphs.
const mermaidLiveUrl = (diagram) =>
  `https://mermaid.live/edit#pako:${zlib
    .deflateSync(Buffer.from(JSON.stringify({ code: diagram }), "utf8"), { level: 9 })
    .toString("base64url")}`;

const summarise = (graph, source) => {
  const report = analyse(graph);
  const parts = [`${report.nodeCount} nodes`, `${report.edgeCount} edges`];
  if (report.violations.length > 0) parts.push(`${report.violations.length} violating`);
  if (!report.acyclic) parts.push(`${report.cycles.length} cycle(s)`);
  process.stderr.write(`  ${graph.slug}: ${parts.join(", ")}\n`);

  for (const edge of report.violations) {
    const label = (id) => graph.nodes.get(id)?.label ?? id;
    process.stderr.write(
      `    ✗ ${label(edge.from)} → ${label(edge.to)} — ${[...edge.violations].join("; ")}\n`,
    );
  }
  for (const cycle of report.cycles) {
    process.stderr.write(`    ↻ cycle: ${cycle.join(" → ")}\n`);
  }
  return { ...report, source };
};

export const emitDiagrams = (graphs, { direction, exclude, focus, link, outDir, quiet }) => {
  const written = [];
  for (const graph of graphs) {
    if (direction !== undefined) graph.direction = direction;
    const filtered = filterGraph(graph, { exclude, focus });
    if (filtered.nodes.size === 0) {
      process.stderr.write(`  ${graph.slug}: every node was filtered out — skipped\n`);
      continue;
    }
    const diagram = toMermaid(filtered);
    if (!quiet) summarise(filtered, diagram);

    if (outDir === undefined) {
      process.stdout.write(`\n%% ── ${graph.slug} ──\n${diagram}\n`);
      if (link) process.stderr.write(`    ${mermaidLiveUrl(diagram)}\n`);
    } else {
      const target = path.resolve(repoRoot, outDir, `${graph.slug}.mmd`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${diagram}\n`, "utf8");
      written.push(path.relative(repoRoot, target));
    }
  }
  return written;
};

export const runGenerator = async (generator, argv = process.argv.slice(2)) => {
  const cli = readCli(argv);
  if (cli.has("help")) {
    process.stdout.write(
      `\n${generator.name} — ${generator.describe}\n\n${generator.options ?? ""}${SHARED_OPTIONS}\n\n`,
    );
    return [];
  }

  process.stderr.write(`${generator.name}\n`);
  const graphs = await generator.build(cli);

  return emitDiagrams(graphs, {
    direction: cli.flag("direction"),
    exclude: cli.flag("exclude") ? new RegExp(cli.flag("exclude")) : undefined,
    focus: cli.flag("focus") ? new RegExp(cli.flag("focus")) : undefined,
    link: !cli.has("no-link"),
    outDir: cli.flag("out-dir"),
    quiet: cli.has("quiet"),
  });
};

export const isMain = (metaUrl) =>
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(new URL(metaUrl).pathname);
