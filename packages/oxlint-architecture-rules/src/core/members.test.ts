import * as Result from "effect/Result";
import { describe, expect, it } from "vitest";

import type { MemberRule } from "../domain/architecture-config.js";
import {
  compileMemberRules,
  evaluateMemberSite,
  memberRulesFailingTheirProbe,
  memberRulesSelecting,
  type MemberSite,
} from "./members.js";

const compile = (rules: ReadonlyArray<MemberRule>) => {
  const compiled = compileMemberRules(rules);
  if (Result.isFailure(compiled)) throw compiled.failure;
  return compiled.success;
};

const PORT = "packages/server/src/modules/todos/domain/todo/todos.repository.ts";
const VIEW = "packages/web/features/todos/todos.view.tsx";

const dumbReads: MemberRule = {
  name: "dumb-repository-ports-reads",
  message: 'Port method "{name}" is not a read this vocabulary admits.',
  probe: { from: PORT, in: "TodosRepositoryShape", name: "findOneById" },
  from: "^packages/server/src/modules/[^/]+/domain/[^/]+/[^/]+\\.repository\\.ts$",
  subject: "type-members",
  in: "Repository(Shape)?$",
  match: "^find",
  allow: "^find(One|Many)$",
};

const viewHooks: MemberRule = {
  name: "view-hooks-allowlist",
  message: "`{name}` puts state in the View.",
  probe: { from: VIEW, name: "useState" },
  from: "^packages/web/features/.*\\.view\\.tsx$",
  subject: "calls",
  match: "^use[A-Z]",
  allow: "^(useAtomValue|useId)$",
};

const violationsAt = (rules: ReadonlyArray<MemberRule>, site: MemberSite) =>
  evaluateMemberSite(memberRulesSelecting(compile(rules), site.file), site).map(
    (violation) => violation.ruleName,
  );

const typeMember = (name: string, declaration = "TodosRepositoryShape"): MemberSite => ({
  file: PORT,
  subject: "type-members",
  name,
  in: declaration,
});

const call = (name: string, file = VIEW): MemberSite => ({ file, subject: "calls", name });

describe("evaluateMemberSite", () => {
  describe("type members", () => {
    it("reports a name the rule speaks to but does not admit", () => {
      expect(violationsAt([dumbReads], typeMember("findOneByEmail"))).toEqual([
        "dumb-repository-ports-reads",
      ]);
    });

    it("admits the vocabulary the rule allows", () => {
      expect(violationsAt([dumbReads], typeMember("findMany"))).toEqual([]);
    });

    it("stays silent on names outside its match", () => {
      expect(violationsAt([dumbReads], typeMember("insertOne"))).toEqual([]);
    });

    // The `in` filter is what keeps a helper type in the same file out of scope.
    it("ignores a declaration its `in` pattern does not name", () => {
      expect(violationsAt([dumbReads], typeMember("findOneById", "TodoRow"))).toEqual([]);
    });

    it("ignores a file its `from` pattern does not select", () => {
      expect(
        violationsAt([dumbReads], {
          ...typeMember("findOneById"),
          file: "packages/server/src/modules/todos/commands/create-todo.handler.ts",
        }),
      ).toEqual([]);
    });
  });

  describe("calls", () => {
    it("reports a call outside the allowlist", () => {
      expect(violationsAt([viewHooks], call("useEffect"))).toEqual(["view-hooks-allowlist"]);
    });

    it("admits an allowlisted call", () => {
      expect(violationsAt([viewHooks], call("useAtomValue"))).toEqual([]);
    });

    it("does not treat a non-hook name as one", () => {
      expect(violationsAt([viewHooks], call("useless"))).toEqual([]);
    });

    it("does not apply a call rule to a type member of the same name", () => {
      expect(
        violationsAt([viewHooks], { file: VIEW, subject: "type-members", name: "useEffect" }),
      ).toEqual([]);
    });
  });

  // The two halves of one vocabulary, split so each can give its own advice —
  // which is what replaced the old rule's branch inside the message string.
  it("uses matchNot to split one vocabulary across two rules", () => {
    const dumbWrites: MemberRule = {
      name: "dumb-repository-ports-writes",
      message: 'Port method "{name}" reads like a domain verb.',
      probe: { from: PORT, in: "TodosRepositoryShape", name: "grantRole" },
      from: dumbReads.from,
      subject: "type-members",
      in: "Repository(Shape)?$",
      matchNot: "^find",
      allow: "^(insert|update|delete|upsert)(One|Many)$",
    };
    const rules = [dumbReads, dumbWrites];

    expect(violationsAt(rules, typeMember("grantRole"))).toEqual(["dumb-repository-ports-writes"]);
    expect(violationsAt(rules, typeMember("findOneById"))).toEqual(["dumb-repository-ports-reads"]);
    expect(violationsAt(rules, typeMember("upsertOne"))).toEqual([]);
  });
});

describe("memberRulesFailingTheirProbe", () => {
  it("passes rules that report their own probes", () => {
    expect(memberRulesFailingTheirProbe(compile([dumbReads, viewHooks]))).toEqual([]);
  });

  it("catches a rule whose allowlist has widened to swallow its probe", () => {
    const widened: MemberRule = { ...viewHooks, allow: "^use" };
    expect(memberRulesFailingTheirProbe(compile([widened])).map((rule) => rule.name)).toEqual([
      "view-hooks-allowlist",
    ]);
  });

  it("catches a rule whose `in` no longer names its probe's declaration", () => {
    const drifted: MemberRule = { ...dumbReads, in: "NeverMatches$" };
    expect(memberRulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "dumb-repository-ports-reads",
    ]);
  });

  it("catches a rule whose from side no longer selects its probe", () => {
    const drifted: MemberRule = { ...viewHooks, from: "^packages/server/" };
    expect(memberRulesFailingTheirProbe(compile([drifted])).map((rule) => rule.name)).toEqual([
      "view-hooks-allowlist",
    ]);
  });
});

describe("compileMemberRules", () => {
  const broken = "^packages/(unclosed";

  it.each([
    ["from", { from: broken }],
    ["fromNot", { fromNot: [broken] }],
    ["in", { in: broken }],
    ["match", { match: broken }],
    ["matchNot", { matchNot: [broken] }],
    ["allow", { allow: broken }],
  ])("refuses an invalid pattern in %s", (field, override) => {
    const compiled = compileMemberRules([{ ...dumbReads, ...override }]);
    expect(Result.isFailure(compiled) && compiled.failure.field).toBe(field);
  });
});
