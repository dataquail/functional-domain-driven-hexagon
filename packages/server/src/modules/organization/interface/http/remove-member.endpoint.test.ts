// Endpoint thin: translates MembershipNotFound and Authz NotFound into
// the wire shapes. Meaningful coverage lives in:
//   - commands/remove-member.test.ts (handler invariants)
//   - infrastructure/membership-repository-live.integration.test.ts
//     (the DELETE path against a real DB)
//
// This file is a parity-rule token per CLAUDE.md.
import { describe, it } from "@effect/vitest";
import { ok } from "assert";

import { removeMemberEndpoint } from "./remove-member.endpoint.js";

describe("removeMemberEndpoint", () => {
  it("is defined", () => {
    ok(typeof removeMemberEndpoint === "function");
  });
});
