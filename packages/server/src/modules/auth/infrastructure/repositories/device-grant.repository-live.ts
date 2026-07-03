import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant.errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant.id.js";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant.root.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/ports/repositories/device-grant.repository.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import * as DeviceGrantMapper from "./device-grant.mapper.js";

export const DeviceGrantRepositoryLive = Layer.effect(
  DeviceGrantRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, grant: DeviceGrantRoot) => {
      const row = DeviceGrantMapper.toPersistence(grant);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO auth.device_grants
            (id, device_code_hash, user_code, status, user_id, created_at, expires_at, approved_at)
          VALUES (
            ${row.id},
            ${row.device_code_hash},
            ${row.user_code},
            ${row.status},
            ${row.user_id},
            ${sql.timestamp(row.created_at)},
            ${sql.timestamp(row.expires_at)},
            ${row.approved_at === null ? null : sql.timestamp(row.approved_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.insertOne"),
      );
    });

    const findOneByCodeHash = db.makeQuery((execute, deviceCodeHash: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          SELECT * FROM auth.device_grants WHERE device_code_hash = ${deviceCodeHash}
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.map(DeviceGrantMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.findOneByCodeHash"),
      ),
    );

    const findOneByUserCode = db.makeQuery((execute, userCode: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          SELECT * FROM auth.device_grants WHERE user_code = ${userCode}
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.map(DeviceGrantMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.findOneByUserCode"),
      ),
    );

    const updateOne = db.makeQuery((execute, grant: DeviceGrantRoot) => {
      const row = DeviceGrantMapper.toPersistence(grant);
      return execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          UPDATE auth.device_grants
          SET status = ${row.status},
              user_id = ${row.user_id},
              approved_at = ${row.approved_at === null ? null : sql.timestamp(row.approved_at)}
          WHERE id = ${row.id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.updateOne"),
      );
    });

    const deleteById = db.makeQuery((execute, id: DeviceGrantId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          DELETE FROM auth.device_grants WHERE id = ${id} RETURNING *
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.deleteOne"),
      ),
    );

    return DeviceGrantRepository.of({
      insertOne,
      findOneByCodeHash,
      findOneByUserCode,
      updateOne,
      deleteOne: deleteById,
    });
  }),
);
