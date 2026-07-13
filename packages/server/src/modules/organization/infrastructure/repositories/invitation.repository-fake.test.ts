import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.js";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRepositoryFake } from "./invitation.repository-fake.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.makeUnsafe(new Date("2026-01-08T00:00:00Z"));

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId: orgId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const provide = Effect.provide(InvitationRepositoryFake);

describe("InvitationRepositoryFake", () => {
  it.effect("findOne(withId) round-trips an inserted invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const found = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      if (found === null) throw new Error("expected invitation");
      deepStrictEqual(found.id, invitationId);
      deepStrictEqual(found.token, "tok-abc");
    }).pipe(provide),
  );

  it.effect("findOne(withToken) returns the matching invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const found = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
      if (found === null) throw new Error("expected invitation");
      deepStrictEqual(found.id, invitationId);
    }).pipe(provide),
  );

  it.effect("findOne returns null when no row matches (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      const byToken = yield* repo.findOne(InvitationSpecifications.withToken("missing"));
      deepStrictEqual(byId, null);
      deepStrictEqual(byToken, null);
    }).pipe(provide),
  );

  it.effect("findOne(isOpen) narrows to open invitations", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const revoked = InvitationRootOps.revoke(seed(), { now });
      if (Result.isFailure(revoked)) throw new Error("expected Right");
      yield* repo.updateOne(revoked.success.invitation);
      const open = yield* repo.findOne(InvitationSpecifications.isOpen);
      deepStrictEqual(open, null);
    }).pipe(provide),
  );

  it.effect("update persists state transitions", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const accepted = InvitationRootOps.accept(seed(), { userId, now });
      if (Result.isFailure(accepted)) throw new Error("expected Right");
      yield* repo.updateOne(accepted.success.invitation);
      const found = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      if (found === null) throw new Error("expected invitation");
      deepStrictEqual(found.acceptedAt !== null, true);
    }).pipe(provide),
  );

  it.effect("update fails InvitationNotFound when the row is missing", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.updateOne(seed()));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof InvitationNotFound, true);
      }
    }).pipe(provide),
  );
});
