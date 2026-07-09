import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok, throws } from "assert";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import { DeviceGrantId } from "./device-grant.id.js";
import { DeviceGrantRootOps, USER_CODE_ALPHABET } from "./device-grant.root.js";

const id = DeviceGrantId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const start = () =>
  DeviceGrantRootOps.start({
    id,
    deviceCodeHash: "hash",
    userCode: "ABCD-2345",
    now,
    ttlSeconds: 600,
  });

describe("DeviceGrantRootOps.start", () => {
  it("creates a pending, unapproved grant with a TTL'd expiry", () => {
    const grant = start();
    deepStrictEqual(grant.status, "pending");
    deepStrictEqual(grant.userId, null);
    deepStrictEqual(grant.approvedAt, null);
    deepStrictEqual(grant.createdAt, now);
    deepStrictEqual(grant.expiresAt, DateTime.add(now, { seconds: 600 }));
  });
});

describe("DeviceGrantRootOps.approve", () => {
  it("binds the grant to the approving user and stamps approvedAt", () => {
    const later = DateTime.add(now, { seconds: 30 });
    const approved = DeviceGrantRootOps.approve({ grant: start(), userId, now: later });
    deepStrictEqual(approved.status, "approved");
    deepStrictEqual(approved.userId, userId);
    deepStrictEqual(approved.approvedAt, later);
    // identity + lifecycle window preserved
    deepStrictEqual(approved.id, id);
    deepStrictEqual(approved.expiresAt, start().expiresAt);
  });
});

describe("DeviceGrantRootOps.isExpired", () => {
  it("is false before expiry and true at/after it", () => {
    const grant = start();
    deepStrictEqual(DeviceGrantRootOps.isExpired(grant, now), false);
    deepStrictEqual(DeviceGrantRootOps.isExpired(grant, grant.expiresAt), true);
    deepStrictEqual(
      DeviceGrantRootOps.isExpired(grant, DateTime.add(grant.expiresAt, { seconds: 1 })),
      true,
    );
  });
});

describe("DeviceGrantRootOps.toUserCode", () => {
  it("formats 8 chars as XXXX-XXXX from the confusable-free alphabet", () => {
    const code = DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    deepStrictEqual(code, "ABCD-EFGH");
    deepStrictEqual(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code), true);
  });

  it("maps every byte into the alphabet (modulo) and omits 0/O/1/I", () => {
    const code = DeviceGrantRootOps.toUserCode(
      new Uint8Array([255, 254, 253, 252, 251, 250, 249, 248]),
    );
    for (const ch of code.replace("-", "")) ok(USER_CODE_ALPHABET.includes(ch));
    ok(!/[O01I]/.test(code));
  });

  it("consumes the first 8 usable bytes; the 32-char alphabet divides 256 so none are rejected", () => {
    // limit = 256 - (256 % 32) = 256, so every byte 0..255 is accepted and the
    // first 8 are used verbatim; trailing bytes are headroom for the rejection guard.
    deepStrictEqual(
      DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 99, 99])),
      "ABCD-EFGH",
    );
  });

  it("throws when there are too few bytes to build 8 characters", () => {
    throws(
      () => DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2])),
      /not enough random bytes/,
    );
  });
});
