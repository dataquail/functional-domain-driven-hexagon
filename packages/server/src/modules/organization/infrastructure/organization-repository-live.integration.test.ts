import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import { beforeEach } from "vitest";

import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/organization-repository-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z"));

const TestLayer = OrganizationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("OrganizationRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("organization.organizations").pipe(Effect.provide(TestDatabaseLive)),
    );
  });

  describe("insert + findOneById", () => {
    it.effect("round-trips an inserted org", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        const { organization } = Organization.create({ id, name: "Acme", now });
        yield* repo.insertOne(organization);
        const found = yield* repo.findOneById(id);
        deepStrictEqual(found.id, id);
        deepStrictEqual(found.name, "Acme");
        deepStrictEqual(found.deletedAt, null);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("findOneById fails OrganizationNotFound for an unknown id", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        const exit = yield* Effect.exit(repo.findOneById(id));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof OrganizationNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update (soft-delete tombstone)", () => {
    it.effect("findOneById hides a soft-deleted row; findOneByIdIncludingDeleted returns it", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        const { organization } = Organization.create({ id, name: "Acme", now });
        yield* repo.insertOne(organization);
        const deletedEither = Organization.softDelete(organization, { now: later });
        if (Either.isLeft(deletedEither)) throw new Error("expected Right");
        yield* repo.updateOne(deletedEither.right.organization);

        const hiddenExit = yield* Effect.exit(repo.findOneById(id));
        deepStrictEqual(Exit.isFailure(hiddenExit), true);

        const visible = yield* repo.findOneByIdIncludingDeleted(id);
        deepStrictEqual(visible.deletedAt !== null, true);
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("update fails OrganizationNotFound when the row is missing", () =>
      Effect.gen(function* () {
        const repo = yield* OrganizationRepository;
        const { organization } = Organization.create({ id, name: "Acme", now });
        const exit = yield* Effect.exit(repo.updateOne(organization));
        deepStrictEqual(Exit.isFailure(exit), true);
        if (Exit.isFailure(exit)) {
          const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
          deepStrictEqual(error instanceof OrganizationNotFound, true);
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
