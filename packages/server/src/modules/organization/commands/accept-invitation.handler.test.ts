import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertDefined, assertTrue } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { InvitationId } from "@/globals/application/ddd/ids/invitation-id.ts";
import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.ts";
import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { Spec } from "@/globals/application/ddd/specification.ts";
import { acceptInvitationHandler } from "@/modules/organization/commands/accept-invitation.handler.ts";
import {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation/invitation.errors.ts";
import { InvitationRepository } from "@/modules/organization/domain/invitation/invitation.repository.ts";
import { type InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.ts";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.ts";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.ts";
import { type MembershipCreated } from "@/modules/organization/domain/membership/membership.events.ts";
import { MembershipRepository } from "@/modules/organization/domain/membership/membership.repository.ts";
import { MembershipSpecifications } from "@/modules/organization/domain/membership/membership.specification.ts";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization/organization.errors.ts";
import { makePlatformRolesFake } from "@/modules/organization/infrastructure/acl/platform-roles.acl-fake.ts";
import { InvitationRepositoryFake } from "@/modules/organization/infrastructure/repositories/invitation.repository-fake.ts";
import { MembershipRepositoryFake } from "@/modules/organization/infrastructure/repositories/membership.repository-fake.ts";
import { RecordedEvents, RecordingEventBus } from "@/test-utils/recording-event-bus.ts";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const organizationId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const superAdminUserId = UserId.make("ssssssss-ssss-ssss-ssss-ssssssssssss");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const inOneWeek = DateTime.makeUnsafe("2026-01-08T00:00:00Z");

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt: inOneWeek,
    now,
  }).invitation;

const TestLayer = Layer.mergeAll(
  InvitationRepositoryFake,
  MembershipRepositoryFake,
  RecordingEventBus,
  PassThroughUnitOfWork,
  // Default: caller is a regular user. The super-admin-rejection test
  // composes its own PlatformRoles fake.
  makePlatformRolesFake(),
);

describe("acceptInvitationHandler", () => {
  it.effect("creates the membership, marks invitation accepted, dispatches both events", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const members = yield* MembershipRepository;
      const rec = yield* RecordedEvents;
      yield* inv.insertOne(seed());

      const orgId = yield* acceptInvitationHandler({ token: "tok-abc", userId });
      deepStrictEqual(orgId, organizationId);

      const maybeUpdated = yield* inv.findOne(InvitationSpecifications.withId(invitationId));

      const updated = Option.getOrThrow(maybeUpdated);
      assertTrue(Option.isSome(updated.acceptedAt));

      const maybeMembership = yield* members.findOne(
        Spec.and(
          MembershipSpecifications.forUser(userId),
          MembershipSpecifications.forOrganization(organizationId),
        ),
      );

      const membership = Option.getOrThrow(maybeMembership);
      deepStrictEqual(membership.userId, userId);

      const tags = (yield* rec.all).map((e) => e._tag);
      deepStrictEqual(tags.includes("InvitationAccepted"), true);
      deepStrictEqual(tags.includes("MembershipCreated"), true);

      const memberEvents = yield* rec.byTag<MembershipCreated>("MembershipCreated");
      const event = memberEvents[0];

      assertDefined(event);
      deepStrictEqual(event.userId, userId);
      deepStrictEqual(event.organizationId, organizationId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationTokenNotFound when no invitation matches the token", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(acceptInvitationHandler({ token: "missing", userId }));
      deepStrictEqual(Schema.is(InvitationTokenNotFound)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationAlreadyAccepted on a second accept", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const accepted = Result.getOrThrow(InvitationRootOps.accept(seed(), { userId, now }));
      yield* inv.insertOne(accepted.invitation);

      const error = yield* Effect.flip(acceptInvitationHandler({ token: "tok-abc", userId }));
      deepStrictEqual(Schema.is(InvitationAlreadyAccepted)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails InvitationRevoked when the invitation was revoked", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      const revoked = Result.getOrThrow(InvitationRootOps.revoke(seed(), { now }));
      yield* inv.insertOne(revoked.invitation);

      const error = yield* Effect.flip(acceptInvitationHandler({ token: "tok-abc", userId }));
      deepStrictEqual(Schema.is(InvitationRevoked)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  // `it.live` because `DateTime.now` inside the handler needs to read the
  // real wall clock — `it.effect`'s TestClock starts at the Unix epoch,
  // which would make a 2020-expiry NOT look expired.
  it.live("fails InvitationExpired when the invitation has expired", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;

      const expired = InvitationRootOps.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "alice@example.com",
        token: "tok-abc",
        expiresAt: DateTime.makeUnsafe("2020-01-01T00:00:00Z"),
        now: DateTime.makeUnsafe("2019-12-01T00:00:00Z"),
      }).invitation;

      yield* inv.insertOne(expired);

      const error = yield* Effect.flip(acceptInvitationHandler({ token: "tok-abc", userId }));
      deepStrictEqual(Schema.is(InvitationExpired)(error), true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("rejects with SuperAdminCannotOwnOrganization when caller is a super-admin", () =>
    Effect.gen(function* () {
      const inv = yield* InvitationRepository;
      yield* inv.insertOne(seed());

      const error = yield* Effect.flip(
        acceptInvitationHandler({ token: "tok-abc", userId: superAdminUserId }),
      );

      deepStrictEqual(Schema.is(SuperAdminCannotOwnOrganization)(error), true);
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          InvitationRepositoryFake,
          MembershipRepositoryFake,
          RecordingEventBus,
          PassThroughUnitOfWork,
          makePlatformRolesFake(new Set([superAdminUserId])),
        ),
      ),
    ),
  );
});
