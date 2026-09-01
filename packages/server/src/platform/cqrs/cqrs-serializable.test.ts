import { describe, expect, it } from "@effect/vitest";
import { Command, Event, Query } from "@effect-server-utils/cqrs";
import { checkEventsSerializable, checkSerializable } from "@effect-server-utils/cqrs/testing";
import * as Effect from "effect/Effect";

import * as authModule from "@/modules/auth/index.js";
import * as billingModule from "@/modules/billing/index.js";
import * as organizationModule from "@/modules/organization/index.js";
import * as roleModule from "@/modules/role/index.js";
import * as todosModule from "@/modules/todos/index.js";
import * as userModule from "@/modules/user/index.js";
import * as walletModule from "@/modules/wallet/index.js";

// ADR-0006 declares a message's channels as schemas rather than bare types so a
// module could be extracted and its messages could travel. In-process dispatch
// passes by reference and encodes nothing, so nothing else tests that claim: a
// payload that reached past the schema language — an aggregate behind
// `Schema.instanceOf`, a channel left as `Unknown` — dispatches perfectly today
// and could never cross a boundary.
//
// Reflection over the barrels, so a message added to a module is covered without
// anyone editing this file.
const modules = {
  auth: authModule,
  billing: billingModule,
  organization: organizationModule,
  role: roleModule,
  todos: todosModule,
  user: userModule,
  wallet: walletModule,
} as const;

describe("every published message can travel as JSON", () => {
  // Guards the reflection: an empty filter passes every assertion below, so a
  // predicate or barrel that stopped surfacing definitions would leave this suite
  // green and worthless.
  it("finds messages of all three kinds to check", () => {
    const exported: ReadonlyArray<unknown> = Object.values(modules).flatMap(
      (published): ReadonlyArray<unknown> => Object.values(published),
    );

    expect(exported.filter(Command.isGroup).length).toBeGreaterThan(5);
    expect(exported.filter(Query.isGroup).length).toBeGreaterThan(4);
    expect(exported.filter(Event.is).length).toBeGreaterThan(10);
  });

  for (const [name, published] of Object.entries(modules)) {
    const exported = Object.values(published);

    it(`${name} commands`, () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const found = yield* Effect.forEach(exported.filter(Command.isGroup), (group) =>
            checkSerializable(group),
          );
          expect(found.flat()).toEqual([]);
        }),
      ));

    it(`${name} queries`, () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const found = yield* Effect.forEach(exported.filter(Query.isGroup), (group) =>
            checkSerializable(group),
          );
          expect(found.flat()).toEqual([]);
        }),
      ));

    it(`${name} events`, () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const found = yield* checkEventsSerializable(exported.filter(Event.is));
          expect(found).toEqual([]);
        }),
      ));
  }
});
