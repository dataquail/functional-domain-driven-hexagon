import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Criteria } from "@/globals/application/ddd/specification";

import { ApiTokenId } from "./api-token.id";
import { ApiTokenRoot } from "./api-token.root";
import { ApiTokenRootOps } from "./api-token.root-ops";
import { ApiTokenSpecifications } from "./api-token.specification";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const otherId = ApiTokenId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");
const otherUserId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");

const mint = (expiresAt: Option.Option<DateTime.Utc>) =>
  ApiTokenRootOps.mint({
    id: apiTokenId,
    userId,
    tokenHash: "hash",
    prefix: "pat_abcd1234",
    label: "ci",
    now,
    expiresAt,
  });

describe("ApiTokenSpecifications.withId", () => {
  it("matches the token with the given id and no other", () => {
    const token = mint(Option.some(DateTime.add(now, { days: 90 })));
    deepStrictEqual(ApiTokenSpecifications.withId(apiTokenId)(token), true);
    deepStrictEqual(ApiTokenSpecifications.withId(otherId)(token), false);
  });

  it("carries an Eq criteria over the id column", () => {
    deepStrictEqual(
      ApiTokenSpecifications.withId(apiTokenId).criteria,
      Criteria.Eq({ field: "id", value: apiTokenId }),
    );
  });
});

describe("ApiTokenSpecifications.withHash", () => {
  it("matches the token with the given hash and no other", () => {
    const token = mint(Option.some(DateTime.add(now, { days: 90 })));
    deepStrictEqual(ApiTokenSpecifications.withHash("hash")(token), true);
    deepStrictEqual(ApiTokenSpecifications.withHash("other")(token), false);
  });

  it("carries an Eq criteria over the token_hash column", () => {
    deepStrictEqual(
      ApiTokenSpecifications.withHash("hash").criteria,
      Criteria.Eq({ field: "tokenHash", value: "hash" }),
    );
  });
});

describe("ApiTokenSpecifications.forUser", () => {
  it("matches the owner's active tokens and excludes revoked or foreign ones", () => {
    const active = mint(Option.some(DateTime.add(now, { days: 90 })));
    deepStrictEqual(ApiTokenSpecifications.forUser(userId)(active), true);
    const revoked = ApiTokenRoot.make({ ...active, revokedAt: Option.some(now) });
    deepStrictEqual(ApiTokenSpecifications.forUser(userId)(revoked), false);
    deepStrictEqual(ApiTokenSpecifications.forUser(otherUserId)(active), false);
  });

  it("carries an And of the user_id Eq and the revoked_at IsNull", () => {
    deepStrictEqual(
      ApiTokenSpecifications.forUser(userId).criteria,
      Criteria.And({
        nodes: [
          Criteria.Eq({ field: "userId", value: userId }),
          Criteria.IsNull({ field: "revokedAt" }),
        ],
      }),
    );
  });
});

describe("ApiTokenSpecifications.isExpired", () => {
  it("is false before the expiry instant and true at/after it", () => {
    const expiresAt = DateTime.add(now, { days: 90 });
    const token = mint(Option.some(expiresAt));
    deepStrictEqual(ApiTokenSpecifications.isExpired(token, now), false);
    deepStrictEqual(ApiTokenSpecifications.isExpired(token, expiresAt), true);
    deepStrictEqual(
      ApiTokenSpecifications.isExpired(token, DateTime.add(expiresAt, { seconds: 1 })),
      true,
    );
  });

  it("treats an absent expiresAt as non-expiring", () => {
    const token = mint(Option.none());
    deepStrictEqual(
      ApiTokenSpecifications.isExpired(token, DateTime.add(now, { days: 100000 })),
      false,
    );
  });
});
