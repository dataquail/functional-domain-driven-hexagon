import { Database, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MembershipNotFound } from "@/modules/organization/domain/membership/membership.errors.js";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.js";
import { type MembershipRoot } from "@/modules/organization/domain/membership/membership.root.js";
import * as MembershipMapper from "@/modules/organization/infrastructure/repositories/membership.mapper.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const MembershipRepositoryLive = Layer.effect(
  MembershipRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    // Idempotent: re-driving a create for an existing (userId, orgId)
    // pair is a no-op (PK conflict ignored). Lets upstream commands
    // treat membership creation as safe to retry.
    const insertOne = db.makeQuery((execute, membership: MembershipRoot) => {
      const row = MembershipMapper.toPersistence(membership);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO "organization".memberships (user_id, organization_id, created_at)
          VALUES (
            ${row.user_id},
            ${row.organization_id},
            ${sql.timestamp(row.created_at)}
          )
          ON CONFLICT (user_id, organization_id) DO NOTHING
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("MembershipRepository.insertOne"),
      );
    });

    const deleteRow = db.makeQuery(
      (execute, args: { userId: UserId; organizationId: OrganizationId }) =>
        execute((client) =>
          client.query(sql.unsafe`
            DELETE FROM "organization".memberships
            WHERE user_id = ${args.userId}
              AND organization_id = ${args.organizationId}
          `),
        ).pipe(
          // `query.rowCount` is 0 when the row didn't exist — surface as
          // MembershipNotFound so the command layer can produce a 404.
          Effect.flatMap((result) =>
            result.rowCount === 0
              ? Effect.fail(
                  new MembershipNotFound({
                    userId: args.userId,
                    organizationId: args.organizationId,
                  }),
                )
              : Effect.void,
          ),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("MembershipRepository.deleteOne"),
        ),
    );

    const findOneByUserIdAndOrgId = db.makeQuery(
      (execute, args: { userId: UserId; organizationId: OrganizationId }) =>
        execute((client) =>
          client.maybeOne(sql.type(RowSchemas.MembershipRowStd)`
            SELECT * FROM "organization".memberships
            WHERE user_id = ${args.userId}
              AND organization_id = ${args.organizationId}
          `),
        ).pipe(
          Effect.flatMap((row) =>
            row === null
              ? Effect.fail(
                  new MembershipNotFound({
                    userId: args.userId,
                    organizationId: args.organizationId,
                  }),
                )
              : Effect.succeed(MembershipMapper.toDomain(row)),
          ),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("MembershipRepository.findOneByUserIdAndOrgId"),
        ),
    );

    const findManyByOrganizationId = db.makeQuery(
      (execute, args: { organizationId: OrganizationId }) =>
        execute((client) =>
          client.any(sql.type(RowSchemas.MembershipRowStd)`
            SELECT * FROM "organization".memberships
            WHERE organization_id = ${args.organizationId}
            ORDER BY created_at ASC
          `),
        ).pipe(
          Effect.map((rows) => rows.map(MembershipMapper.toDomain)),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("MembershipRepository.findManyByOrganizationId"),
        ),
    );

    return MembershipRepository.of({
      insertOne,
      deleteOne: (userId, organizationId) => deleteRow({ userId, organizationId }),
      findOneByUserIdAndOrgId: (userId, organizationId) =>
        findOneByUserIdAndOrgId({ userId, organizationId }),
      findManyByOrganizationId: (organizationId) => findManyByOrganizationId({ organizationId }),
    });
  }),
);
