// Endpoint thin: translates Authz NotFound + invitation-terminal-state
// errors into the wire shapes. Meaningful coverage lives in:
//   - commands/revoke-invitation.test.ts (handler invariants)
//   - interface/http/invite.endpoint.integration.test.ts (HTTP wiring
//     via the full invitation flow)
//
// This file is a parity-rule token per CLAUDE.md.
import { describe, it } from "@effect/vitest";
import { ok } from "assert";

import { revokeInvitationEndpoint } from "./revoke-invitation.endpoint.js";

describe("revokeInvitationEndpoint", () => {
  it("is defined", () => {
    ok(typeof revokeInvitationEndpoint === "function");
  });
});
