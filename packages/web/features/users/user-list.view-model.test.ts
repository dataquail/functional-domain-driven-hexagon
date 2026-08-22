import * as UserContract from "@org/contracts/api/UserContract";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import {
  changePageAtom,
  computePaginationView,
  PAGE_SIZE,
  pageAtom,
  paginationAtom,
  usersResultAtom,
} from "./user-list.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("computePaginationView", () => {
  it("reports a single page and a zero range for an empty set", () => {
    const view = computePaginationView({ currentPage: 1, pageSize: 10, total: 0 });
    expect(view).toMatchObject({
      page: 1,
      totalPages: 1,
      isEmpty: true,
      hasPrevious: false,
      hasNext: false,
      displayedRange: { from: 0, to: 0 },
    });
  });

  it("clamps a page beyond the end back to the last page", () => {
    const view = computePaginationView({ currentPage: 99, pageSize: 10, total: 25 });
    expect(view.page).toBe(3);
    expect(view.hasNext).toBe(false);
    expect(view.displayedRange).toEqual({ from: 21, to: 25 });
  });

  it("clamps a page below one back to the first page", () => {
    expect(computePaginationView({ currentPage: 0, pageSize: 10, total: 25 }).page).toBe(1);
  });

  it("treats a non-positive page size as one, rather than dividing by zero", () => {
    const view = computePaginationView({ currentPage: 1, pageSize: 0, total: 3 });
    expect(view.pageSize).toBe(1);
    expect(view.totalPages).toBe(3);
  });
});

describe("user list ViewModel", () => {
  it("derives pagination from the fetched total", async () => {
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 25 })));

    const registry = makeRegistry();
    await settle(registry, usersResultAtom);

    expect(registry.get(paginationAtom)).toMatchObject({
      page: 1,
      pageSize: PAGE_SIZE,
      total: 25,
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("refetches the newly selected page from the server", async () => {
    const requestedPages: Array<number> = [];
    server.use(
      typedHandler(getEndpoint(UserContract.Group, "find"), ({ urlParams }) => {
        requestedPages.push(urlParams.page);
        return Effect.succeed(
          makePaginatedUsers({ users: [makeUser()], page: urlParams.page, total: 25 }),
        );
      }),
    );

    const registry = makeRegistry();
    await settle(registry, usersResultAtom);
    expect(requestedPages).toEqual([1]);

    registry.set(changePageAtom, "next");
    expect(registry.get(pageAtom)).toBe(2);

    await settle(registry, usersResultAtom);
    expect(requestedPages).toEqual([1, 2]);
    expect(registry.get(paginationAtom).page).toBe(2);
  });

  it("will not advance past the last page or retreat before the first", async () => {
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 15 })));

    const registry = makeRegistry();
    await settle(registry, usersResultAtom);

    registry.set(changePageAtom, "previous");
    expect(registry.get(pageAtom)).toBe(1);

    registry.set(changePageAtom, "next");
    await settle(registry, usersResultAtom);
    registry.set(changePageAtom, "next");
    expect(registry.get(pageAtom)).toBe(2);
  });
});
