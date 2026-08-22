import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { navigationRequestAtom } from "@/services/atom/navigation.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { ORG_B_ID } from "@/test/fixtures/organization";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import { acceptAtom } from "./accept-invitation.view-model";

const acceptEndpoint = getEndpoint(OrganizationContract.InvitationGroup, "accept");

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const accept = (registry: AtomRegistry.AtomRegistry, token: string) => {
  registry.set(acceptAtom, token);
  return Effect.runPromise(
    AtomRegistry.getResult(registry, acceptAtom, { suspendOnWaiting: true }),
  );
};

describe("accept invitation ViewModel", () => {
  it("moves the caller into the org they just joined", async () => {
    const tokens: Array<string> = [];
    server.use(
      typedHandler(acceptEndpoint, ({ path }) => {
        tokens.push(path.token);
        return Effect.succeed(
          new OrganizationContract.AcceptInvitationResponse({ organizationId: ORG_B_ID }),
        );
      }),
    );

    const registry = makeRegistry();
    await accept(registry, "tok-123");

    expect(tokens).toEqual(["tok-123"]);
    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Invitation accepted!",
    });
    expect(registry.get(navigationRequestAtom)?.href).toBe(`/orgs/${ORG_B_ID}`);
  });

  it("stays on the page when the invitation is already closed, so the reason can be read", async () => {
    server.use(
      typedHandler(acceptEndpoint, () =>
        Effect.fail(
          new OrganizationContract.InvitationGoneError({
            reason: "revoked",
            message: "That invitation was revoked.",
          }),
        ),
      ),
    );

    const registry = makeRegistry();
    await accept(registry, "tok-123").catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "That invitation was revoked.",
    });
    expect(registry.get(navigationRequestAtom)).toBeNull();
  });
});
