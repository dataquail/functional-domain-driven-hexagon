import * as Effect from "effect/Effect";
import type * as Hydration from "effect/reactivity/Hydration";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { serverRuntimeOverMsw } from "@/test/server-runtime";

const request = vi.hoisted(() => ({ locals: {} as Record<string, unknown> }));
vi.mock("$app/server", () => ({ getRequestEvent: () => request }));

const { prefetchUsers } = await import("@/services/data-access/users.server");
const { collectPrefetched, prefetchQuery } = await import("./prefetch.server");
const { usersQueryAtom } = await import("@/services/data-access/users.atoms");

afterEach(async () => {
  const runtime = request.locals.runtime as { dispose: () => Promise<void> } | undefined;
  await runtime?.dispose();
  request.locals = {};
});

describe("prefetchQuery", () => {
  it("encodes a fetched page into the entry a browser registry preloads", async () => {
    request.locals = { runtime: serverRuntimeOverMsw() };
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 1 })));

    const entry = await prefetchUsers({ page: 1, pageSize: 10 });

    expect((entry as Hydration.DehydratedAtomValue | null)?.key).toContain("1:10");
  });

  it("yields no entry when the fetch fails, so the browser fetches for itself", async () => {
    request.locals = { runtime: serverRuntimeOverMsw() };

    const entry = await prefetchQuery(
      usersQueryAtom({ page: 1, pageSize: 10 }),
      Effect.die("the server is unreachable"),
    );

    expect(entry).toBeNull();
  });
});

describe("collectPrefetched", () => {
  it("keeps the entries that were fetched and drops the ones that were not", async () => {
    request.locals = { runtime: serverRuntimeOverMsw() };
    server.use(usersHandlers.list(makePaginatedUsers({ users: [], total: 0 })));

    const entries = await collectPrefetched([
      prefetchUsers({ page: 1, pageSize: 10 }),
      Promise.resolve(null),
    ]);

    expect(entries).toHaveLength(1);
  });
});
