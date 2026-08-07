import { describe, expect, it } from "@effect/vitest";
import { Command, Query } from "@org/cqrs";

import * as authModule from "@/modules/auth/index.js";
import * as billingModule from "@/modules/billing/index.js";
import * as organizationModule from "@/modules/organization/index.js";
import * as roleModule from "@/modules/role/index.js";
import * as todosModule from "@/modules/todos/index.js";
import * as userModule from "@/modules/user/index.js";
import * as walletModule from "@/modules/wallet/index.js";

// The completeness question no bus can answer. A definition that was never added
// to its module's group has no handler and no dispatcher, yet every
// `bus.execute(ThatCommand, …)` still compiles and would die at runtime. The bus
// cannot see it — it is not in any table — so the check has to come from the side
// that owns the modules.
//
// Reflection rather than a hand-kept list, so a command added to a barrel is
// covered without anyone remembering to edit this file. The boot-time
// `declaredIn` check in `cqrs-runtime.ts` covers the other direction: a group
// that exists but was never merged at the composition root.
const modules = {
  auth: authModule,
  billing: billingModule,
  organization: organizationModule,
  role: roleModule,
  todos: todosModule,
  user: userModule,
  wallet: walletModule,
} as const;

const orphanTags = (tags: ReadonlyArray<string>, grouped: ReadonlyArray<ReadonlyArray<string>>) => {
  const reachable = new Set(grouped.flat());
  return tags.filter((tag) => !reachable.has(tag));
};

describe("every published message belongs to a group", () => {
  for (const [name, published] of Object.entries(modules)) {
    const exported = Object.values(published);

    it(`${name} commands`, () => {
      const declared = exported.filter(Command.is).map((command) => command.tag);
      const grouped = exported.filter(Command.isGroup).map((group) => group.tags);

      expect(orphanTags(declared, grouped)).toEqual([]);
    });

    it(`${name} queries`, () => {
      const declared = exported.filter(Query.is).map((query) => query.tag);
      const grouped = exported.filter(Query.isGroup).map((group) => group.tags);

      expect(orphanTags(declared, grouped)).toEqual([]);
    });
  }

  // Guards the reflection itself: if the predicates or the barrels stopped
  // surfacing definitions, every assertion above would pass on an empty set and
  // this suite would be silently worthless.
  it("finds messages to check in the first place", () => {
    const found = Object.values(modules).flatMap((published) => {
      const exported = Object.values(published);
      return [...exported.filter(Command.is), ...exported.filter(Query.is)];
    });

    expect(found.length).toBeGreaterThan(20);
  });
});
