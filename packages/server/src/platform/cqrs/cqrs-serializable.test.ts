import { describe, expect, it } from "@effect/vitest";
import { Command, Event, Query } from "@effect-server-utils/cqrs";
import { checkEventsSerializable, checkSerializable } from "@effect-server-utils/cqrs/testing";
import * as Effect from "effect/Effect";

import * as authModule from "@/modules/auth/auth.platform.js";
import * as billingModule from "@/modules/billing/billing.platform.js";
import * as organizationModule from "@/modules/organization/organization.platform.js";
import * as roleModule from "@/modules/role/role.platform.js";
import * as todosModule from "@/modules/todos/todos.platform.js";
import * as userModule from "@/modules/user/user.platform.js";
import * as walletModule from "@/modules/wallet/wallet.platform.js";

// ADR-0006 declares a message's channels as schemas rather than bare types so a
// module could be extracted and its messages could travel. In-process dispatch
// passes by reference and encodes nothing, so nothing else tests that claim: a
// payload that reached past the schema language — an aggregate behind
// `Schema.instanceOf`, a channel left as `Unknown` — dispatches perfectly today
// and could never cross a boundary.
//
// Command and query groups come from the barrels, which is where a module
// publishes them for the composition root. Domain events are read off the files
// that declare them: a module publishes an event only when a peer subscribes to
// it, so the barrels name almost none of their own and reflecting over one would
// check nothing.
const groupSources = {
  auth: authModule,
  billing: billingModule,
  organization: organizationModule,
  role: roleModule,
  todos: todosModule,
  user: userModule,
  wallet: walletModule,
} as const;

const eventFiles = import.meta.glob("../../modules/*/domain/*/*.events.ts", { eager: true });

const moduleOf = (file: string) => /modules\/([a-z-]+)\//.exec(file)?.[1];

const eventsIn = (name: string) =>
  Object.entries(eventFiles)
    .filter(([file]) => moduleOf(file) === name)
    .flatMap(([, declared]) => Object.values(declared))
    .filter(Event.is);

describe("every declared message can travel as JSON", () => {
  // Guards the reflection: an empty filter passes every assertion below, so a
  // predicate, a glob or a barrel that stopped surfacing definitions would leave
  // this suite green and worthless.
  it("finds messages of all three kinds to check", () => {
    const exported: ReadonlyArray<unknown> = Object.values(groupSources).flatMap(
      (published): ReadonlyArray<unknown> => Object.values(published),
    );
    const events = Object.values(eventFiles).flatMap((declared) =>
      Object.values(declared).filter(Event.is),
    );

    expect(exported.filter(Command.isGroup).length).toBeGreaterThan(5);
    expect(exported.filter(Query.isGroup).length).toBeGreaterThan(4);
    expect(events.length).toBeGreaterThan(10);
  });

  for (const [name, published] of Object.entries(groupSources)) {
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
          const found = yield* checkEventsSerializable(eventsIn(name));
          expect(found).toEqual([]);
        }),
      ));
  }
});
