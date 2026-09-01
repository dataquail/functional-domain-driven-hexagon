import {
  type CompiledMemberRule,
  evaluateMemberSite,
  memberRulesSelecting,
} from "../../core/members.js";
import { formatMessage } from "../../domain/violation.js";
import type { LoadedPolicy } from "./config-loader.js";
import {
  type OxlintRule,
  type ReportableNode,
  type RuleContext,
  toRepoRelative,
} from "./oxlint-api.js";

type NamedNode = ReportableNode & {
  readonly type: string;
  readonly name?: unknown;
  readonly value?: unknown;
};

type MemberNode = ReportableNode & {
  readonly type: string;
  readonly key?: NamedNode | null;
  readonly computed?: boolean;
};

type TypeAliasNode = ReportableNode & {
  readonly id?: NamedNode | null;
  readonly typeAnnotation?:
    | (ReportableNode & { readonly type: string; readonly members?: ReadonlyArray<MemberNode> })
    | null;
};

type CallNode = ReportableNode & {
  readonly callee?:
    | (ReportableNode & {
        readonly type: string;
        readonly name?: unknown;
        readonly property?: NamedNode | null;
      })
    | null;
};

const DECLARED_MEMBER_TYPES = new Set(["TSPropertySignature", "TSMethodSignature"]);

const nameOf = (node: NamedNode | null | undefined): string | null => {
  if (node === null || node === undefined) return null;
  if (typeof node.name === "string") return node.name;
  return typeof node.value === "string" ? node.value : null;
};

const calleeName = (node: CallNode): string | null => {
  const callee = node.callee;
  if (callee === null || callee === undefined) return null;
  if (typeof callee.name === "string") return callee.name;
  return nameOf(callee.property);
};

export const makeMembersRule = (policy: LoadedPolicy): OxlintRule => ({
  meta: {
    type: "problem" as const,
    docs: {
      description:
        "which names a file may declare or call — a port's method vocabulary, a tier's allowed hooks",
    },
    schema: [],
  },

  createOnce(context: RuleContext) {
    let file = "";
    let selected: ReadonlyArray<CompiledMemberRule> = [];

    const report = (node: ReportableNode, name: string, declaration?: string): void => {
      const violations = evaluateMemberSite(selected, {
        file,
        subject: declaration === undefined ? "calls" : "type-members",
        name,
        ...(declaration === undefined ? {} : { in: declaration }),
      });
      for (const violation of violations) {
        if (policy.baseline.isBaselined(violation)) continue;
        context.report({ node, message: formatMessage(violation) });
      }
    };

    return {
      before() {
        file = toRepoRelative(policy.repoRoot, context.filename);
        if (file.startsWith("..")) return false;
        selected = memberRulesSelecting(policy.memberRules, file);
        return selected.length > 0;
      },

      TSTypeAliasDeclaration(node: TypeAliasNode) {
        const declaration = nameOf(node.id);
        const annotation = node.typeAnnotation;
        if (declaration === null || annotation?.type !== "TSTypeLiteral") return;

        for (const member of annotation.members ?? []) {
          // A computed key is not a name a vocabulary rule can speak about, and
          // no port in this codebase declares one.
          if (member.computed === true || !DECLARED_MEMBER_TYPES.has(member.type)) continue;
          const name = nameOf(member.key);
          if (name !== null) report(member.key ?? member, name, declaration);
        }
      },

      CallExpression(node: CallNode) {
        const name = calleeName(node);
        if (name !== null) report(node, name);
      },
    };
  },
});
