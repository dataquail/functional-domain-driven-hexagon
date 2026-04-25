import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { UserAlreadyExists, UserNotFound } from "../domain/user-errors.js";
import { type UserId } from "../domain/user-id.js";
import { UserRepository } from "../domain/user-repository.js";
import { type User } from "../domain/user.aggregate.js";

const findUserByEmail = (
  store: HashMap.HashMap<UserId, User>,
  email: string,
): Option.Option<User> => {
  for (const user of HashMap.values(store)) {
    if (user.email === email) return Option.some(user);
  }
  return Option.none();
};

export const UserRepositoryFake = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<UserId, User>());

    const insert = (user: User): Effect.Effect<void, UserAlreadyExists> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findUserByEmail(m, user.email))
          ? Effect.fail(new UserAlreadyExists({ email: user.email }))
          : Ref.update(store, HashMap.set(user.id, user)),
      );

    const update = (user: User): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, user.id)
          ? Ref.update(store, HashMap.set(user.id, user))
          : Effect.fail(new UserNotFound({ userId: user.id })),
      );

    const remove = (id: UserId): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, id)
          ? Ref.update(store, HashMap.remove(id))
          : Effect.fail(new UserNotFound({ userId: id })),
      );

    const findById = (id: UserId): Effect.Effect<User, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new UserNotFound({ userId: id })),
          onSome: Effect.succeed,
        }),
      );

    const findByEmail = (email: string): Effect.Effect<Option.Option<User>> =>
      Effect.map(Ref.get(store), (m) => findUserByEmail(m, email));

    return UserRepository.of({ insert, update, remove, findById, findByEmail });
  }),
);
