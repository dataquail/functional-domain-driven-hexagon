import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type Specification } from "@/globals/application/ddd/specification";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors";
import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors";
import { type DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository";
import { type DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root";

import * as DeviceGrantMapper from "./device-grant.mapper";

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
        criteriaToWhere(sql, spec.criteria, DeviceGrantMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM auth.device_grants
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.DeviceGrantRow),

          Effect.map(Option.map(DeviceGrantMapper.toDomain)),
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
