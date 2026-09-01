import * as Result from "effect/Result";

import { evaluateSelectedEdge, rulesSelecting, type SelectedRule } from "../../core/imports.js";
import { formatMessage } from "../../domain/violation.js";
import type { LoadedPolicy } from "./config-loader.js";
import {
  type OxlintRule,
  type RuleContext,
  type SourceNode,
  specifierOf,
  toRepoRelative,
} from "./oxlint-api.js";

const unresolvedMessage = (specifier: string, detail: string): string =>
  `[unresolved-import] "${specifier}" could not be resolved, so every import rule about it ` +
  `enforces nothing. Fix the resolve scope in the architecture config, or list the specifier ` +
  `in resolve.ignoreUnresolved. (${detail})`;

export const makeImportsRule = (policy: LoadedPolicy): OxlintRule => ({
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "import boundaries between folders and packages, matched against fully resolved module paths",
    },
    schema: [],
  },

  // `createOnce` is what makes resolution affordable: the resolver and the
  // compiled rules are built once per lint run, and `before` decides per file
  // whether any rule selects it at all — a file none select is skipped whole.
  createOnce(context: RuleContext) {
    let importer = "";
    let selected: ReadonlyArray<SelectedRule> = [];

    const check = (node: SourceNode): void => {
      const specifier = specifierOf(node);
      if (specifier === null) return;

      const outcome = evaluateSelectedEdge(selected, policy.resolver, { importer, specifier });

      if (Result.isFailure(outcome)) {
        if (policy.config.resolve.unresolved === "off") return;
        if (policy.ignoreUnresolved.some((pattern) => pattern.test(specifier))) return;
        context.report({ node, message: unresolvedMessage(specifier, outcome.failure.detail) });
        return;
      }

      for (const violation of outcome.success) {
        if (policy.baseline.isBaselined(violation)) continue;
        context.report({ node, message: formatMessage(violation) });
      }
    };

    return {
      before() {
        importer = toRepoRelative(policy.repoRoot, context.filename);
        if (importer.startsWith("..")) return false;
        selected = rulesSelecting(policy.importRules, importer);
        return selected.length > 0;
      },
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
});
