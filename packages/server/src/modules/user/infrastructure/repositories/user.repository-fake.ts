import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import { type UserRoot } from "@/modules/user/domain/user/user.root.js";
import { type UserId } from "@/platform/ids/user-id.js";

const findUserByEmail = (
  store: HashMap.HashMap<UserId, UserRoot>,
  email: string,
): Option.Option<UserRoot> => {
  for (const user of HashMap.values(store)) {
    if (user.email === email) return Option.some(user);
  }
  return Option.none();
};

export const UserRepositoryFake = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<UserId, UserRoot>());

    const insertOne = (user: UserRoot): Effect.Effect<void, UserAlreadyExists> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.isSome(findUserByEmail(m, user.email))
          ? Effect.fail(new UserAlreadyExists({ email: user.email }))
          : Ref.update(store, HashMap.set(user.id, user)),
      );

    const updateOne = (user: UserRoot): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, user.id)
          ? Ref.update(store, HashMap.set(user.id, user))
          : Effect.fail(new UserNotFound({ userId: user.id })),
      );

    const deleteOne = (id: UserId): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        HashMap.has(m, id)
          ? Ref.update(store, HashMap.remove(id))
          : Effect.fail(new UserNotFound({ userId: id })),
      );

    const findOneById = (id: UserId): Effect.Effect<UserRoot, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new UserNotFound({ userId: id })),
          onSome: Effect.succeed,
        }),
      );

    const findOneByEmail = (email: string): Effect.Effect<Option.Option<UserRoot>> =>
      Effect.map(Ref.get(store), (m) => findUserByEmail(m, email));

    return UserRepository.of({ insertOne, updateOne, deleteOne, findOneById, findOneByEmail });
  }),
);
