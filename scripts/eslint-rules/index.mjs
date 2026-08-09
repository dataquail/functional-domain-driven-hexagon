// Single plugin barrel for the repo's local rules. ESLint declared each rule as
// its own pseudo-plugin; oxlint loads one module per `jsPlugins` entry, so the
// rules are collected here and addressed as `local/<rule>`.
import busFactoriesAtCompositionRoots from "./bus-factories-at-composition-roots.mjs";
import dumbRepositoryPorts from "./dumb-repository-ports.mjs";
import enforceReactNamespace from "./enforce-react-namespace.mjs";
import noDeepRelativeImports from "./no-deep-relative-imports.mjs";
import noEffectNamespaceImports from "./no-effect-namespace-imports.mjs";
import noRelativeImportOutsidePackage from "./no-relative-import-outside-package.mjs";
import useCaseDbViaMakeQuery from "./use-case-db-via-make-query.mjs";

export const rules = {
  "bus-factories-at-composition-roots": busFactoriesAtCompositionRoots,
  "dumb-repository-ports": dumbRepositoryPorts,
  "enforce-react-namespace": enforceReactNamespace,
  "no-deep-relative-imports": noDeepRelativeImports,
  "no-effect-namespace-imports": noEffectNamespaceImports,
  "no-relative-import-outside-package": noRelativeImportOutsidePackage,
  "use-case-db-via-make-query": useCaseDbViaMakeQuery,
};

export const localRulesPlugin = { meta: { name: "local" }, rules };

export default localRulesPlugin;
