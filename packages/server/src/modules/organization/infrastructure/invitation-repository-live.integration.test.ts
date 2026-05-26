import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation-repository.js";
import { InvitationRepositoryLive } from "@/modules/organization/infrastructure/invitation-repository-live.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const invitationId = InvitationId.make("44444444-4444-4444-4444-444444444444");
const orgId = OrganizationId.make("55555555-5555-5555-5555-555555555555");
const userId = UserId.make("66666666-6666-6666-6666-666666666666");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.unsafeMake(new Date("2026-01-08T00:00:00Z"));

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

const seed = (): Invitation.Invitation =>
  Invitation.issue({
    id: invitationId,
    organizationId: orgId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const TestLayer = InvitationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("InvitationRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.invitations", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("insert + findById + findByToken", () => {
    it.effect("round-trips an inserted invitation by id and by token", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insert(seed());
        const byId = yield* repo.findById(invitationId);
        deepStrictEqual(byId.id, invitationId);
        const byToken = yield* repo.findByToken("tok-abc");
        deepStrictEqual(byToken.id, invitationId);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("findById fails InvitationNotFound for an unknown id", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        const exit = yield* Effect.exit(repo.findById(invitationId));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof InvitationNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("findByToken fails InvitationTokenNotFound for an unknown token", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        const exit = yield* Effect.exit(repo.findByToken("missing"));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof InvitationTokenNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("persists state transitions (accept sets acceptedAt)", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        yield* repo.insert(seed());
        const accepted = Invitation.accept(seed(), { userId, now });
        if (Either.isLeft(accepted)) throw new Error("expected Right");
        yield* repo.update(accepted.right.invitation);
        const found = yield* repo.findById(invitationId);
        deepStrictEqual(found.acceptedAt !== null, true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("update fails InvitationNotFound when the row is missing", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const repo = yield* InvitationRepository;
        const exit = yield* Effect.exit(repo.update(seed()));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof InvitationNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
