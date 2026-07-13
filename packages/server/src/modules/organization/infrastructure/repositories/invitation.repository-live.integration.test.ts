import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { beforeEach } from "vitest";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/repositories/invitation.repository-live.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const invitationId = InvitationId.make("44444444-4444-4444-4444-444444444444");
const orgId = OrganizationId.make("55555555-5555-5555-5555-555555555555");
const userId = UserId.make("66666666-6666-6666-6666-666666666666");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

// organization.invitations FKs to organization.organizations — seed the
// org row via raw SQL.
const seedOrg = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((client) =>
      client.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${orgId}, 'Acme', now(), now(), NULL)
      `),
    )
    .pipe(Effect.orDie);
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

const suite = describe.sequential;

suite("InvitationRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.invitations", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("insert + findOne (by id, by token)", () => {
    it.effect("round-trips an inserted invitation by id and by token", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insertOne(seed());
        const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
        deepStrictEqual(byId?.id, invitationId);
        const byToken = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
        deepStrictEqual(byToken?.id, invitationId);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("findOne returns null for an unknown id or token (absence is not an error)", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
        const byToken = yield* repo.findOne(InvitationSpecifications.withToken("missing"));
        deepStrictEqual(byId, null);
        deepStrictEqual(byToken, null);
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("persists state transitions (accept sets acceptedAt)", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insertOne(seed());
        const accepted = InvitationRootOps.accept(seed(), { userId, now });
        if (Result.isFailure(accepted)) throw new Error("expected Right");
        yield* repo.updateOne(accepted.success.invitation);
        const found = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
        if (found === null) throw new Error("expected invitation");
        deepStrictEqual(found.acceptedAt !== null, true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("persists a reissue (rotated token + reset expiry)", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insertOne(seed());
        const newExpiresAt = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));
        const reissued = InvitationRootOps.reissue(seed(), {
          token: "tok-rotated",
          expiresAt: newExpiresAt,
          now,
        });
        if (Result.isFailure(reissued)) throw new Error("expected Right");
        yield* repo.updateOne(reissued.success.invitation);

        // The new token must resolve...
        const byNew = yield* repo.findOne(InvitationSpecifications.withToken("tok-rotated"));
        if (byNew === null) throw new Error("expected invitation");
        deepStrictEqual(byNew.id, invitationId);
        deepStrictEqual(
          DateTime.toEpochMillis(byNew.expiresAt),
          DateTime.toEpochMillis(newExpiresAt),
        );

        // ...and the old token must no longer resolve.
        const byOld = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
        deepStrictEqual(byOld, null);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("update fails InvitationNotFound when the row is missing", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        const exit = yield* Effect.exit(repo.updateOne(seed()));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = Cause.hasFails(exit.cause)
            ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
            : null;
          deepStrictEqual(error instanceof InvitationNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
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
        deepStrictEqual(found?.id, invitationId);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("the open variant is applied in SQL — a revoked invite is excluded", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insertOne(seed());
        const revoked = InvitationRootOps.revoke(seed(), { now });
        if (Result.isFailure(revoked)) throw new Error("expected Right");
        yield* repo.updateOne(revoked.success.invitation);

        // open spec filters it out...
        deepStrictEqual(yield* repo.findOne(openForAlice), null);
        // ...but the row is still there when the spec doesn't demand open.
        const all = yield* repo.findMany(InvitationSpecifications.forOrganization(orgId));
        deepStrictEqual(all.length, 1);
        deepStrictEqual(all[0]?.revokedAt !== null, true);
      }).pipe(Effect.provide(TestLayer)),
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
          now: DateTime.makeUnsafe(new Date("2026-01-02T00:00:00Z")),
        }).invitation;
        yield* repo.insertOne(later);
        const all = yield* repo.findMany(InvitationSpecifications.forOrganization(orgId));
        deepStrictEqual(all.length, 2);
        deepStrictEqual(all[0]?.id, secondId);
        deepStrictEqual(all[1]?.id, invitationId);
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
