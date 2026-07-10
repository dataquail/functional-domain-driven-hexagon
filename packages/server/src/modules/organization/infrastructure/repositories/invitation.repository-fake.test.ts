import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Result from "effect/Result";

import {
  InvitationNotFound,
  InvitationTokenNotFound,
} from "@/modules/organization/domain/invitation.errors.js";
import { type InvitationRoot } from "@/modules/organization/domain/invitation.root.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation.root-ops.js";
import { InvitationRepository } from "@/modules/organization/domain/ports/repositories/invitation.repository.js";
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
  it.effect("findOneById round-trips an inserted invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const found = yield* repo.findOneById(invitationId);
      deepStrictEqual(found.id, invitationId);
      deepStrictEqual(found.token, "tok-abc");
    }).pipe(provide),
  );

  it.effect("findOneByToken returns the matching invitation", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const found = yield* repo.findOneByToken("tok-abc");
      deepStrictEqual(found.id, invitationId);
    }).pipe(provide),
  );

  it.effect("findOneById fails InvitationNotFound when absent", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.findOneById(invitationId));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof InvitationNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("findOneByToken fails InvitationTokenNotFound when no row matches", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      const exit = yield* Effect.exit(repo.findOneByToken("missing"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof InvitationTokenNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("update persists state transitions", () =>
    Effect.gen(function* () {
      const repo = yield* InvitationRepository;
      yield* repo.insertOne(seed());
      const accepted = InvitationRootOps.accept(seed(), { userId, now });
      if (Result.isFailure(accepted)) throw new Error("expected Right");
      yield* repo.updateOne(accepted.success.invitation);
      const found = yield* repo.findOneById(invitationId);
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
