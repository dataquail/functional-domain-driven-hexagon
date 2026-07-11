import { Database, RowSchemas, sql } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type FindPendingInvitationsQuery,
  type PendingInvitationView,
} from "@/modules/organization/queries/find-pending-invitations.query.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";

// Only *open* invitations (not accepted, not revoked) belong on the
// pending list — accepted invitees are members and revoked ones are
// gone. Status (pending vs expired) is derived against `now` so the UI
// can offer resend on lapsed invites.
const toView = (row: RowSchemas.InvitationRow, now: DateTime.Utc): PendingInvitationView => ({
  invitationId: InvitationId.make(row.id),
  inviteeEmail: row.invitee_email,
  status: DateTime.isLessThanOrEqualTo(row.expires_at, now) ? "expired" : "pending",
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

export const findPendingInvitations = Effect.fn("findPendingInvitations")(function* (
  query: FindPendingInvitationsQuery,
) {
  const db = yield* Database.Database;
  const now = yield* DateTime.now;
  const rows = yield* db
    .makeQuery((execute) =>
      execute((client) =>
        client.any(sql.type(RowSchemas.InvitationRowStd)`
          SELECT * FROM "organization".invitations
          WHERE organization_id = ${query.organizationId}
            AND accepted_at IS NULL
            AND revoked_at IS NULL
          ORDER BY created_at DESC
        `),
      ),
    )()
    .pipe(
      Effect.catchTag("DatabaseError", Effect.die),
      Effect.catchTag("DatabaseUnavailable", (e) =>
        Effect.fail(new PersistenceUnavailable({ message: e.message })),
      ),
    );
  return rows.map((row) => toView(row, now));
});
