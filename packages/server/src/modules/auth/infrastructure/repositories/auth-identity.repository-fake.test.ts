import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository.ts";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.ts";

import { makeAuthIdentityRepositoryFake } from "./auth-identity.repository-fake.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "identity-sub-1";

describe("AuthIdentityRepositoryFake", () => {
  it.effect("returns the seeded identity for a known subject", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;

      const found = yield* repo
        .findOne(AuthIdentitySpecifications.bySubject(subject))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "better-auth");
    }).pipe(
      Effect.provide(
        makeAuthIdentityRepositoryFake([{ subject, userId, provider: "better-auth" }]),
      ),
    ),
  );

  it.effect("returns null for an unknown subject (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findOne(AuthIdentitySpecifications.bySubject("missing-sub"));
      assertNone(found);
    }).pipe(Effect.provide(makeAuthIdentityRepositoryFake())),
  );
});
