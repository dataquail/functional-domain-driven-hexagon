import { Database, orFail, RowSchemas, sql } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import * as InvitationMapper from "@/modules/organization/infrastructure/repositories/invitation.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translatePersistenceUnavailable } from "@/platform/translate-persistence-unavailable.js";

export const InvitationRepositoryLive = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const db = yield* Database.Database;

    const insertOne = db.makeQuery((execute, invitation: InvitationRoot) => {
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

    const updateOne = db.makeQuery((execute, invitation: InvitationRoot) => {
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

    // The spec contributes only the WHERE; the repository owns FROM, the
    // newest-first ordering, and the projection. `LIMIT 1` is safe because
    // every spec used with findOne selects at most one row (identity keys, or
    // the at-most-one open invite per org+email).
    const findOne = db.makeQuery((execute, spec: Specification<InvitationRoot>) =>
      execute((client) =>
        client.maybeOne(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations
          WHERE ${criteriaToWhere(spec.criteria, InvitationMapper.columns)}
          ORDER BY created_at DESC
          LIMIT 1
        `),
      ).pipe(
        Effect.map((row) => (row === null ? null : InvitationMapper.toDomain(row))),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.findOne"),
      ),
    );

    const findMany = db.makeQuery((execute, spec: Specification<InvitationRoot>) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations
          WHERE ${criteriaToWhere(spec.criteria, InvitationMapper.columns)}
          ORDER BY created_at DESC
        `),
      ).pipe(
        Effect.map((rows) => rows.map(InvitationMapper.toDomain)),
        Effect.catchTag("DatabaseError", Effect.die),
        translatePersistenceUnavailable,
        Effect.withSpan("InvitationRepository.findMany"),
      ),
    );

    return InvitationRepository.of({ insertOne, updateOne, findOne, findMany });
  }),
);
