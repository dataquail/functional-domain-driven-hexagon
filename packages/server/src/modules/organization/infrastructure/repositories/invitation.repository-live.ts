import { Database, orFail, RowSchemas } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import * as InvitationMapper from "@/modules/organization/infrastructure/repositories/invitation.mapper.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

export const InvitationRepositoryLive = Layer.effect(
  InvitationRepository,
  Effect.gen(function* () {
    const sql = yield* Database.Database;

    const insertOne = Effect.fn("InvitationRepository.insertOne")((invitation: InvitationRoot) => {
      const row = InvitationMapper.toPersistence(invitation);
      return sql`
          INSERT INTO "organization".invitations (
            id, organization_id, invitee_email, token,
            expires_at, accepted_at, revoked_at, created_at
          )
          VALUES (
            ${row.id},
            ${row.organization_id},
            ${row.invitee_email},
            ${row.token},
            ${row.expires_at},
            ${row.accepted_at},
            ${row.revoked_at},
            ${row.created_at}
          )
        `.pipe(Database.exec, translateDatabaseErrors);
    });

    const updateOne = Effect.fn("InvitationRepository.updateOne")((invitation: InvitationRoot) => {
      const row = InvitationMapper.toPersistence(invitation);
      // Persist the whole mutable aggregate, not a hand-picked subset.
      // accept/revoke only flip terminal timestamps, but reissue also
      // rotates `token` and resets `expires_at` — dropping those here
      // silently strands the new token (email holds it, DB doesn't),
      // and accept-by-token then 404s.
      return sql`
          UPDATE "organization".invitations SET
            token = ${row.token},
            expires_at = ${row.expires_at},
            accepted_at = ${row.accepted_at},
            revoked_at = ${row.revoked_at}
          WHERE id = ${row.id}
          RETURNING *
        `.pipe(
        Database.maybeRow(RowSchemas.InvitationRow),
        orFail(() => new InvitationNotFound({ invitationId: invitation.id })),
        Effect.asVoid,
        translateDatabaseErrors,
      );
    });

    // The spec contributes only the WHERE; the repository owns FROM, the
    // newest-first ordering, and the projection. `LIMIT 1` is safe because
    // every spec used with findOne selects at most one row (identity keys, or
    // the at-most-one open invite per org+email).
    const findOne = Effect.fn("InvitationRepository.findOne")(
      (spec: Specification<InvitationRoot>) =>
        sql`
          SELECT * FROM "organization".invitations
          WHERE ${criteriaToWhere(sql, spec.criteria, InvitationMapper.columns)}
          ORDER BY created_at DESC
          LIMIT 1
        `.pipe(
          Database.maybeRow(RowSchemas.InvitationRow),
          Effect.map((row) => (row === null ? null : InvitationMapper.toDomain(row))),
          translateDatabaseErrors,
        ),
    );

    const findMany = Effect.fn("InvitationRepository.findMany")(
      (spec: Specification<InvitationRoot>) =>
        sql`
          SELECT * FROM "organization".invitations
          WHERE ${criteriaToWhere(sql, spec.criteria, InvitationMapper.columns)}
          ORDER BY created_at DESC
        `.pipe(
          Database.rows(RowSchemas.InvitationRow),
          Effect.map((rows) => rows.map(InvitationMapper.toDomain)),
          translateDatabaseErrors,
        ),
    );

    return InvitationRepository.of({ insertOne, updateOne, findOne, findMany });
  }),
);
