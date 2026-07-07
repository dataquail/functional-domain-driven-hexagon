// Endpoint thin: dispatches LeaveOrganizationCommand with
// CurrentUser.userId; no Authz check (membership existence IS the
// gate). Meaningful coverage lives in:
//   - commands/leave-organization.test.ts (handler invariants)
//   - infrastructure/repositories/membership-repository-live.integration.test.ts
//     (the DELETE path against a real DB)
//
// This file is a parity-rule token per CLAUDE.md.
import { describe, it } from "@effect/vitest";
import { ok } from "assert";

import { leaveEndpoint } from "./leave.endpoint.js";

describe("leaveEndpoint", () => {
  it("is defined", () => {
    ok(typeof leaveEndpoint === "function");
  });
});
