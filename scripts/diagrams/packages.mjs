import fs from "node:fs";
import path from "node:path";

import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { importsOf, parseFile, repoRoot, walkSources } from "../lib/diagram/program.mjs";

const WORKSPACE_SCOPE = "@org/";

const packageOf = (specifier) => {
  if (!specifier.startsWith(WORKSPACE_SCOPE)) return undefined;
  const [scope, name] = specifier.split("/");
  return name === undefined ? undefined : `${scope}/${name}`;
};

const readWorkspace = () => {
  const packagesDir = path.join(repoRoot, "packages");
  const workspace = new Map();
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packagesDir, entry.name, "package.json");
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    workspace.set(manifest.name, {
      directory: path.join(packagesDir, entry.name),
      declared: new Set(
        [
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.devDependencies ?? {}),
          ...Object.keys(manifest.peerDependencies ?? {}),
        ].filter((dependency) => dependency.startsWith(WORKSPACE_SCOPE)),
      ),
    });
  }
  return workspace;
};

const build = () => {
  const workspace = readWorkspace();
  const graph = makeGraph({
    slug: "packages",
    title: "Workspace packages",
    direction: "LR",
  });

  const used = new Map([...workspace.keys()].map((name) => [name, new Set()]));

  for (const [name, { directory }] of workspace) {
    for (const file of walkSources(directory)) {
      for (const imported of importsOf(parseFile(file))) {
        const target = packageOf(imported.specifier);
        if (target === undefined || target === name || !workspace.has(target)) continue;
        used.get(name).add(target);
        addEdge(graph, {
          from: name,
          to: target,
          typeOnly: imported.typeOnly,
          violation: workspace.get(name).declared.has(target)
            ? undefined
            : "imported, not declared in package.json",
        });
      }
    }
  }

  for (const [name, { declared }] of workspace) {
    for (const dependency of declared) {
      if (!workspace.has(dependency) || used.get(name).has(dependency)) continue;
      addEdge(graph, { from: name, to: dependency, label: "declared, unused" });
    }
  }

  const consumed = new Set([...graph.edges.values()].map((edge) => edge.to));
  for (const name of workspace.keys()) {
    addNode(graph, {
      id: name,
      label: name,
      kind: "package",
      group: consumed.has(name) ? "shared by other packages" : "entry points",
    });
  }

  return [graph];
};

export const generator = {
  name: "packages",
  describe: "workspace packages and the imports between them",
  options: "",
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
