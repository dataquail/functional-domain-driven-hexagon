import { assert, describe, it } from "@effect/vitest";

import { BillingModule, BillingModuleFake } from "@/modules/billing/index.js";
import { applicationModules } from "@/platform/modules/application-modules.js";

describe("applicationModules", () => {
  it("builds the modules in dependency order", () => {
    assert.deepStrictEqual(applicationModules(BillingModule).names, [
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
      applicationModules(BillingModuleFake).names,
      applicationModules(BillingModule).names,
    );
  });
});
