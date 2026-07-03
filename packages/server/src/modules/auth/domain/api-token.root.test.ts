import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";
import { API_TOKEN_PREFIX, ApiTokenRootOps } from "./api-token.root.js";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const mint = (expiresAt: DateTime.Utc | null) =>
  ApiTokenRootOps.mint({
    id: apiTokenId,
    userId,
    tokenHash: "hash",
    prefix: "pat_abcd1234",
    label: "ci",
    now,
    expiresAt,
  });

describe("ApiTokenRootOps.mint", () => {
  it("populates required fields and starts unrevoked", () => {
    const expiresAt = DateTime.add(now, { days: 90 });
    const token = mint(expiresAt);
    deepStrictEqual(token.id, apiTokenId);
    deepStrictEqual(token.userId, userId);
    deepStrictEqual(token.label, "ci");
    deepStrictEqual(token.prefix, "pat_abcd1234");
    deepStrictEqual(token.expiresAt, expiresAt);
    deepStrictEqual(token.revokedAt, null);
    deepStrictEqual(token.createdAt, now);
    deepStrictEqual(token.lastUsedAt, now);
  });
});

describe("ApiTokenRootOps.touch", () => {
  it("advances lastUsedAt but never extends expiresAt (fixed expiry)", () => {
    const expiresAt = DateTime.add(now, { days: 90 });
    const seed = mint(expiresAt);
    const later = DateTime.add(now, { days: 1 });
    const touched = ApiTokenRootOps.touch({ token: seed, now: later });
    deepStrictEqual(touched.lastUsedAt, later);
    deepStrictEqual(touched.expiresAt, expiresAt);
    deepStrictEqual(touched.id, seed.id);
    deepStrictEqual(touched.createdAt, seed.createdAt);
    deepStrictEqual(touched.tokenHash, seed.tokenHash);
  });
});

describe("ApiTokenRootOps.isExpired", () => {
  it("is false before the expiry instant and true at/after it", () => {
    const expiresAt = DateTime.add(now, { days: 90 });
    const token = mint(expiresAt);
    deepStrictEqual(ApiTokenRootOps.isExpired(token, now), false);
    deepStrictEqual(ApiTokenRootOps.isExpired(token, expiresAt), true);
    deepStrictEqual(
      ApiTokenRootOps.isExpired(token, DateTime.add(expiresAt, { seconds: 1 })),
      true,
    );
  });

  it("treats a null expiresAt as non-expiring", () => {
    const token = mint(null);
    deepStrictEqual(ApiTokenRootOps.isExpired(token, DateTime.add(now, { days: 100000 })), false);
  });
});

describe("ApiTokenRootOps token format", () => {
  it("assembles the wire format pat_<publicId>_<secret>", () => {
    deepStrictEqual(
      ApiTokenRootOps.assembleToken("abcd1234", "secret"),
      `${API_TOKEN_PREFIX}_abcd1234_secret`,
    );
  });

  it("derives a non-secret display prefix that omits the secret", () => {
    const token = ApiTokenRootOps.assembleToken("abcd1234", "supersecretvalue");
    const prefix = ApiTokenRootOps.displayPrefix("abcd1234");
    deepStrictEqual(prefix, "pat_abcd1234");
    ok(!prefix.includes("supersecretvalue"));
    ok(token.startsWith(prefix));
  });
});
