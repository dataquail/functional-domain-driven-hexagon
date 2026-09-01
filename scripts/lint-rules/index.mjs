// Single plugin barrel for the repo's local rules. ESLint declared each rule as
// its own pseudo-plugin; oxlint loads one module per `jsPlugins` entry, so the
// rules are collected here and addressed as `local/<rule>`.
import enforceReactNamespace from "./enforce-react-namespace.mjs";
import lucideIconSuffix from "./lucide-icon-suffix.mjs";
import noArrayPushSpread from "./no-array-push-spread.mjs";
import noCrossSchemaSqlAccess from "./no-cross-schema-sql-access.mjs";
import noDeepRelativeImports from "./no-deep-relative-imports.mjs";
import noInlineStyling from "./no-inline-styling.mjs";
import noRelativeImportOutsidePackage from "./no-relative-import-outside-package.mjs";
import preferNamedExports from "./prefer-named-exports.mjs";

export const rules = {
  "enforce-react-namespace": enforceReactNamespace,
  "lucide-icon-suffix": lucideIconSuffix,
  "no-array-push-spread": noArrayPushSpread,
  "no-cross-schema-sql-access": noCrossSchemaSqlAccess,
  "no-deep-relative-imports": noDeepRelativeImports,
  "no-inline-styling": noInlineStyling,
  "no-relative-import-outside-package": noRelativeImportOutsidePackage,
  "prefer-named-exports": preferNamedExports,
};

export const localRulesPlugin = { meta: { name: "local" }, rules };

export default localRulesPlugin;
