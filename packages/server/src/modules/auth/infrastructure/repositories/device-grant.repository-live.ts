import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
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

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique device_code_hash / user_code).
    const findOne = db.makeQuery((execute, spec: Specification<DeviceGrantRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.DeviceGrantRowStd)`
          SELECT * FROM auth.device_grants
          WHERE ${criteriaToWhere(spec.criteria, DeviceGrantMapper.columns)}
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : DeviceGrantMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("DeviceGrantRepository.findOne"),
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
      findOne,
      updateOne,
      deleteOne: deleteById,
    });
  }),
);
