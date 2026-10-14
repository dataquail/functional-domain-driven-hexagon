import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { type OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { type UserId } from "@/globals/application/ddd/ids/user-id";
import { type Specification } from "@/globals/application/ddd/specification";
import { criteriaToWhere } from "@/globals/infrastructure/database/criteria-to-sql";
import { translateDatabaseErrors } from "@/globals/infrastructure/database/translate-database-errors";
import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root";
import * as MembershipMapper from "@/modules/organization/infrastructure/repositories/membership.mapper";

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
          orFail(() => new MembershipNotFound({ userId, organizationId })),
          Effect.asVoid,
          translateDatabaseErrors,
        ),
    );

    // The spec contributes only the WHERE (the composite identity); the
    // repository owns FROM and projection. `LIMIT 1` is safe because the
    // composite key selects at most one row.
    const findOne = Effect.fn("MembershipRepository.findOne")(
      (spec: Specification<MembershipRoot>) =>
        criteriaToWhere(sql, spec.criteria, MembershipMapper.columns).pipe(
          Effect.flatMap(
            (where) => sql`
          SELECT * FROM "organization".memberships
          WHERE ${where}
          LIMIT 1
        `,
          ),
          Database.maybeRow(RowSchemas.MembershipRow),
          Effect.map(Option.map(MembershipMapper.toDomain)),
          translateDatabaseErrors,
        ),
    );

    return MembershipRepository.of({ insertOne, deleteOne, findOne });
  }),
);
