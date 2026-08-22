import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { importsOf, loadProgram, relativeToRepo } from "../lib/diagram/program.mjs";

const MODULES_ROOT = "packages/server/src/modules/";

const moduleOf = (relative) =>
  relative.startsWith(MODULES_ROOT) ? relative.slice(MODULES_ROOT.length).split("/")[0] : undefined;

const withinModule = (relative, module) => relative.slice(`${MODULES_ROOT}${module}/`.length);

const SEAMS = [
  ["infrastructure/acl/", "acl adapter"],
  ["interface/events/", "event adapter"],
  ["sagas/", "saga"],
];

const seamOf = (inner) => SEAMS.find(([prefix]) => inner.startsWith(prefix))?.[1];

const COUNTED = [
  [/^commands\/[^/]+\.command\.ts$/, ["command", "commands"]],
  [/^queries\/[^/]+\.query\.ts$/, ["query", "queries"]],
  [/^queries\/[^/]+\.policy-query\.ts$/, ["policy query", "policy queries"]],
  [/^event-handlers\/[^/]+\.handler\.ts$/, ["event handler", "event handlers"]],
  [/^sagas\/[^/]+\.saga\.ts$/, ["saga", "sagas"]],
  [/^interface\/(http|cli)\/[^/]+\.endpoint\.ts$/, ["endpoint", "endpoints"]],
];

const build = () => {
  const { program, resolve } = loadProgram("packages/server/tsconfig.src.json");
  const graph = makeGraph({
    slug: "server-modules",
    title: "Server modules (cross-module imports)",
    direction: "LR",
  });

  const tally = new Map();

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const relative = relativeToRepo(sourceFile.fileName);
    const module = moduleOf(relative);
    if (module === undefined) continue;

    const inner = withinModule(relative, module);
    const counts = tally.get(module) ?? new Map();
    tally.set(module, counts);
    for (const [pattern, nouns] of COUNTED) {
      if (pattern.test(inner)) counts.set(nouns, (counts.get(nouns) ?? 0) + 1);
    }

    for (const imported of importsOf(sourceFile, resolve)) {
      if (imported.resolved === undefined) continue;
      const target = relativeToRepo(imported.resolved);
      const targetModule = moduleOf(target);
      if (targetModule === undefined || targetModule === module) continue;

      const throughBarrel = withinModule(target, targetModule) === "index.ts";
      const seam = seamOf(inner);

      const violation = !throughBarrel
        ? `deep import: ${withinModule(target, targetModule)}`
        : seam === undefined
          ? `barrel import outside an acl / event-adapter / saga seam (${inner})`
          : undefined;

      addEdge(graph, {
        from: module,
        to: targetModule,
        typeOnly: imported.typeOnly,
        label: violation === undefined ? seam : undefined,
        violation,
      });
      for (const name of imported.names.slice(0, 2)) {
        if (violation === undefined)
          addEdge(graph, { from: module, to: targetModule, label: name });
      }
    }
  }

  for (const [module, counts] of [...tally].sort()) {
    const detail = COUNTED.map(([, nouns]) => nouns)
      .filter((nouns) => counts.has(nouns))
      .map((nouns) => {
        const count = counts.get(nouns);
        return `${count} ${count === 1 ? nouns[0] : nouns[1]}`;
      })
      .join(" · ");
    addNode(graph, {
      id: module,
      label: detail === "" ? module : `${module}<br/>${detail}`,
      kind: "module",
    });
  }

  return [graph];
};

export const generator = {
  name: "server-modules",
  describe: "server feature modules and the barrel imports between them",
  options: "",
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
