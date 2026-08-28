import { Database, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import * as MembershipMapper from "@/modules/organization/infrastructure/repositories/membership.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

export const MembershipRepositoryLive = Layer.effect(
  MembershipRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    // Idempotent: re-driving a create for an existing (userId, orgId)
    // pair is a no-op (PK conflict ignored). Lets upstream commands
    // treat membership creation as safe to retry.
    const insertOne = Effect.fn("MembershipRepository.insertOne")((membership: MembershipRoot) => {
      const row = MembershipMapper.toPersistence(membership);
      return sql`
          INSERT INTO "organization".memberships (user_id, organization_id, created_at)
          VALUES (
            ${row.user_id},
            ${row.organization_id},
            ${row.created_at}
          )
          ON CONFLICT (user_id, organization_id) DO NOTHING
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    const deleteOne = Effect.fn("MembershipRepository.deleteOne")(
      (userId: UserId, organizationId: OrganizationId) =>
        sql`
          DELETE FROM "organization".memberships
          WHERE user_id = ${userId}
            AND organization_id = ${organizationId}
          RETURNING *
        `.pipe(
          Database.maybeRow(RowSchemas.MembershipRow),
          // No returned row means it didn't exist — surface as
          // MembershipNotFound so the command layer can produce a 404.
          Effect.flatMap((row) =>
            row === null ? new MembershipNotFound({ userId, organizationId }) : Effect.void,
          ),
          translateDatabaseErrors,
        ),
    );

    // The spec contributes only the WHERE (the composite identity); the
    // repository owns FROM and projection. `LIMIT 1` is safe because the
    // composite key selects at most one row.
    const findOne = Effect.fn("MembershipRepository.findOne")(
      (spec: Specification<MembershipRoot>) =>
        sql`
          SELECT * FROM "organization".memberships
          WHERE ${criteriaToWhere(sql, spec.criteria, MembershipMapper.columns)}
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.MembershipRow),
          Effect.map((row) => (row === null ? null : MembershipMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    return MembershipRepository.of({ insertOne, deleteOne, findOne });
  }),
);
