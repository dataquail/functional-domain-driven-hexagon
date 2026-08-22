import { InvitationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { makePendingInvitation, ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  orgInvitationsListAtom,
  orgInvitationsResultAtom,
  resendInvitationActionAtom,
  revokeInvitationActionAtom,
} from "./org-invitations-list.view-model";

const LAPSED_ID = InvitationId.make("99999999-9999-9999-9999-999999999999");

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const run = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("org invitations list ViewModel", () => {
  it("flags a lapsed invitation as expired and a live one as not", async () => {
    server.use(
      orgsHandlers.findInvitations([
        makePendingInvitation(),
        makePendingInvitation({
          invitationId: LAPSED_ID,
          inviteeEmail: "lapsed@example.com",
          status: "expired",
        }),
      ]),
    );

    const registry = makeRegistry();
    await run(registry, orgInvitationsResultAtom(ORG_A_ID));

    expect(registry.get(orgInvitationsListAtom(ORG_A_ID)).rows).toEqual([
      {
        invitationId: makePendingInvitation().invitationId,
        email: "invitee@example.com",
        isExpired: false,
        expiresAtLabel: "2026-01-01",
      },
      {
        invitationId: LAPSED_ID,
        email: "lapsed@example.com",
        isExpired: true,
        expiresAtLabel: "2026-01-01",
      },
    ]);
  });

  it("reports emptiness only once the list has arrived", async () => {
    server.use(orgsHandlers.findInvitations([]));

    const registry = makeRegistry();
    expect(registry.get(orgInvitationsListAtom(ORG_A_ID)).isEmpty).toBe(false);

    await run(registry, orgInvitationsResultAtom(ORG_A_ID));

    expect(registry.get(orgInvitationsListAtom(ORG_A_ID)).isEmpty).toBe(true);
  });

  it("announces a resend", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.resendInvitation(),
    );

    const registry = makeRegistry();
    await run(registry, orgInvitationsResultAtom(ORG_A_ID));

    registry.set(resendInvitationActionAtom, {
      orgId: ORG_A_ID,
      invitationId: makePendingInvitation().invitationId,
    });
    await run(registry, resendInvitationActionAtom);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Invitation resent.",
    });
  });

  it("surfaces the server's message when the invitation is already closed", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.resendInvitation({ result: "InvitationGoneError" }),
    );

    const registry = makeRegistry();
    await run(registry, orgInvitationsResultAtom(ORG_A_ID));

    registry.set(resendInvitationActionAtom, {
      orgId: ORG_A_ID,
      invitationId: makePendingInvitation().invitationId,
    });
    await run(registry, resendInvitationActionAtom).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Invitation is closed.",
    });
  });

  it("announces a revoke", async () => {
    server.use(
      orgsHandlers.findInvitations([makePendingInvitation()]),
      orgsHandlers.revokeInvitation(),
    );

    const registry = makeRegistry();
    await run(registry, orgInvitationsResultAtom(ORG_A_ID));

    registry.set(revokeInvitationActionAtom, {
      orgId: ORG_A_ID,
      invitationId: makePendingInvitation().invitationId,
    });
    await run(registry, revokeInvitationActionAtom);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Invitation revoked.",
    });
  });
});
