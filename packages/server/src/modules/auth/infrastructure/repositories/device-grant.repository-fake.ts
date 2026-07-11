import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";

export const DeviceGrantRepositoryFake = Layer.effect(
  DeviceGrantRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make(HashMap.empty<DeviceGrantId, DeviceGrantRoot>());

    const insertOne = (grant: DeviceGrantRoot): Effect.Effect<void> =>
      Ref.update(store, HashMap.set(grant.id, grant));

    const findBy = (
      pred: (g: DeviceGrantRoot) => boolean,
    ): Effect.Effect<DeviceGrantRoot, DeviceGrantNotFound> =>
      Effect.flatMap(Ref.get(store), (m) => {
        const match = Array.from(HashMap.values(m)).find(pred);
        return match === undefined ? Effect.fail(new DeviceGrantNotFound()) : Effect.succeed(match);
      });

    const findOneByCodeHash = (deviceCodeHash: string) =>
      findBy((g) => g.deviceCodeHash === deviceCodeHash);

    const findOneByUserCode = (userCode: string) => findBy((g) => g.userCode === userCode);

    const updateOne = (grant: DeviceGrantRoot): Effect.Effect<void, DeviceGrantNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        if (Option.isNone(HashMap.get(m, grant.id))) {
          return yield* new DeviceGrantNotFound();
        }
        yield* Ref.update(store, HashMap.set(grant.id, grant));
      });

    const deleteGrant = (id: DeviceGrantId): Effect.Effect<void, DeviceGrantNotFound> =>
      Effect.gen(function* () {
        const m = yield* Ref.get(store);
        if (Option.isNone(HashMap.get(m, id))) {
          return yield* new DeviceGrantNotFound();
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
