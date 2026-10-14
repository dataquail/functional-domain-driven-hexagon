import * as Effect from "effect/Effect";
import * as Hydration from "effect/reactivity/Hydration";
import { afterEach, describe, expect, it } from "vitest";

import { usersQueryAtom } from "@/services/data-access/users.atoms";
import { prefetchUsers } from "@/services/data-access/users.server";
import type { ServerRuntime } from "@/services/runtime.server";
import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { endRequest, serveRequest } from "@/test/kit/server";
import { server } from "@/test/msw-server";
import { serverRuntimeOverMsw } from "@/test/server-runtime";

import { collectPrefetched, prefetchQuery } from "./prefetch.server";

const runtimes: Array<ServerRuntime> = [];

const serve = () => {
  const runtime = serverRuntimeOverMsw();
  runtimes.push(runtime);
  serveRequest({ locals: { runtime } });
};

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(async (runtime) => runtime.dispose()));
  endRequest();
});

const unreachable = prefetchQuery(
  usersQueryAtom({ page: 1, pageSize: 10 }),
  Effect.die("the server is unreachable"),
);

describe("collectPrefetched", () => {
  it("encodes a fetched page into the entry a browser registry preloads", async () => {
    serve();
    server.use(usersHandlers.list(makePaginatedUsers({ users: [makeUser()], total: 1 })));

    const entries = await collectPrefetched([prefetchUsers({ page: 1, pageSize: 10 })]);

    const keys = Hydration.toValues(entries).map((entry) => entry.key);

    expect(keys).toHaveLength(1);
    expect(keys[0]).toContain("1:10");
  });

  it("yields no entry when the fetch fails, so the browser fetches for itself", async () => {
    serve();

    expect(await collectPrefetched([unreachable])).toEqual([]);
  });

  it("keeps the entries that were fetched and drops the ones that were not", async () => {
    serve();
    server.use(usersHandlers.list(makePaginatedUsers({ users: [], total: 0 })));

    const entries = await collectPrefetched([
      prefetchUsers({ page: 1, pageSize: 10 }),
      unreachable,
    ]);

    expect(entries).toHaveLength(1);
  });
});
