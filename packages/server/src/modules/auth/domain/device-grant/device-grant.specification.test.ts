import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { DeviceGrantId } from "./device-grant.id.js";
import { DeviceGrantRootOps } from "./device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "./device-grant.specification.js";

const id = DeviceGrantId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const start = () =>
  DeviceGrantRootOps.start({
    id,
    deviceCodeHash: "hash",
    userCode: "ABCD-2345",
    now,
    ttlSeconds: 600,
  });

describe("DeviceGrantSpecifications.isExpired", () => {
  it("is false before expiry and true at/after it", () => {
    const grant = start();
    deepStrictEqual(DeviceGrantSpecifications.isExpired(grant, now), false);
    deepStrictEqual(DeviceGrantSpecifications.isExpired(grant, grant.expiresAt), true);
    deepStrictEqual(
      DeviceGrantSpecifications.isExpired(grant, DateTime.add(grant.expiresAt, { seconds: 1 })),
      true,
    );
  });
});
