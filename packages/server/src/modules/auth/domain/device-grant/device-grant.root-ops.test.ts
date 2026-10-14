import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";

import { UserCodeEntropyExhausted } from "./device-grant.errors.ts";
import { DeviceGrantId } from "./device-grant.id.ts";
import { DeviceGrantRootOps, USER_CODE_ALPHABET } from "./device-grant.root-ops.ts";

const id = DeviceGrantId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

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
    assertNone(grant.userId);
    assertNone(grant.approvedAt);
    deepStrictEqual(grant.createdAt, now);
    deepStrictEqual(grant.expiresAt, DateTime.add(now, { seconds: 600 }));
  });
});

describe("DeviceGrantRootOps.approve", () => {
  it("binds the grant to the approving user and stamps approvedAt", () => {
    const later = DateTime.add(now, { seconds: 30 });
    const approved = DeviceGrantRootOps.approve({ grant: start(), userId, now: later });
    deepStrictEqual(approved.status, "approved");
    deepStrictEqual(approved.userId, Option.some(userId));
    deepStrictEqual(approved.approvedAt, Option.some(later));
    // identity + lifecycle window preserved
    deepStrictEqual(approved.id, id);
    deepStrictEqual(approved.expiresAt, start().expiresAt);
  });
});

describe("DeviceGrantRootOps.toUserCode", () => {
  it("formats 8 chars as XXXX-XXXX from the confusable-free alphabet", () => {
    const code = DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
    assertSuccess(code, "ABCD-EFGH");
  });

  it("maps every byte into the alphabet (modulo) and omits 0/O/1/I", () => {
    const result = DeviceGrantRootOps.toUserCode(
      new Uint8Array([255, 254, 253, 252, 251, 250, 249, 248]),
    );

    assertTrue(Result.isSuccess(result));
    const code = result.success;
    ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code));

    for (const ch of code.replace("-", "")) ok(USER_CODE_ALPHABET.includes(ch));
    ok(!/[O01I]/.test(code));
  });

  it("consumes the first 8 usable bytes; the 32-char alphabet divides 256 so none are rejected", () => {
    // limit = 256 - (256 % 32) = 256, so every byte 0..255 is accepted and the
    // first 8 are used verbatim; trailing bytes are headroom for the rejection guard.
    assertSuccess(
      DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 99, 99])),
      "ABCD-EFGH",
    );
  });

  it("fails when there are too few bytes to build 8 characters", () => {
    assertFailure(
      DeviceGrantRootOps.toUserCode(new Uint8Array([0, 1, 2])),
      new UserCodeEntropyExhausted(),
    );
  });
});
