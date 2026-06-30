import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Invitation } from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import * as InvitationMapper from "@/modules/organization/infrastructure/invitation-mapper.js";
import { type InvitationId } from "@/platform/ids/invitation-id.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const InvitationRepositoryLive = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, invitation: Invitation) => {
      const row = InvitationMapper.toPersistence(invitation);
      return execute((client) =>
        client.query(sql.unsafe`
          INSERT INTO "organization".invitations (
            id, organization_id, invitee_email, token,
            expires_at, accepted_at, revoked_at, created_at
          )
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.invitee_email},
            ${row.token},
            ${sql.timestamp(row.expires_at)},
            ${row.accepted_at === null ? null : sql.timestamp(row.accepted_at)},
            ${row.revoked_at === null ? null : sql.timestamp(row.revoked_at)},
            ${sql.timestamp(row.created_at)}
          )
        `),
      ).pipe(
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.insertOne"),
      );
    });

    const updateOne = db.makeQuery((execute, invitation: Invitation) => {
      const row = InvitationMapper.toPersistence(invitation);
      return execute((client) =>
        // Persist the whole mutable aggregate, not a hand-picked subset.
        // accept/revoke only flip terminal timestamps, but reissue also
        // rotates `token` and resets `expires_at` — dropping those here
        // silently strands the new token (email holds it, DB doesn't),
        // and accept-by-token then 404s.
        client.maybeOne(sql.type(RowSchemas.InvitationRowStd)`
          UPDATE "organization".invitations SET
            token = ${row.token},
            expires_at = ${sql.timestamp(row.expires_at)},
            accepted_at = ${row.accepted_at === null ? null : sql.timestamp(row.accepted_at)},
            revoked_at = ${row.revoked_at === null ? null : sql.timestamp(row.revoked_at)}
          WHERE id = ${row.id}
          RETURNING *
        `),
      ).pipe(
        orFail(() => new InvitationNotFound({ invitationId: invitation.id })),
        Effect.asVoid,
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.updateOne"),
      );
    });

    const findOneById = db.makeQuery((execute, id: InvitationId) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations WHERE id = ${id}
        `),
      ).pipe(
        orFail(() => new InvitationNotFound({ invitationId: id })),
        Effect.map(InvitationMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.findOneById"),
      ),
    );

    const findOneByToken = db.makeQuery((execute, token: string) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations WHERE token = ${token}
        `),
      ).pipe(
        orFail(() => new InvitationTokenNotFound()),
        Effect.map(InvitationMapper.toDomain),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.findOneByToken"),
      ),
    );

    const findManyByOrganizationId = db.makeQuery((execute, organizationId: OrganizationId) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations
          WHERE organization_id = ${organizationId}
          ORDER BY created_at DESC
        `),
      ).pipe(
        Effect.map((rows) => rows.map(InvitationMapper.toDomain)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.findManyByOrganizationId"),
      ),
    );

    const findOneOpenByOrganizationIdAndEmail = db.makeQuery(
      (execute, args: { organizationId: OrganizationId; inviteeEmail: string }) =>
        execute((client) =>
          client.maybeOne(sql.type(RowSchemas.InvitationRowStd)`
            SELECT * FROM "organization".invitations
            WHERE organization_id = ${args.organizationId}
              AND invitee_email = ${args.inviteeEmail}
              AND accepted_at IS NULL
              AND revoked_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          `),
        ).pipe(
          Effect.map((row) => (row === null ? null : InvitationMapper.toDomain(row))),
          Effect.catchTag("DatabaseError", Effect.die),
          translatePersistenceUnavailable,
          Effect.withSpan("InvitationRepository.findOneOpenByOrganizationIdAndEmail"),
        ),
    );

    return InvitationRepository.of({
      insertOne,
      updateOne,
      findOneById,
      findOneByToken,
      findManyByOrganizationId,
      findOneOpenByOrganizationIdAndEmail: (organizationId, inviteeEmail) =>
        findOneOpenByOrganizationIdAndEmail({ organizationId, inviteeEmail }),
    });
  }),
);
