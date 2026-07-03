import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as TestClock from "effect/TestClock";

import { InvitationRootOps } from "@/modules/organization/domain/invitation.root.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.js";
import { findPendingInvitations } from "@/modules/organization/queries/find-pending-invitations.handler.js";
import { FindPendingInvitationsQuery } from "@/modules/organization/queries/find-pending-invitations.query.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

const orgId = OrganizationId.make("55555555-5555-5555-5555-555555555555");
const otherOrgId = OrganizationId.make("99999999-9999-9999-9999-999999999999");
const userId = UserId.make("66666666-6666-6666-6666-666666666666");
const issuedAt = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
// `it.effect` runs on a TestClock (starts at epoch 0), so we pin "now" to
// a fixed instant and place expiries on either side of it for a
// deterministic pending-vs-expired split.
const clockNow = DateTime.unsafeMake(new Date("2026-06-01T00:00:00Z"));
const farFuture = DateTime.unsafeMake(new Date("2099-01-01T00:00:00Z"));
const farPast = DateTime.unsafeMake(new Date("2020-01-01T00:00:00Z"));

const issue = (id: string, email: string, expiresAt: DateTime.Utc, organizationId = orgId) =>
  InvitationRootOps.issue({
    id: InvitationId.make(id),
    organizationId,
    inviteeEmail: email,
    token: `tok-${id}`,
    expiresAt,
    now: issuedAt,
  }).invitation;

describe("findPendingInvitations", () => {
  it.effect("returns only open invitations, tagged pending vs expired", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(DateTime.toEpochMillis(clockNow));
      const repo = yield* InvitationRepository;

      const pending = issue("11111111-1111-1111-1111-111111111111", "live@example.com", farFuture);
      const expired = issue("22222222-2222-2222-2222-222222222222", "lapsed@example.com", farPast);
      const toRevoke = issue("33333333-3333-3333-3333-333333333333", "gone@example.com", farFuture);
      const toAccept = issue("44444444-4444-4444-4444-444444444444", "in@example.com", farFuture);
      // Different org — must be excluded.
      const otherOrg = issue(
        "55555555-5555-5555-5555-555555555556",
        "other@example.com",
        farFuture,
        otherOrgId,
      );

      yield* repo.insertOne(pending);
      yield* repo.insertOne(expired);
      yield* repo.insertOne(toRevoke);
      yield* repo.insertOne(toAccept);
      yield* repo.insertOne(otherOrg);

      const revoked = InvitationRootOps.revoke(toRevoke, { now: issuedAt });
      if (Either.isLeft(revoked)) throw new Error("expected Right");
      yield* repo.updateOne(revoked.right.invitation);

      const accepted = InvitationRootOps.accept(toAccept, { userId, now: issuedAt });
      if (Either.isLeft(accepted)) throw new Error("expected Right");
      yield* repo.updateOne(accepted.right.invitation);

      const result = yield* findPendingInvitations(
        FindPendingInvitationsQuery.make({ organizationId: orgId }),
      );

      const byEmail = new Map(result.map((r) => [r.inviteeEmail, r]));
      deepStrictEqual(result.length, 2);
      deepStrictEqual(byEmail.get("live@example.com")?.status, "pending");
      deepStrictEqual(byEmail.get("lapsed@example.com")?.status, "expired");
      // revoked, accepted, and other-org invitations are excluded
      deepStrictEqual(byEmail.has("gone@example.com"), false);
      deepStrictEqual(byEmail.has("in@example.com"), false);
      deepStrictEqual(byEmail.has("other@example.com"), false);
    }).pipe(Effect.provide(InvitationRepositoryFake)),
  );

  it.effect("returns an empty list for an org with no open invitations", () =>
    Effect.gen(function* () {
      const result = yield* findPendingInvitations(
        FindPendingInvitationsQuery.make({ organizationId: orgId }),
      );
      deepStrictEqual(result.length, 0);
    }).pipe(Effect.provide(InvitationRepositoryFake)),
  );
});
