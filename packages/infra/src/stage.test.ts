import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";

import { kindOfStage, previewBranchExpiresAt } from "./stage.js";

describe("kindOfStage", () => {
  it("keeps prod and staging on databases of their own", () => {
    expect(kindOfStage("prod")).toBe("long-lived");
    expect(kindOfStage("staging")).toBe("long-lived");
  });

  it("treats a pull-request or personal stage as a preview of staging", () => {
    expect(kindOfStage("pr-42")).toBe("preview");
    expect(kindOfStage("dev_alice")).toBe("preview");
  });
});

describe("previewBranchExpiresAt", () => {
  it("expires a preview branch a week after the deploy that last touched it", () => {
    const deployedAt = DateTime.makeUnsafe("2026-10-10T12:00:00Z");

    expect(previewBranchExpiresAt(deployedAt)).toBe("2026-10-17T12:00:00.000Z");
  });
});
