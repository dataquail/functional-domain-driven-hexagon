import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import { screen } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { ORG_B_ID } from "@/test/fixtures/organization";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import AcceptInvitation from "./accept-invitation.view.svelte";

const acceptEndpoint = getEndpoint(OrganizationContract.InvitationGroup, "accept");

describe("AcceptInvitation view", () => {
  it("accepts the invitation its route was opened for", async () => {
    const tokens: Array<string> = [];
    server.use(
      typedHandler(acceptEndpoint, ({ path }) => {
        tokens.push(path.token);

        return Effect.succeed(
          new OrganizationContract.AcceptInvitationResponse({ organizationId: ORG_B_ID }),
        );
      }),
    );
    renderView(
      AcceptInvitation,
      { token: "tok-123" },
      { initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]] },
    );

    await userEvent.click(screen.getByTestId("invitation-accept"));

    await expect.poll(() => tokens).toEqual(["tok-123"]);
  });
});
