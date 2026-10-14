import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Database } from "@org/database/index";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";
import { UserId } from "@/globals/application/ddd/ids/user-id";
import { Spec } from "@/globals/application/ddd/specification";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live";
import { describeIntegration } from "@/test-utils/server-test-runtime";
import { TestDatabaseLive } from "@/test-utils/test-database";

const invitationId = InvitationId.make("44444444-4444-4444-4444-444444444444");
const orgId = OrganizationId.make("55555555-5555-5555-5555-555555555555");
const userId = UserId.make("66666666-6666-6666-6666-666666666666");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const expiresAt = DateTime.makeUnsafe("2026-01-08T00:00:00Z");

// organization.invitations FKs to organization.organizations — seed the
// org row via raw SQL.
const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${orgId}, 'Acme', now(), now(), NULL)
      `.pipe(Effect.orDie);
});

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId: orgId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const openForAlice = Spec.and(
  InvitationSpecifications.forOrganization(orgId),
  InvitationSpecifications.withInviteeEmail("alice@example.com"),
  InvitationSpecifications.isOpen,
);

const TestLayer = InvitationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "InvitationRepositoryLive (integration)",
  { layer: TestLayer, tables: ["organization.invitations", "organization.organizations"] },
  (it) => {
    describe("insert + findOne (by id, by token)", () => {
      it.effect("round-trips an inserted invitation by id and by token", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());
          const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
          deepStrictEqual(
            Option.map(byId, (found) => found.id),
            Option.some(invitationId),
          );
          const byToken = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
          deepStrictEqual(
            Option.map(byToken, (found) => found.id),
            Option.some(invitationId),
          );
        }),
      );

      it.effect("findOne returns null for an unknown id or token (absence is not an error)", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
          const byToken = yield* repo.findOne(InvitationSpecifications.withToken("missing"));
          assertNone(byId);
          assertNone(byToken);
        }),
      );
    });

    describe("update", () => {
      it.effect("persists state transitions (accept sets acceptedAt)", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());
          const accepted = Result.getOrThrow(InvitationRootOps.accept(seed(), { userId, now }));
          yield* repo.updateOne(accepted.invitation);
          const maybeFound = yield* repo.findOne(InvitationSpecifications.withId(invitationId));

          const found = Option.getOrThrow(maybeFound);
          assertTrue(Option.isSome(found.acceptedAt));
        }),
      );

      it.effect("persists a reissue (rotated token + reset expiry)", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());
          const newExpiresAt = DateTime.makeUnsafe("2026-02-01T00:00:00Z");

          const reissued = Result.getOrThrow(
            InvitationRootOps.reissue(seed(), {
              token: "tok-rotated",
              expiresAt: newExpiresAt,
              now,
            }),
          );

          yield* repo.updateOne(reissued.invitation);

          // The new token must resolve...
          const maybeByNew = yield* repo.findOne(InvitationSpecifications.withToken("tok-rotated"));

          const byNew = Option.getOrThrow(maybeByNew);
          deepStrictEqual(byNew.id, invitationId);
          deepStrictEqual(
            DateTime.toEpochMillis(byNew.expiresAt),
            DateTime.toEpochMillis(newExpiresAt),
          );

          // ...and the old token must no longer resolve.
          const byOld = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
          assertNone(byOld);
        }),
      );

      it.effect("update fails InvitationNotFound when the row is missing", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          const error = yield* Effect.flip(repo.updateOne(seed()));
          deepStrictEqual(Schema.is(InvitationNotFound)(error), true);
        }),
      );
    });

    describe("findOne / findMany by specification", () => {
      const secondId = InvitationId.make("44444444-4444-4444-4444-444444444445");

      it.effect("findOne compiles a composed spec (org + email + open) to SQL", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());
          const found = yield* repo.findOne(openForAlice);
          deepStrictEqual(
            Option.map(found, (invitation) => invitation.id),
            Option.some(invitationId),
          );
        }),
      );

      it.effect("the open variant is applied in SQL — a revoked invite is excluded", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());
          const revoked = Result.getOrThrow(InvitationRootOps.revoke(seed(), { now }));
          yield* repo.updateOne(revoked.invitation);

          // open spec filters it out...
          assertNone(yield* repo.findOne(openForAlice));
          // ...but the row is still there when the spec doesn't demand open.
          const all = yield* repo.findMany(InvitationSpecifications.forOrganization(orgId));
          deepStrictEqual(all.length, 1);
          assertTrue(all.every((invitation) => Option.isSome(invitation.revokedAt)));
        }),
      );

      it.effect("findMany(forOrganization) returns every invitation, newest first", () =>
        Effect.gen(function* () {
          yield* seedOrg;
          const repo = yield* InvitationRepository;
          yield* repo.insertOne(seed());

          const later = InvitationRootOps.issue({
            id: secondId,
            organizationId: orgId,
            inviteeEmail: "bob@example.com",
            token: "tok-bob",
            expiresAt,
            now: DateTime.makeUnsafe("2026-01-02T00:00:00Z"),
          }).invitation;

          yield* repo.insertOne(later);
          const all = yield* repo.findMany(InvitationSpecifications.forOrganization(orgId));
          deepStrictEqual(all.length, 2);
          deepStrictEqual(all[0]?.id, secondId);
          deepStrictEqual(all[1]?.id, invitationId);
        }),
      );
    });
  },
);
