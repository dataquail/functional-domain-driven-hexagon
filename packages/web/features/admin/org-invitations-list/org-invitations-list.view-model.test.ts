import { describe, expect, it } from "@effect/vitest";
import { InvitationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

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
) => AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true });

describe("org invitations list ViewModel", () => {
  it.effect("flags a lapsed invitation as expired and a live one as not", () =>
    Effect.gen(function* () {
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
      yield* run(registry, orgInvitationsResultAtom(ORG_A_ID));

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
    }),
  );

  it.effect("reports emptiness only once the list has arrived", () =>
    Effect.gen(function* () {
      server.use(orgsHandlers.findInvitations([]));

      const registry = makeRegistry();
      expect(registry.get(orgInvitationsListAtom(ORG_A_ID)).isEmpty).toBe(false);

      yield* run(registry, orgInvitationsResultAtom(ORG_A_ID));

      expect(registry.get(orgInvitationsListAtom(ORG_A_ID)).isEmpty).toBe(true);
    }),
  );

  it.effect("announces a resend", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findInvitations([makePendingInvitation()]),
        orgsHandlers.resendInvitation(),
      );

      const registry = makeRegistry();
      yield* run(registry, orgInvitationsResultAtom(ORG_A_ID));

      registry.set(resendInvitationActionAtom, {
        orgId: ORG_A_ID,
        invitationId: makePendingInvitation().invitationId,
      });
      yield* run(registry, resendInvitationActionAtom);

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Invitation resent.",
      });
    }),
  );

  it.effect("surfaces the server's message when the invitation is already closed", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findInvitations([makePendingInvitation()]),
        orgsHandlers.resendInvitation({ result: "InvitationGoneError" }),
      );

      const registry = makeRegistry();
      yield* run(registry, orgInvitationsResultAtom(ORG_A_ID));

      registry.set(resendInvitationActionAtom, {
        orgId: ORG_A_ID,
        invitationId: makePendingInvitation().invitationId,
      });
      yield* Effect.exit(run(registry, resendInvitationActionAtom));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "Invitation is closed.",
      });
    }),
  );

  it.effect("announces a revoke", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findInvitations([makePendingInvitation()]),
        orgsHandlers.revokeInvitation(),
      );

      const registry = makeRegistry();
      yield* run(registry, orgInvitationsResultAtom(ORG_A_ID));

      registry.set(revokeInvitationActionAtom, {
        orgId: ORG_A_ID,
        invitationId: makePendingInvitation().invitationId,
      });
      yield* run(registry, revokeInvitationActionAtom);

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Invitation revoked.",
      });
    }),
  );
});
