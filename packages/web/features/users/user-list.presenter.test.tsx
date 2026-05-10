import { makePresenterHarness } from "@/test/presenter-harness";
import { UserContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";
import { act, renderHook, waitFor } from "@testing-library/react";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUserListPresenter } from "./user-list.presenter";

const mkUser = (i: number): UserContract.User =>
  new UserContract.User({
    id: UserId.make(`11111111-1111-1111-1111-${i.toString().padStart(12, "0")}`),
    email: `u${i}@example.com`,
    role: "guest",
    address: { country: "USA", street: "Main", postalCode: "12345" },
    createdAt: DateTime.unsafeFromDate(new Date("2026-01-01T00:00:00Z")),
    updatedAt: DateTime.unsafeFromDate(new Date("2026-01-01T00:00:00Z")),
  });

const makeApiClient = (opts: {
  readonly find?: (urlParams: {
    page: number;
    pageSize: number;
  }) => Effect.Effect<UserContract.PaginatedUsers>;
}) => ({
  user: {
    find: (args: { urlParams: { page: number; pageSize: number } }) =>
      opts.find?.(args.urlParams) ??
      Effect.succeed(
        new UserContract.PaginatedUsers({
          users: [],
          page: args.urlParams.page,
          pageSize: args.urlParams.pageSize,
          total: 0,
        }),
      ),
    create: () => Effect.die("not used"),
  },
});

let harness: ReturnType<typeof makePresenterHarness>;

beforeEach(() => {
  harness = makePresenterHarness({ apiClient: makeApiClient({}) });
});

afterEach(async () => {
  await harness.dispose();
});

describe("useUserListPresenter — empty state", () => {
  it("reports isEmpty=true, totalPages=1, and disables both nav directions when there are no users", async () => {
    const { result } = renderHook(() => useUserListPresenter(), { wrapper: harness.wrapper });
    await waitFor(() => {
      expect(result.current.users).toEqual([]);
    });
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.total).toBe(0);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(false);
  });
});

describe("useUserListPresenter — pagination", () => {
  it("populates users, total, and computes totalPages from total and pageSize", async () => {
    const users = [mkUser(1), mkUser(2), mkUser(3)];
    harness = makePresenterHarness({
      apiClient: makeApiClient({
        find: (vars) =>
          Effect.succeed(
            new UserContract.PaginatedUsers({
              users,
              page: vars.page,
              pageSize: vars.pageSize,
              total: 25,
            }),
          ),
      }),
    });

    const { result } = renderHook(() => useUserListPresenter({ pageSize: 10 }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.users).toEqual(users);
    });
    expect(result.current.total).toBe(25);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.page).toBe(1);
    expect(result.current.hasPrev).toBe(false);
    expect(result.current.hasNext).toBe(true);
  });

  it("goNext advances the page and triggers a new fetch keyed on the new page", async () => {
    const seenPages: Array<number> = [];
    harness = makePresenterHarness({
      apiClient: makeApiClient({
        find: (vars) => {
          seenPages.push(vars.page);
          return Effect.succeed(
            new UserContract.PaginatedUsers({
              users: [mkUser(vars.page)],
              page: vars.page,
              pageSize: vars.pageSize,
              total: 25,
            }),
          );
        },
      }),
    });

    const { result } = renderHook(() => useUserListPresenter({ pageSize: 10 }), {
      wrapper: harness.wrapper,
    });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
    });
    act(() => {
      result.current.goNext();
    });

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    // The new page triggered a refetch keyed on page=2.
    expect(seenPages).toContain(2);
  });

  it("clamps goNext at totalPages and disables hasNext at the last page", async () => {
    harness = makePresenterHarness({
      apiClient: makeApiClient({
        find: (vars) =>
          Effect.succeed(
            new UserContract.PaginatedUsers({
              users: [mkUser(1)],
              page: vars.page,
              pageSize: vars.pageSize,
              total: 15,
            }),
          ),
      }),
    });

    const { result } = renderHook(() => useUserListPresenter({ pageSize: 10 }), {
      wrapper: harness.wrapper,
    });
    await waitFor(() => {
      expect(result.current.totalPages).toBe(2);
    });

    act(() => {
      result.current.goNext();
    });
    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(result.current.hasNext).toBe(false);

    act(() => {
      result.current.goNext();
    });
    // Already at the last page — page stays at totalPages.
    expect(result.current.page).toBe(2);
  });

  it("clamps goPrev at page 1", async () => {
    const { result } = renderHook(() => useUserListPresenter(), { wrapper: harness.wrapper });
    await waitFor(() => {
      expect(result.current.page).toBe(1);
    });
    act(() => {
      result.current.goPrev();
    });
    expect(result.current.page).toBe(1);
  });
});
