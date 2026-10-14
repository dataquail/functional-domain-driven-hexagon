import { deepStrictEqual } from "node:assert";

import { describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import { Spec } from "@/globals/application/ddd/specification.js";
import { OrganizationNotFound } from "@/modules/organization/domain/organization/organization.errors.js";
import { OrganizationRepository } from "@/modules/organization/domain/organization/organization.repository.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.js";
import { OrganizationRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization.repository-live.js";
import { describeIntegration } from "@/test-utils/server-test-runtime.js";
import { TestDatabaseLive } from "@/test-utils/test-database.js";

const activeById = (id: OrganizationId) =>
  Spec.and(OrganizationSpecifications.withId(id), OrganizationSpecifications.notDeleted);

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2026-02-01T00:00:00Z");

const TestLayer = OrganizationRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

describeIntegration(
  "OrganizationRepositoryLive (integration)",
  { layer: TestLayer, tables: ["organization.organizations"] },
  (it) => {
    describe("insert + findOne", () => {
      it.effect("round-trips an inserted org", () =>
        Effect.gen(function* () {
          const repo = yield* OrganizationRepository;
          const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
          yield* repo.insertOne(organization);
          const maybeFound = yield* repo.findOne(activeById(id));

          const found = Option.getOrThrow(maybeFound);
          deepStrictEqual(found.id, id);
          deepStrictEqual(found.name, "Acme");
          assertNone(found.deletedAt);
        }),
      );

      it.effect("findOne returns null for an unknown id", () =>
        Effect.gen(function* () {
          const repo = yield* OrganizationRepository;
          const found = yield* repo.findOne(activeById(id));
          assertNone(found);
        }),
      );
    });

    describe("update (soft-delete tombstone)", () => {
      it.effect("the active-id spec hides a soft-deleted row; withId returns it", () =>
        Effect.gen(function* () {
          const repo = yield* OrganizationRepository;
          const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
          yield* repo.insertOne(organization);

          const deleted = Result.getOrThrow(
            OrganizationRootOps.softDelete(organization, { now: later }),
          );

          yield* repo.updateOne(deleted.organization);

          const hidden = yield* repo.findOne(activeById(id));
          assertNone(hidden);

          const maybeVisible = yield* repo.findOne(OrganizationSpecifications.withId(id));

          const visible = Option.getOrThrow(maybeVisible);
          assertTrue(Option.isSome(visible.deletedAt));
        }),
      );

      it.effect("update fails OrganizationNotFound when the row is missing", () =>
        Effect.gen(function* () {
          const repo = yield* OrganizationRepository;
          const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
          const error = yield* Effect.flip(repo.updateOne(organization));
          deepStrictEqual(Schema.is(OrganizationNotFound)(error), true);
        }),
      );
    });
  },
);
