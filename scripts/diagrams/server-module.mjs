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

const MODULES_ROOT = "packages/server/src/modules/";

const moduleOf = (relative) =>
  relative.startsWith(MODULES_ROOT) ? relative.slice(MODULES_ROOT.length).split("/")[0] : undefined;

const layerOf = (inner) => {
  if (inner.startsWith("domain/ports/")) return "port";
  if (inner.startsWith("domain/")) return "domain";
  if (inner.startsWith("policies/")) return "policy";
  if (inner.startsWith("sagas/")) return "saga";
  if (inner.startsWith("infrastructure/")) return "infrastructure";
  if (inner.startsWith("interface/")) return "interface";
  if (inner.includes("/")) return "application";
  return "composition";
};

const folderOf = (inner) => (path.dirname(inner) === "." ? undefined : path.dirname(inner));

const build = (cli) => {
  const { program, resolve } = loadProgram("packages/server/tsconfig.src.json");
  const granularity = cli.flag("granularity", "file");
  const only = cli.flag("module");
  const selected = only === undefined ? undefined : new Set(only.split(","));

  const byModule = new Map();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const relative = relativeToRepo(sourceFile.fileName);
    const module = moduleOf(relative);
    if (module === undefined || (selected !== undefined && !selected.has(module))) continue;
    const files = byModule.get(module) ?? [];
    files.push({ relative, inner: relative.slice(`${MODULES_ROOT}${module}/`.length), sourceFile });
    byModule.set(module, files);
  }

  return [...byModule]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([module, files]) => {
      const graph = makeGraph({
        slug:
          granularity === "folder" ? `server-module-${module}-folders` : `server-module-${module}`,
        title:
          granularity === "folder"
            ? `modules/${module} — folders`
            : `modules/${module} — hexagon layers`,
        direction: granularity === "folder" ? "LR" : "TB",
      });

      const declare = (inner) => {
        const folder = folderOf(inner);
        const id = granularity === "folder" ? (folder ?? "(module root)") : inner;
        addNode(graph, {
          id,
          label: granularity === "folder" ? id : path.basename(inner),
          kind: layerOf(inner),
          group: granularity === "folder" ? undefined : folder,
        });
        return id;
      };

      const innerOf = new Map(files.map(({ inner, relative }) => [relative, inner]));

      for (const { inner, relative, sourceFile } of files) {
        const from = declare(inner);

        for (const imported of importsOf(sourceFile, resolve)) {
          if (isCoreModule(imported.specifier)) continue;
          const target = dependencyPath({
            specifier: imported.specifier,
            resolved:
              imported.resolved === undefined ? undefined : relativeToRepo(imported.resolved),
          });
          const violations = violatedRules({
            from: relative,
            to: target,
            external: isExternalPath(target),
          });

          const targetInner = innerOf.get(target);
          if (targetInner !== undefined) {
            addEdge(graph, {
              from,
              to: declare(targetInner),
              typeOnly: imported.typeOnly,
              violation: violations.length === 0 ? undefined : violations.join(", "),
            });
            continue;
          }

          if (violations.length === 0) continue;
          const to = `outside:${imported.specifier}`;
          addNode(graph, {
            id: to,
            label: imported.specifier,
            kind: "external",
            group: granularity === "folder" ? undefined : "outside the module",
          });
          addEdge(graph, {
            from,
            to,
            typeOnly: imported.typeOnly,
            violation: violations.join(", "),
          });
        }
      }

      return graph;
    });
};

export const generator = {
  name: "server-module",
  describe: "one diagram per server module: files, hexagon layers, and the imports between them",
  options: `  --module <a,b>        only these modules   [all]
  --granularity <kind>  file | folder   [file]
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
