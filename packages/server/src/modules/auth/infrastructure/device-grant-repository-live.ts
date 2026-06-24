import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

import { type DeviceGrant } from "../domain/device-grant.aggregate.js";
import { DeviceGrantNotFound } from "../domain/device-grant-errors.js";
import { type DeviceGrantId } from "../domain/device-grant-id.js";
import { DeviceGrantRepository } from "../domain/ports/repositories/device-grant-repository.js";
import * as DeviceGrantMapper from "./device-grant-mapper.js";

export const DeviceGrantRepositoryLive = Layer.effect(
  DeviceGrantRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insert = db.makeQuery((execute, grant: DeviceGrant) => {
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
        Effect.withSpan("DeviceGrantRepository.insert"),
      );
    });

    const findByCodeHash = db.makeQuery((execute, deviceCodeHash: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          SELECT * FROM auth.device_grants WHERE device_code_hash = ${deviceCodeHash}
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.map(DeviceGrantMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.findByCodeHash"),
      ),
    );

    const findByUserCode = db.makeQuery((execute, userCode: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          SELECT * FROM auth.device_grants WHERE user_code = ${userCode}
        `),
      ).pipe(
        orFail(() => new DeviceGrantNotFound()),
        Effect.map(DeviceGrantMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.findByUserCode"),
      ),
    );

    const update = db.makeQuery((execute, grant: DeviceGrant) => {
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
        Effect.withSpan("DeviceGrantRepository.update"),
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
        Effect.withSpan("DeviceGrantRepository.delete"),
      ),
    );

    return DeviceGrantRepository.of({
      insert,
      findByCodeHash,
      findByUserCode,
      update,
      delete: deleteById,
    });
  }),
);
