import { afterEach, describe, expect, it, vi } from "vitest";

import { makeMyOrganization, ORG_A_ID, ORG_B_ID } from "@/test/fixtures/organization";
import { handlers } from "@/test/handlers";
import { server } from "@/test/msw-server";
import { serverRuntimeOverMsw } from "@/test/server-runtime";

const request = vi.hoisted(() => ({ locals: {} as Record<string, unknown> }));
vi.mock("$app/server", () => ({ getRequestEvent: () => request }));

const { fetchCurrentUser } = await import("./me.server");
const { fetchMyOrgRole } = await import("./my-orgs.server");

afterEach(async () => {
  const runtime = request.locals.runtime as { dispose: () => Promise<void> } | undefined;
  await runtime?.dispose();
  request.locals = {};
});

describe("fetchCurrentUser", () => {
  it("resolves the signed-in user", async () => {
    request.locals = { runtime: serverRuntimeOverMsw("session=abc") };
    server.use(handlers.auth.signedInAs({ isSuperAdmin: true }));

    expect(await fetchCurrentUser()).toMatchObject({ isSuperAdmin: true });
  });

  it("resolves null when there is no session", async () => {
    request.locals = { runtime: serverRuntimeOverMsw() };

    expect(await fetchCurrentUser()).toBeNull();
  });
});

describe("fetchMyOrgRole", () => {
  it("reads the caller's role in an org from their memberships", async () => {
    request.locals = { runtime: serverRuntimeOverMsw("session=abc") };
    server.use(
      handlers.orgs.findMine([
        makeMyOrganization({ id: ORG_A_ID, isAdmin: true }),
        makeMyOrganization({ id: ORG_B_ID, isAdmin: false }),
      ]),
    );

    expect(await fetchMyOrgRole(ORG_A_ID)).toBe("admin");
    expect(await fetchMyOrgRole(ORG_B_ID)).toBe("member");
  });

  it("is undefined for an org the caller does not belong to", async () => {
    request.locals = { runtime: serverRuntimeOverMsw("session=abc") };
    server.use(handlers.orgs.findMine([]));

    expect(await fetchMyOrgRole(ORG_A_ID)).toBeUndefined();
  });
});
