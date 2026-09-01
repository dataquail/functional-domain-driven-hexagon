import * as path from "node:path";
import { fileURLToPath } from "node:url";

import * as Result from "effect/Result";
import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import { compileMemberRules } from "../../core/members.js";
import { EMPTY_STRUCTURE } from "../../core/structure.js";
import { makeFileSystemFake } from "../../infrastructure/file-system-fake.js";
import { makeModuleResolverFake } from "../../infrastructure/module-resolver-fake.js";
import type { LoadedPolicy } from "./config-loader.js";
import { makeMembersRule } from "./members-rule.js";

RuleTester.describe = describe;
RuleTester.it = it;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const config = {
  resolve: { scopes: [{ files: "", tsconfig: "tsconfig.resolve.json" }] },
  members: [
    {
      name: "dumb-repository-ports",
      message: 'Port method "{name}" is not in the dumb-persistence vocabulary.',
      probe: {
        from: "packages/server/src/modules/todos/domain/todo/todos.repository.ts",
        in: "TodosRepositoryShape",
        name: "findOneById",
      },
      from: "\\.repository\\.ts$",
      subject: "type-members" as const,
      in: "Repository(Shape)?$",
      allow: "^((insert|update|delete|upsert)(One|Many)|find(One|Many))$",
    },
    {
      name: "view-hooks-allowlist",
      message: "`{name}` puts state in the View.",
      probe: { from: "packages/web/features/todos/todos.view.tsx", name: "useState" },
      from: "\\.view\\.tsx$",
      subject: "calls" as const,
      match: "^use[A-Z]",
      allow: "^(useAtomValue|useId)$",
    },
  ],
};

const policy = (): LoadedPolicy => {
  const memberRules = compileMemberRules(config.members);
  if (Result.isFailure(memberRules)) throw memberRules.failure;
  return {
    repoRoot,
    config: { resolve: config.resolve, tree: {} },
    importRules: [],
    exportRules: [],
    memberRules: memberRules.success,
    structure: EMPTY_STRUCTURE,
    fileSystem: makeFileSystemFake([]),
    resolver: makeModuleResolverFake({}),
    ignoreUnresolved: [],
  };
};

const PORT = path.join(
  repoRoot,
  "packages/server/src/modules/todos/domain/todo/todos.repository.ts",
);
const VIEW = path.join(repoRoot, "packages/web/features/todos/todos.view.tsx");

new RuleTester({ cwd: repoRoot }).run("members", makeMembersRule(policy()), {
  valid: [
    { code: "type TodosRepositoryShape = { readonly findOne: () => void };", filename: PORT },
    { code: "type TodosRepositoryShape = { upsertMany(): void };", filename: PORT },
    // A helper type in the same file is not the port, so `in` must not reach it.
    { code: "type TodoRow = { readonly findOneById: () => void };", filename: PORT },
    { code: "const a = useAtomValue(x);", filename: VIEW },
    { code: "const b = useId();", filename: VIEW },
    // A `use` name that is not a hook name.
    { code: "const c = useless();", filename: VIEW },
    // The same call in a file the rule does not select.
    { code: "const d = useState(0);", filename: PORT },
  ],
  invalid: [
    {
      code: "type TodosRepositoryShape = { readonly findOneById: (id: string) => void };",
      filename: PORT,
      errors: [{ message: /^\[dumb-repository-ports\] Port method "findOneById"/ }],
    },
    {
      code: "type TodosRepositoryShape = { grantRole(): void };",
      filename: PORT,
      errors: [{ message: /^\[dumb-repository-ports\] Port method "grantRole"/ }],
    },
    {
      code: "const a = useState(0);",
      filename: VIEW,
      errors: [{ message: /^\[view-hooks-allowlist\] `useState`/ }],
    },
    {
      // Member-expression form: `React.useEffect(...)`.
      code: "const a = React.useEffect(fn);",
      filename: VIEW,
      errors: [{ message: /^\[view-hooks-allowlist\] `useEffect`/ }],
    },
  ],
});
