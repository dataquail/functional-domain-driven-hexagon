import { evaluateStructure } from "../../core/structure.js";
import { formatMessage } from "../../domain/violation.js";
import type { LoadedPolicy } from "./config-loader.js";
import { type OxlintRule, type RuleContext, toRepoRelative } from "./oxlint-api.js";

export const makeStructureRule = (policy: LoadedPolicy): OxlintRule => ({
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "the file taxonomy: which file kinds a folder admits, and which siblings a file owes",
    },
    schema: [],
  },

  createOnce(context: RuleContext) {
    // The taxonomy is a property of the path, not of the syntax, so the whole
    // check runs once in `before` and the visitor exists only because oxlint
    // does not run hooks for a rule with no visitor keys.
    return {
      before() {
        const file = toRepoRelative(policy.repoRoot, context.filename);
        if (file.startsWith("..")) return false;

        for (const violation of evaluateStructure(policy.structure, policy.fileSystem, file)) {
          context.report({
            message: formatMessage(violation),
            loc: { line: 1, column: 0 },
          });
        }
        return false;
      },
      Program() {
        return undefined;
      },
    };
  },
});
