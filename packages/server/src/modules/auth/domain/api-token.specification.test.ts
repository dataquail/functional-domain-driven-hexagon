import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "./api-token.id.js";
import { ApiTokenRootOps } from "./api-token.root-ops.js";
import { ApiTokenSpecifications } from "./api-token.specification.js";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

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

describe("ApiTokenSpecifications.isExpired", () => {
  it("is false before the expiry instant and true at/after it", () => {
    const expiresAt = DateTime.add(now, { days: 90 });
    const token = mint(expiresAt);
    deepStrictEqual(ApiTokenSpecifications.isExpired(token, now), false);
    deepStrictEqual(ApiTokenSpecifications.isExpired(token, expiresAt), true);
    deepStrictEqual(
      ApiTokenSpecifications.isExpired(token, DateTime.add(expiresAt, { seconds: 1 })),
      true,
    );
  });

  it("treats a null expiresAt as non-expiring", () => {
    const token = mint(null);
    deepStrictEqual(
      ApiTokenSpecifications.isExpired(token, DateTime.add(now, { days: 100000 })),
      false,
    );
  });
});
