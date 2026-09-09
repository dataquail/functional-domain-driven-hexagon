import { assert, describe, it } from "@effect/vitest";

import { BillingCommandsFake, BillingCommandsLive } from "@/modules/billing/index.js";
import { applicationModules } from "@/platform/modules/application-modules.js";

describe("applicationModules", () => {
  it("builds the modules in dependency order", () => {
    assert.deepStrictEqual(applicationModules(BillingCommandsLive).names, [
      "role",
      "user",
      "auth",
      "organization",
      "billing",
      "todos",
      "wallet",
    ]);
  });

  it("gives production and the test runtime the same order", () => {
    assert.deepStrictEqual(
      applicationModules(BillingCommandsFake).names,
      applicationModules(BillingCommandsLive).names,
    );
  });
});
