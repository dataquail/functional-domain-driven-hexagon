import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.ts";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { InvitationNotFound } from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.ts";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.ts";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.ts";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.ts";

import { InvitationRepositoryFake } from "./invitation.repository-fake.ts";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const expiresAt = DateTime.makeUnsafe("2026-01-08T00:00:00Z");

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
      const maybeFound = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      const found = Option.getOrThrow(maybeFound);
      deepStrictEqual(found.id, invitationId);
      deepStrictEqual(found.token, "tok-abc");
    }).pipe(provide),
  );

  it.effect("findOne(withToken) returns the matching invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const maybeFound = yield* repo.findOne(InvitationSpecifications.withToken("tok-abc"));
      const found = Option.getOrThrow(maybeFound);
      deepStrictEqual(found.id, invitationId);
    }).pipe(provide),
  );

  it.effect("findOne returns null when no row matches (absence is not an error)", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const byId = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      const byToken = yield* repo.findOne(InvitationSpecifications.withToken("missing"));
      assertNone(byId);
      assertNone(byToken);
    }).pipe(provide),
  );

  it.effect("findOne(isOpen) narrows to open invitations", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const revoked = Result.getOrThrow(InvitationRootOps.revoke(seed(), { now }));
      yield* repo.updateOne(revoked.invitation);
      const open = yield* repo.findOne(InvitationSpecifications.isOpen);
      assertNone(open);
    }).pipe(provide),
  );

  it.effect("update persists state transitions", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const accepted = Result.getOrThrow(InvitationRootOps.accept(seed(), { userId, now }));
      yield* repo.updateOne(accepted.invitation);
      const maybeFound = yield* repo.findOne(InvitationSpecifications.withId(invitationId));
      const found = Option.getOrThrow(maybeFound);
      assertTrue(Option.isSome(found.acceptedAt));
    }).pipe(provide),
  );

  it.effect("update fails InvitationNotFound when the row is missing", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const error = yield* Effect.flip(repo.updateOne(seed()));
      deepStrictEqual(Schema.is(InvitationNotFound)(error), true);
    }).pipe(provide),
  );
});
