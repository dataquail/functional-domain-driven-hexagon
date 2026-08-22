// Single plugin barrel for the repo's local rules. ESLint declared each rule as
// its own pseudo-plugin; oxlint loads one module per `jsPlugins` entry, so the
// rules are collected here and addressed as `local/<rule>`.
import busFactoriesAtCompositionRoots from "./bus-factories-at-composition-roots.mjs";
import dumbRepositoryPorts from "./dumb-repository-ports.mjs";
import enforceReactNamespace from "./enforce-react-namespace.mjs";
import lucideIconSuffix from "./lucide-icon-suffix.mjs";
import noArrayPushSpread from "./no-array-push-spread.mjs";
import noDeepRelativeImports from "./no-deep-relative-imports.mjs";
import noEffectNamespaceImports from "./no-effect-namespace-imports.mjs";
import noInlineStyling from "./no-inline-styling.mjs";
import noRelativeImportOutsidePackage from "./no-relative-import-outside-package.mjs";
import preferNamedExports from "./prefer-named-exports.mjs";
import useCaseDbViaMakeQuery from "./use-case-db-via-make-query.mjs";
import viewHooksAllowlist from "./view-hooks-allowlist.mjs";

export const rules = {
  "bus-factories-at-composition-roots": busFactoriesAtCompositionRoots,
  "dumb-repository-ports": dumbRepositoryPorts,
  "enforce-react-namespace": enforceReactNamespace,
  "lucide-icon-suffix": lucideIconSuffix,
  "no-array-push-spread": noArrayPushSpread,
  "no-deep-relative-imports": noDeepRelativeImports,
  "no-effect-namespace-imports": noEffectNamespaceImports,
  "no-inline-styling": noInlineStyling,
  "no-relative-import-outside-package": noRelativeImportOutsidePackage,
  "prefer-named-exports": preferNamedExports,
  "use-case-db-via-make-query": useCaseDbViaMakeQuery,
  "view-hooks-allowlist": viewHooksAllowlist,
};

export const localRulesPlugin = { meta: { name: "local" }, rules };

export default localRulesPlugin;
