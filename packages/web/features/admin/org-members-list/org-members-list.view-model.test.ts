import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import { UserId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { makeOrganizationMember, ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import {
  demoteMemberActionAtom,
  orgMembersListAtom,
  orgMembersResultAtom,
  promoteMemberActionAtom,
  removeMemberActionAtom,
} from "./org-members-list.view-model";

const BOB_ID = UserId.make("88888888-8888-8888-8888-888888888888");

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const run = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("org members list ViewModel", () => {
  it("maps each member to a row, carrying the admin flag and joined date", async () => {
    server.use(
      orgsHandlers.findMembers([
        makeOrganizationMember({ isAdmin: true }),
        makeOrganizationMember({ userId: BOB_ID, email: "bob@example.com" }),
      ]),
    );

    const registry = makeRegistry();
    await run(registry, orgMembersResultAtom(ORG_A_ID));

    expect(registry.get(orgMembersListAtom(ORG_A_ID)).rows).toEqual([
      {
        userId: makeOrganizationMember().userId,
        email: "alice@example.com",
        joinedAtLabel: "2026-01-01",
        isAdmin: true,
      },
      { userId: BOB_ID, email: "bob@example.com", joinedAtLabel: "2026-01-01", isAdmin: false },
    ]);
  });

  it("reports emptiness only once the roster has arrived", async () => {
    server.use(orgsHandlers.findMembers([]));

    const registry = makeRegistry();
    expect(registry.get(orgMembersListAtom(ORG_A_ID)).isEmpty).toBe(false);

    await run(registry, orgMembersResultAtom(ORG_A_ID));

    expect(registry.get(orgMembersListAtom(ORG_A_ID)).isEmpty).toBe(true);
  });

  it("promotes the member it was given, in the org it was given", async () => {
    const promoted: Array<{ orgId: string; userId: string }> = [];
    server.use(
      orgsHandlers.findMembers([makeOrganizationMember()]),
      typedHandler(getEndpoint(OrganizationContract.Group, "promoteMember"), ({ path }) => {
        promoted.push({ orgId: path.orgId, userId: path.userId });
        return Effect.void;
      }),
    );

    const registry = makeRegistry();
    await run(registry, orgMembersResultAtom(ORG_A_ID));

    registry.set(promoteMemberActionAtom, { orgId: ORG_A_ID, userId: BOB_ID });
    await run(registry, promoteMemberActionAtom);

    expect(promoted).toEqual([{ orgId: ORG_A_ID, userId: BOB_ID }]);
    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Member promoted to admin.",
    });
  });

  it("surfaces a role conflict rather than claiming the demotion worked", async () => {
    server.use(
      orgsHandlers.findMembers([makeOrganizationMember()]),
      orgsHandlers.demoteMember({ result: "OrganizationRoleConflictError" }),
    );

    const registry = makeRegistry();
    await run(registry, orgMembersResultAtom(ORG_A_ID));

    registry.set(demoteMemberActionAtom, { orgId: ORG_A_ID, userId: BOB_ID });
    await run(registry, demoteMemberActionAtom).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Not an admin.",
    });
  });

  it("announces a removal", async () => {
    server.use(orgsHandlers.findMembers([makeOrganizationMember()]), orgsHandlers.removeMember());

    const registry = makeRegistry();
    await run(registry, orgMembersResultAtom(ORG_A_ID));

    registry.set(removeMemberActionAtom, { orgId: ORG_A_ID, userId: BOB_ID });
    await run(registry, removeMemberActionAtom);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Member removed.",
    });
  });
});
