import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type DeviceGrant } from "../domain/device-grant.aggregate.js";
import { DeviceGrantNotFound } from "../domain/device-grant-errors.js";
import { type DeviceGrantId } from "../domain/device-grant-id.js";
import { DeviceGrantRepository } from "../domain/ports/repositories/device-grant-repository.js";

export const DeviceGrantRepositoryFake = Layer.effect(
  DeviceGrantRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<DeviceGrantId, DeviceGrant>());

    const insertOne = (grant: DeviceGrant): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(grant.id, grant));

    const findBy = (
      pred: (g: DeviceGrant) => boolean,
    ): Effect.Effect<DeviceGrant, DeviceGrantNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const match = Array.from(HashMap.values(m)).find(pred);
        return match === undefined ? Effect.fail(new DeviceGrantNotFound()) : Effect.succeed(match);
      });

    const findOneByCodeHash = (deviceCodeHash: string) =>
      findBy((g) => g.deviceCodeHash === deviceCodeHash);

    const findOneByUserCode = (userCode: string) => findBy((g) => g.userCode === userCode);

    const updateOne = (grant: DeviceGrant): Effect.Effect<void, DeviceGrantNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        if (Option.isNone(HashMap.get(m, grant.id))) {
          return yield* Effect.fail(new DeviceGrantNotFound());
        }
        yield* Ref.update(store, HashMap.set(grant.id, grant));
      });

    const deleteGrant = (id: DeviceGrantId): Effect.Effect<void, DeviceGrantNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        if (Option.isNone(HashMap.get(m, id))) {
          return yield* Effect.fail(new DeviceGrantNotFound());
        }
        yield* Ref.update(store, HashMap.remove(id));
      });

    return DeviceGrantRepository.of({
      insertOne,
      findOneByCodeHash,
      findOneByUserCode,
      updateOne,
      deleteOne: deleteGrant,
    });
  }),
);
