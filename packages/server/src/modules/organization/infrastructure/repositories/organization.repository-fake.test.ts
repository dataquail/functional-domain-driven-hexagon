import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { Spec } from "@/globals/application/ddd/specification.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.js";

import { OrganizationRepositoryFake } from "./organization.repository-fake.js";

const activeById = (id: OrganizationId) =>
  Spec.and(OrganizationSpecifications.withId(id), OrganizationSpecifications.notDeleted);

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2026-02-01T00:00:00Z");
const provide = Effect.provide(OrganizationRepositoryFake);

describe("OrganizationRepositoryFake", () => {
  it.effect("findOne by active-id spec round-trips an inserted org", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      yield* repo.insertOne(organization);
      const maybeFound = yield* repo.findOne(activeById(id));
      const found = Option.getOrThrow(maybeFound);
      deepStrictEqual(found.id, id);
      deepStrictEqual(found.name, "Acme");
    }).pipe(provide),
  );

  it.effect("the active-id spec hides soft-deleted rows", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      yield* repo.insertOne(organization);

      const deleted = Result.getOrThrow(
        OrganizationRootOps.softDelete(organization, { now: later }),
      );

      yield* repo.updateOne(deleted.organization);
      const found = yield* repo.findOne(activeById(id));
      assertNone(found);
    }).pipe(provide),
  );

  it.effect("the withId spec returns soft-deleted rows", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      yield* repo.insertOne(organization);

      const deleted = Result.getOrThrow(
        OrganizationRootOps.softDelete(organization, { now: later }),
      );

      yield* repo.updateOne(deleted.organization);
      const maybeFound = yield* repo.findOne(OrganizationSpecifications.withId(id));
      const found = Option.getOrThrow(maybeFound);
      assertTrue(Option.isSome(found.deletedAt));
    }).pipe(provide),
  );

  it.effect("update fails OrganizationNotFound when the org isn't stored", () =>
    Effect.gen(function* () {
      const repo = yield* OrganizationRepository;
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      const error = yield* Effect.flip(repo.updateOne(organization));
      deepStrictEqual(Schema.is(OrganizationNotFound)(error), true);
    }).pipe(provide),
  );
});
