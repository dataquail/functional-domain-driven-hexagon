import { DEFAULT_CONFIG_FILENAME, loadPolicy } from "./config-loader.js";
import { makeExportsRule } from "./exports-rule.js";
import { makeImportsRule } from "./imports-rule.js";
import { makeMembersRule } from "./members-rule.js";
import type { OxlintRule } from "./oxlint-api.js";
import { makeStructureRule } from "./structure-rule.js";

// oxlint imports this module once per lint run and reads `rules` synchronously,
// so the policy is loaded here rather than inside a rule. A load failure throws
// out of the import and fails the run — which is the point: a plugin that came
// up with no policy would report nothing and be indistinguishable from a clean
// codebase.
const policy = await loadPolicy(
  process.env.ARCHITECTURE_ROOT ?? process.cwd(),
  process.env.ARCHITECTURE_CONFIG ?? DEFAULT_CONFIG_FILENAME,
);

export const rules: {
  readonly imports: OxlintRule;
  readonly exports: OxlintRule;
  readonly members: OxlintRule;
  readonly structure: OxlintRule;
} = {
  imports: makeImportsRule(policy),
  exports: makeExportsRule(policy),
  members: makeMembersRule(policy),
  structure: makeStructureRule(policy),
};

const plugin: { readonly meta: { readonly name: string }; readonly rules: typeof rules } = {
  meta: { name: "architecture" },
  rules,
};

export default plugin;
