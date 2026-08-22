import * as UserContract from "@org/contracts/api/UserContract";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Hydration from "effect/unstable/reactivity/Hydration";
import { describe, expect, it } from "vitest";

import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { ApiAtoms } from "./api-atoms.shared";
import { apiTransportAtom } from "./api-transport.shared";
import { dehydrateQuery } from "./dehydration.shared";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const usersQuery = (page: number) =>
  ApiAtoms.query("user", "find", {
    query: new UserContract.FindUsersParams({ page, pageSize: 10 }),
    serializationKey: `${page}:10`,
  });

const settle = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("ApiAtoms", () => {
  it("routes a query atom through the transport atom and decodes the contract response", async () => {
    const alice = makeUser({ email: "alice@example.com" });
    server.use(usersHandlers.list([alice]));

    const registry = makeRegistry();
    const value = await settle(registry, usersQuery(1));

    expect(value.users.map((user) => user.email)).toEqual(["alice@example.com"]);
    expect(value.total).toBe(1);
  });

  it("memoises a query atom on its request, so the same page is one atom", () => {
    expect(usersQuery(1)).toBe(usersQuery(1));
    expect(usersQuery(1)).not.toBe(usersQuery(2));
  });

  it("hydrates a server-dehydrated page into a fresh registry without an HTTP call", async () => {
    // No MSW handler is registered, and the lifecycle errors on any
    // unhandled request — so a fetch here would fail the test outright.
    const page = makePaginatedUsers({ users: [makeUser({ email: "bob@example.com" })] });

    const dehydrated = [dehydrateQuery(usersQuery(1), page)];

    const registry = makeRegistry();
    Hydration.hydrate(registry, dehydrated);

    const value = await settle(registry, usersQuery(1));
    expect(value.users.map((user) => user.email)).toEqual(["bob@example.com"]);
  });

  it("never builds an atom runtime while dehydrating, so the module-global memo map stays empty", () => {
    const before = Atom.defaultMemoMap;
    dehydrateQuery(usersQuery(7), makePaginatedUsers());
    expect(Atom.defaultMemoMap).toBe(before);
  });
});
