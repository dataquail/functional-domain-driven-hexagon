import path from "node:path";

import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { importsOf, loadProgram, relativeToRepo } from "../lib/diagram/program.mjs";
import {
  dependencyPath,
  isCoreModule,
  isExternalPath,
  violatedRules,
} from "../lib/diagram/rules.mjs";

const WEB_ROOT = "packages/web/";

export const isFixture = (relative) =>
  /\.(test|spec|stories)\.(ts|tsx)$/.test(relative) || relative.startsWith(`${WEB_ROOT}test/`);

const stripExtension = (file) => file.replace(/\.(ts|tsx)$/, "");

export const classify = (relative) => {
  if (!relative.startsWith(WEB_ROOT)) return undefined;
  const inner = relative.slice(WEB_ROOT.length);

  if (inner.startsWith("features/")) {
    const feature = inner.split("/")[1];
    return { id: `features/${feature}`, label: feature, kind: "feature", group: "features" };
  }
  if (inner.startsWith("services/atom/")) {
    return { id: "services/atom", label: "atom kernel", kind: "kernel", group: "Model" };
  }
  if (inner.startsWith("services/data-access/")) {
    const base = stripExtension(path.basename(inner)).replace(
      /\.(atoms|server|shared|client)$/,
      "",
    );
    return {
      id: `services/data-access/${base}`,
      label: base,
      kind: "model",
      group: "Model/data-access",
    };
  }
  if (inner.startsWith("services/")) {
    const base = stripExtension(inner.slice("services/".length)).replace(
      /\.(server|shared|client)$/,
      "",
    );
    return { id: `services/${base}`, label: base, kind: "model", group: "Model" };
  }
  if (inner.startsWith("app/")) {
    const route = path.dirname(inner.slice("app/".length));
    return {
      id: `app/${route}`,
      label: route === "." ? "/" : route,
      kind: "route",
      group: "app (routes)",
    };
  }
  return undefined;
};

const build = (cli) => {
  const { program, resolve } = loadProgram("packages/web/tsconfig.json");
  const withApp = !cli.has("no-app");
  const graph = makeGraph({
    slug: "web-overview",
    title: "web — features, Model, and routes",
    direction: "LR",
  });

  const admits = (node) => node !== undefined && (withApp || node.kind !== "route");

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const relative = relativeToRepo(sourceFile.fileName);
    if (isFixture(relative)) continue;
    const from = classify(relative);
    if (!admits(from)) continue;
    addNode(graph, from);

    for (const imported of importsOf(sourceFile, resolve)) {
      if (isCoreModule(imported.specifier)) continue;
      const target = dependencyPath({
        specifier: imported.specifier,
        resolved: imported.resolved === undefined ? undefined : relativeToRepo(imported.resolved),
      });
      const violations = violatedRules({
        from: relative,
        to: target,
        external: isExternalPath(target),
      });
      const to = classify(target);

      if (!admits(to) || to.id === from.id) {
        if (violations.length === 0) continue;
        const outside = `outside:${imported.specifier}`;
        addNode(graph, {
          id: outside,
          label: imported.specifier,
          kind: "external",
          group: "outside web",
        });
        addEdge(graph, {
          from: from.id,
          to: outside,
          typeOnly: imported.typeOnly,
          violation: violations.join(", "),
        });
        continue;
      }

      addNode(graph, to);
      addEdge(graph, {
        from: from.id,
        to: to.id,
        typeOnly: imported.typeOnly,
        violation: violations.length === 0 ? undefined : violations.join(", "),
      });
    }
  }

  return [graph];
};

export const generator = {
  name: "web-overview",
  describe: "web features, the Model they read, and the routes that mount them",
  options: `  --no-app              drop the app/ route nodes
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
