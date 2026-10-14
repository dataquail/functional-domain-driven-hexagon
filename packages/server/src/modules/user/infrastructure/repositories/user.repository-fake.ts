import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type UserId } from "@/globals/application/ddd/ids/user-id";
import { type Specification } from "@/globals/application/ddd/specification";
import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors";
import { UserRepository } from "@/modules/user/domain/user/user.repository";
import { type UserRoot } from "@/modules/user/domain/user/user.root";

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
        Option.match(findUserByEmail(m, user.email), {
          onNone: () => Ref.update(store, HashMap.set(user.id, user)),
          onSome: () => Effect.fail(new UserAlreadyExists({ email: user.email })),
        }),
      );

    const updateOne = (user: UserRoot): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, user.id), {
          onNone: () => Effect.fail(new UserNotFound({ userId: user.id })),
          onSome: () => Ref.update(store, HashMap.set(user.id, user)),
        }),
      );

    const deleteOne = (id: UserId): Effect.Effect<void, UserNotFound> =>
      Effect.flatMap(Ref.get(store), (m) =>
        Option.match(HashMap.get(m, id), {
          onNone: () => Effect.fail(new UserNotFound({ userId: id })),
          onSome: () => Ref.update(store, HashMap.remove(id)),
        }),
      );

    // The spec IS the in-memory predicate — the same object the live repo
    // compiles to SQL — so fake and live agree by construction.
    const findOne = (spec: Specification<UserRoot>): Effect.Effect<Option.Option<UserRoot>> =>
      Effect.map(Ref.get(store), (m) =>
        Option.fromUndefinedOr(Array.from(HashMap.values(m)).find(spec)),
      );

    return UserRepository.of({ insertOne, updateOne, deleteOne, findOne });
  }),
);
