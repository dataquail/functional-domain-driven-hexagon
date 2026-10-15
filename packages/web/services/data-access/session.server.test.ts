import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Option from "effect/Option";
import { afterEach, describe, expect, it } from "vitest";

import type { ServerRuntime } from "@/services/runtime.server";
import { makeMyOrganization, ORG_A_ID, ORG_B_ID } from "@/test/fixtures/organization";
import { handlers } from "@/test/handlers/handler-set";
import { endRequest, serveRequest } from "@/test/kit/server";
import { server } from "@/test/msw-server";
import { serverRuntimeOverMsw } from "@/test/server-runtime";

import { fetchCurrentUser } from "./me.server";
import { fetchMyOrgRole } from "./my-orgs.server";

const runtimes: Array<ServerRuntime> = [];

const serve = (cookieHeader = "") => {
  const runtime = serverRuntimeOverMsw(cookieHeader);
  runtimes.push(runtime);
  serveRequest({ locals: { runtime } });
};

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(async (runtime) => runtime.dispose()));
  endRequest();
});

describe("fetchCurrentUser", () => {
  it("resolves the signed-in user", async () => {
    serve("session=abc");
    server.use(handlers.auth.signedInAs({ isSuperAdmin: true }));

    expect(Option.getOrThrow(await fetchCurrentUser())).toMatchObject({ isSuperAdmin: true });
  });

  it("resolves none when there is no session", async () => {
    serve();

    assertNone(await fetchCurrentUser());
  });
});

describe("fetchMyOrgRole", () => {
  it("reads the caller's role in an org from their memberships", async () => {
    serve("session=abc");
    server.use(
      handlers.orgs.findMine([
        makeMyOrganization({ id: ORG_A_ID, isAdmin: true }),
        makeMyOrganization({ id: ORG_B_ID, isAdmin: false }),
      ]),
    );

    assertSome(await fetchMyOrgRole(ORG_A_ID), "admin");
    assertSome(await fetchMyOrgRole(ORG_B_ID), "member");
  });

  it("is none for an org the caller does not belong to", async () => {
    serve("session=abc");
    server.use(handlers.orgs.findMine([]));

    assertNone(await fetchMyOrgRole(ORG_A_ID));
  });
});
