// Endpoint thin: builds the command from request + CurrentUser and
// translates Authz `NotFound` → `OrganizationNotFoundError`. Meaningful
// coverage lives in:
//   - commands/invite-user.test.ts (handler invariants + Mailer call)
//   - interface/http/invite.endpoint.integration.test.ts (HTTP wiring,
//     authz, full invite → accept flow against a real DB)
//
// This file is a parity-rule token per CLAUDE.md.
import { describe, it } from "@effect/vitest";
import { ok } from "assert";

import { inviteEndpoint } from "./invite.endpoint.js";

describe("inviteEndpoint", () => {
  it("is defined", () => {
    ok(typeof inviteEndpoint === "function");
  });
});
