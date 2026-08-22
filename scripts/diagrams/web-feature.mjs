import path from "node:path";

import { isMain, runGenerator } from "../lib/diagram/generator.mjs";
import { addEdge, addNode, makeGraph } from "../lib/diagram/graph.mjs";
import { importsOf, loadProgram, relativeToRepo, ts } from "../lib/diagram/program.mjs";
import {
  dependencyPath,
  isCoreModule,
  isExternalPath,
  violatedRules,
} from "../lib/diagram/rules.mjs";
import { isFixture } from "./web-overview.mjs";

const FEATURES_ROOT = "packages/web/features/";
const ATOM_INITIALIZER = /^(Atom|ApiAtoms)\./;

const featureOf = (relative) =>
  relative.startsWith(FEATURES_ROOT)
    ? relative.slice(FEATURES_ROOT.length).split("/")[0]
    : undefined;

const withinFeature = (relative, feature) => relative.slice(`${FEATURES_ROOT}${feature}/`.length);

const bindingsOf = (sourceFile) => {
  const bindings = [];
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue;
      bindings.push({
        name: declaration.name.text,
        initializer: declaration.initializer,
        isAtom:
          ATOM_INITIALIZER.test(declaration.initializer.getText()) ||
          declaration.name.text.endsWith("Atom"),
      });
    }
  });
  return bindings;
};

const referencedNames = (node) => {
  const names = new Set();
  const visit = (current) => {
    if (ts.isPropertyAccessExpression(current)) {
      visit(current.expression);
      return;
    }
    if (ts.isIdentifier(current)) names.add(current.text);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return names;
};

const isModelPath = (relative) => relative.startsWith("packages/web/services/");

// A ViewModel may name an atom through a plain local helper; the graph is about
// atoms, so a non-atom binding is inlined into whatever reads it.
const reachedNames = (bindings, binding, seen = new Set()) => {
  const reached = new Set();
  for (const name of referencedNames(binding.initializer)) {
    const local = bindings.find((candidate) => candidate.name === name);
    if (local === undefined || local.isAtom || seen.has(name)) {
      reached.add(name);
      continue;
    }
    seen.add(name);
    for (const inherited of reachedNames(bindings, local, seen)) reached.add(inherited);
  }
  return reached;
};

const groupOf = (inner, suffix) => {
  const stripped = inner.replace(suffix, "");
  const directory = path.dirname(stripped);
  return directory !== "." && path.basename(stripped) === path.basename(directory)
    ? directory
    : stripped;
};

const build = (cli) => {
  const { program, resolve } = loadProgram("packages/web/tsconfig.json");
  const only = cli.flag("feature");
  const selected = only === undefined ? undefined : new Set(only.split(","));

  const byFeature = new Map();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const relative = relativeToRepo(sourceFile.fileName);
    if (isFixture(relative)) continue;
    const feature = featureOf(relative);
    if (feature === undefined || (selected !== undefined && !selected.has(feature))) continue;
    if (!relative.endsWith(".view.tsx") && !relative.endsWith(".view-model.ts")) continue;
    const files = byFeature.get(feature) ?? [];
    files.push({ relative, sourceFile });
    byFeature.set(feature, files);
  }

  return [...byFeature]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([feature, files]) => {
      const graph = makeGraph({
        slug: `web-feature-${feature}`,
        title: `features/${feature} — View → ViewModel → Model`,
        direction: "LR",
      });

      const atomNodes = new Map();
      for (const { relative, sourceFile } of files) {
        if (!relative.endsWith(".view-model.ts")) continue;
        const group = groupOf(withinFeature(relative, feature), /\.view-model\.ts$/);
        for (const binding of bindingsOf(sourceFile)) {
          if (!binding.isAtom) continue;
          const id = `${relative}#${binding.name}`;
          atomNodes.set(id, binding);
          addNode(graph, { id, label: binding.name, kind: "atom", group });
        }
      }

      for (const { relative, sourceFile } of files) {
        const inner = withinFeature(relative, feature);
        const isView = relative.endsWith(".view.tsx");
        if (isView) {
          addNode(graph, {
            id: relative,
            label: groupOf(inner, /\.view\.tsx$/),
            kind: "view",
            group: "views",
          });
        }

        const imported = new Map();
        for (const declaration of importsOf(sourceFile, resolve)) {
          if (isCoreModule(declaration.specifier)) continue;
          const target = dependencyPath({
            specifier: declaration.specifier,
            resolved:
              declaration.resolved === undefined ? undefined : relativeToRepo(declaration.resolved),
          });
          const violations = violatedRules({
            from: relative,
            to: target,
            external: isExternalPath(target),
          });

          const fromModel = isModelPath(target);
          if (
            !fromModel &&
            !atomNodes.has(`${target}#${declaration.names[0]}`) &&
            !target.endsWith(".view.tsx")
          ) {
            if (violations.length > 0) {
              const outside = `outside:${declaration.specifier}`;
              addNode(graph, {
                id: outside,
                label: declaration.specifier,
                kind: "external",
                group: "outside the feature",
              });
              addEdge(graph, {
                from: relative,
                to: outside,
                typeOnly: declaration.typeOnly,
                violation: violations.join(", "),
              });
            }
            continue;
          }

          for (const name of declaration.names) {
            const id = `${target}#${name}`;
            if (fromModel) {
              addNode(graph, {
                id,
                label: name,
                kind: "modelAtom",
                group: `Model/${path.basename(target).replace(/\.(ts|tsx)$/, "")}`,
              });
            } else if (target.endsWith(".view.tsx")) {
              continue;
            } else if (!atomNodes.has(id)) {
              continue;
            }
            imported.set(name, { id, violations, typeOnly: declaration.typeOnly });
          }

          if (target.endsWith(".view.tsx") && isView) {
            addEdge(graph, {
              from: relative,
              to: target,
              typeOnly: declaration.typeOnly,
              violation: violations.length === 0 ? undefined : violations.join(", "),
            });
          }
        }

        if (isView) {
          for (const [name, target] of imported) {
            if (!referencedNames(sourceFile).has(name)) continue;
            addEdge(graph, {
              from: relative,
              to: target.id,
              typeOnly: target.typeOnly,
              violation: target.violations.length === 0 ? undefined : target.violations.join(", "),
            });
          }
          continue;
        }

        const bindings = bindingsOf(sourceFile);
        for (const binding of bindings) {
          const from = `${relative}#${binding.name}`;
          if (!atomNodes.has(from)) continue;
          for (const name of reachedNames(bindings, binding)) {
            const local = `${relative}#${name}`;
            if (name !== binding.name && atomNodes.has(local)) {
              addEdge(graph, { from, to: local });
              continue;
            }
            const target = imported.get(name);
            if (target === undefined) continue;
            addEdge(graph, {
              from,
              to: target.id,
              typeOnly: target.typeOnly,
              violation: target.violations.length === 0 ? undefined : target.violations.join(", "),
            });
          }
        }
      }

      return graph;
    });
};

export const generator = {
  name: "web-feature",
  describe: "one diagram per web feature: views, view-model atoms, and the Model they read",
  options: `  --feature <a,b>       only these features   [all]
`,
  build,
};

if (isMain(import.meta.url)) await runGenerator(generator);
