import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

import { DEFAULT_OUT_DIR } from "../lib/diagram/generator.mjs";
import { toMermaid } from "../lib/diagram/mermaid.mjs";
import { clearCaches } from "../lib/diagram/model-cache.mjs";
import { repoRoot } from "../lib/diagram/program.mjs";
import { allSlugs, draw } from "../lib/diagram/registry.mjs";
import { page } from "../lib/diagram/viewer.mjs";

const OUT = path.resolve(repoRoot, DEFAULT_OUT_DIR);
const MERMAID = path.join(OUT, "mermaid.min.js");
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
const PORT = Number(process.env.DIAGRAMS_PORT ?? 8899);

fs.mkdirSync(OUT, { recursive: true });

// The viewer renders mermaid in the page, so a diagram is whatever the code says
// right now — there is no build step between a source edit and the picture.
if (!fs.existsSync(MERMAID)) {
  process.stderr.write("fetching mermaid…\n");
  const response = await fetch(MERMAID_URL);
  if (!response.ok) {
    process.stderr.write(`could not fetch mermaid (${response.status}) — check the network\n`);
    process.exit(1);
  }
  fs.writeFileSync(MERMAID, Buffer.from(await response.arrayBuffer()));
}

process.stderr.write("loading the TypeScript program…\n");
let index = allSlugs();

let pending;
fs.watch(path.join(repoRoot, "packages"), { recursive: true }, (_event, file) => {
  if (file === null || !/\.(ts|tsx|mts)$/.test(file) || file.includes("node_modules")) return;
  clearTimeout(pending);
  pending = setTimeout(() => {
    clearCaches();
    index = undefined;
    process.stderr.write(`  ${file} changed — rebuilding on the next request\n`);
  }, 250);
});

const slugs = () => {
  index = index ?? allSlugs();
  return index;
};

const send = (response, status, type, body) => {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
};

http
  .createServer((request, response) => {
    const name = decodeURIComponent(request.url.split("?")[0]).replace(/^\//, "");

    if (name === "" || name === "index.html") {
      send(response, 200, "text/html; charset=utf-8", page(slugs()));
      return;
    }
    if (name === "mermaid.min.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      fs.createReadStream(MERMAID).pipe(response);
      return;
    }
    if (name.endsWith(".mmd")) {
      const slug = name.slice(0, -4);
      const started = Date.now();
      const graph = draw(slug);
      if (graph === undefined) {
        send(response, 404, "text/plain", `no diagram for "${slug}"`);
        return;
      }
      process.stderr.write(`  ${slug} (${Date.now() - started}ms)\n`);
      send(response, 200, "text/plain; charset=utf-8", `${toMermaid(graph)}\n`);
      return;
    }
    send(response, 404, "text/plain", "not found");
  })
  .listen(PORT, () => {
    process.stderr.write(
      `\n  ${slugs().length} diagrams, drawn on request\n` +
        `  http://localhost:${PORT}/\n\n  ctrl-c to stop\n`,
    );
  });
