import { Database, RowSchemas } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import {
  type FindPendingInvitationsPayload,
  type PendingInvitationView,
} from "@/modules/organization/queries/find-pending-invitations.query.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

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

export const findPendingInvitationsHandler = Effect.fn("findPendingInvitationsHandler")(function* (
  query: FindPendingInvitationsPayload,
) {
  const sql = yield* Database.Database;
  const now = yield* DateTime.now;
  const rows = yield* sql`
          SELECT * FROM "organization".invitations
          WHERE organization_id = ${query.organizationId}
            AND accepted_at IS NULL
            AND revoked_at IS NULL
          ORDER BY created_at DESC
        `
    .pipe(Database.rows(RowSchemas.InvitationRow))
    .pipe(translateDatabaseErrors);
  return rows.map((row) => toView(row, now));
});
