import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Exit from "effect/Exit";

import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization-errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRepositoryFake } from "./organization-repository-fake.js";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z"));
const provide = Effect.provide(OrganizationRepositoryFake);

describe("OrganizationRepositoryFake", () => {
  it.effect("findById round-trips an inserted org", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = Organization.create({ id, name: "Acme", now });
      yield* repo.insert(organization);
      const found = yield* repo.findById(id);
      deepStrictEqual(found.id, id);
      deepStrictEqual(found.name, "Acme");
    }).pipe(provide),
  );

  it.effect("findById hides soft-deleted rows", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = Organization.create({ id, name: "Acme", now });
      yield* repo.insert(organization);
      const deletedEither = Organization.softDelete(organization, { now: later });
      if (Either.isLeft(deletedEither)) throw new Error("expected Right");
      yield* repo.update(deletedEither.right.organization);
      const exit = yield* Effect.exit(repo.findById(id));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotFound, true);
      }
    }).pipe(provide),
  );

  it.effect("findByIdIncludingDeleted returns soft-deleted rows", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = Organization.create({ id, name: "Acme", now });
      yield* repo.insert(organization);
      const deletedEither = Organization.softDelete(organization, { now: later });
      if (Either.isLeft(deletedEither)) throw new Error("expected Right");
      yield* repo.update(deletedEither.right.organization);
      const found = yield* repo.findByIdIncludingDeleted(id);
      deepStrictEqual(found.deletedAt !== null, true);
    }).pipe(provide),
  );

  it.effect("update fails OrganizationNotFound when the org isn't stored", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = Organization.create({ id, name: "Acme", now });
      const exit = yield* Effect.exit(repo.update(organization));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof OrganizationNotFound, true);
      }
    }).pipe(provide),
  );
});
