import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";

import * as Invitation from "@/modules/organization/domain/invitation.aggregate.js";
import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation-errors.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation-repository.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

import { InvitationRepositoryFake } from "./invitation-repository-fake.js";

const invitationId = InvitationId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const userId = UserId.make("33333333-3333-3333-3333-333333333333");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const expiresAt = DateTime.unsafeMake(new Date("2026-01-08T00:00:00Z"));

const seed = (): Invitation.Invitation =>
  Invitation.issue({
    id: invitationId,
    organizationId: orgId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const provide = Effect.provide(InvitationRepositoryFake);

describe("InvitationRepositoryFake", () => {
  it.effect("findById round-trips an inserted invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insert(seed());
      const found = yield* repo.findById(invitationId);
      deepStrictEqual(found.id, invitationId);
      deepStrictEqual(found.token, "tok-abc");
    }).pipe(provide),
  );

  it.effect("findByToken returns the matching invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insert(seed());
      const found = yield* repo.findByToken("tok-abc");
      deepStrictEqual(found.id, invitationId);
    }).pipe(provide),
  );

  it.effect("findById fails InvitationNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.findById(invitationId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("findByToken fails InvitationTokenNotFound when no row matches", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.findByToken("missing"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationTokenNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("update persists state transitions", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insert(seed());
      const accepted = Invitation.accept(seed(), { userId, now });
      if (Either.isLeft(accepted)) throw new Error("expected Right");
      yield* repo.update(accepted.right.invitation);
      const found = yield* repo.findById(invitationId);
      deepStrictEqual(found.acceptedAt !== null, true);
    }).pipe(provide),
  );

  it.effect("update fails InvitationNotFound when the row is missing", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.update(seed()));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof InvitationNotFound, true);
      }
    }).pipe(provide),
  );
});
