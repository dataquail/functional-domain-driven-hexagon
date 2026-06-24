import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import * as DeviceGrant from "./device-grant.aggregate.js";
import { DeviceGrantId } from "./device-grant-id.js";

const id = DeviceGrantId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const start = () =>
  DeviceGrant.start({ id, deviceCodeHash: "hash", userCode: "ABCD-2345", now, ttlSeconds: 600 });

describe("DeviceGrant.start", () => {
  it("creates a pending, unapproved grant with a TTL'd expiry", () => {
    const grant = start();
    deepStrictEqual(grant.status, "pending");
    deepStrictEqual(grant.userId, null);
    deepStrictEqual(grant.approvedAt, null);
    deepStrictEqual(grant.createdAt, now);
    deepStrictEqual(grant.expiresAt, DateTime.add(now, { seconds: 600 }));
  });
});

describe("DeviceGrant.approve", () => {
  it("binds the grant to the approving user and stamps approvedAt", () => {
    const later = DateTime.add(now, { seconds: 30 });
    const approved = DeviceGrant.approve({ grant: start(), userId, now: later });
    deepStrictEqual(approved.status, "approved");
    deepStrictEqual(approved.userId, userId);
    deepStrictEqual(approved.approvedAt, later);
    // identity + lifecycle window preserved
    deepStrictEqual(approved.id, id);
    deepStrictEqual(approved.expiresAt, start().expiresAt);
  });
});

describe("DeviceGrant.isExpired", () => {
  it("is false before expiry and true at/after it", () => {
    const grant = start();
    deepStrictEqual(DeviceGrant.isExpired(grant, now), false);
    deepStrictEqual(DeviceGrant.isExpired(grant, grant.expiresAt), true);
    deepStrictEqual(
      DeviceGrant.isExpired(grant, DateTime.add(grant.expiresAt, { seconds: 1 })),
      true,
    );
  });
});
