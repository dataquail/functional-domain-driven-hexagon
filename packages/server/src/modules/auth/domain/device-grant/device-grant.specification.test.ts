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

describe("DeviceGrantSpecifications.withCodeHash", () => {
  it("matches the grant with the given device-code hash and no other", () => {
    const grant = start();
    deepStrictEqual(DeviceGrantSpecifications.withCodeHash("hash")(grant), true);
    deepStrictEqual(DeviceGrantSpecifications.withCodeHash("other")(grant), false);
  });

  it("carries an Eq criteria over the device_code_hash column", () => {
    deepStrictEqual(DeviceGrantSpecifications.withCodeHash("hash").criteria, {
      _tag: "Eq",
      field: "deviceCodeHash",
      value: "hash",
    });
  });
});

describe("DeviceGrantSpecifications.withUserCode", () => {
  it("matches the grant with the given user code and no other", () => {
    const grant = start();
    deepStrictEqual(DeviceGrantSpecifications.withUserCode("ABCD-2345")(grant), true);
    deepStrictEqual(DeviceGrantSpecifications.withUserCode("ZZZZ-9999")(grant), false);
  });

  it("carries an Eq criteria over the user_code column", () => {
    deepStrictEqual(DeviceGrantSpecifications.withUserCode("ABCD-2345").criteria, {
      _tag: "Eq",
      field: "userCode",
      value: "ABCD-2345",
    });
  });
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
