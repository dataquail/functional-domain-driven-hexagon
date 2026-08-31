import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as DeviceGrantMapper from "./device-grant.mapper.js";

export const DeviceGrantRepositoryLive = Layer.effect(
  DeviceGrantRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("DeviceGrantRepository.insertOne")((grant: DeviceGrantRoot) => {
      const row = DeviceGrantMapper.toPersistence(grant);
      return sql`
          INSERT INTO auth.device_grants
            (id, device_code_hash, user_code, status, user_id, created_at, expires_at, approved_at)
          VALUES (
            ${row.id},
            ${row.device_code_hash},
            ${row.user_code},
            ${row.status},
            ${row.user_id},
            ${row.created_at},
            ${row.expires_at},
            ${row.approved_at}
          )
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    // The spec contributes only the WHERE; the repository owns FROM and the
    // projection. `LIMIT 1` is safe because every spec used with findOne
    // selects at most one row (the unique device_code_hash / user_code).
    const findOne = Effect.fn("DeviceGrantRepository.findOne")(
      (spec: Specification<DeviceGrantRoot>) =>
        sql`
          SELECT * FROM auth.device_grants
          WHERE ${criteriaToWhere(sql, spec.criteria, DeviceGrantMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.DeviceGrantRow),

          Effect.map((row) => (row === null ? null : DeviceGrantMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    const updateOne = Effect.fn("DeviceGrantRepository.updateOne")((grant: DeviceGrantRoot) => {
      const row = DeviceGrantMapper.toPersistence(grant);
      return sql`
          UPDATE auth.device_grants
          SET status = ${row.status},
              user_id = ${row.user_id},
              approved_at = ${row.approved_at}
          WHERE id = ${row.id}
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.DeviceGrantRow),

        orFail(() => new DeviceGrantNotFound()),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    const deleteById = Effect.fn("DeviceGrantRepository.deleteOne")((id: DeviceGrantId) =>
      sql`
          DELETE FROM auth.device_grants WHERE id = ${id} RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.DeviceGrantRow),

        orFail(() => new DeviceGrantNotFound()),
        Effect.asVoid,
        translateDatabaseErrors,
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
