import { describe, expect, it } from "@effect/vitest";
import { Command, Query } from "@effect-server-utils/cqrs";

import * as authModule from "@/modules/auth/auth.platform.js";
import * as billingModule from "@/modules/billing/billing.platform.js";
import * as organizationModule from "@/modules/organization/organization.platform.js";
import * as roleModule from "@/modules/role/role.platform.js";
import * as todosModule from "@/modules/todos/todos.platform.js";
import * as userModule from "@/modules/user/user.platform.js";
import * as walletModule from "@/modules/wallet/wallet.platform.js";

declare global {
  interface ImportMeta {
    readonly glob: (
      pattern: string,
      options: { readonly eager: true },
    ) => Record<string, Record<string, unknown>>;
  }
}

// The completeness question no bus can answer. A definition that was never added
// to its module's group has no handler and no dispatcher, yet every
// `bus.execute(ThatCommand, …)` still compiles and would die at runtime. The bus
// cannot see it — it is not in any table — so the check has to come from the side
// that owns the modules.
//
// The declared side is read off the files that declare messages, not off the
// barrels: a module publishes only what a consumer needs, so a barrel names
// almost none of its own messages and reflecting over one would check nothing.
// The groups still come from the barrels, which is where a module publishes them
// for the composition root. The boot-time `declaredIn` check in
// `cqrs-runtime.ts` covers the other direction: a group that exists but was
// never merged at the composition root.
const declaringFiles = {
  ...import.meta.glob("../../modules/*/commands/*.command.ts", { eager: true }),
  ...import.meta.glob("../../modules/*/queries/*.query.ts", { eager: true }),
};

const groupSources = {
  auth: authModule,
  billing: billingModule,
  organization: organizationModule,
  role: roleModule,
  todos: todosModule,
  user: userModule,
  wallet: walletModule,
} as const;

const moduleOf = (file: string) => /modules\/([a-z-]+)\//.exec(file)?.[1];

const declaredIn = (name: string) =>
  Object.entries(declaringFiles)
    .filter(([file]) => moduleOf(file) === name)
    .flatMap(([, declared]) => Object.values(declared));

const orphanTags = (tags: ReadonlyArray<string>, grouped: ReadonlyArray<ReadonlyArray<string>>) => {
  const reachable = new Set(grouped.flat());
  return tags.filter((tag) => !reachable.has(tag));
};

describe("every declared message belongs to a group", () => {
  for (const [name, published] of Object.entries(groupSources)) {
    const exported = Object.values(published);
    const declared = declaredIn(name);

    it(`${name} commands`, () => {
      const tags = declared.filter(Command.is).map((command) => command.tag);
      const grouped = exported.filter(Command.isGroup).map((group) => group.tags);

      expect(orphanTags(tags, grouped)).toEqual([]);
    });

    it(`${name} queries`, () => {
      const tags = declared.filter(Query.is).map((query) => query.tag);
      const grouped = exported.filter(Query.isGroup).map((group) => group.tags);

      expect(orphanTags(tags, grouped)).toEqual([]);
    });
  }

  // Guards the reflection itself: if the predicates, the glob or the barrels
  // stopped surfacing definitions, every assertion above would pass on an empty
  // set and this suite would be silently worthless.
  it("finds messages to check in the first place", () => {
    const found = Object.values(declaringFiles).flatMap((declared) => {
      const values = Object.values(declared);
      return [...values.filter(Command.is), ...values.filter(Query.is)];
    });

    expect(found.length).toBeGreaterThan(20);
  });

  // The per-module assertions above key the declared set off the file path. If
  // that mapping broke, each would pass on an empty set while the global count
  // above still held.
  it("maps declared messages to every module", () => {
    for (const name of Object.keys(groupSources)) {
      expect(declaredIn(name).length, `${name} declares no message`).toBeGreaterThan(0);
    }
  });

  it("finds a group in every module to check them against", () => {
    for (const [name, published] of Object.entries(groupSources)) {
      const exported = Object.values(published);
      const groups = [...exported.filter(Command.isGroup), ...exported.filter(Query.isGroup)];

      expect(groups.length, `${name} publishes no group`).toBeGreaterThan(0);
    }
  });
});
