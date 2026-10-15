import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id";

import { OrganizationAlreadyDeleted, OrganizationNotDeleted } from "./organization.errors";
import { type OrganizationEvent } from "./organization.events";
import { OrganizationRootOps } from "./organization.root-ops";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2026-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2026-02-01T00:00:00Z");

const expectEvent = <T extends OrganizationEvent["_tag"]>(
  events: ReadonlyArray<OrganizationEvent>,
  tag: T,
): Extract<OrganizationEvent, { _tag: T }> =>
  Option.getOrThrow(
    Option.filter(Arr.head(events), (event): event is Extract<OrganizationEvent, { _tag: T }> =>
      Predicate.isTagged(event, tag),
    ),
  );

describe("OrganizationRootOps.create", () => {
  it("sets id, name, timestamps; deletedAt is None", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(organization.id, id);
    deepStrictEqual(organization.name, "Acme");
    deepStrictEqual(organization.createdAt, now);
    deepStrictEqual(organization.updatedAt, now);
    assertNone(organization.deletedAt);
  });

  it("emits OrganizationCreated", () => {
    const { events } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "OrganizationCreated");
    deepStrictEqual(event.organizationId, id);
    deepStrictEqual(event.name, "Acme");
  });
});

describe("OrganizationRootOps.softDelete", () => {
  const seed = () => OrganizationRootOps.create({ id, name: "Acme", now }).organization;

  it("sets deletedAt and updatedAt; emits OrganizationSoftDeleted", () => {
    const result = Result.getOrThrow(OrganizationRootOps.softDelete(seed(), { now: later }));
    deepStrictEqual(result.organization.deletedAt, Option.some(later));
    deepStrictEqual(result.organization.updatedAt, later);
    const event = expectEvent(result.events, "OrganizationSoftDeleted");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationAlreadyDeleted when the org is already soft-deleted", () => {
    const first = Result.getOrThrow(OrganizationRootOps.softDelete(seed(), { now: later }));
    const second = OrganizationRootOps.softDelete(first.organization, { now: later });
    deepStrictEqual(Result.isFailure(second), true);

    if (Result.isFailure(second)) {
      deepStrictEqual(Schema.is(OrganizationAlreadyDeleted)(second.failure), true);
    }
  });
});

describe("OrganizationRootOps.restore", () => {
  const seed = () => OrganizationRootOps.create({ id, name: "Acme", now }).organization;

  const deleted = () => {
    const result = Result.getOrThrow(OrganizationRootOps.softDelete(seed(), { now: later }));

    return result.organization;
  };

  it("clears deletedAt and emits OrganizationRestored", () => {
    const restored = Result.getOrThrow(OrganizationRootOps.restore(deleted(), { now: later }));
    assertNone(restored.organization.deletedAt);
    const event = expectEvent(restored.events, "OrganizationRestored");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationNotDeleted when the org isn't deleted", () => {
    const result = OrganizationRootOps.restore(seed(), { now: later });
    deepStrictEqual(Result.isFailure(result), true);

    if (Result.isFailure(result)) {
      deepStrictEqual(Schema.is(OrganizationNotDeleted)(result.failure), true);
    }
  });
});
