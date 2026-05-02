import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { AuthIdentityRepository } from "../domain/auth-identity-repository.js";
import { AuthIdentityNotFound } from "../domain/session-errors.js";
import { makeAuthIdentityRepositoryFake } from "./auth-identity-repository-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "zitadel-sub-1";

describe("AuthIdentityRepositoryFake", () => {
  it.effect("returns the seeded identity for a known subject", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const found = yield* repo.findBySubject(subject);
      deepStrictEqual(found.subject, subject);
      deepStrictEqual(found.userId, userId);
      deepStrictEqual(found.provider, "zitadel");
    }).pipe(
      Effect.provide(makeAuthIdentityRepositoryFake([{ subject, userId, provider: "zitadel" }])),
    ),
  );

  it.effect("fails AuthIdentityNotFound for an unknown subject", () =>
    Effect.gen(function* () {
      const repo = yield* AuthIdentityRepository;
      const exit = yield* Effect.exit(repo.findBySubject("missing-sub"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof AuthIdentityNotFound, true);
      }
    }).pipe(Effect.provide(makeAuthIdentityRepositoryFake())),
  );
});
