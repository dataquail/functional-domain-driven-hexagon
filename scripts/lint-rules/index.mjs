// Single plugin barrel for the repo's local rules. ESLint declared each rule as
// its own pseudo-plugin; oxlint loads one module per `jsPlugins` entry, so the
// rules are collected here and addressed as `local/<rule>`.
import noArrayPushSpread from "./no-array-push-spread.mjs";
import noCrossSchemaSqlAccess from "./no-cross-schema-sql-access.mjs";
import noDeepRelativeImports from "./no-deep-relative-imports.mjs";
import noRelativeImportOutsidePackage from "./no-relative-import-outside-package.mjs";

export const rules = {
  "no-array-push-spread": noArrayPushSpread,
  "no-cross-schema-sql-access": noCrossSchemaSqlAccess,
  "no-deep-relative-imports": noDeepRelativeImports,
  "no-relative-import-outside-package": noRelativeImportOutsidePackage,
};

export const localRulesPlugin = { meta: { name: "local" }, rules };

export default localRulesPlugin;
