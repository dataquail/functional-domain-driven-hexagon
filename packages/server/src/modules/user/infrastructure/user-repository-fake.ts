import { type UserId } from "@/platform/ids/user-id.js";
import { FakeDatabaseRelaxedLive, FakeDatabaseTag } from "@/test-utils/fake-database.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { UserAlreadyExists, UserNotFound } from "../domain/user-errors.js";
import { UserRepository } from "../domain/user-repository.js";
import { type User } from "../domain/user.aggregate.js";

// Variant that consumes a shared `FakeDatabase` from context. Compose
// with other `*FakeShared` repos under a single `FakeDatabaseLive` so
// cross-repo invariants (FK, cascade) exercise the same in-memory
// state. See `@/test-utils/fake-repositories.ts`.
export const UserRepositoryFakeShared: Layer.Layer<UserRepository, never, FakeDatabaseTag> =
  Layer.effect(
    UserRepository,
    Effect.gen(function* () {
      const db = yield* FakeDatabaseTag;

      const insert = (user: User) =>
        db
          .insertUser(user)
          .pipe(
            Effect.catchTag("UniqueViolation", () =>
              Effect.fail(new UserAlreadyExists({ email: user.email })),
            ),
          );

      const update = (user: User) =>
        db.updateUser(user).pipe(
          // Mirror live: the UPDATE's unique-index collision surfaces
          // as a DatabaseError that the live repo dies on. Use cases
          // never observe UserAlreadyExists on update.
          Effect.catchTag("UniqueViolation", (e) => Effect.die(e)),
          Effect.flatMap((ok) =>
            ok ? Effect.void : Effect.fail(new UserNotFound({ userId: user.id })),
          ),
        );

      const remove = (id: UserId) =>
        db.deleteUser(id) ? Effect.void : Effect.fail(new UserNotFound({ userId: id }));

      const findById = (id: UserId) => {
        const found = db.users.get(id);
        return found === undefined
          ? Effect.fail(new UserNotFound({ userId: id }))
          : Effect.succeed(found);
      };

      const findByEmail = (email: string) => {
        for (const user of db.users.values()) {
          if (user.email === email) return Effect.succeed(Option.some(user));
        }
        return Effect.succeed(Option.none<User>());
      };

      return UserRepository.of({ insert, update, remove, findById, findByEmail });
    }),
  );

// Backward-compatible Layer: provides its own `FakeDatabase` so
// existing call sites (`Effect.provide(UserRepositoryFake)`) keep
// working unchanged. Tests that want cross-repo sharing should
// compose `UserRepositoryFakeShared` over a single `FakeDatabaseLive`
// — `FakeRepositoriesLive` in `@/test-utils/fake-repositories.ts`
// is the canonical such composition.
export const UserRepositoryFake = UserRepositoryFakeShared.pipe(
  Layer.provide(FakeDatabaseRelaxedLive),
);
