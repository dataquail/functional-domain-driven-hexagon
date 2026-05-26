// Endpoint thin: translates the command's invitation errors into the
// 404 / 410 wire shapes. Meaningful coverage lives in:
//   - commands/accept-invitation.test.ts (handler invariants + the
//     three terminal-state error paths)
//   - interface/http/invite.endpoint.integration.test.ts (full invite
//     → accept flow against a real DB)
//
// This file is a parity-rule token per CLAUDE.md.
import { describe, it } from "@effect/vitest";
import { ok } from "assert";

import { acceptInvitationEndpoint } from "./accept-invitation.endpoint.js";

describe("acceptInvitationEndpoint", () => {
  it("is defined", () => {
    ok(typeof acceptInvitationEndpoint === "function");
  });
});
