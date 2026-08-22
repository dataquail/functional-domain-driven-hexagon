import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";

import { DEFAULT_OUT_DIR } from "../lib/diagram/generator.mjs";
import { repoRoot } from "../lib/diagram/program.mjs";

const OUT = path.resolve(repoRoot, DEFAULT_OUT_DIR);
const MERMAID = path.join(OUT, "mermaid.min.js");
const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js";
const PORT = Number(process.env.DIAGRAMS_PORT ?? 8899);

if (!fs.existsSync(OUT)) {
  process.stderr.write(`no diagrams yet — run \`pnpm diagrams\` first\n`);
  process.exit(1);
}

const slugs = fs
  .readdirSync(OUT)
  .filter((file) => file.endsWith(".mmd"))
  .map((file) => file.slice(0, -4))
  .sort();

if (slugs.length === 0) {
  process.stderr.write(`no .mmd files in ${DEFAULT_OUT_DIR} — run \`pnpm diagrams\` first\n`);
  process.exit(1);
}

// The viewer renders mermaid in the page so a diagram is live the moment it is
// regenerated, and so a `click` directive is a real link.
if (!fs.existsSync(MERMAID)) {
  process.stderr.write(`fetching mermaid…\n`);
  const response = await fetch(MERMAID_URL);
  if (!response.ok) {
    process.stderr.write(`could not fetch mermaid (${response.status}) — check the network\n`);
    process.exit(1);
  }
  fs.writeFileSync(MERMAID, Buffer.from(await response.arrayBuffer()));
}

const moduleOf = (slug) => /^server-(?:hexagon|usecase)-([a-z]+)/.exec(slug)?.[1];
const useCases = slugs.filter((slug) => slug.startsWith("server-usecase-"));
const overviews = slugs.filter((slug) => slug.startsWith("server-hexagon-"));

const titleOf = (slug) => {
  if (slug.startsWith("server-usecase-")) {
    const module = moduleOf(slug);
    return slug.slice(`server-usecase-${module}-`.length).replaceAll("-", " ");
  }
  return slug
    .replace(/^server-hexagon-/, "")
    .replace(/^server-module-/, "")
    .replace(/-folders$/, "")
    .replace(/^web-feature-/, "feature: ")
    .replace(/^server-modules$/, "all modules")
    .replace(/^web-overview$/, "overview");
};

const list = (items) =>
  `<ul>${items
    .map((slug) => `<li><button data-slug="${slug}">${titleOf(slug)}</button></li>`)
    .join("")}</ul>`;

const nav = [
  `<section><h2>Modules — the map</h2>${list(overviews)}</section>`,
  ...overviews.map((overview) => {
    const module = moduleOf(overview);
    const mine = useCases.filter((slug) => moduleOf(slug) === module);
    if (mine.length === 0) return "";
    return `<details><summary>${module} — ${mine.length} use cases</summary>${list(mine)}</details>`;
  }),
  `<section><h2>Across modules</h2>${list(slugs.filter((s) => s === "server-modules" || s === "packages"))}</section>`,
  `<section><h2>Module shape</h2>${list(slugs.filter((s) => s.endsWith("-folders")))}</section>`,
  `<section><h2>Web</h2>${list(slugs.filter((s) => s.startsWith("web-")))}</section>`,
].join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Architecture diagrams</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111827; --muted:#6b7280; --line:#e5e7eb; --panel:#f9fafb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0b0f19; --fg:#e5e7eb; --muted:#9ca3af; --line:#1f2937; --panel:#111827; } }
  * { box-sizing: border-box; }
  body { margin:0; display:flex; height:100vh; font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--fg); }
  aside { width:280px; flex:none; overflow-y:auto; border-right:1px solid var(--line); background:var(--panel); padding:16px; }
  aside h1 { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:0 0 6px; }
  aside p.hint { margin:0 0 16px; font-size:12px; color:var(--muted); }
  aside h2 { font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin:18px 0 6px; }
  aside ul { list-style:none; margin:0; padding:0; }
  aside details { margin:2px 0; }
  aside summary { cursor:pointer; font-size:12px; color:var(--muted); padding:4px 8px; border-radius:6px; }
  aside summary:hover { background:var(--line); }
  aside details ul { padding-left:10px; border-left:1px solid var(--line); margin:4px 0 8px 8px; }
  aside button { display:block; width:100%; text-align:left; padding:5px 8px; border:0; border-radius:6px; background:none; color:inherit; font:inherit; cursor:pointer; }
  aside button:hover { background:var(--line); }
  aside button[aria-current="true"] { background:#2563eb; color:#fff; }
  main { flex:1; display:flex; flex-direction:column; min-width:0; }
  header { padding:10px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
  header strong { font-size:15px; }
  header .crumb { color:var(--muted); font-size:12px; }
  header .crumb button { border:0; background:none; color:#2563eb; font:inherit; cursor:pointer; padding:0; text-decoration:underline; }
  header .tools { margin-left:auto; display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; }
  header .tools button { border:1px solid var(--line); background:var(--panel); color:inherit; font:inherit; font-size:12px; padding:3px 9px; border-radius:6px; cursor:pointer; }
  header .tools button:hover { background:var(--line); }
  #zoomLabel { min-width:44px; text-align:right; font-variant-numeric:tabular-nums; }
  .stage { flex:1; overflow:auto; padding:20px; }
  .stage svg { display:block; max-width:none !important; height:auto; background:#fff; border-radius:8px; padding:12px; }
  .stage a { cursor:pointer; }
  .stage a:hover rect, .stage a:hover polygon, .stage a:hover path { filter:brightness(.94); }
  pre.error { color:#b91c1c; white-space:pre-wrap; font:12px/1.5 ui-monospace,monospace; }
  footer { padding:8px 20px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
</style>
</head>
<body>
<aside>
  <h1>Diagrams</h1>
  <p class="hint">Click a command or query in a module map to open it in full detail.</p>
  ${nav}
</aside>
<main>
  <header>
    <strong id="current"></strong>
    <span class="crumb" id="crumb"></span>
    <a id="source" href="#" download style="color:var(--muted);font-size:12px">.mmd source</a>
    <span class="tools">
      <button id="out" type="button">&minus;</button>
      <input id="zoom" type="range" min="10" max="400" value="100" step="5">
      <button id="in" type="button">+</button>
      <span id="zoomLabel">100%</span>
      <button id="fit" type="button">fit width</button>
    </span>
  </header>
  <div class="stage" id="stage"></div>
  <footer>generated by <code>pnpm diagrams</code> &middot; amber dashed = an adapter implementing a port &middot; red = an import the rules forbid</footer>
</main>
<script src="mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: false, securityLevel: "loose", theme: "default", flowchart: { htmlLabels: true } });

  const buttons = [...document.querySelectorAll("aside button[data-slug]")];
  const stage = document.getElementById("stage");
  const current = document.getElementById("current");
  const crumb = document.getElementById("crumb");
  const source = document.getElementById("source");
  const zoom = document.getElementById("zoom");
  const zoomLabel = document.getElementById("zoomLabel");
  let slug = "";
  let natural = 1200;
  let serial = 0;

  const applyZoom = () => {
    zoomLabel.textContent = zoom.value + "%";
    const svg = stage.querySelector("svg");
    if (svg) svg.style.width = Math.round((natural * Number(zoom.value)) / 100) + "px";
  };

  const nudge = (delta) => {
    zoom.value = String(Math.min(Number(zoom.max), Math.max(Number(zoom.min), Number(zoom.value) + delta)));
    applyZoom();
  };

  const fitWidth = () => {
    zoom.value = String(Math.max(10, Math.min(400, Math.round(((stage.clientWidth - 64) / natural) * 100))));
    applyZoom();
  };

  const label = (name) =>
    name.startsWith("server-usecase-")
      ? name.replace(/^server-usecase-([a-z]+)-/, "$1 · ").replaceAll("-", " ")
      : name;

  const show = async (next) => {
    slug = next;
    buttons.forEach((b) => b.setAttribute("aria-current", String(b.dataset.slug === slug)));
    current.textContent = label(slug);
    source.href = slug + ".mmd";
    if (location.hash.slice(1) !== slug) location.hash = slug;

    const module = /^server-usecase-([a-z]+)-/.exec(slug);
    crumb.innerHTML = module
      ? '&lsaquo; back to <button type="button" id="up">' + module[1] + " map</button>"
      : "";
    if (module) document.getElementById("up").addEventListener("click", () => show("server-hexagon-" + module[1]));

    try {
      const text = await (await fetch(slug + ".mmd")).text();
      serial += 1;
      const { svg, bindFunctions } = await mermaid.render("render" + serial, text);
      stage.innerHTML = svg;
      const element = stage.querySelector("svg");
      if (bindFunctions) bindFunctions(element);
      natural = Number.parseFloat(element.style.maxWidth) || element.viewBox.baseVal.width || 1200;
      element.removeAttribute("height");
      stage.scrollTo(0, 0);
      zoom.value = "100";
      applyZoom();
    } catch (error) {
      stage.innerHTML = '<pre class="error"></pre>';
      stage.firstChild.textContent =
        "Could not render " + slug + "\\n\\n" + (error && error.message ? error.message : String(error)) +
        "\\n\\nIf this says 'Failed to fetch', open the page over http (localhost) rather than file://.";
    }
  };

  stage.addEventListener("click", (event) => {
    const anchor = event.target.closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("xlink:href") || anchor.getAttribute("href");
    if (href && href.startsWith("#")) {
      event.preventDefault();
      show(href.slice(1));
    }
  });

  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.slug)));
  zoom.addEventListener("input", applyZoom);
  document.getElementById("in").addEventListener("click", () => nudge(25));
  document.getElementById("out").addEventListener("click", () => nudge(-25));
  document.getElementById("fit").addEventListener("click", fitWidth);
  addEventListener("hashchange", () => {
    const wanted = location.hash.slice(1);
    if (wanted && wanted !== slug) show(wanted);
  });

  show(location.hash.slice(1) || buttons[0].dataset.slug);
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(OUT, "index.html"), html, "utf8");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mmd": "text/plain" };

http
  .createServer((request, response) => {
    const name = path.basename(decodeURIComponent(request.url.split("?")[0]));
    const file = path.join(OUT, name === "" || name === "/" ? "index.html" : name);
    if (!file.startsWith(OUT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404).end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(PORT, () => {
    process.stderr.write(
      `\n  ${slugs.length} diagrams (${useCases.length} use cases)\n` +
        `  http://localhost:${PORT}/\n\n  ctrl-c to stop\n`,
    );
  });
